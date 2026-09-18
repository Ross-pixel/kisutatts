const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

export function getSupabasePublicConfig() {
  if (!supabaseUrl || !publishableKey) {
    throw new Error('Supabase public environment variables are not configured')
  }

  return { supabaseUrl, publishableKey }
}

export function getSupabaseServerConfig() {
  const secretKey = process.env.SUPABASE_SECRET_KEY

  if (!supabaseUrl || !secretKey) {
    throw new Error('Supabase server environment variables are not configured')
  }

  return { supabaseUrl, secretKey }
}
