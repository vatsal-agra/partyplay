import { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';

const inter = Inter({ subsets: ['latin'] });

export default function PartyDetailsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className={`${inter.className}`}>
      {children}
      <Toaster position="top-center" richColors closeButton />
    </div>
  );
}
