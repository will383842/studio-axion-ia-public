/**
 * LE MOTEUR DE RENDU UNIQUE DES SOUS-TITRES. PUR, sans React ni Remotion : à un instant t, il dit EXACTEMENT quoi
 * dessiner (texte, police, taille, couleurs mot par mot, position, inclinaison, rebond, soulignement, bandeau).
 * Le calque Remotion (`studio-rendu/compositions/sous-titres/`) et l'aperçu du navigateur (`SousTitreAnime`) ne font
 * que traduire cette scène en éléments : un style ne peut donc jamais différer entre l'aperçu et la vidéo.
 */
import { progres } from "../motion/courbes";
import { largeurLigne, largeurMot, tailleQuiTient, type NomPolice } from "./mesure";
import { graisseAuTemps, largeurReservee } from "./poids-variable";
import { cssLigne, facteurTaille, GABARITS, rgba, type CouleursSousTitres, type DefinitionGabarit } from "./style";
import { PAVE, type BoitePave } from "./pave";
import type { MarqueMot } from "./marques-mot";
import type { LigneBoite } from "./boite-arrondie";
import type { ZoneSureEscalier } from "./escalier";
import { bandeauActif, type BandeauNomRendu } from "./bandeau-nom";
import { ETIQUETTE, ETIQUETTE_AUTONOME, type EtiquetteOutilPosee } from "./noms-outils";
import { estNombre, MOTS_FORTS, normaliser } from "./typographie";
import { pastilleEnManrope, type StylePastille } from "./pastille";
import { segmentEnSortie, SORTIE_ACTIVE, sortieDuGroupe, type SortieGroupe } from "./sortie";
import type { CibleMarqueurRendu, GabaritRendu as BaseSousTitres, PositionGroupeRendu as PositionGroupeSousTitres, SegmentRendu as SegmentSousTitres } from "./types-rendu";

export interface DonneesCalque {
  /** Taille de l'image (1080 × 1920 en 9:16). */
  largeur: number;
  hauteur: number;
  segments: SegmentSousTitres[];
  base: BaseSousTitres;
  couleurs: CouleursSousTitres;
  /** Largeur libre d'une ligne (zones protégées combinées), en px. */
  largeurMaxPx: number;
  /** Centres verticaux, en % de la hauteur : milieu (48), haut et bas (calculés sur les zones protégées). */
  positions: { milieuPct: number; hautPct: number; basPct: number; poitrinePct?: number };
  /** Plans poitrine : la ligne « auto » descend à `poitrinePct` pour ne pas couvrir la bouche (B.5). */
  plansPoitrine?: { debutSec: number; finSec: number }[];
  /** Taille relative du style de la Bibliothèque (1 = gabarit). */
  tailleRelative?: number;
  /**
   * Lot M4 : ombre renforcée sur un décor CLAIR (`sousTitresSurDecor`, règle du catalogue des décors) ; 1 ou absent =
   * ombre du gabarit.
   */
  facteurOmbre?: number;
  /**
   * Style « Encre » (tableau animé, ajout pur) : ni contour ni ombre, police de la charte (le rendu la choisit). Les
   * couleurs viennent de `couleurs`. Absent : inchangé.
   */
  encre?: boolean;
  /**
   * Lot M4b : pendant l'encadré d'ouverture (0-3 s), la ligne « auto » des groupes qui COMMENCENT avant `finSec` se
   * pose à `milieuPct` (ni descente sur la poitrine, ni saut au milieu d'un groupe), pour laisser la place à
   * l'encadré dessous. Absent : aucun changement.
   */
  ouverture?: { finSec: number; milieuPct: number };
  /**
   * Facecam lot C (B.22, ajout pur) : pendant un écran partagé, la ligne « auto » / « milieu » se pose à la JONCTION
   * (`centrePct`), jamais sur la bouche. Absent : aucun changement.
   */
  passagesJonction?: { debutSec: number; finSec: number; centrePct: number; colonne?: ColonneLigne }[];
  /**
   * Cas concret (ajout pur, essai réel du 14/10) : pendant un écran CLAIR, le texte prend la couleur `texte` (foncée),
   * sans contour ni ombre, comme la v4 (texte #15100c sur l'ivoire) ; l'accent ne change pas. Absent : inchangé.
   */
  passagesClairs?: { debutSec: number; finSec: number; texte: string }[];
  /**
   * Facecam lot F1 (ajout pur) : échelle de la lettre et des marges (16:9 : 0,9 à 1 920 px de large, au lieu de
   * largeur / 1 080 = 1,78). `largeurMaxPx` est alors pris tel quel. Absent : largeur / 1 080, comme avant.
   */
  echelleTexte?: number;
  /**
   * Style nommé « Pastille Axion » (tableau « reference/3 », ajout pur, `pastille.ts`) : le groupe dans une pastille
   * pleine, le mot dit en orange clair qui monte et grossit un peu. Absent : inchangé.
   */
  pastille?: StylePastille;
  /**
   * Lot L3b du cas concret (ajout pur) : le mot souligné est SURLIGNÉ (fond de couleur derrière le mot, texte de la
   * couleur `texte`) au lieu du trait. Absent : trait, inchangé.
   */
  surlignage?: SurlignageSousTitres;
  /**
   * Tableau animé, sous-titres dynamiques (ajout pur) : `false`, les accents entrent sans glisser (ils restent dans la
   * bande réservée). Absent : glissement court, inchangé.
   */
  glissement?: false;
  /**
   * Tableau animé, design central (ajout pur) : bande sombre de FOND posée derrière les sous-titres, dans la bande que la
   * mise en page leur réserve (fonds clairs : tableau blanc, paperboard). Absente : rien n'est dessiné, inchangé.
   */
  bandeFond?: BandeFondSousTitres;
  /** C2-U6, ajout pur : cible du marqueur ; absente ou "souligne" : le mot souligné seul, inchangé. */
  cibleMarqueur?: Exclude<CibleMarqueurRendu, "souligne">;
  /** C2-U7a : mot à plaque de chaque groupe (id du segment → indice du mot). Absent : aucun pavé. */
  plaques?: Record<string, number>;
  /** C2-U8 : mots-outils étiquetés de chaque groupe (id du segment → premier indice et nombre de mots). Absent : aucune étiquette. */
  motsOutils?: Record<string, { debut: number; longueur: number }>;
  /** C2-U10 : bandeau « nom et fonction » (pièce non branchée) ; pendant sa tenue, un groupe « bas » se pose comme « auto ». Absent : rien ne change. */
  bandeauNom?: BandeauNomRendu;
  /** C2-U9 : étiquettes d'outil autonomes (pièce non branchée, `ETIQUETTE_OUTIL_AUTONOME` éteinte). Absent : rien ne change. */
  etiquettesOutils?: EtiquetteOutilPosee[];
  /** C2-U19 (AM-08) : sortie animée des groupes (fondu 0,2 s, glissement court), seulement si `SORTIE_ACTIVE`. Absent : le groupe disparaît net, comme avant. */
  sortie?: SortieGroupe;
  /** BR-ESCALIER : absent = rien ne change. */
  escalier?: { zone: ZoneSureEscalier; taillePx: number };
  /** BR-PAVE-MARQUES : seul `true` anime la plaque du mot à plaque (entrée inclinée de 0,18 s). Absent : plaque fixe d'avant, rien ne change. */
  paveAnime?: true;
  /** BR-PAVE-MARQUES : marque posée sous la plaque animée (id du segment → marque). Sans `paveAnime` : sans effet. */
  marques?: Record<string, MarqueMot>;
  /** BR-POIDS-VARIABLE-IV-a : seul `true` fait passer le mot dit de la graisse 500 à 800 ; absent : inchangé. */
  poidsVariable?: true;
  /** BR-MINIMAL-IV-b : boîte arrondie derrière le groupe affiché (rayon et marge en em de la taille du texte). Absent : rien ne change. */
  boite?: { rayonEm: number; margeEm: number; couleurs: { fond: string; texte: string } };
}

/** Bande de fond derrière les sous-titres : couleur (jeton `fond` de la marque), opacité, place (px du calque), fondu haut. */
export interface BandeFondSousTitres {
  couleur: string;
  opacite: number;
  xPx: number;
  yPx: number;
  largeurPx: number;
  hauteurPx: number;
  /** Hauteur du dégradé doux en haut de la bande (de transparent à `opacite`), en px. */
  fonduPx: number;
  /** Effacement doux SOUS la bande (de `opacite` à transparent), en px ; absent : la bande s'arrête net. */
  fonduBasPx?: number;
}

/** Surlignage du mot mis en avant : fond et texte, et leurs couleurs pendant un écran clair (`passagesClairs`). */
export interface SurlignageSousTitres {
  fond: string;
  texte: string;
  /** Écran clair : fond et texte du surlignage (absents : `fond` et `texte`). */
  fondClair?: string;
  texteClair?: string;
}

/** Facecam lot F1 : colonne où la ligne se tient (écran partagé côte à côte), en px de l'image. */
export interface ColonneLigne {
  gauchePx: number;
  largeurPx: number;
}

export interface MotDessine {
  texte: string;
  couleur: string;
  opacite: number;
  /** Soulignement dessiné de gauche à droite : 0 (absent) à 1 (complet). */
  souligne: number;
  /** Style « Pastille » : grossissement et montée (px) du mot dit (absents : 1 et 0). */
  echelle?: number;
  monteePx?: number;
  /** C2-U7a : mot posé sur une plaque (absent : inchangé). */
  plaque?: true;
  /** C2-U8 : nom d'outil en étiquette ; « debut » et « fin » dessinent un nom en deux mots comme une seule pastille. Absent : inchangé. */
  etiquette?: "seul" | "debut" | "fin";
  /** BR-POIDS-VARIABLE-IV-a : graisse (500 à 800) du mot à cet instant ; absente : inchangé (aucune clé). */
  graisse?: number;
}

export interface ElementDessine {
  cle: string;
  gabarit: DefinitionGabarit;
  police: NomPolice;
  taillePx: number;
  /** Centre vertical, en px. */
  yPx: number;
  rotationDeg: number;
  echelle: number;
  opacite: number;
  decalageYPx: number;
  espacePx: number;
  mots: MotDessine[];
  fond?: { couleur: string; margeXPx: number; margeYPx: number };
  couleurSoulignement: string;
  /** Facecam lot F1 : la ligne est centrée dans cette colonne (absente : sur toute la largeur). */
  colonne?: ColonneLigne;
  /** Écran clair : couleur du texte posée ; ni contour ni ombre (absent : inchangé). */
  clair?: string;
  /** Style « Pastille » : la pastille pleine derrière le groupe (absente : inchangé). */
  pastille?: { fond: string; texte: string; poids: number; margeXPx: number; margeYPx: number; ombre: string; bord?: string };
  /** Lot L3b : le mot souligné est surligné (fond derrière le mot) ; absent : trait, inchangé. */
  surlignage?: { fond: string; texte: string };
  /** C2-U6 : marge du surlignage de part et d'autre (px), présente seulement avec une cible de marqueur. */
  margeMarqueurPx?: number;
}

/** Échelle de la lettre : `echelleTexte` (facecam F1), sinon largeur / 1 080 (comme avant). */
const echelleDe = (d: Pick<DonneesCalque, "largeur" | "echelleTexte">) => d.echelleTexte ?? d.largeur / 1080;

/** Épaisseur du trait de soulignement (catalogue : ~10 px), dessiné en 150 ms. */
export const SOULIGNEMENT = { epaisseurPx: 10, dureeSec: 0.15 };

/** Surlignage (lot L3b) : marge de chaque côté du mot, haut et bas du fond (en em), arrondi (em), texte à mi-tracé. */
export const SURLIGNAGE = { margeXEm: 0.1, hautEm: 0.1, basEm: -0.02, arrondiEm: 0.14, texteDes: 0.5 };

const borne = (x: number, min = 0, max = 1) => Math.min(max, Math.max(min, x));

/** Groupe affiché à l'instant t (aucun pendant un blanc). */
export function segmentAuTemps(segments: SegmentSousTitres[], t: number): SegmentSousTitres | null {
  return segments.find((s) => t >= s.debutSec && t < s.finSec) ?? null;
}

function centrePct(d: DonneesCalque, positionDemandee: PositionGroupeSousTitres | undefined, t: number, debutGroupeSec = t): number {
  const position = positionDemandee === "bas" && bandeauActif(d.bandeauNom, t) ? "auto" : positionDemandee;
  if (position === "haut") return d.positions.hautPct;
  if (position === "bas") return d.positions.basPct;
  const jonction = d.passagesJonction?.find((p) => t >= p.debutSec - 1e-6 && t < p.finSec - 1e-6);
  if (jonction && (position === "auto" || position === "milieu" || position === undefined)) return jonction.centrePct;
  if (d.ouverture && debutGroupeSec < d.ouverture.finSec - 1e-6 && (position === "auto" || position === "milieu" || position === undefined)) return d.ouverture.milieuPct;
  if (position === "auto" || position === undefined) {
    const poitrine = d.plansPoitrine?.some((p) => t >= p.debutSec && t < p.finSec);
    if (poitrine && d.positions.poitrinePct) return d.positions.poitrinePct;
  }
  return d.positions.milieuPct;
}

/**
 * Couleur d'un mot « à venir » : sa couleur fondue vers celle du contour (`part` = ancienne opacité, 45 %), en couleur
 * PLEINE. E2E-1 n° 5 (03/10) : l'opacité de 45 % pâlissait AUSSI le contour, et le mot devenait presque invisible
 * sur un fond clair (rabat blanc de la robe). Même teinte qu'avant sur un fond sombre, contour entier partout.
 */
export function couleurAVenir(couleur: string, contour: string, part: number): string {
  const rgb = (hex: string) => {
    const h = hex.trim().replace("#", "");
    const x = h.length === 3 ? h.replace(/./g, "$&$&") : h;
    return /^[0-9a-f]{6}$/i.test(x) ? [0, 8, 16].map((d) => (parseInt(x, 16) >> (16 - d)) & 255) : null;
  };
  const a = rgb(couleur);
  const b = rgb(contour);
  if (!a || !b) return couleur;
  return `#${a.map((v, i) => Math.round(v * part + b[i] * (1 - part)).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

/** Couleur et opacité de chaque mot selon le style (karaoké : dits crème, en cours orange, à venir fondus à 45 %). */
function motsDessines(s: SegmentSousTitres, g: DefinitionGabarit, c: CouleursSousTitres, t: number, cible?: CibleDessin): MotDessine[] {
  // Accents en majuscules (Impact, Bandeau) : sans ponctuation finale (point, virgule, deux-points, E2E-1 n° 11 :
  // « TOUT DE SUITE » et non « TOUT DE SUITE : »), comme les maquettes validées. Un signe seul disparaît.
  const sansPoint = (texte: string, k: number) => (g.casse === "majuscules" && k === s.mots.length - 1 ? texte.replace(/[\s\u00A0\u202F]*[.,;:]+$/, "") : texte);
  return dessines(s, g, c, t, sansPoint, cible).filter((m, k, tous) => !(g.casse === "majuscules" && k === tous.length - 1 && k > 0 && !m.texte.trim()));
}

/** C2-U6 : cible du marqueur et base de la vidéo (pour le repli de « mot-dit » hors karaoké). */
export interface CibleDessin {
  cible: Exclude<CibleMarqueurRendu, "souligne">;
  base: BaseSousTitres;
}

const NB_MOTS_EXPRESSION = 4;
const MONTEE_MOT_DIT_SEC = 0.1;

/** C2-U6 : indices de la suite contiguë autour du mot souligné (valeur, nombre ou mot fort), 4 mots au plus. */
function suiteExpression(s: SegmentSousTitres): Set<number> {
  const k = s.souligne;
  if (k === null || k === undefined || !s.mots[k]) return new Set();
  const compte = (i: number) => {
    const m = s.mots[i];
    return !!m && (m.enValeur || estNombre(m.mot) || MOTS_FORTS.has(normaliser(m.mot)));
  };
  const suite = [k];
  for (let i = k - 1; i >= 0 && suite.length < NB_MOTS_EXPRESSION && compte(i); i--) suite.push(i);
  for (let i = k + 1; i < s.mots.length && suite.length < NB_MOTS_EXPRESSION && compte(i); i++) suite.push(i);
  return new Set(suite);
}

function dessines(s: SegmentSousTitres, g: DefinitionGabarit, c: CouleursSousTitres, t: number, sansPoint: (texte: string, k: number) => string, cible?: CibleDessin): MotDessine[] {
  const expression = cible?.cible === "expression" ? suiteExpression(s) : null;
  const motDit = cible?.cible === "mot-dit" && cible.base === "karaoke" && g.id === "karaoke";
  return s.mots.map((brut, k) => {
    const m = { ...brut, mot: sansPoint(brut.mot, k) };
    const finActifMot = s.mots[k + 1]?.debutSec ?? Math.max(m.finSec, s.finSec);
    const souligne = motDit
      ? m.debutSec <= t && t < finActifMot ? borne((t - m.debutSec) / MONTEE_MOT_DIT_SEC) : 0
      : expression
        ? expression.has(k) ? borne((t - m.debutSec) / SOULIGNEMENT.dureeSec) : 0
        : s.souligne === k ? borne((t - Math.max(s.debutSec, m.debutSec)) / SOULIGNEMENT.dureeSec) : 0;
    const exclu = motDit ? false : s.souligne === k;
    const cle = g.motCle !== "aucun" && (m.enValeur || (g.id === "impact" && estNombre(m.mot))) && !exclu;
    if (g.id === "bandeau") return { texte: m.mot, couleur: cle ? c.accent : c.contour, opacite: 1, souligne };
    if (g.animation === "karaoke") {
      const finActif = s.mots[k + 1]?.debutSec ?? Math.max(m.finSec, s.finSec);
      if (t < m.debutSec) return { texte: m.mot, couleur: couleurAVenir(cle ? c.accent : c.texte, c.contour, g.opaciteAVenir ?? 0.45), opacite: 1, souligne };
      if (t < finActif && !(motDit ? false : s.souligne === k)) return { texte: m.mot, couleur: c.accent, opacite: 1, souligne };
      return { texte: m.mot, couleur: cle ? c.accent : c.texte, opacite: 1, souligne };
    }
    return { texte: m.mot, couleur: cle ? c.accent : c.texte, opacite: 1, souligne };
  });
}

/** Entrée du groupe : fondu (Minimal), rebond 0,9 → 1,05 → 1 (Impact), glissement court des accents (≤ 40 px). */
function entree(g: DefinitionGabarit, s: SegmentSousTitres, t: number, glissement = true): { opacite: number; echelle: number; decalageYPx: number } {
  const e = t - s.debutSec;
  let opacite = 1;
  let echelle = 1;
  let decalageYPx = 0;
  if (g.animation === "fondu") opacite = borne(e / (g.entreeMs / 1000 || 0.12));
  if (g.animation === "rebond") echelle = e < 0.12 ? 0.9 + 0.15 * borne(e / 0.12) : e < 0.24 ? 1.05 - 0.05 * borne((e - 0.12) / 0.12) : 1;
  if (glissement && s.style && s.style !== "base" && (s.inclinaison !== 0 || s.style === "bandeau")) {
    const sens = s.position === "haut" ? -1 : 1;
    decalageYPx = sens * 40 * (1 - borne(e / 0.12));
  }
  return { opacite, echelle, decalageYPx };
}

/** Ce qu'il faut dessiner à l'instant t, ou null (blanc). */
export function sceneAuTemps(d: DonneesCalque, t: number): ElementDessine | null {
  const s = segmentAuTemps(d.segments, t);
  if (!s) {
    // C2-U19 : éteint (champ absent ou interrupteur éteint), disparition nette comme avant.
    const fini = SORTIE_ACTIVE && d.sortie ? segmentEnSortie(d.segments, d.sortie, t) : null;
    const etat = fini && d.sortie ? sortieDuGroupe(d.sortie, fini.finSec, t) : null;
    if (!fini || !etat) return null;
    const el = elementDe(d, fini, fini.finSec - 1e-6);
    return { ...el, opacite: el.opacite * etat.opacite, decalageYPx: el.decalageYPx + etat.decalageYPx * echelleDe(d) };
  }
  return elementDe(d, s, t);
}

/**
 * BR-ESCALIER : lignes de l'escalier à l'instant t (le groupe actif et les précédents de la même phrase, 6 au plus).
 * `null` si le champ `escalier` est absent ou si aucun groupe n'est actif. Pure, ne lève jamais.
 */
export function escalierAuTemps(d: DonneesCalque, t: number): { lignes: string[]; ligneActive: number } | null {
  if (!d.escalier) return null;
  const segments = d.segments;
  const i = segments.findIndex((s) => t >= s.debutSec && t < s.finSec);
  if (i < 0) return null;
  const texte = (s: SegmentSousTitres) => s.mots.map((m) => m.mot).join(" ").trim();
  let debut = i;
  while (debut > 0 && i - debut < 5 && !/[.!?…]["»”’')\]]*$/.test(texte(segments[debut - 1]))) debut--;
  const lignes = segments.slice(debut, i + 1).map(texte);
  return { lignes, ligneActive: lignes.length - 1 };
}

/** BR-PAVE-MARQUES : la plaque animée du mot à plaque du groupe affiché à l'instant t. */
export interface PaveAuTemps {
  /** Boîte du mot SANS la marge de la plaque, en px de l'image. */
  boite: BoitePave;
  taillePx: number;
  /** Instant (s) où le mot est dit : l'entrée de la plaque part de là. */
  debutS: number;
  texte: string;
  police: ElementDessine["police"];
  /** Indice du mot à plaque dans le groupe. */
  indice: number;
  marque?: MarqueMot;
  /** Graine de la marque : l'id du groupe (une vidéo donne toujours les mêmes formes). */
  graine: string;
  /** Opacité et décalage vertical du groupe (entrée, sortie animée) : la plaque les suit. */
  opaciteGroupe: number;
  decalageYPx: number;
}

/**
 * BR-PAVE-MARQUES : boîte du mot à plaque du groupe affiché (le même calcul de largeurs que la plaque fixe d'aujourd'hui),
 * sa date de début et sa marque. `null` si `paveAnime` n'est pas exactement `true`, sans groupe, sans mot à plaque (ou
 * mot remplacé par une étiquette d'outil). Pure, ne lève jamais.
 */
export function paveAuTemps(d: DonneesCalque, t: number): PaveAuTemps | null {
  if (d.paveAnime !== true) return null;
  const el = sceneAuTemps(d, t);
  if (!el) return null;
  const s = d.segments.find((g) => g.id === el.cle);
  const k = el.mots.findIndex((m) => m.plaque);
  const mot = s?.mots[k];
  if (!s || k < 0 || !mot) return null;
  const options = { majuscules: el.gabarit.casse === "majuscules", chiffresTabulaires: true };
  const mx = PAVE.margeXEm * el.taillePx;
  const extra = (m: MotDessine) => (m.plaque ? 2 * mx : 0) + (m.etiquette === "seul" ? 2 * ETIQUETTE.margeXEm * el.taillePx : m.etiquette === "debut" || m.etiquette === "fin" ? ETIQUETTE.margeXEm * el.taillePx : 0);
  const largeurs = el.mots.map((m) => largeurMot(m.texte, el.police, el.taillePx, options));
  const gauche = el.mots.slice(0, k).reduce((n, m, i) => n + largeurs[i] + extra(m) + el.espacePx, 0);
  const total = largeurElement(el);
  const zone = el.colonne ? { x: el.colonne.gauchePx, l: el.colonne.largeurPx } : { x: 0, l: d.largeur };
  const hauteur = 1.1 * el.taillePx;
  return {
    boite: { xPx: zone.x + (zone.l - total) / 2 + (el.fond?.margeXPx ?? 0) + gauche + mx, yPx: el.yPx - hauteur / 2, largeurPx: largeurs[k], hauteurPx: hauteur },
    taillePx: el.taillePx,
    debutS: mot.debutSec,
    texte: el.mots[k].texte,
    police: el.police,
    indice: k,
    ...(d.marques?.[s.id] ? { marque: d.marques[s.id] } : {}),
    graine: s.id,
    opaciteGroupe: el.opacite,
    decalageYPx: el.decalageYPx,
  };
}

/**
 * BR-MINIMAL-IV-b : la ligne de la boîte arrondie du groupe actif (même zone, mêmes largeurs et même `yPx` que `paveAuTemps`).
 * `null` sans `boite` ou sans groupe actif. Pure, ne lève jamais.
 */
export function boiteAuTemps(d: DonneesCalque, t: number): LigneBoite[] | null {
  if (!d.boite) return null;
  const el = sceneAuTemps(d, t);
  if (!el || el.mots.length === 0) return null;
  const total = largeurElement(el);
  const zone = el.colonne ? { x: el.colonne.gauchePx, l: el.colonne.largeurPx } : { x: 0, l: d.largeur };
  const hauteur = 1.1 * el.taillePx;
  return [{ x: zone.x + (zone.l - total) / 2, y: el.yPx - hauteur / 2 + el.decalageYPx, largeur: total, hauteur }];
}

/** BR-POIDS-VARIABLE-IV-a : chaque mot porte sa graisse du moment (seulement `poidsVariable` posé) ; sinon les mots tels quels. */
function avecGraisse(d: DonneesCalque, s: SegmentSousTitres, t: number, mots: MotDessine[]): MotDessine[] {
  if (d.poidsVariable !== true) return mots;
  return mots.map((m, k) => (s.mots[k] ? { ...m, graisse: graisseAuTemps(t, s.mots[k].debutSec, s.mots[k].finSec) } : m));
}

/** Dessin d'un groupe donné à l'instant t (aperçu d'un groupe touché, captures). */
export function elementDe(d: DonneesCalque, s: SegmentSousTitres, t: number): ElementDessine {
  if (d.pastille) return elementPastille(d, d.pastille, s, t);
  const g = GABARITS[s.style === "impact" ? "impact" : s.style === "bandeau" ? "bandeau" : d.base];
  const echelleImage = echelleDe(d);
  const relative = s.style === "base" || !s.style ? (d.tailleRelative ?? 1) : 1;
  const voulue = g.taillePx * facteurTaille(s) * relative * echelleImage;
  const marges = g.bandeau ? 2 * g.bandeau.margeXEm * voulue : 0;
  const options = { majuscules: g.casse === "majuscules", chiffresTabulaires: true, espaceMotsEm: g.espaceMotsEm };
  // Facecam F1 : écran partagé côte à côte, la ligne ne dépasse pas la colonne de Will.
  const colonne = d.passagesJonction?.find((p) => t >= p.debutSec - 1e-6 && t < p.finSec - 1e-6)?.colonne;
  const libre = d.echelleTexte !== undefined ? d.largeurMaxPx : d.largeurMaxPx * echelleImage;
  const outil = d.motsOutils?.[s.id];
  const indiceBrut = d.plaques?.[s.id];
  // C2-U8 : une étiquette l'emporte sur la plaque pour son mot.
  const indicePlaque = indiceBrut !== undefined && outil && indiceBrut >= outil.debut && indiceBrut < outil.debut + outil.longueur ? undefined : indiceBrut;
  const margePlaque = indicePlaque === undefined ? 0 : 2 * PAVE.margeXEm * voulue;
  const margeEtiquette = outil ? 2 * ETIQUETTE.margeXEm * voulue : 0;
  const disponible = (colonne ? Math.min(libre, colonne.largeurPx) : libre) - marges - g.contourPx * echelleImage - margePlaque - margeEtiquette;
  const taillePx = tailleQuiTient(
    s.mots.map((m) => m.mot),
    d.poidsVariable === true ? "Manrope ExtraBold" : g.police, // poids variable : la ligne tient à la graisse 800, la plus large
    voulue,
    disponible,
    options,
  );
  const { opacite, echelle, decalageYPx } = entree(g, s, t, d.glissement !== false);
  const passage = d.passagesClairs?.find((p) => t >= p.debutSec - 1e-6 && t < p.finSec - 1e-6)?.texte;
  // FIX-MINIMAL-FOND-CLAIR-v21s : Minimal (sans contour) sur décor clair = écrit en foncé, comme un écran clair ; un passage clair réel l'emporte.
  const minimalSurClair = g.contourPx === 0 && !g.bandeau && (d.facteurOmbre ?? 1) > 1 ? d.couleurs.contour : undefined;
  const clair = passage ?? minimalSurClair;
  const couleurs = clair ? { ...d.couleurs, texte: clair } : d.couleurs;
  // Lot L3b : surlignage (fond derrière le mot souligné) ; ses couleurs d'écran clair pendant un passage clair.
  const surlignage = d.surlignage ? (clair ? { fond: d.surlignage.fondClair ?? d.surlignage.fond, texte: d.surlignage.texteClair ?? d.surlignage.texte } : { fond: d.surlignage.fond, texte: d.surlignage.texte }) : undefined;
  const motsBase = motsDessines(s, g, couleurs, t, d.cibleMarqueur ? { cible: d.cibleMarqueur, base: d.base } : undefined);
  const motsPlaque = indicePlaque === undefined ? motsBase : motsBase.map((m, k) => (k === indicePlaque ? { ...m, plaque: true as const } : m));
  const mots = outil
    ? motsPlaque.map((m, k) => (k >= outil.debut && k < outil.debut + outil.longueur ? { ...m, etiquette: (outil.longueur === 1 ? "seul" : k === outil.debut ? "debut" : "fin") as MotDessine["etiquette"] } : m))
    : motsPlaque;
  return {
    cle: s.id,
    gabarit: g,
    police: g.police,
    taillePx,
    yPx: (centrePct(d, s.position, t, s.debutSec) / 100) * d.hauteur,
    rotationDeg: s.style === "impact" ? (s.inclinaison ?? 0) : 0,
    echelle,
    opacite,
    decalageYPx: decalageYPx * echelleImage,
    espacePx: g.espaceMotsEm * taillePx,
    mots: avecGraisse(d, s, t, surlignage ? mots.map((m) => (m.souligne >= SURLIGNAGE.texteDes && !m.etiquette ? { ...m, couleur: surlignage.texte } : m)) : mots),
    fond: g.bandeau ? { couleur: d.couleurs.texte, margeXPx: g.bandeau.margeXEm * taillePx, margeYPx: g.bandeau.margeYEm * taillePx } : undefined,
    couleurSoulignement: d.couleurs.accent,
    ...(colonne ? { colonne } : {}),
    ...(clair ? { clair } : {}),
    ...(surlignage ? { surlignage } : {}),
    ...(d.cibleMarqueur ? { margeMarqueurPx: 2 * SURLIGNAGE.margeXEm * taillePx } : {}),
  };
}

const douce = (x: number) => {
  const u = borne(x);
  return u * u * (3 - 2 * u);
};

/** Le groupe commence au plus 0,15 s après la fin du précédent (la pastille reste à l'écran entre les deux). */
function suitUnGroupe(segments: SegmentSousTitres[], s: SegmentSousTitres): boolean {
  return segments.some((x) => x !== s && x.finSec <= s.debutSec + 1e-6 && x.finSec >= s.debutSec - 0.15);
}

/**
 * Style « Pastille Axion » : le groupe au style de base (toujours au centre de la ligne « auto », jamais d'accent ni
 * d'inclinaison), dans une pastille pleine ; le mot en cours (de son début au début du mot suivant) en `motDit`, qui
 * grossit et monte en `arriveeMotMs` puis redescend aussi vite quand le suivant arrive ; fondu court du groupe après un
 * blanc (jamais entre deux groupes qui se suivent).
 */
function elementPastille(d: DonneesCalque, p: StylePastille, s: SegmentSousTitres, t: number): ElementDessine {
  const g = GABARITS[d.base];
  // C2-U14 : éteint, la police du gabarit (comme avant) ; allumé, Manrope Bold pour la mesure comme pour le dessin.
  const police: NomPolice = pastilleEnManrope(p) ? "Manrope Bold" : g.police;
  const e = echelleDe(d);
  const margeXPx = p.margeX * 1080 * e;
  const margeYPx = p.margeY * 1080 * e;
  const options = { majuscules: false, chiffresTabulaires: true, espaceMotsEm: p.espaceMotsEm };
  const libre = d.echelleTexte !== undefined ? d.largeurMaxPx : d.largeurMaxPx * e;
  const voulue = p.taillePx * (d.tailleRelative ?? 1) * e;
  const taillePx = Math.max(p.tailleMinPx * e, tailleQuiTient(s.mots.map((m) => m.mot), police, voulue, libre - 2 * margeXPx, options));
  const arrivee = p.arriveeMotMs / 1000;
  const mots: MotDessine[] = s.mots.map((m, k) => {
    const fin = s.mots[k + 1]?.debutSec ?? Math.max(m.finSec, s.finSec);
    const dit = t >= m.debutSec && t < fin;
    // Monte à l'arrivée du mot, redescend pendant l'arrivée du suivant (aucun saut d'une image à l'autre).
    const u = t < m.debutSec ? 0 : t < fin ? douce((t - m.debutSec) / arrivee) : 1 - douce((t - fin) / arrivee);
    // Le grossissement ne mange jamais l'espace entre deux mots : au plus `debordMotDitEm` de chaque côté (mot long).
    const zoom = Math.min(p.zoomMotDit, 1 + (2 * p.debordMotDitEm * taillePx) / Math.max(1, largeurMot(m.mot, police, taillePx, options)));
    return { texte: m.mot, couleur: dit ? p.motDit : p.texte, opacite: 1, souligne: 0, echelle: 1 + (zoom - 1) * u, monteePx: -p.monteeMotDitEm * taillePx * u };
  });
  const o = p.ombre;
  return {
    cle: s.id,
    gabarit: g,
    police,
    taillePx,
    yPx: (centrePct(d, "auto", t, s.debutSec) / 100) * d.hauteur,
    rotationDeg: 0,
    echelle: 1,
    // Fondu court seulement après un blanc : deux groupes qui se suivent s'enchaînent sans que la pastille clignote.
    opacite: suitUnGroupe(d.segments, s) ? 1 : borne((t - s.debutSec) / (p.entreeMs / 1000 || 0.12)),
    decalageYPx: 0,
    espacePx: p.espaceMotsEm * taillePx,
    mots,
    couleurSoulignement: p.motDit,
    pastille: { fond: p.fond, texte: p.texte, poids: p.poids, margeXPx, margeYPx, ombre: `0 ${o.decalagePx * e}px ${o.flouPx * e}px ${rgba(p.fond, o.opacite)}`, ...(p.bord ? { bord: `${Math.max(1, Math.round(p.bord.px * e))}px solid ${p.bord.couleur}` } : {}) },
  };
}

/** Largeur d'un mot : celle de sa police ; avec une graisse (poids variable), la largeur réservée à 800, la plus large. */
function largeurDuMot(m: MotDessine, el: ElementDessine, options: { majuscules: boolean; chiffresTabulaires: boolean }): number {
  if (m.graisse === undefined) return largeurMot(m.texte, el.police, el.taillePx, options);
  return options.majuscules ? largeurReservee(m.texte.toLocaleUpperCase("fr-FR"), el.taillePx) : largeurReservee(m.texte, el.taillePx);
}

/** Largeur rendue d'un élément dessiné, en px (contrôle de débordement). */
export function largeurElement(el: ElementDessine): number {
  const options = { majuscules: el.gabarit.casse === "majuscules", chiffresTabulaires: true };
  const texte = el.mots.reduce((s, m) => s + largeurDuMot(m, el, options), 0) + el.espacePx * Math.max(0, el.mots.length - 1);
  return texte + (el.fond ? 2 * el.fond.margeXPx : 0) + (el.pastille ? 2 * el.pastille.margeXPx : 0) + (el.margeMarqueurPx ?? 0) + el.mots.reduce((n, m) => n + (m.plaque ? 2 * PAVE.margeXEm * el.taillePx : 0) + (m.etiquette === "seul" ? 2 * ETIQUETTE.margeXEm * el.taillePx : m.etiquette === "debut" || m.etiquette === "fin" ? ETIQUETTE.margeXEm * el.taillePx : 0), 0);
}

export type Css = Record<string, string | number>;

/**
 * Styles CSS d'un élément dessiné (les mêmes pour Remotion et le navigateur) : `conteneur` (pleine largeur,
 * centré sur `yPx`), `ligne` (texte + bandeau), `mot(i)` et `trait(i)` (soulignement).
 * `famille` : nom CSS de la police chargée par chaque côté pour `el.police`.
 */
export function cssElement(el: ElementDessine, d: Pick<DonneesCalque, "couleurs" | "largeur" | "facteurOmbre" | "echelleTexte" | "encre">, famille: string): { conteneur: Css; ligne: Css; mot: (i: number) => Css; trait: (i: number) => Css } {
  const echelleImage = echelleDe(d);
  const ligne: Css = {
    ...cssLigne(el.gabarit, el.taillePx, d.couleurs, famille),
    display: "inline-flex",
    alignItems: "baseline",
    gap: el.espacePx,
    position: "relative",
  };
  if (el.gabarit.contourPx > 0) ligne.WebkitTextStroke = `${el.gabarit.contourPx * echelleImage}px ${d.couleurs.contour}`;
  // Décor clair (lot M4) : ombre plus large et plus dense, plus un halo sombre qui détache la lettre du fond.
  const f = d.facteurOmbre ?? 1;
  if (f > 1 && !el.fond) {
    const o = el.gabarit.ombre;
    ligne.textShadow = `0 ${o.decalagePx * f * echelleImage}px ${Math.max(4, o.flouPx) * f * echelleImage}px ${rgba(d.couleurs.contour, Math.min(1, Math.max(0.5, o.opacite) * f))}, 0 0 ${10 * f * echelleImage}px ${rgba(d.couleurs.contour, 0.55)}`;
  }
  // Style « Encre » (et écran clair du cas concret) : l'encre sur la page se lit seule ; une ombre ou un contour la salirait.
  if (d.encre || el.clair) {
    delete ligne.textShadow;
    delete ligne.WebkitTextStroke;
  }
  // Style « Pastille » : pastille pleine aux coins entièrement arrondis, ombre très douce, lettre sans contour ni ombre.
  if (el.pastille) {
    delete ligne.textShadow;
    delete ligne.WebkitTextStroke;
    ligne.fontWeight = el.pastille.poids;
    ligne.color = el.pastille.texte;
    ligne.background = el.pastille.fond;
    ligne.padding = `${el.pastille.margeYPx}px ${el.pastille.margeXPx}px`;
    ligne.borderRadius = 9999;
    ligne.boxShadow = el.pastille.ombre;
    if (el.pastille.bord) ligne.border = el.pastille.bord;
    ligne.lineHeight = 1.15;
  }
  if (el.fond) {
    ligne.background = el.fond.couleur;
    ligne.padding = `${el.fond.margeYPx}px ${el.fond.margeXPx}px`;
    ligne.lineHeight = 1;
  }
  return {
    conteneur: {
      position: "absolute",
      ...(el.colonne ? { left: el.colonne.gauchePx, width: el.colonne.largeurPx } : { left: 0, right: 0 }),
      top: el.yPx,
      display: "flex",
      justifyContent: "center",
      transform: `translateY(-50%) translateY(${el.decalageYPx}px) rotate(${el.rotationDeg}deg) scale(${el.echelle})`,
      transformOrigin: "50% 50%",
      opacity: el.opacite,
      pointerEvents: "none",
    },
    ligne,
    mot: (i) => {
      const m = el.mots[i];
      const css: Css = { color: m.couleur, opacity: m.opacite, position: "relative", display: "inline-block" };
      // BR-POIDS-VARIABLE-IV-a : graisse du moment, dans une boîte de la largeur réservée à 800 (la ligne ne bouge pas).
      if (m.graisse !== undefined) {
        css.fontWeight = m.graisse;
        css.width = largeurDuMot(m, el, { majuscules: el.gabarit.casse === "majuscules", chiffresTabulaires: true });
        css.textAlign = "center";
      }
      if ((m.echelle !== undefined && m.echelle !== 1) || m.monteePx) {
        css.transform = `translateY(${(m.monteePx ?? 0).toFixed(2)}px) scale(${(m.echelle ?? 1).toFixed(4)})`;
        css.transformOrigin = "50% 70%";
      }
      // C2-U7a : plaque derrière le mot-clé (la marge élargit la ligne, `largeurElement` la compte).
      if (m.plaque) {
        css.background = d.couleurs.accent;
        css.color = d.couleurs.contour;
        css.padding = `${PAVE.margeYEm * el.taillePx}px ${PAVE.margeXEm * el.taillePx}px`;
        css.borderRadius = PAVE.rayonEm * el.taillePx;
        css.WebkitTextStroke = "0";
        css.textShadow = "none";
      }
      // C2-U8 : étiquette de nom d'outil (pastille noire, lettre ivoire, filet gris). Un nom en deux mots n'est qu'une pastille.
      if (m.etiquette) {
        const x = ETIQUETTE.margeXEm * el.taillePx;
        const bord = `${ETIQUETTE.bordPx * echelleImage}px solid ${ETIQUETTE.bord}`;
        const rayon = ETIQUETTE.rayonEm * el.taillePx;
        const debut = m.etiquette === "seul" || m.etiquette === "debut";
        const fin = m.etiquette === "seul" || m.etiquette === "fin";
        css.background = ETIQUETTE.fond;
        css.color = ETIQUETTE.texte;
        css.padding = `${ETIQUETTE.margeYEm * el.taillePx}px ${fin ? x : el.espacePx}px ${ETIQUETTE.margeYEm * el.taillePx}px ${debut ? x : 0}px`;
        if (!fin) css.marginRight = -el.espacePx;
        css.border = bord;
        if (!fin) css.borderRight = "none";
        if (!debut) css.borderLeft = "none";
        css.borderRadius = `${debut ? rayon : 0}px ${fin ? rayon : 0}px ${fin ? rayon : 0}px ${debut ? rayon : 0}px`;
        css.WebkitTextStroke = "0";
        css.textShadow = "none";
        return css;
      }
      // Lot L3b : mot surligné, lettre nette sur son fond (ni contour ni ombre).
      if (el.surlignage && m.souligne >= SURLIGNAGE.texteDes) {
        css.WebkitTextStroke = "0";
        css.textShadow = "none";
      }
      return css;
    },
    trait: (i) => (el.mots[i].etiquette ? { display: "none" } : el.surlignage ? traitSurlignage(el, el.surlignage.fond, el.mots[i].souligne) : {
      position: "absolute",
      left: 0,
      bottom: `${-0.06 * el.taillePx}px`,
      height: SOULIGNEMENT.epaisseurPx * echelleImage,
      width: `${el.mots[i].souligne * 100}%`,
      borderRadius: (SOULIGNEMENT.epaisseurPx * echelleImage) / 2,
      background: el.couleurSoulignement,
      WebkitTextStroke: "0",
    }),
  };
}

/** Lot L3b : fond du surlignage, derrière le mot (plan arrière du conteneur), tracé de gauche à droite comme le trait. */
function traitSurlignage(el: ElementDessine, fond: string, avance: number): Css {
  const marge = SURLIGNAGE.margeXEm * el.taillePx;
  return {
    position: "absolute",
    left: -marge,
    top: SURLIGNAGE.hautEm * el.taillePx,
    bottom: SURLIGNAGE.basEm * el.taillePx,
    width: `calc(${(avance * 100).toFixed(2)}% + ${(2 * marge * avance).toFixed(2)}px)`,
    borderRadius: SURLIGNAGE.arrondiEm * el.taillePx,
    background: fond,
    zIndex: -1,
    WebkitTextStroke: "0",
  };
}

/**
 * Styles CSS de la bande de fond (`bandeFond`) : dégradé doux vers le haut, la couleur à `opacite` jusqu'au bas de la
 * bande, puis, s'il est demandé, un effacement doux sous la bande.
 */
export function cssBandeFond(b: BandeFondSousTitres): Css {
  const plein = rgba(b.couleur, b.opacite);
  const vide = rgba(b.couleur, 0);
  const fondu = Math.max(0, Math.min(b.fonduPx, b.hauteurPx));
  const bas = Math.max(0, b.fonduBasPx ?? 0);
  const total = b.hauteurPx + bas;
  return {
    position: "absolute",
    left: b.xPx,
    top: b.yPx,
    width: b.largeurPx,
    height: total,
    background: `linear-gradient(to bottom, ${vide} 0px, ${plein} ${fondu.toFixed(1)}px, ${plein} ${b.hauteurPx.toFixed(1)}px, ${bas ? vide : plein} ${total.toFixed(1)}px)`,
    pointerEvents: "none",
  };
}

/** 17/11 (FIX-SOUS-TITRES-TABLEAU, lot D) : un blanc plus court que ceci entre deux sous-titres garde la bande (elle ne clignote pas), en secondes. */
export const BANDE_FOND_PONT_SEC = 0.6;
/** 17/11 (lot D) : durée du fondu de la bande avant un sous-titre et après le dernier d'une suite, en secondes. */
export const BANDE_FOND_FONDU_SEC = 0.2;

/**
 * 17/11 (lot D) : opacité (0 à 1) de la bande sombre de fond à l'instant t : la bande n'existe que quand un sous-titre est
 * écrit. 0 sans `bandeFond` ou sans segment ; 1 pendant un segment (temps de sortie du groupe compris) et dans un blanc
 * plus court que `BANDE_FOND_PONT_SEC` ; sinon fondu linéaire de `BANDE_FOND_FONDU_SEC` après la fin d'un segment et avant
 * le début du suivant ; 0 ailleurs (avant le premier mot, page de fin, longs silences). Pure.
 */
export function opaciteBandeFond(d: DonneesCalque, t: number): number {
  if (!d.bandeFond || d.segments.length === 0) return 0;
  const sortie = SORTIE_ACTIVE && d.sortie ? Math.max(0, d.sortie.dureeSec) : 0;
  let finPrecedente = -Infinity;
  let debutSuivant = Infinity;
  for (const s of d.segments) {
    const fin = s.finSec + sortie;
    if (t >= s.debutSec && t < fin) return 1;
    if (fin <= t && fin > finPrecedente) finPrecedente = fin;
    if (s.debutSec > t && s.debutSec < debutSuivant) debutSuivant = s.debutSec;
  }
  if (Number.isFinite(finPrecedente) && Number.isFinite(debutSuivant) && debutSuivant - finPrecedente < BANDE_FOND_PONT_SEC) return 1;
  const sortant = Number.isFinite(finPrecedente) ? 1 - (t - finPrecedente) / BANDE_FOND_FONDU_SEC : 0;
  const entrant = Number.isFinite(debutSuivant) ? 1 - (debutSuivant - t) / BANDE_FOND_FONDU_SEC : 0;
  return Math.max(0, Math.min(1, Math.max(sortant, entrant)));
}

/** Étiquette d'outil autonome dessinée à l'instant t. */
export interface EtiquetteOutilDessinee {
  id: string;
  texte: string;
  opacite: number;
  taillePx: number;
  /** Centre vertical (px) : la zone libre haute `positions.hautPct`. */
  yPx: number;
  largeurPx: number;
  hauteurPx: number;
}

/**
 * C2-U9 : étiquette visible à l'instant t, ou null. Fondu montant puis descendant de 0,2 s (courbes de la charte, sans
 * rebond). Se replie pendant l'encadré d'ouverture et pendant le bandeau « nom et fonction ». Champ absent : null.
 */
export function etiquetteAuTemps(d: DonneesCalque, t: number): EtiquetteOutilDessinee | null {
  const e = d.etiquettesOutils?.find((x) => t >= x.debutSec && t < x.finSec);
  if (!e) return null;
  if (bandeauActif(d.bandeauNom, t) || (d.ouverture && t < d.ouverture.finSec - 1e-6)) return null;
  const A = ETIQUETTE_AUTONOME;
  const entree = progres(t, e.debutSec, A.fonduSec, "signature");
  const sortie = progres(t, e.finSec - A.fonduSec, A.fonduSec, "sortie");
  const echelle = d.largeur / 1080;
  const marge = 2 * A.margeXEm;
  const taillePx = tailleQuiTient([e.texte], "Manrope ExtraBold", A.tailleBasePx * echelle, d.largeurMaxPx / (1 + marge));
  return {
    id: e.id,
    texte: e.texte,
    opacite: Math.min(entree, 1 - sortie),
    taillePx,
    yPx: (d.positions.hautPct / 100) * d.hauteur,
    largeurPx: largeurLigne([e.texte], "Manrope ExtraBold", taillePx) + marge * taillePx,
    hauteurPx: taillePx * (1.2 + 2 * A.margeYEm),
  };
}

/** Styles CSS de l'étiquette autonome (les mêmes pour Remotion et le navigateur) : plaque noire, lettres ivoire, filet gris. */
export function cssEtiquetteOutil(e: EtiquetteOutilDessinee, d: Pick<DonneesCalque, "largeur">, famille: string): { conteneur: Css; texte: Css } {
  return {
    conteneur: {
      position: "absolute",
      left: (d.largeur - e.largeurPx) / 2,
      top: e.yPx - e.hauteurPx / 2,
      width: e.largeurPx,
      height: e.hauteurPx,
      boxSizing: "border-box",
      opacity: e.opacite,
      background: ETIQUETTE.fond,
      border: `${ETIQUETTE.bordPx}px solid ${ETIQUETTE.bord}`,
      borderRadius: ETIQUETTE_AUTONOME.rayonEm * e.taillePx,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    texte: { fontFamily: famille, fontSize: e.taillePx, lineHeight: 1.2, whiteSpace: "nowrap", color: ETIQUETTE.texte },
  };
}
