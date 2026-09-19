import { NextResponse } from 'next/server'
import { getTelegramAdminFromRequest } from '@/lib/telegram-admin'
import { getSupabaseServerConfig } from '@/lib/supabase/config'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

async function runRpc(name: string, payload: Record<string, unknown>) {
  const { supabaseUrl, secretKey } = getSupabaseServerConfig()
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: secretKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })
  const raw = await response.text()
  return { response, raw }
}

export async function POST(request: Request) {
  if (!getTelegramAdminFromRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const action = clean(body?.action)
    const date = clean(body?.date)

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Invalid date.' }, { status: 400 })
    }

    if (action === 'save') {
      const name = clean(body?.name)
      if (!name || name.length > 100) {
        return NextResponse.json({ error: 'Give the template a short name.' }, { status: 400 })
      }

      const { response, raw } = await runRpc('save_booking_day_template', {
        p_name: name,
        p_date: date,
      })

      if (!response.ok) {
        let message = raw
        try { message = JSON.parse(raw)?.message ?? raw } catch {}
        if (message.includes('TEMPLATE_EMPTY')) {
          return NextResponse.json({ error: 'This day has no Available or Blocked windows to save.' }, { status: 409 })
        }
        if (message.includes('TEMPLATE_NAME_EXISTS')) {
          return NextResponse.json({ error: 'A template with this name already exists.' }, { status: 409 })
        }
        console.error('Save booking day template error:', response.status, raw)
        return NextResponse.json({ error: 'Unable to save day template.' }, { status: 502 })
      }

      return NextResponse.json({ ok: true, templateId: JSON.parse(raw) })
    }

    if (action === 'apply') {
      const templateId = clean(body?.templateId)
      if (!UUID_RE.test(templateId)) {
        return NextResponse.json({ error: 'Choose a template first.' }, { status: 400 })
      }

      const { response, raw } = await runRpc('apply_booking_day_template', {
        p_template_id: templateId,
        p_date: date,
      })

      if (!response.ok) {
        let message = raw
        try { message = JSON.parse(raw)?.message ?? raw } catch {}
        if (message.includes('TEMPLATE_CONFLICT')) {
          return NextResponse.json({ error: 'This template overlaps existing calendar windows on that day.' }, { status: 409 })
        }
        if (message.includes('PAST_DATE')) {
          return NextResponse.json({ error: 'Templates can only be applied to today or a future date.' }, { status: 409 })
        }
        if (message.includes('TEMPLATE_NOT_FOUND')) {
          return NextResponse.json({ error: 'Template not found.' }, { status: 404 })
        }
        console.error('Apply booking day template error:', response.status, raw)
        return NextResponse.json({ error: 'Unable to apply day template.' }, { status: 502 })
      }

      return NextResponse.json({ ok: true, created: JSON.parse(raw) })
    }

    return NextResponse.json({ error: 'Invalid template action.' }, { status: 400 })
  } catch (error) {
    console.error('Booking template API error:', error)
    return NextResponse.json({ error: 'Unable to update day templates.' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  if (!getTelegramAdminFromRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const id = clean(new URL(request.url).searchParams.get('id'))
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid template.' }, { status: 400 })
    }

    const { supabaseUrl, secretKey } = getSupabaseServerConfig()
    const response = await fetch(`${supabaseUrl}/rest/v1/booking_day_templates?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        apikey: secretKey,
        Prefer: 'return=representation',
      },
      cache: 'no-store',
    })
    const raw = await response.text()

    if (!response.ok) {
      console.error('Delete booking day template error:', response.status, raw)
      return NextResponse.json({ error: 'Unable to delete template.' }, { status: 502 })
    }

    const rows = raw ? JSON.parse(raw) : []
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Template not found.' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete booking day template API error:', error)
    return NextResponse.json({ error: 'Unable to delete template.' }, { status: 500 })
  }
}
