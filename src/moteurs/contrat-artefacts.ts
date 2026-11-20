/**
 * Contrat des artefacts (G12-04) : un résultat de fabrication contient ce que la déclaration du format promet.
 * Pur : aucun service, aucun réglage, aucun argent. Rien ne l'appelle encore (l'appel depuis chaque moteur = fiches suivantes).
 * Un lecteur n'existe que s'il est prouvé (chemin:ligne en commentaire) ; sinon `nonVerifiable` avec la raison.
 * Jamais « présent » par défaut.
 */
import { DECLARATIONS } from "../generateurs/declaration";
import type { ResultatFabrication } from "./types";

export type EntreeResultat = Pick<ResultatFabrication, "projetMontage" | "plans" | "pistes">;
export type Lecteur = (r: EntreeResultat) => boolean;
export type EntreeLecteur = Lecteur | { readonly nonVerifiable: string };

function objet(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
}

function casConcret(r: EntreeResultat): Record<string, unknown> | undefined {
  return objet(objet(r.projetMontage)?.casConcret);
}

const nv = (raison: string): { readonly nonVerifiable: string } => Object.freeze({ nonVerifiable: raison });
const NV_PLAN = nv("emplacement du plan non prouvé dans le code de ce moteur (G12.md § 1.3 absent du dépôt privé)");
const NV_VOIX = nv("emplacement de la voix non prouvé dans le code de ce moteur (G12.md § 1.3 absent du dépôt privé)");
const NV_SCENES = nv("emplacement des rendus de scène non prouvé dans le code de ce moteur (G12.md § 1.3 absent du dépôt privé)");

const NV_PLAN_VL = nv("VL-05 : pas encore produit par le moteur (le plan de la vidéo longue n'est pas encore rangé dans le résultat)");
const NV_SCENES_VL = nv("VL-05 : pas encore produit par le moteur (les rendus de scène de la vidéo longue ne sont pas encore rangés)");
const NV_VOIX_VL = nv("le moteur range la voix dans projetMontage.reprise.voix (montage-video-longue/index.ts:50-55) ; lecteur à brancher avec VL-05, quand le résultat complet est produit");

/** Plans du résultat : `ResultatFabrication.plans` (src/moteurs/types.ts:94), rempli par le cas concret (montage-cas-concret/index.ts:765). */
const PLANS_PRESENTS: Lecteur = (r) => Array.isArray(r.plans) && r.plans.length > 0;
/** Voix du cas concret : `projetMontage.casConcret.voix` (montage-cas-concret/index.ts:840). */
const VOIX_CAS_CONCRET: Lecteur = (r) => {
  const v = casConcret(r)?.voix;
  return v !== undefined && v !== null;
};
/** Rendus des écrans : `journal.ecrans` (montage-cas-concret/fabriquer.ts:144), retiré par `journalAGarder` (index.ts:183-185). */
const RENDUS_CAS_CONCRET: Lecteur = (r) => {
  const j = objet(casConcret(r)?.journal);
  return j?.ecrans !== undefined && j.ecrans !== null;
};

export const LECTEURS_ARTEFACTS: Readonly<Record<string, Readonly<Record<string, EntreeLecteur>>>> = Object.freeze({
  "avocat": Object.freeze({ plan: NV_PLAN, voix: NV_VOIX }),
  "facecam": Object.freeze({ plan: NV_PLAN }),
  "podcast": Object.freeze({ plan: NV_PLAN }),
  "createur-b": Object.freeze({ plan: NV_PLAN }),
  "ecran-partage": Object.freeze({ plan: NV_PLAN }),
  "motion": Object.freeze({ plan: NV_PLAN }),
  "ugc": Object.freeze({ plan: NV_PLAN }),
  "selfie": Object.freeze({ plan: NV_PLAN }),
  "tableau-anime": Object.freeze({ plan: NV_PLAN, voix: NV_VOIX, "rendus-scenes": NV_SCENES }),
  "cas-concret": Object.freeze({ plan: PLANS_PRESENTS, voix: VOIX_CAS_CONCRET, "rendus-scenes": RENDUS_CAS_CONCRET }),
  "facecam-animee": Object.freeze({ plan: NV_PLAN, voix: NV_VOIX }),
  "image-video": Object.freeze({ plan: NV_PLAN, voix: NV_VOIX, "rendus-scenes": NV_SCENES }),
  "tutoriel-outil": Object.freeze({ plan: NV_PLAN, voix: NV_VOIX, "rendus-scenes": NV_SCENES }),
  "demo-facecam": Object.freeze({ plan: NV_PLAN }),
  "tableau-de-bord": Object.freeze({ plan: NV_PLAN, voix: NV_VOIX, "rendus-scenes": NV_SCENES }),
  "video-longue": Object.freeze({ plan: NV_PLAN_VL, voix: NV_VOIX_VL, "rendus-scenes": NV_SCENES_VL }),
});

export interface ArtefactsDuResultat {
  presents: string[];
  manquants: string[];
  nonVerifiables: string[];
}

/** Classe chaque artefact promis par la déclaration du format. Ne lève jamais ; format inconnu : tout vide. */
export function artefactsDuResultat(formatId: string, r: EntreeResultat): ArtefactsDuResultat {
  const sortie: ArtefactsDuResultat = { presents: [], manquants: [], nonVerifiables: [] };
  try {
    if (!Object.prototype.hasOwnProperty.call(DECLARATIONS, formatId)) return sortie;
    const lecteurs = Object.prototype.hasOwnProperty.call(LECTEURS_ARTEFACTS, formatId) ? LECTEURS_ARTEFACTS[formatId] : {};
    for (const a of DECLARATIONS[formatId].artefacts) {
      const l = Object.prototype.hasOwnProperty.call(lecteurs, a) ? lecteurs[a] : undefined;
      if (typeof l !== "function") { sortie.nonVerifiables.push(a); continue; }
      let present = false;
      try { present = l(r) === true; } catch { present = false; }
      (present ? sortie.presents : sortie.manquants).push(a);
    }
  } catch {
    return { presents: [], manquants: [], nonVerifiables: [] };
  }
  return sortie;
}

export interface EcartConnu { readonly formatId: string; readonly artefact: string; readonly raison: string }

/** Promis mais non gardé aujourd'hui. La liste ne doit que rétrécir. */
export const ECARTS_CONNUS: readonly EcartConnu[] = Object.freeze([
  Object.freeze({
    formatId: "cas-concret",
    artefact: "rendus-scenes",
    raison: "`journalAGarder` (montage-cas-concret/index.ts:183-185) ne garde que version et étapes : les écrans rendus ne sont pas sur la version.",
  }),
]);
