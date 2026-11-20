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
import { OBJET_SOULIGNEMENT_DROIT, OBJET_SOULIGNEMENT_VAGUE, OBJET_SOULIGNEMENT_DOUBLE, OBJET_SURLIGNEUR, EXEMPLES_SOULIGNEMENTS } from "../../motion/petits-objets/soulignements";
import { OBJET_COMPTEUR_ROULEAU, EXEMPLES_ROULEAU } from "../../motion/petits-objets/compteur-rouleau";
import { OBJET_CARTON_DEFINITION, EXEMPLES_CARTON_DEFINITION } from "../../motion/petits-objets/carton-definition";
import { OBJET_FLECHE_MAIN_LEVEE, OBJET_FLECHE_DROITE, OBJET_FLECHE_COURBE, OBJET_FLECHE_POINTILLEE, EXEMPLES_FLECHES } from "../../motion/petits-objets/fleches";
import { OBJET_CROQUIS, OBJET_FEUTRE_ENTOURAGE, OBJET_FEUTRE_SOULIGNEMENT, EXEMPLES_OBJETS_2027 } from "../../motion/petits-objets/objets-2027";
import { OBJET_CARTON_MAGAZINE, EXEMPLES_CARTON_MAGAZINE } from "../../motion/petits-objets/carton-magazine";
import { OBJET_TOURNE, EXEMPLES_OBJET_TOURNE } from "../../motion/petits-objets/objet-tourne";
import { OBJET_PARTICULES, EXEMPLES_PARTICULES } from "../../motion/petits-objets/particules";
import { OBJET_PANNEAU_REGLAGES, EXEMPLES_PANNEAU_REGLAGES } from "../../motion/petits-objets/panneau-reglages";
import { OBJET_ANNEAU_DONNEES, EXEMPLES_ANNEAU } from "../../motion/petits-objets/anneau-donnees";
import { envelopperObjets } from "./objets";

export const OBJETS_PLAN_SCENES = [
  OBJET_GROS_CHIFFRE, OBJET_ETAPE, OBJET_CARTES_COCHE, OBJET_COCHE,
  // BR-OBJETS-c : 6 petits objets de plus (porte fermée)
  OBJET_SOULIGNEMENT_DROIT, OBJET_CROIX, OBJET_MOT_BARRE, OBJET_COMPTEUR_ROULEAU, OBJET_CARTON_DEFINITION, OBJET_FLECHE_MAIN_LEVEE,
  // BR-OBJETS-2027-b : croquis et traits de feutre
  OBJET_CROQUIS, OBJET_FEUTRE_ENTOURAGE, OBJET_FEUTRE_SOULIGNEMENT,
  // N-05-v19b : carton magazine, icône qui tourne, particules, panneau de réglages, anneau de données (porte fermée)
  OBJET_CARTON_MAGAZINE, OBJET_TOURNE, OBJET_PARTICULES, OBJET_PANNEAU_REGLAGES, OBJET_ANNEAU_DONNEES,
  // C9-34-TRAITS-v19c : 2 soulignements, surligneur, 3 flèches (porte fermée)
  OBJET_SOULIGNEMENT_VAGUE, OBJET_SOULIGNEMENT_DOUBLE, OBJET_SURLIGNEUR, OBJET_FLECHE_DROITE, OBJET_FLECHE_COURBE, OBJET_FLECHE_POINTILLEE,
];

/** Graine fixe et pure : somme des codes de caractères de l'identifiant. */
export function graineObjet(id: string): number {
  let somme = 0;
  for (let i = 0; i < id.length; i += 1) somme += id.charCodeAt(i);
  return somme;
}

export const PIECES_OBJETS = envelopperObjets(OBJETS_PLAN_SCENES, graineObjet);

const objet = (id: "objet-gros-chiffre" | "objet-etape" | "objet-cartes-coche" | "objet-coche" | "objet-soulignement-droit" | "objet-croix" | "objet-mot-barre" | "objet-compteur-rouleau" | "objet-carton-definition" | "objet-fleche-main-levee" | "objet-croquis" | "objet-feutre-entourage" | "objet-feutre-soulignement" | "objet-carton-magazine" | "objet-tourne" | "objet-particules" | "objet-panneau-reglages" | "objet-anneau-donnees" | "objet-soulignement-vague" | "objet-soulignement-double" | "objet-surligneur" | "objet-fleche-droite" | "objet-fleche-courbe" | "objet-fleche-pointillee", nom: string, description: string, def: { toile: { largeur: number; hauteur: number } }, exemple: unknown): DefinitionBrique => ({
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
  "objet-croquis": objet("objet-croquis", "Croquis", "Un rectangle esquissé à main levée autour de ce qui est dit.", OBJET_CROQUIS, EXEMPLES_OBJETS_2027.croquis[0]),
  "objet-feutre-entourage": objet("objet-feutre-entourage", "Entourage au feutre", "Un trait de feutre qui entoure le mot important au moment où il est dit.", OBJET_FEUTRE_ENTOURAGE, EXEMPLES_OBJETS_2027.feutreEntourage[0]),
  "objet-feutre-soulignement": objet("objet-feutre-soulignement", "Soulignement au feutre", "Un trait de feutre qui souligne le mot important au moment où il est dit.", OBJET_FEUTRE_SOULIGNEMENT, EXEMPLES_OBJETS_2027.feutreSoulignement[0]),
  // N-05-v19b
  "objet-carton-magazine": objet("objet-carton-magazine", "Carton magazine", "Un carton façon magazine qui met en avant le mot-clé dit à voix haute.", OBJET_CARTON_MAGAZINE, EXEMPLES_CARTON_MAGAZINE[0]),
  "objet-tourne": objet("objet-tourne", "Icône qui tourne", "Une icône qui tourne sur elle-même quand on en parle.", OBJET_TOURNE, EXEMPLES_OBJET_TOURNE[0]),
  "objet-particules": objet("objet-particules", "Particules", "De petites icônes qui tombent ou jaillissent pour marquer un moment fort.", OBJET_PARTICULES, EXEMPLES_PARTICULES[0]),
  "objet-panneau-reglages": objet("objet-panneau-reglages", "Panneau de réglages", "Un petit panneau de réglages dont les curseurs et les interrupteurs bougent.", OBJET_PANNEAU_REGLAGES, EXEMPLES_PANNEAU_REGLAGES[0]),
  "objet-anneau-donnees": objet("objet-anneau-donnees", "Anneau de données", "Un anneau qui se remplit jusqu'au pourcentage dit à voix haute.", OBJET_ANNEAU_DONNEES, EXEMPLES_ANNEAU[0]),
  // C9-34-TRAITS-v19c
  "objet-soulignement-vague": objet("objet-soulignement-vague", "Soulignement ondulé", "Un trait ondulé tracé sous le mot au moment où il est dit.", OBJET_SOULIGNEMENT_VAGUE, EXEMPLES_SOULIGNEMENTS[0]),
  "objet-soulignement-double": objet("objet-soulignement-double", "Double soulignement", "Deux traits tracés sous le mot important au moment où il est dit.", OBJET_SOULIGNEMENT_DOUBLE, EXEMPLES_SOULIGNEMENTS[0]),
  "objet-surligneur": objet("objet-surligneur", "Surligneur", "Un trait de surligneur passé sur le mot au moment où il est dit.", OBJET_SURLIGNEUR, EXEMPLES_SOULIGNEMENTS[0]),
  "objet-fleche-droite": objet("objet-fleche-droite", "Flèche droite", "Une flèche droite qui désigne ce dont on parle.", OBJET_FLECHE_DROITE, EXEMPLES_FLECHES[0]),
  "objet-fleche-courbe": objet("objet-fleche-courbe", "Flèche courbe", "Une flèche courbe qui désigne ce dont on parle.", OBJET_FLECHE_COURBE, EXEMPLES_FLECHES[1]),
  "objet-fleche-pointillee": objet("objet-fleche-pointillee", "Flèche en pointillés", "Une flèche en pointillés qui désigne ce dont on parle.", OBJET_FLECHE_POINTILLEE, EXEMPLES_FLECHES[2]),
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
  "objet-croquis": PIECES_OBJETS["objet-croquis"].Rendu as RenduBrique,
  "objet-feutre-entourage": PIECES_OBJETS["objet-feutre-entourage"].Rendu as RenduBrique,
  "objet-feutre-soulignement": PIECES_OBJETS["objet-feutre-soulignement"].Rendu as RenduBrique,
  // N-05-v19b
  "objet-carton-magazine": PIECES_OBJETS["objet-carton-magazine"].Rendu as RenduBrique,
  "objet-tourne": PIECES_OBJETS["objet-tourne"].Rendu as RenduBrique,
  "objet-particules": PIECES_OBJETS["objet-particules"].Rendu as RenduBrique,
  "objet-panneau-reglages": PIECES_OBJETS["objet-panneau-reglages"].Rendu as RenduBrique,
  "objet-anneau-donnees": PIECES_OBJETS["objet-anneau-donnees"].Rendu as RenduBrique,
  // C9-34-TRAITS-v19c
  "objet-soulignement-vague": PIECES_OBJETS["objet-soulignement-vague"].Rendu as RenduBrique,
  "objet-soulignement-double": PIECES_OBJETS["objet-soulignement-double"].Rendu as RenduBrique,
  "objet-surligneur": PIECES_OBJETS["objet-surligneur"].Rendu as RenduBrique,
  "objet-fleche-droite": PIECES_OBJETS["objet-fleche-droite"].Rendu as RenduBrique,
  "objet-fleche-courbe": PIECES_OBJETS["objet-fleche-courbe"].Rendu as RenduBrique,
  "objet-fleche-pointillee": PIECES_OBJETS["objet-fleche-pointillee"].Rendu as RenduBrique,
} as const;
