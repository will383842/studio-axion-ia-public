/**
 * Dépôts EN MÉMOIRE (V1). Singleton accroché à globalThis : il survit aux
 * rechargements à chaud et est partagé par toutes les requêtes d'un même processus.
 * Les données de démonstration sont chargées à la première utilisation.
 *
 * ⚠️ Importé UNIQUEMENT par src/services. Jamais par un écran.
 */
import "server-only";
import type { Depot, Depots, LotEcritures } from "@/domaine/depots";
import type { Id } from "@/domaine/types";
import { creerDonneesDemo } from "./demo";
import { appliquerLotPostgres, bailPostgres, creerDepotsPostgres, numeroSuiviPostgres, prendreVerrouBouclePostgres, sonderBasePostgres, verrouCreditsPostgres } from "../postgres";
import { refusDemarrageSansBase } from "@/lib/demarrage";

function copie<T>(x: T): T {
  return structuredClone(x);
}

export class DepotMemoire<T extends { id: Id }> implements Depot<T> {
  private readonly table = new Map<Id, T>();

  constructor(initiales: T[] = []) {
    for (const e of initiales) this.table.set(e.id, copie(e));
  }

  async lister(filtre?: (e: T) => boolean, projeter?: (e: T) => T): Promise<T[]> {
    const tout = Array.from(this.table.values());
    const gardes = filtre ? tout.filter(filtre) : tout;
    return copie(projeter ? gardes.map(projeter) : gardes);
  }

  async obtenir(id: Id): Promise<T | null> {
    const e = this.table.get(id);
    return e ? copie(e) : null;
  }

  async trouver(filtre: (e: T) => boolean): Promise<T | null> {
    for (const e of this.table.values()) if (filtre(e)) return copie(e);
    return null;
  }

  async enregistrer(entite: T): Promise<T> {
    this.table.set(entite.id, copie(entite));
    return copie(entite);
  }

  async modifier(id: Id, patch: Partial<T>): Promise<T> {
    const actuelle = this.table.get(id);
    if (!actuelle) throw new Error(`Introuvable : ${id}`);
    const suivante = { ...actuelle, ...copie(patch) } as T;
    if ("modifieLe" in suivante) (suivante as { modifieLe: string }).modifieLe = new Date().toISOString();
    this.table.set(id, suivante);
    return copie(suivante);
  }

  async supprimer(id: Id): Promise<boolean> {
    return this.table.delete(id);
  }

  async compter(filtre?: (e: T) => boolean): Promise<number> {
    if (!filtre) return this.table.size;
    let n = 0;
    for (const e of this.table.values()) if (filtre(e)) n++;
    return n;
  }
}

function creerDepots(): Depots {
  const d = creerDonneesDemo();
  return {
    marques: new DepotMemoire(d.marques),
    fichiers: new DepotMemoire(d.fichiers),
    personnages: new DepotMemoire(d.personnages),
    visages: new DepotMemoire(d.visages),
    voix: new DepotMemoire(d.voix),
    prononciations: new DepotMemoire(d.prononciations),
    elements: new DepotMemoire(d.elements),
    scripts: new DepotMemoire(d.scripts),
    videos: new DepotMemoire(d.videos),
    versions: new DepotMemoire(d.versions),
    plans: new DepotMemoire(d.plans),
    pistes: new DepotMemoire(d.pistes),
    retouches: new DepotMemoire(d.retouches),
    miniatures: new DepotMemoire(d.miniatures),
    sousTitres: new DepotMemoire(d.sousTitres),
    sorties: new DepotMemoire(d.sorties),
    kits: new DepotMemoire(d.kits),
    publications: new DepotMemoire(d.publications),
    partages: new DepotMemoire(d.partages),
    modeles: new DepotMemoire(d.modeles),
    idees: new DepotMemoire(d.idees),
    ideesJugees: new DepotMemoire([]),
    series: new DepotMemoire(d.series),
    rushs: new DepotMemoire(d.rushs),
    travaux: new DepotMemoire(d.travaux),
    depenses: new DepotMemoire(d.depenses),
    ressourcesFournisseurs: new DepotMemoire(d.ressourcesFournisseurs),
    evenementsFournisseurs: new DepotMemoire([]),
    notifications: new DepotMemoire(d.notifications),
    sessions: new DepotMemoire([]),
    tentatives: new DepotMemoire([]),
    parametres: new DepotMemoire(d.parametres),
    evenements: new DepotMemoire(d.evenements),
    veilleOutils: new DepotMemoire([]),
    veilleNouveautes: new DepotMemoire([]),
    pagesSite: new DepotMemoire([]),
    recharges: new DepotMemoire([]),
    reservations: new DepotMemoire([]),
    relevesSoldes: new DepotMemoire([]),
    // Générateur de scripts (lot G1a) : aucune donnée de démonstration (seul Will ajoute ses matières).
    scriptsMaitres: new DepotMemoire(d.scriptsMaitres ?? []),
    variantes: new DepotMemoire(d.variantes ?? []),
    preuves: new DepotMemoire(d.preuves ?? []),
    matieres: new DepotMemoire(d.matieres ?? []),
    exemplesStyle: new DepotMemoire([]),
    fichesStyle: new DepotMemoire([]),
    tournesInterdites: new DepotMemoire([]),
    generations: new DepotMemoire([]),
    bilansApprentissage: new DepotMemoire([]),
    contexteAxion: new DepotMemoire([]),
    reglesDatees: new DepotMemoire([]),
    sessionsTournage: new DepotMemoire([]),
    tracesTableau: new DepotMemoire([]),
    tracesScriptsTableau: new DepotMemoire([]),
    correctionsWill: new DepotMemoire([]),
    visuels: new DepotMemoire([]),
  };
}

const cle = Symbol.for("studio-axion-ia.depots");
type AvecDepots = typeof globalThis & { [cle]?: Depots };

/**
 * Accès unique aux dépôts. Avec DATABASE_URL (mise en ligne) : dépôts persistants Postgres, même
 * contrat. Sans (développement local, tests) : dépôts en mémoire avec les données de démonstration.
 */
export function depots(): Depots {
  const g = globalThis as AvecDepots;
  if (!g[cle]) {
    const url = process.env.DATABASE_URL;
    // E2E-2 données n° 7 : en production sans base, on ne bascule plus en silence sur la démonstration en mémoire.
    const refus = refusDemarrageSansBase(process.env);
    if (refus) throw new Error(refus);
    g[cle] = url && !process.env.VITEST ? creerDepotsPostgres(url) : creerDepots();
  }
  return g[cle];
}

/**
 * Sonde de la base pour `/api/sante` : « memoire » sans base (développement, tests), « ok » si Postgres répond
 * maintenant ; rejette sinon.
 */
export async function sonderBase(): Promise<"memoire" | "ok"> {
  const sonde = sonderBasePostgres(depots());
  if (!sonde) return "memoire";
  await sonde;
  return "ok";
}

/**
 * Verrou de la boucle de fond (audit D, un seul réplica) : true si CETTE instance peut faire tourner la boucle.
 * Sans base (développement, tests) : toujours true (un seul processus). Rejette si la base ne répond pas.
 */
export async function prendreVerrouBoucle(surPerte: () => void): Promise<boolean> {
  return (await prendreVerrouBouclePostgres(depots(), surPerte)) ?? true;
}

/**
 * L3-01 : verrou des crédits PARTAGÉ entre processus. Avec la base : verrou consultatif Postgres, et les collections de
 * l'argent relues dans la base avant `f` (un autre processus a pu réserver ou engager). Sans base (développement,
 * tests) : `f` directement (un seul processus ; la file en mémoire de `credits.ts` suffit).
 */
export function sousVerrouCreditsPartage<T>(f: () => Promise<T>): Promise<T> {
  const pg = verrouCreditsPostgres(depots());
  return pg ? pg(f) : f();
}

const cleBaux = Symbol.for("studio-axion-ia.baux");
type AvecBaux = typeof globalThis & { [cleBaux]?: Map<string, { titulaire: string; expireLe: number }> };

/**
 * Bail exclusif à durée limitée (verrou partagé entre machines) : true si `titulaire` le tient maintenant (pris, ou
 * prolongé de `dureeMs`). Avec la base : dans Postgres, atomique. Sans (développement, tests) : en mémoire, un seul
 * processus. Rejette si la base ne répond pas.
 */
export async function prendreBail(cle: string, titulaire: string, dureeMs: number): Promise<boolean> {
  const pg = bailPostgres(depots());
  if (pg) return pg.prendre(cle, titulaire, dureeMs);
  const g = globalThis as AvecBaux;
  const baux = (g[cleBaux] ??= new Map());
  const b = baux.get(cle);
  const maintenant = Date.now();
  if (b && b.titulaire !== titulaire && b.expireLe > maintenant) return false;
  baux.set(cle, { titulaire, expireLe: maintenant + dureeMs });
  return true;
}

/** Rend le bail s'il est encore à ce titulaire. */
export async function rendreBail(cle: string, titulaire: string): Promise<void> {
  const pg = bailPostgres(depots());
  if (pg) return pg.rendre(cle, titulaire);
  const baux = (globalThis as AvecBaux)[cleBaux];
  if (baux?.get(cle)?.titulaire === titulaire) baux.delete(cle);
}

const cleCompteurs = Symbol.for("studio-axion-ia.compteurs");
type AvecCompteurs = typeof globalThis & { [cleCompteurs]?: Map<string, number> };

/**
 * Numéro suivant d'un compteur (lien suivi) dans [min, max] : jamais redescendant, et au-dessus du plus haut
 * `numeroSuivi` / `numero` des versions de la plage. Avec la base : UNE requête atomique, partagée entre machines.
 * Sans (développement, tests) : en mémoire, sans `await` entre la lecture et l'écriture du compteur.
 */
export async function prochainNumeroSuivi(cle: string, min: number, max: number): Promise<number> {
  const pg = numeroSuiviPostgres(depots());
  if (pg) return pg.suivant(cle, min, max);
  const versions = await depots().versions.lister();
  const amorce = versions.reduce((m, v) => {
    const n = Math.max(v.numeroSuivi ?? 0, v.numero);
    return n >= min && n <= max ? Math.max(m, n) : m;
  }, min - 1);
  const g = globalThis as AvecCompteurs;
  const compteurs = (g[cleCompteurs] ??= new Map());
  const suivant = Math.max((compteurs.get(cle) ?? min - 1) + 1, amorce + 1);
  compteurs.set(cle, suivant);
  return suivant;
}

/**
 * Applique un lot d'écritures d'un bloc : avec la base, en UNE transaction (tout ou rien) ; sans (développement,
 * tests), dans l'ordre, en mémoire (un seul processus, rien ne peut échouer à moitié).
 */
export async function appliquerLot(lot: LotEcritures): Promise<void> {
  const d = depots();
  const pg = appliquerLotPostgres(d, lot);
  if (pg) return pg;
  for (const s of lot.supprimer) await (d[s.collection] as Depot<{ id: Id }>).supprimer(s.id);
  for (const e of lot.enregistrer) await (d[e.collection] as Depot<{ id: Id }>).enregistrer(e.entite);
}

/** Le bail est-il tenu en ce moment (pris et pas encore expiré) ? Lecture seule. */
export async function bailTenu(cle: string): Promise<boolean> {
  const pg = bailPostgres(depots());
  if (pg) return pg.tenu(cle);
  const b = (globalThis as AvecBaux)[cleBaux]?.get(cle);
  return !!b && b.expireLe > Date.now();
}

/** Efface un bail EXPIRÉ (ou rendu) ; un bail encore tenu est laissé (il expirera seul). */
export async function oublierBailExpire(cle: string): Promise<void> {
  const pg = bailPostgres(depots());
  if (pg) return pg.oublierExpire(cle);
  const baux = (globalThis as AvecBaux)[cleBaux];
  const b = baux?.get(cle);
  if (b && b.expireLe <= Date.now()) baux!.delete(cle);
}

/** Pour les tests : repart des données de démonstration. */
export function reinitialiserDepots(): Depots {
  const g = globalThis as AvecDepots;
  g[cle] = creerDepots();
  (globalThis as AvecCompteurs)[cleCompteurs]?.clear();
  return g[cle];
}
