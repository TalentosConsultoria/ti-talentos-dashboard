import "server-only";
import type { Equipamento, HistoricoUso, Peca } from "./types";
import { somarMeses } from "./datas";

/**
 * DADOS DE DEMONSTRAÇÃO. Usados só fora de produção quando não há credencial
 * do Firestore. Nomes de pessoas são fictícios. Gerados de forma determinística
 * (mesma semente = mesmo parque), com datas relativas a hoje para que os
 * estados de garantia (vencida, a vencer, coberta) sempre apareçam.
 */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const UNIDADES = ["MATRIZ", "MATRIZ", "MATRIZ", "JPA", "SCR", "FFC", "NR", "BOHEMIA", "PIRAI", "MACACU"];
const SETORES = ["TI", "DP", "Financeiro", "Almoxarifado", "Comercial", "Operações", "RH", "Diretoria", "Jurídico"];
const PRIMEIROS = [
  "Renata", "Wellington", "Jéssica", "Cláudio", "Thaís", "Edson", "Priscila", "Rogério", "Luana", "Fabrício",
  "Simone", "Anderson", "Patrícia", "Gilberto", "Camila", "Valdir", "Débora", "Márcio", "Aline", "Sérgio",
  "Viviane", "Josué", "Raquel", "Leandro", "Tatiane", "Douglas", "Elaine", "Wagner", "Kátia", "Hélio",
];
const SOBRENOMES = [
  "Albuquerque", "Siqueira", "Monteiro", "Pacheco", "Figueiredo", "Rangel", "Bittencourt", "Queiroz",
  "Tavares", "Machado", "Coutinho", "Brandão", "Valente", "Peixoto", "Guimarães", "Seabra",
];

type Modelo = { tipo: string; marca: string; modelo: string; proc?: string; mem?: string; disco?: string; so?: string };
const MODELOS: { peso: number; m: Modelo }[] = [
  { peso: 22, m: { tipo: "Desktop", marca: "Dell", modelo: "OptiPlex 3080", proc: "Intel Core i5-10500", mem: "8 GB", disco: "SSD 256 GB", so: "Windows 10 Pro" } },
  { peso: 16, m: { tipo: "Desktop", marca: "Dell", modelo: "OptiPlex 7010", proc: "Intel Core i5-13500", mem: "16 GB", disco: "SSD 512 GB", so: "Windows 11 Pro" } },
  { peso: 6, m: { tipo: "Desktop", marca: "Dell", modelo: "OptiPlex 3020", proc: "Intel Core i3-4160", mem: "4 GB", disco: "HD 500 GB", so: "Windows 10 Pro" } },
  { peso: 18, m: { tipo: "Notebook", marca: "Dell", modelo: "Latitude 5420", proc: "Intel Core i5-1145G7", mem: "16 GB", disco: "SSD 256 GB", so: "Windows 11 Pro" } },
  { peso: 10, m: { tipo: "Notebook", marca: "Dell", modelo: "Latitude 3540", proc: "Intel Core i7-1355U", mem: "16 GB", disco: "SSD 512 GB", so: "Windows 11 Pro" } },
  { peso: 5, m: { tipo: "Notebook", marca: "Lenovo", modelo: "ThinkPad E14 Gen 4", proc: "AMD Ryzen 5 5625U", mem: "8 GB", disco: "SSD 256 GB", so: "Windows 11 Pro" } },
  { peso: 12, m: { tipo: "Monitor", marca: "Dell", modelo: "P2422H" } },
  { peso: 5, m: { tipo: "Monitor", marca: "LG", modelo: "24MK430H" } },
  { peso: 5, m: { tipo: "Impressora", marca: "HP", modelo: "LaserJet Pro M428fdw" } },
  { peso: 3, m: { tipo: "Impressora", marca: "Brother", modelo: "DCP-L5652DN" } },
  { peso: 2, m: { tipo: "Servidor", marca: "Dell", modelo: "PowerEdge T340", proc: "Intel Xeon E-2224", mem: "32 GB", disco: "4x HD 2 TB RAID 5", so: "Windows Server 2019" } },
  { peso: 1, m: { tipo: "Servidor", marca: "Dell", modelo: "PowerEdge R250", proc: "Intel Xeon E-2314", mem: "32 GB", disco: "2x SSD 960 GB RAID 1", so: "Windows Server 2022" } },
  { peso: 4, m: { tipo: "Switch", marca: "Ubiquiti", modelo: "UniFi USW-24-PoE" } },
  { peso: 4, m: { tipo: "Nobreak", marca: "APC", modelo: "Back-UPS 1500VA" } },
  { peso: 6, m: { tipo: "Celular", marca: "Samsung", modelo: "Galaxy A34 5G", so: "Android 14" } },
];
const FORNECEDORES = ["Dell Computadores do Brasil", "Kalunga", "Kabum", "Pichau Informática", "Mercado Livre", "Magazine Luiza Empresas"];

function escolher<T>(r: () => number, lista: T[]): T {
  return lista[Math.floor(r() * lista.length)];
}

function escolherModelo(r: () => number): Modelo {
  const total = MODELOS.reduce((s, x) => s + x.peso, 0);
  let alvo = r() * total;
  for (const x of MODELOS) {
    alvo -= x.peso;
    if (alvo <= 0) return x.m;
  }
  return MODELOS[0].m;
}

function serial(r: () => number, marca: string): string {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
  const n = marca === "Dell" ? 7 : 10;
  let s = "";
  for (let i = 0; i < n; i++) s += abc[Math.floor(r() * abc.length)];
  return s;
}

function chaveNF(r: () => number, dataCompra: string): string {
  const aamm = dataCompra.slice(2, 4) + dataCompra.slice(5, 7);
  let corpo = "33" + aamm + "72381189000110" + "55" + "001";
  corpo += String(Math.floor(r() * 999_999)).padStart(9, "0") + "1";
  corpo += String(Math.floor(r() * 99_999_999)).padStart(8, "0");
  return corpo + String(Math.floor(r() * 10));
}

let cache: { hoje: string; equipamentos: Equipamento[]; historico: HistoricoUso[]; pecas: Peca[] } | null = null;

export function gerarMock(hoje: string) {
  if (cache && cache.hoje === hoje) return cache;
  const r = mulberry32(20261017);
  const equipamentos: Equipamento[] = [];
  const historico: HistoricoUso[] = [];
  const pecas: Peca[] = [];

  for (let i = 1; i <= 164; i++) {
    const m = escolherModelo(r);
    const controle = `TAL${String(i).padStart(4, "0")}`;
    const local = escolher(r, UNIDADES);
    const setor = escolher(r, SETORES);
    const pessoa = `${escolher(r, PRIMEIROS)} ${escolher(r, SOBRENOMES)}`;
    const ehPessoal = ["Desktop", "Notebook", "Celular"].includes(m.tipo);

    // Idade do parque: maioria entre 1 e 6 anos, uma cauda antiga.
    const idadeMeses = Math.floor(Math.pow(r(), 1.3) * 120) + 2;
    const compra = somarMeses(hoje, -idadeMeses);
    const semData = r() < 0.06;
    const anosGarantia = m.marca === "Dell" ? (r() < 0.5 ? 3 : 1) : 1;
    const termino = somarMeses(compra, anosGarantia * 12);
    const estendida = m.marca === "Dell" && r() < 0.22 ? somarMeses(termino, 24) : null;
    const fornecedorAte = !estendida && r() < 0.12 ? somarMeses(compra, 18) : null;
    const dellFim = m.marca === "Dell" && !semData && r() < 0.55 ? (estendida ?? termino) : null;
    const obsoleto = idadeMeses > 100 && r() < 0.45;

    const e: Equipamento = {
      _docId: `mock-${controle}`,
      id: `mock-${controle}`,
      controle,
      nome_dispositivo: ehPessoal && m.tipo !== "Celular" ? `${local.slice(0, 3)}-${m.tipo === "Notebook" ? "NB" : "DT"}${String(i).padStart(3, "0")}` : null,
      tipo: m.tipo,
      marca: m.marca,
      modelo: m.modelo,
      serial: serial(r, m.marca),
      setor: m.tipo === "Servidor" || m.tipo === "Switch" || m.tipo === "Nobreak" ? "TI" : setor,
      local,
      usuario: ehPessoal ? pessoa : m.tipo === "Impressora" ? `Uso compartilhado ${setor}` : null,
      so: m.so ?? null,
      processador: m.proc ?? null,
      memoria: m.mem ?? null,
      disco: m.disco ?? null,
      status: obsoleto ? "Baixado" : r() < 0.06 ? "Em manutenção" : r() < 0.05 ? "Estoque" : "Em uso",
      termino_garantia: semData ? null : termino,
      garantia_extendida_ate: semData ? null : estendida,
      garantia_fornecedor_ate: semData ? null : fornecedorAte,
      garantia_dell_inicio: dellFim ? compra : null,
      garantia_dell_fim: dellFim,
      data_compra: semData ? null : compra,
      data_incorporacao: semData ? null : somarMeses(compra, 0),
      fornecedor: semData ? null : m.marca === "Dell" && r() < 0.7 ? "Dell Computadores do Brasil" : escolher(r, FORNECEDORES),
      tipo_aquisicao: r() < 0.9 ? "Compra" : "Doação",
      obsoleto,
      chave_nf: !semData && r() < 0.55 ? chaveNF(r, compra) : null,
      data_baixa: obsoleto ? somarMeses(hoje, -Math.floor(r() * 18) - 1) : null,
      motivo_baixa: obsoleto ? escolher(r, ["Fim de vida útil", "Placa-mãe sem reparo", "Doação para instituição"]) : null,
    };
    equipamentos.push(e);

    if (ehPessoal && r() < 0.35) {
      const n = 1 + Math.floor(r() * 3);
      let anterior = `${escolher(r, PRIMEIROS)} ${escolher(r, SOBRENOMES)}`;
      for (let k = 0; k < n; k++) {
        const novo = k === n - 1 ? pessoa : `${escolher(r, PRIMEIROS)} ${escolher(r, SOBRENOMES)}`;
        historico.push({
          _docId: `mock-h-${controle}-${k}`,
          equipamento_id: e.id,
          data_transferencia: somarMeses(compra, Math.floor(((k + 1) * idadeMeses) / (n + 1))),
          usuario_anterior: anterior,
          usuario_novo: novo,
          local_novo: k === n - 1 ? local : escolher(r, UNIDADES),
          motivo: escolher(r, ["Admissão", "Troca de setor", "Desligamento do usuário anterior", "Substituição de equipamento"]),
        });
        anterior = novo;
      }
    }

    if ((m.tipo === "Desktop" || m.tipo === "Notebook") && r() < 0.18) {
      const opcoes = [
        { peca: "Memória RAM", descricao: "8 GB DDR4 3200 MHz", fabricante: "Kingston", valor: 189.9 },
        { peca: "SSD", descricao: "NVMe 512 GB", fabricante: "WD", valor: 279.0 },
        { peca: "Bateria", descricao: "3 células 54 Wh", fabricante: "Dell", valor: 412.5 },
        { peca: "Fonte", descricao: "180 W", fabricante: "Dell", valor: 236.0 },
        { peca: "Teclado", descricao: "ABNT2 retroiluminado", fabricante: "Dell", valor: 198.0 },
      ];
      const o = escolher(r, opcoes);
      const data = somarMeses(hoje, -Math.floor(r() * 30) - 1);
      pecas.push({
        _docId: `mock-p-${controle}`,
        equipamento_id: e.id,
        data,
        ...o,
        fornecedor: escolher(r, ["Kabum", "Pichau Informática", "Dell Computadores do Brasil"]),
        tecnico: "Marcelo",
        nf: r() < 0.6 ? chaveNF(r, data) : null,
        garantia_peca_ate: somarMeses(data, 12),
      });
    }
  }

  cache = { hoje, equipamentos, historico, pecas };
  return cache;
}
