begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

select has_view('public', 'building_catalog_view', 'catalog view exists');
select has_view('public', 'my_town_details_view', 'my town view exists');
select has_view('public', 'public_town_details_view', 'public town view exists');
select has_view('public', 'population_ranking_view', 'ranking view exists');

select ok(
  (select 'security_invoker=true' = any(coalesce(c.reloptions, '{}'::text[]))
   from pg_catalog.pg_class c
   where c.oid = 'public.building_catalog_view'::regclass),
  'catalog view uses security_invoker'
);
select ok(
  (select 'security_invoker=true' = any(coalesce(c.reloptions, '{}'::text[]))
   from pg_catalog.pg_class c
   where c.oid = 'public.my_town_details_view'::regclass),
  'my town view uses security_invoker'
);
select ok(
  (select 'security_invoker=true' = any(coalesce(c.reloptions, '{}'::text[]))
   from pg_catalog.pg_class c
   where c.oid = 'public.public_town_details_view'::regclass),
  'public town view uses security_invoker'
);
select ok(
  (select 'security_invoker=true' = any(coalesce(c.reloptions, '{}'::text[]))
   from pg_catalog.pg_class c
   where c.oid = 'public.population_ranking_view'::regclass),
  'ranking view uses security_invoker'
);

select has_function('private', 'recalculate_town_population', array['uuid'], 'population recalculation exists');
select has_function('public', 'current_town_coins', array['uuid'], 'safe balance accessor exists');
select col_type_is('public', 'map_layouts', 'id', 'text', 'map layout id is text');
select col_type_is('public', 'towns', 'map_layout_id', 'text', 'town layout reference is text');
select col_type_is('public', 'coin_ledger', 'metadata', 'jsonb', 'ledger metadata is jsonb');
select col_type_is('public', 'unlocked_areas', 'unlocked_at', 'timestamp with time zone', 'unlock time is timestamptz');
select hasnt_column('public', 'building_effects', 'description', 'effect description is not stored');

select is((select count(*) from public.building_types), 9::bigint, 'seed has nine formal catalog rows');
select is((select count(*) from public.building_effects), 9::bigint, 'residential, farm, park, hospital, and town-hall population effects are seeded');
select is((select count(*) from public.building_effects where effect_type not in ('population_flat', 'adjacent_small_house_population_flat', 'adjacent_apartment_population_flat', 'small_house_population_flat', 'apartment_population_flat')), 0::bigint, 'only supported population effects remain');
select is((select value from public.building_effects where building_type_code = 'farm' and effect_type = 'population_flat'), 20::numeric, 'farm adds twenty population');
select is((select value from public.building_effects where building_type_code = 'small_park' and effect_type = 'adjacent_small_house_population_flat'), 5::numeric, 'park adds five population per adjacent small house');
select is((select value from public.building_effects where building_type_code = 'small_park' and effect_type = 'adjacent_apartment_population_flat'), 10::numeric, 'park adds ten population per adjacent apartment');
select is((select value from public.building_effects where building_type_code = 'hospital' and effect_type = 'small_house_population_flat'), 5::numeric, 'hospital adds five population per small house');
select is((select value from public.building_effects where building_type_code = 'hospital' and effect_type = 'apartment_population_flat'), 10::numeric, 'hospital adds ten population per apartment');
select is((select value from public.building_effects where building_type_code = 'town_hall' and effect_type = 'small_house_population_flat'), 20::numeric, 'town hall adds twenty population per small house');
select is((select value from public.building_effects where building_type_code = 'town_hall' and effect_type = 'apartment_population_flat'), 30::numeric, 'town hall adds thirty population per apartment');
select is(has_table_privilege('anon', 'public.building_types', 'SELECT'), false, 'anonymous catalog access is disabled');
select is(has_column_privilege('authenticated', 'public.towns', 'coins', 'SELECT'), false, 'authenticated users cannot query base coins');
select is(has_table_privilege('authenticated', 'public.building_catalog_view', 'SELECT'), true, 'authenticated users can query catalog view');

select * from finish();
rollback;
