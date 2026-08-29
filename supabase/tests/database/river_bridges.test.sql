begin;
create extension if not exists pgtap with schema extensions;
select plan(47);

select has_table('public', 'map_layouts', 'map_layouts exists');
select has_table('public', 'map_terrain_areas', 'map_terrain_areas exists');
select has_table('public', 'road_structures', 'road_structures exists');
select has_table('public', 'town_rpc_requests', 'RPC idempotency table exists');
select has_column('public', 'towns', 'map_layout_id', 'towns has map_layout_id');
select has_column('public', 'placed_buildings', 'road_structure_id', 'placed buildings have a bridge group');

select is(
  (select count(*) from public.map_terrain_areas where map_layout_id = 'walk-city-v1'),
  5::bigint,
  'fixed layout has five normalized river areas'
);
select is(
  (select bridge_cell_cost_coins from public.map_layouts where id = 'walk-city-v1'),
  200::bigint,
  'a river bridge cell costs 200 coins'
);

select has_function('public', 'place_building', array['text', 'integer', 'integer', 'uuid'], 'place_building RPC exists');
select has_function('public', 'move_building', array['uuid', 'integer', 'integer', 'uuid'], 'move_building RPC exists');
select has_function('public', 'place_road_line', array['text', 'jsonb', 'uuid'], 'place_road_line RPC exists');
select has_function('public', 'delete_road', array['uuid', 'uuid'], 'delete_road RPC exists');

select ok(
  (select prosecdef and array_to_string(proconfig, ',') like '%search_path=%'
   from pg_catalog.pg_proc
   where oid = 'public.place_building(text,integer,integer,uuid)'::regprocedure),
  'place_building is SECURITY DEFINER with a pinned search path'
);
select ok(
  (select prosecdef and array_to_string(proconfig, ',') like '%search_path=%'
   from pg_catalog.pg_proc
   where oid = 'public.move_building(uuid,integer,integer,uuid)'::regprocedure),
  'move_building is SECURITY DEFINER with a pinned search path'
);
select ok(
  (select prosecdef and array_to_string(proconfig, ',') like '%search_path=%'
   from pg_catalog.pg_proc
   where oid = 'public.place_road_line(text,jsonb,uuid)'::regprocedure),
  'place_road_line is SECURITY DEFINER with a pinned search path'
);
select ok(
  (select prosecdef and array_to_string(proconfig, ',') like '%search_path=%'
   from pg_catalog.pg_proc
   where oid = 'public.delete_road(uuid,uuid)'::regprocedure),
  'delete_road is SECURITY DEFINER with a pinned search path'
);

select is(has_table_privilege('authenticated', 'public.map_terrain_areas', 'INSERT'), false, 'clients cannot insert terrain');
select is(has_table_privilege('authenticated', 'public.map_terrain_areas', 'UPDATE'), false, 'clients cannot update terrain');
select is(has_table_privilege('authenticated', 'public.road_structures', 'DELETE'), false, 'clients cannot directly delete bridge groups');
select is(has_table_privilege('authenticated', 'public.town_rpc_requests', 'SELECT'), false, 'clients cannot read idempotency records');

set local role authenticated;
select is(
  (select count(*) from public.map_terrain_areas where map_layout_id = 'walk-city-v1'),
  5::bigint,
  'authenticated users can read fixed terrain through RLS'
);
select throws_ok(
  $$update public.map_terrain_areas set bridgeable = false where code = 'river-middle-straight'$$,
  '42501',
  'permission denied for table map_terrain_areas',
  'authenticated users cannot mutate fixed terrain'
);
reset role;

insert into auth.users (id, email)
values
  ('30000000-0000-4000-8000-000000000001', 'river-owner@example.test'),
  ('30000000-0000-4000-8000-000000000002', 'river-other@example.test');
insert into public.profiles (id, display_name)
values
  ('30000000-0000-4000-8000-000000000001', 'River Owner'),
  ('30000000-0000-4000-8000-000000000002', 'Other User');
insert into public.towns (town_id, owner_id, name, coins, population)
values
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'River Test Town', 2000, 0),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', 'Other Town', 2000, 0);
insert into public.unlocked_areas (town_id, x, y, width, height, unlocked_at, unlock_method)
values
  ('40000000-0000-4000-8000-000000000001', 60, 40, 20, 20, '2026-08-29T00:00:00Z', 'test'),
  ('40000000-0000-4000-8000-000000000001', 60, 60, 20, 20, '2026-08-29T00:00:00Z', 'test'),
  ('40000000-0000-4000-8000-000000000002', 60, 40, 20, 20, '2026-08-29T00:00:00Z', 'test');
insert into public.building_types (
  code, name, category, width, height, cost_coins, description, enabled
)
values
  ('road', 'Road', 'road', 1, 1, 0, 'Road', true),
  ('house-small', 'House', 'residential', 1, 1, 50, 'House', true)
on conflict (code) do update
set category = excluded.category,
    width = excluded.width,
    height = excluded.height,
    cost_coins = excluded.cost_coins,
    enabled = excluded.enabled;

select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  $$select private.place_road_line_impl(
    'road',
    '[{"x":64,"y":55},{"x":65,"y":55},{"x":66,"y":55},{"x":67,"y":55},{"x":68,"y":55},{"x":69,"y":55}]'::jsonb,
    '50000000-0000-4000-8000-000000000010'
  )$$,
  'P0001',
  'BRIDGE_SPAN_REQUIRED',
  'an incomplete river crossing is rejected'
);
select throws_ok(
  $$select private.place_road_line_impl(
    'road',
    '[{"x":67,"y":50},{"x":67,"y":51},{"x":67,"y":52},{"x":67,"y":53},{"x":67,"y":54},{"x":67,"y":55},{"x":67,"y":56}]'::jsonb,
    '50000000-0000-4000-8000-000000000011'
  )$$,
  'P0001',
  'BRIDGE_DIRECTION_INVALID',
  'a line parallel to the river is rejected'
);
select throws_ok(
  $$select private.place_road_line_impl(
    'road',
    '[{"x":64,"y":72},{"x":65,"y":72},{"x":66,"y":72},{"x":67,"y":72},{"x":68,"y":72},{"x":69,"y":72},{"x":70,"y":72}]'::jsonb,
    '50000000-0000-4000-8000-000000000012'
  )$$,
  'P0001',
  'BRIDGE_CORNER_FORBIDDEN',
  'a bridge through a river corner is rejected'
);
select is((select count(*) from public.road_structures), 0::bigint, 'invalid bridge attempts create no structures');
select is((select coins from public.towns where town_id = '40000000-0000-4000-8000-000000000001'), 2000::bigint, 'invalid bridge attempts deduct no coins');

select lives_ok(
  $$select private.place_road_line_impl(
    'road',
    '[{"x":64,"y":55},{"x":65,"y":55},{"x":66,"y":55},{"x":67,"y":55},{"x":68,"y":55},{"x":69,"y":55},{"x":70,"y":55}]'::jsonb,
    '50000000-0000-4000-8000-000000000001'
  )$$,
  'owner can build a valid seven-cell bridge'
);
select is((select count(*) from public.road_structures where town_id = '40000000-0000-4000-8000-000000000001'), 1::bigint, 'bridge creates one structure');
select is((select count(*) from public.placed_buildings where road_structure_id is not null), 7::bigint, 'bridge creates seven road cells');
select is((select coins from public.towns where town_id = '40000000-0000-4000-8000-000000000001'), 1000::bigint, 'bridge deducts five times 200 plus approach road prices');
select is((select count(*) from public.coin_ledger where town_id = '40000000-0000-4000-8000-000000000001'), 1::bigint, 'bridge writes one coin ledger row');
select is(
  private.place_road_line_impl(
    'road',
    '[{"x":64,"y":55},{"x":65,"y":55},{"x":66,"y":55},{"x":67,"y":55},{"x":68,"y":55},{"x":69,"y":55},{"x":70,"y":55}]'::jsonb,
    '50000000-0000-4000-8000-000000000001'
  ),
  (select response from public.town_rpc_requests
   where user_id = '30000000-0000-4000-8000-000000000001'
     and operation = 'place_road_line'
     and request_id = '50000000-0000-4000-8000-000000000001'),
  'repeated bridge placement returns the cached result'
);

select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
select throws_ok(
  format(
    'select private.delete_road_impl(%L::uuid, %L::uuid)',
    (select id from public.placed_buildings where road_structure_id is not null limit 1),
    '50000000-0000-4000-8000-000000000002'
  ),
  'P0001',
  'NOT_OWNER',
  'another user cannot delete the bridge'
);

select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
select throws_ok(
  format(
    'select private.move_building_impl(%L::uuid, 64, 56, %L::uuid)',
    (select id from public.placed_buildings where road_structure_id is not null limit 1),
    '50000000-0000-4000-8000-000000000003'
  ),
  'P0001',
  'PLACEMENT_IMMOVABLE',
  'bridge cells cannot move'
);
select lives_ok(
  format(
    'select private.delete_road_impl(%L::uuid, %L::uuid)',
    (select id from public.placed_buildings where road_structure_id is not null order by id limit 1),
    '50000000-0000-4000-8000-000000000004'
  ),
  'owner can delete a complete bridge from any bridge cell'
);
select is((select count(*) from public.placed_buildings where road_structure_id is not null), 0::bigint, 'bridge deletion removes seven cells');
select is((select count(*) from public.road_structures where town_id = '40000000-0000-4000-8000-000000000001'), 0::bigint, 'bridge deletion removes its structure');
select is((select coins from public.towns where town_id = '40000000-0000-4000-8000-000000000001'), 1000::bigint, 'bridge deletion gives no refund');
select is((select count(*) from public.coin_ledger where town_id = '40000000-0000-4000-8000-000000000001'), 1::bigint, 'bridge deletion writes no ledger row');
select lives_ok(
  format(
    'select private.delete_road_impl(%L::uuid, %L::uuid)',
    ((select response->'deletedBuildingIds'->>0 from public.town_rpc_requests
      where operation = 'delete_road' and request_id = '50000000-0000-4000-8000-000000000004')),
    '50000000-0000-4000-8000-000000000004'
  ),
  'repeated bridge deletion returns its cached result after rows are gone'
);

insert into public.road_structures (id, town_id, orientation)
values (
  '60000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  'horizontal'
);
insert into public.placed_buildings (
  town_id, building_type_code, anchor_x, anchor_y,
  purchase_cost_coins, road_structure_id
)
select '40000000-0000-4000-8000-000000000001', 'road', x, 56, 0,
       '60000000-0000-4000-8000-000000000001'
from pg_catalog.generate_series(64, 69) x;
select throws_ok(
  format(
    'select private.delete_road_impl(%L::uuid, %L::uuid)',
    (select id from public.placed_buildings
     where road_structure_id = '60000000-0000-4000-8000-000000000001' limit 1),
    '50000000-0000-4000-8000-000000000013'
  ),
  'P0001',
  'BRIDGE_GROUP_INVALID',
  'an incomplete saved bridge is not partially deleted'
);
select is(
  (select count(*) from public.placed_buildings
   where road_structure_id = '60000000-0000-4000-8000-000000000001'),
  6::bigint,
  'all broken bridge cells remain after a rejected deletion'
);
delete from public.placed_buildings
where road_structure_id = '60000000-0000-4000-8000-000000000001';
delete from public.road_structures
where id = '60000000-0000-4000-8000-000000000001';

select lives_ok(
  $$select private.place_road_line_impl(
    'road', '[{"x":60,"y":45}]'::jsonb,
    '50000000-0000-4000-8000-000000000005'
  )$$,
  'owner can place a normal road cell'
);
select lives_ok(
  $$select private.place_building_impl(
    'house-small', 60, 44,
    '50000000-0000-4000-8000-000000000006'
  )$$,
  'owner can place a building adjacent to the road'
);
select throws_ok(
  format(
    'select private.delete_road_impl(%L::uuid, %L::uuid)',
    (select id from public.placed_buildings where anchor_x = 60 and anchor_y = 45),
    '50000000-0000-4000-8000-000000000007'
  ),
  'P0001',
  'ROAD_IN_USE',
  'a road supporting a building cannot be deleted'
);
select is(
  (select count(*) from public.placed_buildings where anchor_x = 60 and anchor_y = 45),
  1::bigint,
  'failed in-use deletion leaves the road in place'
);

select * from finish();
rollback;
