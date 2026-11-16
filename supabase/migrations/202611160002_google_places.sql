alter table public.places add column if not exists google_place_id text;

-- Keep a cumulative counter. It only resets through an explicit admin action,
-- after checking the billing account's remaining allowance.
create table public.google_places_usage (
    sku text primary key check (sku in ('details', 'photo')),
    used integer not null default 0 check (used >= 0)
);
alter table public.google_places_usage enable row level security;
revoke all on public.google_places_usage from public, anon, authenticated;

create function public.reserve_google_places_request(p_sku text, p_limit integer)
returns boolean
language sql
security definer
set search_path = ''
as $$
    with reserved as (
        insert into public.google_places_usage as usage (sku, used)
        select p_sku, 1
        where p_sku in ('details', 'photo') and p_limit between 1 and 386
        on conflict (sku) do update
        set used = usage.used + 1
        where usage.used < p_limit
        returning sku
    )
    select exists (select from reserved)
$$;
revoke all on function public.reserve_google_places_request(text, integer) from public, anon, authenticated;
grant execute on function public.reserve_google_places_request(text, integer) to service_role;
