"""
Validacao do JWT do Cloudflare Access (header `Cf-Access-Jwt-Assertion`).

Objetivo: impedir que alguem acesse o app direto pela URL
`<app>.onrender.com`, contornando o Cloudflare Access. Toda requisicao que
chega SEM um JWT valido e assinado pelo team domain da Talentos e recusada.

Variaveis de ambiente:
  CF_ACCESS_TEAM_DOMAIN  -> ex: talentos.cloudflareaccess.com   (obrigatorio)
  CF_ACCESS_AUD          -> Application Audience (AUD) tag da Access App (obrigatorio)
  ALLOWED_EMAILS         -> lista separada por virgula (opcional, camada extra)
  ALLOWED_DOMAIN         -> ex: talentosconsultoria.com.br      (opcional)

Referencia:
  https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/
"""
from __future__ import annotations

import os

import jwt
import streamlit as st
from jwt import PyJWKClient

JWT_HEADER = "cf-access-jwt-assertion"
JWT_COOKIE = "CF_Authorization"
ALGORITHMS = ["RS256"]
# Tolerancia de relogio entre Render e Cloudflare (ambos sincronizados por
# NTP; manter baixo para reduzir a janela de reuso de token expirado).
LEEWAY_SECONDS = 10


class AccessDenied(Exception):
    """JWT ausente, invalido, expirado ou identidade nao autorizada."""


def _cfg(key: str, default: str = "") -> str:
    """Le de env var; cai para st.secrets apenas em execucao local."""
    val = os.environ.get(key, "")
    if val:
        return val.strip()
    try:
        return str(st.secrets[key]).strip()
    except Exception:
        return default


def team_domain() -> str:
    """Team domain normalizado, sem esquema e sem barra final."""
    raw = _cfg("CF_ACCESS_TEAM_DOMAIN")
    return raw.replace("https://", "").replace("http://", "").rstrip("/")


def configurado() -> bool:
    return bool(team_domain() and _cfg("CF_ACCESS_AUD"))


# --------------------------------------------------------------------------- #
# Leitura de headers/cookies da requisicao
# --------------------------------------------------------------------------- #
def _headers() -> dict:
    """
    Headers da requisicao HTTP atual, com chaves em minusculo.
    Usa st.context.headers (Streamlit >= 1.37) com fallback para a API interna.
    """
    try:
        ctx = getattr(st, "context", None)
        if ctx is not None and getattr(ctx, "headers", None) is not None:
            return {str(k).lower(): v for k, v in dict(ctx.headers).items()}
    except Exception:
        pass

    try:  # fallback para versoes antigas do Streamlit
        from streamlit.web.server.websocket_headers import _get_websocket_headers

        raw = _get_websocket_headers() or {}
        return {str(k).lower(): v for k, v in raw.items()}
    except Exception:
        return {}


def _cookies() -> dict:
    try:
        ctx = getattr(st, "context", None)
        if ctx is not None and getattr(ctx, "cookies", None) is not None:
            return dict(ctx.cookies)
    except Exception:
        pass

    # Fallback: parse manual do header Cookie.
    bruto = _headers().get("cookie", "")
    out = {}
    for parte in bruto.split(";"):
        if "=" in parte:
            nome, _, valor = parte.partition("=")
            out[nome.strip()] = valor.strip()
    return out


def _extrair_token() -> str:
    """Header tem prioridade; cookie e o fallback (navegacao direta)."""
    token = _headers().get(JWT_HEADER, "")
    if token:
        return token.strip()
    return str(_cookies().get(JWT_COOKIE, "")).strip()


# --------------------------------------------------------------------------- #
# Validacao criptografica
# --------------------------------------------------------------------------- #
@st.cache_resource(show_spinner=False)
def _jwk_client(certs_url: str) -> PyJWKClient:
    """Cliente JWKS com cache das chaves publicas do Cloudflare."""
    # timeout curto: a busca do JWKS acontece no caminho da requisicao.
    return PyJWKClient(certs_url, cache_keys=True, lifespan=3600, timeout=8)


def validar() -> dict:
    """
    Valida o JWT do Cloudflare Access da requisicao atual.

    Returns:
        dict com os claims da identidade (contem `email`).

    Raises:
        AccessDenied: em QUALQUER falha. Nunca retorna identidade sem
        assinatura verificada — este modulo e fail-closed por design.
    """
    dominio = team_domain()
    aud = _cfg("CF_ACCESS_AUD")

    if not dominio or not aud:
        raise AccessDenied(
            "Cloudflare Access nao configurado no servidor "
            "(CF_ACCESS_TEAM_DOMAIN / CF_ACCESS_AUD ausentes)."
        )

    token = _extrair_token()
    if not token:
        raise AccessDenied(
            "Requisicao sem credencial do Cloudflare Access. "
            "Acesse pelo endereco oficial do portal."
        )

    issuer = f"https://{dominio}"
    certs_url = f"{issuer}/cdn-cgi/access/certs"

    try:
        chave = _jwk_client(certs_url).get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            chave.key,
            algorithms=ALGORITHMS,
            audience=aud,
            issuer=issuer,
            leeway=LEEWAY_SECONDS,
            options={
                "require": ["exp", "iat", "aud", "iss"],
                "verify_exp": True,
                "verify_iat": True,
                "verify_aud": True,
                "verify_iss": True,
                "verify_signature": True,
            },
        )
    except jwt.ExpiredSignatureError as exc:
        raise AccessDenied("Sessao do Cloudflare Access expirada.") from exc
    except jwt.InvalidTokenError as exc:
        raise AccessDenied(f"Credencial invalida: {exc}") from exc
    except Exception as exc:  # falha de rede ao buscar JWKS, etc.
        raise AccessDenied(f"Nao foi possivel validar a credencial: {exc}") from exc

    email = str(claims.get("email", "")).strip().lower()
    if not email:
        raise AccessDenied("Credencial sem claim de e-mail.")

    _autorizar_identidade(email)

    claims["email"] = email
    claims.setdefault("preferred_username", email)
    claims.setdefault("name", email.split("@")[0])
    return claims


def _autorizar_identidade(email: str) -> None:
    """Camada extra de allowlist no app (defesa em profundidade)."""
    permitidos = [
        e.strip().lower() for e in _cfg("ALLOWED_EMAILS").split(",") if e.strip()
    ]
    if permitidos and email not in permitidos:
        raise AccessDenied(f"Usuario {email} nao autorizado neste portal.")

    dominio = _cfg("ALLOWED_DOMAIN").lower()
    if dominio and not email.endswith(f"@{dominio}"):
        raise AccessDenied(f"Acesso restrito a contas @{dominio}.")
