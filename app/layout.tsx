import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono, Montserrat } from "next/font/google";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NavLink } from "@/components/NavLink";
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
        <header className="sticky top-0 z-40 border-b border-border bg-surface-0/85 backdrop-blur supports-[backdrop-filter]:bg-surface-0/75">
          <nav className="mx-auto flex h-16 max-w-6xl items-center gap-5 px-4 sm:gap-8">
            <Link href="/" aria-label="Bold Analytics home" className="flex items-center"><Logo height={30} /></Link>
            <div className="flex h-full items-stretch gap-6">
              <NavLink href="/stories/tokenized-stocks" match="/stories">Data stories</NavLink>
            </div>
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
