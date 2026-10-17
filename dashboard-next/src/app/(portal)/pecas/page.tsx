import type { Metadata } from "next";
import { getPecasCompleto } from "@/lib/data";
import { PecasView } from "@/components/pecas/PecasView";

export const metadata: Metadata = { title: "Peças trocadas" };

export default async function PecasPage() {
  const pecas = await getPecasCompleto();
  return <PecasView pecas={pecas} />;
}
