"use client";

import { SessionContextProvider } from "@supabase/auth-helpers-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function PartyLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [supabaseClient] = useState(() => getSupabaseBrowserClient());
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((event, session) => {
      if (!session) {
        router.push("/auth/sign-in");
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [router, supabaseClient]);

  if (!isMounted) {
    return null;
  }

  return (
    <SessionContextProvider supabaseClient={supabaseClient}>
      {children}
    </SessionContextProvider>
  );
}
