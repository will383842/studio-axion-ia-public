/**
 * Mesures de contraste du style « reference/3 » (WCAG 2) : chaque couleur dessinée, son rôle et ses fonds. Lu par
 * `contraste.test.ts` (seuils) et par `apercus-charte.mts --contrastes` (`contrastes.json`).
 */
import { COULEURS_REFERENCE_3 } from "../../../src/briques/tableau-scene/reference/charte";

export const C = COULEURS_REFERENCE_3;
export type Cle = keyof typeof C;

/** Luminance relative (WCAG 2) d'une couleur « #RRGGBB ». */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Rapport de contraste WCAG 2 entre deux couleurs (1 à 21). */
export function rapportContraste(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Seuils : texte (WCAG AA, 1.4.3) et élément graphique porteur de sens (WCAG 1.4.11). */
export const SEUILS_CONTRASTE = Object.freeze({ texte: 4.5, graphique: 3 });

/** Chaque couleur dessinée, son rôle, et TOUS les fonds sur lesquels elle se pose. */
export const MESURES_CONTRASTE_3: readonly { couleur: Cle; sorte: "texte" | "graphique"; fonds: readonly Cle[]; usage: string }[] = Object.freeze([
  // Textes.
  { couleur: "encre", sorte: "texte", fonds: ["fond", "carte", "surlignage"], usage: "titres, phrases, éléments de liste, « après » de la carte, chapitre en cours" },
  { couleur: "mention", sorte: "texte", fonds: ["fond", "carte"], usage: "repère « Exemple illustratif », « Étape 2 sur 4 », détails, « Avant » barré, adresse axion-ia.com, chapitre fait" },
  { couleur: "accentTexte", sorte: "texte", fonds: ["fond", "surlignage"], usage: "la ligne orange de la page (mot-clé surligné)" },
  { couleur: "chapitreAVenir", sorte: "texte", fonds: ["fond"], usage: "nom d'un chapitre à venir" },
  { couleur: "attente", sorte: "texte", fonds: ["fond"], usage: "élément de « À retenir » pas encore dit" },
  { couleur: "fond", sorte: "texte", fonds: ["encre", "accent"], usage: "chiffre de la pastille d'étape, texte du bouton ; texte et compteur du bloc orange, « 1 » de la pastille du téléphone (visuels, 15/10)" },
  { couleur: "encre", sorte: "texte", fonds: ["marqueur", "hachure"], usage: "mot-clé sur le marqueur orange ; lettre d'un schéma A → B sur ses hachures (visuels, 15/10)" },
  // Éléments graphiques porteurs de sens.
  { couleur: "encre", sorte: "graphique", fonds: ["fond", "carte"], usage: "barre d'un chapitre fait, traits du crayon, cases, disques, flèche de la carte" },
  { couleur: "accent", sorte: "graphique", fonds: ["fond"], usage: "remplissage de la barre du chapitre en cours ; touche orange des visuels ; bloc orange plein" },
  { couleur: "mine", sorte: "graphique", fonds: ["fond", "carte"], usage: "traits des visuels dessinés au crayon, flèche dessinée vers le visuel" },
  { couleur: "accentTexte", sorte: "graphique", fonds: ["fond"], usage: "mots de l'accroche entourés, barré orange, adresse soulignée" },
  { couleur: "icone", sorte: "graphique", fonds: ["fond"], usage: "icônes au trait (document, ampoule, cadenas…)" },
  { couleur: "barreFond", sorte: "graphique", fonds: ["fond"], usage: "rail vide de la barre des chapitres" },
  { couleur: "bordCarte", sorte: "graphique", fonds: ["fond"], usage: "bord fin de la carte « avant → après », point du repère de partie" },
  { couleur: "mention", sorte: "graphique", fonds: ["fond"], usage: "signe ✕ de l'« Avant »" },
  { couleur: "attente", sorte: "graphique", fonds: ["fond"], usage: "bord d'une case pas encore dite" },
  { couleur: "fond", sorte: "graphique", fonds: ["encre"], usage: "coche ✓ et signes des codes, dans leur disque à l'encre" },
]);

/**
 * Teintes qui ne sont que des FONDS (ou une couleur de charte que la page ne dessine plus) ; et les textures des visuels
 * (15/10), jamais porteuses de sens : les hachures sable (le contour à la mine porte la forme), la trace du temps du
 * chrono (l'aiguille orange porte le sens), le marqueur sous le mot-clé (fond du texte, mesuré ci-dessus).
 */
export const SEULEMENT_FONDS: readonly Cle[] = ["fond", "carte", "surlignage", "ivoire", "sable", "hachure", "traceTemps", "marqueur"];

/** Toutes les mesures, à plat (une par couleur et par fond). */
export function mesuresContraste3(): { couleur: string; nom: string; fond: string; nomFond: string; sorte: "texte" | "graphique"; rapport: number; seuil: number; usage: string }[] {
  return MESURES_CONTRASTE_3.flatMap((m) =>
    m.fonds.map((f) => ({ couleur: C[m.couleur], nom: m.couleur, fond: C[f], nomFond: f, sorte: m.sorte, rapport: Math.round(rapportContraste(C[m.couleur], C[f]) * 100) / 100, seuil: SEUILS_CONTRASTE[m.sorte], usage: m.usage })),
  );
}

/** Les couleurs d'AVANT le 15/10 (contraste trop faible), pour l'avant / après. */
export const AVANT_CONTRASTE_3: Readonly<Partial<Record<Cle, string>>> = Object.freeze({ mention: "#796955", accentTexte: "#B44F29", carte: "#EEE5D7", bordCarte: "(aucun bord)", barreFond: "#E0D4C3", chapitreAVenir: "#BFA88B", attente: "#BFA88B", icone: "#BFA88B" });
