import type {
  BuildingCatalogItem,
  BuildingEffect,
  MapObstacle,
  PlacedBuilding,
  TownDetail,
  TownSummary,
  UnlockedArea,
} from '../types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isNonEmptyString(value: unknown): value is string {
  return isString(value) && value.trim().length > 0
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value)
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value)
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return isSafeInteger(value) && value >= 0
}

function isPositiveSafeInteger(value: unknown): value is number {
  return isSafeInteger(value) && value > 0
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isIsoDateTime(value: unknown): value is string {
  return (
    isNonEmptyString(value) &&
    /^\d{4}-\d{2}-\d{2}T/.test(value) &&
    Number.isFinite(Date.parse(value))
  )
}

function isUserSummary(value: unknown): value is TownSummary['owner'] {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.displayName)
  )
}

function isBuildingEffect(value: unknown): value is BuildingEffect {
  return (
    isRecord(value) &&
    isNonEmptyString(value.type) &&
    (value.value === null || isFiniteNumber(value.value)) &&
    isNullableString(value.targetCategory) &&
    isNullableString(value.scope) &&
    isNullableString(value.stackingRule) &&
    isString(value.description) &&
    isRecord(value.metadata)
  )
}

export function isBuildingCatalogItem(
  value: unknown,
): value is BuildingCatalogItem {
  return (
    isRecord(value) &&
    isNonEmptyString(value.code) &&
    isNonEmptyString(value.name) &&
    isNonEmptyString(value.category) &&
    (value.width === 1 || value.width === 2) &&
    (value.height === 1 || value.height === 2) &&
    (value.costCoins === null || isNonNegativeSafeInteger(value.costCoins)) &&
    typeof value.enabled === 'boolean' &&
    isString(value.description) &&
    Array.isArray(value.effects) &&
    value.effects.every(isBuildingEffect) &&
    isNonEmptyString(value.assetKey) &&
    isNonNegativeSafeInteger(value.catalogVersion)
  )
}

export function isBuildingCatalog(
  value: unknown,
): value is BuildingCatalogItem[] {
  return Array.isArray(value) && value.every(isBuildingCatalogItem)
}

function isPlacedBuilding(value: unknown): value is PlacedBuilding {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.buildingTypeCode) &&
    isNullableString(value.customName) &&
    isNonNegativeSafeInteger(value.anchorX) &&
    isNonNegativeSafeInteger(value.anchorY) &&
    isIsoDateTime(value.createdAt) &&
    isIsoDateTime(value.updatedAt)
  )
}

function isUnlockedArea(value: unknown): value is UnlockedArea {
  return (
    isRecord(value) &&
    isNonNegativeSafeInteger(value.x) &&
    isNonNegativeSafeInteger(value.y) &&
    isPositiveSafeInteger(value.width) &&
    isPositiveSafeInteger(value.height)
  )
}

function isMapObstacle(value: unknown): value is MapObstacle {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.type) &&
    isNonNegativeSafeInteger(value.anchorX) &&
    isNonNegativeSafeInteger(value.anchorY) &&
    isPositiveSafeInteger(value.width) &&
    isPositiveSafeInteger(value.height)
  )
}

function isTownSummary(value: unknown): value is TownSummary {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isUserSummary(value.owner) &&
    isNonEmptyString(value.name) &&
    (value.coins === undefined || isNonNegativeSafeInteger(value.coins)) &&
    isNonNegativeSafeInteger(value.population) &&
    value.mapWidth === 100 &&
    value.mapHeight === 100
  )
}

export function isTownDetail(value: unknown): value is TownDetail {
  return (
    isRecord(value) &&
    isTownSummary(value.town) &&
    Array.isArray(value.buildings) &&
    value.buildings.every(isPlacedBuilding) &&
    Array.isArray(value.unlockedAreas) &&
    value.unlockedAreas.every(isUnlockedArea) &&
    Array.isArray(value.obstacles) &&
    value.obstacles.every(isMapObstacle) &&
    isNonNegativeSafeInteger(value.catalogVersion) &&
    typeof value.editable === 'boolean'
  )
}
