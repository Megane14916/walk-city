import {
  GOOGLE_HEALTH_ACTIVITY_READ_SCOPE,
  type GoogleIntegrationApi,
} from '../../features/auth/api'
import type {
  AuthSession,
  GoogleHealthConnection,
  GoogleIntegrationErrorCode,
  GoogleIntegrationState,
  InitializeUserResult,
  StartGoogleHealthConnectionResult,
} from '../../features/auth/types'
import type { DailySteps, GetDailyStepsInput } from '../../features/health/types'
import type { ApiResult } from '../../types/common'
import { MOCK_DAILY_STEPS_BY_DATE } from '../data/health'
import { MOCK_AUTH_USER } from '../data/users'
import {
  mockWalkCityStore,
  type MockWalkCityStore,
} from './walk-city-store'

export type MockGoogleOperation =
  | 'getGoogleIntegrationState'
  | 'signInWithGoogle'
  | 'signOut'
  | 'initializeUser'
  | 'startGoogleHealthConnection'
  | 'disconnectGoogleHealth'
  | 'getDailySteps'

export type MockGoogleIntegrationApiOptions = {
  latencyMs?: number
  initiallySignedIn?: boolean
  initiallyHealthConnected?: boolean
  initialHealthConnectionStatus?: GoogleHealthConnection['status']
  stepsByDate?: Record<string, number>
  now?: () => Date
  store?: MockWalkCityStore
}

export type MockGoogleIntegrationApi = GoogleIntegrationApi & {
  setFailure(
    operation: MockGoogleOperation,
    code: GoogleIntegrationErrorCode | null,
  ): void
  setSteps(date: string, steps: number): void
  reset(): void
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const errorMessages: Record<GoogleIntegrationErrorCode, string> = {
  UNAUTHENTICATED: 'Googleでログインしてください。',
  OAUTH_CANCELLED: 'Google認証がキャンセルされました。',
  OAUTH_STATE_MISMATCH: '認証状態を確認できませんでした。もう一度お試しください。',
  HEALTH_NOT_CONNECTED: 'Google Healthが連携されていません。',
  HEALTH_PERMISSION_REQUIRED: '歩数を読み取る権限が必要です。',
  HEALTH_PROVIDER_ERROR: 'Google Healthとの通信に失敗しました。',
  INVALID_INPUT: '入力内容が正しくありません。',
  INTERNAL_ERROR: '予期しないエラーが発生しました。',
}

function success<T>(data: T): ApiResult<T> {
  return { ok: true, data }
}

function failure<T>(code: GoogleIntegrationErrorCode): ApiResult<T> {
  return {
    ok: false,
    error: { code, message: errorMessages[code] },
  }
}

function copyConnection(
  connection: GoogleHealthConnection,
): GoogleHealthConnection {
  return { ...connection, scopes: [...connection.scopes] }
}

export function createMockGoogleIntegrationApi(
  options: MockGoogleIntegrationApiOptions = {},
): MockGoogleIntegrationApi {
  const latencyMs = options.latencyMs ?? 150
  const now = options.now ?? (() => new Date())
  const store = options.store
  const initialSignedIn = options.initiallySignedIn ?? false
  const initialHealthStatus =
    options.initialHealthConnectionStatus ??
    (options.initiallyHealthConnected ? 'connected' : 'not_connected')
  const initialSteps = {
    ...MOCK_DAILY_STEPS_BY_DATE,
    ...options.stepsByDate,
  }
  const failures = new Map<
    MockGoogleOperation,
    GoogleIntegrationErrorCode
  >()
  const authListeners = new Set<() => void>()

  let signedIn = initialSignedIn
  let healthStatus = initialHealthStatus
  let connectedAt =
    initialHealthStatus === 'not_connected' ? null : now().toISOString()
  let lastSyncedAt: string | null = null
  let stepsByDate = { ...initialSteps }

  const wait = async () => {
    if (latencyMs <= 0) return
    await new Promise<void>((resolve) => globalThis.setTimeout(resolve, latencyMs))
  }

  const session = (): AuthSession | null => {
    if (!signedIn) return null

    return {
      user: {
        ...MOCK_AUTH_USER,
        displayName:
          store?.getMutableTown().town.owner.displayName ??
          MOCK_AUTH_USER.displayName,
      },
      expiresAt: new Date(now().getTime() + 60 * 60 * 1000).toISOString(),
    }
  }

  const healthConnection = (): GoogleHealthConnection | null => {
    if (!signedIn) return null

    if (healthStatus === 'connected') {
      return {
        status: healthStatus,
        scopes: [GOOGLE_HEALTH_ACTIVITY_READ_SCOPE],
        connectedAt,
        lastSyncedAt,
      }
    }

    if (healthStatus === 'permission_required') {
      return {
        status: healthStatus,
        scopes: [],
        connectedAt,
        lastSyncedAt,
      }
    }

    return {
      status: healthStatus,
      scopes: [],
      connectedAt: null,
      lastSyncedAt: null,
    }
  }

  const state = (): GoogleIntegrationState => {
    const connection = healthConnection()
    return {
      session: session(),
      healthConnection: connection ? copyConnection(connection) : null,
    }
  }

  const configuredFailure = <T>(
    operation: MockGoogleOperation,
  ): ApiResult<T> | null => {
    const code = failures.get(operation)
    return code ? failure<T>(code) : null
  }

  const notifyAuthChange = () => {
    for (const listener of authListeners) listener()
  }

  return {
    async getGoogleIntegrationState() {
      await wait()
      return configuredFailure('getGoogleIntegrationState') ?? success(state())
    },

    async signInWithGoogle() {
      await wait()
      const failed = configuredFailure<GoogleIntegrationState>(
        'signInWithGoogle',
      )
      if (failed) return failed

      signedIn = true
      notifyAuthChange()
      return success(state())
    },

    async signOut() {
      await wait()
      const failed = configuredFailure<GoogleIntegrationState>('signOut')
      if (failed) return failed

      signedIn = false
      notifyAuthChange()
      return success(state())
    },

    async initializeUser() {
      await wait()
      const failed = configuredFailure<InitializeUserResult>('initializeUser')
      if (failed) return failed
      if (!signedIn) return failure('UNAUTHENTICATED')

      return success({
        profileId: MOCK_AUTH_USER.id,
        townId: '20000000-0000-4000-8000-000000000001',
        created: false,
      })
    },

    subscribeToAuthChanges(listener) {
      authListeners.add(listener)
      return () => authListeners.delete(listener)
    },

    async startGoogleHealthConnection() {
      await wait()
      const failed = configuredFailure<StartGoogleHealthConnectionResult>(
        'startGoogleHealthConnection',
      )
      if (failed) return failed
      if (!signedIn) return failure('UNAUTHENTICATED')

      healthStatus = 'connected'
      connectedAt = now().toISOString()
      return success({ next: 'connected', state: state() })
    },

    async disconnectGoogleHealth() {
      await wait()
      const failed = configuredFailure<GoogleIntegrationState>(
        'disconnectGoogleHealth',
      )
      if (failed) return failed
      if (!signedIn) return failure('UNAUTHENTICATED')

      healthStatus = 'not_connected'
      connectedAt = null
      lastSyncedAt = null
      return success(state())
    },

    async getDailySteps(input: GetDailyStepsInput) {
      await wait()
      const failed = configuredFailure<DailySteps>('getDailySteps')
      if (failed) return failed
      if (!signedIn) return failure('UNAUTHENTICATED')
      if (healthStatus === 'not_connected') {
        return failure('HEALTH_NOT_CONNECTED')
      }
      if (healthStatus === 'permission_required') {
        return failure('HEALTH_PERMISSION_REQUIRED')
      }
      if (!DATE_PATTERN.test(input.date) || input.timezone.trim() === '') {
        return failure('INVALID_INPUT')
      }

      const syncedAt = now().toISOString()
      lastSyncedAt = syncedAt
      return success({
        date: input.date,
        timezone: input.timezone,
        steps: stepsByDate[input.date] ?? 0,
        source: 'google_health',
        syncedAt,
      })
    },

    setFailure(operation, code) {
      if (code) failures.set(operation, code)
      else failures.delete(operation)
    },

    setSteps(date, steps) {
      if (!DATE_PATTERN.test(date) || !Number.isInteger(steps) || steps < 0) {
        throw new Error('dateはYYYY-MM-DD、stepsは0以上の整数にしてください。')
      }
      stepsByDate[date] = steps
    },

    reset() {
      failures.clear()
      signedIn = initialSignedIn
      healthStatus = initialHealthStatus
      connectedAt =
        initialHealthStatus === 'not_connected' ? null : now().toISOString()
      lastSyncedAt = null
      stepsByDate = { ...initialSteps }
      notifyAuthChange()
    },
  }
}

export const mockGoogleIntegrationApi = createMockGoogleIntegrationApi({
  store: mockWalkCityStore,
})
