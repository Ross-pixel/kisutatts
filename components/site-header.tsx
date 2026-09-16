'use client'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { useLanguage } from '@/components/language-provider'
import { instagram } from '@/app/data'

export function SiteHeader() {
  const [open, setOpen] = useState(false)
  const { language, setLanguage, t } = useLanguage()
  return <header className="topbar">
    <a href="/" className="brand">kisu<i>.tatts</i></a>
    <nav className={open ? 'nav-links open' : 'nav-links'}>
      <a href="/" onClick={() => setOpen(false)}>{t.nav.home}</a>
      <a href="/portfolio" onClick={() => setOpen(false)}>{t.nav.portfolio}</a>
      <a href="/flash" onClick={() => setOpen(false)}>{t.nav.flash}</a>
      <a href="/on-skin" onClick={() => setOpen(false)}>{t.nav.onSkin}</a>
      <a href="/faq" onClick={() => setOpen(false)}>{t.nav.faq}</a>
      <a href={instagram} target="_blank" rel="noreferrer">{t.nav.dm}</a>
    </nav>
    <div className="header-actions">
      <button className="header-link" onClick={() => setLanguage(language === 'en' ? 'fi' : 'en')} aria-label="Switch language">{language.toUpperCase()} / {t.nav.language}</button>
      <button className="menu-button" aria-label="Toggle menu" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
    </div>
  </header>
}
