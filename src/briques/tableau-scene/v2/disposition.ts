/**
 * DISPOSITION D'UN ÉCRAN DU STYLE « blocs/2 » : description (tirée de la fiche) + géométrie du format → textes,
 * formes et traits posés en pixels. PUR, déterministe, sans alias « @/ » : même écran = même disposition.
 *
 *  - Titres : Montserrat ExtraBold, chacun ajusté à la largeur (le plus gros possible, 3 rangées au plus) ; les mots
 *    forts dans un bloc (orange sur l'encre et l'ivoire, encre sur l'orange, texte ivoire) ; les mots importants
 *    soulignés au crayon. Jamais un mot coupé : une rangée ne se coupe qu'entre deux mots, et un mot qui ne tient pas
 *    fait réduire la taille.
 *  - Les titres d'un écran tiennent TOUS ensemble au-dessus du corps (ou à côté), plus petits s'il le faut : aucun ne
 *    défile (un titre chassé par le suivant ne se relit pas). Défilement seulement en dernier recours, si rien ne tient.
 *  - Corps : un gabarit réutilisable (cases barrées, compteur, conversation, idée reçue, cartes d'étape, liste qui se
 *    remplit, semaine, avant / après, récapitulatif à coches, bulle de commentaire, appel de diagnostic). Il remplit la
 *    place restante : jamais d'écran presque vide. Ce qui arrive plus tard est déjà là en pointillés ou estompé.
 *  - Textes et traits dans le contenu (zone sûre) ; seules des formes sans texte débordent (carte, grand chiffre en
 *    contour sous les sous-titres).
 *  - Aucun personnage, aucune main : seulement du texte, des formes, les pictogrammes d’objets de la banque et le crayon.
 */
import { largeurEcrite, type PoliceEcriture } from "../../stylo/mesure-ecriture";
import {
  BLOC_SUR,
  CONTOUR_SUR,
  COULEURS_V2,
  EPAISSEURS_V2,
  INTERLIGNE_V2,
  SIGNATURE_V2,
  TAILLES_V2,
  TAILLE_GRANDE_REF,
  TEXTE_SECOND_SUR,
  TEXTE_SUR,
  TRAIT_SUR,
  type FondV2,
} from "./charte";
import { TRACES_DESSINS } from "../../dessins/traces";
import { partVideEcranV2, plusGrandVideV2, VIDE_MAX_ECRAN, zoneUtileV2 } from "./remplissage";
import type { DescriptionEcran, EcranPlace, EtapeBarre, FormeV2, GeometrieV2, PointV2, RectV2, TexteV2, TitreDecrit, TraitV2 } from "./types";

/** Source spéciale : la fin de la voix (signature en grand, sous-titres effacés). */
export const SOURCE_FIN_VOIX = "~fin-voix";

export class ErreurDispositionV2 extends Error {
  constructor(
    message: string,
    readonly ecranId: string,
  ) {
    super(message);
    this.name = "ErreurDispositionV2";
  }
}

/** Mot sans casse, sans accent, sans ponctuation (« L’IA » → « lia »). */
export const cleMotV2 = (m: string) =>
  m
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

const r1 = (v: number) => Math.round(v * 10) / 10;
const mesurer = (t: string, police: PoliceEcriture, taille: number) => largeurEcrite(t, police, taille, 0);
const majuscules = (t: string) => t.toLocaleUpperCase("fr-FR");
const typo = (t: string) => t.replace(/'/g, "’");

/* ------------------------------------------------------------------ */
/* Coupure d'un texte simple (libellés)                                  */
/* ------------------------------------------------------------------ */

/** Coupe un texte en rangées d'au plus `largeur` ; null si un mot ne tient pas ou s'il faut plus de `maxRangees`. */
export function couper(texte: string, police: PoliceEcriture, taille: number, largeur: number, maxRangees: number): string[] | null {
  // Un signe isolé (« ? », « : », « » ») reste avec le mot qui le précède : jamais seul sur sa rangée.
  const mots: string[] = [];
  for (const m of texte.split(/\s+/).filter(Boolean)) {
    if (mots.length && !/[\p{L}\p{N}]/u.test(m) && m !== "«") mots[mots.length - 1] += ` ${m}`;
    else mots.push(m);
  }
  const rangees: string[] = [];
  let cour = "";
  for (const m of mots) {
    if (mesurer(m, police, taille) > largeur) return null;
    const essai = cour ? `${cour} ${m}` : m;
    if (mesurer(essai, police, taille) <= largeur) cour = essai;
    else {
      rangees.push(cour);
      cour = m;
    }
  }
  if (cour) rangees.push(cour);
  return rangees.length <= maxRangees ? rangees : null;
}

/** La plus grande taille (pas de 1 px) où le texte tient dans la boîte ; null si même `min` ne tient pas. */
export function ajuster(texte: string, police: PoliceEcriture, max: number, min: number, largeur: number, hauteur: number, maxRangees: number, interligne: number): { taille: number; rangees: string[] } | null {
  for (let t = Math.floor(max); t >= Math.min(Math.floor(max), Math.ceil(min)); t--) {
    const rg = couper(texte, police, t, largeur, maxRangees);
    if (rg && rg.length * t * interligne <= hauteur + 0.5) return { taille: t, rangees: rg };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Titres                                                                */
/* ------------------------------------------------------------------ */

interface Jeton {
  aff: string;
  cle: string;
  fort: boolean;
  souligne: boolean;
}

/** Jetons d'un titre : un signe isolé reste collé à son mot (« : », « » », « « »). */
function jetons(t: TitreDecrit): Jeton[] {
  const brut = typo(t.texte).split(/\s+/).filter(Boolean);
  const unites: string[] = [];
  for (const m of brut) {
    if (unites.length && !/[\p{L}\p{N}]/u.test(m) && m !== "«") unites[unites.length - 1] += ` ${m}`;
    else unites.push(m);
  }
  // « « » s'accroche au mot suivant.
  const final: string[] = [];
  for (let i = 0; i < unites.length; i++) {
    if (unites[i] === "«" && i + 1 < unites.length) {
      final.push(`« ${unites[i + 1]}`);
      i++;
    } else final.push(unites[i]);
  }
  const forts = new Set(t.forts);
  const soul = new Set(t.soulignes);
  return final.map((m) => {
    const cle = cleMotV2(m);
    return { aff: t.niveau === "titre" ? majuscules(m) : m, cle, fort: !!cle && forts.has(cle), souligne: t.souligneTout || (!!cle && soul.has(cle)) };
  });
}

interface JetonPlace extends Jeton {
  x: number;
  l: number;
}

interface Rangee {
  jetons: JetonPlace[];
  largeur: number;
  /** Taille de la rangée (chaque rangée d'un titre est ajustée à la largeur, comme la vidéo modèle). */
  s?: number;
}

const padBloc = (s: number) => 0.16 * s;

/** Premier mot du bloc (suite de mots forts) qui contient le mot `i`. */
function debutBloc(js: readonly Jeton[], i: number): Jeton {
  let k = i;
  while (k > 0 && js[k - 1].fort) k--;
  return js[k];
}

/** Rangées d'un titre à la taille `s` dans la largeur `w` ; null si un mot (ou un bloc) ne tient pas. */
function rangeesTitre(js: Jeton[], s: number, w: number): Rangee[] | null {
  const esp = mesurer(" ", "titre", s);
  const pad = padBloc(s);
  const rangees: Rangee[] = [];
  let cour: JetonPlace[] = [];
  const fin = (j: JetonPlace) => j.x + j.l + (j.fort ? pad : 0);
  for (const j of js) {
    const l = mesurer(j.aff, "titre", s);
    if (l + (j.fort ? 2 * pad : 0) > w) return null;
    const prec = cour[cour.length - 1];
    let xj = !prec ? (j.fort ? pad : 0) : prec.fort && j.fort ? prec.x + prec.l + esp : prec.x + prec.l + (prec.fort ? pad : 0) + esp + (j.fort ? pad : 0);
    if (prec && xj + l + (j.fort ? pad : 0) > w) {
      // Un bloc (suite de mots forts) ne se coupe jamais : ses premiers mots passent avec lui à la rangée suivante.
      let n = 0;
      if (j.fort) while (n < cour.length - 1 && cour[cour.length - 1 - n].fort) n++;
      const reportes = n ? cour.splice(cour.length - n, n) : [];
      rangees.push({ jetons: cour, largeur: fin(cour[cour.length - 1]) });
      cour = [];
      let x0 = 0;
      for (const r of reportes) {
        const xr = cour.length ? x0 + esp : pad;
        cour.push({ ...r, x: xr });
        x0 = xr + r.l;
      }
      xj = cour.length ? x0 + esp : j.fort ? pad : 0;
      if (xj + l + (j.fort ? pad : 0) > w) return null;
    }
    cour.push({ ...j, x: xj, l });
  }
  if (cour.length) rangees.push({ jetons: cour, largeur: fin(cour[cour.length - 1]) });
  return rangees;
}

const ecartRangee = (t: TitreDecrit, s: number, k: number) => (t.niveau === "titre" ? Math.max(0.16 * s, 22 * k) : Math.max(0.12 * s, 18 * k));
const interligneDe = (t: TitreDecrit) => (t.niveau === "titre" ? INTERLIGNE_V2.titre : INTERLIGNE_V2.texte);
const ecartTitres = (s: number, k: number) => Math.max(0.24 * s, 22 * k);

interface TitreAjuste {
  t: TitreDecrit;
  s: number;
  rangees: Rangee[];
  hauteur: number;
}

/**
 * Plancher de lisibilité des petits textes (px de référence) : l'étiquette de section, le plus petit texte du style, et
 * le seuil du contrôle de la taille du texte. Aucun libellé n'est posé plus petit (avant : 24 ou 26 px permis ici, que
 * le contrôle refusait ensuite).
 */
const PLANCHER_LIBELLE = TAILLES_V2.etiquette;

/** Interligne resserré d'un libellé qui ne tient pas autrement (au lieu de `INTERLIGNE_V2.libelle`). */
const INTERLIGNE_LIBELLE_SERRE = 1.04;

/** Taille maximale des titres (px de référence) : `TAILLES_V2.titreMax`, plus grande quand l'écran grandit son texte. */
let titreMaxCourant: number = TAILLES_V2.titreMax;
/** Pas de croissance de l'écran en cours (0 : tailles ordinaires) ; lu par les corps (panneaux, cartes, lignes). */
let croissanceCourante = 0;

/** Tailles planchers des titres (px de l'image) : réglées par écran (colonne étroite, fond orange). */
let planchers: { titre: number; texte: number } = { titre: TAILLES_V2.titreMin, texte: TAILLES_V2.texteMin };

/** Ajuste un titre : la plus grande taille ≤ `plafond` en 3 rangées au plus. */
function ajusterTitre(t: TitreDecrit, w: number, plafond: number, k: number, maxTaille?: number, croissance = true): TitreAjuste | null {
  const max = Math.min(plafond, maxTaille ?? (t.niveau === "titre" ? titreMaxCourant : TAILLES_V2.texteMax) * k);
  const min = (t.niveau === "titre" ? planchers.titre : planchers.texte) * k;
  const js = jetons(t);
  for (let s = Math.floor(max); s >= Math.ceil(min); s -= 1) {
    const rg = rangeesTitre(js, s, w);
    // Trois rangées au plus ; quatre quand l'écran grandit son texte (une ligne qui remplit sa colonne).
    if (rg && rg.length <= (croissanceCourante ? 4 : 3)) {
      // Chaque rangée d'un titre grandit jusqu'à la largeur (« DES RÉPONSES » / « PLATES »), sans dépasser la taille
      // maximale ni 1,6 fois la taille commune (la hauteur, mesurée après, tient dans le budget) ; les positions suivent
      // (pas de crénage : largeur ∝ taille).
      const rangees = rg.map((r): Rangee => {
        const sr = t.niveau === "titre" && croissance ? Math.max(s, Math.min(s * (w / r.largeur), Math.max(s, Math.min(titreMaxCourant * k, maxTaille ?? Infinity, s * 1.6)))) : s;
        const f = sr / s;
        return { jetons: r.jetons.map((j) => ({ ...j, x: j.x * f, l: j.l * f })), largeur: r.largeur * f, s: Math.floor(sr * 10) / 10 };
      });
      const hauteur = rangees.reduce((h, r, i) => h + r.s! * interligneDe(t) + (i ? ecartRangee(t, r.s!, k) : 0), 0);
      return { t, s, rangees, hauteur };
    }
  }
  return null;
}

/** Ajuste une suite de titres dans `w` × `budget` : plafond commun abaissé jusqu'à ce que tout tienne ; null sinon. */
function ajusterSuite(ts: TitreDecrit[], w: number, budget: number, k: number, maxTaille?: (t: TitreDecrit) => number | undefined): { titres: TitreAjuste[]; hauteur: number } | null {
  if (!ts.length) return { titres: [], hauteur: 0 };
  // Avec les rangées qui grandissent (« DES RÉPONSES » / « PLATES »), tant que la taille commune reste au moins 85 %
  // de celle obtenue sans ; sinon sans.
  const sans = balayer(ts, w, budget, k, maxTaille, false);
  const avec = balayer(ts, w, budget, k, maxTaille, true);
  const base = (x: { titres: TitreAjuste[] }) => Math.min(...x.titres.map((a) => a.s));
  return avec && (!sans || base(avec) >= 0.85 * base(sans)) ? avec : sans;
}

function balayer(ts: TitreDecrit[], w: number, budget: number, k: number, maxTaille: ((t: TitreDecrit) => number | undefined) | undefined, croissance: boolean): { titres: TitreAjuste[]; hauteur: number } | null {
  for (let plafond = Math.max(titreMaxCourant, TAILLES_V2.titreMax) * k; plafond >= Math.min(planchers.titre, planchers.texte) * k - 1e-6; plafond -= 4 * k) {
    const aj = ts.map((t) => ajusterTitre(t, w, plafond, k, maxTaille?.(t), croissance));
    if (aj.some((a) => !a)) continue;
    const a = aj as TitreAjuste[];
    const h = a.reduce((s, x, i) => s + x.hauteur + (i ? ecartTitres(x.s, k) : 0), 0);
    if (h <= budget + 0.5) return { titres: a, hauteur: h };
  }
  return null;
}

/**
 * Titres d'un écran : TOUS ensemble, à la même place, dans le budget (aucun titre ne défile, relecture du 12/10/2026 :
 * un titre chassé par le suivant ne se relit pas). Plus petits s'il le faut, jusqu'aux planchers serrés ; null si même
 * là rien ne tient (la place des titres est alors agrandie, puis, en dernier recours seulement, ils défilent).
 */
function grouper(ts: TitreDecrit[], w: number, budget: number, k: number, maxTaille?: (t: TitreDecrit) => number | undefined): { titres: TitreAjuste[]; hauteur: number }[] | null {
  const tout = ajusterSuite(ts, w, budget, k, maxTaille);
  if (tout) return [tout];
  const avant = planchers;
  planchers = { titre: Math.min(avant.titre, PLANCHERS_SERRES.titre), texte: Math.min(avant.texte, PLANCHERS_SERRES.texte) };
  try {
    const serre = ajusterSuite(ts, w, budget, k, maxTaille);
    return serre ? [serre] : null;
  } finally {
    planchers = avant;
  }
}

/** Planchers des titres quand ils doivent tenir tous ensemble (px de référence) : le titre reste du « grand texte » (52). */
const PLANCHERS_SERRES = Object.freeze({ titre: 52, texte: 40 });

/** DERNIER RECOURS (rien ne tient ensemble, même place agrandie) : groupes successifs à la même place. */
function grouperEnDefilement(ts: TitreDecrit[], w: number, budget: number, k: number, maxTaille?: (t: TitreDecrit) => number | undefined): { titres: TitreAjuste[]; hauteur: number }[] | null {
  // Unités insécables : les morceaux de la ligne d'appel (« ÉCRIVEZ » / « CINQ » / « EN COMMENTAIRE ») restent ensemble.
  // Une ligne qui annonce la suivante (« Vous vous êtes dit : ») reste avec elle.
  const unites: TitreDecrit[][] = [];
  for (const t of ts) {
    const base = t.id.replace(/~(mot|apres)$/, "");
    const prec = unites[unites.length - 1];
    const annonce = !!prec && /:\s*$/.test(prec[prec.length - 1].texte);
    if (prec && (((t.id.endsWith("~mot") || t.id.endsWith("~apres")) && prec.some((x) => x.id === base || x.id === `${base}~mot`)) || annonce)) prec.push(t);
    else unites.push([t]);
  }
  const petitDans = (x: { titres: TitreAjuste[] }) => x.titres.some((a) => a.t.niveau === "titre" && a.s < 72 * k);
  const groupes: { titres: TitreAjuste[]; hauteur: number }[] = [];
  let cour: TitreDecrit[] = [];
  for (const u of unites) {
    const essai = ajusterSuite([...cour, ...u], w, budget, k, maxTaille);
    // Une ligne de niveau « texte » (complément : « et ses relances de devis ») reste TOUJOURS avec son titre si elle
    // tient, même plus petite : un titre n'est jamais chassé par son propre complément.
    const complement = u.every((x) => x.niveau === "texte") && !!essai;
    if ((essai && !petitDans(essai)) || !cour.length || complement) {
      cour.push(...u);
      continue;
    }
    const g = ajusterSuite(cour, w, budget, k, maxTaille);
    if (!g) return null;
    groupes.push(g);
    cour = [...u];
  }
  if (cour.length) {
    const g = ajusterSuite(cour, w, budget, k, maxTaille);
    if (!g) return null;
    groupes.push(g);
  }
  return groupes;
}

/* ------------------------------------------------------------------ */
/* Contexte de disposition                                               */
/* ------------------------------------------------------------------ */

class Pose {
  textes: TexteV2[] = [];
  formes: FormeV2[] = [];
  traits: TraitV2[] = [];
  constructor(
    readonly d: DescriptionEcran,
    readonly g: GeometrieV2,
  ) {}
  get k() {
    return this.g.k;
  }
  get f(): FondV2 {
    return this.d.fond;
  }
  texte(t: Omit<TexteV2, "police" | "entree"> & Partial<Pick<TexteV2, "police" | "entree">>) {
    this.textes.push({ police: "titre", entree: "gauche", ...t, x: r1(t.x), y: r1(t.y), largeur: r1(t.largeur), hauteur: r1(t.hauteur), taille: r1(t.taille) });
  }
  forme(f: Omit<FormeV2, "rayon" | "remplissage" | "contour" | "epaisseur" | "entree"> & Partial<Pick<FormeV2, "rayon" | "remplissage" | "contour" | "epaisseur" | "entree">>) {
    this.formes.push({ rayon: 0, remplissage: null, contour: null, epaisseur: 0, entree: "pop", ...f, x: r1(f.x), y: r1(f.y), largeur: r1(f.largeur), hauteur: r1(f.hauteur) });
  }
  trait(t: TraitV2) {
    this.traits.push({ ...t, segments: t.segments.map((s) => s.map((p) => ({ x: r1(p.x), y: r1(p.y) }))) });
  }
  /** Libellé (une ou deux rangées) ajusté dans une boîte. */
  libelle(o: { id: string; texte: string; boite: RectV2; police?: Exclude<PoliceEcriture, "detail">; max?: number; min?: number; rangees?: number; couleur: string; fond: string; source: string; entree?: TexteV2["entree"]; centre?: boolean; avant?: TexteV2["avant"]; groupe?: number; vertical?: "haut" | "milieu" | "bas" }): number {
    const police = o.police ?? "texte";
    let lh: number = INTERLIGNE_V2.libelle;
    const essayer = (rangees: number) => ajuster(typo(o.texte), police, o.max ?? TAILLES_V2.libelle * this.k, o.min ?? TAILLES_V2.libelleMin * this.k, o.boite.largeur, o.boite.hauteur, rangees, lh);
    // Une place qui n'admet qu'un texte plus petit que le plancher de lisibilité ne tient pas (avant : texte à 16 px).
    if ((o.max ?? TAILLES_V2.libelle * this.k) < PLANCHER_LIBELLE * this.k - 1e-6) throw new ErreurDispositionV2(`le libellé « ${o.texte} » ne tient pas dans sa place, même à la taille plancher.`, this.d.id);
    let a = essayer(o.rangees ?? 2);
    // Ne tient pas, même à la taille plancher : interligne resserré, puis (texte de plusieurs rangées) une rangée de plus.
    // Jamais utilisé quand le libellé tient déjà : l'aspect validé ne change pas.
    if (!a && (o.rangees ?? 2) > 1) {
      lh = INTERLIGNE_LIBELLE_SERRE;
      a = essayer(o.rangees ?? 2) ?? ((o.rangees ?? 2) >= 3 ? essayer((o.rangees ?? 2) + 1) : null);
    }
    if (!a) throw new ErreurDispositionV2(`le libellé « ${o.texte} » ne tient pas dans sa place (${Math.round(o.boite.largeur)} × ${Math.round(o.boite.hauteur)} px).`, this.d.id);
    const h = a.rangees.length * a.taille * lh;
    const y0 = o.vertical === "bas" ? o.boite.y + o.boite.hauteur - h : o.vertical === "milieu" ? o.boite.y + (o.boite.hauteur - h) / 2 : o.boite.y;
    a.rangees.forEach((rg, i) => {
      const l = mesurer(rg, police, a.taille);
      this.texte({ id: `${o.id}.${i}`, texte: rg, x: o.centre ? o.boite.x + (o.boite.largeur - l) / 2 : o.boite.x, y: y0 + i * a.taille * lh, largeur: l, hauteur: a.taille * lh, taille: a.taille, police, couleur: o.couleur, fond: o.fond, source: o.source, entree: o.entree ?? "fondu", ...(o.avant ? { avant: o.avant } : {}), ...(o.groupe !== undefined ? { groupe: o.groupe } : {}) });
    });
    return h;
  }
}

const fondHex = (f: FondV2) => COULEURS_V2[f];

/* ------------------------------------------------------------------ */
/* Titres posés                                                          */
/* ------------------------------------------------------------------ */

interface ZoneTitres {
  x: number;
  y: number;
  largeur: number;
}

/**
 * Pose un groupe de titres ajustés à partir de `z` ; renvoie la hauteur. `immediat` : le titre (et ses blocs) est là dès
 * l'arrivée de l'écran (titre principal d'une étape, visible pendant toute l'étape) ; ses soulignements suivent la voix.
 */
function poserTitres(p: Pose, aj: TitreAjuste[], z: ZoneTitres, groupe: number | undefined, avantContour: boolean, immediat = false): number {
  const { k, f } = p;
  let y = z.y;
  let ordre = 0;
  aj.forEach((a, n) => {
    if (n) y += ecartTitres(a.s, k);
    const t = a.t;
    const lh = interligneDe(t);
    // Sur l'orange, une ligne secondaire sous le « grand texte » passe en ivoire franc (l'encre n'y fait que 3,3:1).
    const couleur = t.niveau === "titre" ? TEXTE_SUR[f] : f === "orange" && a.s < TAILLE_GRANDE_REF * k - 1e-6 ? COULEURS_V2.ivoireFranc : TEXTE_SECOND_SUR[f];
    let yRang = y;
    a.rangees.forEach((rg, j) => {
      const sr = rg.s ?? a.s;
      const pad = padBloc(sr);
      if (j) yRang += ecartRangee(t, sr, k);
      const yr = yRang;
      const hr = sr * lh;
      yRang += hr;
      // Blocs : suites de mots forts.
      let i = 0;
      while (i < rg.jetons.length) {
        const j0 = rg.jetons[i];
        if (!j0.fort) {
          i++;
          continue;
        }
        let i1 = i;
        while (i1 + 1 < rg.jetons.length && rg.jetons[i1 + 1].fort) i1++;
        const dernier = rg.jetons[i1];
        p.forme({ id: `${t.id}#b${j}.${i}`, sorte: "bloc", x: z.x + j0.x - pad, y: yr, largeur: dernier.x + dernier.l - j0.x + 2 * pad, hauteur: hr, rayon: 0.12 * sr, remplissage: BLOC_SUR[f].fond, source: t.id, entree: "claque", ...(groupe !== undefined ? { groupe } : {}), ...(avantContour ? { avant: "contour" as const } : {}), ...(immediat ? { desLArrivee: true } : { motCle: j0.cle }), masqueX: z.x - pad });
        i = i1 + 1;
      }
      rg.jetons.forEach((jt, i2) => {
        p.texte({
          id: `${t.id}#${j}.${i2}`,
          texte: jt.aff,
          x: z.x + jt.x,
          y: yr,
          largeur: jt.l,
          hauteur: hr,
          taille: sr,
          police: "titre",
          couleur: jt.fort ? BLOC_SUR[f].texte : couleur,
          fond: jt.fort ? BLOC_SUR[f].fond : fondHex(f),
          source: t.id,
          entree: jt.fort ? "claque" : "gauche",
          ...(immediat ? { desLArrivee: true } : {}),
          // Un bloc claque d'un seul coup, sur son premier mot dit.
          ...(jt.fort && !immediat ? { motCle: debutBloc(rg.jetons, i2).cle } : {}),
          // La rangée glisse d'un bloc depuis le bord gauche des titres : jamais un mot coupé à sa propre place.
          masqueX: z.x - pad,
          ...(groupe !== undefined ? { groupe } : {}),
          ...(avantContour ? { avant: "contour" as const } : {}),
        });
      });
      // Soulignements : suites de mots soulignés, sous le texte (ou sous le bloc).
      i = 0;
      while (i < rg.jetons.length) {
        if (!rg.jetons[i].souligne) {
          i++;
          continue;
        }
        let i1 = i;
        while (i1 + 1 < rg.jetons.length && rg.jetons[i1 + 1].souligne && rg.jetons[i1 + 1].fort === rg.jetons[i].fort) i1++;
        const a0 = rg.jetons[i];
        const a1 = rg.jetons[i1];
        const x0 = z.x + a0.x - (a0.fort ? pad : 4 * k);
        const x1 = z.x + a1.x + a1.l + (a1.fort ? pad : 6 * k);
        const yu = yr + (a0.fort ? hr + 9 * k : t.niveau === "titre" ? sr * 0.95 : sr * 1.08);
        p.trait({ id: `${t.id}#s${j}.${i}`, sorte: "souligne", segments: [[{ x: x0, y: yu + 1 * k }, { x: x0 + (x1 - x0) * 0.4, y: yu + 4 * k }, { x: x1, y: yu - 3 * k }]], epaisseur: EPAISSEURS_V2.souligne * k, couleur: TRAIT_SUR[f], source: t.gesteId ?? t.id, decalageMs: t.gesteId ? 0 : 260 + ordre * 320, dureeMs: 300, crayon: true, son: "trait", ...(t.gesteId ? {} : { motCle: a0.cle }), ...(groupe !== undefined ? { groupe } : {}) });
        ordre++;
        i = i1 + 1;
      }
      if (t.barre) {
        const ym = yr + hr * 0.5;
        p.trait({ id: `${t.id}#x${j}`, sorte: "barre", segments: [[{ x: z.x - 6 * k, y: ym + 4 * k }, { x: z.x + rg.largeur + 8 * k, y: ym - 6 * k }]], epaisseur: EPAISSEURS_V2.barre * k, couleur: TRAIT_SUR[f], source: t.gesteId ?? t.id, decalageMs: t.gesteId ? 0 : 450, dureeMs: 220, crayon: false, son: "trait", ...(groupe !== undefined ? { groupe } : {}) });
      }
    });
    if (t.entoure) {
      const larg = Math.max(...a.rangees.map((x) => x.largeur));
      const marge = Math.min(10 * k, ecartTitres(a.s, k) * 0.4);
      const cx = z.x + larg / 2;
      const cy = y + a.hauteur / 2;
      const rx = larg / 2 + marge + 8 * k;
      const ry = a.hauteur / 2 + marge;
      const pts: PointV2[] = [];
      for (let q = 0; q <= 40; q++) {
        const ang = -Math.PI / 2 + (q / 40) * 2 * Math.PI * 1.06;
        pts.push({ x: cx + rx * Math.cos(ang), y: cy + ry * Math.sin(ang) });
      }
      p.trait({ id: `${t.id}#o`, sorte: "entoure", segments: [pts], epaisseur: EPAISSEURS_V2.souligne * k, couleur: TRAIT_SUR[f], source: t.gesteId ?? t.id, decalageMs: t.gesteId ? 0 : 400, dureeMs: 500, crayon: true, son: "trait", ...(groupe !== undefined ? { groupe } : {}) });
    }
    y += a.hauteur;
  });
  return y - z.y;
}

/* ------------------------------------------------------------------ */
/* Corps des gabarits                                                    */
/* ------------------------------------------------------------------ */

/** Hauteur minimale du corps de chaque gabarit (px de référence) ; nombre d'éléments compris. */
function corpsMin(d: DescriptionEcran): number {
  const n = Math.max(1, d.items.length);
  switch (d.gabarit) {
    case "accroche-cases":
      return 190;
    case "accroche-compteur":
      return 240;
    case "constat":
      return 300;
    case "idee-recue":
      // L'idée barrée et sa case (la carte s'arrête à elles).
      return 220;
    case "etape":
      return d.items.length ? 230 : 170;
    case "liste":
      // Lignes longues : la place de deux rangées lisibles chacune.
      return n * (d.items.some((it) => (it.detail ?? it.texte).length > 24) ? 72 : 54) + (n - 1) * 12;
    case "semaine":
      return 190;
    case "exemple":
      return 300;
    case "recapitulatif":
      return n * 74 + (n - 1) * 12;
    case "appel-commentaire":
      return 150;
    case "appel-diagnostic":
      return 260;
    case "appel-site":
      return 200;
  }
}

/** Hauteur visée du corps (au-delà, la place va aux titres puis reste en marge). */
function corpsVise(d: DescriptionEcran, b: RectV2, k: number): number {
  switch (d.gabarit) {
    case "accroche-cases":
      return Math.min(b.hauteur, 260 * k);
    case "appel-commentaire":
      return Math.min(b.hauteur, 200 * k);
    case "semaine":
      return Math.min(b.hauteur, 340 * k);
    default:
      return b.hauteur;
  }
}

const ombreCarte = (f: FondV2) => (f === "encre" ? COULEURS_V2.orange : COULEURS_V2.encre);

/** Carte ivoire à bord encre et ombre pleine ; `deborde` : elle continue jusqu'en bas de l'image (forme seule). */
function carte(p: Pose, id: string, b: RectV2, deborde: boolean, source: string, entree: FormeV2["entree"] = "monte"): RectV2 {
  const { k, g } = p;
  const bas = deborde ? g.hauteur + 80 * k : b.y + b.hauteur;
  p.forme({ id, sorte: "carte", x: b.x, y: b.y, largeur: b.largeur - 12 * k, hauteur: bas - b.y, rayon: 34 * k, remplissage: COULEURS_V2.ivoire, contour: COULEURS_V2.encre, epaisseur: EPAISSEURS_V2.contour * k, ombre: ombreCarte(p.f), source, entree, ...(deborde ? { horsZone: true } : {}) });
  return { x: b.x, y: b.y, largeur: b.largeur - 12 * k, hauteur: b.hauteur };
}

/** Marque « là dès l'arrivée de l'écran » les textes et formes dont l'identifiant est l'un de `ids` (ou commence par lui s'il finit par « . »). */
function desLArrivee(p: Pose, ids: string[]): void {
  const vise = (id: string) => ids.some((v) => (v.endsWith(".") ? id.startsWith(v) : id === v));
  for (const x of [...p.textes, ...p.formes]) if (vise(x.id)) x.desLArrivee = true;
}

/** Barres sable (texte figuré, sans mots). */
function barres(p: Pose, id: string, x: number, y: number, largeurs: number[], larg: number, h: number, ecart: number, source: string, decalage: number, couleur: string = COULEURS_V2.sable): number {
  largeurs.forEach((w, i) => {
    p.forme({ id: `${id}.${i}`, sorte: "barre-sable", x, y: y + i * (h + ecart), largeur: larg * w, hauteur: h, rayon: h / 2, remplissage: couleur, source, entree: "barre", decalageMs: decalage + i * 60 });
  });
  return largeurs.length * (h + ecart) - ecart;
}

/** Part de la hauteur des panneaux de l'exemple donnée au panneau « avant ». */
const PART_AVANT_EXEMPLE = 0.56;

/** Même texte, sans casse, accents ni ponctuation (« Signé ailleurs ? » = « SIGNÉ AILLEURS »). */
const memeTexte = (a: string, b: string) => !!cleMotV2(a) && cleMotV2(a) === cleMotV2(b);

/** Gabarits qui écrivent le texte de CHAQUE élément de leur liste dans le corps. */
const ECRIVENT_LEURS_ELEMENTS: ReadonlySet<DescriptionEcran["gabarit"]> = new Set(["recapitulatif", "liste", "accroche-cases", "semaine", "etape"]);

/** Vrai si le corps de l'écran écrit déjà ce texte (un élément de sa liste). */
function corpsEcrit(d: DescriptionEcran, texte: string): boolean {
  // L'exemple écrit les lignes de sa preuve (avant, après) dans ses panneaux.
  // Sans panneau (aucune ligne préfixée « Avant : » ou « Après : », ni preuve), les lignes restent des titres.
  if (d.gabarit === "exemple") {
    const pan = panneauxExemple(d);
    // Une ligne qui redit un panneau (« Une réponse claire » au-dessus du panneau « réponse claire ») n'est pas écrite.
    return pan.some((x) => memeTexte(x.texte, texte) || (!!x.etiquette && memeTexte(`${x.etiquette} ${x.texte}`, texte)) || motsCouverts(x.texte, [texte]) || motsCouverts(texte, [x.texte]));
  }
  if (!ECRIVENT_LEURS_ELEMENTS.has(d.gabarit)) return false;
  if (d.items.some((it) => memeTexte(it.texte, texte))) return true;
  // Une ligne dont chaque mot plein est déjà écrit par les éléments (« Livrable, lecteur » au-dessus de « 1 LIVRABLE »,
  // « 2 LECTEUR ») est elle aussi écrite deux fois (relecture du 12/10/2026, récapitulatif de « consigne »).
  return motsCouverts(texte, d.items.flatMap((it) => [it.texte, it.detail ?? ""]));
}

/** Mots pleins (trois lettres au moins), sans casse ni accents. */
const motsPleinsV2 = (t: string) => typo(t).split(/[^\p{L}\p{N}]+/u).map(cleMotV2).filter((m) => m.length >= 3);

/** Vrai si chaque mot plein de `texte` (un au moins) est écrit dans l'un des `ailleurs`. */
export function motsCouverts(texte: string, ailleurs: readonly string[]): boolean {
  const pleins = motsPleinsV2(texte);
  const vus = new Set(ailleurs.flatMap(motsPleinsV2));
  return pleins.length > 0 && pleins.every((m) => vus.has(m));
}

/** Vrai si un titre de l'écran a ce texte. */
function titreEcrit(d: DescriptionEcran, texte: string): boolean {
  return d.titres.some((t) => memeTexte(t.texte, texte));
}

/**
 * Pictogrammes de l'écran : SEULEMENT ceux de la fiche (élément « dessin » de la scène dans cet écran) qui existent dans
 * la banque, chacun une fois (trois au plus). Jamais de pictogramme générique ajouté pour combler (relecture des quatre
 * vidéos du 12/10/2026 : flèche, coche, engrenage, étoile, point d'interrogation sans rapport avec le propos). Sans
 * dessin, rien : le cadre se réduit et le texte de la scène grandit.
 */
export function pictosEcran(d: Pick<DescriptionEcran, "dessins">): { id: string; dessinId: string }[] {
  const vus = new Set<string>();
  return (d.dessins ?? []).filter((x) => Object.prototype.hasOwnProperty.call(TRACES_DESSINS, x.dessinId) && !vus.has(x.dessinId) && !!vus.add(x.dessinId)).slice(0, 3);
}

/**
 * Pictogrammes en grand, chacun sur un disque sable (le disque et son dessin entrent ensemble : jamais un rond vide),
 * dans une carte ivoire réduite à eux : côte à côte ou l'un sous l'autre, selon ce qui les fait les plus grands. Chacun
 * se trace à l'heure de son dessin dans la fiche. Aucun pictogramme : rien n'est posé (ni carte, ni disque).
 */
function pictogrammes(p: Pose, b: RectV2, avecCarte = true, choisis?: { id: string; dessinId: string }[], suffixe = ""): void {
  const { d, k } = p;
  const src = `${d.id}${suffixe ? `#${suffixe}` : ""}`;
  const montres = new Set(p.formes.filter((f) => f.sorte === "dessin").map((f) => f.dessin));
  const pictos = (choisis ?? pictosEcran(d)).filter((x) => !montres.has(x.dessinId));
  if (!pictos.length) return;
  const n = pictos.length;
  const pad = avecCarte ? 34 * k : 0;
  const ecart = 30 * k;
  const lw = b.largeur - (avecCarte ? 12 * k : 0) - 2 * pad;
  const lh = b.hauteur - (avecCarte ? 12 * k : 0) - 2 * pad;
  // Côte à côte, ou l'un sous l'autre : le plus grand des deux ; jamais plus de `TAILLE_PICTO_MAX`.
  const enLigne = Math.min((lw - ecart * (n - 1)) / n, lh);
  const enColonne = Math.min(lw, (lh - ecart * (n - 1)) / n);
  const colonne = enColonne > enLigne;
  const s = Math.min(Math.max(enLigne, enColonne), TAILLE_PICTO_MAX * k);
  // Pas la place : aucun pictogramme (jamais un pictogramme minuscule) ; le texte grandit.
  if (s < (avecCarte ? 120 : LIBRE_A_COMBLER * 0.9) * k) return;
  const cw = colonne ? s + 2 * pad : n * s + (n - 1) * ecart + 2 * pad;
  const ch = colonne ? n * s + (n - 1) * ecart + 2 * pad : s + 2 * pad;
  const largeurCarte = avecCarte ? Math.max(cw, Math.min(b.largeur - 12 * k, cw + 120 * k)) : cw;
  const cx = b.x + (b.largeur - (avecCarte ? 12 * k : 0) - largeurCarte) / 2;
  const cy = b.y + Math.max(0, (b.hauteur - (avecCarte ? 12 * k : 0) - ch) / 2);
  if (avecCarte) {
    carte(p, `${src}#carte`, { x: cx, y: cy, largeur: largeurCarte + 12 * k, hauteur: ch }, false, d.id);
    // La carte arrive avec son premier pictogramme, jamais vide avant lui.
    p.formes[p.formes.length - 1].attend = `${src}#pd0`;
  }
  const x0 = cx + (largeurCarte - (cw - 2 * pad)) / 2;
  pictos.forEach((x, i) => {
    const px = colonne ? x0 : x0 + i * (s + ecart);
    const py = cy + pad + (colonne ? i * (s + ecart) : 0);
    p.forme({ id: `${src}#pd${i}`, sorte: "rond", x: px, y: py, largeur: s, hauteur: s, rayon: s / 2, remplissage: COULEURS_V2.sable, source: x.id, entree: "pop" });
    p.forme({ id: `${src}#pi${i}`, sorte: "dessin", dessin: x.dessinId, x: px + s * 0.18, y: py + s * 0.18, largeur: s * 0.64, hauteur: s * 0.64, contour: COULEURS_V2.encre, epaisseur: Math.max(8 * k, s * 0.03), source: x.id, entree: "fondu" });
  });
}

/** Plus petit pictogramme posé dans une carte d'étape (px de référence). */
const PICTO_CARTE_MIN = 110;

/** Taille visée du texte d'une carte d'étape sans pictogramme (px de référence). */
const TAILLE_TEXTE_CARTE = 64;

/** Côté maximal d'un pictogramme (px de référence). */
const TAILLE_PICTO_MAX = 560;

/** Coche dans une case (segments). */
const segmentsCoche = (c: RectV2): PointV2[][] => {
  const s = Math.min(c.largeur, c.hauteur) * 0.62;
  const cx = c.x + c.largeur / 2;
  const cy = c.y + c.hauteur / 2;
  return [[{ x: cx - s * 0.5, y: cy }, { x: cx - s * 0.14, y: cy + s * 0.36 }, { x: cx + s * 0.52, y: cy - s * 0.42 }]];
};

/** Croix dans un carré. */
const segmentsCroix = (x: number, y: number, s: number): PointV2[][] => [
  [{ x, y }, { x: x + s, y: y + s }],
  [{ x: x + s, y }, { x, y: y + s }],
];

function corps(p: Pose, b: RectV2): void {
  const { d, k, f } = p;
  const src = d.id;
  switch (d.gabarit) {
    case "accroche-cases": {
      const n = d.items.length || Math.min(5, Math.max(2, parseInt(d.chiffre?.valeur ?? "", 10) || 3));
      const ecart = Math.round(b.largeur * 0.045);
      const cw = (b.largeur - ecart * (n - 1)) / n;
      const ch = Math.min(b.hauteur, cw * 0.85, 260 * k);
      const y = b.y + (b.hauteur - ch) / 2;
      const contour = CONTOUR_SUR[f];
      const lab = f === "orange" ? COULEURS_V2.encre : f === "encre" ? COULEURS_V2.sable : COULEURS_V2.encre;
      for (let i = 0; i < n; i++) {
        const x = b.x + i * (cw + ecart);
        const it = d.items[i];
        p.forme({ id: `${src}#case${i}`, sorte: "case", x, y, largeur: cw, hauteur: ch, rayon: 24 * k, remplissage: f === "orange" ? COULEURS_V2.ivoire : null, contour, epaisseur: EPAISSEURS_V2.contour * k, source: src, entree: d.premier ? "aucune" : "pop", ...(d.premier ? {} : { decalageMs: i * 80 }) });
        let hl = 0;
        // Le libellé d'une case déjà écrit par un titre (« UN MOIS APRÈS » sous « Un mois après : plus personne ne
        // l'ouvre ») n'est pas écrit une seconde fois : la case garde sa croix.
        if (it && !motsCouverts(it.texte, d.titres.filter((t) => !corpsEcrit(d, t.texte)).map((t) => t.texte))) hl = p.libelle({ id: `${src}#case${i}t`, texte: majuscules(it.texte), boite: { x: x + 18 * k, y: y + 14 * k, largeur: cw - 36 * k, hauteur: ch * 0.4 }, police: "titre", max: 40 * k, min: 26 * k, rangees: 1, couleur: lab, fond: f === "orange" ? COULEURS_V2.ivoire : fondHex(f), source: src, entree: d.premier ? "aucune" : "fondu" });
        const zone = ch - hl - 30 * k;
        const s = Math.min(cw * 0.5, zone * 0.78);
        const cx = x + (cw - s) / 2;
        const cy = y + hl + 14 * k + (zone - s) / 2 + 8 * k;
        const geste = d.titres.find((t) => t.barre && t.gesteId)?.gesteId ?? d.titres.find((t) => t.gesteId)?.gesteId;
        // Les croix se posent sur le nombre dit (« trois fois »), à la suite ; sinon sur chaque essai, ou sur le geste.
        if (d.chiffre) {
          p.trait({ id: `${src}#croix${i}`, sorte: "croix", segments: segmentsCroix(cx, cy, s), epaisseur: EPAISSEURS_V2.croix * k, couleur: TRAIT_SUR[f], source: d.chiffre.id, decalageMs: i * 300, dureeMs: 180, crayon: true, son: "trait" });
          continue;
        }
        const source = it ? it.id : geste ?? src;
        p.trait({ id: `${src}#croix${i}`, sorte: "croix", segments: segmentsCroix(cx, cy, s), epaisseur: EPAISSEURS_V2.croix * k, couleur: TRAIT_SUR[f], source, decalageMs: it ? 60 : geste ? i * 420 : 700 + i * 420, dureeMs: 300, crayon: true, son: "trait" });
      }
      return;
    }
    case "accroche-compteur": {
      const valeur = d.chiffre?.valeur ?? "1";
      const s = Math.min(b.hauteur * 0.62, b.largeur * 0.5);
      const taille = Math.min(s / Math.max(1, valeur.length * 0.62), s);
      const lv = mesurer(valeur, "titre", taille);
      const cx = b.x + b.largeur / 2;
      const cy = b.y + b.hauteur / 2;
      const rayon = Math.max(lv, taille) / 2 + 40 * k;
      p.texte({ id: `${src}#n`, texte: valeur, x: cx - lv / 2, y: cy - taille / 2, largeur: lv, hauteur: taille, taille, couleur: TEXTE_SUR[f], fond: fondHex(f), source: d.chiffre?.id ?? src, entree: "claque" });
      const pts: PointV2[] = [];
      for (let q = 0; q <= 44; q++) {
        const ang = -Math.PI / 2 + (q / 44) * 2 * Math.PI * 1.05;
        pts.push({ x: cx + rayon * Math.cos(ang), y: cy + Math.min(rayon, b.hauteur / 2 - 10 * k) * Math.sin(ang) });
      }
      p.trait({ id: `${src}#rond`, sorte: "entoure", segments: [pts], epaisseur: 16 * k, couleur: TRAIT_SUR[f], source: d.chiffre?.id ?? src, decalageMs: 350, dureeMs: 550, crayon: true, son: "trait" });
      return;
    }
    case "constat": {
      // La carte s'arrête sous son champ de saisie (avant : elle descendait jusqu'en bas de l'image, vide dessous).
      const hVise = 110 * k + (2 * 20 * k + 14 * k + 36 * k) + 20 * k + (5 * 34 * k + 22 * k) + 24 * k + 90 * k + 20 * k;
      const c = carte(p, `${src}#carte`, { ...b, hauteur: Math.min(b.hauteur, hVise) }, false, src);
      const pad = 30 * k;
      const ix = c.x + pad;
      const iw = c.largeur - 2 * pad;
      // En-tête de la carte : pastille sombre et barre (une conversation, sans mots).
      p.forme({ id: `${src}#tete`, sorte: "pastille", x: ix, y: c.y + 22 * k, largeur: 74 * k, hauteur: 42 * k, rayon: 10 * k, remplissage: COULEURS_V2.encre, source: src, entree: "fondu" });
      p.forme({ id: `${src}#tete2`, sorte: "barre-sable", x: ix + 96 * k, y: c.y + 33 * k, largeur: iw * 0.32, hauteur: 20 * k, rayon: 10 * k, remplissage: COULEURS_V2.sable, source: src, entree: "fondu" });
      p.forme({ id: `${src}#ligne`, sorte: "barre-sable", x: c.x, y: c.y + 84 * k, largeur: c.largeur, hauteur: EPAISSEURS_V2.contour * k, remplissage: COULEURS_V2.encre, source: src, entree: "aucune" });
      let y = c.y + 110 * k;
      const bas = c.y + c.hauteur - 10 * k;
      // Question (bulle sombre, à droite) ; laissée de côté si la carte est trop basse pour elle et la réponse (titres
      // nombreux, tous à l'écran) : rien ne dépasse dans la bande du crayon.
      const qh = 2 * 20 * k + 14 * k + 36 * k;
      if (bas - y >= qh + 20 * k + 3 * 34 * k + 22 * k) {
        p.forme({ id: `${src}#q`, sorte: "bulle", x: ix + iw * 0.42, y, largeur: iw * 0.58, hauteur: qh, rayon: 28 * k, remplissage: COULEURS_V2.encre, source: src, entree: "pop", decalageMs: 120 });
        barres(p, `${src}#qb`, ix + iw * 0.42 + 26 * k, y + 18 * k, [0.85, 0.55], iw * 0.58 - 52 * k, 20 * k, 14 * k, src, 200, COULEURS_V2.sable);
        y += qh + 20 * k;
      }
      // Réponse plate (barres toutes pareilles).
      const nb = Math.max(3, Math.min(7, Math.floor((bas - y - 40 * k) / (34 * k))));
      const rh = nb * 34 * k + 22 * k;
      p.forme({ id: `${src}#rep`, sorte: "bulle", x: ix, y, largeur: iw * 0.8, hauteur: rh, rayon: 28 * k, remplissage: COULEURS_V2.ivoire, contour: COULEURS_V2.encre, epaisseur: 5 * k, source: src, entree: "pop", decalageMs: 260 });
      barres(p, `${src}#rb`, ix + 24 * k, y + 18 * k, Array(nb).fill(1), iw * 0.8 - 48 * k, 20 * k, 14 * k, src, 320);
      // Gribouillis sur la réponse, au deuxième titre (ou au premier élément).
      const zz: PointV2[] = [];
      const gx0 = ix + 30 * k;
      const gx1 = ix + iw * 0.8 - 30 * k;
      const lignes = Math.max(3, nb);
      for (let q = 0; q <= lignes; q++) zz.push({ x: q % 2 ? gx1 : gx0, y: y + 22 * k + (q * (rh - 44 * k)) / lignes });
      const declencheur = d.titres[1]?.id ?? d.items[0]?.id ?? d.titres[0]?.id ?? src;
      p.trait({ id: `${src}#zz`, sorte: "gribouillis", segments: [zz], epaisseur: EPAISSEURS_V2.gribouillis * k, couleur: COULEURS_V2.orange, source: declencheur, decalageMs: 150, dureeMs: 520, crayon: true, son: "trait" });
      // Tampons : un par élément de liste, qui tombent sur la réponse (jamais le texte d'un titre une seconde fois, même
      // en partie : « DEVIS ENVOYÉ » sous « Devis envoyé. Puis plus rien. »).
      // Chaque tampon sous le précédent, jamais l'un sur l'autre (avant : trois tampons superposés, illisibles) ; celui
      // qui n'a plus la place sur la réponse n'est pas posé.
      // Bas (rotation comprise) du tampon précédent.
      let basTampon = y + rh * 0.3 - 14 * k;
      const sin7 = Math.sin((7 * Math.PI) / 180);
      const cos7 = Math.cos((7 * Math.PI) / 180);
      d.items
        .filter((it) => !titreEcrit(d, it.texte) && !motsCouverts(it.texte, d.titres.map((t) => t.texte)))
        .slice(0, 3)
        .forEach((it, i) => {
          const tx = ix + iw * (0.3 + 0.08 * i);
          const tamp = ajuster(majuscules(typo(it.texte)), "titre", 58 * k, 40 * k, iw * 0.6, 70 * k, 1, 1);
          if (!tamp) return;
          const l = mesurer(tamp.rangees[0], "titre", tamp.taille);
          const pw = l + 52 * k;
          const ph = tamp.taille + 28 * k;
          const haut = ph * cos7 + pw * sin7;
          const cy = basTampon + (i ? 10 * k : 0) + haut / 2;
          if (cy + haut / 2 > Math.min(bas, y + rh + 40 * k)) return;
          basTampon = cy + haut / 2;
          const ty = cy - ph / 2 + 14 * k;
          const big = tamp.taille >= 52 * k;
          const fondT = big ? COULEURS_V2.orange : COULEURS_V2.encre;
          p.forme({ id: `${src}#tamp${i}`, sorte: "pastille", x: tx - 26 * k, y: ty - 14 * k, largeur: l + 52 * k, hauteur: tamp.taille + 28 * k, rayon: 12 * k, remplissage: fondT, contour: COULEURS_V2.encre, epaisseur: 5 * k, rotation: -7, source: it.id, entree: "tombe" });
          p.texte({ id: `${src}#tamp${i}t`, texte: tamp.rangees[0], x: tx, y: ty, largeur: l, hauteur: tamp.taille, taille: tamp.taille, couleur: COULEURS_V2.ivoire, fond: fondT, source: it.id, entree: "tombe", rotation: -7, pivot: { x: tx - 26 * k + (l + 52 * k) / 2, y: ty - 14 * k + (tamp.taille + 28 * k) / 2 } });
        });
      // Champ de saisie vide.
      const yb = y + rh + 24 * k;
      if (bas - yb > 70 * k) p.forme({ id: `${src}#champ`, sorte: "pastille", x: ix, y: yb, largeur: iw, hauteur: Math.min(90 * k, bas - yb), rayon: 45 * k, contour: COULEURS_V2.encre, epaisseur: 5 * k, source: src, entree: "fondu" });
      return;
    }
    case "idee-recue": {
      // Corps très large (côte à côte, sans titres) : la carte prend 62 % de la largeur, les pictogrammes le reste.
      if (p.g.mode === "cote" && b.largeur > 1.6 * b.hauteur && b.largeur > 0.8 * p.g.contenu.largeur && pictosEcran(d).length) b = { ...b, largeur: Math.round(b.largeur * 0.62) };
      const pad = 34 * k;
      const barres_ = d.titres.filter((t) => t.barre);
      const pictos = pictosEcran(d);
      // Rien à montrer dans la carte (ni idée barrée, ni pictogramme de la fiche) : pas de carte, le texte grandit.
      if (!barres_.length && !pictos.length) return;
      const caseS = 120 * k;
      const iw = b.largeur - 12 * k - 2 * pad;
      const largTexte = iw - caseS - 24 * k;
      // L'idée barrée : deux rangées si elles tiennent au « grand texte » (jamais « UN MOTEUR / DE / RECHERCHE »), sinon trois.
      const idees = barres_.map((t) => {
        const tI = 92 * k * (1 + 0.3 * croissanceCourante);
        // Jamais plus haut que la place de la carte (l'idée ne déborde pas de son cadre).
        const hI = Math.min(300 * k * (1 + 0.3 * croissanceCourante), b.hauteur - 12 * k - 2 * pad);
        // 52 px au moins (« grand texte ») ; 40 px dans une carte basse (carré), plutôt qu'une carte qui déborde.
        const essayer = (rangees: number) => ajuster(majuscules(typo(t.texte)), "titre", tI, 52 * k, largTexte, hI, rangees, 1.05) ?? ajuster(majuscules(typo(t.texte)), "titre", Math.min(tI, 52 * k), 40 * k, largTexte, hI, rangees, 1.05);
        const deux = essayer(2);
        const trois = !deux || croissanceCourante ? essayer(3) : null;
        // Texte grandi : trois rangées si elles le font plus grand.
        const a = deux && (!trois || deux.taille >= trois.taille) ? deux : trois;
        if (!a) throw new ErreurDispositionV2(`l'idée reçue « ${t.texte} » ne tient pas dans sa carte.`, d.id);
        return { t, a };
      });
      const hIdees = Math.max(caseS, idees.reduce((h, x) => h + x.a.rangees.length * x.a.taille * 1.05 + 26 * k, 0) - 26 * k);
      // La carte s'arrête à ce qu'elle montre (avant : elle descendait jusqu'en bas de l'image, un grand cadre blanc).
      const resteP = b.hauteur - 12 * k - 2 * pad - hIdees - 26 * k;
      const hPictos = pictos.length && Math.min(iw, resteP) >= LIBRE_A_COMBLER * k ? Math.min(resteP, TAILLE_PICTO_MAX * k) : 0;
      const hCarte = 2 * pad + hIdees + (hPictos ? 26 * k + hPictos : 0) + 12 * k;
      const c = carte(p, `${src}#carte`, { ...b, hauteur: Math.min(b.hauteur, hCarte) }, false, src);
      const ix = c.x + pad;
      let y = c.y + pad;
      const caseR: RectV2 = { x: c.x + c.largeur - pad - caseS, y, largeur: caseS, hauteur: caseS };
      p.forme({ id: `${src}#case`, sorte: "case", ...caseR, rayon: 22 * k, contour: COULEURS_V2.encre, epaisseur: 7 * k, source: src, entree: "pop", decalageMs: 150, attend: `${src}#coche` });
      for (const { t, a } of idees) {
        a.rangees.forEach((rg, j) => {
          const l = mesurer(rg, "titre", a.taille);
          const yr = y + j * a.taille * 1.05;
          p.texte({ id: `${t.id}#c${j}`, texte: rg, x: ix, y: yr, largeur: l, hauteur: a.taille, taille: a.taille, couleur: COULEURS_V2.encre, fond: COULEURS_V2.ivoire, source: t.id, entree: "gauche" });
          p.trait({ id: `${t.id}#cx${j}`, sorte: "barre", segments: [[{ x: ix - 6 * k, y: yr + a.taille * 0.55 }, { x: ix + l + 8 * k, y: yr + a.taille * 0.47 }]], epaisseur: EPAISSEURS_V2.barre * k, couleur: COULEURS_V2.orange, source: t.gesteId ?? t.id, decalageMs: t.gesteId ? 0 : 520 + j * 120, dureeMs: 200, crayon: false, son: j ? null : "trait" });
        });
        y += a.rangees.length * a.taille * 1.05 + 26 * k;
      }
      // La carte arrive avec ce qu'elle montre en premier (l'idée barrée), jamais vide avant.
      if (idees.length) p.formes.find((x) => x.id === `${src}#carte`)!.attend = `${idees[0].t.id}#c0`;
      // Sous l'idée barrée : les pictogrammes de la fiche, s'il y en a et qu'ils ont la place.
      if (hPictos) {
        const yP = c.y + pad + hIdees + 26 * k;
        pictogrammes(p, { x: ix, y: yP, largeur: c.largeur - 2 * pad, hauteur: hPictos }, false);
        if (!idees.length) p.formes.find((x) => x.id === `${src}#carte`)!.attend = `${src}#pd0`;
      }
      // Coche : à la bonne idée (premier titre qui suit une idée barrée), ou à une coche de la fiche.
      const iB = d.titres.findIndex((t) => t.barre);
      const bonne = iB >= 0 ? d.titres.slice(iB + 1).find((t) => !t.barre) : d.titres[d.titres.length - 1];
      const source = d.coches[0] ?? bonne?.id ?? src;
      p.trait({ id: `${src}#coche`, sorte: "coche", segments: segmentsCoche(caseR), epaisseur: EPAISSEURS_V2.coche * k, couleur: COULEURS_V2.orange, source, decalageMs: d.coches[0] ? 0 : 350, dureeMs: 320, crayon: true, son: "validation" });
      return;
    }
    case "etape": {
      if (!d.items.length) {
        // Les pictogrammes de la fiche en grand, dans une carte réduite à eux (avant : une carte jusqu'en bas de l'image
        // avec trois traits gris, un écran à moitié vide).
        pictogrammes(p, b);
        return;
      }
      const n = d.items.length;
      const cols = Math.min(3, n);
      const rows = Math.ceil(n / cols);
      const ecart = 26 * k;
      const cw0 = (b.largeur - 12 * k - ecart * (cols - 1)) / cols;
      // Un pictogramme de la fiche par carte, chacun une fois ; une carte sans pictogramme montre son texte en grand.
      const pictos = pictosEcran(d);
      const plein = Math.min((b.hauteur - ecart * (rows - 1) - 12 * k) / rows, cw0 * 1.35);
      // Carte à pictogramme dans une place large (carré, une seule carte) : pas plus large que haute (jamais un disque au
      // milieu d'une grande carte vide) ; la rangée de cartes est centrée.
      const cw = pictos.length && Math.min(cw0, plein * 1.1) - 44 * k >= PICTO_CARTE_MIN * k && plein - 2 * 22 * k - (2 * 40 * k * INTERLIGNE_V2.libelle + 18 * k) >= PICTO_CARTE_MIN * k ? Math.min(cw0, plein * 1.1) : cw0;
      const dx = (b.largeur - 12 * k - cols * cw - ecart * (cols - 1)) / 2;
      // Aucune carte n'a de pictogramme : les cartes se réduisent à leur texte (jamais un grand cadre vide).
      const tCarte = TAILLE_TEXTE_CARTE * k * (1 + 0.25 * croissanceCourante);
      const texteSeul = (ch: number) => ({ max: Math.min(tCarte, (ch - 40 * k) / (2 * INTERLIGNE_V2.libelle)), boite: (x: number, y: number) => ({ x: x + 24 * k, y: y + 20 * k, largeur: cw - 48 * k, hauteur: ch - 40 * k }) });
      const reduite = 2 * tCarte * INTERLIGNE_V2.libelle + 40 * k + 8 * k;
      // Le pictogramme n'entre que s'il garde une taille lisible au-dessus du texte ; sinon les cartes montrent leur texte
      // en grand (le pictogramme va dans la place libre de l'écran, `combler`).
      const pictoLisible = Math.min(cw - 44 * k, plein - 2 * 22 * k - (2 * 40 * k * INTERLIGNE_V2.libelle + 18 * k)) >= PICTO_CARTE_MIN * k;
      const ch = pictos.length && pictoLisible ? plein : Math.min(plein, reduite);
      d.items.forEach((it, i) => {
        const x = b.x + dx + (i % cols) * (cw + ecart);
        const y = b.y + Math.floor(i / cols) * (ch + ecart);
        // Le premier élément est là dès l'arrivée de l'écran ; les autres au fil de la voix, leur cadre juste avant.
        const source = it.id;
        p.forme({ id: `${src}#cp${i}`, sorte: "case", x, y, largeur: cw, hauteur: ch, rayon: 26 * k, contour: CONTOUR_SUR[f], epaisseur: EPAISSEURS_V2.pointille * k, pointille: true, source: src, entree: "fondu", attend: `${src}#c${i}` });
        p.forme({ id: `${src}#c${i}`, sorte: "carte", x, y, largeur: cw, hauteur: ch, rayon: 26 * k, remplissage: COULEURS_V2.ivoire, contour: COULEURS_V2.encre, epaisseur: EPAISSEURS_V2.contour * k, ombre: ombreCarte(f), source, entree: "pop", ...(i === 0 ? { decalageMs: 150 } : {}) });
        const pic = pictoLisible ? pictos[i] : undefined;
        if (!pic) {
          const t = texteSeul(ch);
          p.libelle({ id: `${src}#ct${i}`, texte: it.texte, boite: t.boite(x, y), police: "titre", max: Math.max(t.max, 30 * k), min: 30 * k, rangees: 3, couleur: COULEURS_V2.encre, fond: COULEURS_V2.ivoire, source, entree: "pop", vertical: "milieu" });
          return;
        }
        const hl = p.libelle({ id: `${src}#ct${i}`, texte: it.texte, boite: { x: x + 20 * k, y: y + ch * 0.42, largeur: cw - 40 * k, hauteur: ch * 0.58 - 18 * k }, police: "titre", max: Math.min(56 * k, (ch * 0.58 - 18 * k) / 2.3), min: 30 * k, rangees: 2, couleur: COULEURS_V2.encre, fond: COULEURS_V2.ivoire, source, entree: "pop", vertical: "bas" });
        // Au-dessus du texte, le pictogramme de la fiche ; le disque et son dessin entrent ensemble.
        const sp = Math.min(cw - 44 * k, ch - hl - 18 * k - 2 * 22 * k);
        if (sp >= 48 * k) {
          const px = x + (cw - sp) / 2;
          const py = y + 22 * k + (ch - hl - 18 * k - 2 * 22 * k - sp) / 2;
          const dec = 120 + (i === 0 ? 150 : 0);
          p.forme({ id: `${src}#cd${i}`, sorte: "rond", x: px, y: py, largeur: sp, hauteur: sp, rayon: sp / 2, remplissage: COULEURS_V2.sable, source, entree: "pop", decalageMs: dec });
          p.forme({ id: `${src}#ci${i}`, sorte: "dessin", dessin: pic.dessinId, x: px + sp * 0.18, y: py + sp * 0.18, largeur: sp * 0.64, hauteur: sp * 0.64, contour: COULEURS_V2.encre, epaisseur: Math.max(6 * k, sp * 0.03), source, entree: "fondu", decalageMs: dec });
        }
      });
      desLArrivee(p, [`${src}#c0`, `${src}#cd0`, `${src}#ci0`, `${src}#ct0.`]);
      return;
    }
    case "liste": {
      const n = Math.max(1, d.items.length);
      const ecart = 14 * k;
      const avecPilule = d.items.some((it) => it.detail);
      // Corps trop bas pour une rangée par élément lisible (carré) : deux colonnes, l'étiquette au-dessus du détail.
      const rh1 = Math.min(118 * k, (b.hauteur - ecart * (n - 1)) / n);
      const pile = avecPilule && n >= 3 && rh1 < 76 * k && b.largeur >= 700 * k;
      const cols = pile ? 2 : 1;
      const lignes = Math.ceil(n / cols);
      const cw = (b.largeur - ecart * (cols - 1)) / cols;
      const rh = pile ? Math.min(160 * k, (b.hauteur - ecart * (lignes - 1)) / lignes) : rh1;
      const taille = Math.max(22 * k, Math.min(60 * k, rh * 0.5));
      const tp = pile ? Math.min(30 * k, rh * 0.24) : Math.min(34 * k, rh * 0.36);
      const lp = avecPilule ? Math.max(...d.items.map((it) => mesurer(majuscules(it.texte), "titre", tp))) + 40 * k : 0;
      const remp = f === "ivoire" ? null : COULEURS_V2.ivoire;
      const fondTexte = remp ?? fondHex(f);
      const coulTexte = COULEURS_V2.encre;
      d.items.forEach((it, i) => {
        // Le premier élément est là dès l'arrivée de l'écran ; les autres au fil de la voix, leur cadre juste avant.
        const x0 = b.x + (i % cols) * (cw + ecart);
        const y = b.y + Math.floor(i / cols) * (rh + ecart);
        p.forme({ id: `${src}#lp${i}`, sorte: "case", x: x0, y, largeur: cw, hauteur: rh, rayon: 18 * k, contour: CONTOUR_SUR[f], epaisseur: EPAISSEURS_V2.pointille * k, pointille: true, source: src, entree: "fondu", attend: `${src}#l${i}` });
        p.forme({ id: `${src}#l${i}`, sorte: "case", x: x0, y, largeur: cw, hauteur: rh, rayon: 18 * k, remplissage: remp, contour: f === "ivoire" ? COULEURS_V2.encre : null, epaisseur: f === "ivoire" ? 4 * k : 0, source: it.id, entree: "gauche", masqueX: x0 });
        let x = x0 + 18 * k;
        let yZone = y;
        let hZone = rh;
        if (avecPilule) {
          const ph = Math.min(rh - 20 * k, tp * 1.7);
          const yp = pile ? y + 14 * k : y + (rh - ph) / 2;
          p.forme({ id: `${src}#lpil${i}`, sorte: "pastille", x, y: yp, largeur: lp, hauteur: ph, rayon: 12 * k, remplissage: COULEURS_V2.encre, source: it.id, entree: "gauche", masqueX: x0 });
          const lt = mesurer(majuscules(typo(it.texte)), "titre", tp);
          p.texte({ id: `${src}#lpt${i}`, texte: majuscules(typo(it.texte)), x: x + (lp - lt) / 2, y: yp + (ph - tp) / 2, largeur: lt, hauteur: tp, taille: tp, couleur: COULEURS_V2.ivoire, fond: COULEURS_V2.encre, source: it.id, entree: "gauche", masqueX: x0 });
          if (pile) {
            yZone = yp + ph + 6 * k;
            hZone = y + rh - 10 * k - yZone;
          } else x += lp + 22 * k;
        }
        const texte = avecPilule ? it.detail ?? "" : it.texte;
        if (!texte) return;
        const tMax = pile ? Math.min(taille, hZone / 1.1) : taille;
        const un = ajuster(typo(texte), "titre", tMax, Math.min(tMax, TAILLES_V2.libelleMin * k * 0.8), x0 + cw - x - 24 * k, hZone - 6 * k, 1, 1.05);
        // Une rangée trop petite pour être lue (sous le plancher) : deux rangées plus grandes, si elles tiennent.
        const deux = (!un || un.taille < PLANCHER_LIBELLE * k) && hZone >= 2 * PLANCHER_LIBELLE * k * 1.05 ? ajuster(typo(texte), "titre", Math.min(tMax, (hZone - 6 * k) / 2.1), PLANCHER_LIBELLE * k, x0 + cw - x - 24 * k, hZone - 6 * k, 2, 1.05) : null;
        const a = deux ?? un;
        if (!a) throw new ErreurDispositionV2(`la ligne « ${texte} » ne tient pas dans la liste.`, d.id);
        const hA = a.rangees.length * a.taille * 1.05;
        a.rangees.forEach((rg, j) => {
          const lj = mesurer(rg, "titre", a.taille);
          const yj = yZone + (hZone - hA) / 2 - 3 * k + j * a.taille * 1.05;
          p.texte({ id: j ? `${src}#lt${i}~${j}` : `${src}#lt${i}`, texte: rg, x, y: yj, largeur: lj, hauteur: a.taille, taille: a.taille, couleur: coulTexte, fond: fondTexte, source: it.id, entree: "gauche", masqueX: x0 });
        });
        const l = mesurer(a.rangees[a.rangees.length - 1], "titre", a.taille);
        const yt = yZone + (hZone - hA) / 2 - 3 * k + (a.rangees.length - 1) * a.taille * 1.05;
        const yu = yt + a.taille * 0.95;
        if (yu + 8 * k < y + rh) p.trait({ id: `${src}#ls${i}`, sorte: "souligne", segments: [[{ x: x - 4 * k, y: yu + 2 * k }, { x: x + l * 0.4, y: yu + 4 * k }, { x: x + l + 6 * k, y: yu - 2 * k }]], epaisseur: 10 * k, couleur: COULEURS_V2.orange, source: it.id, decalageMs: 320, dureeMs: 280, crayon: true, son: "trait" });
      });
      desLArrivee(p, [`${src}#l0`, `${src}#lpil0`, `${src}#lpt0`, `${src}#lt0`]);
      return;
    }
    case "semaine": {
      // Sans éléments : un jour par jour compté (« en 5 jours » : L M M J V).
      const nJours = Math.min(7, Math.max(2, Number(d.chiffre?.valeur) || 5));
      const lettres = d.items.length ? d.items.map((it) => it.texte) : ["L", "M", "M", "J", "V", "S", "D"].slice(0, nJours);
      const n = lettres.length;
      const ecart = 18 * k;
      // Peu de jours : des cases de jour de taille ordinaire (300 px au plus), la place à droite revient aux
      // pictogrammes (`combler`) au lieu de deux cases géantes presque vides.
      const bw = Math.min((b.largeur - ecart * (n - 1)) / n, 300 * k);
      // Jours sans détail : la case se réduit à sa lettre (jamais une colonne de cases vides).
      const bh = d.items.some((it) => it.detail) ? Math.min(b.hauteur, Math.max(bw * 1.1, Math.min(bw * 2.2, b.hauteur))) : Math.min(b.hauteur, Math.min(bw * 0.62, 96 * k) * 1.1 + 48 * k);
      const y = b.y + (b.hauteur - bh) / 2;
      const plein = f === "ivoire" ? COULEURS_V2.encre : COULEURS_V2.ivoire;
      const texteP = f === "ivoire" ? COULEURS_V2.ivoire : COULEURS_V2.encre;
      const declencheur = d.chiffre?.id ?? d.titres[d.titres.length - 1]?.id ?? src;
      lettres.forEach((l, i) => {
        const x = b.x + i * (bw + ecart);
        const it = d.items[i];
        // Le premier jour est là dès l'arrivée de l'écran ; les autres au fil de la voix, leur cadre juste avant.
        const source = it?.id ?? declencheur;
        const dec = i === 0 ? 120 : it ? 0 : 200 + i * 140;
        p.forme({ id: `${src}#jp${i}`, sorte: "case", x, y, largeur: bw, hauteur: bh, rayon: 22 * k, contour: CONTOUR_SUR[f], epaisseur: EPAISSEURS_V2.pointille * k, pointille: true, source: src, entree: "fondu", attend: `${src}#j${i}` });
        p.forme({ id: `${src}#j${i}`, sorte: "case", x, y, largeur: bw, hauteur: bh, rayon: 22 * k, remplissage: plein, contour: f === "orange" ? COULEURS_V2.encre : null, epaisseur: f === "orange" ? 5 * k : 0, source, entree: "pop", decalageMs: dec });
        const avecDetails = d.items.some((x) => x.detail);
        const tl = Math.min(bw * 0.62, 96 * k, avecDetails ? bh * 0.45 : bh - 40 * k);
        const a = ajuster(majuscules(typo(l)), "titre", tl, 30 * k, bw - 16 * k, avecDetails ? bh * 0.5 : bh - 30 * k, 1, 1);
        if (!a) throw new ErreurDispositionV2(`le jour « ${l} » ne tient pas dans sa case.`, d.id);
        const lt = mesurer(a.rangees[0], "titre", a.taille);
        p.texte({ id: `${src}#jt${i}`, texte: a.rangees[0], x: x + (bw - lt) / 2, y: avecDetails ? y + 18 * k : y + (bh - a.taille) / 2, largeur: lt, hauteur: a.taille, taille: a.taille, couleur: texteP, fond: plein, source, entree: "pop", decalageMs: dec });
        if (it?.detail) {
          p.libelle({ id: `${src}#jd${i}`, texte: it.detail, boite: { x: x + 8 * k, y: y + bh * 0.5, largeur: bw - 16 * k, hauteur: bh * 0.5 - 14 * k }, max: 34 * k, min: PLANCHER_LIBELLE * k, rangees: 2, couleur: texteP, fond: plein, source, entree: "pop", centre: true, vertical: "bas" });
        }
      });
      desLArrivee(p, [`${src}#j0`, `${src}#jt0`, `${src}#jd0.`]);
      return;
    }
    case "exemple": {
      // La carte s'arrête à ses panneaux, eux-mêmes réduits à leur texte (avant : elle descendait jusqu'en bas de
      // l'image, vide sous le clavier) ; la place qui reste sous elle revient aux pictogrammes (`combler`).
      // Panneaux tirés des lignes de la fiche, avant / après selon leur préfixe (jamais selon l'ordre seul) ; aucun : pas
      // de carte, le texte de la scène grandit.
      const pan = panneauxExemple(d);
      // Taille visée du texte des panneaux : 54 px, plus grande quand l'écran grandit son texte.
      const tP = 54 * k * (1 + 0.3 * croissanceCourante);
      if (!pan.length) return;
      const P0 = pan.length > 1 ? pan[0] : null;
      const P1 = pan[pan.length - 1];
      const avant = P0?.texte ?? null;
      const apres = P1.texte;
      const srcAvant = P0?.id ?? src;
      const srcApres = P1.id;
      const decApres = P0 && P1.id === P0.id ? 400 : P1.id === src ? 900 : 0;
      // Le dernier panneau porte la coche, sauf s'il dit « avant ».
      const cocheFin = P1.ton !== "avant";
      // Corps très large (carré ou côte à côte sans titres) : « avant » et « après » côte à côte.
      const large = b.largeur > 1.6 * b.hauteur && b.largeur > 0.8 * p.g.contenu.largeur;
      // Seulement si chaque texte y garde la taille visée (54 px, trois rangées au plus) et que les panneaux tiennent
      // en hauteur ; sinon l'un sous l'autre, comme avant.
      const pwCote = (b.largeur - 12 * k - 60 * k - 24 * k) / 2;
      const hCoteVise = (t: string, apresP: boolean) => {
        const c = apresP && cocheFin;
        const rg = couper(typo(t), "texte", tP, pwCote - 44 * k - (c ? 100 * k : 0), 3);
        return rg ? Math.max(78 * k + rg.length * tP * INTERLIGNE_V2.libelle + 18 * k, c ? 182 * k : 0) : Infinity;
      };
      const cotes = large && !!avant && Math.max(hCoteVise(avant, false), hCoteVise(apres, true)) <= b.hauteur - 44 * k - 30 * k;
      if (large && !avant && pictosEcran(d).length) {
        // Un seul panneau : la carte se resserre à son texte s'il reste à côté la place d'un pictogramme.
        const besoinL = mesurer(typo(apres), "texte", tP) + 44 * k + (cocheFin ? 100 * k : 0) + 60 * k + 12 * k + 20 * k;
        if (b.largeur - besoinL - 28 * k >= LIBRE_A_COMBLER * k) b = { ...b, largeur: Math.round(Math.max(b.largeur * 0.4, besoinL)) };
      }
      const pad = 30 * k;
      if (cotes && pictosEcran(d).length) {
        // Côte à côte : la carte se resserre aux deux textes (une rangée chacun) s'il reste à côté la place d'un pictogramme.
        const besoinP = Math.max(mesurer(typo(avant!), "texte", tP) + 44 * k, mesurer(typo(apres), "texte", tP) + 144 * k) + 20 * k;
        const total = 2 * besoinP + 24 * k + 2 * pad + 12 * k;
        if (b.largeur - total - 28 * k >= LIBRE_A_COMBLER * k) b = { ...b, largeur: Math.round(Math.max(b.largeur * 0.4, total)) };
      }
      const ix = b.x + pad;
      const iw = b.largeur - 12 * k - 2 * pad;
      const pw = cotes ? (iw - 24 * k) / 2 : iw;
      // Le panneau « avant » (là dès l'arrivée) prend la plus grande part ; celui de l'« après » est annoncé dès l'arrivée
      // (cadre en pointillés, étiquette, texte estompé) : la carte n'a jamais une moitié vide.
      const utile = b.hauteur - 14 * k - pad - (avant && !cotes ? 24 * k : 0);
      // Carte basse (carré) : parts égales, pour que le texte de l'« après » tienne.
      const part = utile > 360 * k ? PART_AVANT_EXEMPLE : 0.5;
      // Hauteur dont un panneau a besoin : étiquette, texte (54 px au plus), case de l'« après ».
      const besoin = (texte: string, apresP: boolean) => {
        const c = apresP && cocheFin;
        const haut = (apresP ? P1 : P0)?.etiquette ? 78 * k : 22 * k;
        const a = ajuster(typo(texte), "texte", tP, PLANCHER_LIBELLE * k, pw - 44 * k - (c ? 100 * k : 0), 1e5, 5, INTERLIGNE_V2.libelle);
        const h = haut + (a ? a.rangees.length * a.taille * INTERLIGNE_V2.libelle : 0) + 18 * k;
        return c ? Math.max(h, haut + 84 * k + 20 * k) : h;
      };
      const bAp = besoin(apres, true);
      // L'« avant » (là le premier) reste le plus grand quand la place le permet ; côte à côte, même hauteur.
      const hCote = cotes ? Math.min(utile, Math.max(besoin(avant!, false), bAp)) : 0;
      // Chaque panneau à la hauteur de son texte (jamais un panneau à moitié vide) ; le premier reste le plus grand
      // quand son texte le demande.
      const hauteurs = cotes ? [hCote, hCote] : avant ? [Math.min(utile * part, besoin(avant, false)), Math.min(utile * (1 - part), bAp)] : [Math.min(utile, bAp)];
      const hCarte = pad + (cotes ? hCote : hauteurs.reduce((x, h) => x + h, 0) + (avant ? 24 * k : 0)) + 14 * k;
      // Corps large (côte à côte) : la carte est centrée en hauteur dans sa place (jamais tout le vide dessous).
      if (large && b.hauteur > hCarte) b = { ...b, y: b.y + (b.hauteur - hCarte) / 2 };
      const c = carte(p, `${src}#carte`, { ...b, hauteur: Math.min(b.hauteur, hCarte) }, false, src);
      // La carte arrive avec son premier panneau, jamais vide avant lui (avant : la carte entrait seule, vide).
      p.formes[p.formes.length - 1].attend = `${src}#${avant ? "av" : "ap"}`;
      let ph = hauteurs[0];
      let y = c.y + pad;
      let px = ix;
      const etiquette = (id: string, texte: string, x: number, yy: number, fondE: string, coul: string, source: string, decalageMs: number) => {
        // 30 px ; plus petite si elle dépasse le panneau (jamais sous le plancher de lisibilité : sinon, ne tient pas).
        const place = px + pw - 20 * k - x - 28 * k;
        const t = Math.min(30 * k, Math.floor(((30 * k) / mesurer(texte, "titre", 30 * k)) * place));
        if (t < PLANCHER_LIBELLE * k) throw new ErreurDispositionV2(`l'étiquette « ${texte} » ne tient pas dans la carte de l'exemple.`, d.id);
        const l = mesurer(texte, "titre", t);
        p.forme({ id: `${id}f`, sorte: "pastille", x, y: yy, largeur: l + 28 * k, hauteur: t + 18 * k, rayon: 10 * k, remplissage: fondE, source, entree: "pop", decalageMs });
        p.texte({ id, texte, x: x + 14 * k, y: yy + 9 * k, largeur: l, hauteur: t, taille: t, couleur: coul, fond: fondE, source, entree: "pop", decalageMs });
        return l + 28 * k;
      };
      const panneau = (cle: string, P: PanneauExemple, source: string, dec: number, apresP: boolean) => {
        const texte = P.texte;
        // Rempli et coché : le dernier panneau, sauf s'il dit « avant » ; en pointillés : un panneau « avant » (ou le
        // premier de deux panneaux sans préfixe).
        const plein = P.ton === "apres" || (P.ton === "neutre" && apresP);
        const coche = apresP && cocheFin;
        // Emplacement du second panneau annoncé dès l'arrivée (cadre en pointillés, étiquette, texte estompé).
        if (apresP && avant) p.forme({ id: `${src}#${cle}p`, sorte: "case", x: px, y, largeur: pw, hauteur: ph, rayon: 22 * k, contour: COULEURS_V2.encre, epaisseur: EPAISSEURS_V2.pointille * k, pointille: true, source: src, entree: "fondu", desLArrivee: true });
        p.forme({ id: `${src}#${cle}`, sorte: "case", x: px, y, largeur: pw, hauteur: ph, rayon: 22 * k, remplissage: plein ? COULEURS_V2.ivoire : null, contour: COULEURS_V2.encre, epaisseur: (plein ? 6 : 4) * k, pointille: !plein, source, entree: "pop", decalageMs: dec });
        if (P.etiquette) {
          etiquette(`${src}#${cle}e`, P.etiquette, px + 20 * k, y + 18 * k, COULEURS_V2.encre, COULEURS_V2.ivoire, source, dec);
          if (apresP && avant) for (const o of [...p.formes, ...p.textes]) if (o.id === `${src}#${cle}e` || o.id === `${src}#${cle}ef`) Object.assign(o, { source: src, desLArrivee: true, decalageMs: 0 });
        }
        const haut = P.etiquette ? 78 * k : 22 * k;
        const boite = { x: px + 22 * k, y: y + haut, largeur: pw - 44 * k - (coche ? 100 * k : 0), hauteur: ph - haut - 12 * k };
        p.libelle({ id: `${src}#${cle}t`, texte, boite, police: "texte", max: tP, min: PLANCHER_LIBELLE * k, rangees: 5, couleur: COULEURS_V2.encre, fond: COULEURS_V2.ivoire, source, entree: "fondu", ...(apresP && avant ? { avant: "estompe" as const } : {}) });
        if (coche) {
          const caseR: RectV2 = { x: px + pw - 20 * k - 84 * k, y: y + ph - 20 * k - 84 * k, largeur: 84 * k, hauteur: 84 * k };
          p.forme({ id: `${src}#${cle}c`, sorte: "case", ...caseR, rayon: 16 * k, contour: COULEURS_V2.encre, epaisseur: 6 * k, source, entree: "pop", decalageMs: dec });
          p.trait({ id: `${src}#${cle}k`, sorte: "coche", segments: segmentsCoche(caseR), epaisseur: EPAISSEURS_V2.coche * k, couleur: COULEURS_V2.orange, source: d.coches[0] ?? source, decalageMs: d.coches[0] ? 0 : dec + 700, dureeMs: 320, crayon: true, son: "validation" });
        }
        if (cotes) px += pw + 24 * k;
        else y += ph + 24 * k;
        ph = hauteurs[1] ?? ph;
      };
      if (P0) panneau("av", P0, srcAvant, 250, false);
      // Le premier panneau est là dès l'arrivée de l'écran (la carte n'est jamais vide) ; son étiquette suit la voix.
      desLArrivee(p, [`${src}#av`, `${src}#ave`, `${src}#avef`, `${src}#avt.`]);
      panneau("ap", P1, srcApres, decApres, true);
      // Le décalage du texte du second panneau suit celui de son panneau.
      for (const t of p.textes) if (t.id.startsWith(`${src}#apt`)) t.decalageMs = decApres + 200;
      return;
    }
    case "recapitulatif": {
      // Corps très large (côte à côte, sans titres) : la liste se resserre à ses lignes (mêmes tailles, la case juste
      // après la plus longue), la place à droite revient aux pictogrammes (`combler`) au lieu d'un grand vide.
      if (p.g.mode === "cote" && b.largeur > 1.6 * b.hauteur && b.largeur > 0.8 * p.g.contenu.largeur && pictosEcran(d).length) {
        const n0 = Math.max(1, d.items.length);
        const rh0 = Math.min(150 * k, (b.hauteur - 16 * k * (n0 - 1)) / n0);
        const r = recapitulatifSerre(d, b, rh0, k);
        const tw = b.largeur - 2 * r.sq - 52 * k;
        const a = d.items.map((it) => (r.rangees === 1 ? ligneRecapitulatif(it.texte, tw, it.detail ? r.sq * 0.62 : r.sq, k, 1) : null));
        if (a.every(Boolean)) {
          const texteMax = Math.max(...d.items.map((it, i) => Math.max(mesurer(a[i]!.rangees[0], "titre", a[i]!.taille), it.detail ? mesurer(typo(it.detail), "texte", 34 * k) : 0)));
          const besoin = Math.ceil(texteMax + 2 * r.sq + 52 * k + 40 * k);
          if (besoin <= b.largeur - LIBRE_A_COMBLER * k - 28 * k && recapitulatifSerre(d, { ...b, largeur: besoin }, rh0, k).sq === r.sq) b = { ...b, largeur: besoin };
        }
      }
      const n = Math.max(1, d.items.length);
      const ecart = 16 * k;
      const rh = Math.min(150 * k, (b.hauteur - ecart * (n - 1)) / n);
      // Chaque ligne sur une rangée, à côté de son numéro et de sa case (la vidéo modèle). Une ligne qui ne tient pas
      // ainsi, même à 30 px : la ligne passe sur deux rangées serrées, puis les numéros et les cases rapetissent (la
      // largeur va au texte) ; jamais sous la taille plancher.
      const serrer = recapitulatifSerre(d, b, rh, k);
      const sq = serrer.sq;
      const numFond = f === "encre" ? COULEURS_V2.ivoire : COULEURS_V2.encre;
      const numTexte = f === "encre" ? COULEURS_V2.encre : COULEURS_V2.ivoire;
      d.items.forEach((it, i) => {
        const y = b.y + i * (rh + ecart) + (rh - sq) / 2;
        p.forme({ id: `${src}#rn${i}`, sorte: "numero", x: b.x, y, largeur: sq, hauteur: sq, rayon: 14 * k, remplissage: numFond, source: it.id, entree: "pop", avant: "estompe" });
        const tn = sq * 0.7;
        const ln = mesurer(String(i + 1), "titre", tn);
        p.texte({ id: `${src}#rnt${i}`, texte: String(i + 1), x: b.x + (sq - ln) / 2, y: y + (sq - tn) / 2, largeur: ln, hauteur: tn, taille: tn, couleur: numTexte, fond: numFond, source: it.id, entree: "pop", avant: "estompe" });
        const caseR: RectV2 = { x: b.x + b.largeur - sq, y, largeur: sq, hauteur: sq };
        p.forme({ id: `${src}#rc${i}`, sorte: "case", ...caseR, rayon: 14 * k, contour: f === "orange" ? COULEURS_V2.encre : COULEURS_V2.orange === TRAIT_SUR[f] ? TEXTE_SUR[f] : TEXTE_SUR[f], epaisseur: 6 * k, source: src, entree: "fondu" });
        p.trait({ id: `${src}#rk${i}`, sorte: "coche", segments: segmentsCoche(caseR), epaisseur: EPAISSEURS_V2.coche * k, couleur: TRAIT_SUR[f], source: it.id, decalageMs: 380, dureeMs: 300, crayon: true, son: "validation" });
        const tx = b.x + sq + 26 * k;
        const tw = b.largeur - 2 * sq - 52 * k;
        const hT = it.detail ? sq * 0.62 : sq;
        // Sur l'orange, le texte de la ligne est posé sur une bande ivoire (jamais de petit texte sur l'orange).
        const bande = f === "orange";
        const coulL = bande ? COULEURS_V2.encre : TEXTE_SUR[f];
        const fondL = bande ? COULEURS_V2.ivoire : fondHex(f);
        if (bande) p.forme({ id: `${src}#rf${i}`, sorte: "case", x: tx - 14 * k, y: y - 4 * k, largeur: tw + 28 * k, hauteur: sq + 8 * k, rayon: 14 * k, remplissage: COULEURS_V2.ivoire, source: it.id, entree: "aucune", avant: "estompe" });
        const a = ligneRecapitulatif(it.texte, tw, hT, k, serrer.rangees, serrer.taille);
        if (!a) throw new ErreurDispositionV2(`la ligne « ${it.texte} » ne tient pas dans le récapitulatif.`, d.id);
        const hA = a.rangees.length * a.taille * a.interligne;
        a.rangees.forEach((r, j) => {
          const l = mesurer(r, "titre", a.taille);
          const yR = y + (it.detail ? 0 : (sq - hA) / 2) + j * a.taille * a.interligne;
          p.texte({ id: j ? `${src}#rt${i}~${j}` : `${src}#rt${i}`, texte: r, x: tx, y: yR, largeur: l, hauteur: a.taille, taille: a.taille, couleur: coulL, fond: fondL, source: it.id, entree: "aucune", avant: "estompe" });
        });
        if (it.detail) {
          const a2 = detailRecapitulatif(it.detail, tw, sq, hA, k);
          if (!a2) throw new ErreurDispositionV2(`le détail « ${it.detail} » ne tient pas dans le récapitulatif.`, d.id);
          const l2 = mesurer(a2.rangees[0], "texte", a2.taille);
          p.texte({ id: `${src}#rd${i}`, texte: a2.rangees[0], x: tx, y: y + hA + 6 * k, largeur: l2, hauteur: a2.taille * 1.1, taille: a2.taille, police: "texte", couleur: coulL, fond: fondL, source: it.id, entree: "aucune", avant: "estompe" });
        }
      });
      return;
    }
    case "appel-commentaire": {
      const mot = d.motCommentaire ? majuscules(typo(d.motCommentaire)) : "";
      const bh = Math.min(b.hauteur, 190 * k);
      const y = b.y + (b.hauteur - bh) / 2;
      const ligne = d.titres.find((t) => d.motCommentaire && t.texte.split(/\s+/).some((m) => cleMotV2(m) === cleMotV2(d.motCommentaire!))) ?? d.titres[0];
      const source = ligne?.id ?? src;
      const attendBulle = mot ? { attend: `${src}#frappe` } : {};
      p.forme({ id: `${src}#bulle`, sorte: "carte", x: b.x, y, largeur: b.largeur - 12 * k, hauteur: bh, rayon: 40 * k, remplissage: COULEURS_V2.ivoire, contour: COULEURS_V2.encre, epaisseur: EPAISSEURS_V2.contour * k, ombre: ombreCarte(f), source: src, entree: "pop", ...attendBulle });
      const av = bh * 0.5;
      p.forme({ id: `${src}#avatar`, sorte: "rond", x: b.x + 30 * k, y: y + (bh - av) / 2, largeur: av, hauteur: av, rayon: av / 2, remplissage: COULEURS_V2.sable, source: src, entree: "pop", ...attendBulle });
      const bouton = bh * 0.56;
      const bx = b.x + b.largeur - 12 * k - 30 * k - bouton;
      const boutonR: RectV2 = { x: bx, y: y + (bh - bouton) / 2, largeur: bouton, hauteur: bouton };
      p.forme({ id: `${src}#envoi`, sorte: "bouton", ...boutonR, rayon: bouton / 2, remplissage: COULEURS_V2.orange, source: src, entree: "pop", ...attendBulle });
      const tx = b.x + 30 * k + av + 28 * k;
      const tw = bx - 20 * k - tx;
      const a = mot ? ajuster(mot, "titre", Math.min(80 * k, bh * 0.5), 40 * k, tw, bh * 0.6, 1, 1) : null;
      if (a) {
        const l = mesurer(a.rangees[0], "titre", a.taille);
        p.texte({ id: `${src}#frappe`, texte: a.rangees[0], x: tx, y: y + (bh - a.taille) / 2, largeur: l, hauteur: a.taille, taille: a.taille, couleur: COULEURS_V2.encre, fond: COULEURS_V2.ivoire, source, entree: "tape", motCle: cleMotV2(mot), decalageMs: 250 });
      }
      p.trait({ id: `${src}#envoik`, sorte: "coche", segments: segmentsCoche({ x: boutonR.x + bouton * 0.12, y: boutonR.y + bouton * 0.12, largeur: bouton * 0.76, hauteur: bouton * 0.76 }), epaisseur: EPAISSEURS_V2.coche * k, couleur: COULEURS_V2.ivoire, source: d.coches[0] ?? source, decalageMs: d.coches[0] ? 0 : 1700, dureeMs: 280, crayon: false, son: "validation" });
      return;
    }
    case "appel-diagnostic": {
      const c = carte(p, `${src}#carte`, b, false, src, "pop");
      const pad = 30 * k;
      const ix = c.x + pad;
      const iw = c.largeur - 2 * pad;
      const boutonH = Math.min(96 * k, c.hauteur * 0.26);
      const gh = c.hauteur - 2 * pad - boutonH - 24 * k;
      const cols = 5;
      const lignes = 2;
      const e = 14 * k;
      const cw = (iw - e * (cols - 1)) / cols;
      const chh = Math.min((gh - e * (lignes - 1)) / lignes, cw);
      for (let i = 0; i < cols * lignes; i++) {
        const x = ix + (i % cols) * (cw + e);
        const y = c.y + pad + Math.floor(i / cols) * (chh + e);
        const choisi = i === 7;
        p.forme({ id: `${src}#g${i}`, sorte: "case", x, y, largeur: cw, hauteur: chh, rayon: 12 * k, remplissage: choisi ? COULEURS_V2.orange : null, contour: COULEURS_V2.encre, epaisseur: 4 * k, pointille: !choisi, source: choisi ? d.titres[d.titres.length - 1]?.id ?? src : src, entree: "pop", decalageMs: choisi ? 600 : i * 40 });
        if (choisi) p.trait({ id: `${src}#gk`, sorte: "coche", segments: segmentsCoche({ x, y, largeur: cw, hauteur: chh }), epaisseur: EPAISSEURS_V2.coche * k, couleur: COULEURS_V2.ivoire, source: d.coches[0] ?? d.titres[d.titres.length - 1]?.id ?? src, decalageMs: d.coches[0] ? 0 : 900, dureeMs: 300, crayon: false, son: "validation" });
      }
      const by = c.y + c.hauteur - pad - boutonH;
      p.forme({ id: `${src}#bouton`, sorte: "pastille", x: ix, y: by, largeur: iw, hauteur: boutonH, rayon: boutonH / 2, remplissage: COULEURS_V2.encre, source: src, entree: "pop" });
      p.libelle({ id: `${src}#boutont`, texte: "Appel de diagnostic", boite: { x: ix + 30 * k, y: by + 8 * k, largeur: iw - 60 * k, hauteur: boutonH - 16 * k }, police: "titre", max: 44 * k, min: 28 * k, rangees: 1, couleur: COULEURS_V2.ivoire, fond: COULEURS_V2.encre, source: src, entree: "pop", centre: true, vertical: "milieu" });
      return;
    }
    case "appel-site": {
      // Fin sans appel (ou avec la phrase de la fin au-dessus) : le site en grand, au centre du corps, souligné au crayon.
      // Le pictogramme de la fin vient en grand à côté (corps large) ou dessous (`combler`) : le site occupe la gauche
      // du corps, centré en hauteur, ou le haut du corps ; jamais un écran vide autour de lui.
      const large = b.largeur > 1.4 * b.hauteur;
      const lb = large ? b.largeur * 0.6 : b.largeur;
      const a = ajuster(SIGNATURE_V2, "titre", TAILLES_V2.signatureFin * 1.3 * k, 40 * k, lb - 40 * k, b.hauteur * 0.8, 1, 1);
      if (!a) return;
      const l = mesurer(SIGNATURE_V2, "titre", a.taille);
      const x = b.x + (lb - l) / 2;
      const y = large ? b.y + (b.hauteur - a.taille) / 2 : b.y + Math.min((b.hauteur - a.taille) / 2, 40 * k);
      p.texte({ id: `${src}#site`, texte: SIGNATURE_V2, x, y, largeur: l, hauteur: a.taille, taille: a.taille, couleur: TEXTE_SUR[f], fond: fondHex(f), source: src, entree: "pop" });
      const yu = y + a.taille * 0.98;
      p.trait({ id: `${src}#sites`, sorte: "souligne", segments: [[{ x: x - 6 * k, y: yu + 2 * k }, { x: x + l * 0.45, y: yu + 5 * k }, { x: x + l + 8 * k, y: yu - 2 * k }]], epaisseur: EPAISSEURS_V2.souligne * k, couleur: TRAIT_SUR[f], source: src, decalageMs: 420, dureeMs: 420, crayon: true, son: "trait" });
      return;
    }
  }
}

/** Un panneau de l'exemple : une ligne de la fiche, son ton (selon son préfixe) et son étiquette. */
export interface PanneauExemple {
  /** Élément dont l'heure déclenche le panneau (ligne, preuve, élément de liste). */
  id: string;
  texte: string;
  ton: "avant" | "apres" | "neutre";
  etiquette: string | null;
}

/** Ton d'une ligne selon son préfixe (« Avant : », « Après : ») ; null sans préfixe. */
export function tonDeLigne(texte: string): "avant" | "apres" | null {
  const t = texte.trim();
  if (/^avant\s*:/iu.test(t)) return "avant";
  if (/^apr[eè]s\s*:/iu.test(t)) return "apres";
  return null;
}

/**
 * Panneaux de l'exemple, tirés des lignes de la fiche (relecture des quatre vidéos du 12/10/2026 : sous « AVANT » on
 * lisait un contenu d'après). L'étiquette AVANT ou APRÈS ne vient QUE du préfixe de la ligne, jamais de l'ordre :
 *  - lignes de la preuve (deux au plus) : « Avant : … » → AVANT, « Après : … » → APRÈS ; « Entre : le mail » → ENTRE
 *    (préfixe court, trois mots au plus), le texte après les deux-points ; sans préfixe, pas d'étiquette ;
 *  - sans preuve : les lignes de l'écran qui commencent par « Avant : » ou « Après : » (deux au plus) ;
 *  - sinon les éléments de liste à détail (« Avant » / « Après » comme texte, le détail dans le panneau).
 * Aucune : pas de panneau (le texte de la scène grandit).
 */
export function panneauxExemple(d: Pick<DescriptionEcran, "id" | "avantApres" | "titres" | "items">): PanneauExemple[] {
  const NOMS = { avant: "AVANT", apres: "APRÈS" } as const;
  const deLigne = (id: string, ligne: string): PanneauExemple => {
    const ton = tonDeLigne(ligne);
    if (ton) return { id, texte: ligne, ton, etiquette: NOMS[ton] };
    const m = /^([^:]{1,28}?)\s*:\s*(.+)$/u.exec(ligne.trim());
    if (m && m[1].split(/\s+/).length <= 3) return { id, texte: m[2], ton: "neutre", etiquette: majuscules(typo(m[1])) };
    return { id, texte: ligne, ton: "neutre", etiquette: null };
  };
  const av = d.avantApres;
  if (av) {
    const lignes = av.lignes ?? [av.avant, av.apres].filter((x): x is string => !!x);
    // Une ligne sans préfixe prend pour étiquette l'élément de liste de même rang (« TROP FROID », « À SON IMAGE »),
    // s'il y en a un : l'étiquette vient toujours de la fiche.
    return lignes.slice(0, 2).map((l, i) => {
      const x = deLigne(av.id, l);
      const it = d.items[lignes.length === 1 ? d.items.length - 1 : i];
      return !x.etiquette && it && !it.detail ? { ...x, etiquette: majuscules(typo(it.texte)) } : x;
    });
  }
  const prefixees = d.titres.filter((t) => tonDeLigne(t.texte));
  if (prefixees.length) return prefixees.slice(0, 2).map((t) => deLigne(t.id, t.texte));
  return d.items
    .filter((it) => it.detail)
    .slice(0, 2)
    .map((it) => {
      const ton = tonDeLigne(`${it.texte} :`);
      return { id: it.id, texte: it.detail!, ton: ton ?? "neutre", etiquette: ton ? NOMS[ton] : majuscules(typo(it.texte)) };
    });
}

/** Interligne d'une ligne du récapitulatif passée sur deux rangées (serré : majuscules, sans jambages). */
const INTERLIGNE_RECAP_SERRE = 1.04;

/**
 * Une ligne du récapitulatif : une rangée (comme la vidéo modèle), ou, si `rangees` vaut 2, deux rangées serrées au plus.
 * `taille` (deux rangées) : la taille commune à toutes les lignes de l'écran ; une ligne qui tient sur une rangée à
 * cette taille y reste.
 */
function ligneRecapitulatif(texte: string, tw: number, hT: number, k: number, rangees: 1 | 2, taille?: number): { taille: number; rangees: string[]; interligne: number } | null {
  const t = majuscules(typo(texte));
  // Jamais sous le plancher de lisibilité (avant : la hauteur de la case, même plus petite, faisait la taille).
  if (hT < PLANCHER_LIBELLE * k) return null;
  if (rangees === 1) {
    const a = ajuster(t, "titre", Math.min(64 * k, hT), Math.min(30 * k, hT), tw, hT, 1, 1);
    return a ? { ...a, interligne: 1 } : null;
  }
  if (taille !== undefined) {
    const rg = couper(t, "titre", taille, tw, 2);
    return rg && rg.length * taille * INTERLIGNE_RECAP_SERRE <= hT + 0.5 ? { taille, rangees: rg, interligne: rg.length > 1 ? INTERLIGNE_RECAP_SERRE : 1 } : null;
  }
  const max = Math.min(64 * k, hT / (2 * INTERLIGNE_RECAP_SERRE));
  if (max < 30 * k) return null;
  const a = ajuster(t, "titre", max, 30 * k, tw, hT, 2, INTERLIGNE_RECAP_SERRE);
  return a ? { ...a, interligne: INTERLIGNE_RECAP_SERRE } : null;
}

/** Le détail d'une ligne du récapitulatif, sous elle (34 px au plus, jamais sous le plancher de lisibilité). */
function detailRecapitulatif(detail: string, tw: number, sq: number, hA: number, k: number): { taille: number; rangees: string[] } | null {
  const t2 = Math.min(34 * k, sq - hA - 6 * k);
  if (t2 < PLANCHER_LIBELLE * k) return null;
  return ajuster(typo(detail), "texte", t2, PLANCHER_LIBELLE * k, tw, sq - hA, 1, 1.1);
}

/**
 * Taille des numéros et des cases du récapitulatif, et nombre de rangées des lignes. D'abord la disposition de la vidéo
 * modèle (cases à 86 % de la rangée, une rangée par ligne) ; si une ligne n'y tient pas, deux rangées serrées ; puis
 * des cases plus petites (jusqu'à 60 % de la rangée, 64 px au moins), qui laissent la largeur au texte.
 */
function recapitulatifSerre(d: DescriptionEcran, b: RectV2, rh: number, k: number): { sq: number; rangees: 1 | 2; taille?: number } {
  const essais: { part: number; rangees: 1 | 2 }[] = [
    { part: 0.86, rangees: 1 },
    { part: 0.86, rangees: 2 },
    { part: 0.72, rangees: 2 },
    { part: 0.6, rangees: 2 },
  ];
  for (const e of essais) {
    // Premier essai : la case de la vidéo modèle, inchangée ; les suivants ne descendent pas sous 64 px.
    const sq = e.part === essais[0].part ? rh * e.part : Math.max(Math.min(64 * k, rh * essais[0].part), rh * e.part);
    const tw = b.largeur - 2 * sq - 52 * k;
    const tient = (it: DescriptionEcran["items"][number]) => {
      const a = ligneRecapitulatif(it.texte, tw, it.detail ? sq * 0.62 : sq, k, e.rangees);
      return !!a && (!it.detail || !!detailRecapitulatif(it.detail, tw, sq, a.rangees.length * a.taille * a.interligne, k));
    };
    if (!d.items.every(tient)) continue;
    if (e.rangees === 1) return { sq, rangees: 1 };
    // Deux rangées : une seule taille pour toutes les lignes (la plus petite de celles qui tiennent), comme la vidéo modèle.
    const taille = Math.min(...d.items.map((it) => ligneRecapitulatif(it.texte, tw, it.detail ? sq * 0.62 : sq, k, 2)!.taille));
    const memeTaille = (it: DescriptionEcran["items"][number]) => {
      const a = ligneRecapitulatif(it.texte, tw, it.detail ? sq * 0.62 : sq, k, 2, taille);
      return !!a && (!it.detail || !!detailRecapitulatif(it.detail, tw, sq, a.rangees.length * a.taille * a.interligne, k));
    };
    if (d.items.every(memeTaille)) return { sq, rangees: 2, taille };
  }
  return { sq: rh * 0.86, rangees: 1 };
}

/* ------------------------------------------------------------------ */
/* En-tête, barre des étapes, décor, signature de fin                    */
/* ------------------------------------------------------------------ */

function entete(p: Pose, etapes: readonly EtapeBarre[]): void {
  const { d, g, k, f } = p;
  const t = g.tete;
  // Signature : petite, en haut à droite, dans la zone sûre ; sur l'orange, dans une pastille encre.
  const ts = TAILLES_V2.signature * k;
  const ls = mesurer(SIGNATURE_V2, "texte", ts);
  const pilule = f === "orange";
  const xs = t.x + t.largeur - ls - (pilule ? 14 * k : 0);
  if (pilule) p.forme({ id: "sig#f", sorte: "pastille", x: xs - 14 * k, y: t.y + (t.hauteur - ts * 1.5) / 2, largeur: ls + 28 * k, hauteur: ts * 1.5, rayon: 10 * k, remplissage: COULEURS_V2.encre, source: d.id, entree: "aucune" });
  p.texte({ id: "sig", texte: SIGNATURE_V2, x: xs, y: t.y + (t.hauteur - ts * 1.2) / 2, largeur: ls, hauteur: ts * 1.2, taille: ts, police: "texte", couleur: pilule ? COULEURS_V2.ivoire : TEXTE_SUR[f], fond: pilule ? COULEURS_V2.encre : fondHex(f), source: d.id, entree: "aucune", horsContenu: true });
  // Étiquette de section : pastille encre (ivoire sur l'encre), texte en capitales.
  if (d.etiquette) {
    const te = TAILLES_V2.etiquette * k;
    const txt = majuscules(typo(d.etiquette));
    const le = mesurer(txt, "titre", te);
    const fondE = f === "encre" ? COULEURS_V2.ivoire : COULEURS_V2.encre;
    const coulE = f === "encre" ? COULEURS_V2.encre : COULEURS_V2.ivoire;
    const he = te * 1.6;
    p.forme({ id: "etq#f", sorte: "pastille", x: t.x, y: t.y + (t.hauteur - he) / 2, largeur: le + 36 * k, hauteur: he, rayon: 10 * k, remplissage: fondE, source: d.id, entree: "gauche" });
    p.forme({ id: "etq#o", sorte: "jauge", x: t.x, y: t.y + (t.hauteur - he) / 2, largeur: 8 * k, hauteur: he, rayon: 4 * k, remplissage: COULEURS_V2.orange, source: d.id, entree: "gauche" });
    p.texte({ id: "etq", texte: txt, x: t.x + 22 * k, y: t.y + (t.hauteur - te) / 2, largeur: le, hauteur: te, taille: te, couleur: coulE, fond: fondE, source: d.id, entree: "gauche", horsContenu: true });
  }
  // Fil de progression (largeur animée par le rendu).
  p.forme({ id: "fil#piste", sorte: "jauge", x: g.fil.x, y: g.fil.y, largeur: g.fil.largeur, hauteur: g.fil.hauteur, rayon: g.fil.hauteur / 2, remplissage: f === "ivoire" ? "#110A0524" : f === "orange" ? "#110A0538" : "#E9DCC838", source: d.id, entree: "aucune" });
  p.forme({ id: "fil", sorte: "jauge", x: g.fil.x, y: g.fil.y, largeur: g.fil.largeur, hauteur: g.fil.hauteur, rayon: g.fil.hauteur / 2, remplissage: f === "encre" ? COULEURS_V2.ivoire : COULEURS_V2.encre, source: d.id, entree: "aucune" });
  // Barre des étapes : écrans de la méthode et récapitulatif.
  const montrer = (d.moment === "etape" && d.etape) || (d.moment === "recapitulatif" && etapes.length > 1);
  if (!montrer || !etapes.length) return;
  const b = g.barre;
  const n = etapes.length;
  const e = 12 * k;
  const tb = TAILLES_V2.etapeBarre * k;
  const libelleDe = (et: EtapeBarre) => `${et.n} · ${majuscules(typo(et.nom))}`;
  const enCours = d.moment === "recapitulatif" ? n + 1 : d.etape!.n;
  // Toutes les cases à parts égales si chaque libellé y tient lisible (18 px au moins) ; sinon (cinq étapes en portrait :
  // « 5 · ENTRÉE, SORTIE » réduit à « 5 », relecture du 12/10/2026) l'étape en cours garde son libellé entier dans une
  // case plus large et les autres montrent leur numéro seul ; au récapitulatif, les numéros seuls.
  const egale = (b.largeur - e * (n - 1)) / n;
  const tient = etapes.every((et) => !!ajuster(libelleDe(et), "titre", tb, 18 * k, egale - 16 * k, b.hauteur - 14 * k, 1, 1));
  const iCours = etapes.findIndex((et) => et.n === enCours);
  const larges = etapes.map(() => egale);
  if (!tient && iCours >= 0) {
    const voulu = Math.min(b.largeur * 0.5, mesurer(libelleDe(etapes[iCours]), "titre", tb) + 32 * k);
    const reste = (b.largeur - e * (n - 1) - voulu) / Math.max(1, n - 1);
    etapes.forEach((_, i) => (larges[i] = i === iCours ? voulu : reste));
  }
  // Sur l'orange, la barre est posée sur une bande encre (le petit texte n'est jamais sur l'orange).
  const fondBarre: FondV2 = f === "orange" ? "encre" : f;
  if (f === "orange") p.forme({ id: "barre#fond", sorte: "pastille", x: b.x - 10 * k, y: b.y - 8 * k, largeur: b.largeur + 20 * k, hauteur: b.hauteur + 16 * k, rayon: 18 * k, remplissage: COULEURS_V2.encre, source: d.id, entree: "aucune" });
  let x = b.x;
  etapes.forEach((et, i) => {
    const sw = larges[i];
    const etat = et.n < enCours ? "fait" : et.n === enCours ? "cours" : "avenir";
    const clair = fondBarre === "encre";
    const plein = clair ? COULEURS_V2.ivoire : COULEURS_V2.encre;
    const remp = etat === "avenir" ? null : etat === "cours" ? (clair ? COULEURS_V2.orange : COULEURS_V2.encre) : plein;
    const contour = etat === "cours" ? COULEURS_V2.orange : etat === "avenir" ? (clair ? COULEURS_V2.sable : COULEURS_V2.encre) : plein;
    p.forme({ id: `barre#${i}`, sorte: "case", x, y: b.y, largeur: sw, hauteur: b.hauteur, rayon: 14 * k, remplissage: remp === COULEURS_V2.orange ? COULEURS_V2.ivoire : remp, contour, epaisseur: 4 * k, pointille: etat === "avenir", source: d.id, entree: "aucune" });
    if (etat === "cours") p.forme({ id: "barre#jauge", sorte: "jauge", x: x + 4 * k, y: b.y + b.hauteur - 10 * k, largeur: sw - 8 * k, hauteur: 6 * k, rayon: 3 * k, remplissage: COULEURS_V2.orange, source: d.id, entree: "aucune" });
    const fondTexte = etat === "avenir" ? fondHex(fondBarre) : remp === COULEURS_V2.orange ? COULEURS_V2.ivoire : remp!;
    const coul = etat === "avenir" ? (clair ? COULEURS_V2.sable : COULEURS_V2.encre) : fondTexte === COULEURS_V2.encre ? COULEURS_V2.ivoire : COULEURS_V2.encre;
    const libelle = tient || i === iCours ? libelleDe(et) : String(et.n);
    const a = ajuster(libelle, "titre", tb, 18 * k, sw - 16 * k, b.hauteur - 14 * k, 1, 1) ?? ajuster(String(et.n), "titre", tb, 18 * k, sw - 8 * k, b.hauteur - 8 * k, 1, 1);
    if (a) {
      const l = mesurer(a.rangees[0], "titre", a.taille);
      p.texte({ id: `barre#t${i}`, texte: a.rangees[0], x: x + (sw - l) / 2, y: b.y + (b.hauteur - a.taille) / 2 - 2 * k, largeur: l, hauteur: a.taille, taille: a.taille, couleur: coul, fond: fondTexte, source: d.id, entree: "aucune", horsContenu: true });
    }
    x += sw + e;
  });
}

/** Décor sous la zone sûre (seulement des formes) : grand chiffre ou mot en contour. */
function decor(p: Pose): void {
  const { d, g, k, f } = p;
  const bas = g.zoneSure.y + g.zoneSure.hauteur;
  const libre = g.hauteur - bas;
  if (libre < 160 * k || p.formes.some((x) => x.horsZone)) return;
  const premierFort = d.titres.flatMap((t) => t.texte.split(/\s+/).filter((m) => t.forts.includes(cleMotV2(m))))[0];
  const texte = d.etape ? String(d.etape.n) : d.chiffre ? d.chiffre.valeur : premierFort ? majuscules(typo(premierFort)) : d.moment === "accroche" ? "IA" : "";
  if (!texte) return;
  const taille = Math.min(libre * 1.25, (g.largeur * 0.9) / Math.max(1, texte.length * 0.7));
  p.forme({ id: `${d.id}#deco`, sorte: "deco", x: g.largeur * 0.06, y: g.hauteur - taille * 0.78, largeur: mesurer(texte, "titre", taille), hauteur: taille, rotation: -6, contour: CONTOUR_SUR[f], epaisseur: 6 * k, opacite: 0.32, source: d.id, entree: "aucune", deco: { texte, taille }, horsZone: true });
}

/* ------------------------------------------------------------------ */
/* Écran entier                                                          */
/* ------------------------------------------------------------------ */

export interface OptionsDisposition {
  /** Étapes de la vidéo (barre des étapes). */
  etapes?: readonly EtapeBarre[];
}

/**
 * Dispose un écran. Lève `ErreurDispositionV2` (message en français) si rien ne tient, même aux tailles planchers.
 */
export function disposerEcran(d: DescriptionEcran, g: GeometrieV2, options: OptionsDisposition = {}): EcranPlace {
  const avant = planchers;
  const essai = (geo: GeometrieV2, plusLarge = 0, valable: (e: EcranPlace) => boolean = () => true) => {
    // Colonne étroite (côte à côte) : titres un peu plus petits permis, jamais sous le « grand texte » (blocs orange, fond orange).
    planchers = geo.mode === "cote" ? { titre: 52, texte: d.fond === "orange" || d.titres.some((t) => t.forts.length) ? 52 : 40 } : { titre: TAILLES_V2.titreMin, texte: TAILLES_V2.texteMin };
    const base = disposerEcranInterne(d, geo, options, plusLarge);
    // Écran trop vide (rien à montrer dans le corps, cadre réduit) : le texte de la scène grandit, pas à pas, jusqu'à
    // remplir l'écran (relecture des quatre vidéos du 12/10/2026 : jamais un pictogramme ajouté pour combler).
    let meilleur = base;
    let vide = partVideEcranV2(base, geo);
    for (let c = 1; c <= CROISSANCE_MAX && vide > VIDE_VISE; c++) {
      let e: EcranPlace;
      try {
        e = disposerEcranInterne(d, geo, options, plusLarge, c);
      } catch (x) {
        if (!(x instanceof ErreurDispositionV2)) throw x;
        continue;
      }
      if (e.groupes > meilleur.groupes || !valable(e)) continue;
      const v = partVideEcranV2(e, geo);
      if (v < vide - 0.005) {
        meilleur = e;
        vide = v;
      }
    }
    return vide > VIDE_VISE ? centrerVerticalement(meilleur, geo, valable) : meilleur;
  };
  try {
    // Vertical : d'abord avec les titres du haut plus larges ; gardé seulement si tout ce qui dépasse la marge droite
    // ordinaire finit au-dessus de la limite (sinon, la disposition ordinaire).
    const tl = g.titresLarges;
    if (tl && g.mode === "colonne") {
      try {
        const l = essai(g, tl.droite - (g.contenu.x + g.contenu.largeur), (x) => largeurTenue(x, g));
        if (l.groupes === 1 && largeurTenue(l, g)) {
          // Titres larges gardés, sauf si l'écran reste presque vide en haut alors que la disposition ordinaire peut
          // centrer son contenu (un texte seul en grand, au milieu, plutôt qu'en haut avec tout le vide dessous).
          if (partVideEcranV2(l, g) <= VIDE_VISE) return l;
          try {
            const o = essai(g);
            if (o.groupes === 1 && plusGrandVideV2(o, g) < plusGrandVideV2(l, g) - 0.02) return o;
          } catch (x) {
            if (!(x instanceof ErreurDispositionV2)) throw x;
          }
          return l;
        }
      } catch (x) {
        if (!(x instanceof ErreurDispositionV2)) throw x;
      }
    }
    let e: EcranPlace | null = null;
    let erreur: unknown = null;
    try {
      e = essai(g);
    } catch (x) {
      if (!(x instanceof ErreurDispositionV2)) throw x;
      erreur = x;
    }
    // Contenu plus large que haut (carré) : si les titres ne tiennent pas ensemble au-dessus du corps, côte à côte
    // (titres à gauche, corps à droite) plutôt qu'un titre qui défile.
    if ((!e || e.groupes > 1) && g.mode === "colonne" && g.contenu.largeur > g.contenu.hauteur * 1.2) {
      try {
        const c = essai({ ...g, mode: "cote" });
        if (c.groupes === 1) return c;
      } catch (x) {
        if (!(x instanceof ErreurDispositionV2)) throw x;
      }
    }
    if (!e) throw erreur;
    return e;
  } finally {
    planchers = avant;
  }
}

/**
 * Vrai si tout ce qui passe la marge droite ordinaire (titres larges) finit au-dessus de `titresLarges.basMax`. Un
 * texte se juge EN ENTIER (toutes ses rangées, comme le contrôle de la zone sûre, qui encadre chaque ligne de la
 * fiche) : une ligne dont la première rangée déborde à droite et la dernière descend sous la limite ne tient pas.
 */
export function largeurTenue(e: Pick<EcranPlace, "textes" | "formes" | "traits"> & { id?: string }, g: GeometrieV2): boolean {
  const tl = g.titresLarges;
  const droite = g.contenu.x + g.contenu.largeur + 0.5;
  const ok = (x1: number, y1: number) => x1 <= droite || (!!tl && x1 <= tl.droite + 12 * g.k && y1 <= tl.basMax);
  const parSource = new Map<string, { x1: number; y1: number }>();
  for (const t of e.textes) {
    if (t.horsContenu) continue;
    // Les textes propres à l'écran (en-tête, étiquettes) restent jugés un par un, comme avant.
    if (t.source === e.id) {
      if (!ok(t.x + t.largeur, t.y + t.hauteur)) return false;
      continue;
    }
    const b = parSource.get(t.source);
    parSource.set(t.source, { x1: Math.max(b?.x1 ?? -Infinity, t.x + t.largeur), y1: Math.max(b?.y1 ?? -Infinity, t.y + t.hauteur) });
  }
  if ([...parSource.values()].some((b) => !ok(b.x1, b.y1))) return false;
  if (e.formes.some((f) => !f.horsZone && f.sorte !== "jauge" && !ok(f.x + f.largeur, f.y + f.hauteur))) return false;
  return e.traits.every((t) => t.segments.every((sg) => sg.every((q) => ok(q.x, q.y))));
}

/** Ce qui appartient à l'en-tête (étiquette, signature, fil, barre des étapes) ou au décor : jamais déplacé. */
const horsDuContenu = (id: string) => /^(sig|etq|fil|barre#)/.test(id) || id.endsWith("#deco") || id === "signature-fin" || id.startsWith("signature-fin#");

/**
 * Écran qui ne remplit pas sa place même texte grandi : son contenu est centré en hauteur dans la zone utile (deux
 * bandes modestes plutôt qu'un bloc vide en bas). Gardé seulement si l'écran reste valable.
 */
function centrerVerticalement(e: EcranPlace, g: GeometrieV2, valable: (e: EcranPlace) => boolean): EcranPlace {
  const z = zoneUtileV2(e, g);
  const textes = e.textes.filter((t) => !t.horsContenu && !horsDuContenu(t.id));
  const formes = e.formes.filter((f) => !f.horsZone && f.sorte !== "deco" && !horsDuContenu(f.id));
  const traits = e.traits.filter((t) => !horsDuContenu(t.id));
  const ys = [...textes.map((t) => [t.y, t.y + t.hauteur]), ...formes.map((f) => [f.y, f.y + f.hauteur]), ...traits.flatMap((t) => t.segments.flat().map((q) => [q.y, q.y]))];
  if (!ys.length) return e;
  const haut = Math.min(...ys.map((x) => x[0]));
  const bas = Math.max(...ys.map((x) => x[1]));
  const libre = z.y + z.hauteur - bas;
  const dy = Math.round(Math.max(0, Math.min(libre, (z.y + z.hauteur - bas - Math.max(0, haut - z.y)) / 2)) * 10) / 10;
  if (dy < 8 * g.k) return e;
  const bouge = new Set<object>([...textes, ...formes, ...traits]);
  const c: EcranPlace = {
    ...e,
    textes: e.textes.map((t) => (bouge.has(t) ? { ...t, y: t.y + dy, ...(t.pivot ? { pivot: { x: t.pivot.x, y: t.pivot.y + dy } } : {}) } : t)),
    formes: e.formes.map((f) => (bouge.has(f) ? { ...f, y: f.y + dy } : f)),
    traits: e.traits.map((t) => (bouge.has(t) ? { ...t, segments: t.segments.map((sg) => sg.map((q) => ({ x: q.x, y: q.y + dy }))) } : t)),
    // Les zones descendent avec le contenu ; celle du corps garde son bas (jamais dans la bande des sous-titres).
    zoneTitres: { ...e.zoneTitres, y: e.zoneTitres.y + dy },
    zoneCorps: { ...e.zoneCorps, y: e.zoneCorps.y + dy, hauteur: Math.max(0, e.zoneCorps.hauteur - dy) },
  };
  return valable(c) ? c : e;
}

/** Pas de croissance du texte essayés pour un écran trop vide ; part vide visée (sous le seuil du contrôle). */
const CROISSANCE_MAX = 5;
const VIDE_VISE = VIDE_MAX_ECRAN - 0.04;

/** Part de la hauteur du contenu laissée aux titres (le corps garde le reste), par gabarit. */
const PART_TITRES: Partial<Record<DescriptionEcran["gabarit"], number>> = { "accroche-cases": 0.62, "accroche-compteur": 0.55, "appel-commentaire": 0.62, "appel-diagnostic": 0.5, "appel-site": 0.5, semaine: 0.5, constat: 0.56, "idee-recue": 0.56, exemple: 0.5, etape: 0.5 };

/**
 * Étape (ou liste) : une carte dont chaque mot plein est déjà écrit par un titre restant (« Après chaque réunion » sous « Après
 * chaque réunion : dicter des notes ») n'est pas posée : jamais la même ligne deux fois sur l'écran.
 */
function sansCartesEnDouble(d: DescriptionEcran): DescriptionEcran {
  if ((d.gabarit !== "etape" && d.gabarit !== "liste") || !d.items.length) return d;
  const restants = d.titres.filter((t) => !corpsEcrit(d, t.texte)).map((t) => t.texte);
  const items = d.items.filter((it) => !motsCouverts(it.texte, restants));
  return items.length === d.items.length ? d : { ...d, items };
}

/**
 * Le corps de l'écran n'a RIEN à montrer (étape sans élément ni pictogramme, idée reçue sans idée barrée ni
 * pictogramme, exemple sans panneau ni pictogramme) : toute la place va au texte de la scène.
 */
function corpsSansRien(d: DescriptionEcran): boolean {
  const pictos = pictosEcran(d).length > 0;
  switch (d.gabarit) {
    case "etape":
      return !d.items.length && !pictos;
    case "idee-recue":
      return !d.titres.some((t) => t.barre) && !pictos;
    case "exemple":
      return !panneauxExemple(d).length && !pictos;
    default:
      return false;
  }
}

function disposerEcranInterne(d0: DescriptionEcran, g: GeometrieV2, options: OptionsDisposition, plusLarge = 0, croissance = 0): EcranPlace {
  // Croissance : les titres peuvent dépasser leur taille maximale ordinaire, par pas de 15 %.
  const avant = [titreMaxCourant, croissanceCourante] as const;
  titreMaxCourant = TAILLES_V2.titreMax * (1 + 0.15 * croissance);
  croissanceCourante = croissance;
  try {
    return disposerEcranPose(d0, g, options, plusLarge, croissance);
  } finally {
    [titreMaxCourant, croissanceCourante] = avant;
  }
}

function disposerEcranPose(d0: DescriptionEcran, g: GeometrieV2, options: OptionsDisposition, plusLarge: number, croissance: number): EcranPlace {
  const d = sansCartesEnDouble(d0);
  const p = new Pose(d, g);
  const k = g.k;
  const barre = (d.moment === "etape" && d.etape) || (d.moment === "recapitulatif" && (options.etapes?.length ?? 0) > 1);
  const C = barre ? g.contenuEtape : g.contenu;
  const ecart = 28 * k;
  const cote = g.mode === "cote";
  // Titres du corps (idée reçue : la ligne barrée va dans la carte).
  // Une ligne que le corps écrit déjà (élément de liste, de récapitulatif, de case : même texte) n'est pas écrite une
  // seconde fois en titre (relecture du 12/10/2026 : le récapitulatif écrivait ses trois lignes en haut, puis dans la liste).
  const titresZone = (d.gabarit === "idee-recue" ? d.titres.filter((t) => !t.barre) : d.titres).filter((t) => !corpsEcrit(d, t.texte));
  const scinde_ = d.gabarit === "appel-commentaire" && d.motCommentaire ? scinderAppel(titresZone, d.motCommentaire, d.id) : null;
  const appel = scinde_ ? scinde_.titres : titresZone;
  // Appel : le mot en très grand ; toute autre ligne (« Le détail… tient sur 1 page ») reste secondaire.
  const ligneAppel = (t: TitreDecrit) => !!scinde_ && t.id.replace(/~(mot|apres)$/, "") === scinde_.appelId;
  // Croissance (écran trop vide, `disposerEcran`) : les lignes de niveau « texte » grandissent, par pas de 20 %.
  const texteGrandi = croissance ? Math.min(titreMaxCourant, TAILLES_V2.texteMax * (1 + 0.25 * croissance)) * k : undefined;
  // Les mots autour du mot d'appel (« ÉCRIVEZ », « EN COMMENTAIRE ») restent chacun sur une rangée.
  // Le mot reste le plus grand : « ÉCRIVEZ » et « EN COMMENTAIRE » à 85 % au plus de sa taille sur une rangée.
  const tailleMot = () => scinde_ ? Math.min(230 * k, larTitres / Math.max(1, mesurer(majuscules(typo(appel.find((t) => t.id.endsWith("~mot"))?.texte ?? "")), "titre", 1) + 2 * padBloc(1))) : Infinity;
  const uneRangee = (t: TitreDecrit) => Math.min(0.85 * tailleMot(), larTitres / Math.max(1, mesurer(majuscules(typo(t.texte)), "titre", 1)));
  const maxTaille = (t: TitreDecrit) => (ligneAppel(t) && !t.id.endsWith("~mot") && uneRangee(t) >= TAILLES_V2.titreMin * k ? Math.min(TAILLES_V2.titreMax * k, Math.floor(uneRangee(t))) : t.id.endsWith("~mot") ? 230 * k : d.gabarit === "appel-commentaire" && !ligneAppel(t) ? TAILLE_SECONDAIRE_APPEL * k * (1 + 0.15 * croissance) : t.niveau === "texte" ? texteGrandi : undefined);
  // Mention « Exemple illustratif » : pastille au-dessus des titres, à droite.
  let haut = C.y;
  if (d.mention) {
    const tm = 26 * k;
    const txt = "Exemple illustratif";
    const lm = mesurer(txt, "texte", tm);
    const fondM = d.fond === "encre" ? COULEURS_V2.ivoire : COULEURS_V2.encre;
    p.forme({ id: `${d.id}#mention`, sorte: "pastille", x: C.x + C.largeur - lm - 28 * k, y: C.y, largeur: lm + 28 * k, hauteur: tm * 1.6, rayon: 8 * k, remplissage: fondM, source: d.id, entree: "fondu" });
    p.texte({ id: `${d.id}#mentiont`, texte: txt, x: C.x + C.largeur - lm - 14 * k, y: C.y + tm * 0.3, largeur: lm, hauteur: tm, taille: tm, police: "texte", couleur: d.fond === "encre" ? COULEURS_V2.encre : COULEURS_V2.ivoire, fond: fondM, source: d.id, entree: "fondu" });
    haut = C.y + tm * 1.6 + 14 * k;
  }
  const zoneC: RectV2 = { x: C.x, y: haut, largeur: C.largeur, hauteur: C.y + C.hauteur - haut };
  // Numéro d'étape.
  let num = 0;
  // Corps sans rien à montrer : côte à côte, les titres prennent toute la largeur (jamais une moitié d'écran vide).
  const rien = corpsSansRien(d);
  const colG = cote && !rien ? Math.round(zoneC.largeur * 0.46) : zoneC.largeur;
  if (d.moment === "etape" && d.etape) {
    num = Math.round(Math.min(cote ? colG * 0.34 : zoneC.largeur * 0.27, 230 * k, zoneC.hauteur * 0.36));
    const fondN = d.fond === "ivoire" ? COULEURS_V2.orange : d.fond === "orange" ? COULEURS_V2.encre : COULEURS_V2.ivoire;
    const coulN = d.fond === "encre" ? COULEURS_V2.encre : COULEURS_V2.ivoire;
    p.forme({ id: `${d.id}#num`, sorte: "numero", x: zoneC.x, y: zoneC.y, largeur: num, hauteur: num, rayon: 22 * k, remplissage: fondN, source: d.id, entree: "claque", son: "toc" });
    const tn = num * 0.92;
    const ln = mesurer(String(d.etape.n), "titre", tn);
    p.texte({ id: `${d.id}#numt`, texte: String(d.etape.n), x: zoneC.x + (num - ln) / 2, y: zoneC.y + (num - tn) / 2 + 2 * k, largeur: ln, hauteur: tn, taille: tn, couleur: coulN, fond: fondN, source: d.id, entree: "claque" });
  }
  // Côte à côte : le numéro est au-dessus des titres ; en colonne, à leur gauche.
  // `plusLarge` : titres du haut du vertical, qui peuvent aller plus à droite (`GeometrieV2.titresLarges`).
  // Côte à côte aussi, le titre principal d'une étape est À CÔTÉ du grand numéro (avant : sous lui, un vide à sa droite
  // que des pictogrammes génériques comblaient) ; ses lignes secondaires dessous, sur toute la colonne.
  const larTitres = cote ? colG - (num ? num + 26 * k : 0) : zoneC.largeur + plusLarge - (num ? num + 26 * k : 0);
  const larBas = larTitres - plusLarge;
  const xTitres = zoneC.x + (num ? num + 26 * k : 0);
  const yTitres = zoneC.y;
  // Croissance : le corps cède jusqu'à la moitié de son minimum aux titres.
  const minCorps = rien ? 0 : corpsMin(d) * k * Math.max(0.5, 1 - 0.12 * croissance);
  // Accroche : premier titre au-dessus du corps, les suivants dessous.
  const scinde = !cote && (d.gabarit === "accroche-cases" || d.gabarit === "accroche-compteur") && appel.length > 1;
  const hautTitres = scinde ? [appel[0]] : appel;
  const basTitres = scinde ? appel.slice(1) : [];
  let budget = cote ? zoneC.y + zoneC.hauteur - yTitres : rien ? zoneC.hauteur : Math.min(zoneC.hauteur * Math.min(0.9, (PART_TITRES[d.gabarit] ?? 0.44) + 0.12 * croissance), zoneC.hauteur - minCorps - ecart);
  if (!cote && !hautTitres.length) budget = 0;
  let groupes: { titres: TitreAjuste[]; hauteur: number }[] | null = null;
  // Tous les titres ensemble ; sinon dans une place agrandie (le corps garde son minimum) ; défilement en dernier recours.
  const titresEnsemble = (ts: TitreDecrit[]) =>
    grouper(ts, larTitres, budget, k, maxTaille) ?? (cote ? null : grouper(ts, larTitres, zoneC.hauteur - minCorps * 0.8 - ecart, k, maxTaille)) ?? grouperEnDefilement(ts, larTitres, budget, k, maxTaille);
  let groupesBas: { titres: TitreAjuste[]; hauteur: number } | null = null;
  // Étape : le titre principal reste à côté du grand numéro pendant TOUTE l'étape (là dès l'arrivée de l'écran) ; les
  // autres lignes vont dessous, plus petites, et s'ajoutent au fil de la voix. Jamais de titres qui défilent.
  const budgetEtape = (b: number) => poserEtape(hautTitres, larTitres, cote ? colG : zoneC.largeur + plusLarge, b, num, false, k, d.fond, maxTaille);
  const etape = num > 0 && hautTitres.length ? (cote ? budgetEtape(budget) : budgetEtape(Math.max(budget, Math.min(zoneC.hauteur * 0.56, zoneC.hauteur - minCorps - ecart))) ?? budgetEtape(zoneC.hauteur - minCorps * 0.8 - ecart)) : null;
  if (etape) {
    groupes = [];
  } else if (scinde) {
    for (let part = 0.5; part <= 0.8 && !groupes; part += 0.1) {
      const a = ajusterSuite(hautTitres, larTitres, budget * (1 - part), k, maxTaille);
      const b2 = ajusterSuite(basTitres, larBas, budget * part, k, maxTaille);
      if (a && b2) {
        groupes = [a];
        groupesBas = b2;
      }
    }
    if (!groupes) {
      groupes = titresEnsemble(appel);
      groupesBas = null;
    }
  } else groupes = titresEnsemble(hautTitres);
  if (!groupes) throw new ErreurDispositionV2(`les titres de l'écran ne tiennent pas, même à la taille plancher.`, d.id);
  let hT = Math.max(0, ...groupes.map((x) => x.hauteur));
  const plusieurs = groupes.length > 1;
  groupes.forEach((gr, i) => poserTitres(p, gr.titres, { x: xTitres, y: yTitres, largeur: larTitres }, plusieurs ? i : undefined, d.premier));
  if (etape) {
    // Principal : centré sur la hauteur du numéro s'il est moins haut que lui (en colonne).
    const bloc = etape.aCote && etape.S ? etape.P.hauteur + ECART_SECONDAIRES * k + etape.S.hauteur : etape.P.hauteur;
    const dy = Math.max(0, (etape.hautP - bloc) / 2);
    poserTitres(p, etape.P.titres, { x: xTitres, y: yTitres + dy, largeur: larTitres }, undefined, d.premier, true);
    hT = etape.hautP;
    if (etape.S && etape.aCote) {
      // Lignes secondaires dans la colonne du titre, à côté du numéro.
      poserTitres(p, etape.S.titres, { x: xTitres, y: yTitres + dy + etape.P.hauteur + ECART_SECONDAIRES * k, largeur: larTitres }, undefined, d.premier);
    } else if (etape.S) {
      poserTitres(p, etape.S.titres, { x: zoneC.x, y: yTitres + etape.hautP + ECART_SECONDAIRES * k, largeur: cote ? colG : zoneC.largeur + plusLarge }, undefined, d.premier);
      hT += ECART_SECONDAIRES * k + etape.S.hauteur;
    }
  }
  const hautT = cote ? yTitres - zoneC.y + hT : Math.max(hT, num);
  const nbGroupes = Math.max(1, groupes.length);
  let corpsR: RectV2;
  if (cote && !hautT) {
    // Côte à côte sans titre (récapitulatif) : le corps prend toute la largeur.
    corpsR = { ...zoneC };
  } else if (cote) {
    const xC = zoneC.x + colG + 40 * k;
    corpsR = { x: xC, y: zoneC.y, largeur: zoneC.x + zoneC.largeur - xC, hauteur: zoneC.hauteur };
  } else {
    const y0 = zoneC.y + (hautT ? hautT + ecart : 0);
    const hB = groupesBas ? groupesBas.hauteur + ecart : 0;
    corpsR = { x: zoneC.x, y: y0, largeur: zoneC.largeur, hauteur: zoneC.y + zoneC.hauteur - y0 - hB };
  }
  if (!rien && corpsR.hauteur < minCorps * 0.8) throw new ErreurDispositionV2(`le corps de l'écran (gabarit « ${d.gabarit} ») n'a pas la place (${Math.round(corpsR.hauteur)} px).`, d.id);
  const vise = corpsVise(d, corpsR, k);
  const corpsFinal: RectV2 = { ...corpsR, hauteur: Math.max(0, vise) };
  if (vise < corpsR.hauteur && groupesBas) corpsFinal.y = corpsR.y + (corpsR.hauteur - vise) / 2;
  if (!rien) corps(p, corpsFinal);
  if (groupesBas) poserTitres(p, groupesBas.titres, { x: xTitres, y: corpsFinal.y + corpsFinal.hauteur + ecart, largeur: larBas }, undefined, d.premier);
  else {
    // Côte à côte : la colonne des titres, sous eux, si elle est libre jusqu'en bas.
    const yLibre = yTitres + hT + ecart;
    const sousTitres = cote && hautT ? { x: zoneC.x, y: yLibre, largeur: colG, hauteur: zoneC.y + zoneC.hauteur - yLibre } : null;
    // En colonne : à droite de titres courts (« COMMENT / RELANCER ? »), sur leur hauteur.
    const dansTitres = [...p.textes.filter((t) => !t.horsContenu), ...p.formes.filter((f) => f.sorte === "bloc" || f.sorte === "numero")].filter((x) => x.y >= yTitres - 1 && x.y < yTitres + hT);
    const droiteT = Math.max(zoneC.x, ...dansTitres.map((x) => x.x + x.largeur));
    const aDroite = !cote && hT > 0 ? { x: droiteT + ecart, y: yTitres, largeur: zoneC.x + zoneC.largeur - droiteT - ecart, hauteur: Math.min(hT, corpsR.y - ecart - yTitres) } : null;
    // Côte à côte : à droite du grand numéro d'étape (les titres sont sous lui).
    const aCoteNum = cote && num && !etape ? { x: zoneC.x + num + 26 * k, y: zoneC.y, largeur: colG - num - 26 * k, hauteur: num } : null;
    combler(p, corpsR, ecart, [sousTitres ?? aDroite, aCoteNum].filter((x): x is RectV2 => !!x));
  }
  if (d.gabarit === "appel-commentaire") {
    // L'écran d'appel est plein dès son arrivée : toutes ses lignes et le bloc du mot (les soulignements suivent la voix) ;
    // la bulle arrive ensuite, juste avant que le mot s'y tape.
    const ids = new Set(appel.map((t) => t.id));
    for (const x of [...p.textes, ...p.formes]) if (ids.has(x.source) && x.id.startsWith(`${x.source}#`)) x.desLArrivee = true;
  }
  entete(p, options.etapes ?? []);
  // L'écran du site montre déjà `axion-ia.com` en grand : pas de seconde signature après la voix.
  if (d.final && d.gabarit !== "appel-site") signatureFin(p);
  decor(p);
  // Sur l'orange (fond ou bloc), un texte clair est en ivoire franc, jamais l'ivoire du fond (trop proche de l'orange).
  for (const t of p.textes) if (t.fond === COULEURS_V2.orange && t.couleur === COULEURS_V2.ivoire) t.couleur = COULEURS_V2.ivoireFranc;
  const zoneTitres: RectV2 = etape?.S && !cote && !etape.aCote ? { x: zoneC.x, y: yTitres, largeur: zoneC.largeur + plusLarge, hauteur: hT } : { x: xTitres, y: yTitres, largeur: larTitres, hauteur: hT };
  return {
    id: d.id,
    sceneId: d.sceneId,
    fond: d.fond,
    moment: d.moment,
    gabarit: d.gabarit,
    etiquette: d.etiquette,
    etape: d.etape,
    textes: p.textes,
    formes: p.formes,
    traits: p.traits,
    zoneTitres,
    zoneCorps: corpsFinal,
    groupes: nbGroupes,
    final: d.final,
    premier: d.premier,
    reduction: 1,
  };
}

/** Place libre sous le corps à partir de laquelle les pictogrammes de l'écran la comblent (px de référence). */
const LIBRE_A_COMBLER = 110;

/**
 * Un corps plus court que sa place (récapitulatif de trois lignes, semaine, bulle d'appel) ou une colonne de titres
 * courte laisse une partie de l'écran vide : les pictogrammes de la fiche (seulement eux) y viennent en grand,
 * à l'heure de leur dessin. Places essayées : sous le corps, à sa droite, sous les titres ou à droite du grand numéro
 * (côte à côte), à droite de titres courts (en colonne) ; les deux plus grandes sont retenues.
 */
function combler(p: Pose, c: RectV2, ecart: number, ailleurs: RectV2[]): void {
  const { k } = p;
  // Un filet (trait de séparation d'une carte) ne compte pas comme contenu à éviter.
  const dans = [...p.textes.filter((t) => !t.horsContenu), ...p.formes.filter((f) => !f.horsZone && f.sorte !== "jauge" && f.hauteur > 8 * k)].filter((x) => x.y >= c.y - 1 && x.x < c.x + c.largeur && x.x + x.largeur > c.x);
  const points = p.traits.flatMap((t) => t.segments.flat()).filter((q) => q.y >= c.y && q.x >= c.x && q.x <= c.x + c.largeur);
  const bas = Math.max(c.y, ...dans.map((x) => x.y + x.hauteur), ...points.map((q) => q.y));
  const droite = Math.max(c.x, ...dans.map((x) => x.x + x.largeur), ...points.map((q) => q.x));
  const places: RectV2[] = [
    // Sous le contenu (sur sa largeur), à sa droite (sur toute la hauteur) : deux places qui ne se chevauchent pas.
    { x: c.x, y: bas + ecart, largeur: Math.max(droite - c.x, c.largeur * 0.5), hauteur: c.y + c.hauteur - bas - ecart },
    { x: droite + ecart, y: c.y, largeur: c.x + c.largeur - droite - ecart, hauteur: c.hauteur },
    ...ailleurs,
  ].filter((r) => Math.min(r.largeur, r.hauteur) >= LIBRE_A_COMBLER * k);
  // Les deux plus grandes places (jamais l'une sur l'autre) : les pictogrammes de LA FICHE pas encore montrés y sont
  // répartis ; aucun : rien (jamais un pictogramme générique pour combler un vide).
  const triees = places.sort((a, b) => Math.min(b.largeur, b.hauteur) - Math.min(a.largeur, a.hauteur));
  const retenues = triees.slice(0, 1);
  const seconde = triees.slice(1).find((r) => retenues.every((q) => r.x >= q.x + q.largeur || q.x >= r.x + r.largeur || r.y >= q.y + q.hauteur || q.y >= r.y + r.hauteur));
  const montres = new Set(p.formes.filter((f) => f.sorte === "dessin").map((f) => f.dessin));
  const pictos = pictosEcran(p.d).filter((x) => !montres.has(x.dessinId));
  if (!pictos.length) return;
  const lots = seconde && pictos.length > 1 ? [pictos.slice(0, 1), pictos.slice(1)] : [pictos];
  if (seconde && lots.length > 1) retenues.push(seconde);
  retenues.forEach((place, i) => {
    try {
      pictogrammes(p, place, false, lots[i], `q${i}`);
    } catch (e) {
      if (!(e instanceof ErreurDispositionV2)) throw e;
    }
  });
}

/** Taille maximale (px de référence) d'une ligne de niveau « texte » sur l'écran d'appel. */
const TAILLE_SECONDAIRE_APPEL = 52;

/** Écart entre le titre principal d'une étape et ses lignes secondaires (px de référence). */
const ECART_SECONDAIRES = 22;
/** Taille des lignes secondaires d'une étape, au plus cette part de celle du titre principal. */
const PART_SECONDAIRES = Object.freeze({ titre: 0.66, texte: 0.58 });

/**
 * Titres d'une étape : le principal (première ligne de niveau « titre ») le plus grand possible à côté du numéro, les
 * autres lignes dessous (`largeurSec`), plus petites. La place du principal se réduit pas à pas jusqu'à ce que tout
 * tienne dans `budget` ; null si rien ne tient (repli : disposition commune).
 */
function poserEtape(ts: TitreDecrit[], largeur: number, largeurSec: number, budget: number, num: number, cote: boolean, k: number, fond: FondV2, maxTaille?: (t: TitreDecrit) => number | undefined): EtapePosee | null {
  const principal = ts.find((t) => t.niveau === "titre") ?? ts[0];
  const seconds = ts.filter((t) => t !== principal);
  // Lignes secondaires : plus petites que le principal (sur l'orange, sous le « grand texte », elles passent en ivoire franc).
  void fond;
  const avant = planchers;
  planchers = { titre: Math.min(planchers.titre, PLANCHERS_SECONDAIRES.titre), texte: Math.min(planchers.texte, PLANCHERS_SECONDAIRES.texte) };
  const sec = (t: TitreDecrit, sP: number) => Math.max(planchers[t.niveau] * k, PART_SECONDAIRES[t.niveau] * sP);
  try {
    for (const aCote of cote ? [false] : [false, true]) {
      for (let hP = budget; hP >= 40 * k; hP -= 8 * k) {
        const P = ajusterSuite([principal], largeur, hP, k, maxTaille);
        if (!P) continue;
        const sP = P.titres[0].s;
        const hautP = cote ? P.hauteur : Math.max(P.hauteur, num);
        if (!seconds.length) return { P, S: null, hautP, aCote: false };
        if (aCote) {
          // À côté du numéro : principal puis secondaires dans la même colonne.
          const S = ajusterSuite(seconds, largeur, budget - P.hauteur - ECART_SECONDAIRES * k, k, (t) => sec(t, sP));
          if (S) return { P, S, hautP: Math.max(num, P.hauteur + ECART_SECONDAIRES * k + S.hauteur), aCote: true };
          continue;
        }
        const reste = budget - hautP - ECART_SECONDAIRES * k;
        if (reste <= 0) continue;
        const S = ajusterSuite(seconds, largeurSec, reste, k, (t) => sec(t, sP));
        if (S) return { P, S, hautP, aCote: false };
      }
    }
    return null;
  } finally {
    planchers = avant;
  }
}

interface EtapePosee {
  P: { titres: TitreAjuste[]; hauteur: number };
  S: { titres: TitreAjuste[]; hauteur: number } | null;
  /** Hauteur du bloc du principal (et des secondaires s'ils sont à côté du numéro). */
  hautP: number;
  aCote: boolean;
}

/** Tailles planchers des lignes secondaires d'une étape (px de référence) : texte gras très contrasté (4,5:1 au moins). */
const PLANCHERS_SECONDAIRES = Object.freeze({ titre: 48, texte: 40 });

/**
 * Appel : la ligne d'appel est TOUJOURS posée en trois titres, « ÉCRIVEZ » / le mot en très grand / « EN COMMENTAIRE »
 * (la hiérarchie de la première vidéo fabriquée, relecture du 12/10/2026), quelles que soient les lignes de la fiche :
 *  - la ligne d'appel est celle qui porte le mot et « commentaire », sinon celle qui porte le mot (titre d'abord) ;
 *    ce qui manque autour du mot (« Écrivez », « en commentaire ») est ajouté, comme la voix le dit ;
 *  - aucune ligne ne porte le mot : les trois titres sont ajoutés (à l'heure de l'écran) ;
 *  - les autres lignes (« Les trois messages sont prêts », « Une seule habitude suffit ») restent entières et
 *    secondaires (`TAILLE_SECONDAIRE_APPEL`), même si elles contiennent le mot : jamais une petite colonne de six rangées.
 * Rend les titres et l'identifiant de la ligne d'appel.
 */
function scinderAppel(ts: TitreDecrit[], mot: string, ecranId: string): { titres: TitreDecrit[]; appelId: string } {
  const c = cleMotV2(mot);
  const porte = (t: TitreDecrit) => t.texte.split(/\s+/).some((m) => cleMotV2(m) === c);
  const avecMot = ts.filter(porte);
  // La ligne d'appel de la fiche peut porter un autre mot que celui de la fin retenue (« Écrivez CINQ en commentaire »
  // pour la fin au mot « RELANCE ») : elle est alors remplacée, jamais deux appels sur l'écran.
  const ligne = avecMot.find((t) => /commentaire/iu.test(t.texte)) ?? ts.find((t) => /commentaire/iu.test(t.texte)) ?? avecMot.find((t) => t.niveau === "titre") ?? avecMot[0];
  const base = { niveau: "titre" as const, soulignes: [], souligneTout: false, barre: false, entoure: false };
  const appelId = ligne?.id ?? `${ecranId}~appel`;
  const trois = (avantMot: string, motAff: string, apresMot: string, garde?: TitreDecrit): TitreDecrit[] => [
    { ...base, id: appelId, texte: avantMot, forts: [] },
    { ...base, id: `${appelId}~mot`, texte: motAff, forts: [c], ...(garde?.gesteId ? { gesteId: garde.gesteId } : {}) },
    { ...base, id: `${appelId}~apres`, texte: apresMot, forts: [] },
  ];
  if (!ligne) return { titres: [...ts.map((t) => ({ ...t, niveau: "texte" as const })), ...trois("Écrivez", majuscules(mot), "en commentaire")], appelId };
  const mots = ligne.texte.split(/\s+/).filter(Boolean);
  const i = mots.findIndex((m) => cleMotV2(m) === c);
  if (i < 0) return { titres: ts.flatMap((t) => (t === ligne ? trois("Écrivez", majuscules(mot), "en commentaire", t) : [{ ...t, niveau: "texte" as const }])), appelId };
  const avantMot = i > 0 ? mots.slice(0, i).join(" ") : "Écrivez";
  const apres = mots.slice(i + 1).join(" ");
  const apresMot = /commentaire/iu.test(apres) ? apres : "en commentaire";
  const res: TitreDecrit[] = [];
  for (const t of ts) {
    if (t === ligne) res.push(...trois(avantMot, mots[i], apresMot, t));
    else res.push({ ...t, niveau: "texte" });
  }
  return { titres: res, appelId };
}

/** Signature en grand, sur la bande des sous-titres (libre après la voix), soulignée au crayon. */
function signatureFin(p: Pose): void {
  const { g, k, f } = p;
  const b = g.bande;
  const a = ajuster(SIGNATURE_V2, "titre", TAILLES_V2.signatureFin * k, 40 * k, b.largeur - 60 * k, b.hauteur - 40 * k, 1, 1);
  if (!a) return;
  const l = mesurer(SIGNATURE_V2, "titre", a.taille);
  const x = b.x + (b.largeur - l) / 2;
  const y = b.y + (b.hauteur - a.taille) / 2 - 10 * k;
  p.texte({ id: "signature-fin", texte: SIGNATURE_V2, x, y, largeur: l, hauteur: a.taille, taille: a.taille, couleur: TEXTE_SUR[f], fond: fondHex(f), source: SOURCE_FIN_VOIX, entree: "pop", horsContenu: true });
  const yu = y + a.taille * 0.98;
  p.trait({ id: "signature-fin#s", sorte: "souligne", segments: [[{ x: x - 6 * k, y: yu + 2 * k }, { x: x + l * 0.45, y: yu + 5 * k }, { x: x + l + 8 * k, y: yu - 2 * k }]], epaisseur: EPAISSEURS_V2.souligne * k, couleur: TRAIT_SUR[f], source: SOURCE_FIN_VOIX, decalageMs: 420, dureeMs: 420, crayon: true, son: "trait" });
}
