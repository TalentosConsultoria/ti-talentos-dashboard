"""
Dashboard de Inventário de TI — Talentos Consultoria
Execução: streamlit run main.py
"""
import streamlit as st

st.set_page_config(
    page_title="TI Talentos — Inventário",
    page_icon="💻",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Estilo global
st.markdown("""
<style>
[data-testid="stSidebar"] { background: #0C1E35; }
[data-testid="stSidebar"] * { color: #D8E8F5 !important; }
[data-testid="stSidebarNav"] a { border-radius: 6px; padding: 6px 10px; }
[data-testid="stSidebarNav"] a:hover { background: #163354 !important; }
[data-testid="stSidebarNav"] a[aria-selected="true"] { background: #2171B5 !important; }
.block-container { padding-top: 1.5rem; }
.stMetric { background: #EEF3F9; border-radius: 8px; padding: 12px; }
</style>
""", unsafe_allow_html=True)

pages = {
    "Inventário": [
        st.Page("pages/inventario.py",  title="Inventário",         icon="📦"),
        st.Page("pages/ficha.py",       title="Ficha do Equipamento",icon="🖥️"),
    ],
    "Nota Fiscal": [
        st.Page("pages/lancar_nf.py",   title="Lançar NF-e",        icon="📄"),
        st.Page("pages/pecas.py",       title="Peças Trocadas",      icon="🔧"),
    ],
    "Gestão": [
        st.Page("pages/garantias.py",   title="Garantias",           icon="🛡️"),
        st.Page("pages/relatorios.py",  title="Relatórios",          icon="📊"),
    ],
}

pg = st.navigation(pages)
pg.run()
