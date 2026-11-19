/**
 * S-08 · Traduction PURE d'une demande d'animation (vocabulaire de la fiche d'animation d'élément, S-07) vers la
 * déclinaison d'UN écran du cas concret (`TirageEcran`, `variete.ts`). Table fermée : rien n'est inventé, ce qui n'a pas
 * d'équivalent est refusé en une phrase claire. Aucun accès base ni réseau, aucun coût.
 */
import { decrireFiche, ENTREES as ENTREES_S07, INTENSITES as INTENSITES_S07, VITESSES as VITESSES_S07, type FicheAnimation } from "@/briques/animation-element";
import { MOUVEMENTS_CAMERA, SORTIES, schemaTirageEcran, type Mise, type MouvementCamera, type TirageEcran } from "./variete";

export { ENTREES_S07, INTENSITES_S07, VITESSES_S07 };

export interface DemandeAnimationEcran {
  entree?: (typeof ENTREES_S07)[number];
  intensite?: (typeof INTENSITES_S07)[number];
  sortie?: (typeof SORTIES)[number];
  vitesse?: (typeof VITESSES_S07)[number];
}

export const PHRASE_VITESSE_ECRAN = "La vitesse ne se règle pas encore sur un écran du cas concret.";
export const PHRASE_SANS_MISE = "L'animation de cette vidéo ne se règle pas écran par écran.";

/** Entrée S-07 → entrée du cas concret. « pop » n'a pas d'équivalent (refusé) ; « écrit » = le titre mot par mot. */
const ENTREE_VERS_ECRAN: Readonly<Record<string, Partial<Pick<TirageEcran, "entree" | "motParMot">> | null>> = Object.freeze({
  fondu: { entree: "fondu-recul-v4" },
  glisse: { entree: "glissement" },
  zoom: { entree: "zoom-avant" },
  pop: null,
  ecrit: { motParMot: "cascade" },
});

/** Mouvement « normal » : celui qu'aurait donné le style de caméra de la vidéo. */
function cameraNormale(mise: Mise): MouvementCamera {
  return mise.tirage.camera.style === "aucune-v4" ? "aucun" : "zoom-lent";
}

export type ResultatAnimationEcran = { ok: true; tirage: TirageEcran } | { ok: false; raison: string };

/** Applique la demande sur le tirage actuel d'un écran ; ne touche à aucun autre champ. */
export function appliquerAnimationEcran(actuel: TirageEcran, demande: DemandeAnimationEcran, mise: Mise): ResultatAnimationEcran {
  if (demande.vitesse !== undefined) return { ok: false, raison: PHRASE_VITESSE_ECRAN };
  if (demande.entree === undefined && demande.intensite === undefined && demande.sortie === undefined) return { ok: false, raison: "Dites ce qui change dans l'animation de cet écran : l'entrée, l'intensité ou la sortie." };
  let suivant: TirageEcran = { ...actuel };
  if (demande.entree !== undefined) {
    const v = ENTREE_VERS_ECRAN[demande.entree];
    if (!v) return { ok: false, raison: `L'entrée « ${demande.entree} » n'existe pas encore sur un écran du cas concret.` };
    suivant = { ...suivant, ...v };
  }
  if (demande.intensite !== undefined) {
    const camera: MouvementCamera = demande.intensite === "douce" ? MOUVEMENTS_CAMERA[0] : demande.intensite === "forte" ? "punch-in" : cameraNormale(mise);
    suivant = { ...suivant, camera };
  }
  if (demande.sortie !== undefined) suivant = { ...suivant, sortie: demande.sortie };
  const lu = schemaTirageEcran.safeParse(suivant);
  if (!lu.success) return { ok: false, raison: "Cette animation n'est pas possible sur cet écran." };
  return { ok: true, tirage: lu.data };
}

/** Entrée du cas concret → entrée S-07 (celles qui n'ont pas d'équivalent restent nommées telles quelles). */
const ENTREE_DEPUIS_ECRAN: Readonly<Record<string, FicheAnimation["entree"]>> = Object.freeze({ "fondu-recul-v4": "fondu", glissement: "glisse", "zoom-avant": "zoom" });

/** Une ligne lisible par Claude et par Williams (sans montant), dans le vocabulaire de la fiche d'animation S-07. */
export function decrireAnimationEcran(t: TirageEcran): string {
  const entree = ENTREE_DEPUIS_ECRAN[t.entree];
  const intensite: FicheAnimation["intensite"] = t.camera === "aucun" ? "douce" : t.camera === "punch-in" ? "forte" : "normale";
  const base = decrireFiche({ ...(entree ? { entree } : {}), intensite });
  return `${base}${entree ? "" : `, entrée ${t.entree}`}${t.sortie === "aucune-v4" ? "" : `, sortie ${t.sortie}`}`;
}
