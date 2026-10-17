"use client";

import { useState } from "react";
import { Check, Copy } from "@phosphor-icons/react";

export function BotaoCopiar({ texto, rotulo = "Copiar" }: { texto: string; rotulo?: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1600);
    } catch {
      /* navegador sem permissão de clipboard: o texto continua selecionável */
    }
  }

  return (
    <button type="button" className="botao botao--sutil nao-imprimir" onClick={copiar} aria-live="polite">
      {copiado ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
      {copiado ? "Copiada" : rotulo}
    </button>
  );
}
