-- Run as a project administrator after the migration. These queries only read.
-- Confirm flagged rows against the original source before changing any values.
-- For a known fixture, set places.is_mock = true by its verified id.
with source as (
    select p.id, p.name, p.is_mock, to_jsonb(p) as row_data from public.places as p
), fields as (
    select id, name, is_mock,
        coalesce(nullif(row_data ->> 'google_map', ''), row_data ->> 'google map') as map_url,
        row_data ->> 'address' as address,
        row_data ->> 'lat' as lat,
        row_data ->> 'lng' as lng,
        coalesce(nullif(row_data ->> 'price_range', ''), row_data ->> 'price') as price,
        row_data ->> 'features' as features,
        coalesce(nullif(row_data ->> 'open', ''), nullif(row_data ->> 'open_time', ''), row_data ->> 'opening_time') as opens,
        coalesce(nullif(row_data ->> 'close', ''), nullif(row_data ->> 'close_time', ''), row_data ->> 'closing_time') as closes,
        coalesce(nullif(row_data ->> 'open_close', ''), row_data ->> 'open-close') as hours_label,
        coalesce(nullif(row_data ->> 'image_url', ''), nullif(row_data ->> 'image', ''),
                 nullif(row_data ->> 'photo_url', ''), row_data ->> 'รูป') as image_url
    from source
), inputs as (
    select fields.*,
        coalesce(regexp_match(trim(lat) || ',' || trim(lng), '^(-?[0-9]+(?:[.][0-9]+)?),(-?[0-9]+(?:[.][0-9]+)?)$'),
                 regexp_match(map_url, '!3d(-?[0-9]+[.][0-9]+)!4d(-?[0-9]+[.][0-9]+)'),
                 regexp_match(map_url, '(?:query=|q=|@)(-?[0-9]+[.][0-9]+),[[:space:]]*(-?[0-9]+[.][0-9]+)'),
                 regexp_match(address, '[(](-?[0-9]+[.][0-9]+),[[:space:]]*(-?[0-9]+[.][0-9]+)[)]')) as coords
    from fields
)
select id, name, is_mock, map_url, address, coords[1] as latitude, coords[2] as longitude,
    price, features, opens, closes, hours_label, image_url,
    array_remove(array[
        case when nullif(btrim(name), '') is null then 'missing_name' end,
        case when coords is null or abs(coords[1]::numeric) > 90 or abs(coords[2]::numeric) > 180
            then 'check_coordinates' end,
        case when coalesce(btrim(price), '') !~ '([0-9]|^[$]{1,3}$)' then 'check_price' end,
        case when coalesce(btrim(opens), '') !~ '^(0?[0-9]|1[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
            or coalesce(btrim(closes), '') !~ '^(0?[0-9]|1[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
            then 'check_hours' end,
        case when coalesce(btrim(image_url), '') !~* '^https?://' then 'check_image_url' end
    ], null) as issues
from inputs
order by id;

select id, title, start_at, end_at, to_jsonb(e) ->> 'dateTime' as original_date_label
from public.events as e
where public.event_status(e) = 'pending'
order by id;
