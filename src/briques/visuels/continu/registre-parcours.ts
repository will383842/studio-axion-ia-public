import { z } from "zod";
import { texteSansLien } from "../../../domaine/visuels/schema";
import type { DefinitionGabarit } from "./registre-gabarits";

export interface DefinitionParcours {
  id: string;
  nom: string;
  pages: 3 | 4;
  /** Le parcours ouvre la toile : sa première page tient lieu de couverture. */
  commence: boolean;
  /** Le parcours ferme la toile. */
  termine: boolean;
  pagesTypes: string[];
  /** Positions (0 = première page du parcours) en fond sombre. */
  sombres: number[];
  version: number;
  essai?: true;
}

/** Parcours de production : remplis par les lots P3. */
export const PARCOURS_PRODUCTION: DefinitionParcours[] = [];

const TEXTES_PX = [
  ["On avance par étapes", "Chaque étape se vérifie avant la suivante."],
  ["Un devis, de bout en bout", "Du premier échange à la validation."],
  ["Avant de lancer", "Un dernier regard, puis on démarre."],
] as const;

const PAGES_PX: DefinitionGabarit[] = TEXTES_PX.map(([titre, texte], i) => {
  const type = `PX${i + 1}`;
  return {
    type,
    famille: "parcours",
    nom: `Parcours d'essai, page ${i + 1}`,
    role: "contenu",
    sombre: false,
    orangeFort: false,
    version: 1,
    schema: z
      .object({
        type: z.literal(type),
        alt: texteSansLien(1, 125),
        rubrique: texteSansLien(1, 40).optional(),
        titre: texteSansLien(1, 40),
        texte: texteSansLien(1, 90),
      })
      .strict(),
    exemple: { type, alt: titre, titre, texte },
    bordsLibres: { gauche: [[0, 1440]], droite: [[0, 1440]] },
    actif: false,
    essai: true,
  };
});

export const PARCOURS: DefinitionParcours[] = [
  ...PARCOURS_PRODUCTION,
  { id: "PX", nom: "Parcours d'essai", pages: 3, commence: false, termine: false, pagesTypes: ["PX1", "PX2", "PX3"], sombres: [], version: 1, essai: true },
];

/** Pages des parcours, ajoutées à GABARITS. */
export const GABARITS_PARCOURS: DefinitionGabarit[] = PAGES_PX;
