begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

select has_function(
  'public', 'update_user_settings', array['text', 'text'],
  'settings RPC exists'
);
select is(
  has_function_privilege('anon', 'public.update_user_settings(text,text)', 'EXECUTE'),
  false,
  'anon cannot execute the settings RPC'
);
select is(
  has_function_privilege('authenticated', 'public.update_user_settings(text,text)', 'EXECUTE'),
  true,
  'authenticated users can execute the settings RPC'
);
select is(
  has_column_privilege('authenticated', 'public.profiles', 'display_name', 'UPDATE'),
  false,
  'authenticated users cannot update profiles directly'
);
select is(
  has_column_privilege('authenticated', 'public.towns', 'name', 'UPDATE'),
  false,
  'authenticated users cannot update towns directly'
);

insert into auth.users (id, email)
values
  ('51000000-0000-4000-8000-000000000001', 'settings-one@example.test'),
  ('51000000-0000-4000-8000-000000000002', 'settings-two@example.test'),
  ('51000000-0000-4000-8000-000000000003', 'settings-missing@example.test');
insert into public.profiles (id, display_name)
values
  ('51000000-0000-4000-8000-000000000001', 'Before User'),
  ('51000000-0000-4000-8000-000000000002', 'Other User');
insert into public.towns (town_id, owner_id, name, coins, population)
values
  ('52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001', 'Before Town', 4321, 123),
  ('52000000-0000-4000-8000-000000000002', '51000000-0000-4000-8000-000000000002', 'Other Town', 9876, 456);

create temporary table settings_before as
select
  p.created_at as profile_created_at,
  t.created_at as town_created_at,
  t.coins,
  t.population,
  t.map_width,
  t.map_height,
  t.map_layout_id
from public.profiles p
join public.towns t on t.owner_id = p.id
where p.id = '51000000-0000-4000-8000-000000000001';

select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"51000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

create temporary table settings_results (name text primary key, value jsonb);
insert into settings_results values (
  'success', public.update_user_settings('  New User  ', '  New Town  ')
);
reset role;

select is((select value->>'ok' from settings_results where name = 'success'), 'true', 'valid settings return a success envelope');
select is((select value->'data'->>'display_name' from settings_results where name = 'success'), 'New User', 'normalized user name is returned');
select is((select value->'data'->>'town_name' from settings_results where name = 'success'), 'New Town', 'normalized town name is returned');
select ok((select value->'data'->>'updated_at' is not null from settings_results where name = 'success'), 'server timestamp is returned');
select is((select display_name from public.profiles where id = '51000000-0000-4000-8000-000000000001'), 'New User', 'user name is stored');
select is((select name from public.towns where owner_id = '51000000-0000-4000-8000-000000000001'), 'New Town', 'town name is stored');
select is(
  (select p.updated_at from public.profiles p where p.id = '51000000-0000-4000-8000-000000000001'),
  (select t.updated_at from public.towns t where t.owner_id = '51000000-0000-4000-8000-000000000001'),
  'profile and town receive the same timestamp'
);
select is((select coins from public.towns where owner_id = '51000000-0000-4000-8000-000000000001'), (select coins from settings_before), 'coins are unchanged');
select is((select population from public.towns where owner_id = '51000000-0000-4000-8000-000000000001'), (select population from settings_before), 'population is unchanged');
select is((select created_at from public.profiles where id = '51000000-0000-4000-8000-000000000001'), (select profile_created_at from settings_before), 'profile creation time is unchanged');
select is((select created_at from public.towns where owner_id = '51000000-0000-4000-8000-000000000001'), (select town_created_at from settings_before), 'town creation time is unchanged');
select is((select display_name from public.profiles where id = '51000000-0000-4000-8000-000000000002'), 'Other User', 'another user profile is unchanged');
select is((select name from public.towns where owner_id = '51000000-0000-4000-8000-000000000002'), 'Other Town', 'another user town is unchanged');
select is((select display_name from public.my_town_details_view), 'New User', 'my town view exposes the updated canonical user name');
select is((select town_name from public.my_town_details_view), 'New Town', 'my town view exposes the updated town name');
select is((select display_name from public.population_ranking_view where user_id = '51000000-0000-4000-8000-000000000001'), 'New User', 'ranking exposes the updated user name');
select is((select town_name from public.public_town_details_view where owner_id = '51000000-0000-4000-8000-000000000001'), 'New Town', 'public town view exposes the updated town name');

select is(public.update_user_settings('New User', '　')->'error'->>'code', 'INVALID_INPUT', 'full-width whitespace-only town name is rejected');
select is(public.update_user_settings(repeat('名', 31), 'Valid Town')->'error'->>'code', 'INVALID_INPUT', 'names over 30 Unicode characters are rejected');
select is(public.update_user_settings(E'Bad\nName', 'Valid Town')->'error'->>'code', 'INVALID_INPUT', 'control characters are rejected');
select is((select display_name from public.profiles where id = '51000000-0000-4000-8000-000000000001'), 'New User', 'invalid town input does not partially update the profile');
select is((select name from public.towns where owner_id = '51000000-0000-4000-8000-000000000001'), 'New Town', 'invalid input does not partially update the town');

select is(public.update_user_settings('Other User', 'Other Town')->>'ok', 'true', 'duplicate user and town names are allowed');

select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000003', true);
select is(public.update_user_settings('Missing User', 'Missing Town')->'error'->>'code', 'NOT_FOUND', 'missing profile or town returns NOT_FOUND');
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);
select is(public.update_user_settings('No User', 'No Town')->'error'->>'code', 'UNAUTHENTICATED', 'missing authentication returns UNAUTHENTICATED');

select * from finish();
rollback;
