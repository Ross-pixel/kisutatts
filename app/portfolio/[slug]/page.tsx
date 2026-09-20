'use client'

import { ArrowLeft } from 'lucide-react'
import { useParams } from 'next/navigation'
import { tinaField } from 'tinacms/dist/react'
import { SiteHeader } from '@/components/site-header'
import { LightboxImage } from '@/components/lightbox-image'
import { useLanguage } from '@/components/language-provider'
import { useTinaContent } from '@/components/tina-content'
import { PortfolioDocument } from '@/tina/__generated__/types'

function normalizeImageSrc(src: unknown) {
  if (typeof src !== 'string' || !src) return null
  return src.startsWith('/') || src.startsWith('http://') || src.startsWith('https://') ? src : `/${src}`
}

function richTextToPlainText(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(richTextToPlainText).filter(Boolean).join(' ')
  if (value && typeof value === 'object') {
    const node = value as { text?: unknown; children?: unknown }
    if (typeof node.text === 'string') return node.text
    if (node.children) return richTextToPlainText(node.children)
  }
  return ''
}

function EditableImage({ item, field, label }: { item: any; field: 'sketch' | 'onSkin' | 'healed' | 'image'; label: string }) {
  const src = normalizeImageSrc(item?.[field])
  if (!src) {
    return <div className="portfolio-case-media" data-tina-field={tinaField(item, field)}><div className="portfolio-case-empty">＋ {label}</div><span>{label}</span></div>
  }
  return <div className="portfolio-case-media" data-tina-field={tinaField(item, field)}>
    <LightboxImage className="portfolio-case-image" src={src} alt={`${item.title || 'Portfolio'} ${label}`} />
    <span>{label}</span>
  </div>
}

export default function PortfolioVisualEditorPage() {
  const params = useParams<{ slug: string }>()
  const slug = decodeURIComponent(params?.slug || '')
  const { language } = useLanguage()
  const cms = useTinaContent<any>(
    PortfolioDocument,
    { relativePath: `${slug}.mdx` },
    { portfolio: { title: slug || 'Portfolio', category: 'Custom', description: null, sketch: null, onSkin: null, healed: null, featured: false, image: null } },
  )
  const item = cms.portfolio || {}
  const description = richTextToPlainText(item.description)

  return <main className="site-shell">
    <SiteHeader />
    <section className="section portfolio-page max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <a className="back-link" href="/portfolio"><ArrowLeft size={15} /> {language === 'fi' ? 'Takaisin portfolioon' : 'Back to portfolio'}</a>
      <div className="section-label">✦ Tina Visual Editing</div>
      <article className="portfolio-case">
        <div className="portfolio-case-header">
          <div>
            <h1 className="page-title" data-tina-field={tinaField(item, 'title')}>{item.title || slug}</h1>
            <span className="portfolio-case-category" data-tina-field={tinaField(item, 'category')}>{item.category || 'Custom'}</span>
          </div>
          <span className="portfolio-featured" data-tina-field={tinaField(item, 'featured')}>{item.featured ? '♡ Featured' : '☆ Not featured'}</span>
        </div>

        <p className="portfolio-case-description" data-tina-field={tinaField(item, 'description')}>
          {description || (language === 'fi' ? 'Klikkaa tästä lisätäksesi työn tarinan.' : 'Click here to add the story of this work.')}
        </p>

        <div className="portfolio-case-grid">
          <EditableImage item={item} field="sketch" label={language === 'fi' ? 'Luonnos' : 'Sketch'} />
          <EditableImage item={item} field={item.onSkin ? 'onSkin' : 'image'} label={language === 'fi' ? 'Iholla' : 'On skin'} />
          <EditableImage item={item} field="healed" label={language === 'fi' ? 'Parantunut' : 'Healed'} />
        </div>
      </article>
    </section>
  </main>
}
