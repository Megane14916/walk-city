import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { createSupabaseSettingsApi } from './settings'

const SUCCESS = {
  ok: true,
  data: {
    display_name: '新しい市長',
    town_name: '新しい街',
    updated_at: '2026-08-30T12:34:56.000Z',
  },
}

function createClient(result: unknown) {
  const rpc = vi.fn().mockResolvedValue(result)
  return { client: { rpc } as unknown as SupabaseClient, rpc }
}

describe('createSupabaseSettingsApi', () => {
  it('normalizes both names and invokes only update_user_settings', async () => {
    const { client, rpc } = createClient({ data: SUCCESS, error: null })
    const api = createSupabaseSettingsApi(client)

    await expect(
      api.updateUserSettings({
        displayName: '  新しい市長  ',
        townName: '  新しい街  ',
      }),
    ).resolves.toEqual({
      ok: true,
      data: {
        displayName: '新しい市長',
        townName: '新しい街',
        updatedAt: '2026-08-30T12:34:56.000Z',
      },
    })
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('update_user_settings', {
      p_display_name: '新しい市長',
      p_town_name: '新しい街',
    })
  })

  it('rejects either invalid field before making a request', async () => {
    const { client, rpc } = createClient({ data: SUCCESS, error: null })
    const api = createSupabaseSettingsApi(client)

    await expect(
      api.updateUserSettings({ displayName: 'Valid', townName: '　' }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('preserves RPC error envelopes and rejects malformed success data', async () => {
    const rpcFailure = createClient({
      data: {
        ok: false,
        error: { code: 'NOT_FOUND', message: '対象が見つかりませんでした。' },
      },
      error: null,
    })
    const malformed = createClient({
      data: { ok: true, data: { ...SUCCESS.data, updated_at: null } },
      error: null,
    })

    await expect(
      createSupabaseSettingsApi(rpcFailure.client).updateUserSettings({
        displayName: 'Valid User',
        townName: 'Valid Town',
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
    await expect(
      createSupabaseSettingsApi(malformed.client).updateUserSettings({
        displayName: 'Valid User',
        townName: 'Valid Town',
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'INTERNAL_ERROR' } })
  })

  it('normalizes transport failures and thrown requests safely', async () => {
    const denied = createClient({ data: null, error: { code: '42501' } })
    await expect(
      createSupabaseSettingsApi(denied.client).updateUserSettings({
        displayName: 'Valid User',
        townName: 'Valid Town',
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'NOT_OWNER' } })

    const rpc = vi.fn().mockRejectedValue(new Error('secret transport detail'))
    const client = { rpc } as unknown as SupabaseClient
    await expect(
      createSupabaseSettingsApi(client).updateUserSettings({
        displayName: 'Valid User',
        townName: 'Valid Town',
      }),
    ).resolves.toEqual({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: '設定を保存できませんでした。' },
    })
  })

  it('supports an injected RPC name for isolated environments', async () => {
    const { client, rpc } = createClient({ data: SUCCESS, error: null })
    const api = createSupabaseSettingsApi(client, { rpcName: 'test_settings' })

    await api.updateUserSettings({ displayName: 'User', townName: 'Town' })

    expect(rpc).toHaveBeenCalledWith('test_settings', {
      p_display_name: 'User',
      p_town_name: 'Town',
    })
  })
})

