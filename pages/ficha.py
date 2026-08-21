"""Página: Ficha completa de um equipamento."""
import streamlit as st
from datetime import date
from utils.db import (
    get_client, equipamento_get, historico_uso_get,
    pecas_get, garantia_efetiva, dias_restantes,
)
from utils.nf_utils import pdf_local, xml_local, parse_chave

st.title("🖥️ Ficha do Equipamento")

sb = get_client()

# ── Seleção do equipamento ─────────────────────────────────────────────────────
default = st.session_state.get("ficha_controle", "")
controle_input = st.text_input("Código TAL", value=default, placeholder="TAL0045")
controle = controle_input.strip().upper()

if not controle:
    st.info("Informe um código TAL para visualizar a ficha.")
    st.stop()

e = equipamento_get(sb, controle)
if not e:
    st.error(f"Equipamento {controle} não encontrado.")
    st.stop()

st.session_state["ficha_controle"] = controle

# ── Header ────────────────────────────────────────────────────────────────────
def fmt_date(v):
    if not v: return "—"
    try:
        return date.fromisoformat(str(v)[:10]).strftime("%d/%m/%Y")
    except Exception:
        return str(v)

def gar_color(dias):
    if dias is None: return "gray"
    if dias < 0:     return "red"
    if dias <= 90:   return "orange"
    return "green"

col_a, col_b = st.columns([3, 1])
col_a.markdown(f"### {e.get('marca','')} {e.get('modelo','')}")
col_a.caption(f"{e.get('tipo','')} · {e.get('local','')} · {e.get('usuario','')}")

d_ef, origem_ef = garantia_efetiva(e)
dias_ef = dias_restantes(d_ef)
cor = gar_color(dias_ef)

if dias_ef is not None:
    if dias_ef < 0:
        col_b.error(f"🔴 Garantia vencida há {abs(dias_ef)} dias")
    elif dias_ef <= 90:
        col_b.warning(f"🟡 Garantia vence em {dias_ef} dias")
    else:
        col_b.success(f"🟢 Garantia OK ({dias_ef} dias)")
else:
    col_b.info("Sem garantia registrada")

st.divider()

# ── Tabs ──────────────────────────────────────────────────────────────────────
tab1, tab2, tab3, tab4 = st.tabs(["📋 Identificação", "📄 Nota Fiscal", "👥 Histórico de uso", "🔧 Peças"])

# ── Tab 1: Identificação ──────────────────────────────────────────────────────
with tab1:
    col1, col2, col3 = st.columns(3)
    col1.markdown(f"**Tipo:** {e.get('tipo','—')}")
    col1.markdown(f"**Marca:** {e.get('marca','—')}")
    col1.markdown(f"**Modelo:** {e.get('modelo','—')}")
    col1.markdown(f"**Serial:** `{e.get('serial','—')}`")

    col2.markdown(f"**Processador:** {e.get('processador','—')}")
    col2.markdown(f"**RAM:** {e.get('memoria','—')}")
    col2.markdown(f"**Disco:** {e.get('disco','—')}")
    col2.markdown(f"**SO:** {e.get('so','—')}")

    col3.markdown(f"**Local:** {e.get('local','—')}")
    col3.markdown(f"**Setor:** {e.get('setor','—')}")
    col3.markdown(f"**Usuário:** {e.get('usuario','—')}")
    col3.markdown(f"**Status:** {e.get('status','—')}")

    st.markdown("---")
    col4, col5, col6 = st.columns(3)
    col4.markdown(f"**Data de compra:** {fmt_date(e.get('data_compra'))}")
    col4.markdown(f"**Fornecedor:** {e.get('fornecedor','—')}")
    col5.markdown(f"**Gar. original:** {fmt_date(e.get('termino_garantia'))}")
    col5.markdown(f"**Gar. fornecedor:** {fmt_date(e.get('garantia_fornecedor_ate'))}")
    col6.markdown(f"**Gar. estendida:** {fmt_date(e.get('garantia_extendida_ate'))}")
    col6.markdown(f"**Cobertura ativa:** {origem_ef} — {fmt_date(d_ef)}")

    if e.get("obsoleto"):
        st.error(f"⚠️ Equipamento baixado em {fmt_date(e.get('data_baixa'))} · {e.get('motivo_baixa','')}")

    # Gerar PDF
    st.markdown("---")
    if st.button("📥 Gerar ficha PDF", type="secondary"):
        import subprocess, sys
        from pathlib import Path
        script = Path(__file__).parent.parent / "scripts" / "gerar_relatorio.py"
        saida  = f"ficha_{controle}.pdf"
        res = subprocess.run([sys.executable, str(script), "--controle", controle, "--saida", saida],
                             capture_output=True, text=True)
        from pathlib import Path as P
        pdf = P(saida)
        if pdf.exists():
            with open(pdf, "rb") as f:
                st.download_button("⬇️ Baixar ficha PDF", f.read(),
                                   file_name=saida, mime="application/pdf")
        else:
            st.error(f"Erro ao gerar: {res.stderr}")


# ── Tab 2: Nota Fiscal ────────────────────────────────────────────────────────
with tab2:
    chave_nf = e.get("chave_nf")
    if chave_nf:
        info = parse_chave(chave_nf)
        if info:
            c1, c2, c3, c4 = st.columns(4)
            c1.metric("Modelo", info["modelo"])
            c2.metric("Emissão", info["emissao"])
            c3.metric("N.º NF", info["numero"])
            c4.metric("UF", info["uf"])
            st.caption(f"Emitente: CNPJ {info['cnpj']} · Série {info['serie']}")

        st.markdown(f"**Chave de acesso:**")
        st.code(chave_nf, language=None)

        pdf = pdf_local(controle)
        if pdf:
            st.success("✅ DANFE arquivado localmente")
            with open(pdf, "rb") as f:
                st.download_button("📄 Exibir / Baixar NF-e (PDF)",
                                   f.read(), file_name=pdf.name, mime="application/pdf",
                                   type="primary")
        else:
            st.warning("DANFE ainda não baixado. Acesse 'Lançar NF-e' para baixar.")
            col_btn1, col_btn2 = st.columns(2)
            if col_btn1.button("⬇️ Baixar agora (via certificado A1)"):
                from utils.nf_utils import baixar_via_certificado
                with st.spinner("Baixando..."):
                    ok, msg = baixar_via_certificado(chave_nf, controle)
                if ok:
                    st.success("✅ PDF baixado!")
                    st.rerun()
                else:
                    st.error(msg)
            if col_btn2.button("⬇️ Baixar agora (API gratuita)"):
                from utils.nf_utils import baixar_via_api_livre
                with st.spinner("Baixando..."):
                    ok, msg = baixar_via_api_livre(chave_nf, controle)
                if ok:
                    st.success("✅ PDF baixado!")
                    st.rerun()
                else:
                    st.warning(msg)
    else:
        st.info("Nenhuma NF-e associada a este equipamento.")
        if st.button("➕ Lançar NF-e para este equipamento"):
            st.session_state["lancar_nf_controle"] = controle
            st.switch_page("pages/lancar_nf.py")


# ── Tab 3: Histórico de uso ────────────────────────────────────────────────────
with tab3:
    hist = historico_uso_get(sb, e["id"])
    if hist:
        import pandas as pd
        df = pd.DataFrame([{
            "Data":             fmt_date(h.get("data_transferencia")),
            "Usuário anterior": h.get("usuario_anterior","—"),
            "Novo usuário":     h.get("usuario_novo","—"),
            "Local novo":       h.get("local_novo","—"),
            "Motivo":           h.get("motivo","—"),
        } for h in hist])
        st.dataframe(df, use_container_width=True, hide_index=True)
    else:
        st.info("Nenhuma transferência registrada.")


# ── Tab 4: Peças ───────────────────────────────────────────────────────────────
with tab4:
    pecas = pecas_get(sb, e["id"])
    total = sum(float(p.get("valor") or 0) for p in pecas)

    if pecas:
        import pandas as pd
        df = pd.DataFrame([{
            "Data":       fmt_date(p.get("data")),
            "Peça":       p.get("peca",""),
            "Fabricante": p.get("fabricante",""),
            "Fornecedor": p.get("fornecedor",""),
            "Valor":      f"R$ {float(p.get('valor') or 0):,.2f}".replace(",","X").replace(".",",").replace("X","."),
            "NF":         (p.get("nf") or "")[:30],
            "Garantia até":fmt_date(p.get("garantia_peca_ate")),
        } for p in pecas])
        st.dataframe(df, use_container_width=True, hide_index=True)
        st.metric("Total em peças", f"R$ {total:,.2f}".replace(",","X").replace(".",",").replace("X","."))
    else:
        st.info("Nenhuma peça registrada.")
