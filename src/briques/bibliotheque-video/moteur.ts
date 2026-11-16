/**
 * Lecture de la bibliothèque côté moteur (C1-U10, PLAN-FINAL § 3.2 et 3.4).
 * Pur : aucun service, aucun réglage lu, jamais de `server-only` ; importable par un moteur, JAMAIS par `studio-rendu`.
 *
 * RÈGLE DES DEUX PORTES (§ 3.4), que chaque consommateur suit :
 * 1. Une capacité qui a SON PROPRE RÉGLAGE s'allume par ce réglage. Si en plus la commande porte une entrée bibliothèque,
 *    le profil figé doit la permettre (`porteCapacite`). Sans entrée bibliothèque : le réglage propre suffit.
 * 2. Une capacité SANS RÉGLAGE PROPRE exige l'entrée bibliothèque et la permission.
 * 3. Dans tous les cas : absent = comportement d'aujourd'hui.
 */
import type { CommandeFabrication } from "@/domaine/types";
import { lecteurDepuisEntree } from "./lecteur";
import { familleDe } from "./noms";
import { lireEntreeBibliotheque } from "./schema";
import type { IdCapacite } from "./types";

/** Le lecteur de la commande, ou `null` si elle ne porte pas (ou plus lisiblement) d'entrée. Ne lève jamais. */
export function bibliothequeDeLaCommande(commande: Pick<CommandeFabrication, "entrees">): ReturnType<typeof lecteurDepuisEntree> | null {
  try {
    const entree = lireEntreeBibliotheque(commande.entrees);
    return entree ? lecteurDepuisEntree(entree) : null;
  } catch {
    return null;
  }
}

export type PorteCapacite = { bibliotheque: false } | { bibliotheque: true; permis: boolean; maxParVideo?: number };

/** Sans entrée : `{ bibliotheque: false }` (jamais « permis » : le réglage propre décide). Avec entrée : la permission du profil figé. Ne lève jamais. */
export function porteCapacite(entrees: unknown, id: IdCapacite): PorteCapacite {
  try {
    const entree = lireEntreeBibliotheque(entrees);
    if (!entree) return { bibliotheque: false };
    const { capacites, verrous } = entree.profil;
    const regle = capacites[id];
    const verrouille = verrous.includes(id) || verrous.includes(familleDe(id));
    return {
      bibliotheque: true,
      permis: regle?.permis === true && !verrouille,
      ...(regle?.maxParVideo !== undefined ? { maxParVideo: regle.maxParVideo } : {}),
    };
  } catch {
    return { bibliotheque: false };
  }
}
