'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

type LightboxImageProps = {
  src: string
  alt: string
  className?: string
}

export function LightboxImage({ src, alt, className = '' }: LightboxImageProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [open])

  return <>
    <button type="button" className={`lightbox-trigger ${className}`} onClick={() => setOpen(true)} aria-label={`Open ${alt}`}>
      <img src={src} alt={alt} />
    </button>
    {open && <div className="lightbox" role="dialog" aria-modal="true" aria-label={alt} onClick={() => setOpen(false)}>
      <button type="button" className="lightbox-close" onClick={() => setOpen(false)} aria-label="Close image"><X size={24} /></button>
      <img className="lightbox-image" src={src} alt={alt} onClick={(event) => event.stopPropagation()} />
    </div>}
  </>
}
