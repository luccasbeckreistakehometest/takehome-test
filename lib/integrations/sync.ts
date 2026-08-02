import {
  markSync,
  saveSnapshot,
  updateAccessToken,
  type ClientConnection,
  type ConnectorPlatform,
} from "../integrations-db";

// Renova o access token via OAuth refresh (Google/GA4). Resolve o problema do
// token que expira em ~1h: com refreshToken + clientId/secret salvos, geramos
// um token novo antes de cada sync. Atualiza a conexão e retorna o token novo.
async function refreshGoogleToken(conn: ClientConnection): Promise<string> {
  if (!conn.refreshToken || !conn.oauthClientId || !conn.oauthClientSecret) {
    return conn.accessToken; // sem credenciais de refresh: usa o token colado
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: conn.oauthClientId,
      client_secret: conn.oauthClientSecret,
      refresh_token: conn.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const payload = await res.json();
  if (!res.ok || !payload.access_token) {
    throw new Error(payload?.error_description ?? payload?.error ?? "falha no refresh OAuth");
  }
  updateAccessToken(conn.id, payload.access_token);
  return payload.access_token as string;
}

// Puxa métricas REAIS de cada plataforma quando há token configurado. Cada
// adapter fala a API oficial. Sem token → conexão fica "disconnected" e nada
// é inventado. As credenciais o usuário gera no painel de cada plataforma
// (Meta Business, Google Cloud/GA4, TikTok Business).

const last30 = () => {
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
};

type Metrics = {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
};

// GA4 Data API — sessões, conversões e receita (runReport).
async function syncGa4(conn: ClientConnection, start: string, end: string): Promise<Metrics> {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${conn.accountId}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${conn.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: start, endDate: end }],
        metrics: [
          { name: "sessions" },
          { name: "conversions" },
          { name: "totalRevenue" },
          { name: "screenPageViews" },
        ],
      }),
    }
  );
  const payload = await res.json();
  if (!res.ok) throw new Error(payload?.error?.message ?? `GA4 ${res.status}`);
  const row = payload?.rows?.[0]?.metricValues ?? [];
  const num = (i: number) => Number(row[i]?.value ?? 0);
  return {
    spend: 0,
    impressions: num(3), // pageviews como proxy de alcance
    clicks: num(0), // sessions
    conversions: num(1),
    revenue: num(2),
  };
}

// Meta Marketing Insights — spend/impressions/clicks/actions do ad account.
async function syncMetaAds(conn: ClientConnection, start: string, end: string): Promise<Metrics> {
  const url = new URL(`https://graph.facebook.com/v21.0/${conn.accountId}/insights`);
  url.searchParams.set("access_token", conn.accessToken);
  url.searchParams.set("time_range", JSON.stringify({ since: start, until: end }));
  url.searchParams.set("fields", "spend,impressions,clicks,actions,action_values");
  const res = await fetch(url);
  const payload = await res.json();
  if (!res.ok) throw new Error(payload?.error?.message ?? `Meta ${res.status}`);
  const data = payload?.data?.[0] ?? {};
  const purchases = (data.actions ?? []).find(
    (a: { action_type: string; value: string }) => a.action_type === "purchase"
  );
  const purchaseValue = (data.action_values ?? []).find(
    (a: { action_type: string; value: string }) => a.action_type === "purchase"
  );
  return {
    spend: Number(data.spend ?? 0),
    impressions: Number(data.impressions ?? 0),
    clicks: Number(data.clicks ?? 0),
    conversions: Number(purchases?.value ?? 0),
    revenue: Number(purchaseValue?.value ?? 0),
  };
}

// Google Ads e TikTok exigem headers/estruturas próprias; deixamos o gancho
// pronto e sinalizamos que a credencial ainda não está integrada em vez de
// fingir números.
async function notImplemented(platform: string): Promise<never> {
  throw new Error(
    `Conector ${platform} precisa de credencial OAuth do app — configure o token e conta para ativar.`
  );
}

export async function syncConnection(conn: ClientConnection): Promise<Metrics> {
  if (!conn.accessToken || !conn.accountId) {
    throw new Error("Conexão sem token/conta. Configure as credenciais primeiro.");
  }
  const { start, end } = last30();
  let metrics: Metrics;
  switch (conn.platform) {
    case "ga4": {
      // Renova o token via OAuth (se configurado) antes de consultar o GA4.
      const fresh = await refreshGoogleToken(conn);
      metrics = await syncGa4({ ...conn, accessToken: fresh }, start, end);
      break;
    }
    case "meta_ads":
      metrics = await syncMetaAds(conn, start, end);
      break;
    case "google_ads":
      await notImplemented("Google Ads");
      return { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 };
    case "tiktok_ads":
      await notImplemented("TikTok Ads");
      return { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 };
    default:
      throw new Error(`Plataforma ${conn.platform} não suporta sync automático.`);
  }
  saveSnapshot({ clientId: conn.clientId, platform: conn.platform, periodStart: start, periodEnd: end, ...metrics });
  markSync(conn.id, "connected");
  return metrics;
}

export const PLATFORM_LABELS: Record<ConnectorPlatform, string> = {
  ga4: "Google Analytics 4",
  meta_ads: "Meta Ads (Facebook/Instagram)",
  google_ads: "Google Ads",
  tiktok_ads: "TikTok Ads",
  sales_api: "API de vendas / marketplace",
};
