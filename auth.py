"""
Autenticação Microsoft (Azure AD) via MSAL.
Fluxo: Authorization Code com client secret (ConfidentialClientApplication).

Variáveis necessárias (Streamlit secrets ou env):
  AZURE_CLIENT_ID     → ID do aplicativo registrado no Azure AD
  AZURE_CLIENT_SECRET → Segredo do aplicativo
  AZURE_TENANT_ID     → ID do tenant (diretório) da Talentos
  REDIRECT_URI        → URL do app no Streamlit Cloud (ex: https://talentos-ti.streamlit.app)
  ALLOWED_DOMAIN      → Domínio permitido, ex: talentosconsultoria.com.br (opcional)
"""
import os
import msal
import streamlit as st

SCOPES = ["openid", "profile", "email", "User.Read"]


def _cfg(key: str) -> str:
    """Lê de st.secrets (Streamlit Cloud) ou variável de ambiente."""
    try:
        return st.secrets[key]
    except Exception:
        return os.environ.get(key, "")


def _msal_app() -> msal.ConfidentialClientApplication:
    return msal.ConfidentialClientApplication(
        client_id=_cfg("AZURE_CLIENT_ID"),
        client_credential=_cfg("AZURE_CLIENT_SECRET"),
        authority=f"https://login.microsoftonline.com/{_cfg('AZURE_TENANT_ID')}",
    )


def _auth_url() -> str:
    return _msal_app().get_authorization_request_url(
        scopes=SCOPES,
        redirect_uri=_cfg("REDIRECT_URI"),
        response_type="code",
    )


def _trocar_codigo(code: str) -> dict | None:
    result = _msal_app().acquire_token_by_authorization_code(
        code=code,
        scopes=SCOPES,
        redirect_uri=_cfg("REDIRECT_URI"),
    )
    if "error" in result:
        st.error(f"Erro no login: {result.get('error_description','Desconhecido')}")
        return None
    return result


def login_page(auth_url: str):
    """Tela de login — exibida quando o usuário não está autenticado."""
    st.markdown("""
    <style>
    [data-testid="stSidebar"] { display: none; }
    .login-box {
      max-width: 420px; margin: 8vh auto; padding: 2.5rem;
      background: #fff; border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,.12);
      text-align: center; font-family: 'Segoe UI', sans-serif;
    }
    .login-box h1 { font-size: 1.5rem; color: #0C1E35; margin-bottom: .25rem; }
    .login-box p  { color: #566A7F; font-size: .9rem; margin-bottom: 2rem; }
    .ms-btn {
      display: inline-flex; align-items: center; gap: .6rem;
      padding: .75rem 1.5rem; background: #0078D4;
      color: #fff; border-radius: 4px; text-decoration: none;
      font-weight: 600; font-size: .95rem; transition: background .2s;
    }
    .ms-btn:hover { background: #005fa3; }
    </style>
    """, unsafe_allow_html=True)

    st.markdown(f"""
    <div class="login-box">
      <h1>💻 TI Talentos</h1>
      <p>Inventário de TI · Acesso restrito a colaboradores da Talentos Consultoria</p>
      <a class="ms-btn" href="{auth_url}">
        <svg width="20" height="20" viewBox="0 0 21 21" fill="none">
          <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
          <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
          <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
          <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
        </svg>
        Entrar com Microsoft
      </a>
    </div>
    """, unsafe_allow_html=True)
    st.stop()


def _azure_configurado() -> bool:
    return bool(_cfg("AZURE_CLIENT_ID") and _cfg("AZURE_CLIENT_SECRET") and _cfg("AZURE_TENANT_ID"))


def verificar_autenticacao() -> dict:
    """
    Verifica se o usuário está autenticado.
    - Se credenciais Azure não configuradas → modo sem login (acesso direto).
    - Se não estiver autenticado → exibe tela de login Microsoft.
    - Se estiver → retorna o dicionário com dados do usuário.
    """
    _sem_auth = {"name": "Administrador", "preferred_username": "admin@local"}

    if not _azure_configurado():
        st.session_state.setdefault("user", _sem_auth)
        return st.session_state["user"]

    try:
        params = st.query_params
        if "code" in params and "user" not in st.session_state:
            with st.spinner("Autenticando..."):
                result = _trocar_codigo(params["code"])
            if result:
                claims = result.get("id_token_claims", {})
                email  = claims.get("preferred_username", "")
                domain = _cfg("ALLOWED_DOMAIN")
                if domain and not email.endswith(f"@{domain}"):
                    st.error(f"Acesso negado. Apenas usuários @{domain} podem entrar.")
                    st.query_params.clear()
                    st.stop()
                st.session_state["user"]  = claims
                st.session_state["token"] = result.get("access_token", "")
                st.query_params.clear()
                st.rerun()

        if "user" not in st.session_state:
            login_page(_auth_url())
    except Exception:
        st.session_state.setdefault("user", _sem_auth)

    return st.session_state["user"]


def logout():
    """Limpa a sessão e redireciona para a tela de login."""
    for k in ("user", "token"):
        st.session_state.pop(k, None)
    st.rerun()
