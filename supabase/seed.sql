-- Reproducible catalog data for local development and database tests.
insert into public.building_types (
  code, name, category, width, height, cost_coins,
  description, enabled, catalog_version
)
values
  ('road', '道路', 'road', 1, 1, 0, '上下左右に隣接する土地へ建物を配置可能', true, 1),
  ('small_house', '住宅（小）', 'residential', 1, 1, 50, '人口が10人増加する1×1サイズの住宅です', true, 1),
  ('apartment', '住宅（大）', 'residential', 2, 2, 200, '人口を50人増加する2×2サイズの住宅です', true, 1),
  ('small_park', '公園', 'nature', 1, 1, 150, '隣接する住宅の人口を増加する公園です', true, 1),
  ('hospital', '病院', 'public', 2, 2, 600, '町内の住宅数に応じて人口を増加する病院です', true, 1),
  ('commercial', '商業施設', 'commercial', 1, 1, 300, '商業施設の模型です', true, 1),
  ('farm', '農場', 'nature', 2, 2, 100, '人口が20人増加する農場です', true, 1),
  ('town_hall', '役所', 'special', 2, 2, 3000, '町内の住宅数に応じて人口を増加する役所です', true, 1),
  ('factory', '工場', 'industry', 2, 2, 700, '工場の模型です', true, 1)
on conflict (code) do update
set name = excluded.name,
    category = excluded.category,
    width = excluded.width,
    height = excluded.height,
    cost_coins = excluded.cost_coins,
    description = excluded.description,
    enabled = excluded.enabled,
    catalog_version = excluded.catalog_version;

insert into public.building_effects (
  id, building_type_code, effect_type, value,
  metadata
)
values
  ('20000000-0000-4000-8000-000000000001', 'small_house', 'population_flat', 10, '{}'::jsonb),
  ('20000000-0000-4000-8000-000000000002', 'apartment', 'population_flat', 50, '{}'::jsonb),
  ('20000000-0000-4000-8000-000000000003', 'farm', 'population_flat', 20, '{}'::jsonb),
  ('20000000-0000-4000-8000-000000000004', 'small_park', 'adjacent_small_house_population_flat', 5, '{}'::jsonb),
  ('20000000-0000-4000-8000-000000000005', 'small_park', 'adjacent_apartment_population_flat', 10, '{}'::jsonb),
  ('20000000-0000-4000-8000-000000000006', 'hospital', 'small_house_population_flat', 5, '{}'::jsonb),
  ('20000000-0000-4000-8000-000000000007', 'hospital', 'apartment_population_flat', 10, '{}'::jsonb),
  ('20000000-0000-4000-8000-000000000008', 'town_hall', 'small_house_population_flat', 20, '{}'::jsonb),
  ('20000000-0000-4000-8000-000000000009', 'town_hall', 'apartment_population_flat', 30, '{}'::jsonb)
on conflict (id) do update
set building_type_code = excluded.building_type_code,
    effect_type = excluded.effect_type,
    value = excluded.value,
    metadata = excluded.metadata;
