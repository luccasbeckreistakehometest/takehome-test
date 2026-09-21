"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Client } from "@/lib/types";
import type { Professional } from "@/lib/marketplace-types";
import { Button, Card, Select } from "@/components/ui";

// Papéis diferentes, portas diferentes: agência (app completo), cliente
// (portal read-only) e profissional (portal de demandas e entregas).
export default function PortalPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [clientId, setClientId] = useState("");
  const [professionalId, setProfessionalId] = useState("");

  useEffect(() => {
    api<Client[]>("/api/clients").then(setClients);
    api<Professional[]>("/api/professionals").then(setProfessionals);
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-8">
      <div className="text-center">
        <h1 className="d3">
          Entrar na plataforma
        </h1>
        <p className="mt-2 t3 text-text-muted">
          Cada papel tem sua própria visão: escolha como você quer entrar.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="flex flex-col gap-3">
          <p className="d4">Agência
          </p>
          <p className="flex-1 t3 text-text-muted">
            Acesso completo: clientes, IA, demandas, prospecção, relatórios e
            configurações.
          </p>
          <Link href="/">
            <Button className="w-full">Entrar como agência</Button>
          </Link>
        </Card>

        <Card className="flex flex-col gap-3">
          <p className="d4">Cliente
          </p>
          <p className="flex-1 t3 text-text-muted">
            Acompanhe estratégia, entregas e relatórios da sua marca.
          </p>
          <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Selecione sua empresa...</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </Select>
          <Button
            className="w-full"
            disabled={!clientId}
            onClick={() => router.push(`/portal/client/${clientId}`)}
          >
            Entrar como cliente
          </Button>
          <Link href="/cadastro" className="text-center t5 text-text hover:underline">
            Ainda não sou cadastrado
          </Link>
        </Card>

        <Card className="flex flex-col gap-3">
          <p className="d4">Profissional
          </p>
          <p className="flex-1 t3 text-text-muted">
            Suas demandas, oportunidades abertas, entregas e seu elo.
          </p>
          <Select
            value={professionalId}
            onChange={(e) => setProfessionalId(e.target.value)}
          >
            <option value="">Selecione seu perfil...</option>
            {professionals.map((professional) => (
              <option key={professional.id} value={professional.id}>
                {professional.name}
              </option>
            ))}
          </Select>
          <Button
            className="w-full"
            disabled={!professionalId}
            onClick={() => router.push(`/professionals/${professionalId}`)}
          >
            Entrar como profissional
          </Button>
          <Link
            href="/professionals/new"
            className="text-center t5 text-text hover:underline"
          >
            Quero me cadastrar
          </Link>
        </Card>
      </div>
      <p className="text-center t5 text-text-muted">
        Autenticação com senha/SSO entra na próxima fase — hoje os portais são
        separados por papel para validar o fluxo.
      </p>
    </div>
  );
}
