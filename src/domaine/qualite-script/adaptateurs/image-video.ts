/**
 * SOCLE QUALITÉ · adaptateur IMAGE → VIDÉO (fiche de l'image, `fiche-image/1`). PUR.
 * Une ligne par écran (sa partie, ses textes d'écran, ses événements `surMot`), puis la question à commenter (sauf
 * LinkedIn, où elle n'est pas dite dans la vidéo).
 */
import type { FicheImage, Partie as PartieIV } from "@/domaine/image-video/fiche";
import type { ReseauDeclinaison } from "@/domaine/types";
import type { LigneNormalisee, Partie, ScriptNormalise } from "../types";

const PARTIE_IV: Readonly<Record<PartieIV, Partie>> = {
  accroche: "accroche",
  douleur: "douleur",
  "debut-reponse": "corps",
  explication: "corps",
  resultat: "preuve",
  "phrase-choc": "a-retenir",
};

export function depuisFicheImage(fiche: Pick<FicheImage, "ecrans" | "questionCommentaire">, plus: { reseau?: ReseauDeclinaison; dureeViseeSec?: number } = {}): ScriptNormalise {
  const lignes: LigneNormalisee[] = fiche.ecrans.map((e) => ({
    id: e.id,
    dit: e.texteDit,
    partie: PARTIE_IV[e.partie],
    ecrits: e.textesEcran.map((texte) => ({ texte, modifiable: true })),
    changements: e.surMot.map((s) => s.mot),
  }));
  if (plus.reseau !== "linkedin") lignes.push({ id: "question", dit: fiche.questionCommentaire.texteDit, partie: "question", ecrits: [{ texte: fiche.questionCommentaire.texteEcran, modifiable: true }] });
  return { lignes, ...plus };
}
