/**
 * MISE EN PAGE DU TABLEAU ANIMÉ (tâche TB-03, reprise visuelle ; plan `02-FORMAT-TABLEAU-ANIME.md` § 4.2 étape 5,
 * § 7 et § 12).
 *
 * Fonction PURE et déterministe : fiche valide (calée ou non) → pour chaque page, la position et la taille de chaque
 * élément, en pixels (1080 × 1920 ; ou un autre format de sortie, `options.format`, table `formats-sortie.ts`) et en
 * fractions de l'image. La page blanche se remplit de haut en bas, dans l'ordre
 * d'écriture (scène, puis ancre), sans rien effacer. Même fiche = même mise en page, au pixel près.
 *
 * Format VERTICAL lu sur téléphone : la page FINIE (état à sa dernière scène) est calculée d'abord, puis AGRANDIE
 * (jusqu'à `ECHELLE_MAX`) autant que réduite (jusqu'au plancher de 3 %) : la plus grande échelle où tout tient. Une
 * seule échelle par page : une même taille par niveau (titre, texte, légende) sur toute la page. Le bloc est ensuite
 * réparti verticalement (écarts entre scènes, marges haute et basse égales).
 *
 * Rien n'est écrit en dur :
 *  - zones sûres : union des zones protégées des réseaux qui publient du 9:16 (`src/reseaux`) ;
 *  - marges, bande des sous-titres, tailles, écart entre éléments, épaisseurs, couleurs : habillage `charte-video/1` ;
 *  - largeurs : mesurées dans les polices réellement DESSINÉES (Montserrat ExtraBold pour les titres, Inter Bold pour
 *    le texte), `src/briques/stylo/mesure-ecriture.ts` ; le rendu écrit sans crénage, la mesure est exacte.
 *
 * Disposition :
 *  - le texte prend toute la largeur du cadre ; ses rangées sont ÉQUILIBRÉES (même nombre de rangées que la coupure
 *    au plus long, écarts de longueur réduits, jamais un petit mot seul en fin ou sur une rangée quand c'est évitable) ;
 *  - un dessin « gauche » ou « droite » se pose à côté du texte de sa scène (la colonne ne perd qu'un quart de la
 *    largeur) OU sur une rangée à lui, de son côté : la mise en page essaie les deux et garde la plus grande échelle ;
 *    « centre » (ou une scène sans texte) : une rangée à lui ;
 *  - les marques du stylo ont leur place RÉSERVÉE (`encombrement`) : l'ellipse ajustée d'« entourer », le trait sous
 *    une ligne soulignée, le débord d'un barré, la case de la coche ; aucun encombrement n'en touche un autre ;
 *  - la bulle de preuve réserve la phrase testée (légende, au-dessus), les lignes de résultat (AVANT sobre et APRÈS mis
 *    en valeur, en deux colonnes pour la structure « avant-apres », empilés sinon), « Testé le JJ/MM » dessous et sa
 *    queue ; rien n'est omis : si quelque chose ne tient pas, la mise en page est refusée en nommant la page.
 *
 * Valeurs supposées [à régler sur la première vidéo] : `ECHELLE_MAX`, tailles des dessins, marge intérieure de la bulle.
 */
import {
  BANDE_SOUS_TITRES_HAUTEUR,
  COULEURS_VIDEO,
  EPAISSEURS_VIDEO,
  MARGES_VIDEO,
  TAILLES_VIDEO,
  TAILLE_PLANCHER_VIDEO,
  tailleVideoPx,
} from "@/briques/habillage/charte-video";
import { APPROCHE_EM, INTERLIGNE } from "@/briques/motion/jetons";
import { encombrementEntourer } from "@/briques/stylo/courbes";
import { largeurEcrite, type PoliceEcriture } from "@/briques/stylo/mesure-ecriture";
import type { ElementTableauPlace } from "@/briques/tableau-scene/trois-styles/types";
import type { IdReseau } from "@/domaine/types";
import { listerReseaux, zoneProtegeeCombinee, type ZoneProtegee } from "@/reseaux";
import { formatSortie, referenceFormat, zoneSureBlocs2, zoneSureFormat, type IdFormatSortie } from "./formats-sortie";
import { mettreEnPageReference } from "./mise-en-page-reference";
import { mettreEnPageClair } from "./mise-en-page-gabarit";
import { mettreEnPageParties } from "./mise-en-page-v3";
import type { DecorGabarit, MiseEnPageReference } from "@/briques/tableau-scene/reference/types";
import { cleMot, estStyleBlocs2, estStyleReference1, estStyleReference2, estStyleReference3, idEcran, idItemEcran, type Cote, type EcranTableau, type ElementTableau, type FicheTableau, type Geste, type Marque, type SceneTableau } from "./fiche";
import { CONTRASTE_GRAND_MIN, ETIQUETTES_PAR_MOMENT, FONDS_ETAPES, FOND_PAR_MOMENT, STYLE_BLOCS_2 as STYLE_V2, TAILLES_V2, type FondV2 } from "@/briques/tableau-scene/v2/charte";
import { ErreurDispositionV2, cleMotV2, disposerEcran } from "@/briques/tableau-scene/v2/disposition";
import { geometrieV2, REGLAGES_GEOMETRIE_V2 } from "@/briques/tableau-scene/v2/geometrie";
import type { DescriptionEcran, EcranPlace, EtapeBarre, GabaritV2, GeometrieV2, MiseEnPageV2, MomentV2, TexteV2, TitreDecrit } from "@/briques/tableau-scene/v2/types";
import type { MiseEnPageControle, NiveauReference } from "./reference";
import { controleBandeSousTitres, controleTailleTexte, controleZoneSure, SEUILS_CONTROLE_IMAGE, type Boite, type MiseEnPage, type SeuilsControleImage, type ZoneSure } from "@/briques/controle-image";

/* ------------------------------------------------------------------ */
/* Dimensions, zones et cadre                                            */
/* ------------------------------------------------------------------ */

export const VERSION_MISE_EN_PAGE = "mise-en-page-tableau/2";

/** Image du tableau animé (9:16, sortie par défaut). */
export const DIMENSIONS_TABLEAU = Object.freeze({ largeur: 1080, hauteur: 1920 });

/**
 * Gabarit du calcul en cours : dimensions de l'image (`W`, `H`) et image de référence des tailles du style (`RW`, `RH`,
 * 1080 × 1920 à l'échelle du petit côté, `referenceFormat`). Les positions et la zone sûre se lisent sur l'image ;
 * tailles de texte, traits, écarts, marges et bande des sous-titres sur la référence. En 9:16, les deux sont égales :
 * la mise en page d'avant, au pixel près. Fixé par `mettreEnPage` le temps d'un calcul (comme `strict`).
 */
interface Gabarit {
  W: number;
  H: number;
  RW: number;
  RH: number;
}
const GABARIT_VERTICAL: Gabarit = Object.freeze({ W: DIMENSIONS_TABLEAU.largeur, H: DIMENSIONS_TABLEAU.hauteur, RW: DIMENSIONS_TABLEAU.largeur, RH: DIMENSIONS_TABLEAU.hauteur });
let g: Gabarit = GABARIT_VERTICAL;

/** Gabarit d'un format de sortie (table `formats-sortie.ts`). */
export function gabaritFormat(id: IdFormatSortie): Gabarit {
  const f = formatSortie(id);
  const r = referenceFormat(id);
  return { W: f.largeur, H: f.hauteur, RW: r.largeur, RH: r.hauteur };
}

/** Pas de l'échelle d'une page (agrandie ou réduite). */
export const PAS_REDUCTION = 0.05;
/** Plafond d'agrandissement d'une page peu chargée [supposé]. */
export const ECHELLE_MAX = 2;
/**
 * Marge laissée libre au bas de la page, au-dessus des sous-titres (le crayon y passe sous la dernière ligne), sauf
 * pour une page qui ne tiendrait pas autrement [supposé].
 */
const margeBasse = () => Math.round(0.03 * g.RH);
/** Largeur d'écriture au plus, en largeurs de référence, pour une image plus large que haute (16:9) [supposé]. */
export const LARGEUR_PAGE_MAX = 1.25;
/** Part minimale de la hauteur utile (du haut de la zone sûre à la bande des sous-titres) occupée par une page finie. */
export const OCCUPATION_MIN = 0.6;

/** Réseaux qui publient du 9:16 (ceux dont le registre connaît une zone protégée pour lui). */
export function reseauxVerticaux(): IdReseau[] {
  return listerReseaux()
    .filter((r) => r.ratios.includes("9:16") && !!r.zonesProtegees["9:16"])
    .map((r) => r.id);
}

/** Zone sûre (pourcentages, comme le registre) : union des réseaux donnés, ou de tous ceux qui publient du 9:16. */
export function zoneSureTableau(reseaux: readonly IdReseau[] = reseauxVerticaux()): ZoneProtegee {
  const z = zoneProtegeeCombinee("9:16", reseaux.length ? [...reseaux] : reseauxVerticaux());
  if (!z) throw new Error("Aucune zone sûre connue pour le 9:16 dans le registre des réseaux.");
  return z;
}

export interface RectPx {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

/** Même rectangle en fractions de l'image (x et largeur sur la largeur, y et hauteur sur la hauteur). */
export interface RectFraction {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

export interface Rect {
  px: RectPx;
  fraction: RectFraction;
}

const arrondi6 = (v: number) => Math.round(v * 1e6) / 1e6;
const enFraction = (r: RectPx): RectFraction => ({ x: arrondi6(r.x / g.W), y: arrondi6(r.y / g.H), largeur: arrondi6(r.largeur / g.W), hauteur: arrondi6(r.hauteur / g.H) });
const rect = (px: RectPx): Rect => ({ px, fraction: enFraction(px) });

/**
 * Cadre où la page s'écrit et bande des sous-titres (px), pour une zone sûre donnée. La zone sûre est déjà une marge :
 * le cadre ne garde, à l'intérieur, qu'un demi-écart entre éléments, et au moins la marge de page de l'habillage depuis
 * le bord de l'IMAGE. En bas, il s'arrête au bord de la bande des sous-titres (la page répartie garde une marge basse).
 */
export function cadres(zone: ZoneProtegee = zoneSureTableau(), gabarit: Gabarit = g): { cadre: RectPx; bande: RectPx; zoneSure: RectPx } {
  const { W, H, RW, RH } = gabarit;
  const marge = Math.round(MARGES_VIDEO.page * RW);
  const garde = Math.round((MARGES_VIDEO.entreLignes * RW) / 2);
  const zx = Math.round((zone.gauche / 100) * W);
  const zy = Math.round((zone.haut / 100) * H);
  const zDroite = Math.round((zone.droite / 100) * W);
  const zBas = Math.round((zone.bas / 100) * H);
  const zoneSure = { x: zx, y: zy, largeur: W - zx - zDroite, hauteur: H - zy - zBas };
  // La bande des sous-titres est prise EN BAS de la zone sûre ; la page s'écrit au-dessus.
  // Image moins haute que sa référence (portrait, carré, horizontal) : la bande garde la même PART de la hauteur ; elle
  // contient toujours plus de deux lignes de sous-titres (une seule est écrite à la fois). En 9:16 : inchangée.
  const bandeH = Math.round(BANDE_SOUS_TITRES_HAUTEUR * RH * Math.min(1, H / RH));
  const bande = { x: zoneSure.x, y: zoneSure.y + zoneSure.hauteur - bandeH, largeur: zoneSure.largeur, hauteur: bandeH };
  const y = Math.max(marge, zy + garde);
  let x = Math.max(marge, zx + garde);
  let droite = Math.min(W - marge, W - zDroite - garde);
  // Image plus large que sa référence (16:9) : les lignes ne s'allongent pas au-delà de `LARGEUR_PAGE_MAX` fois la
  // largeur de référence (lecture d'un coup d'œil, place des marques du stylo) ; la page est centrée. En 9:16 : inchangé.
  const largeurMax = Math.round(LARGEUR_PAGE_MAX * RW);
  if (W > RW && droite - x > largeurMax) {
    const libre = droite - x - largeurMax;
    x += Math.floor(libre / 2);
    droite = x + largeurMax;
  }
  const cadre = { x, y, largeur: droite - x, hauteur: bande.y - y };
  return { cadre, bande, zoneSure };
}

/* ------------------------------------------------------------------ */
/* Niveaux de texte                                                      */
/* ------------------------------------------------------------------ */

/** Niveaux de l'habillage employés par le tableau. */
export type NiveauMise = "titre" | "corps" | "legende";

const POLICE: Record<NiveauMise, PoliceEcriture> = { titre: "titre", corps: "texte", legende: "texte" };
/** Plancher des tailles : 3 % de la hauteur de référence (1 920 px en 9:16). */
const plancherPx = () => Math.ceil(TAILLE_PLANCHER_VIDEO * g.RH);

/** Taille (px) d'un niveau à l'échelle `echelle` (jamais sous le plancher de 3 %). */
export function tailleNiveau(niveau: NiveauMise, echelle: number): number {
  return Math.max(plancherPx(), Math.round(TAILLES_VIDEO[niveau] * g.RH * echelle));
}

/** Largeur (px) d'un texte écrit à un niveau et une taille (police dessinée, approche comprise). */
export function largeurNiveau(texte: string, niveau: NiveauMise, taille: number): number {
  return largeurEcrite(texte, POLICE[niveau], taille, APPROCHE_EM[niveau]);
}

function niveauDe(e: ElementTableau): NiveauMise {
  switch (e.type) {
    case "ligne":
      return e.niveau === "titre" ? "titre" : "corps";
    case "chiffre":
      return "titre";
    case "mention":
      return "legende";
    default:
      return "corps";
  }
}

/**
 * Valeurs de référence, SEULE source des règles 4 et 5 (`regles.ts`) : hauteur de l'image, largeur utile (largeur du
 * cadre de page) et taille prévue par niveau de ligne à l'échelle 1. La mise en page COUPE une ligne trop longue sur
 * plusieurs lignes visuelles : la règle 4 vérifie donc chaque MOT dans cette largeur, puis la mise en page elle-même.
 */
export const REFERENCE_CONTROLE: MiseEnPageControle = Object.freeze({
  hauteurImagePx: DIMENSIONS_TABLEAU.hauteur,
  largeurUtilePx: cadres().cadre.largeur,
  taillePx: Object.freeze({ titre: tailleVideoPx("titre", DIMENSIONS_TABLEAU.hauteur), texte: tailleVideoPx("corps", DIMENSIONS_TABLEAU.hauteur) }),
}) as MiseEnPageControle;

/** Largeur (px) d'un mot d'une ligne écrite, mesuré exactement comme la mise en page le mesure pour couper. */
export function largeurMotLigne(mot: string, taille: number, niveau: NiveauReference): number {
  return largeurNiveau(mot, niveau === "titre" ? "titre" : "corps", taille);
}

/* ------------------------------------------------------------------ */
/* Sortie                                                                */
/* ------------------------------------------------------------------ */

/** Ton d'une ligne de résultat de la bulle : l'AVANT reste sobre, l'APRÈS est mis en valeur. */
export type TonPreuve = "avant" | "apres";

/** Une ligne visuelle (texte coupé), avec son rectangle. */
export interface LigneVisuelle extends Rect {
  texte: string;
  /** Colonne de la bulle avant/après (deux colonnes côte à côte). */
  colonne?: TonPreuve;
  /** Bloc de la bulle auquel la ligne appartient (avant ou après), en colonnes ou empilé. */
  ton?: TonPreuve;
}

/** Bulle de preuve : tout ce qu'elle montre a sa place réservée. */
export interface BullePlacee {
  /** Phrase testée (légende, entre guillemets), au-dessus des résultats. Vide si la phrase n'a pas été donnée. */
  phrase: LigneVisuelle[];
  /** Place réservée à la phrase testée (2 rangées de légende si elle n'a pas été donnée). */
  zonePhrase: Rect;
  /** Nombre de rangées réservées à la phrase. */
  rangeesPhrase: number;
  /** Étiquettes « Avant » / « Après » (légende), au-dessus de leur bloc. */
  etiquettes: LigneVisuelle[];
  /** « Testé le JJ/MM » (texte vide si la date n'a pas été donnée : le rendu l'écrit dans cette place). */
  date: LigneVisuelle;
  /** Taille (px) de la phrase, des étiquettes et de la date. */
  tailleLegende: number;
  /** Trait vertical entre les deux colonnes. */
  separateur?: { x: number; y: number; hauteur: number };
  /** Queue de la bulle, sous le cadre (à gauche). */
  queue: Rect;
  /** Bloc que le geste « entourer » entoure (l'APRÈS, ou les résultats) : place de l'ellipse réservée autour. */
  cercle?: Rect;
}

export interface ElementPlace extends Rect {
  elementId: string;
  sceneId: string;
  /** Style « blocs/2 » : `ecran` (un écran) et `item` (un élément de sa liste) ont aussi leur place et leur heure. */
  type: Exclude<ElementTableau["type"], "geste"> | "ecran" | "item";
  /** Rang d'écriture dans la page (0 = premier). */
  ordre: number;
  /** Texte : niveau, taille (px), couleurs (habillage), lignes coupées. */
  niveau?: NiveauMise;
  taillePx?: number;
  couleurTexte?: string;
  couleurFond?: string;
  lignes: LigneVisuelle[];
  /** Ligne : rôle, marque du stylo et mots importants (soulignés d'orange). Dessin : banque et côté. */
  role?: string;
  marque?: Marque;
  importants?: string[];
  dessinId?: string;
  cote?: Cote;
  /** Bulle de preuve : en deux colonnes (avant | après), et ses parties. */
  deuxColonnes?: boolean;
  bulle?: BullePlacee;
  /** Rectangle occupé par l'élément ET ses marques (ellipse, traits, coche, queue) : jamais touché par un autre. */
  encombrement: Rect;
  /** Style « reference/1 » : le bloc de texte auquel un dessin est rattaché (un dessin par idée). */
  rattache?: string;  /** Style « reference/2 » : ce que le gabarit de page pose autour de l'élément (repère, pastille, filet, étiquette…). */
  gabarit?: DecorGabarit;
  /** Style « reference/2 » : couleur et épaisseur (px) de la marque, quand elles diffèrent du texte (titre souligné). */
  couleurMarque?: string;
  epaisseurMarque?: number;
  /** Trois styles du tableau (16/10/2026) : polices manuscrites, traits avant et après le texte, objets posés. */
  tableau?: ElementTableauPlace;
}

export interface GestePlace {
  elementId: string;
  sceneId: string;
  geste: Geste;
  cibleId: string;
  /** Rectangle visé par le stylo : celui de la cible. */
  cible: Rect;
  /** Case réservée au tracé quand il ne se fait pas SUR la cible (la coche, à droite de la dernière ligne). */
  zone?: Rect;
  ordre: number;
}

export interface PagePlacee {
  page: number;
  /** Facteur appliqué aux tailles (1 = tailles de l'habillage ; plus grand = page agrandie). */
  echelle: number;
  /** Part de la hauteur utile (haut de la zone sûre → bande des sous-titres) occupée par la page finie. */
  occupation: number;
  /**
   * Page à la limite : elle ne tient qu'en ne réservant PAS la place des gestes de la fiche (coche, ellipse, trait) ;
   * leurs tracés peuvent alors toucher un voisin. Absent sinon.
   */
  gestesSerres?: true;
  elements: ElementPlace[];
  gestes: GestePlace[];
}

export interface MiseEnPageTableau {
  version: typeof VERSION_MISE_EN_PAGE;
  /** Format de sortie, absent pour le vertical (sortie par défaut : forme d'avant, au caractère près). */
  format?: IdFormatSortie;
  largeurPx: number;
  hauteurPx: number;
  /** Image de référence des tailles du style (`referenceFormat`) ; absente : celle de l'image (9:16). */
  reference?: { largeur: number; hauteur: number };
  zoneSure: Rect;
  bandeSousTitres: Rect;
  cadre: Rect;
  pages: PagePlacee[];
  /**
   * Style « blocs/2 » (fiche `habillage: "blocs/2"`) : géométrie, écrans posés et étapes de la vidéo. Les `pages`
   * portent alors la place de chaque élément dans son écran (contrôles inchangés). Absent : style d'avant.
   */
  styleV2?: MiseEnPageV2;
  /**
   * Style « reference/1 » (fiche `habillage: "reference/1"`) : la page blanche écrite au crayon (signature, blocs
   * ajoutés par la fin, textes écrits une fois). Les `pages` portent chaque bloc et chaque dessin. Absent : un autre style.
   */
  styleReference?: MiseEnPageReference;
}

export type { MiseEnPageV2 } from "@/briques/tableau-scene/v2/types";

export class ErreurMiseEnPage extends Error {
  constructor(
    message: string,
    readonly page: number,
  ) {
    super(message);
    this.name = "ErreurMiseEnPage";
  }
}

/** Phrase testée et date du test d'une bulle de preuve (matière « demonstration » ou `Preuve`). */
export interface ContenuPreuve {
  phrase: string;
  /** AAAA-MM-JJ. */
  testeLe: string;
}

export interface OptionsMiseEnPage {
  /**
   * Format de sortie (`formats-sortie.ts`) : dimensions, zone sûre et référence des tailles. Absent ou « vertical » :
   * 1080 × 1920 et la zone sûre des réseaux du 9:16 (`reseaux`), comme avant.
   */
  format?: IdFormatSortie;
  /** Réseaux visés (zone sûre = leur union) ; par défaut tous ceux qui publient du 9:16. Ignoré hors du vertical. */
  reseaux?: readonly IdReseau[];
  /** Phrase testée et date, par élément « preuve » : la phrase est coupée et sa place exacte réservée. */
  preuves?: Readonly<Record<string, ContenuPreuve>>;
  /**
   * Style « blocs/2 » : l'écran d'appel de la dernière scène suit la fin retenue pour la sortie. `mot` : « Écrivez MOT
   * en commentaire » avec le mot saisi à la création (il se tape dans la bulle) ; `diagnostic` : l'écran « Appel de
   * diagnostic ». Absent : l'écran décrit par la fiche (comportement d'avant). Ignoré par le style `charte-video/1`.
   */
  appel?: AppelFinV2;
}

/**
 * Écran d'appel imposé par la fin retenue (style « blocs/2 »). `site` : fin sans promesse d'envoi (TikTok, Shorts),
 * `axion-ia.com` en grand, sous la phrase de la fin (`phrase`) s'il y en a une ; aucune autre ligne.
 */
export type AppelFinV2 = { mot: string } | { diagnostic: true } | { site: true; phrase?: string };

/** « 2026-10-09 » → « Testé le 09/10 ». */
export function dateTest(testeLe: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(testeLe);
  return m ? `Testé le ${m[3]}/${m[2]}` : `Testé le ${testeLe}`;
}

/* ------------------------------------------------------------------ */
/* Coupure des lignes                                                    */
/* ------------------------------------------------------------------ */

interface Bloc {
  taille: number;
  interligne: number;
  hauteur: number;
  lignes: { texte: string; largeur: number }[];
}

/** Mots du texte ; un signe isolé reste avec son mot : « ? », « : », « » » avec le précédent, « « » avec le suivant. */
function unites(texte: string): string[] {
  const res: string[] = [];
  let ouvrant = "";
  for (const m of texte.split(/\s+/).filter(Boolean)) {
    if (/^[«“(]$/u.test(m)) ouvrant += `${m} `;
    else if (res.length && !ouvrant && !/[\p{L}\p{N}]/u.test(m)) res[res.length - 1] += ` ${m}`;
    else {
      res.push(ouvrant + m);
      ouvrant = "";
    }
  }
  if (ouvrant) res.push(ouvrant.trim());
  return res;
}

/**
 * Règle des rangées pleines (deux mots par rangée en moyenne) : appliquée d'abord ; levée seulement pour une page qui,
 * sans elle, n'occuperait pas `OCCUPATION_MIN` de la hauteur utile. Fixée par `mettreEnPage` le temps d'un calcul.
 */
let strict = true;

/** Petit mot qu'on ne laisse pas en fin de rangée ni seul sur une rangée (« à », « la », « de », « un »…). */
const petit = (u: string) => /^[\p{L}']{1,3}$/u.test(u) && !/^\p{Lu}/u.test(u);

/**
 * Coupe un texte en rangées ÉQUILIBRÉES dans `largeurMax` : le moins de rangées possible, puis les rangées les plus
 * égales (somme des carrés des vides), un petit mot jamais en fin de rangée ni seul quand c'est évitable.
 * `null` si un mot ne tient pas.
 */
function couper(texte: string, niveau: NiveauMise, taille: number, largeurMax: number, libre = !strict): Bloc | null {
  const u = unites(texte);
  if (!u.length) return null;
  const l = u.map((m) => largeurNiveau(m, niveau, taille));
  if (l.some((x) => x > largeurMax)) return null;
  const esp = largeurNiveau(" ", niveau, taille);
  const larg = (i: number, j: number) => l.slice(i, j).reduce((s, x) => s + x, 0) + (j - i - 1) * esp;
  // Nombre minimal de rangées (coupure au plus long).
  let n0 = 1;
  for (let i = 0, w = 0; i < u.length; i++) {
    if (w > 0 && w + esp + l[i] > largeurMax) {
      n0++;
      w = l[i];
    } else w += (w > 0 ? esp : 0) + l[i];
  }
  // Jamais plus de rangées que la moitié des mots (deux mots par rangée en moyenne) : sinon, plus petit.
  const n = u.length;
  if (!libre && n0 > Math.max(1, Math.ceil(n / 2))) return null;
  // Rangées équilibrées : programmation dynamique sur n0 rangées.
  const cout = (i: number, j: number, derniere: boolean) => {
    const w = larg(i, j);
    if (w > largeurMax) return Infinity;
    let c = ((largeurMax - w) / largeurMax) ** 2;
    if (!derniere && petit(u[j - 1])) c += 0.3;
    if (n0 > 1 && j - i === 1 && petit(u[i])) c += 0.6;
    return c;
  };
  const meilleur: number[][] = Array.from({ length: n0 + 1 }, () => Array(n + 1).fill(Infinity));
  const coupe: number[][] = Array.from({ length: n0 + 1 }, () => Array(n + 1).fill(-1));
  meilleur[0][0] = 0;
  for (let k = 1; k <= n0; k++)
    for (let j = k; j <= n; j++)
      for (let i = k - 1; i < j; i++) {
        const c = meilleur[k - 1][i] + cout(i, j, k === n0);
        if (c < meilleur[k][j] - 1e-12) {
          meilleur[k][j] = c;
          coupe[k][j] = i;
        }
      }
  const bornes: [number, number][] = [];
  for (let k = n0, j = n; k > 0; k--) {
    const i = coupe[k][j];
    bornes.unshift([i, j]);
    j = i;
  }
  const lignes = bornes.map(([i, j]) => ({ texte: u.slice(i, j).join(" "), largeur: Math.ceil(larg(i, j)) }));
  const interligne = Math.ceil(taille * INTERLIGNE[niveau]);
  return { taille, interligne, hauteur: interligne * lignes.length, lignes };
}

const texteElement = (e: ElementTableau): string =>
  e.type === "ligne" || e.type === "mention" ? e.texte : e.type === "chiffre" ? (e.unite ? `${e.valeur} ${e.unite}` : e.valeur) : "";

/* ------------------------------------------------------------------ */
/* Géométrie des marques du stylo (mêmes chemins que `src/briques/stylo/courbes.ts`) */
/* ------------------------------------------------------------------ */

const epaisseurSouligne = () => Math.max(2, Math.round(EPAISSEURS_VIDEO.soulignement * g.RW));
const epaisseurMarque = () => Math.max(2, Math.round(EPAISSEURS_VIDEO.marque * g.RW));

const union = (rs: RectPx[]): RectPx => {
  const x = Math.floor(Math.min(...rs.map((r) => r.x)));
  const y = Math.floor(Math.min(...rs.map((r) => r.y)));
  const x2 = Math.ceil(Math.max(...rs.map((r) => r.x + r.largeur)));
  const y2 = Math.ceil(Math.max(...rs.map((r) => r.y + r.hauteur)));
  return { x, y, largeur: x2 - x, hauteur: y2 - y };
};
/** Trait sous une cible (souligner : à 104 % de sa hauteur). */
const traitSous = (c: RectPx): RectPx => {
  const e = epaisseurSouligne();
  return { x: c.x - e / 2, y: c.y + c.hauteur * 1.04 - e / 2, largeur: c.largeur + e, hauteur: e };
};
/** Trait barré (déborde de 3 % de chaque côté). */
const traitBarre = (c: RectPx): RectPx => {
  const e = epaisseurMarque();
  return { x: c.x - c.largeur * 0.03 - e / 2, y: c.y + c.hauteur * 0.48 - e / 2, largeur: c.largeur * 1.06 + e, hauteur: c.hauteur * 0.04 + e };
};
const ellipse = (c: RectPx): RectPx => encombrementEntourer(c, epaisseurMarque() / 2);

/** Marques posées sur un élément : la sienne et celles des gestes qui le visent. */
interface Marques {
  souligne: boolean;
  barre: boolean;
  entoure: boolean;
  /** Geste « entourer » sur une bulle de preuve : il entoure son bloc APRÈS, dedans. */
  entoureInterne: boolean;
  coche: boolean;
}

/* ------------------------------------------------------------------ */
/* Pose d'un élément (origine : coin haut gauche de sa colonne)          */
/* ------------------------------------------------------------------ */

interface Pose {
  el: Omit<ElementPlace, "ordre" | "fraction" | "encombrement" | "lignes" | "bulle" | "px"> & { px: RectPx; lignes: { texte: string; px: RectPx; colonne?: TonPreuve; ton?: TonPreuve }[]; bulle?: BulleBrute };
  /** Encombrement (élément + marques). */
  enc: RectPx;
  zoneCoche?: RectPx;
}

interface BulleBrute {
  phrase: { texte: string; px: RectPx }[];
  zonePhrase: RectPx;
  rangeesPhrase: number;
  etiquettes: { texte: string; px: RectPx; colonne?: TonPreuve; ton: TonPreuve }[];
  date: { texte: string; px: RectPx };
  tailleLegende: number;
  separateur?: { x: number; y: number; hauteur: number };
  queue: RectPx;
  cercle?: RectPx;
}

/** Encombrement d'une pose : l'élément, ses marques, la case de la coche. */
function encombrementDe(px: RectPx, lignes: { px: RectPx }[], m: Marques, extra: RectPx[], texte: boolean): { enc: RectPx; zoneCoche?: RectPx } {
  const rs: RectPx[] = [px, ...extra];
  const bases = texte && lignes.length ? lignes.map((l) => l.px) : [px];
  if (m.souligne) rs.push(...bases.map(traitSous));
  if (m.barre) rs.push(...bases.map(traitBarre));
  if (m.entoure) rs.push(ellipse(px));
  let zoneCoche: RectPx | undefined;
  if (m.coche) {
    const der = bases[bases.length - 1];
    const q = Math.round(Math.min(der.hauteur, 140) * 0.9);
    zoneCoche = { x: der.x + der.largeur + Math.round(q * 0.4), y: der.y + Math.round((der.hauteur - q) / 2), largeur: q, hauteur: q };
    rs.push({ x: zoneCoche.x - epaisseurMarque(), y: zoneCoche.y - epaisseurMarque(), largeur: q + 2 * epaisseurMarque(), hauteur: q + 2 * epaisseurMarque() });
  }
  return { enc: union(rs), zoneCoche };
}

/**
 * Pose un élément de texte (ligne, chiffre, mention) dans une colonne de largeur `largeurCol` : la largeur de coupure
 * est réduite jusqu'à ce que l'élément ET ses marques tiennent dans la colonne. `null` si c'est impossible.
 */
function poserTexte(e: Extract<ElementTableau, { type: "ligne" | "chiffre" | "mention" }>, echelle: number, largeurCol: number, m: Marques, sceneId: string): Pose | null {
  const niveau = niveauDe(e);
  const taille = tailleNiveau(niveau, echelle);
  let gauche = 0;
  let droite = 0;
  for (let essai = 0; essai < 8; essai++) {
    const b = couper(texteElement(e), niveau, taille, largeurCol - gauche - droite);
    if (!b) return null;
    const lignes = b.lignes.map((l, i) => ({ texte: l.texte, px: { x: gauche, y: i * b.interligne, largeur: l.largeur, hauteur: b.interligne } }));
    const px = { x: gauche, y: 0, largeur: Math.max(...b.lignes.map((l) => l.largeur)), hauteur: b.hauteur };
    const { enc, zoneCoche } = encombrementDe(px, lignes, m, [], true);
    const dg = -enc.x;
    const dd = enc.x + enc.largeur - largeurCol;
    if (dg <= 0 && dd <= 0) {
      const el: Pose["el"] = {
        elementId: e.id,
        sceneId,
        type: e.type,
        niveau,
        taillePx: taille,
        couleurTexte: COULEURS_VIDEO.ecriture,
        couleurFond: COULEURS_VIDEO.page,
        lignes,
        px,
        ...(e.type === "ligne" ? { role: e.role, ...(e.marque ? { marque: e.marque } : {}), ...(e.importants ? { importants: [...e.importants] } : {}) } : {}),
      };
      return { el, enc, zoneCoche };
    }
    gauche += Math.max(0, dg);
    droite += Math.max(0, dd);
  }
  return null;
}

/** Sépare « Avant : une heure » en étiquette (« Avant ») et contenu ; `null` sans étiquette avant/après. */
function etiquetteDe(ligne: string): { ton: TonPreuve; contenu: string } | null {
  const m = /^\s*(avant|après|apres)\s*:\s*(.+)$/iu.exec(ligne);
  if (!m) return null;
  return { ton: m[1].toLowerCase() === "avant" ? "avant" : "apres", contenu: m[2].trim() };
}

const NOM_TON: Record<TonPreuve, string> = { avant: "Avant", apres: "Après" };
/** Rangées au plus pour la phrase testée. */
const RANGEES_PHRASE_MAX = 3;

/**
 * Pose une bulle de preuve dans une colonne : cadre de toute la largeur disponible ; dedans, la phrase testée (légende,
 * en haut), les résultats (étiquette AVANT ou APRÈS à gauche de chaque bloc, ou au-dessus de chaque colonne), la date ;
 * dessous, la queue. Un geste « entourer » qui vise la bulle entoure le bloc APRÈS (ou les résultats) : sa place est
 * réservée DANS la bulle. `null` si une partie ne tient pas.
 */
function poserBulle(e: Extract<ElementTableau, { type: "preuve" }>, deux: boolean, echelle: number, largeurCol: number, m: Marques, sceneId: string, contenu: ContenuPreuve | undefined): Pose | null {
  const tCorps = tailleNiveau("corps", echelle);
  const tLeg = tailleNiveau("legende", echelle);
  const ilLeg = Math.ceil(tLeg * INTERLIGNE.legende);
  const ilCorps = Math.ceil(tCorps * INTERLIGNE.corps);
  const pad = Math.round(0.36 * tCorps);
  const espace = Math.round(pad * 0.5);
  const queueH = Math.round(pad * 0.9);
  const parts = e.lignes.map((l, i) => {
    const et = etiquetteDe(l);
    const ton: TonPreuve | undefined = et?.ton ?? (deux ? (i === 0 ? "avant" : "apres") : undefined);
    return { ton, contenu: et ? et.contenu : l };
  });
  // Bloc entouré par un geste « entourer » : l'APRÈS, sinon tous les résultats.
  const entoure = (i: number) => m.entoureInterne && (parts.some((p) => p.ton === "apres") ? parts[i].ton === "apres" : true);
  let gauche = 0;
  let droite = 0;
  // Écarts ajoutés autour du bloc entouré (horizontal de chaque côté, vertical dessus et dessous).
  const ov = { x: 0, y: 0 };
  for (let essai = 0; essai < 12; essai++) {
    const largeur = largeurCol - gauche - droite;
    const interieur = largeur - 2 * pad;
    if (interieur <= 0) return null;
    const x0 = gauche + pad;
    let y = pad;
    // Phrase testée.
    let phrase: { texte: string; px: RectPx }[] = [];
    let rangeesPhrase = 2;
    if (contenu) {
      const b = couper(`« ${contenu.phrase} »`, "legende", tLeg, interieur, true);
      if (!b || b.lignes.length > RANGEES_PHRASE_MAX) return null;
      rangeesPhrase = b.lignes.length;
      phrase = b.lignes.map((l, i) => ({ texte: l.texte, px: { x: x0, y: y + i * ilLeg, largeur: l.largeur, hauteur: ilLeg } }));
    }
    const zonePhrase = { x: x0, y, largeur: interieur, hauteur: rangeesPhrase * ilLeg };
    y += rangeesPhrase * ilLeg + espace;
    // Résultats.
    const lignes: Pose["el"]["lignes"] = [];
    const etiquettes: BulleBrute["etiquettes"] = [];
    const cercle: RectPx[] = [];
    let separateur: BulleBrute["separateur"];
    const etiquette = (ton: TonPreuve, x: number, yy: number, colonne?: TonPreuve) => {
      const w = Math.ceil(largeurNiveau(NOM_TON[ton], "legende", tLeg));
      etiquettes.push({ texte: NOM_TON[ton], px: { x, y: yy, largeur: w, hauteur: ilLeg }, ton, ...(colonne ? { colonne } : {}) });
      return w;
    };
    if (deux) {
      const ecartCol = 2 * pad;
      const cw = Math.floor((interieur - ecartCol) / 2);
      let hMax = 0;
      for (const [i, p] of parts.entries()) {
        const col: TonPreuve = i === 0 ? "avant" : "apres";
        const x = x0 + i * (cw + ecartCol);
        if (etiquette(p.ton ?? col, x, y, col) > cw) return null;
        const yc = y + ilLeg + Math.round(espace / 2) + ov.y;
        const dx = entoure(i) ? ov.x : 0;
        const b = couper(p.contenu, "corps", tCorps, cw - 2 * dx, true);
        if (!b) return null;
        b.lignes.forEach((l, k) => {
          const px = { x: x + dx, y: yc + k * b.interligne, largeur: l.largeur, hauteur: b.interligne };
          lignes.push({ texte: l.texte, px, colonne: col, ton: p.ton ?? col });
          if (entoure(i)) cercle.push(px);
        });
        hMax = Math.max(hMax, yc - y + b.hauteur + ov.y);
      }
      separateur = { x: x0 + cw + pad, y, hauteur: hMax };
      y += hMax;
    } else {
      const avecEtiquettes = parts.some((p) => p.ton);
      const largEt = avecEtiquettes ? Math.max(...parts.filter((p) => p.ton).map((p) => Math.ceil(largeurNiveau(NOM_TON[p.ton!], "legende", tLeg)))) : 0;
      // Le contenu s'aligne après l'étiquette la plus large ; le bloc entouré est décalé de la place de son ellipse.
      const xc = x0 + (avecEtiquettes ? largEt + pad : 0);
      for (const [i, p] of parts.entries()) {
        if (i > 0) y += Math.round(espace / 2);
        const dy = entoure(i) ? ov.y : 0;
        y += dy;
        const dx = entoure(i) ? ov.x : 0;
        const b = couper(p.contenu, "corps", tCorps, x0 + interieur - xc - 2 * dx, true);
        if (!b) return null;
        const decalage = Math.max(0, Math.round((ilLeg - ilCorps) / 2));
        if (p.ton) etiquette(p.ton, x0, y + Math.max(0, Math.round((ilCorps - ilLeg) / 2)));
        b.lignes.forEach((l, k) => {
          const px = { x: xc + dx, y: y + decalage + k * b.interligne, largeur: l.largeur, hauteur: b.interligne };
          lignes.push({ texte: l.texte, px, ...(p.ton ? { ton: p.ton } : {}) });
          if (entoure(i)) cercle.push(px);
        });
        y += Math.max(b.hauteur + decalage, p.ton ? ilLeg : 0) + dy;
      }
    }
    y += espace;
    // Date.
    const dateTexte = contenu ? dateTest(contenu.testeLe) : "";
    const dateLarg = Math.ceil(largeurNiveau(contenu ? dateTexte : "Testé le 00/00", "legende", tLeg));
    if (dateLarg > interieur) return null;
    const date = { texte: dateTexte, px: { x: x0, y, largeur: dateLarg, hauteur: ilLeg } };
    y += ilLeg + pad;
    const px = { x: gauche, y: 0, largeur, hauteur: y };
    const queue = { x: gauche + 2 * pad, y: y - 1, largeur: Math.round(queueH * 1.4), hauteur: queueH + 1 };
    // Place du cercle intérieur : l'ellipse ne touche ni les autres textes de la bulle, ni son cadre, ni le séparateur.
    if (cercle.length) {
      const bloc = union(cercle);
      const enc = ellipse(bloc);
      const autres = [...phrase.map((l) => l.px), ...etiquettes.map((l) => l.px), ...lignes.filter((l) => !cercle.includes(l.px)).map((l) => l.px), date.px];
      if (separateur) autres.push({ x: separateur.x - epaisseurMarque() / 2, y: separateur.y, largeur: epaisseurMarque(), hauteur: separateur.hauteur });
      let besoinX = Math.max(gauche + epaisseurMarque() - enc.x, enc.x + enc.largeur - (gauche + largeur - epaisseurMarque()), 0);
      let besoinY = Math.max(0, enc.y + enc.hauteur + epaisseurMarque() - (y - pad));
      for (const r of autres) {
        if (!(Math.min(r.x + r.largeur, enc.x + enc.largeur) > Math.max(r.x, enc.x) && Math.min(r.y + r.hauteur, enc.y + enc.hauteur) > Math.max(r.y, enc.y))) continue;
        if (r.y + r.hauteur <= bloc.y) besoinY = Math.max(besoinY, r.y + r.hauteur + epaisseurMarque() - enc.y);
        else if (r.y >= bloc.y + bloc.hauteur) besoinY = Math.max(besoinY, enc.y + enc.hauteur + epaisseurMarque() - r.y);
        else besoinX = Math.max(besoinX, Math.min(r.x + r.largeur, enc.x + enc.largeur) - Math.max(r.x, enc.x) + epaisseurMarque());
      }
      if (besoinX > 0 || besoinY > 0) {
        ov.x += Math.ceil(besoinX);
        ov.y += Math.ceil(besoinY);
        continue;
      }
    }
    const { enc, zoneCoche } = encombrementDe(px, [], m, [queue], false);
    const dg = -enc.x;
    const dd = enc.x + enc.largeur - largeurCol;
    if (dg <= 0 && dd <= 0) {
      const el: Pose["el"] = {
        elementId: e.id,
        sceneId,
        type: "preuve",
        niveau: "corps",
        taillePx: tCorps,
        couleurTexte: COULEURS_VIDEO.ecriture,
        couleurFond: COULEURS_VIDEO.page,
        lignes,
        deuxColonnes: deux,
        px,
        bulle: { phrase, zonePhrase, rangeesPhrase, etiquettes, date, tailleLegende: tLeg, ...(separateur ? { separateur } : {}), queue, ...(cercle.length ? { cercle: union(cercle) } : {}) },
      };
      return { el, enc, zoneCoche };
    }
    gauche += Math.max(0, dg);
    droite += Math.max(0, dd);
  }
  return null;
}

/**
 * Bulle de preuve : structure « avant-apres » à 2 lignes → deux colonnes côte à côte, sauf si une colonne passe
 * deux rangées ou si elles sont nettement plus hautes que les deux blocs empilés (lignes longues) ; sinon, empilés.
 */
function poserPreuve(fiche: FicheTableau, e: Extract<ElementTableau, { type: "preuve" }>, echelle: number, largeurCol: number, m: Marques, sceneId: string, contenu: ContenuPreuve | undefined): Pose | null {
  const empilee = poserBulle(e, false, echelle, largeurCol, m, sceneId, contenu);
  if (fiche.structure !== "avant-apres" || e.lignes.length !== 2) return empilee;
  const colonnes = poserBulle(e, true, echelle, largeurCol, m, sceneId, contenu);
  if (!colonnes || !empilee) return colonnes ?? empilee;
  const rangeesMax = Math.max(...(["avant", "apres"] as const).map((c) => colonnes.el.lignes.filter((l) => l.colonne === c).length));
  return rangeesMax <= 2 && colonnes.enc.hauteur <= empilee.enc.hauteur * 1.2 ? colonnes : empilee;
}

/** Pose un dessin carré de côté `cote`. */
function poserDessin(e: Extract<ElementTableau, { type: "dessin" }>, cote: number, m: Marques, sceneId: string): Pose {
  const px = { x: 0, y: 0, largeur: cote, hauteur: cote };
  const { enc, zoneCoche } = encombrementDe(px, [], m, [], false);
  return { el: { elementId: e.id, sceneId, type: "dessin", dessinId: e.dessinId, cote: e.cote, lignes: [], px }, enc, zoneCoche };
}

/** Déplace une pose (et tout ce qu'elle contient). */
function deplacer(p: Pose, dx: number, dy: number): Pose {
  const d = (r: RectPx): RectPx => ({ x: r.x + dx, y: r.y + dy, largeur: r.largeur, hauteur: r.hauteur });
  const dl = <T extends { px: RectPx }>(l: T): T => ({ ...l, px: d(l.px) });
  const b = p.el.bulle;
  return {
    el: {
      ...p.el,
      px: d(p.el.px),
      lignes: p.el.lignes.map(dl),
      ...(b
        ? {
            bulle: {
              ...b,
              phrase: b.phrase.map(dl),
              zonePhrase: d(b.zonePhrase),
              etiquettes: b.etiquettes.map(dl),
              date: dl(b.date),
              queue: d(b.queue),
              ...(b.cercle ? { cercle: d(b.cercle) } : {}),
              ...(b.separateur ? { separateur: { x: b.separateur.x + dx, y: b.separateur.y + dy, hauteur: b.separateur.hauteur } } : {}),
            },
          }
        : {}),
    },
    enc: d(p.enc),
    ...(p.zoneCoche ? { zoneCoche: d(p.zoneCoche) } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* Pose d'une page                                                       */
/* ------------------------------------------------------------------ */

const ancreDe = (e: ElementTableau) => ("ancre" in e ? e.ancre : 0);

/** Éléments d'une scène dans l'ordre d'écriture (ancre, puis rang dans la fiche). */
function ordreEcriture(s: SceneTableau): ElementTableau[] {
  return s.elements
    .map((e, i) => ({ e, i }))
    .sort((a, b) => ancreDe(a.e) - ancreDe(b.e) || a.i - b.i)
    .map((x) => x.e);
}

/** Une scène posée : ses poses (dans l'ordre d'écriture), à partir de y = 0, et sa hauteur. */
interface ScenePosee {
  poses: Pose[];
  hauteur: number;
}

type Disposition = "cote" | "rangee";

/** Scènes qui ont du texte ET un dessin à gauche ou à droite : celles où la disposition se choisit. */
const aChoix = (s: SceneTableau) => s.elements.some((e) => e.type !== "dessin" && e.type !== "geste") && s.elements.some((e) => e.type === "dessin" && e.cote !== "centre");

function poserScene(fiche: FicheTableau, s: SceneTableau, cadre: RectPx, echelle: number, disposition: Disposition, marques: Map<string, Marques>, preuves: OptionsMiseEnPage["preuves"], figes?: Record<"gauche" | "droite", number>): ScenePosee | null {
  const ecart = Math.round(MARGES_VIDEO.entreLignes * g.RW * echelle);
  const tTitre = tailleNiveau("titre", echelle);
  const tCorps = tailleNiveau("corps", echelle);
  const suite = ordreEcriture(s).filter((e) => e.type !== "geste");
  const aTexte = suite.some((e) => e.type !== "dessin");
  const lateraux = suite.filter((e): e is Extract<ElementTableau, { type: "dessin" }> => e.type === "dessin" && e.cote !== "centre" && aTexte && disposition === "cote");
  const gauche = lateraux.some((d) => d.cote === "gauche");
  const droite = lateraux.some((d) => d.cote === "droite");
  // Dessin à côté : au plus un quart de la largeur ; sur une rangée : 40 %.
  const coteMax = Math.min(Math.round(cadre.largeur * 0.25), Math.round(2.2 * tTitre));
  const coteRangee = Math.min(Math.round(cadre.largeur * 0.4), Math.round(2.6 * tTitre));
  // Place réservée de chaque côté : le plus grand dessin possible, puis (second passage) la taille retenue.
  const reserve = figes ?? { gauche: coteMax, droite: coteMax };
  const x0 = gauche ? reserve.gauche + ecart : 0;
  const colonne = cadre.largeur - x0 - (droite ? reserve.droite + ecart : 0);
  const m = (id: string): Marques => marques.get(id) ?? { souligne: false, barre: false, entoure: false, entoureInterne: false, coche: false };

  const poses: Pose[] = [];
  const textes: Pose[] = [];
  let y = 0;
  let basTexte = 0;
  for (const e of suite) {
    if (e.type === "dessin") {
      if (lateraux.includes(e)) {
        poses.push(poserDessin(e, coteMax, m(e.id), s.id)); // placé plus bas, à côté du texte
        continue;
      }
      const p = poserDessin(e, coteRangee, m(e.id), s.id);
      const x = e.cote === "gauche" ? 0 : e.cote === "droite" ? cadre.largeur - coteRangee : Math.floor((cadre.largeur - coteRangee) / 2);
      const placee = deplacer(p, x, y - p.enc.y);
      if (placee.enc.x < 0 || placee.enc.x + placee.enc.largeur > cadre.largeur) return null;
      poses.push(placee);
      y = placee.enc.y + placee.enc.hauteur + ecart;
      continue;
    }
    const p = e.type === "preuve" ? poserPreuve(fiche, e, echelle, colonne, m(e.id), s.id, preuves?.[e.id]) : poserTexte(e, echelle, colonne, m(e.id), s.id);
    if (!p) return null;
    const placee = deplacer(p, x0, y - p.enc.y);
    poses.push(placee);
    textes.push(placee);
    y = placee.enc.y + placee.enc.hauteur + ecart;
    basTexte = y - ecart;
  }

  // Dessins à côté du texte : empilés de leur côté, centrés sur le bloc de texte (jamais plus haut que le texte écrit
  // avant eux), ajustés à sa hauteur (un peu plus grands) entre 1,8 taille de texte et le quart de la largeur.
  let hauteur = Math.max(0, y - ecart);
  const retenus = { gauche: 0, droite: 0 };
  for (const c of ["gauche", "droite"] as const) {
    const ici = lateraux.filter((d) => d.cote === c);
    if (!ici.length || !textes.length) continue;
    const hautTexte = Math.min(...textes.map((t) => t.enc.y));
    const hTexte = basTexte - hautTexte;
    const cote = figes ? figes[c] : Math.max(Math.min(coteMax, Math.round(1.8 * tCorps)), Math.min(coteMax, Math.floor((1.15 * hTexte - (ici.length - 1) * ecart) / ici.length)));
    retenus[c] = cote;
    const pile = ici.length * cote + (ici.length - 1) * ecart;
    let yd = hautTexte + Math.max(0, Math.floor((hTexte - pile) / 2));
    for (const d of ici) {
      const k = poses.findIndex((p) => p.el.elementId === d.id);
      // Jamais au-dessus du texte écrit avant lui dans la scène.
      const avant = poses.slice(0, k).filter((p) => p.el.type !== "dessin");
      const plancher = avant.length ? avant[avant.length - 1].el.px.y : hautTexte;
      const yy = Math.max(yd, plancher);
      const x = c === "gauche" ? 0 : cadre.largeur - cote;
      poses[k] = deplacer(poserDessin(d, cote, m(d.id), s.id), x, yy);
      yd = yy + cote + ecart;
      hauteur = Math.max(hauteur, yy + cote);
    }
  }
  // Dessin plus petit que la place réservée : second passage, la colonne de texte reprend la place libérée.
  if (!figes && ((gauche && retenus.gauche < coteMax) || (droite && retenus.droite < coteMax))) {
    const serre = poserScene(fiche, s, cadre, echelle, disposition, marques, preuves, { gauche: retenus.gauche || coteMax, droite: retenus.droite || coteMax });
    if (serre) return serre;
  }
  return { poses, hauteur };
}

/** Marques de chaque élément de la page : la sienne et celles des gestes de la fiche qui le visent. */
function marquesDe(scenes: SceneTableau[], avecGestes = true): Map<string, Marques> {
  const res = new Map<string, Marques>();
  const de = (id: string) => {
    if (!res.has(id)) res.set(id, { souligne: false, barre: false, entoure: false, entoureInterne: false, coche: false });
    return res.get(id)!;
  };
  const preuves = new Set(scenes.flatMap((s) => s.elements).filter((e) => e.type === "preuve").map((e) => e.id));
  for (const s of scenes)
    for (const e of s.elements) {
      if (e.type === "ligne") {
        if (e.marque === "souligne" || e.importants?.length) de(e.id).souligne = true;
        if (e.marque === "barre") de(e.id).barre = true;
        if (e.marque === "entoure") de(e.id).entoure = true;
      }
      if (e.type === "geste" && avecGestes) {
        const m = de(e.cibleId);
        if (e.geste === "souligner") m.souligne = true;
        if (e.geste === "barrer") m.barre = true;
        if (e.geste === "entourer") {
          if (preuves.has(e.cibleId)) m.entoureInterne = true;
          else m.entoure = true;
        }
        if (e.geste === "cocher") m.coche = true;
      }
    }
  return res;
}

interface PageBrute {
  margeBasse: number;
  echelle: number;
  hauteur: number;
  scenes: ScenePosee[];
  rangees: number;
}

/** Pose une page à une échelle, pour une disposition par scène ; `null` si elle ne tient pas dans le cadre. */
function poserPage(fiche: FicheTableau, scenes: SceneTableau[], cadre: RectPx, echelle: number, dispositions: Disposition[], marques: Map<string, Marques>, preuves: OptionsMiseEnPage["preuves"], margeBasse: number): PageBrute | null {
  const ecartScene = Math.round(MARGES_VIDEO.entreLignes * g.RW * echelle * 1.4);
  const posees: ScenePosee[] = [];
  let hauteur = 0;
  for (const [i, s] of scenes.entries()) {
    const p = poserScene(fiche, s, cadre, echelle, dispositions[i], marques, preuves);
    if (!p) return null;
    posees.push(p);
    hauteur += (i ? ecartScene : 0) + p.hauteur;
  }
  if (hauteur > cadre.hauteur - margeBasse) return null;
  return { echelle, hauteur, scenes: posees, rangees: dispositions.filter((d) => d === "rangee").length, margeBasse };
}

/** Échelles essayées, de la plus grande à la plus petite (pas de 5 %), jusqu'au plancher du titre. */
function echelles(): number[] {
  const min = plancherPx() / (TAILLES_VIDEO.titre * g.RH);
  const res: number[] = [];
  for (let k = 0; ; k++) {
    const e = Math.round((ECHELLE_MAX - k * PAS_REDUCTION) * 100) / 100;
    if (e < min - PAS_REDUCTION) break;
    res.push(e);
  }
  return res;
}

/**
 * Met en page une fiche valide du tableau animé. Lève `ErreurMiseEnPage` (message qui nomme la page) si une page ne
 * tient pas, même réduite jusqu'à la taille plancher, ou si un mot important n'est pas dans sa ligne.
 */
export function mettreEnPage(fiche: FicheTableau, options: OptionsMiseEnPage = {}): MiseEnPageTableau {
  if (estStyleBlocs2(fiche)) return mettreEnPageV2(fiche, options);
  if (estStyleReference1(fiche)) return mettreEnPageReference(fiche, options);
  if (estStyleReference2(fiche)) return mettreEnPageClair(fiche, options);
  if (estStyleReference3(fiche)) return partiesEnMemoire(fiche, options);
  const autre = options.format && options.format !== "vertical" ? options.format : null;
  const avant = g;
  g = autre ? gabaritFormat(autre) : GABARIT_VERTICAL;
  try {
    const mise = mettreEnPageGabarit(fiche, options, autre ? zoneSureFormat(autre) : zoneSureTableau(options.reseaux));
    return autre ? { ...mise, format: autre, reference: { largeur: g.RW, hauteur: g.RH } } : mise;
  } finally {
    g = avant;
  }
}

/**
 * « reference/3 » : la même fiche est mise en page plusieurs fois par relecture et par fabrication (réparation des
 * pages, règle 4, contrôles de chaque sortie) ; la mise en page est PURE, la dernière centaine est gardée (clé : la
 * fiche et les options) et rendue en copie neuve (un appelant peut la modifier), un refus est relevé à l'identique.
 */
const MEMOIRE_PARTIES = new Map<string, MiseEnPageTableau | { message: string; page: number }>();
function partiesEnMemoire(fiche: FicheTableau, options: OptionsMiseEnPage): MiseEnPageTableau {
  const cle = JSON.stringify([fiche, options]);
  let r = MEMOIRE_PARTIES.get(cle);
  if (!r) {
    try {
      r = mettreEnPageParties(fiche, options);
    } catch (err) {
      if (!(err instanceof ErreurMiseEnPage)) throw err;
      r = { message: err.message, page: err.page };
    }
    if (MEMOIRE_PARTIES.size >= 100) MEMOIRE_PARTIES.delete(MEMOIRE_PARTIES.keys().next().value!);
    MEMOIRE_PARTIES.set(cle, r);
  }
  if ("message" in r && !("pages" in r)) throw new ErreurMiseEnPage(r.message, r.page);
  return structuredClone(r as MiseEnPageTableau);
}

function mettreEnPageGabarit(fiche: FicheTableau, options: OptionsMiseEnPage, zone: ZoneProtegee): MiseEnPageTableau {
  const { cadre, bande, zoneSure } = cadres(zone);
  const utile = bande.y - zoneSure.y;
  const numeros = [...new Set(fiche.scenes.map((s) => s.page))].sort((a, b) => a - b);
  const pages = numeros.map((page): PagePlacee => {
    const scenes = fiche.scenes.filter((s) => s.page === page);
    for (const s of scenes)
      for (const e of s.elements)
        if (e.type === "ligne")
          for (const m of e.importants ?? [])
            if (!e.texte.split(/\s+/).some((x) => cleMot(x) === cleMot(m)))
              throw new ErreurMiseEnPage(`Page ${page} · scène ${s.id} · le mot important « ${m} » n'est pas dans la ligne « ${e.texte} ».`, page);
    let marques = marquesDe(scenes);
    // Dispositions possibles : pour chaque scène à choix, à côté ou en rangée (au plus 2⁶ combinaisons).
    const choix = scenes.map((s) => aChoix(s));
    const n = Math.min(6, choix.filter(Boolean).length);
    const combinaisons: Disposition[][] = [];
    for (let k = 0; k < 2 ** n; k++) {
      let bit = 0;
      combinaisons.push(choix.map((c) => (c && bit < n ? ((k >> bit++) & 1 ? "rangee" : "cote") : "cote")));
    }
    const occupe = (p: PageBrute) => p.hauteur / utile >= OCCUPATION_MIN;
    // À une échelle : une page qui remplit la hauteur utile, puis le moins de rangées de dessin.
    let marge = margeBasse();
    const meilleure = (echelle: number): PageBrute | null => {
      const possibles = combinaisons.map((d) => poserPage(fiche, scenes, cadre, echelle, d, marques, options.preuves, marge)).filter((p): p is PageBrute => !!p);
      return possibles.length ? possibles.reduce((a, b) => (occupe(b) && !occupe(a) ? b : occupe(a) === occupe(b) && b.rangees < a.rangees ? b : a)) : null;
    };
    let retenue: PageBrute | null = null;
    let serres = false;
    try {
      // 1. Rangées pleines : la plus grande échelle où tout tient.
      strict = true;
      for (const echelle of echelles()) if ((retenue = meilleure(echelle))) break;
      // Page très chargée : sans la marge basse ; puis, en dernier recours, sans la place des gestes de la fiche
      // (la page le signale : `gestesSerres`). La règle 4 (`regles.ts`) met en page la fiche AVEC ses gestes, par
      // cette même fonction : une fiche qu'elle accepte se met donc toujours en page.
      if (!retenue) {
        marge = 0;
        for (const echelle of echelles()) if ((retenue = meilleure(echelle))) break;
      }
      if (!retenue && scenes.some((s) => s.elements.some((e) => e.type === "geste"))) {
        marques = marquesDe(scenes, false);
        for (const echelle of echelles()) if ((retenue = meilleure(echelle))) break;
        if (retenue) serres = true;
      }
      // 2. Page trop vide : rangées plus courtes permises, la plus petite échelle qui remplit la hauteur utile
      //    (sinon la plus grande qui tient).
      if (retenue && !occupe(retenue)) {
        strict = false;
        const plus = echelles().filter((e) => e >= retenue!.echelle).reverse();
        let repli: PageBrute | null = null;
        for (const echelle of plus) {
          const p = meilleure(echelle);
          if (!p) continue;
          repli = p;
          if (occupe(p)) break;
        }
        if (repli && repli.hauteur > retenue.hauteur) retenue = repli;
      }
    } finally {
      strict = true;
    }
    if (!retenue) throw new ErreurMiseEnPage(`Page ${page} · le contenu ne tient pas au-dessus de la bande des sous-titres, même à la taille plancher (3 % de la hauteur).`, page);
    const posee = repartir(page, scenes, retenue, cadre, zoneSure, bande);
    return serres ? { ...posee, gestesSerres: true } : posee;
  });
  return { version: VERSION_MISE_EN_PAGE, largeurPx: g.W, hauteurPx: g.H, zoneSure: rect(zoneSure), bandeSousTitres: rect(bande), cadre: rect(cadre), pages };
}

/**
 * Page aux gestes serrés, HORS du vertical (qui garde son repli d'avant) : un geste « entourer » sur une bulle de preuve
 * vise son bloc APRÈS (ou ses résultats), DANS la bulle, et non la bulle entière, dont l'ellipse sortirait de la zone
 * sûre. `undefined` : rien à changer.
 */
function cercleSerre(cible: { type: string; lignes: { px: RectPx; ton?: TonPreuve }[] }): RectPx | undefined {
  if (g === GABARIT_VERTICAL || cible.type !== "preuve" || !cible.lignes.length) return undefined;
  const apres = cible.lignes.filter((l) => l.ton === "apres");
  return union((apres.length ? apres : cible.lignes).map((l) => l.px));
}

/**
 * Répartit verticalement la page retenue : la place libre élargit d'abord les écarts entre scènes (jusqu'à 2,5 fois
 * l'écart), le reste va en parts égales en haut et en bas. Puis numérote dans l'ordre d'écriture et place les gestes.
 */
function repartir(page: number, scenes: SceneTableau[], p: PageBrute, cadre: RectPx, zoneSure: RectPx, bande: RectPx): PagePlacee {
  const ecartScene = Math.round(MARGES_VIDEO.entreLignes * g.RW * p.echelle * 1.4);
  const libre = cadre.hauteur - p.margeBasse - p.hauteur;
  const nEcarts = p.scenes.length - 1;
  const enPlus = nEcarts ? Math.min(Math.floor((libre * 0.5) / nEcarts), Math.round(ecartScene * 1.5)) : 0;
  let y = cadre.y + Math.floor((libre - enPlus * nEcarts) / 2);
  const elements: ElementPlace[] = [];
  const gestes: GestePlace[] = [];
  const zones = new Map<string, RectPx>();
  let ordre = 0;
  for (const [k, s] of p.scenes.entries()) {
    const parId = new Map(s.poses.map((x) => [x.el.elementId, x]));
    for (const e of ordreEcriture(scenes[k])) {
      if (e.type === "geste") {
        const cible = elements.find((x) => x.elementId === e.cibleId);
        if (!cible) throw new ErreurMiseEnPage(`Scène ${scenes[k].id} · le geste « ${e.id} » vise « ${e.cibleId} », absent de la page.`, page);
        const zone = e.geste === "cocher" ? zones.get(e.cibleId) : e.geste === "entourer" ? cible.bulle?.cercle?.px ?? cercleSerre(cible) : undefined;
        gestes.push({ elementId: e.id, sceneId: scenes[k].id, geste: e.geste, cibleId: e.cibleId, cible: { px: cible.px, fraction: cible.fraction }, ...(zone ? { zone: rect(zone) } : {}), ordre: ordre++ });
        continue;
      }
      const q = deplacer(parId.get(e.id)!, cadre.x, y);
      const { bulle: b, lignes, px, ...reste } = q.el;
      elements.push({
        ...reste,
        ordre: ordre++,
        ...rect(px),
        lignes: lignes.map((l) => ({ texte: l.texte, ...rect(l.px), ...(l.colonne ? { colonne: l.colonne } : {}), ...(l.ton ? { ton: l.ton } : {}) })),
        ...(b
          ? {
              bulle: {
                phrase: b.phrase.map((l) => ({ texte: l.texte, ...rect(l.px) })),
                zonePhrase: rect(b.zonePhrase),
                rangeesPhrase: b.rangeesPhrase,
                etiquettes: b.etiquettes.map((l) => ({ texte: l.texte, ...rect(l.px), ton: l.ton, ...(l.colonne ? { colonne: l.colonne } : {}) })),
                date: { texte: b.date.texte, ...rect(b.date.px) },
                tailleLegende: b.tailleLegende,
                ...(b.separateur ? { separateur: b.separateur } : {}),
                queue: rect(b.queue),
                ...(b.cercle ? { cercle: rect(b.cercle) } : {}),
              },
            }
          : {}),
        encombrement: rect(q.enc),
      });
      if (q.zoneCoche) zones.set(q.el.elementId, q.zoneCoche);
    }
    y += s.hauteur + ecartScene + enPlus;
  }
  const haut = Math.min(...elements.map((e) => e.encombrement.px.y));
  const bas = Math.max(...elements.map((e) => e.encombrement.px.y + e.encombrement.px.hauteur));
  const occupation = arrondi6((bas - haut) / (bande.y - zoneSure.y));
  return { page, echelle: p.echelle, occupation, elements, gestes };
}

/* ------------------------------------------------------------------ */
/* Boîtes pour un contrôle d'image                                       */
/* ------------------------------------------------------------------ */

/**
 * Boîte de texte telle qu'un contrôle d'image l'attend (zones, taille, contraste) [supposé : forme provisoire, le
 * contrôle commun ORG-13 n'existe pas encore sur master ; une boîte par ligne visuelle].
 */
export interface BoiteControle {
  page: number;
  elementId: string;
  texte: string;
  taillePx: number;
  couleurTexte: string;
  couleurFond: string;
  /** Niveau du texte dans l'habillage. */
  role: NiveauMise;
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

/** Convertit une mise en page en boîtes de contrôle. Ne lit que la mise en page (aucun autre module). */
export function boitesDeControle(miseEnPage: MiseEnPageTableau): BoiteControle[] {
  return miseEnPage.pages.flatMap((p) =>
    p.elements
      .filter((e) => e.niveau && e.taillePx && e.couleurTexte && e.couleurFond)
      .flatMap((e) => {
        const boite = (l: LigneVisuelle, taillePx: number, role: NiveauMise): BoiteControle => ({
          page: p.page,
          elementId: e.elementId,
          texte: l.texte,
          taillePx,
          couleurTexte: e.couleurTexte!,
          couleurFond: e.couleurFond!,
          role,
          ...l.px,
        });
        // Bulle : phrase testée, étiquettes et date (légende) en plus des lignes de résultat ; une date pas encore
        // connue (texte vide) n'a pas de boîte.
        const b = e.bulle;
        const legendes = b ? [...b.phrase, ...b.etiquettes, ...(b.date.texte ? [b.date] : [])].map((l) => boite(l, b.tailleLegende, "legende")) : [];
        return [...e.lignes.map((l) => boite(l, e.taillePx!, e.niveau!)), ...legendes];
      }),
  );
}

/* ------------------------------------------------------------------ */
/* Adaptation des boîtes de la mise en page à la brique commune          */
/* ------------------------------------------------------------------ */

/** Boîtes du tableau (pixels, une par ligne visuelle) → boîtes de la brique (fractions de l'image). */
export function miseEnPageBrique(fiche: FicheTableau, mise: MiseEnPageTableau): MiseEnPage {
  const premiere = fiche.scenes[0];
  const accroches = new Set((premiere?.elements ?? []).filter((e) => e.type === "ligne").map((e) => e.id));
  const { largeurPx: L, hauteurPx: H } = mise;
  // Les lignes visuelles d'un même élément sont réunies : le texte est celui de l'élément, le cadre englobe ses lignes.
  const parElement = new Map<string, BoiteControle[]>();
  for (const b of boitesDeControle(mise)) parElement.set(b.elementId, [...(parElement.get(b.elementId) ?? []), b]);
  const boites: Boite[] = [];
  for (const [id, lignes] of parElement) {
    const x0 = Math.min(...lignes.map((b) => b.x));
    const y0 = Math.min(...lignes.map((b) => b.y));
    const x1 = Math.max(...lignes.map((b) => b.x + b.largeur));
    const y1 = Math.max(...lignes.map((b) => b.y + b.hauteur));
    const accroche = accroches.has(id);
    const [f] = lignes;
    boites.push({
      role: accroche ? "accroche" : "texte",
      texte: lignes.map((b) => b.texte).join(" "),
      taille: Math.min(...lignes.map((b) => b.taillePx)) / H,
      couleur: f.couleurTexte,
      fond: f.couleurFond,
      x: x0 / L,
      y: y0 / H,
      largeur: (x1 - x0) / L,
      hauteur: (y1 - y0) / H,
      debutSec: accroche ? 0 : 1,
    });
  }
  // Les marques du stylo (souligné, cadre, barré…) : tracées de la couleur du texte, contraste de 3 pour 1 au moins.
  for (const p of mise.pages) {
    for (const e of p.elements) {
      if (!e.marque || !e.couleurTexte || !e.couleurFond) continue;
      boites.push({ role: "marque", couleur: e.couleurTexte, fond: e.couleurFond, ...e.fraction, debutSec: 1 });
    }
  }
  return { boites };
}

/**
 * Seuils de la brique commune pour le style « blocs/2 » (charte de la vidéo modèle, `v2/charte.ts`) : aucun texte sous
 * le plus petit texte du style (l'étiquette de section, 28 px de référence), bande des sous-titres du style (sa
 * pastille), contraste de 3 pour 1 pour le texte gras d'au moins 52 px de référence, 4,5 pour 1 sinon. La brique n'a
 * qu'un seuil de contraste : elle reçoit le plus bas (le seuil propre à chaque texte est vérifié par les contrôles).
 * Les MÊMES seuils servent à la mise en page (`ecransHorsRegles`) et à la relecture.
 */
export function seuilsImageBlocs2(mise: MiseEnPageTableau, injectes?: Partial<SeuilsControleImage>): SeuilsControleImage {
  const k = mise.styleV2?.geometrie.k ?? 1;
  return {
    ...SEUILS_CONTROLE_IMAGE,
    ...injectes,
    tailleTexteMin: (Math.min(TAILLES_V2.etiquette, TAILLES_V2.libelleMin) * k) / mise.hauteurPx - 1e-6,
    contrasteTexteMin: CONTRASTE_GRAND_MIN,
    bandeSousTitres: mise.bandeSousTitres.px.hauteur / mise.hauteurPx,
  };
}

/** Zone sûre de la mise en page, en fractions de l'image (marges haut, droite, bas, gauche). */
export function zoneSureDeLaMise(mise: MiseEnPageTableau): ZoneSure {
  const z = mise.zoneSure.px;
  return { haut: z.y / mise.hauteurPx, droite: 1 - (z.x + z.largeur) / mise.largeurPx, bas: 1 - (z.y + z.hauteur) / mise.hauteurPx, gauche: z.x / mise.largeurPx };
}

/**
 * « blocs/2 », vertical : une boîte qui finit au-dessus de `titresLarges.basMax` (titres du haut) est vérifiée contre la
 * marge droite du haut (`REGLAGES_GEOMETRIE_V2.hautLarge`) ; plus bas, la marge ordinaire (boutons des réseaux).
 */
export function boitesZoneHaute(m: MiseEnPage, mise: MiseEnPageTableau, zone: ZoneSure): MiseEnPage {
  const tl = mise.styleV2?.geometrie.titresLarges;
  if (!tl) return m;
  const bas = tl.basMax / mise.hauteurPx + 1e-6;
  const droiteHaute = 1 - REGLAGES_GEOMETRIE_V2.hautLarge.droite / 100;
  const droite = 1 - zone.droite;
  return { boites: m.boites.map((b) => (b.y + b.hauteur <= bas && b.x + b.largeur <= droiteHaute && b.x + b.largeur > droite ? { ...b, largeur: Math.max(0, droite - b.x) } : b)) };
}

/**
 * Ce qu'un écran « blocs/2 » posé fait échouer parmi les contrôles de l'image qui dépendent de la place (zone sûre,
 * bande des sous-titres, taille plancher) : les MÊMES fonctions et les mêmes seuils que la relecture, sur les éléments
 * de l'écran. Rend une phrase par contrôle échoué (vide : l'écran tient).
 */
function ecranHorsRegles(fiche: FicheTableau, mise: MiseEnPageTableau, garder: (e: ElementPlace) => boolean): string[] {
  const sous: MiseEnPageTableau = { ...mise, pages: mise.pages.map((p) => ({ ...p, elements: p.elements.filter(garder) })) };
  const zone = zoneSureDeLaMise(mise);
  const seuils = seuilsImageBlocs2(mise);
  const boites = boitesZoneHaute(miseEnPageBrique(fiche, sous), mise, zone);
  return [controleZoneSure(boites, zone), controleBandeSousTitres(boites, zone, seuils), controleTailleTexte(boites, seuils)].filter((c) => c.etat === "echoue").map((c) => c.raison);
}

/* ------------------------------------------------------------------ */
/* Style « blocs/2 » : écrans de la vidéo modèle                         */
/* ------------------------------------------------------------------ */

/** Moment d'une scène sans écran déclaré (repli), tiré de son rôle. */
const MOMENT_DU_ROLE: Readonly<Record<SceneTableau["role"], MomentV2>> = {
  accroche: "accroche",
  douleur: "douleur",
  "idee-recue": "retournement",
  etape: "etape",
  exemple: "exemple",
  preuve: "exemple",
  resultat: "recapitulatif",
  fin: "appel",
};

/** Gabarit de repli d'un écran : celui du moment, selon ce que l'écran contient. */
export function gabaritDeRepli(moment: MomentV2, contenu: { items: number; details: boolean; chiffre: boolean; motCommentaire: boolean; lignes: number }): GabaritV2 {
  switch (moment) {
    case "accroche":
      return contenu.items ? "accroche-cases" : contenu.chiffre ? "accroche-compteur" : "constat";
    case "douleur":
      return "constat";
    case "retournement":
      return "idee-recue";
    case "promesse":
      return contenu.items > 6 ? "liste" : "semaine";
    case "etape":
      return contenu.items ? (contenu.details ? "liste" : "etape") : "etape";
    case "exemple":
      return "exemple";
    case "recapitulatif":
      return "recapitulatif";
    case "appel":
      return contenu.motCommentaire ? "appel-commentaire" : "appel-diagnostic";
  }
}

const ancreEl = (e: ElementTableau) => ("ancre" in e ? e.ancre : 0);

/** Écrans déclarés d'une scène, ou l'écran de repli tiré de son rôle. */
function ecransDeScene(s: SceneTableau): EcranTableau[] {
  return s.ecrans?.length ? s.ecrans : [{ moment: MOMENT_DU_ROLE[s.role] }];
}

/**
 * Descriptions des écrans d'une fiche « blocs/2 », dans l'ordre. Un champ absent prend sa valeur de repli : gabarit
 * du moment, étiquette du moment, fond qui alterne, numéro d'étape compté. Jamais d'échec ici.
 */
export function descriptionsEcrans(fiche: FicheTableau, appel?: AppelFinV2): DescriptionEcran[] {
  const brutes: (DescriptionEcran & { fondVoulu: FondV2 })[] = [];
  const nbEtapes = fiche.scenes.reduce((n, s) => n + ecransDeScene(s).filter((e) => e.moment === "etape").length, 0);
  let etapeN = 0;
  fiche.scenes.forEach((s, iScene) => {
    const ecrans = ecransDeScene(s);
    const debuts = ecrans.map((e, k) => (k === 0 ? 0 : (e.ancre ?? 0)));
    ecrans.forEach((ec, k) => {
      const de = debuts[k];
      const a = k + 1 < debuts.length ? debuts[k + 1] : Infinity;
      const dans = (e: ElementTableau) => {
        if (e.type === "mention") return k === 0;
        if (e.type === "geste") {
          const cible = s.elements.find((x) => x.id === e.cibleId);
          const an = cible ? ancreEl(cible) : ancreEl(e);
          return an >= de && an < a;
        }
        return ancreEl(e) >= de && ancreEl(e) < a;
      };
      const els = s.elements.filter(dans);
      const gestes = els.filter((e): e is Extract<ElementTableau, { type: "geste" }> => e.type === "geste");
      const forts = new Set((ec.motsForts ?? []).map(cleMotV2));
      const lignes = els.filter((e): e is Extract<ElementTableau, { type: "ligne" }> => e.type === "ligne");
      const titres: TitreDecrit[] = lignes.map((l) => {
        const g = gestes.find((x) => x.cibleId === l.id && x.geste !== "cocher" && x.geste !== "pointer");
        const motsL = l.texte.split(/\s+/).map(cleMotV2);
        return {
          id: l.id,
          texte: l.texte,
          niveau: l.niveau,
          forts: motsL.filter((m) => forts.has(m)),
          soulignes: (l.importants ?? []).map(cleMotV2),
          souligneTout: l.marque === "souligne" || l.marque === "surligne" || g?.geste === "souligner",
          barre: l.marque === "barre" || g?.geste === "barrer",
          entoure: l.marque === "entoure" || g?.geste === "entourer",
          ...(g ? { gesteId: g.id } : {}),
        };
      });
      const moment = ec.moment;
      let items = (ec.liste ?? []).map((it, i) => ({ id: idItemEcran(s.id, k, i), texte: it.texte, ...(it.detail ? { detail: it.detail } : {}) }));
      const chiffreEl = els.find((e): e is Extract<ElementTableau, { type: "chiffre" }> => e.type === "chiffre");
      const preuve = els.find((e): e is Extract<ElementTableau, { type: "preuve" }> => e.type === "preuve");
      const motCommentaire = ec.motCommentaire && lignes.some((l) => l.texte.split(/\s+/).some((m) => cleMotV2(m) === cleMotV2(ec.motCommentaire!))) ? ec.motCommentaire : null;
      let gabarit: GabaritV2 = ec.gabarit ?? gabaritDeRepli(moment, { items: items.length, details: items.some((i) => i.detail), chiffre: !!chiffreEl, motCommentaire: !!motCommentaire, lignes: lignes.length });
      let titresEcran = titres;
      // Repli : une liste ou un récapitulatif sans éléments prend les lignes après la première.
      if ((gabarit === "recapitulatif" || gabarit === "liste") && !items.length) {
        if (titres.length > 1) {
          items = titres.slice(gabarit === "recapitulatif" ? 0 : 1).map((t) => ({ id: t.id, texte: t.texte }));
          titresEcran = gabarit === "recapitulatif" ? [] : titres.slice(0, 1);
        } else gabarit = moment === "recapitulatif" ? "constat" : "etape";
      }
      if (gabarit === "appel-commentaire" && !motCommentaire) gabarit = "appel-diagnostic";
      // Semaine : seulement si elle a de quoi remplir ses jours (deux éléments au moins, ou un nombre de jours dit) ; sinon l'écran simple (les
      // titres et les pictogrammes de la fiche), jamais une rangée de jours vides (relecture du 12/10/2026).
      // Un chiffre de jours dit dans l'écran (« en 5 jours ») remplit les jours : un par jour compté.
      const joursComptes = !!chiffreEl && /^jours?$/iu.test(chiffreEl.unite ?? "") && Number(chiffreEl.valeur) >= 2 && Number(chiffreEl.valeur) <= 7;
      if (gabarit === "semaine" && items.length < 2 && !joursComptes) gabarit = "etape";
      if (gabarit === "accroche-compteur" && !chiffreEl) gabarit = items.length ? "accroche-cases" : "constat";
      // Cases barrées : le geste « barrer » de la ligne trace les croix des cases, il ne barre pas le titre.
      if (gabarit === "accroche-cases") titresEcran = titresEcran.map((t) => (t.barre && t.gesteId && !lignes.find((l) => l.id === t.id)?.marque ? { ...t, barre: false } : t));
      if (moment === "etape") etapeN++;
      const etape =
        moment === "etape"
          ? {
              n: ec.etape?.n ?? etapeN,
              total: ec.etape?.total ?? nbEtapes,
              nom: ec.etape?.nom ?? (titres.flatMap((t) => t.texte.split(/\s+/).filter((m) => forts.has(cleMotV2(m))))[0] ?? `Étape ${ec.etape?.n ?? etapeN}`),
            }
          : null;
      const fondVoulu: FondV2 = moment === "etape" ? FONDS_ETAPES[(etape!.n - 1) % FONDS_ETAPES.length] : (FOND_PAR_MOMENT[moment] ?? "ivoire");
      brutes.push({
        id: idEcran(s.id, k),
        sceneId: s.id,
        moment,
        gabarit,
        fond: fondVoulu,
        fondVoulu,
        etiquette: ec.etiquette ?? ETIQUETTES_PAR_MOMENT[moment] ?? null,
        etape,
        titres: titresEcran,
        items,
        chiffre: chiffreEl ? { id: chiffreEl.id, valeur: chiffreEl.valeur, ...(chiffreEl.unite ? { unite: chiffreEl.unite } : {}) } : null,
        avantApres: preuve ? { id: preuve.id, avant: preuve.lignes.length > 1 ? preuve.lignes[0] : null, apres: preuve.lignes[preuve.lignes.length - 1], lignes: [...preuve.lignes] } : null,
        mention: (moment === "exemple" || s.role === "exemple") && els.some((e) => e.type === "mention"),
        coches: gestes.filter((g) => g.geste === "cocher").map((g) => g.id),
        motCommentaire,
        final: false,
        premier: iScene === 0 && k === 0,
        dessins: els.filter((e): e is Extract<ElementTableau, { type: "dessin" }> => e.type === "dessin").map((e) => ({ id: e.id, dessinId: e.dessinId })),
      });
    });
  });
  // Deux écrans qui se suivent n'ont jamais le même fond.
  const ordre: FondV2[] = ["ivoire", "encre", "orange"];
  for (let i = 1; i < brutes.length; i++) {
    if (brutes[i].fond !== brutes[i - 1].fond) continue;
    // L'écran d'appel final garde son fond (encre, comme la vidéo modèle) : c'est l'écran d'avant qui change.
    if (brutes[i].moment === "appel" && i === brutes.length - 1) {
      const avant = brutes[i - 2]?.fond;
      brutes[i - 1].fond = ordre.find((f) => f !== brutes[i].fond && f !== avant) ?? ordre.find((f) => f !== brutes[i].fond)!;
      continue;
    }
    const suivant = brutes[i + 1]?.fondVoulu;
    brutes[i].fond = ordre.find((f) => f !== brutes[i - 1].fond && f !== suivant) ?? ordre.find((f) => f !== brutes[i - 1].fond)!;
  }
  if (brutes.length) brutes[brutes.length - 1].final = true;
  // Fin retenue pour la sortie : l'écran d'appel de la dernière scène prend le mot saisi, ou l'appel de diagnostic.
  const dernier = brutes.at(-1);
  if (appel && dernier?.moment === "appel") {
    if ("mot" in appel && appel.mot.trim()) Object.assign(dernier, { gabarit: "appel-commentaire" as GabaritV2, motCommentaire: appel.mot.trim() });
    else if ("diagnostic" in appel) Object.assign(dernier, { gabarit: "appel-diagnostic" as GabaritV2, motCommentaire: null });
    else if ("site" in appel) {
      const phrase = appel.phrase?.trim().toLocaleUpperCase("fr-FR");
      const titre = { id: `${dernier.id}~fin`, texte: phrase ?? "", niveau: "titre" as const, forts: [], soulignes: [], souligneTout: false, barre: false, entoure: false };
      Object.assign(dernier, { gabarit: "appel-site" as GabaritV2, motCommentaire: null, titres: phrase ? [titre] : [], items: [], chiffre: null, avantApres: null, coches: [], mention: false });
    }
  }
  return brutes.map((b) => {
    const d: DescriptionEcran & { fondVoulu?: FondV2 } = { ...b };
    delete d.fondVoulu;
    return d;
  });
}

/** Étapes de la vidéo, pour la barre. */
export function etapesBarre(descriptions: readonly DescriptionEcran[]): EtapeBarre[] {
  const vues = new Map<number, EtapeBarre>();
  for (const d of descriptions) if (d.etape && !vues.has(d.etape.n)) vues.set(d.etape.n, { n: d.etape.n, nom: d.etape.nom, ecranId: d.id });
  return [...vues.values()].sort((a, b) => a.n - b.n);
}

/** Les essais d'un écran, dans l'ordre : son gabarit, puis des gabarits plus simples (repli sûr). */
function essaisEcran(d: DescriptionEcran): DescriptionEcran[] {
  return [
    d,
    ...(d.gabarit === "liste" || d.gabarit === "semaine" ? [{ ...d, gabarit: "etape" as GabaritV2 }] : []),
    // Étape dont les cartes ne tiennent pas : ses éléments en liste (jamais perdus au profit d'une figure sans rapport).
    ...(d.gabarit === "etape" && d.items.length ? [{ ...d, gabarit: "liste" as GabaritV2 }] : []),
    // La conversation figurée du constat ne remplace que l'accroche ou la douleur (ailleurs, elle n'a pas de rapport).
    ...(d.moment === "accroche" || d.moment === "douleur" ? [{ ...d, gabarit: "constat" as GabaritV2 }] : []),
    // Dernier repli : les titres et une carte simple (le corps le plus court).
    { ...d, gabarit: "etape", items: [] },
  ];
}

/** Dispose un écran à partir de l'essai `depuis` ; rend l'écran et l'essai retenu, ou la dernière erreur. */
function disposerAvecRepli(d: DescriptionEcran, g: GeometrieV2, etapes: EtapeBarre[], depuis = 0): { ecran: EcranPlace; essai: number } | { erreur: ErreurDispositionV2 | null } {
  const essais = essaisEcran(d);
  let derniere: ErreurDispositionV2 | null = null;
  for (let i = depuis; i < essais.length; i++) {
    try {
      return { ecran: disposerEcran(essais[i], g, { etapes }), essai: i };
    } catch (e) {
      if (!(e instanceof ErreurDispositionV2)) throw e;
      derniere = e;
    }
  }
  return { erreur: derniere };
}

/** Ce qu'il faut faire quand un écran ne tient pas : dit à Will, en clair. */
const RACCOURCIR = "Raccourcissez ce texte, ou retirez une ligne ou un élément de cet écran, puis relancez la relecture.";

/** Rectangle englobant des textes et des formes d'une source dans un écran (sinon le contenu). */
function placeDe(e: EcranPlace, source: string, g: GeometrieV2): RectPx {
  const rs = [...e.textes.filter((t) => t.source === source && !t.horsContenu), ...e.formes.filter((f) => f.source === source && !f.horsZone && f.sorte !== "jauge")].map((x) => ({ x: x.x, y: x.y, largeur: x.largeur, hauteur: x.hauteur }));
  const borne = (r: RectPx): RectPx => {
    const x = Math.max(r.x, 0);
    const y = Math.max(r.y, 0);
    return { x, y, largeur: Math.min(r.x + r.largeur, g.largeur) - x, hauteur: Math.min(r.y + r.hauteur, g.bande.y) - y };
  };
  if (!rs.length) return { ...(e.zoneCorps.hauteur > 0 ? e.zoneCorps : e.zoneTitres) };
  return borne(union(rs));
}

function mettreEnPageV2(fiche: FicheTableau, options: OptionsMiseEnPage): MiseEnPageTableau {
  const autre = options.format && options.format !== "vertical" ? options.format : null;
  const gab = autre ? gabaritFormat(autre) : GABARIT_VERTICAL;
  // Vertical : bas de la zone sûre propre au style « blocs/2 » (20 %, `ZONE_VERTICAL_BLOCS_2`).
  const zone = autre ? zoneSureBlocs2(autre) : zoneSureBlocs2("vertical", zoneSureTableau(options.reseaux));
  const geo = geometrieV2(gab.W, gab.H, zone);
  const descriptions = descriptionsEcrans(fiche, options.appel);
  const etapes = etapesBarre(descriptions);
  const pageDe = (d: DescriptionEcran) => fiche.scenes.find((s) => s.id === d.sceneId)?.page ?? 1;
  // Chaque écran part de son gabarit. Un écran posé qui sortirait de la zone sûre, toucherait la bande des
  // sous-titres ou passerait sous la taille plancher (mêmes contrôles que la relecture) passe à l'essai suivant ;
  // plus aucun essai : la mise en page est refusée, en disant quoi raccourcir. Un écran qui tient ne change pas.
  const depuis = descriptions.map(() => 0);
  for (;;) {
    const ecrans = descriptions.map((d, i) => {
      const r = disposerAvecRepli(d, geo, etapes, depuis[i]);
      if ("erreur" in r) throw new ErreurMiseEnPage(`Page ${pageDe(d)} · scène ${d.sceneId} · ${r.erreur?.message ?? "l'écran ne tient pas."} ${RACCOURCIR}`, pageDe(d));
      depuis[i] = r.essai;
      return r.ecran;
    });
    const { mise, ecranDe } = assemblerV2(fiche, ecrans, etapes, geo, gab, autre);
    let refaire = false;
    ecrans.forEach((e, i) => {
      const hors = ecranHorsRegles(fiche, mise, (el) => ecranDe.get(el.elementId) === e.id);
      if (!hors.length) return;
      const d = descriptions[i];
      if (depuis[i] + 1 >= essaisEcran(d).length) throw new ErreurMiseEnPage(`Page ${pageDe(d)} · scène ${d.sceneId} · l'écran ne tient pas : ${hors.join(" ")} ${RACCOURCIR}`, pageDe(d));
      depuis[i]++;
      refaire = true;
    });
    if (!refaire) return mise;
  }
}

/** Pages (la place de chaque élément dans son écran) et mise en page « blocs/2 » d'écrans déjà posés. */
function assemblerV2(fiche: FicheTableau, ecrans: EcranPlace[], etapes: EtapeBarre[], geo: GeometrieV2, gab: Gabarit, autre: IdFormatSortie | null): { mise: MiseEnPageTableau; ecranDe: Map<string, string> } {
  const ecranDe = new Map<string, string>();
  const avant = g;
  g = gab;
  try {
    // Pages : la place de chaque élément dans son écran (les contrôles d'avant les lisent telles quelles).
    const numeros = [...new Set(fiche.scenes.map((s) => s.page))].sort((a, b) => a - b);
    const pages = numeros.map((page): PagePlacee => {
      const elements: ElementPlace[] = [];
      const gestes: GestePlace[] = [];
      let ordre = 0;
      for (const s of fiche.scenes.filter((x) => x.page === page)) {
        const ecransScene = ecrans.filter((e) => e.sceneId === s.id);
        const ecranDeSource = (id: string) => ecransScene.find((e) => e.textes.some((t) => t.source === id) || e.formes.some((f) => f.source === id) || e.traits.some((t) => t.source === id)) ?? ecransScene[0];
        const poser = (elementId: string, type: ElementPlace["type"], e: EcranPlace, extra: Partial<ElementPlace> = {}) => {
          const px = placeDe(e, elementId, geo);
          const textes = e.textes.filter((t) => t.source === elementId && !t.horsContenu);
          const t0: TexteV2 | undefined = textes[0];
          ecranDe.set(elementId, e.id);
          elements.push({
            elementId,
            sceneId: s.id,
            type,
            ordre: ordre++,
            ...rect(px),
            niveau: t0?.police === "texte" ? "corps" : "titre",
            taillePx: Math.round(Math.min(...(textes.length ? textes.map((t) => t.taille) : [tailleNiveau("corps", 1)]))),
            couleurTexte: t0?.couleur ?? COULEURS_VIDEO.ecriture,
            couleurFond: t0?.fond ?? COULEURS_VIDEO.page,
            lignes: textes.map((t) => ({ texte: t.texte, ...rect({ x: t.x, y: t.y, largeur: t.largeur, hauteur: t.hauteur }) })),
            encombrement: rect(px),
            ...extra,
          });
        };
        ecransDeScene(s).forEach((ec, k) => {
          const e = ecransScene[k];
          if (!e) return;
          if (k > 0) poser(idEcran(s.id, k), "ecran", e);
          (ec.liste ?? []).forEach((_, i) => poser(idItemEcran(s.id, k, i), "item", e));
        });
        for (const el of s.elements) {
          if (el.type === "geste") continue;
          const e = ecranDeSource(el.id);
          if (!e) continue;
          poser(el.id, el.type, e, {
            ...(el.type === "ligne" ? { role: el.role, ...(el.marque ? { marque: el.marque } : {}), ...(el.importants ? { importants: el.importants } : {}) } : {}),
            ...(el.type === "dessin" ? { dessinId: el.dessinId, cote: el.cote } : {}),
          });
        }
        for (const el of s.elements) {
          if (el.type !== "geste") continue;
          const cible = elements.find((x) => x.elementId === el.cibleId);
          if (!cible) continue;
          gestes.push({ elementId: el.id, sceneId: s.id, geste: el.geste, cibleId: el.cibleId, cible: { px: cible.px, fraction: cible.fraction }, ordre: ordre++ });
        }
      }
      return { page, echelle: 1, occupation: 1, elements, gestes };
    });
    const z = geo.zoneSure;
    const cadre = geo.contenu;
    return {
      ecranDe,
      mise: {
        version: VERSION_MISE_EN_PAGE,
        ...(autre ? { format: autre, reference: { largeur: gab.RW, hauteur: gab.RH } } : {}),
        largeurPx: gab.W,
        hauteurPx: gab.H,
        zoneSure: rect({ x: z.x, y: z.y, largeur: z.largeur, hauteur: z.hauteur }),
        bandeSousTitres: rect({ ...geo.bande }),
        cadre: rect({ ...cadre }),
        pages,
        styleV2: { style: STYLE_V2, geometrie: geo, ecrans, etapes },
      },
    };
  } finally {
    g = avant;
  }
}
