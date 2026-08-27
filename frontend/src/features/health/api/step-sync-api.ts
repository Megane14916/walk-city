import type { ApiResult } from '../../../types/common'
import type { StepSyncStatus } from '../types'

/**
 * Google Health の歩数をゲーム内報酬として精算するための境界。
 * 歩数・ユーザー ID・コインは入力として受け取らず、サーバーの確定値を返す。
 */
export interface StepSyncApi {
  syncSteps(): Promise<ApiResult<StepSyncStatus>>
}
