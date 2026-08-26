import type { ApiResult } from '../../../types/common'
import type { DailySteps, GetDailyStepsInput } from '../../health/types'
import type {
  GoogleIntegrationState,
  StartGoogleHealthConnectionResult,
} from '../types'

export const GOOGLE_HEALTH_ACTIVITY_READ_SCOPE =
  'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly'

/**
 * GoogleログインとGoogle Health連携をUIから利用するための境界。
 * 実装がmockからSupabase/Edge Functionへ変わってもUIはこの型を使う。
 */
export interface GoogleIntegrationApi {
  getGoogleIntegrationState(): Promise<ApiResult<GoogleIntegrationState>>
  signInWithGoogle(): Promise<ApiResult<GoogleIntegrationState>>
  signOut(): Promise<ApiResult<GoogleIntegrationState>>
  startGoogleHealthConnection(): Promise<
    ApiResult<StartGoogleHealthConnectionResult>
  >
  disconnectGoogleHealth(): Promise<ApiResult<GoogleIntegrationState>>
  getDailySteps(
    input: GetDailyStepsInput,
  ): Promise<ApiResult<DailySteps>>
}
