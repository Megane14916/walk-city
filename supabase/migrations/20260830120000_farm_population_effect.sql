-- Add the farm's flat population effect without changing its existing price.

update public.building_types
set description = '人口が20人増加する農場です'
where code = 'farm';

delete from public.building_effects
where building_type_code = 'farm'
  and effect_type = 'population_flat';

insert into public.building_effects (
  id, building_type_code, effect_type, value, metadata
)
values (
  '20000000-0000-4000-8000-000000000003',
  'farm',
  'population_flat',
  20,
  '{}'::jsonb
);

-- Existing towns may already contain farms, so refresh their stored population.
do $$
declare
  v_town_id uuid;
begin
  for v_town_id in select town_id from public.towns loop
    perform private.recalculate_town_population(v_town_id);
  end loop;
end;
$$;
