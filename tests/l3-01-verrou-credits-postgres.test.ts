/**
 * L3-01 — verrou des crédits PARTAGÉ entre processus (verrou consultatif Postgres), et non plus une file en mémoire.
 * Doubles de test seulement : un FAUX `pg` (une base partagée en mémoire, avec `pg_advisory_lock` / `pg_advisory_unlock`
 * par connexion), deux `creerDepotsPostgres` = deux processus du studio (chacun sa copie en mémoire). Aucune vraie base,
 * aucune clé, aucun réseau, 0 €.
 *  1. deux processus réservent en même temps sur le même disponible : un seul passe (verrou en base ET copie relue) ;
 *  2. la chaîne des crédits (`verifierEtReserver`) prend le verrou en base : la réservation de l'autre processus, posée
 *     pendant l'attente, est vue et la seconde dépense est refusée (BUDGET_DEPASSE), rien n'est réservé ni engagé ;
 *  3. une écriture de CE processus en vol pendant la relecture n'est jamais écrasée par la copie de la base.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "./helpers/next-mocks";
import type { Depots } from "@/domaine/depots";
import type { LigneCout, ReservationCredit } from "@/domaine/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

/* --- Faux `pg` : une base partagée par tous les clients du fichier ------------------------------------------------- */

const fauxPg = vi.hoisted(() => {
  type Ligne = { collection: string; id: string; data: unknown };
  const base = {
    lignes: new Map<string, Ligne>(),
    verrous: new Map<number, number>(),
    attentes: [] as (() => void)[],
    connexions: 0,
    /** Délai d'écriture (une écriture lente reste « en vol » le temps de la relecture d'un autre). */
    retardEcriture: new Map<string, Promise<void>>(),
    /** Réponse de la relecture retenue APRÈS sa photo de la base (la photo est prise au début, comme dans Postgres). */
    retardRelecture: null as Promise<void> | null,
  };
  const cle = (c: string, id: string) => `${c}\u0000${id}`;
  const tour = () => new Promise<void>((r) => setImmediate(r));
  const copie = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

  async function requete(connexion: number, sql: string, params: unknown[] = []): Promise<{ rows: unknown[] }> {
    await tour();
    const s = sql.replace(/\s+/g, " ").trim();
    if (/^CREATE TABLE/i.test(s) || /^(BEGIN|COMMIT|ROLLBACK)$/i.test(s) || s === "SELECT 1") return { rows: [] };
    if (/pg_advisory_lock\(\$1\)/.test(s)) {
      const k = Number(params[0]);
      while (base.verrous.has(k) && base.verrous.get(k) !== connexion) await new Promise<void>((r) => base.attentes.push(r));
      base.verrous.set(k, connexion);
      return { rows: [{}] };
    }
    if (/pg_advisory_unlock\(\$1\)/.test(s)) {
      const k = Number(params[0]);
      const tenu = base.verrous.get(k) === connexion;
      if (tenu) base.verrous.delete(k);
      for (const r of base.attentes.splice(0)) r();
      return { rows: [{ pg_advisory_unlock: tenu }] };
    }
    if (/^SELECT pg_try_advisory_lock/.test(s)) return { rows: [{ pris: true }] };
    if (/^SELECT collection, id, data FROM documents WHERE collection = ANY\(\$1\)/.test(s)) {
      const voulues = new Set(params[0] as string[]);
      const photo = [...base.lignes.values()].filter((l) => voulues.has(l.collection)).map(copie);
      await base.retardRelecture;
      return { rows: photo };
    }
    if (/^SELECT collection, id, data FROM documents$/.test(s)) return { rows: [...base.lignes.values()].map(copie) };
    if (/^INSERT INTO documents/.test(s)) {
      const [collection, id, json] = params as [string, string, string];
      const k = cle(collection, id);
      await base.retardEcriture.get(id);
      if (/DO NOTHING/.test(s) && base.lignes.has(k)) return { rows: [] };
      base.lignes.set(k, { collection, id, data: JSON.parse(json) });
      return { rows: [] };
    }
    if (/^DELETE FROM documents/.test(s)) {
      base.lignes.delete(cle(String(params[0]), String(params[1])));
      return { rows: [] };
    }
    throw new Error(`faux pg : requête inconnue : ${s.slice(0, 80)}`);
  }

  class Client {
    readonly n = ++base.connexions;
    async connect() {}
    query(sql: string, params?: unknown[]) {
      return requete(this.n, sql, params);
    }
    on() {
      return this;
    }
    async end() {
      for (const [k, v] of base.verrous) if (v === this.n) base.verrous.delete(k);
      for (const r of base.attentes.splice(0)) r();
    }
    release(detruire?: boolean) {
      if (detruire) void this.end();
    }
  }
  class Pool {
    on() {
      return this;
    }
    query(sql: string, params?: unknown[]) {
      return requete(0, sql, params);
    }
    async connect() {
      return new Client();
    }
  }
  return { base, Client, Pool };
});

vi.mock("pg", () => ({ Client: fauxPg.Client, Pool: fauxPg.Pool, default: { Client: fauxPg.Client, Pool: fauxPg.Pool } }));

const { creerDepotsPostgres, verrouCreditsPostgres } = await import("@/donnees/postgres");
const credits = await import("@/services/credits");
const { lireParametre } = await import("@/services/_commun");

const CLE_DEPOTS = Symbol.for("studio-axion-ia.depots");
const URL = "postgres://essai@localhost/essai";
const eur = (c: number) => ({ centimes: c, devise: "EUR" as const });
const ligne = (c: number): LigneCout => ({ etape: "Voix", fournisseur: "simulation", unite: "forfait", quantite: 1, prixUnitaire: eur(c), total: eur(c), nature: "estime" });
const parametre = (id: string, valeur: unknown) => ({ id, valeur, creeLe: "", modifieLe: "" });
const reservation = (id: string, centimes: number): ReservationCredit => ({ id, fournisseur: "heygen", travailId: `trv-${id}`, centimes, devise: "USD", statut: "active", creeLe: "", modifieLe: "" });

/** Un « processus » du studio : ses propres dépôts (sa copie en mémoire), sur la base partagée. */
async function processus(): Promise<Depots> {
  const d = creerDepotsPostgres(URL);
  await d.parametres.lister();
  return d;
}

const avant = (globalThis as Record<symbol, unknown>)[CLE_DEPOTS];
beforeEach(() => {
  fauxPg.base.lignes.clear();
  fauxPg.base.verrous.clear();
  fauxPg.base.retardEcriture.clear();
  credits.injecterLecteursPourEssai([], []);
});
afterEach(() => {
  (globalThis as Record<symbol, unknown>)[CLE_DEPOTS] = avant;
  credits.injecterLecteursPourEssai(null);
});

describe("1. deux processus réservent ensemble sur le même disponible : un seul passe", () => {
  it("100 de disponible, deux demandes de 80 lancées au même instant depuis deux processus : une réservation, un refus", async () => {
    const a = await processus();
    const b = await processus();
    const verrouA = verrouCreditsPostgres(a)!;
    const verrouB = verrouCreditsPostgres(b)!;
    expect(verrouA).toBeTypeOf("function");
    const reserver = (d: Depots, verrou: typeof verrouA, id: string) =>
      verrou(async () => {
        const pris = (await d.reservations.lister((r) => r.statut === "active")).reduce((s, r) => s + r.centimes, 0);
        if (pris + 80 > 100) return false;
        await new Promise((r) => setTimeout(r, 10));
        await d.reservations.enregistrer(reservation(id, 80));
        return true;
      });
    const issues = await Promise.all([reserver(a, verrouA, "res-a"), reserver(b, verrouB, "res-b")]);
    expect(issues.filter(Boolean)).toHaveLength(1);
    expect([...fauxPg.base.lignes.values()].filter((l) => l.collection === "reservations")).toHaveLength(1);
    // Le verrou est rendu : la base n'en garde aucun.
    expect(fauxPg.base.verrous.size).toBe(0);
  });

  it("une panne dans la section protégée rend aussi le verrou (l'autre processus n'attend pas pour toujours)", async () => {
    const a = await processus();
    const b = await processus();
    await expect(verrouCreditsPostgres(a)!(async () => Promise.reject(new Error("panne")))).rejects.toThrow("panne");
    expect(await verrouCreditsPostgres(b)!(async () => "passe")).toBe("passe");
  });
});

describe("2. `verifierEtReserver` prend le verrou en base et relit ce que l'autre processus a réservé", () => {
  it("l'autre processus engage 90 € sur 100 € pendant l'attente : la dépense de 20 € est refusée, rien n'est réservé ni engagé", async () => {
    const a = await processus();
    (globalThis as Record<symbol, unknown>)[CLE_DEPOTS] = a;
    await a.parametres.enregistrer(parametre("budget.mensuel", eur(10_000)));
    await a.parametres.enregistrer(parametre("budget.seuilConfirmation", eur(1_000_000)));
    const b = await processus();

    // Processus B tient le verrou ; A lance sa dépense pendant ce temps (elle attend) ; B engage puis rend le verrou.
    let lacher!: () => void;
    const tenu = new Promise<void>((r) => (lacher = r));
    let pris!: () => void;
    const verrouPris = new Promise<void>((r) => (pris = r));
    const cote = verrouCreditsPostgres(b)!(async () => {
      pris();
      await tenu;
      await b.parametres.enregistrer(parametre("budget.engage.trv-b", { centimes: 9_000, le: new Date().toISOString(), statut: "active" }));
      await b.parametres.enregistrer(parametre("budget.engages", ["trv-b"]));
    });
    await verrouPris;
    const depense = credits.verifierEtReserver({ lignes: [ligne(2_000)], total: eur(2_000) }, true, "Cette vidéo", { videoId: "v-a", travailId: "trv-a" });
    await new Promise((r) => setTimeout(r, 20));
    lacher();
    await cote;
    await expect(depense).rejects.toMatchObject({ code: "BUDGET_DEPASSE" });
    expect(await lireParametre("budget.engage.trv-a", null)).toBeNull();
    expect(await a.reservations.lister((r) => r.travailId === "trv-a")).toEqual([]);
  });

  it("sans dépense de l'autre processus, la même dépense passe et son engagement est écrit en base", async () => {
    const a = await processus();
    (globalThis as Record<symbol, unknown>)[CLE_DEPOTS] = a;
    await a.parametres.enregistrer(parametre("budget.mensuel", eur(10_000)));
    await a.parametres.enregistrer(parametre("budget.seuilConfirmation", eur(1_000_000)));
    await credits.verifierEtReserver({ lignes: [ligne(2_000)], total: eur(2_000) }, true, "Cette vidéo", { videoId: "v-a", travailId: "trv-a" });
    const b = await processus();
    await verrouCreditsPostgres(b)!(async () => {
      expect(((await b.parametres.obtenir("budget.engage.trv-a"))?.valeur as { centimes: number }).centimes).toBe(2_000);
    });
  });
});

describe("3. la relecture sous verrou n'écrase jamais une écriture de ce processus encore en vol", () => {
  it("A écrit une ligne pendant que A relit la base (photo prise avant l'écriture) : la copie garde la valeur neuve", async () => {
    const a = await processus();
    await a.parametres.enregistrer(parametre("p-lent", "ancienne"));
    let finirEcriture!: () => void;
    fauxPg.base.retardEcriture.set("p-lent", new Promise<void>((r) => (finirEcriture = r)));
    let finirRelecture!: () => void;
    fauxPg.base.retardRelecture = new Promise<void>((r) => (finirRelecture = r));
    // 1. l'écriture part (retenue avant la base) ; 2. la relecture prend sa photo (encore « ancienne ») et attend ;
    // 3. l'écriture arrive en base et dans la copie ; 4. la relecture rend sa photo : elle ne doit pas écraser « neuve ».
    const ecriture = a.parametres.enregistrer(parametre("p-lent", "neuve"));
    const relecture = verrouCreditsPostgres(a)!(async () => (await a.parametres.obtenir("p-lent"))?.valeur);
    await new Promise((r) => setTimeout(r, 10));
    finirEcriture();
    await ecriture;
    finirRelecture();
    expect(await relecture).toBe("neuve");
    expect((await a.parametres.obtenir("p-lent"))?.valeur).toBe("neuve");
    fauxPg.base.retardRelecture = null;
  });

  it("une ligne écrite par l'autre processus est relue sous le verrou (et pas avant)", async () => {
    const a = await processus();
    const b = await processus();
    await b.parametres.enregistrer(parametre("p-autre", "de B"));
    expect(await a.parametres.obtenir("p-autre")).toBeNull();
    expect(await verrouCreditsPostgres(a)!(async () => (await a.parametres.obtenir("p-autre"))?.valeur)).toBe("de B");
  });
});
