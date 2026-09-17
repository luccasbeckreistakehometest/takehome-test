"use client";

import Link from "next/link";

// Erro no próprio layout raiz: página mínima, com estilo próprio (o CSS do
// app pode não ter carregado).
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#0d0d0f", color: "#f4f4f5" }}>
        <main role="alert" style={{ maxWidth: 520, margin: "0 auto", padding: "80px 20px", textAlign: "center" }}>
          <p style={{ fontSize: 40, fontWeight: 800, color: "#f76b15", margin: 0 }}>Marqa</p>
          <h1 style={{ fontSize: 24, margin: "16px 0 8px" }}>Algo deu errado</h1>
          <p style={{ color: "#a1a1aa", margin: 0 }}>Tente de novo em instantes.</p>
          <p lang="en" style={{ color: "#a1a1aa", fontSize: 14 }}>Something went wrong. Please try again shortly.</p>
          {error.digest && <p style={{ fontFamily: "monospace", fontSize: 12, color: "#71717a" }}>código: {error.digest}</p>}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 28, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={reset}
              style={{ background: "#f76b15", color: "#fff", border: 0, borderRadius: 8, padding: "10px 16px", fontSize: 14, cursor: "pointer" }}
            >
              Tentar de novo · Retry
            </button>
            <Link href="/" style={{ color: "#f4f4f5", border: "1px solid #3f3f46", borderRadius: 8, padding: "10px 16px", fontSize: 14, textDecoration: "none" }}>
              Início · Home
            </Link>
            <Link href="/contato" style={{ color: "#f4f4f5", border: "1px solid #3f3f46", borderRadius: 8, padding: "10px 16px", fontSize: 14, textDecoration: "none" }}>
              Contato · Contact
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
