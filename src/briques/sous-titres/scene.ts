/**
 * LE MOTEUR DE RENDU UNIQUE DES SOUS-TITRES. PUR, sans React ni Remotion : à un instant t, il dit EXACTEMENT quoi
 * dessiner (texte, police, taille, couleurs mot par mot, position, inclinaison, rebond, soulignement, bandeau).
 * Le calque Remotion (`studio-rendu/compositions/sous-titres/`) et l'aperçu du navigateur (`SousTitreAnime`) ne font
 * que traduire cette scène en éléments : un style ne peut donc jamais différer entre l'aperçu et la vidéo.
 */
import { largeurMot, tailleQuiTient, type NomPolice } from "./mesure";
import { cssLigne, facteurTaille, GABARITS, rgba, type CouleursSousTitres, type DefinitionGabarit } from "./style";
import { estNombre } from "./typographie";
import type { StylePastille } from "./pastille";
import type { BaseRendu as BaseSousTitres, PositionGroupeRendu as PositionGroupeSousTitres, SegmentRendu as SegmentSousTitres } from "./types-rendu";

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

function centrePct(d: DonneesCalque, position: PositionGroupeSousTitres | undefined, t: number, debutGroupeSec = t): number {
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
function motsDessines(s: SegmentSousTitres, g: DefinitionGabarit, c: CouleursSousTitres, t: number): MotDessine[] {
  // Accents en majuscules (Impact, Bandeau) : sans ponctuation finale (point, virgule, deux-points, E2E-1 n° 11 :
  // « TOUT DE SUITE » et non « TOUT DE SUITE : »), comme les maquettes validées. Un signe seul disparaît.
  const sansPoint = (texte: string, k: number) => (g.casse === "majuscules" && k === s.mots.length - 1 ? texte.replace(/[\s\u00A0\u202F]*[.,;:]+$/, "") : texte);
  return dessines(s, g, c, t, sansPoint).filter((m, k, tous) => !(g.casse === "majuscules" && k === tous.length - 1 && k > 0 && !m.texte.trim()));
}

function dessines(s: SegmentSousTitres, g: DefinitionGabarit, c: CouleursSousTitres, t: number, sansPoint: (texte: string, k: number) => string): MotDessine[] {
  return s.mots.map((brut, k) => {
    const m = { ...brut, mot: sansPoint(brut.mot, k) };
    const souligne = s.souligne === k ? borne((t - Math.max(s.debutSec, m.debutSec)) / SOULIGNEMENT.dureeSec) : 0;
    const cle = g.motCle !== "aucun" && (m.enValeur || (g.id === "impact" && estNombre(m.mot))) && s.souligne !== k;
    if (g.id === "bandeau") return { texte: m.mot, couleur: cle ? c.accent : c.contour, opacite: 1, souligne };
    if (g.animation === "karaoke") {
      const finActif = s.mots[k + 1]?.debutSec ?? Math.max(m.finSec, s.finSec);
      if (t < m.debutSec) return { texte: m.mot, couleur: couleurAVenir(cle ? c.accent : c.texte, c.contour, g.opaciteAVenir ?? 0.45), opacite: 1, souligne };
      if (t < finActif && s.souligne !== k) return { texte: m.mot, couleur: c.accent, opacite: 1, souligne };
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
  if (!s) return null;
  return elementDe(d, s, t);
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
  const disponible = (colonne ? Math.min(libre, colonne.largeurPx) : libre) - marges - g.contourPx * echelleImage;
  const taillePx = tailleQuiTient(
    s.mots.map((m) => m.mot),
    g.police,
    voulue,
    disponible,
    options,
  );
  const { opacite, echelle, decalageYPx } = entree(g, s, t, d.glissement !== false);
  const clair = d.passagesClairs?.find((p) => t >= p.debutSec - 1e-6 && t < p.finSec - 1e-6)?.texte;
  const couleurs = clair ? { ...d.couleurs, texte: clair } : d.couleurs;
  // Lot L3b : surlignage (fond derrière le mot souligné) ; ses couleurs d'écran clair pendant un passage clair.
  const surlignage = d.surlignage ? (clair ? { fond: d.surlignage.fondClair ?? d.surlignage.fond, texte: d.surlignage.texteClair ?? d.surlignage.texte } : { fond: d.surlignage.fond, texte: d.surlignage.texte }) : undefined;
  const mots = motsDessines(s, g, couleurs, t);
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
    mots: surlignage ? mots.map((m) => (m.souligne >= SURLIGNAGE.texteDes ? { ...m, couleur: surlignage.texte } : m)) : mots,
    fond: g.bandeau ? { couleur: d.couleurs.texte, margeXPx: g.bandeau.margeXEm * taillePx, margeYPx: g.bandeau.margeYEm * taillePx } : undefined,
    couleurSoulignement: d.couleurs.accent,
    ...(colonne ? { colonne } : {}),
    ...(clair ? { clair } : {}),
    ...(surlignage ? { surlignage } : {}),
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
  const e = echelleDe(d);
  const margeXPx = p.margeX * 1080 * e;
  const margeYPx = p.margeY * 1080 * e;
  const options = { majuscules: false, chiffresTabulaires: true, espaceMotsEm: p.espaceMotsEm };
  const libre = d.echelleTexte !== undefined ? d.largeurMaxPx : d.largeurMaxPx * e;
  const voulue = p.taillePx * (d.tailleRelative ?? 1) * e;
  const taillePx = Math.max(p.tailleMinPx * e, tailleQuiTient(s.mots.map((m) => m.mot), g.police, voulue, libre - 2 * margeXPx, options));
  const arrivee = p.arriveeMotMs / 1000;
  const mots: MotDessine[] = s.mots.map((m, k) => {
    const fin = s.mots[k + 1]?.debutSec ?? Math.max(m.finSec, s.finSec);
    const dit = t >= m.debutSec && t < fin;
    // Monte à l'arrivée du mot, redescend pendant l'arrivée du suivant (aucun saut d'une image à l'autre).
    const u = t < m.debutSec ? 0 : t < fin ? douce((t - m.debutSec) / arrivee) : 1 - douce((t - fin) / arrivee);
    // Le grossissement ne mange jamais l'espace entre deux mots : au plus `debordMotDitEm` de chaque côté (mot long).
    const zoom = Math.min(p.zoomMotDit, 1 + (2 * p.debordMotDitEm * taillePx) / Math.max(1, largeurMot(m.mot, g.police, taillePx, options)));
    return { texte: m.mot, couleur: dit ? p.motDit : p.texte, opacite: 1, souligne: 0, echelle: 1 + (zoom - 1) * u, monteePx: -p.monteeMotDitEm * taillePx * u };
  });
  const o = p.ombre;
  return {
    cle: s.id,
    gabarit: g,
    police: g.police,
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

/** Largeur rendue d'un élément dessiné, en px (contrôle de débordement). */
export function largeurElement(el: ElementDessine): number {
  const options = { majuscules: el.gabarit.casse === "majuscules", chiffresTabulaires: true };
  const texte = el.mots.reduce((s, m) => s + largeurMot(m.texte, el.police, el.taillePx, options), 0) + el.espacePx * Math.max(0, el.mots.length - 1);
  return texte + (el.fond ? 2 * el.fond.margeXPx : 0) + (el.pastille ? 2 * el.pastille.margeXPx : 0);
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
      if ((m.echelle !== undefined && m.echelle !== 1) || m.monteePx) {
        css.transform = `translateY(${(m.monteePx ?? 0).toFixed(2)}px) scale(${(m.echelle ?? 1).toFixed(4)})`;
        css.transformOrigin = "50% 70%";
      }
      // Lot L3b : mot surligné, lettre nette sur son fond (ni contour ni ombre).
      if (el.surlignage && m.souligne >= SURLIGNAGE.texteDes) {
        css.WebkitTextStroke = "0";
        css.textShadow = "none";
      }
      return css;
    },
    trait: (i) => (el.surlignage ? traitSurlignage(el, el.surlignage.fond, el.mots[i].souligne) : {
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
