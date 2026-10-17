import type { Metadata } from "next";
import { getEquipamentos } from "@/lib/data";
import { hojeISO } from "@/lib/datas";
import { GarantiasView } from "@/components/garantias/GarantiasView";

export const metadata: Metadata = { title: "Garantias" };

export default async function GarantiasPage() {
  const equipamentos = (await getEquipamentos()).filter((e) => e.obsoleto !== true);
  return <GarantiasView equipamentos={equipamentos} hoje={hojeISO()} />;
}
