import {
  GOOGLE_HEALTH_ACTIVITY_READ_SCOPE,
  type GoogleIntegrationApi,
} from './google-integration-api'
import type { ApiResult } from '../../../types/common'
import type { DailySteps, GetDailyStepsInput } from '../../health/types'
import type {
  AuthSession,
  GoogleHealthConnection,
  GoogleIntegrationErrorCode,
  GoogleIntegrationState,
  StartGoogleHealthConnectionResult,
} from '../types'

export type MockGoogleOperation =
  | 'getGoogleIntegrationState'
  | 'signInWithGoogle'
  | 'signOut'
  | 'startGoogleHealthConnection'
  | 'disconnectGoogleHealth'
  | 'getDailySteps'

export type MockGoogleIntegrationApiOptions = {
  latencyMs?: number
  initiallySignedIn?: boolean
  initiallyHealthConnected?: boolean
  stepsByDate?: Record<string, number>
  now?: () => Date
}

export type MockGoogleIntegrationApi = GoogleIntegrationApi & {
  setFailure(
    operation: MockGoogleOperation,
    code: GoogleIntegrationErrorCode | null,
  ): void
  setSteps(date: string, steps: number): void
  reset(): void
}

const MOCK_USER = {
  id: 'mock-user-001',
  displayName: 'Walk City テストユーザー',
  email: 'walker@example.com',
  avatarUrl: null,
}

const DEFAULT_STEPS_BY_DATE: Record<string, number> = {
  '2026-08-23': 4321,
  '2026-08-24': 7890,
  '2026-08-25': 6500,
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
  const initialSignedIn = options.initiallySignedIn ?? false
  const initialHealthConnected = options.initiallyHealthConnected ?? false
  const initialSteps = {
    ...DEFAULT_STEPS_BY_DATE,
    ...options.stepsByDate,
  }
  const failures = new Map<
    MockGoogleOperation,
    GoogleIntegrationErrorCode
  >()

  let signedIn = initialSignedIn
  let healthConnected = initialHealthConnected
  let connectedAt = initialHealthConnected ? now().toISOString() : null
  let lastSyncedAt: string | null = null
  let stepsByDate = { ...initialSteps }

  const wait = async () => {
    if (latencyMs <= 0) return
    await new Promise<void>((resolve) => globalThis.setTimeout(resolve, latencyMs))
  }

  const session = (): AuthSession | null => {
    if (!signedIn) return null

    return {
      user: { ...MOCK_USER },
      expiresAt: new Date(now().getTime() + 60 * 60 * 1000).toISOString(),
    }
  }

  const healthConnection = (): GoogleHealthConnection | null => {
    if (!signedIn) return null

    return healthConnected
      ? {
          status: 'connected',
          scopes: [GOOGLE_HEALTH_ACTIVITY_READ_SCOPE],
          connectedAt,
          lastSyncedAt,
        }
      : {
          status: 'not_connected',
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
      return success(state())
    },

    async signOut() {
      await wait()
      const failed = configuredFailure<GoogleIntegrationState>('signOut')
      if (failed) return failed

      signedIn = false
      return success(state())
    },

    async startGoogleHealthConnection() {
      await wait()
      const failed = configuredFailure<StartGoogleHealthConnectionResult>(
        'startGoogleHealthConnection',
      )
      if (failed) return failed
      if (!signedIn) return failure('UNAUTHENTICATED')

      healthConnected = true
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

      healthConnected = false
      connectedAt = null
      lastSyncedAt = null
      return success(state())
    },

    async getDailySteps(input: GetDailyStepsInput) {
      await wait()
      const failed = configuredFailure<DailySteps>('getDailySteps')
      if (failed) return failed
      if (!signedIn) return failure('UNAUTHENTICATED')
      if (!healthConnected) return failure('HEALTH_NOT_CONNECTED')
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
      healthConnected = initialHealthConnected
      connectedAt = initialHealthConnected ? now().toISOString() : null
      lastSyncedAt = null
      stepsByDate = { ...initialSteps }
    },
  }
}

export const mockGoogleIntegrationApi = createMockGoogleIntegrationApi()
