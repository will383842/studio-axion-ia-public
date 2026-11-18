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
import { OBJET_COCHE, OBJET_CROIX, OBJET_MOT_BARRE, EXEMPLES_MARQUES } from "../../motion/petits-objets/marques";
import { OBJET_SOULIGNEMENT_DROIT, EXEMPLES_SOULIGNEMENTS } from "../../motion/petits-objets/soulignements";
import { OBJET_COMPTEUR_ROULEAU, EXEMPLES_ROULEAU } from "../../motion/petits-objets/compteur-rouleau";
import { OBJET_CARTON_DEFINITION, EXEMPLES_CARTON_DEFINITION } from "../../motion/petits-objets/carton-definition";
import { OBJET_FLECHE_MAIN_LEVEE, EXEMPLES_FLECHES } from "../../motion/petits-objets/fleches";
import { envelopperObjets } from "./objets";

export const OBJETS_PLAN_SCENES = [
  OBJET_GROS_CHIFFRE, OBJET_ETAPE, OBJET_CARTES_COCHE, OBJET_COCHE,
  // BR-OBJETS-c : 6 petits objets de plus (porte fermée)
  OBJET_SOULIGNEMENT_DROIT, OBJET_CROIX, OBJET_MOT_BARRE, OBJET_COMPTEUR_ROULEAU, OBJET_CARTON_DEFINITION, OBJET_FLECHE_MAIN_LEVEE,
];

/** Graine fixe et pure : somme des codes de caractères de l'identifiant. */
export function graineObjet(id: string): number {
  let somme = 0;
  for (let i = 0; i < id.length; i += 1) somme += id.charCodeAt(i);
  return somme;
}

export const PIECES_OBJETS = envelopperObjets(OBJETS_PLAN_SCENES, graineObjet);

const objet = (id: "objet-gros-chiffre" | "objet-etape" | "objet-cartes-coche" | "objet-coche" | "objet-soulignement-droit" | "objet-croix" | "objet-mot-barre" | "objet-compteur-rouleau" | "objet-carton-definition" | "objet-fleche-main-levee", nom: string, description: string, def: { toile: { largeur: number; hauteur: number } }, exemple: unknown): DefinitionBrique => ({
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
  "objet-soulignement-droit": objet("objet-soulignement-droit", "Soulignement", "Un trait droit tracé sous le mot au moment où il est dit.", OBJET_SOULIGNEMENT_DROIT, EXEMPLES_SOULIGNEMENTS[0]),
  "objet-croix": objet("objet-croix", "Croix", "Une croix tracée quand on dit que c'est faux.", OBJET_CROIX, EXEMPLES_MARQUES[0]),
  "objet-mot-barre": objet("objet-mot-barre", "Mot barré", "Un trait qui barre le mot qu'on corrige à voix haute.", OBJET_MOT_BARRE, EXEMPLES_MARQUES[0]),
  "objet-compteur-rouleau": objet("objet-compteur-rouleau", "Compteur qui roule", "Un nombre dit à voix haute, dont les chiffres roulent jusqu'à la valeur.", OBJET_COMPTEUR_ROULEAU, EXEMPLES_ROULEAU[0]),
  "objet-carton-definition": objet("objet-carton-definition", "Carton définition", "Un petit carton qui donne la définition d'un mot dit.", OBJET_CARTON_DEFINITION, EXEMPLES_CARTON_DEFINITION[0]),
  "objet-fleche-main-levee": objet("objet-fleche-main-levee", "Flèche à main levée", "Une flèche dessinée à la main qui désigne ce dont on parle.", OBJET_FLECHE_MAIN_LEVEE, EXEMPLES_FLECHES[0]),
} as const;

export const RENDUS_OBJETS = {
  "objet-gros-chiffre": PIECES_OBJETS["objet-gros-chiffre"].Rendu as RenduBrique,
  "objet-etape": PIECES_OBJETS["objet-etape"].Rendu as RenduBrique,
  "objet-cartes-coche": PIECES_OBJETS["objet-cartes-coche"].Rendu as RenduBrique,
  "objet-coche": PIECES_OBJETS["objet-coche"].Rendu as RenduBrique,
  "objet-soulignement-droit": PIECES_OBJETS["objet-soulignement-droit"].Rendu as RenduBrique,
  "objet-croix": PIECES_OBJETS["objet-croix"].Rendu as RenduBrique,
  "objet-mot-barre": PIECES_OBJETS["objet-mot-barre"].Rendu as RenduBrique,
  "objet-compteur-rouleau": PIECES_OBJETS["objet-compteur-rouleau"].Rendu as RenduBrique,
  "objet-carton-definition": PIECES_OBJETS["objet-carton-definition"].Rendu as RenduBrique,
  "objet-fleche-main-levee": PIECES_OBJETS["objet-fleche-main-levee"].Rendu as RenduBrique,
} as const;
