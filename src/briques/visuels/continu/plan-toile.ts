/** Planificateur de la toile continue (P4b) : PUR et déterministe, sans IA. Choisit le parcours, les plaquettes et les raccords. */
import { premierSansRepetition } from "../../../domaine/controles-visuel/memoire-carrousels";
import type { EmpreinteCarrousel } from "../../../domaine/visuels/contrats";
import type { RaccordToile } from "../../../domaine/visuels/continu/schema-toile";
import { HAUTEURS, PAGES_DEFAUT_MAX, PAGES_MAX, PAGES_MIN, type FormatToile } from "../../../domaine/visuels/continu/geometrie";
import type { Intention } from "../trames";
import { GABARITS_PRODUCTION, type DefinitionGabarit, type FamilleContinu } from "./registre-gabarits";
import { PARCOURS_PRODUCTION, type DefinitionParcours } from "./registre-parcours";
import { RACCORDS, type DefinitionRaccord } from "./registre-raccords";

export type Variete = "sobre" | "equilibre" | "varie";

export interface RegistresPlan {
  gabarits: DefinitionGabarit[];
  parcours: DefinitionParcours[];
  raccords: DefinitionRaccord[];
}

/** Seuls les gabarits de production (actifs, hors essai) sont planifiés. */
export const REGISTRES_PRODUCTION: RegistresPlan = { gabarits: GABARITS_PRODUCTION, parcours: PARCOURS_PRODUCTION, raccords: RACCORDS };

export interface EntreePlan {
  sujet: string;
  /** 1 au premier essai, +1 à chaque « Refaire ». */
  version: number;
  intention?: Intention;
  recents: readonly EmpreinteCarrousel[];
  /** Familles cochées (les pages de parcours sont toujours permises). Absent : toutes. */
  familles?: readonly FamilleContinu[];
  variete: Variete;
  /** Nombre exact de pages voulu (10 au plus). Absent : 3 à 6. */
  pagesCible?: number;
  format: FormatToile;
}

export interface PlanToile {
  parcours: string;
  types: string[];
  raccords: RaccordToile[];
}

export class ErreurPlanToile extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurPlanToile";
  }
}

export const PARCOURS_PAR_INTENTION: Record<Intention, readonly string[]> = {
  eveil: ["PC", "PD", "PB"],
  methode: ["PA", "PG", "PH", "PF"],
  preuve: ["PB", "PE", "PF"],
};

export const FAMILLES_MIN: Record<Variete, number> = { sobre: 2, equilibre: 3, varie: 4 };

const CONTENUS_MAX = 3;
const CAS_MAX = 2;
/** Tirages par parcours, et nombre de plans distincts gardés. */
const TIRAGES = 40;
const CANDIDATS_MAX = 48;

/** Hachage pur FNV-1a 32 bits (recopié de `src/visuels/texte/simulation.ts`). */
export function fnv1a(texte: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

export function normaliserSujet(sujet: string): string {
  return sujet.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/gu, " ").trim();
}

/** Suite pseudo-aléatoire déterministe (mulberry32). */
function alea(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const piocher = <T>(liste: readonly T[], r: () => number): T | undefined => liste[Math.floor(r() * liste.length)];

function melanger<T>(liste: readonly T[], r: () => number): T[] {
  const copie = [...liste];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}

/** Empreinte anti-répétition d'une toile : la suite des types et la couverture (même forme que les carrousels classiques). */
export function empreintePlan(types: readonly string[]): EmpreinteCarrousel {
  return { suite: types.join(" "), couverture: `${types[0] ?? ""}:` };
}

type Intervalle = [number, number];

function intersection(a: readonly Intervalle[], b: readonly Intervalle[], hauteur: number): Intervalle | undefined {
  let meilleur: Intervalle | undefined;
  for (const [a1, a2] of a)
    for (const [b1, b2] of b) {
      const debut = Math.max(a1, b1, 0);
      const fin = Math.min(a2, b2, hauteur);
      if (fin > debut && (!meilleur || fin - debut > meilleur[1] - meilleur[0])) meilleur = [debut, fin];
    }
  return meilleur;
}

interface Contexte {
  parType: Map<string, DefinitionGabarit>;
  couvertures: DefinitionGabarit[];
  contenus: DefinitionGabarit[];
  relances: DefinitionGabarit[];
  appels: DefinitionGabarit[];
  raccords: DefinitionRaccord[];
  entree: EntreePlan;
}

/** Contrôle de variété d'une suite de pages (le parcours compte comme un seul bloc). */
function varieteRespectee(types: string[], ctx: Contexte, sombresParcours: number): boolean {
  const gs = types.map((t) => ctx.parType.get(t)!);
  for (let i = 1; i < gs.length; i++) {
    const [a, b] = [gs[i - 1], gs[i]];
    if (a.famille === "parcours" && b.famille === "parcours") continue;
    // La relance (A02) annonce l'appel : même famille, voisinage voulu.
    if (a.role === "relance" && b.role === "appel") continue;
    if (a.famille === b.famille) return false;
  }
  const sombres = gs.filter((g) => g.sombre && g.famille !== "parcours").length + sombresParcours;
  if (sombres > 1) return false;
  if (gs.filter((g) => g.orangeFort).length > 1) return false;
  if (gs.filter((g) => g.famille === "cas").length > CAS_MAX) return false;
  return new Set(gs.map((g) => g.famille)).size >= FAMILLES_MIN[ctx.entree.variete];
}

function poserRaccords(types: string[], debutParcours: number, parcours: DefinitionParcours, ctx: Contexte, r: () => number): RaccordToile[] | undefined {
  const hauteur = HAUTEURS[ctx.entree.format];
  const raccords: RaccordToile[] = [];
  for (let c = 1; c < types.length; c++) {
    if (c > debutParcours && c < debutParcours + parcours.pagesTypes.length) continue;
    const zone = intersection(ctx.parType.get(types[c - 1])!.bordsLibres.droite, ctx.parType.get(types[c])!.bordsLibres.gauche, hauteur);
    const possibles = zone ? ctx.raccords.filter((x) => x.diametre <= zone[1] - zone[0]) : [];
    const choisi = piocher(possibles, r);
    // Une couture externe sans raccord possible écarte le plan.
    if (!choisi || !zone) return undefined;
    raccords.push({ type: choisi.type, couture: c, y: Math.round((zone[0] + zone[1]) / 2) });
  }
  return raccords;
}

function construire(parcours: DefinitionParcours, ctx: Contexte, r: () => number): PlanToile | undefined {
  const { entree } = ctx;
  const couverture = parcours.commence ? undefined : piocher(ctx.couvertures, r);
  const appel = parcours.termine ? undefined : piocher(ctx.appels, r);
  if ((!parcours.commence && !couverture) || (!parcours.termine && !appel)) return undefined;
  const relance = appel && r() < 0.5 ? piocher(ctx.relances, r) : undefined;
  const fixes = parcours.pagesTypes.length + (couverture ? 1 : 0) + (appel ? 1 : 0) + (relance ? 1 : 0);
  const [min, max] = entree.pagesCible ? [entree.pagesCible, entree.pagesCible] : [PAGES_MIN, PAGES_DEFAUT_MAX];
  const nMin = Math.max(0, min - fixes);
  const nMax = Math.min(CONTENUS_MAX, max - fixes, ctx.contenus.length);
  if (nMax < nMin) return undefined;
  // Un parcours qui ferme la toile ne laisse rien après lui : les contenus passent devant.
  if (parcours.commence && parcours.termine && nMin > 0) return undefined;
  const contenus = melanger(ctx.contenus, r).slice(0, nMin + Math.floor(r() * (nMax - nMin + 1)));
  const types = parcours.termine
    ? [...(couverture ? [couverture.type] : []), ...contenus.map((g) => g.type), ...parcours.pagesTypes]
    : [...(couverture ? [couverture.type] : []), ...parcours.pagesTypes, ...contenus.map((g) => g.type), ...(relance ? [relance.type] : []), ...(appel ? [appel.type] : [])];
  if (parcours.commence && parcours.termine && types.length !== parcours.pagesTypes.length) return undefined;
  if (!varieteRespectee(types, ctx, parcours.sombres.length)) return undefined;
  const debut = types.indexOf(parcours.pagesTypes[0]);
  const raccords = poserRaccords(types, debut, parcours, ctx, r);
  if (!raccords) return undefined;
  return { parcours: parcours.id, types, raccords };
}

/** Phrase qui explique pourquoi aucun plan n'existe avec ces réglages. */
function phraseImpossible(entree: EntreePlan, parcours: DefinitionParcours[], ctx: Contexte): string {
  if (parcours.length === 0) return "Aucun parcours de production n'est disponible : le registre des parcours est vide.";
  const coches = entree.familles ? ` (${entree.familles.join(", ")})` : "";
  if (ctx.couvertures.length === 0 && !parcours.some((p) => p.commence)) return `Les familles cochées${coches} n'ont aucune couverture et aucun parcours n'ouvre la toile : cochez la famille « couverture ».`;
  if (ctx.appels.length === 0 && !parcours.some((p) => p.termine)) return `Les familles cochées${coches} n'ont aucun appel et aucun parcours ne ferme la toile : cochez la famille « appel ».`;
  return `Aucun plan ne respecte les familles cochées${coches} avec la variété « ${entree.variete} » (${FAMILLES_MIN[entree.variete]} familles au moins)${entree.pagesCible ? ` en ${entree.pagesCible} pages` : ""} : cochez une famille de plus ou choisissez une variété plus sobre.`;
}

/**
 * Plan de la toile : [couverture si le parcours ne commence pas] + parcours + 0 à 3 contenus + [A02 facultatif] + [appel si le
 * parcours ne termine pas] ; un parcours qui termine passe en dernier, les contenus avant lui. Les plans possibles sont tirés
 * d'une graine fnv1a(sujet normalisé | intention), dans un ordre fixe ; la version avance d'un plan à chaque cran, puis
 * `premierSansRepetition` écarte les suites et couvertures des récents.
 */
export function choisirPlan(entree: EntreePlan, registres: RegistresPlan = REGISTRES_PRODUCTION): PlanToile {
  if (!Number.isInteger(entree.version) || entree.version < 1) {
    throw new ErreurPlanToile("La version du plan doit être un entier d'au moins 1 : 1 au premier essai, puis +1 à chaque « Refaire ».");
  }
  if (entree.pagesCible !== undefined && (entree.pagesCible < PAGES_MIN || entree.pagesCible > PAGES_MAX || !Number.isInteger(entree.pagesCible))) {
    throw new ErreurPlanToile(`Le nombre de pages demandé doit être un entier, de ${PAGES_MIN} à ${PAGES_MAX} pages : une toile en compte ${PAGES_MAX} au plus.`);
  }
  const production = registres.gabarits.filter((g) => g.actif && !g.essai);
  const parType = new Map(production.map((g) => [g.type, g]));
  const permise = (g: DefinitionGabarit) => g.famille !== "parcours" && (!entree.familles || entree.familles.includes(g.famille));
  const deRole = (role: DefinitionGabarit["role"]) => production.filter((g) => g.role === role && permise(g));
  const ctx: Contexte = { parType, couvertures: deRole("couverture"), contenus: deRole("contenu"), relances: deRole("relance"), appels: deRole("appel"), raccords: registres.raccords, entree };

  const disponibles = registres.parcours.filter((p) => !p.essai && p.pagesTypes.every((t) => parType.get(t)?.famille === "parcours"));
  const graine = fnv1a(`${normaliserSujet(entree.sujet)}|${entree.intention ?? ""}`);
  const tirer = (liste: DefinitionParcours[]) => {
    const plans: PlanToile[] = [];
    const vus = new Set<string>();
    for (let k = 0; k < TIRAGES && plans.length < CANDIDATS_MAX; k++)
      for (const p of liste) {
        const plan = construire(p, ctx, alea(fnv1a(`${graine}|${p.id}|${k}`)));
        const cle = plan && plan.types.join(" ");
        if (plan && cle && !vus.has(cle)) {
          vus.add(cle);
          plans.push(plan);
        }
      }
    return plans;
  };

  const preferes = entree.intention ? disponibles.filter((p) => PARCOURS_PAR_INTENTION[entree.intention!].includes(p.id)) : [];
  let candidats = preferes.length ? tirer(preferes) : [];
  if (candidats.length === 0) candidats = tirer(disponibles);
  if (candidats.length === 0) throw new ErreurPlanToile(phraseImpossible(entree, disponibles, ctx));

  if (candidats.length === 1 && entree.version > 1) {
    throw new ErreurPlanToile("Un seul plan possible avec ces réglages : cochez une famille de plus ou changez la variété pour en voir un autre.");
  }
  const depart = (graine + Math.max(0, entree.version - 1)) % candidats.length;
  const empreinte = (p: PlanToile) => empreintePlan(p.types);
  const choisi = premierSansRepetition(candidats, depart, empreinte, entree.recents);
  // Si toutes les couvertures ont servi récemment, on écarte au moins la même suite.
  if (!entree.recents.some((e) => e.suite === empreinte(choisi).suite)) return choisi;
  return premierSansRepetition(candidats, depart, empreinte, entree.recents.map((e) => ({ suite: e.suite, couverture: "" })));
}
