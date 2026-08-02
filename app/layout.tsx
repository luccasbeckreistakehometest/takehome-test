import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import { getSettings } from "@/lib/settings";
import { SESSION_COOKIE, verifySession } from "@/lib/auth-shared";
import Translator, { LangToggle } from "@/components/Translator";
import ActivityBell, { LogoutButton } from "@/components/ActivityBell";
import JobsIndicator from "@/components/JobsIndicator";
import GlobalSearch from "@/components/GlobalSearch";
import AssistantWidget from "@/components/AssistantWidget";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const spaceGrotesk = Space_Grotesk({ variable: "--font-display", subsets: ["latin"] });

// Whitelabel + sessão: marca e navegação vêm do banco/cookie a cada request
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Central de Marketing com IA",
  description:
    "Centralize briefings, conecte clientes, agência e profissionais, e gere estratégia, campanhas, identidade e landing pages com IA.",
};

const AGENCY_NAV = [
  { href: "/", label: "Hoje" },
  { href: "/clients", label: "Clientes" },
  { href: "/production", label: "Produção" },
  { href: "/prospecting", label: "Prospecção" },
  { href: "/professionals", label: "Profissionais" },
  { href: "/agenda", label: "Agenda" },
  { href: "/ideas", label: "Ideias" },
  { href: "/settings", label: "Configurações" },
];

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = getSettings();
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);

  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} h-full antialiased`}
      style={{ ["--accent" as string]: settings.accentColor }}
    >
      <body className="min-h-full flex flex-col">
        <Translator />
        <JobsIndicator />
        <GlobalSearch />
        <header className="sticky top-0 z-40 border-b border-edge bg-background/80 backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4">
            <Link
              href={
                session?.role === "client"
                  ? `/portal/client/${session.refId}`
                  : session?.role === "professional"
                    ? `/professionals/${session.refId}`
                    : "/"
              }
              className="flex shrink-0 items-center gap-2"
            >
              <span className="grid size-7 place-items-center rounded-md bg-accent font-[family-name:var(--font-display)] text-sm font-bold text-accent-ink">
                {settings.agencyName.charAt(0).toUpperCase()}
              </span>
              <span className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">
                {settings.agencyName}
              </span>
            </Link>
            <nav className="flex items-center gap-4 overflow-x-auto text-sm text-muted">
              {session?.role === "agency" &&
                AGENCY_NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="whitespace-nowrap transition-colors hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                ))}
              {session && (
                <ActivityBell
                  audience={session.role}
                  clientId={session.role === "client" ? (session.refId ?? undefined) : undefined}
                  professionalId={
                    session.role === "professional" ? (session.refId ?? undefined) : undefined
                  }
                />
              )}
              <LangToggle />
              {session ? (
                <>
                  <span className="hidden whitespace-nowrap text-xs sm:inline">
                    {session.name}
                  </span>
                  <LogoutButton />
                </>
              ) : (
                <Link
                  href="/login"
                  className="whitespace-nowrap rounded-md bg-accent px-3 py-1.5 font-medium text-accent-ink transition-opacity hover:opacity-90"
                >
                  Entrar
                </Link>
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        {session?.role === "agency" && <AssistantWidget />}
        <footer className="border-t border-edge py-4 text-center text-xs text-muted">
          {settings.agencyName} — {settings.tagline}
        </footer>
      </body>
    </html>
  );
}
