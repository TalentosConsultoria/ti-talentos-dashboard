import "server-only";
import { cert, getApps, initializeApp, applicationDefault, type App } from "firebase-admin/app";
import { getFirestore, Timestamp, type DocumentSnapshot, type Firestore } from "firebase-admin/firestore";
import type { Equipamento, HistoricoUso, Peca } from "./types";

/**
 * Leitura do Firestore no servidor, com a MESMA service account do Streamlit
 * (FIREBASE_SERVICE_ACCOUNT_JSON). As regras do Firestore continuam fechadas
 * para clientes web: nada de credencial do banco chega ao navegador.
 */
let app: App | null = null;

export function firestoreConfigurado(): boolean {
  return !!(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS);
}

function db(): Firestore {
  if (!app) {
    app = getApps()[0] ?? null;
  }
  if (!app) {
    const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    app = initializeApp({
      credential: json ? cert(JSON.parse(json)) : applicationDefault(),
    });
  }
  return getFirestore(app);
}

/** Timestamp -> "AAAA-MM-DD"; demais valores ficam serializáveis. */
function normalizarValor(v: unknown): unknown {
  if (v instanceof Timestamp) return v.toDate().toISOString().slice(0, 10);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (v === undefined) return null;
  if (Array.isArray(v)) return v.map(normalizarValor);
  if (v && typeof v === "object") {
    if ("toDate" in v && typeof (v as { toDate: unknown }).toDate === "function") {
      return ((v as { toDate: () => Date }).toDate()).toISOString().slice(0, 10);
    }
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, normalizarValor(x)]));
  }
  return v;
}

function docParaObjeto<T>(doc: DocumentSnapshot): T {
  const dados = (doc.data() ?? {}) as Record<string, unknown>;
  const out: Record<string, unknown> = { _docId: doc.id };
  for (const [k, v] of Object.entries(dados)) out[k] = normalizarValor(v);
  return out as T;
}

export async function fsEquipamentos(): Promise<Equipamento[]> {
  const snap = await db().collection("equipamentos").get();
  return snap.docs.map((d) => {
    const e = docParaObjeto<Equipamento>(d);
    e.controle = String(e.controle ?? "").trim();
    return e;
  });
}

export async function fsEquipamento(controle: string): Promise<Equipamento | null> {
  const snap = await db()
    .collection("equipamentos")
    .where("controle", "==", controle.toUpperCase())
    .limit(1)
    .get();
  return snap.empty ? null : docParaObjeto<Equipamento>(snap.docs[0]);
}

export async function fsHistoricoUso(equipamentoId: string): Promise<HistoricoUso[]> {
  const snap = await db().collection("historico_uso").where("equipamento_id", "==", equipamentoId).get();
  return snap.docs
    .map((d) => docParaObjeto<HistoricoUso>(d))
    .sort((a, b) => (a.data_transferencia ?? "").localeCompare(b.data_transferencia ?? ""));
}

export async function fsPecas(equipamentoId?: string): Promise<Peca[]> {
  const col = db().collection("historico_pecas");
  const snap = equipamentoId ? await col.where("equipamento_id", "==", equipamentoId).get() : await col.get();
  return snap.docs
    .map((d) => {
      const p = docParaObjeto<Peca>(d);
      p.valor = p.valor === null || p.valor === undefined ? null : Number(p.valor);
      return p;
    })
    .sort((a, b) => (b.data ?? "").localeCompare(a.data ?? ""));
}
