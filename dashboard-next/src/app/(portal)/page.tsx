import type { Metadata } from "next";
import { getEquipamentos } from "@/lib/data";
import { agoraSP, hojeISO } from "@/lib/datas";
import { InventoryView } from "@/components/inventario/InventoryView";
import { filtrosDeParams } from "@/components/inventario/filtros";

export const metadata: Metadata = { title: "Equipamentos" };

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [sp, equipamentos] = await Promise.all([searchParams, getEquipamentos()]);
  return <InventoryView equipamentos={equipamentos} hoje={hojeISO()} lidoEm={agoraSP()} inicial={filtrosDeParams(sp)} />;
}
