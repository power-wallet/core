import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Inter } from 'next/font/google';
import Providers from './providers';
import Script from 'next/script';
import GATracking from './ga-tracking';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Power Wallet - Bitcoin accumulation strategies on auto-pilot',
  description: 'Automated Bitcoin investing strategies that help you accumulate more BTC over time, securely in your own on-chain wallets.',
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png' },
    ],
    other: [
      { rel: 'manifest', url: '/manifest.json' },
      { rel: 'mask-icon', url: '/safari-pinned-tab.svg', color: '#F59E0B' },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-6CNY1706RJ" strategy="afterInteractive" />
        <Script id="gtag-init" strategy="afterInteractive">{
          `window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-6CNY1706RJ');`
        }</Script>
        <Providers>
          {children}
          <Suspense fallback={null}>
            <GATracking />
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}
