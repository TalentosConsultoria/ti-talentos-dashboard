import { requireUser } from "@/lib/auth";
import { AccessDenied, logoutUrl } from "@/lib/cf-access";
import { fonteDadosSegura } from "@/lib/data";
import { Sidebar } from "@/components/shell/Sidebar";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    // O proxy já barra antes; isto é a segunda camada.
    const motivo = err instanceof AccessDenied ? err.message : "Falha na verificação de acesso.";
    return (
      <main className="principal">
        <div className="erro-caixa" role="alert">
          <h1>Acesso negado</h1>
          <p>{motivo}</p>
        </div>
      </main>
    );
  }

  const fonte = fonteDadosSegura();

  return (
    <>
      <a href="#conteudo" className="pular">
        Pular para o conteúdo
      </a>
      <div className="shell">
        <Sidebar user={{ nome: user.nome, email: user.email }} logoutUrl={logoutUrl()} />
        <main id="conteudo" className="principal" tabIndex={-1}>
          {fonte === "mock" && (
            <p className="aviso-demo" role="note" title="Configure FIREBASE_SERVICE_ACCOUNT_JSON para ler o Firestore.">
              Dados de demonstração
            </p>
          )}
          {children}
        </main>
      </div>
    </>
  );
}
