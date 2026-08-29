import { describe, expect, it } from 'vitest'
import {
  clampMapZoom,
  getInitialMapView,
  MAX_MAP_ZOOM,
  MIN_MAP_ZOOM,
  zoomMapAtPoint,
} from './map-viewport'

describe('map viewport geometry', () => {
  it('clamps zoom to the supported range', () => {
    expect(clampMapZoom(0.1)).toBe(MIN_MAP_ZOOM)
    expect(clampMapZoom(1.25)).toBe(1.25)
    expect(clampMapZoom(4)).toBe(MAX_MAP_ZOOM)
  })

  it('fits the first unlocked area into the viewport', () => {
    const view = getInitialMapView(
      { width: 760, height: 560 },
      100,
      100,
      [{ x: 0, y: 0, width: 20, height: 20 }],
    )

    expect(view.zoom).toBeCloseTo(0.725)
    expect(view.panX).toBeCloseTo(148)
    expect(view.panY).toBeCloseTo(48)
  })

  it('falls back to a centered area when no land is unlocked', () => {
    const view = getInitialMapView(
      { width: 760, height: 560 },
      100,
      100,
      [],
    )

    expect(view.zoom).toBeCloseTo(0.725)
    expect(view.panX).toBeLessThan(0)
    expect(view.panY).toBeLessThan(0)
  })

  it('keeps the selected screen point fixed while zooming', () => {
    const next = zoomMapAtPoint(
      { panX: 100, panY: 50, zoom: 1 },
      2,
      300,
      250,
    )

    expect(next).toEqual({ panX: -100, panY: -150, zoom: 2 })
  })
})
