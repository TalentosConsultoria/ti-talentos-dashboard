import Link from "next/link";

export default function EquipamentoNaoEncontrado() {
  return (
    <div className="erro-caixa">
      <h1>Equipamento não encontrado</h1>
      <p>Esse código de patrimônio não está no inventário. Confira o número na plaqueta (formato TAL0000).</p>
      <Link href="/" className="botao">
        Voltar para equipamentos
      </Link>
    </div>
  );
}
