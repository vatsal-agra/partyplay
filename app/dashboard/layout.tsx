import { ReactNode } from 'react';

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen pt-10">
      <div className="w-full px-4 pb-16">
        {children}
      </div>
    </div>
  );
}
