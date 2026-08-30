begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

select is(
  (select count(*) from public.building_effects
   where building_type_code = 'hospital'
     and effect_type = 'small_house_population_flat'),
  1::bigint,
  'hospital has exactly one small-house population effect'
);
select is(
  (select value from public.building_effects
   where building_type_code = 'hospital'
     and effect_type = 'small_house_population_flat'),
  5::numeric,
  'hospital adds five population per small house'
);
select is(
  (select count(*) from public.building_effects
   where building_type_code = 'hospital'
     and effect_type = 'apartment_population_flat'),
  1::bigint,
  'hospital has exactly one apartment population effect'
);
select is(
  (select value from public.building_effects
   where building_type_code = 'hospital'
     and effect_type = 'apartment_population_flat'),
  10::numeric,
  'hospital adds ten population per apartment'
);

insert into auth.users (id, email)
values ('d0000000-0000-4000-8000-000000000001', 'hospital-effect@example.test');
insert into public.profiles (id, display_name)
values ('d0000000-0000-4000-8000-000000000001', 'Hospital Effect User');
insert into public.towns (town_id, owner_id, name, coins, population)
values (
  'd1000000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000001',
  'Hospital Effect Town', 4000, 0
);
insert into public.unlocked_areas (
  town_id, x, y, width, height, unlocked_at, unlock_method
) values (
  'd1000000-0000-4000-8000-000000000001',
  40, 40, 20, 20, '2026-08-30T00:00:00Z', 'initial'
);

select set_config('request.jwt.claim.sub', 'd0000000-0000-4000-8000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

create temporary table hospital_effect_results (name text primary key, value jsonb);

insert into hospital_effect_results values (
  'road',
  public.place_road_line(
    'road',
    '[{"x":40,"y":45},{"x":41,"y":45},{"x":42,"y":45},{"x":43,"y":45},{"x":44,"y":45},{"x":45,"y":45},{"x":46,"y":45},{"x":47,"y":45},{"x":48,"y":45},{"x":49,"y":45}]'::jsonb,
    'd2000000-0000-4000-8000-000000000001'
  )
);
select is((select value->>'ok' from hospital_effect_results where name = 'road'), 'true', 'road placement succeeds');

insert into hospital_effect_results values (
  'small_house',
  public.place_building(
    'small_house', 41, 44,
    'd2000000-0000-4000-8000-000000000002'
  )
);
select is((select value->>'ok' from hospital_effect_results where name = 'small_house'), 'true', 'small house placement succeeds');
select is((select value->'data'->>'population' from hospital_effect_results where name = 'small_house'), '10', 'small house starts at population ten');

insert into hospital_effect_results values (
  'apartment',
  public.place_building(
    'apartment', 43, 43,
    'd2000000-0000-4000-8000-000000000003'
  )
);
select is((select value->>'ok' from hospital_effect_results where name = 'apartment'), 'true', 'apartment placement succeeds');
select is((select value->'data'->>'population' from hospital_effect_results where name = 'apartment'), '60', 'housing base population is sixty');

insert into hospital_effect_results values (
  'first_hospital',
  public.place_building(
    'hospital', 46, 43,
    'd2000000-0000-4000-8000-000000000004'
  )
);
select is((select value->>'ok' from hospital_effect_results where name = 'first_hospital'), 'true', 'first hospital placement succeeds');
select is((select value->'data'->>'population' from hospital_effect_results where name = 'first_hospital'), '75', 'hospital applies both housing bonuses');
select is((select population from public.towns where town_id = 'd1000000-0000-4000-8000-000000000001'), 75::bigint, 'hospital population is stored');

insert into hospital_effect_results values (
  'second_hospital',
  public.place_building(
    'hospital', 48, 46,
    'd2000000-0000-4000-8000-000000000005'
  )
);
select is((select value->>'ok' from hospital_effect_results where name = 'second_hospital'), 'true', 'second hospital placement succeeds');
select is((select value->'data'->>'population' from hospital_effect_results where name = 'second_hospital'), '75', 'multiple hospitals do not stack');

insert into hospital_effect_results values (
  'second_small_house',
  public.place_building(
    'small_house', 40, 44,
    'd2000000-0000-4000-8000-000000000006'
  )
);
select is((select value->>'ok' from hospital_effect_results where name = 'second_small_house'), 'true', 'housing can be added after the hospital');
select is((select value->'data'->>'population' from hospital_effect_results where name = 'second_small_house'), '90', 'new housing receives the existing hospital effect');
select is((select population from public.towns where town_id = 'd1000000-0000-4000-8000-000000000001'), 90::bigint, 'updated hospital population is stored');
select is((select coins from public.towns where town_id = 'd1000000-0000-4000-8000-000000000001'), 2500::bigint, 'hospital retains the existing six-hundred coin price');

select * from finish();
rollback;
