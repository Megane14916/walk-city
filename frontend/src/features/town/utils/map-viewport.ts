import type { UnlockedArea } from '../types'

export const MAP_CELL_SIZE = 32
export const MIN_MAP_ZOOM = 0.5
export const MAX_MAP_ZOOM = 2
export const MAP_VIEWPORT_PADDING = 48

export type MapView = {
  panX: number
  panY: number
  zoom: number
}

export type ViewportSize = {
  width: number
  height: number
}

export function clampMapZoom(zoom: number): number {
  return Math.min(MAX_MAP_ZOOM, Math.max(MIN_MAP_ZOOM, zoom))
}

export function getInitialMapView(
  viewport: ViewportSize,
  mapWidth: number,
  mapHeight: number,
  unlockedAreas: UnlockedArea[],
): MapView {
  const fallbackSize = Math.min(20, mapWidth, mapHeight)
  const focusArea = unlockedAreas[0] ?? {
    x: (mapWidth - fallbackSize) / 2,
    y: (mapHeight - fallbackSize) / 2,
    width: fallbackSize,
    height: fallbackSize,
  }

  const focusWidth = Math.max(1, focusArea.width) * MAP_CELL_SIZE
  const focusHeight = Math.max(1, focusArea.height) * MAP_CELL_SIZE
  const availableWidth = Math.max(1, viewport.width - MAP_VIEWPORT_PADDING * 2)
  const availableHeight = Math.max(1, viewport.height - MAP_VIEWPORT_PADDING * 2)
  const zoom = clampMapZoom(
    Math.min(availableWidth / focusWidth, availableHeight / focusHeight),
  )
  const focusCenterX = (focusArea.x + focusArea.width / 2) * MAP_CELL_SIZE
  const focusCenterY = (focusArea.y + focusArea.height / 2) * MAP_CELL_SIZE

  return {
    panX: viewport.width / 2 - focusCenterX * zoom,
    panY: viewport.height / 2 - focusCenterY * zoom,
    zoom,
  }
}

export function zoomMapAtPoint(
  view: MapView,
  nextZoom: number,
  pointX: number,
  pointY: number,
): MapView {
  const zoom = clampMapZoom(nextZoom)
  const worldX = (pointX - view.panX) / view.zoom
  const worldY = (pointY - view.panY) / view.zoom

  return {
    panX: pointX - worldX * zoom,
    panY: pointY - worldY * zoom,
    zoom,
  }
}
