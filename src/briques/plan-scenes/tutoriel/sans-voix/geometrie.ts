/**
 * GÉOMÉTRIE PURE DU TUTORIEL SANS VOIX « COMPOSÉ » (lot qualité 25-11, QUAL-1) : `imageSansVoixA(plan, tMs)` dit, à
 * chaque instant, CE QUI EST À L'ÉCRAN (éléments posés, en pixels de l'image finale). FONCTION PURE ET DÉTERMINISTE :
 * même entrée, mêmes éléments ; aucun hasard, aucune horloge, aucun navigateur, aucun React. Le dessin (QUAL-3) ne fait que
 * dessiner ces éléments ; le contrôle (QUAL-4) les mesure. Imports RELATIFS seulement (lu par Remotion).
 *
 * CONTRAT DU DESSIN (à respecter à la lettre) :
 *  - `rect` = rectangle ACTUEL à l'écran (déjà tronqué par la progression d'une barre ou d'un filet : la barre « pousse »,
 *    son `rect.largeur` grandit ; `progression` n'est qu'une information 0..1) ;
 *  - TEXTE : `rect.largeur` est la largeur ESTIMÉE du bloc (toujours ≥ la largeur réelle, mesure prudente) ; le dessin trace
 *    chaque entrée de `lignes` sur UNE ligne, en `white-space: nowrap` (il ne recoupe jamais), alignée selon `alignement`
 *    ("gauche" : contre `rect.x` ; "centre" : centrée dans `rect`), à `taillePx` et `graisse`, avec l'interligne
 *    `INTERLIGNE` (exporté ci-dessous) : la ligne k occupe [rect.y + k·taillePx·INTERLIGNE, +taillePx·INTERLIGNE] et
 *    `rect.hauteur = lignes.length · taillePx · INTERLIGNE`. Le texte AFFICHÉ est `lignes.join(" ")` (peut être une suite
 *    contiguë plus courte que le texte du plan, finie par « … », quand rien ne tient : jamais de débordement) ;
 *  - `genre: "cible"` = zone cliquable visée : transparente (sans remplissage ni contour), la ligne ou le bouton visible est
 *    une `forme` voisine ; un curseur référence toujours une `cible` présente dans la même image ;
 *  - les enfants d'une carte/panneau portent `parentId` : ils sont TOUJOURS dans le rect de leur parent et leur opacité est
 *    ≤ celle du parent (garanti en fin de calcul) ; une carte « fantôme » (squelette) n'a pas d'enfant texte ;
 *  - TOUT élément, visible ou non (même d'opacité < 0,05), reste dans `zones.contenu` : aucun filet de sécurité qui masque,
 *    la mise en page calcule ce qui tient (nombre de lignes de liste plafonné selon la place, textes réduits puis raccourcis) ;
 *  - aucun nombre ajouté : seuls les textes du plan sont affichés, les valeurs sont des barres squelettes.
 *
 * Plan d'écran (`ecran`) : TOUS les événements `focus` sont gérés (le plus avancé à l'instant t l'emporte) ; pour les autres
 * genres (`cartes-chiffres`, `liste`, `tri`, `clic`, `panneau`, `alerte`) seul le PREMIER événement du genre compte
 * (le plan en produit un seul). Pas de zoom : un `focus` met la cible en valeur (contour terracotta qui pulse) et atténue
 * les autres parties à 0,55 d'opacité, ENSEMBLE avec leurs enfants. Avant le premier événement, l'écran VIT : les emplacements
 * se dessinent en cascade (contours, barres squelettes) pour qu'aucune image ne reste figée plus de ~1,5 s.
 *
 * Règles de mouvement : transitions entre scènes = fondu enchaîné 400 ms + glissé 24 px (la sortie recule à 0,96) ;
 * entrées 500 ms ; dérive 1 → 1,02 pour qu'aucune image ne soit figée ; jamais de rebond.
 */
import { adoucir, avancement, DUREES_MS, echelleFormat, entre, INTERLIGNE, OPACITE_ATTENUEE, PLANCHER_ABSOLU, PLANCHER_TEXTE, zonesSansVoix } from "./grammaire";
import { couperLignes, largeurBloc, largeurMotMotion } from "../../../motion/mesure";
import type { CouleurCharte, ElementVisible, EvenementEcran, ImageSansVoix, PlanComposeSansVoix, RectPx, SceneSansVoix } from "./types";

export { INTERLIGNE };

/* ------------------------------------------------------------------ */
/* Outils                                                               */
/* ------------------------------------------------------------------ */

type Pose = ElementVisible;
type Ajout = Omit<Pose, "z" | "opacite"> & { opacite?: number };

const borne = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

interface Ctx {
  T: number;
  s: number;
  U: RectPx;
  /** Plancher d'opacité des premiers éléments de la toute première scène (jamais d'image vide à 0 ms). */
  pf: number;
}

function nouveau() {
  const els: Pose[] = [];
  let z = 0;
  const add = (p: Ajout): Pose => {
    const e = { opacite: 1, ...p, z: ++z } as Pose;
    els.push(e);
    return e;
  };
  return { els, add };
}

interface Ajuste {
  taille: number;
  /** Lignes déjà coupées (chacune tient dans `largeur`). */
  lignes: string[];
  /** Largeur estimée du bloc (≥ réelle). */
  w: number;
  h: number;
  /** Texte réellement affiché (le texte du plan, ou une suite contiguë plus courte finie par « … »). */
  texte: string;
}

/** Coupe un mot trop long en morceaux finis par un trait d'union, chacun tenant dans `largeur` (dernier recours). */
function couperMot(mot: string, taille: number, g: number, largeur: number): string[] {
  const reste = Array.from(mot);
  const morceaux: string[] = [];
  while (reste.length) {
    let n = reste.length;
    const tient = (k: number) => largeurMotMotion(reste.slice(0, k).join("") + (k < reste.length ? "-" : ""), taille, g) <= largeur;
    while (n > 1 && !tient(n)) n--;
    morceaux.push(reste.splice(0, n).join("") + (reste.length ? "-" : ""));
  }
  return morceaux;
}

/**
 * Texte coupé au mot qui TIENT TOUJOURS (jamais plus de `maxL` lignes, jamais plus large que `largeur`, jamais sous
 * `PLANCHER_ABSOLU`) : 1) réduit de `cible` jusqu'à `absolu` ; 2) puis jusqu'au plancher absolu ; 3) un mot encore trop long
 * est coupé avec un trait d'union ; 4) sinon on garde une SUITE CONTIGUË plus courte des mots (le début), finie par « … ».
 * `g` = graisse de mesure (800 : la plus large ; 600 pour les libellés SemiBold).
 */
function ajuster(s: number, texte: string, cible: number, largeur: number, maxL: number, g = 800, absolu = PLANCHER_TEXTE * s): Ajuste {
  const dur = Math.min(absolu, PLANCHER_ABSOLU * s);
  const mots = texte.split(/\s+/).filter(Boolean);
  const fait = (taille: number, liste: string[], affiche: string): Ajuste => {
    const t = liste.join(" ");
    const lignes = couperLignes(t, taille, g, largeur).map((l) => l.join(" "));
    return { taille, lignes, w: Math.ceil(largeurBloc(t, taille, g, largeur)), h: lignes.length * taille * INTERLIGNE, texte: affiche };
  };
  const tient = (a: Ajuste) => a.lignes.length <= maxL && a.w <= largeur + 0.5;
  const haut = Math.max(Math.round(cible), Math.ceil(absolu));
  for (let t = haut; t >= Math.ceil(absolu); t--) {
    const a = fait(t, mots, texte);
    if (tient(a)) return a;
  }
  for (let t = Math.ceil(absolu) - 1; t > dur; t--) {
    const a = fait(t, mots, texte);
    if (tient(a)) return a;
  }
  const plancher = fait(dur, mots, texte);
  if (tient(plancher)) return plancher;
  const coupes = mots.flatMap((m) => (largeurMotMotion(m, dur, g) > largeur ? couperMot(m, dur, g, largeur) : [m]));
  const recolle = (l: string[]) => l.join(" ").replace(/- /g, "");
  const coupe = fait(dur, coupes, texte);
  if (tient(coupe)) return coupe;
  for (let k = coupes.length; k >= 1; k--) {
    const liste = [...coupes.slice(0, k - 1), coupes[k - 1].replace(/-$/, "") + "…"];
    const a = fait(dur, liste, recolle(liste));
    if (tient(a)) return a;
  }
  const premier = Array.from(coupes[0] ?? "").filter((c) => c !== "-");
  for (let n = premier.length - 1; n >= 1; n--) {
    const liste = [premier.slice(0, n).join("") + "…"];
    const a = fait(dur, liste, liste[0]);
    if (tient(a)) return a;
  }
  return fait(dur, ["…"], "…");
}

interface OptTexte {
  graisse: 500 | 600 | 700 | 800;
  couleur: CouleurCharte;
  alignement?: "gauche" | "centre";
  parentId?: string;
  opacite?: number;
  barre?: number;
}

function poserTexte(add: (p: Ajout) => Pose, id: string, f: Ajuste, x: number, y: number, boite: number, o: OptTexte): Pose {
  const centre = o.alignement === "centre";
  return add({
    id,
    genre: "texte",
    rect: { x: centre ? x + (boite - f.w) / 2 : x, y, largeur: f.w, hauteur: f.h },
    opacite: o.opacite ?? 1,
    texte: f.texte,
    lignes: f.lignes,
    taillePx: f.taille,
    graisse: o.graisse,
    couleur: o.couleur,
    alignement: centre ? "centre" : "gauche",
    parentId: o.parentId,
    barre: o.barre,
  });
}

/** Décale (glissé d'entrée) et estompe un élément. */
function entrer(e: Pose, p: number, dy: number, dx = 0): Pose {
  e.opacite *= p;
  e.rect = { ...e.rect, x: e.rect.x + (1 - p) * dx, y: e.rect.y + (1 - p) * dy };
  return e;
}

/** Premier événement d'un genre (le plan n'en produit qu'un ; seuls les `focus` sont traités tous). */
function trouver<G extends EvenementEcran["genre"]>(ev: EvenementEcran[], g: G): Extract<EvenementEcran, { genre: G }> | undefined {
  return ev.find((e) => e.genre === g) as Extract<EvenementEcran, { genre: G }> | undefined;
}

const rectEnveloppe = (r: RectPx, d: number): RectPx => ({ x: r.x - d, y: r.y - d, largeur: r.largeur + 2 * d, hauteur: r.hauteur + 2 * d });

/** Point d'un arc doux (Bézier quadratique) de `a` vers `b`. */
function arc(a: { x: number; y: number }, b: { x: number; y: number }, u: number): { x: number; y: number } {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const cx = mx - dy * 0.22;
  const cy = my + dx * 0.22;
  const v = 1 - u;
  return { x: v * v * a.x + 2 * v * u * cx + u * u * b.x, y: v * v * a.y + 2 * v * u * cy + u * u * b.y };
}

/** Ajoute un curseur (et son anneau de clic). */
function poserCurseur(add: (p: Ajout) => Pose, s: number, T: number, dep: number, clicAMs: number, depart: { x: number; y: number }, arrivee: { x: number; y: number }, cibleId: string, tenueMs: number): void {
  const u = avancement(T, dep, Math.max(200, clicAMs - dep), adoucir);
  const entree = avancement(T, dep, 250);
  const sortie = 1 - avancement(T, clicAMs + tenueMs, 300, adoucir);
  const o = entree * sortie;
  if (o <= 0.001) return;
  const pt = arc(depart, arrivee, u);
  const q = (T - clicAMs) / DUREES_MS.clic;
  add({
    id: "curseur",
    genre: "curseur",
    rect: { x: pt.x, y: pt.y, largeur: 34 * s, hauteur: 44 * s },
    opacite: o,
    pointe: pt,
    anneauClic: q > 0 && q <= 1 ? q : 0,
    cibleId,
  });
}

/* ------------------------------------------------------------------ */
/* Scène « titre »                                                      */
/* ------------------------------------------------------------------ */

function sceneTitre(c: Ctx, sc: Extract<SceneSansVoix, { genre: "titre" }>): Pose[] {
  const { T, s, U, pf } = c;
  const { els, add } = nouveau();
  const a0 = sc.debutMs;
  const L = U.largeur * 0.96;
  const x0 = U.x + (U.largeur - L) / 2;
  const sur = sc.surTitre ? ajuster(s, sc.surTitre, 46 * s, L, 2, 600, 40 * s) : null;
  const ti = ajuster(s, sc.texte, 84 * s, L, 3, 800, 64 * s);
  const g1 = 18 * s;
  const g2 = 34 * s;
  const g3 = 52 * s;
  const filetH = 8 * s;
  const autres = (sur ? sur.h + g1 : 0) + ti.h + g2 + filetH;
  // 70 px de réserve : glissé d'entrée, transition et dérive ne sortent jamais du contenu.
  let illH = Math.min(U.hauteur - autres - g3 - 70 * s, 0.4 * U.hauteur, 340 * s);
  if (illH < 150 * s) illH = 0;
  const total = autres + (illH ? g3 + illH : 0);
  let y = U.y + (U.hauteur - total) / 2;

  if (sur) {
    entrer(poserTexte(add, "sur-titre", sur, x0, y, L, { graisse: 600, couleur: "terracotta", alignement: "centre" }), Math.max(pf, avancement(T, a0, 500)), 16 * s);
    y += sur.h + g1;
  }
  entrer(poserTexte(add, "titre", ti, x0, y, L, { graisse: 800, couleur: "noir", alignement: "centre" }), Math.max(pf, avancement(T, a0 + 60, 500)), 16 * s);
  y += ti.h + g2;
  const fl = Math.min(260 * s, L * 0.5);
  const q = avancement(T, a0 + 350, 650, adoucir);
  add({ id: "filet", genre: "forme", rect: { x: x0 + (L - fl) / 2, y, largeur: fl * q, hauteur: filetH }, opacite: q > 0 ? 1 : 0, remplissage: "terracotta", rayonPx: filetH / 2, progression: q });
  y += filetH + g3;

  if (illH) {
    const cw = Math.min(U.largeur * 0.74, 640 * s);
    const cx = x0 + (L - cw) / 2;
    const pe = Math.max(pf, avancement(T, a0 + 200, 550));
    entrer(add({ id: "pile", genre: "forme", rect: { x: cx, y, largeur: cw, hauteur: illH }, remplissage: "blanc", contour: "gris", rayonPx: 28 * s, ombre: true }), pe, 20 * s);
    const pad = 28 * s;
    const n = 4;
    const gap = 16 * s;
    const rh = Math.min(48 * s, (illH - 2 * pad - (n - 1) * gap) / n);
    const largs = [0.78, 0.62, 0.7, 0.5];
    const hor = 56 * s;
    entrer(add({ id: "pile/horloge", genre: "forme", rect: { x: cx + cw - pad - hor, y: y + pad * 0.5, largeur: hor, hauteur: hor }, icone: "horloge", couleur: "terracotta", parentId: "pile" }), pe, 20 * s);
    for (let k = 0; k < n; k++) {
      const ry = y + pad + k * (rh + gap);
      const ak = a0 + 300 + k * 140;
      const p = Math.max(pf, avancement(T, ak, 400));
      const bw = (cw - 2 * pad - rh - 18 * s - (k === 0 ? hor + 10 * s : 0)) * largs[k];
      entrer(add({ id: `pile/case-${k + 1}`, genre: "forme", rect: { x: cx + pad, y: ry, largeur: rh, hauteur: rh }, contour: "grisTexte", rayonPx: 10 * s, parentId: "pile" }), p, 14 * s);
      entrer(add({ id: `pile/barre-${k + 1}`, genre: "forme", rect: { x: cx + pad + rh + 18 * s, y: ry + rh * 0.2, largeur: bw, hauteur: rh * 0.6 }, remplissage: "grisTexte", rayonPx: rh * 0.3, parentId: "pile" }), p * 0.3, 14 * s);
      const qs = avancement(T, a0 + 900 + k * 380, 450, adoucir);
      add({ id: `pile/trait-${k + 1}`, genre: "forme", rect: { x: cx + pad - 6 * s, y: ry + rh / 2 - 2.5 * s, largeur: (bw + rh + 30 * s) * qs, hauteur: 5 * s }, opacite: qs > 0 ? 1 : 0, remplissage: k === n - 1 ? "terracotta" : "grisTexte", rayonPx: 2.5 * s, progression: qs, parentId: "pile" });
    }
  }
  return els;
}

/* ------------------------------------------------------------------ */
/* Scène « repère » (avant barré → après)                              */
/* ------------------------------------------------------------------ */

function sceneRepere(c: Ctx, sc: Extract<SceneSansVoix, { genre: "repere" }>): Pose[] {
  const { T, s, U, pf } = c;
  const { els, add } = nouveau();
  const a0 = sc.debutMs;
  const L = U.largeur * 0.96;
  const x0 = U.x + (U.largeur - L) / 2;
  const av = ajuster(s, sc.avant, 72 * s, L, 2, 800, 64 * s);
  const ap = ajuster(s, sc.apres, 88 * s, L, 2, 800, 64 * s);
  const icoH = 110 * s;
  const g = [36 * s, 64 * s, 30 * s];
  const filetH = 8 * s;
  let total = icoH + g[0] + av.h + g[1] + ap.h + g[2] + filetH;
  const avecIcone = total + 70 * s <= U.hauteur;
  if (!avecIcone) total -= icoH + g[0];
  let y = U.y + (U.hauteur - total) / 2;
  if (avecIcone) {
    entrer(add({ id: "horloge", genre: "forme", rect: { x: U.x + (U.largeur - icoH) / 2, y, largeur: icoH, hauteur: icoH }, icone: "horloge", couleur: "grisTexte" }), Math.max(pf, avancement(T, a0, 500)), 16 * s);
    y += icoH + g[0];
  }
  // Robuste à l'ordre des mots (« en une minute au lieu d'une heure » : apresAMs < barreAMs) : « avant » est là dès le début,
  // le trait se trace au plus tôt des deux instants, « après » monte au plus tard 500 ms après le début du trait.
  const tBarre = Math.min(sc.barreAMs, sc.apresAMs);
  const tApres = Math.max(sc.apresAMs, tBarre + 500);
  entrer(poserTexte(add, "avant", av, x0, y, L, { graisse: 800, couleur: "grisTexte", alignement: "centre", barre: avancement(T, tBarre, 500, adoucir) }), Math.max(pf, avancement(T, a0 + 40, 500)), 16 * s);
  y += av.h + g[1];
  entrer(poserTexte(add, "apres", ap, x0, y, L, { graisse: 800, couleur: "noir", alignement: "centre" }), avancement(T, tApres, 550), 28 * s);
  y += ap.h + g[2];
  const fl = Math.min(260 * s, L * 0.5);
  const q = avancement(T, tApres + 350, 550, adoucir);
  add({ id: "filet", genre: "forme", rect: { x: x0 + (L - fl) / 2, y, largeur: fl * q, hauteur: filetH }, opacite: q > 0 ? 1 : 0, remplissage: "terracotta", rayonPx: filetH / 2, progression: q });
  return els;
}

/* ------------------------------------------------------------------ */
/* Scène « appel » (question + bouton cliqué)                           */
/* ------------------------------------------------------------------ */

function sceneAppel(c: Ctx, sc: Extract<SceneSansVoix, { genre: "appel" }>): Pose[] {
  const { T, s, U, pf } = c;
  const { els, add } = nouveau();
  const a0 = sc.debutMs;
  const L = U.largeur * 0.96;
  const x0 = U.x + (U.largeur - L) / 2;
  const qu = sc.question ? ajuster(s, sc.question, 68 * s, L, 3, 800, 56 * s) : null;
  const bt = ajuster(s, sc.bouton, 44 * s, L * 0.8 - 104 * s, 2, 800, 36 * s);
  const bw = borne(bt.w + 104 * s, 440 * s, U.largeur * 0.92);
  const bh = Math.max(112 * s, bt.h + 68 * s);
  const g = 56 * s;
  const total = (qu ? qu.h + g : 0) + bh;
  let y = U.y + (U.hauteur - total) / 2 - 24 * s;
  if (qu) {
    entrer(poserTexte(add, "question", qu, x0, y, L, { graisse: 800, couleur: "noir", alignement: "centre" }), Math.max(pf, avancement(T, a0, 500)), 16 * s);
    y += qu.h + g;
  }
  const bx = U.x + (U.largeur - bw) / 2;
  const pb = Math.max(pf, avancement(T, a0 + (qu ? 450 : 0), 500));
  entrer(add({ id: "bouton", genre: "forme", rect: { x: bx, y, largeur: bw, hauteur: bh }, remplissage: "terracotta", rayonPx: bh / 2, ombre: true }), pb, 24 * s);
  entrer(poserTexte(add, "bouton/texte", bt, bx, y + (bh - bt.h) / 2, bw, { graisse: 700, couleur: "ivoire", alignement: "centre", parentId: "bouton" }), pb, 24 * s);
  add({ id: "bouton/cible", genre: "cible", rect: { x: bx, y, largeur: bw, hauteur: bh } });
  const dep = Math.max(a0, sc.clicAMs - 1100);
  poserCurseur(add, s, T, dep, sc.clicAMs, { x: U.x + U.largeur - 90 * s, y: U.y + U.hauteur - 130 * s }, { x: bx + bw * 0.62, y: y + bh * 0.58 }, "bouton/cible", 1.0e9);
  return els;
}

/* ------------------------------------------------------------------ */
/* Scène « carte-phrase » (repli générique)                             */
/* ------------------------------------------------------------------ */

function sceneCartePhrase(c: Ctx, sc: Extract<SceneSansVoix, { genre: "carte-phrase" }>): Pose[] {
  const { T, s, U, pf } = c;
  const { els, add } = nouveau();
  const a0 = sc.debutMs;
  const pad = 56 * s;
  const f = ajuster(s, sc.texte, 68 * s, U.largeur - 2 * pad, 3, 800, 56 * s);
  const filetH = 10 * s;
  const padV = Math.min(pad, Math.max(20 * s, (U.hauteur - 70 * s - f.h - filetH - 28 * s) / 2));
  const h = Math.min(U.hauteur - 70 * s, f.h + 2 * padV + filetH + 28 * s);
  const y = U.y + (U.hauteur - h) / 2;
  const p = Math.max(pf, avancement(T, a0, 550));
  entrer(add({ id: "carte", genre: "forme", rect: { x: U.x, y, largeur: U.largeur, hauteur: h }, remplissage: "blanc", contour: "gris", rayonPx: 32 * s, ombre: true }), p, 24 * s);
  const q = avancement(T, a0 + 300, 600, adoucir);
  add({ id: "carte/filet", genre: "forme", rect: { x: U.x + pad, y: y + padV, largeur: 120 * s * q, hauteur: filetH }, opacite: q > 0 ? 1 : 0, remplissage: "terracotta", rayonPx: filetH / 2, progression: q, parentId: "carte" });
  entrer(poserTexte(add, "carte/texte", f, U.x + pad, y + padV + filetH + 28 * s, U.largeur - 2 * pad, { graisse: 800, couleur: "noir", parentId: "carte" }), Math.max(pf, avancement(T, a0 + 150, 500)), 16 * s);
  return els;
}

/* ------------------------------------------------------------------ */
/* Scène « écran » : la fenêtre qui se construit                        */
/* ------------------------------------------------------------------ */

const HAUTEURS_COLONNES = [
  [0.35, 0.5, 0.45, 0.7, 0.6, 0.85],
  [0.8, 0.6, 0.7, 0.45, 0.5, 0.3],
  [0.9, 0.75, 0.6, 0.45, 0.3, 0.15],
];

/** Groupe d'un élément de l'écran (pour l'atténuation d'un `focus`) ; `null` = jamais atténué (coque de la fenêtre). */
function groupeDe(id: string): "cartes" | "liste" | "panneau" | "alerte" | null {
  if (id.startsWith("carte-") || id === "pulse-carte") return "cartes";
  if (id === "liste" || id.startsWith("liste/") || id.startsWith("rang-") || id.startsWith("ligne-1")) return "liste";
  if (id === "panneau" || id.startsWith("panneau/")) return "panneau";
  if (id === "alerte" || id.startsWith("alerte/")) return "alerte";
  return null;
}

function sceneEcran(c: Ctx, sc: Extract<SceneSansVoix, { genre: "ecran" }>): Pose[] {
  const { T, s, U, pf } = c;
  const { els, add } = nouveau();
  const ev = sc.evenements;
  const W = U;
  const compact = U.hauteur < 760 * s; // 1:1 et 16:9 : fenêtre moins haute, marges resserrées
  const barH = Math.round((compact ? 64 : 92) * s);
  const P = Math.round((compact ? 16 : 18) * s);
  const g = Math.round((compact ? 14 : 14) * s);
  const g2 = Math.round((compact ? 14 : 20) * s);
  const ix = W.x + P;
  const iy = W.y + barH + P;
  const iw = W.largeur - 2 * P;
  const ih = W.hauteur - barH - 2 * P;
  const evCartes = trouver(ev, "cartes-chiffres");
  const evListe = trouver(ev, "liste");
  const evTri = trouver(ev, "tri");
  const evClic = trouver(ev, "clic");
  const evPanneau = trouver(ev, "panneau");
  const evAlerte = trouver(ev, "alerte");

  /* Alerte (bannière) : calculée d'abord, elle estompe le titre de la fenêtre. */
  const pIn = evAlerte ? avancement(T, evAlerte.aMs, 450) : 0;
  const pOut = evAlerte ? 1 - avancement(T, evAlerte.aMs + 450 + DUREES_MS.alerteTenue, 400, adoucir) : 1;
  const bp = pIn * pOut;

  /* Écran qui VIT avant le premier événement : cascade des emplacements (contours, barres squelettes). */
  const horsFocus = ev.filter((e) => e.genre !== "focus").map((e) => e.aMs);
  if (evCartes) for (const k of evCartes.cartes) horsFocus.push(k.aMs);
  const premierEv = Math.min(sc.finMs, ...horsFocus);
  const T0 = sc.debutMs + 450;
  const cascade = premierEv - T0 >= 1500;

  /* Fenêtre : coque, dots, titre, filet */
  add({ id: "fenetre", genre: "forme", rect: { ...W }, remplissage: "blanc", contour: "gris", rayonPx: 28 * s, ombre: true });
  for (let k = 0; k < 3; k++) {
    add({ id: `fenetre/point-${k + 1}`, genre: "forme", rect: { x: W.x + 28 * s + k * 34 * s, y: W.y + barH / 2 - 11 * s, largeur: 22 * s, hauteur: 22 * s }, opacite: 0.5 * (1 - bp), icone: "point", couleur: "grisTexte", parentId: "fenetre" });
  }
  const tx = W.x + 28 * s + 3 * 34 * s + 24 * s;
  const tf = ajuster(s, sc.titreFenetre, 44 * s, W.x + W.largeur - tx - 28 * s, 1, 800, 40 * s);
  poserTexte(add, "fenetre/titre", tf, tx, W.y + (barH - tf.h) / 2, W.largeur, { graisse: 700, couleur: "noir", parentId: "fenetre", opacite: 1 - bp });
  add({ id: "fenetre/filet", genre: "forme", rect: { x: W.x + 2 * s, y: W.y + barH, largeur: W.largeur - 4 * s, hauteur: 2 * s }, remplissage: "gris", parentId: "fenetre" });

  /* Cartes-chiffres : libellés ≥ 36 px sur 2 lignes max, cartes hautes (la fenêtre a de la place). */
  const cartes = evCartes ? evCartes.cartes.slice(0, 4) : [];
  const n = cartes.length > 0 ? cartes.length : 3;
  const cw = (iw - (n - 1) * g) / n;
  const padC = Math.round((compact ? 12 : 14) * s);
  const wInt = cw - 2 * padC;
  let fits = cartes.map((k) => ajuster(s, k.libelle, 40 * s, wInt, 2, 600, 36 * s));
  if (fits.length) {
    const tmin = Math.min(...fits.map((f) => f.taille));
    fits = cartes.map((k) => ajuster(s, k.libelle, tmin, wInt, 2, 600, Math.min(36 * s, tmin)));
  }
  const labelH = fits.length ? Math.max(...fits.map((f) => f.h)) : 2 * 40 * s * INTERLIGNE;
  const valH = (compact ? 30 : 40) * s;
  const stripH = 8 * s;
  const gv = (compact ? 10 : 18) * s;
  const naturel = padC + stripH + gv + labelH + gv + valH + padC;
  const cardsH = Math.min(Math.max(naturel, (compact ? 0.34 : 0.4) * ih), 0.46 * ih);
  const largsVal = [0.62, 0.5, 0.7, 0.55];
  const rectCarte = (k: number): RectPx => ({ x: ix + k * (cw + g), y: iy, largeur: cw, hauteur: cardsH });

  /* Liste : N plafonné selon la place (minimum 3), lignes qui TIENNENT dans le panneau. */
  const lx = ix;
  const ly = iy + cardsH + g2;
  const lh = iy + ih - ly;
  const pw = Math.floor(0.55 * W.largeur);
  const pOuv = evPanneau ? avancement(T, evPanneau.aMs, DUREES_MS.panneau, adoucir) : 0;
  const lwMin = evPanneau ? iw - (pw + g) : iw;
  const lw = iw - pOuv * (pw + g);
  const padL = Math.round((compact ? 12 : 18) * s);
  const pL = evListe ? avancement(T, evListe.aMs, 450) : 0;
  const titreL = evListe ? ajuster(s, evListe.titre, 40 * s, lwMin - 2 * padL, 2, 800, 40 * s) : null;
  let pill: Ajuste | null = null;
  let pillSurLigne = true;
  if (evTri) {
    pill = ajuster(s, evTri.etiquette, 36 * s, lwMin - 2 * padL - 32 * s, 1, 600, 36 * s);
    pillSurLigne = !!titreL && titreL.w + 24 * s + pill.w + 32 * s <= lwMin - 2 * padL;
  }
  const titreH = titreL ? titreL.h : 24 * s;
  const pillH = pill ? pill.h + 14 * s : 0;
  const headerH = pill && !pillSurLigne ? titreH + 10 * s + pillH : Math.max(titreH, pillH);
  const rowsTop = ly + padL + headerH + 14 * s;
  const dispoRangs = Math.max(0, ly + lh - padL - rowsTop);
  const gapR = (lh < 330 * s ? 8 : 12) * s;
  const rowMin = 40 * s;
  const Ndemande = Math.round(borne(evListe ? evListe.lignes : 4, 2, 7));
  const Nplace = Math.floor((dispoRangs + gapR) / (rowMin + gapR));
  const N = Math.max(3, Math.min(Ndemande, Nplace));
  const gapEff = Math.min(gapR, dispoRangs / (4 * N));
  // Hauteur de ligne : jamais relevée au-dessus de ce qui tient (les N lignes tiennent TOUJOURS dans le panneau).
  const rowH = Math.min(84 * s, Math.max(1, (dispoRangs - (N - 1) * gapEff) / N));
  const slotAvant: number[] = [];
  if (evTri) {
    const ordre = Array.from({ length: N }, (_, i) => i).sort((a, b) => ((a * 5 + 3) % 11) - ((b * 5 + 3) % 11));
    ordre.forEach((item, rang) => (slotAvant[item] = rang));
  } else for (let i = 0; i < N; i++) slotAvant[i] = i;
  const pTri = evTri ? avancement(T, evTri.aMs, DUREES_MS.tri, adoucir) : 0;
  const slotPos = (i: number) => entre(slotAvant[i], i, pTri);
  const rowRect = (pos: number): RectPx => ({ x: lx + padL, y: rowsTop + pos * (rowH + gapEff), largeur: lw - 2 * padL, hauteur: rowH });

  /* Cascade des emplacements : une case par étape (contour de carte, barres, panneau, lignes). */
  const etapes = 3 * n + 2 + N;
  const dt = borne((premierEv - T0 - 600) / etapes, 120, 380);
  const gh = (etape: number) => (cascade ? avancement(T, T0 + etape * dt, 450) : 1);
  const bril = (k: number) => 1 + 0.15 * Math.sin((2 * Math.PI * T) / 2400 + k);

  for (let k = 0; k < n; k++) {
    const R = rectCarte(k);
    const a = cartes[k] ? cartes[k].aMs : Infinity;
    const p = Number.isFinite(a) ? avancement(T, a, 450) : 0;
    const dy = 14 * s;
    const id = `carte-${k + 1}`;
    const g0 = gh(3 * k);
    const g1 = gh(3 * k + 1);
    const g2c = gh(3 * k + 2);
    add({ id, genre: "forme", rect: { ...R, y: R.y + (1 - p) * dy }, opacite: g0 * (0.55 + 0.45 * p), remplissage: "ivoire", contour: "gris", rayonPx: 20 * s });
    const fy = (e: Pose) => {
      e.rect = { ...e.rect, y: e.rect.y + (1 - p) * dy };
      return e;
    };
    if (p < 1) {
      fy(add({ id: `${id}/fantome-libelle`, genre: "forme", rect: { x: R.x + padC, y: R.y + padC + stripH + gv, largeur: wInt * 0.7 * g1, hauteur: 16 * s }, opacite: 0.22 * (1 - p) * g1 * bril(k), remplissage: "grisTexte", rayonPx: 8 * s, parentId: id }));
      fy(add({ id: `${id}/fantome-valeur`, genre: "forme", rect: { x: R.x + padC, y: R.y + cardsH - padC - valH, largeur: wInt * 0.45 * g2c, hauteur: valH }, opacite: 0.22 * (1 - p) * g2c * bril(k + 1), remplissage: "grisTexte", rayonPx: valH / 2, parentId: id }));
    }
    if (p > 0) {
      fy(add({ id: `${id}/accent`, genre: "forme", rect: { x: R.x + padC, y: R.y + padC, largeur: 56 * s, hauteur: stripH }, opacite: p * (k === 0 ? 1 : 0.3), remplissage: k === 0 ? "terracotta" : "grisTexte", rayonPx: stripH / 2, parentId: id }));
      if (fits[k]) fy(poserTexte(add, `${id}/libelle`, fits[k], R.x + padC, R.y + padC + stripH + gv, wInt, { graisse: 600, couleur: "noir", parentId: id, opacite: p }));
      const q = avancement(T, a + 150, 650, adoucir);
      fy(add({ id: `${id}/valeur`, genre: "forme", rect: { x: R.x + padC, y: R.y + cardsH - padC - valH, largeur: wInt * largsVal[k % 4] * q, hauteur: valH }, opacite: q > 0 ? (k === 0 ? 1 : 0.35) * Math.min(1, q * 6) * p : 0, remplissage: k === 0 ? "terracotta" : "grisTexte", rayonPx: valH / 2, progression: q, parentId: id }));
    }
  }

  const gL = gh(3 * n);
  const gT = gh(3 * n + 1);
  add({ id: "liste", genre: "forme", rect: { x: lx, y: ly, largeur: lw, hauteur: lh }, opacite: gL * (0.55 + 0.45 * pL), remplissage: "ivoire", contour: "gris", rayonPx: 22 * s });
  if (pL < 1) {
    add({ id: "liste/fantome-titre", genre: "forme", rect: { x: lx + padL, y: ly + padL, largeur: Math.min(lw - 2 * padL, lw * 0.4) * gT, hauteur: 22 * s }, opacite: 0.22 * (1 - pL) * gT * bril(7), remplissage: "grisTexte", rayonPx: 11 * s, parentId: "liste" });
  }
  if (titreL) {
    poserTexte(add, "liste/titre", titreL, lx + padL, ly + padL + (pill && !pillSurLigne ? 0 : (headerH - titreH) / 2), lw, { graisse: 700, couleur: "noir", parentId: "liste", opacite: pL });
  }
  if (pill && evTri) {
    const pq = avancement(T, evTri.aMs, 350);
    const pwid = pill.w + 32 * s;
    const px = pillSurLigne && titreL ? lx + padL + titreL.w + 24 * s : lx + padL;
    const py = pillSurLigne ? ly + padL + (headerH - pillH) / 2 : ly + padL + titreH + 10 * s;
    add({ id: "liste/etiquette", genre: "forme", rect: { x: px, y: py + (1 - pq) * 8 * s, largeur: pwid, hauteur: pillH }, opacite: pq, remplissage: "gris", rayonPx: pillH / 2, parentId: "liste" });
    poserTexte(add, "liste/etiquette/texte", pill, px + 16 * s, py + 7 * s + (1 - pq) * 8 * s, pwid, { graisse: 600, couleur: "noir", parentId: "liste/etiquette", opacite: pq });
  }
  // Clic : si l'événement précède l'écran (plan non chronologique), il est repoussé 1 s après son début.
  const tClic = evClic ? Math.max(evClic.aMs, sc.debutMs + 1000) : Infinity;
  const litP = evClic ? avancement(T, tClic, 250) : 0;
  for (let i = 0; i < N; i++) {
    const pos = slotPos(i);
    const R = rowRect(pos);
    const aRow = evListe ? evListe.aMs + 120 + slotAvant[i] * 130 : Infinity;
    const pr = Number.isFinite(aRow) ? avancement(T, aRow, 380) : 0;
    const gr = gh(3 * n + 2 + slotAvant[i]);
    const dy = (1 - pr) * Math.min(14 * s, padL * 0.8);
    const id = `rang-${i + 1}`;
    add({ id, genre: "forme", rect: { ...R, y: R.y + dy }, opacite: gr * (0.45 + 0.55 * pr), remplissage: "blanc", contour: "gris", rayonPx: Math.min(14 * s, R.hauteur / 2), parentId: "liste" });
    const ps = Math.min(R.hauteur * 0.46, 28 * s);
    const bx = R.x + 16 * s + ps + 16 * s;
    const shortW = R.largeur * 0.14;
    const dispo = Math.max(0, R.largeur - (bx - R.x) - 16 * s - shortW - 16 * s);
    const bh = Math.min(R.hauteur * 0.3, 18 * s);
    if (pr < 1) {
      add({ id: `${id}/fantome-barre`, genre: "forme", rect: { x: bx, y: R.y + (R.hauteur - bh) / 2 + dy, largeur: dispo * 0.6 * gr, hauteur: bh }, opacite: 0.2 * (1 - pr) * gr * bril(i + 3), remplissage: "grisTexte", rayonPx: bh / 2, parentId: id });
    }
    if (pr > 0) {
      const urg = N > 1 ? 1 - (0.65 * i) / (N - 1) : 1;
      add({ id: `${id}/pastille`, genre: "forme", rect: { x: R.x + 16 * s, y: R.y + (R.hauteur - ps) / 2 + dy, largeur: ps, hauteur: ps }, opacite: pr * urg, icone: "pastille", couleur: "terracotta", parentId: id });
      const qb = avancement(T, aRow + 100, 500, adoucir);
      add({ id: `${id}/barre`, genre: "forme", rect: { x: bx, y: R.y + (R.hauteur - bh) / 2 + dy, largeur: dispo * [0.78, 0.62, 0.7, 0.5][i % 4] * qb, hauteur: bh }, opacite: qb > 0 ? 0.3 * pr : 0, remplissage: "grisTexte", rayonPx: bh / 2, progression: qb, parentId: id });
      add({ id: `${id}/court`, genre: "forme", rect: { x: R.x + R.largeur - 16 * s - shortW * qb, y: R.y + (R.hauteur - bh) / 2 + dy, largeur: shortW * qb, hauteur: bh }, opacite: qb > 0 ? 0.2 * pr : 0, remplissage: "grisTexte", rayonPx: bh / 2, progression: qb, parentId: id });
    }
  }
  const slot0 = rowRect(0);
  // La surbrillance du clic est attachée à la CIBLE FIXE `ligne-1` (position 0 de la liste), pas à une ligne qui bouge.
  if (litP > 0.002) {
    add({ id: "ligne-1/allume-fond", genre: "forme", rect: { ...slot0 }, opacite: 0.12 * litP, remplissage: "terracotta", rayonPx: Math.min(14 * s, slot0.hauteur / 2), parentId: "liste" });
    add({ id: "ligne-1/allume", genre: "forme", rect: { ...slot0 }, opacite: litP, contour: "terracotta", rayonPx: Math.min(14 * s, slot0.hauteur / 2), parentId: "liste" });
  }
  add({ id: "ligne-1", genre: "cible", rect: slot0 });

  /* Panneau « Historique » (dans la fenêtre, ≤ 55 % de sa largeur) */
  if (evPanneau) {
    const pp = avancement(T, evPanneau.aMs, 500);
    const off = (1 - pp) * 14 * s;
    const px = ix + iw - pw + off;
    const idP = "panneau";
    add({ id: idP, genre: "forme", rect: { x: px, y: ly, largeur: pw, hauteur: lh }, opacite: pp, remplissage: "blanc", contour: "gris", rayonPx: 22 * s, ombre: true });
    const th = ajuster(s, evPanneau.titre, 44 * s, pw - 2 * padL - 54 * s, 1, 800, 40 * s);
    add({ id: `${idP}/horloge`, genre: "forme", rect: { x: px + padL, y: ly + padL + (th.h - 40 * s) / 2, largeur: 40 * s, hauteur: 40 * s }, opacite: pp, icone: "horloge", couleur: "terracotta", parentId: idP });
    poserTexte(add, `${idP}/titre`, th, px + padL + 54 * s, ly + padL, pw, { graisse: 700, couleur: "noir", parentId: idP, opacite: pp });
    const ligne = pw >= 560 * s;
    const labW = ligne ? (pw - 2 * padL) * 0.58 : pw - 2 * padL;
    const rub = evPanneau.rubriques;
    const lf = rub.map((r) => ajuster(s, r.libelle, (compact ? 36 : 40) * s, labW, 2, 600, 36 * s));
    const dispoH = lh - 2 * padL - th.h - (compact ? 8 : 16) * s - (compact ? 6 : 14) * s;
    const options = [
      { chartH: 36, gp: 16, sepL: 10 },
      { chartH: 24, gp: 8, sepL: 10 },
      { chartH: 16, gp: 6, sepL: 4 },
      { chartH: 10, gp: 4, sepL: 3 },
      { chartH: 6, gp: 2, sepL: 2 },
    ];
    const total = (o: (typeof options)[number]) => lf.reduce((a, f) => a + (ligne ? Math.max(f.h, o.chartH * s) : f.h + o.sepL * s + o.chartH * s), 0) + Math.max(0, rub.length - 1) * o.gp * s;
    const choix = options.find((o) => total(o) <= dispoH) ?? options[options.length - 1];
    const chartH = choix.chartH * s;
    const gp = choix.gp * s;
    const sepL = choix.sepL * s;
    const hs = lf.map((f) => (ligne ? Math.max(f.h, chartH) : f.h + sepL + chartH));
    let yy = ly + padL + th.h + (compact ? 8 : 16) * s;
    rub.forEach((r, k) => {
      const f = lf[k];
      // Une rubrique n'apparaît jamais avant son panneau (plan non chronologique).
      const pr = avancement(T, Math.max(r.aMs, evPanneau.aMs + 300), 400);
      const dy = (1 - pr) * 12 * s;
      const idR = `${idP}/rubrique-${k + 1}`;
      poserTexte(add, `${idR}/libelle`, f, px + padL, yy + dy + (ligne ? (hs[k] - f.h) / 2 : 0), labW, { graisse: 600, couleur: "noir", parentId: idP, opacite: pr });
      const colW = 16 * s;
      const colG = 8 * s;
      const chartW = 6 * colW + 5 * colG;
      const cx = ligne ? px + pw - padL - chartW : px + padL;
      const base = ligne ? yy + (hs[k] + chartH) / 2 : yy + f.h + sepL + chartH;
      const fr = HAUTEURS_COLONNES[k % 3];
      const debut = Math.max(r.aMs, evPanneau.aMs + 300);
      for (let j = 0; j < 6; j++) {
        const q = avancement(T, debut + 150 + j * 70, 450, adoucir);
        const hh = chartH * fr[j] * q;
        const rouge = k % 3 === 2 && j === 5;
        add({ id: `${idR}/colonne-${j + 1}`, genre: "forme", rect: { x: cx + j * (colW + colG), y: base - hh + dy, largeur: colW, hauteur: hh }, opacite: q > 0 ? (rouge ? 1 : 0.35) * Math.min(1, q * 6) * pr : 0, remplissage: rouge ? "terracotta" : "grisTexte", rayonPx: 4 * s, progression: q, parentId: idP });
      }
      yy += hs[k] + gp;
    });
  }

  /* Pulsation de la carte (alerte) */
  if (evAlerte && evAlerte.cartePulse !== undefined && evAlerte.cartePulse >= 0 && evAlerte.cartePulse < n) {
    const x = (T - (evAlerte.aMs + 400)) / DUREES_MS.pulseTotal;
    if (x > 0 && x < 1) {
      const env = Math.pow(Math.sin(2 * Math.PI * x), 2);
      add({ id: "pulse-carte", genre: "forme", rect: rectEnveloppe(rectCarte(evAlerte.cartePulse), 5 * s * env), opacite: env, contour: "terracotta", rayonPx: 24 * s });
    }
  }

  /* Curseur du clic (vers la ligne 1) : toujours visible et d'accord avec la ligne allumée (même instant `tClic`). */
  if (evClic) {
    const dep = Math.max(sc.debutMs, tClic - 1000);
    const cible = { x: slot0.x + slot0.largeur * 0.45, y: slot0.y + slot0.hauteur * 0.55 };
    poserCurseur(add, s, T, dep, tClic, { x: W.x + W.largeur - 90 * s, y: W.y + barH + 40 * s }, cible, "ligne-1", 1500);
  }

  /* Bannière d'alerte (au-dessus) */
  let banR: RectPx | null = null;
  if (evAlerte && bp > 0.001) {
    const pad = 22 * s;
    const ico = 48 * s;
    const bw = W.largeur - 48 * s;
    const bt = ajuster(s, evAlerte.texte, 36 * s, bw - 2 * pad - ico - 18 * s, 2, 600, 36 * s);
    const bh = Math.max(76 * s, bt.h + 2 * 18 * s);
    const by = W.y + 12 * s - (1 - pIn) * 30 * s;
    banR = { x: W.x + 24 * s, y: by, largeur: bw, hauteur: bh };
    add({ id: "alerte", genre: "forme", rect: banR, opacite: bp, remplissage: "blanc", contour: "terracotta", rayonPx: 22 * s, ombre: true });
    add({ id: "alerte/cloche", genre: "forme", rect: { x: W.x + 24 * s + pad, y: by + (bh - ico) / 2, largeur: ico, hauteur: ico }, opacite: bp, icone: "cloche", couleur: "terracotta", parentId: "alerte" });
    poserTexte(add, "alerte/texte", bt, W.x + 24 * s + pad + ico + 18 * s, by + (bh - bt.h) / 2, bw, { graisse: 600, couleur: "noir", parentId: "alerte", opacite: bp });
  }

  /* Mise en valeur (`focus`) : PAS de zoom. La cible s'éclaire (contour terracotta qui pulse), les autres parties
     s'atténuent à 0,55 ENSEMBLE avec leurs enfants. Tous les focus sont gérés : le plus avancé à l'instant t l'emporte. */
  let kMax = 0;
  let foc: Extract<EvenementEcran, { genre: "focus" }> | undefined;
  for (const e of ev) {
    if (e.genre !== "focus") continue;
    const k = avancement(T, e.aMs, DUREES_MS.camera, adoucir) * (1 - avancement(T, e.finMs, DUREES_MS.camera, adoucir));
    if (k > kMax) {
      kMax = k;
      foc = e;
    }
  }
  if (foc && kMax > 0.001) {
    const listeR: RectPx = { x: lx, y: ly, largeur: lw, hauteur: lh };
    let cible: "cartes" | "liste" | "panneau" | "alerte" | "ensemble" = foc.cible;
    if (cible === "panneau" && !evPanneau) cible = "liste";
    if (cible === "alerte" && !banR) cible = "ensemble";
    const cadre: RectPx = cible === "cartes" ? { x: ix, y: iy, largeur: iw, hauteur: cardsH } : cible === "liste" ? listeR : cible === "panneau" ? { x: ix + iw - pw, y: ly, largeur: pw, hauteur: lh } : cible === "alerte" ? banR! : { ...W };
    if (cible !== "ensemble") {
      const f = 1 - (1 - OPACITE_ATTENUEE) * kMax;
      for (const e of els) {
        const gr = groupeDe(e.id);
        if (gr !== null && gr !== cible && e.genre !== "cible") e.opacite *= f;
      }
    }
    const marge = (cible === "ensemble" ? 3 : 6) * s;
    const pulse = 0.8 + 0.2 * Math.sin((2 * Math.PI * (T - foc.aMs)) / 800);
    add({ id: "focus-cadre", genre: "forme", rect: rectEnveloppe(cadre, marge), opacite: kMax * pulse, contour: "terracotta", rayonPx: 26 * s });
  }

  /* Entrée de la fenêtre (montée + fondu) */
  const wp = Math.max(pf, avancement(T, sc.debutMs, DUREES_MS.entree));
  for (const e of els) entrer(e, wp, 14 * s);
  return els;
}

/* ------------------------------------------------------------------ */
/* Assemblage : scènes, transitions, dérive                             */
/* ------------------------------------------------------------------ */

const DERIVE: Record<SceneSansVoix["genre"], number> = { titre: 0.02, repere: 0.02, appel: 0.02, "carte-phrase": 0.02, ecran: 0.012 };

/** Marge intérieure de la zone utile (px à 1080) : absorbe glissé (24), entrée (≤ 28), dérive et recul sans sortir du contenu. */
const MARGE_UTILE = 56;

function construire(c: Ctx, sc: SceneSansVoix): Pose[] {
  switch (sc.genre) {
    case "titre":
      return sceneTitre(c, sc);
    case "ecran":
      return sceneEcran(c, sc);
    case "repere":
      return sceneRepere(c, sc);
    case "appel":
      return sceneAppel(c, sc);
    case "carte-phrase":
      return sceneCartePhrase(c, sc);
  }
}

export function imageSansVoixA(plan: PlanComposeSansVoix, tMs: number): ImageSansVoix {
  const zones = zonesSansVoix(plan.format, plan.basPct);
  const s = echelleFormat(plan.format);
  const m = MARGE_UTILE * s;
  const C = zones.contenu;
  const U: RectPx = { x: C.x + m, y: C.y + m, largeur: C.largeur - 2 * m, hauteur: C.hauteur - 2 * m };
  const scenes = [...plan.scenes].sort((a, b) => a.debutMs - b.debutMs);
  if (scenes.length === 0) return { tMs, fond: "ivoire", elements: [] };
  const T = tMs;
  let idx = 0;
  for (let i = 0; i < scenes.length; i++) if (scenes[i].debutMs <= T) idx = i;
  const aTracer = idx > 0 && T < scenes[idx].debutMs + DUREES_MS.transition ? [idx - 1, idx] : [idx];
  const sortie: Pose[] = [];
  for (const i of aTracer) {
    const sc = scenes[i];
    const x = borne((T - scenes[idx].debutMs) / DUREES_MS.transition, 0, 1);
    const a = adoucir(x);
    const entrant = i === idx;
    const premier = i === 0;
    let opacite = 1;
    let dy = 0;
    let recul = 1;
    if (!entrant) {
      opacite = 1 - a;
      dy = -a * DUREES_MS.glisseTransitionPx * s;
      recul = 1 - DUREES_MS.reculSortie * a;
    } else if (!premier) {
      opacite = a;
      dy = (1 - a) * DUREES_MS.glisseTransitionPx * s;
    }
    const duree = Math.max(1, sc.finMs - sc.debutMs);
    const derive = 1 + DERIVE[sc.genre] * borne((T - sc.debutMs) / duree, 0, 1);
    const e = derive * recul;
    const ctx: Ctx = { T, s, U, pf: premier ? 0.3 : 0 };
    const cx = U.x + U.largeur / 2;
    const cy = U.y + U.hauteur / 2;
    for (const p of construire(ctx, sc)) {
      const r = p.rect;
      const rect: RectPx = { x: cx + (r.x - cx) * e, y: cy + (r.y - cy) * e + dy, largeur: r.largeur * e, hauteur: r.hauteur * e };
      const el: ElementVisible = { ...p, id: `${sc.id}/${p.id}`, rect, opacite: p.opacite * opacite, z: i * 10000 + p.z };
      if (p.parentId) el.parentId = `${sc.id}/${p.parentId}`;
      if (p.cibleId) el.cibleId = `${sc.id}/${p.cibleId}`;
      if (p.taillePx) el.taillePx = p.taillePx * e;
      if (p.pointe) el.pointe = { x: cx + (p.pointe.x - cx) * e, y: cy + (p.pointe.y - cy) * e + dy };
      for (const k of Object.keys(el) as (keyof ElementVisible)[]) if (el[k] === undefined) delete el[k];
      el.opacite = borne(el.opacite, 0, 1);
      sortie.push(el);
    }
  }
  sortie.sort((a, b) => a.z - b.z);
  // Les enfants prennent TOUJOURS l'opacité de leur parent (jamais plus opaques) : le parent précède l'enfant (z croissant).
  const opaciteDe = new Map<string, number>();
  for (const el of sortie) {
    if (el.parentId !== undefined) {
      const po = opaciteDe.get(el.parentId);
      if (po !== undefined && el.opacite > po) el.opacite = po;
    }
    opaciteDe.set(el.id, el.opacite);
  }
  return { tMs, fond: "ivoire", elements: sortie };
}

/** Alias : seuls les éléments posés à l'instant `tMs` (ce que lit le contrôle de composition). */
export const elementsSansVoixA = (plan: PlanComposeSansVoix, t: number): ElementVisible[] => imageSansVoixA(plan, t).elements;
