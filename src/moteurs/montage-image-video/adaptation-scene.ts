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

/**
 * Écrans de la fiche cités par les défauts de détail de la ligne de temps (Q13 : chiffre non montré ; Q14 : trou ou plan trop long).
 * Limite connue : un Q14 SANS écran désigné (rythme moyen > 2,2 s, vue d'ensemble > 1,5 s, deux plans de suite > 4 s) ne cite
 * aucun écran : l'adaptation n'a rien à changer et le défaut sort en « gardé » (la vidéo continue, remarque au journal).
 */
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

/** Image figée acceptée tant que la voix parle (`controles.ts`, décision du 17/10) : 2,5 s. */
export const VIDE_MAX_SOUS_VOIX_IV = 2.5;

/**
 * Vrai si le plan de l'écran reçoit un changement visible au moins toutes les 2,5 s tant que la voix parle
 * (début du plan, changements visibles de la ligne, fin du plan ou de la voix). Un écran sans plan est vivant. PUR.
 */
export function ecranVivantIV(l: Pick<LigneDeTempsIV, "evenements" | "plans" | "finVoixSec">, ecran: string): boolean {
  const visibles = instantsVisibles(l.evenements, l.finVoixSec);
  for (const p of l.plans) {
    if (p.ecran !== ecran) continue;
    const fin = Math.min(p.fin, l.finVoixSec);
    if (fin <= p.debut) continue;
    const pts = [p.debut, ...visibles.filter((t) => t > p.debut && t < fin), fin];
    for (let k = 1; k < pts.length; k++) if (pts[k] - pts[k - 1] > VIDE_MAX_SOUS_VOIX_IV + 1e-6) return false;
  }
  return true;
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

/** Contrôles de DÉTAIL : ils n'arrêtent jamais une vidéo (remarque orange à la porte « Contrôles », voir `CONTROLES_INDICATIFS`). */
export const DEFAUTS_DE_DETAIL_IV = ["Q13", "Q14"] as const;
const estDetail = (code: string) => (DEFAUTS_DE_DETAIL_IV as readonly string[]).includes(code);

/** Lignes « zéro blocage » (règle du 25/10/2026) : un défaut de ces lignes est une remarque, jamais un blocage. Q13 et Q14 (la boucle d'adaptation) n'y figurent pas : ils sont dans `DEFAUTS_DE_DETAIL_IV`. */
export const LIGNES_ZERO_BLOCAGE_IV = ["Q12", "Q15", "Q19", "Q20", "Q21", "Q22", "Q23", "Q25", "Q27", "FOND", "ORANGE", "FIN", "SCENE"] as const;
const estZeroBlocage = (code: string) => estDetail(code) || (LIGNES_ZERO_BLOCAGE_IV as readonly string[]).includes(code);

/**
 * Met en scène une version avec le filet. `mettre(adaptes)` rend la mise en scène avec les écrans déjà adaptés
 * (les `deja` d'abord, puis ceux de cet appel). `fiche` (facultative) limite les écrans désignés à ceux qui ne sont pas
 * déjà en scène « titre » et qui portent du texte.
 * Une adaptation n'est GARDÉE que si elle règle tout ou réduit le nombre de défauts de détail ; sinon ses écrans sont
 * notés comme essayés et on revient au meilleur résultat. Un Q12 né de l'adaptation ne peut donc jamais refuser la vidéo.
 */
export function mettreEnSceneAvecFiletIV(mettre: (adaptes: readonly string[]) => ResultatMiseEnSceneIV, deja: readonly string[] = [], nom = "version", fiche?: FicheImage): IssueAdaptationIV {
  const adaptes: string[] = [];
  const essayes = new Set<string>(deja);
  const journal: string[] = [];
  const tous = () => [...deja, ...adaptes];
  let resultat = mettre(tous());
  const detailSeul = (r: ResultatMiseEnSceneIV) => !r.ok && r.rapport.bloquants.every((b) => estDetail(b.code));
  const nbDetails = (r: ResultatMiseEnSceneIV) => r.rapport.bloquants.filter((b) => estDetail(b.code)).length;
  const adaptable = (id: string) => {
    if (!fiche) return true;
    const e = fiche.ecrans.find((x) => x.id === id);
    return !!e && e.scene !== "titre" && e.textesEcran.length > 0;
  };
  for (let essai = 1; essai <= ESSAIS_ADAPTATION_IV && detailSeul(resultat); essai++) {
    const d = ecransEnDefautIV(resultat.ligne);
    const ids = [...new Set([...d.q13, ...d.q14])].filter((id) => !essayes.has(id) && adaptable(id));
    if (!ids.length) break;
    ids.forEach((id) => essayes.add(id));
    let candidat = mettre([...tous(), ...ids]);
    // Grands vides (issue 119) : un écran passé en « titre » n'est gardé que si son plan reçoit un changement visible au moins
    // toutes les 2,5 s tant que la voix parle ; sinon l'adaptation est annulée pour cet écran (la remarque Q14 reste).
    let gardesIds = ids.filter((id) => ecranVivantIV(candidat.ligne, id));
    if (gardesIds.length < ids.length) {
      journal.push(`Mise en scène (${nom}), essai ${essai}/${ESSAIS_ADAPTATION_IV} : le texte seul laisserait l'écran ${ids.filter((id) => !gardesIds.includes(id)).join(", ")} sans rien de nouveau pendant plus de 2,5 s, annulé pour cet écran.`);
      if (gardesIds.length) candidat = mettre([...tous(), ...gardesIds]);
    }
    if (gardesIds.length && (candidat.ok || (detailSeul(candidat) && nbDetails(candidat) < nbDetails(resultat)))) {
      adaptes.push(...gardesIds);
      journal.push(`Mise en scène (${nom}), essai ${essai}/${ESSAIS_ADAPTATION_IV} : défaut de détail (${resultat.phrases[0]}) ; écran(s) ${gardesIds.join(", ")} passé(s) en texte seul (« titre »).`);
      resultat = candidat;
    } else {
      journal.push(`Mise en scène (${nom}), essai ${essai}/${ESSAIS_ADAPTATION_IV} : le texte seul pour ${ids.join(", ")} n'améliore rien, annulé.`);
    }
  }
  if (resultat.ok) return { resultat, adaptes, refus: [], gardes: [], journal };
  if (!resultat.ok && resultat.rapport.bloquants.every((b) => estZeroBlocage(b.code))) {
    const gardes = resultat.phrases;
    journal.push(`Mise en scène (${nom}) : défaut de détail gardé après ${adaptes.length ? "adaptation" : "analyse"}, la vidéo continue : ${gardes.join(" ; ")}`);
    return { resultat, adaptes, refus: [], gardes, journal };
  }
  return { resultat, adaptes, refus: resultat.phrases, gardes: [], journal };
}
