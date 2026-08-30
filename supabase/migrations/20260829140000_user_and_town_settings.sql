-- User and town settings: validated names and one atomic, owner-scoped mutation.

do $$
begin
  if exists (
    select 1
    from public.profiles
    where char_length(display_name) not between 1 and 30
       or display_name <> pg_catalog.btrim(display_name, ' ')
       or display_name ~ '^[[:space:]　]*$'
       or display_name ~ '[[:cntrl:]]'
  ) then
    raise exception 'Existing profiles.display_name values violate the settings name contract';
  end if;

  if exists (
    select 1
    from public.towns
    where char_length(name) not between 1 and 30
       or name <> pg_catalog.btrim(name, ' ')
       or name ~ '^[[:space:]　]*$'
       or name ~ '[[:cntrl:]]'
  ) then
    raise exception 'Existing towns.name values violate the settings name contract';
  end if;
end;
$$;

alter table public.profiles
  drop constraint if exists profiles_display_name_settings_check;
alter table public.profiles
  add constraint profiles_display_name_settings_check check (
    char_length(display_name) between 1 and 30
    and display_name = pg_catalog.btrim(display_name, ' ')
    and display_name !~ '^[[:space:]　]*$'
    and display_name !~ '[[:cntrl:]]'
  );

alter table public.towns
  drop constraint if exists towns_name_settings_check;
alter table public.towns
  add constraint towns_name_settings_check check (
    char_length(name) between 1 and 30
    and name = pg_catalog.btrim(name, ' ')
    and name !~ '^[[:space:]　]*$'
    and name !~ '[[:cntrl:]]'
  );

revoke update (display_name) on table public.profiles from authenticated;
revoke update (name) on table public.towns from authenticated;

create or replace function public.update_user_settings(
  p_display_name text,
  p_town_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_display_name text;
  v_town_name text;
  v_timestamp timestamptz := pg_catalog.clock_timestamp();
begin
  begin
    if v_user_id is null then
      return private.api_failure('UNAUTHENTICATED');
    end if;

    if p_display_name is null or p_town_name is null then
      return private.api_failure('INVALID_INPUT');
    end if;

    v_display_name := pg_catalog.btrim(p_display_name, ' ');
    v_town_name := pg_catalog.btrim(p_town_name, ' ');

    if char_length(v_display_name) not between 1 and 30
      or v_display_name ~ '^[[:space:]　]*$'
      or v_display_name ~ '[[:cntrl:]]'
      or char_length(v_town_name) not between 1 and 30
      or v_town_name ~ '^[[:space:]　]*$'
      or v_town_name ~ '[[:cntrl:]]' then
      return private.api_failure('INVALID_INPUT');
    end if;

    perform 1
    from public.profiles
    where id = v_user_id
    for update;
    if not found then
      return private.api_failure('NOT_FOUND');
    end if;

    perform 1
    from public.towns
    where owner_id = v_user_id
    for update;
    if not found then
      return private.api_failure('NOT_FOUND');
    end if;

    update public.profiles
    set display_name = v_display_name,
        updated_at = v_timestamp
    where id = v_user_id;

    update public.towns
    set name = v_town_name,
        updated_at = v_timestamp
    where owner_id = v_user_id;

    return private.api_success(jsonb_build_object(
      'display_name', v_display_name,
      'town_name', v_town_name,
      'updated_at', v_timestamp
    ));
  exception
    when others then return private.api_failure('INTERNAL_ERROR');
  end;
end;
$$;

revoke all on function public.update_user_settings(text, text) from public, anon;
grant execute on function public.update_user_settings(text, text) to authenticated, service_role;

