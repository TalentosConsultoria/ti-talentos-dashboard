/** Porte de `parse_chave` (utils/nf_utils.py) para TypeScript. */
const UF: Record<number, string> = {
  11: "RO", 12: "AC", 13: "AM", 14: "RR", 15: "PA", 16: "AP", 17: "TO",
  21: "MA", 22: "PI", 23: "CE", 24: "RN", 25: "PB", 26: "PE", 27: "AL", 28: "SE", 29: "BA",
  31: "MG", 32: "ES", 33: "RJ", 35: "SP", 41: "PR", 42: "SC", 43: "RS",
  50: "MS", 51: "MT", 52: "GO", 53: "DF",
};
const MESES = ["", "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export type InfoChave = {
  uf: string;
  emissao: string;
  cnpj: string;
  modelo: string;
  serie: string;
  numero: string;
};

export function limparChave(chave: string): string {
  return chave.replace(/[\s.]/g, "");
}

export function parseChave(chave: string | null | undefined): InfoChave | null {
  if (!chave) return null;
  const ch = limparChave(chave);
  if (!/^\d{44}$/.test(ch)) return null;
  const ufCode = Number(ch.slice(0, 2));
  const mes = Number(ch.slice(4, 6));
  const c = ch.slice(6, 20);
  const modelo = ch.slice(20, 22);
  return {
    uf: UF[ufCode] ?? `?${ufCode}`,
    emissao: `${MESES[mes] ?? "?"}/20${ch.slice(2, 4)}`,
    cnpj: `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`,
    modelo: modelo === "55" ? "NF-e" : modelo === "65" ? "NFC-e" : `mod. ${modelo}`,
    serie: ch.slice(22, 25),
    numero: Number(ch.slice(25, 34)).toLocaleString("pt-BR"),
  };
}

/** Chave em grupos de 4 dígitos, como impressa no DANFE. */
export function chaveAgrupada(chave: string): string {
  return limparChave(chave).replace(/(\d{4})(?=\d)/g, "$1 ");
}
