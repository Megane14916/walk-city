export const paths = {
  root: '/',
  login: '/login',
  ranking: '/ranking',
  userPattern: '/users/:userId',
  user: (userId: string) => `/users/${encodeURIComponent(userId)}`,
} as const
