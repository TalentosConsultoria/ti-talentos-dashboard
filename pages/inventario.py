"""Página: Inventário completo com filtros e métricas."""
import streamlit as st
import pandas as pd
from datetime import date
from utils.db import get_client, equipamentos_lista, garantia_efetiva, dias_restantes

st.title("📦 Inventário de TI")

sb = get_client()

# ── Filtros ────────────────────────────────────────────────────────────────────
with st.expander("🔍 Filtros", expanded=True):
    col1, col2, col3, col4 = st.columns([2, 2, 2, 1])
    busca      = col1.text_input("Buscar (TAL / serial / modelo / usuário)", placeholder="ex: TAL0045 ou DELL")
    filtro_loc = col2.text_input("Local / Unidade", placeholder="ex: SP")
    tipos      = ["", "Desktop", "Notebook", "Servidor", "Impressora", "Monitor", "Switch", "Nobreak", "Celular"]
    filtro_tipo = col3.selectbox("Tipo", tipos)
    obsoletos  = col4.checkbox("Ver baixados")

rows = equipamentos_lista(sb, obsoletos=obsoletos,
                           tipo=filtro_tipo or None,
                           local=filtro_loc or None,
                           busca=busca or None)

# ── Métricas ──────────────────────────────────────────────────────────────────
def gar_status(row):
    d, _ = garantia_efetiva(row)
    dias  = dias_restantes(d)
    if dias is None:    return "sem_info"
    if dias < 0:        return "vencida"
    if dias <= 90:      return "alerta"
    return "ok"

total  = len(rows)
ativas = sum(1 for r in rows if not r.get("obsoleto"))
g_ven  = sum(1 for r in rows if gar_status(r) == "vencida")
g_ale  = sum(1 for r in rows if gar_status(r) == "alerta")

m1, m2, m3, m4 = st.columns(4)
m1.metric("Total ativo", ativas)
m2.metric("Garantias vencidas", g_ven, delta_color="inverse")
m3.metric("Garantias a vencer (90 d)", g_ale, delta_color="inverse")
m4.metric("Total no filtro", total)

st.divider()

# ── Tabela ────────────────────────────────────────────────────────────────────
def fmt_date(v):
    if not v: return ""
    try:
        return date.fromisoformat(str(v)[:10]).strftime("%d/%m/%Y")
    except Exception:
        return str(v)


def gar_label(row):
    d, origem = garantia_efetiva(row)
    dias = dias_restantes(d)
    if dias is None: return "—"
    if dias < 0:     return f"🔴 Vencida há {abs(dias)}d ({origem})"
    if dias <= 90:   return f"🟡 {dias}d ({origem})"
    return f"🟢 {dias}d ({origem})"


df_data = []
for r in rows:
    df_data.append({
        "Controle":  r.get("controle",""),
        "Tipo":      r.get("tipo",""),
        "Marca":     r.get("marca",""),
        "Modelo":    r.get("modelo",""),
        "Serial":    r.get("serial",""),
        "Local":     r.get("local",""),
        "Usuário":   r.get("usuario",""),
        "Status":    r.get("status",""),
        "Garantia":  gar_label(r),
        "Compra":    fmt_date(r.get("data_compra")),
        "Fornecedor":r.get("fornecedor",""),
    })

if not df_data:
    st.info("Nenhum equipamento encontrado com os filtros aplicados.")
else:
    df = pd.DataFrame(df_data)
    sel = st.dataframe(
        df,
        use_container_width=True,
        hide_index=True,
        selection_mode="single-row",
        on_select="rerun",
        column_config={
            "Garantia": st.column_config.TextColumn("Garantia", width="medium"),
        },
    )

    # Ao selecionar uma linha → navega para a ficha
    if sel and sel.selection.rows:
        idx      = sel.selection.rows[0]
        controle = df_data[idx]["Controle"]
        st.session_state["ficha_controle"] = controle
        st.info(f"Equipamento selecionado: **{controle}** — acesse a ficha pelo menu lateral.")
