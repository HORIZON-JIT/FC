import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/Header';

export const metadata: Metadata = {
  title: '作業手順書アプリ',
  description: 'PC事務作業・梱包作業の手順書を作成・管理するアプリケーション',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="bg-gray-50 min-h-screen">
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}
