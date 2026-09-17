// Abre uma aba no clique e só depois define o endereço (o navegador bloqueia
// window.open feito depois de um await). Sem aba, navega na própria.
export async function openAfter(getUrl: () => Promise<string | null | undefined>): Promise<void> {
  const tab = typeof window !== "undefined" ? window.open("about:blank", "_blank") : null;
  try {
    const url = await getUrl();
    if (!url) {
      tab?.close();
      return;
    }
    if (tab) {
      tab.opener = null;
      tab.location.href = url;
    } else {
      window.location.href = url;
    }
  } catch (error) {
    tab?.close();
    throw error;
  }
}
