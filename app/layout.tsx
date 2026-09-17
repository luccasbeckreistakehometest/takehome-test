import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import { resolveBrand } from "@/lib/branding";
import { getSession } from "@/lib/session";
import Translator, { LangToggle } from "@/components/Translator";
import ActivityBell from "@/components/ActivityBell";
import UserMenu from "@/components/UserMenu";
import SiteFooter from "@/components/SiteFooter";
import { appBaseUrl } from "@/lib/legal";
import JobsIndicator from "@/components/JobsIndicator";
import GlobalSearch from "@/components/GlobalSearch";
import AssistantWidget from "@/components/AssistantWidget";
import ThemeToggle from "@/components/ThemeToggle";
import Tour from "@/components/Tour";
import { tourKind } from "@/lib/tour-steps";
import { Icon } from "@/components/icons";
import AgencyNav from "@/components/AgencyNav";
import Track from "@/components/Track";
import { MarqaMark } from "@/components/MarqaLogo";
import { purchaseBlockReason } from "@/lib/plans";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const spaceGrotesk = Space_Grotesk({ variable: "--font-display", subsets: ["latin"] });

// Whitelabel + sessão: marca e navegação vêm do banco/cookie a cada request
export const dynamic = "force-dynamic";

const DESCRIPTION =
  "Marketing com IA para agências, marcas e profissionais: briefing falado, estratégia, calendário, aprovações, relatório mensal e atendimento no WhatsApp.";

export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: new URL(appBaseUrl()),
    title: { default: "Marqa — Marketing com IA", template: "%s · Marqa" },
    description: DESCRIPTION,
    applicationName: "Marqa",
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      siteName: "Marqa",
      locale: "pt_BR",
      alternateLocale: ["en_US"],
      title: "Marqa — Marketing com IA",
      description: DESCRIPTION,
    },
    twitter: { card: "summary_large_image", title: "Marqa — Marketing com IA", description: DESCRIPTION },
    formatDetection: { telephone: false },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  // Marca exibida no chrome: a da agência da sessão (whitelabel) para a
  // agência e os convidados dela; plataforma para anônimos e auto-cadastrados.
  const brand = resolveBrand(session);

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
        <Track />
        <JobsIndicator />
        <Tour kind={tourKind(session)} refId={session?.refId ?? null} />
        <GlobalSearch />
        <header className="sticky top-0 z-40 border-b border-edge bg-background/80 backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4">
            <Link
              href={
                session?.role === "client"
                  ? session.selfServe
                    ? `/clients/${session.refId}`
                    : `/portal/client/${session.refId}`
                  : session?.role === "professional"
                    ? `/professionals/${session.refId}`
                    : "/"
              }
              className="flex shrink-0 items-center gap-2"
            >
              {brand.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={brand.logoUrl}
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
            <div className="flex items-center gap-1 text-sm text-muted">
              {session?.role === "agency" && <AgencyNav />}
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
                <UserMenu name={session.name} role={session.role} showPlans={!purchaseBlockReason(session) || session.role === "admin"} />
              ) : (
                <Link
                  href="/login"
                  className="whitespace-nowrap rounded-md bg-accent px-3 py-1.5 font-medium text-accent-ink transition-opacity hover:opacity-90"
                >
                  Entrar
                </Link>
              )}
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
          {session?.mustChangePassword && (
            <p role="alert" data-testid="must-change-password" className="mb-6 rounded-md border border-amber-500/60 bg-amber-500/10 px-3 py-2 text-sm">
              Você entrou com uma senha provisória. <Link href="/conta?trocar=1" className="font-medium text-accent hover:underline">Troque a senha</Link> para usar a plataforma.
            </p>
          )}
          {children}
        </main>
        {session?.role === "agency" && <AssistantWidget />}
        <SiteFooter brandName={brand.name} tagline={brand.tagline} />
      </body>
    </html>
  );
}
