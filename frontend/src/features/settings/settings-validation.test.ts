import { describe, expect, it } from 'vitest'
import {
  hasControlCharacter,
  isSameUserSettings,
  normalizeUserSettingsInput,
  userSettingsNameLength,
  validateUserSettings,
} from './settings-validation'

describe('settings validation', () => {
  it('normalizes only leading and trailing ASCII spaces', () => {
    expect(
      normalizeUserSettingsInput({
        displayName: '  街 歩き  ',
        townName: '  グリーン シティ ',
      }),
    ).toEqual({
      displayName: '街 歩き',
      townName: 'グリーン シティ',
    })
  })

  it('accepts one through thirty Unicode code points and duplicates', () => {
    const thirtyCharacters = '街'.repeat(29) + '🏙️'
    expect(userSettingsNameLength(thirtyCharacters)).toBe(31)
    expect(
      validateUserSettings({ displayName: '同じ名前', townName: '同じ名前' }),
    ).toEqual({})
    expect(
      validateUserSettings({
        displayName: '街'.repeat(30),
        townName: 'A',
      }),
    ).toEqual({})
  })

  it('rejects empty, overlong and control-character names', () => {
    expect(
      validateUserSettings({ displayName: '   ', townName: '街'.repeat(31) }),
    ).toEqual({
      displayName: 'ユーザー名を入力してください。',
      townName: '街の名前は30文字以内で入力してください。',
    })
    expect(hasControlCharacter('街\n名前')).toBe(true)
    expect(
      validateUserSettings({ displayName: '利用者\t名', townName: '街' }),
    ).toHaveProperty('displayName')
    expect(
      validateUserSettings({ displayName: '　　', townName: '街' }),
    ).toHaveProperty('displayName', 'ユーザー名を入力してください。')
  })

  it('compares dirty state after normalization', () => {
    expect(
      isSameUserSettings(
        { displayName: ' 利用者 ', townName: ' 街 ' },
        { displayName: '利用者', townName: '街' },
      ),
    ).toBe(true)
  })
})
