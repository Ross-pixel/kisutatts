import { NextResponse } from 'next/server'
import { getSupabasePublicConfig } from '@/lib/supabase/config'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { supabaseUrl, publishableKey } = getSupabasePublicConfig()

    const now = new Date().toISOString()
    const params = new URLSearchParams({
      select: 'id,starts_at,ends_at',
      status: 'eq.available',
      starts_at: `gt.${now}`,
      order: 'starts_at.asc',
    })

    const response = await fetch(
      `${supabaseUrl}/rest/v1/booking_slots?${params.toString()}`,
      {
        headers: {
          apikey: publishableKey,
          Authorization: `Bearer ${publishableKey}`,
        },
        cache: 'no-store',
      },
    )

    if (!response.ok) {
      const detail = await response.text()
      console.error('Supabase booking slots error:', response.status, detail)
      return NextResponse.json(
        { error: 'Unable to load booking slots' },
        { status: 502 },
      )
    }

    const slots = await response.json()

    return NextResponse.json(slots, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error) {
    console.error('Booking slots API error:', error)
    return NextResponse.json(
      { error: 'Booking service is not configured' },
      { status: 500 },
    )
  }
}
