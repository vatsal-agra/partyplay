import { ReactNode } from 'react';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className={`${inter.className} min-h-screen bg-gradient-to-br from-cyan-500 via-purple-500 to-pink-500 pt-16`}>
      <div className="w-full px-4 pb-12">
        {children}
      </div>
    </div>
  );
}
