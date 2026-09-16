'use client'

import { ArrowUpRight } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { useLanguage } from '@/components/language-provider'
import { copy, flash, fiFlash, instagram, portfolio, prices } from './data'
import { useTinaContent } from '@/components/tina-content'
import { PortfolioConnectionDocument } from '@/tina/__generated__/types'

const Card = ({ item }: { item: any }) => <div className={`portfolio-card ${item[2]}`}>{item[3] ? <img src={item[3]} alt={item[0]} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : <span className="art-shape" />}<span className="art-label"><b>{item[0]}</b><small>{item[1]}</small></span></div>

export default function Page() {
  const { language } = useLanguage()
  const c = copy[language]
  const cms = useTinaContent<any>(PortfolioConnectionDocument, { first: 3 }, { portfolioConnection: { edges: [] } })
  const cmsItems = cms.portfolioConnection?.edges?.map((edge: any) => [edge.node.title, edge.node.category ?? 'Custom', edge.node.category?.toLowerCase().replace(/[^a-z]/g, '') ?? 'custom', edge.node.image] as const) ?? []
  const featuredPortfolio = cmsItems.length ? cmsItems : portfolio
  const rows = language === 'fi' ? fiFlash : flash
  return <main className="site-shell"><SiteHeader />
    <section className="hero"><div className="hero-copy"><p className="kicker">✦ Tattoo artist in Tampere</p><h1>Eva<span className="dot">.</span></h1><p className="hero-lead">Colours, lines & shadows.<br /><em>Fin / Eng / Rus</em></p><a className="primary-button" href={instagram} target="_blank" rel="noreferrer">{c.book} <ArrowUpRight size={16} /></a></div><div className="avatar-card"><div className="pixel-grid" /><div className="avatar-face"><span className="ear left" /><span className="ear right" /><span className="hair" /><span className="eye one" /><span className="eye two" /><span className="mouth" /></div><span className="sticker sticker-one">♡</span><p>tampere, finland</p></div></section>
    <section className="section about-section" id="about"><div className="section-label">♡ 01 / {c.about}</div><div className="about-grid"><div className="about-photo">♡<small>work in progress</small></div><div className="about-text"><h2>{c.aboutTitle}</h2><p className="body-copy">{c.aboutText}</p><p className="signature">Eva ♡</p></div></div></section>
    <section className="section portfolio-section"><div className="section-label">✦ 02 / {c.portfolio}</div><div className="section-head"><h2>Little pieces<br /><span>of magic.</span></h2><p>Every piece is drawn with care.<br />More work on Instagram ↗</p></div><div className="portfolio-grid">{featuredPortfolio.slice(0, 3).map((item: any) => <Card key={item[0]} item={item} />)}</div><a className="text-link" href="/portfolio">View all portfolio <ArrowUpRight size={15} /></a></section>
    <section className="section healed-section"><div className="section-label">♡ 03 / {c.onSkinTitle}</div><div className="healed-head"><h2>{c.onSkinTitle}</h2><p>{c.onSkinText}</p></div><div className="healed-grid">{[1, 2, 3].map((i) => <div className="healed-card" key={i}><span>♡</span><small>{c.onSkinPlaceholder}</small></div>)}</div><a className="text-link" href="/on-skin">{language === 'fi' ? 'Katso kaikki iholla' : 'View all on skin'} <ArrowUpRight size={15} /></a></section>
    <section className="section pricing-section"><div className="section-label">✦ 04 / {c.pricing}</div><p className="page-intro">{c.priceIntro}</p><div className="flash-list">{rows.slice(0, 3).map((row, index) => <div className="flash-row" key={row[0]}><strong>{prices[index]}</strong><span><b>{row[0]}</b><small>{row[1]}</small></span><i>+</i></div>)}</div><a className="text-link" href="/flash">{language === 'fi' ? 'Katso kaikki flash-mallit' : 'View all flash designs'} <ArrowUpRight size={15} /></a></section>
    <section className="section contact-section"><div className="section-label">♡ 05 / {c.contact}</div><h2>{c.contactText}</h2><a className="primary-button" href={instagram} target="_blank" rel="noreferrer">{c.book} <ArrowUpRight size={16} /></a></section>
  </main>
}
