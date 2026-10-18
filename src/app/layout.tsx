import type { Metadata, Viewport } from 'next';
import { Inter_Tight, Lilita_One, Outfit } from 'next/font/google';
import { Providers } from '@/components/Providers';
import './globals.css';

const display = Outfit({ subsets: ['latin'], variable: '--font-outfit', display: 'swap' });
const body = Inter_Tight({ subsets: ['latin'], variable: '--font-inter-tight', display: 'swap' });
const brand = Lilita_One({ subsets: ['latin'], weight: '400', variable: '--font-lilita', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: 'Chog Arena',
  description: 'Your Chog is your fighter. Tap, build bots, and battle in 3-lane ranked seasons on Monad.',
  applicationName: 'Chog Arena',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'Chog Arena', statusBarStyle: 'black-translucent' },
  openGraph: { title: 'Chog Arena', description: 'Your Chog is your fighter. Tap, build bots, battle in ranked seasons.', images: ['/og.jpg'] },
  twitter: { card: 'summary_large_image', title: 'Chog Arena', description: 'Your Chog is your fighter.', images: ['/og.jpg'] },
};

export const viewport: Viewport = {
  themeColor: '#12061f',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={`${display.variable} ${body.variable} ${brand.variable}`} suppressHydrationWarning>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
