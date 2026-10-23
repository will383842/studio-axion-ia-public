/**
 * MAQUETTES DE VARIÉTÉ (lot L1, plan `PLAN-ARCHITECTE.md` du 15/10/2026) : données PURES des maquettes en images fixes.
 * Prototypes seulement : rien ici n'est lu par le moteur ni par les compositions du format. Toute couleur, police et
 * taille vient de la charte `charte-duo/1` ; tous les chiffres viennent des faits prouvés du cas `articles-blog`
 * (`src/formats/cas-concret/catalogue/articles-blog.ts`) et du cas `recrutement-apporteurs`.
 *
 * PUR : ni `remotion` ni React. Les propriétés des écrans « aujourd'hui » sont construites À LA DEMANDE (fonction).
 */
import { boitesEcran, proprietesEcrans, type BoitePx, type EcranCale, type ProprietesEcran } from "../../../../src/briques/ecrans-motion";

/** Les maquettes rendues, dans l'ordre de la planche. */
export const MAQUETTES = Object.freeze([
  "aujourdhui-accroche",
  "aujourdhui-etape",
  "m01-ouverture-chiffre",
  "m02-ouverture-titre-gauche",
  "m03-etape-plein-cadre",
  "m04-etape-objet-gauche",
  "m05-liste-pile",
  "m06-fond-terracotta",
  "m07-barres-proportionnelles",
  "m08-objet-compose",
  "m09-ouverture-question",
  "m10-ouverture-avant-apres",
  "m11-ouverture-zoom-arriere",
  "m12-citation-geante",
  "m13-comparatif-deux-colonnes",
  "m14-journee-8h-22h",
  "m15-jauge-13-criteres",
  "m16-fin-variante",
  "m17-recrutement-autre-tirage",
  "t1-volet-entree",
  "t2-volet-sortie",
  "t3-zoom-debut",
  "t4-zoom-fin",
] as const);
export type NomMaquette = (typeof MAQUETTES)[number];

/** Taille, cadence et durée de la composition des maquettes (4 s : assez pour que chaque animation soit posée). */
export const FORMAT_MAQUETTE = Object.freeze({ largeur: 1080, hauteur: 1920, fps: 25, images: 100 });

/** Zone « pleine image » du format (recopiée de `src/formats/cas-concret/index.ts`, sans alias « @/ »). */
const ZONE_PLEINE_IMAGE = Object.freeze({ haut: (143 / 1920) * 100, droite: (40 / 1080) * 100, bas: (176 / 1920) * 100, gauche: (40 / 1080) * 100 });
const BANDE_SOUS_TITRES = 0.08;
const BAS_FIL = 1770 / 1920;

/** Les deux écrans « aujourd'hui » (moteur actuel, v4), avec le contenu du cas blog. */
export function proprietesAujourdhui(): ProprietesEcran[] {
  const ecrans: EcranCale[] = [
    { id: "a1", fond: "sombre", debutMs: 0, finMs: 4000, evenements: [], type: "accroche", etiquette: "Blog · cas réel", lignes: ["Des articles", "écrits et *publiés*"] } as EcranCale,
    {
      id: "a2",
      fond: "ivoire",
      debutMs: 4000,
      finMs: 8000,
      evenements: [],
      type: "etape",
      numero: 2,
      nombreEtapes: 5,
      titre: "L'*écriture*",
      ligne: "L'IA écrit 900 à 1300 mots.",
      visuel: { objet: "rapport", textes: ["Article · 1 200 mots", "Rédaction"] },
      puces: [],
    } as EcranCale,
  ];
  const brutes = proprietesEcrans({ ecrans, captures: {}, zoneProtegee: { ...ZONE_PLEINE_IMAGE }, bandeSousTitres: BANDE_SOUS_TITRES });
  return brutes.map((e) => {
    const basUtile = e.zone.y + e.zone.hauteur;
    const dessin = e.dessin ? { ...e.dessin, hauteur: Math.max(e.zone.hauteur, Math.min(e.dessin.hauteur, basUtile - e.dessin.y)) } : e.dessin;
    return { ...e, dessin, basFil: BAS_FIL * e.hauteur };
  });
}

/** Boîte de la marque « axion-ia.com » : la même que dans les écrans du format (même zone pleine image). */
export function boiteMarque(): BoitePx {
  return boitesEcran(proprietesAujourdhui()[0]).marque.boite;
}

/** Centre vertical (px) de la ligne de sous-titres du format, en zone pleine image (≈ 85 % de la hauteur). */
export const CENTRE_SOUS_TITRES_PX = 0.85 * 1920;

/** Marges latérales des maquettes (zone pleine image : 40 px ; on garde un peu d'air). */
export const MARGE_PX = 64;

/**
 * Barres proportionnelles : largeur de chaque barre = valeur / maximum, avec un plancher visible (3 % de la piste),
 * pour que « 1 » se voie à côté de « 200 ». PUR.
 */
export function barresProportionnelles(valeurs: readonly number[], plancher = 0.03): number[] {
  const max = Math.max(...valeurs.map((v) => Math.abs(v)), 1e-9);
  return valeurs.map((v) => Math.max(plancher, Math.abs(v) / max));
}

/** Instants (s) de la bande « transitions » : volet terracotta entre deux écrans, puis zoom lent sur un écran. */
export const INSTANTS_BANDE = Object.freeze({ voletEntree: 0.38, voletSortie: 0.66, zoomDebut: 0, zoomFin: 3.96 });

/** Volet terracotta : position du bord avant (0 = hors cadre à gauche, 1 = tout couvert, 2 = sorti à droite). */
export function planVolet(t: number, debut = 0.1, duree = 0.7) {
  const x = Math.max(0, Math.min(1, (t - debut) / duree));
  const y = x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const bord = 2 * y;
  return { gauche: Math.max(0, bord - 1), droite: Math.min(1, bord), montreB: bord >= 1 };
}

/** Zoom lent de 1 à 1,06 sur la durée de l'écran (caméra autorisée dans ce format), courbe douce. */
export function planZoomLent(t: number, duree: number, de = 1, a = 1.06) {
  const x = Math.max(0, Math.min(1, t / duree));
  const y = x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  return de + (a - de) * y;
}
