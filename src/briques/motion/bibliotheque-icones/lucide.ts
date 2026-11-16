/**
 * ICÔNES LUCIDE — FICHIER GÉNÉRÉ par scripts/motion/importer-icones.mjs, lucide-static 0.545.0, sha256 504ff853e30a745ec91c82a8ddcfc0a0d4e0fe7474f341ff87cbe5f24668d7dc, ISC + MIT (Feather) : voir LICENCE-Lucide.txt. Ne pas modifier à la main.
 * Noms préfixés par le jeu (« lucide:coche »). PUR, SANS alias « @/ » : lisible par Remotion.
 */
export type NoeudBibliotheque = [balise: "path" | "circle" | "rect" | "line" | "polyline" | "polygon" | "ellipse", attributs: Record<string, string>];
export interface IconeBibliotheque {
  jeu: string;
  viewBox: string;
  noeuds: NoeudBibliotheque[];
}

export const LUCIDE_BIBLIOTHEQUE: Record<string, IconeBibliotheque> = {
  /** [triangle-alert] */
  "lucide:alerte": { jeu: "lucide", viewBox: "0 0 24 24", noeuds: [["path",{"d":"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"}],["path",{"d":"M12 9v4"}],["path",{"d":"M12 17h.01"}]] },
  /** [repeat] */
  "lucide:boucle": { jeu: "lucide", viewBox: "0 0 24 24", noeuds: [["path",{"d":"m17 2 4 4-4 4"}],["path",{"d":"M3 11v-1a4 4 0 0 1 4-4h14"}],["path",{"d":"m7 22-4-4 4-4"}],["path",{"d":"M21 13v1a4 4 0 0 1-4 4H3"}]] },
  /** [message-circle] */
  "lucide:bulle": { jeu: "lucide", viewBox: "0 0 24 24", noeuds: [["path",{"d":"M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"}]] },
  /** [lock] */
  "lucide:cadenas": { jeu: "lucide", viewBox: "0 0 24 24", noeuds: [["rect",{"width":"18","height":"11","x":"3","y":"11","rx":"2","ry":"2"}],["path",{"d":"M7 11V7a5 5 0 0 1 10 0v4"}]] },
  /** [calendar] */
  "lucide:calendrier": { jeu: "lucide", viewBox: "0 0 24 24", noeuds: [["path",{"d":"M8 2v4"}],["path",{"d":"M16 2v4"}],["rect",{"width":"18","height":"18","x":"3","y":"4","rx":"2"}],["path",{"d":"M3 10h18"}]] },
  /** [chevrons-right] */
  "lucide:chevrons": { jeu: "lucide", viewBox: "0 0 24 24", noeuds: [["path",{"d":"m6 17 5-5-5-5"}],["path",{"d":"m13 17 5-5-5-5"}]] },
  /** [target] */
  "lucide:cible": { jeu: "lucide", viewBox: "0 0 24 24", noeuds: [["circle",{"cx":"12","cy":"12","r":"10"}],["circle",{"cx":"12","cy":"12","r":"6"}],["circle",{"cx":"12","cy":"12","r":"2"}]] },
  /** [key-round] */
  "lucide:cle": { jeu: "lucide", viewBox: "0 0 24 24", noeuds: [["path",{"d":"M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"}],["circle",{"cx":"16.5","cy":"7.5","r":".5","fill":"currentColor"}]] },
  /** [bell] */
  "lucide:cloche": { jeu: "lucide", viewBox: "0 0 24 24", noeuds: [["path",{"d":"M10.268 21a2 2 0 0 0 3.464 0"}],["path",{"d":"M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"}]] },
  /** [check] */
  "lucide:coche": { jeu: "lucide", viewBox: "0 0 24 24", noeuds: [["path",{"d":"M20 6 9 17l-5-5"}]] },
  /** [square-check] */
  "lucide:coche-carre": { jeu: "lucide", viewBox: "0 0 24 24", noeuds: [["rect",{"width":"18","height":"18","x":"3","y":"3","rx":"2"}],["path",{"d":"m9 12 2 2 4-4"}]] },
  /** [circle-check] */
  "lucide:coche-cercle": { jeu: "lucide", viewBox: "0 0 24 24", noeuds: [["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"m9 12 2 2 4-4"}]] },
  /** [check-check] */
  "lucide:coche-double": { jeu: "lucide", viewBox: "0 0 24 24", noeuds: [["path",{"d":"M18 6 7 17l-5-5"}],["path",{"d":"m22 10-7.5 7.5L13 16"}]] },
  /** [x] */
  "lucide:croix": { jeu: "lucide", viewBox: "0 0 24 24", noeuds: [["path",{"d":"M18 6 6 18"}],["path",{"d":"m6 6 12 12"}]] },
  /** [square-x] */
  "lucide:croix-carre": { jeu: "lucide", viewBox: "0 0 24 24", noeuds: [["rect",{"width":"18","height":"18","x":"3","y":"3","rx":"2","ry":"2"}],["path",{"d":"m15 9-6 6"}],["path",{"d":"m9 9 6 6"}]] },
  /** [circle-x] */
  "lucide:croix-cercle": { jeu: "lucide", viewBox: "0 0 24 24", noeuds: [["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"m15 9-6 6"}],["path",{"d":"m9 9 6 6"}]] },
  /** [trending-down] */
  "lucide:descente": { jeu: "lucide", viewBox: "0 0 24 24", noeuds: [["path",{"d":"M16 17h6v-6"}],["path",{"d":"m22 17-8.5-8.5-5 5L2 7"}]] },
  /** [file-text] */
  "lucide:document": { jeu: "lucide", viewBox: "0 0 24 24", noeuds: [["path",{"d":"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"}],["path",{"d":"M14 2v4a2 2 0 0 0 2 2h4"}],["path",{"d":"M10 9H8"}],["path",{"d":"M16 13H8"}],["path",{"d":"M16 17H8"}]] },
  /** [folder] */
  "lucide:dossier": { jeu: "lucide", viewBox: "0 0 24 24", noeuds: [["path",{"d":"M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"}]] },
  /** [zap] */
  "lucide:eclair": { jeu: "lucide", viewBox: "0 0 24 24", noeuds: [["path",{"d":"M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"}]] },
  /** [equal] */
  "lucide:egal": { jeu: "lucide", viewBox: "0 0 24 24", noeuds: [["line",{"x1":"5","x2":"19","y1":"9","y2":"9"}],["line",{"x1":"5","x2":"19","y1":"15","y2":"15"}]] },
  /** [star] */
  "lucide:etoile": { jeu: "lucide", viewBox: "0 0 24 24", noeuds: [["path",{"d":"M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"}]] },
  /** [euro] */
  "lucide:euro": { jeu: "lucide", viewBox: "0 0 24 24", noeuds: [["path",{"d":"M4 10h12"}],["path",{"d":"M4 14h9"}],["path",{"d":"M19 6a7.7 7.7 0 0 0-5.2-2A7.9 7.9 0 0 0 6 12c0 4.4 3.5 8 7.8 8 2 0 3.8-.8 5.2-2"}]] },
  /** [arrow-down] */
  "lucide:fleche-bas": { jeu: "lucide", viewBox: "0 0 24 24", noeuds: [["path",{"d":"M12 5v14"}],["path",{"d":"m19 12-7 7-7-7"}]] },
  /** [corner-down-right] */
  "lucide:fleche-courbe": { jeu: "lucide", viewBox: "0 0 24 24", noeuds: [["path",{"d":"m15 10 5 5-5 5"}],["path",{"d":"M4 4v7a4 4 0 0 0 4 4h12"}]] },
  /** [arrow-right] */
  "lucide:fleche-droite": { jeu: "lucide", viewBox: "0 0 24 24", noeuds: [["path",{"d":"M5 12h14"}],["path",{"d":"m12 5 7 7-7 7"}]] },
  /** [arrow-left] */
  "lucide:fleche-gauche": { jeu: "lucide", viewBox: "0 0 24 24", noeuds: [["path",{"d":"m12 19-7-7 7-7"}],["path",{"d":"M19 12H5"}]] },
  /** [arrow-up] */
  "lucide:fleche-haut": { jeu: "lucide", viewBox: "0 0 24 24", noeuds: [["path",{"d":"m5 12 7-7 7 7"}],["path",{"d":"M12 19V5"}]] },
  /** [chart-column] */
  "lucide:graphique": { jeu: "lucide", viewBox: "0 0 24 24", noeuds: [["path",{"d":"M3 3v16a2 2 0 0 0 2 2h16"}],["path",{"d":"M18 17V9"}],["path",{"d":"M13 17V5"}],["path",{"d":"M8 17v-3"}]] },
  /** [clock] */
  "lucide:horloge": { jeu: "lucide", viewBox: "0 0 24 24", noeuds: [["path",{"d":"M12 6v6l4 2"}],["circle",{"cx":"12","cy":"12","r":"10"}]] },
  /** [info] */
  "lucide:info": { jeu: "lucide", viewBox: "0 0 24 24", noeuds: [["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"M12 16v-4"}],["path",{"d":"M12 8h.01"}]] },
  /** [ban] */
  "lucide:interdit": { jeu: "lucide", viewBox: "0 0 24 24", noeuds: [["path",{"d":"M4.929 4.929 19.07 19.071"}],["circle",{"cx":"12","cy":"12","r":"10"}]] },
  /** [link] */
  "lucide:lien": { jeu: "lucide", viewBox: "0 0 24 24", noeuds: [["path",{"d":"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"}],["path",{"d":"M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"}]] },
  /** [search] */
  "lucide:loupe": { jeu: "lucide", viewBox: "0 0 24 24", noeuds: [["path",{"d":"m21 21-4.34-4.34"}],["circle",{"cx":"11","cy":"11","r":"8"}]] },
  /** [minus] */
  "lucide:moins": { jeu: "lucide", viewBox: "0 0 24 24", noeuds: [["path",{"d":"M5 12h14"}]] },
  /** [trending-up] */
  "lucide:montee": { jeu: "lucide", viewBox: "0 0 24 24", noeuds: [["path",{"d":"M16 7h6v6"}],["path",{"d":"m22 7-8.5 8.5-5-5L2 17"}]] },
  /** [user] */
  "lucide:personne": { jeu: "lucide", viewBox: "0 0 24 24", noeuds: [["path",{"d":"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"}],["circle",{"cx":"12","cy":"7","r":"4"}]] },
  /** [plus] */
  "lucide:plus": { jeu: "lucide", viewBox: "0 0 24 24", noeuds: [["path",{"d":"M5 12h14"}],["path",{"d":"M12 5v14"}]] },
  /** [thumbs-down] */
  "lucide:pouce-bas": { jeu: "lucide", viewBox: "0 0 24 24", noeuds: [["path",{"d":"M17 14V2"}],["path",{"d":"M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"}]] },
  /** [thumbs-up] */
  "lucide:pouce-haut": { jeu: "lucide", viewBox: "0 0 24 24", noeuds: [["path",{"d":"M7 10v12"}],["path",{"d":"M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"}]] },
  /** [circle-question-mark] */
  "lucide:question": { jeu: "lucide", viewBox: "0 0 24 24", noeuds: [["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"}],["path",{"d":"M12 17h.01"}]] },
  /** [undo-2] */
  "lucide:retour": { jeu: "lucide", viewBox: "0 0 24 24", noeuds: [["path",{"d":"M9 14 4 9l5-5"}],["path",{"d":"M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"}]] },
  /** [download] */
  "lucide:telechargement": { jeu: "lucide", viewBox: "0 0 24 24", noeuds: [["path",{"d":"M12 15V3"}],["path",{"d":"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"}],["path",{"d":"m7 10 5 5 5-5"}]] },
};
