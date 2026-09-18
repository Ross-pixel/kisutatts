import { NextResponse } from 'next/server'
import { getSupabaseServerConfig } from '@/lib/supabase/config'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const slotId = clean(body?.slotId)
    const name = clean(body?.name)
    const contact = clean(body?.contact)
    const idea = clean(body?.idea)
    const budget = clean(body?.budget)

    if (!UUID_RE.test(slotId)) {
      return NextResponse.json({ error: 'Please choose a valid booking slot.' }, { status: 400 })
    }

    if (!name || name.length > 100) {
      return NextResponse.json({ error: 'Please enter your name.' }, { status: 400 })
    }

    if (!contact || contact.length > 200) {
      return NextResponse.json({ error: 'Please enter a contact or social media username.' }, { status: 400 })
    }

    if (!idea || idea.length > 5000) {
      return NextResponse.json({ error: 'Please describe your tattoo idea.' }, { status: 400 })
    }

    if (budget.length > 200) {
      return NextResponse.json({ error: 'Budget is too long.' }, { status: 400 })
    }

    const { supabaseUrl, secretKey } = getSupabaseServerConfig()

    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/create_booking_request`, {
      method: 'POST',
      headers: {
        apikey: secretKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_slot_id: slotId,
        p_name: name,
        p_contact: contact,
        p_idea: idea,
        p_budget: budget || null,
      }),
      cache: 'no-store',
    })

    const raw = await response.text()

    if (!response.ok) {
      let message = raw
      try {
        const parsed = JSON.parse(raw)
        message = parsed?.message ?? raw
      } catch {}

      if (message.includes('SLOT_NOT_AVAILABLE')) {
        return NextResponse.json(
          { error: 'That time was just taken. Please choose another available slot.' },
          { status: 409 },
        )
      }

      console.error('Supabase booking request error:', response.status, raw)
      return NextResponse.json({ error: 'Unable to send booking request.' }, { status: 502 })
    }

    let requestId = raw.replace(/^"|"$/g, '')
    try {
      const parsed = JSON.parse(raw)
      if (typeof parsed === 'string') requestId = parsed
    } catch {}

    return NextResponse.json({ ok: true, requestId }, { status: 201 })
  } catch (error) {
    console.error('Booking request API error:', error)
    return NextResponse.json({ error: 'Unable to send booking request.' }, { status: 500 })
  }
}
