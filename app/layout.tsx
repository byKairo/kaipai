import type { Viewport } from 'next';
import './globals.css';

export const metadata = {
  title: '楷排 · AI 公众号排版工作台',
  description: '以本地优先方式完成公众号文章排版',
  icons: { icon: '/favicon.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
