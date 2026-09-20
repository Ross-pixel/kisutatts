'use client'

import { ArrowLeft } from 'lucide-react'
import { useParams } from 'next/navigation'
import { tinaField } from 'tinacms/dist/react'
import { SiteHeader } from '@/components/site-header'
import { LightboxImage } from '@/components/lightbox-image'
import { useLanguage } from '@/components/language-provider'
import { useTinaContent } from '@/components/tina-content'

const ON_SKIN_QUERY = `
  query OnSkinVisualEdit($relativePath: String!) {
    onSkinWorks(relativePath: $relativePath) {
      title
      category
      image
      description
    }
  }
`

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

export default function OnSkinVisualEditorPage() {
  const params = useParams()
  const rawSlug = params?.slug
  const slug = decodeURIComponent(Array.isArray(rawSlug) ? rawSlug[0] || '' : rawSlug || '')
  const { language } = useLanguage()
  const cms = useTinaContent<any>(
    ON_SKIN_QUERY,
    { relativePath: `${slug}.mdx` },
    { onSkinWorks: { title: slug || 'On skin', category: '', image: null, description: null } },
  )
  const item = cms.onSkinWorks || {}
  const imageSrc = normalizeImageSrc(item.image)
  const description = richTextToPlainText(item.description)

  return <main className="site-shell">
    <SiteHeader />
    <div className="page-wrap max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <a className="back-link" href="/on-skin"><ArrowLeft size={15} /> {language === 'fi' ? 'Takaisin iholla-galleriaan' : 'Back to on-skin gallery'}</a>
      <div className="section-label">♡ Tina Visual Editing</div>
      <h1 className="page-title" data-tina-field={tinaField(item, 'title')}>{item.title || slug}</h1>
      <p className="page-intro" data-tina-field={tinaField(item, 'description')}>
        {description || (language === 'fi' ? 'Klikkaa tästä lisätäksesi kuvauksen.' : 'Click here to add a description.')}
      </p>

      <div className="portfolio-case">
        <span className="portfolio-case-category" data-tina-field={tinaField(item, 'category')}>{item.category || (language === 'fi' ? 'Tatuointi' : 'Tattoo')}</span>
        <div className="portfolio-case-grid single" style={{ marginTop: 18 }}>
          <div className="portfolio-case-media" data-tina-field={tinaField(item, 'image')}>
            {imageSrc ? <LightboxImage className="portfolio-case-image" src={imageSrc} alt={item.title || 'Tattoo on skin'} /> : <div className="portfolio-case-empty">＋ {language === 'fi' ? 'Lisää kuva' : 'Add image'}</div>}
            <span>{language === 'fi' ? 'Tatuointi iholla' : 'Tattoo on skin'}</span>
          </div>
        </div>
      </div>
    </div>
  </main>
}
