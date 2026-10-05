'use client'

import { useEffect } from 'react'

const ADMIN_REFRESH_EVENT = 'kisu-booking-admin-refresh'

function inputUrl(input: RequestInfo | URL) {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit) {
  if (init?.method) return init.method.toUpperCase()
  if (typeof Request !== 'undefined' && input instanceof Request) return input.method.toUpperCase()
  return 'GET'
}

export function BookingAdminBehaviorFixes() {
  useEffect(() => {
    const originalFetch = window.fetch

    const wrappedFetch: typeof window.fetch = async (input, init) => {
      const url = inputUrl(input)
      const method = requestMethod(input, init)
      const response = await originalFetch.call(window, input, init)

      if (response.ok && url.includes('/api/admin/booking/slots') && method === 'POST') {
        // The slot is already safely stored server-side at this point. Refresh the
        // dashboard explicitly so the newly-created window appears immediately.
        window.setTimeout(() => {
          document.querySelector<HTMLButtonElement>('.admin-refresh')?.click()

          // If React kept the editor open after the async submit, close it now.
          if (document.querySelector('.admin-add-slot-form')) {
            document.querySelector<HTMLButtonElement>('.admin-day-add')?.click()
          }
        }, 120)
      }

      if (response.ok && url.includes('/api/admin/booking/requests') && method === 'POST') {
        // BookingAdmin and PrivateNotes are separate client components. Tell the
        // private panel to reload whenever a request changes (cancel, complete,
        // confirm, decline, note, adjust, etc.).
        window.setTimeout(() => {
          window.dispatchEvent(new Event(ADMIN_REFRESH_EVENT))
        }, 120)
      }

      return response
    }

    window.fetch = wrappedFetch

    const handleClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const addButton = target.closest('.admin-day-add')
      if (!addButton) return

      const opening = !document.querySelector('.admin-add-slot-form')
      if (!opening) return

      // The editor is rendered after this click, so wait a moment before looking
      // for it and then bring the whole form into the Telegram viewport.
      window.setTimeout(() => {
        document.querySelector<HTMLElement>('.admin-add-slot-form')?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        })
      }, 80)
    }

    document.addEventListener('click', handleClick)

    return () => {
      document.removeEventListener('click', handleClick)
      if (window.fetch === wrappedFetch) window.fetch = originalFetch
    }
  }, [])

  return null
}

export { ADMIN_REFRESH_EVENT }
