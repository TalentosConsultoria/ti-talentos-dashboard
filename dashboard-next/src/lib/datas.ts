/**
 * Datas como string ISO "AAAA-MM-DD", sempre tratadas como data civil (sem fuso).
 * Evita o clássico bug de "um dia a menos" ao converter para Date local.
 */
export type Ymd = { y: number; m: number; d: number };

export function parseYmd(iso: string | null | undefined): Ymd | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

export function toUtcMs(v: Ymd): number {
  return Date.UTC(v.y, v.m - 1, v.d);
}

const DIA_MS = 86_400_000;

/** Dias de `de` até `ate` (negativo se `ate` já passou). */
export function diasEntre(de: string, ate: string): number | null {
  const a = parseYmd(de);
  const b = parseYmd(ate);
  if (!a || !b) return null;
  return Math.round((toUtcMs(b) - toUtcMs(a)) / DIA_MS);
}

/** Meses civis completos entre duas datas (a <= b). */
export function mesesCompletos(a: Ymd, b: Ymd): number {
  let meses = (b.y - a.y) * 12 + (b.m - a.m);
  if (b.d < a.d) meses -= 1;
  return Math.max(0, meses);
}

/** "Hoje" no fuso de São Paulo, em ISO. Calculado no servidor e repassado ao cliente. */
export function hojeISO(): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return partes; // en-CA => AAAA-MM-DD
}

export function agoraSP(): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

export function fmtData(iso: string | null | undefined): string {
  const v = parseYmd(iso);
  if (!v) return "";
  return `${String(v.d).padStart(2, "0")}/${String(v.m).padStart(2, "0")}/${v.y}`;
}

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function nomeMesCurto(m: number): string {
  return MESES_CURTOS[m - 1] ?? "";
}

/** Soma meses a uma data, ajustando para o último dia do mês quando preciso. */
export function somarMeses(iso: string, meses: number): string {
  const v = parseYmd(iso);
  if (!v) return iso;
  const total = v.y * 12 + (v.m - 1) + meses;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const d = Math.min(v.d, ultimo);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function idadeEmAnos(iso: string | null | undefined, hoje: string): number | null {
  const dias = iso ? diasEntre(iso, hoje) : null;
  return dias === null ? null : dias / 365.25;
}
