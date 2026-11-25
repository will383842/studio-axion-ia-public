/**
 * MISE EN PAGE DE LA VIDÉO LONGUE SANS VOIX (lot QUALL-3) : toute la géométrie ET toute l'animation, calculées à
 * l'instant `tMs` (temps de la vidéo entière). PURE : mêmes entrées, mêmes sorties. Le rendu (composition Remotion
 * `VideoLongue`) et le contrôle objectif (`controle.ts`) lisent EXACTEMENT les mêmes éléments.
 *
 * Bundlée par webpack dans Remotion : chemins RELATIFS seulement, aucun « @/ », aucun module serveur.
 *
 * Règles tenues partout : rien dans la bande des sous-titres (y ≥ 900) hors le sous-titre ; tout élément reste dans sa
 * zone à CHAQUE instant (les entrées montent de quelques pixels à l'intérieur de marges prévues) ; tailles au moins
 * égales aux planchers du contrat ; deux éléments ne se recouvrent que si l'un est `dans` l'autre ; jamais de bleu ni de
 * jaune ; orange et gris sur noir seulement.
 */
import { couperLignes, largeurMotMotion, ESPACE_MOTS_EM } from "../../briques/motion/mesure";
import {
  TAILLES_LONGUE,
  TEMPS_LONGUE,
  ZONES_LONGUE,
  type CouleurLongue,
  type ElementPose,
  type FondScene,
  type FormeLongue,
  type LigneSousTitre,
  type MorceauLigne,
  type PoserScene,
  type PoserSousTitre,
  type Rect,
  type SceneAvantApres,
  type SceneCartonChapitre,
  type SceneCartonTitre,
  type SceneChiffre,
  type SceneEtapes,
  type SceneFin,
  type SceneListe,
  type ScenePhraseCle,
} from "./storyboard-types";

/* ------------------------------------------------------------------ */
/* Outils d'animation                                                  */
/* ------------------------------------------------------------------ */

const borne = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
/** Avancement 0 → 1 d'une animation qui commence à `debut` et dure `duree` (ms). */
const prog = (t: number, debut: number, duree: number) => borne((t - debut) / duree);
const douce = (p: number) => 1 - (1 - p) ** 3;
const rebond = (p: number) => {
  const c = 1.4;
  return 1 + (c + 1) * (p - 1) ** 3 + c * (p - 1) ** 2;
};
/** Mouvement continu : sinus de période `periodeMs`. */
const souffle = (tl: number, periodeMs: number, dephasage = 0) => Math.sin((2 * Math.PI * tl) / periodeMs + dephasage);
const arrondi = (v: number) => Math.round(v * 100) / 100;

/** Montée d'entrée d'un texte libre (px) : les marges sous chaque texte libre sont toutes d'au moins 40 px. */
const MONTEE_PX = 28;
/** Bas utile d'une scène de contenu : 24 px de réserve sous la zone pour les entrées qui montent. */
const BAS_SCENE = ZONES_LONGUE.scene.y + ZONES_LONGUE.scene.hauteur - 24;

/* ------------------------------------------------------------------ */
/* Mesure du texte (Manrope), coupe en lignes, accents                   */
/* ------------------------------------------------------------------ */

type Graisse = 500 | 600 | 700 | 800;
/** Part de la boîte réellement remplie : marge contre l'écart entre la mesure et le rendu. */
const UTILE = 0.96;

const cacheCoupe = new Map<string, string[][]>();
function coupe(texte: string, taille: number, graisse: Graisse, largeur: number): string[][] {
  const cle = `${taille}|${graisse}|${Math.round(largeur)}|${texte}`;
  let r = cacheCoupe.get(cle);
  if (!r) {
    if (cacheCoupe.size > 4000) cacheCoupe.clear();
    r = couperLignes(texte.replace(/\*/g, ""), taille, graisse, largeur * UTILE, 0);
    cacheCoupe.set(cle, r);
  }
  return r;
}

const nettoie = (t: string) => t.replace(/\*/g, "").replace(/\s+/g, " ").trim();
const hauteurLignes = (n: number, taille: number, interligne: number) => n * taille * interligne;
const largeurLigne = (mots: string[], taille: number, graisse: Graisse) => mots.reduce((s, m) => s + largeurMotMotion(m, taille, graisse, 0), 0) + ESPACE_MOTS_EM * taille * Math.max(0, mots.length - 1);

/** Plus grande taille (≤ `max`, ≥ `plancher`) pour laquelle le texte tient dans `largeur` × `hauteurMax`, et son nombre de lignes. */
function ajuster(texte: string, max: number, plancher: number, graisse: Graisse, largeur: number, hauteurMax: number, interligne: number): { taille: number; lignes: string[][] } {
  let taille = max;
  for (;;) {
    const lignes = coupe(texte, taille, graisse, largeur);
    const plusLong = Math.max(0, ...nettoie(texte).split(" ").map((m) => largeurMotMotion(m, taille, graisse, 0)));
    const tient = plusLong <= largeur * UTILE && hauteurLignes(lignes.length, taille, interligne) <= hauteurMax;
    if (tient || taille <= plancher) return { taille: Math.max(taille, plancher), lignes };
    taille -= 2;
  }
}

/** Les mots de chaque ligne regroupés en morceaux (accent ou non). Les espaces sont portés par le morceau qui précède. */
function morceaux(texte: string, lignes: string[][], accent: string | null): MorceauLigne[][] {
  const propre = nettoie(texte);
  const cible = accent ? nettoie(accent) : "";
  const debutAccent = cible ? propre.indexOf(cible) : -1;
  const finAccent = debutAccent >= 0 ? debutAccent + cible.length : -1;
  let curseur = 0;
  return lignes.map((mots) => {
    const flags = mots.map((m) => {
      const i = propre.indexOf(m, curseur);
      const debut = i < 0 ? curseur : i;
      curseur = debut + m.length;
      return debutAccent >= 0 && debut < finAccent && curseur > debutAccent;
    });
    const res: MorceauLigne[] = [];
    mots.forEach((m, k) => {
      const dernier = res[res.length - 1];
      if (dernier && dernier.accent === flags[k]) dernier.texte += ` ${m}`;
      else res.push({ texte: m, accent: flags[k] });
    });
    return res.map((p, i) => (i < res.length - 1 ? { ...p, texte: `${p.texte} ` } : p));
  });
}

/* ------------------------------------------------------------------ */
/* Palette selon le fond                                               */
/* ------------------------------------------------------------------ */

interface Palette {
  texte: CouleurLongue;
  accent: CouleurLongue;
  carte: CouleurLongue;
  bordure: CouleurLongue;
  /** Texte posé sur un aplat d'accent. */
  surAccent: CouleurLongue;
  fond: FondScene;
}
const palette = (fond: FondScene): Palette =>
  fond === "noir"
    ? { texte: "ivoire", accent: "orange", carte: "noir", bordure: "grisSurNoir", surAccent: "noir", fond }
    : { texte: "noir", accent: "terracotta", carte: "blanc", bordure: "gris", surAccent: "blanc", fond };

/* ------------------------------------------------------------------ */
/* Fabrique d'éléments                                                 */
/* ------------------------------------------------------------------ */

interface OptTexte {
  id: string;
  x: number;
  y: number;
  largeur: number;
  texte: string;
  taille: number;
  graisse: Graisse;
  couleur: CouleurLongue;
  accent?: string | null;
  couleurAccent?: CouleurLongue;
  alignement?: "gauche" | "centre";
  interligne?: number;
  opacite?: number;
  dy?: number;
  dx?: number;
  lignes?: string[][];
  role?: ElementPose["role"];
  dans?: string;
}

function texteEl(o: OptTexte): ElementPose {
  const interligne = o.interligne ?? 1.15;
  const lignes = o.lignes ?? coupe(o.texte, o.taille, o.graisse, o.largeur);
  return {
    id: o.id,
    nature: "texte",
    role: o.role ?? "contenu",
    rect: { x: arrondi(o.x + (o.dx ?? 0)), y: arrondi(o.y + (o.dy ?? 0)), largeur: o.largeur, hauteur: arrondi(hauteurLignes(lignes.length, o.taille, interligne)) },
    opacite: arrondi(borne(o.opacite ?? 1)),
    couleur: o.couleur,
    lignes: morceaux(o.texte, lignes, o.accent ?? null),
    taillePx: o.taille,
    graisse: o.graisse,
    interligne,
    alignement: o.alignement ?? "gauche",
    couleurAccent: o.couleurAccent,
    ...(o.dans ? { dans: o.dans } : {}),
  };
}

function etiquetteEl(id: string, x: number, y: number, largeur: number, texte: string, couleur: CouleurLongue, opacite: number, alignement: "gauche" | "centre" = "gauche", dans?: string): ElementPose {
  return {
    id,
    nature: "texte",
    role: "etiquette",
    rect: { x, y, largeur, hauteur: arrondi(TAILLES_LONGUE.etiquette * 1.2) },
    opacite: arrondi(borne(opacite)),
    couleur,
    lignes: [[{ texte, accent: false }]],
    taillePx: TAILLES_LONGUE.etiquette,
    graisse: 700,
    interligne: 1.2,
    alignement,
    ...(dans ? { dans } : {}),
  };
}

const carteEl = (id: string, rect: Rect, fond: CouleurLongue | undefined, bordure: CouleurLongue | undefined, opacite: number, rayonPx = 28, epaisseurPx = 2, dans?: string): ElementPose => ({
  id,
  nature: "carte",
  role: "decor",
  rect: { x: arrondi(rect.x), y: arrondi(rect.y), largeur: arrondi(rect.largeur), hauteur: arrondi(rect.hauteur) },
  opacite: arrondi(borne(opacite)),
  couleur: fond ?? bordure ?? "gris",
  fond,
  bordure,
  rayonPx,
  epaisseurPx,
  ...(dans ? { dans } : {}),
});

const disqueEl = (id: string, cx: number, cy: number, d: number, fond: CouleurLongue | undefined, bordure: CouleurLongue | undefined, opacite: number, epaisseurPx = 4, dans?: string): ElementPose => ({
  id,
  nature: "disque",
  role: "decor",
  rect: { x: arrondi(cx - d / 2), y: arrondi(cy - d / 2), largeur: arrondi(d), hauteur: arrondi(d) },
  opacite: arrondi(borne(opacite)),
  couleur: fond ?? bordure ?? "gris",
  fond,
  bordure,
  epaisseurPx,
  ...(dans ? { dans } : {}),
});

/** Trait plein dans son rectangle, tracé de la gauche vers la droite (horizontal) ou du haut vers le bas (vertical). */
const traitEl = (id: string, rect: Rect, couleur: CouleurLongue, trace: number, opacite = 1, dans?: string): ElementPose => ({
  id,
  nature: "trait",
  role: "decor",
  rect: { x: arrondi(rect.x), y: arrondi(rect.y), largeur: arrondi(rect.largeur), hauteur: arrondi(rect.hauteur) },
  opacite: arrondi(borne(opacite)),
  couleur,
  trace: arrondi(borne(trace)),
  epaisseurPx: Math.min(rect.largeur, rect.hauteur),
  ...(dans ? { dans } : {}),
});

const formeEl = (id: string, forme: FormeLongue, rect: Rect, couleur: CouleurLongue, trace: number, epaisseurPx: number, opacite = 1, dans?: string): ElementPose => ({
  id,
  nature: "forme",
  role: "decor",
  rect: { x: arrondi(rect.x), y: arrondi(rect.y), largeur: arrondi(rect.largeur), hauteur: arrondi(rect.hauteur) },
  opacite: arrondi(borne(opacite)),
  couleur,
  forme,
  trace: arrondi(borne(trace)),
  epaisseurPx,
  ...(dans ? { dans } : {}),
});

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Colonne de la grille de la zone de scène : x de la colonne `i` (0 à 11) et largeur de `n` colonnes. */
const COL = 142;
const colX = (i: number) => ZONES_LONGUE.scene.x + i * COL;
const colsL = (n: number) => n * COL - 24;

/* ------------------------------------------------------------------ */
/* Carton-titre                                                        */
/* ------------------------------------------------------------------ */

function cartonTitre(s: SceneCartonTitre, t: number): ElementPose[] {
  const tl = t - s.debutMs;
  const p = palette(s.fond);
  const Z = ZONES_LONGUE.plein;
  const xTexte = Z.x + 64;
  const largeur = 1180;
  const { taille, lignes } = ajuster(s.question, TAILLES_LONGUE.question, 64, 800, largeur, 480, 1.08);
  const hQ = hauteurLignes(lignes.length, taille, 1.08);
  const hEtiq = TAILLES_LONGUE.etiquette * 1.2;
  const total = hEtiq + 52 + hQ + 56 + 10;
  const y0 = Z.y + (Z.hauteur - total) / 2;
  const yQ = y0 + hEtiq + 52;
  const eQ = douce(prog(tl, 300, 550));
  const hBarre = total;
  const croit = douce(prog(tl, 150, 800));
  const barre = traitEl(`${s.id}:barre`, { x: Z.x, y: y0 + hBarre * (1 - croit), largeur: 12, hauteur: hBarre * croit }, p.accent, 1, 1);
  const derive = 10;
  const cote = 360;
  const forme = formeEl(
    `${s.id}:forme`,
    "cible",
    { x: 1400 + derive * souffle(tl, 7000), y: Z.y + (Z.hauteur - cote) / 2 + derive * souffle(tl, 5200, 1.2), largeur: cote, hauteur: cote },
    p.accent,
    douce(prog(tl, 350, 1100)),
    14,
    0.95,
  );
  return [
    barre,
    etiquetteEl(`${s.id}:etiquette`, xTexte, y0, 400, "AXION IA", p.accent, prog(tl, 200, 400)),
    texteEl({ id: `${s.id}:question`, x: xTexte, y: yQ, largeur, texte: s.question, taille, graisse: 800, couleur: p.texte, interligne: 1.08, lignes, opacite: eQ, dy: MONTEE_PX * (1 - eQ) }),
    traitEl(`${s.id}:souligne`, { x: xTexte, y: yQ + hQ + 56, largeur: 440, hauteur: 10 }, p.accent, douce(prog(tl, 950, 600))),
    forme,
  ];
}

/* ------------------------------------------------------------------ */
/* Carton de chapitre                                                  */
/* ------------------------------------------------------------------ */

function cartonChapitre(s: SceneCartonChapitre, t: number): ElementPose[] {
  const tl = t - s.debutMs;
  const p = palette(s.fond);
  const Z = ZONES_LONGUE.plein;
  const largeur = 1136;
  const hNum = TAILLES_LONGUE.numeroChapitre * 1.0;
  const { taille, lignes } = ajuster(s.titre, TAILLES_LONGUE.titreChapitre, 64, 800, largeur, 420, 1.08);
  const hT = hauteurLignes(lignes.length, taille, 1.08);
  const yBas = 900;
  const total = hNum + 40 + 8 + 52 + hT;
  const y0 = Z.y + (yBas - Z.y - total) / 2;
  const eN = douce(prog(tl, 150, 500));
  const eT = douce(prog(tl, 350, 500));
  const out: ElementPose[] = [
    texteEl({ id: `${s.id}:numero`, x: Z.x, y: y0, largeur: 900, texte: `${pad2(s.rang)} / ${pad2(s.total)}`, taille: TAILLES_LONGUE.numeroChapitre, graisse: 800, couleur: p.accent, interligne: 1.0, opacite: eN, dy: 40 * (1 - eN) }),
    traitEl(`${s.id}:filet`, { x: Z.x, y: y0 + hNum + 40, largeur: 280, hauteur: 8 }, p.accent, douce(prog(tl, 400, 600))),
    texteEl({ id: `${s.id}:titre`, x: Z.x, y: y0 + hNum + 40 + 8 + 52, largeur, texte: s.titre, taille, graisse: 800, couleur: p.texte, interligne: 1.08, lignes, opacite: eT, dy: 40 * (1 - eT) }),
  ];
  const cote = 380;
  const d = 10;
  out.push(formeEl(`${s.id}:forme`, s.rang % 2 === 1 ? "cible" : "cercle", { x: 1400 + d * souffle(tl, 6400), y: Z.y + (yBas - Z.y - cote) / 2 + d * souffle(tl, 5000, 0.8), largeur: cote - 20, hauteur: cote - 20 }, p.accent, douce(prog(tl, 300, 1100)), 14, 0.9));
  // Progression : un segment par chapitre, ceux déjà vus pleins, le courant se remplit.
  const n = Math.max(1, s.total);
  const gap = 16;
  const lSeg = (Z.largeur - (n - 1) * gap) / n;
  for (let i = 0; i < n; i++) {
    const x = Z.x + i * (lSeg + gap);
    const rang = i + 1;
    const fondVide: CouleurLongue = p.fond === "noir" ? "grisSurNoir" : "gris";
    const vu = rang < s.rang;
    const courant = rang === s.rang;
    const remplissage = vu ? 1 : courant ? douce(prog(tl, 600, 900)) : 0;
    const opaciteVide = p.fond === "noir" ? 0.4 : 0.9;
    const wPlein = lSeg * remplissage;
    if (wPlein < lSeg) out.push(carteEl(`${s.id}:seg${rang}`, { x: x + wPlein, y: 940, largeur: lSeg - wPlein, hauteur: 12 }, fondVide, undefined, opaciteVide, 6));
    if (wPlein > 0) out.push(carteEl(`${s.id}:seg${rang}-plein`, { x, y: 940, largeur: wPlein, hauteur: 12 }, p.accent, undefined, 1, 6));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Liste                                                               */
/* ------------------------------------------------------------------ */

/** Instants d'apparition réellement joués : jamais avant la fin de la transition, jamais deux au même instant. */
function apparitions(brutes: number[], debut: number, premier: number, pas: number): number[] {
  const res: number[] = [];
  brutes.forEach((b, i) => res.push(Math.max(b, i === 0 ? debut + premier : res[i - 1] + pas)));
  return res;
}

function liste(s: SceneListe, t: number): ElementPose[] {
  const tl = t - s.debutMs;
  const p = palette(s.fond);
  const S = ZONES_LONGUE.scene;
  const out: ElementPose[] = [];
  const aCompte = s.compte !== null;
  const largeurListe = aCompte ? colsL(9) : S.largeur;
  let y = S.y;
  if (s.titre) {
    const a = ajuster(s.titre, s.elements.length <= 3 ? 84 : 76, 60, 800, largeurListe, 190, 1.1);
    const e = douce(prog(tl, 120, 450));
    out.push(texteEl({ id: `${s.id}:titre`, x: S.x, y, largeur: largeurListe, texte: s.titre, taille: a.taille, graisse: 800, couleur: p.texte, interligne: 1.1, lignes: a.lignes, opacite: e, dy: MONTEE_PX * (1 - e) }));
    y += hauteurLignes(a.lignes.length, a.taille, 1.1) + 56;
  }
  const n = s.elements.length;
  const dispo = BAS_SCENE - y;
  const gap = 32;
  const marque = s.titre ? 28 : 64;
  const pad = 32;
  // Colonnes et taille : la plus grande qui tient.
  let choix: { colonnes: number; taille: number; hLigne: number; lignes: string[][][] } | null = null;
  for (const colonnes of n >= 4 ? [1, 2] : [1]) {
    const largeurCarte = (largeurListe - (colonnes - 1) * gap) / colonnes;
    const largeurTexte = largeurCarte - pad - marque - 28 - pad;
    const rangs = Math.ceil(n / colonnes);
    for (const taille of n <= 3 ? [60, 56, 52, 50, 48, 46, 44] : [TAILLES_LONGUE.liste, 50, 48, 46, 44]) {
      const lignes = s.elements.map((e) => coupe(e.texte, taille, 600, largeurTexte));
      const besoin = Math.max(...lignes.map((l) => hauteurLignes(l.length, taille, 1.2))) + 44;
      const hLigne = Math.max(104, besoin);
      if (rangs * hLigne + (rangs - 1) * gap <= dispo) {
        choix = { colonnes, taille, hLigne, lignes };
        break;
      }
    }
    if (choix) break;
  }
  if (!choix) {
    const colonnes = n >= 3 ? 2 : 1;
    const largeurTexte = (largeurListe - (colonnes - 1) * gap) / colonnes - pad - marque - 28 - pad;
    const lignes = s.elements.map((e) => coupe(e.texte, 44, 600, largeurTexte));
    choix = { colonnes, taille: 44, hLigne: Math.max(...lignes.map((l) => hauteurLignes(l.length, 44, 1.2))) + 28, lignes };
  }
  const { colonnes, taille, lignes } = choix;
  const rangs = Math.ceil(n / colonnes);
  const hRang = Math.min(190, Math.max(choix.hLigne, (dispo - (rangs - 1) * gap) / rangs));
  const hBloc = rangs * hRang + (rangs - 1) * gap;
  const y0 = y + Math.max(0, (dispo - hBloc) / 2);
  const largeurCarte = (largeurListe - (colonnes - 1) * gap) / colonnes;
  const app = apparitions(s.elements.map((e) => e.apparitionMs), s.debutMs, 450, 180);
  let actif = -1;
  app.forEach((a, i) => {
    if (t >= a) actif = i;
  });
  s.elements.forEach((el, i) => {
    const col = colonnes === 2 ? i % 2 : 0;
    const rang = colonnes === 2 ? Math.floor(i / 2) : i;
    const cx = S.x + col * (largeurCarte + gap);
    const cy = y0 + rang * (hRang + gap);
    const e = douce(prog(t, app[i], 380));
    const courant = i === actif;
    out.push(carteEl(`${s.id}:carte${i}`, { x: cx, y: cy, largeur: largeurCarte, hauteur: hRang }, p.carte, courant ? p.accent : p.bordure, 0.5 + 0.5 * e, 28, courant ? 4 : 2));
    const hT = hauteurLignes(lignes[i].length, taille, 1.2);
    const xT = cx + pad + marque + 28;
    if (s.titre) {
      const d = 28 * (0.35 + 0.65 * rebond(prog(t, app[i], 450))) + (e >= 1 ? 3 * souffle(tl, 2200, i) : 0);
      out.push(disqueEl(`${s.id}:puce${i}`, cx + pad + marque / 2, cy + hRang / 2, Math.max(8, d), p.accent, undefined, e, 0, `${s.id}:carte${i}`));
    } else {
      out.push(texteEl({ id: `${s.id}:num${i}`, x: cx + pad, y: cy + (hRang - 72) / 2, largeur: marque, texte: String(i + 1), taille: 72, graisse: 800, couleur: p.accent, interligne: 1.0, opacite: e, dy: 20 * (1 - e), dans: `${s.id}:carte${i}` }));
    }
    out.push(
      texteEl({
        id: `${s.id}:texte${i}`,
        x: xT,
        y: cy + (hRang - hT) / 2,
        largeur: largeurCarte - pad - marque - 28 - pad,
        texte: el.texte,
        taille,
        graisse: 600,
        couleur: p.texte,
        accent: el.accent,
        couleurAccent: p.accent,
        interligne: 1.2,
        lignes: lignes[i],
        opacite: e,
        dy: 20 * (1 - e),
        dans: `${s.id}:carte${i}`,
      }),
    );
  });
  if (aCompte && s.compte !== null) {
    const zone = { x: colX(9), largeur: colsL(3) };
    const cxp = zone.x + zone.largeur / 2;
    const cyp = S.y + (BAS_SCENE - S.y) / 2;
    const eP = rebond(prog(tl, 250, 600));
    const dP = 290 * Math.max(0.05, eP) + 6 * souffle(tl, 3200);
    const idP = `${s.id}:pastille`;
    const cycle = (tl % 2600) / 2600;
    const idO = `${s.id}:onde`;
    // L'onde entoure la pastille : la pastille est « dans » l'onde.
    if (tl > 1200) out.push(disqueEl(idO, cxp, cyp, dP + 90 * douce(cycle), undefined, p.accent, 0.6 * (1 - cycle), 4));
    out.push(disqueEl(idP, cxp, cyp, dP, p.accent, undefined, borne(prog(tl, 250, 300)), 4, tl > 1200 ? idO : undefined));
    if (tl >= 600) {
      const valeur = Math.round(s.compte * douce(prog(tl, 650, 900)));
      out.push(texteEl({ id: `${s.id}:compte`, x: cxp - 130, y: cyp - 70, largeur: 260, texte: String(valeur), taille: 140, graisse: 800, couleur: p.surAccent, interligne: 1.0, alignement: "centre", opacite: prog(tl, 600, 250), dans: idP }));
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Étapes                                                              */
/* ------------------------------------------------------------------ */

function etapes(s: SceneEtapes, t: number): ElementPose[] {
  const tl = t - s.debutMs;
  const p = palette(s.fond);
  const S = ZONES_LONGUE.scene;
  const out: ElementPose[] = [];
  const n = s.elements.length;
  const gap = 44;
  const d = 112;
  const dispo = BAS_SCENE - S.y;
  const hRang = Math.min(240, (dispo - (n - 1) * gap) / Math.max(1, n));
  const hBloc = n * hRang + (n - 1) * gap;
  const y0 = S.y + (dispo - hBloc) / 2;
  const xCarte = S.x + d + 40;
  const lCarte = S.largeur - d - 40;
  const lTexte = lCarte - 96;
  const app = apparitions(s.elements.map((e) => e.apparitionMs), s.debutMs, 450, 220);
  let actif = -1;
  app.forEach((a, i) => {
    if (t >= a) actif = i;
  });
  // Même taille pour toutes les étapes de la scène.
  let taille: number = 56;
  for (const cand of [56, 52, TAILLES_LONGUE.etape, 46, 44]) {
    taille = cand;
    const maxH = Math.max(...s.elements.map((e) => hauteurLignes(coupe(e.texte, cand, 600, lTexte).length, cand, 1.2)));
    if (maxH <= hRang - 36) break;
  }
  s.elements.forEach((el, i) => {
    const ry = y0 + i * (hRang + gap);
    const e = douce(prog(t, app[i], 380));
    const courant = i === actif;
    const idCarte = `${s.id}:carte${i}`;
    out.push(carteEl(idCarte, { x: xCarte, y: ry, largeur: lCarte, hauteur: hRang }, p.carte, courant ? p.accent : p.bordure, 0.5 + 0.5 * e, 32, courant ? 4 : 2));
    const lignes = coupe(el.texte, taille, 600, lTexte);
    const hT = hauteurLignes(lignes.length, taille, 1.2);
    out.push(texteEl({ id: `${s.id}:texte${i}`, x: xCarte + 48, y: ry + (hRang - hT) / 2, largeur: lTexte, texte: el.texte, taille, graisse: 600, couleur: p.texte, accent: el.accent, couleurAccent: p.accent, interligne: 1.2, lignes, opacite: e, dy: 20 * (1 - e), dans: idCarte }));
    // Disque : plein pour l'étape lue, au trait sinon.
    const pop = courant ? Math.min(1, 0.82 + 0.18 * rebond(prog(t, app[i] + 120, 450))) * (0.965 + 0.035 * (0.5 + 0.5 * souffle(tl, 1800))) : 1;
    const idD = `${s.id}:disque${i}`;
    const cx = S.x + d / 2;
    const cy = ry + hRang / 2;
    const dd = d * pop;
    const futur = t < app[i];
    const op = futur ? 0.55 : 1;
    out.push(disqueEl(idD, cx, cy, dd, courant ? p.accent : p.fond === "noir" ? "noir" : "ivoire", p.accent, op, courant ? 0 : 5));
    out.push(texteEl({ id: `${s.id}:num${i}`, x: cx - dd / 2, y: cy - 38, largeur: dd, texte: String(s.numeroDepart + i), taille: 76, graisse: 800, couleur: courant ? p.surAccent : p.accent, interligne: 1.0, alignement: "centre", opacite: op, dans: idD }));
    if (i > 0) {
      const haut = y0 + (i - 1) * (hRang + gap) + hRang / 2 + d / 2 + 8;
      const bas = ry + hRang / 2 - d / 2 - 8;
      const q = douce(prog(t, app[i] - 60, 520));
      if (q > 0) out.push({ ...traitEl(`${s.id}:lien${i}`, { x: cx - 3, y: haut, largeur: 6, hauteur: Math.max(0, bas - haut) * q }, p.accent, 1, 1), trace: arrondi(q) });
    }
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* Chiffre                                                             */
/* ------------------------------------------------------------------ */

/** Le chiffre affiché à mi-compteur : mêmes séparateurs, mêmes décimales que le texte final. */
export function chiffreCompte(affiche: string, valeur: number, avancement: number): string {
  if (avancement >= 1) return affiche;
  const m = /\d[\d\s  ]*(?:[.,]\d+)?/.exec(affiche);
  if (!m) return affiche;
  const brut = m[0];
  const sep = /[\s  ]/.exec(brut)?.[0] ?? "";
  const dec = /[.,](\d+)$/.exec(brut);
  const nbDec = dec ? dec[1].length : 0;
  const signe = dec ? brut[brut.length - nbDec - 1] : ",";
  const v = Math.abs(valeur) * avancement;
  const [ent, frac = ""] = v.toFixed(nbDec).split(".");
  const entier = sep ? ent.replace(/\B(?=(\d{3})+(?!\d))/g, sep) : ent;
  return affiche.slice(0, m.index) + entier + (nbDec ? signe + frac : "") + affiche.slice(m.index + brut.length);
}

function chiffre(s: SceneChiffre, t: number): ElementPose[] {
  const tl = t - s.debutMs;
  const p = palette(s.fond);
  const S = ZONES_LONGUE.scene;
  const out: ElementPose[] = [];
  const n = s.chiffres.length;
  const largeurGauche = colsL(6);
  const zoneH = BAS_SCENE - S.y;
  if (n === 1) {
    const c = s.chiffres[0];
    const cx = S.x + largeurGauche / 2;
    const cy = S.y + zoneH / 2;
    const dRing = 700;
    const idR = `${s.id}:anneau`;
    const respire = 8 * souffle(tl, 3600);
    const trace = douce(prog(tl, 250, 900));
    out.push(formeEl(idR, "cercle", { x: cx - (dRing + respire) / 2, y: cy - (dRing + respire) / 2, largeur: dRing + respire, hauteur: dRing + respire }, p.accent, trace, 16, 0.95));
    const debut = Math.max(c.apparitionMs, s.debutMs + 350);
    const av = douce(prog(t, debut, 900));
    const largeurN = 520;
    const tN = Math.min(TAILLES_LONGUE.chiffre, Math.floor((largeurN * UTILE * TAILLES_LONGUE.chiffre) / Math.max(largeurN * 0.2, largeurLigne([c.affiche], TAILLES_LONGUE.chiffre, 800))));
    const tailleN = Math.max(120, tN);
    const aU = ajuster(c.unite, TAILLES_LONGUE.unite, 44, 700, largeurN, 64 * 1.2 * 1.01, 1.2);
    const hU = c.unite ? hauteurLignes(aU.lignes.length, aU.taille, 1.2) : 0;
    const total = tailleN + (c.unite ? 14 + hU : 0);
    const yN = cy - total / 2;
    const e = prog(tl, 150, 300);
    out.push(texteEl({ id: `${s.id}:nombre`, x: cx - largeurN / 2, y: yN, largeur: largeurN, texte: chiffreCompte(c.affiche, c.valeur, av), taille: tailleN, graisse: 800, couleur: p.accent, interligne: 1.0, alignement: "centre", opacite: e, lignes: [[chiffreCompte(c.affiche, c.valeur, av)]], dans: idR }));
    if (c.unite) {
      const a = aU;
      const eU = douce(prog(t, debut + 500, 400));
      out.push(texteEl({ id: `${s.id}:unite`, x: cx - largeurN / 2, y: yN + tailleN + 14, largeur: largeurN, texte: c.unite, taille: a.taille, graisse: 700, couleur: p.texte, interligne: 1.2, alignement: "centre", lignes: a.lignes, opacite: eU, dy: 16 * (1 - eU), dans: idR }));
    }
  } else {
    const hBloc = 330;
    const y1 = S.y + 20;
    s.chiffres.forEach((c, i) => {
      const by = y1 + i * (hBloc + 40);
      const debut = Math.max(c.apparitionMs, s.debutMs + 350 + i * 250);
      const av = douce(prog(t, debut, 900));
      const tailleN = Math.max(120, Math.min(190, Math.floor((largeurGauche * UTILE * 190) / Math.max(largeurGauche * 0.2, largeurLigne([c.affiche], 190, 800)))));
      const hU = c.unite ? 56 * 1.2 : 0;
      const contenu = tailleN + (c.unite ? 10 + hU : 0);
      const yN = by + (hBloc - contenu) / 2;
      const e = prog(tl, 150 + i * 200, 300);
      const texteN = chiffreCompte(c.affiche, c.valeur, av);
      out.push(texteEl({ id: `${s.id}:nombre${i}`, x: S.x, y: yN, largeur: largeurGauche, texte: texteN, taille: tailleN, graisse: 800, couleur: p.accent, interligne: 1.0, lignes: [[texteN]], opacite: e }));
      if (c.unite) {
        const a = ajuster(c.unite, 56, 44, 700, largeurGauche, 140, 1.2);
        const eU = douce(prog(t, debut + 500, 400));
        out.push(texteEl({ id: `${s.id}:unite${i}`, x: S.x, y: yN + tailleN + 10, largeur: largeurGauche, texte: c.unite, taille: a.taille, graisse: 700, couleur: p.texte, interligne: 1.2, lignes: a.lignes, opacite: eU, dy: 16 * (1 - eU) }));
      }
      if (i === 0) out.push(traitEl(`${s.id}:separe`, { x: S.x, y: by + hBloc + 18, largeur: largeurGauche, hauteur: 4 }, p.fond === "noir" ? "grisSurNoir" : "gris", douce(prog(tl, 600, 700))));
    });
  }
  // Contexte : carte à droite, barre d'accent à gauche du texte.
  const xC = colX(6);
  const lC = colsL(6);
  const lTexte = lC - 80 - 48;
  const a = ajuster(s.contexte, 60, 44, 600, lTexte, 560, 1.25);
  const hT = hauteurLignes(a.lignes.length, a.taille, 1.25);
  const hCarte = Math.min(zoneH, Math.max(300, hT + 140));
  const yCarte = S.y + (zoneH - hCarte) / 2;
  const accent = s.chiffres.map((c) => [c.affiche, c.ecrit]).flat().find((m) => m && nettoie(s.contexte).includes(m)) ?? null;
  const eC = douce(prog(tl, 300, 450));
  const idC = `${s.id}:carte`;
  out.push(carteEl(idC, { x: xC, y: yCarte, largeur: lC, hauteur: hCarte }, p.carte, p.bordure, 0.4 + 0.6 * eC, 32, 2));
  out.push(traitEl(`${s.id}:barre`, { x: xC + 40, y: yCarte + (hCarte - hT) / 2, largeur: 8, hauteur: hT * douce(prog(tl, 500, 600)) }, p.accent, 1, 0.8 + 0.2 * souffle(tl, 1800), idC));
  out.push(texteEl({ id: `${s.id}:contexte`, x: xC + 80, y: yCarte + (hCarte - hT) / 2, largeur: lTexte, texte: s.contexte, taille: a.taille, graisse: 600, couleur: p.texte, accent, couleurAccent: p.accent, interligne: 1.25, lignes: a.lignes, opacite: douce(prog(tl, 420, 450)), dy: 20 * (1 - douce(prog(tl, 420, 450))), dans: idC }));
  return out;
}

/* ------------------------------------------------------------------ */
/* Avant / après                                                       */
/* ------------------------------------------------------------------ */

function avantApres(s: SceneAvantApres, t: number): ElementPose[] {
  const tl = t - s.debutMs;
  const p = palette(s.fond);
  const S = ZONES_LONGUE.scene;
  const out: ElementPose[] = [];
  const lCarte = 760;
  const lT = lCarte - 96;
  const a = ajuster(s.avant, 52, 44, 600, lT, 480, 1.2);
  const b = ajuster(s.apres, 72, 44, 800, lT, 480, 1.15);
  const hA = hauteurLignes(a.lignes.length, a.taille, 1.2);
  const hB = hauteurLignes(b.lignes.length, b.taille, 1.15);
  const hC = Math.min(BAS_SCENE - S.y - 40, Math.max(520, 140 + Math.max(hA, hB) + 90));
  const yC = S.y + (BAS_SCENE - S.y - hC) / 2;
  const xA = S.x;
  const xB = S.x + S.largeur - lCarte;
  const idA = `${s.id}:avant`;
  const idB = `${s.id}:apres`;
  const eA = douce(prog(tl, 120, 450));
  const appB = Math.max(s.apparitionApresMs, s.debutMs + 1300);
  const eB = douce(prog(t, appB, 450));
  const fondAvant: CouleurLongue = p.fond === "noir" ? "noir" : "gris";
  out.push(carteEl(idA, { x: xA, y: yC, largeur: lCarte, hauteur: hC }, fondAvant, p.fond === "noir" ? p.bordure : undefined, 0.4 + 0.6 * eA, 36, 2));
  out.push(carteEl(idB, { x: xB, y: yC, largeur: lCarte, hauteur: hC }, p.carte, p.accent, 0.4 + 0.6 * eB, 36, 5));
  const hautTexte = yC + 140;
  const dispo = yC + hC - 56 - hautTexte;
  const yA = hautTexte + (dispo - hA) / 2;
  const yB = hautTexte + (dispo - hB) / 2;
  out.push(etiquetteEl(`${s.id}:etiqA`, xA + 48, yC + 44, 360, "AVANT", p.texte, eA, "gauche", idA));
  out.push(etiquetteEl(`${s.id}:etiqB`, xB + 48, yC + 44, 360, "MAINTENANT", p.accent, 0.5 + 0.5 * eB, "gauche", idB));
  out.push(texteEl({ id: `${s.id}:texteA`, x: xA + 48, y: yA, largeur: lT, texte: s.avant, taille: a.taille, graisse: 600, couleur: p.texte, interligne: 1.2, lignes: a.lignes, opacite: eA * (1 - 0.25 * prog(t, s.debutMs + 900, 500)), dy: 20 * (1 - eA), dans: idA }));
  // Le trait qui barre : une ligne par ligne de texte, tracées l'une après l'autre.
  a.lignes.forEach((mots, i) => {
    const q = douce(prog(tl, 600 + i * 220, 380));
    if (q <= 0) return;
    const w = largeurLigne(mots, a.taille, 600);
    out.push(traitEl(`${s.id}:barre${i}`, { x: xA + 48, y: yA + 20 * (1 - eA) + i * a.taille * 1.2 + a.taille * 0.6 - 3, largeur: Math.min(lT, w), hauteur: 6 }, p.accent, q, 1, `${s.id}:texteA`));
  });
  out.push(texteEl({ id: `${s.id}:texteB`, x: xB + 48, y: yB, largeur: lT, texte: s.apres, taille: b.taille, graisse: 800, couleur: p.texte, interligne: 1.15, lignes: b.lignes, opacite: eB, dy: 24 * (1 - eB), dans: idB }));
  // Coche en haut à droite de la carte « après ».
  const qc = douce(prog(t, appB + 120, 500));
  if (qc > 0) out.push(formeEl(`${s.id}:coche`, "coche", { x: xB + lCarte - 48 - 100, y: yC + 28, largeur: 100, hauteur: 100 }, p.accent, qc, 9, 1, idB));
  // Flèche tracée dans l'espace entre les deux cartes.
  const gapX = xB - (xA + lCarte);
  const wF = 112;
  const dxF = 10 * souffle(tl, 2200);
  const qf = douce(prog(t, appB - 500, 500));
  if (qf > 0) out.push(formeEl(`${s.id}:fleche`, "fleche", { x: xA + lCarte + (gapX - wF) / 2 + dxF, y: yC + hC / 2 - wF / 2, largeur: wF, hauteur: wF }, p.accent, qf, 9));
  return out;
}

/* ------------------------------------------------------------------ */
/* Phrase clé                                                          */
/* ------------------------------------------------------------------ */

function phraseCle(s: ScenePhraseCle, t: number): ElementPose[] {
  const tl = t - s.debutMs;
  const p = palette(s.fond);
  const S = ZONES_LONGUE.scene;
  const out: ElementPose[] = [];
  const largeur = colsL(8);
  const interligne = 1.25;
  const a = ajuster(s.phrase, TAILLES_LONGUE.phraseCle, 56, 800, largeur, 560, interligne);
  const hT = hauteurLignes(a.lignes.length, a.taille, interligne);
  const zoneH = BAS_SCENE - S.y;
  const yT = S.y + (zoneH - hT) / 2 + 20;
  const e = douce(prog(tl, 200, 600));
  out.push(traitEl(`${s.id}:filet`, { x: S.x, y: yT - 64, largeur: 160, hauteur: 10 }, p.accent, douce(prog(tl, 100, 600))));
  const idT = `${s.id}:phrase`;
  out.push(texteEl({ id: idT, x: S.x, y: yT, largeur, texte: s.phrase, taille: a.taille, graisse: 800, couleur: p.texte, accent: s.motCle, couleurAccent: p.accent, interligne, lignes: a.lignes, opacite: e, dy: MONTEE_PX * (1 - e) }));
  if (s.motCle) {
    const mots = morceaux(s.phrase, a.lignes, s.motCle);
    mots.forEach((ligne, i) => {
      const avant = ligne.filter((m, k) => !m.accent && ligne.slice(k + 1).some((x) => x.accent)).map((m) => m.texte.trim().split(" ")).flat();
      const dans = ligne.filter((m) => m.accent).map((m) => m.texte.trim().split(" ")).flat();
      if (!dans.length) return;
      const x0 = largeurLigne(avant, a.taille, 800) + (avant.length ? ESPACE_MOTS_EM * a.taille : 0);
      const w = largeurLigne(dans, a.taille, 800);
      const q = douce(prog(tl, 800 + i * 300, 500));
      if (q > 0) out.push(traitEl(`${s.id}:souligne${i}`, { x: S.x + x0, y: yT + MONTEE_PX * (1 - e) + i * a.taille * interligne + a.taille * interligne - 14, largeur: Math.min(w * 0.96, largeur - x0), hauteur: 8 }, p.accent, q, 1, idT));
    });
  }
  const cote = 360;
  const d = 10;
  const zone = { x: colX(8), largeur: colsL(4) };
  out.push(
    formeEl(
      `${s.id}:forme`,
      s.forme,
      { x: zone.x + (zone.largeur - cote) / 2 + d * souffle(tl, 6800), y: S.y + (zoneH - cote) / 2 + d * souffle(tl, 5200, 1.3), largeur: cote, hauteur: cote },
      p.accent,
      douce(prog(tl, 300, 900)),
      13,
      1,
    ),
  );
  return out;
}

/* ------------------------------------------------------------------ */
/* Fin                                                                 */
/* ------------------------------------------------------------------ */

/** Position du logo de la fin (dessiné par la composition, hors de tout élément posé) : tout le bloc est centré dans la zone pleine. */
export function logoFin(s: SceneFin): { y: number; hauteur: number } {
  const hLogo = 240;
  const hQ = s.question ? hauteurLignes(ajuster(s.question, TAILLES_LONGUE.finAdresse, 44, 600, 1400, 200, 1.25).lignes.length, TAILLES_LONGUE.finAdresse, 1.25) + 80 : 40;
  const total = hLogo + 60 + hQ + 160 + 90 + 60;
  return { y: ZONES_LONGUE.plein.y + (ZONES_LONGUE.plein.hauteur - total) / 2, hauteur: hLogo };
}

function fin(s: SceneFin, t: number): ElementPose[] {
  const tl = t - s.debutMs;
  const p = palette(s.fond);
  const out: ElementPose[] = [];
  const largeur = 1400;
  const x = (1920 - largeur) / 2;
  const lg = logoFin(s);
  let y = lg.y + lg.hauteur + 60;
  if (s.question) {
    const a = ajuster(s.question, TAILLES_LONGUE.finAdresse, 44, 600, largeur, 200, 1.25);
    const h = hauteurLignes(a.lignes.length, a.taille, 1.25);
    const e = douce(prog(tl, 250, 500));
    out.push(texteEl({ id: `${s.id}:question`, x, y, largeur, texte: s.question, taille: a.taille, graisse: 600, couleur: p.texte, interligne: 1.25, alignement: "centre", lignes: a.lignes, opacite: e, dy: MONTEE_PX * (1 - e) }));
    y += h + 80;
  } else {
    y += 40;
  }
  const tA = TAILLES_LONGUE.finAppel;
  const wTexte = largeurLigne(nettoie(s.appel).split(" "), tA, 800);
  const wBouton = Math.min(largeur, wTexte + 200);
  const hBouton = 160;
  const pulse = 1 + 0.015 * (1 + souffle(tl, 1600, -Math.PI / 2));
  const eB = rebond(prog(tl, 650, 600));
  const echelle = Math.max(0.05, (0.88 + 0.12 * eB) * (tl > 1300 ? pulse : 1));
  const cx = 960;
  const cy = y + hBouton / 2;
  const idB = `${s.id}:bouton`;
  out.push({
    id: idB,
    nature: "carte",
    role: "decor",
    rect: { x: arrondi(cx - (wBouton * echelle) / 2), y: arrondi(cy - (hBouton * echelle) / 2), largeur: arrondi(wBouton * echelle), hauteur: arrondi(hBouton * echelle) },
    opacite: arrondi(borne(prog(tl, 650, 300))),
    couleur: "terracotta",
    fond: "terracotta",
    rayonPx: 80,
    ...(tl > 1300 ? { dans: `${s.id}:onde` } : {}),
  });
  if (tl > 1300) {
    const cycle = ((tl - 1300) % 2400) / 2400;
    const g = 12 + 48 * douce(cycle);
    out.push({
      id: `${s.id}:onde`,
      nature: "carte",
      role: "decor",
      rect: { x: arrondi(cx - wBouton / 2 - g), y: arrondi(cy - hBouton / 2 - g), largeur: arrondi(wBouton + 2 * g), hauteur: arrondi(hBouton + 2 * g) },
      opacite: arrondi(0.7 * (1 - cycle)),
      couleur: p.accent,
      bordure: p.accent,
      rayonPx: 80 + g,
      epaisseurPx: 4,
    });
  }
  out.push(texteEl({ id: `${s.id}:appel`, x: cx - (wBouton * echelle) / 2, y: cy - (tA * 1.0) / 2, largeur: wBouton * echelle, texte: s.appel, taille: tA, graisse: 800, couleur: "blanc", interligne: 1.0, alignement: "centre", lignes: [[s.appel]], opacite: prog(tl, 750, 300), dans: idB }));
  const eAd = douce(prog(tl, 1100, 500));
  out.push(texteEl({ id: `${s.id}:adresse`, x, y: y + hBouton + 90 - MONTEE_PX * 0 + MONTEE_PX * (1 - eAd), largeur, texte: s.adresse, taille: TAILLES_LONGUE.finAdresse, graisse: 700, couleur: p.accent, interligne: 1.15, alignement: "centre", opacite: eAd }));
  return out;
}


/* ------------------------------------------------------------------ */
/* API publique                                                        */
/* ------------------------------------------------------------------ */

/** Mise en page d'une scène à l'instant `tMs` (temps de la vidéo entière). PURE. */
export const poserScene: PoserScene = (scene, tMs) => {
  switch (scene.type) {
    case "carton-titre":
      return cartonTitre(scene, tMs);
    case "carton-chapitre":
      return cartonChapitre(scene, tMs);
    case "liste":
      return liste(scene, tMs);
    case "etapes":
      return etapes(scene, tMs);
    case "chiffre":
      return chiffre(scene, tMs);
    case "avant-apres":
      return avantApres(scene, tMs);
    case "phrase-cle":
      return phraseCle(scene, tMs);
    case "fin":
      return fin(scene, tMs);
  }
};

/** Vrai si la scène a la bande de sous-titres (les cartons et la fin n'en ont pas). */
export const sceneAvecBande = (type: string): boolean => type !== "carton-titre" && type !== "carton-chapitre" && type !== "fin";

/** Sous-titre posé dans la zone du texte de la bande à l'instant `tMs`, ou null hors de sa durée. PURE. */
export const poserSousTitre: PoserSousTitre = (ligne: LigneSousTitre, tMs) => {
  if (tMs < ligne.debutMs || tMs >= ligne.finMs) return null;
  const Z = ZONES_LONGUE.texteSousTitres;
  let taille: number = TAILLES_LONGUE.sousTitrePx;
  let lignes = coupe(ligne.texte, taille, 600, Z.largeur);
  if (lignes.length > TAILLES_LONGUE.sousTitreLignesMax) {
    taille = TAILLES_LONGUE.texteMinPx;
    lignes = coupe(ligne.texte, taille, 600, Z.largeur);
  }
  const interligne = 1.25;
  const h = hauteurLignes(lignes.length, taille, interligne);
  const duree = ligne.finMs - ligne.debutMs;
  const fondu = Math.min(120, duree / 3);
  const opacite = Math.min(prog(tMs, ligne.debutMs, fondu), 1 - prog(tMs, ligne.finMs - fondu, fondu));
  return {
    id: `sous-titre:${ligne.debutMs}`,
    nature: "texte",
    role: "contenu",
    rect: { x: Z.x, y: arrondi(Z.y + (Z.hauteur - Math.min(h, Z.hauteur)) / 2), largeur: Z.largeur, hauteur: arrondi(h) },
    opacite: arrondi(borne(opacite)),
    couleur: "noir",
    lignes: morceaux(ligne.texte, lignes, null),
    taillePx: taille,
    graisse: 600,
    interligne,
    alignement: "centre",
  };
};

/** Durée de la transition d'entrée (réexportée pour le rendu). */
export const DUREE_TRANSITION_MS = TEMPS_LONGUE.transitionMs;
