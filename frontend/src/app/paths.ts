export const paths = {
  root: '/',
  login: '/login',
  authCallback: '/auth/callback',
  healthConnect: '/health/connect',
  ranking: '/ranking',
  townPattern: '/town/:userId',
  town: (userId: string) => `/town/${encodeURIComponent(userId)}`,
  userPattern: '/users/:userId',
  user: (userId: string) => `/users/${encodeURIComponent(userId)}`,
} as const
