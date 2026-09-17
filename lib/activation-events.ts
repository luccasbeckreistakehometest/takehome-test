// Barramento dos "primeiros passos": qualquer ação que muda dados avisa, e o
// card confere de novo sem recarregar a página.
export const ACTIVATION_EVENT = "ah:activation";

export function notifyActivation(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(ACTIVATION_EVENT));
  } catch {
    // navegador sem Event construtor: o card atualiza no próximo foco
  }
}
