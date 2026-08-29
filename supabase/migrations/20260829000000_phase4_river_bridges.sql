-- Walk City Phase 4: fixed river map, bridges, road deletion, RPCs and RLS.
-- The CREATE IF NOT EXISTS statements also make a fresh local Supabase reset
-- reproducible when the remote baseline migration is not present in this branch.

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.building_types (
  code text primary key,
  name text not null,
  category text not null default 'other',
  width smallint not null default 1 check (width between 1 and 2),
  height smallint not null default 1 check (height between 1 and 2),
  cost_coins bigint check (cost_coins is null or cost_coins >= 0),
  description text not null default '',
  enabled boolean not null default false,
  catalog_version integer not null default 1 check (catalog_version > 0)
);

create table if not exists public.building_effects (
  id uuid primary key default extensions.gen_random_uuid(),
  building_type_code text not null references public.building_types(code),
  effect_type text not null,
  value numeric,
  target_category text,
  scope text,
  stacking_rule text,
  description text not null default '',
  metadata jsonb not null default '{}'::jsonb
);
alter table public.building_effects
  add column if not exists description text not null default '';

create table if not exists public.map_layouts (
  id text primary key,
  width smallint not null check (width > 0),
  height smallint not null check (height > 0),
  bridge_cell_cost_coins bigint not null check (bridge_cell_cost_coins >= 0),
  version integer not null check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.map_layouts (
  id, width, height, bridge_cell_cost_coins, version
)
values ('walk-city-v1', 100, 100, 200, 1)
on conflict (id) do update
set width = excluded.width,
    height = excluded.height,
    bridge_cell_cost_coins = excluded.bridge_cell_cost_coins,
    version = excluded.version,
    updated_at = now();

create table if not exists public.towns (
  town_id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id) on delete cascade,
  name text not null,
  coins bigint not null default 0 check (coins >= 0),
  population bigint not null default 0 check (population >= 0),
  map_width smallint not null default 100 check (map_width > 0),
  map_height smallint not null default 100 check (map_height > 0),
  map_layout_id text references public.map_layouts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.towns
  add column if not exists map_layout_id text references public.map_layouts(id);
update public.towns
set map_layout_id = 'walk-city-v1'
where map_layout_id is null;
alter table public.towns alter column map_layout_id set default 'walk-city-v1';
alter table public.towns alter column map_layout_id set not null;

create table if not exists public.map_terrain_areas (
  id uuid primary key default extensions.gen_random_uuid(),
  map_layout_id text not null references public.map_layouts(id) on delete cascade,
  code text not null,
  terrain_type text not null,
  segment_kind text not null check (segment_kind in ('horizontal', 'vertical', 'corner')),
  x smallint not null check (x >= 0),
  y smallint not null check (y >= 0),
  width smallint not null check (width > 0),
  height smallint not null check (height > 0),
  bridgeable boolean not null default false,
  created_at timestamptz not null default now(),
  check (x + width <= 100 and y + height <= 100),
  unique (map_layout_id, code)
);

insert into public.map_terrain_areas (
  id, map_layout_id, code, terrain_type, segment_kind,
  x, y, width, height, bridgeable
)
values
  ('10000000-0000-4000-8000-000000000001', 'walk-city-v1', 'river-lower-straight', 'river', 'horizontal', 0, 70, 65, 5, true),
  ('10000000-0000-4000-8000-000000000002', 'walk-city-v1', 'river-lower-corner', 'river', 'corner', 65, 70, 5, 5, false),
  ('10000000-0000-4000-8000-000000000003', 'walk-city-v1', 'river-middle-straight', 'river', 'vertical', 65, 25, 5, 45, true),
  ('10000000-0000-4000-8000-000000000004', 'walk-city-v1', 'river-upper-corner', 'river', 'corner', 65, 20, 5, 5, false),
  ('10000000-0000-4000-8000-000000000005', 'walk-city-v1', 'river-upper-straight', 'river', 'horizontal', 70, 20, 30, 5, true)
on conflict (map_layout_id, code) do update
set terrain_type = excluded.terrain_type,
    segment_kind = excluded.segment_kind,
    x = excluded.x,
    y = excluded.y,
    width = excluded.width,
    height = excluded.height,
    bridgeable = excluded.bridgeable;

create table if not exists public.unlocked_areas (
  town_id uuid not null references public.towns(town_id) on delete cascade,
  x smallint not null default 40,
  y smallint not null default 40,
  width smallint not null,
  height smallint not null,
  unlocked_at timestamptz not null default now(),
  unlock_method text,
  primary key (town_id, x, y)
);

alter table public.unlocked_areas add column if not exists x smallint;
alter table public.unlocked_areas add column if not exists y smallint;
update public.unlocked_areas set x = 40 where x is null;
update public.unlocked_areas set y = 40 where y is null;
alter table public.unlocked_areas alter column x set default 40;
alter table public.unlocked_areas alter column y set default 40;
alter table public.unlocked_areas alter column x set not null;
alter table public.unlocked_areas alter column y set not null;
do $$
declare
  v_constraint_name text;
  v_key_columns text[];
begin
  select c.conname,
         array_agg(a.attname::text order by keys.ordinality)
  into v_constraint_name, v_key_columns
  from pg_catalog.pg_constraint c
  cross join lateral unnest(c.conkey) with ordinality keys(attnum, ordinality)
  join pg_catalog.pg_attribute a
    on a.attrelid = c.conrelid and a.attnum = keys.attnum
  where c.conrelid = 'public.unlocked_areas'::regclass
    and c.contype = 'p'
  group by c.conname;

  if v_key_columns = array['town_id']::text[] then
    execute format(
      'alter table public.unlocked_areas drop constraint %I',
      v_constraint_name
    );
    alter table public.unlocked_areas
      add primary key (town_id, x, y);
  end if;
end;
$$;

create table if not exists public.road_structures (
  id uuid primary key default extensions.gen_random_uuid(),
  town_id uuid not null references public.towns(town_id) on delete cascade,
  structure_type text not null default 'bridge' check (structure_type = 'bridge'),
  orientation text not null check (orientation in ('horizontal', 'vertical')),
  created_at timestamptz not null default now()
);
create index if not exists road_structures_town_id_idx
  on public.road_structures(town_id);

create table if not exists public.placed_buildings (
  id uuid primary key default extensions.gen_random_uuid(),
  town_id uuid not null references public.towns(town_id) on delete cascade,
  building_type_code text not null references public.building_types(code),
  custom_name text,
  anchor_x smallint not null,
  anchor_y smallint not null,
  purchase_cost_coins bigint not null check (purchase_cost_coins >= 0),
  road_structure_id uuid references public.road_structures(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.placed_buildings add column if not exists custom_name text;
alter table public.placed_buildings
  add column if not exists road_structure_id uuid references public.road_structures(id);
create index if not exists placed_buildings_town_id_idx
  on public.placed_buildings(town_id);
create index if not exists placed_buildings_road_structure_id_idx
  on public.placed_buildings(road_structure_id);
create unique index if not exists road_structures_id_town_id_key
  on public.road_structures(id, town_id);
do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.placed_buildings'::regclass
      and conname = 'placed_buildings_road_structure_town_fkey'
  ) then
    alter table public.placed_buildings
      add constraint placed_buildings_road_structure_town_fkey
      foreign key (road_structure_id, town_id)
      references public.road_structures(id, town_id);
  end if;
end;
$$;

create table if not exists public.coin_ledger (
  id uuid primary key default extensions.gen_random_uuid(),
  town_id uuid not null references public.towns(town_id) on delete cascade,
  amount bigint not null,
  reason text not null,
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.town_rpc_requests (
  user_id uuid not null references public.profiles(id) on delete cascade,
  operation text not null,
  request_id uuid not null,
  input_hash text not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, operation, request_id)
);

create or replace function private.raise_api_error(p_code text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = p_code;
end;
$$;

create or replace function private.current_user_id()
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    perform private.raise_api_error('UNAUTHENTICATED');
  end if;
  return v_user_id;
end;
$$;

create or replace function private.input_hash(p_input jsonb)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select encode(extensions.digest(p_input::text, 'sha256'), 'hex')
$$;

create or replace function private.lock_rpc_request(
  p_user_id uuid,
  p_operation text,
  p_request_id uuid,
  p_input_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.town_rpc_requests%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_user_id::text || ':' || p_operation || ':' || p_request_id::text,
      0
    )
  );

  select * into v_request
  from public.town_rpc_requests
  where user_id = p_user_id
    and operation = p_operation
    and request_id = p_request_id;

  if found then
    if v_request.input_hash <> p_input_hash then
      perform private.raise_api_error('CONFLICT');
    end if;
    return v_request.response;
  end if;
  return null;
end;
$$;

create or replace function private.save_rpc_request(
  p_user_id uuid,
  p_operation text,
  p_request_id uuid,
  p_input_hash text,
  p_response jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.town_rpc_requests (
    user_id, operation, request_id, input_hash, response
  ) values (
    p_user_id, p_operation, p_request_id, p_input_hash, p_response
  )
$$;

create or replace function private.cell_is_unlocked(
  p_town_id uuid,
  p_x integer,
  p_y integer
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.unlocked_areas ua
    where ua.town_id = p_town_id
      and p_x >= ua.x
      and p_x < ua.x + ua.width
      and p_y >= ua.y
      and p_y < ua.y + ua.height
  )
$$;

create or replace function private.cell_terrain(
  p_layout_id text,
  p_x integer,
  p_y integer
)
returns table (
  area_id uuid,
  segment_kind text,
  bridgeable boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.segment_kind, a.bridgeable
  from public.map_terrain_areas a
  where a.map_layout_id = p_layout_id
    and a.terrain_type = 'river'
    and p_x >= a.x
    and p_x < a.x + a.width
    and p_y >= a.y
    and p_y < a.y + a.height
  limit 1
$$;

create or replace function private.cell_is_occupied(
  p_town_id uuid,
  p_x integer,
  p_y integer,
  p_excluded_building_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.placed_buildings pb
    join public.building_types bt on bt.code = pb.building_type_code
    where pb.town_id = p_town_id
      and (p_excluded_building_id is null or pb.id <> p_excluded_building_id)
      and p_x >= pb.anchor_x
      and p_x < pb.anchor_x + bt.width
      and p_y >= pb.anchor_y
      and p_y < pb.anchor_y + bt.height
  )
$$;

create or replace function private.cell_has_road(
  p_town_id uuid,
  p_x integer,
  p_y integer,
  p_excluded_ids uuid[] default '{}'::uuid[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.placed_buildings pb
    join public.building_types bt on bt.code = pb.building_type_code
    where pb.town_id = p_town_id
      and bt.category = 'road'
      and not (pb.id = any(p_excluded_ids))
      and pb.anchor_x = p_x
      and pb.anchor_y = p_y
  )
$$;

create or replace function private.building_has_road_access(
  p_town_id uuid,
  p_anchor_x integer,
  p_anchor_y integer,
  p_width integer,
  p_height integer,
  p_excluded_ids uuid[] default '{}'::uuid[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from pg_catalog.generate_series(p_anchor_x, p_anchor_x + p_width - 1) gx(x)
    cross join pg_catalog.generate_series(p_anchor_y, p_anchor_y + p_height - 1) gy(y)
    where private.cell_has_road(p_town_id, gx.x - 1, gy.y, p_excluded_ids)
       or private.cell_has_road(p_town_id, gx.x + 1, gy.y, p_excluded_ids)
       or private.cell_has_road(p_town_id, gx.x, gy.y - 1, p_excluded_ids)
       or private.cell_has_road(p_town_id, gx.x, gy.y + 1, p_excluded_ids)
  )
$$;

create or replace function private.all_buildings_have_road_access(
  p_town_id uuid,
  p_excluded_ids uuid[] default '{}'::uuid[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from public.placed_buildings pb
    join public.building_types bt on bt.code = pb.building_type_code
    where pb.town_id = p_town_id
      and bt.category <> 'road'
      and not (pb.id = any(p_excluded_ids))
      and not private.building_has_road_access(
        p_town_id,
        pb.anchor_x,
        pb.anchor_y,
        bt.width,
        bt.height,
        p_excluded_ids
      )
  )
$$;

create or replace function private.placed_building_json(p_building_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', pb.id,
    'buildingTypeCode', pb.building_type_code,
    'customName', pb.custom_name,
    'anchorX', pb.anchor_x,
    'anchorY', pb.anchor_y,
    'roadStructureId', pb.road_structure_id,
    'roadVariant', case
      when bt.category <> 'road' then null
      when pb.road_structure_id is null then 'normal'
      when rs.orientation = 'horizontal' then 'bridge_horizontal'
      else 'bridge_vertical'
    end,
    'createdAt', pb.created_at,
    'updatedAt', pb.updated_at
  )
  from public.placed_buildings pb
  join public.building_types bt on bt.code = pb.building_type_code
  left join public.road_structures rs on rs.id = pb.road_structure_id
  where pb.id = p_building_id
$$;

create or replace function public.place_building(
  p_building_type_code text,
  p_anchor_x integer,
  p_anchor_y integer,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := private.current_user_id();
  v_town public.towns%rowtype;
  v_item public.building_types%rowtype;
  v_hash text;
  v_cached jsonb;
  v_building_id uuid := extensions.gen_random_uuid();
  v_population_delta bigint := 0;
  v_timestamp timestamptz := pg_catalog.clock_timestamp();
  v_response jsonb;
begin
  if p_request_id is null or p_building_type_code is null then
    perform private.raise_api_error('INVALID_INPUT');
  end if;
  v_hash := private.input_hash(jsonb_build_object(
    'buildingTypeCode', p_building_type_code,
    'anchorX', p_anchor_x,
    'anchorY', p_anchor_y
  ));
  v_cached := private.lock_rpc_request(v_user_id, 'place_building', p_request_id, v_hash);
  if v_cached is not null then return v_cached; end if;

  select * into v_town
  from public.towns
  where owner_id = v_user_id
  for update;
  if not found then perform private.raise_api_error('NOT_OWNER'); end if;

  select * into v_item
  from public.building_types
  where code = p_building_type_code;
  if not found then perform private.raise_api_error('NOT_FOUND'); end if;
  if not v_item.enabled then perform private.raise_api_error('CATALOG_ITEM_DISABLED'); end if;
  if v_item.cost_coins is null then perform private.raise_api_error('PRICE_NOT_SET'); end if;
  if p_anchor_x < 0 or p_anchor_y < 0
    or p_anchor_x + v_item.width > v_town.map_width
    or p_anchor_y + v_item.height > v_town.map_height then
    perform private.raise_api_error('OUT_OF_MAP');
  end if;
  if exists (
    select 1
    from pg_catalog.generate_series(p_anchor_x, p_anchor_x + v_item.width - 1) gx(x)
    cross join pg_catalog.generate_series(p_anchor_y, p_anchor_y + v_item.height - 1) gy(y)
    where not private.cell_is_unlocked(v_town.town_id, gx.x, gy.y)
  ) then perform private.raise_api_error('LAND_LOCKED'); end if;
  if exists (
    select 1
    from pg_catalog.generate_series(p_anchor_x, p_anchor_x + v_item.width - 1) gx(x)
    cross join pg_catalog.generate_series(p_anchor_y, p_anchor_y + v_item.height - 1) gy(y)
    where private.cell_is_occupied(v_town.town_id, gx.x, gy.y)
  ) then perform private.raise_api_error('CELL_OCCUPIED'); end if;
  if exists (
    select 1
    from pg_catalog.generate_series(p_anchor_x, p_anchor_x + v_item.width - 1) gx(x)
    cross join pg_catalog.generate_series(p_anchor_y, p_anchor_y + v_item.height - 1) gy(y)
    where exists (
      select 1 from private.cell_terrain(v_town.map_layout_id, gx.x, gy.y)
    )
  ) then perform private.raise_api_error('RIVER_BLOCKED'); end if;
  if v_item.category <> 'road' and not private.building_has_road_access(
    v_town.town_id, p_anchor_x, p_anchor_y, v_item.width, v_item.height
  ) then perform private.raise_api_error('ROAD_REQUIRED'); end if;
  if v_town.coins < v_item.cost_coins then
    perform private.raise_api_error('INSUFFICIENT_COINS');
  end if;

  select coalesce(sum(be.value), 0)::bigint into v_population_delta
  from public.building_effects be
  where be.building_type_code = v_item.code
    and be.effect_type = 'population_flat';

  insert into public.placed_buildings (
    id, town_id, building_type_code, anchor_x, anchor_y,
    purchase_cost_coins, created_at, updated_at
  ) values (
    v_building_id, v_town.town_id, v_item.code, p_anchor_x, p_anchor_y,
    v_item.cost_coins, v_timestamp, v_timestamp
  );
  insert into public.coin_ledger (
    town_id, amount, reason, idempotency_key, metadata
  ) values (
    v_town.town_id,
    -v_item.cost_coins,
    'building_purchase',
    'place_building:' || v_user_id::text || ':' || p_request_id::text,
    jsonb_build_object('buildingId', v_building_id, 'buildingTypeCode', v_item.code)
  );
  update public.towns
  set coins = coins - v_item.cost_coins,
      population = population + v_population_delta,
      updated_at = v_timestamp
  where town_id = v_town.town_id
  returning * into v_town;

  v_response := jsonb_build_object(
    'building', private.placed_building_json(v_building_id),
    'coinBalance', v_town.coins,
    'population', v_town.population,
    'updatedAt', v_timestamp
  );
  perform private.save_rpc_request(
    v_user_id, 'place_building', p_request_id, v_hash, v_response
  );
  return v_response;
end;
$$;

create or replace function public.move_building(
  p_building_id uuid,
  p_anchor_x integer,
  p_anchor_y integer,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := private.current_user_id();
  v_town public.towns%rowtype;
  v_building public.placed_buildings%rowtype;
  v_item public.building_types%rowtype;
  v_hash text;
  v_cached jsonb;
  v_timestamp timestamptz := pg_catalog.clock_timestamp();
  v_response jsonb;
begin
  if p_request_id is null or p_building_id is null then
    perform private.raise_api_error('INVALID_INPUT');
  end if;
  v_hash := private.input_hash(jsonb_build_object(
    'buildingId', p_building_id,
    'anchorX', p_anchor_x,
    'anchorY', p_anchor_y
  ));
  v_cached := private.lock_rpc_request(v_user_id, 'move_building', p_request_id, v_hash);
  if v_cached is not null then return v_cached; end if;

  select * into v_building
  from public.placed_buildings
  where id = p_building_id
  for update;
  if not found then perform private.raise_api_error('NOT_FOUND'); end if;
  select * into v_town
  from public.towns
  where town_id = v_building.town_id
  for update;
  if v_town.owner_id <> v_user_id then perform private.raise_api_error('NOT_OWNER'); end if;
  select * into v_item from public.building_types where code = v_building.building_type_code;
  if v_item.category = 'road' or v_building.road_structure_id is not null then
    perform private.raise_api_error('PLACEMENT_IMMOVABLE');
  end if;
  if v_building.anchor_x = p_anchor_x and v_building.anchor_y = p_anchor_y then
    perform private.raise_api_error('INVALID_INPUT');
  end if;
  if p_anchor_x < 0 or p_anchor_y < 0
    or p_anchor_x + v_item.width > v_town.map_width
    or p_anchor_y + v_item.height > v_town.map_height then
    perform private.raise_api_error('OUT_OF_MAP');
  end if;
  if exists (
    select 1
    from pg_catalog.generate_series(p_anchor_x, p_anchor_x + v_item.width - 1) gx(x)
    cross join pg_catalog.generate_series(p_anchor_y, p_anchor_y + v_item.height - 1) gy(y)
    where not private.cell_is_unlocked(v_town.town_id, gx.x, gy.y)
  ) then perform private.raise_api_error('LAND_LOCKED'); end if;
  if exists (
    select 1
    from pg_catalog.generate_series(p_anchor_x, p_anchor_x + v_item.width - 1) gx(x)
    cross join pg_catalog.generate_series(p_anchor_y, p_anchor_y + v_item.height - 1) gy(y)
    where private.cell_is_occupied(v_town.town_id, gx.x, gy.y, v_building.id)
  ) then perform private.raise_api_error('CELL_OCCUPIED'); end if;
  if exists (
    select 1
    from pg_catalog.generate_series(p_anchor_x, p_anchor_x + v_item.width - 1) gx(x)
    cross join pg_catalog.generate_series(p_anchor_y, p_anchor_y + v_item.height - 1) gy(y)
    where exists (
      select 1 from private.cell_terrain(v_town.map_layout_id, gx.x, gy.y)
    )
  ) then perform private.raise_api_error('RIVER_BLOCKED'); end if;
  if not private.building_has_road_access(
    v_town.town_id, p_anchor_x, p_anchor_y, v_item.width, v_item.height
  ) then perform private.raise_api_error('ROAD_REQUIRED'); end if;

  update public.placed_buildings
  set anchor_x = p_anchor_x,
      anchor_y = p_anchor_y,
      updated_at = v_timestamp
  where id = v_building.id;
  update public.towns set updated_at = v_timestamp where town_id = v_town.town_id;

  v_response := jsonb_build_object(
    'building', private.placed_building_json(v_building.id),
    'coinBalance', v_town.coins,
    'population', v_town.population,
    'updatedAt', v_timestamp
  );
  perform private.save_rpc_request(
    v_user_id, 'move_building', p_request_id, v_hash, v_response
  );
  return v_response;
end;
$$;

create or replace function public.place_road_line(
  p_building_type_code text,
  p_cells jsonb,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := private.current_user_id();
  v_town public.towns%rowtype;
  v_item public.building_types%rowtype;
  v_hash text;
  v_cached jsonb;
  v_cells jsonb;
  v_cell_count integer;
  v_new_cell_count integer;
  v_min_x integer;
  v_max_x integer;
  v_min_y integer;
  v_max_y integer;
  v_horizontal boolean;
  v_orientation text;
  v_river_count integer;
  v_corner_count integer;
  v_river_area_count integer;
  v_river_area_id uuid;
  v_river_segment_kind text;
  v_river_bridgeable boolean;
  v_is_bridge boolean := false;
  v_structure_id uuid;
  v_total_cost bigint;
  v_timestamp timestamptz := pg_catalog.clock_timestamp();
  v_building_ids uuid[] := '{}'::uuid[];
  v_building_id uuid;
  v_response jsonb;
begin
  if p_request_id is null or p_building_type_code is null
    or jsonb_typeof(p_cells) <> 'array'
    or jsonb_array_length(p_cells) = 0 then
    perform private.raise_api_error('INVALID_INPUT');
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_cells) c(value)
    where coalesce(jsonb_typeof(c.value), 'null') <> 'object'
      or coalesce(jsonb_typeof(c.value->'x'), 'null') <> 'number'
      or coalesce(jsonb_typeof(c.value->'y'), 'null') <> 'number'
      or (c.value->>'x') !~ '^-?[0-9]+$'
      or (c.value->>'y') !~ '^-?[0-9]+$'
  ) then perform private.raise_api_error('INVALID_INPUT'); end if;

  select count(*), min((value->>'x')::integer), max((value->>'x')::integer),
         min((value->>'y')::integer), max((value->>'y')::integer)
  into v_cell_count, v_min_x, v_max_x, v_min_y, v_max_y
  from jsonb_array_elements(p_cells);
  if v_cell_count > 100 or (
    select count(distinct ((value->>'x')::text || ':' || (value->>'y')::text))
    from jsonb_array_elements(p_cells)
  ) <> v_cell_count then perform private.raise_api_error('INVALID_INPUT'); end if;

  v_horizontal := v_min_y = v_max_y;
  if not v_horizontal and v_min_x <> v_max_x then
    perform private.raise_api_error('INVALID_INPUT');
  end if;
  if (v_horizontal and v_max_x - v_min_x + 1 <> v_cell_count)
    or (not v_horizontal and v_max_y - v_min_y + 1 <> v_cell_count) then
    perform private.raise_api_error('INVALID_INPUT');
  end if;
  v_orientation := case when v_horizontal then 'horizontal' else 'vertical' end;
  select jsonb_agg(
    jsonb_build_object('x', (value->>'x')::integer, 'y', (value->>'y')::integer)
    order by case when v_horizontal then (value->>'x')::integer else (value->>'y')::integer end
  ) into v_cells
  from jsonb_array_elements(p_cells);

  v_hash := private.input_hash(jsonb_build_object(
    'buildingTypeCode', p_building_type_code,
    'cells', v_cells
  ));
  v_cached := private.lock_rpc_request(v_user_id, 'place_road_line', p_request_id, v_hash);
  if v_cached is not null then return v_cached; end if;

  select * into v_town from public.towns where owner_id = v_user_id for update;
  if not found then perform private.raise_api_error('NOT_OWNER'); end if;
  select * into v_item from public.building_types where code = p_building_type_code;
  if not found then perform private.raise_api_error('NOT_FOUND'); end if;
  if v_item.category <> 'road' or v_item.width <> 1 or v_item.height <> 1 then
    perform private.raise_api_error('INVALID_INPUT');
  end if;
  if not v_item.enabled then perform private.raise_api_error('CATALOG_ITEM_DISABLED'); end if;
  if v_item.cost_coins is null then perform private.raise_api_error('PRICE_NOT_SET'); end if;
  if v_min_x < 0 or v_min_y < 0
    or v_max_x >= v_town.map_width or v_max_y >= v_town.map_height then
    perform private.raise_api_error('OUT_OF_MAP');
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_cells) c(value)
    where not private.cell_is_unlocked(
      v_town.town_id, (c.value->>'x')::integer, (c.value->>'y')::integer
    )
  ) then perform private.raise_api_error('LAND_LOCKED'); end if;

  select count(t.area_id),
         count(t.area_id) filter (where t.segment_kind = 'corner'),
         count(distinct t.area_id),
         (array_agg(distinct t.area_id) filter (where t.area_id is not null))[1],
         min(t.segment_kind),
         bool_and(t.bridgeable)
  into v_river_count, v_corner_count, v_river_area_count,
       v_river_area_id, v_river_segment_kind, v_river_bridgeable
  from jsonb_array_elements(v_cells) c(value)
  left join lateral private.cell_terrain(
    v_town.map_layout_id,
    (c.value->>'x')::integer,
    (c.value->>'y')::integer
  ) t on true;

  if v_river_count > 0 then
    v_is_bridge := true;
    if v_corner_count > 0 then perform private.raise_api_error('BRIDGE_CORNER_FORBIDDEN'); end if;
    if v_river_area_count = 1 and (
      (v_river_segment_kind = 'vertical' and v_orientation <> 'horizontal')
      or (v_river_segment_kind = 'horizontal' and v_orientation <> 'vertical')
    ) then
      perform private.raise_api_error('BRIDGE_DIRECTION_INVALID');
    end if;
    if v_cell_count <> 7 or v_river_count <> 5 or v_river_area_count <> 1
      or not coalesce(v_river_bridgeable, false) then
      perform private.raise_api_error('BRIDGE_SPAN_REQUIRED');
    end if;
    if exists (
      select 1
      from jsonb_array_elements(v_cells) with ordinality c(value, ordinal)
      left join lateral private.cell_terrain(
        v_town.map_layout_id,
        (c.value->>'x')::integer,
        (c.value->>'y')::integer
      ) t on true
      where (c.ordinal in (1, 7) and t.area_id is not null)
         or (c.ordinal between 2 and 6 and t.area_id is distinct from v_river_area_id)
    ) then perform private.raise_api_error('BRIDGE_SPAN_REQUIRED'); end if;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_cells) c(value)
    where private.cell_is_occupied(
      v_town.town_id, (c.value->>'x')::integer, (c.value->>'y')::integer
    )
  ) then perform private.raise_api_error('CELL_OCCUPIED'); end if;

  v_new_cell_count := jsonb_array_length(v_cells);

  if v_is_bridge then
    select bridge_cell_cost_coins * 5 + v_item.cost_coins * 2
    into v_total_cost
    from public.map_layouts where id = v_town.map_layout_id;
  else
    v_total_cost := v_item.cost_coins * v_new_cell_count;
  end if;
  if v_town.coins < v_total_cost then perform private.raise_api_error('INSUFFICIENT_COINS'); end if;

  if v_is_bridge then
    insert into public.road_structures (town_id, orientation)
    values (v_town.town_id, v_orientation)
    returning id into v_structure_id;
  end if;

  for v_building_id in
    insert into public.placed_buildings (
      town_id, building_type_code, anchor_x, anchor_y,
      purchase_cost_coins, road_structure_id, created_at, updated_at
    )
    select v_town.town_id,
           v_item.code,
           (c.value->>'x')::integer,
           (c.value->>'y')::integer,
           case when v_is_bridge and c.ordinal between 2 and 6
             then ml.bridge_cell_cost_coins else v_item.cost_coins end,
           v_structure_id,
           v_timestamp,
           v_timestamp
    from jsonb_array_elements(v_cells) with ordinality c(value, ordinal)
    cross join public.map_layouts ml
    where ml.id = v_town.map_layout_id
      and (v_is_bridge or not private.cell_has_road(
        v_town.town_id, (c.value->>'x')::integer, (c.value->>'y')::integer
      ))
    returning id
  loop
    v_building_ids := array_append(v_building_ids, v_building_id);
  end loop;

  insert into public.coin_ledger (
    town_id, amount, reason, idempotency_key, metadata
  ) values (
    v_town.town_id,
    -v_total_cost,
    case when v_is_bridge then 'bridge_purchase' else 'road_purchase' end,
    'place_road_line:' || v_user_id::text || ':' || p_request_id::text,
    jsonb_build_object(
      'buildingIds', to_jsonb(v_building_ids),
      'roadStructureId', v_structure_id,
      'placementKind', case when v_is_bridge then 'bridge' else 'road' end
    )
  );
  update public.towns
  set coins = coins - v_total_cost, updated_at = v_timestamp
  where town_id = v_town.town_id
  returning * into v_town;

  select jsonb_build_object(
    'buildings', coalesce(jsonb_agg(private.placed_building_json(id)), '[]'::jsonb),
    'placementKind', case when v_is_bridge then 'bridge' else 'road' end,
    'roadStructureId', v_structure_id,
    'totalCostCoins', v_total_cost,
    'coinBalance', v_town.coins,
    'population', v_town.population,
    'updatedAt', v_timestamp
  ) into v_response
  from unnest(v_building_ids) ids(id);

  perform private.save_rpc_request(
    v_user_id, 'place_road_line', p_request_id, v_hash, v_response
  );
  return v_response;
end;
$$;

create or replace function private.bridge_structure_is_valid(p_structure_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with structure_cells as (
    select rs.id, rs.town_id, rs.orientation, t.map_layout_id,
           pb.id as building_id, pb.anchor_x::integer as x, pb.anchor_y::integer as y,
           row_number() over (
             order by case when rs.orientation = 'horizontal' then pb.anchor_x else pb.anchor_y end
           ) as ordinal,
           bt.category
    from public.road_structures rs
    join public.towns t on t.town_id = rs.town_id
    join public.placed_buildings pb on pb.road_structure_id = rs.id
    join public.building_types bt on bt.code = pb.building_type_code
    where rs.id = p_structure_id
  ), classified as (
    select sc.*, terrain.area_id, terrain.segment_kind, terrain.bridgeable
    from structure_cells sc
    left join lateral private.cell_terrain(sc.map_layout_id, sc.x, sc.y) terrain on true
  )
  select count(*) = 7
    and count(distinct building_id) = 7
    and bool_and(category = 'road')
    and (
      (min(orientation) = 'horizontal' and min(y) = max(y) and max(x) - min(x) = 6)
      or
      (min(orientation) = 'vertical' and min(x) = max(x) and max(y) - min(y) = 6)
    )
    and count(area_id) = 5
    and count(distinct area_id) = 1
    and bool_and(
      (ordinal in (1, 7) and area_id is null)
      or
      (ordinal between 2 and 6 and area_id is not null and bridgeable)
    )
    and bool_and(
      area_id is null
      or (orientation = 'horizontal' and segment_kind = 'vertical')
      or (orientation = 'vertical' and segment_kind = 'horizontal')
    )
  from classified
$$;

create or replace function public.delete_road(
  p_building_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := private.current_user_id();
  v_town public.towns%rowtype;
  v_building public.placed_buildings%rowtype;
  v_item public.building_types%rowtype;
  v_hash text;
  v_cached jsonb;
  v_deleted_ids uuid[];
  v_timestamp timestamptz := pg_catalog.clock_timestamp();
  v_response jsonb;
begin
  if p_request_id is null or p_building_id is null then
    perform private.raise_api_error('INVALID_INPUT');
  end if;
  v_hash := private.input_hash(jsonb_build_object('buildingId', p_building_id));
  v_cached := private.lock_rpc_request(v_user_id, 'delete_road', p_request_id, v_hash);
  if v_cached is not null then return v_cached; end if;

  select * into v_building
  from public.placed_buildings
  where id = p_building_id
  for update;
  if not found then perform private.raise_api_error('NOT_FOUND'); end if;
  select * into v_town from public.towns where town_id = v_building.town_id for update;
  if v_town.owner_id <> v_user_id then perform private.raise_api_error('NOT_OWNER'); end if;
  select * into v_item from public.building_types where code = v_building.building_type_code;
  if v_item.category <> 'road' then perform private.raise_api_error('DELETE_NOT_ALLOWED'); end if;

  if v_building.road_structure_id is null then
    v_deleted_ids := array[v_building.id];
  else
    perform 1 from public.road_structures
    where id = v_building.road_structure_id and town_id = v_town.town_id
    for update;
    perform 1 from public.placed_buildings
    where road_structure_id = v_building.road_structure_id
    for update;
    if not private.bridge_structure_is_valid(v_building.road_structure_id) then
      perform private.raise_api_error('BRIDGE_GROUP_INVALID');
    end if;
    select array_agg(id order by id) into v_deleted_ids
    from public.placed_buildings
    where road_structure_id = v_building.road_structure_id;
  end if;

  if not private.all_buildings_have_road_access(v_town.town_id, v_deleted_ids) then
    perform private.raise_api_error('ROAD_IN_USE');
  end if;

  delete from public.placed_buildings where id = any(v_deleted_ids);
  if v_building.road_structure_id is not null then
    delete from public.road_structures where id = v_building.road_structure_id;
  end if;
  update public.towns set updated_at = v_timestamp where town_id = v_town.town_id;

  v_response := jsonb_build_object(
    'deletionKind', case when v_building.road_structure_id is null then 'road' else 'bridge' end,
    'deletedBuildingIds', to_jsonb(v_deleted_ids),
    'deletedRoadStructureId', v_building.road_structure_id,
    'coinBalance', v_town.coins,
    'population', v_town.population,
    'updatedAt', v_timestamp
  );
  perform private.save_rpc_request(
    v_user_id, 'delete_road', p_request_id, v_hash, v_response
  );
  return v_response;
end;
$$;

alter table public.profiles enable row level security;
alter table public.building_types enable row level security;
alter table public.building_effects enable row level security;
alter table public.map_layouts enable row level security;
alter table public.map_terrain_areas enable row level security;
alter table public.towns enable row level security;
alter table public.unlocked_areas enable row level security;
alter table public.road_structures enable row level security;
alter table public.placed_buildings enable row level security;
alter table public.coin_ledger enable row level security;
alter table public.town_rpc_requests enable row level security;

drop policy if exists profiles_read_authenticated on public.profiles;
create policy profiles_read_authenticated on public.profiles
  for select to authenticated using (true);
drop policy if exists building_types_read_all on public.building_types;
create policy building_types_read_all on public.building_types
  for select to anon, authenticated using (true);
drop policy if exists building_effects_read_all on public.building_effects;
create policy building_effects_read_all on public.building_effects
  for select to anon, authenticated using (true);
drop policy if exists map_layouts_read_authenticated on public.map_layouts;
create policy map_layouts_read_authenticated on public.map_layouts
  for select to authenticated using (true);
drop policy if exists map_terrain_read_authenticated on public.map_terrain_areas;
create policy map_terrain_read_authenticated on public.map_terrain_areas
  for select to authenticated using (true);
drop policy if exists towns_owner_read on public.towns;
drop policy if exists towns_read_authenticated on public.towns;
create policy towns_read_authenticated on public.towns
  for select to authenticated using (true);
drop policy if exists unlocked_areas_read_authenticated on public.unlocked_areas;
create policy unlocked_areas_read_authenticated on public.unlocked_areas
  for select to authenticated using (true);
drop policy if exists road_structures_read_authenticated on public.road_structures;
create policy road_structures_read_authenticated on public.road_structures
  for select to authenticated using (true);
drop policy if exists placed_buildings_read_authenticated on public.placed_buildings;
create policy placed_buildings_read_authenticated on public.placed_buildings
  for select to authenticated using (true);
drop policy if exists coin_ledger_owner_read on public.coin_ledger;
create policy coin_ledger_owner_read on public.coin_ledger
  for select to authenticated using (
    exists (
      select 1 from public.towns t
      where t.town_id = coin_ledger.town_id
        and t.owner_id = (select auth.uid())
    )
  );

create or replace view public.public_towns
with (security_invoker = true)
as
select town_id, owner_id, name, population, map_width, map_height,
       map_layout_id, created_at, updated_at
from public.towns;

revoke insert, update, delete, truncate, references, trigger
  on public.building_types, public.building_effects,
     public.map_layouts, public.map_terrain_areas,
     public.towns, public.unlocked_areas, public.road_structures,
     public.placed_buildings, public.coin_ledger, public.town_rpc_requests
  from anon, authenticated;
revoke all privileges on table public.town_rpc_requests
  from public, anon, authenticated;
grant select on public.building_types, public.building_effects to anon, authenticated;
grant select on public.profiles, public.map_layouts, public.map_terrain_areas,
  public.public_towns, public.unlocked_areas,
  public.road_structures, public.placed_buildings, public.coin_ledger
  to authenticated;
grant select (
  town_id, owner_id, name, population, map_width, map_height,
  map_layout_id, created_at, updated_at
) on public.towns to authenticated;

revoke all on function public.place_building(text, integer, integer, uuid) from public, anon;
revoke all on function public.move_building(uuid, integer, integer, uuid) from public, anon;
revoke all on function public.place_road_line(text, jsonb, uuid) from public, anon;
revoke all on function public.delete_road(uuid, uuid) from public, anon;
grant execute on function public.place_building(text, integer, integer, uuid) to authenticated;
grant execute on function public.move_building(uuid, integer, integer, uuid) to authenticated;
grant execute on function public.place_road_line(text, jsonb, uuid) to authenticated;
grant execute on function public.delete_road(uuid, uuid) to authenticated;

revoke all on all functions in schema private from public, anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;
