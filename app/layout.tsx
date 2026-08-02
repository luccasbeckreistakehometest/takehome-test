import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import { getSettings } from "@/lib/settings";
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

// Whitelabel: a marca vem do banco a cada request
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Central de Marketing com IA",
  description:
    "Centralize briefings, conecte clientes, agência e profissionais, e gere estratégia, campanhas, identidade e landing pages com IA.",
};

const NAV = [
  { href: "/", label: "Clientes" },
  { href: "/prospecting", label: "Prospecção" },
  { href: "/professionals", label: "Profissionais" },
  { href: "/ideas", label: "Ideias" },
  { href: "/treinamento", label: "Treinamento" },
  { href: "/settings", label: "Configurações" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = getSettings();
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} h-full antialiased`}
      style={{ ["--accent" as string]: settings.accentColor }}
    >
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-40 border-b border-edge bg-background/80 backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4">
            <Link href="/" className="flex shrink-0 items-center gap-2">
              <span className="grid size-7 place-items-center rounded-md bg-accent font-[family-name:var(--font-display)] text-sm font-bold text-accent-ink">
                {settings.agencyName.charAt(0).toUpperCase()}
              </span>
              <span className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">
                {settings.agencyName}
              </span>
            </Link>
            <nav className="flex items-center gap-4 overflow-x-auto text-sm text-muted">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="whitespace-nowrap transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/portal"
                className="whitespace-nowrap rounded-md bg-accent px-3 py-1.5 font-medium text-accent-ink transition-opacity hover:opacity-90"
              >
                Portal
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
          {children}
        </main>
        <footer className="border-t border-edge py-4 text-center text-xs text-muted">
          {settings.agencyName} — {settings.tagline}
        </footer>
      </body>
    </html>
  );
}
