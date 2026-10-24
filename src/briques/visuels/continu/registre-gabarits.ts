import type { z } from "zod";
import { APPELS } from "./familles/appels";
import { CARTES_CAS } from "./familles/cas";
import { COMPARAISONS } from "./familles/comparaisons";
import { COUVERTURES } from "./familles/couvertures";
import { DONNEES } from "./familles/donnees";
import { ESSAI } from "./familles/essai";
import { LISTES } from "./familles/listes";
import { GABARITS_PARCOURS } from "./registre-parcours";

export type FamilleContinu = "couverture" | "liste" | "comparaison" | "cas" | "donnees" | "appel" | "parcours" | "essai";
export type RoleGabarit = "couverture" | "contenu" | "relance" | "appel";

export interface DefinitionGabarit {
  type: string;
  famille: FamilleContinu;
  nom: string;
  role: RoleGabarit;
  sombre: boolean;
  orangeFort: boolean;
  version: number;
  /** Strict ; contient `type: z.literal(type)`, `alt` et `rubrique?`. */
  schema: z.ZodObject;
  /** Objet qui passe le schéma (textes de la maquette). */
  exemple: Record<string, unknown>;
  /** Intervalles [y1, y2] libres dans les 120 px du bord de la page. */
  bordsLibres: { gauche: [number, number][]; droite: [number, number][] };
  /** Étiquette « Scénario type » posée par le code. */
  cas?: boolean;
  exigeFait?: boolean;
  exigeAccord?: boolean;
  actif: boolean;
  essai?: true;
}

export const GABARITS: DefinitionGabarit[] = [
  ...COUVERTURES,
  ...LISTES,
  ...COMPARAISONS,
  ...CARTES_CAS,
  ...DONNEES,
  ...APPELS,
  ...ESSAI,
  ...GABARITS_PARCOURS,
];

export const GABARITS_PRODUCTION: DefinitionGabarit[] = GABARITS.filter((g) => g.actif && !g.essai);
