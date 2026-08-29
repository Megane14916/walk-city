SET local check_function_bodies = off;

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "service_role";

REVOKE ALL ON FUNCTION "public"."delete_road"(uuid, uuid) FROM "service_role";

REVOKE ALL ON FUNCTION "public"."move_building"(uuid, integer, integer, uuid) FROM "service_role";

REVOKE ALL ON FUNCTION "public"."place_building"(text, integer, integer, uuid) FROM "service_role";

REVOKE ALL ON FUNCTION "public"."place_road_line"(text, jsonb, uuid) FROM "service_role";

ALTER TABLE "public"."health_connections"
  DROP CONSTRAINT "health_connections_user_id_fkey";

DROP FUNCTION "private"."initialize_user"(uuid);

DROP FUNCTION "public"."sync_step_rewards"(uuid, text, jsonb);

ALTER TABLE "public"."coin_ledger"
  ALTER COLUMN "metadata" DROP DEFAULT;

ALTER TABLE "public"."unlocked_areas"
  ALTER COLUMN "unlocked_at" DROP DEFAULT;

DROP TABLE "public"."health_connections";

ALTER TABLE "public"."coin_ledger"
  ALTER COLUMN "metadata" DROP DEFAULT;

ALTER TABLE "public"."coin_ledger"
  ALTER COLUMN "metadata" TYPE json USING "metadata"::json;

ALTER TABLE "public"."unlocked_areas"
  ALTER COLUMN "unlocked_at" DROP DEFAULT;

ALTER TABLE "public"."unlocked_areas"
  ALTER COLUMN "unlocked_at" TYPE text USING "unlocked_at"::text;

ALTER TABLE "public"."coin_ledger"
  ALTER COLUMN "town_id" SET DEFAULT gen_random_uuid();

CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
DECLARE
    random_hex TEXT;
    new_username TEXT;
BEGIN
    -- 0 から 16777215 (0xFFFFFF) までのランダムな数を6桁の16進数に変換
    random_hex := lpad(to_hex(floor(random() * 16777216)::int), 6, '0');
    new_username := 'user-' || random_hex;

    -- プロフィールテーブルに記録
    INSERT INTO public.profiles (id, display_name)
    VALUES (NEW.id, new_username);

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.place_building (
  p_town_id            uuid,
  p_building_type_code text,
  p_anchor_x           integer,
  p_anchor_y           integer,
  p_idempotency_key    uuid
)
  RETURNS public.towns
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
declare
  v_town public.towns%rowtype;
  v_type record;
  v_existing record;
  v_width integer;
  v_height integer;
  v_cost bigint;
  v_building_id uuid;
  v_population integer;
begin
  select * into v_town
    from public.towns
   where id = p_town_id and owner_id = auth.uid()
   for update;
  if not found then
    raise exception 'town_not_found_or_forbidden' using errcode = '42501';
  end if;

  select bt.width, bt.height, bt.cost_coins, bt.enabled, bt.is_road
    into v_type
    from public.building_types bt
   where bt.code = p_building_type_code;
  if not found or not v_type.enabled or v_type.cost_coins is null then
    raise exception 'building_type_unavailable' using errcode = '22023';
  end if;
  v_width := v_type.width;
  v_height := v_type.height;
  v_cost := v_type.cost_coins;

  select * into v_existing
    from public.coin_ledger
   where town_id = p_town_id and idempotency_key = p_idempotency_key;
  if found then
    select * into v_town from public.towns where id = p_town_id;
    return v_town;
  end if;

  if p_anchor_x < 0 or p_anchor_y < 0
     or p_anchor_x + v_width > 100 or p_anchor_y + v_height > 100 then
    raise exception 'building_out_of_bounds' using errcode = '22023';
  end if;

  for x in p_anchor_x..p_anchor_x + v_width - 1 loop
    for y in p_anchor_y..p_anchor_y + v_height - 1 loop
      if not exists (select 1 from public.unlocked_cells
                      where town_id = p_town_id and x = x and y = y) then
        raise exception 'cell_locked' using errcode = '22023';
      end if;
      if exists (select 1 from public.placed_buildings b
                  where b.town_id = p_town_id
                    and b.anchor_x < x + 1 and b.anchor_x + b.width > x
                    and b.anchor_y < y + 1 and b.anchor_y + b.height > y)
         or exists (select 1 from public.map_obstacles o
                     where o.town_id = p_town_id and o.x = x and o.y = y) then
        raise exception 'cell_occupied' using errcode = '22023';
      end if;
    end loop;
  end loop;

  if v_town.coins < v_cost then
    raise exception 'insufficient_coins' using errcode = 'P0001';
  end if;

  update public.towns
     set coins = coins - v_cost, updated_at = now()
   where id = p_town_id;
  insert into public.coin_ledger
    (town_id, amount, reason, idempotency_key, created_at)
  values (p_town_id, -v_cost, 'building_purchase', p_idempotency_key, now());
  insert into public.placed_buildings
    (town_id, building_type_code, anchor_x, anchor_y, width, height,
     created_at, updated_at)
  values (p_town_id, p_building_type_code, p_anchor_x, p_anchor_y, v_width,
          v_height, now(), now())
  returning id into v_building_id;

  select coalesce(sum(case when building_type_code = 'small_house' then 10
                           when building_type_code = 'farm' then 5 else 0 end), 0)
    into v_population
    from public.placed_buildings where town_id = p_town_id;
  update public.towns set population = v_population where id = p_town_id;
  select * into v_town from public.towns where id = p_town_id;
  return v_town;
end;
$function$;

CREATE OR REPLACE FUNCTION public."sync-health-steps" (
  p_user_id   uuid,
  p_source    text,
  p_records   jsonb,
  p_base_rate numeric DEFAULT 0
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$declare
  item record;
  record_id uuid;
  previous_rewarded integer;
  step_delta integer;
  reward bigint;
  total_reward bigint := 0;
  v_town_id uuid;
  balance bigint;
  result jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'UNAUTHENTICATED';
  end if;
  if p_base_rate < 0 or p_base_rate is null then
    raise exception 'INVALID_INPUT';
  end if;

  select t.town_id into v_town_id
  from public.towns t
  where t.owner_id = p_user_id
  for update;

  if v_town_id is null then
    raise exception 'NOT_FOUND';
  end if;

  for item in
    select *
    from jsonb_to_recordset(p_records) as r(step_date date, steps integer)
  loop
    if item.step_date is null or item.steps is null or item.steps < 0 then
      raise exception 'INVALID_INPUT';
    end if;

    insert into public.daily_step_records (
      user_id, step_date, steps, rewarded_steps, source, synced_at
    )
    values (p_user_id, item.step_date, item.steps, 0, p_source, now())
    on conflict (user_id, step_date, source)
    do update set steps = excluded.steps, synced_at = excluded.synced_at
    returning id into record_id;

    select rewarded_steps into previous_rewarded
    from public.daily_step_records
    where id = record_id
    for update;

    step_delta := greatest(item.steps - previous_rewarded, 0);
    reward := floor(step_delta * p_base_rate)::bigint;

    update public.daily_step_records
    set rewarded_steps = previous_rewarded + step_delta, synced_at = now()
    where id = record_id;

    if reward > 0 then
      insert into public.coin_ledger (
        town_id, amount, reason, idempotency_key, metadata
      )
      values (
        v_town_id,
        reward,
        'step_reward',
        format('step_reward:%s:%s:%s:%s', p_user_id, p_source, item.step_date, previous_rewarded + step_delta),
        jsonb_build_object('step_date', item.step_date, 'steps', step_delta)
      );
      total_reward := total_reward + reward;
    end if;

    result := result || jsonb_build_array(jsonb_build_object(
      'step_date', item.step_date,
      'steps', item.steps,
      'rewarded_steps', previous_rewarded + step_delta,
      'coins_awarded', reward
    ));
  end loop;

  if total_reward > 0 then
    update public.towns
    set coins = coins + total_reward, updated_at = now()
    where towns.town_id = v_town_id;
  end if;

  select coins into balance from public.towns where towns.town_id = v_town_id;
  return jsonb_build_object(
    'records', result,
    'coins_awarded', total_reward,
    'balance', balance,
    'synced_at', now()
  );
end;$function$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

GRANT EXECUTE ON FUNCTION "public"."handle_new_user"() TO PUBLIC, "postgres";

REVOKE ALL ON FUNCTION "public"."place_building"(uuid, text, integer, integer, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."place_building"(uuid, text, integer, integer, uuid) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."sync-health-steps"(uuid, text, jsonb, numeric) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."sync-health-steps"(uuid, text, jsonb, numeric) TO "authenticated", "postgres";

REVOKE ALL ON TABLE "public"."building_effects" FROM "service_role";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."building_effects" TO "service_role";

REVOKE ALL ON TABLE "public"."building_types" FROM "service_role";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."building_types" TO "service_role";

REVOKE ALL ON TABLE "public"."coin_ledger" FROM "anon";

GRANT MAINTAIN ON TABLE "public"."coin_ledger" TO "anon";

REVOKE ALL ON TABLE "public"."coin_ledger" FROM "service_role";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."coin_ledger" TO "service_role";

REVOKE ALL ON TABLE "public"."daily_step_records" FROM "anon";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."daily_step_records" TO "anon";

REVOKE ALL ON TABLE "public"."daily_step_records" FROM "authenticated";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."daily_step_records" TO "authenticated";

REVOKE ALL ON TABLE "public"."daily_step_records" FROM "service_role";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."daily_step_records" TO "service_role";

REVOKE ALL ON TABLE "public"."map_layouts" FROM "anon";

GRANT MAINTAIN ON TABLE "public"."map_layouts" TO "anon";

REVOKE ALL ON TABLE "public"."map_layouts" FROM "service_role";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."map_layouts" TO "service_role";

REVOKE ALL ON TABLE "public"."map_terrain_areas" FROM "anon";

GRANT MAINTAIN ON TABLE "public"."map_terrain_areas" TO "anon";

REVOKE ALL ON TABLE "public"."map_terrain_areas" FROM "service_role";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."map_terrain_areas" TO "service_role";

REVOKE ALL ON TABLE "public"."placed_buildings" FROM "anon";

GRANT MAINTAIN ON TABLE "public"."placed_buildings" TO "anon";

REVOKE ALL ON TABLE "public"."placed_buildings" FROM "service_role";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."placed_buildings" TO "service_role";

REVOKE ALL ON TABLE "public"."profiles" FROM "anon";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."profiles" TO "anon";

REVOKE ALL ON TABLE "public"."profiles" FROM "authenticated";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."profiles" TO "authenticated";

REVOKE ALL ON TABLE "public"."profiles" FROM "service_role";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."profiles" TO "service_role";

REVOKE ALL ON TABLE "public"."road_structures" FROM "anon";

GRANT MAINTAIN ON TABLE "public"."road_structures" TO "anon";

REVOKE ALL ON TABLE "public"."road_structures" FROM "service_role";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."road_structures" TO "service_role";

REVOKE ALL ON TABLE "public"."town_rpc_requests" FROM "service_role";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."town_rpc_requests" TO "service_role";

REVOKE ALL ON TABLE "public"."towns" FROM "anon";

GRANT MAINTAIN ON TABLE "public"."towns" TO "anon";

REVOKE ALL ON TABLE "public"."towns" FROM "authenticated";

GRANT MAINTAIN ON TABLE "public"."towns" TO "authenticated";

REVOKE ALL ON TABLE "public"."towns" FROM "service_role";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."towns" TO "service_role";

REVOKE ALL ON TABLE "public"."unlocked_areas" FROM "anon";

GRANT MAINTAIN ON TABLE "public"."unlocked_areas" TO "anon";

REVOKE ALL ON TABLE "public"."unlocked_areas" FROM "service_role";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."unlocked_areas" TO "service_role";

REVOKE ALL ON TABLE "public"."public_towns" FROM "anon";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."public_towns" TO "anon";

REVOKE ALL ON TABLE "public"."public_towns" FROM "authenticated";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."public_towns" TO "authenticated";

REVOKE ALL ON TABLE "public"."public_towns" FROM "service_role";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."public_towns" TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLES TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLES TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLES TO "service_role";

