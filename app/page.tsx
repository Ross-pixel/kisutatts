'use client'

import { useState } from 'react'
import {
  ArrowUpRight,
  ChevronDown,
  Camera,
  MapPin,
  Menu,
  MessageCircle,
  Music2,
  Sparkles,
  X,
} from 'lucide-react'

const instagram = 'https://www.instagram.com/kisu.tatts/'
const tiktok = 'https://www.tiktok.com/@kisu.tatts'

const portfolio = [
  { title: 'Flora', tag: 'botanical / soft', className: 'art-flora' },
  { title: 'B&W', tag: 'ink / shading', className: 'art-bw' },
  { title: 'Color', tag: 'sweet / bright', className: 'art-color' },
  { title: 'Healed', tag: 'lived-in ink', className: 'art-healed' },
  { title: 'ALT', tag: 'odd little things', className: 'art-alt' },
  { title: 'Custom', tag: 'made for you', className: 'art-custom' },
]

const prices = [
  ['75€', 'Small & simple', 'stars · octopus · pretzels · puzzles'],
  ['80€', 'Cute little ones', 'stars · ghosts · bunnies'],
  ['90€', 'Medium', 'wolves · fairies · owls · mushrooms'],
  ['100€', 'Medium +', 'rays · hooded cats · clocks · flowers'],
  ['110€', 'Large', 'jellyfish · sword rats · twins'],
  ['120€', 'Large +', 'Gengar · witch cats · pigeons · Minecraft'],
  ['130€', 'Detailed', 'bunnies · alien bears · squids · candles'],
  ['140€', 'Large detailed', 'brushes · fish · deer · clown cats · spiders'],
  ['160€', 'Very detailed', 'mice · scissors · bugs · branches · skeletons'],
  ['170–180€', 'Maximum detail', 'lizard skeletons · spiky hearts · swords'],
]

export default function Page() {
  const [lang, setLang] = useState<'en' | 'fi'>('en')
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeArt, setActiveArt] = useState<number | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  const copy = lang === 'fi'
    ? { book: 'Varaa aika', about: 'Minusta', portfolio: 'Portfolio', pricing: 'Flash & hinnat', booking: 'Varaus', faq: 'Usein kysytyt', contact: 'Yhteys', eyebrow: 'Tatuointitaiteilija Tampereella', intro: 'Värit, linjat & varjot.', more: 'Lue lisää' }
    : { book: 'Book now', about: 'About me', portfolio: 'Portfolio', pricing: 'Flash & pricing', booking: 'Booking', faq: 'FAQ', contact: 'Get in touch', eyebrow: 'Tattoo artist in Tampere', intro: 'Colours, lines & shadows.', more: 'Read more' }

  return (
    <main className="site-shell">
      <header className="topbar">
        <a href="#top" className="brand" aria-label="kisu.tatts home"><span>kisu</span><i>.tatts</i></a>
        <nav className={menuOpen ? 'nav-links open' : 'nav-links'}>
          <a href="#about" onClick={() => setMenuOpen(false)}>{copy.about}</a>
          <a href="#portfolio" onClick={() => setMenuOpen(false)}>{copy.portfolio}</a>
          <a href="#pricing" onClick={() => setMenuOpen(false)}>{copy.pricing}</a>
          <a href="#contact" onClick={() => setMenuOpen(false)}>{copy.contact}</a>
        </nav>
        <div className="header-actions">
          <div className="lang-switch" aria-label="Language switcher">
            <button className={lang === 'fi' ? 'active' : ''} onClick={() => setLang('fi')}>FI</button>
            <span>/</span>
            <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button>
          </div>
          <button className="menu-button" aria-label="Toggle menu" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="kicker"><Sparkles size={14} /> {copy.eyebrow}</p>
          <h1>Eva<span className="dot">.</span></h1>
          <p className="hero-lead">{copy.intro}<br /><em>Fin / Eng / Rus</em></p>
          <a className="primary-button" href={instagram} target="_blank" rel="noreferrer">{copy.book} <ArrowUpRight size={16} /></a>
        </div>
        <div className="avatar-card" aria-label="Pixel art portrait of Eva">
          <div className="pixel-grid" />
          <div className="avatar-face"><span className="ear left" /><span className="ear right" /><span className="hair" /><span className="eye one" /><span className="eye two" /><span className="mouth" /><span className="neck" /></div>
          <span className="sticker sticker-one">♡</span><span className="sticker sticker-two">✳</span>
          <p>tampere, finland</p>
        </div>
        <div className="scroll-note">scroll to explore <span>↓</span></div>
      </section>

      <section className="intro-strip"><p>“Making tiny pieces of joy<br />to live on your skin.”</p><span>est. 2023 / hari.gallery</span></section>

      <section className="section about-section" id="about">
        <div className="section-label"><span className="section-icon">♡</span> 01 / {copy.about}</div>
        <div className="about-grid">
          <div className="about-photo"><div className="desk-doodle">♡<br /><small>work in progress</small></div><span>real studio moments<br />coming soon</span></div>
          <div className="about-text"><p className="small-heading">nice to meet you <span>♡</span></p><h2>Hi, I&apos;m Eva!</h2><p className="body-copy">I&apos;m really friendly and I love to brighten people&apos;s day ♡ I fell in love with tattoos because they bring joy to both me and others. I adore that my own drawings can live forever on someone&apos;s skin ✦</p><p className="body-copy finnish">Moikka! Oon Eva &lt;3 Oon todella ystävällinen ja rakastan ilahduttaa muita. Mulla on paljon vapaita malleja, joista voi varata omansa — tai voidaan tehdä custom-tatska just sun toiveiden mukaan!</p><p className="signature">Eva <span>♡</span></p></div>
        </div>
      </section>

      <section className="section portfolio-section" id="portfolio">
        <div className="section-head"><div><div className="section-label"><span className="section-icon">✦</span> 02 / {copy.portfolio}</div><h2>Little pieces<br /><em>of magic.</em></h2></div><p>Every piece is drawn with a lot of care.<br />More work on Instagram ↗</p></div>
        <div className="portfolio-grid">{portfolio.map((item, i) => <button className={`portfolio-card ${item.className}`} key={item.title} onClick={() => setActiveArt(i)}><span className="art-shape" /><span className="art-label"><b>{item.title}</b><small>{item.tag}</small></span><span className="view-icon">↗</span></button>)}</div>
        <a className="text-link" href={instagram} target="_blank" rel="noreferrer">view all on instagram <ArrowUpRight size={15} /></a>
      </section>

      <section className="price-band" id="pricing"><div className="section price-section"><div className="section-label"><span className="section-icon">🍄</span> 03 / {copy.pricing}</div><div className="price-intro"><h2>Pick a flash.<br /><em>Make it yours.</em></h2><p>Ready-to-go designs, made with love and a little bit of weird. Scroll through the price points or message me for a custom idea.</p></div><div className="price-list">{prices.map(([price, title, details]) => <div className="price-row" key={price}><strong>{price}</strong><div><b>{title}</b><span>{details}</span></div><span className="plus">+</span></div>)}</div><p className="price-note">All flash designs can be booked. Custom designs are always welcome — final price depends on size and detail.</p></div></section>

      <section className="section booking-section" id="booking"><div className="section-label"><span className="section-icon">🐾</span> 04 / {copy.booking}</div><div className="booking-grid"><div><h2>Let&apos;s make<br /><em>something cute.</em></h2><p className="body-copy">Choose a flash design or bring your own idea. We&apos;ll make it feel like you.</p><a className="primary-button pixel-cta" href={instagram} target="_blank" rel="noreferrer"><MessageCircle size={16} /> DM me on Instagram ♡</a></div><div className="steps">{[['01', 'Send a DM', 'Tell me your idea, placement and size.'], ['02', 'Talk it through', 'We find the right design and a time that works.'], ['03', 'Deposit', 'A small deposit secures your appointment.'], ['04', 'Tattoo day', 'Come to Hari Gallery and let the magic happen.']].map(([n, title, text]) => <div className="step" key={n}><span>{n}</span><div><b>{title}</b><p>{text}</p></div></div>)}</div></div><div className="address-chip"><MapPin size={16} /><span>Aspinniemenkatu 5, Tampere</span><a href="https://maps.google.com/?q=Aspinniemenkatu+5+Tampere" target="_blank" rel="noreferrer">open map ↗</a></div></section>

      <section className="section faq-section" id="faq"><div className="section-label">05 / {copy.faq}</div><div className="faq-layout"><h2>Good to<br /><em>know.</em></h2><div className="faq-list">{[['How do I take care of my new tattoo?', 'I’ll send you clear aftercare instructions after your session. In short: keep it clean, moisturised and out of the sun while it heals.'], ['What languages do you speak?', 'Fin / Eng / Rus — everyone is welcome.'], ['Can I bring my own idea?', 'Absolutely! I love custom work. Send me your references, mood and wishes in a DM.']].map(([q, a], i) => <div className={`faq-item ${openFaq === i ? 'open' : ''}`} key={q}><button onClick={() => setOpenFaq(openFaq === i ? null : i)}><span>{q}</span><ChevronDown size={18} /></button>{openFaq === i && <p>{a}</p>}</div>)}</div></div></section>

      <section className="contact-section" id="contact"><div className="section contact-inner"><div><div className="section-label">06 / {copy.contact}</div><h2>Say hi<span>.</span></h2><p>Have a question, an idea, or just want to say hello? My DMs are open.</p><a className="primary-button light" href={instagram} target="_blank" rel="noreferrer">@kisu.tatts <ArrowUpRight size={16} /></a></div><div className="contact-links"><a href={instagram} target="_blank" rel="noreferrer"><Camera size={20} /> Instagram <span>@kisu.tatts</span></a><a href={tiktok} target="_blank" rel="noreferrer"><Music2 size={20} /> TikTok <span>@kisu.tatts</span></a><a href={instagram} target="_blank" rel="noreferrer"><Sparkles size={20} /> Studio <span>@hari.gallery</span></a></div></div><div className="map-frame"><iframe title="Map to Hari Gallery" src="https://www.google.com/maps?q=Aspinniemenkatu%205,%20Tampere&output=embed" loading="lazy" /></div></section>

      <footer><a href="#top" className="brand">kisu<i>.tatts</i></a><span>© 2024 Eva / made with care in Tampere</span><div><a href={instagram} target="_blank" rel="noreferrer">IG</a><a href={tiktok} target="_blank" rel="noreferrer">TT</a></div></footer>
      {activeArt !== null && <div className="lightbox" role="dialog" aria-modal="true" onClick={() => setActiveArt(null)}><button aria-label="Close" onClick={() => setActiveArt(null)}><X /></button><div className={`lightbox-art ${portfolio[activeArt].className}`} onClick={(e) => e.stopPropagation()}><span className="art-shape" /><b>{portfolio[activeArt].title}</b><small>Portfolio placeholder — add Eva&apos;s original work here</small></div></div>}
    </main>
  )
}
