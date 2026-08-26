export const paths = {
  root: '/',
  login: '/login',
  healthConnect: '/health/connect',
  ranking: '/ranking',
  userPattern: '/users/:userId',
  user: (userId: string) => `/users/${encodeURIComponent(userId)}`,
} as const
