'use client'

import { useEffect } from 'react'
import { useTina } from 'tinacms/dist/react'

type TinaPayload = Record<string, unknown>

function describePayload(payload: TinaPayload) {
  const connection = Object.values(payload).find((value) => value && typeof value === 'object' && 'edges' in value) as { edges?: unknown[] } | undefined
  return {
    keys: Object.keys(payload),
    recordCount: connection?.edges?.length ?? 0,
    records: connection?.edges?.map((edge) => {
      const node = (edge as { node?: Record<string, unknown> })?.node
      return node ? { id: node.id, title: node.title, category: node.category, image: node.image } : edge
    }) ?? [],
  }
}

export function useTinaContent<T extends TinaPayload>(query: string, variables: Record<string, unknown>, fallback: T) {
  const result = useTina({ query, variables, data: fallback })
  const data = result.data as T

  useEffect(() => {
    console.log('[v0] TinaCMS response', describePayload(data))
    if (describePayload(data).recordCount === 0) {
      console.warn('[v0] TinaCMS returned no records; the page is using its fallback content.', { query, variables })
    }
  }, [data, query, variables])

  return data
}
