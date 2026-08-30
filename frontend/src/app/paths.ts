export const paths = {
  root: '/',
  login: '/login',
  privacy: '/privacy',
  terms: '/terms',
  authCallback: '/auth/callback',
  healthConnect: '/health/connect',
  townPattern: '/town/:userId',
  town: (userId: string) => `/town/${encodeURIComponent(userId)}`,
} as const
