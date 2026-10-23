/**
 * Données de la PLANCHE DE STYLE (lot 1) : 16,6 s de la prise IMG_7747 de Will (33,4 → 50,0 s), mots horodatés
 * par faster-whisper. Écrites à la main pour valider le style ; en série, c'est le réalisateur qui les produira.
 * Temps en secondes depuis le début de la planche (temps source − 33,4).
 */
import type { GroupeSousTitre, MotSousTitre } from "./SousTitres";

export const PLANCHE = Object.freeze({
  /** Début dans la prise source (secondes). */
  debutSource: 33.4,
  /** 16,6 s de prise + écran de fin. */
  duree: 18.4,
  /** Fin de la prise utilisée (secondes depuis le début de la planche). */
  finPrise: 16.6,
  fps: 25,
  largeur: 1080,
  hauteur: 1920,
});

const m = (w: string, a: number, fort = false): MotSousTitre => ({ w, a, fort });

const BRUT: MotSousTitre[][] = [
  [m("Chez", 0.26), m("Axion-IA", 0.5, true)],
  [m("on", 1.3), m("forme", 1.34, true)],
  [m("les", 1.66), m("équipes", 1.82)],
  [m("à", 2.14), m("l'IA", 2.28, true)],
  [m("on", 2.78), m("accompagne", 2.88, true)],
  [m("les", 3.46), m("dirigeants", 3.6)],
  [m("en", 3.98), m("one-to-one", 4.16, true)],
  [m("on", 4.96), m("audite", 5.02, true)],
  [m("des", 5.26), m("entreprises", 5.48)],
  [m("et", 5.9), m("on", 6.28), m("automatise", 6.4, true)],
  [m("tout", 7.0), m("ce", 7.42), m("qui", 7.54)],
  [m("leur", 7.6), m("coûte", 7.74)],
  [m("du", 7.92), m("temps", 8.04, true)],
  [m("petite", 8.62), m("structure", 8.88, true)],
  [m("entreprise", 9.6), m("en", 10.0), m("croissance", 10.1, true)],
  [m("ou", 10.44), m("groupe", 10.74, true)],
  [m("partout", 10.94, true)],
  [m("je", 11.56), m("vois", 11.62)],
  [m("le", 11.76), m("même", 11.88), m("réflexe", 12.0, true)],
  [m("on", 12.98), m("veut", 13.1)],
  [m("colmater", 13.26, true)],
  [m("en", 13.82), m("ajoutant", 14.1)],
  [m("un", 14.72), m("outil", 15.08, true)],
  [m("de", 15.36), m("plus", 15.46, true)],
  [m("une", 16.14), m("embauche", 16.28, true)],
];

export const GROUPES: GroupeSousTitre[] = BRUT.map((mots, i) => ({
  mots,
  fin: Math.min(BRUT[i + 1]?.[0].a ?? PLANCHE.duree, mots[mots.length - 1].a + 0.9),
}));

/** Fenêtres de temps (secondes) de la mise en scène. */
export const SCENE = Object.freeze({
  tuile: { debut: 0.42, fin: 1.12 },
  role: { debut: 0.85, fin: 1.12 },
  carte: { debut: 1.1, fin: 8.45 },
  etapes: [
    { texte: "Former les équipes", icone: "former", a: 1.34 },
    { texte: "Accompagner", icone: "boussole", a: 2.88 },
    { texte: "Auditer", icone: "loupe", a: 5.02 },
    { texte: "Automatiser", icone: "eclair", a: 6.4 },
  ],
  badge: { texte: "Du temps rendu", a: 8.04 },
  /** Petits éléments qui se posent sur une ligne au mot qui les nomme. */
  puces: [{ etape: 1, texte: "1:1", a: 4.16 }, { etape: 2, texte: "Entreprises", a: 5.48 }],
  /** Toutes les étapes se cochent en cascade. */
  cocheA: 7.6,
  tailles: { debut: 8.62, fin: 10.92, icones: [{ nom: "utilisateurs", a: 8.7 }, { nom: "batiment", a: 9.62 }, { nom: "reseau", a: 10.76 }] },
  /** Fenêtres d'illustration ; une fenêtre peut POUSSER la précédente (entrées et sorties qui se chevauchent). */
  fenetres: [
    { debut: 10.94, fin: 11.92, image: "equipe", etiquette: { texte: "Partout en France", a: 11.2 } },
    { debut: 14.72, fin: 16.12, image: "robot", etiquette: { texte: "+1 outil", a: 15.08 } },
    { debut: 16.02, fin: 16.62, image: "embauche", etiquette: { texte: "+1 embauche", a: 16.28 } },
    // « On veut colmater… » : l'ancien réflexe, l'image PASSE EN NOIR ET BLANC.
    { debut: 12.98, fin: 14.62, image: "horloge", noirEtBlancA: 13.26 },
  ],
  reflexe: { debut: 11.92, fin: 12.95 },
  colmater: { debut: 13.26, fin: 14.75, barreA: 13.9 },
  /** Écran de fin : il monte et pousse l'image (appel à l'action du script « par où commencer » : GUIDE). */
  fin: { debut: 16.4, marque: "Axion-IA", adresse: "axion-ia.com", motCle: "GUIDE", tuiles: ["former", "boussole", "loupe", "eclair"] },
  /** Zooms coupés sur le visage : [début, fin, échelle]. */
  zooms: [
    [0.26, 1.1, 1.08],
    [8.5, 10.92, 1.12],
    [11.92, 12.95, 1.2],
    [14.9, 16.6, 1.1],
  ] as [number, number, number][],
});

/** Bruitages : [instant, fichier, volume]. Un son par élément, comme la référence ; niveaux réglés à la mesure :
 * crêtes des pops et des souffles ≈ 10 dB sous les crêtes de la voix (mesuré en isolant les bruitages du mélange) (après normalisation à −14 LUFS). */
export const BRUITAGES: [number, string, number][] = [
  [0.42, "drop_001", 0.04],
  [0.85, "maximize_008", 0.08],
  [1.08, "whoosh-in", 0.25],
  [1.34, "select_002", 0.04],
  [2.88, "select_002", 0.04],
  [5.02, "select_002", 0.04],
  [6.4, "select_002", 0.04],
  [4.16, "drop_003", 0.04],
  [5.48, "drop_001", 0.04],
  [7.6, "tick_001", 0.05],
  [7.68, "tick_001", 0.05],
  [7.76, "tick_001", 0.05],
  [7.84, "tick_001", 0.05],
  [8.04, "drop_002", 0.04],
  [8.31, "whoosh-out", 0.25],
  [8.62, "drop_003", 0.04],
  [8.7, "tick_004", 0.05],
  [9.62, "tick_004", 0.05],
  [10.76, "tick_004", 0.05],
  [10.92, "whoosh-in", 0.25],
  [11.2, "drop_001", 0.04],
  [11.92, "drop_004", 0.04],
  [13.26, "drop_002", 0.04],
  [13.9, "click_001", 0.05],
  [14.7, "whoosh-in", 0.25],
  [15.08, "drop_003", 0.04],
  [16.0, "whoosh-in", 0.25],
  [16.28, "drop_001", 0.04],
  [12.96, "whoosh-in", 0.25],
  [16.38, "whoosh-in", 0.3],
  [16.62, "drop_004", 0.05],
  [16.8, "tick_001", 0.05],
  [16.89, "tick_001", 0.05],
  [16.98, "tick_001", 0.05],
  [17.07, "tick_001", 0.05],
  [17.28, "confirmation_002", 0.06],
];
