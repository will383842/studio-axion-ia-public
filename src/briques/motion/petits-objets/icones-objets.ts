/**
 * C9-28 — TABLE FIGÉE « rôle → icône » des petits objets. PUR, sans alias d’import ni import de droits : lisible par le rendu.
 * Les noms visent la bibliothèque d'icônes (C6-H17a, « lucide:* ») ; aucun logo de marque, aucun visage.
 * Les droits des icônes sont portés par `droits/registre/icones-bibliotheque-*.ts` (lus dans le test seulement).
 */
import { ICONES_BIBLIOTHEQUE } from "../bibliotheque-icones";
import type { NoeudBibliotheque } from "../bibliotheque-icones";

export interface IconeObjet {
  viewBox: string;
  noeuds: NoeudBibliotheque[];
}

/** `null` = icône absente de la bibliothèque : ne pas la dessiner à la main. */
export const ICONES_OBJETS: Readonly<Record<string, string | null>> = Object.freeze({
  pouce: "lucide:pouce-haut",
  lien: "lucide:lien",
  cloche: "lucide:cloche",
  personne: "lucide:personne",
  etoile: "lucide:etoile",
  coche: "lucide:coche",
  // attend C6-H17b ou un ré-import H17a (absents de la bibliothèque) :
  globe: null,
  "ajout-personne": null,
  lecture: null,
});

/** Icône d'un rôle, ou `null` (rôle inconnu, icône absente, entrée invalide). Ne lève jamais. */
export function iconeObjet(role: string): IconeObjet | null {
  try {
    if (typeof role !== "string" || !Object.prototype.hasOwnProperty.call(ICONES_OBJETS, role)) return null;
    const nom = ICONES_OBJETS[role];
    if (nom === null || nom === undefined) return null;
    const i = Object.prototype.hasOwnProperty.call(ICONES_BIBLIOTHEQUE, nom) ? ICONES_BIBLIOTHEQUE[nom] : undefined;
    return i ? { viewBox: i.viewBox, noeuds: i.noeuds } : null;
  } catch {
    return null;
  }
}
