"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnOrderState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { CaretDown, CaretUp, Check, Columns, FunnelSimple, MagnifyingGlass } from "@phosphor-icons/react";
import type { Equipamento } from "@/lib/types";
import { infoGarantia, type InfoGarantia } from "@/lib/garantia";
import { fmtData } from "@/lib/datas";
import { comparar, normalizar, plural, unicos } from "@/lib/formato";
import { GarantiaCelula } from "@/components/garantia/Garantia";
import { FILTROS_VAZIOS, filtrosDeParams, filtrosParaQuery, type FiltroGarantia, type Filtros } from "./filtros";

type Linha = { e: Equipamento; gar: InfoGarantia; busca: string; modelo: string };

const ALTURA_LINHA = 44;
const ALTURA_CABECALHO = 36;
const CHAVE_COLUNAS = "inventario:colunas:v2";

const COLUNAS_OCULTAS_PADRAO: VisibilityState = {
  nome_dispositivo: false,
  serial: false,
  so: false,
  processador: false,
  memoria: false,
  disco: false,
  fornecedor: false,
  tipo_aquisicao: false,
};

function txt(v: string | null | undefined) {
  return v ?? "";
}

function colunaTexto(id: keyof Equipamento, header: string, extra?: { mono?: boolean }): ColumnDef<Linha> {
  return {
    id: id as string,
    header,
    accessorFn: (l) => txt(l.e[id] as string | null) || undefined,
    sortingFn: (a, b, col) => comparar(String(a.getValue(col) ?? ""), String(b.getValue(col) ?? "")),
    sortUndefined: "last",
    cell: (c) => {
      const v = c.getValue() as string | undefined;
      return extra?.mono ? <span className="dado">{v}</span> : v;
    },
  };
}

export function InventoryView({
  equipamentos,
  hoje,
  lidoEm,
  inicial,
}: {
  equipamentos: Equipamento[];
  hoje: string;
  lidoEm: string;
  inicial: Filtros;
}) {
  const router = useRouter();
  const params = useSearchParams();
  // A URL real manda (no "voltar" o router pode restaurar props antigos do servidor).
  const [f, setF] = useState<Filtros>(() => (params.size ? filtrosDeParams(Object.fromEntries(params)) : inicial));
  const [sorting, setSorting] = useState<SortingState>([{ id: "controle", desc: false }]);
  const [visibilidade, setVisibilidade] = useState<VisibilityState>(COLUNAS_OCULTAS_PADRAO);
  const [ordemColunas, setOrdemColunas] = useState<ColumnOrderState>([]);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const busca = useRef<HTMLInputElement>(null);
  const caixa = useRef<HTMLDivElement>(null);

  const set = <K extends keyof Filtros>(k: K, v: Filtros[K]) => setF((atual) => ({ ...atual, [k]: v }));

  // Linhas com garantia pré-calculada (uma vez por carga).
  const linhas = useMemo<Linha[]>(
    () =>
      equipamentos.map((e) => ({
        e,
        gar: infoGarantia(e, hoje),
        modelo: [e.marca, e.modelo].filter(Boolean).join(" "),
        busca: normalizar(
          [e.controle, e.serial, e.marca, e.modelo, e.usuario, e.nome_dispositivo].filter(Boolean).join(" "),
        ),
      })),
    [equipamentos, hoje],
  );

  const opcoes = useMemo(
    () => ({
      tipos: unicos(equipamentos.map((e) => e.tipo)),
      locais: unicos(equipamentos.map((e) => e.local)),
      setores: unicos(equipamentos.map((e) => e.setor)),
    }),
    [equipamentos],
  );

  // Escopo = todos os filtros menos o de garantia (as métricas usam este recorte).
  const escopo = useMemo(() => {
    const q = normalizar(f.q.trim());
    return linhas.filter(
      (l) =>
        (f.baixados || l.e.obsoleto !== true) &&
        (!f.tipo || l.e.tipo === f.tipo) &&
        (!f.local || l.e.local === f.local) &&
        (!f.setor || l.e.setor === f.setor) &&
        (!q || l.busca.includes(q)),
    );
  }, [linhas, f.q, f.tipo, f.local, f.setor, f.baixados]);

  const visiveis = useMemo(
    () => (f.garantia === "todas" ? escopo : escopo.filter((l) => l.gar.status === f.garantia)),
    [escopo, f.garantia],
  );

  const metricas = useMemo(() => {
    const ativos = escopo.filter((l) => l.e.obsoleto !== true);
    return {
      ativos: ativos.length,
      unidades: new Set(ativos.map((l) => l.e.local).filter(Boolean)).size,
      vencidas: ativos.filter((l) => l.gar.status === "vencida").length,
      alerta: ativos.filter((l) => l.gar.status === "alerta").length,
    };
  }, [escopo]);

  const totalAtivos = useMemo(() => linhas.filter((l) => l.e.obsoleto !== true).length, [linhas]);
  const totalUnidades = useMemo(
    () => new Set(linhas.filter((l) => l.e.obsoleto !== true).map((l) => l.e.local).filter(Boolean)).size,
    [linhas],
  );

  const colunas = useMemo<ColumnDef<Linha>[]>(
    () => [
      {
        id: "controle",
        header: "Controle",
        accessorFn: (l) => l.e.controle,
        meta: { fixa: true },
        enableHiding: false,
        cell: (c) => (
          <Link href={`/equipamento/${encodeURIComponent(c.row.original.e.controle)}`} prefetch={false} className="codigo" onClick={(ev) => ev.stopPropagation()}>
            {c.row.original.e.controle}
          </Link>
        ),
      },
      colunaTexto("nome_dispositivo", "Dispositivo", { mono: true }),
      colunaTexto("tipo", "Tipo"),
      {
        id: "modelo",
        header: "Marca e modelo",
        accessorFn: (l) => l.modelo || undefined,
        sortUndefined: "last",
        sortingFn: (a, b) => comparar(a.original.modelo, b.original.modelo),
      },
      colunaTexto("serial", "Serial", { mono: true }),
      colunaTexto("local", "Unidade"),
      colunaTexto("setor", "Setor"),
      colunaTexto("usuario", "Usuário"),
      {
        id: "garantia",
        header: "Garantia",
        accessorFn: (l) => l.gar.dias ?? undefined,
        sortUndefined: "last",
        cell: (c) => <GarantiaCelula info={c.row.original.gar} hoje={hoje} />,
      },
      colunaTexto("so", "S.O."),
      colunaTexto("processador", "Processador"),
      colunaTexto("memoria", "Memória"),
      colunaTexto("disco", "Disco"),
      colunaTexto("status", "Status"),
      {
        id: "data_compra",
        header: "Compra",
        accessorFn: (l) => l.e.data_compra || undefined,
        sortUndefined: "last",
        cell: (c) => <span className="dado">{fmtData(c.getValue() as string | undefined)}</span>,
      },
      colunaTexto("fornecedor", "Fornecedor"),
      colunaTexto("tipo_aquisicao", "Aquisição"),
    ],
    [hoje],
  );

  const table = useReactTable({
    data: visiveis,
    columns: colunas,
    state: { sorting, columnVisibility: visibilidade, columnOrder: ordemColunas },
    onColumnOrderChange: setOrdemColunas,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setVisibilidade,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (l) => l.e._docId,
  });

  const rows = table.getRowModel().rows;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => caixa.current,
    estimateSize: () => ALTURA_LINHA,
    paddingStart: ALTURA_CABECALHO,
    overscan: 6,
    initialRect: { width: 1200, height: 560 },
  });
  const itens = virtualizer.getVirtualItems();
  const padTop = itens.length ? itens[0].start - ALTURA_CABECALHO : 0;
  const padBottom = itens.length ? virtualizer.getTotalSize() - itens[itens.length - 1].end : 0;
  const nColunas = table.getVisibleLeafColumns().length;

  // Preferência de colunas persistida no navegador.
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CHAVE_COLUNAS);
      if (salvo) setVisibilidade({ ...COLUNAS_OCULTAS_PADRAO, ...JSON.parse(salvo) });
    } catch {
      /* ignora preferência corrompida */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(CHAVE_COLUNAS, JSON.stringify(visibilidade));
    } catch {
      /* sem persistência */
    }
  }, [visibilidade]);

  // No celular a régua de garantia vem logo depois do código (cabe sem rolar).
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    const aplicar = () => setOrdemColunas(mq.matches ? ["controle", "garantia"] : []);
    aplicar();
    mq.addEventListener("change", aplicar);
    return () => mq.removeEventListener("change", aplicar);
  }, []);

  // Filtros refletidos na URL (link compartilhável, voltar da ficha preserva).
  useEffect(() => {
    window.history.replaceState(null, "", `${window.location.pathname}${filtrosParaQuery(f)}`);
  }, [f]);

  // Volta ao topo da tabela quando o recorte muda.
  useEffect(() => {
    caixa.current?.scrollTo({ top: 0 });
  }, [f]);

  // Atalho "/" para a busca.
  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      const alvo = ev.target as HTMLElement | null;
      if (ev.key !== "/" || ev.metaKey || ev.ctrlKey) return;
      if (alvo && (alvo.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(alvo.tagName))) return;
      ev.preventDefault();
      busca.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtrando = JSON.stringify(f) !== JSON.stringify(FILTROS_VAZIOS);
  const nFiltros = [f.tipo, f.local, f.setor, f.garantia !== "todas", f.baixados].filter(Boolean).length;
  const alternarGarantia = (g: FiltroGarantia) => set("garantia", f.garantia === g ? "todas" : g);
  const pct = metricas.ativos ? Math.round((metricas.vencidas / metricas.ativos) * 100) : 0;

  return (
    <>
      <header className="cabecalho">
        <div>
          <h1>Equipamentos</h1>
          <p className="cabecalho__contexto">
            {plural(totalAtivos, "ativo", "ativos")} em {plural(totalUnidades, "unidade", "unidades")}. Leitura de {lidoEm}.
          </p>
        </div>
      </header>

      <section className="metricas" aria-label="Resumo do recorte atual">
        <div className="metrica">
          <span className="metrica__rotulo">Ativos</span>
          <span className="metrica__valor">{metricas.ativos}</span>
          <span className="metrica__nota">em {plural(metricas.unidades, "unidade", "unidades")}</span>
        </div>
        <button
          type="button"
          className="metrica metrica--vencida"
          aria-pressed={f.garantia === "vencida"}
          title="Filtrar a tabela pelas garantias vencidas"
          onClick={() => alternarGarantia("vencida")}
        >
          <FunnelSimple className="metrica__filtro" size={16} aria-hidden="true" />
          <span className="metrica__rotulo">Garantia vencida</span>
          <span className="metrica__valor">{metricas.vencidas}</span>
          <span className="metrica__nota">{pct}% dos ativos</span>
        </button>
        <button
          type="button"
          className="metrica metrica--alerta"
          aria-pressed={f.garantia === "alerta"}
          title="Filtrar a tabela pelas garantias que vencem em 90 dias"
          onClick={() => alternarGarantia("alerta")}
        >
          <FunnelSimple className="metrica__filtro" size={16} aria-hidden="true" />
          <span className="metrica__rotulo">Vence em 90 dias</span>
          <span className="metrica__valor">{metricas.alerta}</span>
          <span className="metrica__nota">Planejar renovação ou troca</span>
        </button>
        <div className="metrica">
          <span className="metrica__rotulo">Na tabela</span>
          <span className="metrica__valor">{visiveis.length}</span>
          <span className="metrica__nota">{filtrando ? "com os filtros aplicados" : "sem filtro"}</span>
        </div>
      </section>

      <div className="filtros" role="search">
        <div className="campo busca-campo">
          <label htmlFor="f-busca">Buscar</label>
          <div className="busca">
            <MagnifyingGlass size={16} aria-hidden="true" />
            <input
              ref={busca}
              id="f-busca"
              className="entrada"
              type="search"
              placeholder="TAL, serial, modelo ou usuário"
              autoComplete="off"
              value={f.q}
              onChange={(ev) => set("q", ev.target.value)}
            />
            {!f.q && <kbd aria-hidden="true">/</kbd>}
          </div>
        </div>
        <button
          type="button"
          className="botao filtros__abrir"
          aria-expanded={filtrosAbertos}
          aria-controls="filtros-extras"
          onClick={() => setFiltrosAbertos((v) => !v)}
          style={{ alignSelf: "end" }}
        >
          <FunnelSimple size={16} aria-hidden="true" />
          Filtros{nFiltros ? ` (${nFiltros})` : ""}
        </button>
        <div id="filtros-extras" className="filtros__extras" data-aberto={filtrosAbertos}>
        <Seletor id="f-tipo" rotulo="Tipo" valor={f.tipo} opcoes={opcoes.tipos} todos="Todos" onChange={(v) => set("tipo", v)} />
        <Seletor id="f-local" rotulo="Unidade" valor={f.local} opcoes={opcoes.locais} todos="Todas" onChange={(v) => set("local", v)} />
        <Seletor id="f-setor" rotulo="Setor" valor={f.setor} opcoes={opcoes.setores} todos="Todos" onChange={(v) => set("setor", v)} />
        <div className="campo">
          <label htmlFor="f-garantia">Garantia</label>
          <select
            id="f-garantia"
            className="seletor"
            value={f.garantia}
            onChange={(ev) => set("garantia", ev.target.value as FiltroGarantia)}
          >
            <option value="todas">Todas</option>
            <option value="vencida">Vencida</option>
            <option value="alerta">Vence em 90 dias</option>
            <option value="ok">Coberta</option>
            <option value="sem_info">Sem registro</option>
          </select>
        </div>
        <div className="filtros__fim">
          <label className="alternador">
            <input type="checkbox" checked={f.baixados} onChange={(ev) => set("baixados", ev.target.checked)} />
            Incluir baixados
          </label>
          <SeletorColunas table={table} />
        </div>
        </div>
      </div>

      <div className="resumo-filtro" aria-live="polite">
        <span>
          <strong>{plural(visiveis.length, "equipamento", "equipamentos")}</strong>
          {filtrando ? " no recorte" : ""}
        </span>
        {filtrando && (
          <button type="button" className="link-acao" onClick={() => setF(FILTROS_VAZIOS)}>
            Limpar filtros
          </button>
        )}
      </div>

      <div ref={caixa} className="tabela-caixa tabela-caixa--virtual">
        <table className="tabela" aria-rowcount={rows.length + 1}>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const ordem = h.column.getIsSorted();
                  const fixa = (h.column.columnDef.meta as { fixa?: boolean } | undefined)?.fixa;
                  return (
                    <th
                      key={h.id}
                      scope="col"
                      className={fixa ? "col-fixa" : undefined}
                      aria-sort={ordem === "asc" ? "ascending" : ordem === "desc" ? "descending" : "none"}
                    >
                      <button type="button" className="ordenar" data-ativo={!!ordem} onClick={h.column.getToggleSortingHandler()}>
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {ordem === "asc" ? (
                          <CaretUp size={12} weight="bold" aria-hidden="true" />
                        ) : ordem === "desc" ? (
                          <CaretDown size={12} weight="bold" aria-hidden="true" />
                        ) : null}
                      </button>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className="espaco">
                <td colSpan={nColunas}>
                  <div className="vazio">
                    <strong>Nenhum equipamento neste recorte.</strong>
                    <span>Revise a busca ou os filtros. Equipamentos baixados só aparecem com a opção marcada.</span>
                    <button type="button" className="botao" onClick={() => setF(FILTROS_VAZIOS)}>
                      Limpar filtros
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              <>
                {padTop > 0 && (
                  <tr className="espaco" aria-hidden="true">
                    <td colSpan={nColunas} style={{ height: padTop }} />
                  </tr>
                )}
                {itens.map((vi) => {
                  const row = rows[vi.index];
                  const e = row.original.e;
                  return (
                    <tr
                      key={row.id}
                      aria-rowindex={vi.index + 2}
                      className={e.obsoleto ? "baixado" : undefined}
                      onClick={() => router.push(`/equipamento/${encodeURIComponent(e.controle)}`)}
                    >
                      {row.getVisibleCells().map((cell) => {
                        const fixa = (cell.column.columnDef.meta as { fixa?: boolean } | undefined)?.fixa;
                        return (
                          <td key={cell.id} className={fixa ? "col-fixa" : undefined}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {padBottom > 0 && (
                  <tr className="espaco" aria-hidden="true">
                    <td colSpan={nColunas} style={{ height: padBottom }} />
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Seletor({
  id,
  rotulo,
  valor,
  opcoes,
  todos,
  onChange,
}: {
  id: string;
  rotulo: string;
  valor: string;
  opcoes: string[];
  todos: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="campo">
      <label htmlFor={id}>{rotulo}</label>
      <select id={id} className="seletor" value={valor} onChange={(ev) => onChange(ev.target.value)}>
        <option value="">{todos}</option>
        {opcoes.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function SeletorColunas({ table }: { table: ReturnType<typeof useReactTable<Linha>> }) {
  const colunas = table.getAllLeafColumns().filter((c) => c.getCanHide());
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <button type="button" className="botao">
          <Columns size={16} aria-hidden="true" />
          Colunas
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="menu" align="end" sideOffset={6}>
          <DropdownMenu.Label className="menu__rotulo">Colunas visíveis</DropdownMenu.Label>
          {colunas.map((c) => (
            <DropdownMenu.CheckboxItem
              key={c.id}
              className="menu__item"
              checked={c.getIsVisible()}
              onCheckedChange={(v) => c.toggleVisibility(!!v)}
              onSelect={(ev) => ev.preventDefault()}
            >
              <span className="menu__check">
                <DropdownMenu.ItemIndicator>
                  <Check size={14} weight="bold" aria-hidden="true" />
                </DropdownMenu.ItemIndicator>
              </span>
              {String(c.columnDef.header)}
            </DropdownMenu.CheckboxItem>
          ))}
          <DropdownMenu.Separator className="menu__sep" />
          <DropdownMenu.Item className="menu__item" onSelect={() => table.setColumnVisibility(COLUNAS_OCULTAS_PADRAO)}>
            <span className="menu__check" />
            Restaurar padrão
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
