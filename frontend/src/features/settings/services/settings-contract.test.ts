import { describe, expect, it } from 'vitest'
import {
  mapUserSettingsRpcData,
  parseUserSettingsRpcResult,
} from './settings-contract'

const VALID_DATA = {
  display_name: '歩く市長',
  town_name: 'ウォークシティ',
  updated_at: '2026-08-30T12:34:56.000Z',
}

describe('user settings Supabase contract', () => {
  it('accepts and maps the agreed RPC envelope', () => {
    expect(mapUserSettingsRpcData(VALID_DATA)).toEqual({
      displayName: '歩く市長',
      townName: 'ウォークシティ',
      updatedAt: '2026-08-30T12:34:56.000Z',
    })
    expect(
      parseUserSettingsRpcResult({ ok: true, data: VALID_DATA }),
    ).toEqual({
      ok: true,
      data: {
        displayName: '歩く市長',
        townName: 'ウォークシティ',
        updatedAt: '2026-08-30T12:34:56.000Z',
      },
    })
  })

  it.each([
    ['raw data', VALID_DATA],
    ['camel case data', { ...VALID_DATA, display_name: undefined, displayName: '歩く市長' }],
    ['missing town name', { ...VALID_DATA, town_name: undefined }],
    ['leading ASCII spaces', { ...VALID_DATA, display_name: ' 市長' }],
    ['over 30 code points', { ...VALID_DATA, town_name: '街'.repeat(31) }],
    ['control character', { ...VALID_DATA, display_name: '市長\n' }],
    ['invalid timestamp', { ...VALID_DATA, updated_at: '2026-08-30' }],
  ])('rejects %s', (_label, value) => {
    expect(parseUserSettingsRpcResult(value)).toMatchObject({
      ok: false,
      error: { code: 'INTERNAL_ERROR' },
    })
  })

  it('preserves a known safe error envelope', () => {
    expect(
      parseUserSettingsRpcResult({
        ok: false,
        error: { code: 'INVALID_INPUT', message: '入力内容を確認してください。' },
      }),
    ).toEqual({
      ok: false,
      error: { code: 'INVALID_INPUT', message: '入力内容を確認してください。' },
    })
  })

  it('rejects an error code outside the settings RPC contract', () => {
    expect(
      parseUserSettingsRpcResult({
        ok: false,
        error: { code: 'CONFLICT', message: '競合しました。' },
      }),
    ).toEqual({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: '設定を保存できませんでした。' },
    })
  })
})
