import { memo } from 'react'
import type { BuildingCatalogItem, PlacedBuilding } from '../types'
import { MAP_CELL_SIZE } from '../utils'

export type MapBuildingProps = {
  building: PlacedBuilding
  item?: BuildingCatalogItem
}

const CATEGORY_STYLES: Record<string, string> = {
  residential:
    'border-[#b66b52] bg-[linear-gradient(145deg,#fff4e9,#f3c9aa)] text-[#733d2e]',
  public:
    'border-[#4b9673] bg-[linear-gradient(145deg,#e8f6df,#96cf9c)] text-[#245c42]',
  special:
    'border-[#7b7898] bg-[linear-gradient(145deg,#efedf8,#c7c1e2)] text-[#55516f]',
}

const CATEGORY_ICONS: Record<string, string> = {
  residential: '⌂',
  public: '♧',
  special: '◆',
}

export const MapBuilding = memo(function MapBuilding({
  building,
  item,
}: MapBuildingProps) {
  const width = item?.width ?? 1
  const height = item?.height ?? 1
  const name = item?.name ?? `不明な建物（${building.buildingTypeCode}）`
  const isRoad = item?.category === 'road'

  if (isRoad) {
    return (
      <div
        className="absolute z-20 grid place-items-center border border-[#7b8581] bg-[#87908c] shadow-[inset_0_0_0_3px_rgba(255,255,255,.16)]"
        style={{
          left: building.anchorX * MAP_CELL_SIZE,
          top: building.anchorY * MAP_CELL_SIZE,
          width: width * MAP_CELL_SIZE,
          height: height * MAP_CELL_SIZE,
        }}
        role="img"
        aria-label={`${name}、座標${building.anchorX},${building.anchorY}`}
        title={name}
      >
        <span className="h-0.5 w-4/5 rounded-full bg-[#f2d56d]" aria-hidden="true" />
      </div>
    )
  }

  const category = item?.category ?? 'unknown'
  const categoryStyle =
    CATEGORY_STYLES[category] ??
    'border-[#8a918e] bg-[repeating-linear-gradient(135deg,#f0f1ed_0_7px,#dfe2dc_7px_14px)] text-[#5f6865]'

  return (
    <div
      className={`absolute z-20 grid place-items-center overflow-hidden rounded-[6px] border-2 shadow-[0_4px_8px_rgba(19,54,49,.18),inset_0_1px_0_rgba(255,255,255,.68)] ${categoryStyle}`}
      style={{
        left: building.anchorX * MAP_CELL_SIZE + 2,
        top: building.anchorY * MAP_CELL_SIZE + 2,
        width: width * MAP_CELL_SIZE - 4,
        height: height * MAP_CELL_SIZE - 4,
      }}
      role="img"
      aria-label={`${name}、座標${building.anchorX},${building.anchorY}、${width}×${height}セル`}
      title={name}
    >
      <span
        className="text-[clamp(14px,2vw,23px)] leading-none font-black drop-shadow-[0_1px_0_rgba(255,255,255,.8)]"
        aria-hidden="true"
      >
        {CATEGORY_ICONS[category] ?? '?'}
      </span>
      {width > 1 && (
        <span className="absolute right-1 bottom-0.5 left-1 truncate rounded bg-white/70 px-1 text-center text-[7px] leading-3 font-black">
          {name}
        </span>
      )}
    </div>
  )
})
