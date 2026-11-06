import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Bold Analytics", template: "%s · Bold Analytics" },
  description: "Onchain data analysis for blockchain companies.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="border-b border-border">
          <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-4 text-sm">
            <Link href="/" className="font-bold tracking-tight text-ink">Bold Analytics</Link>
            <Link href="/stories/tokenized-stocks" className="text-ink-2 hover:text-ink">Tokenized Stocks</Link>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-ink-3">
            For informational purposes only, not financial advice. Data via{" "}
            <a href="https://dune.com" className="underline hover:text-ink-2">Dune</a>. All times UTC.
          </div>
        </footer>
      </body>
    </html>
  );
}
