"""Página: Garantias — alertas de vencimento."""
import streamlit as st
import pandas as pd
from datetime import date, timedelta
from utils.db import get_client, equipamentos_lista, garantia_efetiva, dias_restantes

st.title("🛡️ Garantias")

sb = get_client()

col1, col2 = st.columns([1, 3])
janela = col1.slider("Alertar vencimentos em até (dias)", 30, 365, 90, step=30)
mostrar_vencidas = col2.checkbox("Incluir já vencidas", value=True)

rows = equipamentos_lista(sb)

vencidas, alerta, ok_list = [], [], []
for r in rows:
    d, origem = garantia_efetiva(r)
    dias = dias_restantes(d)
    if dias is None:
        continue
    entry = {**r, "_dias": dias, "_origem": origem, "_data": d}
    if dias < 0:
        vencidas.append(entry)
    elif dias <= janela:
        alerta.append(entry)
    else:
        ok_list.append(entry)

def fmt_date(v):
    if not v: return "—"
    try:
        return date.fromisoformat(str(v)[:10]).strftime("%d/%m/%Y")
    except Exception:
        return str(v)

def tabela_gar(lista, *, is_vencida=False):
    data = []
    for r in sorted(lista, key=lambda x: x["_data"] or ""):
        d = r["_dias"]
        data.append({
            "Controle":  r.get("controle",""),
            "Tipo":      r.get("tipo",""),
            "Marca":     r.get("marca",""),
            "Modelo":    r.get("modelo",""),
            "Local":     r.get("local",""),
            "Usuário":   r.get("usuario",""),
            "Fornecedor":r.get("fornecedor",""),
            "Tipo Gar.": r.get("_origem",""),
            "Vence em":  fmt_date(r.get("_data")),
            "Situação":  (f"há {abs(d)} dias" if d < 0 else f"em {d} dias"),
        })
    if data:
        df = pd.DataFrame(data)
        st.dataframe(df, use_container_width=True, hide_index=True)
    else:
        st.info("Nenhum equipamento nesta categoria.")

# ── Vencidas ──────────────────────────────────────────────────────────────────
if mostrar_vencidas:
    st.subheader(f"🔴 Garantias vencidas — {len(vencidas)} equipamento(s)")
    tabela_gar(vencidas, is_vencida=True)
    st.divider()

# ── A vencer ──────────────────────────────────────────────────────────────────
st.subheader(f"🟡 A vencer em {janela} dias — {len(alerta)} equipamento(s)")
tabela_gar(alerta)
st.divider()

# ── Resumo ────────────────────────────────────────────────────────────────────
st.subheader("Resumo")
c1, c2, c3 = st.columns(3)
c1.metric("🔴 Vencidas",         len(vencidas))
c2.metric(f"🟡 Vencem em {janela}d", len(alerta))
c3.metric("🟢 OK",               len(ok_list))
