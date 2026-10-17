"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MagnifyingGlass } from "@phosphor-icons/react";
import type { PecaComEquipamento } from "@/lib/types";
import { fmtData } from "@/lib/datas";
import { fmtBRL, normalizar, plural } from "@/lib/formato";

export function PecasView({ pecas }: { pecas: PecaComEquipamento[] }) {
  const [q, setQ] = useState("");

  const filtradas = useMemo(() => {
    const t = normalizar(q.trim());
    if (!t) return pecas;
    return pecas.filter((p) =>
      normalizar([p.equipamento?.controle, p.peca, p.descricao, p.fornecedor, p.fabricante].filter(Boolean).join(" ")).includes(t),
    );
  }, [pecas, q]);

  const total = filtradas.reduce((s, p) => s + (Number(p.valor) || 0), 0);
  const totalGeral = pecas.reduce((s, p) => s + (Number(p.valor) || 0), 0);

  return (
    <>
      <header className="cabecalho">
        <div>
          <h1>Peças trocadas</h1>
          <p className="cabecalho__contexto">
            {plural(pecas.length, "troca registrada", "trocas registradas")}, {fmtBRL(totalGeral)} investidos em manutenção.
          </p>
        </div>
      </header>

      <div className="filtros" role="search" style={{ gridTemplateColumns: "minmax(220px, 420px) 1fr" }}>
        <div className="campo">
          <label htmlFor="p-busca">Buscar</label>
          <div className="busca">
            <MagnifyingGlass size={16} aria-hidden="true" />
            <input
              id="p-busca"
              className="entrada"
              type="search"
              placeholder="TAL, peça ou fornecedor"
              autoComplete="off"
              value={q}
              onChange={(ev) => setQ(ev.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="resumo-filtro" aria-live="polite">
        <span>
          <strong>{plural(filtradas.length, "peça", "peças")}</strong>
          {q ? ` no recorte, somando ${fmtBRL(total)}` : ""}
        </span>
      </div>

      <div className="tabela-caixa">
        {filtradas.length === 0 ? (
          <div className="vazio">
            <strong>{pecas.length ? "Nenhuma peça neste recorte." : "Nenhuma troca de peça registrada."}</strong>
            <span>
              {pecas.length
                ? "Tente o código TAL, o nome da peça ou o fornecedor."
                : "Os registros da coleção historico_pecas aparecem aqui."}
            </span>
          </div>
        ) : (
          <table className="tabela">
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col" className="col-fixa">Controle</th>
                <th scope="col">Tipo</th>
                <th scope="col">Peça</th>
                <th scope="col">Descrição</th>
                <th scope="col">Fabricante</th>
                <th scope="col">Fornecedor</th>
                <th scope="col" className="num">Valor</th>
                <th scope="col">NF</th>
                <th scope="col">Garantia até</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((p) => (
                <tr key={p._docId} style={{ cursor: "default" }}>
                  <td className="dado">{fmtData(p.data)}</td>
                  <td className="col-fixa">
                    {p.equipamento ? (
                      <Link href={`/equipamento/${encodeURIComponent(p.equipamento.controle)}`} prefetch={false} className="codigo">
                        {p.equipamento.controle}
                      </Link>
                    ) : (
                      <span className="apagado">Sem vínculo</span>
                    )}
                  </td>
                  <td>{p.equipamento?.tipo}</td>
                  <td>{p.peca}</td>
                  <td>{p.descricao}</td>
                  <td>{p.fabricante}</td>
                  <td>{p.fornecedor}</td>
                  <td className="num dado">{fmtBRL(p.valor)}</td>
                  <td className="dado apagado" title={p.nf ?? undefined}>
                    {p.nf ? `${p.nf.slice(0, 4)} ... ${p.nf.slice(-4)}` : ""}
                  </td>
                  <td className="dado">{fmtData(p.garantia_peca_ate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
