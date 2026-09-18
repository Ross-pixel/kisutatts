import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'
import './polish.css'
import { LanguageProvider } from '@/components/language-provider'

export const metadata: Metadata = {
  title: 'Eva — Tattoo Artist in Tampere | kisu.tatts',
  description: 'Soft, strange and sweet tattoos by Eva in Tampere, Finland. Flash designs, custom work and booking via Instagram DM.',
  generator: 'v0.app',
  metadataBase: new URL('https://kisu-tatts.vercel.app'),
  openGraph: {
    title: 'Eva — Tattoo Artist in Tampere',
    description: 'Tiny pieces of joy to live on your skin. Flash and custom tattoos by Eva.',
    type: 'website',
    url: 'https://kisu-tatts.vercel.app',
    siteName: 'kisu.tatts',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Eva — Tattoo Artist in Tampere',
    description: 'Soft, strange and sweet tattoos by Eva. Book via Instagram DM.',
  },
  icons: {
    icon: '/uploads/logo-card.png',
    apple: '/uploads/logo-card.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#fdfbf7',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <LanguageProvider>{children}</LanguageProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
