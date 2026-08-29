create schema if not exists private;

create or replace function private.initialize_user(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile_id uuid;
  v_town_id uuid;
  v_created boolean := false;
begin
  if p_user_id is null then
    raise exception 'INVALID_INPUT';
  end if;

  if not exists (select 1 from public.profiles where id = p_user_id) then
    insert into public.profiles (id, display_name)
    values (p_user_id, format('user-%s', substr(p_user_id::text, 1, 8)))
    on conflict (id) do nothing;
    v_created := true;
  end if;

  select id into v_profile_id
  from public.profiles
  where id = p_user_id;

  if v_profile_id is null then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  if not exists (select 1 from public.towns where owner_id = p_user_id) then
    insert into public.towns (owner_id, name, coins, population)
    values (
      p_user_id,
      format('Town-%s', substr(p_user_id::text, 1, 8)),
      1000,
      0
    )
    on conflict (owner_id) do nothing
    returning town_id into v_town_id;
    v_created := true;
  end if;

  if v_town_id is null then
    select town_id into v_town_id
    from public.towns
    where owner_id = p_user_id;
  end if;

  if v_town_id is null then
    raise exception 'TOWN_NOT_FOUND';
  end if;

  if not exists (select 1 from public.unlocked_areas where town_id = v_town_id) then
    insert into public.unlocked_areas (town_id, width, height, unlock_method)
    values (v_town_id, 20, 20, 'initial');
  end if;

  if not exists (
    select 1
    from public.coin_ledger
    where town_id = v_town_id
      and idempotency_key = format('initial_grant:%s', p_user_id)
  ) then
    insert into public.coin_ledger (
      town_id,
      amount,
      reason,
      idempotency_key,
      metadata
    )
    values (
      v_town_id,
      1000,
      'initial_grant',
      format('initial_grant:%s', p_user_id),
      jsonb_build_object('source', 'initial_grant')
    );
  end if;

  return jsonb_build_object(
    'profile_id', v_profile_id,
    'town_id', v_town_id,
    'created', v_created
  );
end;
$$;

revoke all on function private.initialize_user(uuid) from public;
grant execute on function private.initialize_user(uuid) to service_role;
