"""
Autenticacao do Portal TI Talentos — FAIL-CLOSED.

Regra de ouro: se a autenticacao nao puder ser comprovada, o acesso e negado.
Nenhum caminho de excecao concede identidade administrativa.

Modos (variavel de ambiente AUTH_MODE):

  cloudflare  (PADRAO)  Cloudflare Access e o gatekeeper. O app apenas VALIDA
                        o JWT `Cf-Access-Jwt-Assertion` assinado pelo team
                        domain. Bloqueia acesso direto a <app>.onrender.com.
                        Requer CF_ACCESS_TEAM_DOMAIN e CF_ACCESS_AUD.

  azure                 Login Microsoft dentro do app via MSAL.
                        Requer AZURE_CLIENT_ID / AZURE_CLIENT_SECRET /
                        AZURE_TENANT_ID / REDIRECT_URI.

  local                 Bypass para desenvolvimento na maquina do Marcelo.
                        So funciona com ENVIRONMENT != "production".
                        NUNCA definir AUTH_MODE=local no Render.

Qualquer outro valor (ou variaveis faltando) => acesso negado.
"""
from __future__ import annotations

import os

import streamlit as st

import cf_access
from cf_access import AccessDenied

SCOPES = ["openid", "profile", "email", "User.Read"]
MODO_PADRAO = "cloudflare"


def _cfg(key: str, default: str = "") -> str:
    val = os.environ.get(key, "")
    if val:
        return val.strip()
    try:
        return str(st.secrets[key]).strip()
    except Exception:
        return default


def _modo() -> str:
    return (_cfg("AUTH_MODE") or MODO_PADRAO).lower()


def _producao() -> bool:
    return _cfg("ENVIRONMENT", "production").lower() == "production"


# --------------------------------------------------------------------------- #
# Telas
# --------------------------------------------------------------------------- #
_CSS_CAIXA = """
<style>
[data-testid="stSidebar"], [data-testid="stSidebarNav"] { display: none !important; }
[data-testid="stHeader"] { display: none !important; }
.auth-box {
  max-width: 460px; margin: 8vh auto; padding: 2.5rem;
  background: #fff; border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0,0,0,.12);
  text-align: center; font-family: 'Segoe UI', sans-serif;
}
.auth-box h1 { font-size: 1.5rem; color: #0C1E35; margin-bottom: .25rem; }
.auth-box p  { color: #566A7F; font-size: .9rem; margin-bottom: 1.75rem; }
.auth-box .motivo {
  background: #FDF2F2; border: 1px solid #F5C2C2; color: #8A1F1F;
  border-radius: 6px; padding: .75rem 1rem; font-size: .82rem;
  text-align: left; margin-top: 1.25rem;
}
.ms-btn {
  display: inline-flex; align-items: center; gap: .6rem;
  padding: .75rem 1.5rem; background: #0078D4;
  color: #fff; border-radius: 4px; text-decoration: none;
  font-weight: 600; font-size: .95rem; transition: background .2s;
}
.ms-btn:hover { background: #005fa3; }
</style>
"""


def bloquear(motivo: str) -> "None":
    """Renderiza a tela de acesso negado e encerra a execucao. Nunca retorna."""
    st.markdown(_CSS_CAIXA, unsafe_allow_html=True)
    st.markdown(
        f"""
    <div class="auth-box">
      <h1>Acesso negado</h1>
      <p>Portal TI Talentos &middot; area restrita</p>
      <div class="motivo"><strong>Motivo:</strong> {motivo}</div>
    </div>
    """,
        unsafe_allow_html=True,
    )
    st.stop()


def login_page(auth_url: str) -> "None":
    """Tela de login Microsoft (apenas no modo azure). Nunca retorna."""
    st.markdown(_CSS_CAIXA, unsafe_allow_html=True)
    st.markdown(
        f"""
    <div class="auth-box">
      <h1>TI Talentos</h1>
      <p>Inventario de TI &middot; acesso restrito a colaboradores da Talentos Consultoria</p>
      <a class="ms-btn" href="{auth_url}">
        <svg width="20" height="20" viewBox="0 0 21 21" fill="none">
          <rect x="1"  y="1"  width="9" height="9" fill="#F25022"/>
          <rect x="11" y="1"  width="9" height="9" fill="#7FBA00"/>
          <rect x="1"  y="11" width="9" height="9" fill="#00A4EF"/>
          <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
        </svg>
        Entrar com Microsoft
      </a>
    </div>
    """,
        unsafe_allow_html=True,
    )
    st.stop()


# --------------------------------------------------------------------------- #
# Modo azure (MSAL)
# --------------------------------------------------------------------------- #
def _azure_configurado() -> bool:
    return bool(
        _cfg("AZURE_CLIENT_ID")
        and _cfg("AZURE_CLIENT_SECRET")
        and _cfg("AZURE_TENANT_ID")
        and _cfg("REDIRECT_URI")
    )


def _msal_app():
    import msal

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


def _autenticar_azure() -> dict:
    if not _azure_configurado():
        bloquear(
            "AUTH_MODE=azure, mas as credenciais do Entra ID nao estao "
            "configuradas no servidor."
        )

    params = st.query_params
    if "code" in params and "user" not in st.session_state:
        with st.spinner("Autenticando..."):
            resultado = _msal_app().acquire_token_by_authorization_code(
                code=params["code"],
                scopes=SCOPES,
                redirect_uri=_cfg("REDIRECT_URI"),
            )
        if "error" in resultado:
            st.query_params.clear()
            bloquear(resultado.get("error_description", "Falha no login Microsoft."))

        claims = resultado.get("id_token_claims", {}) or {}
        email = str(claims.get("preferred_username", "")).strip().lower()
        if not email:
            st.query_params.clear()
            bloquear("Token Microsoft sem e-mail.")

        try:
            cf_access._autorizar_identidade(email)
        except AccessDenied as exc:
            st.query_params.clear()
            bloquear(str(exc))

        claims["email"] = email
        st.session_state["user"] = claims
        st.query_params.clear()
        st.rerun()

    if "user" not in st.session_state:
        login_page(_auth_url())

    return st.session_state["user"]


# --------------------------------------------------------------------------- #
# Entrada principal
# --------------------------------------------------------------------------- #
def verificar_autenticacao() -> dict:
    """
    Retorna os claims do usuario autenticado.
    Em qualquer falha, chama bloquear() e encerra — nunca devolve identidade
    de fallback.
    """
    modo = _modo()

    if modo == "cloudflare":
        try:
            usuario = cf_access.validar()
        except AccessDenied as exc:
            bloquear(str(exc))
        except Exception as exc:  # falha inesperada => negar, nao liberar
            bloquear(f"Falha na verificacao de acesso: {exc}")
        st.session_state["user"] = usuario
        return usuario

    if modo == "azure":
        return _autenticar_azure()

    if modo == "local":
        if _producao():
            bloquear(
                "AUTH_MODE=local nao e permitido em producao. "
                "Corrija a configuracao do servico."
            )
        usuario = {
            "name": "Desenvolvimento local",
            "preferred_username": "dev@local",
            "email": "dev@local",
        }
        st.session_state["user"] = usuario
        st.warning("Modo de desenvolvimento: autenticacao desabilitada.", icon="⚠️")
        return usuario

    bloquear(f"AUTH_MODE invalido: '{modo}'. Valores aceitos: cloudflare, azure, local.")


def logout():
    """
    Encerra a sessao.
    - modo cloudflare: o logout real e do Cloudflare Access (/cdn-cgi/access/logout).
    - modo azure/local: limpa apenas a sessao do Streamlit.
    """
    for k in ("user", "token"):
        st.session_state.pop(k, None)

    if _modo() == "cloudflare":
        dominio = cf_access.team_domain()
        if dominio:
            st.markdown(
                f'<meta http-equiv="refresh" content="0;url=https://{dominio}/cdn-cgi/access/logout">',
                unsafe_allow_html=True,
            )
            st.stop()

    st.rerun()
