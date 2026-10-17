import type { StatusGarantia } from "@/lib/garantia";

export type FiltroGarantia = StatusGarantia | "todas";

export type Filtros = {
  q: string;
  tipo: string;
  local: string;
  setor: string;
  garantia: FiltroGarantia;
  baixados: boolean;
};

export const FILTROS_VAZIOS: Filtros = { q: "", tipo: "", local: "", setor: "", garantia: "todas", baixados: false };

const GARANTIAS: FiltroGarantia[] = ["todas", "vencida", "alerta", "ok", "sem_info"];

type Params = Record<string, string | string[] | undefined>;

function um(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v ?? "").slice(0, 120);
}

export function filtrosDeParams(sp: Params): Filtros {
  const g = um(sp.garantia) as FiltroGarantia;
  return {
    q: um(sp.q),
    tipo: um(sp.tipo),
    local: um(sp.local),
    setor: um(sp.setor),
    garantia: GARANTIAS.includes(g) ? g : "todas",
    baixados: um(sp.baixados) === "1",
  };
}

export function filtrosParaQuery(f: Filtros): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.tipo) p.set("tipo", f.tipo);
  if (f.local) p.set("local", f.local);
  if (f.setor) p.set("setor", f.setor);
  if (f.garantia !== "todas") p.set("garantia", f.garantia);
  if (f.baixados) p.set("baixados", "1");
  const s = p.toString();
  return s ? `?${s}` : "";
}
