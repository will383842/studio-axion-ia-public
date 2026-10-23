/**
 * INSCRIPTION DU CALAGE RÉEL (posée par l'architecte le 02/10, `docs/LOT-INTENSITE-CREDITS-EXECUTION.md`, remplie par D3).
 * Le registre (`fournisseurs/index.ts`) appelle `aligneurReel()` une fois, sans être touché.
 * `{ "studio-aligneur": … }` si `STUDIO_ALIGNEUR_URL` existe (client HTTP du conteneur `studio-aligneur`, même
 * protocole et même clé partagée `STUDIO_RENDU_CLE` que `studio-rendu`). Il s'active ensuite par
 * `FOURNISSEUR_ALIGNEMENT=studio-aligneur` (ou le réglage « fournisseur.alignement ») ; Réglages > Connexions affiche
 * alors « Calage des sous-titres » relié.
 * Sans adresse : rien n'est inscrit, la simulation reste (le moteur saute alors le calage).
 */
import type { FournisseurAlignement } from "../types";
import { creerAligneurHttp } from "./client";

export function aligneurReel(env: Record<string, string | undefined> = process.env): Record<string, FournisseurAlignement> {
  const url = env.STUDIO_ALIGNEUR_URL?.trim();
  if (!url || !/^https?:\/\//.test(url)) return {};
  return { "studio-aligneur": creerAligneurHttp(url, { cle: env.STUDIO_RENDU_CLE?.trim() || undefined }) };
}
