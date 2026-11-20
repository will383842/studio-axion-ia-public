/**
 * Prise floutée sous « Étape N » (C11-T6b-c) : calcul PUR d'UNE fenêtre de flou et d'assombrissement du décor, le temps
 * de l'entrée, de la tenue et de la sortie de l'étape, avec les valeurs du fond flou des cartes (C10-03a).
 * Imports relatifs seulement, aucun React ni Remotion, aucun hasard, aucune date.
 * Éteint : rien ne l'importe hors planche et tests (C11-C2 branchera) ; jamais de flou sur la personne.
 */
import { FOND_FLOU_DEFAUT, type FenetreFondFlou, type OptionsFondFlouCarte } from "../habillage-commun/fond-flou-carte";
import { ENTREE_S, SORTIE_S, TENUE_S } from "./etapes";

function borne(v: number | undefined, min: number, max: number, defaut: number): number {
  const x = typeof v === "number" && Number.isFinite(v) ? v : defaut;
  return Math.min(max, Math.max(min, x));
}

export function fondFlouSousEtape(debutSec: number, options: OptionsFondFlouCarte = {}): FenetreFondFlou[] {
  if (options.decorSepare === false) return [];
  if (typeof debutSec !== "number" || !Number.isFinite(debutSec) || debutSec < 0) return [];
  return [
    {
      debutSec,
      finSec: debutSec + ENTREE_S + TENUE_S + SORTIE_S,
      flouPx: borne(options.flouPx, 0, 24, FOND_FLOU_DEFAUT.flouPx),
      assombrir: borne(options.assombrir, 0, 0.6, FOND_FLOU_DEFAUT.assombrir),
      fonduSec: borne(options.fonduSec, 0.2, 0.4, FOND_FLOU_DEFAUT.fonduSec),
      cible: "decor",
    },
  ];
}
