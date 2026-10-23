/**
 * ANIMATION D'UN ÉCRAN DU STYLE « blocs/2 » : quand chaque chose entre et sort, quand le crayon trace, où il est,
 * quels bruitages tombent. Fonction PURE du temps (aucun hasard, aucune horloge) : même écran = même vidéo.
 *
 *  - Les entrées suivent les heures du calage (élément, élément de liste) ; un bloc de mot fort CLAQUE sur le mot dit
 *    quand les mots horodatés de la voix sont connus, sinon juste après sa ligne.
 *  - Quelque chose change à l'écran au moins toutes les `ECART_CHANGEMENT_MAX_MS` : sans entrée ni trait prévu, le
 *    dernier bloc (ou le dernier titre) « respire » (relance).
 *  - Le crayon trace un trait à la fois. Pour chaque trait, l'inclinaison retenue est la première dont l'image du crayon
 *    ne touche AUCUN mot visible ; s'il n'y en a pas, le trait se pose seul (sans crayon). Entre deux traits, le
 *    crayon glisse si le trajet ne passe sur aucun mot, sinon il disparaît et réapparaît. Au repos, il est couché dans
 *    sa bande libre, dans la zone sûre, et bouge à peine.
 *  - Bruitages : trait de crayon (traits sur les mots forts, croix, gribouillis), « toc » (numéro d'étape, mot de
 *    l'appel), validation (coches) ; deux sons jamais à moins de `ECART_SONS_MIN_MS`, jamais un son par mot.
 */
import { empreinteStylo, polygoneTouche } from "../../stylo/empreinte";
import { adoucir } from "../../stylo/courbes";
import { STYLO_PAR_DEFAUT, STYLOS } from "../../stylo/registre";
import type { Stylo } from "../../stylo/types";
import { SOURCE_FIN_VOIX, cleMotV2 } from "./disposition";
import type { EcranPlace, EntreeV2, FamilleBruitageV2, GeometrieV2, MotDitV2, PointV2, RectV2, TexteV2 } from "./types";

export const REGLAGES_ANIMATION_V2 = Object.freeze({
  /** Le mot claque une image avant le son. */
  avanceMs: 40,
  entreeMs: 330,
  claqueMs: 300,
  sortieMs: 200,
  /** Transition entre deux écrans (balayage du fond). */
  balayageMs: 270,
  /** Un cadre d'attente (case en pointillés, bulle) n'entre qu'au plus ceci avant ce qu'il attend. */
  attenteCadreMs: 900,
  /** Plus long écart permis sans changement à l'écran. */
  ecartChangementMaxMs: 1700,
  /** Relance (le bloc respire). */
  relanceMs: 320,
  /** Crayon : aller depuis le repos, retour, enchaînement direct entre deux traits proches. */
  allerMs: 260,
  retourMs: 300,
  enchaineMs: 650,
  /** Deux sons jamais plus proches ; deux sons de la même famille jamais plus proches. */
  ecartSonsMinMs: 180,
  ecartFamilleMinMs: 300,
  /** Inclinaisons essayées pour un trait (degrés ; 90 = corps à droite). */
  angles: Object.freeze([100, 112, 88, 125, 76, 140, 62, 155, 48, 170, 35, 185]),
});

export interface ApparitionV2 {
  debutMs: number;
  dureeMs: number;
  entree: EntreeV2;
  sortieMs?: number;
}

export interface TraitAnime {
  id: string;
  debutMs: number;
  dureeMs: number;
  /** Tracé avec le crayon (une inclinaison sûre a été trouvée). */
  crayon: boolean;
  angle: number;
}

export interface SonV2 {
  ms: number;
  famille: FamilleBruitageV2;
  source: string;
}

export interface RelanceV2 {
  id: string;
  ms: number;
}

export interface TrajetCrayon {
  /** Fin du trait d'avant (ou -∞ : depuis le repos) et début du trait suivant. */
  deMs: number;
  aMs: number;
  /** Trajet direct libre (sinon : disparaît, réapparaît). */
  libre: boolean;
}

export interface PlanEcranV2 {
  ecranId: string;
  debutMs: number;
  finMs: number;
  apparitions: Record<string, ApparitionV2>;
  traits: TraitAnime[];
  sons: SonV2[];
  relances: RelanceV2[];
  /** Instants où quelque chose change (contrôle du rythme). */
  changements: number[];
  /** Pour chaque trait du crayon : le trajet depuis le précédent (ou depuis le repos), libre ou non. */
  trajets: { versRepos: boolean[]; depuisRepos: boolean[]; direct: boolean[] };
}

export interface EntreeAnimationV2 {
  ecran: EcranPlace;
  geometrie: GeometrieV2;
  debutMs: number;
  finMs: number;
  /** Heures (ms) des sources : éléments de la fiche, éléments de liste, écrans. */
  heures: Readonly<Record<string, number>>;
  finVoixMs: number;
  mots?: readonly MotDitV2[];
  stylo?: string;
}

/* ------------------------------------------------------------------ */
/* Outils                                                                */
/* ------------------------------------------------------------------ */

const borne = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));

/** Boîte d'ENCRE d'un texte (sans l'interligne) : ce que le crayon ne doit jamais couvrir. */
export function encreTexte(t: Pick<TexteV2, "x" | "y" | "largeur" | "hauteur" | "taille" | "texte">): RectV2 {
  const bas = /[a-zà-ÿ,;]/.test(t.texte) ? 0 : 0.12 * t.taille;
  return { x: t.x, y: t.y + 0.12 * t.taille, largeur: t.largeur, hauteur: Math.max(1, t.hauteur - 0.12 * t.taille - bas) };
}

/** Longueur d'une polyligne. */
const longueur = (pts: readonly PointV2[]) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - pts[i].x, p.y - pts[i].y), 0);

/** Point à la fraction `u` (de la longueur totale) d'un trait à plusieurs segments. */
export function pointTrait(segments: readonly PointV2[][], u: number): PointV2 {
  const total = segments.reduce((s, seg) => s + longueur(seg), 0);
  let reste = borne(u) * total;
  for (const seg of segments) {
    const l = longueur(seg);
    if (reste <= l || seg === segments[segments.length - 1]) {
      for (let i = 1; i < seg.length; i++) {
        const d = Math.hypot(seg[i].x - seg[i - 1].x, seg[i].y - seg[i - 1].y);
        if (reste <= d || i === seg.length - 1) {
          const k = d ? borne(reste / d) : 1;
          return { x: seg[i - 1].x + (seg[i].x - seg[i - 1].x) * k, y: seg[i - 1].y + (seg[i].y - seg[i - 1].y) * k };
        }
        reste -= d;
      }
      return seg[seg.length - 1];
    }
    reste -= l;
  }
  const dernier = segments[segments.length - 1];
  return dernier[dernier.length - 1];
}

/** Longueur dessinée de chaque segment à la fraction `u` (rendu progressif du trait). */
export function avancementSegments(segments: readonly PointV2[][], u: number): number[] {
  const total = segments.reduce((s, seg) => s + longueur(seg), 0);
  let reste = borne(u) * total;
  return segments.map((seg) => {
    const l = longueur(seg);
    const v = Math.min(l, Math.max(0, reste));
    reste -= l;
    return v;
  });
}

function styloDe(id?: string): Stylo {
  return (STYLOS as Record<string, Stylo>)[id ?? STYLO_PAR_DEFAUT] ?? (STYLOS as Record<string, Stylo>)[STYLO_PAR_DEFAUT];
}

/** Empreinte du crayon (pointe en `p`, incliné de `angle`). */
export function empreinteCrayon(g: Pick<GeometrieV2, "hauteurCrayon">, p: PointV2, angle: number, stylo?: string): PointV2[] {
  return empreinteStylo(styloDe(stylo), p, g.hauteurCrayon, angle);
}

/* ------------------------------------------------------------------ */
/* Plan                                                                  */
/* ------------------------------------------------------------------ */

/** Heure (ms) d'un mot dit à partir de `depuis`, s'il est connu. */
function heureMot(mots: readonly MotDitV2[] | undefined, cle: string, depuis: number, jusqua: number): number | null {
  if (!mots || !cle) return null;
  for (const m of mots) {
    if (m.debutMs < depuis - 150 || m.debutMs > jusqua) continue;
    const c = cleMotV2(m.mot);
    if (c === cle || (cle.length >= 4 && c.startsWith(cle)) || c.replace(/^(l|d|j|n|s|c|qu)(?=[aeiouyh])/, "") === cle) return m.debutMs;
  }
  return null;
}

/**
 * Part du fil de progression à l'instant `t` (0 à 1) : `t` ÷ fin de la voix. `depart` (vertical dont la fin diffère de
 * la vidéo de référence, scènes communes reprises telles quelles) : avant `depart.ms`, le fil suit la vidéo de
 * référence (`t × part ÷ ms`) ; ensuite il repart de `depart.part` et finit plein à la fin de la voix. Jamais de saut.
 */
export function partFilV2(t: number, finVoixMs: number, depart?: { ms: number; part: number }): number {
  const borne = (x: number) => Math.max(0, Math.min(1, x));
  if (!depart || !(depart.ms > 0)) return borne(t / Math.max(1, finVoixMs));
  if (t <= depart.ms) return borne((t * depart.part) / depart.ms);
  return borne(depart.part + ((1 - depart.part) * (t - depart.ms)) / Math.max(1, finVoixMs - depart.ms));
}

/** Plan d'animation d'un écran. */
export function planifierEcranV2(e: EntreeAnimationV2): PlanEcranV2 {
  const R = REGLAGES_ANIMATION_V2;
  const { ecran, debutMs, finMs } = e;
  // Les morceaux de la ligne d'appel (« ~mot », « ~apres ») ont l'heure de leur ligne.
  const heureSource = (src: string) => e.heures[src] ?? e.heures[src.replace(/~(mot|apres)$/, "")];
  const heure = (src: string) => (src === ecran.id ? debutMs : src === SOURCE_FIN_VOIX ? e.finVoixMs + 150 : Math.max(debutMs, heureSource(src) ?? debutMs));
  const apparitions: Record<string, ApparitionV2> = {};

  // 1. Entrées des textes et des formes.
  const entreeDe = (x: { source: string; entree: EntreeV2; decalageMs?: number; motCle?: string; avant?: string; desLArrivee?: boolean }, texte?: string) => {
    // « Dès l'arrivée » : à l'heure de l'écran, quelle que soit celle de la source.
    let t = x.desLArrivee ? debutMs : heure(x.source);
    const premiere = ecran.premier && x.source !== SOURCE_FIN_VOIX && (x.desLArrivee || (heureSource(x.source) ?? debutMs) <= debutMs + 1);
    if (x.motCle && !x.desLArrivee) {
      const m = heureMot(e.mots, x.motCle, t, finMs);
      t = m !== null ? Math.max(debutMs, m - R.avanceMs) : t + 220;
    } else if (x.entree === "gauche" || x.entree === "claque") t = Math.max(debutMs, t - R.avanceMs);
    t += x.decalageMs ?? 0;
    // Premier écran : ce qui part au premier mot est là dès la première image.
    if (premiere && !x.motCle && !x.decalageMs) return { debutMs: debutMs, dureeMs: 0, entree: "aucune" as EntreeV2 };
    const duree = x.entree === "aucune" ? 0 : x.entree === "tape" ? 90 * Math.max(1, (texte ?? "").length) : x.entree === "claque" ? R.claqueMs : R.entreeMs;
    return { debutMs: Math.min(t, finMs), dureeMs: duree, entree: x.entree };
  };
  for (const t of ecran.textes) apparitions[t.id] = entreeDe(t, t.texte);
  for (const f of ecran.formes) apparitions[f.id] = entreeDe(f);

  // 2. Groupes de titres qui défilent : un groupe sort quand le suivant entre.
  if (ecran.groupes > 1) {
    const debutGroupe: number[] = [];
    for (const x of [...ecran.textes, ...ecran.formes]) if (x.groupe !== undefined) debutGroupe[x.groupe] = Math.min(debutGroupe[x.groupe] ?? Infinity, apparitions[x.id].debutMs);
    for (const x of [...ecran.textes, ...ecran.formes]) {
      if (x.groupe === undefined) continue;
      const suivant = debutGroupe[x.groupe + 1];
      if (suivant !== undefined && Number.isFinite(suivant)) apparitions[x.id].sortieMs = Math.max(apparitions[x.id].debutMs + 60, suivant - 80);
    }
  }

  // 3. Traits : à l'heure du mot (si connu) ou de la source, jamais avant leur texte ; le crayon un à la fois.
  const textesParSource = new Map<string, number>();
  for (const t of ecran.textes) textesParSource.set(t.source, Math.min(textesParSource.get(t.source) ?? Infinity, apparitions[t.id].debutMs));
  const brutes = ecran.traits.map((tr) => {
    let t = heure(tr.source) + tr.decalageMs;
    if (tr.motCle) {
      const m = heureMot(e.mots, tr.motCle, heure(tr.source), finMs);
      if (m !== null) t = m + 120;
    }
    const apparu = textesParSource.get(tr.source);
    if (apparu !== undefined && Number.isFinite(apparu)) t = Math.max(t, apparu + 180);
    return { tr, t: Math.min(t, finMs - tr.dureeMs - 40) };
  });
  brutes.sort((a, b) => a.t - b.t);
  let libreA = -Infinity;
  const traits: TraitAnime[] = [];
  for (const { tr, t } of brutes) {
    let debut = Math.max(t, debutMs + 60);
    if (tr.crayon) {
      debut = Math.max(debut, libreA + 120);
      libreA = debut + tr.dureeMs;
    }
    traits.push({ id: tr.id, debutMs: Math.round(debut), dureeMs: tr.dureeMs, crayon: tr.crayon, angle: 100 });
  }
  // Un trait dans un groupe qui sort est caché avec lui (rendu) ; il ne part jamais après la sortie du groupe.

  // 3 bis. Cadres d'attente : jamais vides plus de `attenteCadreMs` (ils arrivent juste avant ce qu'ils attendent).
  for (const f of [...ecran.formes, ...ecran.textes]) {
    if (!f.attend) continue;
    const vise = apparitions[f.attend]?.debutMs ?? traits.find((x) => x.id === f.attend)?.debutMs;
    if (vise === undefined) continue;
    const a = apparitions[f.id];
    if (vise - a.debutMs > R.attenteCadreMs) apparitions[f.id] = { ...a, debutMs: Math.min(finMs, Math.max(a.debutMs, vise - R.attenteCadreMs)) };
  }

  // 4. Inclinaison sûre de chaque trait du crayon (aucun mot visible touché).
  const visibles = (t: number) => motsVisibles(ecran, apparitions, t);
  for (const ta of traits) {
    if (!ta.crayon) continue;
    const tr = ecran.traits.find((x) => x.id === ta.id)!;
    const boites = [...visibles(ta.debutMs), ...visibles(ta.debutMs + ta.dureeMs)];
    // Le crayon oscille de ±4° en traçant : toute l'oscillation est vérifiée.
    const angle = R.angles.find((a) => [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1].every((u) => [a - 4, a, a + 4].every((b) => libreDe(empreinteCrayon(e.geometrie, pointTrait(tr.segments, u), b, e.stylo), boites, e.geometrie))));
    if (angle === undefined) ta.crayon = false;
    else ta.angle = angle;
  }

  // 5. Trajets du crayon.
  const duCrayon = traits.filter((t) => t.crayon);
  const trajets = { versRepos: [] as boolean[], depuisRepos: [] as boolean[], direct: [] as boolean[] };
  const repos = { x: e.geometrie.repos.x, y: e.geometrie.repos.y };
  duCrayon.forEach((ta, i) => {
    const tr = ecran.traits.find((x) => x.id === ta.id)!;
    const debut = pointTrait(tr.segments, 0);
    const fin = pointTrait(tr.segments, 1);
    const b1 = [...visibles(ta.debutMs - R.allerMs), ...visibles(ta.debutMs)];
    trajets.depuisRepos.push(trajetLibre(e, repos, e.geometrie.repos.angle, debut, ta.angle, b1));
    const b2 = [...visibles(ta.debutMs + ta.dureeMs), ...visibles(ta.debutMs + ta.dureeMs + R.retourMs)];
    trajets.versRepos.push(trajetLibre(e, fin, ta.angle, repos, e.geometrie.repos.angle, b2));
    const suiv = duCrayon[i + 1];
    if (suiv) {
      const trS = ecran.traits.find((x) => x.id === suiv.id)!;
      const b3 = [...visibles(ta.debutMs + ta.dureeMs), ...visibles(suiv.debutMs)];
      trajets.direct.push(trajetLibre(e, fin, ta.angle, pointTrait(trS.segments, 0), suiv.angle, b3, 30 * e.geometrie.k));
    }
  });

  // 6. Bruitages, sans excès.
  const candidats: SonV2[] = [];
  for (const ta of traits) {
    const tr = ecran.traits.find((x) => x.id === ta.id)!;
    if (tr.son) candidats.push({ ms: Math.round(ta.debutMs + (tr.son === "validation" ? ta.dureeMs * 0.8 : 10)), famille: tr.son, source: tr.id });
  }
  for (const f of ecran.formes) if (f.son) candidats.push({ ms: Math.round(apparitions[f.id].debutMs + 60), famille: f.son, source: f.id });
  // Le mot de l'appel (grand bloc) : un « toc ».
  for (const f of ecran.formes) if (f.sorte === "bloc" && f.source.endsWith("~mot")) candidats.push({ ms: Math.round(apparitions[f.id].debutMs + 60), famille: "toc", source: f.id });
  candidats.sort((a, b) => a.ms - b.ms);
  const sons: SonV2[] = [];
  for (const s of candidats) {
    if (s.ms < debutMs || s.ms > finMs) continue;
    const prec = sons[sons.length - 1];
    if (prec && s.ms - prec.ms < R.ecartSonsMinMs) continue;
    const meme = [...sons].reverse().find((x) => x.famille === s.famille);
    if (meme && s.ms - meme.ms < R.ecartFamilleMinMs) continue;
    sons.push(s);
  }

  // 7. Changements et relances.
  const changements = new Set<number>([debutMs]);
  for (const a of Object.values(apparitions)) {
    if (a.entree !== "aucune" && a.debutMs > debutMs) changements.add(Math.round(a.debutMs));
    if (a.sortieMs !== undefined) changements.add(Math.round(a.sortieMs));
  }
  for (const t of traits) changements.add(t.debutMs);
  const relances: RelanceV2[] = [];
  const cibles = (t: number) => {
    const blocs = ecran.formes.filter((f) => (f.sorte === "bloc" || f.sorte === "numero" || f.sorte === "bouton") && visibleA(apparitions[f.id], t));
    if (blocs.length) return blocs.sort((a, b) => apparitions[b.id].debutMs - apparitions[a.id].debutMs)[0].id;
    const ts = ecran.textes.filter((x) => !x.horsContenu && x.police === "titre" && visibleA(apparitions[x.id], t));
    return ts.length ? ts.sort((a, b) => b.taille - a.taille)[0].id : null;
  };
  const tries = [...changements].sort((a, b) => a - b);
  const pts = [...tries.filter((t) => t >= debutMs && t <= finMs), finMs];
  for (let i = 1; i < pts.length; i++) {
    let t = pts[i - 1];
    while (pts[i] - t > R.ecartChangementMaxMs) {
      t += Math.min(1300, (pts[i] - t) / 2);
      const id = cibles(t);
      if (!id) break;
      relances.push({ id, ms: Math.round(t) });
      changements.add(Math.round(t));
    }
  }
  return { ecranId: ecran.id, debutMs, finMs, apparitions, traits, sons, relances, changements: [...changements].sort((a, b) => a - b), trajets };
}

const visibleA = (a: ApparitionV2 | undefined, t: number) => !!a && t >= a.debutMs && (a.sortieMs === undefined || t < a.sortieMs);

/** Boîtes d'encre des mots visibles à l'instant `t` (un mot en contour ou estompé compte aussi). */
export function motsVisibles(ecran: EcranPlace, apparitions: Record<string, ApparitionV2>, t: number): RectV2[] {
  return ecran.textes
    .filter((x) => {
      const a = apparitions[x.id];
      if (!a) return false;
      if (a.sortieMs !== undefined && t >= a.sortieMs) return false;
      return t >= a.debutMs || x.avant === "contour" || x.avant === "estompe";
    })
    .map((x) => encreTexte(x));
}

function libreDe(poly: PointV2[], boites: RectV2[], g: GeometrieV2): boolean {
  if (!poly.every((q) => q.x >= 0 && q.y >= 0 && q.x <= g.largeur && q.y <= g.hauteur)) return false;
  return !boites.some((b) => polygoneTouche(poly, b));
}

function trajetLibre(e: EntreeAnimationV2, a: PointV2, angA: number, b: PointV2, angB: number, boites: RectV2[], arc = 0): boolean {
  // Pas fin (40 points) et léger balancement du repos (± 1,5°, 3 px) : le trajet vérifié est celui qui est dessiné.
  for (let i = 0; i <= 40; i++) {
    const u = i / 40;
    for (const [da, dy] of [[0, 0], [-1.5, -3], [1.5, 3]]) {
      const p = { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u - arc * Math.sin(Math.PI * u) + dy * e.geometrie.k };
      if (!libreDe(empreinteCrayon(e.geometrie, p, angA + (angB - angA) * u + da, e.stylo), boites, e.geometrie)) return false;
    }
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* Pose du crayon                                                        */
/* ------------------------------------------------------------------ */

export interface PoseCrayonV2 {
  x: number;
  y: number;
  angle: number;
  opacite: number;
}

/** Où est le crayon à l'instant `t` (ms). */
export function poseCrayonV2(plan: PlanEcranV2, ecran: EcranPlace, g: GeometrieV2, t: number): PoseCrayonV2 {
  const R = REGLAGES_ANIMATION_V2;
  const k = g.k;
  const repos = { x: g.repos.x, y: g.repos.y + 3 * k * Math.sin((t / 1000) * Math.PI), angle: g.repos.angle + 1.2 * Math.sin((t / 1000) * 1.3) };
  const reposPose: PoseCrayonV2 = { ...repos, opacite: 1 };
  const traits = plan.traits.filter((x) => x.crayon);
  const seg = (id: string) => ecran.traits.find((x) => x.id === id)!.segments;
  const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
  for (let i = 0; i < traits.length; i++) {
    const ta = traits[i];
    const fin = ta.debutMs + ta.dureeMs;
    if (t >= ta.debutMs && t <= fin) {
      const u = adoucir((t - ta.debutMs) / Math.max(1, ta.dureeMs));
      const p = pointTrait(seg(ta.id), u);
      return { x: p.x, y: p.y, angle: ta.angle + 4 * Math.sin(u * Math.PI * 2), opacite: 1 };
    }
    const suiv = traits[i + 1];
    // Enchaînement direct entre deux traits proches.
    if (suiv && t > fin && t < suiv.debutMs && suiv.debutMs - fin <= R.enchaineMs) {
      const a = pointTrait(seg(ta.id), 1);
      const b = pointTrait(seg(suiv.id), 0);
      const u = adoucir((t - fin) / (suiv.debutMs - fin));
      if (plan.trajets.direct[i]) return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) - 30 * k * Math.sin(Math.PI * u), angle: lerp(ta.angle, suiv.angle, u), opacite: 1 };
      // Trajet qui passerait sur un mot : le crayon disparaît d'un coup et réapparaît juste avant le trait suivant.
      return u < 0.75 ? { x: a.x, y: a.y, angle: ta.angle, opacite: 0 } : { x: b.x, y: b.y, angle: suiv.angle, opacite: (u - 0.75) * 4 };
    }
  }
  // Aller vers le prochain trait, ou retour au repos après le dernier.
  const suivant = traits.find((x) => x.debutMs > t);
  const kS = suivant ? traits.indexOf(suivant) : -1;
  const precedent = [...traits].reverse().find((x) => x.debutMs + x.dureeMs < t);
  const kP = precedent ? traits.indexOf(precedent) : -1;
  if (suivant && suivant.debutMs - t <= R.allerMs && !(precedent && suivant.debutMs - (precedent.debutMs + precedent.dureeMs) <= R.enchaineMs)) {
    const b = pointTrait(seg(suivant.id), 0);
    const u = adoucir(1 - (suivant.debutMs - t) / R.allerMs);
    if (plan.trajets.depuisRepos[kS]) return { x: lerp(repos.x, b.x, u), y: lerp(repos.y, b.y, u), angle: lerp(repos.angle, suivant.angle, u), opacite: 1 };
    return u < 0.5 ? { ...reposPose, opacite: 1 - u * 2 } : { x: b.x, y: b.y, angle: suivant.angle, opacite: u < 0.75 ? 0 : (u - 0.75) * 4 };
  }
  if (precedent) {
    const fin = precedent.debutMs + precedent.dureeMs;
    if (t - fin <= R.retourMs) {
      const a = pointTrait(seg(precedent.id), 1);
      const u = adoucir((t - fin) / R.retourMs);
      if (plan.trajets.versRepos[kP]) return { x: lerp(a.x, repos.x, u), y: lerp(a.y, repos.y, u), angle: lerp(precedent.angle, repos.angle, u), opacite: 1 };
      return u < 0.5 ? { x: a.x, y: a.y, angle: precedent.angle, opacite: 0 } : { ...reposPose, opacite: (u - 0.5) * 2 };
    }
  }
  return reposPose;
}
