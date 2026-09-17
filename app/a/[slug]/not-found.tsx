// 404 da página pública da agência (slug inexistente ou página despublicada).
export default function AgencyPageNotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center" data-testid="agency-page-404">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Página não encontrada</h1>
      <p className="mt-3 text-muted">O endereço pode estar errado ou a agência ainda não publicou a página.</p>
    </div>
  );
}
