/**
 * ANIMATION DU STYLE « reference/3 » (gabarit par parties, 14/10/2026 ; charte Axion, direction A, 15/10/2026).
 * Fonctions PURES, sans React (lues par le rendu et les tests). Regard de Will sur la vidéo v-f1739d6a4f51 : « le
 * motion design n'est pas assez précis », des lignes à moitié écrites, des pages presque vides, l'accroche illisible au
 * début. Ici :
 *  - ce qui ARRIVE AVEC LA PAGE (repère de partie, icône ou pastille, titre, accroche, page d'appel, premier bloc) est
 *    déjà écrit quand la page arrive (« fondu + montée » de 850 ms, le crayon reprend à 400 ms) : jamais de page vide ;
 *  - chaque bloc démarre au mot où la voix le dit et il est ENTIÈREMENT écrit au plus tard quand la voix finit de le
 *    dire (`<id>~fin` : l'écriture accélère au besoin) ;
 *  - les mots de la douleur de l'accroche sont entourés PENDANT que la voix les dit (`<id>~mot:<k>`) ;
 *  - le surlignage orange pâle se trace sous le mot-clé, le texte d'avant se barre, l'icône se trace seule au trait ;
 *  - pastilles et numéros : apparition avec un léger rebond ; cases, repères, cartes : fondu court ; tout le reste suit
 *    UNE courbe douce (`courbeReference3`) ;
 *  - le crayon fait une chose à la fois, sans tremblement ; son inclinaison est fixée par action (aucun saut) et
 *    choisie pour ne couvrir aucun texte visible ; au repos plus de 0,9 s il quitte la page (bas à droite) et revient.
 *
 * PEPS (maquette validée par Will le 15/10, PR #260), sur une page qui en a :
 *  - le VISUEL dessiné : le crayon trace ses traits un par un (au prorata de leur longueur), ses hachures, ses textes,
 *    puis sa SEULE touche orange s'anime (le crayon la trace quand c'est un trait, sinon il s'écarte) ; une fois fini,
 *    il respire (±5 px en 3,4 s), et s'apaise avant la fin de la page ;
 *  - la FLÈCHE dessinée (du bloc orange vers le visuel) se trace juste avant lui ;
 *  - le BLOC ORANGE apparaît en rebond, son compteur défile, il se pousse (×1,06) quand la voix dit son chiffre ;
 *  - le MARQUEUR balaie sous le mot-clé quand la voix le dit, et la ligne se pousse au même instant.
 */
import { COULEURS_REFERENCE_3, CRAYON_REFERENCE, PEPS_REFERENCE_3, RYTHME_REFERENCE_3, TAILLES_GABARIT_3, VISUELS_GABARIT_3, courbeReference3, rebondReference3, sortieReference3 } from "./charte";
import { GRILLE_VISUEL_3, clocheVisuel3, dessinVisuel3, estIdVisuel3, etapesVisuel3, rebondVisuel3, tempsVisuel3 } from "./visuels-3";
import { pointA, silhouetteCrayon, type PointRef } from "./animation";
import type { ElementPlace, PagePlacee, RectPx } from "../types";
import type { ProprietesReference } from "./types";
import { OUTIL_TABLEAU } from "../trois-styles/outil";
import { CHARTES_TABLEAU, type StyleTableau } from "../trois-styles/styles";

/** `trait` : un trait libre du crayon (la flèche vers le visuel) ; `contour` : un trait d'un dessin (le visuel). */
export type Trace3 = "ecrire" | "souligne" | "surligne" | "barre" | "entoure" | "coche" | "fleche" | "contour" | "trait";

export interface Action3 {
  id: string;
  partie: string;
  trace: Trace3;
  /** Points que suit la pointe (et que le trait dessine) ; pour « ecrire », la ligne de base. */
  points: PointRef[];
  /** Rectangle visé (ligne écrite, zone du geste). */
  cible: RectPx;
  debut: number;
  duree: number;
  /** Inclinaison du crayon pendant l'action (degrés), fixée une fois pour toutes. */
  angle: number;
  couleur: string;
  epaisseur: number;
  /** Bloc « posé » (dernier recours, 15/10) : il apparaît en fondu court, sans le crayon. */
  fondu?: boolean;
  /** La touche orange d'un visuel qui s'anime seule : le crayon s'écarte. */
  sansCrayon?: boolean;
  /** Trois styles du tableau : durée la plus courte acceptée (s) quand la fin de page presse (`calerOutilTableau`). */
  min?: number;
}

export interface Plan3 {
  actions: Action3[];
  /** Apparitions (s) : décors (pastille, disque, case, étiquette) ; `<id>#encre` : un élément de « À retenir » dit. */
  apparitions: Record<string, number>;
  /** Couleur des dessins : début (s) de leur remplissage. */
  couleurs: Record<string, number>;
  /** Éléments là dès l'arrivée de la page. */
  poses: Set<string>;
  /** Début de la page (la coupe, s) et fin de la transition. */
  debutPage: number;
  finTransition: number;
  k: number;
  /** Image (le crayon y entre et en sort). */
  largeur: number;
  hauteur: number;
  /** La page entière, finie (la page d'avant pendant la transition) : tout est là, rien ne bouge. */
  fini: boolean;
  /** Page d'appel : les battements doux du bouton (débuts, s) et leur centre (px). */
  battement?: { debuts: number[]; centre: PointRef };
  /** Fin de la page (s) : ce qui vit encore (souffle du visuel, pastille, points) s'apaise avant. */
  finPage: number;
  /** Peps : poussées douces (×1,06 puis retour), début (s) par élément (bloc orange, ligne du mot-clé). */
  poussees: Record<string, number>;
  /** Trois styles du tableau : le style de la page (l'outil, sa couleur). */
  style?: StyleTableau;
}

const R = RYTHME_REFERENCE_3;
const P = PEPS_REFERENCE_3;
const borne = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
export const POINTE_LIGNE_3 = 0.74;
/** Un bloc pressé peut partir jusqu'à… (s) avant que la voix dise ses mots (jamais pendant la transition). */
export const AVANCE_DEPART_MAX_SEC = 0.6;
/** Fin d'écriture acceptée jusqu'à… (s) après la fin dite (le contrôle tolère 0,15 s). */
const MARGE_ECHEANCE_SEC = 0.08;
/** Fondu court d'un bloc posé (s). */
export const FONDU_SEC = 0.2;
/** Gestes décoratifs : raccourcis ou sautés quand ils retardent un bloc. */
const DECORATIFS: ReadonlySet<Trace3> = new Set(["souligne", "surligne", "coche", "contour", "entoure", "barre"]);

/** Trois styles du tableau : durée d'écriture du titre (s), d'un trait dès la fin de l'effacement. */
export const TITRE_TABLEAU_SEC = [0.4, 0.6] as const;
/**
 * Trois styles (vidéo v-6616b3800357, 17/10) : quand la voix dit la phrase suivante bien après le titre, le titre
 * s'écrit au rythme de la voix, jusqu'à… (s) ; au-delà, la phrase suivante commence plus tôt. Le titre n'est jamais seul
 * plus de `TITRE_AIR_TABLEAU_SEC` (le contrôle « Titre jamais seul » tolère 0,6 s).
 */
export const TITRE_TABLEAU_LENT_MAX_SEC = 1.4;
export const TITRE_AIR_TABLEAU_SEC = 0.3;

/**
 * Le bloc qui suit le titre d'une page : le PREMIER que l'outil écrit après lui (`quand` : son départ), hors repère,
 * numéro, dessin et satellites ; à égalité, le premier dans l'ordre de lecture. En carré et en 16:9, une liste peut se
 * lire après un détail et s'écrire avant lui. Commun au plan de l'outil et au contrôle « Titre jamais seul ».
 */
export function suivantDuTitre<E extends Pick<ElementPlace, "type" | "lignes" | "ordre" | "gabarit" | "elementId">>(elements: readonly E[], titre: E, quand: (e: E) => number = () => 0): E | undefined {
  return elements
    .filter((e) => e !== titre && e.type !== "dessin" && e.lignes.length && e.ordre > titre.ordre && !["partie", "pastille", "titre"].includes(e.gabarit?.sorte ?? "") && !e.elementId.includes("~"))
    .map((e) => ({ e, t: quand(e) }))
    .sort((a, b) => a.t - b.t || a.e.ordre - b.e.ordre)[0]?.e;
}
/**
 * Trois styles : le titre n'attend jamais le bloc qui le suit, QUEL QUE SOIT le minutage de la voix (vidéo
 * v-fc3ac0c1d171, 17/10 : un dessin dit au début de la page se traçait entre eux, la phrase partait 1,2 s après le
 * titre). Garantie générale, après l'ordonnancement : si le premier trait du bloc suivant (ses satellites compris) part
 * plus de `TITRE_AIR_TABLEAU_SEC` après la fin du titre, ce bloc passe juste après le titre (son tracé entier, au même
 * rythme) et ce que l'outil traçait entre eux (un dessin, un geste, la fin d'un surlignage) se trace juste après lui,
 * dans le même ordre : l'ensemble finit à la même heure, rien d'autre ne bouge. Le bloc s'écrit un peu avant que la
 * voix le dise (comme `avances`), jamais avant d'être tracé : c'est l'outil qui l'écrit. Mesure : celle du contrôle
 * « Titre jamais seul » (`titreSeulSec`).
 */
export function serrerTitre(actions: Action3[], page: Pick<PagePlacee, "elements">, finTransition: number, apparitions: Record<string, number> = {}): void {
  const titre = page.elements.find((e) => e.gabarit?.sorte === "titre");
  if (!titre || !actions.some((a) => a.id === titre.elementId && a.trace === "ecrire")) return;
  const de = (id: string) => (a: Action3) => a.id === id || a.id.startsWith(`${id}~`);
  const debut = (id: string) => Math.min(...actions.filter(de(id)).map((a) => a.debut));
  const suivant = suivantDuTitre(page.elements, titre, (e) => debut(e.elementId));
  const S = suivant ? debut(suivant.elementId) : Infinity;
  if (!suivant || !Number.isFinite(S)) return;
  const finTitre = Math.max(...actions.filter((a) => a.id === titre.elementId).map((a) => a.debut + a.duree), finTransition);
  if (S - finTitre <= TITRE_AIR_TABLEAU_SEC) return;
  const estSuivant = de(suivant.elementId);
  const outil = (a: Action3) => !a.fondu && !a.sansCrayon;
  // Le tracé du bloc d'un seul tenant : ses actions jusqu'à la première chose d'un autre que l'outil trace après elles.
  const parOutil = actions.filter(outil).sort((a, b) => a.debut - b.debut);
  const i0 = parOutil.findIndex(estSuivant);
  let i1 = i0 < 0 ? -1 : i0;
  while (i1 + 1 < parOutil.length && estSuivant(parOutil[i1 + 1])) i1++;
  const finBloc = i0 < 0 ? Math.max(...actions.filter(estSuivant).map((a) => a.debut + a.duree)) : parOutil[i1].debut + parOutil[i1].duree;
  const depart = finTitre + Math.min(R.deplacementSec * 0.6, TITRE_AIR_TABLEAU_SEC);
  const recul = S - depart;
  const bloc = actions.filter((a) => estSuivant(a) && a.debut >= S - 1e-9 && a.debut <= finBloc - 1e-9 + (outil(a) ? 0 : 1e-9));
  for (const a of bloc) a.debut -= recul;
  if (apparitions[suivant.elementId] !== undefined) apparitions[suivant.elementId] = Math.min(apparitions[suivant.elementId], depart - 0.06);
  // Ce qui s'intercalait (l'outil le traçait entre le titre et le bloc) : juste après le bloc, même ordre, mêmes écarts.
  const entre = parOutil.filter((a) => !estSuivant(a) && a.id !== titre.elementId && a.debut >= finTitre - 1e-9 && a.debut < S);
  if (entre.length) {
    const finBlocNouvelle = finBloc - recul;
    const decale = finBlocNouvelle + R.deplacementSec * 0.6 - entre[0].debut;
    for (const a of entre) a.debut += decale;
  }
  // Rien ne se chevauche ensuite : l'outil fait une chose à la fois (ce qui suivait n'est poussé que de l'écart gagné).
  let t = -Infinity;
  for (const a of actions.filter(outil).sort((x, y) => x.debut - y.debut)) {
    if (a.debut < t) a.debut = t;
    t = a.debut + a.duree;
  }
}
/** Trois styles : une ligne écrite au rythme de la voix ralentit au plus de… (×, de 1 700 à ~770 px/s, la maquette en écrit ~800). */
const TABLEAU_RALENTI_MAX = 2.2;

/**
 * Trois styles du tableau (critique #291, I1) : la page finit de s'écrire `calmeFinSec` avant l'arrivée de la suivante,
 * l'outil sorti de l'image. Un tracé trop tard se fait d'abord plus vite (jusqu'à sa durée `min`), puis part plus tôt
 * (les précédents avec lui si besoin), jamais avant `debut`.
 */
export function calerOutilTableau(actions: Action3[], debut: number, finPage: number): void {
  const O = OUTIL_TABLEAU;
  const plusCourt = (a: Action3) => a.min ?? (a.trace === "ecrire" ? a.duree * 0.7 : Math.min(a.duree, Math.max(0.12, a.duree * 0.4)));
  for (const a of actions) {
    if (!(a.fondu || a.sansCrayon) || a.debut + a.duree <= finPage - O.calmeFinSec) continue;
    a.debut = Math.max(debut, finPage - O.calmeFinSec - a.duree);
    a.duree = Math.max(0, Math.min(a.duree, finPage - O.calmeFinSec - a.debut));
  }
  const outil = actions.filter((a) => !a.fondu && !a.sansCrayon && a.duree > 0).sort((a, b) => a.debut - b.debut);
  if (!outil.length) return;
  let b = finPage - O.calmeFinSec - O.sortieSec;
  for (let i = outil.length - 1; i >= 0; i--) {
    const a = outil[i];
    if (a.debut + a.duree > b) {
      a.duree = Math.max(plusCourt(a), Math.min(a.duree, b - a.debut));
      if (a.debut + a.duree > b) a.debut = b - a.duree;
    }
    b = a.debut;
  }
  // Un dessin posé en fondu (le bloc pressait) apparaît juste avant le texte qu'il accompagne, s'il a été avancé.
  for (const a of actions) {
    if (!a.fondu || a.trace !== "contour") continue;
    const premier = Math.min(...outil.filter((x) => x.id === a.id).map((x) => x.debut));
    if (premier < a.debut + a.duree) a.debut = Math.max(debut, premier - a.duree);
  }
  // Rien avant le début de la page : ce qui y remonterait s'enchaîne dès `debut`.
  let t = debut;
  outil.forEach((a) => {
    if (a.debut < t) a.debut = t;
    t = a.debut + a.duree;
  });
}

/** Trois styles : l'outil porte l'accent (craie terracotta, capuchon orange) pour une coche, un entouré, un trait orange. */
export function accentOutil(style: StyleTableau, a: { trace: Trace3; couleur: string }): boolean {
  const S = CHARTES_TABLEAU[style];
  return a.trace === "coche" || a.trace === "entoure" || a.couleur === S.accent || a.couleur === S.accentTexte;
}

/** Tour d'une zone (ellipse arrondie faite à la main, un peu au-delà du départ). */
function tourZone(r: RectPx): PointRef[] {
  const cx = r.x + r.largeur / 2;
  const cy = r.y + r.hauteur / 2;
  const rx = r.largeur / 2;
  const ry = r.hauteur / 2;
  const pts: PointRef[] = [];
  const n = 36;
  for (let i = 0; i <= n + 3; i++) {
    const a = -Math.PI * 0.62 + (i / n) * Math.PI * 2;
    const f = 1 + 0.035 * Math.sin(i * 0.9);
    pts.push({ x: cx + rx * f * Math.cos(a), y: cy + ry * f * Math.sin(a) });
  }
  return pts;
}

const ligneDeBase = (c: RectPx): PointRef[] => [
  { x: c.x, y: c.y + c.hauteur * POINTE_LIGNE_3 },
  { x: c.x + c.largeur, y: c.y + c.hauteur * POINTE_LIGNE_3 },
];
const sousLigne = (c: RectPx, dy: number): PointRef[] => [
  { x: c.x - 2, y: c.y + c.hauteur * 0.95 + dy },
  { x: c.x + c.largeur * 0.5, y: c.y + c.hauteur * 0.96 + dy },
  { x: c.x + c.largeur + 2, y: c.y + c.hauteur * 0.945 + dy },
];
const barreLigne = (c: RectPx): PointRef[] => [
  { x: c.x - 6, y: c.y + c.hauteur * 0.54 },
  { x: c.x + c.largeur + 6, y: c.y + c.hauteur * 0.5 },
];
const cocheDans = (c: RectPx): PointRef[] => [
  { x: c.x + c.largeur * 0.18, y: c.y + c.hauteur * 0.52 },
  { x: c.x + c.largeur * 0.42, y: c.y + c.hauteur * 0.78 },
  { x: c.x + c.largeur * 0.86, y: c.y + c.hauteur * 0.18 },
];

/** Une chose que fait le crayon : ses traits dans l'ordre, l'heure où elle part, l'heure où elle doit être finie. */
interface Chose {
  id: string;
  heure: number;
  echeance?: number;
  ordre: number;
  /** Un dessin entier (le visuel) : jamais rangé parmi les gestes décoratifs qu'un bloc pressé raccourcit ou saute. */
  fixe?: boolean;
  /** Trois styles : ses gestes après l'écriture (la coche d'une liste) ne sont jamais sautés par le bloc suivant. */
  garde?: boolean;
  traits: { partie: string; trace: Trace3; points: PointRef[]; cible: RectPx; duree: number; ecriture: boolean; couleur: string; epaisseur: number; heure?: number; pause?: number; sansCrayon?: boolean; min?: number; id?: string }[];
}

/** Points d'un rectangle, pour savoir ce que couvre le crayon. */
const dans = (q: PointRef, r: RectPx) => q.x > r.x && q.x < r.x + r.largeur && q.y > r.y && q.y < r.y + r.hauteur;

/**
 * Plan de la page. `fini` : la page entière, finie (la page d'avant pendant la transition) — tout est déjà là.
 */
export function planPage3(page: PagePlacee, r: ProprietesReference, image: { largeur: number; hauteur: number }, fini = false): Plan3 {
  const k = r.k;
  const debutPage = (r.debutPageMs ?? r.scenesPage[0]?.debutMs ?? 0) / 1000;
  // La première page de la vidéo n'a pas de transition : l'accroche est là dès la première image.
  const finTransition = debutPage > 0.01 ? debutPage + R.transitionSec : debutPage;
  // Trois styles du tableau : la page finit à l'arrivée de la suivante (un peu après sa coupe, `debutPage3`).
  const finPage = (r.tableau && r.finPageMs !== undefined ? r.finPageMs : Math.max(...r.scenesPage.map((s) => s.finMs), 0)) / 1000;
  const heure = (id: string) => (r.heuresPage[id] ?? (r.debutPageMs ?? 0)) / 1000;
  const t3 = (cle: string) => (r.temps3?.[cle] !== undefined ? r.temps3[cle]! / 1000 : undefined);
  const poses = new Set(r.poses ?? []);
  const apparitions: Record<string, number> = {};
  const couleurs: Record<string, number> = {};
  const poussees: Record<string, number> = {};
  const choses: Chose[] = [];
  const vitesse = R.vitessePxParSec * k;
  const trait = Math.max(3, Math.round(TAILLES_GABARIT_3.trait * k));
  const ecrireLignes = (e: ElementPlace, indices?: number[]) =>
    (indices ?? e.lignes.map((_, i) => i)).map((i) => ({ partie: `ligne:${i}`, trace: "ecrire" as const, points: ligneDeBase(e.lignes[i].px), cible: e.lignes[i].px, duree: Math.max(R.ligneMinSec, e.lignes[i].px.largeur / vitesse), ecriture: true, couleur: e.couleurTexte ?? COULEURS_REFERENCE_3.encre, epaisseur: 0, min: 0.7 * Math.max(R.ligneMinSec, e.lignes[i].px.largeur / vitesse) }));
  // Trois styles : un bloc part quand la voix commence à le dire (`~debut`), si c'est plus tôt que son heure répartie ;
  // le bloc qui suit le titre part au plus tard juste après lui (`avances`, le titre n'est jamais seul).
  const avances = new Map<string, number>();
  const heureDite = (id: string) => Math.min(r.tableau && t3(`${id}~debut`) !== undefined ? Math.min(heure(id), t3(`${id}~debut`)!) : heure(id), avances.get(id) ?? Infinity);
  const debutVisible = (id: string) => (poses.has(id) ? finTransition : Math.max(finTransition, heureDite(id)));
  /** Surlignage orange pâle sous le mot-clé (titre ou phrase clé de la douleur et de la solution). */
  const surligner = (e: ElementPlace): Chose["traits"] => {
    const g = e.gabarit;
    if ((g?.sorte !== "titre" && g?.sorte !== "phrase") || !g.surligne) return [];
    const z = g.surligne;
    // Peps : le marqueur franc balaie quand la voix dit le mot-clé, et la ligne se pousse au même instant.
    const cle = g.marqueur ? t3(`${e.elementId}~cle`) : undefined;
    if (g.marqueur) poussees[e.elementId] = Math.max(cle ?? 0, finTransition);
    return [{ partie: "surligne", trace: "surligne", points: [{ x: z.x, y: z.y + z.hauteur / 2 }, { x: z.x + z.largeur, y: z.y + z.hauteur / 2 }], cible: z, duree: g.marqueur ? P.marqueurSec : R.surlignageSec, ecriture: false, couleur: g.marqueur ? COULEURS_REFERENCE_3.marqueur : COULEURS_REFERENCE_3.surlignage, epaisseur: z.hauteur, ...(cle !== undefined ? { heure: Math.max(finTransition, cle - 0.04) } : {}) }];
  };
  const appelPage = page.elements.some((e) => e.gabarit?.sorte === "appel-plein");
  /** Les traits d'un élément que l'outil trace avant son texte (case, petit dessin, surligneur) ou après (souligné, barre, dessin). */
  const traitsDe = (e: ElementPlace, quand: "avant" | "apres"): Chose["traits"] =>
    (e.tableau?.[quand] ?? []).map((t, i) => {
      const points: PointRef[] = [];
      for (let j = 0; j + 1 < t.p.length; j += 2) points.push({ x: t.p[j], y: t.p[j + 1] });
      return { partie: `croquis:${quand}:${i}`, trace: "contour" as const, points, cible: e.px, duree: t.d ?? 0.05, ecriture: false, couleur: t.c, epaisseur: t.w, pause: 0, min: 0.3 * (t.d ?? 0.05), id: e.elementId };
    });
  /** Trois styles : le texte dont un élément est le satellite (« e12~etiquette », « e12~dessin », « e13~fleche »…). */
  const parentDe = (e: ElementPlace): ElementPlace | undefined => {
    const m = /^(.+)~(etiquette|dessin|fleche|carte|separe)$/.exec(e.elementId);
    return m && !poses.has(e.elementId) ? page.elements.find((x) => x.elementId === m[1] && x.lignes.length && !poses.has(x.elementId)) : undefined;
  };
  /** Trois styles : les satellites d'un texte puis ses propres traits d'avant, ce qui se trace avant ses lignes. */
  const avantTexte = (e: ElementPlace): Chose["traits"] => {
    if (!tableau) return [];
    const sats = page.elements.filter((x) => parentDe(x) === e).sort((a, b) => a.ordre - b.ordre);
    return [...sats.flatMap((x) => [...traitsDe(x, "avant"), ...ecrireLignes(x).map((l) => ({ ...l, id: x.elementId })), ...traitsDe(x, "apres")]), ...traitsDe(e, "avant").filter((_, i) => e.tableau?.avant?.[i]?.g !== "s")];
  };
  /** Trois styles : le surligneur passe sous des mots déjà écrits (dessiné sous l'encre, tracé après elle). */
  const surligneurDe = (e: ElementPlace): Chose["traits"] => (tableau ? traitsDe(e, "avant").filter((_, i) => e.tableau?.avant?.[i]?.g === "s") : []);
  // Trois styles du tableau (critique #291) : seuls le repère et le numéro arrivent avec la page (leurs traits aussi) ;
  // le titre s'écrit vite dès la fin de l'effacement ; chaque autre bloc s'écrit pendant que la voix le dit.
  const tableau = r.tableau?.style;
  /** Trois styles : les lignes écrites au rythme de la voix (de leur départ à leur fin dite), sans traîner. */
  const auRythme = (traits: Chose["traits"], h: number, ech: number | undefined): Chose["traits"] => {
    if (!tableau || ech === undefined) return traits;
    const ecr = traits.filter((x) => x.ecriture);
    const d = ecr.reduce((sm, x) => sm + x.duree, 0) + R.retourSec * Math.max(0, ecr.length - 1);
    const place = ech - R.avanceSec - Math.max(h, finTransition);
    if (!(d > 0) || place <= d) return traits;
    const f = Math.min(TABLEAU_RALENTI_MAX, place / d);
    return traits.map((x) => (x.ecriture ? { ...x, duree: x.duree * f } : x));
  };

  // Trois styles : le titre et le bloc qui le suit. Le titre s'écrit vite (0,4 à 0,6 s) quand la voix enchaîne ; sinon au
  // rythme de la voix (jusqu'à 1,4 s), et le bloc suivant part au plus tard juste après lui (vidéo v-6616b3800357 : le
  // titre restait seul 0,8 s en attendant la phrase).
  let dureeTitre: number | undefined;
  let avance: { id: string; titre: string; heure: number } | undefined;
  if (tableau) {
    const titre = page.elements.find((e) => e.gabarit?.sorte === "titre" && !poses.has(e.elementId));
    const suivant = titre && suivantDuTitre(page.elements, titre, (e) => (poses.has(e.elementId) ? Infinity : debutVisible(e.elementId)));
    if (titre) {
      const d = ecrireLignes(titre).reduce((sm, x) => sm + x.duree, 0);
      const vite = borne(d, TITRE_TABLEAU_SEC[0], TITRE_TABLEAU_SEC[1]);
      const hS = suivant && !poses.has(suivant.elementId) ? debutVisible(suivant.elementId) : undefined;
      dureeTitre = hS === undefined ? vite : borne(hS - TITRE_AIR_TABLEAU_SEC - finTransition, vite, Math.max(vite, TITRE_TABLEAU_LENT_MAX_SEC));
      const tard = finTransition + dureeTitre + TITRE_AIR_TABLEAU_SEC;
      if (suivant && hS !== undefined) {
        if (hS > tard) avances.set(suivant.elementId, tard);
        avance = { id: suivant.elementId, titre: titre.elementId, heure: Math.min(hS, tard) };
      }
    } else if (debutPage > 0.01 && !page.elements.some((e) => poses.has(e.elementId) && e.lignes.length && !["partie", "pastille"].includes(e.gabarit?.sorte ?? ""))) {
      // Sans titre, le premier bloc écrit part au plus tard juste après la transition (jamais une page vide quand la voix
      // dit d'abord une phrase que la page n'écrit pas).
      const premier = page.elements
        .filter((e) => e.type !== "dessin" && e.lignes.length && !poses.has(e.elementId) && !["partie", "pastille"].includes(e.gabarit?.sorte ?? "") && !e.elementId.includes("~"))
        .sort((a, b) => debutVisible(a.elementId) - debutVisible(b.elementId) || a.ordre - b.ordre)[0];
      // (Le contrôle des trois styles veut un premier trait au plus 0,58 s après l'arrivée de la page, transition comprise.)
      const tot = finTransition + 0.1;
      if (premier && debutVisible(premier.elementId) > tot) {
        avances.set(premier.elementId, tot);
        avance = { id: premier.elementId, titre: "", heure: tot };
      }
    }
  }

  for (const e of page.elements) {
    const g = e.gabarit;
    const pose = poses.has(e.elementId);
    const h = debutVisible(e.elementId);
    const ech = t3(`${e.elementId}~fin`);
    // Trois styles du tableau (16/10/2026) : les traits que l'outil trace avant le texte (case, petit dessin,
    // surligneur) et après lui (souligné, barre, dessin illustré), un par un, à leur durée (raccourcis ou posés quand un
    // bloc pressé les rattrape, comme les gestes décoratifs).
    const tb = e.tableau;
    // Trois styles : un satellite (étiquette, petit dessin, flèche, carte d'un texte) se trace avec son texte, ci-dessous.
    if (tableau && parentDe(e)) continue;
    if (tableau && (tb?.avant?.length || tb?.apres?.length) && !pose && !poses.has(`${e.elementId}#attente`) && !e.lignes.length) {
      // Un dessin seul (le dessin illustré de la page) ; celui de la première page attend la première image (la miniature).
      choses.push({ id: e.elementId, heure: debutPage < 0.01 ? Math.max(h, P.premierVisuelSec) : h, ordre: e.ordre, traits: [...traitsDe(e, "avant"), ...traitsDe(e, "apres")] });
    } else if (!tableau && (tb?.avant?.length || tb?.apres?.length)) {
      // Un élément déjà là avec la page (posé, ou d'une liste « À retenir » pâle) : ses traits se tracent dès son arrivée.
      const hc = pose || poses.has(`${e.elementId}#attente`) ? finTransition : h;
      if (tb.avant?.length) choses.push({ id: e.elementId, heure: hc, ordre: e.ordre - 0.5, traits: traitsDe(e, "avant") });
      if (tb.apres?.length) choses.push({ id: e.elementId, heure: hc + 0.001, ordre: e.ordre + 0.5, traits: traitsDe(e, "apres") });
    }
    if (e.type === "dessin") {
      // L'icône au trait se trace seule (sans le crayon) ; celle de la première page est là dès la première image.
      apparitions[e.elementId] = debutPage < 0.01 && pose ? -1 : pose ? debutPage + 0.1 : h;
      continue;
    }
    switch (g?.sorte) {
      case "partie":
      case "avant-apres":
        apparitions[e.elementId] = pose ? debutPage - 1 : h;
        continue;
      case "bloc-orange": {
        // Il apparaît en rebond (posé : déjà là) ; il se pousse quand la voix dit son chiffre (sinon ses premiers mots).
        apparitions[e.elementId] = pose ? debutPage - 1 : h;
        const dit = t3(`${e.elementId}~mot:0`) ?? t3(`${e.elementId}~debut`);
        poussees[e.elementId] = Math.max(dit ?? h, (pose ? finTransition : h) + P.blocSec * 0.6);
        continue;
      }
      case "visuel": {
        if (!estIdVisuel3(g.id)) continue;
        // La flèche vers le visuel, puis le visuel trait par trait, puis sa touche orange (maquette, `planVisuel`).
        const d = dessinVisuel3(g.id, g.options);
        const etapes = etapesVisuel3(d);
        const temps = tempsVisuel3(etapes, P.visuelSec);
        const sg = g.boite.largeur / GRILLE_VISUEL_3;
        const px = (q: PointRef): PointRef => ({ x: g.boite.x + q.x * sg, y: g.boite.y + q.y * sg });
        const traits: Chose["traits"] = [];
        if (g.fleche) {
          // La flèche relie le bloc orange au visuel : elle part une fois le bloc arrivé (son rebond presque fini).
          const bloc = page.elements.find((x) => x.gabarit?.sorte === "bloc-orange");
          const apresBloc = bloc ? debutVisible(bloc.elementId) + P.blocSec * 0.9 : h;
          const ep = Math.max(3, Math.round(VISUELS_GABARIT_3.traitFleche * k));
          choses.push({
            id: e.elementId,
            heure: Math.max(finTransition, apresBloc),
            ordre: e.ordre,
            traits: [
              { partie: "fleche-visuel", trace: "trait", points: g.fleche.corps, cible: g.encre, duree: P.flecheSec, ecriture: false, couleur: COULEURS_REFERENCE_3.mine, epaisseur: ep },
              { partie: "fleche-visuel:tete", trace: "trait", points: g.fleche.tete, cible: g.encre, duree: P.teteSec, ecriture: false, couleur: COULEURS_REFERENCE_3.mine, epaisseur: ep, pause: 0.02 },
            ],
          });
        }
        etapes.forEach((x, j) => {
          const pts = x.chemins.flat().map(px);
          const centre = px({ x: GRILLE_VISUEL_3 / 2, y: GRILLE_VISUEL_3 / 2 });
          traits.push({ partie: `visuel:${x.sorte}:${x.i}`, trace: "contour", points: pts.length ? pts : [centre], cible: g.encre, duree: Math.max(0.02, temps[j].t1 - temps[j].t0), ecriture: false, couleur: COULEURS_REFERENCE_3.mine, epaisseur: 0, pause: j ? Math.max(0, temps[j].t0 - temps[j - 1].t1) : 0, ...(x.crayon ? {} : { sansCrayon: true }) });
        });
        // Première image de la vidéo (la miniature) : l'accroche seule ; le crayon entre ensuite tracer le visuel.
        choses.push({ id: e.elementId, heure: debutPage < 0.01 ? Math.max(h, P.premierVisuelSec) : h, ordre: e.ordre, fixe: true, traits });
        continue;
      }
      case "bouton":
        // Trois styles : la demande s'écrit sur sa plaque (la plaque arrive avec elle).
        if (tableau && !pose) choses.push({ id: e.elementId, heure: h, ...(ech !== undefined ? { echeance: ech } : {}), ordre: e.ordre, traits: [...avantTexte(e), ...auRythme(ecrireLignes(e), h, ech), ...surligneurDe(e), ...traitsDe(e, "apres")] });
        continue;
      case "pastille":
        apparitions[e.elementId] = Math.max(finTransition - 0.12, Math.min(h, finTransition + 0.6));
        continue;
      case "accroche": {
        // Les mots de la douleur, entourés pendant que la voix les dit.
        const id = e.elementId;
        g.mots.forEach((m, j) => {
          const de = t3(`${id}~mot:${m.k}`) ?? h + 0.5 + j * 0.7;
          const a = t3(`${id}~motfin:${m.kFin}`) ?? de + 0.4;
          choses.push({ id, heure: Math.max(finTransition, de - 0.05), ordre: e.ordre, traits: [{ partie: `entoure:${j}`, trace: "entoure", points: tourZone(m.zone), cible: m.zone, duree: borne(a - de + 0.05, 0.3, 0.6), ecriture: false, couleur: g.couleur, epaisseur: trait, heure: Math.max(finTransition, de - 0.05) }] });
        });
        continue;
      }
      case "titre": {
        if (tableau && !pose) {
          // Trois styles : le titre s'écrit d'un trait dès la fin de l'effacement, en 0,4 à 0,6 s (critique #291, I2).
          const ls = ecrireLignes(e);
          const d = ls.reduce((sm, x) => sm + x.duree, 0);
          const vise = Math.max(0.2, (dureeTitre ?? borne(d, TITRE_TABLEAU_SEC[0], TITRE_TABLEAU_SEC[1])) - R.retourSec * (ls.length - 1));
          choses.push({ id: e.elementId, heure: finTransition, ordre: e.ordre, traits: [...avantTexte(e), ...ls.map((x) => ({ ...x, duree: (x.duree * vise) / d, min: (x.duree * vise) / d })), ...surligneurDe(e), ...traitsDe(e, "apres"), ...surligner(e)] });
          continue;
        }
        // Titre arrivé avec la page : le crayon surligne son mot-clé juste après la transition.
        const traits: Chose["traits"] = [...(pose ? [] : ecrireLignes(e)), ...surligner(e)];
        if (traits.length) choses.push({ id: e.elementId, heure: pose ? finTransition : h, ...(ech !== undefined && !pose ? { echeance: ech } : {}), ordre: e.ordre, traits });
        continue;
      }
      case "code": {
        apparitions[e.elementId] = h;
        choses.push({ id: e.elementId, heure: h + 0.08, ...(ech !== undefined ? { echeance: ech } : {}), ordre: e.ordre, traits: ecrireLignes(e) });
        continue;
      }
      case "case": {
        if (g.attente) {
          // « À retenir » : déjà là, pâle ; quand la voix le dit, il passe à l'encre et se coche.
          apparitions[`${e.elementId}#encre`] = Math.max(finTransition, h);
          choses.push({ id: e.elementId, heure: Math.max(finTransition, h), ordre: e.ordre, traits: [{ partie: "coche", trace: "coche", points: cocheDans(g.boite), cible: g.boite, duree: R.gesteSec * 0.85, ecriture: false, couleur: g.couleur, epaisseur: Math.round(trait * 1.25) }] });
        } else {
          apparitions[e.elementId] = h;
          const coche = Math.max(h + 0.3, (ech ?? h + 0.5) - 0.1);
          // Trois styles : la case vide, le petit dessin, le texte, puis la coche (jamais sautée), d'un seul geste.
          const avant = avantTexte(e).map((x, j) => ({ ...x, duree: x.duree * 0.7, ...(j ? {} : { heure: h }) }));
          choses.push({ id: e.elementId, heure: h + 0.06, ...(ech !== undefined ? { echeance: ech } : {}), ordre: e.ordre, ...(tableau ? { garde: true } : {}), traits: [...avant, ...ecrireLignes(e), ...surligneurDe(e), ...(tableau ? traitsDe(e, "apres") : []), { partie: "coche", trace: "coche", points: cocheDans(g.boite), cible: g.boite, duree: R.gesteSec * 0.8, ecriture: false, couleur: g.couleur, epaisseur: Math.round(trait * 1.25), heure: coche }] });
        }
        continue;
      }
      case "transformation": {
        // La carte arrive (fondu court) juste avant que le crayon y écrive.
        apparitions[e.elementId] = pose ? debutPage - 1 : h;
        const [de, vers] = e.lignes;
        // Le mot d'après dit (« un code ») ; introuvable, juste avant la fin dite du bloc (trois styles).
        const quand = t3(`${e.elementId}~vers`) ?? (tableau && ech !== undefined ? Math.max(h, ech - 0.35) : h + 1.2);
        const ec = ech ?? quand + 0.6;
        const f = g.fleche;
        // Trois styles : « Le nom → » s'écrit juste avant que la voix dise « un code », qui s'écrit pendant qu'elle le dit.
        const hT = tableau ? Math.max(finTransition, Math.min(h, quand - 0.9)) : h;
        if (tableau) apparitions[e.elementId] = pose ? debutPage - 1 : hT;
        choses.push({
          id: e.elementId,
          heure: hT,
          echeance: ec,
          ordre: e.ordre,
          traits: [
            { partie: "ligne:0", trace: "ecrire", points: ligneDeBase(de.px), cible: de.px, duree: Math.max(R.ligneMinSec, de.px.largeur / vitesse), ecriture: true, couleur: COULEURS_REFERENCE_3.mention, epaisseur: 0 },
            { partie: "fleche", trace: "fleche", points: [{ x: f.x1, y: f.y1 }, { x: f.x2, y: f.y2 }], cible: { x: f.x1, y: f.y1 - 20 * k, largeur: f.x2 - f.x1, hauteur: 40 * k }, duree: 0.3, ecriture: false, couleur: COULEURS_REFERENCE_3.encre, epaisseur: trait, heure: Math.max(hT, quand - (tableau ? 0.45 : 0.35)) },
            { partie: "ligne:1", trace: "ecrire", points: ligneDeBase(vers.px), cible: vers.px, duree: Math.max(R.ligneMinSec, vers.px.largeur / vitesse), ecriture: true, couleur: COULEURS_REFERENCE_3.encre, epaisseur: 0, heure: tableau ? Math.max(hT, quand - 0.12) : quand },
          ],
        });
        continue;
      }
      case "idee": {
        apparitions[e.elementId] = pose ? debutPage - 1 : h;
        const traits = pose ? [] : ecrireLignes(e);
        const barre = Math.max(h + 0.4, (ech ?? h + 1.2) + 0.05);
        choses.push({ id: e.elementId, heure: h, ...(ech !== undefined ? { echeance: ech } : {}), ordre: e.ordre, traits: [...traits, ...e.lignes.map((l, i) => ({ partie: `barre:${i}`, trace: "barre" as const, points: barreLigne(l.px), cible: l.px, duree: R.gesteSec * 0.8, ecriture: false, couleur: COULEURS_REFERENCE_3.accentTexte, epaisseur: Math.round(trait * 1.2), heure: i ? undefined : barre }))] });
        continue;
      }
      default: {
        if (e.type === "mention" && !e.lignes.length) continue;
        const traits: Chose["traits"] = pose ? [] : [...avantTexte(e), ...auRythme(ecrireLignes(e), h, ech), ...surligneurDe(e), ...(tableau ? traitsDe(e, "apres") : [])];
        // Texte d'avant : barré au crayon juste après lui ; mot-clé de la phrase : surligné.
        if (e.marque === "barre") traits.push(...e.lignes.map((l, i) => ({ partie: `barre:${i}`, trace: "barre" as const, points: barreLigne(l.px), cible: l.px, duree: R.gesteSec * 0.7, ecriture: false, couleur: COULEURS_REFERENCE_3.encre, epaisseur: Math.max(2, Math.round(trait * 0.8)) })));
        traits.push(...surligner(e));
        // Marque de la ligne (souligné) juste après elle ; le site de la page d'appel est souligné plus tard (l'appel).
        if (e.marque === "souligne" && !appelPage) traits.push(...e.lignes.map((l, i) => ({ partie: `souligne:${i}`, trace: "souligne" as const, points: sousLigne(l.px, 4 * k), cible: l.px, duree: R.gesteSec * 0.7, ecriture: false, couleur: e.couleurMarque ?? e.couleurTexte ?? COULEURS_REFERENCE_3.encre, epaisseur: e.epaisseurMarque ?? trait })));
        if (traits.length) choses.push({ id: e.elementId, heure: pose ? finTransition + 0.05 : h, ...(ech !== undefined && !pose ? { echeance: ech } : {}), ordre: e.ordre, traits });
      }
    }
  }
  // Page d'appel : jamais figée. Le crayon souligne l'adresse du site (orange), puis le bouton bat doucement jusqu'à la fin.
  const appel = page.elements.find((e) => e.gabarit?.sorte === "appel-plein");
  let battement: Plan3["battement"];
  if (appel) {
    const t0 = finTransition;
    const site = page.elements.find((e) => e.elementId.endsWith("~site")) ?? appel;
    const bouton = page.elements.find((e) => e.gabarit?.sorte === "bouton") ?? appel;
    const siteEcrit = tableau && !poses.has(site.elementId) ? debutVisible(site.elementId) + 0.3 : -Infinity;
    choses.push({ id: site.elementId, heure: Math.max(t0 + R.appelSouligneSec, siteEcrit), ordre: site.ordre, traits: site.lignes.map((l, i) => ({ partie: `souligne-appel:${i}`, trace: "souligne" as const, points: sousLigne(l.px, 6 * k), cible: l.px, duree: R.gesteSec * 1.6, ecriture: false, couleur: COULEURS_REFERENCE_3.accentTexte, epaisseur: Math.round(trait * 1.1) })) });
    const debuts: number[] = [];
    for (let b = t0 + R.battementPremierSec; b + R.battementSec <= finPage + 1e-6; b += R.battementPeriodeSec) debuts.push(+b.toFixed(3));
    const c = bouton.gabarit?.sorte === "bouton" ? bouton.gabarit.cadre : bouton.px;
    battement = { debuts, centre: { x: c.x + c.largeur / 2, y: c.y + c.hauteur / 2 } };
  }
  // Gestes de la fiche (souligner, entourer, cocher) : à leur heure, sur leur cible.
  for (const g of page.gestes) {
    const cible = page.elements.find((x) => x.elementId === g.cibleId);
    if (!cible || g.geste === "pointer" || g.geste === "barrer") continue;
    // Une coche à côté d'un texte barré (l'« avant ») dirait le contraire : le barré suffit.
    if (g.geste === "cocher" && cible.marque === "barre") continue;
    const h = Math.max(finTransition, heure(g.elementId));
    const zone = { x: cible.px.x - 14 * k, y: cible.px.y - 10 * k, largeur: cible.px.largeur + 28 * k, hauteur: cible.px.hauteur + 20 * k };
    const traits: Chose["traits"] =
      g.geste === "entourer"
        ? [{ partie: "entoure", trace: "entoure", points: tourZone(zone), cible: zone, duree: R.gesteSec * 1.3, ecriture: false, couleur: COULEURS_REFERENCE_3.accentTexte, epaisseur: trait }]
        : g.geste === "souligner"
          ? cible.lignes.map((l, i) => ({ partie: `souligne:${i}`, trace: "souligne" as const, points: sousLigne(l.px, 4 * k), cible: l.px, duree: R.gesteSec * 0.7, ecriture: false, couleur: cible.couleurTexte ?? COULEURS_REFERENCE_3.encre, epaisseur: trait }))
          : [{ partie: "coche", trace: "coche", points: cocheDans({ x: cible.px.x + cible.px.largeur + 16 * k, y: cible.px.y, largeur: 48 * k, hauteur: 48 * k }), cible: cible.px, duree: R.gesteSec, ecriture: false, couleur: COULEURS_REFERENCE_3.encre, epaisseur: trait }];
    choses.push({ id: g.elementId, heure: h, ordre: g.ordre, traits });
  }

  // Trois styles : rien ne s'intercale entre le titre et le bloc qui le suit (un dessin dit plus tôt se trace juste après).
  if (avance) for (const c of choses) if (c.id !== avance.id && c.id !== avance.titre && c.heure < avance.heure && c.heure > finTransition && !c.traits.some((x) => x.trace === "ecrire")) c.heure = avance.heure + 0.001;
  // Ordonnancement : une chose à la fois ; chaque bloc ENTIER au plus tard à sa fin dite (15/10, v-d3e2a726cf0c : une
  // vidéo n'est jamais refusée pour ça). Si le bloc ne tient pas, même écrit plus vite : (a) il part un peu plus tôt
  // (jusqu'à 0,6 s avant ses mots, jamais pendant la transition) ; (b) les gestes décoratifs qui le retardent (coche,
  // souligné, contour, entouré : ceux laissés par le crayon juste avant, puis les siens) sont raccourcis, puis sautés ;
  // (c) en dernier recours, il apparaît en fondu court (« posé ») à l'heure et le crayon passe au suivant.
  choses.sort((a, b) => a.heure - b.heure || a.ordre - b.ordre);
  const actions: Action3[] = [];
  /** Gestes décoratifs en fin de file (après la dernière écriture) : ils cèdent la place à un bloc pressé. */
  let file: { a: Action3; duree: number }[] = [];
  /** Fin du crayon sans cette file. */
  let libreFixe = -Infinity;
  const apresLibre = (l: number) => (l === -Infinity ? -Infinity : l + R.deplacementSec * 0.6);
  /** La file replacée : « garde » telle quelle, « serre » (au plus tôt, moitié de durée), « saute » (le contour d'un dessin reste, posé). */
  const replacer = (mode: "garde" | "serre" | "saute"): { file: Action3[]; poses: Action3[]; libre: number } => {
    if (mode === "garde") return { file: file.map((q) => q.a), poses: [], libre: file.length ? Math.max(...file.map((q) => q.a.debut + q.a.duree)) : libreFixe };
    if (mode === "saute") return { file: [], poses: file.filter((q) => q.a.trace === "contour").map((q) => ({ ...q.a, duree: FONDU_SEC, fondu: true })), libre: libreFixe };
    let t = libreFixe;
    const res = file.map((q, i) => {
      const de = t === -Infinity ? q.a.debut : t + (i ? R.retourSec : R.deplacementSec * 0.6);
      const a = { ...q.a, debut: Math.min(q.a.debut, de), duree: Math.max(0.1, q.duree * 0.5) };
      t = a.debut + a.duree;
      return a;
    });
    return { file: res, poses: [], libre: res.length ? t : libreFixe };
  };
  /** Les traits d'une chose posés à partir de `t0`, écriture au facteur `f`, gestes décoratifs avant l'échéance × `deco` (0 : sautés). */
  const simuler = (c: Chose, t0: number, f: number, deco: number) => {
    const dernier = c.traits.map((x) => x.trace).lastIndexOf("ecrire");
    const sautes = c.traits.filter((x, j) => deco === 0 && j < dernier && DECORATIFS.has(x.trace));
    const traits = c.traits.filter((x) => !sautes.includes(x));
    const acts: Action3[] = [];
    let t = t0;
    // Trois styles : un dessin sauté (le bloc presse) apparaît quand même, en fondu court, au départ du bloc.
    if (tableau) for (const x of sautes) if (x.partie.startsWith("croquis:")) acts.push({ id: x.id ?? c.id, partie: x.partie, trace: x.trace, points: x.points, cible: x.cible, debut: t0, duree: FONDU_SEC, angle: CRAYON_REFERENCE.angle, couleur: x.couleur, epaisseur: x.epaisseur, fondu: true });
    let finEcriture = -Infinity;
    traits.forEach((x, j) => {
      if (x.heure !== undefined) t = Math.max(t + (j ? R.retourSec : 0), x.heure);
      else if (j && x.pause !== undefined) t += x.pause;
      else if (j) t += x.trace === "ecrire" && traits[j - 1].trace === "ecrire" ? R.retourSec * f : R.retourSec;
      const avant = c.traits.indexOf(x) < dernier;
      // Un dessin fait de nombreux petits traits (trois styles) se raccourcit trait par trait, sans plancher.
      const duree = x.ecriture ? x.duree * f : avant && DECORATIFS.has(x.trace) ? (x.partie.startsWith("croquis:") ? x.duree * deco : Math.max(0.1, x.duree * deco)) : x.duree;
      acts.push({ id: x.id ?? c.id, partie: x.partie, trace: x.trace, points: x.points, cible: x.cible, debut: t, duree, angle: CRAYON_REFERENCE.angle, couleur: x.couleur, epaisseur: x.epaisseur, ...(x.sansCrayon ? { sansCrayon: true } : {}), ...(tableau && x.min !== undefined ? { min: Math.min(x.min, duree) } : {}) });
      t += duree;
      if (x.trace === "ecrire") finEcriture = t;
    });
    return { acts, finEcriture, dernier: acts.map((a) => (a.fondu ? "" : a.trace)).lastIndexOf("ecrire") };
  };
  const commettre = (c: Chose, acts: Action3[], dernier: number, avant: { file: Action3[]; poses: Action3[] }) => {
    actions.push(...avant.file, ...avant.poses);
    // La boîte (case, pastille de code) est là avant que le crayon écrive dedans.
    if (acts.length && apparitions[c.id] !== undefined) apparitions[c.id] = Math.max(finTransition - 0.12, Math.min(apparitions[c.id], acts[0].debut - 0.06));
    const queue = acts.slice(dernier + 1);
    const queueDeco = !c.garde && dernier >= 0 && queue.every((a) => DECORATIFS.has(a.trace));
    const fixes = queueDeco ? acts.slice(0, dernier + 1) : acts;
    actions.push(...fixes);
    libreFixe = fixes[fixes.length - 1].debut + fixes[fixes.length - 1].duree;
    file = queueDeco ? queue.map((a) => ({ a, duree: a.duree })) : [];
  };
  for (const c of choses) {
    const ecritures = c.traits.filter((x) => x.trace === "ecrire");
    if (c.echeance === undefined || !ecritures.length) {
      const avant = replacer("garde");
      const { acts, dernier } = simuler(c, Math.max(c.heure, apresLibre(avant.libre)), 1, 1);
      if (dernier < 0 && !c.fixe) {
        file.push(...acts.map((a) => ({ a, duree: a.duree })));
        continue;
      }
      commettre(c, acts, c.fixe ? acts.length - 1 : dernier, avant);
      continue;
    }
    const limite = c.echeance - R.avanceSec;
    const fMin = Math.max(0.2, 0.12 / Math.max(...ecritures.map((x) => x.duree)));
    const tot = Math.max(finTransition, c.heure - AVANCE_DEPART_MAX_SEC);
    const essais = [
      { mode: "garde", de: c.heure, deco: 1 },
      { mode: "garde", de: tot, deco: 1 },
      { mode: "serre", de: tot, deco: 1 },
      { mode: "serre", de: tot, deco: 0.4 },
      { mode: "saute", de: tot, deco: 0.4 },
      { mode: "saute", de: tot, deco: 0 },
    ] as const;
    let choisi: { acts: Action3[]; dernier: number; avant: ReturnType<typeof replacer> } | undefined;
    for (const e of essais) {
      const avant = replacer(e.mode);
      const t0 = Math.max(e.de, apresLibre(avant.libre));
      // Facteur de vitesse : 1 si le bloc tient, sinon le plus lent qui tient (jamais plus vite que 0,12 s par ligne).
      let s = simuler(c, t0, 1, e.deco);
      if (s.finEcriture > limite) {
        const vite = simuler(c, t0, fMin, e.deco);
        if (vite.finEcriture > limite) s = vite;
        else {
          let [lent, rapide] = [1, fMin];
          for (let i = 0; i < 18; i++) {
            const m = (lent + rapide) / 2;
            if (simuler(c, t0, m, e.deco).finEcriture > limite) lent = m;
            else rapide = m;
          }
          s = simuler(c, t0, rapide, e.deco);
        }
      }
      if (s.finEcriture <= c.echeance + MARGE_ECHEANCE_SEC) {
        choisi = { acts: s.acts, dernier: s.dernier, avant };
        break;
      }
    }
    if (choisi) {
      commettre(c, choisi.acts, choisi.dernier, choisi.avant);
      continue;
    }
    // (c) Posé : le bloc apparaît en fondu court, entier à sa fin dite ; le crayon ne s'y arrête pas.
    const de = Math.max(finTransition, Math.min(c.heure, c.echeance + MARGE_ECHEANCE_SEC - FONDU_SEC));
    for (const x of ecritures) actions.push({ id: c.id, partie: x.partie, trace: "ecrire", points: x.points, cible: x.cible, debut: de, duree: Math.max(0.05, Math.min(FONDU_SEC, c.echeance + MARGE_ECHEANCE_SEC - de)), angle: CRAYON_REFERENCE.angle, couleur: x.couleur, epaisseur: x.epaisseur, fondu: true });
    if (apparitions[c.id] !== undefined) apparitions[c.id] = Math.max(finTransition - 0.12, Math.min(apparitions[c.id], de - 0.06));
  }
  actions.push(...file.map((q) => q.a));
  if (tableau) serrerTitre(actions, page, finTransition, apparitions);
  if (tableau) calerOutilTableau(actions, debutPage < 0.01 ? debutPage : finTransition, finPage);
  // La couleur d'un dessin arrive après son contour.
  for (const a of actions) if (a.trace === "contour") couleurs[a.id] = a.debut + a.duree;
  // Rien ne déborde de la page : ce qui ne tient pas est fini juste avant la coupe suivante.
  for (const a of actions) {
    const max = finPage - 0.06;
    if (a.debut + a.duree > max) {
      a.debut = Math.min(a.debut, max);
      a.duree = Math.max(0, max - a.debut);
    }
  }
  actions.sort((a, b) => a.debut - b.debut);
  const plan: Plan3 = { actions, apparitions, couleurs, poses, debutPage, finTransition, k, largeur: image.largeur, hauteur: image.hauteur, fini, finPage, poussees, ...(battement ? { battement } : {}), ...(tableau ? { style: tableau } : {}) };
  // Inclinaison : une par action, choisie pour ne couvrir aucun texte visible à la fin de l'action.
  for (const a of actions) if (!a.fondu && !a.sansCrayon) a.angle = angleLibre(plan, page, pointA(a.points, a.trace === "ecrire" ? 1 : 0.5), a.debut + a.duree, a);
  if (fini) {
    for (const a of plan.actions) {
      a.debut = -1e6;
      a.duree = 0;
    }
    for (const id of Object.keys(plan.apparitions)) plan.apparitions[id] = -1e6;
    for (const id of Object.keys(plan.couleurs)) plan.couleurs[id] = -1e6;
    for (const id of Object.keys(plan.poussees)) plan.poussees[id] = -1e6;
  }
  return plan;
}

/* ------------------------------------------------------------------ */
/* État à un instant                                                     */
/* ------------------------------------------------------------------ */

/** Avancement (0 à 1, courbe du style) d'une partie d'un élément à l'instant `t` ; 1 si l'élément arrive avec la page. */
export function avancement3(plan: Plan3, id: string, partie: string, t: number): number {
  if (plan.fini) return 1;
  const a = plan.actions.find((x) => x.id === id && x.partie === partie);
  if (!a) return partie.startsWith("ligne:") && (plan.poses.has(id) || plan.poses.has(`${id}#attente`)) ? 1 : 0;
  if (a.duree <= 0 || a.fondu) return t >= a.debut ? 1 : 0;
  const u = borne((t - a.debut) / a.duree);
  // Les traits d'un visuel se tracent à vitesse constante (maquette) ; sa touche orange qui s'anime seule suit ses
  // propres courbes (`etatOrange3`) ; ses traces orange, la courbe du style.
  if (a.trace === "contour" && a.partie.startsWith("visuel:") && (a.sansCrayon || !a.partie.startsWith("visuel:orange"))) return u;
  // L'écriture avance à vitesse presque constante (le bord suit la pointe) ; les traits suivent la courbe du style.
  return a.trace === "ecrire" ? lerp(u, courbeReference3(u), 0.35) : courbeReference3(u);
}

/** Opacité d'une ligne : 1, sauf un bloc posé (fondu court). */
export function opaciteLigne3(plan: Plan3, id: string, partie: string, t: number): number {
  if (plan.fini) return 1;
  const a = plan.actions.find((x) => x.id === id && x.partie === partie);
  return a?.fondu ? courbeReference3((t - a.debut) / Math.max(0.01, a.duree)) : 1;
}

/** Opacité (et décalage) d'une apparition : fondu court, ou léger rebond (pastilles). */
export function apparition3(plan: Plan3, id: string, t: number, rebond = false): { o: number; echelle: number; dy: number } {
  if (plan.fini) return { o: 1, echelle: 1, dy: 0 };
  const d = plan.apparitions[id];
  if (d === undefined) return { o: 0, echelle: 1, dy: 0 };
  if (rebond) {
    const u = borne((t - d) / R.rebondSec);
    return { o: borne(u * 3), echelle: u <= 0 ? 0 : rebondReference3(u), dy: 0 };
  }
  const u = courbeReference3((t - d) / R.apparitionSec);
  return { o: u, echelle: 1, dy: (1 - u) * 12 * plan.k };
}

/** Échelle de la page d'appel à l'instant `t` (1 : au repos) : un battement doux, la même courbe que le reste. */
export function battement3(plan: Plan3, t: number): number {
  if (plan.fini || !plan.battement) return 1;
  for (const b of plan.battement.debuts) {
    const u = (t - b) / R.battementSec;
    if (u > 0 && u < 1) return 1 + R.battementAmplitude * Math.sin(Math.PI * courbeReference3(u));
  }
  return 1;
}

/**
 * Plus long moment (s) où la page ne bouge pas, entre `de` et `a` : ni crayon (ses actions, son entrée et sa sortie),
 * ni battement. Sert au contrôle « jamais figée » de la page d'appel.
 */
export function immobileMax3(plan: Plan3, de: number, a: number): number {
  const mouvements = [...plan.actions.map((x) => [x.debut - 0.32, x.debut + x.duree + 0.32] as const), ...(plan.battement?.debuts ?? []).map((b) => [b, b + R.battementSec] as const)].sort((x, y) => x[0] - y[0]);
  let max = 0;
  let t = de;
  for (const [d, f] of mouvements) {
    if (f <= t) continue;
    if (d > t) max = Math.max(max, Math.min(d, a) - t);
    t = Math.max(t, f);
    if (t >= a) break;
  }
  return Math.max(max, a - t);
}

/** Tracé d'une icône au trait (0 à 1) : elle se dessine seule, en douceur. */
export function traceIcone3(plan: Plan3, id: string, t: number): number {
  if (plan.fini) return 1;
  const d = plan.apparitions[id];
  return d === undefined ? 0 : courbeReference3((t - d) / R.iconeSec);
}

/** Couleur d'un dessin (0 à 1), après son contour. */
export function couleurDessin3(plan: Plan3, id: string, t: number): number {
  if (plan.fini) return 1;
  const d = plan.couleurs[id];
  return d === undefined ? 0 : courbeReference3((t - d) / 0.25);
}

/**
 * Transition de page « fondu + montée » à l'instant `t` (maquette A) : la page d'avant monte un peu et s'efface
 * (`depart` : 0 → 1 en `sortiePageSec`), la nouvelle arrive d'un peu plus bas (`arrivee` : opacité et montée, 0 → 1 en
 * `fonduMonteeSec`). `enCours` : faux dès que la nouvelle page est en place (et sur la première page).
 */
export function transitionPage3(plan: Plan3, t: number): { enCours: boolean; depart: number; opacite: number; montee: number } {
  if (plan.finTransition <= plan.debutPage || plan.fini) return { enCours: false, depart: 1, opacite: 1, montee: 1 };
  const u = (t - plan.debutPage) / R.fonduMonteeSec;
  if (u >= 1) return { enCours: false, depart: 1, opacite: 1, montee: 1 };
  return { enCours: true, depart: courbeReference3((t - plan.debutPage) / R.sortiePageSec), opacite: courbeReference3((t - plan.debutPage - R.fonduMonteeSec * 0.15) / (R.fonduMonteeSec * 0.55)), montee: sortieReference3(u) };
}

/** Reste de la transition à l'instant `t` (1 → la page arrive, 0 → la page est en place). */
export function glissement3(plan: Plan3, t: number): number {
  const x = transitionPage3(plan, t);
  return x.enCours ? 1 - x.montee : 0;
}

/* ------------------------------------------------------------------ */
/* Peps : visuel, bloc orange, poussée, pastille                         */
/* ------------------------------------------------------------------ */

/** Ampleur (0 à 1) de ce qui vit encore sur la page à l'instant `t` : 1, puis s'apaise dans sa dernière seconde. */
export function vie3(plan: Plan3, t: number): number {
  if (plan.fini) return 0;
  return borne((plan.finPage - 0.15 - t) / 0.85);
}

/**
 * État du visuel `id` à l'instant `t` : avancement (0 à 1) de chacune de ses étapes (`visuel:<sorte>:<i>`), de sa
 * flèche, le temps écoulé depuis la fin de sa touche orange (`apres`, s ; négatif avant), son souffle.
 */
export function etatVisuel3(plan: Plan3, id: string, t: number): { parties: Record<string, number>; apres: number; vie: number; debut: number } {
  const acts = plan.actions.filter((a) => a.id === id);
  const parties: Record<string, number> = {};
  for (const a of acts) parties[a.partie] = avancement3(plan, id, a.partie, t);
  const fin = acts.length ? Math.max(...acts.map((a) => a.debut + a.duree)) : Infinity;
  const debut = acts.length ? Math.min(...acts.map((a) => a.debut)) : Infinity;
  return { parties, apres: plan.fini ? 1e6 : t - fin, vie: vie3(plan, t), debut };
}

/** Échelle de la poussée douce de l'élément `id` à l'instant `t` (1 : au repos ; ×1,06 au plus, 0,5 s). */
export function poussee3(plan: Plan3, id: string, t: number): number {
  const d = plan.poussees[id];
  if (plan.fini || d === undefined) return 1;
  return 1 + P.pousseeAmplitude * clocheVisuel3((t - d) / P.pousseeSec);
}

/** Bloc orange : apparition en rebond (de 0,55 à 1, dépassement franc) et valeur du compteur à l'instant `t`. */
export function blocOrange3(plan: Plan3, id: string, t: number, compteur?: { de: number; a: number }): { o: number; echelle: number; valeur?: number } {
  const d = plan.apparitions[id];
  const valeur = (u: number) => (compteur ? Math.round(compteur.de + (compteur.a - compteur.de) * courbeReference3(u)) : undefined);
  if (plan.fini || (d !== undefined && d < plan.debutPage)) return { o: 1, echelle: 1, valeur: compteur?.a };
  if (d === undefined) return { o: 0, echelle: 1 };
  const u = borne((t - d) / P.blocSec);
  return { o: borne(u * 3), echelle: u <= 0 ? 0.55 : 0.55 + 0.45 * rebondVisuel3(u), valeur: valeur((t - d - 0.05) / P.compteurSec) };
}

/** Pastille d'étape d'une page avec peps : rebond franc de la maquette (0,55 s, de 0,55 à 1). */
export function pastillePeps3(plan: Plan3, id: string, t: number): { o: number; echelle: number } {
  if (plan.fini) return { o: 1, echelle: 1 };
  const d = plan.apparitions[id];
  if (d === undefined) return { o: 0, echelle: 1 };
  const u = borne((t - d) / P.pastilleSec);
  return { o: borne(u * 3), echelle: u <= 0 ? 0.55 : 0.55 + 0.45 * rebondVisuel3(u) };
}

/* ------------------------------------------------------------------ */
/* Crayon                                                                */
/* ------------------------------------------------------------------ */

const ANGLES = [0, 10, -10, 20, -20, 30, -30, 40, -45, -60, -75, -90, -105];

/** Textes visibles à l'instant `t` (arrivés avec la page, ou commencés) : le crayon ne les couvre jamais. */
function textesVisibles(plan: Plan3, page: PagePlacee, t: number, sauf?: Action3): RectPx[] {
  const res: RectPx[] = [];
  for (const e of page.elements) {
    if (e.type === "dessin") continue;
    const deja = plan.poses.has(e.elementId) || plan.poses.has(`${e.elementId}#attente`) || plan.apparitions[e.elementId] !== undefined && plan.apparitions[e.elementId] <= t;
    e.lignes.forEach((l, i) => {
      const a = plan.actions.find((x) => x.id === e.elementId && x.partie === `ligne:${i}`);
      if (a === sauf) return;
      if (deja || (a && a.debut <= t)) res.push({ x: l.px.x, y: l.px.y + l.px.hauteur * 0.1, largeur: l.px.largeur, hauteur: l.px.hauteur * 0.8 });
    });
  }
  return res;
}

function angleLibre(plan: Plan3, page: PagePlacee, pointe: PointRef, t: number, sauf: Action3): number {
  const textes = textesVisibles(plan, page, t, sauf);
  const marge = 4 * plan.k;
  let meilleur: number = CRAYON_REFERENCE.angle;
  let moindre = Infinity;
  for (const d of ANGLES) {
    const angle = CRAYON_REFERENCE.angle + d;
    let fautes = 0;
    const corps = silhouetteCrayon(pointe, angle, plan.k);
    const [, a1, b1, b2, a2] = corps;
    const pts: PointRef[] = [];
    for (let i = 0; i <= 10; i++) {
      const u = i / 10;
      pts.push({ x: lerp(a1.x, b1.x, u), y: lerp(a1.y, b1.y, u) }, { x: lerp(a2.x, b2.x, u), y: lerp(a2.y, b2.y, u) }, { x: lerp((a1.x + a2.x) / 2, (b1.x + b2.x) / 2, u), y: lerp((a1.y + a2.y) / 2, (b1.y + b2.y) / 2, u) });
    }
    for (const q of pts) {
      if (q.x < marge || q.y < marge || q.x > plan.largeur - marge || q.y > plan.hauteur - marge) fautes += 10;
      for (const r of textes) if (dans(q, r)) fautes++;
    }
    fautes += Math.abs(d) / 200;
    if (fautes < moindre) {
      moindre = fautes;
      meilleur = angle;
    }
  }
  return meilleur;
}

export interface PoseCrayon3 {
  pointe: PointRef;
  angle: number;
  ecrit: boolean;
}

/** Le point de sortie du crayon (hors de l'image, en bas à droite). */
const sortie = (plan: Plan3): PointRef => ({ x: plan.largeur + 40 * plan.k, y: plan.hauteur * 0.82 });

/** Où est le crayon à l'instant `t` ; `null` : hors de l'image. Aucun tremblement, aucun saut. */
export function poseCrayon3(plan: Plan3, t: number): PoseCrayon3 | null {
  const acts = plan.actions.filter((a) => !a.fondu && !a.sansCrayon);
  if (!acts.length) return null;
  const enCours = acts.find((a) => t >= a.debut && t <= a.debut + a.duree && a.duree > 0);
  if (enCours) return { pointe: pointA(enCours.points, avancement3(plan, enCours.id, enCours.partie, t)), angle: enCours.angle, ecrit: true };
  const prec = [...acts].reverse().find((a) => a.debut + a.duree <= t);
  const suiv = acts.find((a) => a.debut > t);
  const dehors = sortie(plan);
  const aller = (de: PointRef, a: PointRef, angDe: number, angA: number, u: number): PoseCrayon3 => {
    const v = courbeReference3(u);
    return { pointe: { x: lerp(de.x, a.x, v), y: lerp(de.y, a.y, v) - Math.sin(Math.PI * v) * 14 * plan.k }, angle: lerp(angDe, angA, v), ecrit: false };
  };
  const finDe = (a: Action3) => pointA(a.points, 1);
  const debutDe = (a: Action3) => pointA(a.points, 0);
  const entree = 0.32;
  if (!prec && suiv) {
    // Il entre par le bas à droite juste avant sa première action.
    const u = (t - (suiv.debut - entree)) / entree;
    return u <= 0 ? null : aller(dehors, debutDe(suiv), CRAYON_REFERENCE.angle, suiv.angle, u);
  }
  if (prec && !suiv) {
    const u = (t - (prec.debut + prec.duree)) / entree;
    return u >= 1 ? null : aller(finDe(prec), dehors, prec.angle, CRAYON_REFERENCE.angle, u);
  }
  if (!prec || !suiv) return null;
  const finP = prec.debut + prec.duree;
  const ecart = suiv.debut - finP;
  if (ecart > R.sortieSec) {
    // Long repos : il quitte la page, puis revient (jamais posé sur le texte qu'on lit).
    if (t < finP + entree) return aller(finDe(prec), dehors, prec.angle, CRAYON_REFERENCE.angle, (t - finP) / entree);
    if (t > suiv.debut - entree) return aller(dehors, debutDe(suiv), CRAYON_REFERENCE.angle, suiv.angle, (t - (suiv.debut - entree)) / entree);
    return null;
  }
  const glisse = Math.min(R.deplacementSec, ecart);
  const u = glisse > 0 ? (t - (suiv.debut - glisse)) / glisse : 1;
  if (u <= 0) return { pointe: finDe(prec), angle: prec.angle, ecrit: false };
  return aller(finDe(prec), debutDe(suiv), prec.angle, suiv.angle, u);
}
