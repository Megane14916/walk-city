import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseFailure } from '../../../lib/supabase-api'
import type { ApiResult } from '../../../types/common'
import type { SettingsApi } from '../api'
import {
  normalizeUserSettingsInput,
  validateUserSettings,
} from '../settings-validation'
import type { UserSettings } from '../types'
import { parseUserSettingsRpcResult } from './settings-contract'

export type SupabaseSettingsApiOptions = {
  rpcName?: string
}

function failure(): ApiResult<UserSettings> {
  return {
    ok: false,
    error: { code: 'INVALID_INPUT', message: '入力内容を確認してください。' },
  }
}

export function createSupabaseSettingsApi(
  supabase: SupabaseClient,
  options: SupabaseSettingsApiOptions = {},
): SettingsApi {
  const rpcName = options.rpcName ?? 'update_user_settings'

  return {
    async updateUserSettings(input) {
      const normalized = normalizeUserSettingsInput(input)
      if (Object.keys(validateUserSettings(normalized)).length > 0) {
        return failure()
      }

      try {
        const { data, error } = await supabase.rpc(rpcName, {
          p_display_name: normalized.displayName,
          p_town_name: normalized.townName,
        })
        if (error) {
          return supabaseFailure(error, {
            fallbackMessage: '設定を保存できませんでした。',
          })
        }

        return parseUserSettingsRpcResult(data)
      } catch {
        return {
          ok: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: '設定を保存できませんでした。',
          },
        }
      }
    },
  }
}

