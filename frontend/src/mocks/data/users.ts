import type { AuthUser } from '../../features/auth/types'

export const MOCK_AUTH_USER = {
  id: 'mock-user-001',
  displayName: 'Walk City テストユーザー',
  email: 'walker@example.com',
  avatarUrl: null,
} satisfies AuthUser
