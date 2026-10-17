/**
 * Validação do JWT do Cloudflare Access (header `Cf-Access-Jwt-Assertion`).
 * Porte fiel de cf_access.py + auth.py do dashboard Streamlit. FAIL-CLOSED:
 * qualquer falha nega o acesso; nenhum caminho de exceção concede identidade.
 *
 * Usado em dois pontos (defesa em profundidade):
 *   1. proxy.ts            -> barra a requisição antes de renderizar qualquer rota
 *   2. lib/auth.ts         -> cada leitura de dados revalida a identidade
 *
 * Não importa "server-only" porque o proxy também consome este módulo.
 */
import { createRemoteJWKSet, errors, jwtVerify, type JWTPayload } from "jose";

export class AccessDenied extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = "AccessDenied";
  }
}

export type PortalUser = {
  email: string;
  nome: string;
  modo: "cloudflare" | "local";
};

const JWT_HEADER = "cf-access-jwt-assertion";
const JWT_COOKIE = "CF_Authorization";
const LEEWAY_SECONDS = 10;

function cfg(key: string): string {
  return (process.env[key] ?? "").trim();
}

const emDesenvolvimento = () => process.env.NODE_ENV === "development";

/** Padrão: `local` só no `next dev`; em qualquer build de produção, `cloudflare`. */
export function authMode(): string {
  return (cfg("AUTH_MODE") || (emDesenvolvimento() ? "local" : "cloudflare")).toLowerCase();
}

export function isProduction(): boolean {
  const env = cfg("ENVIRONMENT") || (emDesenvolvimento() ? "development" : "production");
  return env.toLowerCase() === "production";
}

export function teamDomain(): string {
  return cfg("CF_ACCESS_TEAM_DOMAIN").replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

export function logoutUrl(): string | null {
  if (authMode() !== "cloudflare") return null;
  const d = teamDomain();
  return d ? `https://${d}/cdn-cgi/access/logout` : null;
}

// Cache do JWKS por team domain (chaves públicas do Cloudflare, TTL 1h).
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
function jwks(dominio: string) {
  let set = jwksCache.get(dominio);
  if (!set) {
    set = createRemoteJWKSet(new URL(`https://${dominio}/cdn-cgi/access/certs`), {
      timeoutDuration: 8000,
      cacheMaxAge: 3_600_000,
      cooldownDuration: 30_000,
    });
    jwksCache.set(dominio, set);
  }
  return set;
}

function lerCookie(cookieHeader: string | null, nome: string): string {
  if (!cookieHeader) return "";
  for (const parte of cookieHeader.split(";")) {
    const i = parte.indexOf("=");
    if (i > 0 && parte.slice(0, i).trim() === nome) return parte.slice(i + 1).trim();
  }
  return "";
}

/** Header tem prioridade; cookie é o fallback (navegação direta). */
export function extrairToken(headers: Headers): string {
  const h = headers.get(JWT_HEADER);
  if (h) return h.trim();
  return lerCookie(headers.get("cookie"), JWT_COOKIE);
}

/** Allowlist no app: mesma regra de _autorizar_identidade (cf_access.py). */
export function autorizarIdentidade(email: string): void {
  const permitidos = cfg("ALLOWED_EMAILS")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (permitidos.length && !permitidos.includes(email)) {
    throw new AccessDenied(`Usuário ${email} não autorizado neste portal.`);
  }
  const dominio = cfg("ALLOWED_DOMAIN").toLowerCase();
  if (dominio && !email.endsWith(`@${dominio}`)) {
    throw new AccessDenied(`Acesso restrito a contas @${dominio}.`);
  }
}

function nomeAPartirDoEmail(email: string): string {
  return email
    .split("@")[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

async function validarCloudflare(headers: Headers): Promise<PortalUser> {
  const dominio = teamDomain();
  const aud = cfg("CF_ACCESS_AUD");
  if (!dominio || !aud) {
    throw new AccessDenied(
      "Cloudflare Access não configurado no servidor (CF_ACCESS_TEAM_DOMAIN / CF_ACCESS_AUD ausentes).",
    );
  }
  const token = extrairToken(headers);
  if (!token) {
    throw new AccessDenied("Requisição sem credencial do Cloudflare Access. Acesse pelo endereço oficial do portal.");
  }

  const issuer = `https://${dominio}`;
  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(token, jwks(dominio), {
      issuer,
      audience: aud,
      algorithms: ["RS256"],
      clockTolerance: LEEWAY_SECONDS,
      requiredClaims: ["exp", "iat", "aud", "iss"],
    }));
  } catch (err) {
    if (err instanceof errors.JWTExpired) throw new AccessDenied("Sessão do Cloudflare Access expirada.");
    if (err instanceof errors.JOSEError) throw new AccessDenied(`Credencial inválida (${err.code}).`);
    throw new AccessDenied("Não foi possível validar a credencial.");
  }

  const email = String(payload.email ?? "").trim().toLowerCase();
  if (!email) throw new AccessDenied("Credencial sem claim de e-mail.");
  autorizarIdentidade(email);

  const nome = typeof payload.name === "string" && payload.name ? payload.name : nomeAPartirDoEmail(email);
  return { email, nome, modo: "cloudflare" };
}

/**
 * Retorna a identidade autenticada ou lança AccessDenied. Nunca devolve
 * identidade de fallback em produção.
 */
export async function authenticate(headers: Headers): Promise<PortalUser> {
  const modo = authMode();

  if (modo === "cloudflare") return validarCloudflare(headers);

  if (modo === "local") {
    if (isProduction()) {
      throw new AccessDenied("AUTH_MODE=local não é permitido em produção. Corrija a configuração do serviço.");
    }
    return { email: "dev@local", nome: "Desenvolvimento local", modo: "local" };
  }

  if (modo === "azure") {
    throw new AccessDenied(
      "AUTH_MODE=azure não existe nesta versão. O Cloudflare Access (com Entra ID) é o único gatekeeper.",
    );
  }

  throw new AccessDenied(`AUTH_MODE inválido: '${modo}'. Valores aceitos: cloudflare, local.`);
}
