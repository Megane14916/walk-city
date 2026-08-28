// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import {
  MOCK_PUBLIC_LONG_NAME_TOWN,
  MOCK_PUBLIC_OWNER_MISMATCH_USER_ID,
  MOCK_PUBLIC_USER_ID,
} from '../../../mocks/data/towns'
import { createMockTownApi } from '../../../mocks/services/town'
import type { PublicUserProfile } from '../types'
import { PublicUserProfileView } from './PublicUserProfileView'
import { UserProfileErrorState } from './UserProfileErrorState'
import { UserProfileSkeleton } from './UserProfileSkeleton'
import { UserProfileSummary } from './UserProfileSummary'

const PROFILE: PublicUserProfile = {
  id: 'user-001',
  displayName: '街歩きユーザー',
  town: {
    id: 'town-001',
    name: 'みどりの街',
    population: 12_345,
  },
}

afterEach(cleanup)

function renderWithRouter(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

function renderProfileView(
  api = createMockTownApi({ latencyMs: 0 }),
  userId = MOCK_PUBLIC_USER_ID,
) {
  return renderWithRouter(
    <PublicUserProfileView
      api={api}
      userId={userId}
      loginHref="/login"
      rankingHref="/ranking"
      townHref={`/town/${userId}`}
    />,
  )
}

describe('UserProfileSummary', () => {
  it('shows the public values and navigation links', () => {
    const { container } = renderWithRouter(
      <UserProfileSummary
        profile={PROFILE}
        rankingHref="/ranking"
        townHref="/town/user-001"
      />,
    )

    expect(
      screen.getByRole('heading', { level: 1, name: '街歩きユーザー' }),
    ).not.toBeNull()
    expect(screen.getByRole('heading', { level: 2, name: 'みどりの街' })).not.toBeNull()
    expect(screen.getByText('12,345')).not.toBeNull()
    expect(screen.getByText('街', { selector: '[aria-hidden="true"]' })).not.toBeNull()
    expect(
      screen.getByRole('link', { name: 'ランキングへ戻る' }).getAttribute('href'),
    ).toBe('/ranking')
    expect(
      screen
        .getByRole('link', { name: /このユーザーの街を訪問/ })
        .getAttribute('href'),
    ).toBe('/town/user-001')
    expect(container.textContent).not.toContain('user-001')
  })

  it('preserves long names and formats a large population', () => {
    const profile: PublicUserProfile = {
      id: MOCK_PUBLIC_LONG_NAME_TOWN.town.owner.id,
      displayName: MOCK_PUBLIC_LONG_NAME_TOWN.town.owner.displayName,
      town: {
        id: MOCK_PUBLIC_LONG_NAME_TOWN.town.id,
        name: MOCK_PUBLIC_LONG_NAME_TOWN.town.name,
        population: Number.MAX_SAFE_INTEGER,
      },
    }
    renderWithRouter(
      <UserProfileSummary
        profile={profile}
        rankingHref="/ranking"
        townHref="/town/long-name"
      />,
    )

    expect(screen.getByText(profile.displayName)).not.toBeNull()
    expect(screen.getByText(profile.town.name)).not.toBeNull()
    expect(screen.getByText('9,007,199,254,740,991')).not.toBeNull()
  })
})

describe('UserProfileSkeleton', () => {
  it('announces the loading state and supports reduced motion', () => {
    const { container } = render(<UserProfileSkeleton />)

    expect(
      screen.getByRole('status', { name: '公開プロフィールを読み込み中' }),
    ).not.toBeNull()
    expect(screen.getByText('公開プロフィールを読み込んでいます…')).not.toBeNull()
    expect(container.querySelector('.motion-reduce\\:animate-none')).not.toBeNull()
  })
})

describe('UserProfileErrorState', () => {
  it.each([
    ['INVALID_INPUT', 'ユーザーを特定できませんでした', '/ranking'],
    ['NOT_FOUND', 'ユーザーを見つけられませんでした', '/ranking'],
    ['UNAUTHENTICATED', 'ログインが必要です', '/login'],
  ] as const)('shows the safe %s action', (code, title, href) => {
    renderWithRouter(
      <UserProfileErrorState
        error={{ code, message: '画面に出してはいけない内部メッセージ' }}
        loginHref="/login"
        rankingHref="/ranking"
        onRetry={() => undefined}
      />,
    )

    expect(screen.getByRole('heading', { name: title })).not.toBeNull()
    expect(screen.getAllByRole('link')[0].getAttribute('href')).toBe(href)
    expect(
      screen.queryByText('画面に出してはいけない内部メッセージ'),
    ).toBeNull()
  })

  it('offers retry for an internal error', () => {
    let retried = false
    renderWithRouter(
      <UserProfileErrorState
        error={{ code: 'INTERNAL_ERROR', message: '内部詳細' }}
        loginHref="/login"
        rankingHref="/ranking"
        onRetry={() => {
          retried = true
        }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'もう一度試す' }))
    expect(retried).toBe(true)
  })
})

describe('PublicUserProfileView', () => {
  it('shows a skeleton before rendering the loaded profile', async () => {
    const api = createMockTownApi({ latencyMs: 10 })
    renderProfileView(api)

    expect(
      screen.getByRole('status', { name: '公開プロフィールを読み込み中' }),
    ).not.toBeNull()
    expect(
      await screen.findByRole('heading', { name: 'シティウォーカー' }),
    ).not.toBeNull()
    expect(screen.getByRole('heading', { name: 'ブルータウン' })).not.toBeNull()
    expect(screen.getByText('60')).not.toBeNull()
  })

  it('retries an internal API failure', async () => {
    const api = createMockTownApi({ latencyMs: 0 })
    api.setFailure('getPublicTown', 'INTERNAL_ERROR')
    renderProfileView(api)

    expect(
      await screen.findByRole('heading', {
        name: 'ユーザー情報を読み込めませんでした',
      }),
    ).not.toBeNull()

    api.setFailure('getPublicTown', null)
    fireEvent.click(screen.getByRole('button', { name: 'もう一度試す' }))

    expect(
      await screen.findByRole('heading', { name: 'シティウォーカー' }),
    ).not.toBeNull()
  })

  it('shows a safe not-found state without retry', async () => {
    renderProfileView(createMockTownApi({ latencyMs: 0 }), 'missing-user')

    expect(
      await screen.findByRole('heading', {
        name: 'ユーザーを見つけられませんでした',
      }),
    ).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'もう一度試す' })).toBeNull()
    expect(
      screen.getByRole('link', { name: 'ランキングへ戻る' }).getAttribute('href'),
    ).toBe('/ranking')
  })

  it('turns a contract violation into a safe internal error', async () => {
    renderProfileView(
      createMockTownApi({ latencyMs: 0 }),
      MOCK_PUBLIC_OWNER_MISMATCH_USER_ID,
    )

    await waitFor(() =>
      expect(
        screen.getByRole('heading', {
          name: 'ユーザー情報を読み込めませんでした',
        }),
      ).not.toBeNull(),
    )
    expect(screen.queryByText('unexpected-owner-id')).toBeNull()
  })
})
