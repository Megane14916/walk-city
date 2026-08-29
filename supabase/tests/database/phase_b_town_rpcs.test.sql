begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

select has_function('public', 'place_building', array['text', 'integer', 'integer', 'uuid'], 'place_building RPC exists');
select has_function('public', 'move_building', array['uuid', 'integer', 'integer', 'uuid'], 'move_building RPC exists');
select has_function('public', 'place_road_line', array['text', 'jsonb', 'uuid'], 'place_road_line RPC exists');
select has_function('public', 'delete_road', array['uuid', 'uuid'], 'delete_road RPC exists');
select has_function('public', 'unlock_land', array['integer', 'integer', 'uuid'], 'unlock_land RPC exists');
select has_function('public', 'rename_building', array['uuid', 'text'], 'rename_building RPC exists');

select is(has_function_privilege('anon', 'public.unlock_land(integer,integer,uuid)', 'EXECUTE'), false, 'anon cannot unlock land');
select is(has_function_privilege('authenticated', 'public.unlock_land(integer,integer,uuid)', 'EXECUTE'), true, 'authenticated can unlock land');
select is(has_function_privilege('authenticated', 'private.unlock_land_impl(integer,integer,uuid)', 'EXECUTE'), false, 'authenticated cannot call internal unlock implementation');

insert into auth.users (id, email)
values ('a0000000-0000-4000-8000-000000000001', 'phase-b@example.test');
insert into public.profiles (id, display_name)
values ('a0000000-0000-4000-8000-000000000001', 'Phase B User');
insert into public.towns (town_id, owner_id, name, coins, population)
values (
  'b0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  'Phase B Town', 3000, 0
);
insert into public.unlocked_areas (
  town_id, x, y, width, height, unlocked_at, unlock_method
) values (
  'b0000000-0000-4000-8000-000000000001',
  40, 40, 20, 20, '2026-08-29T00:00:00Z', 'initial'
);

select set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

create temporary table phase_b_results (name text primary key, value jsonb);

insert into phase_b_results values (
  'road',
  public.place_road_line(
    'road', '[{"x":40,"y":45},{"x":40,"y":46}]'::jsonb,
    'c0000000-0000-4000-8000-000000000001'
  )
);
select is((select value->>'ok' from phase_b_results where name = 'road'), 'true', 'road placement uses success envelope');
select is((select jsonb_array_length(value->'data'->'buildings') from phase_b_results where name = 'road'), 2, 'road placement returns both cells');
select is((select count(*) from public.placed_buildings where building_type_code = 'road'), 2::bigint, 'road cells are stored atomically');
select is(
  public.place_road_line(
    'road', '[{"x":40,"y":45},{"x":40,"y":46}]'::jsonb,
    'c0000000-0000-4000-8000-000000000001'
  ),
  (select value from phase_b_results where name = 'road'),
  'repeated road request returns the same public envelope'
);
select is(
  public.place_road_line(
    'road', '[{"x":40,"y":47}]'::jsonb,
    'c0000000-0000-4000-8000-000000000001'
  )->'error'->>'code',
  'CONFLICT',
  'reusing a request ID with different input is rejected'
);

insert into phase_b_results values (
  'house',
  public.place_building(
    'small_house', 41, 45,
    'c0000000-0000-4000-8000-000000000002'
  )
);
select is((select value->>'ok' from phase_b_results where name = 'house'), 'true', 'building placement uses success envelope');
select is((select value->'data'->>'coinBalance' from phase_b_results where name = 'house'), '2950', 'building placement returns the new balance');
select is((select population from public.towns where town_id = 'b0000000-0000-4000-8000-000000000001'), 10::bigint, 'residential population is recalculated');
select is(
  (select count(*) from public.coin_ledger where reason = 'building_purchase'),
  1::bigint,
  'repeated-capable placement writes one purchase ledger row'
);

insert into phase_b_results values (
  'move',
  public.move_building(
    (select (value->'data'->'building'->>'id')::uuid from phase_b_results where name = 'house'),
    41, 46, 'c0000000-0000-4000-8000-000000000003'
  )
);
select is((select value->>'ok' from phase_b_results where name = 'move'), 'true', 'building move uses success envelope');
select is((select value->'data'->>'coinBalance' from phase_b_results where name = 'move'), '2950', 'moving does not deduct coins');

insert into phase_b_results values (
  'rename',
  public.rename_building(
    (select (value->'data'->'building'->>'id')::uuid from phase_b_results where name = 'house'),
    '  My Home  '
  )
);
select is((select value->'data'->'building'->>'customName' from phase_b_results where name = 'rename'), 'My Home', 'building name is trimmed and returned');
select is(
  (select custom_name from public.placed_buildings where id =
    (select (value->'data'->'building'->>'id')::uuid from phase_b_results where name = 'house')),
  'My Home',
  'trimmed building name is stored'
);
select is(
  public.rename_building(
    (select (value->'data'->'building'->>'id')::uuid from phase_b_results where name = 'house'),
    '   '
  )->'error'->>'code',
  'INVALID_INPUT',
  'blank building name is rejected'
);

insert into phase_b_results values (
  'unlock',
  public.unlock_land(60, 40, 'c0000000-0000-4000-8000-000000000004')
);
select is((select value->>'ok' from phase_b_results where name = 'unlock'), 'true', 'adjacent land unlock uses success envelope');
select is((select value->'data'->>'coin_balance' from phase_b_results where name = 'unlock'), '1950', 'land unlock deducts 1000 coins');
select is((select count(*) from public.unlocked_areas where town_id = 'b0000000-0000-4000-8000-000000000001'), 2::bigint, 'land unlock stores one new 20 by 20 area');
select is(
  public.unlock_land(60, 40, 'c0000000-0000-4000-8000-000000000004'),
  (select value from phase_b_results where name = 'unlock'),
  'repeated unlock returns the same envelope without another charge'
);
select is(
  public.unlock_land(60, 40, 'c0000000-0000-4000-8000-000000000005')->'error'->>'code',
  'AREA_ALREADY_UNLOCKED',
  'an already unlocked area is rejected for a new request'
);
select is(
  public.unlock_land(80, 80, 'c0000000-0000-4000-8000-000000000006')->'error'->>'code',
  'AREA_NOT_ADJACENT',
  'diagonal or detached land is rejected'
);
select is(
  public.unlock_land(55, 40, 'c0000000-0000-4000-8000-000000000007')->'error'->>'code',
  'INVALID_INPUT',
  'land coordinates must align to the 20-cell grid'
);
select is((select count(*) from public.coin_ledger where reason = 'land_unlock'), 1::bigint, 'unlock idempotency writes one ledger row');

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);
select is(
  public.unlock_land(20, 40, 'c0000000-0000-4000-8000-000000000008')->'error'->>'code',
  'UNAUTHENTICATED',
  'unauthenticated calls return a safe error envelope'
);

select * from finish();
rollback;
