# Inventário de TI · Talentos (Next.js)

Substituto do dashboard Streamlit (`../dashboard/`). Leitura do Firestore, autenticação pelo
Cloudflare Access. Sistema visual documentado em
`.claude/projetos/portal-inventario-ti/SISTEMA.md`.

## Rodar local

```bash
npm install
npm run dev        # http://localhost:3000
```

Sem nenhuma variável, o `npm run dev` entra em `AUTH_MODE=local` e usa **dados de demonstração**
(164 equipamentos fictícios, aviso "Dados de demonstração" no topo). Para ler o Firestore real,
crie `.env.local` com `FIREBASE_SERVICE_ACCOUNT_JSON` (ver `.env.example`).

> Atenção ao OneDrive: `npm install` aqui cria `node_modules/` (cerca de 300 MB) e o OneDrive vai
> sincronizar tudo. Prefira clonar o repositório numa pasta fora do OneDrive para desenvolver.

```bash
npm run build && npm run start   # build de produção (fail-closed: exige CF_ACCESS_*)
npm run typecheck
```

## Arquitetura

| Camada | Arquivo | O que faz |
|---|---|---|
| Portão 1 | `src/proxy.ts` | Valida o JWT `Cf-Access-Jwt-Assertion` (ou cookie `CF_Authorization`) antes de qualquer rota. Responde 403 sem renderizar nada |
| Portão 2 | `src/lib/auth.ts` | `requireUser()` revalida a identidade em toda leitura de dados (defesa em profundidade) |
| JWT | `src/lib/cf-access.ts` | Porte de `cf_access.py`: RS256, `iss`, `aud`, `exp`, JWKS com cache de 1h, allowlist por e-mail e domínio |
| Dados | `src/lib/data.ts` + `firestore.ts` | `firebase-admin` no servidor com a mesma service account do Streamlit |
| Demo | `src/lib/mock.ts` | Dados fictícios determinísticos; recusados em produção |
| Garantia | `src/lib/garantia.ts` | Cobertura vigente = a mais longa entre original, fornecedor, estendida e Dell; períodos em anos e meses civis |

### Por que o Firestore é lido no servidor (e não pelo Firebase JS SDK no navegador)

O Cloudflare Access protege o HTML do portal, não o Firestore. O SDK web fala direto com
`firestore.googleapis.com`. Para funcionar no navegador, as regras do banco precisariam liberar
leitura pública (qualquer um com o `projectId` leria o inventário), ou seria preciso ativar o
Firebase Auth com token customizado e reescrever as regras, ou seja, mexer no backend. Lendo no
servidor com `firebase-admin`, as regras continuam fechadas, nenhuma credencial chega ao navegador
e a autenticação fail-closed do Streamlit fica preservada.

## Rotas

| Rota | Substitui | Conteúdo |
|---|---|---|
| `/` | `pages/inventario.py` | Métricas clicáveis, busca (`/`), filtros na URL, TanStack Table virtualizada, colunas configuráveis |
| `/equipamento/[controle]` | `pages/ficha.py` | Plaqueta, régua de cobertura, abas (identificação, NF-e, histórico, peças), impressão |
| `/garantias` | `pages/garantias.py` | Janela de alerta ajustável, calendário de 12 meses, listas a vencer e vencidas |
| `/pecas` | `pages/pecas.py` (histórico) | Histórico geral com busca e total em R$ |
| `/relatorios` | `pages/relatorios.py` (gráficos) | Idade do parque, garantia por unidade, equipamentos por tipo |
| `/api/health` | `/_stcore/health` | Health check do Render |

**Ficou fora desta versão (somente leitura):** lançar NF-e, registrar peça e gerar PDF via Python.
A ficha agora é impressa pelo navegador (`Imprimir ficha`), com folha de estilo de impressão.
