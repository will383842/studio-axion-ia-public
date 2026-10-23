/**
 * CHOIX DU FOURNISSEUR des travaux face caméra (plan facecam v4, lot A). Par défaut : le DOUBLE DE SIMULATION.
 * Le vrai `studio-aligneur` n'est pris que si l'appelant le demande (`reel`, décidé au lot B, par exemple par un
 * réglage en base) ET que `STUDIO_ALIGNEUR_URL` existe (même adresse et même clé `STUDIO_RENDU_CLE` que le calage des
 * sous-titres). Aucune variable d'environnement nouvelle : le déploiement ne change pas.
 */
import { creerFacecamHttp, type FournisseurFacecam } from "./client";
import { creerFacecamSimule } from "./simulation";

export type * from "./client";
export { ROUTES_FACECAM } from "./client";
export { creerFacecamHttp } from "./client";
export { creerFacecamSimule } from "./simulation";

export function fournisseurFacecam(options: { reel?: boolean } = {}, env: Record<string, string | undefined> = process.env): FournisseurFacecam {
  const url = env.STUDIO_ALIGNEUR_URL?.trim();
  if (options.reel && url && /^https?:\/\//.test(url)) {
    return creerFacecamHttp(url, { cle: env.STUDIO_RENDU_CLE?.trim() || undefined });
  }
  return creerFacecamSimule();
}
