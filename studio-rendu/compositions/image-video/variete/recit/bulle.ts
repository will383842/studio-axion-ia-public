/**
 * REC-C · où se pose la bulle du message (« 23h14 »). PUR : aucun JSX, aucun Remotion (les tests l'appellent directement).
 *
 * Défaut corrigé le 23/10/2026 (relecture finale de v-6e4a06b9c718) : la bulle visait « au-dessus du nœud », puis était
 * ramenée de force dans le cadre lisible ; quand la caméra zoome sur un nœud, elle atterrissait SUR son titre
 * (« Chatbot IA », « Envoyée en 4 sec », « Client informé : »), dessinée par-dessus. Désormais : quatre places essayées
 * dans l'ordre (au-dessus, à droite, à gauche, en dessous du nœud suivi) ; une place ne vaut que si la bulle (queue
 * comprise) tient dans le cadre lisible ET ne recouvre AUCUN nœud dessiné ni aucune pastille de part, à l'écran,
 * à l'instant demandé (une carte pas encore dite n'est qu'une silhouette sans texte : la bulle peut passer devant). Aucune place ne convient : `null`, la bulle n'est pas dessinée (elle est décorative, « 23h14 »
 * reste écrit dans le premier nœud). Jamais de ramenage de force sur un autre élément.
 */
import { cameraA, ECRAN_IV } from "../../../../../src/briques/schema-motion";
import { TEMPS_IV } from "../../../../../src/briques/schema-motion/temps";
import type { SceneCalculee } from "../../plan";

/** Corps de la bulle (pixels de l'écran de référence 1080 × 1920) et hauteur de sa queue (`Bulle` : 28 % de la hauteur). */
export const BULLE = Object.freeze({ l: 330, h: 140, queue: 39 });
/** Cadre où le corps de la bulle reste lisible : sous l'en-tête (haut du cadre de la toile), hors des zones protégées (doc 74 § 3), au-dessus des sous-titres. */
export const CADRE = Object.freeze({ gauche: 65, droite: 886, haut: 540, bas: 1110 });
/** Respiration autour de la bulle (rotation de 4°, ombre, queue) : aucun nœud ni pastille ne doit entrer dans ce rectangle. */
export const MARGE_BULLE = 12;
/** Écart voulu entre la bulle et le nœud suivi quand elle se pose à côté de lui. */
const ECART = 20;
/** Distance entre le haut de la bulle et le haut du nœud quand elle se pose au-dessus : corps, queue (qui pointe vers lui), marge et 2 px d'air. */
const HAUTEUR_AU_DESSUS = BULLE.h + BULLE.queue + MARGE_BULLE + 2;
const DEPLACEMENT_S = 0.5;

type Rect = { x: number; y: number; l: number; h: number };
type Scene = Pick<SceneCalculee, "trajectoire" | "parId" | "cadrage" | "premierMot">;

const doux = (x: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
const entre = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Pas (pixels) du balayage des places d'un côté du nœud. */
const PAS = 8;

/** Valeurs voulues (ramenées dans [min, max]), puis tout [min, max] au pas `PAS`, du plus proche de la première au plus loin. */
function glissements(voulues: readonly number[], min: number, max: number): number[] {
  const premiere = entre(voulues[0]!, min, max);
  const reste: number[] = [];
  for (let v = min; v <= max + 1e-9; v += PAS) reste.push(v);
  reste.sort((a, b) => Math.abs(a - premiere) - Math.abs(b - premiere) || a - b);
  return [...voulues.map((v) => entre(v, min, max)), ...reste];
}

/** Le nœud suivi à l'instant `t` (le dernier du parcours dont la voix a commencé à parler) et l'heure de ce passage. */
export function noeudSuivi(scene: Pick<SceneCalculee, "premierMot" | "parId">, parcours: readonly string[], depart: string, t: number): { courant: string; precedent: string | null; depuis: number } {
  const passages = parcours
    .filter((id) => scene.parId.has(id) && scene.premierMot.has(id))
    .map((id) => ({ id, t: scene.premierMot.get(id)! - TEMPS_IV.avanceNoeud }))
    .sort((x, y) => x.t - y.t);
  let courant = scene.parId.has(depart) ? depart : (passages[0]?.id ?? depart);
  let precedent: string | null = null;
  let depuis = -Infinity;
  for (const p of passages) {
    if (p.t > t) break;
    if (p.id === courant) continue;
    precedent = courant;
    courant = p.id;
    depuis = p.t;
  }
  return { courant, precedent, depuis };
}

/** Rectangle occupé à l'écran (hors marge) par une bulle dont le coin haut-gauche est en (x, y) : corps + queue. */
export function empriseBulle(x: number, y: number): Rect {
  return { x, y, l: BULLE.l, h: BULLE.h + BULLE.queue };
}

/** Deux rectangles se recouvrent-ils (bords qui se touchent : non) ? */
export function seRecouvrent(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.l && b.x < a.x + a.l && a.y < b.y + b.h && b.y < a.y + a.h;
}

/**
 * Rectangles, À L'ÉCRAN et à l'instant `t`, de ce que la bulle ne doit jamais recouvrir : les nœuds DESSINÉS (dits depuis
 * `premierMot - avanceNoeud`, ou déjà vus avant la séquence : sans heure de mot) et les pastilles de part. Un nœud pas
 * encore dit n'est qu'une carte éteinte sans texte (schéma muet) : la bulle peut passer devant. Position = celle de la
 * toile passée par la caméra (`cameraA`), comme `Camera.tsx`.
 */
export function obstaclesEcran(scene: Scene, t: number): { id: string; rect: Rect }[] {
  const pose = cameraA(scene.trajectoire, t);
  const ecran = (r: Rect): Rect => ({ x: (r.x - pose.cx) * pose.zoom + ECRAN_IV.largeur / 2, y: (r.y - pose.cy) * pose.zoom + ECRAN_IV.hauteur / 2, l: r.l * pose.zoom, h: r.h * pose.zoom });
  const liste: { id: string; rect: Rect }[] = [];
  for (const [id, b] of scene.parId) {
    const dit = scene.premierMot.get(id);
    if (dit !== undefined && t < dit - TEMPS_IV.avanceNoeud) continue;
    liste.push({ id, rect: ecran({ x: b.x, y: b.y, l: b.largeur, h: b.hauteur }) });
  }
  for (const e of scene.cadrage.etiquettes ?? []) liste.push({ id: e.id, rect: ecran({ x: e.x, y: e.y, l: e.largeur, h: e.hauteur }) });
  return liste;
}

/** La bulle posée en (x, y) tient-elle dans le cadre lisible et ne recouvre-t-elle aucun obstacle (marge comprise) ? */
function convient(x: number, y: number, obstacles: readonly { rect: Rect }[]): boolean {
  if (x < CADRE.gauche - 1e-6 || x + BULLE.l > CADRE.droite + 1e-6 || y < CADRE.haut - 1e-6 || y + BULLE.h > CADRE.bas + 1e-6) return false;
  const zone = empriseBulle(x - MARGE_BULLE, y - MARGE_BULLE);
  zone.l += 2 * MARGE_BULLE;
  zone.h += 2 * MARGE_BULLE;
  return !obstacles.some((o) => seRecouvrent(zone, o.rect));
}

/** Premier candidat qui convient, ou `null`. */
function premier(candidats: readonly { x: number; y: number }[], obstacles: readonly { rect: Rect }[]): { x: number; y: number } | null {
  return candidats.find((c) => convient(c.x, c.y, obstacles)) ?? null;
}

/**
 * Coin haut-gauche de la bulle, à l'écran, à côté du nœud `id` à l'instant `t` ; `null` si aucune des quatre places
 * (au-dessus, à droite, à gauche, en dessous, dans cet ordre) ne tient dans le cadre sans recouvrir un nœud ou une
 * pastille de part : la bulle n'est alors pas dessinée.
 */
export function placeBulleRecitC(scene: Scene, id: string, t: number): { x: number; y: number } | null {
  const b = scene.parId.get(id);
  if (!b) return null;
  const obstacles = obstaclesEcran(scene, t);
  const pose = cameraA(scene.trajectoire, t);
  const cible: Rect = { x: (b.x - pose.cx) * pose.zoom + ECRAN_IV.largeur / 2, y: (b.y - pose.cy) * pose.zoom + ECRAN_IV.hauteur / 2, l: b.largeur * pose.zoom, h: b.hauteur * pose.zoom };
  const droite = cible.x + cible.l;
  const bas = cible.y + cible.h;
  // Sur chaque côté, la place voulue d'abord, puis le reste de la course permise, de la plus proche à la plus lointaine
  // (la bulle se glisse entre deux pastilles ou contre un bord plutôt que de disparaître).
  const colonnes = glissements([cible.x + cible.l / 2 - BULLE.l * 0.2, cible.x, droite - BULLE.l], CADRE.gauche, CADRE.droite - BULLE.l);
  const lignes = glissements([cible.y, cible.y + cible.h / 2 - BULLE.h / 2, bas - BULLE.h], CADRE.haut, CADRE.bas - BULLE.h);
  const dessus = colonnes.map((x) => ({ x, y: cible.y - HAUTEUR_AU_DESSUS }));
  const adroite = lignes.map((y) => ({ x: droite + ECART, y }));
  const agauche = lignes.map((y) => ({ x: cible.x - ECART - BULLE.l, y }));
  const dessous = colonnes.map((x) => ({ x, y: bas + ECART }));
  return premier(dessus, obstacles) ?? premier(adroite, obstacles) ?? premier(agauche, obstacles) ?? premier(dessous, obstacles);
}

/**
 * Coin haut-gauche de la bulle à l'instant `t` : posée à côté du nœud suivi ; entre deux nœuds, elle glisse de l'un à
 * l'autre (`DEPLACEMENT_S`) en suivant la caméra. `null` (rien à dessiner) si l'une des deux places manque pendant le
 * déplacement, si la place d'arrivée manque après, ou si la bulle, en chemin, passerait sur un nœud ou une pastille.
 */
export function positionBulleRecitC(scene: Scene, parcours: readonly string[], depart: string, t: number): { x: number; y: number } | null {
  const s = noeudSuivi(scene, parcours, depart, t);
  const ici = placeBulleRecitC(scene, s.courant, t);
  if (!ici) return null;
  const u = doux((t - s.depuis) / DEPLACEMENT_S);
  if (!s.precedent || u >= 1) return ici;
  const avant = placeBulleRecitC(scene, s.precedent, t);
  if (!avant) return null;
  const p = { x: avant.x + (ici.x - avant.x) * u, y: avant.y + (ici.y - avant.y) * u };
  return convient(p.x, p.y, obstaclesEcran(scene, t)) ? p : null;
}
