import type { Metadata } from "next";

import { Geist, Geist_Mono } from "next/font/google";

import "../index.css";
import Header from "@/components/header";
import Providers from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "trend-x",
  description: "trend-x",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          <div className="grid h-svh grid-rows-[auto_1fr_auto]">
            <Header />
            <main className="mx-auto w-full max-w-5xl px-4">{children}</main>
            <div className="mt-auto">
              <footer className="mt-16 border-t py-4 text-center text-muted-foreground text-sm">
                trend-x
              </footer>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
