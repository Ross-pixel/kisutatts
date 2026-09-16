'use client'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { useLanguage } from '@/components/language-provider'
import { instagram } from '@/app/data'

export function SiteHeader() {
  const [open, setOpen] = useState(false)
  const { language, setLanguage, t } = useLanguage()
  return <header className="topbar">
    <Link href="/" className="brand">kisu<i>.tatts</i></Link>
    <nav className={open ? 'nav-links open' : 'nav-links'}>
      <Link href="/" onClick={() => setOpen(false)}>{t.nav.home}</Link>
      <Link href="/portfolio" onClick={() => setOpen(false)}>{t.nav.portfolio}</Link>
      <Link href="/flash" onClick={() => setOpen(false)}>{t.nav.flash}</Link>
      <Link href="/on-skin" onClick={() => setOpen(false)}>{t.nav.onSkin}</Link>
      <Link href="/faq" onClick={() => setOpen(false)}>{t.nav.faq}</Link>
      <a href={instagram} target="_blank" rel="noreferrer">{t.nav.dm}</a>
    </nav>
    <div className="header-actions">
      <button className="header-link" onClick={() => setLanguage(language === 'en' ? 'fi' : 'en')} aria-label="Switch language">{language.toUpperCase()} / {t.nav.language}</button>
      <button className="menu-button" aria-label="Toggle menu" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
    </div>
  </header>
}
