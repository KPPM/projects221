begin;

alter table public.places
    add column if not exists google_place_lookup_after timestamptz;

alter table public.google_places_usage drop constraint if exists google_places_usage_sku_check;
alter table public.google_places_usage
    add constraint google_places_usage_sku_check check (sku in ('search', 'details', 'photo'));

-- Preserve the existing counters. Increasing a secret increases the absolute
-- allowance; it does not reset consumption already recorded.
create or replace function public.reserve_google_places_request(p_sku text, p_limit integer)
returns boolean
language sql
security definer
set search_path = ''
as $$
    with reserved as (
        insert into public.google_places_usage as usage (sku, used)
        select p_sku, 1
        where p_sku in ('search', 'details', 'photo') and p_limit between 1 and 1000
        on conflict (sku) do update
        set used = usage.used + 1
        where usage.used < p_limit
        returning sku
    )
    select exists (select from reserved)
$$;
revoke all on function public.reserve_google_places_request(text, integer) from public, anon, authenticated;
grant execute on function public.reserve_google_places_request(text, integer) to service_role;

-- Serialize first-time searches per restaurant and reserve quota before the API call.
create function public.reserve_google_place_search(p_place bigint, p_limit integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
    saved_id text;
    lookup_after timestamptz;
begin
    select google_place_id, google_place_lookup_after into saved_id, lookup_after
    from public.places where id = p_place and not is_mock for update;

    if not found then return 'no_place_id'; end if;
    if btrim(saved_id) ~ '^[A-Za-z0-9_-]{8,300}$' then return 'already_linked'; end if;
    if lookup_after > now() then return 'lookup_cooldown'; end if;
    if not public.reserve_google_places_request('search', p_limit) then return 'search_quota'; end if;

    update public.places
    set google_place_lookup_after = now() + interval '1 day'
    where id = p_place;
    return 'reserved';
end;
$$;
revoke all on function public.reserve_google_place_search(bigint, integer) from public, anon, authenticated;
grant execute on function public.reserve_google_place_search(bigint, integer) to service_role;

notify pgrst, 'reload schema';
commit;
