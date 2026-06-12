import { Metadata } from "next";

export const metadata: Metadata = {
  title: "PartyPlay - Authentication",
  description: "Sign in or create an account to start playing games with friends",
};

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-500 to-pink-500 dark:from-cyan-600 dark:to-pink-600">
      <div className="w-full max-w-md space-y-8 p-8 bg-white/95 rounded-xl shadow-lg">
        {children}
      </div>
    </div>
  );
}
