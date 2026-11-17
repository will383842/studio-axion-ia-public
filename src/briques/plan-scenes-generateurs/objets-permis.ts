/**
 * Objets permis lus dans l'entrée bibliothèque figée (C9-35a). Fonctions pures, AUCUN appelant (C9-35b les branchera).
 * Ne lève jamais ; ne lit aucun réglage ; importe seulement `moteur` et `noms` de la bibliothèque.
 */
import { porteCapacite } from "../bibliotheque-video/moteur";
import { ID } from "../bibliotheque-video/noms";
import type { CapaciteObjet, DefinitionObjet } from "../motion/petits-objets/contrat";
import { OBJETS_PAR_VIDEO_MAX } from "../motion/petits-objets/contrat";

const IDS_OBJET = (Object.values(ID) as string[]).filter((id): id is CapaciteObjet => id.startsWith("objet."));

/** Capacités `objet.*` permises par le profil figé (ordre de `noms.ts`). Sans entrée ou entrée illisible : `[]`. */
export function objetsPermisDesEntrees(entrees: unknown): readonly CapaciteObjet[] {
  try {
    return Object.freeze(IDS_OBJET.filter((id) => {
      const p = porteCapacite(entrees, id as never);
      return p.bibliotheque && p.permis;
    }));
  } catch {
    return Object.freeze([]);
  }
}

/** Plus petit `maxParVideo` des objets permis, borné par `OBJETS_PAR_VIDEO_MAX` ; aucun permis : 0. */
export function maxObjetsParVideo(entrees: unknown): number {
  try {
    let max = 0;
    let vu = false;
    for (const id of objetsPermisDesEntrees(entrees)) {
      const p = porteCapacite(entrees, id as never);
      const m = p.bibliotheque && typeof p.maxParVideo === "number" && Number.isFinite(p.maxParVideo) ? Math.max(0, Math.floor(p.maxParVideo)) : OBJETS_PAR_VIDEO_MAX;
      max = vu ? Math.min(max, m) : m;
      vu = true;
    }
    return Math.min(max, OBJETS_PAR_VIDEO_MAX);
  } catch {
    return 0;
  }
}

/** Filtre pur des définitions d'objets par capacité permise, ordre conservé. */
export function definitionsPermises<P>(defs: readonly DefinitionObjet<P>[], permis: readonly CapaciteObjet[]): readonly DefinitionObjet<P>[] {
  return defs.filter((d) => permis.includes(d.capacite));
}
