"use client";

import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [supabaseClient] = useState(() => getSupabaseBrowserClient());

  return (
    <SessionContextProvider supabaseClient={supabaseClient}>
      {children}
    </SessionContextProvider>
  );
}
