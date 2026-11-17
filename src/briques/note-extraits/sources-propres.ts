/**
 * Sources propres (X4-09) : moments tirés de l'écran de démo et des captures du cas concret. Fonctions pures :
 * aucune lecture de stockage, aucun réseau, aucune date du jour, aucun hasard. Appelées seulement par X4-10 ; rien ne les importe.
 *
 * PRISE V4 : AUCUN moment dans cette fiche. Le recalage de la prise brute par les coupes n'est pas prouvé (étude UT-3.13) ;
 * `DemandeChaineV4.priseCle` n'est donc pas lu ici.
 *
 * Les décisions viennent de `noter` (X4-04) ; ici on ne fait que donner les moments et leurs contraintes :
 * - `decisionMax` (écran de démo) : synchro `audio` ou `fourni` → « garde » ; `debut` ou `aucune` → « peut-etre » (calage non prouvé).
 *   À appliquer avec `appliquerPlafond` sur la note.
 * - captures : valeurs fictives, donc `CHIFFRES_REELS_CAPTURE = false` ; `usagesPermis` retire « preuve-chiffree ».
 */
import type { EtatCaptures } from "@/moteurs/montage-cas-concret/captures";
import { DUREE_CAPTURE_SEC } from "@/moteurs/montage-cas-concret/captures";
import type { EntreesDemo } from "@/moteurs/montage-demo-facecam/entrees";
import { momentsDepuisScenes } from "./moments-ecran";
import type { Moment, NoteMoment, UsageExtrait } from "./types";

type Decision = NoteMoment["decision"];

/** Les captures du cas concret montrent des valeurs fictives (`captures.ts`) : jamais de chiffres réels. */
export const CHIFFRES_REELS_CAPTURE = false;

const TRANCHE_MAX_SEC = 6;

export interface MomentsEcranDemo {
  moments: Moment[];
  /** Décision la plus haute permise à ces moments. */
  decisionMax: "garde" | "peut-etre";
}

/** Moments sur la ligne de temps de l'écran. Sans écran séparé (une seule vidéo) : aucun moment. */
export function momentsEcranDemo(entrees: EntreesDemo, plan?: unknown): MomentsEcranDemo {
  const ecran = entrees?.ecran;
  if (!ecran || typeof ecran.cle !== "string") return { moments: [], decisionMax: "garde" };
  const mode = entrees.synchro?.mode;
  const decisionMax = mode === "audio" || mode === "fourni" ? "garde" : "peut-etre";
  const sourcePlan = plan ?? entrees.plan;
  let moments = momentsDepuisScenes(sourcePlan, { avecVisage: false }).map<Moment>((m) => ({
    ...m, origine: "ecran-demo", avecVisage: false, texteIncruste: false, sourceCle: ecran.cle,
  }));
  if (moments.length === 0 && typeof ecran.dureeSec === "number" && Number.isFinite(ecran.dureeSec) && ecran.dureeSec > 0) {
    const n = Math.ceil(ecran.dureeSec / TRANCHE_MAX_SEC - 1e-9);
    const pas = ecran.dureeSec / n;
    moments = Array.from({ length: n }, (_, k) => {
      const debutSec = Math.round(k * pas * 100) / 100;
      const finSec = k === n - 1 ? ecran.dureeSec! : Math.round((k + 1) * pas * 100) / 100;
      return {
        id: `e-${Math.round(debutSec * 100)}-${Math.round(finSec * 100)}`, origine: "ecran-demo", debutSec, finSec, montre: "interface",
        avecVisage: false, texteIncruste: false, sourceCle: ecran.cle,
      };
    });
  }
  return { moments, decisionMax };
}

/** Une capture déposée (résultat « ok ») = un moment de `DUREE_CAPTURE_SEC` ; une capture ratée n'en donne aucun. */
export function momentsCaptures(etat: EtatCaptures): Moment[] {
  const resultats = etat?.resultats;
  if (!resultats || !Array.isArray(etat.demandes)) return [];
  const moments: Moment[] = [];
  for (const d of etat.demandes) {
    const r = resultats[d.id];
    if (!r || !r.ok) continue;
    moments.push({
      id: `c-${d.id}`, origine: "capture-cas", debutSec: 0, finSec: DUREE_CAPTURE_SEC, montre: "interface",
      avecVisage: false, texteIncruste: false, sourceCle: r.cle,
    });
  }
  return moments;
}

/** Abaisse « garde » à « peut-etre » si le plafond l'impose ; ne relève jamais rien. */
export function appliquerPlafond(note: NoteMoment, decisionMax: "garde" | "peut-etre"): NoteMoment {
  const decision: Decision = decisionMax === "peut-etre" && note.decision === "garde" ? "peut-etre" : note.decision;
  return decision === note.decision ? note : { ...note, decision };
}

/** Une capture ne sert jamais de preuve chiffrée (valeurs fictives). Les autres origines : usages inchangés. */
export function usagesPermis(moment: Moment, usages: readonly UsageExtrait[]): UsageExtrait[] {
  return moment.origine === "capture-cas" && !CHIFFRES_REELS_CAPTURE ? usages.filter((u) => u !== "preuve-chiffree") : [...usages];
}
