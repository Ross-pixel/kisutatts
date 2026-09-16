'use client'
import { useState } from 'react'
import { SiteHeader } from '@/components/site-header'
import { portfolio } from '../data'
import { useLanguage } from '@/components/language-provider'
export default function PortfolioPage(){const { t } = useLanguage(); const [filter,setFilter]=useState('All');const visible=filter==='All'?portfolio:portfolio.filter(item=>item[0]===filter);return <main className="site-shell"><SiteHeader/><section className="section portfolio-page"><div className="section-label">✦ Portfolio / kaikki työt</div><h1 className="page-title">All the little<br/><span>magic.</span></h1><div className="filter-row"><button onClick={()=>setFilter('All')}>All</button>{['Flora','B&W','Color','Healed','ALT'].map(x=><button key={x} onClick={()=>setFilter(x)}>{x}</button>)}</div><div className="portfolio-grid portfolio-all">{visible.map(item=><div className={`portfolio-card ${item[2]}`} key={item[0]}><span className="art-shape"/><span className="art-label"><b>{item[0]}</b><small>{item[1]}</small></span></div>)}</div></section></main>}
