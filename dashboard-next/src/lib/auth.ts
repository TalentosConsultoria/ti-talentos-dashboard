import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { authenticate, type PortalUser } from "./cf-access";

/**
 * Identidade da requisição atual, revalidada no servidor (uma vez por
 * request graças ao `cache`). Toda função de dados chama isto antes de tocar
 * no Firestore, equivalente a `_exigir_sessao_autenticada` do Streamlit.
 */
export const requireUser = cache(async (): Promise<PortalUser> => {
  const h = await headers();
  return authenticate(h);
});
