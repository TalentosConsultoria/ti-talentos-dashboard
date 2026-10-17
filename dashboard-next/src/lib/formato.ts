const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function fmtBRL(v: number | null | undefined): string {
  return BRL.format(Number(v) || 0);
}

export function texto(v: string | null | undefined, vazio = "Não informado"): string {
  const t = (v ?? "").toString().trim();
  return t || vazio;
}

/** Ordenação alfabética pt-BR, ignorando acento e caixa. */
export const comparar = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true }).compare;

export function unicos(valores: (string | null | undefined)[]): string[] {
  const set = new Set<string>();
  for (const v of valores) {
    const t = (v ?? "").trim();
    if (t) set.add(t);
  }
  return [...set].sort(comparar);
}

export function normalizar(s: string | null | undefined): string {
  return (s ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function plural(n: number, um: string, varios: string): string {
  return `${n.toLocaleString("pt-BR")} ${n === 1 ? um : varios}`;
}
