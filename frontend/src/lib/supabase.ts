import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  getSupabaseClientConfig,
  type SupabaseClientEnvironment,
} from './supabase-config'

export type { SupabaseClientEnvironment } from './supabase-config'

export function createBrowserSupabaseClient(
  environment: SupabaseClientEnvironment = import.meta.env,
): SupabaseClient {
  const { url, publishableKey } = getSupabaseClientConfig(environment)

  return createClient(url, publishableKey)
}
