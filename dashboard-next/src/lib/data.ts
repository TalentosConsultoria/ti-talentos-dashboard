import "server-only";
import { cache } from "react";
import { requireUser } from "./auth";
import { isProduction } from "./cf-access";
import { hojeISO } from "./datas";
import { firestoreConfigurado, fsEquipamento, fsEquipamentos, fsHistoricoUso, fsPecas } from "./firestore";
import { gerarMock } from "./mock";
import { equipId, type Equipamento, type HistoricoUso, type Peca, type PecaComEquipamento } from "./types";

export type FonteDados = "firestore" | "mock";

/**
 * Escolhe a fonte de dados. Em produção só existe Firestore: sem credencial,
 * a leitura falha (nunca mostra dados de demonstração no ar).
 */
export function fonteDados(): FonteDados {
  const pedida = (process.env.DATA_SOURCE ?? "").trim().toLowerCase();
  if (pedida === "mock") {
    if (isProduction()) throw new Error("DATA_SOURCE=mock não é permitido em produção.");
    return "mock";
  }
  if (pedida === "firestore" || firestoreConfigurado()) return "firestore";
  if (isProduction()) {
    throw new Error("Firestore não configurado: defina FIREBASE_SERVICE_ACCOUNT_JSON no serviço.");
  }
  return "mock";
}

export function fonteDadosSegura(): FonteDados | "erro" {
  try {
    return fonteDados();
  } catch {
    return "erro";
  }
}

/** Todos os equipamentos, inclusive baixados (o filtro é feito na interface). */
export const getEquipamentos = cache(async (): Promise<Equipamento[]> => {
  await requireUser();
  const lista = fonteDados() === "mock" ? gerarMock(hojeISO()).equipamentos : await fsEquipamentos();
  return [...lista].sort((a, b) => a.controle.localeCompare(b.controle));
});

export const getEquipamento = cache(async (controle: string): Promise<Equipamento | null> => {
  await requireUser();
  const alvo = controle.trim().toUpperCase();
  if (!/^[A-Z0-9-]{1,32}$/.test(alvo)) return null;
  if (fonteDados() === "mock") return gerarMock(hojeISO()).equipamentos.find((e) => e.controle === alvo) ?? null;
  return fsEquipamento(alvo);
});

export async function getHistoricoUso(e: Equipamento): Promise<HistoricoUso[]> {
  await requireUser();
  const id = equipId(e);
  if (fonteDados() === "mock") {
    return gerarMock(hojeISO()).historico.filter((h) => h.equipamento_id === id);
  }
  return fsHistoricoUso(id);
}

export async function getPecasDoEquipamento(e: Equipamento): Promise<Peca[]> {
  await requireUser();
  const id = equipId(e);
  try {
    if (fonteDados() === "mock") return gerarMock(hojeISO()).pecas.filter((p) => p.equipamento_id === id);
    return await fsPecas(id);
  } catch {
    // Mesmo comportamento do Streamlit: coleção ausente = lista vazia.
    return [];
  }
}

/** Todas as peças, enriquecidas com o equipamento (substitui o lookup N+1 do Streamlit). */
export async function getPecasCompleto(): Promise<PecaComEquipamento[]> {
  await requireUser();
  const [pecas, equipamentos] = await Promise.all([
    fonteDados() === "mock"
      ? Promise.resolve([...gerarMock(hojeISO()).pecas].sort((a, b) => (b.data ?? "").localeCompare(a.data ?? "")))
      : fsPecas().catch(() => [] as Peca[]),
    getEquipamentos(),
  ]);
  const mapa = new Map<string, Equipamento>();
  for (const e of equipamentos) {
    mapa.set(e._docId, e);
    if (e.id) mapa.set(e.id, e);
  }
  return pecas.map((p) => {
    const e = p.equipamento_id ? mapa.get(p.equipamento_id) : undefined;
    return {
      ...p,
      equipamento: e
        ? { controle: e.controle, tipo: e.tipo, marca: e.marca, modelo: e.modelo, local: e.local, usuario: e.usuario }
        : null,
    };
  });
}
