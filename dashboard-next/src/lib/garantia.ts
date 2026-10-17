import type { Equipamento } from "./types";
import { diasEntre, mesesCompletos, parseYmd } from "./datas";

export type StatusGarantia = "vencida" | "alerta" | "ok" | "sem_info";

export type OrigemCobertura = "Original" | "Fornecedor" | "Estendida" | "Dell";

export type Cobertura = {
  origem: OrigemCobertura;
  /** Início conhecido da cobertura (pode faltar). */
  inicio: string | null;
  fim: string;
};

export type InfoGarantia = {
  status: StatusGarantia;
  /** Data final da cobertura válida mais longa. */
  fim: string | null;
  origem: OrigemCobertura | null;
  /** Início estimado da cobertura vigente (para a régua). */
  inicio: string | null;
  /** Dias até o fim (negativo = vencida). */
  dias: number | null;
};

export const JANELA_ALERTA_PADRAO = 90;

/**
 * Todas as coberturas registradas do equipamento.
 * Mesma regra do Streamlit (original, fornecedor, estendida) acrescida da
 * garantia Dell que o agente Roberto grava (garantia_dell_inicio/fim).
 */
export function coberturas(e: Equipamento): Cobertura[] {
  const compra = parseYmd(e.data_compra) ? (e.data_compra as string) : null;
  const lista: Cobertura[] = [];
  if (parseYmd(e.termino_garantia)) {
    lista.push({ origem: "Original", inicio: compra, fim: e.termino_garantia as string });
  }
  if (parseYmd(e.garantia_fornecedor_ate)) {
    lista.push({ origem: "Fornecedor", inicio: compra, fim: e.garantia_fornecedor_ate as string });
  }
  if (parseYmd(e.garantia_extendida_ate)) {
    const ini = parseYmd(e.termino_garantia) ? (e.termino_garantia as string) : compra;
    lista.push({ origem: "Estendida", inicio: ini, fim: e.garantia_extendida_ate as string });
  }
  if (parseYmd(e.garantia_dell_fim)) {
    const ini = parseYmd(e.garantia_dell_inicio) ? (e.garantia_dell_inicio as string) : compra;
    lista.push({ origem: "Dell", inicio: ini, fim: e.garantia_dell_fim as string });
  }
  return lista;
}

export function statusPorDias(dias: number | null, janela = JANELA_ALERTA_PADRAO): StatusGarantia {
  if (dias === null) return "sem_info";
  if (dias < 0) return "vencida";
  if (dias <= janela) return "alerta";
  return "ok";
}

export function infoGarantia(e: Equipamento, hoje: string, janela = JANELA_ALERTA_PADRAO): InfoGarantia {
  const lista = coberturas(e);
  if (!lista.length) {
    return { status: "sem_info", fim: null, origem: null, inicio: null, dias: null };
  }
  // A cobertura vigente é a que termina por último.
  const vigente = lista.reduce((a, b) => (b.fim > a.fim ? b : a));
  const inicio =
    lista.map((c) => c.inicio).filter((v): v is string => !!v).sort()[0] ?? null;
  const dias = diasEntre(hoje, vigente.fim);
  return {
    status: statusPorDias(dias, janela),
    fim: vigente.fim,
    origem: vigente.origem,
    inicio,
    dias,
  };
}

/**
 * Período em anos e meses civis entre hoje e a data final.
 * Compacto: "1a 4m", "7m", "2a", "18d". Longo: "1 ano e 4 meses".
 */
export function periodo(hoje: string, fim: string, formato: "curto" | "longo" = "curto"): string {
  const a = parseYmd(hoje);
  const b = parseYmd(fim);
  if (!a || !b) return "";
  const [ini, fin] = fim >= hoje ? [a, b] : [b, a];
  const meses = mesesCompletos(ini, fin);
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  if (meses === 0) {
    const d = Math.abs(diasEntre(hoje, fim) ?? 0);
    if (formato === "curto") return `${d}d`;
    return d === 1 ? "1 dia" : `${d} dias`;
  }
  if (formato === "curto") {
    if (anos && resto) return `${anos}a ${resto}m`;
    if (anos) return `${anos}a`;
    return `${resto}m`;
  }
  const pa = anos === 1 ? "1 ano" : `${anos} anos`;
  const pm = resto === 1 ? "1 mês" : `${resto} meses`;
  if (anos && resto) return `${pa} e ${pm}`;
  if (anos) return pa;
  return pm;
}

/** Texto do badge (compacto) e rótulo acessível (longo). */
export function rotuloGarantia(info: InfoGarantia, hoje: string): { curto: string; longo: string } {
  if (!info.fim || info.dias === null) {
    return { curto: "Sem registro", longo: "Sem garantia registrada" };
  }
  const p = periodo(hoje, info.fim, "curto");
  const pl = periodo(hoje, info.fim, "longo");
  if (info.dias < 0) {
    return { curto: `há ${p}`, longo: `Garantia vencida há ${pl}` };
  }
  if (info.dias === 0) return { curto: "vence hoje", longo: "Garantia vence hoje" };
  return { curto: p, longo: `Garantia ${info.origem?.toLowerCase()} por mais ${pl}` };
}

/** Fração já consumida da cobertura vigente (0..1), ou null se não há início. */
export function fracaoConsumida(info: InfoGarantia, hoje: string): number | null {
  if (!info.inicio || !info.fim) return null;
  const total = diasEntre(info.inicio, info.fim);
  const gasto = diasEntre(info.inicio, hoje);
  if (total === null || gasto === null || total <= 0) return null;
  return Math.min(1, Math.max(0, gasto / total));
}

export const ROTULO_STATUS: Record<StatusGarantia, string> = {
  vencida: "Vencida",
  alerta: "A vencer",
  ok: "Coberta",
  sem_info: "Sem registro",
};
