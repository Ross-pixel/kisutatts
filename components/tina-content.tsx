'use client'

import { useEffect } from 'react'
import { useTina } from 'tinacms/dist/react'
import client from '@/tina/__generated__/client'

const TINA_BRANCH = 'main'
const TINA_CLIENT_ID = process.env.NEXT_PUBLIC_TINA_CLIENT_ID ?? '(missing)'

function logTinaPayload(label: string, payload: unknown) {
  console.log(`[v0] TinaCMS ${label}`, payload)
}

async function diagnosePortfolioQuery() {
  try {
    const response = await (client as any).queries.portfolioConnection({}, { branch: TINA_BRANCH })
    logTinaPayload('raw portfolio response', {
      branch: TINA_BRANCH,
      clientId: TINA_CLIENT_ID,
      response,
      errors: response?.errors ?? null,
    })
  } catch (error) {
    console.error('[v0] TinaCMS portfolio request failed', {
      branch: TINA_BRANCH,
      clientId: TINA_CLIENT_ID,
      error,
    })
  }
}


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
    const summary = describePayload(data)
    logTinaPayload('useTina data before fallback mapping', {
      branch: TINA_BRANCH,
      clientId: TINA_CLIENT_ID,
      query,
      variables,
      summary,
      fullData: data,
    })
    if (summary.recordCount === 0) {
      console.warn('[v0] TinaCMS returned no records; the page is using its fallback content.', { query, variables, branch: TINA_BRANCH })
    }
  }, [data, query, variables])

  useEffect(() => {
    void diagnosePortfolioQuery()
  }, [])

  return data
}
