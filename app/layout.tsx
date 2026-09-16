import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'

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
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
