begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

select is(
  (select count(*) from public.building_effects
   where building_type_code = 'small_park'
     and effect_type = 'adjacent_small_house_population_flat'),
  1::bigint,
  'park has exactly one adjacent small-house population effect'
);
select is(
  (select value from public.building_effects
   where building_type_code = 'small_park'
     and effect_type = 'adjacent_small_house_population_flat'),
  5::numeric,
  'park adds five population per adjacent small house'
);
select is(
  (select count(*) from public.building_effects
   where building_type_code = 'small_park'
     and effect_type = 'adjacent_apartment_population_flat'),
  1::bigint,
  'park has exactly one adjacent apartment population effect'
);
select is(
  (select value from public.building_effects
   where building_type_code = 'small_park'
     and effect_type = 'adjacent_apartment_population_flat'),
  10::numeric,
  'park adds ten population per adjacent apartment'
);

insert into auth.users (id, email)
values ('e0000000-0000-4000-8000-000000000001', 'park-effect@example.test');
insert into public.profiles (id, display_name)
values ('e0000000-0000-4000-8000-000000000001', 'Park Effect User');
insert into public.towns (town_id, owner_id, name, coins, population)
values (
  'e1000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000001',
  'Park Effect Town', 3000, 0
);
insert into public.unlocked_areas (
  town_id, x, y, width, height, unlocked_at, unlock_method
) values (
  'e1000000-0000-4000-8000-000000000001',
  40, 40, 20, 20, '2026-08-30T00:00:00Z', 'initial'
);

select set_config('request.jwt.claim.sub', 'e0000000-0000-4000-8000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"e0000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

create temporary table park_effect_results (name text primary key, value jsonb);

insert into park_effect_results values (
  'road',
  public.place_road_line(
    'road',
    '[{"x":40,"y":45},{"x":41,"y":45},{"x":42,"y":45},{"x":43,"y":45},{"x":44,"y":45},{"x":45,"y":45}]'::jsonb,
    'e2000000-0000-4000-8000-000000000001'
  )
);
select is((select value->>'ok' from park_effect_results where name = 'road'), 'true', 'road placement succeeds');

insert into park_effect_results values (
  'house',
  public.place_building(
    'small_house', 41, 44,
    'e2000000-0000-4000-8000-000000000002'
  )
);
select is((select value->>'ok' from park_effect_results where name = 'house'), 'true', 'small house placement succeeds');
select is((select value->'data'->>'population' from park_effect_results where name = 'house'), '10', 'small house starts at population ten');

insert into park_effect_results values (
  'first_park',
  public.place_building(
    'small_park', 42, 44,
    'e2000000-0000-4000-8000-000000000003'
  )
);
select is((select value->>'ok' from park_effect_results where name = 'first_park'), 'true', 'first adjacent park placement succeeds');
select is((select value->'data'->>'population' from park_effect_results where name = 'first_park'), '15', 'first adjacent park adds five population');

insert into park_effect_results values (
  'second_park',
  public.place_building(
    'small_park', 40, 44,
    'e2000000-0000-4000-8000-000000000004'
  )
);
select is((select value->>'ok' from park_effect_results where name = 'second_park'), 'true', 'second adjacent park placement succeeds');
select is((select value->'data'->>'population' from park_effect_results where name = 'second_park'), '15', 'the same house receives the park bonus only once');
select is((select population from public.towns where town_id = 'e1000000-0000-4000-8000-000000000001'), 15::bigint, 'deduplicated park population is stored');

insert into park_effect_results values (
  'move_house',
  public.move_building(
    (select (value->'data'->'building'->>'id')::uuid from park_effect_results where name = 'house'),
    44, 44,
    'e2000000-0000-4000-8000-000000000005'
  )
);
select is((select value->>'ok' from park_effect_results where name = 'move_house'), 'true', 'moving the small house succeeds');
select is((select value->'data'->>'population' from park_effect_results where name = 'move_house'), '10', 'moving away removes the park bonus');
select is((select population from public.towns where town_id = 'e1000000-0000-4000-8000-000000000001'), 10::bigint, 'population after moving is stored');

insert into park_effect_results values (
  'apartment',
  public.place_building(
    'apartment', 43, 46,
    'e2000000-0000-4000-8000-000000000006'
  )
);
select is((select value->>'ok' from park_effect_results where name = 'apartment'), 'true', 'apartment placement succeeds');
select is((select value->'data'->>'population' from park_effect_results where name = 'apartment'), '60', 'apartment raises the base population to sixty');

insert into park_effect_results values (
  'first_apartment_park',
  public.place_building(
    'small_park', 42, 46,
    'e2000000-0000-4000-8000-000000000007'
  )
);
select is((select value->>'ok' from park_effect_results where name = 'first_apartment_park'), 'true', 'first park beside the apartment succeeds');
select is((select value->'data'->>'population' from park_effect_results where name = 'first_apartment_park'), '70', 'park adds ten for an adjacent apartment');

insert into park_effect_results values (
  'second_apartment_park',
  public.place_building(
    'small_park', 45, 46,
    'e2000000-0000-4000-8000-000000000008'
  )
);
select is((select value->>'ok' from park_effect_results where name = 'second_apartment_park'), 'true', 'second park beside the apartment succeeds');
select is((select value->'data'->>'population' from park_effect_results where name = 'second_apartment_park'), '70', 'the same apartment receives the park bonus only once');
select is((select population from public.towns where town_id = 'e1000000-0000-4000-8000-000000000001'), 70::bigint, 'deduplicated apartment park population is stored');

select is((select coins from public.towns where town_id = 'e1000000-0000-4000-8000-000000000001'), 2150::bigint, 'park retains the existing one-hundred-fifty coin price');

select * from finish();
rollback;
