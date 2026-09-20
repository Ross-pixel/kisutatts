'use client'

import { ArrowLeft } from 'lucide-react'
import { useParams } from 'next/navigation'
import { tinaField } from 'tinacms/dist/react'
import { SiteHeader } from '@/components/site-header'
import { LightboxImage } from '@/components/lightbox-image'
import { useLanguage } from '@/components/language-provider'
import { useTinaContent } from '@/components/tina-content'
import { FlashDesignsDocument } from '@/tina/__generated__/types'

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

export default function FlashVisualEditorPage() {
  const params = useParams<{ slug: string }>()
  const slug = decodeURIComponent(params?.slug || '')
  const { language } = useLanguage()
  const cms = useTinaContent<any>(
    FlashDesignsDocument,
    { relativePath: `${slug}.mdx` },
    { flashDesigns: { title: slug || 'Flash', price: '', category: 'Flash', image: null, description: null } },
  )
  const item = cms.flashDesigns || {}
  const imageSrc = normalizeImageSrc(item.image)
  const description = richTextToPlainText(item.description)

  return <main className="site-shell">
    <SiteHeader />
    <div className="page-wrap max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <a className="back-link" href="/flash"><ArrowLeft size={15} /> {language === 'fi' ? 'Takaisin flash-galleriaan' : 'Back to flash gallery'}</a>
      <div className="section-label">✦ Tina Visual Editing</div>
      <h1 className="page-title" data-tina-field={tinaField(item, 'title')}>{item.title || slug}</h1>
      <p className="page-intro" data-tina-field={tinaField(item, 'description')}>
        {description || (language === 'fi' ? 'Klikkaa tästä lisätäksesi kuvauksen.' : 'Click here to add a description.')}
      </p>

      <div className="portfolio-case">
        <div className="portfolio-case-header">
          <div>
            <span className="portfolio-case-category" data-tina-field={tinaField(item, 'category')}>{item.category || 'Flash'}</span>
            <h2 data-tina-field={tinaField(item, 'price')}>{item.price || (language === 'fi' ? 'Lisää hinta' : 'Add price')}</h2>
          </div>
        </div>
        <div className="portfolio-case-grid single">
          <div className="portfolio-case-media" data-tina-field={tinaField(item, 'image')}>
            {imageSrc ? <LightboxImage className="portfolio-case-image" src={imageSrc} alt={item.title || 'Flash design'} /> : <div className="portfolio-case-empty">＋ {language === 'fi' ? 'Lisää kuva' : 'Add image'}</div>}
            <span>{language === 'fi' ? 'Flash-kuva' : 'Flash image'}</span>
          </div>
        </div>
      </div>
    </div>
  </main>
}
