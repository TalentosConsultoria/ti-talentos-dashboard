import type { CSSProperties } from "react";
import { diasEntre, fmtData, parseYmd, toUtcMs } from "@/lib/datas";
import { coberturas, statusPorDias, type InfoGarantia } from "@/lib/garantia";
import type { Equipamento } from "@/lib/types";

/**
 * Régua de cobertura da ficha: uma pista por garantia registrada (original,
 * fornecedor, estendida, Dell) sobre um eixo de anos, com a marca de hoje.
 * Server Component puro; a única animação é o preenchimento inicial (CSS).
 */
export function LinhaDoTempo({ equipamento, info, hoje }: { equipamento: Equipamento; info: InfoGarantia; hoje: string }) {
  const lista = coberturas(equipamento);
  if (!lista.length) {
    return (
      <div className="linha-tempo">
        <p className="vazio vazio--solto">
          <strong>Nenhuma garantia registrada.</strong>
          Preencha término de garantia, garantia do fornecedor ou estendida no cadastro.
        </p>
      </div>
    );
  }

  const datas = [hoje, ...lista.map((c) => c.fim), ...lista.map((c) => c.inicio).filter((v): v is string => !!v)];
  if (equipamento.data_compra && parseYmd(equipamento.data_compra)) datas.push(equipamento.data_compra);
  const ordenadas = datas.filter((d) => parseYmd(d)).sort();
  const anoIni = parseYmd(ordenadas[0])!.y;
  const anoFim = parseYmd(ordenadas[ordenadas.length - 1])!.y + 1;
  const ini = Date.UTC(anoIni, 0, 1);
  const fim = Date.UTC(anoFim, 0, 1);
  const pos = (iso: string) => ((toUtcMs(parseYmd(iso)!) - ini) / (fim - ini)) * 100;

  const anos: number[] = [];
  for (let y = anoIni; y <= anoFim; y++) anos.push(y);
  const passo = anos.length > 9 ? 2 : 1;
  const pHoje = pos(hoje);

  // Tiques de trimestre no eixo (anos com tique maior).
  const tiques: { x: number; ano: boolean }[] = [];
  for (let y = anoIni; y < anoFim; y++) {
    for (const m of [0, 3, 6, 9]) {
      if (y === anoIni && m === 0) continue;
      tiques.push({ x: ((Date.UTC(y, m, 1) - ini) / (fim - ini)) * 100, ano: m === 0 });
    }
  }

  const grades = anos.filter((y) => y > anoIni && y < anoFim).map((y) => ((Date.UTC(y, 0, 1) - ini) / (fim - ini)) * 100);

  return (
    <figure className="linha-tempo" aria-label="Régua de cobertura de garantia">
      <div className="linha-tempo__grade">
        <span aria-hidden="true" />
        <div className="linha-tempo__eixo" aria-hidden="true">
          {tiques.map((t) => (
            <span key={t.x} className={`linha-tempo__tique${t.ano ? " linha-tempo__tique--ano" : ""}`} style={{ left: `${t.x}%` }} />
          ))}
          {anos.map((y, i) => {
            const x = ((Date.UTC(y, 0, 1) - ini) / (fim - ini)) * 100;
            // Some com o ano que colidiria com o rótulo HOJE.
            if (i % passo !== 0 || y >= anoFim || Math.abs(x - pHoje) < 7) return null;
            return (
              <span key={y} className="linha-tempo__ano" style={{ left: `${x}%`, translate: i === 0 ? "0 0" : undefined }}>
                {y}
              </span>
            );
          })}
          <span className="linha-tempo__hoje" style={{ left: `${pHoje}%` }}>
            <span>Hoje</span>
          </span>
        </div>
        <span className="linha-tempo__vazio" aria-hidden="true" />

        {lista.map((c, i) => {
          const dias = diasEntre(hoje, c.fim);
          const status = statusPorDias(dias);
          const vigente = info.origem === c.origem;
          const xIni = c.inicio ? pos(c.inicio) : 0;
          const xFim = pos(c.fim);
          const largura = Math.max(0.6, xFim - xIni);
          // Parte já consumida dentro da barra, em % da própria barra.
          const consumido = Math.min(100, Math.max(0, ((pHoje - xIni) / largura) * 100));
          const estilo = { left: `${xIni}%`, width: `${largura}%`, "--i": i } as CSSProperties;
          const descricao = `${c.origem}: ${c.inicio ? `de ${fmtData(c.inicio)} ` : ""}até ${fmtData(c.fim)}${
            status === "vencida" ? ", vencida" : status === "alerta" ? ", vence em menos de 90 dias" : ", vigente"
          }`;
          return (
            <div key={c.origem} style={{ display: "contents" }}>
              <div className="linha-tempo__origem">
                {c.origem}
                {vigente && <small>Mais longa</small>}
              </div>
              <div className="linha-tempo__pista" role="img" aria-label={descricao}>
                {grades.map((g) => (
                  <span key={g} className="linha-tempo__grade-ano" style={{ left: `${g}%` }} aria-hidden="true" />
                ))}
                <span
                  className={`linha-tempo__barra linha-tempo__barra--${status}${c.inicio ? "" : " linha-tempo__barra--sem-inicio"}`}
                  style={estilo}
                >
                  {status === "vencida" ? (
                    <span className="linha-tempo__barra-gasto" style={{ width: "100%" }} />
                  ) : (
                    <>
                      <span className="linha-tempo__barra-gasto" style={{ width: `${consumido}%` }} />
                      <span className="linha-tempo__barra-resto" style={{ width: `${100 - consumido}%` }} />
                    </>
                  )}
                </span>
                <span className="linha-tempo__hoje" style={{ left: `${pHoje}%` }} aria-hidden="true" />
              </div>
              <div className={`linha-tempo__fim${vigente ? " linha-tempo__fim--vigente" : ""}`}>até {fmtData(c.fim)}</div>
            </div>
          );
        })}
      </div>
    </figure>
  );
}
