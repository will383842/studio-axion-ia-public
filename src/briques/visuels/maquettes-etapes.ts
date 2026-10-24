/**
 * Variante « étapes à mini-maquettes » de T20 (L10) : chaque étape montre un petit écran dessiné par le code (rectangles, barres, coches ;
 * jamais de texte, de logo ni de capture). Le CODE choisit la maquette d'après le texte de l'étape (mots-clés), toutes différentes sur une
 * page, toujours la même pour le même texte. Fonction PURE, partagée par la composition (`pages/T20.tsx`) et la porte (`places-mots.ts`).
 */

/** Mises en page de la page étapes : l'ancienne (texte seul) et, en L10, les étapes à mini-maquettes d'écran. */
export type VarianteT20 = "classique" | "maquettes";

/** Variante choisie par le CODE d'après la page : sans la clé `variante` (anciennes fiches), l'ancienne page, au pixel près. Fonction PURE. */
export function varianteEtapes(page: { variante?: "maquettes" }): VarianteT20 {
  return page.variante === "maquettes" ? "maquettes" : "classique";
}

/** Maquettes dessinées (`studio-rendu/compositions/visuels/pages/maquettes-etapes.tsx`), dans l'ordre de repli. */
export const MAQUETTES = ["liste", "formulaire", "messages", "agenda", "tableau", "validation"] as const;
export type Maquette = (typeof MAQUETTES)[number];

/** Largeur (px, facteur 1) d'une mini-maquette ; sa hauteur suit le rapport d'un écran (3 : 2). */
export const LARGEUR_MAQUETTE = 150;
export const HAUTEUR_MAQUETTE = 100;

/** Débuts de mots (minuscules, sans accent) qui appellent chaque maquette. */
const MOTS: Record<Maquette, readonly string[]> = {
  liste: ["list", "tri", "class", "rang", "repere", "invent", "recens", "note"],
  formulaire: ["rempli", "saisi", "formulaire", "fiche", "decri", "redig", "complet"],
  messages: ["message", "repond", "repons", "envoi", "envoy", "relanc", "courri", "echang", "mail"],
  agenda: ["planifi", "agenda", "date", "rendez", "calendri", "moment", "program", "semaine"],
  tableau: ["suivi", "suivre", "tableau", "mesur", "compar", "bilan", "chiffr"],
  validation: ["valid", "verifi", "control", "reli", "approuv", "main", "accord"],
};

const mots = (texte: string): string[] =>
  texte.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);

/** Maquette de chaque étape : la première (dans l'ordre de `MAQUETTES`) dont un mot-clé est dans l'étape et pas encore prise ; sinon la première libre. */
export function maquettesDesEtapes(etapes: readonly { titre: string; corps: string }[]): Maquette[] {
  const prises = new Set<Maquette>();
  return etapes.map((e) => {
    const lus = mots(`${e.titre} ${e.corps}`);
    const choix = MAQUETTES.find((m) => !prises.has(m) && MOTS[m].some((debut) => lus.some((l) => l.startsWith(debut)))) ?? MAQUETTES.find((m) => !prises.has(m)) ?? MAQUETTES[0];
    prises.add(choix);
    return choix;
  });
}
