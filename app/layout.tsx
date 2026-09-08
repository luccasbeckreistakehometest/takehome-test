import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import { getSettings } from "@/lib/settings";
import { resolveBrand } from "@/lib/branding";
import { SESSION_COOKIE, verifySession } from "@/lib/auth-shared";
import Translator, { LangToggle } from "@/components/Translator";
import ActivityBell, { LogoutButton } from "@/components/ActivityBell";
import JobsIndicator from "@/components/JobsIndicator";
import GlobalSearch from "@/components/GlobalSearch";
import AssistantWidget from "@/components/AssistantWidget";
import ThemeToggle from "@/components/ThemeToggle";
import { Icon, type IconName } from "@/components/icons";
import { MarqaMark } from "@/components/MarqaLogo";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const spaceGrotesk = Space_Grotesk({ variable: "--font-display", subsets: ["latin"] });

// Whitelabel + sessão: marca e navegação vêm do banco/cookie a cada request
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Marqa — Marketing com IA",
  description:
    "Centralize briefings, conecte clientes, agência e profissionais, e gere estratégia, campanhas, identidade e landing pages com IA.",
};

const AGENCY_NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Hoje", icon: "home" },
  { href: "/clients", label: "Clientes", icon: "briefcase" },
  { href: "/production", label: "Produção", icon: "kanban" },
  { href: "/insights", label: "Insights", icon: "chart" },
  { href: "/messages", label: "Mensagens", icon: "message" },
  { href: "/prospecting", label: "Prospecção", icon: "radar" },
  { href: "/professionals", label: "Profissionais", icon: "users" },
  { href: "/agenda", label: "Agenda", icon: "calendar" },
  { href: "/ideas", label: "Ideias", icon: "lightbulb" },
  { href: "/plans", label: "Planos", icon: "money" },
];

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = getSettings();
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  // Marca exibida no chrome: agência (whitelabel) para a agência e convidados;
  // plataforma para anônimos e auto-cadastrados.
  const brand = resolveBrand(session, settings);

  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} h-full antialiased`}
      style={{ ["--accent" as string]: brand.accentColor }}
      suppressHydrationWarning
    >
      <head>
        {/* Aplica o tema salvo antes da pintura (sem flash) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme');if(!t){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}document.documentElement.setAttribute('data-theme',t)}catch(e){document.documentElement.setAttribute('data-theme','dark')}`,
          }}
        />
      </head>
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
              {brand.logoMime ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src="/api/settings/logo"
                  alt={brand.name}
                  className="size-7 rounded-md object-contain"
                />
              ) : brand.isPlatform ? (
                <MarqaMark size={28} />
              ) : (
                <span className="grid size-7 place-items-center rounded-md bg-accent font-[family-name:var(--font-display)] text-sm font-bold text-accent-ink">
                  {brand.name.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="hidden font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight sm:inline">
                {brand.name}
              </span>
            </Link>
            <nav className="flex items-center gap-1 text-sm text-muted">
              {session?.role === "agency" && (
                <div className="hidden items-center gap-0.5 lg:flex">
                  {AGENCY_NAV.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="group flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 transition-colors hover:bg-surface-2 hover:text-foreground"
                    >
                      <Icon name={item.icon} size={16} className="opacity-70 transition-opacity group-hover:opacity-100" />
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
              {session?.role === "agency" && (
                <details className="relative lg:hidden">
                  <summary className="grid size-8 list-none place-items-center rounded-md hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
                    <Icon name="kanban" size={18} />
                  </summary>
                  <div className="absolute right-0 top-10 z-50 w-52 rounded-xl border border-edge bg-surface p-1.5 shadow-2xl">
                    {AGENCY_NAV.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center gap-2.5 rounded-md px-3 py-2 transition-colors hover:bg-surface-2 hover:text-foreground"
                      >
                        <Icon name={item.icon} size={16} />
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </details>
              )}
              <div className="mx-1 hidden h-5 w-px bg-edge sm:block" />
              <ThemeToggle />
              {session && session.role !== "admin" && (
                <ActivityBell
                  audience={session.role}
                  clientId={session.role === "client" ? (session.refId ?? undefined) : undefined}
                  professionalId={
                    session.role === "professional" ? (session.refId ?? undefined) : undefined
                  }
                />
              )}
              {session?.role === "agency" && (
                <Link
                  href="/settings"
                  title="Configurações"
                  className="grid size-8 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                >
                  <Icon name="settings" size={17} />
                </Link>
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
          {brand.name} — {brand.tagline}
        </footer>
      </body>
    </html>
  );
}
