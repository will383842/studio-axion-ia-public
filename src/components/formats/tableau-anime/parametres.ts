/**
 * PARAMÈTRES DES BOUTONS DE RETOUCHE (raccord 2) : ce que chaque bouton demande, en listes fermées tirées de la fiche
 * (scène, ligne, mot, dessin, geste, page, fin). Aucune saisie de coordonnées ; le texte libre n'existe que pour
 * « Changer le texte écrit » et « Changer ce qui est dit ». PUR : l'écran choisit, ce fichier pose l'opération.
 */
import type { ChoixFerme, ChoixRetoucheTableau, SceneAChoisir } from "@/services/tableau-vue";

/** Quel élément de la scène le bouton vise. */
export type ElementVise = "ligne" | "ligne-marquee" | "ligne-avec-importants" | "dessin" | "geste" | "tout";
/** Quelle valeur le bouton choisit dans une liste fermée. */
export type ValeurVisee = "mot" | "important" | "marque" | "dessin" | "geste" | "vers" | "appel";

export interface Besoin {
  scene: boolean;
  element?: ElementVise;
  valeur?: ValeurVisee;
  /** Texte libre : seulement le texte écrit d'une ligne, ou ce que dit la voix. */
  texte?: "ligne" | "dit";
}

export const BESOINS: Readonly<Record<string, Besoin>> = {
  remplacerTexteLigne: { scene: true, element: "ligne", texte: "ligne" },
  marquerMotImportant: { scene: true, element: "ligne", valeur: "mot" },
  retirerMotImportant: { scene: true, element: "ligne-avec-importants", valeur: "important" },
  ajouterMarque: { scene: true, element: "ligne", valeur: "marque" },
  retirerMarque: { scene: true, element: "ligne-marquee" },
  remplacerDessin: { scene: true, element: "dessin", valeur: "dessin" },
  supprimerElement: { scene: true, element: "tout" },
  changerGeste: { scene: true, element: "geste", valeur: "geste" },
  deplacerScene: { scene: true, valeur: "vers" },
  changerFin: { scene: false, valeur: "appel" },
  modifierTexteDit: { scene: true, texte: "dit" },
};

export interface Saisie {
  sceneId?: string;
  elementId?: string;
  valeur?: string;
  texte?: string;
}

/** Scènes où le bouton a un sens (ex. « Changer le dessin » : celles qui ont un dessin). */
export function scenesPour(cle: string, choix: ChoixRetoucheTableau): SceneAChoisir[] {
  const b = BESOINS[cle];
  if (!b?.scene) return [];
  return choix.scenes.filter((s) => elementsPour(cle, s).length > 0 || !b.element).filter((s) => (cle === "deplacerScene" ? deplacements(s).length > 0 : true));
}

/** Éléments proposés dans une scène. */
export function elementsPour(cle: string, scene: SceneAChoisir | undefined): ChoixFerme[] {
  const vise = BESOINS[cle]?.element;
  if (!scene || !vise) return [];
  if (vise === "dessin") return scene.dessins;
  if (vise === "geste") return scene.gestes;
  if (vise === "tout") return scene.elements;
  const lignes = scene.lignes.filter((l) => (vise === "ligne-marquee" ? l.marquee : vise === "ligne-avec-importants" ? l.importants.length > 0 : true));
  return lignes.map((l) => ({ valeur: l.id, libelle: l.libelle }));
}

function deplacements(scene: SceneAChoisir): ChoixFerme[] {
  return [
    ...(scene.premiereDePage && !scene.premiere ? [{ valeur: "page-precedente", libelle: "À la page d'avant" }] : []),
    ...(scene.derniereDePage ? [{ valeur: "page-suivante", libelle: "À la page d'après" }] : []),
  ];
}

/** Valeurs proposées (liste fermée) pour le bouton, la scène et l'élément choisis. */
export function valeursPour(cle: string, choix: ChoixRetoucheTableau, saisie: Saisie): ChoixFerme[] {
  const scene = choix.scenes.find((s) => s.id === saisie.sceneId);
  const ligne = scene?.lignes.find((l) => l.id === saisie.elementId);
  switch (BESOINS[cle]?.valeur) {
    case "mot":
      return (ligne?.mots ?? []).filter((m) => !ligne?.importants.some((i) => i.toLowerCase() === m.toLowerCase())).map((m) => ({ valeur: m, libelle: m }));
    case "important":
      return (ligne?.importants ?? []).map((m) => ({ valeur: m, libelle: m }));
    case "marque":
      return choix.marques;
    case "dessin":
      return choix.dessins;
    case "geste":
      return choix.gestes;
    case "vers":
      return scene ? deplacements(scene) : [];
    case "appel":
      return choix.appels;
    default:
      return [];
  }
}

/** L'opération à envoyer ; `null` tant qu'un choix manque. */
export function operationDe(cle: string, saisie: Saisie): Record<string, unknown> | null {
  const b = BESOINS[cle];
  if (!b) return null;
  if (b.scene && !saisie.sceneId) return null;
  if (b.element && !saisie.elementId) return null;
  if (b.valeur && !saisie.valeur) return null;
  if (b.texte && !saisie.texte?.trim()) return null;
  const s = { sceneId: saisie.sceneId, elementId: saisie.elementId };
  switch (cle) {
    case "remplacerTexteLigne":
      return { type: cle, ...s, texte: saisie.texte!.trim() };
    case "marquerMotImportant":
    case "retirerMotImportant":
      return { type: cle, ...s, mot: saisie.valeur };
    case "ajouterMarque":
      return { type: cle, ...s, marque: saisie.valeur };
    case "retirerMarque":
    case "supprimerElement":
      return { type: cle, ...s };
    case "remplacerDessin":
      return { type: cle, ...s, dessinId: saisie.valeur };
    case "changerGeste":
      return { type: cle, ...s, geste: saisie.valeur };
    case "deplacerScene":
      return { type: cle, sceneId: saisie.sceneId, vers: saisie.valeur };
    case "changerFin":
      return { type: cle, appelId: saisie.valeur };
    case "modifierTexteDit":
      return { type: cle, sceneId: saisie.sceneId, texte: saisie.texte!.trim() };
    default:
      return null;
  }
}
