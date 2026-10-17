"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ChartBar,
  List as IconeMenu,
  Monitor,
  ShieldCheck,
  SignOut,
  Wrench,
  X,
  type Icon,
} from "@phosphor-icons/react";
import { ThemeToggle } from "./ThemeToggle";

type Item = { href: string; rotulo: string; icone: Icon; ativo: (p: string) => boolean };

const GRUPOS: { titulo: string; itens: Item[] }[] = [
  {
    titulo: "Inventário",
    itens: [
      { href: "/", rotulo: "Equipamentos", icone: Monitor, ativo: (p) => p === "/" || p.startsWith("/equipamento") },
      { href: "/garantias", rotulo: "Garantias", icone: ShieldCheck, ativo: (p) => p.startsWith("/garantias") },
    ],
  },
  {
    titulo: "Manutenção",
    itens: [{ href: "/pecas", rotulo: "Peças trocadas", icone: Wrench, ativo: (p) => p.startsWith("/pecas") }],
  },
  {
    titulo: "Gestão",
    itens: [{ href: "/relatorios", rotulo: "Relatórios", icone: ChartBar, ativo: (p) => p.startsWith("/relatorios") }],
  },
];

type Props = { user: { nome: string; email: string }; logoutUrl: string | null };

function Marca() {
  return (
    <Link href="/" className="marca">
      <span className="marca__selo" aria-hidden="true">
        T
      </span>
      <span className="marca__nome">
        <strong>TI Talentos</strong>
        <span>Inventário</span>
      </span>
    </Link>
  );
}

function Navegacao({ aoNavegar }: { aoNavegar?: () => void }) {
  const pathname = usePathname() ?? "/";
  return (
    <nav className="nav" aria-label="Seções do portal">
      {GRUPOS.map((g) => (
        <div className="nav__grupo" key={g.titulo}>
          <h2>{g.titulo}</h2>
          <ul>
            {g.itens.map((item) => {
              const ativo = item.ativo(pathname);
              const Icone = item.icone;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="nav__link"
                    aria-current={ativo ? "page" : undefined}
                    onClick={aoNavegar}
                  >
                    <Icone size={18} weight={ativo ? "fill" : "regular"} aria-hidden="true" />
                    {item.rotulo}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Rodape({ user, logoutUrl }: Props) {
  return (
    <div className="sidebar__rodape">
      <div className="usuario">
        <strong title={user.nome}>{user.nome}</strong>
        <span title={user.email}>{user.email}</span>
      </div>
      <div className="sidebar__acoes">
        <ThemeToggle />
        {logoutUrl && (
          <a className="botao botao--sutil" href={logoutUrl}>
            <SignOut size={16} aria-hidden="true" />
            Sair
          </a>
        )}
      </div>
    </div>
  );
}

export function Sidebar(props: Props) {
  const [aberta, setAberta] = useState(false);

  return (
    <>
      <aside className="sidebar">
        <Marca />
        <Navegacao />
        <Rodape {...props} />
      </aside>

      <header className="topo-mobile">
        <Marca />
        <Dialog.Root open={aberta} onOpenChange={setAberta}>
          <Dialog.Trigger asChild>
            <button className="botao botao--icone" aria-label="Abrir menu">
              <IconeMenu size={20} aria-hidden="true" />
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="gaveta__fundo" />
            <Dialog.Content className="gaveta" aria-describedby={undefined}>
              <Dialog.Title className="sr-only">Menu</Dialog.Title>
              <Marca />
              <Dialog.Close asChild>
                <button className="botao botao--icone botao--sutil gaveta__fechar" aria-label="Fechar menu">
                  <X size={20} aria-hidden="true" />
                </button>
              </Dialog.Close>
              <Navegacao aoNavegar={() => setAberta(false)} />
              <Rodape {...props} />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </header>
    </>
  );
}
