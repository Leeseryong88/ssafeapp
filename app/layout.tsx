import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import FirebaseProvider from '../components/FirebaseProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '이미지 분석 앱',
  description: 'Gemini API를 활용한 이미지 분석 애플리케이션',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        <FirebaseProvider>
          <main className="min-h-screen bg-gray-100">
            {children}
          </main>
        </FirebaseProvider>
      </body>
    </html>
  );
} 