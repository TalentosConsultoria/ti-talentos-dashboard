"""Página: Registrar e consultar peças trocadas."""
import streamlit as st
import pandas as pd
from datetime import date
from utils.db import get_client, equipamentos_lista, equipamento_get, pecas_get, pecas_insert
from utils.nf_utils import parse_chave, baixar_via_api_livre, baixar_via_certificado, pasta_nf

st.title("🔧 Peças Trocadas")

sb = get_client()
tab_novo, tab_hist = st.tabs(["➕ Registrar peça", "📋 Histórico geral"])

# ── Registrar nova peça ────────────────────────────────────────────────────────
with tab_novo:
    st.subheader("Registrar troca de peça")

    with st.form("form_peca"):
        col1, col2 = st.columns(2)
        controle = col1.text_input("Código TAL do equipamento", placeholder="TAL0045")
        data_peca = col2.date_input("Data da troca", value=date.today())

        col3, col4 = st.columns(2)
        peca      = col3.text_input("Peça", placeholder="ex: Memória RAM")
        descricao = col4.text_input("Descrição", placeholder="ex: 8GB DDR4 2400MHz")

        col5, col6, col7 = st.columns(3)
        fabricante = col5.text_input("Fabricante da peça", placeholder="ex: Kingston")
        fornecedor = col6.text_input("Fornecedor / loja", placeholder="ex: Kabum")
        valor      = col7.number_input("Valor (R$)", min_value=0.0, step=0.01, format="%.2f")

        col8, col9 = st.columns(2)
        chave_nf   = col8.text_input("Chave NF-e da peça (44 dígitos)", max_chars=44)
        gar_peca   = col9.date_input("Garantia da peça até", value=None)
        tecnico    = st.text_input("Técnico responsável", value="Marcelo")

        usar_cert = st.checkbox("Baixar NF via certificado A1", value=True)
        salvar    = st.form_submit_button("💾 Salvar", type="primary")

    if salvar:
        controle = controle.strip().upper()
        equip = equipamento_get(sb, controle)
        if not equip:
            st.error(f"Equipamento {controle} não encontrado.")
            st.stop()
        if not peca:
            st.error("Informe o nome da peça.")
            st.stop()

        # Download da NF da peça se chave fornecida
        chave_clean = chave_nf.strip().replace(" ","").replace(".","")
        nf_arquivo  = None
        if len(chave_clean) == 44 and chave_clean.isdigit():
            tag = f"{controle}_peca_{chave_clean[:8]}"
            with st.spinner("Baixando NF da peça..."):
                if usar_cert:
                    ok, msg = baixar_via_certificado(chave_clean, tag)
                else:
                    ok, msg = baixar_via_api_livre(chave_clean, tag)
            if ok:
                st.success("✅ NF da peça baixada!")
            else:
                st.warning(f"Não foi possível baixar a NF: {msg}")

        dados = {
            "equipamento_id":   equip["id"],
            "data":             data_peca.isoformat(),
            "peca":             peca,
            "descricao":        descricao or None,
            "fabricante":       fabricante or None,
            "fornecedor":       fornecedor or None,
            "valor":            float(valor) if valor else None,
            "tecnico":          tecnico or "Marcelo",
            "nf":               chave_clean if len(chave_clean) == 44 else (chave_nf or None),
            "garantia_peca_ate": gar_peca.isoformat() if gar_peca else None,
        }
        pecas_insert(sb, dados)
        st.success(f"✅ Peça '{peca}' registrada em {controle}.")

# ── Histórico geral de peças ───────────────────────────────────────────────────
with tab_hist:
    st.subheader("Histórico geral de peças")

    busca = st.text_input("Filtrar por TAL, peça ou fornecedor", placeholder="ex: RAM ou TAL0045")

    # Busca todas as peças via join
    try:
        res = sb.table("historico_pecas").select(
            "*, equipamentos(controle, tipo, marca, modelo, local, usuario)"
        ).order("data", desc=True).execute()
        todas = res.data or []
    except Exception:
        todas = []

    def fmt_date(v):
        if not v: return "—"
        try: return date.fromisoformat(str(v)[:10]).strftime("%d/%m/%Y")
        except: return str(v)

    if busca:
        busca_l = busca.lower()
        todas = [p for p in todas
                 if busca_l in (p.get("equipamentos",{}) or {}).get("controle","").lower()
                 or busca_l in (p.get("peca","") or "").lower()
                 or busca_l in (p.get("fornecedor","") or "").lower()]

    if todas:
        df = pd.DataFrame([{
            "Data":       fmt_date(p.get("data")),
            "TAL":        (p.get("equipamentos") or {}).get("controle",""),
            "Tipo":       (p.get("equipamentos") or {}).get("tipo",""),
            "Peça":       p.get("peca",""),
            "Fabricante": p.get("fabricante",""),
            "Fornecedor": p.get("fornecedor",""),
            "Valor":      f"R$ {float(p.get('valor') or 0):,.2f}".replace(",","X").replace(".",",").replace("X","."),
            "NF":         (p.get("nf") or "")[:20],
            "Gar. até":   fmt_date(p.get("garantia_peca_ate")),
        } for p in todas])
        total_geral = sum(float(p.get("valor") or 0) for p in todas)
        st.dataframe(df, use_container_width=True, hide_index=True)
        st.metric("Total em peças (filtro)", f"R$ {total_geral:,.2f}".replace(",","X").replace(".",",").replace("X","."))
    else:
        st.info("Nenhuma peça encontrada.")
