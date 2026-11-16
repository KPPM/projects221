begin;

create table public.google_places_monthly_usage (
    billing_month date not null,
    sku text not null check (sku in ('search', 'details', 'photo')),
    used integer not null check (used >= 0),
    primary key (billing_month, sku)
);
alter table public.google_places_monthly_usage enable row level security;
revoke all on public.google_places_monthly_usage from public, anon, authenticated;

-- Freeze concurrent reservations against the old counter during the cutover.
lock table public.google_places_usage in access exclusive mode;
insert into public.google_places_monthly_usage (billing_month, sku, used)
select date_trunc('month', now() at time zone 'America/Los_Angeles')::date, sku, used
from public.google_places_usage;

create or replace function public.reserve_google_places_request(p_sku text, p_limit integer)
returns boolean
language sql
security definer
set search_path = ''
as $$
    with budget as (
        select least(p_limit, case p_sku
            when 'search' then 54
            when 'details' then 60
            when 'photo' then 500
        end) as cap
        where p_sku in ('search', 'details', 'photo') and p_limit > 0
    ), reserved as (
        insert into public.google_places_monthly_usage as usage (billing_month, sku, used)
        select date_trunc('month', now() at time zone 'America/Los_Angeles')::date, p_sku, 1
        from budget where cap > 0
        on conflict (billing_month, sku) do update
        set used = usage.used + 1
        where usage.used < (select cap from budget)
        returning 1
    )
    select exists (select from reserved)
$$;
revoke all on function public.reserve_google_places_request(text, integer) from public, anon, authenticated;
grant execute on function public.reserve_google_places_request(text, integer) to service_role;

commit;
