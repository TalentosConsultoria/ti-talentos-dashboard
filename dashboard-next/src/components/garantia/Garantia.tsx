/**
 * Selo + régua de garantia. Componentes sem estado (funcionam em Server e
 * Client Components). A régua é o elemento-assinatura do sistema: mostra
 * quanto da cobertura já foi consumido (cinza) e quanto resta (cor do estado).
 */
import { fmtData } from "@/lib/datas";
import { fracaoConsumida, rotuloGarantia, type InfoGarantia } from "@/lib/garantia";

export function SeloGarantia({ info, hoje, longo = false, discreto = false }: { info: InfoGarantia; hoje: string; longo?: boolean; discreto?: boolean }) {
  const r = rotuloGarantia(info, hoje);
  return (
    <span className={`selo selo--${info.status}${discreto ? " selo--discreto" : ""}`} title={info.fim ? `${r.longo}. Fim em ${fmtData(info.fim)} (${info.origem}).` : r.longo}>
      {longo ? (
        r.longo
      ) : (
        <>
          <span aria-hidden="true">{r.curto}</span>
          <span className="sr-only">{r.longo}</span>
        </>
      )}
    </span>
  );
}

export function Regua({ info, hoje }: { info: InfoGarantia; hoje: string }) {
  if (info.status === "sem_info") return <span className="regua regua--vazia" aria-hidden="true" />;
  if (info.status === "vencida") return <span className="regua regua--vencida" aria-hidden="true" />;
  const frac = fracaoConsumida(info, hoje);
  if (frac === null) return <span className={`regua regua--${info.status}`} aria-hidden="true"><span className="regua__resto" style={{ width: "100%" }} /></span>;
  const gasto = Math.round(frac * 1000) / 10;
  return (
    <span className={`regua regua--${info.status}`} aria-hidden="true">
      <span className="regua__gasto" style={{ width: `${gasto}%` }} />
      <span className="regua__resto" style={{ width: `${100 - gasto}%` }} />
    </span>
  );
}

export function GarantiaCelula({ info, hoje }: { info: InfoGarantia; hoje: string }) {
  return (
    <span className="garantia-celula">
      <Regua info={info} hoje={hoje} />
      <SeloGarantia info={info} hoje={hoje} discreto />
    </span>
  );
}
