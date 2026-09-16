'use client'

import { useEffect, useRef } from 'react'
import { useTina } from 'tinacms/dist/react'
import client from '@/tina/__generated__/client'

const TINA_BRANCH = 'main'
const TINA_CLIENT_ID = process.env.NEXT_PUBLIC_TINA_CLIENT_ID ?? '(missing)'

type TinaPayload = Record<string, unknown>

function getRecordCount(payload: TinaPayload) {
  const connection = Object.values(payload).find((value) => value && typeof value === 'object' && 'edges' in value) as { edges?: unknown[]; totalCount?: number } | undefined
  return connection?.totalCount ?? connection?.edges?.length ?? 0
}

export function useTinaContent<T extends TinaPayload>(query: string, variables: Record<string, unknown>, fallback: T) {
  const result = useTina({ query, variables, data: fallback })
  const data = result.data as T

  const hasLogged = useRef(false)

  useEffect(() => {
    if (hasLogged.current) return
    hasLogged.current = true
    console.log('[TinaCMS Check]', {
      branch: TINA_BRANCH,
      recordCount: getRecordCount(data),
      url: (client as { url?: string; __url?: string }).url ?? (client as { __url?: string }).__url ?? 'Tina client endpoint configured at build time',
    })
  }, [data])

  return data
}
