begin;
create extension if not exists pgtap with schema extensions;
select plan(56);

select has_table('private', 'health_tokens', 'encrypted Health tokens have a private table');
select has_table('private', 'health_oauth_states', 'one-time OAuth states have a private table');
select hasnt_column('public', 'health_connections', 'refresh_token', 'public connection state contains no plaintext token');
select has_column('public', 'health_connections', 'status', 'public connection state exposes status');
select has_column('public', 'health_connections', 'scopes', 'public connection state exposes granted scopes');
select is(has_schema_privilege('authenticated', 'private', 'USAGE'), false, 'authenticated cannot use the private schema');
select is(has_table_privilege('authenticated', 'private.health_tokens', 'SELECT'), false, 'authenticated cannot read encrypted tokens');
select is(has_function_privilege('authenticated', 'public.sync_step_rewards(uuid,text,jsonb)', 'EXECUTE'), false, 'clients cannot award step coins');
select is(has_function_privilege('service_role', 'public.sync_step_rewards(uuid,text,jsonb)', 'EXECUTE'), true, 'service role can award step coins');
select has_function('private', 'calculate_step_coin_bonus', array['uuid'], 'private step coin bonus calculator exists');
select is(has_function_privilege('authenticated', 'private.calculate_step_coin_bonus(uuid)', 'EXECUTE'), false, 'clients cannot execute the bonus calculator');
select is(has_function_privilege('service_role', 'private.calculate_step_coin_bonus(uuid)', 'EXECUTE'), true, 'service role can execute the bonus calculator');

insert into auth.users (id, email)
values ('f0000000-0000-4000-8000-000000000001', 'health@example.test');
insert into public.profiles (id, display_name)
values ('f0000000-0000-4000-8000-000000000001', 'Health User');
insert into public.towns (town_id, owner_id, name, coins, population)
values (
  'f1000000-0000-4000-8000-000000000001',
  'f0000000-0000-4000-8000-000000000001',
  'Health Town', 1000, 0
);

select lives_ok(
  $$select public.store_health_oauth_state(
    'f0000000-0000-4000-8000-000000000001',
    repeat('a', 64),
    'http://localhost:5173/health/connect'
  )$$,
  'OAuth state can be stored by the service bridge'
);
select is(
  public.consume_health_oauth_state(repeat('a', 64))->>'user_id',
  'f0000000-0000-4000-8000-000000000001',
  'OAuth state resolves the authenticated user once'
);
select throws_ok(
  $$select public.consume_health_oauth_state(repeat('a', 64))$$,
  'P0001', 'NOT_FOUND', 'OAuth state cannot be replayed'
);

select lives_ok(
  $$select public.upsert_health_connection(
    'f0000000-0000-4000-8000-000000000001',
    'v1.test-initial-vector.ciphertext',
    array['https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly']
  )$$,
  'encrypted refresh token and public state are stored together'
);
select is((select count(*) from private.health_tokens), 1::bigint, 'one encrypted token is stored');
select is((select status from public.health_connections), 'connected', 'connection becomes connected');
select is(
  public.get_health_connection('f0000000-0000-4000-8000-000000000001')->>'encrypted_refresh_token',
  'v1.test-initial-vector.ciphertext',
  'service bridge can retrieve only the encrypted representation'
);
select lives_ok(
  $$select public.upsert_health_connection(
    'f0000000-0000-4000-8000-000000000001',
    'v1.test-second-vector.new-ciphertext',
    array['https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly']
  )$$,
  're-consent replaces rather than duplicates a token'
);
select is((select count(*) from private.health_tokens), 1::bigint, 're-consent keeps one token row');

create temporary table step_results (step_count integer primary key, value jsonb);
insert into step_results values (
  9,
  public.sync_step_rewards(
    'f0000000-0000-4000-8000-000000000001', 'google_health',
    '[{"step_date":"2026-08-29","steps":9}]'::jsonb
  )
);
select is((select value->>'coins_awarded' from step_results where step_count = 9), '0', '9 steps award no coins');
select is((select rewarded_steps from public.daily_step_records), 9, 'sub-10 steps remain available for the next sync');

insert into step_results values (
  10,
  public.sync_step_rewards(
    'f0000000-0000-4000-8000-000000000001', 'google_health',
    '[{"step_date":"2026-08-29","steps":10}]'::jsonb
  )
);
select is((select value->>'coins_awarded' from step_results where step_count = 10), '1', 'the tenth step awards one coin');
select is((select value->>'balance' from step_results where step_count = 10), '1001', 'reward and balance update in one transaction');

insert into step_results values (
  19,
  public.sync_step_rewards(
    'f0000000-0000-4000-8000-000000000001', 'google_health',
    '[{"step_date":"2026-08-29","steps":19}]'::jsonb
  )
);
select is((select value->>'coins_awarded' from step_results where step_count = 19), '0', 'steps 11 through 19 award no additional coin');
select is((select value->'records'->0->>'newly_rewarded_steps' from step_results where step_count = 19), '9', 'raw newly synchronized steps are reported');

insert into step_results values (
  20,
  public.sync_step_rewards(
    'f0000000-0000-4000-8000-000000000001', 'google_health',
    '[{"step_date":"2026-08-29","steps":20}]'::jsonb
  )
);
select is((select value->>'coins_awarded' from step_results where step_count = 20), '1', 'the twentieth step awards the next coin');
select is(
  public.sync_step_rewards(
    'f0000000-0000-4000-8000-000000000001', 'google_health',
    '[{"step_date":"2026-08-29","steps":20}]'::jsonb
  )->>'coins_awarded',
  '0',
  'repeating the same total awards nothing'
);

insert into step_results values (
  105,
  public.sync_step_rewards(
    'f0000000-0000-4000-8000-000000000001', 'google_health',
    '[{"step_date":"2026-08-29","steps":105}]'::jsonb
  )
);
select is((select value->>'coins_awarded' from step_results where step_count = 105), '8', 'large increases have no daily cap');
select is((select value->>'balance' from step_results where step_count = 105), '1010', '105 total steps produce exactly 10 total coins');
select is((select value->'applied_bonuses' from step_results where step_count = 105), '[]'::jsonb, 'no bonus is returned without commercial or factory buildings');
select is((select count(*) from public.coin_ledger where reason = 'step_reward'), 3::bigint, 'only rewarding syncs create ledger rows');
select is((select sum(amount) from public.coin_ledger where reason = 'step_reward'), 10::numeric, 'step ledger totals ten coins');
select is(
  public.sync_step_rewards(
    'f0000000-0000-4000-8000-000000000001', 'google_health',
    '[{"step_date":"2026-08-29","steps":100}]'::jsonb
  )->>'coins_awarded',
  '0',
  'a lower provider total never revokes or duplicates rewards'
);
select is((select rewarded_steps from public.daily_step_records), 105, 'highest rewarded total is preserved');

insert into public.placed_buildings (
  id, town_id, building_type_code, anchor_x, anchor_y, purchase_cost_coins
) values (
  'f2000000-0000-4000-8000-000000000001',
  'f1000000-0000-4000-8000-000000000001',
  'commercial', 0, 0, 300
);

insert into step_results values (
  1000,
  public.sync_step_rewards(
    'f0000000-0000-4000-8000-000000000001', 'google_health',
    '[{"step_date":"2026-08-30","steps":1000}]'::jsonb
  )
);
select is((select value->>'coins_awarded' from step_results where step_count = 1000), '110', 'one commercial building adds ten percent');
select is(
  (select value->'applied_bonuses' from step_results where step_count = 1000),
  '[{"source_building_type":"commercial","source_count":1,"effect_type":"step_coin_bonus_percent","amount":10}]'::jsonb,
  'commercial bonus reports actual source count and effective amount'
);
select is(
  (select metadata->>'base_coins' from public.coin_ledger where metadata->>'step_date' = '2026-08-30'),
  '100',
  'step ledger records base coins before the building bonus'
);
select is(
  (select metadata->>'bonus_percent' from public.coin_ledger where metadata->>'step_date' = '2026-08-30'),
  '10',
  'step ledger records the effective bonus percentage'
);
select is(
  public.sync_step_rewards(
    'f0000000-0000-4000-8000-000000000001', 'google_health',
    '[{"step_date":"2026-08-30","steps":1000}]'::jsonb
  )->>'coins_awarded',
  '0',
  'repeating bonus-eligible steps awards no additional coins'
);
select is(
  public.sync_step_rewards(
    'f0000000-0000-4000-8000-000000000001', 'google_health',
    '[{"step_date":"2026-08-30","steps":1000}]'::jsonb
  )->'applied_bonuses',
  '[]'::jsonb,
  'a zero-base repeat returns no applied bonuses'
);

insert into public.placed_buildings (
  id, town_id, building_type_code, anchor_x, anchor_y, purchase_cost_coins
) values
  ('f2000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000001', 'commercial', 1, 0, 300),
  ('f2000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-000000000001', 'commercial', 2, 0, 300),
  ('f2000000-0000-4000-8000-000000000004', 'f1000000-0000-4000-8000-000000000001', 'commercial', 3, 0, 300),
  ('f2000000-0000-4000-8000-000000000005', 'f1000000-0000-4000-8000-000000000001', 'factory', 4, 0, 700),
  ('f2000000-0000-4000-8000-000000000006', 'f1000000-0000-4000-8000-000000000001', 'factory', 6, 0, 700),
  ('f2000000-0000-4000-8000-000000000007', 'f1000000-0000-4000-8000-000000000001', 'factory', 8, 0, 700);

insert into step_results values (
  2000,
  public.sync_step_rewards(
    'f0000000-0000-4000-8000-000000000001', 'google_health',
    '[{"step_date":"2026-08-31","steps":1000}]'::jsonb
  )
);
select is((select value->>'coins_awarded' from step_results where step_count = 2000), '150', 'mixed building bonuses are capped at fifty percent');
select is(
  (select value->'applied_bonuses' from step_results where step_count = 2000),
  '[{"source_building_type":"commercial","source_count":4,"effect_type":"step_coin_bonus_percent","amount":30},{"source_building_type":"factory","source_count":3,"effect_type":"step_coin_bonus_percent","amount":20}]'::jsonb,
  'commercial applies first while source counts include over-cap buildings'
);
select is((select value->>'balance' from step_results where step_count = 2000), '1270', 'mixed bonus reward updates the balance atomically');
select is(
  (select metadata->'applied_bonuses' from public.coin_ledger where metadata->>'step_date' = '2026-08-31'),
  '[{"source_building_type":"commercial","source_count":4,"effect_type":"step_coin_bonus_percent","amount":30},{"source_building_type":"factory","source_count":3,"effect_type":"step_coin_bonus_percent","amount":20}]'::jsonb,
  'step ledger preserves the applied bonus breakdown'
);

select is(
  public.sync_step_rewards(
    'f0000000-0000-4000-8000-000000000001', 'google_health',
    '[{"step_date":"2026-09-01","steps":10}]'::jsonb
  )->>'coins_awarded',
  '1',
  'percentage calculation floors only after applying the combined rate'
);
select is(
  jsonb_array_length(public.sync_step_rewards(
    'f0000000-0000-4000-8000-000000000001', 'google_health',
    '[{"step_date":"2026-09-01","steps":20}]'::jsonb
  )->'applied_bonuses'),
  2,
  'positive base coins return both applied bonus entries even when rounding adds no coin'
);

delete from public.placed_buildings
where town_id = 'f1000000-0000-4000-8000-000000000001'
  and building_type_code = 'commercial';

insert into step_results values (
  3000,
  public.sync_step_rewards(
    'f0000000-0000-4000-8000-000000000001', 'google_health',
    '[{"step_date":"2026-09-02","steps":1000}]'::jsonb
  )
);
select is((select value->>'coins_awarded' from step_results where step_count = 3000), '150', 'three factories are capped at two effective buildings');
select is(
  (select value->'applied_bonuses' from step_results where step_count = 3000),
  '[{"source_building_type":"factory","source_count":3,"effect_type":"step_coin_bonus_percent","amount":50}]'::jsonb,
  'factory bonus keeps the actual source count and caps the effective amount'
);

select throws_ok(
  $$select public.sync_step_rewards(
    'f0000000-0000-4000-8000-000000000001', 'client_input',
    '[{"step_date":"2026-08-29","steps":9999}]'::jsonb
  )$$,
  'P0001', 'INVALID_INPUT', 'untrusted reward sources are rejected'
);

select lives_ok(
  $$select public.mark_health_synced(
    'f0000000-0000-4000-8000-000000000001',
    '2026-08-29T12:34:56Z'
  )$$,
  'last successful synchronization can be recorded'
);
select is((select last_synced_at from public.health_connections), '2026-08-29T12:34:56Z'::timestamptz, 'public state exposes the last sync time');
select lives_ok(
  $$select public.disconnect_health_connection('f0000000-0000-4000-8000-000000000001')$$,
  'disconnect is atomic'
);
select is((select count(*) from private.health_tokens), 0::bigint, 'disconnect deletes the encrypted token');
select is((select status from public.health_connections), 'not_connected', 'disconnect keeps a safe public state');

select * from finish();
rollback;
