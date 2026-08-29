-- Phase D: private Health token storage, OAuth state and 10-steps-per-coin rewards.

alter table public.health_connections
  drop column if exists refresh_token;
alter table public.health_connections
  add column if not exists status text not null default 'not_connected',
  add column if not exists scopes text[] not null default '{}'::text[],
  add column if not exists connected_at timestamptz,
  add column if not exists last_synced_at timestamptz;

alter table public.health_connections
  drop constraint if exists health_connections_status_check;
alter table public.health_connections
  add constraint health_connections_status_check
  check (status in ('connected', 'not_connected', 'permission_required'));

create table if not exists private.health_tokens (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'google_health',
  encrypted_refresh_token text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, provider),
  check (char_length(encrypted_refresh_token) between 20 and 10000)
);

create table if not exists private.health_oauth_states (
  state_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  success_redirect_url text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (char_length(state_hash) = 64)
);

revoke all on table private.health_tokens from public, anon, authenticated;
revoke all on table private.health_oauth_states from public, anon, authenticated;

create or replace function public.store_health_oauth_state(
  p_user_id uuid,
  p_state_hash text,
  p_success_redirect_url text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null or p_state_hash !~ '^[0-9a-f]{64}$'
    or p_success_redirect_url is null
    or char_length(p_success_redirect_url) > 2000 then
    perform private.raise_api_error('INVALID_INPUT');
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    perform private.raise_api_error('NOT_FOUND');
  end if;

  delete from private.health_oauth_states where expires_at <= now();
  insert into private.health_oauth_states (
    state_hash, user_id, success_redirect_url, expires_at
  ) values (
    p_state_hash, p_user_id, p_success_redirect_url, now() + interval '10 minutes'
  );
end;
$$;

create or replace function public.consume_health_oauth_state(p_state_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state private.health_oauth_states%rowtype;
begin
  if p_state_hash !~ '^[0-9a-f]{64}$' then
    perform private.raise_api_error('INVALID_INPUT');
  end if;

  delete from private.health_oauth_states
  where state_hash = p_state_hash and expires_at > now()
  returning * into v_state;
  if not found then perform private.raise_api_error('NOT_FOUND'); end if;

  return jsonb_build_object(
    'user_id', v_state.user_id,
    'success_redirect_url', v_state.success_redirect_url
  );
end;
$$;

create or replace function public.upsert_health_connection(
  p_user_id uuid,
  p_encrypted_refresh_token text,
  p_scopes text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null or p_encrypted_refresh_token is null
    or char_length(p_encrypted_refresh_token) < 20
    or not ('https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly' = any(coalesce(p_scopes, '{}'::text[]))) then
    perform private.raise_api_error('INVALID_INPUT');
  end if;

  insert into private.health_tokens (
    user_id, provider, encrypted_refresh_token, updated_at
  ) values (
    p_user_id, 'google_health', p_encrypted_refresh_token, now()
  )
  on conflict (user_id, provider) do update
  set encrypted_refresh_token = excluded.encrypted_refresh_token,
      updated_at = excluded.updated_at;

  insert into public.health_connections (
    user_id, provider, status, scopes, connected_at, last_synced_at, updated_at
  ) values (
    p_user_id, 'google_health', 'connected', p_scopes, now(), null, now()
  )
  on conflict (user_id, provider) do update
  set status = 'connected',
      scopes = excluded.scopes,
      connected_at = coalesce(public.health_connections.connected_at, excluded.connected_at),
      updated_at = excluded.updated_at;
end;
$$;

create or replace function public.get_health_connection(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when hc.user_id is null then null else jsonb_build_object(
    'status', hc.status,
    'scopes', to_jsonb(hc.scopes),
    'connected_at', hc.connected_at,
    'last_synced_at', hc.last_synced_at,
    'encrypted_refresh_token', ht.encrypted_refresh_token
  ) end
  from (select p_user_id as user_id_input) input
  left join public.health_connections hc
    on hc.user_id = input.user_id_input and hc.provider = 'google_health'
  left join private.health_tokens ht
    on ht.user_id = hc.user_id and ht.provider = hc.provider
$$;

create or replace function public.disconnect_health_connection(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from private.health_tokens
  where user_id = p_user_id and provider = 'google_health';

  insert into public.health_connections (
    user_id, provider, status, scopes, connected_at, last_synced_at, updated_at
  ) values (
    p_user_id, 'google_health', 'not_connected', '{}'::text[], null, null, now()
  )
  on conflict (user_id, provider) do update
  set status = 'not_connected', scopes = '{}'::text[], connected_at = null,
      last_synced_at = null, updated_at = now();
end;
$$;

create or replace function public.mark_health_permission_required(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.health_connections
  set status = 'permission_required', updated_at = now()
  where user_id = p_user_id and provider = 'google_health'
$$;

create or replace function public.mark_health_synced(
  p_user_id uuid,
  p_synced_at timestamptz
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.health_connections
  set status = 'connected', last_synced_at = p_synced_at, updated_at = p_synced_at
  where user_id = p_user_id and provider = 'google_health'
$$;

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
  v_reward bigint;
  v_total_reward bigint := 0;
  v_town public.towns%rowtype;
  v_synced_at timestamptz := clock_timestamp();
  v_records jsonb := '[]'::jsonb;
begin
  if p_user_id is null or p_source <> 'google_health'
    or p_records is null or jsonb_typeof(p_records) <> 'array'
    or jsonb_array_length(p_records) < 1 then
    perform private.raise_api_error('INVALID_INPUT');
  end if;

  select * into v_town from public.towns where owner_id = p_user_id for update;
  if not found then perform private.raise_api_error('NOT_FOUND'); end if;

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
    v_reward := greatest(
      floor(item.steps::numeric / 10) - floor(v_previous_rewarded::numeric / 10),
      0
    )::bigint;

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
        'step_reward:' || p_user_id::text || ':' || p_source || ':' || item.step_date::text || ':' || floor(item.steps::numeric / 10)::text,
        jsonb_build_object(
          'step_date', item.step_date,
          'total_steps', item.steps,
          'previous_rewarded_steps', v_previous_rewarded,
          'newly_rewarded_steps', v_newly_rewarded
        )
      );
      v_total_reward := v_total_reward + v_reward;
    end if;

    v_records := v_records || jsonb_build_array(jsonb_build_object(
      'step_date', item.step_date,
      'steps', item.steps,
      'rewarded_steps', greatest(v_previous_rewarded, item.steps),
      'newly_rewarded_steps', v_newly_rewarded,
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
    'applied_bonuses', '[]'::jsonb,
    'synced_at', v_synced_at
  );
end;
$$;

do $$
declare
  v_signature text;
begin
  foreach v_signature in array array[
    'public.store_health_oauth_state(uuid,text,text)',
    'public.consume_health_oauth_state(text)',
    'public.upsert_health_connection(uuid,text,text[])',
    'public.get_health_connection(uuid)',
    'public.disconnect_health_connection(uuid)',
    'public.mark_health_permission_required(uuid)',
    'public.mark_health_synced(uuid,timestamptz)',
    'public.sync_step_rewards(uuid,text,jsonb)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', v_signature);
    execute format('grant execute on function %s to service_role', v_signature);
  end loop;
end;
$$;

revoke all on table public.health_connections from anon;
revoke all on table public.health_connections from authenticated;
grant select (user_id, provider, status, scopes, connected_at, last_synced_at, created_at, updated_at)
  on public.health_connections to authenticated;

