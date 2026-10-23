/**
 * ANIMATION DU STYLE « reference/1 » : le crayon ÉCRIT. Fonctions PURES, sans React (lues par le rendu et les tests).
 *
 * Le plan se calcule PAGE par PAGE (toutes les scènes de la page, leurs heures du calage) : chaque scène rend sa
 * fenêtre du même plan, le crayon ne saute jamais d'une scène à la suivante.
 *  - Chaque bloc démarre sur l'heure de son mot d'ancre (jamais avant), le crayon faisant une chose à la fois : le
 *    texte se dévoile de gauche à droite à vitesse constante, la pointe suit le bord, sur la ligne de base ; retour à
 *    la ligne en 0,12 s ; entre deux blocs, le crayon glisse en 0,3 s.
 *  - Un dessin : la pointe en fait le tour pendant que son contour se trace (0,5 s), puis la couleur se pose (0,3 s)
 *    pendant que le crayon repart.
 *  - Marques de la ligne (souligné, barré, entouré) juste après elle ; gestes de la fiche (souligner, barrer, entourer,
 *    cocher, pointer) à leur heure : un trait simple, du même crayon.
 *  - Une scène trop courte pour tout écrire : ses durées sont réduites d'un même facteur (jusqu'à `reductionMin`) ; ce
 *    qui ne tient toujours pas est fini à la dernière image de la scène (la scène suivante reprend la page finie).
 *  - Le crayon garde la même inclinaison (corps vers le bas à droite, sur la page encore vide) : il ne cache jamais la
 *    ligne en cours. Entre deux actions il reste en l'air au bout de ce qu'il vient d'écrire, avec un léger
 *    tremblement (jamais figé). À la fin de la vidéo, il se pose, presque couché, sous la page finie.
 *  - Première image de la vidéo : l'accroche est déjà écrite (règle « accroche dès la première image ») ; sa marque
 *    s'écrit tout de suite.
 */
import { CRAYON_REFERENCE, RYTHME_REFERENCE, TAILLES_REFERENCE } from "./charte";
import type { ElementPlace, GestePlace, PagePlacee, RectPx } from "../types";
import type { ProprietesReference } from "./types";

export interface PointRef {
  x: number;
  y: number;
}

/** Ce que trace une action : une ligne écrite, un trait de marque ou de geste, le contour d'un dessin. */
export type TraceReference = "ecrire" | "souligne" | "barre" | "entoure" | "coche" | "pointe" | "contour" | "rond";

export interface ActionReference {
  /** Élément ou geste. */
  id: string;
  /** « ligne:i », « souligne:i », « barre:i », « entoure », « coche », « pointe », « contour ». */
  partie: string;
  trace: TraceReference;
  /** Rectangle visé : la ligne, la zone du geste, le dessin. */
  cible: RectPx;
  /** Début et durée (s, horloge de la vidéo). */
  debut: number;
  duree: number;
}

export interface PlanPageReference {
  actions: ActionReference[];
  /** Éléments et gestes déjà là au début de la page (l'accroche de la première image). */
  deja: Record<string, true>;
  /** Couleur des dessins : début (s) de leur remplissage. */
  couleurs: Record<string, number>;
  /** Crayon posé à la fin de la vidéo (s) et où. */
  pose: { debut: number; point: PointRef } | null;
  /** Échelle des tailles. */
  k: number;
  /**
   * Style « reference/2 » : ce que le gabarit pose sans le crayon (repère, bandeau, étiquette, puce) et l'heure (s) où
   * il apparaît, en fondu court.
   */
  apparitions: Record<string, number>;
}

const borne = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lisse = (x: number) => x * x * (3 - 2 * x);
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

/** Retard permis (s) sur ce qui s'écrit au moment où la voix le dit. */
export const A_L_HEURE_SEC = 0.15;

/** Part de la hauteur d'une ligne où passe la pointe (ligne de base : 37 px sur 52 dans la maquette). */
export const POINTE_LIGNE = 0.72;

/* ------------------------------------------------------------------ */
/* Tracés                                                                */
/* ------------------------------------------------------------------ */

/** Tour d'un rectangle à coins arrondis, dans le sens horaire depuis le haut à gauche, un peu au-delà du départ. */
function tour(r: RectPx, rayon: number, depassement = 0.06): PointRef[] {
  const q = Math.min(rayon, r.largeur / 2, r.hauteur / 2);
  const pts: PointRef[] = [];
  const arc = (cx: number, cy: number, a0: number) => {
    for (let i = 0; i <= 6; i++) {
      const a = a0 + (i / 6) * (Math.PI / 2);
      pts.push({ x: cx + q * Math.cos(a), y: cy + q * Math.sin(a) });
    }
  };
  pts.push({ x: r.x + q, y: r.y });
  arc(r.x + r.largeur - q, r.y + q, -Math.PI / 2);
  arc(r.x + r.largeur - q, r.y + r.hauteur - q, 0);
  arc(r.x + q, r.y + r.hauteur - q, Math.PI / 2);
  arc(r.x + q, r.y + q, Math.PI);
  // Le trait repasse un peu au-delà de son départ, comme une boucle faite à la main.
  pts.push({ x: r.x + q + depassement * r.largeur, y: r.y + 0.004 * r.hauteur });
  return pts;
}

/** Points (polyligne) que suit la pointe, et que le trait dessine, pour une action. */
export function pointsTrace(a: Pick<ActionReference, "trace" | "cible">, k: number): PointRef[] {
  const c = a.cible;
  switch (a.trace) {
    case "ecrire":
      return [
        { x: c.x, y: c.y + c.hauteur * POINTE_LIGNE },
        { x: c.x + c.largeur, y: c.y + c.hauteur * POINTE_LIGNE },
      ];
    case "souligne":
      return [
        { x: c.x - 2 * k, y: c.y + c.hauteur * 0.93 },
        { x: c.x + c.largeur * 0.5, y: c.y + c.hauteur * 0.94 },
        { x: c.x + c.largeur + 2 * k, y: c.y + c.hauteur * 0.92 },
      ];
    case "barre":
      return [
        { x: c.x - 4 * k, y: c.y + c.hauteur * 0.52 },
        { x: c.x + c.largeur + 4 * k, y: c.y + c.hauteur * 0.49 },
      ];
    case "entoure":
      return tour(c, Math.min(c.hauteur / 2, 44 * k));
    case "rond":
      return tour(c, c.largeur / 2, 0.02);
    case "coche":
      return [
        { x: c.x + c.largeur * 0.08, y: c.y + c.hauteur * 0.55 },
        { x: c.x + c.largeur * 0.38, y: c.y + c.hauteur * 0.86 },
        { x: c.x + c.largeur * 0.95, y: c.y + c.hauteur * 0.08 },
      ];
    case "pointe":
      return [
        { x: c.x - 26 * k, y: c.y + c.hauteur * 0.5 },
        { x: c.x - 10 * k, y: c.y + c.hauteur * 0.62 },
        { x: c.x - 26 * k, y: c.y + c.hauteur * 0.5 },
      ];
    case "contour": {
      const m = c.largeur * 0.08;
      return tour({ x: c.x + m, y: c.y + m, largeur: c.largeur - 2 * m, hauteur: c.hauteur - 2 * m }, c.largeur * 0.12, 0);
    }
  }
}

/** Point d'une polyligne à la part `u` de sa longueur. */
export function pointA(pts: readonly PointRef[], u: number): PointRef {
  if (pts.length === 1) return pts[0];
  const longueurs = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y));
  const total = longueurs.reduce((s, l) => s + l, 0) || 1;
  let reste = borne(u) * total;
  for (let i = 0; i < longueurs.length; i++) {
    if (reste <= longueurs[i] || i === longueurs.length - 1) {
      const v = longueurs[i] ? borne(reste / longueurs[i]) : 1;
      return { x: lerp(pts[i].x, pts[i + 1].x, v), y: lerp(pts[i].y, pts[i + 1].y, v) };
    }
    reste -= longueurs[i];
  }
  return pts[pts.length - 1];
}

/** Chemin SVG d'une polyligne (le rendu le trace avec `pathLength` 1). */
export function cheminTrace(pts: readonly PointRef[]): string {
  return pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
}

/* ------------------------------------------------------------------ */
/* Plan d'une page                                                       */
/* ------------------------------------------------------------------ */

/** Une chose à écrire sur la page : ses actions, dans l'ordre, et son heure. */
interface Chose {
  id: string;
  sceneId: string;
  heure: number;
  ordre: number;
  dessin: boolean;
  parties: { partie: string; trace: TraceReference; cible: RectPx; duree: number }[];
}

/** Zone entourée d'un bloc (marque « entoure » de la ligne) : le texte et sa marge, comme la mise en page. */
const zoneEntoure = (e: Pick<ElementPlace, "px">, k: number): RectPx => {
  const m = Math.round(TAILLES_REFERENCE.margeEntoure * k);
  return { x: e.px.x - m, y: e.px.y - m, largeur: e.px.largeur + 2 * m, hauteur: e.px.hauteur + 2 * m };
};

function chosesDeLaPage(page: PagePlacee, r: Pick<ProprietesReference, "heuresPage" | "k">): Chose[] {
  const R = RYTHME_REFERENCE;
  const k = r.k;
  const vitesse = R.vitessePxParSec * k;
  const res: Chose[] = [];
  const heure = (id: string) => (r.heuresPage[id] ?? 0) / 1000;
  for (const e of page.elements) {
    const decor = e.gabarit?.sorte;
    // Style « reference/2 » : repère, bandeau, étiquette et puce apparaissent (aucun trait du crayon).
    if (decor === "repere" || decor === "bandeau" || decor === "etiquette" || decor === "puce") continue;
    if (e.gabarit?.sorte === "pastille") {
      // La pastille numérotée : le crayon trace le rond, le disque se colore, puis le chiffre s'écrit.
      const g = e.gabarit;
      const parties: Chose["parties"] = [{ partie: "rond", trace: "rond", cible: g.disque, duree: R.gesteSec * 0.9 }, ...e.lignes.map((l, i) => ({ partie: `ligne:${i}`, trace: "ecrire" as const, cible: l.px, duree: Math.max(R.ligneMinSec, l.px.largeur / vitesse) }))];
      res.push({ id: e.elementId, sceneId: e.sceneId, heure: heure(e.elementId), ordre: e.ordre, dessin: false, parties });
      continue;
    }
    if (e.type === "dessin") {
      res.push({ id: e.elementId, sceneId: e.sceneId, heure: heure(e.elementId), ordre: e.ordre, dessin: true, parties: [{ partie: "contour", trace: "contour", cible: e.px, duree: R.contourSec }] });
      continue;
    }
    const parties: Chose["parties"] = e.lignes.map((l, i) => ({ partie: `ligne:${i}`, trace: "ecrire" as const, cible: l.px, duree: Math.max(R.ligneMinSec, l.px.largeur / vitesse) }));
    // Style « reference/2 » : l'appel s'écrit dans son cadre, que le crayon trace d'abord (puis il se remplit).
    if (e.gabarit?.sorte === "appel") parties.unshift({ partie: "entoure", trace: "entoure", cible: e.gabarit.cadre, duree: R.gesteSec });
    // Trait épais (titre du gabarit clair) : un peu plus bas, sous les jambages.
    const sous = (c: RectPx): RectPx => (e.epaisseurMarque ? { ...c, hauteur: c.hauteur + e.epaisseurMarque * 1.6 } : c);
    if (e.marque === "souligne" || e.marque === "barre") e.lignes.forEach((l, i) => parties.push({ partie: `${e.marque}:${i}`, trace: e.marque as TraceReference, cible: e.marque === "souligne" ? sous(l.px) : l.px, duree: R.gesteSec * 0.6 }));
    if (e.marque === "entoure") parties.push({ partie: "entoure", trace: "entoure", cible: zoneEntoure(e, k), duree: R.gesteSec });
    res.push({ id: e.elementId, sceneId: e.sceneId, heure: heure(e.elementId), ordre: e.ordre, dessin: false, parties });
  }
  for (const g of page.gestes) {
    const cible = page.elements.find((x) => x.elementId === g.cibleId);
    if (!cible) continue;
    res.push({ id: g.elementId, sceneId: g.sceneId, heure: heure(g.elementId), ordre: g.ordre, dessin: false, parties: partiesGeste(g, cible, k) });
  }
  return res.sort((a, b) => a.heure - b.heure || a.ordre - b.ordre);
}

function partiesGeste(g: GestePlace, cible: ElementPlace, k: number): Chose["parties"] {
  const d = RYTHME_REFERENCE.gesteSec;
  switch (g.geste) {
    case "souligner":
    case "barrer": {
      const trace: TraceReference = g.geste === "souligner" ? "souligne" : "barre";
      const n = Math.max(1, cible.lignes.length);
      return cible.lignes.map((l, i) => ({ partie: `${trace}:${i}`, trace, cible: l.px, duree: d / Math.sqrt(n) }));
    }
    case "entourer":
      return [{ partie: "entoure", trace: "entoure", cible: g.zone?.px ?? zoneEntoure(cible, k), duree: d }];
    case "cocher":
      return [{ partie: "coche", trace: "coche", cible: g.zone?.px ?? { x: cible.px.x + cible.px.largeur + 12 * k, y: cible.px.y, largeur: 40 * k, hauteur: 40 * k }, duree: d * 0.7 }];
    case "pointer":
      return [{ partie: "pointe", trace: "pointe", cible: cible.lignes[0]?.px ?? cible.px, duree: d }];
  }
}

/** Ordonne les choses d'une scène à partir de `depart` (s), durées multipliées par `f` ; rend la fin. */
function ordonner(choses: Chose[], depart: number, avant: boolean, f: number, sortie?: ActionReference[], couleurs?: Record<string, number>): number {
  const R = RYTHME_REFERENCE;
  let t = depart;
  let precede = avant;
  for (const c of choses) {
    const glisse = (c.dessin ? R.versDessinSec : R.deplacementSec) * f;
    let debut = Math.max(c.heure, precede ? t + glisse : t);
    c.parties.forEach((p, j) => {
      if (j > 0) debut += R.retourSec * f;
      const duree = p.duree * f;
      sortie?.push({ id: c.id, partie: p.partie, trace: p.trace, cible: p.cible, debut, duree });
      debut += duree;
    });
    if (c.dessin && couleurs) couleurs[c.id] = debut;
    t = debut;
    precede = true;
  }
  return t;
}

/**
 * Plan du crayon pour la page de la scène : toutes les scènes de la page, leurs heures. Même entrée (page, heures,
 * scènes de la page) = même plan, quelle que soit la scène qui le demande.
 */
export function planPageReference(page: PagePlacee, r: ProprietesReference): PlanPageReference {
  const R = RYTHME_REFERENCE;
  const k = r.k;
  const toutes = chosesDeLaPage(page, r);
  const deja: Record<string, true> = {};
  const actions: ActionReference[] = [];
  const couleurs: Record<string, number> = {};
  // Accroche de la première image : son texte est déjà écrit ; sa marque, elle, s'écrit tout de suite.
  const accroche = r.accroche ? toutes.find((c) => c.id === r.accroche) : undefined;
  if (accroche) {
    accroche.parties = accroche.parties.filter((p) => p.trace !== "ecrire");
    if (!accroche.parties.length) deja[accroche.id] = true;
    else deja[`${accroche.id}#texte`] = true;
  }
  let t = r.scenesPage.length ? r.scenesPage[0].debutMs / 1000 : 0;
  let avant = !!accroche;
  for (const s of r.scenesPage) {
    const choses = toutes.filter((c) => c.sceneId === s.id && !deja[c.id]);
    const debut = Math.max(t, s.debutMs / 1000);
    const fin = s.finMs / 1000 - 0.04;
    // La plus grande vitesse naturelle qui tient dans la scène (réduction d'un même facteur au besoin), en laissant au
    // crayon le temps de quitter un geste avant la scène suivante.
    const visee = Math.max(debut, fin - R.deplacementSec);
    // Ce qui doit s'écrire au moment où la voix le dit (« reference/2 » : la phrase de la fin) : ce qui le précède
    // s'écrit plus vite au besoin.
    const aLHeure = choses.filter((c) => r.aLHeure?.includes(c.id));
    const trop = (m: number) => {
      const essai: ActionReference[] = [];
      if (ordonner(choses, debut, avant, m, essai) > visee) return true;
      return aLHeure.some((c) => (essai.find((a) => a.id === c.id)?.debut ?? 0) > c.heure + A_L_HEURE_SEC);
    };
    let f = 1;
    if (trop(1)) {
      let bas: number = R.reductionMin;
      let haut: number = 1;
      for (let i = 0; i < 20; i++) {
        const m = (bas + haut) / 2;
        if (trop(m)) haut = m;
        else bas = m;
      }
      f = bas;
    }
    const ici: ActionReference[] = [];
    t = ordonner(choses, debut, avant, f, ici, couleurs);
    // Ce qui ne tient toujours pas est fini à la dernière image de la scène.
    for (const a of ici) {
      if (a.debut + a.duree > fin) {
        a.debut = Math.min(a.debut, fin);
        a.duree = Math.max(0, fin - a.debut);
      }
    }
    for (const id of Object.keys(couleurs)) couleurs[id] = Math.min(couleurs[id], Math.max(debut, fin - R.couleurSec));
    t = Math.min(t, fin);
    actions.push(...ici);
    if (choses.length) avant = true;
  }
  // Fin de la vidéo : le crayon se pose, presque couché, sous le dernier bloc.
  let pose: PlanPageReference["pose"] = null;
  if (r.pageFinale && page.elements.length) {
    const bas = Math.max(...page.elements.map((e) => (e.encombrement ?? e).px.y + (e.encombrement ?? e).px.hauteur));
    const textes = page.elements.filter((e) => e.type !== "dessin");
    const cx = textes.length ? textes.reduce((s, e) => s + e.px.x + e.px.largeur / 2, 0) / textes.length : page.elements[0].px.x;
    pose = { debut: Math.max(t, Math.min(r.finVoixMs / 1000, t + 0.6)), point: { x: cx - 0.52 * CRAYON_REFERENCE.longueur * k, y: bas + 60 * k } };
  }
  const apparitions: Record<string, number> = {};
  // Les points des étapes apparaissent une fois le titre écrit (jamais sur une page sans titre : 14/10, regard de Will).
  const titre = page.elements.find((e) => e.gabarit?.sorte === "titre");
  const finTitre = titre ? Math.max(-Infinity, ...actions.filter((a) => a.id === titre.elementId).map((a) => a.debut + a.duree)) : -Infinity;
  for (const e of page.elements) {
    const d = e.gabarit?.sorte;
    if (d === "repere" || d === "bandeau" || d === "etiquette" || d === "puce") {
      const heure = (r.heuresPage[e.elementId] ?? r.scenesPage[0]?.debutMs ?? 0) / 1000;
      apparitions[e.elementId] = d === "repere" ? Math.max(heure, finTitre) : heure;
    }
  }
  return { actions, deja, couleurs, pose, k, apparitions };
}

/** Fin (s) d'une partie d'un élément (`Infinity` si elle n'est pas prévue ; 0 si l'élément est déjà là). */
export function finPartie(plan: PlanPageReference, id: string, partie: string): number {
  if (plan.deja[id]) return 0;
  const a = plan.actions.find((x) => x.id === id && x.partie === partie);
  return a ? a.debut + a.duree : Infinity;
}

/** Opacité (0 à 1) d'un élément du gabarit qui apparaît (repère, bandeau, étiquette, puce), en 0,25 s. */
export function apparition(plan: PlanPageReference, id: string, t: number): number {
  const d = plan.apparitions[id];
  if (d === undefined) return 0;
  return lisse(borne((t - d) / 0.25));
}

/* ------------------------------------------------------------------ */
/* État à un instant                                                     */
/* ------------------------------------------------------------------ */

/** Avancement (0 à 1) d'une partie d'un élément ou d'un geste à l'instant `t` (s) ; 1 si déjà là. */
export function avancementReference(plan: PlanPageReference, id: string, partie: string, t: number): number {
  if (plan.deja[id] || (partie.startsWith("ligne:") && plan.deja[`${id}#texte`])) return 1;
  const a = plan.actions.find((x) => x.id === id && x.partie === partie);
  if (!a) return 0;
  if (a.duree <= 0) return t >= a.debut ? 1 : 0;
  return borne((t - a.debut) / a.duree);
}

/** Avancement de la couleur d'un dessin (0 à 1), après son contour. */
export function couleurDessin(plan: PlanPageReference, id: string, t: number): number {
  if (plan.deja[id]) return 1;
  const d = plan.couleurs[id];
  if (d === undefined) return 0;
  return lisse(borne((t - d) / RYTHME_REFERENCE.couleurSec));
}

export interface PoseCrayon {
  pointe: PointRef;
  angle: number;
  /** La mine touche le papier. */
  ecrit: boolean;
}

/** Tremblement naturel du crayon (px de référence × k), fonction de l'heure de la vidéo seulement. */
function tremblement(t: number, amp: number): PointRef {
  return { x: amp * (0.9 * Math.sin(t * 41.3) + 0.5 * Math.sin(t * 97.1 + 1.3)), y: amp * (0.8 * Math.sin(t * 53.7 + 0.4) + 0.4 * Math.sin(t * 83.9 + 2.1)) };
}

/** Taille de l'image (px) : le crayon n'en sort jamais. */
export interface ImageReference {
  largeur: number;
  hauteur: number;
}

/**
 * Inclinaisons essayées, de la plus proche de l'inclinaison du style à la plus éloignée : corps vers le bas, vers la
 * droite, ou relevé vers le haut à droite (au départ d'un entouré, le bloc est sous la pointe).
 */
const ANGLES_ESSAYES = [0, 8, -8, 16, -16, 24, -24, 32, -32, 40, -40, 48, -48, -56, -64, -72, -80, -88, -96];

/** Points du corps du crayon (axe et deux bords), pour savoir ce qu'il couvre. */
function pointsCorps(pointe: PointRef, angle: number, k: number): PointRef[] {
  const poly = silhouetteCrayon(pointe, angle, k);
  const res: PointRef[] = [...poly];
  // Le long des deux bords et de l'axe, de la taille à la gomme.
  const [, a1, b1, b2, a2] = poly;
  for (let i = 0; i <= 8; i++) {
    const u = i / 8;
    res.push({ x: lerp(a1.x, b1.x, u), y: lerp(a1.y, b1.y, u) }, { x: lerp(a2.x, b2.x, u), y: lerp(a2.y, b2.y, u) }, { x: lerp((a1.x + a2.x) / 2, (b1.x + b2.x) / 2, u), y: lerp((a1.y + a2.y) / 2, (b1.y + b2.y) / 2, u) });
  }
  return res;
}

/**
 * Inclinaison du crayon à l'instant `t` : celle du style (corps vers le bas à droite) si le crayon y reste dans l'image
 * et ne couvre aucun texte déjà écrit ; sinon la plus proche qui le permet (de relevé vers le haut à droite à debout
 * vers le bas : jamais vers la gauche, où est ce qui vient d'être écrit).
 */
function angleLibre(plan: PlanPageReference, pointe: PointRef, t: number, image: ImageReference | undefined): number {
  const C = CRAYON_REFERENCE;
  let meilleur: number = C.angle;
  let moindre = Infinity;
  for (const d of ANGLES_ESSAYES) {
    const angle = Math.max(-45, Math.min(90, C.angle + d));
    const fautes = fautesCrayon(plan, pointe, angle, t, image);
    if (fautes === 0) return angle;
    if (fautes < moindre) {
      moindre = fautes;
      meilleur = angle;
    }
  }
  return meilleur;
}

/** Ce que couvre le crayon (texte déjà écrit : 1 par point ; hors de l'image : 10 par point). */
function fautesCrayon(plan: PlanPageReference, pointe: PointRef, angle: number, t: number, image: ImageReference | undefined): number {
  const k = plan.k;
  const marge = 6 * k;
  // Lignes déjà écrites (entièrement ou en partie : la part écrite).
  const ecrits: RectPx[] = [];
  for (const a of plan.actions) {
    if (a.trace !== "ecrire" || t < a.debut) continue;
    const u = a.duree > 0 ? borne((t - a.debut) / a.duree) : 1;
    const r = { x: a.cible.x, y: a.cible.y + a.cible.hauteur * 0.12, largeur: a.cible.largeur * u, hauteur: a.cible.hauteur * 0.76 };
    if (r.largeur > 0) ecrits.push(r);
  }
  const dans = (q: PointRef, r: RectPx) => q.x > r.x && q.x < r.x + r.largeur && q.y > r.y && q.y < r.y + r.hauteur;
  let fautes = 0;
  for (const q of pointsCorps(pointe, angle, k).slice(1)) {
    if (image && (q.x < marge || q.y < marge || q.x > image.largeur - marge || q.y > image.hauteur - marge)) fautes += 10;
    for (const r of ecrits) if (dans(q, r)) fautes++;
  }
  return fautes;
}

/** Où est le crayon à l'instant `t` (s, horloge de la vidéo), et comment il est incliné. */
export function poseCrayonReference(plan: PlanPageReference, t: number, image?: ImageReference): PoseCrayon | null {
  const p = poseBrute(plan, t, image);
  if (!p || p.pose) return p ? { pointe: p.pointe, angle: p.angle, ecrit: p.ecrit } : null;
  const ici = angleLibre(plan, p.pointe, t, image);
  // Inclinaison lissée sur 0,2 s (le crayon tourne doucement) ; si l'angle lissé couvre un texte ou sort de l'image,
  // l'angle libre de l'instant l'emporte.
  const n = 5;
  let somme = ici;
  for (let i = 1; i < n; i++) {
    const ti = t - (i * 0.2) / (n - 1);
    const q = poseBrute(plan, ti, image);
    somme += q && !q.pose ? angleLibre(plan, q.pointe, ti, image) : CRAYON_REFERENCE.angle;
  }
  const lisse = somme / n;
  const angle = fautesCrayon(plan, p.pointe, lisse, t, image) <= fautesCrayon(plan, p.pointe, ici, t, image) ? lisse : ici;
  return { pointe: p.pointe, angle, ecrit: p.ecrit };
}

function poseBrute(plan: PlanPageReference, t: number, image?: ImageReference): (PoseCrayon & { pose: boolean }) | null {
  const C = CRAYON_REFERENCE;
  const R = RYTHME_REFERENCE;
  const k = plan.k;
  const acts = plan.actions;
  if (!acts.length && !plan.pose) return null;
  const debutDe = (a: ActionReference) => pointA(pointsTrace(a, k), 0);
  const finDe = (a: ActionReference) => pointA(pointsTrace(a, k), 1);
  // En attente après un geste ou un dessin : le crayon revient au bout de la dernière ligne écrite (la plus basse de la
  // page qui se remplit), d'où son corps ne couvre que la page encore vide.
  const enAttente = (prec: ActionReference, t0: number): PointRef => {
    const a = finDe(prec);
    if (prec.trace === "ecrire") return a;
    const ligne = [...acts].reverse().find((x) => x.trace === "ecrire" && x.debut + x.duree <= t0);
    if (!ligne) return a;
    const b = finDe(ligne);
    const u = lisse(borne((t0 - (prec.debut + prec.duree)) / R.deplacementSec));
    return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) - Math.sin(Math.PI * u) * 12 * k };
  };
  let pointe: PointRef;
  let angle: number = C.angle;
  let ecrit = false;
  const enCours = acts.find((a) => t >= a.debut && t <= a.debut + a.duree && a.duree > 0);
  const precedente = [...acts].reverse().find((a) => a.debut + a.duree <= t);
  const suivante = acts.find((a) => a.debut > t);
  if (enCours) {
    pointe = pointA(pointsTrace(enCours, k), (t - enCours.debut) / enCours.duree);
    ecrit = enCours.trace !== "pointe";
  } else if (!precedente && suivante) {
    pointe = debutDe(suivante);
  } else if (precedente && suivante) {
    const a = enAttente(precedente, t);
    const b = debutDe(suivante);
    const fin = precedente.debut + precedente.duree;
    const glisse = Math.min(R.deplacementSec, suivante.debut - fin);
    const u = glisse > 0 ? lisse(borne((t - (suivante.debut - glisse)) / glisse)) : 1;
    pointe = { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) - Math.sin(Math.PI * u) * 16 * k };
  } else {
    pointe = precedente ? enAttente(precedente, t) : plan.pose!.point;
  }
  if (plan.pose && t >= plan.pose.debut) {
    const u = lisse(borne((t - plan.pose.debut) / R.poseSec));
    pointe = { x: lerp(pointe.x, plan.pose.point.x, u), y: lerp(pointe.y, plan.pose.point.y, u) };
    angle = lerp(C.angle, C.anglePose, u);
    ecrit = false;
    if (u >= 1) return { pointe, angle, ecrit, pose: true };
    const tr = tremblement(t, C.tremblementRepos * k);
    return { pointe: { x: pointe.x + tr.x, y: pointe.y + tr.y }, angle, ecrit, pose: true };
  }
  const tr = tremblement(t, (ecrit ? C.tremblement : C.tremblementRepos) * k);
  return { pointe: { x: pointe.x + tr.x, y: pointe.y + tr.y }, angle, ecrit, pose: false };
}

/**
 * Silhouette du crayon (polygone, px) pour une pointe et une inclinaison : la pointe taillée puis le corps, jusqu'à la
 * gomme. Sert au contrôle « le crayon ne cache jamais la ligne en cours ».
 */
export function silhouetteCrayon(pointe: PointRef, angle: number, k: number): PointRef[] {
  const C = CRAYON_REFERENCE;
  const L = C.longueur * k;
  const w = (C.epaisseur * k) / 2;
  const taille = L * 0.22;
  const a = (angle * Math.PI) / 180;
  const ax = { x: Math.cos(a), y: Math.sin(a) };
  const n = { x: -Math.sin(a), y: Math.cos(a) };
  const p = (d: number, o: number): PointRef => ({ x: pointe.x + ax.x * d + n.x * o, y: pointe.y + ax.y * d + n.y * o });
  return [p(0, 0), p(taille, -w), p(L, -w), p(L, w), p(taille, w)];
}
