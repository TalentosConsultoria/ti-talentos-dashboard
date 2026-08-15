"""Página: Relatórios — ficha PDF e gráfico de idade do parque."""
import streamlit as st
import subprocess
import sys
from pathlib import Path
from datetime import date
from utils.db import get_client, equipamentos_lista, garantia_efetiva, dias_restantes

st.title("📊 Relatórios")

sb  = get_client()
tab1, tab2 = st.tabs(["📄 Ficha do Equipamento (PDF)", "📈 Parque de TI"])

SCRIPTS = Path(__file__).parent.parent.parent / "scripts"

# ── Ficha PDF ─────────────────────────────────────────────────────────────────
with tab1:
    st.subheader("Gerar ficha individual em PDF")
    col1, col2 = st.columns([2, 1])
    controle = col1.text_input("Código TAL", placeholder="TAL0045")
    saida    = col2.text_input("Nome do arquivo", placeholder="ficha_TAL0045.pdf")

    if st.button("📥 Gerar PDF", type="primary", disabled=not controle):
        controle = controle.strip().upper()
        nome_saida = saida.strip() or f"ficha_{controle}.pdf"
        script = SCRIPTS / "gerar_relatorio.py"

        with st.spinner(f"Gerando ficha para {controle}..."):
            res = subprocess.run(
                [sys.executable, str(script), "--controle", controle, "--saida", nome_saida],
                capture_output=True, text=True,
            )

        pdf_path = Path(nome_saida)
        if pdf_path.exists():
            with open(pdf_path, "rb") as f:
                st.download_button(
                    f"⬇️ Baixar {nome_saida}",
                    f.read(),
                    file_name=nome_saida,
                    mime="application/pdf",
                    type="primary",
                )
            st.success("Ficha gerada com sucesso!")
        else:
            st.error("Falha ao gerar PDF.")
            if res.stderr:
                st.code(res.stderr, language="text")

# ── Gráfico de idade ──────────────────────────────────────────────────────────
with tab2:
    st.subheader("Idade do parque de TI")

    rows = equipamentos_lista(sb)
    hoje = date.today()

    def faixa(data_str):
        if not data_str:
            return "Sem data"
        try:
            d    = date.fromisoformat(str(data_str)[:10])
            anos = (hoje - d).days / 365.25
            if anos < 2:   return "Menos de 2 anos"
            if anos < 4:   return "2 a 4 anos"
            if anos < 6:   return "4 a 6 anos"
            if anos < 8:   return "6 a 8 anos"
            return "Mais de 8 anos (obsoleto)"
        except Exception:
            return "Sem data"

    contagem = {}
    tipos_eq  = {}
    for r in rows:
        if r.get("tipo") not in ("Desktop","Notebook","Servidor"):
            continue
        f = faixa(r.get("data_compra"))
        contagem[f] = contagem.get(f, 0) + 1

    ordem = [
        "Menos de 2 anos",
        "2 a 4 anos",
        "4 a 6 anos",
        "6 a 8 anos",
        "Mais de 8 anos (obsoleto)",
        "Sem data",
    ]
    labels = [o for o in ordem if o in contagem]
    values = [contagem[o] for o in labels]

    if labels:
        import pandas as pd
        df_graf = pd.DataFrame({"Faixa etária": labels, "Qtd": values})
        st.bar_chart(df_graf.set_index("Faixa etária"), use_container_width=True, color="#2171B5")
        st.dataframe(df_graf, use_container_width=True, hide_index=True)

        total = sum(values)
        obs   = contagem.get("Mais de 8 anos (obsoleto)", 0)
        st.metric("Computadores ativos",          total)
        st.metric("Obsoletos (mais de 8 anos)",   obs, delta_color="inverse")
    else:
        st.info("Nenhum computador cadastrado com data de compra.")

    st.divider()
    st.subheader("Garantias a vencer nos próximos 90 dias")
    script_gar = SCRIPTS / "relatorio_garantia.py"
    if st.button("▶️ Gerar relatório de garantias"):
        res = subprocess.run(
            [sys.executable, str(script_gar), "--dias", "90", "--todos"],
            capture_output=True, text=True,
        )
        st.code(res.stdout or res.stderr, language="text")
