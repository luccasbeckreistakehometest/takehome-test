import type { Metadata } from "next";
import Link from "next/link";
import { Archivo, Fraunces } from "next/font/google";
import { resolveBrand } from "@/lib/branding";
import { brandStyle } from "@/lib/brand-ramp";
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
import AppRail, { RailToggle } from "@/components/AppRail";
import { buttonClass } from "@/lib/button-class";
import Track from "@/components/Track";
import { MarqaMark } from "@/components/MarqaLogo";
import { purchaseBlockReason } from "@/lib/plans";
import "./globals.css";

// Duas variáveis servidas pelo próprio Next (sem CDN) e uma pilha de sistema
// para monoespaçada — docs/DESIGN.md §3.1. Nenhuma das duas é Inter, Poppins,
// Montserrat ou Geist. `latin` cobre o pt-BR inteiro.
//
// Fraunces é display e só entra com o eixo óptico acompanhando o tamanho
// (lib/type.ts); Archivo carrega texto, UI e TODO número, porque tem figura
// tabular de verdade e um eixo de largura que dispensa uma terceira família.
// `fallback` é a pilha que o Next usa para calcular o size-adjust da fonte
// substituta — é o que impede o salto de layout enquanto a woff2 chega.
const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  variable: "--font-fraunces",
  display: "swap",
  fallback: ["Iowan Old Style", "Palatino Linotype", "Palatino", "Book Antiqua", "Georgia", "serif"],
});
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
  fallback: ["Helvetica Neue", "Helvetica", "Arial", "Liberation Sans", "sans-serif"],
});

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
  const isAgency = session?.role === "agency";

  return (
    <html
      lang="pt-BR"
      className={`${fraunces.variable} ${archivo.variable} h-full antialiased`}
      style={brandStyle(brand.accentColor) as React.CSSProperties}
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
      <body className="min-h-full">
        <Translator />
        <Track />
        <JobsIndicator />
        <Tour kind={tourKind(session)} refId={session?.refId ?? null} />
        <GlobalSearch />
        {/* Casca da ferramenta (§4.1B): trilho de 248px + coluna de conteúdo.
            Quem não é agência (anônimo, marca, profissional, admin) continua
            sem trilho — a barra superior basta para três ou quatro destinos. */}
        <div className="flex min-h-dvh">
          {isAgency && <AppRail brandName={brand.name} />}
          <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
            <header className="no-print sticky top-0 z-40 border-b border-rule bg-canvas">
              <div className="flex h-14 items-center gap-2 px-4">
                {isAgency && <RailToggle />}
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
                  className={`flex shrink-0 items-center gap-2 ${isAgency ? "lg:hidden" : ""}`}
                >
                  {brand.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={brand.logoUrl} alt={brand.name} className="size-7 rounded-sm object-contain" />
                  ) : brand.isPlatform ? (
                    <MarqaMark size={28} />
                  ) : (
                    <span className="grid size-7 place-items-center rounded-sm bg-brand-solid text-brand-ink">
                      <span className="t5 font-medium">{brand.name.charAt(0).toUpperCase()}</span>
                    </span>
                  )}
                  <span className="t2 hidden font-medium sm:inline">{brand.name}</span>
                </Link>

                <div className="ml-auto flex items-center gap-0.5">
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
                  {isAgency && (
                    <Link
                      href="/settings"
                      title="Configurações"
                      aria-label="Configurações"
                      className="grid size-9 place-items-center rounded-sm text-text-muted transition-colors hover:bg-surface-sunken hover:text-text"
                    >
                      <Icon name="settings" size={20} />
                    </Link>
                  )}
                  <LangToggle />
                  {session ? (
                    <UserMenu
                      name={session.name}
                      role={session.role}
                      showPlans={!purchaseBlockReason(session) || session.role === "admin"}
                    />
                  ) : (
                    <Link href="/login" className={`${buttonClass("primary")} ml-2`}>
                      Entrar
                    </Link>
                  )}
                </div>
              </div>
            </header>

            <main className="main-shell">
              {session?.mustChangePassword && (
                <p
                  role="alert"
                  data-testid="must-change-password"
                  className="t3 mb-6 rounded-sm border border-caution bg-caution-wash px-3 py-2"
                >
                  Você entrou com uma senha provisória.{" "}
                  <Link href="/conta?trocar=1" className="font-medium underline underline-offset-4">
                    Troque a senha
                  </Link>{" "}
                  para usar a plataforma.
                </p>
              )}
              {children}
            </main>

            <SiteFooter brandName={brand.name} tagline={brand.tagline} />
          </div>
        </div>
        {isAgency && <AssistantWidget />}
      </body>
    </html>
  );
}
