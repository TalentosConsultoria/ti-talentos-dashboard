/** Documento da coleção `equipamentos` (Firestore), já normalizado para JSON. */
export type Equipamento = {
  /** ID do documento no Firestore (= UUID herdado do Supabase). */
  _docId: string;
  id?: string | null;
  controle: string;
  nome_dispositivo?: string | null;
  tipo?: string | null;
  marca?: string | null;
  modelo?: string | null;
  serial?: string | null;
  setor?: string | null;
  local?: string | null;
  usuario?: string | null;
  so?: string | null;
  processador?: string | null;
  memoria?: string | null;
  disco?: string | null;
  status?: string | null;
  termino_garantia?: string | null;
  garantia_extendida_ate?: string | null;
  garantia_fornecedor_ate?: string | null;
  garantia_dell_inicio?: string | null;
  garantia_dell_fim?: string | null;
  data_compra?: string | null;
  data_incorporacao?: string | null;
  fornecedor?: string | null;
  tipo_aquisicao?: string | null;
  obsoleto?: boolean | null;
  chave_nf?: string | null;
  data_baixa?: string | null;
  motivo_baixa?: string | null;
};

/** Documento da coleção `historico_uso`. */
export type HistoricoUso = {
  _docId: string;
  equipamento_id?: string | null;
  data_transferencia?: string | null;
  usuario_anterior?: string | null;
  usuario_novo?: string | null;
  local_novo?: string | null;
  motivo?: string | null;
};

/** Documento da coleção `historico_pecas`. */
export type Peca = {
  _docId: string;
  equipamento_id?: string | null;
  data?: string | null;
  peca?: string | null;
  descricao?: string | null;
  fabricante?: string | null;
  fornecedor?: string | null;
  valor?: number | null;
  tecnico?: string | null;
  nf?: string | null;
  garantia_peca_ate?: string | null;
};

export type PecaComEquipamento = Peca & {
  equipamento: Pick<Equipamento, "controle" | "tipo" | "marca" | "modelo" | "local" | "usuario"> | null;
};

/** Chave estável do equipamento para cruzar com historico_uso / historico_pecas. */
export function equipId(e: Pick<Equipamento, "id" | "_docId">): string {
  return e.id || e._docId;
}
