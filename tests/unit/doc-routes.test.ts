import { describe, expect, it } from "vitest";
import { isChromelessRoute, routeArtefact } from "@/lib/doc-routes";

// docs/DESIGN.md §10: as cinco peças que a agência mostra ao cliente dela não
// podem sair emolduradas pela casca da plataforma.
describe("routeArtefact", () => {
  it("reconhece as cinco peças e a chave de cada uma", () => {
    expect(routeArtefact("/a/estudio-norte")).toEqual({ kind: "agency-page", key: "estudio-norte" });
    expect(routeArtefact("/proposta/abc123")).toEqual({ kind: "proposal", key: "abc123" });
    expect(routeArtefact("/fatura/tok-1")).toEqual({ kind: "invoice", key: "tok-1" });
    expect(routeArtefact("/aprovar/tok_2")).toEqual({ kind: "approval", key: "tok_2" });
    expect(routeArtefact("/print/report/tok.3")).toEqual({ kind: "report", key: "tok.3" });
  });

  it("separa /print/report/[token] de /print/[id] — o relatório público tem dono no endereço", () => {
    expect(routeArtefact("/print/xyz")).toEqual({ kind: "print", key: "xyz" });
    expect(routeArtefact("/print/report/xyz")).toEqual({ kind: "report", key: "xyz" });
  });

  it("ignora a barra final e a query", () => {
    expect(routeArtefact("/proposta/abc/")).toEqual({ kind: "proposal", key: "abc" });
    expect(routeArtefact("/proposta/abc?lang=en")).toEqual({ kind: "proposal", key: "abc" });
  });

  it("não confunde o produto com uma peça", () => {
    for (const path of ["/", "/clients", "/clients/abc", "/plans", "/settings", "/login", "/a", "/a/", "/proposta", "/agenda", "/admin"]) {
      expect(routeArtefact(path), path).toBeNull();
      expect(isChromelessRoute(path), path).toBe(false);
    }
  });

  it("recusa chave que não é um segmento", () => {
    expect(routeArtefact("/proposta/a/b")).toBeNull();
    expect(routeArtefact("/fatura/../etc")).toBeNull();
  });

  it("a peça é servida sem casca", () => {
    for (const path of ["/a/x", "/proposta/x", "/fatura/x", "/aprovar/x", "/print/report/x", "/print/x"]) {
      expect(isChromelessRoute(path), path).toBe(true);
    }
  });
});
