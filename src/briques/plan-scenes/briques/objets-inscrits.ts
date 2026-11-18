/**
 * BR-OBJETS-a (= C9-34b) — inscription des 4 petits objets des règles fixes C9-36a dans le plan de scènes, PORTE FERMÉE :
 * tant que `objetsPermis` est vide (défaut partout), la consigne de Claude et les vidéos restent identiques.
 * Lu par le rendu : imports RELATIFS seulement ; ne JAMAIS importer `plan-scenes-objets/registre.ts` (AM-18).
 * Aucun appel à Claude, aucun son, rien sur le visage.
 */
import type { DefinitionBrique } from "../catalogue";
import type { RenduBrique } from "./index";
import { OBJET_GROS_CHIFFRE, EXEMPLES_GROS_CHIFFRE } from "../../motion/petits-objets/gros-chiffre";
import { OBJET_ETAPE, EXEMPLES_ETAPES } from "../../motion/petits-objets/etapes";
import { OBJET_CARTES_COCHE, EXEMPLES_CARTES } from "../../motion/petits-objets/cartes";
import { OBJET_COCHE, EXEMPLES_MARQUES } from "../../motion/petits-objets/marques";
import { OBJET_CROQUIS, OBJET_FEUTRE_ENTOURAGE, OBJET_FEUTRE_SOULIGNEMENT, EXEMPLES_OBJETS_2027 } from "../../motion/petits-objets/objets-2027";
import { envelopperObjets } from "./objets";

export const OBJETS_PLAN_SCENES = [OBJET_GROS_CHIFFRE, OBJET_ETAPE, OBJET_CARTES_COCHE, OBJET_COCHE, OBJET_CROQUIS, OBJET_FEUTRE_ENTOURAGE, OBJET_FEUTRE_SOULIGNEMENT];

/** Graine fixe et pure : somme des codes de caractères de l'identifiant. */
export function graineObjet(id: string): number {
  let somme = 0;
  for (let i = 0; i < id.length; i += 1) somme += id.charCodeAt(i);
  return somme;
}

export const PIECES_OBJETS = envelopperObjets(OBJETS_PLAN_SCENES, graineObjet);

const objet = (id: "objet-gros-chiffre" | "objet-etape" | "objet-cartes-coche" | "objet-coche" | "objet-croquis" | "objet-feutre-entourage" | "objet-feutre-soulignement", nom: string, description: string, def: { toile: { largeur: number; hauteur: number } }, exemple: unknown): DefinitionBrique => ({
  id,
  nom,
  description,
  famille: "objet",
  alias: [],
  toile: def.toile,
  schema: PIECES_OBJETS[id].schema,
  exemple,
});

export const BRIQUES_OBJETS = {
  "objet-gros-chiffre": objet("objet-gros-chiffre", "Gros chiffre", "Un nombre dit à voix haute, tracé en grand au moment où il est dit.", OBJET_GROS_CHIFFRE, EXEMPLES_GROS_CHIFFRE[0]),
  "objet-etape": objet("objet-etape", "Étape", "Une pastille « Étape n sur N » posée quand l'étape est annoncée.", OBJET_ETAPE, EXEMPLES_ETAPES[0]),
  "objet-cartes-coche": objet("objet-cartes-coche", "Cartes cochées", "Quelques cartes courtes qui se cochent au fil de ce qui est dit.", OBJET_CARTES_COCHE, EXEMPLES_CARTES[0]),
  "objet-coche": objet("objet-coche", "Coche", "Une coche tracée au moment où l'on dit que c'est fait.", OBJET_COCHE, EXEMPLES_MARQUES[0]),
  "objet-croquis": objet("objet-croquis", "Croquis", "Un rectangle esquissé à main levée autour de ce qui est dit.", OBJET_CROQUIS, EXEMPLES_OBJETS_2027.croquis[0]),
  "objet-feutre-entourage": objet("objet-feutre-entourage", "Entourage au feutre", "Un trait de feutre qui entoure le mot important au moment où il est dit.", OBJET_FEUTRE_ENTOURAGE, EXEMPLES_OBJETS_2027.feutreEntourage[0]),
  "objet-feutre-soulignement": objet("objet-feutre-soulignement", "Soulignement au feutre", "Un trait de feutre qui souligne le mot important au moment où il est dit.", OBJET_FEUTRE_SOULIGNEMENT, EXEMPLES_OBJETS_2027.feutreSoulignement[0]),
} as const;

export const RENDUS_OBJETS = {
  "objet-gros-chiffre": PIECES_OBJETS["objet-gros-chiffre"].Rendu as RenduBrique,
  "objet-etape": PIECES_OBJETS["objet-etape"].Rendu as RenduBrique,
  "objet-cartes-coche": PIECES_OBJETS["objet-cartes-coche"].Rendu as RenduBrique,
  "objet-coche": PIECES_OBJETS["objet-coche"].Rendu as RenduBrique,
  "objet-croquis": PIECES_OBJETS["objet-croquis"].Rendu as RenduBrique,
  "objet-feutre-entourage": PIECES_OBJETS["objet-feutre-entourage"].Rendu as RenduBrique,
  "objet-feutre-soulignement": PIECES_OBJETS["objet-feutre-soulignement"].Rendu as RenduBrique,
} as const;
