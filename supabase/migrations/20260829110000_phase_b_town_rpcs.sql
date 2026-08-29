-- Phase B: common RPC envelope, town mutations, land unlock and rename.

alter function public.place_building(text, integer, integer, uuid) set schema private;
alter function private.place_building(text, integer, integer, uuid) rename to place_building_impl;
alter function public.move_building(uuid, integer, integer, uuid) set schema private;
alter function private.move_building(uuid, integer, integer, uuid) rename to move_building_impl;
alter function public.place_road_line(text, jsonb, uuid) set schema private;
alter function private.place_road_line(text, jsonb, uuid) rename to place_road_line_impl;
alter function public.delete_road(uuid, uuid) set schema private;
alter function private.delete_road(uuid, uuid) rename to delete_road_impl;

drop function if exists public.place_building(uuid, text, integer, integer, uuid);

revoke all on function private.place_building_impl(text, integer, integer, uuid) from public, anon, authenticated;
revoke all on function private.move_building_impl(uuid, integer, integer, uuid) from public, anon, authenticated;
revoke all on function private.place_road_line_impl(text, jsonb, uuid) from public, anon, authenticated;
revoke all on function private.delete_road_impl(uuid, uuid) from public, anon, authenticated;

create or replace function private.api_error_message(p_code text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select case p_code
    when 'UNAUTHENTICATED' then 'Googleでログインしてください。'
    when 'INVALID_INPUT' then '入力内容を確認してください。'
    when 'CATALOG_ITEM_DISABLED' then 'この建物は現在購入できません。'
    when 'PRICE_NOT_SET' then 'この建物の価格は未設定です。'
    when 'INSUFFICIENT_COINS' then 'コインが不足しています。'
    when 'OUT_OF_MAP' then 'マップの範囲外です。'
    when 'LAND_LOCKED' then '開放されていない土地です。'
    when 'CELL_OCCUPIED' then 'すでに建物が配置されています。'
    when 'ROAD_REQUIRED' then '道路に接する場所を指定してください。'
    when 'RIVER_BLOCKED' then '川の上には配置できません。'
    when 'BRIDGE_SPAN_REQUIRED' then '橋は陸1セル、川5セル、陸1セルで指定してください。'
    when 'BRIDGE_DIRECTION_INVALID' then '橋は川と直交させてください。'
    when 'BRIDGE_CORNER_FORBIDDEN' then '川の曲がり角には橋を配置できません。'
    when 'PLACEMENT_IMMOVABLE' then '道路と橋は移動できません。'
    when 'DELETE_NOT_ALLOWED' then 'この建物は削除できません。'
    when 'ROAD_IN_USE' then '建物が利用している道路は削除できません。'
    when 'BRIDGE_GROUP_INVALID' then '橋の構造が不正です。'
    when 'AREA_ALREADY_UNLOCKED' then 'この土地はすでに開放されています。'
    when 'AREA_NOT_ADJACENT' then '既存の土地と辺で接する場所を指定してください。'
    when 'NOT_OWNER' then 'この操作を行う権限がありません。'
    when 'NOT_FOUND' then '対象が見つかりませんでした。'
    when 'CONFLICT' then '同じリクエストIDが別の操作に使用されています。'
    else '処理を完了できませんでした。'
  end
$$;

create or replace function private.api_failure(p_code text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'ok', false,
    'error', jsonb_build_object(
      'code', case when p_code = any(array[
        'UNAUTHENTICATED', 'INVALID_INPUT', 'CATALOG_ITEM_DISABLED',
        'PRICE_NOT_SET', 'INSUFFICIENT_COINS', 'OUT_OF_MAP', 'LAND_LOCKED',
        'CELL_OCCUPIED', 'ROAD_REQUIRED', 'RIVER_BLOCKED',
        'BRIDGE_SPAN_REQUIRED', 'BRIDGE_DIRECTION_INVALID',
        'BRIDGE_CORNER_FORBIDDEN', 'PLACEMENT_IMMOVABLE',
        'DELETE_NOT_ALLOWED', 'ROAD_IN_USE', 'BRIDGE_GROUP_INVALID',
        'AREA_ALREADY_UNLOCKED', 'AREA_NOT_ADJACENT', 'NOT_OWNER',
        'NOT_FOUND', 'CONFLICT'
      ]) then p_code else 'INTERNAL_ERROR' end,
      'message', private.api_error_message(p_code)
    )
  )
$$;

create or replace function private.api_success(p_data jsonb)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  select jsonb_build_object('ok', true, 'data', p_data)
$$;

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

  update public.towns set population = v_population where town_id = p_town_id;
  return v_population;
end;
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
  v_data jsonb;
  v_town_id uuid;
  v_population bigint;
begin
  begin
    if exists (
      select 1 from public.building_types
      where code = p_building_type_code and category = 'road'
    ) then
      perform private.raise_api_error('INVALID_INPUT');
    end if;
    v_data := private.place_building_impl(
      p_building_type_code, p_anchor_x, p_anchor_y, p_request_id
    );
    select town_id into v_town_id from public.towns where owner_id = auth.uid();
    v_population := private.recalculate_town_population(v_town_id);
    v_data := jsonb_set(v_data, '{population}', to_jsonb(v_population), true);
    return private.api_success(v_data);
  exception
    when sqlstate 'P0001' then return private.api_failure(sqlerrm);
    when others then return private.api_failure('INTERNAL_ERROR');
  end;
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
  v_data jsonb;
  v_town_id uuid;
  v_population bigint;
begin
  begin
    v_data := private.move_building_impl(
      p_building_id, p_anchor_x, p_anchor_y, p_request_id
    );
    select town_id into v_town_id from public.towns where owner_id = auth.uid();
    v_population := private.recalculate_town_population(v_town_id);
    v_data := jsonb_set(v_data, '{population}', to_jsonb(v_population), true);
    return private.api_success(v_data);
  exception
    when sqlstate 'P0001' then return private.api_failure(sqlerrm);
    when others then return private.api_failure('INTERNAL_ERROR');
  end;
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
begin
  begin
    return private.api_success(private.place_road_line_impl(
      p_building_type_code, p_cells, p_request_id
    ));
  exception
    when sqlstate 'P0001' then return private.api_failure(sqlerrm);
    when others then return private.api_failure('INTERNAL_ERROR');
  end;
end;
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
begin
  begin
    return private.api_success(private.delete_road_impl(p_building_id, p_request_id));
  exception
    when sqlstate 'P0001' then return private.api_failure(sqlerrm);
    when others then return private.api_failure('INTERNAL_ERROR');
  end;
end;
$$;

alter table public.unlocked_areas
  drop constraint if exists unlocked_areas_town_xy_size_key;
alter table public.unlocked_areas
  add constraint unlocked_areas_town_xy_size_key
  unique (town_id, x, y, width, height);

create or replace function private.unlock_land_impl(
  p_x integer,
  p_y integer,
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
  v_hash text;
  v_cached jsonb;
  v_timestamp timestamptz := pg_catalog.clock_timestamp();
  v_response jsonb;
begin
  if p_request_id is null or p_x is null or p_y is null
    or p_x < 0 or p_y < 0 or p_x % 20 <> 0 or p_y % 20 <> 0
    or p_x + 20 > 100 or p_y + 20 > 100 then
    perform private.raise_api_error('INVALID_INPUT');
  end if;

  v_hash := private.input_hash(jsonb_build_object('x', p_x, 'y', p_y));
  v_cached := private.lock_rpc_request(v_user_id, 'unlock_land', p_request_id, v_hash);
  if v_cached is not null then return v_cached; end if;

  select * into v_town from public.towns where owner_id = v_user_id for update;
  if not found then perform private.raise_api_error('NOT_OWNER'); end if;

  if exists (
    select 1 from public.unlocked_areas
    where town_id = v_town.town_id and x = p_x and y = p_y
  ) then
    perform private.raise_api_error('AREA_ALREADY_UNLOCKED');
  end if;

  if not exists (
    select 1
    from public.unlocked_areas ua
    where ua.town_id = v_town.town_id
      and (
        ((ua.x + ua.width = p_x or p_x + 20 = ua.x)
          and greatest(ua.y, p_y) < least(ua.y + ua.height, p_y + 20))
        or
        ((ua.y + ua.height = p_y or p_y + 20 = ua.y)
          and greatest(ua.x, p_x) < least(ua.x + ua.width, p_x + 20))
      )
  ) then
    perform private.raise_api_error('AREA_NOT_ADJACENT');
  end if;

  if v_town.coins < 1000 then perform private.raise_api_error('INSUFFICIENT_COINS'); end if;

  insert into public.unlocked_areas (
    town_id, x, y, width, height, unlocked_at, unlock_method
  ) values (
    v_town.town_id, p_x, p_y, 20, 20, v_timestamp, 'coin_purchase'
  );
  insert into public.coin_ledger (
    town_id, amount, reason, idempotency_key, metadata
  ) values (
    v_town.town_id, -1000, 'land_unlock',
    'unlock_land:' || v_user_id::text || ':' || p_request_id::text,
    jsonb_build_object('x', p_x, 'y', p_y, 'width', 20, 'height', 20)
  );
  update public.towns
  set coins = coins - 1000, updated_at = v_timestamp
  where town_id = v_town.town_id
  returning * into v_town;

  v_response := jsonb_build_object(
    'unlocked_area', jsonb_build_object('x', p_x, 'y', p_y, 'width', 20, 'height', 20),
    'coin_balance', v_town.coins,
    'updated_at', v_timestamp
  );
  perform private.save_rpc_request(
    v_user_id, 'unlock_land', p_request_id, v_hash, v_response
  );
  return v_response;
end;
$$;

create or replace function public.unlock_land(
  p_x integer,
  p_y integer,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    return private.api_success(private.unlock_land_impl(p_x, p_y, p_request_id));
  exception
    when sqlstate 'P0001' then return private.api_failure(sqlerrm);
    when others then return private.api_failure('INTERNAL_ERROR');
  end;
end;
$$;

create or replace function public.rename_building(
  p_building_id uuid,
  p_custom_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_building public.placed_buildings%rowtype;
  v_owner_id uuid;
  v_catalog_name text;
  v_custom_name text;
  v_timestamp timestamptz := pg_catalog.clock_timestamp();
begin
  if v_user_id is null then return private.api_failure('UNAUTHENTICATED'); end if;
  if p_building_id is null then return private.api_failure('INVALID_INPUT'); end if;

  select pb.*
  into v_building
  from public.placed_buildings pb
  where pb.id = p_building_id
  for update of pb;

  if not found then return private.api_failure('NOT_FOUND'); end if;

  select t.owner_id, bt.name
  into v_owner_id, v_catalog_name
  from public.towns t
  join public.building_types bt on bt.code = v_building.building_type_code
  where t.town_id = v_building.town_id;

  if v_owner_id <> v_user_id then return private.api_failure('NOT_OWNER'); end if;

  if p_custom_name is null then
    v_custom_name := null;
  else
    v_custom_name := btrim(p_custom_name);
    if char_length(v_custom_name) < 1 or char_length(v_custom_name) > 30
      or v_custom_name ~ '[[:cntrl:]]' then
      return private.api_failure('INVALID_INPUT');
    end if;
    if v_custom_name = v_catalog_name then v_custom_name := null; end if;
  end if;

  update public.placed_buildings
  set custom_name = v_custom_name, updated_at = v_timestamp
  where id = p_building_id;

  return private.api_success(jsonb_build_object(
    'building', private.placed_building_json(p_building_id),
    'updatedAt', v_timestamp
  ));
exception
  when others then return private.api_failure('INTERNAL_ERROR');
end;
$$;

revoke all on function public.place_building(text, integer, integer, uuid) from public, anon;
revoke all on function public.move_building(uuid, integer, integer, uuid) from public, anon;
revoke all on function public.place_road_line(text, jsonb, uuid) from public, anon;
revoke all on function public.delete_road(uuid, uuid) from public, anon;
revoke all on function public.unlock_land(integer, integer, uuid) from public, anon;
revoke all on function public.rename_building(uuid, text) from public, anon;

grant execute on function public.place_building(text, integer, integer, uuid) to authenticated, service_role;
grant execute on function public.move_building(uuid, integer, integer, uuid) to authenticated, service_role;
grant execute on function public.place_road_line(text, jsonb, uuid) to authenticated, service_role;
grant execute on function public.delete_road(uuid, uuid) to authenticated, service_role;
grant execute on function public.unlock_land(integer, integer, uuid) to authenticated, service_role;
grant execute on function public.rename_building(uuid, text) to authenticated, service_role;

revoke all on all functions in schema private from public, anon, authenticated;
