import { NextResponse, type NextRequest } from "next/server";
import { AccessDenied, authenticate } from "@/lib/cf-access";

/**
 * Primeiro portão: nenhuma rota do portal é renderizada sem identidade válida.
 * (Next 16 renomeou `middleware` para `proxy`; roda no runtime Node.)
 * A segunda camada fica em lib/auth.ts, chamada por cada leitura de dados.
 */
export async function proxy(request: NextRequest) {
  try {
    await authenticate(request.headers);
    return NextResponse.next();
  } catch (err) {
    const motivo = err instanceof AccessDenied ? err.message : "Falha na verificação de acesso.";
    return new NextResponse(paginaNegada(motivo), {
      status: 403,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }
}

export const config = {
  // /api/health fica aberto para o health check do Render (não expõe dados).
  matcher: ["/((?!api/health|_next/static|_next/image|favicon.ico|icon.svg).*)"],
};

function escapar(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function paginaNegada(motivo: string): string {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Acesso negado · Inventário de TI</title>
<style>
  :root{color-scheme:dark}
  body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#14171B;color:#E6E8EB;
    font:15px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
  main{max-width:440px;padding:40px 24px}
  .tag{display:inline-block;background:#7B1010;color:#FBF7F6;font:600 12px/1 ui-monospace,Consolas,monospace;
    letter-spacing:.08em;padding:8px 10px;border-radius:2px}
  h1{font-size:28px;line-height:1.15;margin:24px 0 8px;letter-spacing:-.01em}
  p{color:#A7A398;margin:0 0 24px}
  .motivo{border-left:2px solid #F27A70;padding:4px 0 4px 16px;color:#E6E8EB;font-size:14px}
</style></head>
<body><main>
  <span class="tag">TI TALENTOS</span>
  <h1>Acesso negado</h1>
  <p>O inventário de TI é restrito à equipe da Talentos Consultoria.</p>
  <div class="motivo">${escapar(motivo)}</div>
</main></body></html>`;
}
