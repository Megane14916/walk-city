-- Phase C: idempotent user initialization callable only by the Edge Function.

create or replace function private.initialize_user(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_town_id uuid;
  v_created boolean := false;
  v_town_created boolean := false;
  v_suffix text;
begin
  if p_user_id is null then
    perform private.raise_api_error('INVALID_INPUT');
  end if;

  perform 1 from auth.users where id = p_user_id for update;
  if not found then perform private.raise_api_error('NOT_FOUND'); end if;

  v_suffix := left(replace(p_user_id::text, '-', ''), 8);

  insert into public.profiles (id, display_name)
  values (p_user_id, 'user-' || v_suffix)
  on conflict (id) do nothing
  returning id into v_profile_id;
  if v_profile_id is not null then v_created := true; end if;

  select id into v_profile_id from public.profiles where id = p_user_id;

  insert into public.towns (owner_id, name, coins, population, map_width, map_height)
  values (p_user_id, 'Town-' || v_suffix, 1000, 0, 100, 100)
  on conflict (owner_id) do nothing
  returning town_id into v_town_id;
  if v_town_id is not null then
    v_created := true;
    v_town_created := true;
  else
    select town_id into v_town_id from public.towns where owner_id = p_user_id;
  end if;

  if v_town_created then
    insert into public.coin_ledger (
      town_id, amount, reason, idempotency_key, metadata
    ) values (
      v_town_id,
      1000,
      'initial_grant',
      'initial_grant:' || p_user_id::text,
      jsonb_build_object('source', 'initialize-user')
    );
  end if;

  insert into public.unlocked_areas (
    town_id, x, y, width, height, unlock_method
  ) values (
    v_town_id, 40, 40, 20, 20, 'initial'
  )
  on conflict (town_id, x, y, width, height) do nothing;
  if found then v_created := true; end if;

  return jsonb_build_object(
    'profile_id', v_profile_id,
    'town_id', v_town_id,
    'created', v_created
  );
end;
$$;

create or replace function public.initialize_user(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.initialize_user(p_user_id);
end;
$$;

revoke all on function private.initialize_user(uuid) from public, anon, authenticated;
grant execute on function private.initialize_user(uuid) to service_role;
revoke all on function public.initialize_user(uuid) from public, anon, authenticated;
grant execute on function public.initialize_user(uuid) to service_role;

