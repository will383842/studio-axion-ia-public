/**
 * TRACÉS DES DESSINS (TB-07) — mêmes dessins que `traces/<id>.svg`, en données pour `studio-rendu`.
 * PUR, SANS alias « @/ ». Grille 24 × 24, trait 2, contour seulement (couleur : `currentColor`).
 * Même forme que `ICONES` de `src/briques/motion/icones.ts` : le composant qui trace les icônes les trace aussi.
 * Un test vérifie que ces chaînes sont identiques à celles des fichiers SVG.
 */
export type NoeudDessin = [balise: "path", attributs: { d: string }];

export const GRILLE_DESSIN = 24;
export const EPAISSEUR_TRAIT_DESSIN = 2;

export const TRACES_DESSINS = {
  "document": [["path",{"d":"M14 3H6v18h12V7l-4-4v4h4"}],["path",{"d":"M9 12h6"}],["path",{"d":"M9 16h6"}]],
  "loupe": [["path",{"d":"M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13"}],["path",{"d":"M15.5 15.5L21 21"}]],
  "bulle": [["path",{"d":"M4 16V5h16v11h-9l-4 4v-4H4"}],["path",{"d":"M8 9.5h8"}],["path",{"d":"M8 12.5h5"}]],
  "tableau-colonnes": [["path",{"d":"M3 19V5h18v14H3"}],["path",{"d":"M9 5v14"}],["path",{"d":"M15 5v14"}],["path",{"d":"M3 10h18"}]],
  "enveloppe": [["path",{"d":"M3 18V6h18v12H3"}],["path",{"d":"M3 7l9 6 9-6"}]],
  "horloge": [["path",{"d":"M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18"}],["path",{"d":"M12 7v5l3 2"}]],
  "cible": [["path",{"d":"M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18"}],["path",{"d":"M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8"}],["path",{"d":"M12 12l8-8"}],["path",{"d":"M16 4h4v4"}]],
  "ampoule": [["path",{"d":"M8.5 14.5C7 13.2 6 11.4 6 9.5a6 6 0 0 1 12 0c0 1.9-1 3.7-2.5 5-.6.5-1 1.2-1 2h-5c0-.8-.4-1.5-1-2"}],["path",{"d":"M10 20h4"}]],
  "point-interrogation": [["path",{"d":"M8.5 9a3.5 3.5 0 1 1 5.5 2.9c-1.2.9-2 1.6-2 3.1"}],["path",{"d":"M12 19h.01"}]],
  "coche-cercle": [["path",{"d":"M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18"}],["path",{"d":"M8 12.5l3 3 5-6"}]],
  "calendrier": [["path",{"d":"M4 6h16v14H4V6"}],["path",{"d":"M4 11h16"}],["path",{"d":"M8 3v4"}],["path",{"d":"M16 3v4"}]],
  "telephone": [["path",{"d":"M7 3h10v18H7V3"}],["path",{"d":"M11 18h2"}]],
  "ordinateur-portable": [["path",{"d":"M5 6h14v9H5V6"}],["path",{"d":"M3 19h18"}]],
  "dossier": [["path",{"d":"M3 6h6l2 2h10v11H3V6"}],["path",{"d":"M3 12h18"}]],
  "trombone": [["path",{"d":"M10 9v7a2 2 0 0 0 4 0V7a4 4 0 0 0-8 0v9a6 6 0 0 0 12 0V9"}]],
  "crayon": [["path",{"d":"M4 20l1-4L16 5l3 3L8 19l-4 1"}],["path",{"d":"M14 7l3 3"}]],
  "gomme": [["path",{"d":"M3 14l8-8 6 6-8 8-6-6"}],["path",{"d":"M7 10l6 6"}],["path",{"d":"M14 20h7"}]],
  "calculatrice": [["path",{"d":"M6 3h12v18H6V3"}],["path",{"d":"M9 6h6v3H9V6"}],["path",{"d":"M9 13h.01"}],["path",{"d":"M12 13h.01"}],["path",{"d":"M15 13h.01"}],["path",{"d":"M9 17h.01"}],["path",{"d":"M12 17h.01"}],["path",{"d":"M15 17h.01"}]],
  "graphique-barres": [["path",{"d":"M3 3v18h18"}],["path",{"d":"M8 17v-4"}],["path",{"d":"M12 17V8"}],["path",{"d":"M16 17v-7"}]],
  "courbe-monte": [["path",{"d":"M3 3v18h18"}],["path",{"d":"M7 15l4-4 3 3 6-6"}],["path",{"d":"M16 8h4v4"}]],
  "fleche-droite": [["path",{"d":"M4 12h16"}],["path",{"d":"M14 6l6 6-6 6"}]],
  "fleche-boucle": [["path",{"d":"M20 12a8 8 0 1 1-3-6"}],["path",{"d":"M13 6h4V2"}]],
  "croix": [["path",{"d":"M6 6l12 12"}],["path",{"d":"M18 6L6 18"}]],
  "cadenas": [["path",{"d":"M5 11h14v10H5V11"}],["path",{"d":"M8 11V7a4 4 0 0 1 8 0v4"}],["path",{"d":"M12 15v2"}]],
  "cle": [["path",{"d":"M8 12a4 4 0 1 0 0 8a4 4 0 1 0 0-8"}],["path",{"d":"M11 13L20 4"}],["path",{"d":"M17 7l3 3"}]],
  "engrenage": [["path",{"d":"M18.2 10.1L20.9 10.4L20.9 13.6L18.2 13.9L17.7 15.1L19.4 17.2L17.2 19.4L15.1 17.7L13.9 18.2L13.6 20.9L10.4 20.9L10.1 18.2L8.9 17.7L6.8 19.4L4.6 17.2L6.3 15.1L5.8 13.9L3.1 13.6L3.1 10.4L5.8 10.1L6.3 8.9L4.6 6.8L6.8 4.6L8.9 6.3L10.1 5.8L10.4 3.1L13.6 3.1L13.9 5.8L15.1 6.3L17.2 4.6L19.4 6.8L17.7 8.9L18.2 10.1"}],["path",{"d":"M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6"}]],
  "eclair": [["path",{"d":"M13 3L5 14h6l-1 7 8-11h-6l1-7"}]],
  "sablier": [["path",{"d":"M6 3h12"}],["path",{"d":"M6 21h12"}],["path",{"d":"M8 3v4l4 5-4 5v4"}],["path",{"d":"M16 3v4l-4 5 4 5v4"}]],
  "chronometre": [["path",{"d":"M12 7a7 7 0 1 0 0 14a7 7 0 1 0 0-14"}],["path",{"d":"M12 3v4"}],["path",{"d":"M10 3h4"}],["path",{"d":"M12 14l3-3"}],["path",{"d":"M18 7l1.5-1.5"}]],
  "panier": [["path",{"d":"M3 9h18l-2 11H5L3 9"}],["path",{"d":"M8 9l4-5 4 5"}],["path",{"d":"M9 13v4"}],["path",{"d":"M15 13v4"}]],
  "piece": [["path",{"d":"M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18"}],["path",{"d":"M16 9a4 4 0 1 0 0 6"}],["path",{"d":"M8 10.5h5.5"}],["path",{"d":"M8 13.5h5.5"}]],
  "batiment": [["path",{"d":"M5 21V4h10v17"}],["path",{"d":"M15 10h4v11"}],["path",{"d":"M3 21h18"}],["path",{"d":"M8 8h4"}],["path",{"d":"M8 12h4"}]],
  "maillons": [["path",{"d":"M7 8h3a4 4 0 0 1 0 8H7a4 4 0 0 1 0-8"}],["path",{"d":"M14 8h3a4 4 0 0 1 0 8h-3a4 4 0 0 1 0-8"}]],
  "liste-puces": [["path",{"d":"M5 6h.01"}],["path",{"d":"M9 6h11"}],["path",{"d":"M5 12h.01"}],["path",{"d":"M9 12h11"}],["path",{"d":"M5 18h.01"}],["path",{"d":"M9 18h11"}]],
  "liste-cochee": [["path",{"d":"M4 6l1.5 1.5L8 4.5"}],["path",{"d":"M11 6h9"}],["path",{"d":"M4 12l1.5 1.5L8 10.5"}],["path",{"d":"M11 12h9"}],["path",{"d":"M4 18l1.5 1.5L8 16.5"}],["path",{"d":"M11 18h9"}]],
  "guillemets": [["path",{"d":"M8 17l2-4V8H5v5h5"}],["path",{"d":"M17 17l2-4V8h-5v5h5"}]],
  "etoile": [["path",{"d":"M12 3.3L14.5 9.4L21 9.9L16 14.1L17.6 20.5L12 17L6.4 20.5L8 14.1L3 9.9L9.5 9.4L12 3.3"}]],
  "drapeau": [["path",{"d":"M5 21V4h13l-3 4 3 4H5"}]],
  "balance": [["path",{"d":"M12 4v16"}],["path",{"d":"M8 20h8"}],["path",{"d":"M5 7h14"}],["path",{"d":"M5 7l-3 6a3 3 0 0 0 6 0L5 7"}],["path",{"d":"M19 7l-3 6a3 3 0 0 0 6 0L19 7"}]],
  "puzzle": [["path",{"d":"M3 8h4a2.5 2.5 0 1 1 4 0h6v4a2.5 2.5 0 1 1 0 4v5H3v-5a2.5 2.5 0 1 0 0-4V8"}]],
} as const satisfies Record<string, NoeudDessin[]>;

export type IdDessin = keyof typeof TRACES_DESSINS;
