import { useCallback, useEffect, useRef, useState } from 'react'
import type { ApiError } from '../../../types/common'
import type { TownApi } from '../../town/api'
import type { PublicUserProfile } from '../types'
import { toPublicUserProfile } from '../utils'

export type PublicUserApi = Pick<TownApi, 'getPublicTown'>

export type PublicUserProfileState = {
  profile: PublicUserProfile | null
  isLoading: boolean
  error: ApiError | null
  retry: () => Promise<void>
}

type StoredPublicUserProfileState = {
  api: PublicUserApi
  userId: string
  profile: PublicUserProfile | null
  isLoading: boolean
  error: ApiError | null
}

type ActiveRequest = {
  api: PublicUserApi
  userId: string
  promise: Promise<void>
}

const INVALID_USER_ERROR: ApiError = {
  code: 'INVALID_INPUT',
  message: 'ユーザーを特定できませんでした。',
}

const UNEXPECTED_ERROR: ApiError = {
  code: 'INTERNAL_ERROR',
  message: 'ユーザー情報を読み込めませんでした。',
}

export function usePublicUserProfile(
  api: PublicUserApi,
  userId: string,
): PublicUserProfileState {
  const [stored, setStored] = useState<StoredPublicUserProfileState>({
    api,
    userId,
    profile: null,
    isLoading: true,
    error: null,
  })
  const mounted = useRef(true)
  const requestGeneration = useRef(0)
  const activeRequest = useRef<ActiveRequest | null>(null)

  useEffect(() => {
    mounted.current = true

    return () => {
      mounted.current = false
      requestGeneration.current += 1
      activeRequest.current = null
    }
  }, [])

  const load = useCallback((): Promise<void> => {
    const currentRequest = activeRequest.current
    if (
      currentRequest?.api === api &&
      currentRequest.userId === userId
    ) {
      return currentRequest.promise
    }

    const generation = requestGeneration.current + 1
    requestGeneration.current = generation
    activeRequest.current = null

    const request = Promise.resolve()
      .then(() => {
        if (!mounted.current || requestGeneration.current !== generation) {
          return null
        }

        if (userId.trim() === '') {
          setStored({
            api,
            userId,
            profile: null,
            isLoading: false,
            error: INVALID_USER_ERROR,
          })
          return null
        }

        setStored({
          api,
          userId,
          profile: null,
          isLoading: true,
          error: null,
        })
        return api.getPublicTown(userId)
      })
      .then((result) => {
        if (
          result === null ||
          !mounted.current ||
          requestGeneration.current !== generation
        ) {
          return
        }

        if (!result.ok) {
          setStored({
            api,
            userId,
            profile: null,
            isLoading: false,
            error: result.error,
          })
          return
        }

        const profileResult = toPublicUserProfile(userId, result.data)
        setStored({
          api,
          userId,
          profile: profileResult.ok ? profileResult.data : null,
          isLoading: false,
          error: profileResult.ok ? null : profileResult.error,
        })
      })
      .catch(() => {
        if (!mounted.current || requestGeneration.current !== generation) {
          return
        }

        setStored({
          api,
          userId,
          profile: null,
          isLoading: false,
          error: UNEXPECTED_ERROR,
        })
      })
      .finally(() => {
        if (activeRequest.current?.promise === request) {
          activeRequest.current = null
        }
      })

    activeRequest.current = { api, userId, promise: request }
    return request
  }, [api, userId])

  useEffect(() => {
    void load()
  }, [load])

  const retry = useCallback(() => load(), [load])
  const isCurrentRequest = stored.api === api && stored.userId === userId

  return {
    profile: isCurrentRequest ? stored.profile : null,
    isLoading: isCurrentRequest ? stored.isLoading : true,
    error: isCurrentRequest ? stored.error : null,
    retry,
  }
}
