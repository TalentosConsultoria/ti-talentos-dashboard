import type { Metadata } from "next";
import { getEquipamentos } from "@/lib/data";
import { hojeISO, idadeEmAnos } from "@/lib/datas";
import { comparar, plural } from "@/lib/formato";
import { infoGarantia, type StatusGarantia } from "@/lib/garantia";

export const metadata: Metadata = { title: "Relatórios" };

const FAIXAS = ["Menos de 2 anos", "2 a 4 anos", "4 a 6 anos", "6 a 8 anos", "Mais de 8 anos", "Sem data de compra"] as const;
type Faixa = (typeof FAIXAS)[number];

function faixa(anos: number | null): Faixa {
  if (anos === null) return "Sem data de compra";
  if (anos < 2) return "Menos de 2 anos";
  if (anos < 4) return "2 a 4 anos";
  if (anos < 6) return "4 a 6 anos";
  if (anos < 8) return "6 a 8 anos";
  return "Mais de 8 anos";
}

const ORDEM_STATUS: StatusGarantia[] = ["vencida", "alerta", "ok", "sem_info"];
const NOME_STATUS: Record<StatusGarantia, string> = {
  vencida: "Vencida",
  alerta: "Vence em 90 dias",
  ok: "Coberta",
  sem_info: "Sem registro",
};

export default async function RelatoriosPage() {
  const hoje = hojeISO();
  const ativos = (await getEquipamentos()).filter((e) => e.obsoleto !== true);

  // Idade do parque: só computadores (mesma regra do Streamlit).
  const computadores = ativos.filter((e) => ["Desktop", "Notebook", "Servidor"].includes(e.tipo ?? ""));
  const idade = new Map<Faixa, number>(FAIXAS.map((f) => [f, 0]));
  for (const e of computadores) {
    const f = faixa(idadeEmAnos(e.data_compra, hoje));
    idade.set(f, (idade.get(f) ?? 0) + 1);
  }
  const maxIdade = Math.max(1, ...idade.values());
  const antigos = idade.get("Mais de 8 anos") ?? 0;

  // Cobertura por unidade (empilhada).
  const porUnidade = new Map<string, Record<StatusGarantia, number>>();
  for (const e of ativos) {
    const u = e.local || "Sem unidade";
    const linha = porUnidade.get(u) ?? { vencida: 0, alerta: 0, ok: 0, sem_info: 0 };
    linha[infoGarantia(e, hoje).status] += 1;
    porUnidade.set(u, linha);
  }
  const unidades = [...porUnidade.entries()]
    .map(([u, l]) => ({ u, l, total: ORDEM_STATUS.reduce((s, k) => s + l[k], 0) }))
    .sort((a, b) => b.total - a.total || comparar(a.u, b.u));
  const maxUnidade = Math.max(1, ...unidades.map((x) => x.total));

  // Distribuição por tipo.
  const porTipo = new Map<string, number>();
  for (const e of ativos) porTipo.set(e.tipo || "Sem tipo", (porTipo.get(e.tipo || "Sem tipo") ?? 0) + 1);
  const tipos = [...porTipo.entries()].sort((a, b) => b[1] - a[1] || comparar(a[0], b[0]));
  const maxTipo = Math.max(1, ...tipos.map((t) => t[1]));

  return (
    <>
      <header className="cabecalho">
        <div>
          <h1>Relatórios</h1>
          <p className="cabecalho__contexto">Retrato do parque ativo: {plural(ativos.length, "equipamento", "equipamentos")}.</p>
        </div>
      </header>

      <section className="secao" style={{ marginTop: 0 }} aria-labelledby="h-idade">
        <h2 id="h-idade">Idade dos computadores</h2>
        <p className="secao__nota">
          {plural(computadores.length, "desktop, notebook ou servidor", "desktops, notebooks e servidores")}.{" "}
          {antigos
            ? `${plural(antigos, "máquina passou", "máquinas passaram")} de 8 anos e já ${antigos === 1 ? "é candidata" : "são candidatas"} à substituição.`
            : "Nenhuma máquina passou de 8 anos."}
        </p>
        <div className="barras" role="table" aria-label="Computadores por faixa de idade">
          {FAIXAS.map((f) => {
            const n = idade.get(f) ?? 0;
            return (
              <div className="barras__linha" role="row" key={f}>
                <span className="barras__rotulo" role="rowheader">
                  {f}
                </span>
                <span className="barras__pista" role="presentation">
                  <span
                    className={`barras__seg${f === "Mais de 8 anos" ? " barras__seg--destaque" : ""}`}
                    style={{ width: `${(n / maxIdade) * 100}%` }}
                  />
                </span>
                <span className="barras__valor" role="cell">
                  {n}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <div className="relatorio-grade secao">
        <section aria-labelledby="h-unidade">
          <h2 id="h-unidade" style={{ fontSize: "var(--fs-md)", marginBottom: 12 }}>
            Garantia por unidade
          </h2>
          <div className="legenda" aria-hidden="true">
            {ORDEM_STATUS.map((s) => (
              <span key={s}>
                <i className={`barras__seg--${s}`} />
                {NOME_STATUS[s]}
              </span>
            ))}
          </div>
          <div className="barras" role="table" aria-label="Situação da garantia por unidade">
            {unidades.map(({ u, l, total }) => (
              <div className="barras__linha" role="row" key={u}>
                <span className="barras__rotulo" role="rowheader">
                  {u}
                </span>
                <span
                  className="barras__pista"
                  role="cell"
                  aria-label={ORDEM_STATUS.filter((s) => l[s]).map((s) => `${NOME_STATUS[s]}: ${l[s]}`).join(", ")}
                >
                  {ORDEM_STATUS.map((s) =>
                    l[s] ? (
                      <span key={s} className={`barras__seg barras__seg--${s}`} style={{ width: `${(l[s] / maxUnidade) * 100}%` }} />
                    ) : null,
                  )}
                </span>
                <span className="barras__valor" role="cell">
                  {total}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="h-tipo">
          <h2 id="h-tipo" style={{ fontSize: "var(--fs-md)", marginBottom: 12 }}>
            Equipamentos por tipo
          </h2>
          <div className="barras" role="table" aria-label="Equipamentos ativos por tipo">
            {tipos.map(([t, n]) => (
              <div className="barras__linha" role="row" key={t}>
                <span className="barras__rotulo" role="rowheader">
                  {t}
                </span>
                <span className="barras__pista" role="presentation">
                  <span className="barras__seg" style={{ width: `${(n / maxTipo) * 100}%` }} />
                </span>
                <span className="barras__valor" role="cell">
                  {n}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
