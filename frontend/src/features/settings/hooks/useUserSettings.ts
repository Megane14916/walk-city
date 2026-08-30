import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SettingsApi } from '../api'
import {
  isSameUserSettings,
  normalizeUserSettingsInput,
  validateUserSettings,
} from '../settings-validation'
import type {
  UpdateUserSettingsInput,
  UserSettings,
  UserSettingsFieldErrors,
} from '../types'
import type { ApiError } from '../../../types/common'

const UNEXPECTED_ERROR: ApiError = {
  code: 'INTERNAL_ERROR',
  message: '設定を保存できませんでした。もう一度お試しください。',
}

export type UseUserSettingsOptions = {
  api: SettingsApi
  initialSettings: UpdateUserSettingsInput
}

export type UserSettingsFormState = {
  values: UpdateUserSettingsInput
  errors: UserSettingsFieldErrors
  apiError: ApiError | null
  isDirty: boolean
  isSubmitting: boolean
  canSubmit: boolean
  setDisplayName: (value: string) => void
  setTownName: (value: string) => void
  submit: () => Promise<UserSettings | null>
}

export function useUserSettings({
  api,
  initialSettings,
}: UseUserSettingsOptions): UserSettingsFormState {
  const [normalizedInitial] = useState(() =>
    normalizeUserSettingsInput(initialSettings),
  )
  const [values, setValues] = useState<UpdateUserSettingsInput>(normalizedInitial)
  const [apiError, setApiError] = useState<ApiError | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const mounted = useRef(true)
  const requestGeneration = useRef(0)
  const submitting = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      requestGeneration.current += 1
    }
  }, [])

  const errors = useMemo(() => validateUserSettings(values), [values])
  const isDirty = !isSameUserSettings(values, normalizedInitial)
  const hasErrors = Object.keys(errors).length > 0

  const setDisplayName = useCallback((displayName: string) => {
    setValues((current) => ({ ...current, displayName }))
    setApiError(null)
  }, [])

  const setTownName = useCallback((townName: string) => {
    setValues((current) => ({ ...current, townName }))
    setApiError(null)
  }, [])

  const submit = useCallback(async (): Promise<UserSettings | null> => {
    if (submitting.current) return null

    const normalized = normalizeUserSettingsInput(values)
    if (
      Object.keys(validateUserSettings(normalized)).length > 0 ||
      isSameUserSettings(normalized, normalizedInitial)
    ) {
      return null
    }

    submitting.current = true
    setIsSubmitting(true)
    setApiError(null)
    const generation = requestGeneration.current + 1
    requestGeneration.current = generation

    try {
      const result = await api.updateUserSettings(normalized)
      if (!mounted.current || generation !== requestGeneration.current) {
        return null
      }
      if (!result.ok) {
        setApiError(result.error)
        return null
      }
      setValues({
        displayName: result.data.displayName,
        townName: result.data.townName,
      })
      return result.data
    } catch {
      if (mounted.current && generation === requestGeneration.current) {
        setApiError(UNEXPECTED_ERROR)
      }
      return null
    } finally {
      if (mounted.current && generation === requestGeneration.current) {
        submitting.current = false
        setIsSubmitting(false)
      }
    }
  }, [api, normalizedInitial, values])

  return {
    values,
    errors,
    apiError,
    isDirty,
    isSubmitting,
    canSubmit: isDirty && !hasErrors && !isSubmitting,
    setDisplayName,
    setTownName,
    submit,
  }
}
