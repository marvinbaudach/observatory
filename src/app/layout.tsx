import type { Metadata } from 'next';
import { Cormorant_Garamond, Space_Mono } from 'next/font/google';
import './globals.css';

const serif = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
});

const mono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Observatory: interaktive 3D-Szene',
  description: 'Interaktive 3D-Szene mit React Three Fiber. Drei Projekte schweben im Raum und lassen sich anklicken.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${serif.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
