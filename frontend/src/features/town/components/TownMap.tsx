import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type WheelEvent,
} from 'react'
import type {
  BuildingCatalogItem,
  Cell,
  LandUnlockPreviewStatus,
  PlacementPreviewStatus,
  RoadLinePreview,
  TownDetail,
  UnlockedArea,
} from '../types'
import {
  getLandUnlockAreaForCell,
  getCellKey,
  getInitialMapView,
  getPlacedBuildingCells,
  getRoadLineCells,
  MAP_CELL_SIZE,
  MAX_MAP_ZOOM,
  MIN_MAP_ZOOM,
  screenPointToCell,
  zoomMapAtPoint,
  type MapView,
  type ViewportSize,
} from '../utils'
import { MapBuilding, type RoadConnections } from './MapBuilding'

export type TownMapProps = {
  town: TownDetail
  catalog: BuildingCatalogItem[]
  viewportClassName?: string
  placement?: {
    item: BuildingCatalogItem
    anchor: Cell | null
    preview: PlacementPreviewStatus | null
    onSelectAnchor: (anchor: Cell) => void
  } | null
  landUnlock?: {
    area: UnlockedArea | null
    preview: LandUnlockPreviewStatus | null
    onSelectArea: (area: UnlockedArea) => void
  } | null
  roadPlacement?: {
    item: BuildingCatalogItem
    cells: Cell[]
    preview: RoadLinePreview | null
    onSelectCells: (cells: Cell[]) => void
  } | null
  selectedBuildingId?: string | null
  onSelectBuilding?: (buildingId: string | null) => void
}

type PointerPosition = { x: number; y: number }

type DragGesture = {
  pointerId: number
  startX: number
  startY: number
  startPanX: number
  startPanY: number
}

type PinchGesture = {
  startDistance: number
  startZoom: number
  worldX: number
  worldY: number
}

type RoadDrawGesture = {
  pointerId: number
  start: Cell
}

const FALLBACK_VIEWPORT: ViewportSize = { width: 760, height: 560 }

function pointerDistance(points: PointerPosition[]): number {
  const [first, second] = points
  return Math.hypot(second.x - first.x, second.y - first.y)
}

function pointerMidpoint(points: PointerPosition[]): PointerPosition {
  const [first, second] = points
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  }
}

export function TownMap({
  town,
  catalog,
  viewportClassName = 'h-[clamp(430px,64svh,680px)]',
  placement = null,
  landUnlock = null,
  roadPlacement = null,
  selectedBuildingId = null,
  onSelectBuilding,
}: TownMapProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const pointersRef = useRef(new Map<number, PointerPosition>())
  const dragRef = useRef<DragGesture | null>(null)
  const pinchRef = useRef<PinchGesture | null>(null)
  const roadDrawRef = useRef<RoadDrawGesture | null>(null)
  const didPanRef = useRef(false)
  const [viewportSize, setViewportSize] = useState(FALLBACK_VIEWPORT)
  const [isPanning, setIsPanning] = useState(false)
  const initialView = useMemo(
    () =>
      getInitialMapView(
        viewportSize,
        town.town.mapWidth,
        town.town.mapHeight,
        town.unlockedAreas,
      ),
    [town.town.mapWidth, town.town.mapHeight, town.unlockedAreas, viewportSize],
  )
  const [view, setViewState] = useState<MapView>(initialView)
  const viewRef = useRef(view)

  const setView = useCallback((nextView: MapView) => {
    viewRef.current = nextView
    setViewState(nextView)
  }, [])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const updateSize = () => {
      const rect = viewport.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        const nextSize = { width: rect.width, height: rect.height }
        setViewportSize(nextSize)
        setView(
          getInitialMapView(
            nextSize,
            town.town.mapWidth,
            town.town.mapHeight,
            town.unlockedAreas,
          ),
        )
      }
    }

    const frame = globalThis.requestAnimationFrame(updateSize)
    if (typeof ResizeObserver === 'undefined') {
      return () => globalThis.cancelAnimationFrame(frame)
    }
    const observer = new ResizeObserver(updateSize)
    observer.observe(viewport)
    return () => {
      globalThis.cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [setView, town.town.mapHeight, town.town.mapWidth, town.unlockedAreas])

  const catalogByCode = useMemo(
    () => new Map(catalog.map((item) => [item.code, item])),
    [catalog],
  )

  const roadCellIndex = useMemo(() => {
    const roadCodes = new Set(
      catalog.filter((item) => item.category === 'road').map((item) => item.code),
    )

    return new Set(
      town.buildings
        .filter((building) => roadCodes.has(building.buildingTypeCode))
        .map((building) =>
          getCellKey({ x: building.anchorX, y: building.anchorY }),
        ),
    )
  }, [catalog, town.buildings])

  const getRoadConnections = useCallback(
    (x: number, y: number): RoadConnections => ({
      up: roadCellIndex.has(getCellKey({ x, y: y - 1 })),
      right: roadCellIndex.has(getCellKey({ x: x + 1, y })),
      down: roadCellIndex.has(getCellKey({ x, y: y + 1 })),
      left: roadCellIndex.has(getCellKey({ x: x - 1, y })),
    }),
    [roadCellIndex],
  )

  const roadPreviewNewCellIndex = useMemo(
    () =>
      new Set(
        (roadPlacement?.preview?.newCells ?? []).map((cell) => getCellKey(cell)),
      ),
    [roadPlacement?.preview?.newCells],
  )

  const zoomAtCenter = useCallback(
    (zoomMultiplier: number) => {
      const current = viewRef.current
      setView(
        zoomMapAtPoint(
          current,
          current.zoom * zoomMultiplier,
          viewportSize.width / 2,
          viewportSize.height / 2,
        ),
      )
    },
    [setView, viewportSize],
  )

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    const pointX = event.clientX - rect.left
    const pointY = event.clientY - rect.top
    const multiplier = event.deltaY < 0 ? 1.12 : 1 / 1.12
    setView(
      zoomMapAtPoint(
        viewRef.current,
        viewRef.current.zoom * multiplier,
        pointX,
        pointY,
      ),
    )
  }

  const beginPinch = () => {
    const points = [...pointersRef.current.values()].slice(0, 2)
    if (points.length < 2) return
    const midpoint = pointerMidpoint(points)
    const current = viewRef.current
    pinchRef.current = {
      startDistance: Math.max(1, pointerDistance(points)),
      startZoom: current.zoom,
      worldX: (midpoint.x - current.panX) / current.zoom,
      worldY: (midpoint.y - current.panY) / current.zoom,
    }
    dragRef.current = null
  }

  const getCellAtClientPoint = (
    target: HTMLDivElement,
    clientX: number,
    clientY: number,
  ): Cell | null => {
    const rect = target.getBoundingClientRect()
    const current = viewRef.current
    return screenPointToCell({
      pointerX: clientX,
      pointerY: clientY,
      viewportLeft: rect.left,
      viewportTop: rect.top,
      panX: current.panX,
      panY: current.panY,
      zoom: current.zoom,
      cellSize: MAP_CELL_SIZE,
      mapWidth: town.town.mapWidth,
      mapHeight: town.town.mapHeight,
    })
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    didPanRef.current = false
    if (roadPlacement && town.editable) {
      const cell = getCellAtClientPoint(
        event.currentTarget,
        event.clientX,
        event.clientY,
      )
      if (!cell) return
      event.currentTarget.setPointerCapture?.(event.pointerId)
      roadDrawRef.current = { pointerId: event.pointerId, start: cell }
      roadPlacement.onSelectCells([cell])
      return
    }

    event.currentTarget.setPointerCapture?.(event.pointerId)
    const rect = event.currentTarget.getBoundingClientRect()
    pointersRef.current.set(event.pointerId, {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    })

    if (pointersRef.current.size === 1) {
      const current = viewRef.current
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startPanX: current.panX,
        startPanY: current.panY,
      }
    } else {
      didPanRef.current = true
      beginPinch()
    }
    setIsPanning(true)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const roadDraw = roadDrawRef.current
    if (roadDraw?.pointerId === event.pointerId && roadPlacement) {
      const cell = getCellAtClientPoint(
        event.currentTarget,
        event.clientX,
        event.clientY,
      )
      if (cell) {
        roadPlacement.onSelectCells(getRoadLineCells(roadDraw.start, cell))
      }
      return
    }

    if (!pointersRef.current.has(event.pointerId)) return
    const rect = event.currentTarget.getBoundingClientRect()
    pointersRef.current.set(event.pointerId, {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    })

    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const points = [...pointersRef.current.values()].slice(0, 2)
      const midpoint = pointerMidpoint(points)
      const pinch = pinchRef.current
      const zoom = Math.min(
        MAX_MAP_ZOOM,
        Math.max(
          MIN_MAP_ZOOM,
          pinch.startZoom * (pointerDistance(points) / pinch.startDistance),
        ),
      )
      setView({
        panX: midpoint.x - pinch.worldX * zoom,
        panY: midpoint.y - pinch.worldY * zoom,
        zoom,
      })
      return
    }

    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const deltaX = event.clientX - drag.startX
    const deltaY = event.clientY - drag.startY
    if (Math.abs(deltaX) <= 6 && Math.abs(deltaY) <= 6) return
    didPanRef.current = true
    setView({
      ...viewRef.current,
      panX: drag.startPanX + deltaX,
      panY: drag.startPanY + deltaY,
    })
  }

  const finishPointer = (event: PointerEvent<HTMLDivElement>) => {
    const roadDraw = roadDrawRef.current
    if (roadDraw?.pointerId === event.pointerId) {
      const cell = getCellAtClientPoint(
        event.currentTarget,
        event.clientX,
        event.clientY,
      )
      if (cell && roadPlacement) {
        roadPlacement.onSelectCells(getRoadLineCells(roadDraw.start, cell))
      }
      roadDrawRef.current = null
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture?.(event.pointerId)
      }
      return
    }

    pointersRef.current.delete(event.pointerId)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    pinchRef.current = null

    const remaining = [...pointersRef.current.entries()][0]
    if (remaining) {
      const [pointerId, point] = remaining
      const current = viewRef.current
      const rect = event.currentTarget.getBoundingClientRect()
      dragRef.current = {
        pointerId,
        startX: point.x + rect.left,
        startY: point.y + rect.top,
        startPanX: current.panX,
        startPanY: current.panY,
      }
    } else {
      dragRef.current = null
      setIsPanning(false)
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const panStep = event.shiftKey ? 96 : 32
    const current = viewRef.current
    if (event.key === '+' || event.key === '=') {
      event.preventDefault()
      zoomAtCenter(1.2)
    } else if (event.key === '-') {
      event.preventDefault()
      zoomAtCenter(1 / 1.2)
    } else if (event.key === '0') {
      event.preventDefault()
      setView(initialView)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      setView({ ...current, panX: current.panX + panStep })
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      setView({ ...current, panX: current.panX - panStep })
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setView({ ...current, panY: current.panY + panStep })
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      setView({ ...current, panY: current.panY - panStep })
    }
  }

  const handleCellClick = (event: MouseEvent<HTMLDivElement>) => {
    if (didPanRef.current) {
      didPanRef.current = false
      return
    }
    if (roadPlacement) return

    const rect = event.currentTarget.getBoundingClientRect()
    const current = viewRef.current
    const cell = screenPointToCell({
      pointerX: event.clientX,
      pointerY: event.clientY,
      viewportLeft: rect.left,
      viewportTop: rect.top,
      panX: current.panX,
      panY: current.panY,
      zoom: current.zoom,
      cellSize: MAP_CELL_SIZE,
      mapWidth: town.town.mapWidth,
      mapHeight: town.town.mapHeight,
    })

    if (!cell) return
    if (placement) {
      if (!town.editable) return
      placement.onSelectAnchor(cell)
      return
    }
    if (landUnlock) {
      if (!town.editable) return
      landUnlock.onSelectArea(getLandUnlockAreaForCell(cell))
      return
    }

    const building = [...town.buildings].reverse().find((candidate) =>
      getPlacedBuildingCells(candidate, catalog).some(
        (occupiedCell) =>
          occupiedCell.x === cell.x && occupiedCell.y === cell.y,
      ),
    )
    onSelectBuilding?.(building?.id ?? null)
  }

  const previewTone =
    placement?.preview?.status === 'valid'
      ? 'border-[#2f8567] bg-[#64c496]/55 text-[#164c3c]'
      : placement?.preview?.status === 'unknown'
        ? 'border-[#bb8b2d] bg-[#ffd86d]/55 text-[#765a18]'
        : 'border-[#b9574f] bg-[#ef897d]/55 text-[#762f2a]'
  const landUnlockTone =
    landUnlock?.preview?.status === 'valid'
      ? 'border-[#3b8468] bg-[#78c59f]/40 text-[#164c3c]'
      : 'border-[#a94f49] bg-[#df776f]/40 text-[#762f2a]'
  const roadPlacementTone =
    roadPlacement?.preview?.status.status === 'valid'
      ? 'border-[#397b65] bg-[#75867f]/80 text-white'
      : 'border-[#a94f49] bg-[#cf7169]/75 text-white'

  return (
    <div className="relative overflow-hidden rounded-[22px] border border-[#cfd8d1] bg-[#d8ddd4] shadow-[0_18px_42px_rgba(24,61,55,.12)]">
      <div
        ref={viewportRef}
        className={`relative w-full touch-none overflow-hidden outline-none select-none ${viewportClassName} ${
          isPanning
            ? 'cursor-grabbing'
            : placement || landUnlock || roadPlacement
              ? 'cursor-crosshair'
              : 'cursor-grab'
        }`}
        role="application"
        aria-label={`${town.town.name}のマップ。ドラッグまたは矢印キーで移動し、ホイールまたはボタンで拡大縮小できます。`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
        onClick={handleCellClick}
        onWheel={handleWheel}
      >
        <div
          className="absolute top-0 left-0 origin-top-left bg-[#c8cec5] will-change-transform"
          style={{
            width: town.town.mapWidth * MAP_CELL_SIZE,
            height: town.town.mapHeight * MAP_CELL_SIZE,
            transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})`,
            backgroundImage:
              'repeating-linear-gradient(135deg,rgba(65,83,76,.08) 0 8px,transparent 8px 16px)',
          }}
        >
          {town.unlockedAreas.map((area, index) => (
            <div
              key={`${area.x}:${area.y}:${area.width}:${area.height}:${index}`}
              className="absolute z-0 bg-[linear-gradient(145deg,#dcebcf,#c6dfb6)] shadow-[inset_0_0_0_2px_rgba(72,124,84,.24)]"
              style={{
                left: area.x * MAP_CELL_SIZE,
                top: area.y * MAP_CELL_SIZE,
                width: area.width * MAP_CELL_SIZE,
                height: area.height * MAP_CELL_SIZE,
              }}
            />
          ))}

          <div
            className="pointer-events-none absolute inset-0 z-10"
            style={{
              backgroundImage:
                'linear-gradient(rgba(38,74,64,.16) 1px,transparent 1px),linear-gradient(90deg,rgba(38,74,64,.16) 1px,transparent 1px)',
              backgroundSize: `${MAP_CELL_SIZE}px ${MAP_CELL_SIZE}px`,
            }}
          />

          {town.obstacles.map((obstacle) => (
            <div
              key={obstacle.id}
              className="absolute z-20 grid place-items-center border-2 border-[#796f61] bg-[repeating-linear-gradient(45deg,#a79d8e_0_6px,#8f8577_6px_12px)] text-[9px] font-black text-white shadow-sm"
              style={{
                left: obstacle.anchorX * MAP_CELL_SIZE + 2,
                top: obstacle.anchorY * MAP_CELL_SIZE + 2,
                width: obstacle.width * MAP_CELL_SIZE - 4,
                height: obstacle.height * MAP_CELL_SIZE - 4,
              }}
              title={obstacle.type}
            >
              !
            </div>
          ))}

          {town.buildings.map((building) => (
            <MapBuilding
              key={building.id}
              building={building}
              item={catalogByCode.get(building.buildingTypeCode)}
              roadConnections={
                catalogByCode.get(building.buildingTypeCode)?.category === 'road'
                  ? getRoadConnections(building.anchorX, building.anchorY)
                  : undefined
              }
              isSelected={building.id === selectedBuildingId}
            />
          ))}

          {placement?.anchor && (
            <div
              className={`pointer-events-none absolute z-30 grid place-items-center rounded-[6px] border-2 border-dashed font-black shadow-[0_5px_14px_rgba(18,55,49,.22)] ${previewTone}`}
              style={{
                left: placement.anchor.x * MAP_CELL_SIZE + 2,
                top: placement.anchor.y * MAP_CELL_SIZE + 2,
                width: placement.item.width * MAP_CELL_SIZE - 4,
                height: placement.item.height * MAP_CELL_SIZE - 4,
              }}
              role="img"
              aria-label={`${placement.item.name}の配置プレビュー、座標${placement.anchor.x},${placement.anchor.y}、${placement.preview?.status === 'valid' ? '配置可能' : '配置不可'}`}
            >
              {placement.preview?.status === 'valid' ? '✓' : '!'}
            </div>
          )}

          {roadPlacement && roadPlacement.cells.length > 0 && (
            <div
              className="pointer-events-none absolute inset-0 z-30"
              role="img"
              aria-label={`道路の線プレビュー、${roadPlacement.cells.length}マス、${roadPlacement.preview?.status.status === 'valid' ? '配置可能' : '配置不可'}`}
            >
              {roadPlacement.cells.map((cell) => {
                const isNew = roadPreviewNewCellIndex.has(getCellKey(cell))
                return (
                  <div
                    key={getCellKey(cell)}
                    className={`absolute grid place-items-center rounded-[4px] border-2 border-dashed text-[9px] font-black shadow-[0_3px_8px_rgba(18,55,49,.2)] ${
                      isNew
                        ? roadPlacementTone
                        : 'border-[#50605a] bg-[#aeb8b3]/65 text-[#31423c]'
                    }`}
                    style={{
                      left: cell.x * MAP_CELL_SIZE + 2,
                      top: cell.y * MAP_CELL_SIZE + 2,
                      width: MAP_CELL_SIZE - 4,
                      height: MAP_CELL_SIZE - 4,
                    }}
                    aria-hidden="true"
                  >
                    {isNew ? '•' : '↔'}
                  </div>
                )
              })}
            </div>
          )}

          {landUnlock?.area && (
            <div
              className={`pointer-events-none absolute z-30 grid place-items-center border-4 border-dashed text-4xl font-black shadow-[inset_0_0_0_3px_rgba(255,255,255,.4),0_8px_22px_rgba(18,55,49,.22)] ${landUnlockTone}`}
              style={{
                left: landUnlock.area.x * MAP_CELL_SIZE + 2,
                top: landUnlock.area.y * MAP_CELL_SIZE + 2,
                width: landUnlock.area.width * MAP_CELL_SIZE - 4,
                height: landUnlock.area.height * MAP_CELL_SIZE - 4,
              }}
              role="img"
              aria-label={`未開放領域アンロックのプレビュー、座標${landUnlock.area.x},${landUnlock.area.y}、${landUnlock.preview?.status === 'valid' ? '開放可能' : '開放不可'}`}
            >
              {landUnlock.preview?.status === 'valid' ? '✓' : '!'}
            </div>
          )}
        </div>

        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-16 bg-gradient-to-b from-[#193b38]/10 to-transparent" />
        <div className="absolute top-4 left-4 z-40 rounded-full border border-white/70 bg-[rgba(247,246,240,.88)] px-3 py-1.5 text-[9px] font-black tracking-[.08em] text-[#3d665c] shadow-sm backdrop-blur-sm">
          {Math.round(view.zoom * 100)}%
        </div>

        <div
          className="absolute right-4 bottom-4 z-40 flex items-center gap-1 rounded-[14px] border border-white/70 bg-[rgba(247,246,240,.91)] p-1.5 shadow-[0_8px_20px_rgba(24,61,55,.16)] backdrop-blur-sm"
          aria-label="マップ表示操作"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            className="grid h-10 w-10 cursor-pointer place-items-center rounded-[10px] border-0 bg-transparent text-lg font-black text-[#315f56] hover:bg-white disabled:cursor-not-allowed disabled:opacity-35"
            type="button"
            onClick={() => zoomAtCenter(1 / 1.2)}
            disabled={view.zoom <= MIN_MAP_ZOOM}
            aria-label="縮小"
          >
            −
          </button>
          <button
            className="grid h-10 min-w-10 cursor-pointer place-items-center rounded-[10px] border-0 bg-transparent px-2 text-[10px] font-black text-[#315f56] hover:bg-white"
            type="button"
            onClick={() => setView(initialView)}
            aria-label="開放エリアを中央に戻す"
          >
            戻す
          </button>
          <button
            className="grid h-10 w-10 cursor-pointer place-items-center rounded-[10px] border-0 bg-transparent text-lg font-black text-[#315f56] hover:bg-white disabled:cursor-not-allowed disabled:opacity-35"
            type="button"
            onClick={() => zoomAtCenter(1.2)}
            disabled={view.zoom >= MAX_MAP_ZOOM}
            aria-label="拡大"
          >
            ＋
          </button>
        </div>
      </div>
    </div>
  )
}
