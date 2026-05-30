import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import UserAuthButton from "@/components/UserAuthButton";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Aether | AI Carbon Marketplace",
  description: "Automated AI Carbon Marketplace verifying real-world impact.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full antialiased" suppressHydrationWarning>
      <body className={`${inter.className} min-h-full flex flex-col bg-zinc-950 text-white`}>
        <Providers>
          <header className="sticky top-0 z-50 w-full backdrop-blur-[12px] bg-zinc-950/60 border-b border-white/5">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 font-bold text-white shadow-[0_0_15px_rgba(16,185,129,0.5)]">
                  Æ
                </div>
                <span className="text-xl font-semibold tracking-tight text-white">Aether</span>
              </div>
              <div className="flex items-center gap-4">
                <UserAuthButton />
                <ConnectButton label="Connect Wallet" chainStatus="icon" showBalance={false} />
              </div>
            </div>
          </header>
          <main className="flex-1 flex flex-col items-center p-4">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
