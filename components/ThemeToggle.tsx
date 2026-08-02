"use client";

import { useEffect, useState } from "react";
import { Icon } from "./icons";

type Theme = "dark" | "light";

// Alterna tema claro/escuro. O tema é aplicado em <html data-theme> por um
// script inline no layout (evita flash), então aqui só sincronizamos o estado.
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const current = (document.documentElement.getAttribute("data-theme") as Theme) || "dark";
    setTheme(current);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      // sem persistência disponível
    }
  }

  return (
    <button
      onClick={toggle}
      className="grid size-8 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
      title={theme === "dark" ? "Tema claro" : "Tema escuro"}
      aria-label="Alternar tema"
    >
      <Icon name={theme === "dark" ? "sun" : "moon"} size={17} />
    </button>
  );
}
