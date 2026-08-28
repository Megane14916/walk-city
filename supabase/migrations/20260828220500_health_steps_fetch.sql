alter table public.daily_step_records
  add constraint daily_step_records_user_date_source_key
  unique (user_id, step_date, source);

create or replace function public.sync_step_rewards(
  p_user_id uuid,
  p_source text,
  p_records jsonb,
  p_base_rate numeric default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
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
end;
$$;

revoke all on function public.sync_step_rewards(uuid, text, jsonb, numeric) from public;
grant execute on function public.sync_step_rewards(uuid, text, jsonb, numeric) to authenticated;
