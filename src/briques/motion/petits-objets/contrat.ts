/**
 * PETITS OBJETS — contrat (D3 § C). PUR : aucun alias, aucune validation externe, aucun hasard non graîné. Lu par le rendu : imports relatifs seulement.
 * Le nom `IdObjet` est pris (`src/briques/ecrans-motion/types.ts`) : on utilise `IdPetitObjet`.
 */
import type { JSX } from "react";
import type { ProprietesBrique } from "../../plan-scenes/briques/communs";

export type FamilleObjet = "trait" | "marque" | "etiquette" | "chiffre" | "schema" | "ecran" | "manuscrit" | "emoji";
/** Un objet ne reçoit jamais une couleur, seulement un ton. */
export type TonObjet = "neutre" | "accent" | "valide" | "erreur";
/** En % du cadre (comme `plan-scenes/zones.ts`). */
export interface ZoneObjet {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}
export type IdPetitObjet = `objet-${string}`;
export type CapaciteObjet = `objet.${string}`;

export interface ProprietesObjet<P> extends ProprietesBrique<P> {
  ton?: TonObjet;
  graine: number;
}

export interface DefinitionObjet<P> {
  id: IdPetitObjet;
  famille: FamilleObjet;
  capacite: CapaciteObjet;
  /** Jamais d'exception ; null = l'objet n'apparaît pas. */
  valider(p: unknown): P | null;
  /** px ; mis à l'échelle dans la zone reçue. */
  toile: { largeur: number; hauteur: number };
  /** Dans 0,4 .. 4 s. */
  dureeSec: { min: number; max: number };
  /** Lu par la garde C9-04 côté Studio. */
  donnees: "aucune" | "mots-dits" | "nombres-dits" | "source-saisie";
  /** Pur : même entrée = même image. */
  Rendu(p: ProprietesObjet<P>): JSX.Element;
}

export const OBJETS_A_L_ECRAN_MAX = 1;
/** Plafond du profil, à valider sur planche. */
export const OBJETS_PAR_VIDEO_MAX = 4;
export const MOTS_MAX = 4;
export const SURFACE_MAX = 0.6;
export const DUREE_SEC = { min: 0.4, max: 4 } as const;

export const CAPACITES_OBJET = [
  "objet.trait", "objet.marque", "objet.etiquette", "objet.appel", "objet.chiffre", "objet.etape",
  "objet.cartes", "objet.schema", "objet.ecran", "objet.reseau-schema", "objet.manuscrit", "objet.emoji",
] as const;

/** "ok" ou refus motivé. Pure, sans exception. */
export function verifierDefinition<P>(def: DefinitionObjet<P>): "ok" | { refus: string } {
  if (typeof def.id !== "string" || !def.id.startsWith("objet-")) return { refus: "identifiant sans préfixe « objet- »" };
  if (!(CAPACITES_OBJET as readonly string[]).includes(def.capacite)) return { refus: `capacité inconnue : ${String(def.capacite)}` };
  const { min, max } = def.dureeSec ?? { min: NaN, max: NaN };
  if (!(min >= DUREE_SEC.min && max <= DUREE_SEC.max && min <= max)) return { refus: `durée hors de ${DUREE_SEC.min}..${DUREE_SEC.max} s` };
  return "ok";
}
