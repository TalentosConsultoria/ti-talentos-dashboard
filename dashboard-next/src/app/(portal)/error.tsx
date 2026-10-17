"use client";

export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="erro-caixa" role="alert">
      <h1>Não foi possível ler o inventário</h1>
      <p>
        O Firestore não respondeu ou a configuração do servidor está incompleta. Tente de novo; se persistir, verifique as
        variáveis de ambiente no Render.
      </p>
      {error.digest && (
        <p className="dado" style={{ fontSize: "var(--fs-rotulo)" }}>
          Código do erro: {error.digest}
        </p>
      )}
      <button type="button" className="botao" onClick={reset}>
        Tentar de novo
      </button>
    </div>
  );
}
