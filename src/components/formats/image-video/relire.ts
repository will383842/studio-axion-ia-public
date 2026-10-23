/**
 * RELIRE LE SCRIPT · IMAGE → VIDÉO (réglage `imageVideo.relireScript`) : l'adaptateur PUR de la fiche de l'image vers
 * l'écran commun « Relire le script » (`domaine/relecture-script`). Une ligne par écran (ce que la voix dit, ses textes
 * écrits modifiables), puis la question de commentaire quand elle est dite. Ce que Will change repart sous la forme
 * qu'attend déjà `scriptValideParWill` : une seule logique de validation, celle de l'ancien écran.
 */
import { evaluerQualite } from "@/domaine/qualite-script";
import { depuisFicheImage } from "@/domaine/qualite-script/adaptateurs/image-video";
import { RECETTE_IMAGE_VIDEO } from "@/domaine/qualite-script/recettes/image-video";
import type { FicheImage } from "@/domaine/image-video/fiche";
import { differences, type LigneScript, type PastilleControle } from "@/domaine/relecture-script";
import { LIBELLES_PARTIE_IV, type ModificationsScript } from "./vue";

export const ID_QUESTION_IV = "question";

/** La fiche en lignes : une par écran (`id` de l'écran), puis la question de commentaire si elle est dite. */
export function lignesRelireIV(fiche: Pick<FicheImage, "ecrans" | "questionCommentaire">, avecQuestion: boolean): LigneScript[] {
  const lignes: LigneScript[] = fiche.ecrans.map((e) => ({ id: e.id, dit: e.texteDit, groupe: LIBELLES_PARTIE_IV[e.partie] ?? "Écran", ecrits: e.textesEcran.map((texte) => ({ texte, modifiable: true })) }));
  if (avecQuestion) lignes.push({ id: ID_QUESTION_IV, dit: fiche.questionCommentaire.texteDit, groupe: "Question pour commenter" });
  return lignes;
}

/** Les seules modifications de la relecture, au format de `scriptValideParWill` (rien d'autre n'est envoyé). */
export function modificationsDesLignesIV(depart: readonly LigneScript[], relues: readonly LigneScript[]): Pick<ModificationsScript, "ecrans" | "question"> {
  const m: Pick<ModificationsScript, "ecrans" | "question"> = { ecrans: {} };
  for (const d of differences(depart, relues)) {
    if (d.id === ID_QUESTION_IV) {
      if (d.dit !== undefined) m.question = d.dit;
      continue;
    }
    const avant = depart.find((l) => l.id === d.id);
    m.ecrans[d.id] = { ...(d.dit !== undefined ? { texteDit: d.dit } : {}), ...(d.ecrits ? { ecrits: (avant?.ecrits ?? []).map((e, k) => d.ecrits![k] ?? e.texte) } : {}) };
  }
  return m;
}

/** Socle qualité commun (observation, aucun appel) : les pastilles « info » sous les cartes, sur le script relu. */
export function observerIV(fiche: Pick<FicheImage, "ecrans" | "questionCommentaire">, avecQuestion: boolean): (lignes: LigneScript[]) => PastilleControle[] {
  return (lignes) => {
    const dits = new Map(lignes.map((l) => [l.id, l] as const));
    const ecrans = fiche.ecrans.map((e) => ({ ...e, texteDit: dits.get(e.id)?.dit ?? e.texteDit, textesEcran: e.textesEcran.map((t, k) => dits.get(e.id)?.ecrits?.[k]?.texte ?? t) }));
    const questionCommentaire = avecQuestion ? { ...fiche.questionCommentaire, texteDit: dits.get(ID_QUESTION_IV)?.dit ?? fiche.questionCommentaire.texteDit } : fiche.questionCommentaire;
    return evaluerQualite(depuisFicheImage({ ecrans, questionCommentaire }, avecQuestion ? {} : { reseau: "linkedin" }), RECETTE_IMAGE_VIDEO).pastilles;
  };
}
