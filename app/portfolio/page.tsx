'use client'

import { useState } from 'react'
import { SiteHeader } from '@/components/site-header'
import { portfolio } from '../data'
import { useLanguage } from '@/components/language-provider'

export default function PortfolioPage() {
  const { language } = useLanguage()
  const [filter, setFilter] = useState('All')
  const visible = filter === 'All' ? portfolio : portfolio.filter((item) => item[0] === filter)
  const filters = language === 'fi' ? ['Kaikki', 'Flora', 'B&W', 'Color', 'Iholla', 'ALT'] : ['All', 'Flora', 'B&W', 'Color', 'On Skin', 'ALT']

  return <main className="site-shell"><SiteHeader /><section className="section portfolio-page">
    <div className="section-label">✦ {language === 'fi' ? 'Portfolio / kaikki työt' : 'Portfolio / all work'}</div>
    <h1 className="page-title">{language === 'fi' ? <>Kaikki pienet<br /><span>taikapalat.</span></> : <>All the little<br /><span>magic.</span></>}</h1>
    <div className="filter-row">{filters.map((label, index) => <button key={label} onClick={() => setFilter(index === 0 ? 'All' : label === 'Iholla' ? 'Healed' : label === 'On Skin' ? 'Healed' : label)}>{label}</button>)}</div>
    <div className="portfolio-grid portfolio-all">{visible.map((item) => <div className={`portfolio-card ${item[2]}`} key={item[0]}><span className="art-shape" /><span className="art-label"><b>{item[0]}</b><small>{item[1]}</small></span></div>)}</div>
  </section></main>
}
