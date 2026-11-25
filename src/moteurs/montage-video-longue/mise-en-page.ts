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
  type Rect,
  type SceneAvantApres,
  type SceneCartonChapitre,
  type SceneCartonTitre,
  type SceneChiffre,
  type SceneEtapes,
  type SceneFin,
  type SceneListe,
  type SceneLongue,
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
/**
 * Haut et bas utiles d'une scène de contenu. Haut : 106 px (le zoom 1,06 ne fait jamais passer le contenu sous 80 px du haut).
 * Bas : 800 px, soit au moins 40 px au-dessus de la barre de progression (846 px) même quand une carte flotte.
 */
const HAUT_SCENE = 106;
const BAS_SCENE = 800;
/** Zoom lent de la scène : 1 → 1,06 sur sa durée, autour de ce point (le rendu applique la transformation). */
export const ZOOM_SCENE = 1.06;
export const ORIGINE_ZOOM_Y = 420;
/** Les cartes d'une scène flottent de ±6 px (période 3 s) : elles bougent sans jamais toucher la barre de progression. */
const FLOTTE_CARTE_PX = 6;
/** Va-et-vient 0 → 1 de période `periodeMs`. */
const onde = (tl: number, periodeMs: number, dephasage = 0) => 0.5 + 0.5 * Math.sin((2 * Math.PI * tl) / periodeMs + dephasage);

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
    const propre = texte.replace(/\*/g, "");
    r = couperLignes(propre, taille, graisse, largeur * UTILE, 0);
    // Lignes équilibrées : même nombre de lignes, largeur la plus étroite possible (pas de mot orphelin en dernière ligne).
    if (r.length >= 2) {
      let bas = Math.max(...propre.split(/\s+/).filter(Boolean).map((m) => largeurMotMotion(m, taille, graisse, 0)));
      let haut = largeur * UTILE;
      const n = r.length;
      for (let k = 0; k < 14; k++) {
        const mil = (bas + haut) / 2;
        if (couperLignes(propre, taille, graisse, mil, 0).length <= n) haut = mil;
        else bas = mil;
      }
      r = couperLignes(propre, taille, graisse, haut, 0);
    }
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

/**
 * Les mots de chaque ligne regroupés en morceaux (accent ou non). Les espaces sont portés par le morceau qui précède.
 * La ponctuation collée à un mot clé (« manquer, ») reste hors de l'accent : jamais de virgule soulignée.
 */
function morceaux(texte: string, lignes: string[][], accent: string | null): MorceauLigne[][] {
  const propre = nettoie(texte);
  const cible = accent ? nettoie(accent) : "";
  const debutAccent = cible ? propre.indexOf(cible) : -1;
  const finAccent = debutAccent >= 0 ? debutAccent + cible.length : -1;
  let curseur = 0;
  return lignes.map((mots) => {
    const res: { texte: string; accent: boolean; espaceApres: boolean }[] = [];
    mots.forEach((m, k) => {
      const i = propre.indexOf(m, curseur);
      const debut = i < 0 ? curseur : i;
      curseur = debut + m.length;
      // Parties du mot : avant l'accent, dans l'accent, après l'accent.
      const a0 = Math.min(m.length, Math.max(0, debutAccent - debut));
      const a1 = Math.min(m.length, Math.max(0, finAccent - debut));
      const parties: { t: string; accent: boolean }[] =
        debutAccent < 0 || a1 <= a0 ? [{ t: m, accent: false }] : [{ t: m.slice(0, a0), accent: false }, { t: m.slice(a0, a1), accent: true }, { t: m.slice(a1), accent: false }];
      parties
        .filter((x) => x.t)
        .forEach((x, j) => {
          const dernier = res[res.length - 1];
          const espace = j === 0 && k > 0;
          if (dernier && dernier.accent === x.accent) dernier.texte += (espace ? " " : "") + x.t;
          else {
            if (dernier) dernier.espaceApres = espace;
            res.push({ texte: x.t, accent: x.accent, espaceApres: false });
          }
        });
    });
    return res.map((p) => ({ texte: p.espaceApres ? `${p.texte} ` : p.texte, accent: p.accent }));
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
  const cote = 360;
  const forme = formeEl(
    `${s.id}:forme`,
    "cible",
    { x: 1400 + 8 * souffle(tl, 3000, Math.PI / 2), y: Z.y + (Z.hauteur - cote) / 2 + 14 * souffle(tl, 3000), largeur: cote, hauteur: cote },
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

/** Icônes des chapitres : choisie par les mots du titre, sinon par le rang. */
const ICONES_CHAPITRE: FormeLongue[] = ["horloge", "graphique", "alerte", "fleche", "calendrier", "cible", "coche", "cercle"];
export function formeChapitre(titre: string, rang: number): FormeLongue {
  const t = titre.toLowerCase();
  const parRang = ICONES_CHAPITRE[(Math.max(1, rang) - 1) % ICONES_CHAPITRE.length];
  if (/commenc|d[ée]marr|d[ée]but|premier|d[ée]part|lancer|[ée]tape/.test(t)) return "fleche";
  if (/alerte/.test(t)) return "cloche";
  if (/manqu|rupture|seuil|pr[ée]venir|surveill/.test(t)) return "alerte";
  if (/solution|tableau|bord|outil|r[ée]sultat|chiffre|suivi|donn[ée]es/.test(t)) return "graphique";
  if (/probl[èe]me|main|erreur|perte|temps|manuel|compter/.test(t)) return "horloge";
  if (/pourquoi|enjeu|objectif|but/.test(t)) return "cible";
  if (/conclusion|bilan|r[ée]sum|v[ée]rif|valid/.test(t)) return "coche";
  return parRang;
}

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
  out.push(formeEl(`${s.id}:forme`, formeChapitre(s.titre, s.rang), { x: 1400 + 8 * souffle(tl, 3000, Math.PI / 2), y: Z.y + (yBas - Z.y - cote) / 2 + 14 * souffle(tl, 3000), largeur: cote - 20, hauteur: cote - 20 }, p.accent, douce(prog(tl, 300, 1100)), 14, 0.9));
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
  brutes.forEach((b, i) => res.push(i === 0 ? debut + premier : Math.max(b, res[i - 1] + pas)));
  return res;
}

/** Barre fine de progression de la scène (bas de la zone de scène) : elle se remplit du début à la fin, donc rien n'est jamais figé. */
function barreProgres(s: SceneLongue, t: number): ElementPose[] {
  const S = sceneAvecBande(s.type) ? ZONES_LONGUE.scene : ZONES_LONGUE.plein;
  const p = palette(s.fond);
  const q = prog(t, s.debutMs, Math.max(1, s.finMs - s.debutMs));
  const y = S.y + S.hauteur - 14;
  const vide: CouleurLongue = p.fond === "noir" ? "grisSurNoir" : "gris";
  const out = [carteEl(`${s.id}:progres`, { x: S.x, y, largeur: S.largeur, hauteur: 8 }, vide, undefined, p.fond === "noir" ? 0.4 : 0.9, 4)];
  const w = Math.max(2, S.largeur * q);
  out.push(carteEl(`${s.id}:progres-plein`, { x: S.x, y, largeur: w, hauteur: 8 }, p.accent, undefined, 1, 4, 0, `${s.id}:progres`));
  return out;
}

/** Icône d'une tuile, choisie dans le libellé (jamais deux fois la même dans une scène). */
const POOL_TUILES: FormeLongue[] = ["graphique", "alerte", "horloge", "calendrier", "cible", "fleche"];
function iconeTuile(texte: string, deja: Set<FormeLongue>): FormeLongue {
  const m: FormeLongue | null = /épuis|manqu|rupture|alerte|seuil|critique/i.test(texte)
    ? "alerte"
    : /attente|commande|délai|retard|livraison/i.test(texte)
      ? "horloge"
      : /valeur|stock|total|chiffre|vente|euro|€/i.test(texte)
        ? "graphique"
        : null;
  const f = m && !deja.has(m) ? m : (POOL_TUILES.find((x) => !deja.has(x)) ?? "cercle");
  deja.add(f);
  return f;
}

/** Liste annoncée par un nombre (« trois chiffres ») : de grandes tuiles côte à côte, façon tableau de bord. Libellés seulement, aucun chiffre inventé. */
function tuiles(s: SceneListe, t: number): ElementPose[] {
  const tl = t - s.debutMs;
  const p = palette(s.fond);
  const S = ZONES_LONGUE.scene;
  const out: ElementPose[] = [];
  const n = s.elements.length;
  const gap = 32;
  const wT = (S.largeur - (n - 1) * gap) / n;
  const pad = 40;
  const icone = n <= 3 ? 150 : 130;
  const wTexte = wT - 2 * pad;
  const zoneH = BAS_SCENE - HAUT_SCENE;
  const dPast = 176;
  const aT = s.titre ? ajuster(s.titre, 84, 64, 800, S.largeur - dPast - 56, 200, 1.1) : null;
  const hTitre = aT ? hauteurLignes(aT.lignes.length, aT.taille, 1.1) : 0;
  const hRangee = aT ? Math.max(hTitre, dPast + 14) : 0;
  const entre = aT ? hRangee + 52 : 0;
  let taille = 56;
  let lignes: string[][][] = [];
  for (const cand of [56, 52, 48, 46, 44]) {
    taille = cand;
    lignes = s.elements.map((e) => coupe(e.texte, cand, 600, wTexte));
    if (pad + icone + 30 + Math.max(...lignes.map((l) => hauteurLignes(l.length, cand, 1.2))) + pad <= zoneH - entre - 20) break;
  }
  const hTexteMax = Math.max(...lignes.map((l) => hauteurLignes(l.length, taille, 1.2)));
  const hTuile = Math.max(pad + icone + 30 + hTexteMax + pad, Math.min(zoneH - entre - 20, aT ? 400 : 520));
  const total = entre + hTuile;
  const y0 = HAUT_SCENE + (zoneH - total) / 2;
  if (aT) {
    const e = douce(prog(tl, 120, 450));
    out.push(texteEl({ id: `${s.id}:titre`, x: S.x, y: y0 + (hRangee - hTitre) / 2, largeur: Math.min(S.largeur - dPast - 56, Math.max(...aT.lignes.map((l) => largeurLigne(l, aT.taille, 800))) + 8), texte: s.titre ?? "", taille: aT.taille, graisse: 800, couleur: p.texte, interligne: 1.1, lignes: aT.lignes, opacite: e, dy: MONTEE_PX * (1 - e) }));
    // La pastille est accolée au titre et affiche d'emblée le compte final, avec un petit rebond.
    const wTitre = Math.max(...aT.lignes.map((l) => largeurLigne(l, aT.taille, 800)));
    const cxp = S.x + wTitre + 48 + dPast / 2;
    const cyp = y0 + hRangee / 2;
    const eP = rebond(prog(tl, 200, 600));
    const dP = Math.max(8, dPast * Math.max(0.05, eP) - 14 + 10 * souffle(tl, 2400));
    const idP = `${s.id}:pastille`;
    out.push(disqueEl(idP, cxp, cyp, dP, p.accent, undefined, borne(prog(tl, 200, 250)), 0));
    if (tl >= 350 && s.compte !== null) out.push(texteEl({ id: `${s.id}:compte`, x: cxp - 70, y: cyp - 48, largeur: 140, texte: String(s.compte), taille: 96, graisse: 800, couleur: p.surAccent, interligne: 1.0, alignement: "centre", opacite: prog(tl, 350, 200), dans: idP }));
  }
  // Les tuiles se posent l'une après l'autre dès le début de la scène : le tableau de bord est complet en une seconde.
  const app = s.elements.map((_e, i) => s.debutMs + 450 + i * 250);
  let actif = -1;
  app.forEach((a, i) => {
    if (t >= a) actif = i;
  });
  const deja = new Set<FormeLongue>();
  s.elements.forEach((el, i) => {
    const forme = iconeTuile(el.texte, deja);
    // Les tuiles sont posées dès le début de la scène, en contour terracotta ; le libellé et l'icône arrivent à leur tour.
    const eC = douce(prog(tl, 100, 400));
    const e = douce(prog(t, app[i], 420));
    const dy = 26 * (1 - eC) + FLOTTE_CARTE_PX * souffle(tl, 3000, i * 2.1);
    const cx = S.x + i * (wT + gap);
    const cy = y0 + entre + dy;
    const idT = `${s.id}:tuile${i}`;
    const courant = i === actif;
    if (courant) out.push(halo(idT, { x: cx, y: cy, largeur: wT, hauteur: hTuile }, tl, eC, 32, p));
    out.push(carteEl(idT, { x: cx, y: cy, largeur: wT, hauteur: hTuile }, p.carte, p.accent, eC, 32, courant ? 5 : 3));
    if (t <= app[i]) return;
    out.push(formeEl(`${s.id}:icone${i}`, forme, { x: cx + pad, y: cy + pad, largeur: icone, hauteur: icone }, p.accent, douce(prog(t, app[i] + 120, 800)), 8, e, idT));
    const hT = hauteurLignes(lignes[i].length, taille, 1.2);
    out.push(texteEl({ id: `${s.id}:texte${i}`, x: cx + pad, y: cy + hTuile - pad - hT, largeur: wTexte, texte: el.texte, taille, graisse: 600, couleur: p.texte, accent: el.accent, couleurAccent: p.accent, interligne: 1.2, lignes: lignes[i], opacite: e, dans: idT }));
  });
  return out;
}

/** Forme de remplacement : deux scènes voisines (numéros d'identifiant de parité différente) n'ont jamais la même icône. */
const AUTRE_FORME: Partial<Record<FormeLongue, FormeLongue>> = { cloche: "fleche", tableur: "liste", cible: "coche", calendrier: "horloge", graphique: "tableur", liste: "coche" };

/** Forme de l'icône posée à droite d'une liste ou d'étapes (d'après leurs mots) ; la parité du numéro de scène alterne avec l'autre forme. */
export function formeDeListe(textes: string[], type: "liste" | "etapes", idScene = ""): FormeLongue {
  const t = textes.join(" ").toLowerCase();
  let f: FormeLongue;
  if (/alerte|message|résumé|resume|notification|préviens|prévient/.test(t)) f = "cloche";
  else if (/tableur|rempli|feuille/.test(t)) f = "tableur";
  else if (/seuil|objectif|cible|priorit/.test(t)) f = "cible";
  else if (type === "etapes") f = "liste";
  else if (/semaine|mois|lundi|calendrier|année|jour/.test(t)) f = "calendrier";
  else if (/chiffre|stock|tableau|vente|catalogue|valeur|article/.test(t)) f = "graphique";
  else f = "liste";
  const num = Number(/(\d+)\s*$/.exec(idScene)?.[1] ?? 0);
  return num % 2 === 1 ? (AUTRE_FORME[f] ?? f) : f;
}

/** Icône animée à droite des cartes (4 colonnes) : grande, qui flotte (sinus vertical ±14 px, période 3 s) et s'anime selon sa nature. */
function iconeDroite(s: SceneListe | SceneEtapes, tl: number, p: Palette): ElementPose {
  const zone = { x: colX(8), largeur: colsL(4) };
  const cote = 420;
  const cy = HAUT_SCENE + (BAS_SCENE - HAUT_SCENE) / 2;
  const forme = formeDeListe(s.elements.map((e) => e.texte), s.type, s.id);
  return formeEl(`${s.id}:forme`, forme, { x: zone.x + (zone.largeur - cote) / 2 + 8 * souffle(tl, 3000, Math.PI / 2), y: cy - cote / 2 + 14 * souffle(tl, 3000), largeur: cote, hauteur: cote }, p.accent, douce(prog(tl, 200, 900)), 12, 1);
}

/** Halo qui pulse DANS la carte active : un filet d'accent qui s'écarte du bord puis y revient (jamais hors de la carte), et s'éclaircit. */
function halo(id: string, r: Rect, tl: number, apparition: number, rayon: number, p: Palette): ElementPose {
  const w = onde(tl, 1600);
  const g = 3 + 6 * w;
  return carteEl(`${id}:halo`, { x: r.x + g, y: r.y + g, largeur: r.largeur - 2 * g, hauteur: r.hauteur - 2 * g }, undefined, p.accent, apparition * (0.2 + 0.5 * w), Math.max(8, rayon - g), 3, id);
}

function liste(s: SceneListe, t: number): ElementPose[] {
  if (s.compte !== null && s.elements.length >= 2 && s.elements.length <= 4) return tuiles(s, t);
  const tl = t - s.debutMs;
  const p = palette(s.fond);
  const S = ZONES_LONGUE.scene;
  const out: ElementPose[] = [];
  const aCompte = s.compte !== null;
  const avecIcone = !aCompte && s.elements.length <= 2;
  const largeurListe = aCompte ? colsL(9) : avecIcone ? colsL(8) : S.largeur;
  const zoneH = BAS_SCENE - HAUT_SCENE;
  let hTitre = 0;
  let aTitre: { taille: number; lignes: string[][] } | null = null;
  if (s.titre) {
    aTitre = ajuster(s.titre, s.elements.length <= 3 ? 80 : 72, 60, 800, largeurListe, 190, 1.1);
    hTitre = hauteurLignes(aTitre.lignes.length, aTitre.taille, 1.1) + 48;
  }
  const n = s.elements.length;
  const dispo = zoneH - hTitre;
  const gap = n >= 5 ? 20 : 28;
  const marque = s.titre ? 28 : 68;
  const pad = 40;
  const minH = n <= 2 ? 210 : n === 3 ? 170 : n === 4 ? 120 : 92;
  // Taille et colonnes : la plus grande taille qui tient (60 px et plus tant que possible, 56 px au moins avant de descendre).
  let choix: { colonnes: number; taille: number; hLigne: number; lignes: string[][][] } | null = null;
  const tailles = n <= 2 ? [66, 64, 62, 60, 56, 52, 48, 44] : [62, 60, 58, 56, 52, 50, 48, 46, 44];
  for (const taille of tailles) {
    for (const colonnes of n >= 3 ? [1, 2] : [1]) {
      const largeurCarte = (largeurListe - (colonnes - 1) * gap) / colonnes;
      const largeurTexte = largeurCarte - pad - marque - 28 - pad;
      const rangs = Math.ceil(n / colonnes);
      const lignes = s.elements.map((e) => coupe(e.texte, taille, 600, largeurTexte));
      if (Math.max(...lignes.map((l) => l.length)) > 2 && taille > 44) continue;
      const besoin = Math.max(...lignes.map((l) => hauteurLignes(l.length, taille, 1.2))) + 40;
      const hLigne = Math.max(minH, besoin);
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
    choix = { colonnes, taille: 44, hLigne: Math.max(...lignes.map((l) => hauteurLignes(l.length, 44, 1.2))) + 24, lignes };
  }
  const { colonnes, taille, lignes } = choix;
  const rangs = Math.ceil(n / colonnes);
  const hRang = Math.max(choix.hLigne, Math.min(220, (dispo - (rangs - 1) * gap) / rangs));
  const largeurCarte = (largeurListe - (colonnes - 1) * gap) / colonnes;
  const app = apparitions(s.elements.map((e) => e.apparitionMs), s.debutMs, 450, 180);
  let actif = -1;
  app.forEach((a, i) => {
    if (t >= a) actif = i;
  });
  const avance = s.elements.map((_e, i) => douce(prog(t, app[i], 400)));
  // Le bloc (titre compris) est centré sur ce qui est DÉJÀ affiché et glisse doucement quand une rangée arrive.
  const poidsRang = Array.from({ length: rangs }, () => 1); // grille fixe dès le début : rien ne remonte
  const hVu = Math.max(0, poidsRang.reduce((a, w) => a + w * (hRang + gap), 0) - gap * (poidsRang.some((w) => w > 0) ? 1 : 0));
  const dernier = poidsRang.reduce((m, w, r) => (w > 0 ? r : m), -1);
  const etendue = dernier < 0 ? 0 : poidsRang.slice(0, dernier).reduce((a, w) => a + w * (hRang + gap), 0) + hRang;
  // Centré sur le visible, sans que la rangée qui arrive (déjà posée à sa pleine hauteur) dépasse le bas de la zone.
  const yTop = Math.max(HAUT_SCENE, Math.min(HAUT_SCENE + (zoneH - hTitre - hVu) / 2, BAS_SCENE - hTitre - etendue));
  const y0 = yTop + hTitre;
  if (aTitre) {
    const e = douce(prog(tl, 120, 450));
    out.push(texteEl({ id: `${s.id}:titre`, x: S.x, y: yTop, largeur: largeurListe, texte: s.titre ?? "", taille: aTitre.taille, graisse: 800, couleur: p.texte, interligne: 1.1, lignes: aTitre.lignes, opacite: e, dy: MONTEE_PX * (1 - e) }));
  }
  s.elements.forEach((el, i) => {
    const col = colonnes === 2 ? i % 2 : 0;
    const rang = colonnes === 2 ? Math.floor(i / 2) : i;
    const cx = S.x + col * (largeurCarte + gap);
    const fl = FLOTTE_CARTE_PX * souffle(tl, 3000 + i * 260, i * 1.7);
    const cy = y0 + poidsRang.slice(0, rang).reduce((a, w) => a + w * (hRang + gap), 0) + fl;
    const e = avance[i];
    const courant = i === actif;
    const rect = { x: cx, y: cy, largeur: largeurCarte, hauteur: hRang };
    if (t <= app[i]) {
      // Élément à venir : contour terracotta en pointillé et repère visible, sans texte (filigrane léger).
      const eF = douce(prog(tl, 80 + i * 90, 400));
      out.push(carteEl(`${s.id}:fili${i}`, rect, undefined, p.accent, eF * (0.3 + 0.25 * onde(tl, 2000, i * 2.1)), 28, 3));
      return;
    }
    if (courant) out.push(halo(`${s.id}:carte${i}`, rect, tl, e, 28, p));
    out.push(carteEl(`${s.id}:carte${i}`, rect, p.carte, courant ? p.accent : p.bordure, e, 28, courant ? 4 : 2));
    const hT = hauteurLignes(lignes[i].length, taille, 1.2);
    const xT = cx + pad + marque + 28;
    if (s.titre) {
      const d = 28 * (0.35 + 0.65 * rebond(prog(t, app[i], 450))) + (e >= 1 ? 6 * souffle(tl, 2200, i) : 0);
      out.push(disqueEl(`${s.id}:puce${i}`, cx + pad + marque / 2, cy + hRang / 2, Math.max(8, d), p.accent, undefined, e, 0, `${s.id}:carte${i}`));
    } else {
      out.push(texteEl({ id: `${s.id}:num${i}`, x: cx + pad, y: cy + (hRang - 88) / 2 + 5 * souffle(tl, 1800, i * 1.3), largeur: marque + 12, texte: String(i + 1), taille: 88, graisse: 800, couleur: p.accent, interligne: 1.0, opacite: e, dans: `${s.id}:carte${i}` }));
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
        dans: `${s.id}:carte${i}`,
      }),
    );
  });
  if (aCompte && s.compte !== null) {
    const zone = { x: colX(9), largeur: colsL(3) };
    const cxp = zone.x + zone.largeur / 2;
    const cyp = HAUT_SCENE + zoneH / 2 + 12 * souffle(tl, 3000);
    const eP = rebond(prog(tl, 250, 600));
    const dP = 290 * Math.max(0.05, eP) + 10 * souffle(tl, 3200);
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
  } else if (avecIcone) {
    out.push(iconeDroite(s, tl, p));
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
  const avecIcone = n <= 2;
  const d = n >= 4 ? 96 : 120;
  const dispo = BAS_SCENE - HAUT_SCENE;
  const largeurZone = avecIcone ? colsL(8) : S.largeur;
  const xCarte = S.x + d + 32;
  const lCarte = largeurZone - d - 32;
  const lTexte = lCarte - 96;
  const app = apparitions(s.elements.map((e) => e.apparitionMs), s.debutMs, 450, 220);
  let actif = -1;
  app.forEach((a, i) => {
    if (t >= a) actif = i;
  });
  // Grille FIXE dès le début de la scène : les positions finales de toutes les étapes sont connues, rien ne remonte.
  // Texte 52 px au moins (56 et plus si possible, 60 et plus avec 1 ou 2 étapes), 1 à 2 lignes.
  const minH = n <= 2 ? 200 : n === 3 ? 170 : n === 4 ? 130 : 96;
  const maxH = n <= 3 ? 280 : 200;
  const gap0 = n >= 5 ? 14 : 28;
  const tailles = n <= 2 ? [64, 60, 56, 52] : n <= 4 ? [60, 58, 56, 52] : [56, 54, 52];
  let taille = tailles[tailles.length - 1];
  let gap = gap0;
  let lignesDe: string[][][] = [];
  let hautes: number[] = [];
  for (const cand of tailles) {
    taille = cand;
    lignesDe = s.elements.map((e) => coupe(e.texte, cand, 600, lTexte));
    hautes = lignesDe.map((l) => Math.min(maxH, Math.max(minH, hauteurLignes(l.length, cand, 1.2) + 24)));
    gap = gap0;
    if (Math.max(...lignesDe.map((l) => l.length)) <= 2 && hautes.reduce((a, b) => a + b, 0) + (n - 1) * gap <= dispo) break;
  }
  const somme = hautes.reduce((a, b) => a + b, 0);
  if (somme + (n - 1) * gap > dispo) gap = Math.max(10, (dispo - somme) / Math.max(1, n - 1));
  // Les cartes sont réparties sur toute la hauteur utile quand il reste de la place (jamais plus de 60 px d'écart).
  else if (n > 1) gap = Math.min(60, Math.max(gap, (dispo - somme) / (n - 1)));
  const total = hautes.reduce((a, b) => a + b, 0) + (n - 1) * gap;
  const y0 = Math.max(HAUT_SCENE, HAUT_SCENE + (dispo - total) / 2);
  const tops: number[] = [];
  hautes.reduce((acc, h, i) => ((tops[i] = acc), acc + h + gap), y0);
  const fond: CouleurLongue = p.fond === "noir" ? "noir" : "ivoire";
  s.elements.forEach((el, i) => {
    const fl = FLOTTE_CARTE_PX * souffle(tl, 3000 + i * 260, i * 1.7);
    const ry = tops[i] + fl;
    const hRang = hautes[i];
    const lu = t > app[i];
    const e = lu ? douce(prog(t, app[i], 380)) : 0;
    const eFond = douce(prog(tl, 80 + i * 90, 400));
    const courant = i === actif;
    const idCarte = `${s.id}:carte${i}`;
    const rect = { x: xCarte, y: ry, largeur: lCarte, hauteur: hRang };
    const cx = S.x + d * 0.55;
    const cy = ry + hRang / 2;
    if (!lu) {
      // Étape à venir : contour terracotta en pointillé et numéro visible, sans texte (filigrane léger).
      const respire = 0.3 + 0.25 * onde(tl, 2000, i * 2.1);
      out.push(carteEl(`${s.id}:fili${i}`, rect, undefined, p.accent, respire * eFond, 32, 3));
      out.push(disqueEl(`${s.id}:disque${i}`, cx, cy, d, fond, p.accent, respire * eFond, 4));
      out.push(texteEl({ id: `${s.id}:num${i}`, x: cx - d / 2, y: cy - (n >= 4 ? 34 : 44), largeur: d, texte: String(s.numeroDepart + i), taille: n >= 4 ? 68 : 88, graisse: 800, couleur: p.accent, interligne: 1.0, alignement: "centre", opacite: respire * eFond, dans: `${s.id}:disque${i}` }));
    } else {
      if (courant) out.push(halo(idCarte, rect, tl, e, 32, p));
      out.push(carteEl(idCarte, rect, p.carte, courant ? p.accent : p.bordure, e, 32, courant ? 4 : 2));
      const lignes = lignesDe[i];
      const hT = hauteurLignes(lignes.length, taille, 1.2);
      out.push(texteEl({ id: `${s.id}:texte${i}`, x: xCarte + 48, y: ry + (hRang - hT) / 2, largeur: lTexte, texte: el.texte, taille, graisse: 600, couleur: p.texte, accent: el.accent, couleurAccent: p.accent, interligne: 1.2, lignes, opacite: e, dy: 20 * (1 - e), dans: idCarte }));
      // Disque : l'étape lue s'allume (plein, il pulse), les étapes déjà lues restent au trait.
      const pop = courant ? Math.min(1, 0.82 + 0.18 * rebond(prog(t, app[i] + 120, 450))) * (0.9 + 0.1 * onde(tl, 1500)) : 1;
      const idD = `${s.id}:disque${i}`;
      const dd = d * pop * (1 + 0.04 * souffle(tl, 2000, i * 1.3));
      out.push(disqueEl(idD, cx, cy, dd, courant ? p.accent : fond, p.accent, 1, courant ? 0 : 5));
      out.push(texteEl({ id: `${s.id}:num${i}`, x: cx - dd / 2, y: cy - (n >= 4 ? 34 : 44), largeur: dd, texte: String(s.numeroDepart + i), taille: n >= 4 ? 68 : 88, graisse: 800, couleur: courant ? p.surAccent : p.accent, interligne: 1.0, alignement: "centre", opacite: 1, dans: idD }));
    }
    if (i > 0) {
      const haut = tops[i - 1] + FLOTTE_CARTE_PX * souffle(tl, 3000 + (i - 1) * 260, (i - 1) * 1.7) + hautes[i - 1] / 2 + d / 2 + 6;
      const bas = cy - d / 2 - 6;
      const q = lu ? douce(prog(t, app[i], 520)) : 0;
      if (q > 0 && bas > haut) out.push({ ...traitEl(`${s.id}:lien${i}`, { x: cx - 3, y: haut, largeur: 6, hauteur: (bas - haut) * q }, p.accent, 1, 1), trace: arrondi(q) });
    }
  });
  if (avecIcone) out.push(iconeDroite(s, tl, p));
  return out;
}

/* ------------------------------------------------------------------ */
/* Chiffre                                                             */
/* ------------------------------------------------------------------ */

/** Le chiffre affiché à mi-compteur : mêmes séparateurs, mêmes décimales que le texte final. */
export function chiffreCompte(affiche: string, valeur: number, avancement: number): string {
  if (avancement >= 1) return affiche;
  const m = /\d[\d\s  ]*(?:[.,]\d+)?/.exec(affiche);
  if (!m) return affiche;
  const brut = m[0];
  const sep = /[\s  ]/.exec(brut)?.[0] ?? "";
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
  const zoneH = BAS_SCENE - HAUT_SCENE;
  if (n === 1) {
    const c = s.chiffres[0];
    const cx = S.x + largeurGauche / 2;
    const blocs = Number.isInteger(c.valeur) && c.valeur >= 2 && c.valeur <= 24 ? c.valeur : 0;
    const parRangee = blocs > 12 ? Math.ceil(blocs / 2) : blocs;
    const rangees = blocs ? Math.ceil(blocs / parRangee) : 0;
    const tBloc = blocs ? Math.min(64, Math.floor((largeurGauche - (parRangee - 1) * 10) / parRangee)) : 0;
    const hBlocs = blocs ? rangees * tBloc + (rangees - 1) * 10 : 0;
    const dRing = blocs ? 460 : 560;
    const total = dRing + (blocs ? 56 + hBlocs : 0);
    const haut = HAUT_SCENE + (zoneH - total) / 2 + 12 * souffle(tl, 3000);
    const cy = haut + dRing / 2;
    const idR = `${s.id}:anneau`;
    const respire = 20 * souffle(tl, 2400);
    const trace = douce(prog(tl, 250, 900));
    out.push(formeEl(idR, "cercle", { x: cx - (dRing + respire) / 2, y: cy - (dRing + respire) / 2, largeur: dRing + respire, hauteur: dRing + respire }, p.accent, trace, 16, 0.95));
    // Un point d'accent parcourt l'anneau en orbite (un tour en 2,4 s).
    const angleO = (2 * Math.PI * tl) / 2400 - Math.PI / 2;
    const rO = (dRing + respire) / 2;
    out.push(disqueEl(`${s.id}:orbite`, cx + rO * Math.cos(angleO), cy + rO * Math.sin(angleO), 40, p.accent, undefined, borne(prog(tl, 700, 300)), 0, idR));
    // Le compteur part au début de la scène et atteint la valeur en 900 ms.
    const debut = s.debutMs + 300;
    const av = douce(prog(t, debut, 900));
    const largeurN = dRing - 140;
    const tN = Math.min(TAILLES_LONGUE.chiffre, Math.floor((largeurN * UTILE * TAILLES_LONGUE.chiffre) / Math.max(largeurN * 0.2, largeurLigne([c.affiche], TAILLES_LONGUE.chiffre, 800))));
    const tailleN = Math.max(120, tN);
    const aU = ajuster(c.unite, TAILLES_LONGUE.unite, 44, 700, largeurN, 64 * 1.2 * 1.01, 1.2);
    const hU = c.unite ? hauteurLignes(aU.lignes.length, aU.taille, 1.2) : 0;
    const hContenu = tailleN + (c.unite ? 14 + hU : 0);
    const yN = cy - hContenu / 2;
    const e = prog(tl, 150, 300);
    const texteN = chiffreCompte(c.affiche, c.valeur, av);
    out.push(texteEl({ id: `${s.id}:nombre`, x: cx - largeurN / 2, y: yN, largeur: largeurN, texte: texteN, taille: tailleN, graisse: 800, couleur: p.accent, interligne: 1.0, alignement: "centre", opacite: e, lignes: [[texteN]], dans: idR }));
    if (c.unite) {
      const eU = douce(prog(t, debut + 500, 400));
      out.push(texteEl({ id: `${s.id}:unite`, x: cx - largeurN / 2, y: yN + tailleN + 14, largeur: largeurN, texte: c.unite, taille: aU.taille, graisse: 700, couleur: p.texte, interligne: 1.2, alignement: "centre", lignes: aU.lignes, opacite: eU, dy: 16 * (1 - eU), dans: idR }));
    }
    // Illustration exacte du nombre : `valeur` petits blocs qui se remplissent un à un.
    if (blocs) {
      const yB = haut + dRing + 56;
      const vide: CouleurLongue = p.fond === "noir" ? "grisSurNoir" : "gris";
      for (let k = 0; k < blocs; k++) {
        const r = Math.floor(k / parRangee);
        const dansRangee = Math.min(parRangee, blocs - r * parRangee);
        const x = cx - (dansRangee * tBloc + (dansRangee - 1) * 10) / 2 + (k - r * parRangee) * (tBloc + 10);
        const y = yB + r * (tBloc + 10);
        const idB = `${s.id}:bloc${k}`;
        out.push(carteEl(idB, { x, y, largeur: tBloc, hauteur: tBloc }, vide, undefined, p.fond === "noir" ? 0.4 : 0.9, 12));
        const q = douce(prog(t, debut + (k * 900) / blocs, 260));
        if (q > 0) {
          const dd = tBloc * (0.5 + 0.5 * q);
          // Une fois remplis, les blocs scintillent en vague (taille et opacité).
          const vague = q >= 1 ? onde(tl, 1400, -k * 0.55) : 0;
          const ddv = q >= 1 ? tBloc * (0.62 + 0.38 * vague) : dd;
          out.push(carteEl(`${s.id}:bloc${k}-plein`, { x: x + (tBloc - ddv) / 2, y: y + (tBloc - ddv) / 2, largeur: ddv, hauteur: ddv }, p.accent, undefined, q >= 1 ? 0.55 + 0.45 * vague : q, 12, 0, idB));
        }
      }
    }
  } else {
    const hBloc = 300;
    const y1 = HAUT_SCENE + (zoneH - (n * hBloc + (n - 1) * 40)) / 2;
    s.chiffres.forEach((c, i) => {
      const by = y1 + i * (hBloc + 40);
      const debut = s.debutMs + 300 + i * 250;
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
  const yCarte = HAUT_SCENE + (zoneH - hCarte) / 2 + FLOTTE_CARTE_PX * souffle(tl, 3000, 1);
  const accent = s.chiffres.map((c) => [c.affiche, c.ecrit]).flat().find((m) => m && nettoie(s.contexte).includes(m)) ?? null;
  const eC = douce(prog(tl, 300, 450));
  const idC = `${s.id}:carte`;
  out.push(halo(idC, { x: xC, y: yCarte, largeur: lC, hauteur: hCarte }, tl, eC, 32, p));
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
  const lCarte = 700;
  const lT = lCarte - 96;
  const b = ajuster(s.apres, 84, 60, 800, lT, 560, 1.15);
  // « Après » reste au moins 1,3 fois plus grand que « avant » (hiérarchie).
  const a = ajuster(s.avant, Math.max(44, Math.min(60, Math.floor(b.taille / 1.32))), 44, 600, lT, 560, 1.2);
  const hA = hauteurLignes(a.lignes.length, a.taille, 1.2);
  const hB = hauteurLignes(b.lignes.length, b.taille, 1.15);
  // Les cartes remplissent la hauteur de la scène.
  const hC = BAS_SCENE - HAUT_SCENE - 16;
  const yC = HAUT_SCENE + 8;
  const yCA = yC + 8 * souffle(tl, 3000);
  const yCB = yC + 8 * souffle(tl, 2300, 1);
  // Chaque carte décrit un petit cercle (±8 px en hauteur, ±6 px en largeur) : le mouvement ne s'arrête jamais.
  const xA = S.x + 6 + 6 * souffle(tl, 3000, Math.PI / 2);
  const xB = S.x + S.largeur - lCarte - 6 + 6 * souffle(tl, 2300, 1 + Math.PI / 2);
  const idA = `${s.id}:avant`;
  const idB = `${s.id}:apres`;
  const eA = douce(prog(tl, 120, 450));
  const appB = Math.max(s.apparitionApresMs, s.debutMs + 1300);
  const eB = douce(prog(t, appB, 450));
  // Carte « avant » claire (texte noir lisible), barré en terracotta.
  out.push(carteEl(idA, { x: xA, y: yCA, largeur: lCarte, hauteur: hC }, p.fond === "noir" ? p.carte : "gris", p.fond === "noir" ? p.bordure : undefined, eA, 36, 3));
  const hautTexte = yC + 140;
  const dispo = yC + hC - 56 - hautTexte;
  const dyA = yCA - yC;
  const dyB = yCB - yC;
  const yA = hautTexte + (dispo - hA) / 2 + dyA;
  const yB = hautTexte + (dispo - hB) / 2 + dyB;
  out.push(etiquetteEl(`${s.id}:etiqA`, xA + 48, yCA + 44, 360, "AVANT", p.texte, eA, "gauche", idA));
  out.push(texteEl({ id: `${s.id}:texteA`, x: xA + 48, y: yA, largeur: lT, texte: s.avant, taille: a.taille, graisse: 600, couleur: p.texte, interligne: 1.2, lignes: a.lignes, opacite: eA, dy: 20 * (1 - eA), dans: idA }));
  // Le trait qui barre : une ligne par ligne de texte, tracées l'une après l'autre.
  a.lignes.forEach((mots, i) => {
    const q = douce(prog(tl, 600 + i * 220, 380));
    if (q <= 0) return;
    const w = largeurLigne(mots, a.taille, 600);
    out.push(traitEl(`${s.id}:barre${i}`, { x: xA + 48, y: yA + 20 * (1 - eA) + i * a.taille * 1.2 + a.taille * 0.6 - 4, largeur: Math.min(lT, w), hauteur: 8 }, p.accent, q, 1, `${s.id}:texteA`));
  });
  if (eB > 0) {
    out.push(carteEl(idB, { x: xB, y: yCB, largeur: lCarte, hauteur: hC }, p.carte, p.accent, eB, 36, 5));
    out.push(etiquetteEl(`${s.id}:etiqB`, xB + 48, yCB + 44, 360, "MAINTENANT", p.accent, eB, "gauche", idB));
    out.push(texteEl({ id: `${s.id}:texteB`, x: xB + 48, y: yB, largeur: lT, texte: s.apres, taille: b.taille, graisse: 800, couleur: p.texte, interligne: 1.15, lignes: b.lignes, opacite: eB, dy: 24 * (1 - eB), dans: idB }));
    // Coche en haut à droite de la carte « après ».
    const qc = douce(prog(t, appB + 120, 500));
    if (qc > 0) out.push(formeEl(`${s.id}:coche`, "coche", { x: xB + lCarte - 48 - 100, y: yCB + 28, largeur: 100, hauteur: 100 }, p.accent, qc, 9, 1, idB));
  }
  // Grande flèche tracée dans l'espace entre les deux cartes.
  const gapX = xB - (xA + lCarte);
  const wF = 220;
  const dxF = 22 * souffle(tl, 1800);
  const qf = douce(prog(t, appB - 500, 700));
  if (qf > 0) out.push(formeEl(`${s.id}:fleche`, "fleche", { x: xA + lCarte + (gapX - wF) / 2 + dxF, y: yC + hC / 2 - wF / 2 + 8 * souffle(tl, 3000), largeur: wF, hauteur: wF }, p.accent, qf, 14));
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
  const a = ajuster(s.phrase, 84, 64, 800, largeur, 560, interligne);
  const hT = hauteurLignes(a.lignes.length, a.taille, interligne);
  const zoneH = BAS_SCENE - HAUT_SCENE;
  // Filet + phrase, centrés ensemble dans la zone.
  const yT = HAUT_SCENE + (zoneH - hT - 64) / 2 + 64;
  const e = douce(prog(tl, 200, 600));
  out.push(traitEl(`${s.id}:filet`, { x: S.x, y: yT - 64, largeur: 160, hauteur: 10 }, p.accent, douce(prog(tl, 100, 600))));
  const idT = `${s.id}:phrase`;
  // Le soulignement du mot clé est dessiné par le rendu sur le mot lui-même (`trace` = part tracée) : largeur exacte du mot.
  const souligne = s.motCle ? douce(prog(tl, 800, 600)) : undefined;
  out.push({ ...texteEl({ id: idT, x: S.x, y: yT, largeur, texte: s.phrase, taille: a.taille, graisse: 800, couleur: p.texte, accent: s.motCle, couleurAccent: p.accent, interligne, lignes: a.lignes, opacite: e, dy: MONTEE_PX * (1 - e) }), ...(souligne !== undefined ? { trace: arrondi(souligne) } : {}) });
  const cote = 480;
  const zone = { x: colX(8), largeur: colsL(4) };
  out.push(
    formeEl(
      `${s.id}:forme`,
      s.forme,
      { x: zone.x + (zone.largeur - cote) / 2 + 8 * souffle(tl, 3000, Math.PI / 2), y: HAUT_SCENE + (zoneH - cote) / 2 + 14 * souffle(tl, 3000), largeur: cote, hauteur: cote },
      p.accent,
      douce(prog(tl, 300, 900)),
      14,
      1,
    ),
  );
  return out;
}

/* ------------------------------------------------------------------ */
/* Fin                                                                 */
/* ------------------------------------------------------------------ */

/** Géométrie de la fin (une seule colonne centrée : logo, question, bouton, adresse), centrée dans la zone pleine. */
function geoFin(s: SceneFin) {
  const Z = ZONES_LONGUE.plein;
  const largeur = 1500;
  const hLogo = 340;
  const qA = s.question ? ajuster(s.question, 56, 44, 700, largeur, 220, 1.2) : null;
  const hQ = qA ? hauteurLignes(qA.lignes.length, qA.taille, 1.2) : 0;
  const hBouton = 130;
  const hAdresse = TAILLES_LONGUE.finAdresse * 1.15;
  const total = hLogo + 44 + (qA ? hQ + 56 : 0) + hBouton + 90 + hAdresse;
  const y0 = Z.y + (Z.hauteur - total) / 2;
  return { largeur, hLogo, qA, hQ, hBouton, hAdresse, y0, yQ: y0 + hLogo + 44, yBouton: y0 + hLogo + 44 + (qA ? hQ + 56 : 0) };
}

/** Position du logo de la fin (dessiné par la composition, hors de tout élément posé) : grand, centré en haut de la colonne. */
export function logoFin(s: SceneFin): { x: number; y: number; hauteur: number; largeur: number } {
  const g = geoFin(s);
  const largeur = g.hLogo * (2048 / 1423);
  return { x: (1920 - largeur) / 2, y: g.y0, hauteur: g.hLogo, largeur };
}

function fin(s: SceneFin, t: number): ElementPose[] {
  const tl = t - s.debutMs;
  const p = palette(s.fond);
  const out: ElementPose[] = [];
  const g = geoFin(s);
  const cx = 960;
  const x = (1920 - g.largeur) / 2;
  if (g.qA && s.question) {
    const e = douce(prog(tl, 0, 350));
    out.push(texteEl({ id: `${s.id}:question`, x, y: g.yQ, largeur: g.largeur, texte: s.question, taille: g.qA.taille, graisse: 700, couleur: p.texte, interligne: 1.2, alignement: "centre", lignes: g.qA.lignes, opacite: e, dy: MONTEE_PX * (1 - e) }));
  }
  const tA0 = TAILLES_LONGUE.finAppel;
  const wTexte0 = largeurLigne(nettoie(s.appel).split(" "), tA0, 800);
  const wBouton = Math.min(1000, wTexte0 + 160);
  const tA = Math.max(48, Math.min(tA0, Math.floor((tA0 * (wBouton - 100)) / Math.max(1, wTexte0))));
  // Le bouton entre (montée + fondu) en 450 ms, visible dès +600 ms, puis pulse.
  const debutB = 0;
  const eB = douce(prog(tl, debutB, 350));
  const enPulse = tl > debutB + 400;
  const pulse = enPulse ? 1 + 0.04 * (0.5 + 0.5 * souffle(tl, 1600, -Math.PI / 2)) : 1;
  const cy = g.yBouton + g.hBouton / 2 + 60 * (1 - eB);
  const idB = `${s.id}:bouton`;
  out.push({
    id: idB,
    nature: "carte",
    role: "decor",
    rect: { x: arrondi(cx - (wBouton * pulse) / 2), y: arrondi(cy - (g.hBouton * pulse) / 2), largeur: arrondi(wBouton * pulse), hauteur: arrondi(g.hBouton * pulse) },
    opacite: arrondi(borne(prog(tl, debutB, 250))),
    couleur: "terracotta",
    fond: "terracotta",
    rayonPx: 70,
    ...(enPulse ? { dans: `${s.id}:onde` } : {}),
  });
  if (enPulse) {
    const cycle = ((tl - debutB - 400) % 2400) / 2400;
    const gg = 12 + 40 * douce(cycle);
    out.push({
      id: `${s.id}:onde`,
      nature: "carte",
      role: "decor",
      rect: { x: arrondi(cx - wBouton / 2 - gg), y: arrondi(cy - g.hBouton / 2 - gg), largeur: arrondi(wBouton + 2 * gg), hauteur: arrondi(g.hBouton + 2 * gg) },
      opacite: arrondi(0.7 * (1 - cycle)),
      couleur: p.accent,
      bordure: p.accent,
      rayonPx: 70 + gg,
      epaisseurPx: 4,
    });
  }
  out.push(texteEl({ id: `${s.id}:appel`, x: cx - (wBouton * pulse) / 2, y: cy - tA / 2, largeur: wBouton * pulse, texte: s.appel, taille: tA, graisse: 800, couleur: "blanc", interligne: 1.0, alignement: "centre", lignes: [[s.appel]], opacite: prog(tl, debutB + 50, 250), dans: idB }));
  const eAd = douce(prog(tl, debutB + 150, 300));
  out.push(texteEl({ id: `${s.id}:adresse`, x, y: g.yBouton + g.hBouton + 90 + MONTEE_PX * (1 - eAd), largeur: g.largeur, texte: s.adresse, taille: TAILLES_LONGUE.finAdresse, graisse: 700, couleur: p.accent, interligne: 1.15, alignement: "centre", opacite: eAd }));
  return out;
}

/* ------------------------------------------------------------------ */
/* API publique                                                        */
/* ------------------------------------------------------------------ */

/**
 * Mise en page d'une scène à l'instant `tMs` (temps de la vidéo entière). PURE.
 */
export const poserScene = (scene: SceneLongue, tMs: number): ElementPose[] => {
  switch (scene.type) {
    case "carton-titre":
      return cartonTitre(scene, tMs);
    case "carton-chapitre":
      return cartonChapitre(scene, tMs);
    case "liste":
      return [...liste(scene, tMs), ...barreProgres(scene, tMs)];
    case "etapes":
      return [...etapes(scene, tMs), ...barreProgres(scene, tMs)];
    case "chiffre":
      return [...chiffre(scene, tMs), ...barreProgres(scene, tMs)];
    case "avant-apres":
      return [...avantApres(scene, tMs), ...barreProgres(scene, tMs)];
    case "phrase-cle":
      return [...phraseCle(scene, tMs), ...barreProgres(scene, tMs)];
    case "fin":
      return [...fin(scene, tMs), ...barreProgres(scene, tMs)];
  }
};

/** Vrai si la scène a la bande de sous-titres (les cartons et la fin n'en ont pas). */
export const sceneAvecBande = (type: string): boolean => type !== "carton-titre" && type !== "carton-chapitre" && type !== "fin";

const normeTexte = (t: string) => t.toLocaleLowerCase("fr").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/**
 * Vrai si la scène affiche déjà, mot pour mot, la phrase que la ligne de sous-titres lirait (phrase clé entière, contexte
 * d'un chiffre, élément de liste ou d'étape identique) : la bande ne la répète pas.
 */
export function sousTitreRedondant(scene: SceneLongue, ligne: LigneSousTitre): boolean {
  const l = normeTexte(ligne.texte);
  if (!l) return false;
  switch (scene.type) {
    case "phrase-cle":
      return normeTexte(scene.phrase) === l;
    case "chiffre":
      return normeTexte(scene.contexte) === l;
    case "liste":
    case "etapes":
      return scene.elements.some((e) => normeTexte(e.texte) === l);
    default:
      return false;
  }
}

/** Repère de chapitre affiché dans la bande à la place d'un sous-titre redondant : « 01 · Le problème : compter à la main ». */
export const repereChapitre = (rang: number, titre: string): string => `${pad2(rang)} · ${titre}`;

/**
 * Sous-titre posé dans la zone du texte de la bande à l'instant `tMs`, ou null hors de sa durée. PURE.
 * Avec `repere`, la bande affiche ce repère (plus discret : graisse 500, opacité 0,7) au lieu du texte de la ligne.
 */
export const poserSousTitre = (ligne: LigneSousTitre, tMs: number, repere?: string): ElementPose | null => {
  if (tMs < ligne.debutMs || tMs >= ligne.finMs) return null;
  const Z = ZONES_LONGUE.texteSousTitres;
  const texte = repere ?? ligne.texte;
  let taille: number = TAILLES_LONGUE.sousTitrePx;
  let lignes = coupe(texte, taille, repere ? 500 : 600, Z.largeur);
  if (lignes.length > TAILLES_LONGUE.sousTitreLignesMax) {
    taille = TAILLES_LONGUE.texteMinPx;
    lignes = coupe(texte, taille, repere ? 500 : 600, Z.largeur);
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
    opacite: arrondi(borne(opacite * (repere ? 0.7 : 1))),
    couleur: "noir",
    lignes: morceaux(texte, lignes, null),
    taillePx: taille,
    graisse: repere ? 500 : 600,
    interligne,
    alignement: "centre",
  };
};

/** Durée de la transition d'entrée (réexportée pour le rendu). */
export const DUREE_TRANSITION_MS = TEMPS_LONGUE.transitionMs;
