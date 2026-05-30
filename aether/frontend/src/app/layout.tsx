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
      <body className={`${inter.className} min-h-full flex flex-col`}>
        <Providers>
          <main className="flex-1 flex flex-col w-full">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
