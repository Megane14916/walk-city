export type UpdateUserSettingsInput = {
  displayName: string
  townName: string
}

export type UserSettings = {
  displayName: string
  townName: string
  updatedAt: string
}

export type UserSettingsField = 'displayName' | 'townName'

export type UserSettingsFieldErrors = Partial<
  Record<UserSettingsField, string>
>
