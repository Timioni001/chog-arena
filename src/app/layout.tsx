import type { Metadata, Viewport } from 'next';
import { Nunito, Pixelify_Sans } from 'next/font/google';
import { Providers } from '@/components/Providers';
import './globals.css';

const pixel = Pixelify_Sans({ subsets: ['latin'], variable: '--font-pixelify', weight: ['500', '700'], display: 'swap' });
const body = Nunito({ subsets: ['latin'], variable: '--font-nunito', weight: ['500', '700', '800', '900'], display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: 'Chog Arena',
  description: 'Your Chog is your fighter. Tap, build bots, and battle in 3-lane ranked seasons on Monad.',
  applicationName: 'Chog Arena',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/icons/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'Chog Arena', statusBarStyle: 'black-translucent' },
  openGraph: { title: 'Chog Arena', description: 'Your Chog is your fighter. Tap, build bots, battle in ranked seasons.', images: ['/og.png'] },
  twitter: { card: 'summary_large_image', title: 'Chog Arena', description: 'Your Chog is your fighter.', images: ['/og.png'] },
};

export const viewport: Viewport = {
  themeColor: '#0d0a18',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={`${pixel.variable} ${body.variable}`} suppressHydrationWarning>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
