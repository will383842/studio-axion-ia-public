/**
 * RÉSERVE DE TUTORIELS · modèle pur (plan PLAN-RESERVE-TUTORIELS-21-11, § 3 et § 4.1).
 * Aucun import de service, aucun `server-only` : types, constantes et règles sans effet de bord.
 */

export const PREFIXE_RESERVE = "tutoriel.reserve.";
export const PARAM_RESERVE_REGLAGES = "tutoriel.reserve.reglages";
export const PARAM_RESERVE_INDEX = "tutoriel.reserve.index";
export const PARAM_RESERVE_HISTORIQUE = "tutoriel.reserve.historique";
export const cleElementReserve = (id: string): string => `tutoriel.reserve.element.${id}`;
export const cleTirageReserve = (cle: string): string => `tutoriel.reserve.tirage.${cle}`;
export const CLE_BAIL_TIRAGE = "tutoriel.reserve.tirage";

export const TENTATIVES_MAX = 2;
export const MAX_EN_COURS = 1;
export const PAR_SEMAINE_MAX = 7;
export const PLAFOND_VIDEO_DEFAUT_CENTIMES = 125; // 1,25 €
export const PLAFOND_VIDEO_MAX_CENTIMES = 1000; // borne de saisie
export const HISTORIQUE_MAX = 50;
export const DELAI_PRIS_SANS_VIDEO_MS = 15 * 60_000;
export const CLE_TIRAGE_VALIDE = /^[A-Za-z0-9._:-]{8,100}$/;
export const ID_ELEMENT_VALIDE = /^(res-[A-Za-z0-9_-]{6,40}|demo-0[1-7]-[a-z0-9-]{2,30})$/;

export type EtatElementReserve = "en_reserve" | "pris" | "fait" | "a_revoir" | "retire";
export type DeclencheurTirage = "rythme" | "usine" | "essai";
export type FinReserve = "aucune" | "prendre-rendez-vous";

export type SourceElementReserve =
  | { type: "dossier"; fichierId: string; nomFichier: string; attestationImages: boolean }
  | { type: "idee"; phrase: string }
  | { type: "maquette-demo"; dossier: string; fichierId?: string }; // dossier : "01-courriels" … "07-taches"

export interface PassageEtat {
  le: string;
  de: EtatElementReserve | null;
  vers: EtatElementReserve;
  motif?: string;
}

export interface PriseReserve {
  cle: string;
  declencheur: DeclencheurTirage;
  le: string;
  videoId?: string;
}

export interface ElementReserve {
  id: string;
  titre: string; // 80 caractères au plus
  source: SourceElementReserve;
  script?: string; // collé, 8000 au plus, fait foi
  fin: FinReserve;
  etat: EtatElementReserve;
  ajouteLe: string; // ISO UTC
  ajoutePar: "fondateur" | "amorcage";
  tentatives: number; // échecs depuis la dernière remise en réserve
  prise?: PriseReserve;
  motif?: string; // dernière phrase lisible, JAMAIS un montant
  passages: PassageEtat[]; // 20 derniers
  version: 1;
}

export interface ReglagesReserve {
  actif: boolean;
  parSemaine: number;
  voix: boolean;
  plafondVideoCentimes: number;
  version: 1;
}
export const REGLAGES_RESERVE_DEFAUT: ReglagesReserve = {
  actif: false,
  parSemaine: 1,
  voix: false,
  plafondVideoCentimes: PLAFOND_VIDEO_DEFAUT_CENTIMES,
  version: 1,
};

export interface TirageReserve {
  cle: string;
  declencheur: DeclencheurTirage;
  le: string;
  elementId: string;
  videoId?: string;
}
export interface LigneHistorique {
  le: string;
  declencheur: DeclencheurTirage;
  elementId: string;
}

export type RaisonAttente =
  | "formulaire_ferme"
  | "entree_fermee"
  | "equipe_eteinte"
  | "deja_en_cours"
  | "voix_sans_devis"
  | "plafond_video"
  | "plafond_mois"
  | "autonomie_usine"
  | "bail_occupe";

export type IssueTirage =
  | { etat: "pris"; deja: boolean; elementId: string; videoId?: string; titre: string }
  | { etat: "reserve_vide" }
  | { etat: "eteint" }
  | { etat: "attente"; raison: RaisonAttente; phrase: string }
  | { etat: "echec"; elementId: string; phrase: string; retourEnReserve: boolean };

const PASSAGES_MAX = 20;

// ─── Réglages ────────────────────────────────────────────────────────────────────────────────────────────────────────

const entierDans = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/** Contrôle d'une saisie ; `null` = valide. */
export function controlerReglagesReserve(r: unknown): { champ: keyof ReglagesReserve; message: string } | null {
  if (typeof r !== "object" || r === null || Array.isArray(r)) return { champ: "actif", message: "Les réglages de la réserve sont illisibles." };
  const o = r as Record<string, unknown>;
  if (typeof o.actif !== "boolean") return { champ: "actif", message: "L'interrupteur de la réserve doit être allumé ou éteint." };
  if (!entierDans(o.parSemaine, 0, PAR_SEMAINE_MAX)) return { champ: "parSemaine", message: `Le rythme est un nombre entier de 0 à ${PAR_SEMAINE_MAX} par semaine.` };
  if (typeof o.voix !== "boolean") return { champ: "voix", message: "La voix doit être allumée ou éteinte." };
  if (!entierDans(o.plafondVideoCentimes, 1, PLAFOND_VIDEO_MAX_CENTIMES))
    return { champ: "plafondVideoCentimes", message: `Le plafond par vidéo est un nombre entier de centimes, de 1 à ${PLAFOND_VIDEO_MAX_CENTIMES}.` };
  if (o.version !== 1) return { champ: "version", message: "La version des réglages n'est pas reconnue." };
  return null;
}

/** Échec fermé : toute forme imprévue → défaut éteint ; seul `actif === true` allume. */
export function lireReglagesReserveBrut(brut: unknown): ReglagesReserve {
  if (controlerReglagesReserve(brut) !== null) return { ...REGLAGES_RESERVE_DEFAUT };
  const o = brut as ReglagesReserve;
  return { actif: o.actif === true, parSemaine: o.parSemaine, voix: o.voix === true, plafondVideoCentimes: o.plafondVideoCentimes, version: 1 };
}

// ─── États ───────────────────────────────────────────────────────────────────────────────────────────────────────────

const PERMIS: Record<EtatElementReserve, readonly EtatElementReserve[]> = {
  en_reserve: ["pris", "retire"],
  pris: ["fait", "en_reserve", "a_revoir"],
  fait: [],
  a_revoir: ["en_reserve", "retire"],
  retire: ["en_reserve"],
};

/** Transitions permises (§ 3.1) ; `null` = interdite. Ajoute un passage (20 max). `tentatives` remis à 0 vers en_reserve depuis a_revoir|retire. */
export function transition(e: ElementReserve, vers: EtatElementReserve, le: string, motif?: string): ElementReserve | null {
  if (!PERMIS[e.etat].includes(vers)) return null;
  const passage: PassageEtat = { le, de: e.etat, vers, ...(motif !== undefined ? { motif } : {}) };
  const remise = vers === "en_reserve" && (e.etat === "a_revoir" || e.etat === "retire");
  return {
    ...e,
    etat: vers,
    tentatives: remise ? 0 : e.tentatives,
    ...(motif !== undefined ? { motif } : {}),
    passages: [...e.passages, passage].slice(-PASSAGES_MAX),
  };
}

/** Premier élément `en_reserve` dans l'ordre de l'index ; ignore les identifiants sans élément. */
export function suivantFifo(index: readonly string[], elements: ReadonlyMap<string, ElementReserve>): ElementReserve | null {
  for (const id of index) {
    const e = elements.get(id);
    if (e && e.etat === "en_reserve") return e;
  }
  return null;
}

// ─── Rythme (semaine de Paris) ───────────────────────────────────────────────────────────────────────────────────────

const FORMAT_PARIS = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" });
const JOURS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Date civile de Paris (AAAA-MM-JJ) et rang du jour (0 = lundi) d'un instant. */
function dateParis(iso: string): { jour: string; rang: number } {
  const p = Object.fromEntries(FORMAT_PARIS.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { jour: `${p.year}-${p.month}-${p.day}`, rang: JOURS.indexOf(String(p.weekday)) };
}

/** Lundi (AAAA-MM-JJ, calendrier de Paris) de la semaine de `iso`. */
function lundiParis(iso: string): string {
  const { jour, rang } = dateParis(iso);
  const d = new Date(`${jour}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - rang);
  return d.toISOString().slice(0, 10);
}

const tiragesRythmeDeLaSemaine = (h: readonly LigneHistorique[], maintenantIso: string): number => {
  const lundi = lundiParis(maintenantIso);
  return h.filter((l) => l.declencheur === "rythme" && dateParis(l.le).jour >= lundi).length;
};

/** Tirage « rythme » dû ? (§ 3.2) — semaine de Paris depuis lundi, espacement 7 j / parSemaine ; parSemaine 0 ou actif faux → false. */
export function tirageDu(r: ReglagesReserve, historique: readonly LigneHistorique[], maintenantIso: string): boolean {
  if (r.actif !== true || !entierDans(r.parSemaine, 1, PAR_SEMAINE_MAX)) return false;
  if (tiragesRythmeDeLaSemaine(historique, maintenantIso) >= r.parSemaine) return false;
  const dernier = historique.reduce((m, l) => Math.max(m, Date.parse(l.le) || 0), 0);
  if (dernier === 0) return true;
  return Date.parse(maintenantIso) - dernier >= (7 * 24 * 3_600_000) / r.parSemaine;
}

/** Clé d'idempotence d'un tirage au rythme : `rythme-<lundi AAAA-MM-JJ>-<n>` (n = tirages rythme de la semaine + 1). */
export function cleTirageRythme(historique: readonly LigneHistorique[], maintenantIso: string): string {
  return `rythme-${lundiParis(maintenantIso)}-${tiragesRythmeDeLaSemaine(historique, maintenantIso) + 1}`;
}
