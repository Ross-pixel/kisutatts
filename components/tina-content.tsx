'use client'

import { useTina } from 'tinacms/dist/react'

type TinaPayload = Record<string, unknown>

export function useTinaContent<T extends TinaPayload>(query: string, variables: Record<string, unknown>, fallback: T) {
  const result = useTina({ query, variables, data: fallback })
  return result.data as T
}
