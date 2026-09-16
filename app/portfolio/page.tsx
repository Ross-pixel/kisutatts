'use client'

import { useState } from 'react'
import { SiteHeader } from '@/components/site-header'
import { portfolio } from '../data'
import { useLanguage } from '@/components/language-provider'
import { useTinaContent } from '@/components/tina-content'
import { PortfolioConnectionDocument } from '@/tina/__generated__/types'

export default function PortfolioPage() {
  const { language } = useLanguage()
  const [filter, setFilter] = useState('All')
  const cms = useTinaContent<any>(PortfolioConnectionDocument, { first: 100 }, { portfolioConnection: { edges: [] } })
  const cmsItems = cms.portfolioConnection?.edges?.map((edge: any) => [edge.node.title, edge.node.category ?? 'Custom', edge.node.category?.toLowerCase().replace(/[^a-z]/g, '') ?? 'custom', edge.node.image] as const) ?? []
  const allItems = cmsItems.length ? cmsItems : portfolio
  const visible = filter === 'All' ? allItems : allItems.filter((item: any) => item[1] === filter || (filter === 'Healed' && item[1] === 'On Skin'))
  const filters = language === 'fi' ? ['Kaikki', 'Flora', 'B&W', 'Color', 'Iholla', 'ALT'] : ['All', 'Flora', 'B&W', 'Color', 'On Skin', 'ALT']

  return <main className="site-shell"><SiteHeader /><section className="section portfolio-page">
    <div className="section-label">✦ {language === 'fi' ? 'Portfolio / kaikki työt' : 'Portfolio / all work'}</div>
    <h1 className="page-title">{language === 'fi' ? <>Kaikki pienet<br /><span>taikapalat.</span></> : <>All the little<br /><span>magic.</span></>}</h1>
    <div className="filter-row">{filters.map((label, index) => <button key={label} onClick={() => setFilter(index === 0 ? 'All' : label === 'Iholla' ? 'Healed' : label === 'On Skin' ? 'Healed' : label)}>{label}</button>)}</div>
    <div className="portfolio-grid portfolio-all">{visible.map((item: any) => <div className={`portfolio-card ${item[2]}`} key={item[0]}><span className="art-shape" /><span className="art-label"><b>{item[0]}</b><small>{item[1]}</small></span></div>)}</div>
  </section></main>
}
