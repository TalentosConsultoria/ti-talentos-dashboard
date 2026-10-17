import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { getEquipamento, getHistoricoUso, getPecasDoEquipamento } from "@/lib/data";
import { fmtData, hojeISO } from "@/lib/datas";
import { fmtBRL } from "@/lib/formato";
import { infoGarantia } from "@/lib/garantia";
import { chaveAgrupada, parseChave } from "@/lib/nfe";
import type { Equipamento } from "@/lib/types";
import { SeloGarantia } from "@/components/garantia/Garantia";
import { LinhaDoTempo } from "@/components/garantia/LinhaDoTempo";
import { FichaAbas } from "@/components/ficha/FichaAbas";
import { BotaoImprimir } from "@/components/ficha/BotaoImprimir";
import { BotaoCopiar } from "@/components/ficha/BotaoCopiar";

type Params = { params: Promise<{ controle: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { controle } = await params;
  return { title: decodeURIComponent(controle).toUpperCase() };
}

type Campo = { rotulo: string; valor: string | null | undefined; dado?: boolean };

function Grupo({ titulo, campos }: { titulo: string; campos: Campo[] }) {
  return (
    <section className="grupo">
      <h3>{titulo}</h3>
      <dl>
        {campos.map((c) => {
          const v = (c.valor ?? "").toString().trim();
          return (
            <div key={c.rotulo}>
              <dt>{c.rotulo}</dt>
              <dd className={!v ? "vazio-texto" : c.dado ? "dado" : undefined}>{v || "Não informado"}</dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

function Identificacao({ e }: { e: Equipamento }) {
  return (
    <div className="grupos">
      <Grupo
        titulo="Hardware"
        campos={[
          { rotulo: "Processador", valor: e.processador },
          { rotulo: "Memória", valor: e.memoria, dado: true },
          { rotulo: "Disco", valor: e.disco, dado: true },
          { rotulo: "Sistema operacional", valor: e.so },
          { rotulo: "Serial", valor: e.serial, dado: true },
        ]}
      />
      <Grupo
        titulo="Alocação"
        campos={[
          { rotulo: "Unidade", valor: e.local },
          { rotulo: "Setor", valor: e.setor },
          { rotulo: "Usuário", valor: e.usuario },
          { rotulo: "Nome do dispositivo", valor: e.nome_dispositivo, dado: true },
          { rotulo: "Status", valor: e.status },
        ]}
      />
      <Grupo
        titulo="Aquisição"
        campos={[
          { rotulo: "Data de compra", valor: fmtData(e.data_compra), dado: true },
          { rotulo: "Fornecedor", valor: e.fornecedor },
          { rotulo: "Tipo de aquisição", valor: e.tipo_aquisicao },
          { rotulo: "Incorporação", valor: fmtData(e.data_incorporacao), dado: true },
          { rotulo: "Garantia original até", valor: fmtData(e.termino_garantia), dado: true },
        ]}
      />
    </div>
  );
}

function NotaFiscal({ chave }: { chave: string | null | undefined }) {
  const info = parseChave(chave);
  if (!chave) {
    return (
      <div className="vazio vazio--solto">
        <strong>Nenhuma NF-e associada.</strong>
        <span>O lançamento de NF-e continua no fluxo do agente NF (certificado A1).</span>
      </div>
    );
  }
  return (
    <div className="nf">
      <div>
        <p className="campo__rotulo" style={{ marginBottom: 8 }}>
          Chave de acesso
        </p>
        <div className="nf__chave">
          <code>{chaveAgrupada(chave)}</code>
          <BotaoCopiar texto={chave.replace(/[\s.]/g, "")} rotulo="Copiar chave" />
        </div>
      </div>
      {info ? (
        <dl className="nf__dados">
          <div>
            <dt>Modelo</dt>
            <dd>{info.modelo}</dd>
          </div>
          <div>
            <dt>Número</dt>
            <dd>{info.numero}</dd>
          </div>
          <div>
            <dt>Série</dt>
            <dd>{info.serie}</dd>
          </div>
          <div>
            <dt>Emissão</dt>
            <dd>{info.emissao}</dd>
          </div>
          <div>
            <dt>UF</dt>
            <dd>{info.uf}</dd>
          </div>
          <div>
            <dt>CNPJ emitente</dt>
            <dd>{info.cnpj}</dd>
          </div>
        </dl>
      ) : (
        <p className="secao__nota">A chave não tem 44 dígitos; confira o cadastro.</p>
      )}
    </div>
  );
}

export default async function FichaPage({ params }: Params) {
  const { controle } = await params;
  const e = await getEquipamento(decodeURIComponent(controle));
  if (!e) notFound();

  const [historico, pecas] = await Promise.all([getHistoricoUso(e), getPecasDoEquipamento(e)]);
  const hoje = hojeISO();
  const info = infoGarantia(e, hoje);
  const totalPecas = pecas.reduce((s, p) => s + (Number(p.valor) || 0), 0);
  const titulo = [e.marca, e.modelo].filter(Boolean).join(" ") || e.tipo || e.controle;
  const contexto = [e.tipo, [e.local, e.setor].filter(Boolean).join(", "), e.usuario].filter(Boolean);

  return (
    <article>
      <Link href="/" className="voltar nao-imprimir">
        <ArrowLeft size={16} aria-hidden="true" />
        Equipamentos
      </Link>

      <header className="ficha-topo">
        <div className="plaqueta" aria-label={`Patrimônio ${e.controle}`}>
          <div className="plaqueta__topo" aria-hidden="true">
            <span>Patrimônio</span>
            <span>Talentos</span>
          </div>
          <span className="plaqueta__codigo">{e.controle}</span>
          {e.serial && <span className="plaqueta__serial">S/N {e.serial}</span>}
        </div>
        <div className="ficha-titulo">
          <h1>{titulo}</h1>
          <p>{contexto.join(". ")}</p>
          <SeloGarantia info={info} hoje={hoje} longo />
          {e.obsoleto && (
            <p className="baixa">
              Baixado em {fmtData(e.data_baixa) || "data não informada"}
              {e.motivo_baixa ? `. ${e.motivo_baixa}` : ""}
            </p>
          )}
        </div>
        <BotaoImprimir />
      </header>

      <section className="secao" style={{ marginTop: 0 }} aria-labelledby="h-cobertura">
        <h2 id="h-cobertura">Cobertura de garantia</h2>
        <LinhaDoTempo equipamento={e} info={info} hoje={hoje} />
      </section>

      <div className="secao">
        <FichaAbas
          abas={[
            { id: "identificacao", rotulo: "Identificação", conteudo: <Identificacao e={e} /> },
            { id: "nf", rotulo: "Nota fiscal", conteudo: <NotaFiscal chave={e.chave_nf} /> },
            {
              id: "historico",
              rotulo: "Histórico de uso",
              contagem: historico.length,
              conteudo: historico.length ? (
                <div className="tabela-caixa">
                  <table className="tabela">
                    <thead>
                      <tr>
                        <th scope="col">Data</th>
                        <th scope="col">Usuário anterior</th>
                        <th scope="col">Novo usuário</th>
                        <th scope="col">Unidade</th>
                        <th scope="col">Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historico.map((h) => (
                        <tr key={h._docId} style={{ cursor: "default" }}>
                          <td className="dado">{fmtData(h.data_transferencia)}</td>
                          <td>{h.usuario_anterior}</td>
                          <td>{h.usuario_novo}</td>
                          <td>{h.local_novo}</td>
                          <td>{h.motivo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="vazio vazio--solto">
                  <strong>Nenhuma transferência registrada.</strong>
                  <span>O equipamento está com o mesmo usuário desde o cadastro.</span>
                </div>
              ),
            },
            {
              id: "pecas",
              rotulo: "Peças",
              contagem: pecas.length,
              conteudo: pecas.length ? (
                <>
                  <p className="secao__nota" style={{ margin: "0 0 16px" }}>
                    Total investido em peças: <strong className="dado">{fmtBRL(totalPecas)}</strong>
                  </p>
                  <div className="tabela-caixa">
                    <table className="tabela">
                      <thead>
                        <tr>
                          <th scope="col">Data</th>
                          <th scope="col">Peça</th>
                          <th scope="col">Descrição</th>
                          <th scope="col">Fabricante</th>
                          <th scope="col">Fornecedor</th>
                          <th scope="col" className="num">Valor</th>
                          <th scope="col">Garantia até</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pecas.map((p) => (
                          <tr key={p._docId} style={{ cursor: "default" }}>
                            <td className="dado">{fmtData(p.data)}</td>
                            <td>{p.peca}</td>
                            <td>{p.descricao}</td>
                            <td>{p.fabricante}</td>
                            <td>{p.fornecedor}</td>
                            <td className="num dado">{fmtBRL(p.valor)}</td>
                            <td className="dado">{fmtData(p.garantia_peca_ate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="vazio vazio--solto">
                  <strong>Nenhuma peça trocada.</strong>
                  <span>Trocas registradas aparecem aqui e na página Peças trocadas.</span>
                </div>
              ),
            },
          ]}
        />
      </div>
    </article>
  );
}
