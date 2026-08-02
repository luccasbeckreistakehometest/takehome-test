import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AgencyHub — Central de Marketing com IA",
  description:
    "Centralize briefings de clientes e gere planos de campanha, social media, identidade visual e landing pages com IA.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-40 border-b border-edge bg-background/80 backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-md bg-accent font-[family-name:var(--font-display)] text-sm font-bold text-accent-ink">
                A
              </span>
              <span className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">
                Agency<span className="text-accent">Hub</span>
              </span>
            </Link>
            <nav className="flex items-center gap-4 text-sm text-muted">
              <Link href="/" className="transition-colors hover:text-foreground">
                Clientes
              </Link>
              <Link
                href="/clients/new"
                className="rounded-md bg-accent px-3 py-1.5 font-medium text-accent-ink transition-opacity hover:opacity-90"
              >
                Novo cliente
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
          {children}
        </main>
        <footer className="border-t border-edge py-4 text-center text-xs text-muted">
          AgencyHub — sua agência, centralizada e acelerada por IA
        </footer>
      </body>
    </html>
  );
}
