"use client";

import { Printer } from "@phosphor-icons/react";

/** Substitui o "Gerar ficha PDF" (subprocess Python) pela impressão do navegador. */
export function BotaoImprimir() {
  return (
    <button type="button" className="botao nao-imprimir" onClick={() => window.print()}>
      <Printer size={16} aria-hidden="true" />
      Imprimir ficha
    </button>
  );
}
