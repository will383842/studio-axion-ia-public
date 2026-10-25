/**
 * IMAGE → VIDÉO · Filet « zéro blocage » de la mise en scène (25/10/2026, vidéo v-b54bb4798246). PUR.
 *
 * Un défaut de DÉTAIL (Q13 : chiffre dit mais pas montré ; Q14 : rythme trop lent) ne doit jamais arrêter la vidéo.
 * Avant de refuser, les écrans cités par ces défauts passent en scène « titre » (texte seul, toujours posé), puis la mise
 * en scène est relancée, jusqu'à 3 fois. Si le défaut persiste, la vidéo continue : il est noté dans le journal.
 * Seul un défaut d'une AUTRE sorte (Q12 : un bloc dessiné manque vraiment, Q15, Q19...) garde le refus.
 */
import type { FicheImage } from "@/domaine/image-video/fiche";
import { instantsVisibles } from "./controles-scene";
import type { EntreeMiseEnSceneIV, LigneDeTempsIV, ResultatMiseEnSceneIV } from "./mise-en-scene";
import { REGLES_SCENE_IV } from "./regles-scene";

export const ESSAIS_ADAPTATION_IV = 3;

/** Écrans de la fiche cités par les défauts de détail de la ligne de temps (Q13 : chiffre non montré ; Q14 : trou ou plan trop long). */
export function ecransEnDefautIV(l: Pick<LigneDeTempsIV, "evenements" | "plans" | "finVoixSec" | "chiffresDits">): { q13: string[]; q14: string[] } {
  const S = REGLES_SCENE_IV;
  const q13 = new Set<string>();
  for (const d of l.chiffresDits) {
    const ok = l.evenements.some((e) => e.visible && e.chiffres.includes(d.cle) && e.instantSec >= d.t - S.chiffreAvant - 1e-6 && e.instantSec <= d.t + S.chiffreApres + 1e-6);
    if (!ok) q13.add(d.ecran);
  }
  const q14 = new Set<string>();
  const pts = [0, ...instantsVisibles(l.evenements, l.finVoixSec).filter((t) => t > 0), l.finVoixSec];
  for (let k = 1; k < pts.length; k++) {
    if (pts[k] - pts[k - 1] <= S.ecartMax + 1e-6) continue;
    for (const p of l.plans) if (p.ecran && p.debut < pts[k] - 1e-6 && p.fin > pts[k - 1] + 1e-6) q14.add(p.ecran);
  }
  for (const p of l.plans) if (p.ecran && Math.min(p.fin, l.finVoixSec) - p.debut > S.planMax + 1e-6) q14.add(p.ecran);
  return { q13: [...q13], q14: [...q14] };
}

/** La fiche dont les écrans cités passent en scène « titre » (texte seul). */
export function ficheAdapteeIV(fiche: FicheImage, ecrans: readonly string[] | undefined): FicheImage {
  if (!ecrans?.length) return fiche;
  const ids = new Set(ecrans);
  if (!fiche.ecrans.some((e) => ids.has(e.id) && e.scene !== "titre")) return fiche;
  return { ...fiche, ecrans: fiche.ecrans.map((e) => (ids.has(e.id) ? { ...e, scene: "titre" as const } : e)) };
}

export interface IssueAdaptationIV {
  resultat: ResultatMiseEnSceneIV;
  /** Écrans passés en « titre » pendant cet appel. */
  adaptes: string[];
  /** Phrases du refus : vides quand la vidéo continue (défaut de détail gardé ou résolu). */
  refus: string[];
  /** Défauts de détail gardés après les essais (la vidéo continue). */
  gardes: string[];
  journal: string[];
}

/**
 * Met en scène une version avec le filet. `mettre(adaptes)` rend la mise en scène avec les écrans déjà adaptés
 * (les `deja` d'abord, puis ceux de cet appel).
 */
export function mettreEnSceneAvecFiletIV(mettre: (adaptes: readonly string[]) => ResultatMiseEnSceneIV, deja: readonly string[] = [], nom = "version"): IssueAdaptationIV {
  const adaptes: string[] = [];
  const journal: string[] = [];
  const tous = () => [...deja, ...adaptes];
  let resultat = mettre(tous());
  const detailSeul = (r: ResultatMiseEnSceneIV) => !r.ok && r.rapport.bloquants.every((b) => b.code === "Q13" || b.code === "Q14");
  for (let essai = 1; essai <= ESSAIS_ADAPTATION_IV && detailSeul(resultat); essai++) {
    const d = ecransEnDefautIV(resultat.ligne);
    const ids = [...new Set([...d.q13, ...d.q14])].filter((id) => !tous().includes(id));
    if (!ids.length) break;
    adaptes.push(...ids);
    journal.push(`Mise en scène (${nom}), essai ${essai}/${ESSAIS_ADAPTATION_IV} : défaut de détail (${resultat.phrases[0]}) ; écran(s) ${ids.join(", ")} passé(s) en texte seul (« titre »).`);
    resultat = mettre(tous());
  }
  if (resultat.ok) return { resultat, adaptes, refus: [], gardes: [], journal };
  if (detailSeul(resultat)) {
    const gardes = resultat.phrases;
    journal.push(`Mise en scène (${nom}) : défaut de détail gardé après ${adaptes.length ? "adaptation" : "analyse"}, la vidéo continue : ${gardes.join(" ; ")}`);
    return { resultat, adaptes, refus: [], gardes, journal };
  }
  return { resultat, adaptes, refus: resultat.phrases, gardes: [], journal };
}

