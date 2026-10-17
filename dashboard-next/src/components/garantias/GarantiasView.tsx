"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as Slider from "@radix-ui/react-slider";
import type { Equipamento } from "@/lib/types";
import { infoGarantia, type InfoGarantia } from "@/lib/garantia";
import { fmtData, nomeMesCurto, parseYmd, somarMeses } from "@/lib/datas";
import { plural } from "@/lib/formato";
import { GarantiaCelula } from "@/components/garantia/Garantia";

type Item = { e: Equipamento; gar: InfoGarantia };

const LIMITE = 12;

export function GarantiasView({ equipamentos, hoje }: { equipamentos: Equipamento[]; hoje: string }) {
  const [janela, setJanela] = useState(90);
  const [todasVencidas, setTodasVencidas] = useState(false);

  const grupos = useMemo(() => {
    const itens: Item[] = equipamentos.map((e) => ({ e, gar: infoGarantia(e, hoje, janela) }));
    const porFim = (a: Item, b: Item) => (a.gar.fim ?? "").localeCompare(b.gar.fim ?? "");
    return {
      vencidas: itens.filter((i) => i.gar.status === "vencida").sort((a, b) => porFim(b, a)),
      alerta: itens.filter((i) => i.gar.status === "alerta").sort(porFim),
      ok: itens.filter((i) => i.gar.status === "ok").length,
      sem: itens.filter((i) => i.gar.status === "sem_info").length,
      todos: itens,
    };
  }, [equipamentos, hoje, janela]);

  // Vencimentos nos próximos 12 meses, mês a mês.
  const meses = useMemo(() => {
    const base = parseYmd(hoje)!;
    const lista = Array.from({ length: 12 }, (_, i) => {
      const ref = parseYmd(somarMeses(`${base.y}-${String(base.m).padStart(2, "0")}-01`, i))!;
      return { y: ref.y, m: ref.m, qtd: 0, naJanela: false };
    });
    for (const i of grupos.todos) {
      if (!i.gar.fim || i.gar.fim < hoje) continue;
      const f = parseYmd(i.gar.fim)!;
      const idx = (f.y - base.y) * 12 + (f.m - base.m);
      if (idx >= 0 && idx < 12) lista[idx].qtd += 1;
    }
    // Um mês entra na janela se o primeiro dia dele estiver dentro do prazo de alerta.
    for (const mes of lista) {
      const diff = (Date.UTC(mes.y, mes.m - 1, 1) - Date.UTC(base.y, base.m - 1, base.d)) / 86_400_000;
      mes.naJanela = diff <= janela;
    }
    return lista;
  }, [grupos.todos, hoje, janela]);

  const maximo = Math.max(1, ...meses.map((m) => m.qtd));

  return (
    <>
      <header className="cabecalho">
        <div>
          <h1>Garantias</h1>
          <p className="cabecalho__contexto">
            Cobertura dos {plural(equipamentos.length, "equipamento ativo", "equipamentos ativos")}, pela garantia mais longa registrada.
          </p>
        </div>
        <div className="janela">
          <span className="campo__rotulo" id="rotulo-janela">
            Alertar com antecedência de
          </span>
          <Slider.Root
            className="slider"
            min={30}
            max={365}
            step={15}
            value={[janela]}
            onValueChange={([v]) => setJanela(v)}
            aria-labelledby="rotulo-janela"
          >
            <Slider.Track className="slider__trilho">
              <Slider.Range className="slider__faixa" />
            </Slider.Track>
            <Slider.Thumb className="slider__alca" aria-label="Dias de antecedência" />
          </Slider.Root>
          <span className="janela__valor">{janela} dias</span>
        </div>
      </header>

      <section className="metricas" aria-label="Situação das garantias">
        <div className="metrica metrica--vencida">
          <span className="metrica__rotulo">Vencidas</span>
          <span className="metrica__valor">{grupos.vencidas.length}</span>
          <span className="metrica__nota">sem cobertura hoje</span>
        </div>
        <div className="metrica metrica--alerta">
          <span className="metrica__rotulo">Vencem em {janela} dias</span>
          <span className="metrica__valor">{grupos.alerta.length}</span>
          <span className="metrica__nota">decidir renovação ou troca</span>
        </div>
        <div className="metrica">
          <span className="metrica__rotulo">Cobertas</span>
          <span className="metrica__valor">{grupos.ok}</span>
          <span className="metrica__nota">além da janela de alerta</span>
        </div>
        <div className="metrica">
          <span className="metrica__rotulo">Sem registro</span>
          <span className="metrica__valor">{grupos.sem}</span>
          <span className="metrica__nota">nenhuma data cadastrada</span>
        </div>
      </section>

      <section className="secao" aria-labelledby="h-calendario">
        <h2 id="h-calendario">Vencimentos nos próximos 12 meses</h2>
        <p className="secao__nota">Em destaque, os meses dentro da janela de alerta.</p>
        <ol className="calendario">
          {meses.map((m) => (
            <li
              key={`${m.y}-${m.m}`}
              className="calendario__mes"
              aria-label={`${nomeMesCurto(m.m)} de ${m.y}: ${plural(m.qtd, "vencimento", "vencimentos")}`}
            >
              <span className={`calendario__qtd${m.qtd ? "" : " calendario__qtd--zero"}`} aria-hidden="true">
                {m.qtd}
              </span>
              <span
                className={`calendario__barra${m.naJanela ? " calendario__barra--janela" : ""}`}
                style={{ height: `${(m.qtd / maximo) * 100}%` }}
                aria-hidden="true"
              />
            </li>
          ))}
        </ol>
        <div className="calendario__rotulos" aria-hidden="true">
          {meses.map((m) => (
            <span key={`${m.y}-${m.m}`}>
              {nomeMesCurto(m.m)}
              {m.m === 1 ? ` ${String(m.y).slice(2)}` : ""}
            </span>
          ))}
        </div>
      </section>

      <section className="secao" aria-labelledby="h-alerta">
        <h2 id="h-alerta">Vencem nos próximos {janela} dias</h2>
        <ListaGarantias itens={grupos.alerta} hoje={hoje} vazio={`Nenhuma garantia vence nos próximos ${janela} dias.`} />
      </section>

      <section className="secao" aria-labelledby="h-vencidas">
        <h2 id="h-vencidas">Vencidas</h2>
        <p className="secao__nota">
          {grupos.vencidas.length > LIMITE && !todasVencidas
            ? `As ${LIMITE} que venceram mais recentemente, de ${grupos.vencidas.length}.`
            : "Da mais recente para a mais antiga."}
        </p>
        <ListaGarantias
          itens={todasVencidas ? grupos.vencidas : grupos.vencidas.slice(0, LIMITE)}
          hoje={hoje}
          vazio="Nenhum equipamento ativo com garantia vencida."
        />
        {grupos.vencidas.length > LIMITE && (
          <button type="button" className="botao" style={{ marginTop: 16 }} onClick={() => setTodasVencidas((v) => !v)}>
            {todasVencidas ? "Mostrar só as recentes" : `Mostrar todas as ${grupos.vencidas.length}`}
          </button>
        )}
      </section>
    </>
  );
}

function ListaGarantias({ itens, hoje, vazio }: { itens: Item[]; hoje: string; vazio: string }) {
  const router = useRouter();
  if (!itens.length) {
    return (
      <div className="tabela-caixa">
        <div className="vazio">
          <strong>{vazio}</strong>
        </div>
      </div>
    );
  }
  return (
    <div className="tabela-caixa">
      <table className="tabela">
        <thead>
          <tr>
            <th scope="col" className="col-fixa">Controle</th>
            <th scope="col">Equipamento</th>
            <th scope="col">Unidade</th>
            <th scope="col">Usuário</th>
            <th scope="col">Cobertura</th>
            <th scope="col">Fim</th>
            <th scope="col">Situação</th>
          </tr>
        </thead>
        <tbody>
          {itens.map(({ e, gar }) => (
            <tr key={e._docId} onClick={() => router.push(`/equipamento/${encodeURIComponent(e.controle)}`)}>
              <td className="col-fixa">
                <Link href={`/equipamento/${encodeURIComponent(e.controle)}`} prefetch={false} className="codigo" onClick={(ev) => ev.stopPropagation()}>
                  {e.controle}
                </Link>
              </td>
              <td>{[e.tipo, [e.marca, e.modelo].filter(Boolean).join(" ")].filter(Boolean).join(". ")}</td>
              <td>{e.local}</td>
              <td>{e.usuario}</td>
              <td>{gar.origem}</td>
              <td className="dado">{fmtData(gar.fim)}</td>
              <td>
                <GarantiaCelula info={gar} hoje={hoje} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
