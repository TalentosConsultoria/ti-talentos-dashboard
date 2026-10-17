// Health check do Render. Público por design: não toca no banco nem expõe dados.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
