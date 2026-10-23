/**
 * SOCLE QUALITÉ · adaptateur CAS CONCRET (fiche d'écrans, corps seul : accroche → question). PUR.
 * Une ligne par écran (`e01`, `e02`… comme `lignesDesEcrans`) ; les textes affichés deviennent les écrits ; les
 * événements d'animation (`surMot`) sont des changements à l'écran ; un écran « chiffre » ou « résultat » est tiré d'un
 * fait du cas (sourcé).
 */
import type { ReseauDeclinaison } from "@/domaine/types";
import { idEcranAttendu } from "@/moteurs/montage-cas-concret/fiche";
import type { EcranScript } from "@/moteurs/montage-cas-concret/script-valide";
import type { LigneNormalisee, Partie, ScriptNormalise } from "../types";

const PARTIE_DU_TYPE: Readonly<Record<EcranScript["type"], Partie>> = {
  accroche: "accroche",
  chiffre: "preuve",
  "liste-avant": "douleur",
  titre: "corps",
  etape: "corps",
  objet: "corps",
  preuve: "preuve",
  resultat: "preuve",
  question: "question",
};

/** Textes affichés d'un écran, dans l'ordre de lecture. */
export function textesAffiches(e: EcranScript): string[] {
  switch (e.type) {
    case "accroche":
      return e.lignes;
    case "chiffre":
      return [`${e.valeur} ${e.unite}`, ...e.pastilles];
    case "liste-avant":
      return [...e.taches, ...(e.total ? [e.total] : [])];
    case "titre":
      return e.lignes;
    case "etape":
      return [e.titre, e.ligne, ...e.puces];
    case "objet":
      return [e.titre, ...(e.ligne ? [e.ligne] : [])];
    case "preuve":
      return [e.titre, ...e.puces];
    case "resultat":
      return [e.titre, e.ligne];
    case "question":
      return [...e.lignes, e.question];
  }
}

export function depuisEcransCasConcret(ecrans: readonly EcranScript[], plus: { reseau?: ReseauDeclinaison; dureeViseeSec?: number } = {}): ScriptNormalise {
  const lignes = ecrans.map(
    (e, i): LigneNormalisee => ({
      id: idEcranAttendu(i),
      dit: e.texteDit,
      partie: PARTIE_DU_TYPE[e.type],
      ecrits: textesAffiches(e).map((texte) => ({ texte, modifiable: false })),
      changements: e.evenements.map((ev) => ev.surMot),
      ...(e.type === "chiffre" || e.type === "resultat" ? { sourcee: true } : {}),
    }),
  );
  return { lignes, ...plus };
}
