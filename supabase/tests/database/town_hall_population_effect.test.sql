begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

select is(
  (select count(*) from public.building_effects
   where building_type_code = 'town_hall'
     and effect_type = 'small_house_population_flat'),
  1::bigint,
  'town hall has exactly one small-house population effect'
);
select is(
  (select value from public.building_effects
   where building_type_code = 'town_hall'
     and effect_type = 'small_house_population_flat'),
  20::numeric,
  'town hall adds twenty population per small house'
);
select is(
  (select count(*) from public.building_effects
   where building_type_code = 'town_hall'
     and effect_type = 'apartment_population_flat'),
  1::bigint,
  'town hall has exactly one apartment population effect'
);
select is(
  (select value from public.building_effects
   where building_type_code = 'town_hall'
     and effect_type = 'apartment_population_flat'),
  30::numeric,
  'town hall adds thirty population per apartment'
);

insert into auth.users (id, email)
values ('c0000000-0000-4000-8000-000000000001', 'town-hall-effect@example.test');
insert into public.profiles (id, display_name)
values ('c0000000-0000-4000-8000-000000000001', 'Town Hall Effect User');
insert into public.towns (town_id, owner_id, name, coins, population)
values (
  'c1000000-0000-4000-8000-000000000001',
  'c0000000-0000-4000-8000-000000000001',
  'Town Hall Effect Town', 10000, 0
);
insert into public.unlocked_areas (
  town_id, x, y, width, height, unlocked_at, unlock_method
) values (
  'c1000000-0000-4000-8000-000000000001',
  40, 40, 20, 20, '2026-08-30T00:00:00Z', 'initial'
);

select set_config('request.jwt.claim.sub', 'c0000000-0000-4000-8000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"c0000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

create temporary table town_hall_effect_results (name text primary key, value jsonb);

insert into town_hall_effect_results values (
  'road',
  public.place_road_line(
    'road',
    '[{"x":40,"y":45},{"x":41,"y":45},{"x":42,"y":45},{"x":43,"y":45},{"x":44,"y":45},{"x":45,"y":45},{"x":46,"y":45},{"x":47,"y":45},{"x":48,"y":45},{"x":49,"y":45}]'::jsonb,
    'c2000000-0000-4000-8000-000000000001'
  )
);
select is((select value->>'ok' from town_hall_effect_results where name = 'road'), 'true', 'road placement succeeds');

insert into town_hall_effect_results values (
  'small_house',
  public.place_building(
    'small_house', 41, 44,
    'c2000000-0000-4000-8000-000000000002'
  )
);
select is((select value->>'ok' from town_hall_effect_results where name = 'small_house'), 'true', 'small house placement succeeds');
select is((select value->'data'->>'population' from town_hall_effect_results where name = 'small_house'), '10', 'small house starts at population ten');

insert into town_hall_effect_results values (
  'apartment',
  public.place_building(
    'apartment', 43, 43,
    'c2000000-0000-4000-8000-000000000003'
  )
);
select is((select value->>'ok' from town_hall_effect_results where name = 'apartment'), 'true', 'apartment placement succeeds');
select is((select value->'data'->>'population' from town_hall_effect_results where name = 'apartment'), '60', 'housing base population is sixty');

insert into town_hall_effect_results values (
  'first_town_hall',
  public.place_building(
    'town_hall', 46, 43,
    'c2000000-0000-4000-8000-000000000004'
  )
);
select is((select value->>'ok' from town_hall_effect_results where name = 'first_town_hall'), 'true', 'first town hall placement succeeds');
select is((select value->'data'->>'population' from town_hall_effect_results where name = 'first_town_hall'), '110', 'town hall applies both housing bonuses');
select is((select population from public.towns where town_id = 'c1000000-0000-4000-8000-000000000001'), 110::bigint, 'town hall population is stored');

insert into town_hall_effect_results values (
  'second_town_hall',
  public.place_building(
    'town_hall', 48, 46,
    'c2000000-0000-4000-8000-000000000005'
  )
);
select is((select value->>'ok' from town_hall_effect_results where name = 'second_town_hall'), 'true', 'second town hall placement succeeds');
select is((select value->'data'->>'population' from town_hall_effect_results where name = 'second_town_hall'), '110', 'multiple town halls do not stack');

insert into town_hall_effect_results values (
  'second_small_house',
  public.place_building(
    'small_house', 40, 44,
    'c2000000-0000-4000-8000-000000000006'
  )
);
select is((select value->>'ok' from town_hall_effect_results where name = 'second_small_house'), 'true', 'housing can be added after the town hall');
select is((select value->'data'->>'population' from town_hall_effect_results where name = 'second_small_house'), '140', 'new housing receives the existing town hall effect');
select is((select population from public.towns where town_id = 'c1000000-0000-4000-8000-000000000001'), 140::bigint, 'updated town hall population is stored');
select is((select coins from public.towns where town_id = 'c1000000-0000-4000-8000-000000000001'), 3700::bigint, 'town hall retains the existing three-thousand coin price');

select * from finish();
rollback;
