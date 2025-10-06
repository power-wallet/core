import favicons from 'favicons';
import fs from 'fs/promises';
import path from 'path';

const SRC = path.resolve(process.cwd(), 'public', 'img', 'logo.png');
const OUT = path.resolve(process.cwd(), 'public');

const configuration = {
  path: '/',
  appName: 'Power Wallet',
  appShortName: 'PowerWallet',
  appDescription: 'Smart On-Chain Investing',
  developerName: 'Power Wallet',
  developerURL: 'https://powerwallet.finance',
  dir: 'auto',
  lang: 'en-US',
  background: '#111827',
  theme_color: '#F59E0B',
  appleStatusBarStyle: 'default',
  display: 'standalone',
  orientation: 'any',
  scope: '/',
  start_url: '/',
  version: '1.0',
  logging: false,
  pixel_art: false,
  loadManifestWithCredentials: false,
  icons: {
    android: true,
    appleIcon: true,
    appleStartup: false,
    favicons: true,
    windows: true,
    yandex: false,
  },
};

try {
  const res = await favicons(SRC, configuration);
  // Write images
  await Promise.all(res.images.map(async (file) => {
    await fs.writeFile(path.join(OUT, file.name), file.contents);
  }));
  // Write files (manifest/browserconfig)
  await Promise.all(res.files.map(async (file) => {
    await fs.writeFile(path.join(OUT, file.name), file.contents);
  }));
  // Write html (we will reference via Next metadata)
  await fs.writeFile(path.join(OUT, 'favicons-snippet.html'), res.html.join('\n'));
  console.log('Favicons generated in', OUT);
} catch (err) {
  console.error('Favicons generation failed:', err);
  process.exit(1);
}


