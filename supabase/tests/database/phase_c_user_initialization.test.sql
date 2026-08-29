begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

select has_function('private', 'initialize_user', array['uuid'], 'private initialize function exists');
select has_function('public', 'initialize_user', array['uuid'], 'Edge Function RPC bridge exists');
select is(has_function_privilege('anon', 'public.initialize_user(uuid)', 'EXECUTE'), false, 'anon cannot initialize an arbitrary user');
select is(has_function_privilege('authenticated', 'public.initialize_user(uuid)', 'EXECUTE'), false, 'authenticated cannot initialize an arbitrary user');
select is(has_function_privilege('service_role', 'public.initialize_user(uuid)', 'EXECUTE'), true, 'service role can call the initialization bridge');

insert into auth.users (id, email)
values
  ('d1234567-89ab-4def-8123-000000000001', 'new-user@example.test'),
  ('d1234567-89ab-4def-8123-000000000002', 'existing-user@example.test');

create temporary table initialization_results (name text primary key, value jsonb);
insert into initialization_results values (
  'first', public.initialize_user('d1234567-89ab-4def-8123-000000000001')
);

select is((select value->>'created' from initialization_results where name = 'first'), 'true', 'first initialization reports created');
select is((select display_name from public.profiles where id = 'd1234567-89ab-4def-8123-000000000001'), 'user-d1234567', 'profile name uses the normalized UUID prefix');
select is((select name from public.towns where owner_id = 'd1234567-89ab-4def-8123-000000000001'), 'Town-d1234567', 'town name uses the normalized UUID prefix');
select is((select coins from public.towns where owner_id = 'd1234567-89ab-4def-8123-000000000001'), 1000::bigint, 'new town starts with 1000 coins');
select is((select count(*) from public.unlocked_areas ua join public.towns t on t.town_id = ua.town_id where t.owner_id = 'd1234567-89ab-4def-8123-000000000001' and ua.x = 40 and ua.y = 40 and ua.width = 20 and ua.height = 20), 1::bigint, 'central 20 by 20 area is unlocked');
select is((select count(*) from public.coin_ledger cl join public.towns t on t.town_id = cl.town_id where t.owner_id = 'd1234567-89ab-4def-8123-000000000001' and cl.amount = 1000 and cl.reason = 'initial_grant'), 1::bigint, 'initial grant ledger is written once');

insert into initialization_results values (
  'second', public.initialize_user('d1234567-89ab-4def-8123-000000000001')
);
select is((select value->>'created' from initialization_results where name = 'second'), 'false', 'repeat initialization reports no changes');
select is((select count(*) from public.profiles where id = 'd1234567-89ab-4def-8123-000000000001'), 1::bigint, 'repeat creates no profile duplicate');
select is((select count(*) from public.towns where owner_id = 'd1234567-89ab-4def-8123-000000000001'), 1::bigint, 'repeat creates no town duplicate');
select is((select count(*) from public.coin_ledger cl join public.towns t on t.town_id = cl.town_id where t.owner_id = 'd1234567-89ab-4def-8123-000000000001'), 1::bigint, 'repeat grants no additional coins');

insert into public.profiles (id, display_name)
values ('d1234567-89ab-4def-8123-000000000002', 'Existing Name');
insert into public.towns (town_id, owner_id, name, coins, population)
values (
  'e0000000-0000-4000-8000-000000000002',
  'd1234567-89ab-4def-8123-000000000002',
  'Existing Town', 4321, 12
);
insert into initialization_results values (
  'lazy', public.initialize_user('d1234567-89ab-4def-8123-000000000002')
);

select is((select value->>'created' from initialization_results where name = 'lazy'), 'true', 'lazy initialization reports a missing area was created');
select is((select display_name from public.profiles where id = 'd1234567-89ab-4def-8123-000000000002'), 'Existing Name', 'existing profile name is preserved');
select is((select name from public.towns where owner_id = 'd1234567-89ab-4def-8123-000000000002'), 'Existing Town', 'existing town name is preserved');
select is((select coins from public.towns where owner_id = 'd1234567-89ab-4def-8123-000000000002'), 4321::bigint, 'existing balance is preserved');
select is((select count(*) from public.coin_ledger where town_id = 'e0000000-0000-4000-8000-000000000002'), 0::bigint, 'existing town is not given a retroactive initial grant');
select is((select count(*) from public.unlocked_areas where town_id = 'e0000000-0000-4000-8000-000000000002' and x = 40 and y = 40), 1::bigint, 'missing initial area is repaired');

select throws_ok(
  $$select public.initialize_user('ffffffff-ffff-4fff-8fff-ffffffffffff')$$,
  'P0001', 'NOT_FOUND', 'a nonexistent auth user cannot be initialized'
);

select * from finish();
rollback;
