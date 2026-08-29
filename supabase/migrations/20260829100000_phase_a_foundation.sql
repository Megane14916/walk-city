-- Phase A: canonical catalog, schema repairs, read views, RLS and grants.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Initialization is invoked from the frontend auth callback in Phase C.
-- Remove the legacy auth.users trigger so it cannot create partial user data.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

alter table public.coin_ledger alter column town_id drop default;
alter table public.coin_ledger
  alter column metadata type jsonb using coalesce(metadata::jsonb, '{}'::jsonb),
  alter column metadata set default '{}'::jsonb,
  alter column metadata set not null;

alter table public.unlocked_areas
  alter column unlocked_at type timestamptz
    using coalesce(nullif(unlocked_at::text, '')::timestamptz, now()),
  alter column unlocked_at set default now(),
  alter column unlocked_at set not null;

alter table public.building_effects drop column if exists description;
alter table public.building_effects
  alter column metadata set default '{}'::jsonb,
  alter column metadata set not null;

-- Preserve remote data while replacing legacy frontend codes with the Phase 0 codes.
with code_map(old_code, new_code) as (
  values
    ('house-small', 'small_house'),
    ('park', 'small_park'),
    ('commercial-facility', 'commercial'),
    ('city-hall', 'town_hall')
)
insert into public.building_types (
  code, name, category, width, height, cost_coins,
  description, enabled, catalog_version
)
select
  m.new_code, bt.name, bt.category, bt.width, bt.height, bt.cost_coins,
  bt.description, bt.enabled, bt.catalog_version
from code_map m
join public.building_types bt on bt.code = m.old_code
on conflict (code) do update
set name = excluded.name,
    category = excluded.category,
    width = excluded.width,
    height = excluded.height,
    cost_coins = excluded.cost_coins,
    description = excluded.description,
    enabled = excluded.enabled,
    catalog_version = excluded.catalog_version;

update public.building_effects be
set building_type_code = case be.building_type_code
  when 'house-small' then 'small_house'
  when 'park' then 'small_park'
  when 'commercial-facility' then 'commercial'
  when 'city-hall' then 'town_hall'
  else be.building_type_code
end
where be.building_type_code in (
  'house-small', 'park', 'commercial-facility', 'city-hall'
);

update public.placed_buildings pb
set building_type_code = case pb.building_type_code
  when 'house-small' then 'small_house'
  when 'park' then 'small_park'
  when 'commercial-facility' then 'commercial'
  when 'city-hall' then 'town_hall'
  else pb.building_type_code
end
where pb.building_type_code in (
  'house-small', 'park', 'commercial-facility', 'city-hall'
);

delete from public.building_types
where code in ('house-small', 'park', 'commercial-facility', 'city-hall', 'future-building');

create or replace function private.recalculate_town_population(p_town_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_population bigint;
begin
  select coalesce(sum(be.value), 0)::bigint
  into v_population
  from public.placed_buildings pb
  join public.building_effects be
    on be.building_type_code = pb.building_type_code
   and be.effect_type = 'population_flat'
  where pb.town_id = p_town_id;

  update public.towns
  set population = v_population,
      updated_at = now()
  where town_id = p_town_id;

  return v_population;
end;
$$;

revoke all on function private.recalculate_town_population(uuid) from public, anon, authenticated;
grant execute on function private.recalculate_town_population(uuid) to service_role;

-- A security-definer scalar is used so the security-invoker view does not
-- require granting the private coins column on the towns base table.
create or replace function public.current_town_coins(p_town_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select t.coins
  from public.towns t
  where t.town_id = p_town_id
    and t.owner_id = auth.uid()
$$;

revoke all on function public.current_town_coins(uuid) from public, anon;
grant execute on function public.current_town_coins(uuid) to authenticated, service_role;

create or replace view public.building_catalog_view
with (security_invoker = true)
as
select
  bt.code,
  bt.name,
  bt.category,
  bt.width,
  bt.height,
  bt.cost_coins,
  bt.enabled,
  bt.description,
  bt.catalog_version,
  coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'effect_type', be.effect_type,
        'value', be.value,
        'target_category', be.target_category,
        'scope', be.scope,
        'stacking_rule', be.stacking_rule,
        'metadata', coalesce(be.metadata, '{}'::jsonb)
      ) order by be.effect_type, be.id
    )
    from public.building_effects be
    where be.building_type_code = bt.code
  ), '[]'::jsonb) as effects
from public.building_types bt;

create or replace view public.my_town_details_view
with (security_invoker = true)
as
select
  t.town_id,
  t.owner_id,
  p.display_name,
  t.name as town_name,
  public.current_town_coins(t.town_id) as coins,
  t.population,
  t.map_width,
  t.map_height,
  coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', pb.id,
        'building_type_code', pb.building_type_code,
        'custom_name', pb.custom_name,
        'anchor_x', pb.anchor_x,
        'anchor_y', pb.anchor_y,
        'road_structure_id', pb.road_structure_id,
        'road_variant', case
          when bt.category <> 'road' then null
          when pb.road_structure_id is null then 'normal'
          when rs.orientation = 'horizontal' then 'bridge_horizontal'
          else 'bridge_vertical'
        end,
        'created_at', pb.created_at,
        'updated_at', pb.updated_at
      ) order by pb.created_at, pb.id
    )
    from public.placed_buildings pb
    join public.building_types bt on bt.code = pb.building_type_code
    left join public.road_structures rs on rs.id = pb.road_structure_id
    where pb.town_id = t.town_id
  ), '[]'::jsonb) as buildings,
  coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'x', ua.x,
        'y', ua.y,
        'width', ua.width,
        'height', ua.height
      ) order by ua.y, ua.x
    )
    from public.unlocked_areas ua
    where ua.town_id = t.town_id
  ), '[]'::jsonb) as unlocked_areas,
  coalesce((select max(bt.catalog_version) from public.building_types bt where bt.enabled), 0) as catalog_version
from public.towns t
join public.profiles p on p.id = t.owner_id
where t.owner_id = auth.uid();

create or replace view public.public_town_details_view
with (security_invoker = true)
as
select
  t.town_id,
  t.owner_id,
  p.display_name,
  t.name as town_name,
  t.population,
  t.map_width,
  t.map_height,
  coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', pb.id,
        'building_type_code', pb.building_type_code,
        'custom_name', pb.custom_name,
        'anchor_x', pb.anchor_x,
        'anchor_y', pb.anchor_y,
        'road_structure_id', pb.road_structure_id,
        'road_variant', case
          when bt.category <> 'road' then null
          when pb.road_structure_id is null then 'normal'
          when rs.orientation = 'horizontal' then 'bridge_horizontal'
          else 'bridge_vertical'
        end,
        'created_at', pb.created_at,
        'updated_at', pb.updated_at
      ) order by pb.created_at, pb.id
    )
    from public.placed_buildings pb
    join public.building_types bt on bt.code = pb.building_type_code
    left join public.road_structures rs on rs.id = pb.road_structure_id
    where pb.town_id = t.town_id
  ), '[]'::jsonb) as buildings,
  coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'x', ua.x,
        'y', ua.y,
        'width', ua.width,
        'height', ua.height
      ) order by ua.y, ua.x
    )
    from public.unlocked_areas ua
    where ua.town_id = t.town_id
  ), '[]'::jsonb) as unlocked_areas,
  coalesce((select max(bt.catalog_version) from public.building_types bt where bt.enabled), 0) as catalog_version
from public.towns t
join public.profiles p on p.id = t.owner_id;

create or replace view public.population_ranking_view
with (security_invoker = true)
as
select
  rank() over (order by t.population desc) as rank,
  t.owner_id as user_id,
  p.display_name,
  t.town_id,
  t.name as town_name,
  t.population
from public.towns t
join public.profiles p on p.id = t.owner_id;

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
alter table public.daily_step_records enable row level security;
alter table public.town_rpc_requests enable row level security;

drop policy if exists profiles_read_authenticated on public.profiles;
create policy profiles_read_authenticated on public.profiles
  for select to authenticated using (true);
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists building_types_read_all on public.building_types;
create policy building_types_read_all on public.building_types
  for select to authenticated using (true);
drop policy if exists building_effects_read_all on public.building_effects;
create policy building_effects_read_all on public.building_effects
  for select to authenticated using (true);
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
      where t.town_id = coin_ledger.town_id and t.owner_id = auth.uid()
    )
  );
drop policy if exists daily_step_records_owner_read on public.daily_step_records;
create policy daily_step_records_owner_read on public.daily_step_records
  for select to authenticated using (user_id = auth.uid());

revoke all on all tables in schema public from anon;
revoke all on table public.profiles, public.building_types, public.building_effects,
  public.map_layouts, public.map_terrain_areas, public.towns,
  public.unlocked_areas, public.road_structures, public.placed_buildings,
  public.coin_ledger, public.daily_step_records, public.town_rpc_requests
  from authenticated;

grant select on public.profiles, public.building_types, public.building_effects,
  public.map_layouts, public.map_terrain_areas, public.unlocked_areas,
  public.road_structures, public.placed_buildings, public.coin_ledger,
  public.daily_step_records to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select (town_id, owner_id, name, population, map_width, map_height,
  map_layout_id, created_at, updated_at) on public.towns to authenticated;

grant select on public.building_catalog_view, public.my_town_details_view,
  public.public_town_details_view, public.population_ranking_view
  to authenticated;

grant all on table public.profiles, public.building_types, public.building_effects,
  public.map_layouts, public.map_terrain_areas, public.towns,
  public.unlocked_areas, public.road_structures, public.placed_buildings,
  public.coin_ledger, public.daily_step_records, public.town_rpc_requests
  to service_role;

revoke all on all functions in schema private from public, anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;
