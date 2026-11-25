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
 *    `rect.hauteur = lignes.length · taillePx · INTERLIGNE`. Les « ? ! : ; » et « » » sont collés au mot précédent par une
 *    espace insécable (U+00A0) : jamais de ponctuation haute en début de ligne ; les lignes sont ÉQUILIBRÉES ;
 *  - `lignes.join(" ")` peut DIFFÉRER de `texte` : (1) espaces insécables, (2) mot trop long coupé par un trait d'union
 *    (≥ 3 lettres de chaque côté : « Réapprovi- » « sionnements »), (3) texte raccourci à une FRONTIÈRE DE MOT et fini par
 *    « … » : alors `tronque: true` et `texteSource` = texte complet du plan (jamais de coupe au milieu d'un mot) ;
 *  - `genre: "cible"` = zone cliquable visée : transparente (sans remplissage ni contour), la ligne ou le bouton visible est
 *    une `forme` voisine ; un curseur référence toujours une `cible` présente dans la même image ; la pointe du curseur est
 *    DANS le rect de la cible (et pas sur le texte du bouton) ; `rect` du curseur = boîte de la flèche dessinée (34 × 50 à 1080) ;
 *  - icône « horloge » : `progression` = tour de l'aiguille (0..1) ; elle TOURNE pour la grande horloge de l'avant / après et reste
 *    IMMOBILE à 3 h pour les petites icônes (≤ 48 px : une aiguille qui tourne sur un diamètre se lit comme « interdit ») ;
 *  - ALERTE en deux temps : à `aMs` l'écran montre la condition (carte qui pulse, ligne la plus urgente terracotta) ; au déclencheur le
 *    toast part et reste jusqu'à la sortie de la scène ; le titre de la fenêtre ne disparaît jamais ;
 *  - les enfants d'une carte/panneau portent `parentId` : ils sont TOUJOURS dans le rect de leur parent et leur opacité est
 *    ≤ celle du parent (garanti en fin de calcul) ;
 *  - TOUT élément, visible ou non (même d'opacité < 0,05), reste dans `zones.contenu` : aucun filet de sécurité qui masque,
 *    la mise en page calcule ce qui tient (disposition changée avant de couper un mot, lignes de liste plafonnées, rubriques
 *    plafonnées : documenté dans `sceneEcran`) ;
 *  - aucun nombre ajouté : seuls les textes du plan sont affichés, les valeurs sont des barres squelettes.
 *
 * Règles de mouvement :
 *  - ENTRE DEUX SCÈNES : la sortante s'efface en 130 ms (elle glisse de 14 px vers le haut et recule à 0,96), PUIS l'entrante
 *    monte du bas et apparaît (de +130 à +330 ms) : aucun texte superposé à une opacité > 0,15 ;
 *  - CAMÉRA : un léger mouvement global (échelle 1 → 1,035, dérive ≤ 12 px, courbes douces) s'applique à TOUT le groupe de la
 *    scène ; la mise en page garde la marge pour qu'il ne sorte jamais du contenu ;
 *  - ÉCRAN : la fenêtre (≥ 95 % de la largeur et ≥ 90 % de la hauteur du contenu) se construit en ≈ 1,5 s (cartes avec leurs
 *    libellés en cascade, titre et lignes squelettes de la liste), puis chaque partie s'ILLUMINE au mot qui la cite ; dans les
 *    creux entre deux mots, des colonnes de mini-graphique (squelette) se posent une à une : jamais plus de ~1,5 s sans
 *    élément nouveau ; jamais de rebond (seul le toast d'alerte a un petit dépassement doux, ≤ 6 px).
 */
import { adoucir, avancement, CAMERA, DUREES_MS, echelleFormat, entre, INTERLIGNE, OPACITE_ATTENUEE, PLANCHER_ABSOLU, PLANCHER_TEXTE, zonesSansVoix } from "./grammaire";
import { ESPACE_MOTS_EM } from "../../../motion/mesure";
import { largeurMot, type NomPolice } from "../../../sous-titres/mesure";
import { CARACTERES } from "../../../sous-titres/metriques";
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
  /** Zone utile (contenu moins une marge) : titre, appel, carte-phrase. */
  U: RectPx;
  /** Zone `contenu` entière : fenêtre de l'écran et carte du repère. */
  C: RectPx;
  /** Plancher d'opacité des éléments de la toute première scène : 1 = image OPAQUE dès 0 ms (miniature LinkedIn), 0 ailleurs. */
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

/* ------------------------------------------------------------------ */
/* Texte : mesure, coupe équilibrée, ajustement                         */
/* ------------------------------------------------------------------ */

const NBSP = " ";
const CONNUS = new Set<string>(Array.from(CARACTERES));
const POLICES: Record<number, NomPolice> = { 500: "Manrope Medium", 600: "Manrope SemiBold", 700: "Manrope Bold", 800: "Manrope ExtraBold" };
/** Marge de sécurité de la mesure (le rendu réel est un peu plus large que la table de chasses). */
const MARGE_MESURE = 1.04;

/** Largeur (px) d'un mot à la graisse `g` ; un caractère absent de la table est estimé comme un « m » (par excès). */
function larg(mot: string, taille: number, g: number): number {
  let t = "";
  for (const c of mot) t += c === NBSP ? " " : CONNUS.has(c) || CONNUS.has(c.normalize("NFD")[0]) ? c : "m";
  return largeurMot(t, POLICES[g] ?? "Manrope ExtraBold", taille) * MARGE_MESURE;
}

const PONCTUATION_HAUTE = /^[?!:;»…]+$/;

/** Mots du texte ; « ? ! : ; » … » collés au mot précédent et « « » au mot suivant par une espace insécable. */
function jetons(texte: string): string[] {
  const sortie: string[] = [];
  for (const m of texte.split(/[ \t\r\n]+/).filter(Boolean)) {
    const prec = sortie[sortie.length - 1];
    if (prec !== undefined && (PONCTUATION_HAUTE.test(m) || prec === "«")) sortie[sortie.length - 1] = prec + NBSP + m;
    else sortie.push(m);
  }
  return sortie;
}

/** Coupe en lignes qui tiennent dans `largeur` : nombre de lignes du glouton, puis lignes ÉQUILIBRÉES (plus large ligne minimale). */
function couper(liste: string[], taille: number, g: number, largeur: number): { lignes: string[]; w: number } {
  const m = liste.length;
  const esp = ESPACE_MOTS_EM * taille;
  const ws = liste.map((x) => larg(x, taille, g));
  const wl = (a: number, b: number) => {
    let t = esp * (b - a - 1);
    for (let i = a; i < b; i++) t += ws[i];
    return t;
  };
  const gloutonne: [number, number][] = [];
  for (let i = 0; i < m; ) {
    let k = i + 1;
    while (k < m && wl(i, k + 1) <= largeur) k++;
    gloutonne.push([i, k]);
    i = k;
  }
  let coupes = gloutonne;
  const n = gloutonne.length;
  if (n >= 2 && ws.every((w) => w <= largeur)) {
    // Programmation dynamique : exactement n lignes, plus grande largeur minimale, puis somme des carrés minimale.
    type Etat = { mx: number; ss: number; prec: number };
    const meilleur: (Etat | null)[][] = Array.from({ length: n + 1 }, () => Array<Etat | null>(m + 1).fill(null));
    meilleur[0][0] = { mx: 0, ss: 0, prec: -1 };
    for (let k = 1; k <= n; k++)
      for (let i = k; i <= m; i++)
        for (let j = k - 1; j < i; j++) {
          const pr = meilleur[k - 1][j];
          const w = wl(j, i);
          if (!pr || w > largeur) continue;
          const cand = { mx: Math.max(pr.mx, w), ss: pr.ss + w * w, prec: j };
          const cur = meilleur[k][i];
          if (!cur || cand.mx < cur.mx - 0.5 || (Math.abs(cand.mx - cur.mx) <= 0.5 && cand.ss < cur.ss)) meilleur[k][i] = cand;
        }
    if (meilleur[n][m]) {
      const r: [number, number][] = [];
      for (let k = n, i = m; k >= 1; k--) {
        const j = meilleur[k][i]!.prec;
        r.unshift([j, i]);
        i = j;
      }
      coupes = r;
    }
  }
  return { lignes: coupes.map(([a, b]) => liste.slice(a, b).join(" ")), w: Math.max(0, ...coupes.map(([a, b]) => wl(a, b))) };
}

interface Ajuste {
  taille: number;
  /** Lignes déjà coupées (chacune tient dans `largeur`). */
  lignes: string[];
  /** Largeur estimée du bloc (≥ réelle). */
  w: number;
  h: number;
  /** Texte réellement affiché (le texte du plan, ou une suite de mots entiers finie par « … »). */
  texte: string;
  /** Raccourci à une frontière de mot (« … ») : `source` = texte complet. */
  tronque?: true;
  source: string;
  /** Un mot a dû être coupé par un trait d'union, CÉSURE (la disposition devrait s'élargir avant d'en arriver là). */
  cesure?: true;
}

/** Coupe un mot trop long en morceaux finis par un trait d'union : ≥ 3 lettres avant et ≥ 3 lettres après chaque coupe. */
function couperMot(mot: string, taille: number, g: number, largeur: number): string[] {
  const reste = Array.from(mot);
  const morceaux: string[] = [];
  while (reste.length) {
    if (larg(reste.join(""), taille, g) <= largeur) {
      morceaux.push(reste.join(""));
      break;
    }
    let n = reste.length - 1;
    while (n > 3 && larg(reste.slice(0, n).join("") + "-", taille, g) > largeur) n--;
    n = Math.min(n, reste.length - 3);
    if (n < 3) {
      morceaux.push(reste.join(""));
      break;
    }
    morceaux.push(reste.splice(0, n).join("") + "-");
  }
  return morceaux;
}

/**
 * Texte coupé au mot qui TIENT TOUJOURS (jamais plus de `maxL` lignes, jamais plus large que `largeur`, jamais sous
 * `PLANCHER_ABSOLU`) : 1) réduit de `cible` jusqu'à `absolu` ; 2) puis jusqu'au plancher absolu ; 3) un mot encore trop long
 * est coupé avec un trait d'union (≥ 3 lettres de chaque côté, `cesure: true`) ; 4) sinon on garde les PREMIERS MOTS ENTIERS,
 * finis par « … » (`tronque: true`, jamais de coupe au milieu d'un mot). `g` = graisse de mesure (celle du dessin).
 */
const MEMO_AJUSTE = new Map<string, Ajuste>();

/** Version mémoïsée : le calcul est PUR (mêmes arguments, même résultat) et ne dépend jamais du temps, donc la mise en page
 *  d'un texte n'est refaite qu'une fois pour toutes les images d'une vidéo. Les résultats ne sont jamais modifiés par les appelants. */
function ajuster(s: number, texte: string, cible: number, largeur: number, maxL: number, g = 800, absolu = PLANCHER_TEXTE * s): Ajuste {
  const cle = `${s}|${cible}|${largeur}|${maxL}|${g}|${absolu}|${texte}`;
  let r = MEMO_AJUSTE.get(cle);
  if (!r) {
    if (MEMO_AJUSTE.size > 20000) MEMO_AJUSTE.clear();
    r = ajusterCalcul(s, texte, cible, largeur, maxL, g, absolu);
    Object.freeze(r.lignes);
    Object.freeze(r);
    MEMO_AJUSTE.set(cle, r);
  }
  return r;
}

function ajusterCalcul(s: number, texte: string, cible: number, largeur: number, maxL: number, g = 800, absolu = PLANCHER_TEXTE * s): Ajuste {
  const dur = Math.min(absolu, PLANCHER_ABSOLU * s);
  const mots = jetons(texte);
  const fait = (taille: number, liste: string[], affiche: string): Ajuste => {
    const { lignes, w } = couper(liste, taille, g, largeur);
    return { taille, lignes, w: Math.ceil(w), h: lignes.length * taille * INTERLIGNE, texte: affiche, source: texte };
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
  // Unités affichables : un mot entier, ou un morceau de mot césuré (`cesure` = le mot continue au morceau suivant).
  const unites: { txt: string; cesure: boolean }[] = mots.flatMap((m) => {
    if (larg(m, dur, g) <= largeur) return [{ txt: m, cesure: false }];
    const morceaux = couperMot(m, dur, g, largeur);
    return morceaux.map((p, i) => ({ txt: p, cesure: i < morceaux.length - 1 && p.endsWith("-") }));
  });
  const coupes = unites.map((u) => u.txt);
  const aCesure = unites.some((u) => u.cesure);
  const cesure = fait(dur, coupes, texte);
  if (aCesure) cesure.cesure = true;
  if (tient(cesure)) return cesure;
  // Texte affiché reconstruit À PARTIR DES MOTS (jamais par une expression régulière sur le texte) : un morceau césuré perd son
  // trait d'union ajouté et se recolle au suivant.
  const reconstruit = (u: { txt: string; cesure: boolean }[]): string => {
    const mm: string[] = [];
    let cur = "";
    for (const x of u) {
      if (x.cesure) cur += x.txt.slice(0, -1);
      else {
        mm.push(cur + x.txt);
        cur = "";
      }
    }
    if (cur) mm.push(cur);
    return mm.join(" ").split(NBSP).join(" ");
  };
  const finale = (txt: string) => txt.split(NBSP).join(" ").replace(/[\s,;:.!?»…]+$/u, "");
  for (let k = unites.length; k >= 1; k--) {
    if (unites[k - 1].cesure) continue; // jamais au milieu d'un mot
    const dernier = finale(unites[k - 1].txt);
    if (!dernier) continue;
    const gardees = [...unites.slice(0, k - 1), { txt: dernier + "…", cesure: false }];
    const a = fait(dur, gardees.map((u) => u.txt), reconstruit(gardees));
    a.tronque = true;
    if (aCesure) a.cesure = true;
    if (tient(a)) return a;
  }
  // Dernier recours : JAMAIS « … » seul. On garde le premier mot entier (césuré s'il le faut), même si c'est le plus étroit possible.
  let n1 = 1;
  while (n1 < unites.length && unites[n1 - 1].cesure) n1++;
  const premier = unites.slice(0, n1);
  const dernierP = premier[n1 - 1];
  const garde = [...premier.slice(0, -1), { txt: finale(dernierP.txt) + "…", cesure: false }];
  const a = fait(dur, garde.map((u) => u.txt), reconstruit(garde));
  a.tronque = true;
  if (n1 > 1) a.cesure = true;
  return a;
}

/** Comme `ajuster`, mais JAMAIS sous `mini` px : si le texte entier ne tient pas à `mini` sur `maxL` lignes, il est raccourci à une
 *  FRONTIÈRE DE MOT (« … », `tronque`) en gardant la taille ≥ `mini` (au lieu de rétrécir le texte ou de couper un mot). */
function ajusterMini(s: number, texte: string, cible: number, largeur: number, maxL: number, g: number, mini: number): Ajuste {
  const ok = (a: Ajuste) => !a.cesure && !a.tronque && a.taille >= mini - 0.01;
  const a = ajuster(s, texte, cible, largeur, maxL, g, mini);
  if (ok(a)) return a;
  const mots = texte.split(/\s+/).filter(Boolean);
  for (let k = mots.length - 1; k >= 1; k--) {
    const dernier = mots[k - 1].replace(/[\s,;:.!?»…]+$/u, "");
    if (!dernier) continue;
    const b = ajuster(s, [...mots.slice(0, k - 1), dernier + "…"].join(" "), cible, largeur, maxL, g, mini);
    if (ok(b)) return { ...b, tronque: true, source: texte };
  }
  return a;
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
    lignes: [...f.lignes],
    taillePx: f.taille,
    graisse: o.graisse,
    couleur: o.couleur,
    alignement: centre ? "centre" : "gauche",
    parentId: o.parentId,
    barre: o.barre,
    ...(f.tronque ? { tronque: true as const, texteSource: f.source } : {}),
    ...(f.cesure ? { cesure: true as const } : {}),
  });
}

/** Décale (glissé d'entrée) et estompe un élément. */
function entrer(e: Pose, p: number, dy: number, dx = 0): Pose {
  e.opacite *= p;
  e.rect = { ...e.rect, x: e.rect.x + (1 - p) * dx, y: e.rect.y + (1 - p) * dy };
  return e;
}

/** Réduit un élément (et son texte) autour du point `c` : effet « enfoncé » d'une ligne ou d'un bouton. */
function reduire(e: Pose, c: { x: number; y: number }, f: number): void {
  const r = e.rect;
  e.rect = { x: c.x + (r.x - c.x) * f, y: c.y + (r.y - c.y) * f, largeur: r.largeur * f, hauteur: r.hauteur * f };
  if (e.taillePx) e.taillePx *= f;
}

/** Courbe d'un enfoncement : descente en `dMs`, tenue `tenueMs`, remontée en `uMs` (0 après, `Infinity` = reste enfoncé). */
function enfoncement(t: number, dMs: number, tenueMs: number, uMs: number): number {
  if (t <= 0) return 0;
  if (t < dMs) return t / dMs;
  if (t <= dMs + tenueMs) return 1;
  if (!Number.isFinite(tenueMs)) return 1;
  return Math.max(0, 1 - (t - dMs - tenueMs) / uMs);
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

/** Arc qui reste TOUJOURS au-dessous de la plus basse des deux extrémités (point de contrôle sous les deux) : le curseur arrive
 *  par en dessous et ne passe jamais sur un texte placé au-dessus de la cible. */
function arcBas(a: { x: number; y: number }, b: { x: number; y: number }, u: number, creux: number): { x: number; y: number } {
  const cx = (a.x + b.x) / 2;
  const cy = Math.max(a.y, b.y) + creux;
  const v = 1 - u;
  return { x: v * v * a.x + 2 * v * u * cx + u * u * b.x, y: v * v * a.y + 2 * v * u * cy + u * u * b.y };
}

/** Ajoute un curseur (et son anneau de clic) : trajet en arc depuis `dep`, arrivée EXACTE au clic, puis il reste `tenueMs`. */
function poserCurseur(add: (p: Ajout) => Pose, s: number, T: number, dep: number, clicAMs: number, depart: { x: number; y: number }, arrivee: { x: number; y: number }, cibleId: string, tenueMs: number, creux?: number, opt?: { droit?: boolean; opaque?: boolean }): void {
  // Vitesse JAMAIS nulle avant le clic : moitié linéaire, moitié douce (le curseur n'attend jamais dans un coin).
  const duree = Math.max(200, clicAMs - dep);
  const u = 0.5 * avancement(T, dep, duree, (x) => borne(x, 0, 1)) + 0.5 * avancement(T, dep, duree, adoucir);
  // `opaque` : le curseur entre à PLEINE opacité (jamais de fantôme translucide qui traverse le vide).
  const entree = opt?.opaque ? (T >= dep ? 1 : 0) : avancement(T, dep, 250);
  const sortie = 1 - avancement(T, clicAMs + tenueMs, 300, adoucir);
  const o = entree * sortie;
  if (o <= 0.001) return;
  const pt = opt?.droit ? { x: depart.x + (arrivee.x - depart.x) * u, y: depart.y + (arrivee.y - depart.y) * u } : creux !== undefined ? arcBas(depart, arrivee, u, creux) : arc(depart, arrivee, u);
  const q = (T - clicAMs) / DUREES_MS.clic;
  add({
    id: "curseur",
    genre: "curseur",
    rect: { x: pt.x, y: pt.y, largeur: 34 * s, hauteur: 50 * s },
    opacite: o,
    pointe: pt,
    anneauClic: q > 0 && q <= 1 ? q : 0,
    cibleId,
  });
}

/** Reflet qui parcourt un filet terracotta ENTIÈREMENT tracé (aller-retour doux, 1,8 s) : le filet « vit » tant que la scène dure.
 *  `progression` = position du reflet (0..1) ; l'opacité varie avec elle (changement visible à chaque instant). */
function refletFilet(add: (p: Ajout) => Pose, id: string, T: number, t0: number, r: RectPx, trace: number): void {
  if (trace < 1 || T < t0) return;
  const pos = 0.5 - 0.5 * Math.cos((2 * Math.PI * (T - t0)) / 1800);
  const w = r.largeur * 0.2;
  add({ id, genre: "forme", rect: { x: r.x + (r.largeur - w) * pos, y: r.y, largeur: w, hauteur: r.hauteur }, opacite: 0.5 + 0.3 * pos, remplissage: "blanc", rayonPx: r.hauteur / 2, progression: pos });
}

/** Horloge (tour 9) : la petite aiguille (heures) est FIXE à 300° (10 h) ; `progression` = angle de la grande aiguille (0 = midi).
 *  Les deux partent du centre et se lisent comme un chevron : la grande aiguille reste TOUJOURS à ≥ 60° de la petite.
 *  PETITES icônes statiques (≤ 48 px) : 0,25 tour (90°, 3 h : jamais un « ✓ »). */
const HORLOGE_FIXE = 0.25;

/** Plage de la grande aiguille d'une GRANDE horloge qui travaille : de 0,02 à 0,28 tour (7° → 101°), d'un mouvement régulier et sans retour,
 *  réparti sur la durée de la scène (jamais immobile) ; écart à la petite aiguille (300°) entre 67° et 159° : toujours ≥ 60°, jamais une droite. */
const HORLOGE_DEBUT = 0.02;
const HORLOGE_PLAGE = 0.26;
const aiguilleTournante = (dtMs: number, dureeMs: number): number => HORLOGE_DEBUT + HORLOGE_PLAGE * borne(dtMs / Math.max(1000, dureeMs), 0, 1);

/* ------------------------------------------------------------------ */
/* Scène « titre »                                                      */
/* ------------------------------------------------------------------ */

function sceneTitre(c: Ctx, sc: Extract<SceneSansVoix, { genre: "titre" }>): Pose[] {
  const { T, s, U, C, pf } = c;
  const { els, add } = nouveau();
  const a0 = sc.debutMs;
  const L = U.largeur * 0.96;
  const x0 = U.x + (U.largeur - L) / 2;
  // ACCROCHE : la QUESTION (surtitre) vient en PREMIER et en GRAND (≥ 64 px ExtraBold) ; la phrase titre vient ensuite, plus petite (≥ 48 px).
  const g1 = 12 * s;
  const g2 = 24 * s;
  const g3 = 28 * s;
  const filetH = 8 * s;
  // Carte de la liste : ≥ 85 % de la largeur du contenu ET jusqu'en bas du contenu (au reste près : marge de caméra / glissé).
  const bas = U.y + U.hauteur - 6 * s;
  const padI = 20 * s;
  const gapI = 10 * s;
  const rhMin = 30 * s;
  const illMin = 2 * padI + 5 * rhMin + 4 * gapI;
  // La question rétrécit (72 → 64 px) et le titre (56 → 48 px) tant que la carte de ≥ 5 lignes ne tient pas dessous ; sinon la carte saute.
  let sur = sc.surTitre ? ajuster(s, sc.surTitre, 72 * s, L, 3, 800, 64 * s) : null;
  let ti = ajuster(s, sc.texte, 56 * s, L, 3, 800, 48 * s);
  let illH = 0;
  for (let k = 0; ; k++) {
    sur = sc.surTitre ? ajuster(s, sc.surTitre, Math.max(64, 72 - 2 * k) * s, L, 3, 800, 64 * s) : null;
    ti = ajuster(s, sc.texte, Math.max(48, 56 - 2 * k) * s, L, 3, 800, 48 * s);
    // La question n'est JAMAIS plus petite que le titre : si elle tombe sous 64 px, le titre est plafonné à sa taille.
    if (sur && ti.taille > sur.taille) ti = ajuster(s, sc.texte, sur.taille, L, 3, 800, Math.min(48 * s, sur.taille));
    const autres = (sur ? sur.h + g1 : 0) + ti.h + g2 + filetH;
    illH = bas - U.y - autres - g3;
    if (illH >= illMin || k >= 8) break;
  }
  if (illH < illMin) illH = 0;
  const autres = (sur ? sur.h + g1 : 0) + ti.h + g2 + filetH;
  let y = illH ? U.y : U.y + (U.hauteur - autres) / 2;

  if (sur) {
    entrer(poserTexte(add, "sur-titre", sur, x0, y, L, { graisse: 800, couleur: "terracotta", alignement: "centre" }), Math.max(pf, avancement(T, a0, 350)), 16 * s);
    y += sur.h + g1;
  }
  entrer(poserTexte(add, "titre", ti, x0, y, L, { graisse: 800, couleur: "noir", alignement: "centre" }), sur ? avancement(T, a0 + 450, 450) : Math.max(pf, avancement(T, a0 + 60, 450)), 16 * s);
  y += ti.h + g2;
  const fl = Math.min(260 * s, L * 0.5);
  const q = avancement(T, a0 + 350, 650, adoucir);
  add({ id: "filet", genre: "forme", rect: { x: x0 + (L - fl) / 2, y, largeur: fl * q, hauteur: filetH }, opacite: q > 0 ? 1 : 0, remplissage: "terracotta", rayonPx: filetH / 2, progression: q });
  refletFilet(add, "filet/reflet", T, a0 + 1000, { x: x0 + (L - fl) / 2, y, largeur: fl, hauteur: filetH }, q);
  y += filetH + g3;

  if (illH) {
    // Carte LARGE (≥ 85 % du contenu) qui descend jusqu'au bas du contenu : 5 à 7 grandes lignes qui se cochent et se barrent une à une.
    const cw = 0.951 * C.largeur;
    const cx = C.x + (C.largeur - cw) / 2;
    const pe = Math.max(pf, avancement(T, a0 + 200, 550));
    const n = Math.max(5, Math.min(7, Math.floor((illH - 2 * padI + gapI) / (92 * s + gapI))));
    const rh = (illH - 2 * padI - (n - 1) * gapI) / n;
    entrer(add({ id: "pile", genre: "forme", rect: { x: cx, y, largeur: cw, hauteur: illH }, remplissage: "blanc", contour: "gris", rayonPx: 28 * s, ombre: true }), pe, 20 * s);
    const hor = Math.min(0.2 * cw, 140 * s, illH - 2 * padI);
    // Horloge à droite, au milieu de la carte : l'aiguille avance de 0 à 0,35 tour, jamais alignée sur une aiguille fixe.
    entrer(add({ id: "pile/horloge", genre: "forme", rect: { x: cx + cw - padI - hor, y: y + (illH - hor) / 2, largeur: hor, hauteur: hor }, icone: "horloge", couleur: "terracotta", progression: aiguilleTournante(T - a0, sc.finMs - a0), parentId: "pile" }), pe, 20 * s);
    const largs = [0.78, 0.62, 0.7, 0.5, 0.66, 0.56, 0.72];
    for (let k = 0; k < n; k++) {
      const ry = y + padI + k * (rh + gapI);
      const ak = a0 + 300 + k * 120;
      const p = Math.max(pf, avancement(T, ak, 400));
      const bw = (cw - 2 * padI - rh - 18 * s - hor - 40 * s) * largs[k % largs.length];
      entrer(add({ id: `pile/case-${k + 1}`, genre: "forme", rect: { x: cx + padI, y: ry, largeur: rh, hauteur: rh }, contour: "grisTexte", rayonPx: 10 * s, parentId: "pile" }), p, 14 * s);
      entrer(add({ id: `pile/barre-${k + 1}`, genre: "forme", rect: { x: cx + padI + rh + 18 * s, y: ry + rh * 0.2, largeur: bw, hauteur: rh * 0.6 }, opacite: 0.3, remplissage: "grisTexte", rayonPx: rh * 0.3, parentId: "pile" }), p, 14 * s);
      const qs = avancement(T, a0 + 900 + k * 340, 450, adoucir);
      // La case se COCHE (carré terracotta qui grandit) quand son trait a fini de la barrer : la liste « se fait » toute seule.
      const qc = avancement(T, a0 + 900 + k * 340 + 380, 320, adoucir);
      if (qc > 0) {
        const ci = rh * 0.3 * qc;
        add({ id: `pile/coche-${k + 1}`, genre: "forme", rect: { x: cx + padI + rh / 2 - ci, y: ry + rh / 2 - ci, largeur: 2 * ci, hauteur: 2 * ci }, remplissage: "terracotta", rayonPx: 4 * s, progression: qc, parentId: "pile" });
      }
      add({ id: `pile/trait-${k + 1}`, genre: "forme", rect: { x: cx + padI + rh + 12 * s, y: ry + rh / 2 - 2.5 * s, largeur: (bw + 12 * s) * qs, hauteur: 5 * s }, opacite: qs > 0 ? 1 : 0, remplissage: k === n - 1 ? "terracotta" : "grisTexte", rayonPx: 2.5 * s, progression: qs, parentId: "pile" });
    }
  }
  return els;
}

/* ------------------------------------------------------------------ */
/* Fenêtre / carte pleine (écran, repère)                               */
/* ------------------------------------------------------------------ */

/** Rectangle de la fenêtre (et de la carte du repère) : ≥ 95 % de la largeur et ≥ 90 % de la hauteur du contenu. */
function fenetreDe(C: RectPx): RectPx {
  return { x: C.x + 0.0245 * C.largeur, y: C.y + 0.0475 * C.hauteur, largeur: 0.951 * C.largeur, hauteur: 0.905 * C.hauteur };
}

/* ------------------------------------------------------------------ */
/* Scène « repère » : carte avant / après                                */
/* ------------------------------------------------------------------ */

function sceneRepere(c: Ctx, sc: Extract<SceneSansVoix, { genre: "repere" }>): Pose[] {
  const { T, s, C, pf } = c;
  const { els, add } = nouveau();
  const a0 = sc.debutMs + DUREES_MS.sortieScene;
  const K = fenetreDe(C);
  const pad = 40 * s;
  const Lw = K.largeur - 2 * pad;
  const filetH = 8 * s;
  const marge = 30 * s;
  const dispo = (K.hauteur - 2 * pad) / 1.06 - marge;
  // Le contenu OCCUPE ≥ 75 % de la hauteur de la carte (texte centré verticalement) : textes de 104 / 156 px sur UNE ligne si possible
  // (deux sinon), horloge qui prend le reste (160 px minimum), puis le surplus d'espace va aux intervalles.
  const LwT = Lw / 1.07;
  const un = (txt: string, cible: number, g = 800) => {
    const a = ajuster(s, txt, cible, LwT, 1, g, 64 * s);
    return a.taille >= 0.72 * cible && !a.tronque && !a.cesure ? a : ajuster(s, txt, cible, LwT, 2, g, 64 * s);
  };
  const gMin = [26 * s, 34 * s, 28 * s];
  let f = 1;
  let av = un(sc.avant, 104 * s);
  let ap = un(sc.apres, 156 * s);
  const hMin = 160 * s;
  const pile = (h: number) => (h > 0 ? h + gMin[0] : 0) + av.h + gMin[1] + ap.h + gMin[2] + filetH;
  while (pile(hMin) > dispo && f > 0.45) {
    f -= 0.05;
    av = un(sc.avant, 104 * s * f);
    ap = un(sc.apres, 156 * s * f);
  }
  const avecHorloge = pile(hMin) <= dispo;
  const cible = Math.min(0.8 * K.hauteur / 1.06, dispo);
  const horl = avecHorloge ? borne(cible - pile(0) - gMin[0], hMin, Math.max(hMin, Math.min(0.32 * K.hauteur, dispo - pile(0) - gMin[0]))) : 0;
  const base = pile(horl);
  const surplus = Math.max(0, Math.min(cible, dispo) - base);
  const nGaps = avecHorloge ? 3 : 2;
  const g = [gMin[0] + (avecHorloge ? surplus / nGaps : 0), gMin[1] + surplus / nGaps, gMin[2] + surplus / nGaps];
  const pc = Math.max(pf, avancement(T, a0, 200));
  // L'ORDRE SUIT LE TEMPS : le premier groupe prononcé (« une minute ») est là DÈS L'ENTRÉE de la carte (≤ 150 ms) ; l'autre (« une
  // heure », barré aussitôt) arrive à SON instant, au moins 400 ms après le premier. la place du second est RÉSERVÉE dès
  // le début (bloc centré avec ses positions finales, rien ne bouge à son arrivée).
  const avantD = sc.barreAMs <= sc.apresAMs;
  const tPrem = a0;
  const tSec = Math.max(Math.max(sc.barreAMs, sc.apresAMs), tPrem + 400);
  const tAv = avantD ? tPrem : tSec;
  const tAp = avantD ? tSec : tPrem;
  // PLACES RÉSERVÉES dès l'entrée (tour 9) : le bloc est posé à ses positions FINALES, « une minute » à sa place ; « une heure » (au-dessus)
  // apparaît SUR PLACE (fondu + légère descente ≤ 12 px) sans jamais traverser un autre texte.
  const hAv = av.h + g[1];
  const hAp = ap.h + g[2];
  const total = (avecHorloge ? horl + g[0] : 0) + hAv + hAp + filetH;
  let y = K.y + (K.hauteur - total) / 2;
  entrer(add({ id: "carte", genre: "forme", rect: { ...K }, remplissage: "blanc", contour: "gris", rayonPx: 32 * s, ombre: true }), pc, 8 * s);
  if (avecHorloge) {
    const ph = Math.max(pf, avancement(T, a0, 200));
    // L'aiguille avance en continu (de 0 à 0,35 tour sur la scène), dès l'apparition de la carte.
    const tour = aiguilleTournante(T - a0, sc.finMs - a0);
    entrer(add({ id: "carte/horloge", genre: "forme", rect: { x: K.x + (K.largeur - horl) / 2, y, largeur: horl, hauteur: horl }, icone: "horloge", couleur: "terracotta", progression: tour, parentId: "carte" }), ph, 12 * s);
    y += horl + g[0];
  }
  const x0 = K.x + pad;
  const pAv = avancement(T, tAv, avantD ? 120 : 260);
  if (pAv > 0) entrer(poserTexte(add, "avant", av, x0, y, Lw, { graisse: 800, couleur: "grisTexte", alignement: "centre", barre: avancement(T, tAv + 150, 550, adoucir), parentId: "carte" }), pAv, -10 * s);
  y += hAv;
  const pAp = avancement(T, tAp, avantD ? 260 : 120);
  if (pAp > 0) entrer(poserTexte(add, "apres", ap, x0, y, Lw, { graisse: 800, couleur: "noir", alignement: "centre", parentId: "carte" }), pAp, -10 * s);
  y += hAp;
  const fl = Math.min(300 * s, Lw * 0.5);
  // Le filet terracotta se trace dès que « une minute » est là, sans attendre la fin de la scène.
  const q = avancement(T, tAp + 350, 650, adoucir);
  add({ id: "carte/filet", genre: "forme", rect: { x: K.x + (K.largeur - fl) / 2, y, largeur: fl * q, hauteur: filetH }, opacite: q > 0 ? 1 : 0, remplissage: "terracotta", rayonPx: filetH / 2, progression: q, parentId: "carte" });
  refletFilet(add, "carte/filet/reflet", T, tAp + 1000, { x: K.x + (K.largeur - fl) / 2, y, largeur: fl, hauteur: filetH }, q);
  // Mouvement CONTINU sur toute la scène : le contenu de la carte grossit de 1 à 1,06 (la carte reste fixe) ; l'aiguille tourne.
  const zoom = 1 + 0.06 * avancement(T, a0, Math.max(1000, sc.finMs - a0), (x) => borne(x, 0, 1));
  const centre = { x: K.x + K.largeur / 2, y: K.y + K.hauteur / 2 };
  for (const e of els) if (e.id !== "carte") reduire(e, centre, zoom);
  return els;
}

/* ------------------------------------------------------------------ */
/* Scène « appel » (question + bouton cliqué)                           */
/* ------------------------------------------------------------------ */

function sceneAppel(c: Ctx, sc: Extract<SceneSansVoix, { genre: "appel" }>): Pose[] {
  const { T, s, U, C, pf } = c;
  const { els, add } = nouveau();
  const a0 = sc.debutMs + DUREES_MS.sortieScene;
  const L = U.largeur * 0.96;
  const x0 = U.x + (U.largeur - L) / 2;
  const ruleH = 8 * s;
  // Le groupe (question, bouton, marque + filet, site) est AGRANDI jusqu'à occuper ≥ 70 % de la hauteur du contenu : on retient le plus
  // grand facteur `f` (≤ 1,5) dont la pile tient ; le surplus éventuel va aux intervalles. Minimums : question ≥ 64 px, bouton ≥ 60 px,
  // marque ≥ 56 px, site ≥ 40 px (jamais en dessous, `ajuster` ne descend que si le texte ne tient vraiment pas).
  const compose = (f: number) => {
    const qu = sc.question ? ajuster(s, sc.question, 78 * f * s, L, 2, 800, 64 * s) : null;
    // Texte du bouton sur UNE ligne si possible (≥ 60 px), sur deux sinon.
    const wb = L - 150 * s;
    let bt = ajuster(s, sc.bouton, 66 * f * s, wb, 1, 700, 60 * s);
    if (bt.tronque || bt.cesure || bt.taille < 60 * s - 0.01) bt = ajuster(s, sc.bouton, 66 * f * s, wb, 2, 700, 60 * s);
    const mq = sc.marque ? ajuster(s, sc.marque, 80 * f * s, L, 1, 800, (C.hauteur < 760 * s ? 56 : 72) * s) : null;
    const si = sc.site ? ajuster(s, sc.site, 46 * f * s, L, 2, 600, 40 * s) : null;
    // Bouton assez haut pour que la pointe, à ≈ 30 % du bas, reste SOUS le texte.
    const bh = Math.max(156 * s * Math.min(f, 1.2), 2.5 * bt.h + 20 * s);
    const bw = borne(bt.w + 140 * s * Math.min(f, 1.2), 600 * s, U.largeur * 0.96);
    const gaps = { q: 74 * f * s, m: (mq ? 52 : 50) * f * s, r: 14 * f * s, si: 32 * f * s };
    const hauteur = (extra = 0) =>
      (qu ? qu.h + gaps.q + extra : 0) + bh + (mq ? gaps.m + extra + mq.h + gaps.r + ruleH : 0) + (si ? (mq ? gaps.si : gaps.m) + extra + si.h : 0);
    return { qu, bt, mq, si, bh, bw, gaps, hauteur };
  };
  const plafond = U.hauteur;
  let L1 = compose(1.5);
  for (let f = 1.5; f >= 0.4 - 1e-9; f -= 0.05) {
    L1 = compose(f);
    if (L1.hauteur() <= plafond) break;
  }
  const { qu, bt, mq, si, bh, bw, gaps } = L1;
  // Surplus : la pile atteint ≥ 72 % du contenu (par ses intervalles) si elle ne l'atteint pas déjà par ses tailles.
  const nIntervalles = (qu ? 1 : 0) + (mq ? 1 : 0) + (si ? 1 : 0);
  const manque = Math.max(0, plafond - L1.hauteur());
  const extra = nIntervalles ? Math.min(manque / nIntervalles, 130 * s) : 0;
  const total = L1.hauteur(extra);
  // Centre OPTIQUE : légèrement au-dessus du milieu du contenu (47 %).
  let y = C.y + 0.47 * C.hauteur - total / 2;
  y = borne(y, U.y, Math.max(U.y, U.y + U.hauteur - total));
  const gq = gaps.q + extra;
  if (qu) {
    entrer(poserTexte(add, "question", qu, x0, y, L, { graisse: 800, couleur: "noir", alignement: "centre" }), Math.max(pf, avancement(T, a0, 200)), 16 * s);
    y += qu.h + gq;
  }
  const bx = U.x + (U.largeur - bw) / 2;
  const pb = Math.max(pf, avancement(T, a0 + (qu ? 20 : 0), 220));
  // Le clic arrive TÔT : à ≈ 1,5 s du début de la scène (ou à `clicAMs` s'il est plus tôt), jamais avant que le bouton soit là.
  const tc = Math.max(a0 + 300, Math.min(sc.clicAMs, sc.debutMs + 1500));
  // Survol : le bouton s'éclaircit légèrement 300 ms avant le clic. Clic : il s'enfonce (0,96) et RESTE enfoncé, puis « respire »
  // doucement (0,96 → 0,975) jusqu'à la fin de la scène : l'image ne se fige jamais.
  const survol = avancement(T, tc - 300, 200, adoucir);
  const apres = Math.max(0, T - tc - 600);
  const respire = apres > 0 ? 0.015 * (0.5 - 0.5 * Math.cos((2 * Math.PI * apres) / 1600)) : 0;
  const f = 1 - 0.04 * enfoncement(T - tc, 120, Infinity, 1) + respire;
  const centre = { x: bx + bw / 2, y: y + bh / 2 };
  const bouton = entrer(add({ id: "bouton", genre: "forme", rect: { x: bx, y, largeur: bw, hauteur: bh }, remplissage: "terracotta", rayonPx: bh / 2, ombre: true }), pb, 24 * s);
  const voile = survol > 0.001 ? entrer(add({ id: "bouton/survol", genre: "forme", rect: { x: bx, y, largeur: bw, hauteur: bh }, opacite: 0.09 * survol, remplissage: "blanc", rayonPx: bh / 2, parentId: "bouton" }), pb, 24 * s) : null;
  const texte = entrer(poserTexte(add, "bouton/texte", bt, bx, y + (bh - bt.h) / 2, bw, { graisse: 700, couleur: "ivoire", alignement: "centre", parentId: "bouton" }), pb, 24 * s);
  const cibleR = { x: bx, y, largeur: bw, hauteur: bh };
  add({ id: "bouton/cible", genre: "cible", rect: cibleR });
  const cy = (1 - pb) * 24 * s;
  reduire(bouton, { x: centre.x, y: centre.y + cy }, f);
  if (voile) reduire(voile, { x: centre.x, y: centre.y + cy }, f);
  reduire(texte, { x: centre.x, y: centre.y + cy }, f);
  // Anneau terracotta : il part du bouton au clic (s'élargit de 6 à 22 px en s'effaçant), puis un halo discret respire autour.
  const q = (T - tc) / DUREES_MS.clic;
  if (q > 0 && q <= 1) add({ id: "anneau", genre: "forme", rect: rectEnveloppe(bouton.rect, (6 + 16 * adoucir(q)) * s), opacite: 0.9 * (1 - q), contour: "terracotta", rayonPx: bh / 2 + 22 * s });
  else if (q > 1) add({ id: "halo", genre: "forme", rect: rectEnveloppe(bouton.rect, 8 * s), opacite: 0.3 + 0.2 * Math.sin((2 * Math.PI * (T - tc - DUREES_MS.clic)) / 1600), contour: "terracotta", rayonPx: bh / 2 + 8 * s });
  // Avant le clic, le halo respire déjà (le bouton « attend » : l'image vit même sans curseur à l'écran).
  else if (q <= 0 && pb > 0.5) add({ id: "halo", genre: "forme", rect: rectEnveloppe(bouton.rect, 8 * s), opacite: pb * (0.18 + 0.12 * Math.sin((2 * Math.PI * (T - a0)) / 1600)), contour: "terracotta", rayonPx: bh / 2 + 8 * s });
  // DÈS L'ENTRÉE de la scène (≤ 600 ms après la question) : la MARQUE (ExtraBold noir) avec son filet terracotta dessous, puis le SITE (noir).
  let yb = y + bh;
  if (mq) {
    yb += gaps.m + extra;
    const pm = Math.max(0, avancement(T, a0 + 150, 300));
    const marqueEl = entrer(poserTexte(add, "marque", mq, x0, yb, L, { graisse: 800, couleur: "noir", alignement: "centre", opacite: 1 }), pm, 12 * s);
    // Tour 10 : après le clic la marque GRANDIT doucement (1 → 1,04, en 600 ms) puis respire : les 4 dernières secondes ne sont pas figées.
    const gm = 1 + 0.04 * avancement(T, tc + 250, 600, adoucir) + (T > tc + 850 ? 0.008 * (0.5 - 0.5 * Math.cos((2 * Math.PI * (T - tc - 850)) / 2400)) : 0);
    const ancre = { x: x0 + L / 2, y: yb + mq.h / 2 };
    reduire(marqueEl, ancre, gm);
    yb += mq.h + gaps.r;
    const fl = Math.min(260 * s, Math.max(120 * s, mq.w * 0.7));
    const qf = avancement(T, a0 + 350, 600, adoucir);
    add({ id: "marque/filet", genre: "forme", rect: { x: U.x + (U.largeur - fl * gm) / 2, y: yb + (1 - pm) * 12 * s, largeur: fl * qf * gm, hauteur: ruleH }, opacite: qf > 0 ? 1 : 0, remplissage: "terracotta", rayonPx: ruleH / 2, progression: qf });
    yb += ruleH;
  }
  if (si) {
    yb += (mq ? gaps.si : gaps.m) + extra;
    const ps = Math.max(0, avancement(T, a0 + (mq ? 300 : 150), 300));
    entrer(poserTexte(add, "site", si, x0, yb, L, { graisse: 600, couleur: "noir", alignement: "centre", opacite: 1 }), ps, 12 * s);
  }
  // Le curseur ENTRE par le bord du cadre du contenu (à pleine opacité, jamais un fantôme translucide), droit vers le BAS-CENTRE du
  // bouton (≈ 30 % de sa hauteur depuis le bas : sous le texte, dans la pilule) : il y arrive par en dessous du texte.
  const bas = y + (bh + bt.h) / 2;
  const reste = Math.min(0.3 * bh, (bh - bt.h) / 2 - 4 * s);
  const arrivee = { x: bx + bw / 2, y: Math.max(bas + 12 * s, y + bh - reste) };
  const dep = Math.max(a0, tc - 1100);
  // Le départ reste DANS le contenu (le curseur mesure 50 px de haut) : jamais d'entrée par un bord hors cadre.
  const departAppel = { x: C.x + C.largeur - 66 * s, y: Math.min(arrivee.y + 60 * s, C.y + C.hauteur - 78 * s) };
  // Tour 10 : après le clic le curseur s'efface (≤ 400 ms : 100 ms de tenue, 300 ms de fondu) ; la marque prend alors le relais.
  poserCurseur(add, s, T, dep, tc, departAppel, arrivee, "bouton/cible", 100, undefined, { droit: true, opaque: true });
  // Anneau de clic À LA POINTE du curseur (ivoire sur le terracotta du bouton) : il s'élargit de 10 à 34 px en 500 ms en s'effaçant ;
  // le curseur reste ensuite immobile (le bouton, lui, respire).
  const qp = (T - tc) / DUREES_MS.clic;
  if (qp > 0 && qp <= 1) {
    const r = (10 + 24 * adoucir(qp)) * s;
    add({ id: "anneau-pointe", genre: "forme", rect: { x: arrivee.x - r, y: arrivee.y - r, largeur: 2 * r, hauteur: 2 * r }, opacite: 0.95 * (1 - qp), contour: "ivoire", rayonPx: r });
  }
  return els;
}

/* ------------------------------------------------------------------ */
/* Scène « carte-phrase » (repli générique)                             */
/* ------------------------------------------------------------------ */

function sceneCartePhrase(c: Ctx, sc: Extract<SceneSansVoix, { genre: "carte-phrase" }>): Pose[] {
  const { T, s, U, pf } = c;
  const { els, add } = nouveau();
  const a0 = sc.debutMs + DUREES_MS.sortieScene;
  const pad = 56 * s;
  const f = ajuster(s, sc.texte, 68 * s, U.largeur - 2 * pad, 3, 800, 56 * s);
  const filetH = 10 * s;
  const padV = Math.min(pad, Math.max(20 * s, (U.hauteur - 70 * s - f.h - filetH - 28 * s) / 2));
  const h = Math.min(U.hauteur - 70 * s, f.h + 2 * padV + filetH + 28 * s);
  const y = U.y + (U.hauteur - h) / 2;
  const p = Math.max(pf, avancement(T, a0, 220));
  entrer(add({ id: "carte", genre: "forme", rect: { x: U.x, y, largeur: U.largeur, hauteur: h }, remplissage: "blanc", contour: "gris", rayonPx: 32 * s, ombre: true }), p, 24 * s);
  const q = avancement(T, a0 + 100, 500, adoucir);
  add({ id: "carte/filet", genre: "forme", rect: { x: U.x + pad, y: y + padV, largeur: 120 * s * q, hauteur: filetH }, opacite: q > 0 ? 1 : 0, remplissage: "terracotta", rayonPx: filetH / 2, progression: q, parentId: "carte" });
  entrer(poserTexte(add, "carte/texte", f, U.x + pad, y + padV + filetH + 28 * s, U.largeur - 2 * pad, { graisse: 800, couleur: "noir", parentId: "carte" }), Math.max(pf, avancement(T, a0, 220)), 16 * s);
  return els;
}

/* ------------------------------------------------------------------ */
/* Scène « écran » : la fenêtre qui se construit                        */
/* ------------------------------------------------------------------ */

const HAUTEURS_COLONNES = [
  [0.5, 0.65, 0.6, 0.8, 0.7, 0.95],
  [0.9, 0.7, 0.8, 0.55, 0.6, 0.4],
  [0.95, 0.8, 0.7, 0.55, 0.45, 0.35],
];

/** Colonnes de mini-graphique (squelette) par carte : elles se posent une à une dans les creux entre deux mots. */
const COLONNES_CARTE = 7;
const HAUTEURS_CARTE = [0.5, 0.65, 0.55, 0.8, 0.6, 0.95, 0.7, 0.85, 0.5, 0.75];

/** Mini-graphiques DIFFÉRENTS d'une carte à l'autre (tour 9) : une série (forme et graine) par carte, lue en boucle par la colonne qui glisse. */
const SERIES_CARTES: number[][] = [
  [0.4, 0.5, 0.45, 0.62, 0.55, 0.7, 0.66, 0.82, 0.76, 0.95], // stock : montée en escalier
  [0.95, 0.8, 0.86, 0.62, 0.7, 0.48, 0.55, 0.36, 0.42, 0.3], // seuil : descente vers la ligne
  [0.5, 0.82, 0.38, 0.9, 0.45, 0.74, 0.3, 0.86, 0.55, 0.68], // valeur : en dents de scie
  [0.6, 0.6, 0.85, 0.85, 0.45, 0.45, 0.7, 0.7, 0.35, 0.95], // 4e carte : en paliers
];

/** Pictogrammes des cartes-chiffres, choisis de façon DÉTERMINISTE par mots-clés du libellé (seuil / valeur d'abord, car plus précis que
 *  « article » : « Articles sous le seuil » est un seuil) ; sinon boite / seuil / valeur selon l'index. Deux cartes ne portent jamais le
 *  même pictogramme tant qu'il en reste un de libre. */
const PICTOS_CARTES = ["boite", "seuil", "valeur"] as const;
type PictoCarte = (typeof PICTOS_CARTES)[number];
export function pictogrammesCartes(libelles: string[]): PictoCarte[] {
  const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const choix: PictoCarte[] = libelles.map((l, k) => {
    const t = norm(l);
    if (/seuil|alerte|rupture/.test(t)) return "seuil";
    if (/valeur|total|montant|chiffre d.affaires/.test(t)) return "valeur";
    if (/stock|article/.test(t)) return "boite";
    return PICTOS_CARTES[k % PICTOS_CARTES.length];
  });
  const pris = new Set<PictoCarte>();
  return choix.map((c) => {
    if (!pris.has(c)) {
      pris.add(c);
      return c;
    }
    const libre = PICTOS_CARTES.find((x) => !pris.has(x));
    if (libre) {
      pris.add(libre);
      return libre;
    }
    return c;
  });
}

/** Groupe d'un élément de l'écran (pour l'atténuation d'un `focus`) ; `null` = jamais atténué (coque de la fenêtre). */
function groupeDe(id: string): "cartes" | "liste" | "panneau" | "alerte" | null {
  if (id.startsWith("carte-") || id === "pulse-carte") return "cartes";
  if (id === "liste" || id.startsWith("liste/") || id.startsWith("rang-") || id.startsWith("ligne-1")) return "liste";
  if (id === "panneau" || id.startsWith("panneau/")) return "panneau";
  if (id === "alerte" || id === "halo-alerte" || id.startsWith("alerte/")) return "alerte";
  return null;
}

function sceneEcran(c: Ctx, sc: Extract<SceneSansVoix, { genre: "ecran" }>): Pose[] {
  const { T, s, C, pf } = c;
  const { els, add } = nouveau();
  const ev = sc.evenements;
  const W = fenetreDe(C);
  const compact = C.hauteur < 760 * s; // 1:1 et 16:9 : fenêtre moins haute, marges resserrées
  let barH = Math.round((compact ? 64 : 92) * s);
  const P = Math.round((compact ? 8 : 18) * s);
  const g = Math.round(14 * s);
  const g2 = Math.round((compact ? 8 : 16) * s);
  // La barre de titre : points, titre, et la place du TOAST d'alerte. Le TITRE reste TOUJOURS visible (jamais de barre vide) et le
  // toast ne recouvre aucun texte. Deux dispositions : (1) à droite du titre, sur UNE ligne ; (2) à droite du titre sur DEUX lignes
  // (36 px minimum, texte raccourci à une frontière de mot au-delà), la barre grandissant d'autant. La mise en page est calculée une fois pour toutes (la barre
  // ne change pas de taille pendant la vidéo : rien ne saute à l'arrivée du toast).
  const tx = W.x + 24 * s + 3 * 26 * s + 16 * s;
  const evAlerte = trouver(sc.evenements, "alerte");
  // Place de la barre à droite du titre (jusqu'à 20 px du bord de la carte). Avec une alerte, la place du TOAST est RÉSERVÉE d'abord : sa largeur
  // naturelle (une ligne), bornée entre 40 % et 55 % de la place (davantage seulement si un mot du toast l'exige : jamais coupé au milieu d'un mot) ;
  // le TITRE est ajusté dans le reste (raccourci à une frontière de mot si besoin), jamais le toast.
  const espace = W.x + W.largeur - 20 * s - tx;
  const padT = 12 * s;
  const fixeT = 2 * padT + 40 * s + 10 * s; // marges, cloche (44 px), intervalle (plus de pastille orpheline en bout de toast)
  let reserve = 0;
  if (evAlerte) {
    const naturel = ajuster(s, evAlerte.texte, 44 * s, 100 * espace, 1, 600, 40 * s).w + fixeT;
    const motLong = Math.max(...jetons(evAlerte.texte).map((m) => larg(m, 40 * s, 600))) + fixeT;
    // Le TITRE garde sa largeur naturelle (40 px) ; le toast reçoit le reste (au plus sa largeur d'une ligne, au moins son plus long mot).
    const titreNat = ajuster(s, sc.titreFenetre, 40 * s, 100 * espace, 1, 700, 40 * s).w;
    // Largeur minimale pour afficher le toast COMPLET sur deux lignes à ≥ 40 px (le titre est raccourci avant le toast).
    let w2 = motLong;
    while (w2 < naturel) {
      const a = ajuster(s, evAlerte.texte, 40 * s, w2 - fixeT, 2, 600, 40 * s);
      if (!a.tronque && !a.cesure && a.taille >= 40 * s - 0.01) break;
      w2 += 6 * s;
    }
    reserve = Math.min(0.7 * espace, Math.max(w2, Math.min(naturel, espace - 26 * s - titreNat)));
  }
  const tf = ajusterMini(s, sc.titreFenetre, (evAlerte ? 40 : 44) * s, Math.max(60 * s, espace - (evAlerte ? 26 * s + reserve : 8 * s)), 1, 700, 40 * s);
  let toast: { bt: Ajuste; bw: number; bh: number; pad: number; padV: number; ico: number; gap: number } | null = null;
  if (evAlerte) {
    const pad = padT;
    const ico = 40 * s;
    const gap = 10 * s;
    const fixe = fixeT;
    // Marges : ≥ 28 px entre le titre et le toast, 20 px au bord droit de la carte, ≥ 18 px (16 + rebond) du filet de la barre.
    // Le toast reçoit au moins la place réservée, et le reste que le titre laisse libre.
    const dispoDroite = Math.max(reserve, espace - (tf.w + 26 * s)) - fixe;
    // Tour 9 : texte du toast ≥ 40 px (44 px visés), sur UNE ou DEUX lignes (la barre grandit d'autant), trois si la barre le permet ;
    // à défaut, raccourci à une frontière de mot À 40 px (jamais plus petit, jamais un mot coupé).
    const dd = Math.max(60 * s, dispoDroite);
    const barMax = Math.max(barH, 0.26 * W.hauteur);
    const hBarre = (a: Ajuste) => a.h + 2 * (0.3 * a.taille + 3 * s) + (compact ? 25 : 30) * s;
    const plein = (a: Ajuste) => !a.tronque && !a.cesure && a.taille >= 40 * s - 0.01;
    let bt: Ajuste | null = null;
    for (const nl of [1, 2, 3]) {
      const a = ajuster(s, evAlerte.texte, 44 * s, dd, nl, 600, 40 * s);
      if (plein(a) && (nl === 1 || hBarre(a) <= barMax)) {
        bt = a;
        break;
      }
    }
    if (!bt) {
      for (const nl of [3, 2, 1]) {
        bt = ajusterMini(s, evAlerte.texte, 44 * s, dd, nl, 600, 40 * s);
        if (hBarre(bt) <= barMax) break;
      }
    }
    bt = bt!;
    // Marge verticale ≥ 0,3 × la taille (+ 4 px) au-dessus et au-dessous : le jambage du « p » reste dans la pastille.
    const padV = 0.3 * bt.taille + 3 * s;
    const bh = bt.h + 2 * padV;
    toast = { bt, bw: bt.w + fixe, bh, pad, padV, ico, gap };
    barH = Math.max(barH, Math.ceil(bh + (compact ? 25 : 30) * s));
  }
  const ix = W.x + P;
  const iy = W.y + barH + P;
  const iw = W.largeur - 2 * P;
  const ih = W.hauteur - barH - 2 * P;
  const evCartes = trouver(ev, "cartes-chiffres");
  const evListe = trouver(ev, "liste");
  const evTri = trouver(ev, "tri");
  const evClic = trouver(ev, "clic");
  const evPanneau = trouver(ev, "panneau");
  // La fenêtre est « visible » dès la fin de la sortie de la scène précédente : toute la construction part de là.
  const tS = sc.debutMs + DUREES_MS.sortieScene;
  const tClic = evClic ? Math.max(evClic.aMs, sc.debutMs + 1600) : Infinity;
  // L'historique ne s'ouvre jamais avant 500 ms APRÈS le clic : la ligne s'enfonce et son anneau terracotta se voient d'abord.
  // Tour 9 : la LISTE se rétrécit d'abord (300 ms, à partir de 500 ms après le clic), PUIS le panneau entre (`tP`) : aucun texte du
  // panneau ne recouvre jamais un texte de la liste.
  const DUREE_RETRECI = 300;
  const tP = evPanneau ? Math.max(evPanneau.aMs, tClic + 500) : Infinity;
  // Tour 10 : la liste se rétrécit (300 ms adoucis) PENDANT que le panneau glisse depuis la droite : aucun saut.
  const tRetreci = tP;

  /* Alerte en DEUX temps : à `aMs` (la condition) l'écran MONTRE la condition (carte qui pulse, ligne la plus urgente (rang 1) qui
     vire au terracotta) ; à `tDecl` (le déclencheur) le toast part (glisse, la cloche s'agite) et RESTE à pleine opacité
     jusqu'à la sortie de la scène (il ne disparaît qu'avec tout l'écran). */
  const aAl = evAlerte ? evAlerte.aMs : Infinity;
  const tDecl = evAlerte
    ? borne(evAlerte.declencheurAMs ?? aAl + 0.6 * Math.max(0, sc.finMs - aAl), aAl, Math.max(aAl, sc.finMs - 500))
    : Infinity;
  // Entrée du toast : il tombe de 14 px avec un petit rebond doux (dépassement ≈ 3,5 px, 300 ms), opaque dès 150 ms.
  const pIn = evAlerte ? avancement(T, tDecl, 150) : 0;
  const rebond = (u: number): number => {
    if (u <= 0) return 0;
    if (u >= 1) return 1;
    return u < 0.6 ? 1.25 * (1 - Math.pow(1 - u / 0.6, 2)) : 1.25 - 0.25 * adoucir((u - 0.6) / 0.4);
  };
  const eToast = evAlerte ? rebond((T - tDecl) / 300) : 0;

  /* Fenêtre : coque, points, titre, filet (le titre ne s'efface JAMAIS) */
  add({ id: "fenetre", genre: "forme", rect: { ...W }, remplissage: "blanc", contour: "gris", rayonPx: 28 * s, ombre: true });
  for (let k = 0; k < 3; k++) {
    add({ id: `fenetre/point-${k + 1}`, genre: "forme", rect: { x: W.x + 24 * s + k * 26 * s, y: W.y + barH / 2 - 9 * s, largeur: 18 * s, hauteur: 18 * s }, opacite: 0.5, icone: "point", couleur: "grisTexte", parentId: "fenetre" });
  }
  poserTexte(add, "fenetre/titre", tf, tx, W.y + (barH - tf.h) / 2, W.largeur, { graisse: 700, couleur: "noir", parentId: "fenetre", opacite: 1 });
  add({ id: "fenetre/filet", genre: "forme", rect: { x: W.x + 2 * s, y: W.y + barH, largeur: W.largeur - 4 * s, hauteur: 2 * s }, remplissage: "gris", parentId: "fenetre" });

  /* ---- Cartes-chiffres : libellés 42 px, en cascade dès l'entrée ; disposition changée avant de couper un mot ---- */
  const cartes = evCartes ? evCartes.cartes.slice(0, 4) : [];
  const n = cartes.length > 0 ? cartes.length : 3;
  const padC = Math.round((compact ? 10 : 10) * s);
  const valH = (compact ? 20 : 20) * s;
  const stripH = 8 * s;
  const gv = (compact ? 4 : 6) * s;
  const calcLibelles = (w: number, cible: number) => {
    let f = cartes.map((k) => ajuster(s, k.libelle, cible, w, 2, 600, 36 * s));
    if (f.length) {
      const tmin = Math.min(...f.map((x) => x.taille));
      f = cartes.map((k) => ajuster(s, k.libelle, tmin, w, 2, 600, Math.min(36 * s, tmin)));
    }
    return f;
  };
  const cwC = (iw - (n - 1) * g) / n;
  const wIntC = cwC - 2 * padC;
  // Pictogramme de carte (tour 9) : chaque carte a le sien (boîte, seuil, pièces). En COLONNES il occupe la rangée du haut, à gauche (le
  // filet d'accent est à sa droite) : le libellé garde toute la largeur de la carte. En LIGNES pleine largeur il est à gauche du libellé.
  const icoC = (compact ? 30 : 40) * s;
  const icoG = 12 * s;
  const icoW = icoC + icoG;
  const pictos = pictogrammesCartes(cartes.map((k) => k.libelle));
  const topH = Math.max(stripH, icoC);
  let fits = calcLibelles(wIntC, 42 * s);
  // Un mot ne tient pas dans une colonne (coupé ou texte raccourci) : les cartes passent en LIGNES pleine largeur.
  const enLignes = fits.some((f) => f.tronque || f.cesure || f.taille < 36 * s - 0.01);
  const vw = Math.round(0.3 * iw);
  const labW = iw - 2 * padC - stripH - 14 * s - vw - 14 * s;
  if (enLignes) fits = calcLibelles(labW - icoW, 42 * s);
  const labelH = fits.length ? Math.max(...fits.map((f) => f.h)) : 2 * 42 * s * INTERLIGNE;
  const naturel = padC + topH + gv + labelH + gv + valH + padC;
  // En lignes pleine largeur, CHAQUE ligne a la hauteur de son libellé (une ligne de 1 libellé court ne grandit pas pour un long).
  const rowsCH = Array.from({ length: n }, (_, k) => Math.max((fits[k] ? fits[k].h : 42 * s * INTERLIGNE) + 2 * padC, 56 * s));
  const rowsY = rowsCH.map((_, k) => rowsCH.slice(0, k).reduce((a, b) => a + b, 0) + k * g);
  const cardsH = enLignes ? rowsCH.reduce((a, b) => a + b, 0) + (n - 1) * g : Math.min(Math.max(naturel, (compact ? 0.34 : 0.365) * ih), 0.46 * ih);
  const sparkH = enLignes ? 0 : cardsH - naturel - gv;
  const avecSpark = sparkH >= 26 * s;
  const largsVal = [0.62, 0.5, 0.7, 0.55];
  const rectCarte = (k: number): RectPx => (enLignes ? { x: ix, y: iy + rowsY[k], largeur: iw, hauteur: rowsCH[k] } : { x: ix + k * (cwC + g), y: iy, largeur: cwC, hauteur: cardsH });

  /* ---- Liste : N plafonné selon la place (minimum 3), lignes qui TIENNENT dans le panneau ---- */
  const lx = ix;
  const ly = iy + cardsH + g2;
  const lh = iy + ih - ly;
  const pw = Math.floor(0.55 * W.largeur);
  const glisse = 64 * s;
  const pOuv = evPanneau ? avancement(T, tRetreci, DUREE_RETRECI, adoucir) : 0;
  const lwMin = evPanneau ? iw - (pw + g) : iw;
  const lw = iw - pOuv * (pw + g);
  const padL = Math.round((compact ? 12 : 18) * s);
  const gapR = (lh < 330 * s ? 8 : 12) * s;
  const rowMin = (compact ? 30 : 40) * s;
  const Ndemande = Math.round(borne(evListe ? evListe.lignes : 4, 2, 7));
  // En-tête de la liste : le TITRE seul (≤ 2 lignes), les lignes commencent à ≤ 24 px dessous (aucune place réservée à l'étiquette). L'étiquette
  // « Par urgence » (≥ 36 px) arrive au mot du tri, en PIED de liste : sa place s'ouvre en 500 ms (les lignes s'affinent doucement).
  const entete = (maxLTitre: number, avecEtiquette = true) => {
    const titreL = evListe ? ajuster(s, evListe.titre, (compact ? 40 : 44) * s, lwMin - 2 * padL, maxLTitre, 700, 40 * s) : null;
    let pill: Ajuste | null = null;
    if (evTri && avecEtiquette) pill = ajuster(s, evTri.etiquette, (compact ? 36 : 38) * s, lwMin - 2 * padL - 32 * s, 1, 600, 36 * s);
    const titreH = titreL ? titreL.h : 24 * s;
    const pillH = pill ? pill.h + (compact ? 6 : 10) * s : 0;
    const pied = pill ? pillH + (compact ? 4 : 8) * s : 0;
    const rowsTop = ly + padL + titreH + (compact ? 6 : 14) * s;
    const dispoDeb = Math.max(0, ly + lh - padL - rowsTop);
    const dispoRangs = Math.max(0, dispoDeb - pied);
    const Nplace = Math.floor((dispoRangs + gapR) / (rowMin + gapR));
    return { titreL, pill, titreH, pillH, rowsTop, dispoDeb, dispoRangs, Nplace };
  };
  // Échelle de repli : titre sur 2 lignes + étiquette, titre sur 1 ligne, puis (dernier recours, textes démesurés) sans étiquette.
  let ent = entete(2);
  for (const essai of [entete(1), entete(1, false)]) if (ent.Nplace < 3 && essai.Nplace > ent.Nplace) ent = essai;
  const { titreL, pill, pillH, rowsTop, dispoDeb, dispoRangs, Nplace } = ent;
  const N = Nplace >= 3 ? Math.min(Ndemande, Nplace) : Math.max(1, Nplace);
  // Hauteur de ligne : jamais relevée au-dessus de ce qui tient (les N lignes tiennent TOUJOURS dans le panneau), avant (sans pied) et après le tri.
  const dimsRangs = (dispo: number) => {
    const gap = Math.min(gapR, dispo / (4 * N));
    return { gap, h: Math.min(84 * s, Math.max(1, (dispo - (N - 1) * gap) / N)) };
  };
  const dFin = dimsRangs(dispoRangs);
  const dDeb = dimsRangs(dispoDeb);
  const rowFin = dFin.h;
  const slotAvant: number[] = [];
  if (evTri) {
    const ordre = Array.from({ length: N }, (_, i) => i).sort((a, b) => ((a * 5 + 3) % 11) - ((b * 5 + 3) % 11));
    ordre.forEach((item, rang) => (slotAvant[item] = rang));
  } else for (let i = 0; i < N; i++) slotAvant[i] = i;
  const pTri = evTri ? avancement(T, evTri.aMs, DUREES_MS.tri, adoucir) : 0;
  const slotPos = (i: number) => entre(slotAvant[i], i, pTri);
  const rowH = entre(dDeb.h, dFin.h, pTri);
  const gapEff = entre(dDeb.gap, dFin.gap, pTri);
  const rowRect = (pos: number): RectPx => ({ x: lx + padL, y: rowsTop + pos * (rowH + gapEff), largeur: lw - 2 * padL, hauteur: rowH });

  /* ---- Mesure de l'historique (ne dépend pas du temps) : sert aux jalons du calendrier (seules les rubriques MONTRÉES comptent) ---- */
  const PM = evPanneau
    ? (() => {
        const th = ajuster(s, evPanneau.titre, 44 * s, pw - 2 * padL - 54 * s, 1, 700, 40 * s);
        // Rubriques : libellés ≥ 40 px si la place le permet ; sinon 1 ligne, puis sans mini-graphique, puis moins de rubriques.
        const wFull = pw - 2 * padL;
        const colW = 16 * s;
        const colG = 8 * s;
        const chartW = 6 * colW + 5 * colG;
        const rub = evPanneau.rubriques;
        const dispoH = ly + lh - padL - (ly + padL + th.h + 14 * s);
        const sepL = 10 * s;
        const mesure = (lignesMax: number, cible = 44) => rub.map((r) => ajuster(s, r.libelle, cible * s, wFull, lignesMax, 600, 36 * s));
        const enLigne = (f: Ajuste) => f.lignes.length === 1 && f.w + 20 * s + chartW <= wFull;
        const hauteurR = (f: Ajuste, ch: number) => (ch <= 0 ? f.h : enLigne(f) ? Math.max(f.h, ch) : f.h + sepL + ch);
        const gpDe = (ch: number) => (ch >= 34 ? 14 : 8) * s;
        const total = (lf: Ajuste[], ch: number, m: number) => lf.slice(0, m).reduce((a, f) => a + hauteurR(f, ch * s), 0) + Math.max(0, m - 1) * gpDe(ch);
        let lf = mesure(2);
        let chartH = 0;
        let montrees = rub.length;
        let trouve = false;
        // Tailles visées 44 puis 40 puis 36 px (jamais moins) : la hauteur manque d'abord → on rapetisse un peu AVANT de retirer une rubrique.
        for (const cible of [44, 40, 36]) {
          for (const lm of [2, 1]) {
            lf = mesure(lm, cible);
            // Jamais de libellé sous 36 px pour gagner de la hauteur : une ligne plus petite n'est pas une option.
            if (lf.some((f) => f.taille < 36 * s - 0.01)) continue;
            for (const ch of lm === 2 ? [84, 66, 52, 40, 32, 26, 0] : [84, 66, 52, 40, 32, 26]) {
              if (total(lf, ch, rub.length) <= dispoH) {
                chartH = ch * s;
                trouve = true;
                break;
              }
            }
            if (trouve) break;
          }
          if (trouve) break;
        }
        if (!trouve) {
          // Rien ne tient avec des mini-graphiques : libellés sur 2 lignes au plus, sans graphique, puis on PLAFONNE le nombre de rubriques.
          lf = mesure(2);
          if (total(lf, 0, rub.length) > dispoH) while (montrees > 1 && total(lf, 0, montrees) > dispoH) montrees--;
          chartH = 0;
        }
        const gp = gpDe(chartH / s);
        return { th, wFull, chartW, colW, colG, rub, lf, chartH, montrees, gp, enLigne, hauteurR, sepL };
      })()
    : null;

  /* ---- Calendrier : cascade d'entrée (≈ 1,5 s), jalons (mots), colonnes de mini-graphique dans les creux ---- */
  // TOUS les emplacements (contours des cartes, de la liste et de ses lignes) sont posés ≤ 600 ms après l'entrée de la fenêtre ;
  // la cascade les REMPLIT ensuite (libellés, barres, colonnes) : jamais une fenêtre aux deux tiers blanche.
  const tCarte = (k: number) => tS + k * 20;
  const tListe = tS + 20;
  const pasLigne = Math.min(20, 30 / N);
  const tLigne = (rang: number) => tS + 40 + rang * pasLigne;
  // Au mot « trois chiffres » (`cartes-chiffres`), les barres et les mini-graphiques des cartes se remplissent TOUS ENSEMBLE
  // (mêmes instants pour les cartes) ; ensuite chaque carte s'allume sur son propre mot. Les creux sont comblés par les lignes.
  const tColonne = (j: number): number => (avecSpark ? tS + 150 + j * 35 : Infinity);
  /* ---- Cartes ---- */
  const dyC = 12 * s;
  // Carte de l'alerte : dès la condition (`aAl`), son SEUL contour est `pulse-carte` (3 px terracotta) ; le contour `allume` s'efface (jamais de double bordure).
  const kPulse = evAlerte && T >= aAl && evAlerte.cartePulse !== undefined && evAlerte.cartePulse >= 0 && evAlerte.cartePulse < n ? evAlerte.cartePulse : -1;
  const cadreCartes: RectPx[] = [];
  for (let k = 0; k < n; k++) {
    const R = rectCarte(k);
    const cIn = avancement(T, tCarte(k), 170);
    const a = cartes[k] ? cartes[k].aMs : Infinity;
    const p = Number.isFinite(a) ? avancement(T, a, 450) : 0;
    const id = `carte-${k + 1}`;
    const fy = (e: Pose) => {
      e.rect = { ...e.rect, y: e.rect.y + (1 - cIn) * dyC };
      e.opacite *= cIn;
      return e;
    };
    const carte = fy(add({ id, genre: "forme", rect: { ...R }, remplissage: "ivoire", contour: "gris", rayonPx: 20 * s }));
    cadreCartes.push(carte.rect);
    const ax = R.x + padC;
    const ay = R.y + padC;
    const accent: RectPx = enLignes ? { x: ax, y: ay, largeur: stripH, hauteur: R.hauteur - 2 * padC } : { x: ax + icoW, y: ay + (topH - stripH) / 2, largeur: 56 * s, hauteur: stripH };
    if (enLignes) fy(add({ id: `${id}/accent`, genre: "forme", rect: accent, opacite: 0.3, remplissage: "grisTexte", rayonPx: stripH / 2, parentId: id }));
    if (p > 0 && enLignes) fy(add({ id: `${id}/accent-allume`, genre: "forme", rect: { ...accent }, opacite: p, remplissage: "terracotta", rayonPx: stripH / 2, parentId: id }));
    const lx0 = enLignes ? ax + stripH + 14 * s + icoW : ax;
    const ly0 = enLignes ? R.y + (R.hauteur - (fits[k] ? fits[k].h : labelH)) / 2 : ay + topH + gv;
    if (cartes[k]) {
      const iy0 = enLignes ? R.y + (R.hauteur - icoC) / 2 : ay;
      fy(add({ id: `${id}/icone`, genre: "forme", rect: { x: enLignes ? lx0 - icoW : ax, y: iy0, largeur: icoC, hauteur: icoC }, icone: pictos[k], couleur: pictos[k] === "seuil" ? "terracotta" : pictos[k] === "boite" ? "noir" : "grisTexte", parentId: id }));
    }
    if (fits[k]) fy(poserTexte(add, `${id}/libelle`, fits[k], lx0, ly0, (enLignes ? labW - icoW : wIntC), { graisse: 600, couleur: "noir", parentId: id }));
    else fy(add({ id: `${id}/fantome-libelle`, genre: "forme", rect: { x: lx0, y: ly0, largeur: (enLignes ? labW - icoW : wIntC) * 0.7, hauteur: 16 * s }, opacite: 0.22, remplissage: "grisTexte", rayonPx: 8 * s, parentId: id }));
    const tw = enLignes ? vw : wIntC;
    const tx0 = enLignes ? R.x + R.largeur - padC - vw : ax;
    const ty0 = enLignes ? R.y + (R.hauteur - valH) / 2 : R.y + R.hauteur - padC - valH;
    fy(add({ id: `${id}/valeur-fond`, genre: "forme", rect: { x: tx0, y: ty0, largeur: tw, hauteur: valH }, opacite: 0.12, remplissage: "grisTexte", rayonPx: valH / 2, parentId: id }));
    const q = Number.isFinite(a) ? avancement(T, a + 100, 650, adoucir) : 0;
    // Barre de valeur (squelette) : elle se remplit avec les mini-graphiques, pour toutes les cartes ensemble.
    const qb0 = avancement(T, tS + 500, 700, adoucir);
    // Les barres de valeur bougent légèrement une fois posées (± 4 %), déphasées d'une carte à l'autre.
    const vieV = qb0 >= 1 ? 1 + 0.04 * Math.sin((2 * Math.PI * (T - tS)) / 2000 + k * 1.7) : 1;
    fy(add({ id: `${id}/valeur-base`, genre: "forme", rect: { x: tx0, y: ty0, largeur: tw * largsVal[k % 4] * qb0 * vieV, hauteur: valH }, opacite: qb0 > 0 ? 0.3 * Math.min(1, qb0 * 6) : 0, remplissage: "grisTexte", rayonPx: valH / 2, progression: qb0, parentId: id }));
    fy(add({ id: `${id}/valeur`, genre: "forme", rect: { x: tx0, y: ty0, largeur: tw * largsVal[k % 4] * q * vieV, hauteur: valH }, opacite: q > 0 ? 0.85 * Math.min(1, q * 6) : 0, remplissage: "terracotta", rayonPx: valH / 2, progression: q, parentId: id }));
    if (avecSpark) {
      const sy = ay + topH + gv + labelH + gv;
      const colG = 8 * s;
      const colW = (wIntC - (COLONNES_CARTE - 1) * colG) / COLONNES_CARTE;
      const pas = colW + colG;
      // Mini-graphique VIVANT : toutes les 0,8 s une NOUVELLE colonne arrive à droite et les autres glissent d'un cran vers la gauche
      // (la plus ancienne sort à gauche) ; la colonne j porte la donnée m + j : le mouvement est continu et se lit comme un flux.
      const tVie = tS + 900;
      const m = T >= tVie ? Math.floor((T - tVie) / 800) : 0;
      const phi = T >= tVie ? adoucir(((T - tVie) % 800) / 800) : 0;
      for (let j = 0; j <= COLONNES_CARTE; j++) {
        const qj = j < COLONNES_CARTE && Number.isFinite(tColonne(j)) ? avancement(T, tColonne(j), 300, adoucir) : T >= tVie ? 1 : 0;
        const x0c = Math.max(0, (j - phi) * pas);
        const x1c = Math.min(wIntC, (j - phi) * pas + colW);
        if (qj <= 0 || x1c - x0c < 1) continue;
        const serie = SERIES_CARTES[k % SERIES_CARTES.length];
        const hv = serie[(m + j) % serie.length];
        const entrant = j === COLONNES_CARTE ? phi : 1;
        const hh = Math.min(sparkH, (26 * s + (sparkH - 26 * s) * hv) * qj * (0.15 + 0.85 * entrant));
        const bord = Math.min(1, (x1c - x0c) / colW);
        fy(add({ id: `${id}/col-${m + j + 1}`, genre: "forme", rect: { x: ax + x0c, y: sy + sparkH - hh, largeur: x1c - x0c, hauteur: hh }, opacite: Math.min(1, qj * 6) * (0.45 + 0.1 * hv) * bord, remplissage: "grisTexte", rayonPx: Math.min(5 * s, colW / 2), progression: qj, parentId: id }));
      }
    }
    const retour = evAlerte ? 1 - avancement(T, aAl, 300) : 1;
    if (p * retour > 0.001 && k !== kPulse) fy(add({ id: `${id}/allume`, genre: "forme", rect: { ...R }, opacite: p * retour, contour: "terracotta", rayonPx: 20 * s, parentId: id }));
  }

  /* ---- Liste ---- */
  const lIn = avancement(T, tListe, 170);
  add({ id: "liste", genre: "forme", rect: { x: lx, y: ly, largeur: lw, hauteur: lh }, opacite: lIn, remplissage: "ivoire", contour: "gris", rayonPx: 22 * s });
  if (titreL) {
    poserTexte(add, "liste/titre", titreL, lx + padL, ly + padL + 0, lw, { graisse: 700, couleur: "noir", parentId: "liste", opacite: lIn });
  } else {
    add({ id: "liste/fantome-titre", genre: "forme", rect: { x: lx + padL, y: ly + padL, largeur: Math.min(lw - 2 * padL, lw * 0.4), hauteur: 22 * s }, opacite: 0.22 * lIn, remplissage: "grisTexte", rayonPx: 11 * s, parentId: "liste" });
  }
  if (pill && evTri) {
    const pq = avancement(T, evTri.aMs + 300, 350);
    const pwid = pill.w + 32 * s;
    const px = lx + padL;
    const py = ly + lh - padL - pillH;
    add({ id: "liste/etiquette", genre: "forme", rect: { x: px, y: py + (1 - pq) * 8 * s, largeur: pwid, hauteur: pillH }, opacite: pq, remplissage: "gris", rayonPx: pillH / 2, parentId: "liste" });
    poserTexte(add, "liste/etiquette/texte", pill, px + 16 * s, py + (pillH - pill.h) / 2 + (1 - pq) * 8 * s, pwid, { graisse: 600, couleur: "noir", parentId: "liste/etiquette", opacite: pq });
  }
  // UNE SEULE ligne sélectionnée à la fois : la ligne 1 au clic ; dès la condition de l'alerte (`aMs`) elle se désélectionne et seule la ligne concernée s'allume.
  const litP = evClic ? avancement(T, tClic, 250) * (1 - avancement(T, aAl, 250)) : 0;
  const rayonRang = Math.min(14 * s, rowFin / 2);
  for (let i = 0; i < N; i++) {
    const pos = slotPos(i);
    const R = rowRect(pos);
    const rIn = avancement(T, tLigne(slotAvant[i]), 150);
    const aRow = evListe ? evListe.aMs + 120 + slotAvant[i] * 130 : Infinity;
    const pr = Number.isFinite(aRow) ? avancement(T, aRow, 380) : 0;
    const dy = (1 - rIn) * Math.min(14 * s, padL * 0.8);
    const id = `rang-${i + 1}`;
    add({ id, genre: "forme", rect: { ...R, y: R.y + dy }, opacite: lIn * rIn, remplissage: "blanc", contour: "gris", rayonPx: rayonRang, parentId: "liste" });
    const ps = Math.min(R.hauteur * 0.46, 28 * s);
    const bx = R.x + 16 * s + ps + 16 * s;
    const shortW = R.largeur * 0.14;
    const dispo = Math.max(0, R.largeur - (bx - R.x) - 16 * s - shortW - 16 * s);
    const bh = Math.min(R.hauteur * 0.3, 18 * s);
    const urg = N > 1 ? 1 - (0.65 * i) / (N - 1) : 1;
    add({ id: `${id}/pastille`, genre: "forme", rect: { x: R.x + 16 * s, y: R.y + (R.hauteur - ps) / 2 + dy, largeur: ps, hauteur: ps }, opacite: rIn * (0.22 + pr * (urg - 0.22)), icone: "pastille", couleur: "terracotta", parentId: id });
    // Barres des lignes DESSINÉES dès l'entrée de la fenêtre, en gris foncé À PLEINE OPACITÉ (des lignes lisibles, pas des fantômes) ;
    // la pastille d'urgence s'allume au mot de la liste. Une fois posées, les barres VIVENT (± 5 % de longueur, déphasées d'une ligne à l'autre).
    const qb = avancement(T, tLigne(slotAvant[i]) + 60, 400, adoucir);
    const vie = qb >= 1 ? Math.sin((2 * Math.PI * (T - tS)) / 2400 + i * 1.3) : 0;
    // Ligne concernée par l'alerte (rang 1) : de `aMs` au déclencheur sa barre de valeur BAISSE (0,78 → 0,32 de la place) et franchit le
    // marqueur « seuil » (petit trait terracotta vertical posé à 0,55) ; aucun chiffre.
    const L0 = dispo * [0.78, 0.62, 0.7, 0.5][i % 4];
    const cond = evAlerte && i === 0 && T >= aAl;
    const dec = cond ? avancement(T, aAl, Math.min(1600, Math.max(600, tDecl - aAl)), (x) => borne(x, 0, 1)) : 0;
    add({ id: `${id}/barre`, genre: "forme", rect: { x: bx, y: R.y + (R.hauteur - bh) / 2 + dy, largeur: L0 * qb * (cond ? 1 - 0.59 * dec : 1 + 0.05 * vie), hauteur: bh }, opacite: qb > 0 ? Math.min(1, qb * 6) * rIn : 0, remplissage: "grisTexte", rayonPx: bh / 2, progression: qb, parentId: id });
    if (cond) {
      const mq = avancement(T, aAl, 250);
      add({ id: `${id}/seuil`, genre: "forme", rect: { x: bx + L0 * 0.55 - 2 * s, y: R.y + R.hauteur * 0.12 + dy, largeur: 4 * s, hauteur: R.hauteur * 0.76 }, opacite: mq * rIn, remplissage: "terracotta", rayonPx: 2 * s, progression: mq, parentId: id });
    }
    // Micro-graphique de la ligne : même flux que celui des cartes (une colonne neuve à droite toutes les 0,8 s, les autres glissent à gauche).
    const nC = 5;
    const cG = 4 * s;
    const cW = Math.max(2 * s, (shortW - (nC - 1) * cG) / nC);
    const pasC = cW + cG;
    const wC = nC * cW + (nC - 1) * cG;
    const xC = R.x + R.largeur - 16 * s - wC;
    const tVie = tS + 900;
    const mC = T >= tVie ? Math.floor((T - tVie) / 800) : 0;
    const phC = T >= tVie ? adoucir(((T - tVie) % 800) / 800) : 0;
    const hMax = Math.min(R.hauteur * 0.62, 30 * s);
    for (let j = 0; j <= nC; j++) {
      const qj = j < nC ? qb : T >= tVie ? 1 : 0;
      const x0c = Math.max(0, (j - phC) * pasC);
      const x1c = Math.min(wC, (j - phC) * pasC + cW);
      if (qj <= 0 || x1c - x0c < 1) continue;
      const hv = HAUTEURS_CARTE[(mC + j + 2 * i) % HAUTEURS_CARTE.length];
      const hh = hMax * (0.35 + 0.65 * hv) * qj * (j === nC ? 0.15 + 0.85 * phC : 1);
      add({ id: `${id}/mini-${mC + j + 1}`, genre: "forme", rect: { x: xC + x0c, y: R.y + (R.hauteur + hMax) / 2 - hh + dy, largeur: x1c - x0c, hauteur: hh }, opacite: Math.min(1, qj * 6) * (j === nC ? Math.min(1, qb * 6) : 1) * 0.7 * Math.min(1, (x1c - x0c) / cW) * rIn, remplissage: "grisTexte", rayonPx: Math.min(3 * s, cW / 2), progression: qj, parentId: id });
    }
  }
  const slot0 = rowRect(0);
  // La surbrillance du clic est attachée à la CIBLE FIXE `ligne-1` (position 0 de la liste), pas à une ligne qui bouge.
  if (litP > 0.002) {
    add({ id: "ligne-1/allume-fond", genre: "forme", rect: { ...slot0 }, opacite: 0.3 * litP, remplissage: "terracotta", rayonPx: rayonRang, parentId: "liste" });
    add({ id: "ligne-1/allume", genre: "forme", rect: { ...slot0 }, opacite: litP, contour: "terracotta", rayonPx: rayonRang, parentId: "liste" });
  }
  add({ id: "ligne-1", genre: "cible", rect: slot0 });
  // La ligne cliquée s'ENFONCE (0,97 pendant 300 ms, avant l'ouverture de l'historique) : la ligne en position 0, sa surbrillance et ses enfants.
  if (evClic) {
    const f = 1 - 0.03 * enfoncement(T - tClic, 60, 300, 100);
    if (f < 1) {
      let ip = 0;
      for (let i = 1; i < N; i++) if (slotPos(i) < slotPos(ip)) ip = i;
      const cl = { x: slot0.x + slot0.largeur / 2, y: slot0.y + slot0.hauteur / 2 };
      for (const e of els) if (e.id === `rang-${ip + 1}` || e.id.startsWith(`rang-${ip + 1}/`) || e.id === "ligne-1/allume" || e.id === "ligne-1/allume-fond") reduire(e, cl, f);
    }
  }

  /* ---- Panneau « Historique » : un tiroir qui glisse depuis la droite (≥ 60 px) dans la fenêtre ---- */
  if (evPanneau) {
    const pp = avancement(T, tP, DUREES_MS.panneau, adoucir);
    const dxP = (1 - pp) * glisse;
    const px = ix + iw - pw;
    const droite = px + pw;
    const i0 = els.length;
    const idP = "panneau";
    add({ id: idP, genre: "forme", rect: { x: px + dxP, y: ly, largeur: pw - dxP, hauteur: lh }, opacite: pp, remplissage: "blanc", contour: "gris", rayonPx: 22 * s, ombre: true });
    const { th, wFull, chartW, colW, colG, rub, lf, chartH, montrees, gp, enLigne, hauteurR, sepL } = PM!;
    add({ id: `${idP}/horloge`, genre: "forme", rect: { x: px + padL, y: ly + padL + (th.h - 40 * s) / 2, largeur: 40 * s, hauteur: 40 * s }, opacite: pp, icone: "horloge", couleur: "terracotta", progression: HORLOGE_FIXE, parentId: idP });
    poserTexte(add, `${idP}/titre`, th, px + padL + 54 * s, ly + padL, pw, { graisse: 700, couleur: "noir", parentId: idP, opacite: pp });

    let yy = ly + padL + th.h + 14 * s;
    rub.slice(0, montrees).forEach((r, k) => {
      const f = lf[k];
      const inline = enLigne(f);
      const hr = hauteurR(f, chartH);
      // Une rubrique n'apparaît jamais avant son panneau, et seulement quand le tiroir a fini de glisser.
      // Tour 10 : le panneau entre DÉJÀ REMPLI (libellés grisés et squelettes de barres bas), chaque rubrique s'ALLUME (noir, barres qui
      // poussent) sur son mot, jamais avant la fin du glissé.
      const t0 = Math.max(r.aMs, tP + 600);
      const pr = avancement(T, t0, 400);
      const pre = avancement(T, tP + 100, 300);
      const dy = 0;
      const idR = `${idP}/rubrique-${k + 1}`;
      poserTexte(add, `${idR}/libelle`, f, px + padL, yy + dy + (chartH > 0 && inline ? (hr - f.h) / 2 : 0), wFull, { graisse: 600, couleur: T >= t0 ? "noir" : "grisTexte", parentId: idP, opacite: pre });
      if (chartH > 0) {
        const cx = inline ? px + pw - padL - chartW : px + padL;
        const base = inline ? yy + (hr + chartH) / 2 : yy + f.h + sepL + chartH;
        const fr = HAUTEURS_COLONNES[k % 3];
        for (let j = 0; j < 6; j++) {
          const q = avancement(T, t0 + 150 + j * 90, 600, adoucir);
          const hh = chartH * fr[j] * (0.3 + 0.7 * q);
          const rouge = k % 3 === 2 && j === 5;
          add({ id: `${idR}/colonne-${j + 1}`, genre: "forme", rect: { x: cx + j * (colW + colG), y: base - hh + dy, largeur: colW, hauteur: hh }, opacite: pre * (0.3 + 0.7 * pr) * (rouge ? 1 : 0.4) * (rouge && pr < 1 ? pr : 1), remplissage: rouge ? "terracotta" : "grisTexte", rayonPx: 4 * s, progression: q, parentId: idP });
        }
      }
      yy += hr + gp;
    });
    // Tiroir : tout ce qui est dans le panneau glisse avec lui, sans jamais dépasser son bord droit (fixe).
    for (const e of els.slice(i0)) {
      if (e.id === idP) continue;
      const x = Math.min(e.rect.x + dxP, droite);
      e.rect = { ...e.rect, x, largeur: Math.max(0, Math.min(e.rect.largeur, droite - x)) };
    }
  }

  /* ---- La CONDITION de l'alerte, montrée dès `aMs` : la carte pulse (contour terracotta qui respire) et la ligne la plus urgente (rang 1) de la
     liste vire au terracotta en glissant un peu vers le haut ; tout cela dure jusqu'à la sortie de la scène. ---- */
  if (evAlerte && T >= aAl) {
    const monte = avancement(T, aAl, 300);
    if (kPulse >= 0) {
      // Contour terracotta UNIQUE (3 px) qui PULSE 2 fois (700 ms chacune, léger gonflement) puis reste tracé, à pleine opacité.
      const kc = (T - aAl) / 700;
      const env = kc >= 0 && kc < 2 ? Math.pow(Math.sin(Math.PI * kc), 2) : 0;
      add({ id: "pulse-carte", genre: "forme", rect: rectEnveloppe(rectCarte(kPulse), (1 + 4 * env) * s), opacite: Math.max(monte, cartes[kPulse] ? avancement(T, cartes[kPulse].aMs, 450) : 0), contour: "terracotta", rayonPx: 24 * s });
    }
    // Cohérence (tour 9) : la liste est triée par urgence, l'article qui passe sous le seuil est le PLUS urgent (rang 1, pastille la plus foncée).
    const rl = els.find((e) => e.id === "rang-1");
    if (rl) {
      // La ligne PULSE 2 fois, en phase avec l'arrivée du toast (900 ms) : son fond s'intensifie et un anneau terracotta s'élargit.
      const kp = (T - tDecl) / 450;
      const pulse = kp > 0 && kp < 2 ? Math.pow(Math.sin(Math.PI * kp), 2) : 0;
      if (kp > 0 && kp < 2) {
        const ph = kp % 1;
        add({ id: `rang-1/pulse`, genre: "forme", rect: rectEnveloppe(rl.rect, (2 + 6 * ph) * s), opacite: 0.9 * (1 - ph) * lIn, contour: "terracotta", rayonPx: rayonRang + 2 * s + 6 * s * ph, parentId: "liste" });
      }
      add({ id: `rang-1/alerte-fond`, genre: "forme", rect: { ...rl.rect }, opacite: Math.min(1, 0.16 + 0.34 * pulse) * monte * lIn, remplissage: "terracotta", rayonPx: rayonRang, parentId: "liste" });
      add({ id: `rang-1/alerte-contour`, genre: "forme", rect: { ...rl.rect }, opacite: monte * lIn, contour: "terracotta", rayonPx: rayonRang, parentId: "liste" });
    }
  }

  /* ---- Curseur du clic : vrai TRAJET (≥ 1 s) en arc vers la ligne 1, pointe SUR la ligne ---- */
  if (evClic) {
    // Tour 10 : le curseur apparaît ≤ 1 s avant le clic (900 ms) et son départ est à ≤ 300 px de la cible (jamais un coin lointain).
    const dep = Math.max(sc.debutMs, tClic - 900);
    const cible = { x: slot0.x + slot0.largeur * 0.45, y: slot0.y + slot0.hauteur * 0.55 };
    // Départ juste en dessous et à droite de la cible (≈ 250 px), arrivée PAR EN DESSOUS : le trajet ne passe sur aucun libellé.
    const dep0 = { x: Math.min(cible.x + 200 * s, W.x + W.largeur - 70 * s), y: Math.min(cible.y + 150 * s, C.y + C.hauteur - 95 * s) };
    poserCurseur(add, s, T, dep, tClic, dep0, cible, "ligne-1", 1500, 30 * s);
  }

  /* ---- Toast d'alerte : il part au déclencheur (glisse depuis la droite, la cloche s'agite) puis RESTE. Il a son emplacement dans
     la barre (à droite du titre) (la place du toast est réservée avant d'ajuster le titre) : il ne recouvre aucun texte et le titre reste visible. ---- */
  let banR: RectPx | null = null;
  if (evAlerte && toast && pIn > 0.001) {
    const { bt, bw, bh, pad, padV, ico, gap } = toast;
    const bx = W.x + W.largeur - 20 * s - bw;
    // Au repos : 20 px (19 en format compact) du filet de la barre ; le rebond (≈ 3,5 px vers le bas) laisse ≥ 16 px.
    const by = W.y + (barH - bh) / 2 - (compact ? 7.5 : 5) * s - (1 - eToast) * 14 * s;
    banR = { x: bx, y: by, largeur: bw, hauteur: bh };
    // Cloche : elle s'agite (balancement amorti horizontal, ± 5 px) pendant 900 ms après l'arrivée du toast.
    const tw = T - tDecl;
    // Tour 10 : ±8° ≈ 8 px de décalage horizontal, 3 oscillations en 600 ms, puis elle se calme.
    const agite = tw > 0 && tw < 900 ? Math.sin((2 * Math.PI * 3 * tw) / 600) * Math.max(0, 1 - Math.max(0, tw - 600) / 300) * 8 * s : 0;
    // Halo terracotta : un anneau qui grandit (≈ 30 px) et s'efface en 500 ms autour du toast, une seule fois.
    const hp = tw / 500;
    if (hp > 0 && hp < 1) add({ id: "halo-alerte", genre: "forme", rect: rectEnveloppe(banR, (4 + 26 * adoucir(hp)) * s), opacite: 0.9 * (1 - hp), contour: "terracotta", rayonPx: Math.min(22 * s, bh / 2) + (4 + 26 * adoucir(hp)) * s });
    add({ id: "alerte", genre: "forme", rect: banR, opacite: pIn, remplissage: "blanc", contour: "terracotta", rayonPx: Math.min(22 * s, bh / 2), ombre: true });
    add({ id: "alerte/cloche", genre: "forme", rect: { x: bx + pad + agite, y: by + (bh - ico) / 2, largeur: ico, hauteur: ico }, opacite: pIn, icone: "cloche", couleur: "terracotta", parentId: "alerte" });
    poserTexte(add, "alerte/texte", bt, bx + pad + ico + gap, by + padV, bw, { graisse: 600, couleur: "noir", parentId: "alerte", opacite: pIn });
  }

  /* ---- Mise en valeur (`focus`) : PAS de zoom. La cible s'éclaire (contour terracotta qui pulse, marge ≥ 6 px autour de la
     cible réelle), les autres parties s'atténuent à 0,75 ENSEMBLE avec leurs enfants. Le plus avancé à l'instant t l'emporte. ---- */
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
    const rectDe = (id: string): RectPx | null => els.find((e) => e.id === id)?.rect ?? null;
    let cible: "cartes" | "liste" | "panneau" | "alerte" | "ensemble" = foc.cible;
    if (cible === "panneau" && !evPanneau) cible = "liste";
    if (cible === "alerte" && !banR) cible = "ensemble";
    const union = (rs: RectPx[]): RectPx => {
      const x0 = Math.min(...rs.map((r) => r.x));
      const y0 = Math.min(...rs.map((r) => r.y));
      return { x: x0, y: y0, largeur: Math.max(...rs.map((r) => r.x + r.largeur)) - x0, hauteur: Math.max(...rs.map((r) => r.y + r.hauteur)) - y0 };
    };
    const cadre: RectPx = cible === "cartes" ? union(cadreCartes) : cible === "liste" ? (rectDe("liste") ?? W) : cible === "panneau" ? (rectDe("panneau") ?? W) : cible === "alerte" ? banR! : { ...W };
    if (cible !== "ensemble") {
      const f = 1 - (1 - OPACITE_ATTENUEE) * kMax;
      for (const e of els) {
        const gr = groupeDe(e.id);
        if (gr !== null && gr !== cible && e.genre !== "cible") e.opacite *= f;
      }
    }
    const marge = (cible === "ensemble" ? 0 : 8) * s;
    const pulse = 0.8 + 0.2 * Math.sin((2 * Math.PI * (T - foc.aMs)) / 800);
    add({ id: "focus-cadre", genre: "forme", rect: rectEnveloppe(cadre, marge), opacite: kMax * pulse, contour: "terracotta", rayonPx: 26 * s });
  }

  /* ---- Entrée de la fenêtre (montée + fondu) ---- */
  const wp = Math.max(pf, avancement(T, tS, 200));
  for (const e of els) entrer(e, wp, 8 * s);
  return els;
}

/* ------------------------------------------------------------------ */
/* Assemblage : scènes, transitions sans superposition, caméra          */
/* ------------------------------------------------------------------ */

/** Marge intérieure de la zone utile (px à 1080) : absorbe glissé, entrée, caméra et recul sans sortir du contenu. */
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

/** Caméra douce d'une scène : échelle 1 → 1,035 (en cloche, période ≤ 9 s) et dérive lente (≤ 6 px en x, ≤ 10 px en y). */
function camera(sc: SceneSansVoix, T: number, s: number): { e: number; dx: number; dy: number } {
  const duree = Math.max(1, sc.finMs - sc.debutMs);
  const periode = Math.min(2 * duree, CAMERA.periodeMs);
  const dt = Math.max(0, T - sc.debutMs);
  const k = 0.5 - 0.5 * Math.cos((2 * Math.PI * dt) / periode);
  // Scène écran : léger PUSH-IN continu (1 → 1,03 sur toute la scène, jamais de retour), la fenêtre garde sa marge dans le contenu.
  const e = sc.genre === "ecran" ? 1 + 0.03 * borne(dt / duree, 0, 1) : 1 + CAMERA.echelleMax * k;
  return {
    e,
    dx: CAMERA.deriveXPx * s * Math.sin((2 * Math.PI * dt) / 7300),
    dy: CAMERA.deriveYPx * s * Math.sin((2 * Math.PI * dt) / 5300 + 1),
  };
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
  // Seule la scène courante et, pendant 130 ms, la sortante : la sortante a fini de s'effacer AVANT que l'entrante n'affiche
  // du texte (entrée de +130 à +330 ms) : jamais deux textes superposés à plus de 0,15 d'opacité.
  const aTracer = idx > 0 && T < scenes[idx].debutMs + DUREES_MS.sortieScene ? [idx - 1, idx] : [idx];
  const sortie: Pose[] = [];
  for (const i of aTracer) {
    const sc = scenes[i];
    const entrant = i === idx;
    const premier = i === 0;
    let opacite = 1;
    let dy = 0;
    let recul = 1;
    if (!entrant) {
      const x = borne((T - scenes[idx].debutMs) / DUREES_MS.sortieScene, 0, 1);
      opacite = 1 - x;
      dy = -x * DUREES_MS.glisseTransitionPx * s;
      recul = 1 - DUREES_MS.reculSortie * x;
    } else if (!premier) {
      const y = borne((T - sc.debutMs - DUREES_MS.decalageEntreeScene) / DUREES_MS.entreeScene, 0, 1);
      const a = 1 - Math.pow(1 - y, 2);
      opacite = a;
      dy = (1 - a) * DUREES_MS.glisseTransitionPx * s;
    }
    const cam = camera(sc, T, s);
    const e = cam.e * recul;
    const ctx: Ctx = { T, s, U, C, pf: premier ? 1 : 0 };
    const cx = C.x + C.largeur / 2;
    const cy = C.y + C.hauteur / 2;
    for (const p of construire(ctx, sc)) {
      const r = p.rect;
      const rect: RectPx = { x: cx + (r.x - cx) * e + cam.dx, y: cy + (r.y - cy) * e + cam.dy + dy, largeur: r.largeur * e, hauteur: r.hauteur * e };
      const el: ElementVisible = { ...p, id: `${sc.id}/${p.id}`, rect, opacite: p.opacite * opacite, z: i * 10000 + p.z };
      if (p.parentId) el.parentId = `${sc.id}/${p.parentId}`;
      if (p.cibleId) el.cibleId = `${sc.id}/${p.cibleId}`;
      if (p.taillePx) el.taillePx = p.taillePx * e;
      if (p.pointe) el.pointe = { x: cx + (p.pointe.x - cx) * e + cam.dx, y: cy + (p.pointe.y - cy) * e + cam.dy + dy };
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
