-- Add the hospital's town-wide housing population effects without changing its price.

update public.building_types
set description = '町内の住宅数に応じて人口を増加する病院です'
where code = 'hospital';

delete from public.building_effects
where building_type_code = 'hospital'
  and effect_type in (
    'small_house_population_flat',
    'apartment_population_flat'
  );

insert into public.building_effects (
  id, building_type_code, effect_type, value,
  target_category, scope, stacking_rule, metadata
)
values
  (
    '20000000-0000-4000-8000-000000000006',
    'hospital',
    'small_house_population_flat',
    5,
    'residential',
    'town',
    'single_source',
    '{}'::jsonb
  ),
  (
    '20000000-0000-4000-8000-000000000007',
    'hospital',
    'apartment_population_flat',
    10,
    'residential',
    'town',
    'single_source',
    '{}'::jsonb
  );

create or replace function private.recalculate_town_population(p_town_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_population bigint;
  v_park_population bigint;
  v_hospital_population bigint;
begin
  select coalesce(sum(be.value), 0)::bigint
  into v_population
  from public.placed_buildings pb
  join public.building_effects be
    on be.building_type_code = pb.building_type_code
   and be.effect_type = 'population_flat'
  where pb.town_id = p_town_id;

  select coalesce(sum(target_bonus.bonus), 0)::bigint
  into v_park_population
  from (
    select target.id, max(park_effect.value) as bonus
    from public.placed_buildings park
    join public.building_effects park_effect
      on park_effect.building_type_code = park.building_type_code
     and park_effect.effect_type in (
       'adjacent_small_house_population_flat',
       'adjacent_apartment_population_flat'
     )
    join public.placed_buildings target
      on target.town_id = park.town_id
     and (
       (park_effect.effect_type = 'adjacent_small_house_population_flat'
        and target.building_type_code = 'small_house')
       or
       (park_effect.effect_type = 'adjacent_apartment_population_flat'
        and target.building_type_code = 'apartment')
     )
    join public.building_types target_type
      on target_type.code = target.building_type_code
    where park.town_id = p_town_id
      and (
        (
          park.anchor_x in (
            target.anchor_x - 1,
            target.anchor_x + target_type.width
          )
          and park.anchor_y between target.anchor_y
              and target.anchor_y + target_type.height - 1
        )
        or
        (
          park.anchor_y in (
            target.anchor_y - 1,
            target.anchor_y + target_type.height
          )
          and park.anchor_x between target.anchor_x
              and target.anchor_x + target_type.width - 1
        )
      )
    group by target.id
  ) target_bonus;

  select coalesce(sum(hospital_effect.value * target_count.count), 0)::bigint
  into v_hospital_population
  from public.building_effects hospital_effect
  join lateral (
    select count(*)::bigint as count
    from public.placed_buildings target
    where target.town_id = p_town_id
      and target.building_type_code = case hospital_effect.effect_type
        when 'small_house_population_flat' then 'small_house'
        when 'apartment_population_flat' then 'apartment'
      end
  ) target_count on true
  where hospital_effect.building_type_code = 'hospital'
    and hospital_effect.effect_type in (
      'small_house_population_flat',
      'apartment_population_flat'
    )
    and exists (
      select 1
      from public.placed_buildings hospital
      where hospital.town_id = p_town_id
        and hospital.building_type_code = 'hospital'
    );

  v_population := v_population
    + coalesce(v_park_population, 0)
    + coalesce(v_hospital_population, 0);

  update public.towns
  set population = v_population,
      updated_at = now()
  where town_id = p_town_id;

  return v_population;
end;
$$;

revoke all on function private.recalculate_town_population(uuid) from public, anon, authenticated;
grant execute on function private.recalculate_town_population(uuid) to service_role;

-- Existing towns may already contain hospitals and housing, so refresh their population.
do $$
declare
  v_town_id uuid;
begin
  for v_town_id in select town_id from public.towns loop
    perform private.recalculate_town_population(v_town_id);
  end loop;
end;
$$;
