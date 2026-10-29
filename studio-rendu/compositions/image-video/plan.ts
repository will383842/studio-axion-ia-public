/**
 * PLAN DES COMPOSANTS « Image → vidéo » (L7) : ce qui est visible sur la toile à un instant donné — état de chaque
 * nœud (absent, actif, vu, coché), tracé de chaque flèche, branche active, compteurs de l'embranchement, scène
 * « Ensemble ». PUR : ni React ni `remotion` (les tests l'appellent directement). Déterministe : tout se calcule
 * depuis l'instant `t` (secondes) et les propriétés de la scène.
 */
import {
  boiteALEcran,
  cameraA,
  disposerEtCadrer,
  ECRAN_IV,
  emprise,
  etatDansCadre,
  FONDU_CADRE,
  MARGE_CADRE,
  TAILLE_LIBELLE_IV,
  disposerEnsemble,
  type BoiteNoeud,
  type CadrageCamera,
  type CouleurSchema,
  type DebordNoeud,
  type DispositionEnsemble,
  type DispositionToile,
  type EtiquetteToile,
  type FlecheToile,
  type MotParle,
  type ProprietesSceneIV,
  type TrajectoireCamera,
  type VarianteDisposition,
} from "../../../src/briques/schema-motion";
import { c01, doux, progres } from "../cas-concret/plans/commun";
import { BANDE_SOUS_TITRES_IV, miseEnPageDeHauteurIV, ZONE_UTILE_IV } from "./mise-en-page";
import { couleurTrait, TEMPS_IV } from "../../../src/briques/schema-motion/temps";

/** Réglages de mouvement et couleur des traits : SEULE SOURCE dans `src/briques/schema-motion/temps.ts` (lue aussi par le contrôle de mise en page du moteur). */
export { couleurTrait, TEMPS_IV };

/** Opacité d'un nœud déjà vu (grisé). */
export const OPACITE_VU = 0.35;

/** Hauteur de l'en-tête (fraction de la hauteur) : la toile s'efface dessous, la scène « Ensemble » commence après. */
export const BAS_ENTETE = 0.245;

/**
 * Sous un en-tête, ligne (fraction de la hauteur) où la toile redevient pleinement visible ; au-dessus, elle s'efface
 * sur `FONDU_CADRE` (masque de `Compositions.tsx`). Un texte de la toile est entier sous cette ligne, ou caché dessus.
 */
export const HAUT_CADRE = BAS_ENTETE + 0.03;

/**
 * Zoom préféré de la caméra sur la toile : 1 (et non 1,25), pour garder dans le cadre le nœud d'avant et les branches
 * comme la maquette validée ; la taille effective des textes reste au-dessus du plancher (contrôlée par L2).
 */
export const ZOOM_PREFERE_IV = 1;

/** Rayon de la pastille d'icône et de la coche d'un nœud (pixels de toile). */
export const RAYON_PASTILLE = 46;
/** Débord des décors d'un nœud hors de sa carte (`Noeud.tsx`) : pastille d'icône à gauche, coche en haut à droite. */
export const DEBORD_ICONE = 2 * RAYON_PASTILLE - 30;
export const DEBORD_COCHE = RAYON_PASTILLE - 14;
/** Débord de l'ombre hachurée d'un nœud (« au feutre », `Noeud.tsx`) : vers la droite et vers le bas, hors de sa carte. */
export const DEBORD_HACHURES = 26;

/** Débord de chaque nœud d'après ses décors réels (icône, coche). */
export function debordNoeuds(p: Pick<ProprietesSceneIV, "schema" | "coches">): (id: string) => DebordNoeud {
  const icones = new Set(p.schema.noeuds.filter((n) => n.icone).map((n) => n.id));
  const coches = new Set((p.coches ?? []).map((c) => c.noeud));
  return (id) => ({ gauche: icones.has(id) ? DEBORD_ICONE : 0, droite: coches.has(id) ? DEBORD_COCHE : 0, haut: coches.has(id) ? DEBORD_COCHE : 0, bas: 0 });
}

/** Pastille de part (« 80 % ») : taille du texte, marges intérieures (pixels de toile), comme `Embranchement.tsx`. */
export const PASTILLE_PART = Object.freeze({ taille: TAILLE_LIBELLE_IV * ECRAN_IV.hauteur, padX: 34, padHaut: 6, padBas: 2, signe: 0.6 });

/** Rectangle (pixels de toile) d'une pastille de part centrée en (x, y) qui écrit « {part} % ». */
export function rectPastillePart(x: number, y: number, part: number): { x: number; y: number; largeur: number; hauteur: number } {
  const P = PASTILLE_PART;
  const largeur = `${part} %`.length * P.signe * P.taille + 2 * P.padX;
  const hauteur = P.taille * 1.15 + P.padHaut + P.padBas;
  return { x: x - largeur / 2, y: y - hauteur / 2, largeur, hauteur };
}

/**
 * Format 4:5 (lot F45) : la toile garde ses pixels de l'écran de référence 1080 × 1920 (mêmes tailles de textes) et la
 * composition n'en montre que le haut (1080 × 1350). Les bandes du 4:5 (`MISE_EN_PAGE_IV["4:5"]`, fractions de 1350) sont
 * donc ramenées en fractions de 1920 pour la caméra : `k` = 1350 / 1920. En 9:16, `k` = 1 et rien ne change.
 */
const versReference = (hauteur: number) => miseEnPageDeHauteurIV(hauteur).hauteur / ECRAN_IV.hauteur;

/** Haut du cadre pleinement visible sous l'en-tête d'un écran de hauteur `hauteur` (fraction de cette hauteur). */
export function hautCadreDe(hauteur: number = ECRAN_IV.hauteur): number {
  const m = miseEnPageDeHauteurIV(hauteur);
  return m.format === "9:16" ? HAUT_CADRE : m.entete.bas + 0.03;
}

/**
 * Cadrage de la caméra : bande où poser le nœud parlé (sous l'en-tête s'il y en a un, marge comprise ; au-dessus des
 * sous-titres, jusqu'au bas de la zone utile), cadre où tout texte est entier ou caché, décors des nœuds, pastilles de part.
 * 4:5 (hauteur 1350) : les mêmes règles dans la mise en page du 4:5, en fractions de l'écran de référence.
 */
export function cadrageScene(p: Pick<ProprietesSceneIV, "entetes" | "schema" | "coches" | "coupeFranche"> & { hauteur?: number }, etiquettes: readonly EtiquetteToile[] = []): CadrageCamera {
  const avecEntete = (p.entetes ?? []).length > 0;
  const marge = (MARGE_CADRE * ECRAN_IV.largeur) / ECRAN_IV.hauteur;
  const base = { zoomPrefere: ZOOM_PREFERE_IV, debord: debordNoeuds(p), apparition: TEMPS_IV.avanceNoeud, etiquettes, ...(p.coupeFranche ? { coupeFranche: true } : {}) };
  const m = miseEnPageDeHauteurIV(p.hauteur ?? ECRAN_IV.hauteur);
  if (m.format === "4:5") {
    const k = versReference(m.hauteur);
    const haut = avecEntete ? hautCadreDe(m.hauteur) * k : 0;
    // Cadre des textes (nœuds, pastilles de part) : entier au-dessus du fondu bas de la toile (bas de la zone utile).
    return { ...base, bande: { haut: avecEntete ? haut + marge : m.zoneContenu.haut * k, bas: m.zoneUtile.bas * k }, cadre: { haut, bas: m.zoneUtile.bas * k } };
  }
  return {
    ...base,
    ...(avecEntete ? { bande: { haut: HAUT_CADRE + marge, bas: ZONE_UTILE_IV.bas }, cadre: { haut: HAUT_CADRE, bas: 1 } } : {}),
  };
}

/**
 * Masque CSS de la toile : sous un en-tête, cachée au-dessus du fondu, pleinement visible dès `HAUT_CADRE` ; en bas,
 * elle s'efface avant la bande des sous-titres (un nœud vu ou à venir n'est jamais sous un sous-titre). 4:5 : les
 * mêmes lignes dans la mise en page du 4:5.
 */
export function masqueToile(hauteur: number, avecEntete = true): string {
  const m = miseEnPageDeHauteurIV(hauteur);
  const cadre = hautCadreDe(hauteur);
  const [utile, bande] = m.format === "9:16" ? [ZONE_UTILE_IV.bas, BANDE_SOUS_TITRES_IV.haut] : [m.zoneUtile.bas, m.bandeSousTitres.haut];
  // Pleinement visible jusqu'au bas de la zone utile (bas du cadrage), effacée au haut de la bande des sous-titres.
  const bas = bande * hauteur;
  const haut = avecEntete ? `transparent 0, transparent ${(cadre - FONDU_CADRE) * hauteur}px, #000 ${cadre * hauteur}px` : "#000 0";
  return `linear-gradient(to bottom, ${haut}, #000 ${utile * hauteur}px, transparent ${bas}px)`;
}

/**
 * Lot G · bas de la ZONE D'APPOINT en 9:16 (fraction de la hauteur, doc 76 : y 1300 → 1536) : sous y = 1536,
 * l'interface des réseaux recouvre l'écran, on n'y met que du fond.
 */
export const BAS_APPOINT_IV = 0.8;

/**
 * Lot G · RAIL DES CARTES SUIVANTES, dans la zone d'appoint du 9:16 (sous les sous-titres) : les cartes du schéma, dans
 * leur ordre, en cartes MUETTES (aucun texte : rien de lisible sous les sous-titres, rien de montré avant d'être dit).
 * La fenêtre montre `RAIL_IV.cartes` cartes à partir de celle qui suit la carte dont on parle (avant le premier mot :
 * à partir de la première carte dite ; en fin de schéma, les dernières) et glisse vers la gauche à chaque nouvelle carte.
 * Pixels de l'écran de référence 1080 × 1920.
 */
export const RAIL_IV = Object.freeze({ cartes: 3, gauche: 60, droite: 1020, ecart: 40, haut: 1306, hauteur: 206, glisse: 0.45 });

/**
 * Lot G · rail du 4:5 : sous la bande des sous-titres, la barre de lecture recouvre l'écran ; le rail se pose donc
 * AU-DESSUS de la bande (y 946 → 1030 du cadre 1080 × 1350), et seulement quand la toile lui laisse la place : il paraît
 * en fondu dès qu'aucune carte (dite ou muette) ni pastille de part n'est à moins de `marge` px au-dessus de lui.
 */
export const RAIL_45 = Object.freeze({ haut: 946, hauteur: 84, marge: 20, fondu: 40 });

/** Place du rail (pixels de l'écran de référence, haut et hauteur) dans un écran de hauteur `hauteur`. */
export function placeRail(hauteur: number): { haut: number; hauteur: number } {
  return miseEnPageDeHauteurIV(hauteur).format === "4:5" ? { haut: RAIL_45.haut, hauteur: RAIL_45.hauteur } : { haut: RAIL_IV.haut, hauteur: RAIL_IV.hauteur };
}

/**
 * Opacité du rail à l'instant `t` (PUR) : 1 en 9:16 (zone d'appoint, sous les sous-titres, que la toile n'atteint pas) ;
 * en 4:5, d'après la place libre entre la plus basse carte posée au-dessus de lui (caméra de la scène) et son haut,
 * et effacé avec la toile (`fonduToile`, vue d'ensemble).
 */
export function opaciteRail(s: SceneCalculee, hauteur: number, t: number, fonduToile = 1): number {
  if (miseEnPageDeHauteurIV(hauteur).format !== "4:5") return 1;
  const pose = cameraA(s.trajectoire, t);
  let libre = Infinity;
  const obstacles = [
    ...s.toile.boites.map((b) => ({ x: b.x - DEBORD_ICONE, y: b.y - DEBORD_COCHE, largeur: b.largeur + DEBORD_ICONE + DEBORD_COCHE, hauteur: b.hauteur + DEBORD_COCHE })),
    ...(s.cadrage.etiquettes ?? []).filter((e) => e.des <= t),
  ];
  for (const o of obstacles) {
    const e = boiteALEcran(o, pose);
    // Une carte qui commence sous le haut du rail est dans le fondu bas de la toile : le rail la couvre.
    if (e.x + e.largeur <= RAIL_IV.gauche || e.x >= RAIL_IV.droite || e.y >= RAIL_45.haut) continue;
    libre = Math.min(libre, RAIL_45.haut - (e.y + e.hauteur));
  }
  return c01((libre - RAIL_45.marge) / RAIL_45.fondu) * fonduToile;
}

/**
 * Lot G · masques du SCHÉMA MUET (cartes sans texte). `futurs` : visible dès le bas de l'en-tête (aucun texte à
 * protéger), effacé avant la bande des sous-titres comme la toile. `dessus` : seulement entre le bas de l'en-tête et
 * la ligne où la toile redevient visible (`hautCadreDe`) : les cartes déjà dites y restent devinées, en silhouette,
 * sans texte ; `null` sans en-tête (la toile est visible jusqu'en haut).
 */
export function masqueSchemaMuet(hauteur: number, avecEntete: boolean, partie: "futurs" | "dessus"): string | null {
  const m = miseEnPageDeHauteurIV(hauteur);
  const entete = m.entete.bas * hauteur;
  const cadre = hautCadreDe(hauteur) * hauteur;
  const f = FONDU_CADRE * hauteur;
  if (partie === "dessus") return avecEntete ? `linear-gradient(to bottom, transparent 0, transparent ${entete}px, #000 ${entete + f}px, #000 ${cadre - f}px, transparent ${cadre}px)` : null;
  const [utile, bande] = m.format === "9:16" ? [ZONE_UTILE_IV.bas, BANDE_SOUS_TITRES_IV.haut] : [m.zoneUtile.bas, m.bandeSousTitres.haut];
  const haut = avecEntete ? `transparent 0, transparent ${entete}px, #000 ${entete + f}px` : "#000 0";
  return `linear-gradient(to bottom, ${haut}, #000 ${utile * hauteur}px, transparent ${bande * hauteur}px)`;
}

export type CarteRail = { id: string; x: number; largeur: number; opacite: number; etat: "absent" | "actif" | "vu" };

/** Ordre des cartes du rail : celui du schéma (`ordre`, puis id), limité aux cartes posées sur la toile. */
function ordreRail(s: SceneCalculee, p: Pick<ProprietesSceneIV, "schema">): string[] {
  return [...p.schema.noeuds].filter((n) => s.parId.has(n.id)).sort((a, b) => a.ordre - b.ordre || a.id.localeCompare(b.id)).map((n) => n.id);
}

/** Début de la fenêtre du rail quand on parle de la carte `courant` (index dans l'ordre ; −1 avant le premier mot). */
function debutFenetre(courant: number, n: number): number {
  return Math.max(0, Math.min(courant + 1, n - RAIL_IV.cartes));
}

/** Cartes du rail à l'instant `t` (PUR) : position (glissement doux à chaque carte dite), opacité aux bords, état. */
export function railSuite(s: SceneCalculee, p: Pick<ProprietesSceneIV, "schema">, t: number): CarteRail[] {
  const ordre = ordreRail(s, p);
  if (ordre.length === 0) return [];
  const index = new Map(ordre.map((id, i) => [id, i]));
  // Début de la fenêtre : il change à chaque mot (moins l'avance d'apparition) ; il glisse de l'ancien au nouveau.
  const premier = s.mots.length ? (index.get(s.mots[0].noeud) ?? 0) : 0;
  let avant = debutFenetre(premier - 1, ordre.length);
  let debut = avant;
  let depuis = -Infinity;
  for (const m of s.mots) {
    const t0 = m.t - TEMPS_IV.avanceNoeud;
    if (t0 > t) break;
    const v = debutFenetre(index.get(m.noeud) ?? -1, ordre.length);
    if (v !== debut) {
      avant = fenetreA(avant, debut, depuis, t0);
      debut = v;
      depuis = t0;
    }
  }
  const f = fenetreA(avant, debut, depuis, t);
  const largeur = (RAIL_IV.droite - RAIL_IV.gauche - (RAIL_IV.cartes - 1) * RAIL_IV.ecart) / RAIL_IV.cartes;
  const pas = largeur + RAIL_IV.ecart;
  return ordre.flatMap((id, i) => {
    const x = RAIL_IV.gauche + (i - f) * pas;
    // Pleine dans la fenêtre, effacée sur une demi-carte de part et d'autre.
    const hors = Math.max(RAIL_IV.gauche - x, x + largeur - RAIL_IV.droite, 0);
    const opacite = c01(1 - hors / (largeur / 2));
    return opacite > 0 ? [{ id, x, largeur, opacite, etat: etatNoeud(s, id, t).etat }] : [];
  });
}

/** Début de fenêtre à l'instant `t`, en glissement doux de `avant` vers `apres` à partir de `depuis`. */
function fenetreA(avant: number, apres: number, depuis: number, t: number): number {
  return avant + (apres - avant) * doux(progres(t, depuis, RAIL_IV.glisse));
}

export type SceneCalculee = {
  toile: DispositionToile;
  trajectoire: TrajectoireCamera;
  /** Mots triés (t croissant, égalités par id). */
  mots: MotParle[];
  parId: Map<string, BoiteNoeud>;
  premierMot: Map<string, number>;
  /** Colonne de branche de chaque nœud (`null` = tronc). */
  colonne: Map<string, string | null>;
  separation: Map<string, number>;
  coche: Map<string, number>;
  /** Part portée par chaque lien (80 pour « 80 % »). */
  part: Map<string, number>;
  /** Ordonnée (toile) du coude des flèches qui quittent chaque décision : les pastilles de part s'y posent. */
  coude: Map<string, number>;
  cadrage: CadrageCamera;
  /** Disposition retenue pour qu'aucun texte ne soit coupé par le bord. */
  variante: VarianteDisposition;
};

/** Distance maximale entre le bas d'une décision et le coude de ses flèches (où se posent les pastilles de part). */
export const COUDE_MAX = 110;
/** Écart horizontal maximal entre le bord d'une décision et une pastille de part (les branches lointaines restent près). */
export const ECART_PART = 60;

const trier = (l: readonly MotParle[]) => [...l].sort((a, b) => a.t - b.t || a.noeud.localeCompare(b.noeud));

type Geometrie = { parId: Map<string, BoiteNoeud>; colonne: Map<string, string | null>; coude: Map<string, number>; etiquettes: EtiquetteToile[] };

/** Colonnes, coudes des embranchements et pastilles de part d'une toile. */
function geometrie(toile: DispositionToile, p: Pick<ProprietesSceneIV, "schema" | "separations">): Geometrie {
  const branches = new Set(toile.branches.map((b) => b.id));
  const parId = new Map(toile.boites.map((b) => [b.id, b]));
  const colonne = new Map(toile.boites.map((b) => [b.id, b.colonne !== null && branches.has(b.colonne) ? b.colonne : null]));
  // Coude commun des flèches d'un embranchement : près de la décision (au plus `COUDE_MAX`), à mi-chemin si plus court.
  const coude = new Map<string, number>();
  for (const sep of p.separations ?? []) {
    const d = parId.get(sep.noeud);
    if (!d) continue;
    const bas = d.y + d.hauteur;
    const tetes = toile.fleches.filter((f) => f.de === d.id && colonne.get(f.vers) && colonne.get(f.vers) !== colonne.get(d.id)).map((f) => parId.get(f.vers)!.y - bas);
    if (tetes.length) coude.set(d.id, bas + Math.min(COUDE_MAX, Math.min(...tetes) / 2));
  }
  // Pastilles de part : textes de la toile soumis au cadrage comme les nœuds, rattachés à leur nœud de décision.
  const part = new Map(p.schema.liens.filter((l) => typeof l.part === "number" && l.part > 0).map((l) => [l.id, l.part!]));
  const etiquettes: EtiquetteToile[] = [];
  for (const sep of trier(p.separations ?? [])) {
    const y = coude.get(sep.noeud);
    if (y === undefined) continue;
    for (const f of toile.fleches) {
      if (f.de !== sep.noeud || !colonne.get(f.vers) || colonne.get(f.vers) === colonne.get(f.de)) continue;
      // Pas de part (cartes réelles : `part: null`) = pas de pastille « 0 % » figée.
      if (!part.get(f.id)) continue;
      const ch = cheminFleche(parId.get(f.de)!, parId.get(f.vers)!, y);
      etiquettes.push({ id: `part-${f.id}`, noeud: sep.noeud, des: sep.t + TEMPS_IV.dessinFleche * 0.6, ...rectPastillePart(ch.milieu[0], ch.milieu[1], part.get(f.id)!) });
    }
  }
  return { parId, colonne, coude, etiquettes };
}

/** Cadrage de la caméra sur une toile donnée (avec les pastilles de part de cette toile). */
export function cadrageDeToile(toile: DispositionToile, p: Pick<ProprietesSceneIV, "schema" | "separations" | "entetes" | "coches" | "coupeFranche"> & { hauteur?: number }): CadrageCamera {
  return cadrageScene(p, geometrie(toile, p).etiquettes);
}

/**
 * Disposition et trajectoire de la scène (calculées une fois par rendu) : la disposition change si, à un mot, aucun
 * cadrage ne garde tous les textes entiers (`disposerEtCadrer`).
 */
export function calculerScene(p: Pick<ProprietesSceneIV, "schema" | "mots" | "dureeSec" | "separations" | "coches" | "entetes" | "coupeFranche"> & { hauteur?: number }): SceneCalculee {
  const mots = trier(p.mots);
  const cadree = disposerEtCadrer(p.schema, mots, p.dureeSec, (toile) => cadrageDeToile(toile, p));
  const { toile, trajectoire, cadrage, variante } = cadree;
  const { parId, colonne, coude } = geometrie(toile, p);
  const premierMot = new Map<string, number>();
  for (const m of mots) if (!premierMot.has(m.noeud)) premierMot.set(m.noeud, m.t);
  return {
    toile,
    cadrage,
    variante,
    coude,
    trajectoire,
    mots,
    parId,
    premierMot,
    colonne,
    separation: new Map(trier(p.separations ?? []).map((s) => [s.noeud, s.t])),
    coche: new Map(trier(p.coches ?? []).map((s) => [s.noeud, s.t])),
    part: new Map(p.schema.liens.filter((l) => typeof l.part === "number" && l.part > 0).map((l) => [l.id, l.part!])),
  };
}

/** Décalages (en secondes) dont les moyennes, passée (`t − r`) et future (`t + r`), lissent l'opacité de `opaciteCadre` : 0,15 s de fondu de chaque côté d'une coupe. */
export const LISSAGE_CADRE = Object.freeze([0, 0.05, 0.1, 0.15]);

/** La caméra est-elle posée à l'instant `t` (hors d'un panoramique entre deux poses différentes) ? */
export function cameraPosee(images: TrajectoireCamera["images"], t: number): boolean {
  for (let i = 1; i < images.length; i++) {
    const a = images[i - 1];
    const b = images[i];
    if (t > a.t && t < b.t) return a.cx === b.cx && a.cy === b.cy && a.zoom === b.zoom;
  }
  return true;
}

/**
 * FILET « jamais un bloc coupé à l'écran » (PUR) : opacité d'un bloc de la toile (`id` d'un nœud, ou `part-…` d'une
 * pastille de part) à l'instant `t`, pour la caméra `images` réellement vue (celle de la scène, ou celle de la variété
 * CAM-B/CAM-C). La trajectoire étant connue d'avance, le fondu se fait de CHAQUE côté de la coupe : 0 si le bloc est coupé
 * par un bord du cadre à `t` ; sinon le MINIMUM de la moyenne passée (`t`, `t − 0,05`, `t − 0,10`, `t − 0,15`) et de la
 * moyenne future (`t`, `t + 0,05`, `t + 0,10`, `t + 0,15`) de l'indicateur « le bloc n'est pas coupé » (1 s'il est entier
 * ou hors cadre, 0 s'il est coupé). Le bloc vaut donc 0 sur toute la coupe, avec un fondu avant et un fondu après ; aux
 * poses tenues (propres), l'opacité vaut 1.
 * Le bloc dont on parle n'est jamais caché (remarque Q15), mais seulement aux échantillons où il est le nœud courant ET où
 * la caméra est posée : pendant un panoramique vers le mot suivant, le courant garde son rang mais la caméra le coupe, il
 * s'efface avec les autres. `courant` : `noeudCourant(s, t)`, calculé une fois par image par l'appelant.
 */
export function opaciteCadre(s: SceneCalculee, images: TrajectoireCamera["images"], id: string, t: number, courant: string | null = noeudCourant(s, t)): number {
  const boite = s.parId.get(id);
  const etiquette = boite ? undefined : (s.cadrage.etiquettes ?? []).find((e) => e.id === id);
  if (!boite && !etiquette) return 1;
  const zone = boite ? emprise(boite, s.cadrage) : etiquette!;
  const coupe = (tau: number) => {
    if ((tau === t ? courant : noeudCourant(s, tau)) === id && cameraPosee(images, tau)) return false;
    return etatDansCadre(zone, cameraA({ images }, tau), s.cadrage) === "coupe";
  };
  if (coupe(t)) return 0;
  let passe = 0;
  let futur = 0;
  for (const r of LISSAGE_CADRE) {
    passe += coupe(t - r) ? 0 : 1;
    futur += coupe(t + r) ? 0 : 1;
  }
  return Math.min(passe, futur) / LISSAGE_CADRE.length;
}

/** Nœud dont on parle à l'instant `t` (dernier mot commencé), ou `null` avant le premier. */
export function noeudCourant(s: SceneCalculee, t: number): string | null {
  let courant: string | null = null;
  for (const m of s.mots) if (m.t - TEMPS_IV.avanceNoeud <= t) courant = m.noeud;
  return courant;
}

/** Branches déjà parcourues à l'instant `t` (au moins un de leurs nœuds dit). */
function branchesVues(s: SceneCalculee, t: number): Set<string> {
  const vues = new Set<string>();
  for (const m of s.mots) {
    const c = s.colonne.get(m.noeud);
    if (c && m.t - TEMPS_IV.avanceNoeud <= t) vues.add(c);
  }
  return vues;
}

/**
 * Branche allumée à l'instant `t` : celle du nœud dont on parle ; de retour au tronc après une branche, la prochaine
 * branche pas encore parcourue (dans l'ordre de la toile, majoritaire d'abord) ; sinon aucune (toutes allumées).
 */
export function brancheActive(s: SceneCalculee, t: number): string | null {
  const courant = noeudCourant(s, t);
  if (courant === null) return null;
  const c = s.colonne.get(courant);
  if (c) return c;
  const vues = branchesVues(s, t);
  if (vues.size === 0) return null;
  return s.toile.branches.find((b) => !vues.has(b.id))?.id ?? null;
}

export type EtatNoeud = {
  /** 0 avant son mot, 1 une fois posé (surgissement avec rebond entre les deux). */
  entree: number;
  etat: "absent" | "actif" | "vu";
  /** 0 à 1 : coche verte qui surgit. */
  coche: number;
};

export function etatNoeud(s: SceneCalculee, id: string, t: number): EtatNoeud {
  const t0 = s.premierMot.get(id);
  const tc = s.coche.get(id);
  const coche = tc === undefined ? 0 : progres(t, tc, TEMPS_IV.coche);
  if (t0 === undefined || t < t0 - TEMPS_IV.avanceNoeud) return { entree: 0, etat: "absent", coche: 0 };
  const entree = progres(t, t0 - TEMPS_IV.avanceNoeud, TEMPS_IV.surgir);
  return { entree, etat: noeudCourant(s, t) === id ? "actif" : "vu", coche };
}

export type EtatFleche = {
  /** Part du tracé dessinée (0 à 1). */
  trace: number;
  /** Pointe : 0 à 1, posée en dernier. */
  pointe: number;
  opacite: number;
};

/** Flèche qui quitte une décision vers une branche, à une séparation : elle se dessine en deux temps (coude, puis nœud). */
export function estFlecheDeSeparation(s: SceneCalculee, f: FlecheToile): boolean {
  return s.coude.has(f.de) && s.separation.has(f.de) && !!s.colonne.get(f.vers) && s.colonne.get(f.vers) !== s.colonne.get(f.de);
}

/** Chemin d'une flèche de la scène (avec coude pour une flèche de séparation). */
export function cheminDe(s: SceneCalculee, f: FlecheToile): CheminFleche | null {
  const a = s.parId.get(f.de);
  const b = s.parId.get(f.vers);
  if (!a || !b) return null;
  return cheminFleche(a, b, estFlecheDeSeparation(s, f) ? s.coude.get(f.de) : undefined);
}

export function etatFleche(s: SceneCalculee, f: FlecheToile, t: number): EtatFleche {
  const t0 = s.premierMot.get(f.vers);
  const debut = t0 === undefined ? null : t0 - TEMPS_IV.avanceNoeud - TEMPS_IV.dessinFleche;
  let trace: number;
  let pointe: number;
  if (estFlecheDeSeparation(s, f)) {
    // À la séparation, le fil va jusqu'au coude (où compte la part) ; il rejoint son nœud quand ce nœud est dit.
    const sep = s.separation.get(f.de)!;
    if (t < sep) return { trace: 0, pointe: 0, opacite: 0 };
    const coude = cheminDe(s, f)!.partCoude;
    const suite = debut === null ? 0 : doux(progres(t, debut, TEMPS_IV.dessinFleche));
    trace = coude * doux(progres(t, sep, TEMPS_IV.dessinFleche)) + (1 - coude) * suite;
    // La pointe n'arrive qu'avec la seconde moitié du fil (jamais sous la pastille tant que le nœud n'est pas dit).
    pointe = c01((suite - TEMPS_IV.pointe) / (1 - TEMPS_IV.pointe));
  } else {
    if (debut === null || t < debut) return { trace: 0, pointe: 0, opacite: 0 };
    trace = doux(progres(t, debut, TEMPS_IV.dessinFleche));
    pointe = c01((trace - TEMPS_IV.pointe) / (1 - TEMPS_IV.pointe));
  }
  const active = brancheActive(s, t);
  const colonne = s.colonne.get(f.vers) ?? null;
  const arrivee = etatNoeud(s, f.vers, t).etat;
  // Grisée seulement si elle mène à un nœud déjà vu hors de la branche allumée.
  const grisee = arrivee === "vu" && (colonne === null || colonne !== active) && noeudCourant(s, t) !== f.vers;
  const horsBranche = colonne !== null && active !== null && colonne !== active;
  return { trace, pointe, opacite: grisee || horsBranche ? OPACITE_VU : 1 };
}

/** Point d'une courbe de Bézier cubique. */
function bezier(p: number[][], u: number): [number, number] {
  const v = 1 - u;
  const a = v * v * v;
  const b = 3 * v * v * u;
  const c = 3 * v * u * u;
  const d = u * u * u;
  return [a * p[0][0] + b * p[1][0] + c * p[2][0] + d * p[3][0], a * p[0][1] + b * p[1][1] + c * p[2][1] + d * p[3][1]];
}

export type CheminFleche = {
  d: string;
  longueur: number;
  /** Part de la longueur jusqu'au coude (1 sans coude). */
  partCoude: number;
  milieu: [number, number];
  /** Bout de la flèche et angle de la pointe (degrés, 0 = vers la droite). */
  bout: [number, number];
  angle: number;
};

/**
 * Chemin d'une flèche entre deux boîtes : du bas de la première au haut de la seconde (courbe en S qui descend,
 * part et arrive à la verticale), ou, pour un retour vers le haut, par le flanc droit des deux boîtes.
 */
export function cheminFleche(a: BoiteNoeud, b: BoiteNoeud, coude?: number): CheminFleche {
  let pts: number[][];
  if (coude !== undefined && b.y > coude && coude > a.y + a.hauteur) {
    // Embranchement : le fil descend et s'incurve jusqu'au coude (où se pose la part), près de la décision (au plus
    // `ECART_PART` de son bord) ; de là, il tombe sur le nœud (droit s'il est à l'aplomb, en S sinon).
    const x1 = a.x + a.largeur / 2;
    const y1 = a.y + a.hauteur;
    const x2 = b.x + b.largeur / 2;
    const limite = a.largeur / 2 + ECART_PART;
    const xc = Math.abs(x2 - x1) <= limite ? x2 : x1 + Math.sign(x2 - x1) * limite;
    const k = (coude - y1) / 2;
    const courbe = [
      [x1, y1],
      [x1, y1 + k],
      [xc, coude - k],
      [xc, coude],
    ];
    const longueurDe = (q: number[][]) => {
      let l = 0;
      let avant = bezier(q, 0);
      for (let i = 1; i <= 48; i++) {
        const p = bezier(q, i / 48);
        l += Math.hypot(p[0] - avant[0], p[1] - avant[1]);
        avant = p;
      }
      return l;
    };
    const l1 = longueurDe(courbe);
    const r = (x: number) => Math.round(x * 10) / 10;
    const k2 = (b.y - coude) / 2;
    const suite = xc === x2 ? `L ${r(x2)} ${r(b.y)}` : `C ${r(xc)} ${r(coude + k2)}, ${r(x2)} ${r(b.y - k2)}, ${r(x2)} ${r(b.y)}`;
    const l2 = xc === x2 ? b.y - coude : longueurDe([[xc, coude], [xc, coude + k2], [x2, b.y - k2], [x2, b.y]]);
    const longueur = l1 + l2;
    return {
      d: `M ${r(x1)} ${r(y1)} C ${r(x1)} ${r(y1 + k)}, ${r(xc)} ${r(coude - k)}, ${r(xc)} ${r(coude)} ${suite}`,
      longueur,
      partCoude: l1 / longueur,
      milieu: [xc, coude],
      bout: [x2, b.y],
      angle: 90,
    };
  }
  if (b.y >= a.y + a.hauteur) {
    const x1 = a.x + a.largeur / 2;
    const y1 = a.y + a.hauteur;
    const x2 = b.x + b.largeur / 2;
    const y2 = b.y;
    const k = Math.max(30, (y2 - y1) / 2);
    pts = [
      [x1, y1],
      [x1, y1 + k],
      [x2, y2 - k],
      [x2, y2],
    ];
  } else {
    const x1 = a.x + a.largeur;
    const y1 = a.y + a.hauteur / 2;
    const x2 = b.x + b.largeur;
    const y2 = b.y + b.hauteur / 2;
    const dx = Math.max(x1, x2) + 160;
    pts = [
      [x1, y1],
      [dx, y1],
      [dx, y2],
      [x2, y2],
    ];
  }
  let longueur = 0;
  let avant = bezier(pts, 0);
  for (let i = 1; i <= 48; i++) {
    const p = bezier(pts, i / 48);
    longueur += Math.hypot(p[0] - avant[0], p[1] - avant[1]);
    avant = p;
  }
  const r = (x: number) => Math.round(x * 10) / 10;
  const fin = pts[3];
  const tangente = [pts[3][0] - pts[2][0], pts[3][1] - pts[2][1]];
  return {
    d: `M ${r(pts[0][0])} ${r(pts[0][1])} C ${r(pts[1][0])} ${r(pts[1][1])}, ${r(pts[2][0])} ${r(pts[2][1])}, ${r(fin[0])} ${r(fin[1])}`,
    longueur,
    partCoude: 1,
    milieu: bezier(pts, 0.5),
    bout: [fin[0], fin[1]],
    angle: (Math.atan2(tangente[1], tangente[0]) * 180) / Math.PI,
  };
}

export type PartEmbranchement = {
  fleche: string;
  branche: string;
  /** Part portée (80 pour « 80 % »), comptée de 0 à sa valeur. */
  part: number;
  valeur: number;
  couleur: CouleurSchema;
  /** Centre de la pastille (pixels de toile) et côté où elle s'étend. */
  x: number;
  y: number;
  cote: "gauche" | "droite";
  allumee: boolean;
  entree: number;
};

/** Les parts d'un embranchement qui se déploie (une pastille par flèche qui quitte la décision vers une branche). */
export function partsEmbranchement(s: SceneCalculee, decision: string, t: number): PartEmbranchement[] {
  const ts = s.coude.has(decision) ? s.separation.get(decision) : undefined;
  const d = s.parId.get(decision);
  if (ts === undefined || !d || t < ts) return [];
  const active = brancheActive(s, t);
  const entree = progres(t, ts + TEMPS_IV.dessinFleche * 0.6, TEMPS_IV.surgir);
  const x = progres(t, ts + TEMPS_IV.compteurDepart, TEMPS_IV.compteurDuree);
  const lissee = 1 - Math.pow(1 - x, 3);
  const res: PartEmbranchement[] = [];
  for (const f of s.toile.fleches) {
    if (f.de !== decision) continue;
    const branche = s.colonne.get(f.vers);
    const b = s.parId.get(f.vers);
    if (!branche || !b || !estFlecheDeSeparation(s, f)) continue;
    const part = s.part.get(f.id);
    if (!part) continue;
    const ch = cheminDe(s, f)!;
    res.push({
      fleche: f.id,
      branche,
      part,
      valeur: Math.round(part * lissee),
      couleur: s.toile.branches.find((x) => x.id === branche)?.couleur ?? f.couleur,
      x: ch.milieu[0],
      y: ch.milieu[1],
      cote: "droite",
      allumee: active === null || active === branche,
      entree,
    });
  }
  // Côté de chaque pastille par rapport aux autres (une branche peut descendre droit sous la décision).
  const milieu = res.reduce((m, x) => m + x.x, 0) / Math.max(1, res.length);
  for (const x of res) x.cote = x.x < milieu ? "gauche" : "droite";
  return res.sort((a, b) => a.x - b.x || a.fleche.localeCompare(b.fleche));
}

/**
 * Fond que la scène de toile PEINT à l'instant `t` (secondes depuis son début). Pendant la fenêtre d'une vue
 * d'ensemble [début, fin[, la ligne de temps déclare le plan ivoire (sous-titres à l'encre sombre, récit sur fond
 * ivoire) : le rendu doit peindre ivoire lui aussi, quel que soit le fond de la toile. PURE.
 */
export function fondSceneA(p: Pick<ProprietesSceneIV, "ensembles" | "fond">, t: number): "ivoire" | "sombre" {
  return (p.ensembles ?? []).some((e) => t >= e.debut - 1e-6 && t < e.fin - 1e-6) ? "ivoire" : p.fond;
}

/** Scène « Ensemble » en cours à l'instant `t` : son fondu (0 à 1) et sa disposition, ou `null`. */
export function ensembleA(
  p: Pick<ProprietesSceneIV, "ensembles" | "schema" | "entetes"> & { hauteur?: number },
  s: SceneCalculee,
  t: number,
): { fondu: number; ecoule: number; disposition: DispositionEnsemble; options: { allumes?: string[]; chiffresCles?: string[]; bande?: { haut: number; bas: number } } } | null {
  const e = (p.ensembles ?? []).find((x) => t >= x.debut - TEMPS_IV.fondu && t < x.fin);
  if (!e) return null;
  const fondu = Math.min(progres(t, e.debut - TEMPS_IV.fondu, TEMPS_IV.fondu), 1 - progres(t, e.fin - TEMPS_IV.fondu, TEMPS_IV.fondu));
  const avecEntete = (p.entetes ?? []).some((x) => x.debut < e.fin && x.fin > e.debut);
  const m = miseEnPageDeHauteurIV(p.hauteur ?? ECRAN_IV.hauteur);
  const k = versReference(m.hauteur);
  const bande45 = { haut: (avecEntete ? m.zoneUtile.haut : m.zoneContenu.haut) * k, bas: m.zoneUtile.bas * k };
  const options = { allumes: e.allumes, chiffresCles: e.chiffresCles, bande: m.format === "4:5" ? bande45 : avecEntete ? { haut: BAS_ENTETE + 0.02, bas: ZONE_UTILE_IV.bas } : undefined };
  return { fondu, ecoule: t - e.debut + TEMPS_IV.fondu, disposition: disposerEnsemble(s.toile, p.schema, options), options };
}

/** En-tête affiché à l'instant `t` et son ouverture (0 à 1) / sa fermeture. */
export function enteteA(p: Pick<ProprietesSceneIV, "entetes">, t: number) {
  const e = (p.entetes ?? []).find((x) => t >= x.debut && t < x.fin);
  if (!e) return null;
  return { entete: e, ecoule: t - e.debut, sortie: progres(t, e.fin - 0.15, 0.15) };
}
