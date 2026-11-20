/**
 * RETOUCHE DU FILM DU TUTORIEL PAR LE CHAT (T-EXT-53c) — aperçu et application pour le tutoriel d'outil. PUR : tout passe par
 * les ports de `service.ts` ; aucun appel payant, aucun rendu, aucune écriture (le plan prêt est rendu au navigateur, qui le
 * renvoie tel quel au bouton de fabrication).
 *
 * // en attendant T-EXT-53a : `ReglagesFilm`, `OperationFilm`, leur lecture stricte et leur application sont ICI en version
 * minimale (mêmes noms de crans que la fiche) ; 53a les remplacera. Les règles de lecture du film (« zoome plus sur
 * l'étape 3 ») arrivent par `deps.lireFilm` (absent : aucune opération du film lue par règles).
 * // en attendant T-EXT-53b : sans lecteur commun, règles seules (aucun appel Claude, `appelNonBranche` dans les ports).
 * // en attendant T-EXT-46b : `operationsDeFabrication` donne l'opération à ajouter à `lancerRetouche` ; `tutoriel-fabriquer.ts` n'existe pas encore.
 * Rien n'écrit jamais un texte : seules des crans (jamais des nombres libres) sont retenus.
 */
import type { OperationRetouche } from "@/briques/operations";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import type { OperationMontage } from "@/moteurs/types";
import { appliquerOperations } from "./appliquer";
import { impactRetouche, type ImpactRetouche } from "./impact";
import { lireOperations } from "./schema";
import { apercevoirRetouche, PHRASE_SANS_PLAN, type PortsRetoucheChat } from "./service";

/* ------------------------------------------------------------------ */
/* Interface minimale « en attendant 53a »                              */
/* ------------------------------------------------------------------ */

const ZOOMS = ["moins", "normal", "plus"] as const;
const TENUES = ["courte", "normale", "longue"] as const;
const RYTHMES = ["plus-lent", "normal", "plus-rapide"] as const;
const VITESSES = ["lente", "normale", "vive"] as const;
const TRAJETS = ["droit", "arc"] as const;
const INTENSITES = ["douce", "normale", "forte"] as const;
const CRANS = ["aucun", "sobre", "equilibre", "dynamique"] as const;

export interface ReglageEtape {
  zoom?: (typeof ZOOMS)[number];
  tenue?: (typeof TENUES)[number];
  rythme?: (typeof RYTHMES)[number];
  curseur?: { vitesse?: (typeof VITESSES)[number]; trajet?: (typeof TRAJETS)[number]; visible?: boolean };
  projecteur?: { actif?: boolean; intensite?: (typeof INTENSITES)[number] };
}
export interface ReglagesFilm {
  parEtape: Record<string, ReglageEtape>;
  global?: { cran?: (typeof CRANS)[number]; volet?: boolean };
}

export type OperationFilm =
  | { type: "ajuster-camera-etape"; etape: number | string; zoom?: ReglageEtape["zoom"]; tenue?: ReglageEtape["tenue"] }
  | { type: "ajuster-rythme-etape"; etape: number | string; rythme: (typeof RYTHMES)[number] }
  | { type: "ajuster-curseur"; etape?: number | string; vitesse?: (typeof VITESSES)[number]; trajet?: (typeof TRAJETS)[number]; visible?: boolean }
  | { type: "ajuster-projecteur"; etape?: number | string; actif?: boolean; intensite?: (typeof INTENSITES)[number] }
  | { type: "changer-cran"; cran: (typeof CRANS)[number] }
  | { type: "changer-volet"; actif: boolean };

export interface EtapeFilm {
  numero: number;
  etapeId: string;
}

const dans = <T extends string>(liste: readonly T[], v: unknown): v is T => typeof v === "string" && (liste as readonly string[]).includes(v);
const objet = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const sansExces = (o: Record<string, unknown>, permis: string[]) => Object.keys(o).every((k) => permis.includes(k));

/** Les étapes du film = les scènes du plan, dans l'ordre (numéro = rang + 1). */
export function etapesDuPlan(plan: PlanValide): EtapeFilm[] {
  return plan.scenes.map((s, i) => ({ numero: i + 1, etapeId: s.id }));
}

/** Réglages du film, lecture stricte : étape inconnue, cran inconnu, champ en trop → `null` (jamais d'exception). */
export function lireReglagesFilm(brut: unknown, etapeIds: readonly string[]): ReglagesFilm | null {
  if (!objet(brut) || !sansExces(brut, ["parEtape", "global"]) || !objet(brut.parEtape)) return null;
  const parEtape: Record<string, ReglageEtape> = {};
  for (const [id, r] of Object.entries(brut.parEtape)) {
    if (!etapeIds.includes(id) || !objet(r) || !sansExces(r, ["zoom", "tenue", "rythme", "curseur", "projecteur"])) return null;
    const e: ReglageEtape = {};
    if (r.zoom !== undefined) { if (!dans(ZOOMS, r.zoom)) return null; e.zoom = r.zoom; }
    if (r.tenue !== undefined) { if (!dans(TENUES, r.tenue)) return null; e.tenue = r.tenue; }
    if (r.rythme !== undefined) { if (!dans(RYTHMES, r.rythme)) return null; e.rythme = r.rythme; }
    if (r.curseur !== undefined) {
      const c = r.curseur;
      if (!objet(c) || !sansExces(c, ["vitesse", "trajet", "visible"])) return null;
      if ((c.vitesse !== undefined && !dans(VITESSES, c.vitesse)) || (c.trajet !== undefined && !dans(TRAJETS, c.trajet)) || (c.visible !== undefined && typeof c.visible !== "boolean")) return null;
      e.curseur = { ...c } as NonNullable<ReglageEtape["curseur"]>;
    }
    if (r.projecteur !== undefined) {
      const p = r.projecteur;
      if (!objet(p) || !sansExces(p, ["actif", "intensite"])) return null;
      if ((p.actif !== undefined && typeof p.actif !== "boolean") || (p.intensite !== undefined && !dans(INTENSITES, p.intensite))) return null;
      e.projecteur = { ...p } as NonNullable<ReglageEtape["projecteur"]>;
    }
    parEtape[id] = e;
  }
  let global: ReglagesFilm["global"];
  if (brut.global !== undefined) {
    const g = brut.global;
    if (!objet(g) || !sansExces(g, ["cran", "volet"])) return null;
    if ((g.cran !== undefined && !dans(CRANS, g.cran)) || (g.volet !== undefined && typeof g.volet !== "boolean")) return null;
    global = { ...g } as NonNullable<ReglagesFilm["global"]>;
  }
  return { parEtape, ...(global ? { global } : {}) };
}

/** Une opération du film, relue (liste fermée) ; `null` si elle n'est pas dans la liste ou porte un champ de trop. */
function lireOperationFilm(brut: unknown): OperationFilm | null {
  if (!objet(brut)) return null;
  const etape = (v: unknown) => typeof v === "number" || typeof v === "string";
  switch (brut.type) {
    case "ajuster-camera-etape":
      return sansExces(brut, ["type", "etape", "zoom", "tenue"]) && etape(brut.etape) && (brut.zoom === undefined || dans(ZOOMS, brut.zoom)) && (brut.tenue === undefined || dans(TENUES, brut.tenue)) && (brut.zoom !== undefined || brut.tenue !== undefined) ? (brut as unknown as OperationFilm) : null;
    case "ajuster-rythme-etape":
      return sansExces(brut, ["type", "etape", "rythme"]) && etape(brut.etape) && dans(RYTHMES, brut.rythme) ? (brut as unknown as OperationFilm) : null;
    case "ajuster-curseur":
      return sansExces(brut, ["type", "etape", "vitesse", "trajet", "visible"]) && (brut.etape === undefined || etape(brut.etape)) && (brut.vitesse === undefined || dans(VITESSES, brut.vitesse)) && (brut.trajet === undefined || dans(TRAJETS, brut.trajet)) && (brut.visible === undefined || typeof brut.visible === "boolean") ? (brut as unknown as OperationFilm) : null;
    case "ajuster-projecteur":
      return sansExces(brut, ["type", "etape", "actif", "intensite"]) && (brut.etape === undefined || etape(brut.etape)) && (brut.actif === undefined || typeof brut.actif === "boolean") && (brut.intensite === undefined || dans(INTENSITES, brut.intensite)) ? (brut as unknown as OperationFilm) : null;
    case "changer-cran":
      return sansExces(brut, ["type", "cran"]) && dans(CRANS, brut.cran) ? (brut as unknown as OperationFilm) : null;
    case "changer-volet":
      return sansExces(brut, ["type", "actif"]) && typeof brut.actif === "boolean" ? (brut as unknown as OperationFilm) : null;
    default:
      return null;
  }
}

export const REMARQUE_FILM_ECARTEE = "Une demande sur le film n'a pas été comprise : dites l'étape (par exemple « étape 3 ») et ce qu'il faut changer.";
export const REMARQUE_ETAPE_INCONNUE = "Cette étape n'existe pas dans la vidéo : dites un numéro d'étape de la vidéo.";

export function lireOperationsFilm(brut: unknown): { operations: OperationFilm[]; remarques: string[] } {
  if (!Array.isArray(brut)) return { operations: [], remarques: [] };
  const operations: OperationFilm[] = [];
  let ecartee = false;
  for (const b of brut.slice(0, 40)) {
    const o = lireOperationFilm(b);
    if (o) operations.push(o);
    else ecartee = true;
  }
  return { operations, remarques: ecartee ? [REMARQUE_FILM_ECARTEE] : [] };
}

function idEtape(etape: number | string, etapes: readonly EtapeFilm[]): string | null {
  if (typeof etape === "number") return etapes.find((e) => e.numero === etape)?.etapeId ?? null;
  return etapes.find((e) => e.etapeId === etape)?.etapeId ?? null;
}

/** Applique des opérations du film sur une COPIE des réglages : sur une même étape, la dernière gagne. */
export function appliquerOperationsFilm(avant: ReglagesFilm | undefined, ops: readonly OperationFilm[], etapes: readonly EtapeFilm[]): { reglages: ReglagesFilm; remarques: string[] } {
  const r: ReglagesFilm = JSON.parse(JSON.stringify(avant ?? { parEtape: {} })) as ReglagesFilm;
  const remarques: string[] = [];
  const cibles = (etape: number | string | undefined): string[] | null => {
    if (etape === undefined) return etapes.map((e) => e.etapeId);
    const id = idEtape(etape, etapes);
    return id ? [id] : null;
  };
  for (const o of ops) {
    if (o.type === "changer-cran") r.global = { ...r.global, cran: o.cran };
    else if (o.type === "changer-volet") r.global = { ...r.global, volet: o.actif };
    else {
      const ids = cibles(o.etape);
      if (!ids) {
        if (!remarques.includes(REMARQUE_ETAPE_INCONNUE)) remarques.push(REMARQUE_ETAPE_INCONNUE);
        continue;
      }
      for (const id of ids) {
        const e = (r.parEtape[id] ??= {});
        if (o.type === "ajuster-camera-etape") {
          if (o.zoom) e.zoom = o.zoom;
          if (o.tenue) e.tenue = o.tenue;
        } else if (o.type === "ajuster-rythme-etape") e.rythme = o.rythme;
        else if (o.type === "ajuster-curseur") e.curseur = { ...e.curseur, ...(o.vitesse ? { vitesse: o.vitesse } : {}), ...(o.trajet ? { trajet: o.trajet } : {}), ...(o.visible !== undefined ? { visible: o.visible } : {}) };
        else e.projecteur = { ...e.projecteur, ...(o.actif !== undefined ? { actif: o.actif } : {}), ...(o.intensite ? { intensite: o.intensite } : {}) };
      }
    }
  }
  return { reglages: r, remarques };
}

/* ------------------------------------------------------------------ */
/* Aperçu, en mots simples                                              */
/* ------------------------------------------------------------------ */

export interface ChangementFilm {
  etape: number;
  avant: string;
  apres: string;
}

const MOT: Record<string, string> = { moins: "plus large", normal: "normal", plus: "plus serré", courte: "courte", normale: "normale", longue: "longue", "plus-lent": "plus lent", "plus-rapide": "plus rapide", lente: "lente", vive: "vive", droit: "en ligne droite", arc: "en arc", douce: "douce", forte: "forte" };
const mot = (v: string | boolean | undefined, defaut: string) => (v === undefined ? defaut : typeof v === "boolean" ? (v ? "oui" : "non") : (MOT[v] ?? v));

/** Ce qui change, étape par étape, en mots simples (« Étape 3 : zoom normal → plus serré »). Ne dit jamais de montant. */
export function changementsFilm(avant: ReglagesFilm | undefined, apres: ReglagesFilm, etapes: readonly EtapeFilm[]): { etape: number; libelle: string; avant: string; apres: string }[] {
  const sortie: { etape: number; libelle: string; avant: string; apres: string }[] = [];
  const champs: { libelle: string; lire: (r: ReglageEtape | undefined) => string | boolean | undefined; defaut: string }[] = [
    { libelle: "zoom", lire: (r) => r?.zoom, defaut: "normal" },
    { libelle: "tenue de la caméra", lire: (r) => r?.tenue, defaut: "normale" },
    { libelle: "rythme", lire: (r) => r?.rythme, defaut: "normal" },
    { libelle: "vitesse du curseur", lire: (r) => r?.curseur?.vitesse, defaut: "normale" },
    { libelle: "trajet du curseur", lire: (r) => r?.curseur?.trajet, defaut: "en arc" },
    { libelle: "curseur visible", lire: (r) => r?.curseur?.visible, defaut: "oui" },
    { libelle: "surbrillance", lire: (r) => r?.projecteur?.actif, defaut: "oui" },
    { libelle: "intensité de la surbrillance", lire: (r) => r?.projecteur?.intensite, defaut: "normale" },
  ];
  for (const e of etapes) {
    for (const c of champs) {
      const a = mot(c.lire(avant?.parEtape[e.etapeId]), c.defaut);
      const b = mot(c.lire(apres.parEtape[e.etapeId]), c.defaut);
      if (a !== b) sortie.push({ etape: e.numero, libelle: c.libelle, avant: a, apres: b });
    }
  }
  for (const [cle, libelle, defaut] of [["cran", "dynamisme du film", "équilibré"], ["volet", "volet « avant → maintenant »", "oui"]] as const) {
    const lire = (g: ReglagesFilm["global"]) => mot(g?.[cle] as string | boolean | undefined, defaut);
    if (lire(avant?.global) !== lire(apres.global)) sortie.push({ etape: 0, libelle, avant: lire(avant?.global), apres: lire(apres.global) });
  }
  return sortie;
}

/** `etape` 0 = toute la vidéo ; sinon « Étape N : <avant> → <après> » (ex. « Étape 3 : zoom normal → plus serré »). */
const enMots = (c: { etape: number; libelle: string; avant: string; apres: string }): ChangementFilm => ({ etape: c.etape, avant: `${c.libelle} ${c.avant}`, apres: c.apres });

/* ------------------------------------------------------------------ */
/* Service                                                              */
/* ------------------------------------------------------------------ */

export interface PortsFilm {
  /** // en attendant T-EXT-53a : règles de lecture du film (`lireParReglesFilm`) ; absent : aucune opération du film lue par règles. */
  lireFilm?: (phrase: string, etapes: readonly EtapeFilm[]) => unknown[];
  /** Réglages du film de la version choisie (projet de montage du tutoriel) ; absent : film réglé comme avant. */
  reglagesAvant?: (videoId: string) => Promise<unknown> | unknown;
}

export interface ApercuRetoucheTutoriel {
  statut: "plan-pret";
  demande: string;
  plan: PlanValide;
  reglagesFilm: ReglagesFilm | null;
  changements: ChangementFilm[];
  operations: OperationRetouche[];
  impact: ImpactRetouche;
  remarques: string[];
}

export const PHRASE_RIEN_FABRIQUE = "Rien n'est fabriqué tant que vous n'avez pas cliqué « Fabriquer cette version ».";

function lireAvant(brut: unknown, etapes: readonly EtapeFilm[]): ReglagesFilm | undefined {
  return brut === undefined || brut === null ? undefined : (lireReglagesFilm(brut, etapes.map((e) => e.etapeId)) ?? undefined);
}

function composer(demande: string, plan: PlanValide, operationsPlan: OperationRetouche[], remarquesPlan: string[], opsFilm: OperationFilm[], remarquesFilm: string[], avant: ReglagesFilm | undefined, objetsPermis?: readonly string[]): ApercuRetoucheTutoriel {
  const etapes = etapesDuPlan(plan);
  const a = appliquerOperations(plan, operationsPlan, objetsPermis?.length ? { objetsPermis } : {});
  const film = appliquerOperationsFilm(avant, opsFilm, etapes);
  const changements = changementsFilm(avant, film.reglages, etapes);
  const impact = impactRetouche(plan, a.plan, a.operations);
  const remarques = [...remarquesPlan, ...remarquesFilm, ...film.remarques];
  return {
    statut: "plan-pret",
    demande,
    plan: a.plan,
    reglagesFilm: changements.length ? film.reglages : null,
    changements: changements.map(enMots),
    operations: a.operations,
    impact,
    remarques,
  };
}

/**
 * Aperçu : comprend la phrase (plan par le service commun, film par les règles du film ou le supplément du lecteur), applique sur
 * des COPIES, dit ce qui change étape par étape. N'écrit rien, ne rend rien, n'appelle jamais Claude hors du port `appeler` fourni.
 */
export async function apercevoirRetoucheTutoriel(videoId: string, demande: string, ports: PortsRetoucheChat, film: PortsFilm = {}): Promise<ApercuRetoucheTutoriel | { statut: "inchangee"; demande: string; operations: []; impact: ImpactRetouche; remarques: string[] }> {
  const courante = await ports.lireVersionChoisie(videoId);
  if (!courante) return { statut: "inchangee", demande, operations: [], impact: { scenes: [], total: 0, voixTouchee: false, phrase: "Aucune scène ne change, la voix ne change pas." }, remarques: [PHRASE_SANS_PLAN] };
  const etapes = etapesDuPlan(courante.plan);
  const ap = await apercevoirRetouche(videoId, demande, ports);
  // Le film : supplément du lecteur commun (53b) s'il existe, sinon règles du film (53a) ; relus dans les deux cas.
  const supplementaires = (ap as { supplementaires?: unknown[] }).supplementaires;
  const brut = supplementaires?.length ? supplementaires : (film.lireFilm?.(demande, etapes) ?? []);
  const lu = lireOperationsFilm(brut);
  const avant = lireAvant(await film.reglagesAvant?.(videoId), etapes);
  const r = composer(demande, courante.plan, ap.operations, ap.remarques, lu.operations, lu.remarques, avant, courante.objetsPermis);
  return r;
}

/** Application : mêmes opérations, relues (elles viennent du navigateur), sans lecteur ni rendu ; le plan prêt est rendu tel quel. */
export async function appliquerRetoucheTutoriel(videoId: string, e: { demande: string; operations: unknown; reglagesFilm?: unknown }, ports: PortsRetoucheChat, film: PortsFilm = {}): Promise<ApercuRetoucheTutoriel | { statut: "inchangee"; impact: null; remarques: string[] }> {
  const courante = await ports.lireVersionChoisie(videoId);
  if (!courante) return { statut: "inchangee", impact: null, remarques: [PHRASE_SANS_PLAN] };
  const etapes = etapesDuPlan(courante.plan);
  const lu = lireOperations(e.operations);
  const f = ports.filtrerOperations?.(lu.operations, e.demande) ?? { operations: lu.operations, remarques: [] };
  const avant = lireAvant(await film.reglagesAvant?.(videoId), etapes);
  const recu = e.reglagesFilm === undefined ? undefined : lireReglagesFilm(e.reglagesFilm, etapes.map((x) => x.etapeId));
  const remarques = [...lu.remarques, ...f.remarques, ...(e.reglagesFilm !== undefined && !recu ? ["Réglages du film illisibles : version d'avant gardée"] : [])];
  const r = composer(e.demande, courante.plan, f.operations, remarques, [], [], avant, courante.objetsPermis);
  // Les réglages reçus (relus) remplacent ceux de l'aperçu : ce sont ceux que Williams a vus.
  const reglagesFilm = recu ?? null;
  const changements = reglagesFilm ? changementsFilm(avant, reglagesFilm, etapes).map(enMots) : [];
  if (!changements.length && !r.impact.scenes.length && !r.impact.voixTouchee) return { statut: "inchangee", impact: null, remarques: [...r.remarques, r.impact.phrase] };
  return { ...r, reglagesFilm, changements };
}

/** // en attendant T-EXT-46b : l'opération à ajouter à celles de `lancerRetouche` (relue par le moteur ; absente si rien à régler). */
export function operationsDeFabrication(reglagesFilm: unknown, etapeIds: readonly string[]): OperationMontage[] {
  const lu = reglagesFilm === undefined || reglagesFilm === null ? null : lireReglagesFilm(reglagesFilm, etapeIds);
  return lu ? [{ type: "reglagesFilm", reglages: lu }] : [];
}
