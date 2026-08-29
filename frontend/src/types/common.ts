export type ApiErrorCode =
  | 'UNAUTHENTICATED'
  | 'OAUTH_CANCELLED'
  | 'OAUTH_STATE_MISMATCH'
  | 'HEALTH_NOT_CONNECTED'
  | 'HEALTH_PERMISSION_REQUIRED'
  | 'HEALTH_PROVIDER_ERROR'
  | 'INVALID_INPUT'
  | 'CATALOG_ITEM_DISABLED'
  | 'PRICE_NOT_SET'
  | 'INSUFFICIENT_COINS'
  | 'OUT_OF_MAP'
  | 'LAND_LOCKED'
  | 'CELL_OCCUPIED'
  | 'ROAD_REQUIRED'
  | 'RIVER_BLOCKED'
  | 'BRIDGE_SPAN_REQUIRED'
  | 'BRIDGE_DIRECTION_INVALID'
  | 'BRIDGE_CORNER_FORBIDDEN'
  | 'PLACEMENT_IMMOVABLE'
  | 'DELETE_NOT_ALLOWED'
  | 'ROAD_IN_USE'
  | 'BRIDGE_GROUP_INVALID'
  | 'AREA_ALREADY_UNLOCKED'
  | 'AREA_NOT_ADJACENT'
  | 'NOT_OWNER'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'

export type ApiError = {
  code: ApiErrorCode
  message: string
  details?: Record<string, unknown>
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | {
      ok: false
      error: ApiError
    }
