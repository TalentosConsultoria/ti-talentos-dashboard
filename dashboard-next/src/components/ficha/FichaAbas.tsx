"use client";

import * as Tabs from "@radix-ui/react-tabs";

type Aba = { id: string; rotulo: string; contagem?: number; conteudo: React.ReactNode };

/** Abas da ficha. forceMount mantém todos os painéis no DOM para a impressão. */
export function FichaAbas({ abas }: { abas: Aba[] }) {
  return (
    <Tabs.Root defaultValue={abas[0]?.id} className="abas">
      <Tabs.List className="abas__lista" aria-label="Detalhes do equipamento">
        {abas.map((a) => (
          <Tabs.Trigger key={a.id} value={a.id} className="abas__gatilho">
            {a.rotulo}
            {typeof a.contagem === "number" && <span className="abas__contagem">{a.contagem}</span>}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {abas.map((a) => (
        <Tabs.Content key={a.id} value={a.id} className="abas__painel" forceMount>
          {a.conteudo}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
