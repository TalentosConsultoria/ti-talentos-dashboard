"""Acesso ao Firestore — funções compartilhadas entre as páginas."""
import os
import json
import streamlit as st
import firebase_admin
from firebase_admin import credentials, firestore as fstore
from datetime import date


def _exigir_sessao_autenticada() -> None:
    """
    Defesa em profundidade: nenhuma página toca o banco sem que main.py
    tenha autenticado a requisição. Se o guard de auth for removido ou
    contornado, o acesso a dados falha fechado.
    """
    if not st.session_state.get("user"):
        st.error("Sessão não autenticada. Acesse o portal pelo endereço oficial.")
        st.stop()


@st.cache_resource(show_spinner=False)
def _init_firebase() -> None:
    if firebase_admin._apps:
        return
    sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON", "")
    if sa_json:
        cred = credentials.Certificate(json.loads(sa_json))
    else:
        # Fallback para arquivo local (desenvolvimento)
        path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "./serviceAccountKey.json")
        cred = credentials.Certificate(path)
    firebase_admin.initialize_app(cred)


def get_client():
    _exigir_sessao_autenticada()
    _init_firebase()
    return fstore.client()


def _doc_to_dict(doc) -> dict:
    d = doc.to_dict() or {}
    d.setdefault("_doc_id", doc.id)
    return d


def equipamentos_lista(db, *, obsoletos=False, tipo=None, local=None, busca=None):
    q = db.collection("equipamentos")
    if not obsoletos:
        q = q.where("obsoleto", "==", False)
    if tipo:
        q = q.where("tipo", "==", tipo)
    rows = [_doc_to_dict(d) for d in q.stream()]

    # ilike e busca livre — feitos em Python (Firestore não suporta)
    if local:
        local_l = local.lower()
        rows = [r for r in rows if local_l in (r.get("local") or "").lower()]
    if busca:
        busca_l = busca.lower()
        rows = [
            r for r in rows
            if busca_l in (r.get("controle") or "").lower()
            or busca_l in (r.get("serial") or "").lower()
            or busca_l in (r.get("modelo") or "").lower()
            or busca_l in (r.get("usuario") or "").lower()
        ]

    rows.sort(key=lambda r: r.get("controle") or "")
    return rows


def equipamento_get(db, controle: str) -> dict | None:
    docs = list(
        db.collection("equipamentos")
        .where("controle", "==", controle.upper())
        .limit(1)
        .stream()
    )
    return _doc_to_dict(docs[0]) if docs else None


def equipamento_update(db, controle: str, campos: dict):
    docs = list(
        db.collection("equipamentos")
        .where("controle", "==", controle.upper())
        .limit(1)
        .stream()
    )
    if docs:
        docs[0].reference.update(campos)


def historico_uso_get(db, equip_id: str) -> list:
    docs = (
        db.collection("historico_uso")
        .where("equipamento_id", "==", equip_id)
        .stream()
    )
    rows = [_doc_to_dict(d) for d in docs]
    rows.sort(key=lambda r: r.get("data_transferencia") or "")
    return rows


def pecas_get(db, equip_id: str) -> list:
    try:
        docs = (
            db.collection("historico_pecas")
            .where("equipamento_id", "==", equip_id)
            .stream()
        )
        rows = [_doc_to_dict(d) for d in docs]
        rows.sort(key=lambda r: r.get("data") or "", reverse=True)
        return rows
    except Exception:
        return []


def pecas_insert(db, dados: dict):
    db.collection("historico_pecas").add(dados)


def pecas_historico_completo(db) -> list:
    """Todas as peças com dados do equipamento — equivalente ao join Supabase."""
    try:
        docs = (
            db.collection("historico_pecas")
            .order_by("data", direction="DESCENDING")
            .stream()
        )
        todas = [_doc_to_dict(d) for d in docs]

        # Enriquece com dados do equipamento (lookup por document ID = UUID Supabase)
        equip_ids = {p.get("equipamento_id") for p in todas if p.get("equipamento_id")}
        equip_map = {}
        for eid in equip_ids:
            doc = db.collection("equipamentos").document(eid).get()
            if doc.exists:
                d = doc.to_dict() or {}
                equip_map[eid] = {
                    k: d.get(k, "")
                    for k in ("controle", "tipo", "marca", "modelo", "local", "usuario")
                }

        for p in todas:
            p["equipamentos"] = equip_map.get(p.get("equipamento_id"), {})
        return todas
    except Exception:
        return []


def garantia_efetiva(row: dict) -> tuple[str | None, str]:
    """Retorna (data_iso, origem) — a garantia válida mais longa."""
    opcoes = [
        (row.get("garantia_extendida_ate"), "Estendida"),
        (row.get("garantia_fornecedor_ate"), "Fornecedor"),
        (row.get("termino_garantia"), "Original"),
    ]
    validas = [(d, o) for d, o in opcoes if d]
    if not validas:
        return None, "—"
    return max(validas, key=lambda x: x[0])


def dias_restantes(data_iso: str | None) -> int | None:
    if not data_iso:
        return None
    try:
        return (date.fromisoformat(str(data_iso)[:10]) - date.today()).days
    except Exception:
        return None
