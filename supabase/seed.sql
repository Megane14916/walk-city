-- Reproducible catalog data for local development and database tests.
insert into public.building_types (
  code, name, category, width, height, cost_coins,
  description, enabled, catalog_version
)
values
  ('road', '道路', 'road', 1, 1, 0, '建物を隣接して配置するための道路です', true, 1),
  ('house-small', '住宅（小）', 'residential', 1, 1, 50, '人口が10人増加する1×1サイズの住宅です', true, 1),
  ('apartment', '住宅（大）', 'residential', 2, 2, 200, '人口を50人増加する2×2サイズの住宅です', true, 1),
  ('park', '公園', 'nature', 1, 1, 150, '公園の模型です', true, 1),
  ('hospital', '病院', 'public', 2, 2, 600, '病院の模型です', true, 1),
  ('commercial-facility', '商業施設', 'commercial', 1, 1, 300, '商業施設の模型です', true, 1),
  ('farm', '農場', 'nature', 2, 2, 100, '農場の模型です', true, 1),
  ('city-hall', '役所', 'special', 2, 2, 3000, '役所の模型です', true, 1),
  ('factory', '工場', 'industry', 2, 2, 700, '工場の模型です', true, 1),
  ('future-building', '準備中の建物', 'special', 1, 1, null, '価格と効果を調整中です', false, 1)
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
  description, metadata
)
values
  ('20000000-0000-4000-8000-000000000001', 'house-small', 'population_flat', 10, '人口を10増やします', '{}'::jsonb),
  ('20000000-0000-4000-8000-000000000002', 'apartment', 'population_flat', 50, '人口を50人増加します', '{}'::jsonb)
on conflict (id) do update
set building_type_code = excluded.building_type_code,
    effect_type = excluded.effect_type,
    value = excluded.value,
    description = excluded.description,
    metadata = excluded.metadata;
