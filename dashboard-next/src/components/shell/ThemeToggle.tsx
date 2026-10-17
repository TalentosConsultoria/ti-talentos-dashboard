"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "@phosphor-icons/react";

type Tema = "dark" | "light";

export function ThemeToggle() {
  const [tema, setTema] = useState<Tema>("dark");

  useEffect(() => {
    const atual = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    setTema(atual);
  }, []);

  function alternar() {
    const novo: Tema = tema === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = novo;
    try {
      localStorage.setItem("tema", novo);
    } catch {
      /* modo privado: segue sem persistir */
    }
    setTema(novo);
  }

  const rotulo = tema === "dark" ? "Usar tema claro" : "Usar tema escuro";
  return (
    <button type="button" className="botao botao--icone botao--sutil" onClick={alternar} aria-label={rotulo} title={rotulo}>
      {tema === "dark" ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    </button>
  );
}
