'use client'

import { ArrowUpRight } from 'lucide-react'
import { tinaField } from 'tinacms/dist/react'
import { SiteHeader } from '@/components/site-header'
import { LightboxImage } from '@/components/lightbox-image'
import { useLanguage } from '@/components/language-provider'
import { copy, flash, fiFlash, instagram, portfolio, prices } from './data'
import { useTinaContent } from '@/components/tina-content'
import { PortfolioConnectionDocument, OnSkinWorksConnectionDocument, SiteContentDocument } from '@/tina/__generated__/types'

const Card = ({ item }: { item: any }) => <div className={`portfolio-card ${item[2]}`}>{item[3] ? <LightboxImage className="portfolio-image" src={item[3]} alt={item[0]} /> : <span className="art-shape" />}<span className="art-label"><b>{item[0]}</b><small>{item[1]}</small></span></div>
const Deco = ({ children, className = '' }: { children: string; className?: string }) => <span className={`mood-deco ${className}`} aria-hidden="true">{children}</span>
const Constellation = ({ area }: { area: string }) => <div className={`deco-constellation deco-${area}`} aria-hidden="true"><i>♡</i><i>✦</i><i>✧</i></div>

export default function Page() {
  const { language } = useLanguage()
  const c = copy[language]
  const siteCms = useTinaContent<any>(
    SiteContentDocument,
    { relativePath: 'content.json' },
    {
      siteContent: {
        heroTitle: 'Eva',
        heroKickerEn: 'Tattoo artist in Tampere',
        heroKickerFi: 'Tatuoija Tampereella',
        heroLeadEn: 'Colours, lines & shadows.',
        heroLeadFi: 'Värit, viivat & varjot.',
        location: 'tampere, finland',
        heroImage: '/uploads/eva-photo-2.jpg',
        aboutTitleEn: c.aboutTitle,
        aboutTitleFi: c.aboutTitle,
        aboutTextEn: c.aboutText,
        aboutTextFi: c.aboutText,
        aboutImage: '/uploads/eva-photo.jpg',
        onSkinTitleEn: c.onSkinTitle,
        onSkinTitleFi: c.onSkinTitle,
        onSkinTextEn: c.onSkinText,
        onSkinTextFi: c.onSkinText,
        priceIntroEn: c.priceIntro,
        priceIntroFi: c.priceIntro,
        contactTextEn: c.contactText,
        contactTextFi: c.contactText,
      },
    },
  )
  const site = siteCms.siteContent || {}
  const siteField = (en: string, fi: string, fallback: string) => language === 'fi' ? (site[fi] || fallback) : (site[en] || fallback)

  const cms = useTinaContent<any>(PortfolioConnectionDocument, { first: 100 }, { portfolioConnection: { edges: [] } })
  const onSkinCms = useTinaContent<any>(OnSkinWorksConnectionDocument, { first: 100 }, { onSkinWorksConnection: { edges: [] } })
  const cmsEdges = cms.portfolioConnection?.edges ?? []
  const cmsItems = cmsEdges.map((edge: any) => [edge.node.title, edge.node.category ?? 'Custom', edge.node.category?.toLowerCase().replace(/[^a-z]/g, '') ?? 'custom', edge.node.onSkin || edge.node.image || edge.node.sketch, edge.node.featured === true] as const) ?? []
  const featuredItems = cmsItems.filter((item: any) => item[4])
  const homepagePortfolio = featuredItems.length ? featuredItems : cmsItems.length ? cmsItems : portfolio
  const onSkinWorks = onSkinCms.onSkinWorksConnection?.edges?.map((edge: any) => edge.node).filter(Boolean) ?? []
  const rows = language === 'fi' ? fiFlash : flash
  const previewWorks = onSkinWorks.length ? onSkinWorks.slice(0, 3) : [1, 2, 3].map((i) => ({ title: String(i), image: null }))

  const heroKicker = siteField('heroKickerEn', 'heroKickerFi', language === 'fi' ? 'Tatuoija Tampereella' : 'Tattoo artist in Tampere')
  const heroLead = siteField('heroLeadEn', 'heroLeadFi', language === 'fi' ? 'Värit, viivat & varjot.' : 'Colours, lines & shadows.')
  const aboutTitle = siteField('aboutTitleEn', 'aboutTitleFi', c.aboutTitle)
  const aboutText = siteField('aboutTextEn', 'aboutTextFi', c.aboutText)
  const onSkinTitle = siteField('onSkinTitleEn', 'onSkinTitleFi', c.onSkinTitle)
  const onSkinText = siteField('onSkinTextEn', 'onSkinTextFi', c.onSkinText)
  const priceIntro = siteField('priceIntroEn', 'priceIntroFi', c.priceIntro)
  const contactText = siteField('contactTextEn', 'contactTextFi', c.contactText)

  return <main className="site-shell"><SiteHeader />
    <section className="hero grid grid-cols-1 lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto px-4 sm:px-6 lg:px-8"><Deco className="deco-hero">✦</Deco><Constellation area="hero-extra" /><div className="hero-copy"><p className="kicker" data-tina-field={tinaField(site, language === 'fi' ? 'heroKickerFi' : 'heroKickerEn')}>✦ {heroKicker}</p><h1 data-tina-field={tinaField(site, 'heroTitle')}>{site.heroTitle || 'Eva'}<span className="dot">.</span></h1><p className="hero-lead" data-tina-field={tinaField(site, language === 'fi' ? 'heroLeadFi' : 'heroLeadEn')}>{heroLead}<br /><em>Fin / Eng / Rus</em></p><div className="hero-actions"><a className="primary-button" href="/booking">{c.book} <ArrowUpRight size={16} /></a><a className="instagram-link" href={instagram} target="_blank" rel="noreferrer"><span aria-hidden="true">♡</span> @kisu.tatts</a></div></div><div className="avatar-card" data-tina-field={tinaField(site, 'heroImage')}><img className="site-photo hero-photo" src={site.heroImage || '/uploads/eva-photo-2.jpg'} alt="Eva, tattoo artist" /><span className="sticker sticker-one">♡</span><p data-tina-field={tinaField(site, 'location')}>{site.location || 'tampere, finland'}</p></div></section>
    <section className="section max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 about-section" id="about"><Deco className="deco-about">♡</Deco><Constellation area="about-extra" /><div className="section-label">♡ 01 / {c.about}</div><div className="about-grid"><div className="about-photo" data-tina-field={tinaField(site, 'aboutImage')}><img className="site-photo about-photo-image" src={site.aboutImage || '/uploads/eva-photo.jpg'} alt="Eva, tattoo artist" /><span className="site-photo-caption">Eva</span></div><div className="about-text"><h2 data-tina-field={tinaField(site, language === 'fi' ? 'aboutTitleFi' : 'aboutTitleEn')}>{aboutTitle}</h2><p className="body-copy" data-tina-field={tinaField(site, language === 'fi' ? 'aboutTextFi' : 'aboutTextEn')}>{aboutText}</p><p className="signature">Eva ♡</p></div></div></section>
    <section className="section max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 portfolio-section"><Deco className="deco-portfolio">✧</Deco><Constellation area="portfolio-extra" /><div className="section-label">✦ 02 / {c.portfolio}</div><div className="section-head"><h2>Little pieces<br /><span>of magic.</span></h2><p>Every piece is drawn with care.<br /><a className="inline-instagram" href={instagram} target="_blank" rel="noreferrer">More work on Instagram <ArrowUpRight size={14} /></a></p></div><div className="portfolio-grid">{homepagePortfolio.slice(0, 3).map((item: any) => <Card key={item[0]} item={item} />)}</div><a className="text-link" href="/portfolio">View all portfolio <ArrowUpRight size={15} /></a></section>
    <section className="section max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 healed-section"><Deco className="deco-onskin">♡</Deco><Constellation area="onskin-extra" /><div className="section-label">♡ 03 / {onSkinTitle}</div><div className="healed-head"><h2 data-tina-field={tinaField(site, language === 'fi' ? 'onSkinTitleFi' : 'onSkinTitleEn')}>{onSkinTitle}</h2><p data-tina-field={tinaField(site, language === 'fi' ? 'onSkinTextFi' : 'onSkinTextEn')}>{onSkinText}</p></div><div className="healed-grid">{previewWorks.map((item: any, index: number) => <div className="healed-card" style={{ position: 'relative' }} key={item.id ?? item.title ?? index}>{item.image ? <LightboxImage className="portfolio-image" src={item.image} alt={item.title ?? onSkinTitle} /> : <span>♡</span>}<small>{item.image ? item.title : c.onSkinPlaceholder}</small></div>)}</div><a className="text-link" href="/on-skin">{language === 'fi' ? 'Katso kaikki iholla' : 'View all on skin'} <ArrowUpRight size={15} /></a></section>
    <section className="section max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pricing-section"><Deco className="deco-flash">✦</Deco><Constellation area="flash-extra" /><div className="section-label">✦ 04 / {c.pricing}</div><p className="page-intro" data-tina-field={tinaField(site, language === 'fi' ? 'priceIntroFi' : 'priceIntroEn')}>{priceIntro}</p><div className="flash-list">{rows.slice(0, 3).map((row, index) => <div className="flash-row" key={row[0]}><strong>{prices[index]}</strong><span><b>{row[0]}</b><small>{row[1]}</small></span><i>+</i></div>)}</div><a className="text-link" href="/flash">{language === 'fi' ? 'Katso kaikki flash-модели' : 'View all flash designs'} <ArrowUpRight size={16} /></a></section>
    <section className="section max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 contact-section"><Deco className="deco-contact">♡</Deco><Constellation area="contact-extra" /><div className="section-label">♡ 05 / {c.contact}</div><h2 data-tina-field={tinaField(site, language === 'fi' ? 'contactTextFi' : 'contactTextEn')}>{contactText}</h2><div className="contact-actions"><a className="primary-button" href="/booking">{c.book} <ArrowUpRight size={16} /></a><a className="instagram-link" href={instagram} target="_blank" rel="noreferrer"><span aria-hidden="true">♡</span> Instagram · @kisu.tatts</a></div></section>
  </main>
}
