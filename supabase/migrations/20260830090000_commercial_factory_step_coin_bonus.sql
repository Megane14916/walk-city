-- Commercial and factory bonuses for step reward settlement.

insert into public.building_types (
  code, name, category, width, height, cost_coins,
  description, enabled, catalog_version
)
values
  (
    'commercial', '商業施設', 'commercial', 1, 1, 300,
    '歩数同期時のコイン獲得を10%増やす商業施設です', true, 1
  ),
  (
    'factory', '工場', 'industry', 2, 2, 700,
    '歩数同期時のコイン獲得を25%増やす工場です', true, 1
  )
on conflict (code) do update
set name = excluded.name,
    category = excluded.category,
    width = excluded.width,
    height = excluded.height,
    cost_coins = excluded.cost_coins,
    description = excluded.description,
    enabled = excluded.enabled,
    catalog_version = excluded.catalog_version;

delete from public.building_effects
where building_type_code in ('commercial', 'factory')
  and effect_type in ('step_coin_bonus_flat', 'step_coin_bonus_percent');

insert into public.building_effects (
  id, building_type_code, effect_type, value,
  target_category, scope, stacking_rule, metadata
)
values
  (
    '20000000-0000-4000-8000-000000000003',
    'commercial',
    'step_coin_bonus_percent',
    10,
    null,
    'step_sync',
    'commercial_first_combined_cap',
    '{"maxEffectiveCount":3,"combinedCapPercent":50,"priority":1}'::jsonb
  ),
  (
    '20000000-0000-4000-8000-000000000004',
    'factory',
    'step_coin_bonus_percent',
    25,
    null,
    'step_sync',
    'commercial_first_combined_cap',
    '{"maxEffectiveCount":2,"combinedCapPercent":50,"priority":2}'::jsonb
  );

create or replace function private.calculate_step_coin_bonus(p_town_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_commercial_count bigint;
  v_factory_count bigint;
  v_commercial_config_count bigint;
  v_factory_config_count bigint;
  v_commercial_rate numeric;
  v_factory_rate numeric;
  v_commercial_amount bigint;
  v_factory_amount bigint;
  v_total_percent bigint;
  v_bonuses jsonb := '[]'::jsonb;
begin
  if p_town_id is null then
    perform private.raise_api_error('INVALID_INPUT');
  end if;

  select count(*), max(be.value)
  into v_commercial_config_count, v_commercial_rate
  from public.building_effects be
  where be.building_type_code = 'commercial'
    and be.effect_type = 'step_coin_bonus_percent';

  select count(*), max(be.value)
  into v_factory_config_count, v_factory_rate
  from public.building_effects be
  where be.building_type_code = 'factory'
    and be.effect_type = 'step_coin_bonus_percent';

  if v_commercial_config_count <> 1 or v_commercial_rate <> 10
    or v_factory_config_count <> 1 or v_factory_rate <> 25 then
    perform private.raise_api_error('INTERNAL_ERROR');
  end if;

  select
    count(*) filter (where pb.building_type_code = 'commercial'),
    count(*) filter (where pb.building_type_code = 'factory')
  into v_commercial_count, v_factory_count
  from public.placed_buildings pb
  where pb.town_id = p_town_id
    and pb.building_type_code in ('commercial', 'factory');

  v_commercial_amount := least(v_commercial_count, 3) * v_commercial_rate::bigint;
  v_factory_amount := least(
    least(v_factory_count, 2) * v_factory_rate::bigint,
    greatest(50 - v_commercial_amount, 0)
  );
  v_total_percent := v_commercial_amount + v_factory_amount;

  if v_commercial_count > 0 and v_commercial_amount > 0 then
    v_bonuses := v_bonuses || jsonb_build_array(jsonb_build_object(
      'source_building_type', 'commercial',
      'source_count', v_commercial_count,
      'effect_type', 'step_coin_bonus_percent',
      'amount', v_commercial_amount
    ));
  end if;

  if v_factory_count > 0 and v_factory_amount > 0 then
    v_bonuses := v_bonuses || jsonb_build_array(jsonb_build_object(
      'source_building_type', 'factory',
      'source_count', v_factory_count,
      'effect_type', 'step_coin_bonus_percent',
      'amount', v_factory_amount
    ));
  end if;

  return jsonb_build_object(
    'total_percent', v_total_percent,
    'applied_bonuses', v_bonuses
  );
end;
$$;

revoke all on function private.calculate_step_coin_bonus(uuid)
  from public, anon, authenticated;
grant execute on function private.calculate_step_coin_bonus(uuid) to service_role;

create or replace function public.sync_step_rewards(
  p_user_id uuid,
  p_source text,
  p_records jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item record;
  v_record_id uuid;
  v_previous_rewarded integer;
  v_newly_rewarded integer;
  v_base_reward bigint;
  v_reward bigint;
  v_total_base_reward bigint := 0;
  v_total_reward bigint := 0;
  v_town public.towns%rowtype;
  v_bonus jsonb;
  v_bonus_percent bigint;
  v_applied_bonuses jsonb;
  v_record_bonuses jsonb;
  v_synced_at timestamptz := clock_timestamp();
  v_records jsonb := '[]'::jsonb;
begin
  if p_user_id is null or p_source <> 'google_health'
    or p_records is null or jsonb_typeof(p_records) <> 'array'
    or jsonb_array_length(p_records) < 1 then
    perform private.raise_api_error('INVALID_INPUT');
  end if;

  select * into v_town
  from public.towns
  where owner_id = p_user_id
  for update;
  if not found then perform private.raise_api_error('NOT_FOUND'); end if;

  v_bonus := private.calculate_step_coin_bonus(v_town.town_id);
  v_bonus_percent := (v_bonus->>'total_percent')::bigint;
  v_applied_bonuses := v_bonus->'applied_bonuses';

  if v_bonus_percent < 0 or v_bonus_percent > 50
    or jsonb_typeof(v_applied_bonuses) <> 'array' then
    perform private.raise_api_error('INTERNAL_ERROR');
  end if;

  for item in
    select * from jsonb_to_recordset(p_records) as r(step_date date, steps integer)
  loop
    if item.step_date is null or item.steps is null or item.steps < 0 then
      perform private.raise_api_error('INVALID_INPUT');
    end if;

    insert into public.daily_step_records (
      user_id, step_date, steps, rewarded_steps, source, synced_at
    ) values (
      p_user_id, item.step_date, item.steps, 0, p_source, v_synced_at
    )
    on conflict (user_id, step_date, source) do update
    set steps = greatest(public.daily_step_records.steps, excluded.steps),
        synced_at = excluded.synced_at
    returning id, rewarded_steps into v_record_id, v_previous_rewarded;

    v_newly_rewarded := greatest(item.steps - v_previous_rewarded, 0);
    v_base_reward := greatest(
      floor(item.steps::numeric / 10) - floor(v_previous_rewarded::numeric / 10),
      0
    )::bigint;
    v_reward := floor(
      v_base_reward::numeric * (100 + v_bonus_percent)::numeric / 100
    )::bigint;
    v_record_bonuses := case
      when v_base_reward > 0 then v_applied_bonuses
      else '[]'::jsonb
    end;

    update public.daily_step_records
    set rewarded_steps = greatest(rewarded_steps, item.steps)
    where id = v_record_id;

    if v_reward > 0 then
      insert into public.coin_ledger (
        town_id, amount, reason, idempotency_key, metadata
      ) values (
        v_town.town_id,
        v_reward,
        'step_reward',
        'step_reward:' || p_user_id::text || ':' || p_source || ':' ||
          item.step_date::text || ':' || floor(item.steps::numeric / 10)::text,
        jsonb_build_object(
          'step_date', item.step_date,
          'total_steps', item.steps,
          'previous_rewarded_steps', v_previous_rewarded,
          'newly_rewarded_steps', v_newly_rewarded,
          'base_coins', v_base_reward,
          'bonus_percent', v_bonus_percent,
          'applied_bonuses', v_record_bonuses
        )
      );
      v_total_reward := v_total_reward + v_reward;
    end if;

    v_total_base_reward := v_total_base_reward + v_base_reward;
    v_records := v_records || jsonb_build_array(jsonb_build_object(
      'step_date', item.step_date,
      'steps', item.steps,
      'rewarded_steps', greatest(v_previous_rewarded, item.steps),
      'newly_rewarded_steps', v_newly_rewarded,
      'base_coins', v_base_reward,
      'bonus_percent', v_bonus_percent,
      'applied_bonuses', v_record_bonuses,
      'coins_awarded', v_reward
    ));
  end loop;

  if v_total_reward > 0 then
    update public.towns
    set coins = coins + v_total_reward, updated_at = v_synced_at
    where town_id = v_town.town_id
    returning * into v_town;
  end if;

  return jsonb_build_object(
    'records', v_records,
    'coins_awarded', v_total_reward,
    'balance', v_town.coins,
    'applied_bonuses', case
      when v_total_base_reward > 0 then v_applied_bonuses
      else '[]'::jsonb
    end,
    'synced_at', v_synced_at
  );
end;
$$;

revoke all on function public.sync_step_rewards(uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.sync_step_rewards(uuid, text, jsonb) to service_role;
