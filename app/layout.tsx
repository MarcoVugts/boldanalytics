import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono, Montserrat } from "next/font/google";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const montserrat = Montserrat({ variable: "--font-brand", subsets: ["latin"], weight: ["600", "700", "800"] });

export const metadata: Metadata = {
  // absolute URLs for link previews (Vercel sets VERCEL_PROJECT_PRODUCTION_URL)
  metadataBase: new URL(
    process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000",
  ),
  twitter: { card: "summary_large_image" },
  title: { default: "Bold Analytics", template: "%s · Bold Analytics" },
  description: "Onchain data analysis for blockchain companies.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} ${montserrat.variable} h-full antialiased`}>
      <head>
        {/* apply a remembered theme before first paint (see components/ThemeToggle.tsx) */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}` }} />
      </head>
      <body className="min-h-full flex flex-col">
        <header className="border-b border-border">
          <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-4 text-sm">
            <Link href="/" aria-label="Bold Analytics home"><Logo height={26} /></Link>
            <Link href="/stories/tokenized-stocks" className="text-ink-2 hover:text-ink">Tokenized Stocks</Link>
            <ThemeToggle />
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
