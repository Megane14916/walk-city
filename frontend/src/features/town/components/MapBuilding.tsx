import { memo } from 'react'
import type { BuildingCatalogItem, PlacedBuilding } from '../types'
import { MAP_CELL_SIZE } from '../utils'

export type MapBuildingProps = {
  building: PlacedBuilding
  item?: BuildingCatalogItem
  roadConnections?: RoadConnections
  isSelected?: boolean
}

export type RoadConnections = {
  up: boolean
  right: boolean
  down: boolean
  left: boolean
}

const CATEGORY_STYLES: Record<string, string> = {
  residential:
    'border-[#b66b52] bg-[linear-gradient(145deg,#fff4e9,#f3c9aa)] text-[#733d2e]',
  nature:
    'border-[#66975f] bg-[linear-gradient(145deg,#f0f7df,#add69a)] text-[#346036]',
  public:
    'border-[#4b9673] bg-[linear-gradient(145deg,#e8f6df,#96cf9c)] text-[#245c42]',
  commercial:
    'border-[#c89b3e] bg-[linear-gradient(145deg,#fff8d8,#f0cb70)] text-[#765817]',
  industry:
    'border-[#747d79] bg-[linear-gradient(145deg,#f0f1ed,#aeb7b2)] text-[#45504b]',
  special:
    'border-[#7b7898] bg-[linear-gradient(145deg,#efedf8,#c7c1e2)] text-[#55516f]',
}

const CATEGORY_ICONS: Record<string, string> = {
  residential: '⌂',
  nature: '♧',
  public: '♧',
  commercial: '◇',
  industry: '▥',
  special: '◆',
}

const BUILDING_ICONS: Record<string, string> = {
  small_house: '⌂',
  apartment: '⌂',
  small_park: '♧',
  hospital: '＋',
  commercial: '◇',
  farm: '⌗',
  town_hall: '▦',
  factory: '▥',
}

export const MapBuilding = memo(function MapBuilding({
  building,
  item,
  roadConnections,
  isSelected = false,
}: MapBuildingProps) {
  const width = item?.width ?? 1
  const height = item?.height ?? 1
  const defaultName =
    item?.name ?? `不明な建物（${building.buildingTypeCode}）`
  const name = building.customName ?? defaultName
  const isRoad = item?.category === 'road'

  if (isRoad) {
    const bridgeOrientation =
      building.roadVariant === 'bridge_horizontal'
        ? 'horizontal'
        : building.roadVariant === 'bridge_vertical'
          ? 'vertical'
          : null
    if (bridgeOrientation) {
      const isHorizontal = bridgeOrientation === 'horizontal'
      return (
        <div
          className={`absolute ${isSelected ? 'z-30 rounded ring-4 ring-[#ffcf57] ring-offset-2 ring-offset-white/80' : 'z-20'}`}
          style={{
            left: building.anchorX * MAP_CELL_SIZE,
            top: building.anchorY * MAP_CELL_SIZE,
            width: width * MAP_CELL_SIZE,
            height: height * MAP_CELL_SIZE,
          }}
          role="img"
          aria-label={`橋（${isHorizontal ? '横向き' : '縦向き'}）、座標${building.anchorX},${building.anchorY}、7セル構造`}
          title="橋"
        >
          <svg
            className="h-full w-full overflow-visible drop-shadow-[0_2px_2px_rgba(27,47,43,.3)]"
            viewBox="0 0 32 32"
            aria-hidden="true"
          >
            {isHorizontal ? (
              <>
                <rect x="0" y="7" width="32" height="18" fill="#6f7975" />
                <line x1="0" y1="6" x2="32" y2="6" stroke="#4b5551" strokeWidth="2" />
                <line x1="0" y1="26" x2="32" y2="26" stroke="#4b5551" strokeWidth="2" />
                <line x1="0" y1="9" x2="32" y2="9" stroke="#d8c18b" strokeWidth="2" />
                <line x1="0" y1="23" x2="32" y2="23" stroke="#d8c18b" strokeWidth="2" />
                <line x1="1" y1="16" x2="31" y2="16" stroke="#f1d36a" strokeWidth="1.5" strokeDasharray="5 4" />
              </>
            ) : (
              <>
                <rect x="7" y="0" width="18" height="32" fill="#6f7975" />
                <line x1="6" y1="0" x2="6" y2="32" stroke="#4b5551" strokeWidth="2" />
                <line x1="26" y1="0" x2="26" y2="32" stroke="#4b5551" strokeWidth="2" />
                <line x1="9" y1="0" x2="9" y2="32" stroke="#d8c18b" strokeWidth="2" />
                <line x1="23" y1="0" x2="23" y2="32" stroke="#d8c18b" strokeWidth="2" />
                <line x1="16" y1="1" x2="16" y2="31" stroke="#f1d36a" strokeWidth="1.5" strokeDasharray="5 4" />
              </>
            )}
          </svg>
        </div>
      )
    }

    const connections = normalizeRoadConnections(roadConnections)
    const actualConnections = roadConnections ?? EMPTY_ROAD_CONNECTIONS
    const connectionLabel = getRoadConnectionLabel(actualConnections)
    const isHorizontalStraight =
      connections.left &&
      connections.right &&
      !connections.up &&
      !connections.down
    const isVerticalStraight =
      connections.up &&
      connections.down &&
      !connections.left &&
      !connections.right

    return (
      <div
        className={`absolute ${isSelected ? 'z-30 rounded ring-4 ring-[#ffcf57] ring-offset-2 ring-offset-white/80' : 'z-20'}`}
        style={{
          left: building.anchorX * MAP_CELL_SIZE,
          top: building.anchorY * MAP_CELL_SIZE,
          width: width * MAP_CELL_SIZE,
          height: height * MAP_CELL_SIZE,
        }}
        role="img"
        aria-label={`${name}、座標${building.anchorX},${building.anchorY}、${connectionLabel}`}
        title={name}
      >
        <svg
          className="h-full w-full overflow-visible drop-shadow-[0_2px_2px_rgba(27,47,43,.25)]"
          viewBox="0 0 32 32"
          aria-hidden="true"
        >
          <g fill="#6f7975">
            {connections.up && <rect x="7" y="0" width="18" height="17" />}
            {connections.right && <rect x="15" y="7" width="17" height="18" />}
            {connections.down && <rect x="7" y="15" width="18" height="17" />}
            {connections.left && <rect x="0" y="7" width="17" height="18" />}
            <rect x="7" y="7" width="18" height="18" rx="2" />
          </g>

          <g fill="none" stroke="#53605b" strokeWidth="1">
            {connections.up && <line x1="7" y1="0" x2="7" y2="8" />}
            {connections.up && <line x1="25" y1="0" x2="25" y2="8" />}
            {connections.right && <line x1="24" y1="7" x2="32" y2="7" />}
            {connections.right && <line x1="24" y1="25" x2="32" y2="25" />}
            {connections.down && <line x1="7" y1="24" x2="7" y2="32" />}
            {connections.down && <line x1="25" y1="24" x2="25" y2="32" />}
            {connections.left && <line x1="0" y1="7" x2="8" y2="7" />}
            {connections.left && <line x1="0" y1="25" x2="8" y2="25" />}
          </g>

          {isHorizontalStraight ? (
            <line
              x1="1"
              y1="16"
              x2="31"
              y2="16"
              stroke="#f1d36a"
              strokeWidth="1.5"
              strokeDasharray="5 4"
            />
          ) : isVerticalStraight ? (
            <line
              x1="16"
              y1="1"
              x2="16"
              y2="31"
              stroke="#f1d36a"
              strokeWidth="1.5"
              strokeDasharray="5 4"
            />
          ) : (
            <g
              fill="none"
              stroke="#f1d36a"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            >
              {connections.up && <line x1="16" y1="1" x2="16" y2="9" />}
              {connections.right && <line x1="23" y1="16" x2="31" y2="16" />}
              {connections.down && <line x1="16" y1="23" x2="16" y2="31" />}
              {connections.left && <line x1="1" y1="16" x2="9" y2="16" />}
            </g>
          )}
        </svg>
      </div>
    )
  }

  const category = item?.category ?? 'unknown'
  const categoryStyle =
    CATEGORY_STYLES[category] ??
    'border-[#8a918e] bg-[repeating-linear-gradient(135deg,#f0f1ed_0_7px,#dfe2dc_7px_14px)] text-[#5f6865]'

  return (
    <div
      className={`absolute grid place-items-center overflow-hidden rounded-[6px] border-2 shadow-[0_4px_8px_rgba(19,54,49,.18),inset_0_1px_0_rgba(255,255,255,.68)] ${isSelected ? 'z-30 ring-4 ring-[#ffcf57] ring-offset-2 ring-offset-white/80' : 'z-20'} ${categoryStyle}`}
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
        {BUILDING_ICONS[item?.assetKey ?? ''] ??
          CATEGORY_ICONS[category] ??
          '?'}
      </span>
      {width > 1 && (
        <span className="absolute right-1 bottom-0.5 left-1 truncate rounded bg-white/70 px-1 text-center text-[7px] leading-3 font-black">
          {name}
        </span>
      )}
    </div>
  )
})

const EMPTY_ROAD_CONNECTIONS: RoadConnections = {
  up: false,
  right: false,
  down: false,
  left: false,
}

function normalizeRoadConnections(
  connections: RoadConnections | undefined,
): RoadConnections {
  const next = { ...(connections ?? EMPTY_ROAD_CONNECTIONS) }
  const count = Object.values(next).filter(Boolean).length

  if (count === 0) {
    return { ...next, left: true, right: true }
  }

  if (count === 1) {
    if (next.left || next.right) return { ...next, left: true, right: true }
    return { ...next, up: true, down: true }
  }

  return next
}

function getRoadConnectionLabel(connections: RoadConnections): string {
  const directions = [
    connections.up && '上',
    connections.right && '右',
    connections.down && '下',
    connections.left && '左',
  ].filter(Boolean)

  return directions.length > 0 ? `${directions.join('')}に接続` : '単独道路'
}
