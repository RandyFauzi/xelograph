import type { Metadata, Viewport } from 'next';
import '../styles.css';
import '../game.css';
import '../world-theme.css';
import '../audio.css';

export const metadata: Metadata = {
  title: 'Xelograph — Kembali ke cerita kita',
  description:
    'Jelajahi kampus kecil penuh kenangan. Temukan teman lama dan tentukan reuni berikutnya, satu cerita setiap langkah.',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f7faf5' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
