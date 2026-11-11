/**
 * INSCRIPTION DE LA PUBLICATION RÉELLE (lots R1 et z1p). Le registre (`fournisseurs/index.ts`) appelle
 * `publicationBuffer()` une fois, sans rien savoir des outils : cette fonction rend les outils dont la clé existe.
 * - `{ buffer: … }` si `BUFFER_API_KEY` existe ; `{ zernio: … }` si `ZERNIO_API_KEY` existe.
 * Sans clé : rien n'est inscrit pour l'outil, la simulation reste (rien ne part). Aucun repli d'un outil vers l'autre
 * (D2) : `fournisseurParId` refuse un identifiant non inscrit.
 */
import { cleDans, type Env } from "../mesures/commun";
import { VARIABLE_CLE_BUFFER } from "../mesures/buffer";
import type { FournisseurPublication } from "../types";
import { creerPublicationBuffer } from "./buffer";
import { creerPublicationZernio } from "./zernio";

export const VARIABLE_CLE_ZERNIO = "ZERNIO_API_KEY";

/**
 * Interrupteur « Tout arrêter », relu à chaque requête. Import différé : les services importent déjà les fournisseurs,
 * un import direct ferait une boucle.
 */
/** L7-08 : le fournisseur de publication (posts du calendrier) exige l'ancien ET le nouveau réglage. */
export const envoiAutoriseCalendrierClient = async (): Promise<boolean> => (await import("@/services/zernio")).envoiPublicationCalendrierAutorise();

export function publicationZernio(env: Env = process.env): Record<string, FournisseurPublication> {
  const cle = cleDans(env, VARIABLE_CLE_ZERNIO);
  return cle ? { zernio: creerPublicationZernio(cle, { client: { envoiAutorise: envoiAutoriseCalendrierClient } }) } : {};
}

export function publicationBuffer(env: Env = process.env): Record<string, FournisseurPublication> {
  const cle = cleDans(env, VARIABLE_CLE_BUFFER);
  return { ...(cle ? { buffer: creerPublicationBuffer(cle) } : {}), ...publicationZernio(env) };
}
