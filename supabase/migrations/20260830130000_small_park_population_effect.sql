-- Add the small park's orthogonal adjacency effect without changing its price.

update public.building_types
set description = '隣接する住宅の人口を増加する公園です'
where code = 'small_park';

delete from public.building_effects
where building_type_code = 'small_park'
  and effect_type in (
    'adjacent_small_house_population_flat',
    'adjacent_apartment_population_flat'
  );

insert into public.building_effects (
  id, building_type_code, effect_type, value,
  target_category, scope, stacking_rule, metadata
)
values
  (
    '20000000-0000-4000-8000-000000000004',
    'small_park',
    'adjacent_small_house_population_flat',
    5,
    'residential',
    'orthogonal_adjacent',
    'unique_target',
    '{}'::jsonb
  ),
  (
    '20000000-0000-4000-8000-000000000005',
    'small_park',
    'adjacent_apartment_population_flat',
    10,
    'residential',
    'orthogonal_adjacent',
    'unique_target',
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

  v_population := v_population + coalesce(v_park_population, 0);

  update public.towns
  set population = v_population,
      updated_at = now()
  where town_id = p_town_id;

  return v_population;
end;
$$;

revoke all on function private.recalculate_town_population(uuid) from public, anon, authenticated;
grant execute on function private.recalculate_town_population(uuid) to service_role;

-- Existing towns may already contain parks and houses, so refresh their population.
do $$
declare
  v_town_id uuid;
begin
  for v_town_id in select town_id from public.towns loop
    perform private.recalculate_town_population(v_town_id);
  end loop;
end;
$$;
