export type SupabaseClientEnvironment = {
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_PUBLISHABLE_KEY?: string
  VITE_SUPABASE_ANON_KEY?: string
}

export type SupabaseClientConfig = {
  url: string
  publishableKey: string
}

export function getSupabaseClientConfig(
  environment: SupabaseClientEnvironment,
): SupabaseClientConfig {
  const url = environment.VITE_SUPABASE_URL?.trim()
  const publishableKey =
    environment.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    environment.VITE_SUPABASE_ANON_KEY?.trim()

  if (!url) {
    throw new Error(
      'supabaseモードではVITE_SUPABASE_URLの設定が必要です。',
    )
  }
  if (!publishableKey) {
    throw new Error(
      'supabaseモードではVITE_SUPABASE_PUBLISHABLE_KEYまたはVITE_SUPABASE_ANON_KEYの設定が必要です。',
    )
  }

  return { url, publishableKey }
}
