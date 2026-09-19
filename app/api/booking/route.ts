import { createHmac } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getSupabaseServerConfig } from '@/lib/supabase/config'
import { sendBookingTelegramNotification } from '@/lib/telegram'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function getClientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || request.headers.get('x-real-ip')?.trim() || request.headers.get('cf-connecting-ip')?.trim() || ''
}

async function consumeRateLimit(supabaseUrl: string, secretKey: string, ip: string) {
  if (!ip) return true

  const keyHash = createHmac('sha256', secretKey)
    .update(`booking:${ip}`)
    .digest('hex')

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/consume_booking_rate_limit`, {
    method: 'POST',
    headers: {
      apikey: secretKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_key_hash: keyHash,
      p_limit: 6,
      p_window_minutes: 60,
    }),
    cache: 'no-store',
  })

  if (!response.ok) {
    console.error('Booking rate limit error:', response.status, await response.text())
    throw new Error('RATE_LIMIT_UNAVAILABLE')
  }

  return await response.json() === true
}

async function verifyTurnstile(token: string, ip: string) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || ''
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim() || ''

  if (!siteKey && !secret) return { enabled: false, success: true }

  if (!siteKey || !secret) {
    console.error('Turnstile is partially configured. Both site key and secret key are required.')
    return { enabled: true, success: false, configurationError: true }
  }

  if (!token || token.length > 2048) {
    return { enabled: true, success: false }
  }

  const form = new URLSearchParams({
    secret,
    response: token,
  })
  if (ip) form.set('remoteip', ip)

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      signal: AbortSignal.timeout(8_000),
      cache: 'no-store',
    })

    if (!response.ok) {
      console.error('Turnstile verification HTTP error:', response.status)
      return { enabled: true, success: false }
    }

    const result = await response.json() as { success?: boolean; 'error-codes'?: string[] }
    if (result.success !== true) {
      console.warn('Turnstile verification rejected:', result['error-codes'] || [])
      return { enabled: true, success: false }
    }

    return { enabled: true, success: true }
  } catch (error) {
    console.error('Turnstile verification error:', error)
    return { enabled: true, success: false }
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const slotId = clean(body?.slotId)
    const name = clean(body?.name)
    const contact = clean(body?.contact)
    const idea = clean(body?.idea)
    const budget = clean(body?.budget)
    const turnstileToken = clean(body?.turnstileToken)
    const privacyAccepted = body?.privacyAccepted === true

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

    if (!privacyAccepted) {
      return NextResponse.json({ error: 'Please accept the booking privacy notice.' }, { status: 400 })
    }

    const { supabaseUrl, secretKey } = getSupabaseServerConfig()
    const clientIp = getClientIp(request)

    const rateAllowed = await consumeRateLimit(supabaseUrl, secretKey, clientIp)
    if (!rateAllowed) {
      return NextResponse.json(
        { error: 'Too many booking attempts. Please wait a while and try again.' },
        { status: 429 },
      )
    }

    const turnstile = await verifyTurnstile(turnstileToken, clientIp)
    if (!turnstile.success) {
      if ('configurationError' in turnstile && turnstile.configurationError) {
        return NextResponse.json({ error: 'Booking verification is temporarily unavailable.' }, { status: 503 })
      }
      return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 403 })
    }

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

    try {
      await sendBookingTelegramNotification(requestId)
    } catch (error) {
      // The database is the source of truth. A Telegram outage or configuration
      // problem must never make a successfully stored booking look unsuccessful.
      console.error('Telegram booking notification error:', error)
    }

    return NextResponse.json({ ok: true, requestId }, { status: 201 })
  } catch (error) {
    console.error('Booking request API error:', error)
    if (error instanceof Error && error.message === 'RATE_LIMIT_UNAVAILABLE') {
      return NextResponse.json({ error: 'Booking is temporarily unavailable. Please try again shortly.' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Unable to send booking request.' }, { status: 500 })
  }
}
