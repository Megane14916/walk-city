import { describe, expect, it } from 'vitest'
import {
  normalizeSupabaseError,
  parseApiResultEnvelope,
} from './supabase-api'

describe('parseApiResultEnvelope', () => {
  const isPayload = (value: unknown): value is { id: string } =>
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string'

  it('accepts a valid success envelope', () => {
    expect(
      parseApiResultEnvelope(
        { ok: true, data: { id: 'town-1' } },
        isPayload,
        '読み込めませんでした。',
      ),
    ).toEqual({ ok: true, data: { id: 'town-1' } })
  })

  it('accepts a known API error without exposing details', () => {
    expect(
      parseApiResultEnvelope(
        {
          ok: false,
          error: {
            code: 'INSUFFICIENT_COINS',
            message: 'コインが足りません。',
            details: { sql: 'secret' },
          },
        },
        isPayload,
        '処理できませんでした。',
      ),
    ).toEqual({
      ok: false,
      error: {
        code: 'INSUFFICIENT_COINS',
        message: 'コインが足りません。',
      },
    })
  })

  it('rejects an invalid success payload', () => {
    expect(
      parseApiResultEnvelope(
        { ok: true, data: { id: 1 } },
        isPayload,
        '読み込めませんでした。',
      ),
    ).toEqual({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '読み込めませんでした。',
      },
    })
  })
})

describe('normalizeSupabaseError', () => {
  const options = { fallbackMessage: '街データを読み込めませんでした。' }

  it('maps Postgres conflicts without exposing the database message', async () => {
    await expect(
      normalizeSupabaseError(
        { code: '23505', message: 'duplicate key value violates constraint x' },
        options,
      ),
    ).resolves.toEqual({
      code: 'CONFLICT',
      message: 'データが更新されています。もう一度お試しください。',
    })
  })

  it('maps an HTTP 401 response to UNAUTHENTICATED', async () => {
    await expect(
      normalizeSupabaseError({ status: 401 }, options),
    ).resolves.toEqual({
      code: 'UNAUTHENTICATED',
      message: 'Googleでログインしてください。',
    })
  })

  it('reads a typed error envelope from a Function response', async () => {
    const response = new Response(
      JSON.stringify({
        ok: false,
        error: { code: 'LAND_LOCKED', message: '土地が未開放です。' },
      }),
      { status: 409, headers: { 'Content-Type': 'application/json' } },
    )

    await expect(
      normalizeSupabaseError({ context: response }, options),
    ).resolves.toEqual({
      code: 'LAND_LOCKED',
      message: '土地が未開放です。',
    })
  })

  it('uses a safe fallback for unknown errors', async () => {
    await expect(
      normalizeSupabaseError(
        { message: 'select * from private_table' },
        options,
      ),
    ).resolves.toEqual({
      code: 'INTERNAL_ERROR',
      message: '街データを読み込めませんでした。',
    })
  })
})
