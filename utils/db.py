"""Acesso ao Supabase — funções compartilhadas entre as páginas."""
import os
import streamlit as st
from supabase import create_client, Client
from datetime import date


@st.cache_resource(show_spinner=False)
def get_client() -> Client:
    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_KEY", "")
    if not url or not key:
        st.error("Variáveis SUPABASE_URL e SUPABASE_KEY não configuradas.")
        st.stop()
    return create_client(url, key)


def equipamentos_lista(sb: Client, *, obsoletos=False, tipo=None, local=None, busca=None):
    q = sb.table("equipamentos").select("*")
    if not obsoletos:
        q = q.eq("obsoleto", False)
    if tipo:
        q = q.eq("tipo", tipo)
    if local:
        q = q.ilike("local", f"%{local}%")
    rows = q.order("controle").execute().data

    if busca:
        busca = busca.lower()
        rows = [
            r for r in rows
            if busca in (r.get("controle") or "").lower()
            or busca in (r.get("serial") or "").lower()
            or busca in (r.get("modelo") or "").lower()
            or busca in (r.get("usuario") or "").lower()
        ]
    return rows


def equipamento_get(sb: Client, controle: str) -> dict | None:
    r = sb.table("equipamentos").select("*").eq("controle", controle.upper()).execute()
    return r.data[0] if r.data else None


def equipamento_update(sb: Client, controle: str, campos: dict):
    return sb.table("equipamentos").update(campos).eq("controle", controle.upper()).execute()


def historico_uso_get(sb: Client, equip_id: str) -> list:
    return sb.table("historico_uso").select("*") \
        .eq("equipamento_id", equip_id).order("data_transferencia").execute().data


def pecas_get(sb: Client, equip_id: str) -> list:
    try:
        return sb.table("historico_pecas").select("*") \
            .eq("equipamento_id", equip_id).order("data", desc=True).execute().data
    except Exception:
        return []


def pecas_insert(sb: Client, dados: dict):
    return sb.table("historico_pecas").insert(dados).execute()


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
