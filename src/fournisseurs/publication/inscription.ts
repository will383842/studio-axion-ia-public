/**
 * INSCRIPTION DE LA PUBLICATION RÉELLE (lot R1). Le registre (`fournisseurs/index.ts`) appelle `publicationBuffer()`
 * une fois, sans rien savoir de Buffer.
 * `{ buffer: … }` si `BUFFER_API_KEY` existe ; il s'active ensuite par le choix de Will (Réglages, Connexions,
 * « fournisseur.publication » = buffer) ou `FOURNISSEUR_PUBLICATION=buffer`. Sans clé : rien n'est inscrit, la
 * simulation reste (rien ne part).
 */
import { cleDans, type Env } from "../mesures/commun";
import { VARIABLE_CLE_BUFFER } from "../mesures/buffer";
import type { FournisseurPublication } from "../types";
import { creerPublicationBuffer } from "./buffer";

export function publicationBuffer(env: Env = process.env): Record<string, FournisseurPublication> {
  const cle = cleDans(env, VARIABLE_CLE_BUFFER);
  return cle ? { buffer: creerPublicationBuffer(cle) } : {};
}
