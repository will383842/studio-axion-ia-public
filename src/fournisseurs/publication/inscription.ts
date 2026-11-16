/**
 * INSCRIPTION DE LA PUBLICATION RÉELLE (lots R1 et z1p). Le registre (`fournisseurs/index.ts`) appelle
 * `publicationBuffer()` une fois, sans rien savoir des outils : cette fonction rend les outils dont la clé existe.
 * - `{ zernio: … }` si `ZERNIO_API_KEY` existe. Buffer n'est plus inscrit (L0-13a), même avec `BUFFER_API_KEY` (clé gardée pour la lecture de l'historique).
 * Sans clé : rien n'est inscrit pour l'outil, la simulation reste (rien ne part). Aucun repli d'un outil vers l'autre
 * (D2) : `fournisseurParId` refuse un identifiant non inscrit.
 */
import { cleDans, type Env } from "../mesures/commun";
import type { FournisseurPublication } from "../types";
import { creerPublicationZernio } from "./zernio";

export const VARIABLE_CLE_ZERNIO = "ZERNIO_API_KEY";

/**
 * L7-08 : le fournisseur de publication (posts du calendrier) exige l'ancien (« Tout arrêter », relu à chaque requête), le réglage du calendrier ET la publication éditoriale (éteinte par défaut).
 * Import différé : les services importent déjà les fournisseurs, un import direct ferait une boucle.
 */
export const envoiAutoriseCalendrierClient = async (): Promise<boolean> => (await import("@/services/zernio")).publicationEditorialeAutorisee();

export function publicationZernio(env: Env = process.env): Record<string, FournisseurPublication> {
  const cle = cleDans(env, VARIABLE_CLE_ZERNIO);
  return cle ? { zernio: creerPublicationZernio(cle, { client: { envoiAutorise: envoiAutoriseCalendrierClient } }) } : {};
}

/** L0-13a : nom conservé (importé par le registre), mais Buffer n'est plus inscrit : seul Zernio peut envoyer. */
export function publicationBuffer(env: Env = process.env): Record<string, FournisseurPublication> {
  return publicationZernio(env);
}
