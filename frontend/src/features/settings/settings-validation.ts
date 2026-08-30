import type {
  UpdateUserSettingsInput,
  UserSettingsFieldErrors,
} from './types'

export const USER_SETTINGS_NAME_MAX_LENGTH = 30

export function trimAsciiSpaces(value: string): string {
  return value.replace(/^ +| +$/g, '')
}

export function userSettingsNameLength(value: string): number {
  return Array.from(value).length
}

export function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f)
  })
}

export function normalizeUserSettingsInput(
  input: UpdateUserSettingsInput,
): UpdateUserSettingsInput {
  return {
    displayName: trimAsciiSpaces(input.displayName),
    townName: trimAsciiSpaces(input.townName),
  }
}

function validateName(value: string, label: string): string | undefined {
  const length = userSettingsNameLength(value)
  if (length === 0 || value.trim().length === 0) {
    return `${label}を入力してください。`
  }
  if (length > USER_SETTINGS_NAME_MAX_LENGTH) {
    return `${label}は${USER_SETTINGS_NAME_MAX_LENGTH}文字以内で入力してください。`
  }
  if (hasControlCharacter(value)) {
    return `${label}に改行やタブなどの制御文字は使用できません。`
  }
  return undefined
}

export function validateUserSettings(
  input: UpdateUserSettingsInput,
): UserSettingsFieldErrors {
  const normalized = normalizeUserSettingsInput(input)
  const displayName = validateName(normalized.displayName, 'ユーザー名')
  const townName = validateName(normalized.townName, '街の名前')

  return {
    ...(displayName ? { displayName } : {}),
    ...(townName ? { townName } : {}),
  }
}

export function isSameUserSettings(
  left: UpdateUserSettingsInput,
  right: UpdateUserSettingsInput,
): boolean {
  const normalizedLeft = normalizeUserSettingsInput(left)
  const normalizedRight = normalizeUserSettingsInput(right)
  return (
    normalizedLeft.displayName === normalizedRight.displayName &&
    normalizedLeft.townName === normalizedRight.townName
  )
}
