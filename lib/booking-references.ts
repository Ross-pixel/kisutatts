export const BOOKING_REFERENCE_BUCKET = 'booking-references'
export const MAX_REFERENCE_FILES = 5
export const MAX_REFERENCE_FILE_SIZE = 10 * 1024 * 1024

export const REFERENCE_MIME_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
} as const

export type ReferenceMime = keyof typeof REFERENCE_MIME_EXTENSIONS

const EXTENSION_MIME: Record<string, ReferenceMime> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
}

export function normalizeReferenceMime(filename: string, mime: string): ReferenceMime | null {
  const normalizedMime = mime.trim().toLowerCase()
  if (normalizedMime in REFERENCE_MIME_EXTENSIONS) {
    return normalizedMime as ReferenceMime
  }

  const extension = filename.split('.').pop()?.toLowerCase() ?? ''
  return EXTENSION_MIME[extension] ?? null
}
