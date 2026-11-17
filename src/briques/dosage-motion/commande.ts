/**
 * Dosage de l'animation (X3-03) : écrit le cran dans la commande de fabrication. PURE : aucun import de service, de
 * moteur ni d'argent, jamais importée par le rendu. Aucune date, aucun hasard.
 * Rend une NOUVELLE commande ; l'entrée n'est jamais modifiée.
 */
import type { CommandeFabrication } from "@/domaine/types";
import { NIVEAU_DU_DOSAGE } from "./crans";
import type { DosageMotion } from "./types";

/** Clé d'entrée du motion commun de l'avocat (= `ENTREE_MOTION_AVOCAT`, `montage-avocat/motion.ts`) : gardée par un test. */
const CLE_MOTION_AVOCAT = "avocatMotionCommune";

const estAvocat = (c: CommandeFabrication) => (c.moteurId ? c.moteurId === "montage-avocat" : c.formatId === "avocat");

/**
 * X3-04 : avocat au cran « aucun ». Plans sans illustration (le plan illustration redevient un plan normal, comme une
 * brique coupée), sans texte à l'écran, sans zoom fin ; plus d'entrée de motion commun. Les consignes du monteur et la
 * carte de fin restent (règle 7, Q4). Pur : ne modifie jamais l'entrée.
 */
function sansAnimationAvocat(c: CommandeFabrication): Partial<CommandeFabrication> {
  const sortie: Partial<CommandeFabrication> = {};
  if (c.plans) {
    sortie.plans = c.plans.map((p) => {
      const q = { ...p, illustration: undefined, texteEcran: undefined } as typeof p;
      if (p.sourceImage === "illustration") q.sourceImage = "double";
      if (p.cadrage && "zoomFin" in p.cadrage) {
        const { zoomFin: _z, ...cadrage } = p.cadrage;
        q.cadrage = cadrage;
      }
      return q;
    });
  }
  if (c.entrees && CLE_MOTION_AVOCAT in c.entrees) {
    const { [CLE_MOTION_AVOCAT]: _e, ...entrees } = c.entrees;
    sortie.entrees = entrees;
  }
  return sortie;
}

export type ChoisiPar = "video" | "generateur" | "code";

export function appliquerDosage(
  c: CommandeFabrication,
  p: { cran: DosageMotion; choisiPar: ChoisiPar; v4?: boolean },
): CommandeFabrication {
  const sortie: CommandeFabrication = { ...c, dosageMotion: { cran: p.cran, choisiPar: p.choisiPar } };
  // La v4 ne lit pas l'intensité : seul le cran est figé.
  if (p.v4) return sortie;
  const niveau = NIVEAU_DU_DOSAGE[p.cran];
  if (c.intensite) sortie.intensite = { ...c.intensite, niveau };
  if (c.sousTitres) sortie.sousTitres = { ...c.sousTitres, intensite: niveau };
  return p.cran === "aucun" && estAvocat(c) ? { ...sortie, ...sansAnimationAvocat(c) } : sortie;
}
