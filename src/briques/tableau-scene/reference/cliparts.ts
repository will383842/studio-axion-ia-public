/**
 * DESSINS RECOLORIÉS DU STYLE « reference/1 » : chaque dessin de la banque (`src/briques/dessins/traces.ts`, grille
 * 24 × 24, contours seulement) reçoit des APLATS de la palette du style (terracotta, sable, encre, ivoire, jaune miel),
 * posés sous son contour, tracé à l'encre en trait fin. Aucun nouveau dessin : les formes restent celles de la banque
 * (et de son registre des droits) ; seuls les aplats sont ajoutés, et parfois la teinte ou l'épaisseur d'un trait.
 *
 * `aplats` : formes pleines, sous les traits ; `contour` : la forme a son propre trait d'encre (quand elle ne suit pas
 * un tracé de la banque, comme la grosse flèche). `traits` : les tracés de la banque gardés (par défaut tous), leurs
 * teintes (par défaut l'encre) et leur épaisseur (grille 24, par défaut `EPAISSEUR_TRAIT_CLIPART`).
 * PUR, sans alias « @/ » : lu par `studio-rendu`.
 */
import { GRILLE_DESSIN, TRACES_DESSINS, type IdDessin } from "../../dessins/traces";
import { PALETTE_DESSINS, type TeinteDessin } from "./charte";

/** Épaisseur du contour d'encre, en unités de la grille 24 (≈ 4,5 px pour un dessin de 108 px : un trait fin). */
export const EPAISSEUR_TRAIT_CLIPART = 1;

export interface AplatClipart {
  d: string;
  teinte: TeinteDessin;
  /** La forme a son propre contour d'encre (sinon : les traits de la banque la bordent). */
  contour?: boolean;
}

export interface RecoloriageClipart {
  aplats: readonly AplatClipart[];
  /** Index des tracés de la banque gardés (absent : tous). */
  traits?: readonly number[];
  /** Teinte d'un tracé (par index) ; absente : l'encre. */
  teintes?: Readonly<Record<number, TeinteDessin>>;
  /** Épaisseur des tracés (grille 24) ; absente : `EPAISSEUR_TRAIT_CLIPART`. */
  epaisseur?: number;
}

const disque = (teinte: TeinteDessin, r = 10.5): AplatClipart => ({ d: `M12 ${12 - r}a${r} ${r} 0 1 0 0 ${2 * r}a${r} ${r} 0 1 0 0-${2 * r}`, teinte });

/** Recoloriage de CHAQUE dessin de la banque (un test vérifie qu'aucun ne manque). */
export const RECOLORIAGES: Readonly<Record<IdDessin, RecoloriageClipart>> = {
  document: { aplats: [{ d: "M6 3H14L18 7V21H6Z", teinte: "ivoire" }, { d: "M14 3V7H18Z", teinte: "sable" }] },
  loupe: { aplats: [{ d: "M14.6 16.4L20.1 21.9L21.9 20.1L16.4 14.6Z", teinte: "terracotta" }, { d: "M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13", teinte: "ivoire" }] },
  bulle: { aplats: [{ d: "M4 16V5h16v11h-9l-4 4v-4H4Z", teinte: "terracotta" }], teintes: { 1: "ivoire", 2: "ivoire" } },
  "tableau-colonnes": { aplats: [{ d: "M3 5h18v14H3Z", teinte: "ivoire" }, { d: "M3 5h18v5H3Z", teinte: "terracotta" }] },
  enveloppe: { aplats: [{ d: "M3 6h18v12H3Z", teinte: "ivoire" }, { d: "M3 6h18v1l-9 6-9-6Z", teinte: "sable" }] },
  horloge: { aplats: [disque("miel", 9), { d: "M12 5.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13", teinte: "ivoire" }] },
  cible: { aplats: [disque("terracotta", 9), { d: "M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8", teinte: "ivoire" }] },
  ampoule: { aplats: [{ d: "M8.5 14.5C7 13.2 6 11.4 6 9.5a6 6 0 0 1 12 0c0 1.9-1 3.7-2.5 5-.6.5-1 1.2-1 2h-5c0-.8-.4-1.5-1-2Z", teinte: "miel" }, { d: "M9.5 16.5h5V21h-5Z", teinte: "sable" }] },
  "point-interrogation": { aplats: [disque("miel")] },
  "coche-cercle": { aplats: [disque("miel", 9)] },
  calendrier: { aplats: [{ d: "M4 6h16v14H4Z", teinte: "ivoire" }, { d: "M4 6h16v5H4Z", teinte: "terracotta" }] },
  telephone: { aplats: [{ d: "M7 3h10v18H7Z", teinte: "sable" }, { d: "M8.6 5h6.8v11H8.6Z", teinte: "ivoire" }] },
  "ordinateur-portable": { aplats: [{ d: "M5 6h14v9H5Z", teinte: "ivoire" }, { d: "M3 17.8h18v2.4H3Z", teinte: "sable" }] },
  dossier: { aplats: [{ d: "M3 6h6l2 2h10v11H3Z", teinte: "miel" }, { d: "M3 12h18v7H3Z", teinte: "sable" }] },
  trombone: { aplats: [disque("ivoire")], teintes: { 0: "terracotta" }, epaisseur: 1.5 },
  crayon: { aplats: [{ d: "M4 20l1-4L16 5l3 3L8 19Z", teinte: "miel" }, { d: "M4 20l1-4 3 3Z", teinte: "sable" }] },
  gomme: { aplats: [{ d: "M3 14l8-8 6 6-8 8Z", teinte: "terracotta" }, { d: "M3 14l4-4 6 6-4 4Z", teinte: "ivoire" }] },
  calculatrice: { aplats: [{ d: "M6 3h12v18H6Z", teinte: "sable" }, { d: "M9 6h6v3H9Z", teinte: "ivoire" }] },
  "graphique-barres": { aplats: [{ d: "M7 13h2v4H7Z", teinte: "terracotta", contour: true }, { d: "M11 8h2v9h-2Z", teinte: "miel", contour: true }, { d: "M15 10h2v7h-2Z", teinte: "sable", contour: true }], traits: [0] },
  "courbe-monte": { aplats: [{ d: "M7 15l4-4 3 3 6-6v13H7Z", teinte: "miel" }] },
  "fleche-droite": { aplats: [{ d: "M3.5 9.5h10V5.5l7 6.5-7 6.5v-4h-10Z", teinte: "miel", contour: true }], traits: [] },
  "fleche-boucle": { aplats: [disque("ivoire")], teintes: { 0: "terracotta", 1: "terracotta" }, epaisseur: 1.7 },
  croix: { aplats: [disque("ivoire", 10)], teintes: { 0: "terracotta", 1: "terracotta" }, epaisseur: 2.2 },
  cadenas: { aplats: [{ d: "M5 11h14v10H5Z", teinte: "miel" }] },
  cle: { aplats: [{ d: "M8 12a4 4 0 1 0 0 8a4 4 0 1 0 0-8", teinte: "miel" }] },
  engrenage: {
    aplats: [
      { d: "M18.2 10.1L20.9 10.4L20.9 13.6L18.2 13.9L17.7 15.1L19.4 17.2L17.2 19.4L15.1 17.7L13.9 18.2L13.6 20.9L10.4 20.9L10.1 18.2L8.9 17.7L6.8 19.4L4.6 17.2L6.3 15.1L5.8 13.9L3.1 13.6L3.1 10.4L5.8 10.1L6.3 8.9L4.6 6.8L6.8 4.6L8.9 6.3L10.1 5.8L10.4 3.1L13.6 3.1L13.9 5.8L15.1 6.3L17.2 4.6L19.4 6.8L17.7 8.9L18.2 10.1Z", teinte: "sable" },
      { d: "M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6", teinte: "ivoire" },
    ],
  },
  eclair: { aplats: [{ d: "M13 3L5 14h6l-1 7 8-11h-6l1-7Z", teinte: "miel" }] },
  sablier: { aplats: [{ d: "M8 3h8v4l-4 5-4-5Z", teinte: "ivoire" }, { d: "M12 15.5l3.2 3.5V21H8.8v-2Z", teinte: "miel" }] },
  chronometre: { aplats: [{ d: "M12 7a7 7 0 1 0 0 14a7 7 0 1 0 0-14", teinte: "ivoire" }, { d: "M10 2.2h4v1.6h-4Z", teinte: "terracotta", contour: true }] },
  panier: { aplats: [{ d: "M3 9h18l-2 11H5Z", teinte: "terracotta" }], teintes: { 2: "ivoire", 3: "ivoire" } },
  piece: { aplats: [{ d: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18", teinte: "miel" }] },
  batiment: { aplats: [{ d: "M5 4h10v17H5Z", teinte: "sable" }, { d: "M15 10h4v11h-4Z", teinte: "ivoire" }] },
  maillons: { aplats: [], teintes: { 0: "terracotta", 1: "encre" }, epaisseur: 1.7 },
  "liste-puces": { aplats: [{ d: "M2.5 3h19v18h-19Z", teinte: "ivoire", contour: true }] },
  "liste-cochee": { aplats: [{ d: "M2 2.5h20v19H2Z", teinte: "ivoire", contour: true }], teintes: { 0: "terracotta", 2: "terracotta", 4: "terracotta" } },
  guillemets: { aplats: [{ d: "M5 8h5v5l-2 4H6l2-4H5Z", teinte: "terracotta", contour: true }, { d: "M14 8h5v5l-2 4h-2l2-4h-3Z", teinte: "terracotta", contour: true }], traits: [] },
  etoile: { aplats: [{ d: "M12 3.3L14.5 9.4L21 9.9L16 14.1L17.6 20.5L12 17L6.4 20.5L8 14.1L3 9.9L9.5 9.4Z", teinte: "miel" }] },
  drapeau: { aplats: [{ d: "M5 4h13l-3 4 3 4H5Z", teinte: "terracotta" }] },
  balance: { aplats: [{ d: "M5 7l-3 6a3 3 0 0 0 6 0Z", teinte: "miel" }, { d: "M19 7l-3 6a3 3 0 0 0 6 0Z", teinte: "miel" }] },
  puzzle: { aplats: [{ d: "M3 8h4a2.5 2.5 0 1 1 4 0h6v4a2.5 2.5 0 1 1 0 4v5H3v-5a2.5 2.5 0 1 0 0-4Z", teinte: "miel" }] },
};

/** Un trait du dessin recolorié, prêt à tracer. */
export interface TraitClipart {
  d: string;
  couleur: string;
  /** Épaisseur, en unités de la grille 24. */
  epaisseur: number;
}

/** Dessin recolorié prêt à rendre : aplats (sous) et traits (dessus), couleurs déjà résolues. */
export interface ClipartRecolorie {
  grille: number;
  aplats: { d: string; couleur: string; contour: boolean }[];
  traits: TraitClipart[];
}

/** Le dessin `id` recolorié ; `null` s'il n'est pas dans la banque. */
export function clipartRecolorie(id: string): ClipartRecolorie | null {
  if (!Object.prototype.hasOwnProperty.call(TRACES_DESSINS, id)) return null;
  const noeuds = TRACES_DESSINS[id as IdDessin] as readonly (readonly [string, { d: string }])[];
  const r = RECOLORIAGES[id as IdDessin];
  const garder = r.traits ?? noeuds.map((_, i) => i);
  const epaisseur = r.epaisseur ?? EPAISSEUR_TRAIT_CLIPART;
  return {
    grille: GRILLE_DESSIN,
    aplats: r.aplats.map((a) => ({ d: a.d, couleur: PALETTE_DESSINS[a.teinte], contour: !!a.contour })),
    traits: garder.map((i) => ({ d: noeuds[i][1].d, couleur: PALETTE_DESSINS[r.teintes?.[i] ?? "encre"], epaisseur })),
  };
}

/** Toutes les couleurs employées par un dessin recolorié (contrôle : la palette seule). */
export function couleursClipart(id: string): string[] {
  const c = clipartRecolorie(id);
  if (!c) return [];
  return [...new Set([...c.aplats.map((a) => a.couleur), ...c.traits.map((t) => t.couleur), ...(c.aplats.some((a) => a.contour) ? [PALETTE_DESSINS.encre] : [])])];
}
