begin;

create or replace function public.reserve_google_places_request(p_sku text, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    month_start date := date_trunc('month', now() at time zone 'America/Los_Angeles')::date;
    unit_cost integer := case p_sku when 'search' then 32 when 'details' then 20 when 'photo' then 7 end;
    sku_cap integer := least(p_limit, case when p_sku = 'search' then 54 else 500 end);
    sku_used integer;
    month_cost bigint;
begin
    if unit_cost is null or p_limit is null or sku_cap <= 0 then return false; end if;

    -- Serialize all three SKUs against a shared budget. Price each request at
    -- the first paid tier, ignoring free usage. 11,000 milli-USD is USD 11.
    perform pg_advisory_xact_lock(221, 500);
    select coalesce(sum(used::bigint * case sku when 'search' then 32 when 'details' then 20 when 'photo' then 7 end), 0),
           coalesce(max(used) filter (where sku = p_sku), 0)
    into month_cost, sku_used
    from public.google_places_monthly_usage where billing_month = month_start;

    if sku_used >= sku_cap or month_cost + unit_cost > 11000 then return false; end if;

    insert into public.google_places_monthly_usage as usage (billing_month, sku, used)
    values (month_start, p_sku, 1)
    on conflict (billing_month, sku) do update set used = usage.used + 1;
    return true;
end;
$$;

revoke all on function public.reserve_google_places_request(text, integer) from public, anon, authenticated;
grant execute on function public.reserve_google_places_request(text, integer) to service_role;

commit;
