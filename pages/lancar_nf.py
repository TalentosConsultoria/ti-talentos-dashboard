"""Página: Lançar NF-e — associar chave a equipamento ou peça e baixar via SEFAZ."""
import streamlit as st
from datetime import date
from utils.db import get_client, equipamento_get, equipamento_update
from utils.nf_utils import (
    parse_chave, baixar_via_api_livre, baixar_via_certificado,
    pdf_local, pasta_nf,
)

st.title("📄 Lançar NF-e")
st.caption("Informe apenas a chave de acesso (44 dígitos). O download do PDF e XML é automático.")

sb = get_client()

# ── Formulário principal ───────────────────────────────────────────────────────
with st.form("form_nf"):
    col1, col2 = st.columns([3, 1])
    chave = col1.text_input(
        "Chave de acesso (44 dígitos)",
        placeholder="00000000000000000000000000000000000000000000",
        max_chars=44,
    )
    controle = col2.text_input("Código TAL", placeholder="TAL0045")

    tipo_nf = st.radio(
        "Esta NF é de:",
        ["Compra do equipamento", "Peça / manutenção"],
        horizontal=True,
    )

    usar_cert = st.checkbox(
        "Usar Certificado Digital A1 (qualquer data, sem restrição)",
        value=True,
        help="Requer SEFAZ_CERT_PATH, SEFAZ_CERT_PASSWORD e TALENTOS_CNPJ configurados.",
    )

    enviado = st.form_submit_button("⬇️ Baixar NF-e e associar", type="primary")

if enviado:
    chave    = chave.strip().replace(" ", "").replace(".", "")
    controle = controle.strip().upper()

    # ── Validações ──────────────────────────────────────────────────────────
    erros = []
    if len(chave) != 44 or not chave.isdigit():
        erros.append("Chave deve ter exatamente 44 dígitos numéricos.")
    if not controle:
        erros.append("Informe o código TAL.")
    elif not controle.startswith("TAL"):
        erros.append("Código TAL deve começar com 'TAL' (ex: TAL0045).")

    if erros:
        for e in erros:
            st.error(e)
        st.stop()

    # ── Verifica se equipamento existe ──────────────────────────────────────
    equip = equipamento_get(sb, controle)
    if not equip:
        st.error(f"Equipamento {controle} não encontrado no inventário.")
        st.stop()

    # ── Exibe info da chave ──────────────────────────────────────────────────
    info = parse_chave(chave)
    if info:
        c1, c2, c3, c4 = st.columns(4)
        c1.metric("Tipo", info["modelo"])
        c2.metric("Emissão", info["emissao"])
        c3.metric("UF", info["uf"])
        c4.metric("N.º NF", info["numero"])
        st.caption(f"Emitente CNPJ: {info['cnpj']} · Série {info['serie']}")

    # ── Download ──────────────────────────────────────────────────────────────
    with st.spinner("Baixando NF-e do SEFAZ..."):
        if usar_cert:
            ok, msg = baixar_via_certificado(chave, controle)
        else:
            ok, msg = baixar_via_api_livre(chave, controle)

    if ok:
        st.success(f"✅ NF-e baixada com sucesso!")
    else:
        st.warning(f"⚠️ {msg}")
        if not usar_cert:
            st.info("Tente marcar 'Usar Certificado Digital A1' para baixar NF-es antigas.")

    # ── Associa ao equipamento ────────────────────────────────────────────────
    if tipo_nf == "Compra do equipamento":
        campos = {"chave_nf": chave}
        if info.get("cnpj"):
            campos["fornecedor"] = info["cnpj"]
        equipamento_update(sb, controle, campos)
        st.success(f"✅ Chave associada ao equipamento {controle}.")

    # ── Exibe PDF se disponível ───────────────────────────────────────────────
    pdf = pdf_local(controle)
    if pdf:
        st.divider()
        st.subheader("📄 DANFE")
        with open(pdf, "rb") as f:
            st.download_button(
                label="⬇️ Baixar DANFE (PDF)",
                data=f.read(),
                file_name=pdf.name,
                mime="application/pdf",
            )
        st.caption(f"Arquivo: {pdf}")
    elif ok:
        p = pasta_nf() / f"{controle}.pdf"
        if p.exists():
            with open(p, "rb") as f:
                st.download_button("⬇️ Baixar DANFE (PDF)", f.read(),
                                   file_name=p.name, mime="application/pdf")

# ── NF-es já arquivadas ────────────────────────────────────────────────────────
st.divider()
st.subheader("📁 NF-es arquivadas")

pasta = pasta_nf()
pdfs  = sorted(pasta.glob("*.pdf")) if pasta.exists() else []
if pdfs:
    for p in pdfs:
        ctrl_nome = p.stem
        col_a, col_b = st.columns([4, 1])
        col_a.write(f"📄 `{p.name}`")
        with open(p, "rb") as f:
            col_b.download_button("Baixar", f.read(),
                                  file_name=p.name, mime="application/pdf",
                                  key=f"dl_{p.stem}")
else:
    st.info("Nenhuma NF-e arquivada ainda. Use o formulário acima para baixar a primeira.")
