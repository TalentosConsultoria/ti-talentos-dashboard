import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@/styles/tokens.css";
import "@/styles/base.css";
import "@/styles/layout.css";
import "@/styles/components.css";

// Fontes baixadas no build e servidas pelo próprio app (sem chamada ao Google em
// runtime). Subset latin: ~1/2 do peso das variáveis completas do pacote `geist`.
const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap", preload: false });

export const metadata: Metadata = {
  title: { default: "Inventário de TI · Talentos", template: "%s · Inventário de TI" },
  description: "Inventário patrimonial de TI da Talentos Consultoria.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#14171b",
  colorScheme: "dark light",
};

// Tema escuro é o padrão; a escolha manual fica no localStorage.
const scriptTema = `try{var t=localStorage.getItem("tema");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="dark" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTema }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
