import type { ApiResult } from '../../../types/common'
import type { UpdateUserSettingsInput, UserSettings } from '../types'

export interface SettingsApi {
  updateUserSettings(
    input: UpdateUserSettingsInput,
  ): Promise<ApiResult<UserSettings>>
}
