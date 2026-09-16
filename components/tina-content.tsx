'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTina } from 'tinacms/dist/react'
import client from '@/tina/__generated__/client'

type TinaPayload = Record<string, unknown>
type TinaResponse = { data?: TinaPayload; errors?: unknown[] }

function getRecordCount(payload: TinaPayload) {
  const connection = Object.values(payload).find((value) => value && typeof value === 'object' && 'edges' in value) as { edges?: unknown[]; totalCount?: number } | undefined
  return connection?.totalCount ?? connection?.edges?.length ?? 0
}

export function useTinaContent<T extends TinaPayload>(query: string, variables: Record<string, unknown>, fallback: T) {
  const [fetched, setFetched] = useState<T | null>(null)
  const [requestError, setRequestError] = useState<unknown>(null)
  const logged = useRef(false)
  const stableVariables = useMemo(() => variables, [JSON.stringify(variables)])

  useEffect(() => {
    let active = true
    const branchUrl = `${client.apiUrl.substring(0, client.apiUrl.lastIndexOf('/') + 1)}main`
    void client.request({ query, variables: stableVariables, url: branchUrl }, {})
      .then((response) => {
        if (!active) return
        const data = (response.data ?? {}) as T
        setFetched(data)
        if (!logged.current) {
          logged.current = true
          console.log('[TinaCMS Check]', {
            branch: 'main',
            recordCount: getRecordCount(data),
            url: client.apiUrl,
            errors: response.errors ?? [],
            firstRecord: Object.values(data).find((value) => value && typeof value === 'object' && 'edges' in value),
          })
        }
      })
      .catch((error: unknown) => {
        if (!active) return
        setRequestError(error)
        if (!logged.current) {
          logged.current = true
          console.log('[TinaCMS Check]', { branch: 'main', recordCount: 0, url: client.apiUrl, errors: [error] })
        }
      })
    return () => { active = false }
  }, [query, stableVariables])

  const initial = fetched ?? fallback
  const result = useTina({ query, variables: stableVariables, data: initial })
  if (requestError && !fetched) return fallback
  return result.data as T
}
