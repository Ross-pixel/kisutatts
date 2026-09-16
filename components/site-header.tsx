'use client'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'
export function SiteHeader(){const [open,setOpen]=useState(false);return <header className="topbar"><Link href="/" className="brand">kisu<i>.tatts</i></Link><nav className={open?'nav-links open':'nav-links'}><Link href="/">Home</Link><Link href="/portfolio">Portfolio</Link><Link href="/faq">FAQ</Link><a href="https://www.instagram.com/kisu.tatts/" target="_blank" rel="noreferrer">DM me</a></nav><div className="header-actions"><Link className="header-link" href="/portfolio">FI / EN</Link><button className="menu-button" aria-label="Toggle menu" onClick={()=>setOpen(!open)}>{open?<X/>:<Menu/>}</button></div></header>}
