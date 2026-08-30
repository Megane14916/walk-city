begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

select is(
  (select count(*) from public.building_effects
   where building_type_code = 'farm' and effect_type = 'population_flat'),
  1::bigint,
  'farm has exactly one flat population effect'
);
select is(
  (select value from public.building_effects
   where building_type_code = 'farm' and effect_type = 'population_flat'),
  20::numeric,
  'farm population effect is twenty'
);

insert into auth.users (id, email)
values ('f0000000-0000-4000-8000-000000000001', 'farm-effect@example.test');
insert into public.profiles (id, display_name)
values ('f0000000-0000-4000-8000-000000000001', 'Farm Effect User');
insert into public.towns (town_id, owner_id, name, coins, population)
values (
  'f1000000-0000-4000-8000-000000000001',
  'f0000000-0000-4000-8000-000000000001',
  'Farm Effect Town', 3000, 0
);
insert into public.unlocked_areas (
  town_id, x, y, width, height, unlocked_at, unlock_method
) values (
  'f1000000-0000-4000-8000-000000000001',
  40, 40, 20, 20, '2026-08-30T00:00:00Z', 'initial'
);

select set_config('request.jwt.claim.sub', 'f0000000-0000-4000-8000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"f0000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

create temporary table farm_effect_results (name text primary key, value jsonb);

insert into farm_effect_results values (
  'road',
  public.place_road_line(
    'road',
    '[{"x":40,"y":45},{"x":41,"y":45},{"x":42,"y":45},{"x":43,"y":45},{"x":44,"y":45},{"x":45,"y":45}]'::jsonb,
    'f2000000-0000-4000-8000-000000000001'
  )
);
select is((select value->>'ok' from farm_effect_results where name = 'road'), 'true', 'road placement succeeds');

insert into farm_effect_results values (
  'first_farm',
  public.place_building(
    'farm', 41, 43,
    'f2000000-0000-4000-8000-000000000002'
  )
);
select is((select value->>'ok' from farm_effect_results where name = 'first_farm'), 'true', 'first farm placement succeeds');
select is((select value->'data'->>'population' from farm_effect_results where name = 'first_farm'), '20', 'first farm returns population twenty');
select is((select population from public.towns where town_id = 'f1000000-0000-4000-8000-000000000001'), 20::bigint, 'first farm stores population twenty');

insert into farm_effect_results values (
  'second_farm',
  public.place_building(
    'farm', 43, 46,
    'f2000000-0000-4000-8000-000000000003'
  )
);
select is((select value->>'ok' from farm_effect_results where name = 'second_farm'), 'true', 'second farm placement succeeds');
select is((select value->'data'->>'population' from farm_effect_results where name = 'second_farm'), '40', 'two farms return population forty');
select is((select population from public.towns where town_id = 'f1000000-0000-4000-8000-000000000001'), 40::bigint, 'two farms store population forty');
select is((select coins from public.towns where town_id = 'f1000000-0000-4000-8000-000000000001'), 2800::bigint, 'two farms retain the existing one-hundred coin price');

select * from finish();
rollback;
