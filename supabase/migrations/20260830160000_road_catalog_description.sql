-- Align the road catalog description with the canonical building-effect document.

update public.building_types
set description = '上下左右に隣接する土地へ建物を配置可能'
where code = 'road';
