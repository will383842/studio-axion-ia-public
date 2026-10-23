/**
 * ICÔNES MÉTIER LUCIDE — 40 tracés Lucide, grille 24 × 24, trait 2.
 *
 * ISC License — Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2023 as part of Feather (MIT).
 * All other copyright (c) for Lucide are held by Lucide Contributors 2025. lucide.dev
 * Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby
 * granted, provided that the above copyright notice and this permission notice appear in all copies.
 * Texte complet de la licence : studio-rendu/compositions/visuels/icones/LICENCE-Lucide-ISC.txt
 *
 * Pas de doublon : les 20 tracés déjà générés pour le motion design (`src/briques/motion/icones.ts`, produit par
 * `scripts/motion/generer-icones.mjs`, droit `icones-motion-lucide`) et IDENTIQUES ici sont réutilisés (`MOTION[...]`).
 * Les 20 autres sont recopiés de lucide-static 0.545.0 et figés ici : soit absents du jeu motion (courrier, dossier…),
 * soit d'une autre version ou d'un autre sens (motion `cle` = clé à molette ; ici `cle` = key-round ; `calendrier`,
 * `horloge`, `graphique`, `eclair`, `document`, `fusee`, `coche-cercle` diffèrent). Ce fichier n'est PAS régénéré : un
 * changement de version Lucide côté motion ne modifie que les 20 tracés partagés, ce qui est voulu.
 *
 * Seuls les chemins sont copiés : aucune bibliothèque d'icônes n'est une dépendance de studio-rendu. PUR, SANS alias « @/ ».
 * Les noms français sont ceux du registre (`src/briques/visuels/registre-illustrations.ts`) ; entre crochets, le nom Lucide.
 */
import { ICONES as MOTION } from "../../../../src/briques/motion/icones";

export type NoeudLucide = [balise: "path" | "circle" | "rect" | "line" | "polyline" | "polygon" | "ellipse", attributs: Record<string, string | number>];

export const LUCIDE = {
  /** [mail] */
  "courrier": [["path",{"d":"m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"}],["rect",{"x":"2","y":"4","width":"20","height":"16","rx":"2"}]],
  /** [calendar] */
  "calendrier": [["path",{"d":"M8 2v4"}],["path",{"d":"M16 2v4"}],["rect",{"width":"18","height":"18","x":"3","y":"4","rx":"2"}],["path",{"d":"M3 10h18"}]],
  /** [clock] */
  "horloge": [["path",{"d":"M12 6v6l4 2"}],["circle",{"cx":"12","cy":"12","r":"10"}]],
  /** [shield-check] */
  "bouclier": MOTION["bouclier"],
  /** [folder] */
  "dossier": [["path",{"d":"M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"}]],
  /** [chart-column] */
  "graphique": [["path",{"d":"M3 3v16a2 2 0 0 0 2 2h16"}],["path",{"d":"M18 17V9"}],["path",{"d":"M13 17V5"}],["path",{"d":"M8 17v-3"}]],
  /** [zap] */
  "eclair": [["path",{"d":"M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"}]],
  /** [check] */
  "coche": MOTION["coche"],
  /** [x] */
  "croix": MOTION["croix"],
  /** [arrow-right] */
  "fleche": MOTION["fleche"],
  /** [settings] */
  "engrenage": MOTION["engrenage"],
  /** [search] */
  "loupe": MOTION["loupe"],
  /** [message-square] */
  "bulle": [["path",{"d":"M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"}]],
  /** [lock] */
  "cadenas": MOTION["verrou"],
  /** [target] */
  "cible": MOTION["cible"],
  /** [hourglass] */
  "sablier": MOTION["sablier"],
  /** [file-text] */
  "document": [["path",{"d":"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"}],["path",{"d":"M14 2v4a2 2 0 0 0 2 2h4"}],["path",{"d":"M10 9H8"}],["path",{"d":"M16 13H8"}],["path",{"d":"M16 17H8"}]],
  /** [list-checks] */
  "liste": MOTION["liste"],
  /** [phone] */
  "telephone": MOTION["telephone"],
  /** [laptop] */
  "ordinateur": [["path",{"d":"M18 5a2 2 0 0 1 2 2v8.526a2 2 0 0 0 .212.897l1.068 2.127a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45l1.068-2.127A2 2 0 0 0 4 15.526V7a2 2 0 0 1 2-2z"}],["path",{"d":"M20.054 15.987H3.946"}]],
  /** [users] */
  "utilisateurs": MOTION["equipe"],
  /** [briefcase] */
  "valise": [["path",{"d":"M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"}],["rect",{"width":"20","height":"14","x":"2","y":"6","rx":"2"}]],
  /** [lightbulb] */
  "ampoule": MOTION["ampoule"],
  /** [rocket] */
  "fusee": [["path",{"d":"M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"}],["path",{"d":"m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"}],["path",{"d":"M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"}],["path",{"d":"M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"}]],
  /** [flag] */
  "drapeau": MOTION["drapeau"],
  /** [star] */
  "etoile": MOTION["etoile"],
  /** [key-round] */
  "cle": [["path",{"d":"M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"}],["circle",{"cx":"16.5","cy":"7.5","r":".5","fill":"currentColor"}]],
  /** [house] */
  "maison": MOTION["maison"],
  /** [trending-up] */
  "hausse": MOTION["hausse"],
  /** [trending-down] */
  "baisse": MOTION["baisse"],
  /** [triangle-alert] */
  "alerte": MOTION["alerte"],
  /** [circle-help] */
  "question": MOTION["question"],
  /** [circle-check] */
  "coche-cercle": [["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"m9 12 2 2 4-4"}]],
  /** [link] */
  "lien": [["path",{"d":"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"}],["path",{"d":"M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"}]],
  /** [pencil] */
  "crayon": [["path",{"d":"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"}],["path",{"d":"m15 5 4 4"}]],
  /** [trash-2] */
  "corbeille": [["path",{"d":"M10 11v6"}],["path",{"d":"M14 11v6"}],["path",{"d":"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"}],["path",{"d":"M3 6h18"}],["path",{"d":"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"}]],
  /** [scale] */
  "balance": [["path",{"d":"m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"}],["path",{"d":"m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"}],["path",{"d":"M7 21h10"}],["path",{"d":"M12 3v18"}],["path",{"d":"M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"}]],
  /** [building-2] */
  "batiment": [["path",{"d":"M10 12h4"}],["path",{"d":"M10 8h4"}],["path",{"d":"M14 21v-3a2 2 0 0 0-4 0v3"}],["path",{"d":"M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2"}],["path",{"d":"M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"}]],
  /** [send] */
  "envoyer": [["path",{"d":"M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"}],["path",{"d":"m21.854 2.147-10.94 10.939"}]],
  /** [download] */
  "telechargement": [["path",{"d":"M12 15V3"}],["path",{"d":"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"}],["path",{"d":"m7 10 5 5 5-5"}]],
} as const satisfies Record<string, NoeudLucide[]>;

export type NomLucide = keyof typeof LUCIDE;

export const NOMS_LUCIDE = Object.keys(LUCIDE) as NomLucide[];
