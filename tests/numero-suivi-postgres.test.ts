/**
 * Numéro du lien suivi sur DEUX « processus » du studio (deux conteneurs) : un FAUX `pg` partagé (une base en mémoire),
 * deux `creerDepotsPostgres` (chacun sa copie en mémoire, chargée au démarrage). Le numéro vient du compteur en base,
 * pas de la copie : le processus B, dont la copie des versions est PÉRIMÉE, ne redonne pas le numéro pris par A.
 * Aucune vraie base, aucun réseau, 0 €. (Le SQL lui-même est essayé par `numero-suivi-postgres-reel.test.ts`.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "./helpers/next-mocks";
import type { Depots } from "@/domaine/depots";

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
    // Bail (ancien chemin) : pris si libre, expiré ou déjà à ce titulaire.
    if (s.includes("jsonb_build_object('titulaire'")) {
      const [collection, id, titulaire, dureeMs] = params as [string, string, string, number];
      const k = cle(collection, id);
      const actuel = base.lignes.get(k)?.data as { titulaire: string; expireLe: number } | undefined;
      if (actuel && actuel.titulaire !== titulaire && actuel.expireLe > Date.now()) return { rows: [] };
      base.lignes.set(k, { collection, id, data: { titulaire, expireLe: Date.now() + Number(dureeMs) } });
      return { rows: [{ id }] };
    }
    // Bail rendu : il expire aussitôt.
    if (/^UPDATE documents SET data = jsonb_set/.test(s)) {
      const [collection, id, titulaire] = params as [string, string, string];
      const ligne = base.lignes.get(cle(collection, id));
      const actuel = ligne?.data as { titulaire: string; expireLe: number } | undefined;
      if (ligne && actuel?.titulaire === titulaire) ligne.data = { ...actuel, expireLe: Date.now() - 1000 };
      return { rows: [] };
    }
    // Compteur du numéro de suivi : une requête atomique (la tâche entière tient dans un seul tour, sans await).
    if (/^WITH amorce AS/.test(s)) {
      const [clef, min, max, collectionCompteurs, collectionVersions] = params as [string, number, number, string, string];
      let amorce = Number(min) - 1;
      for (const l of base.lignes.values()) {
        if (l.collection !== collectionVersions) continue;
        const d = l.data as { numeroSuivi?: unknown; numero?: unknown };
        const n = Math.max(typeof d.numeroSuivi === "number" ? Math.floor(d.numeroSuivi) : 0, typeof d.numero === "number" ? Math.floor(d.numero) : 0);
        if (n >= Number(min) && n <= Number(max)) amorce = Math.max(amorce, n);
      }
      const k = cle(collectionCompteurs, clef);
      const compteur = (base.lignes.get(k)?.data as { dernier?: number } | undefined)?.dernier;
      const suivant = Math.max((compteur ?? Number(min) - 1) + 1, amorce + 1);
      base.lignes.set(k, { collection: collectionCompteurs, id: clef, data: { dernier: suivant } });
      return { rows: [{ dernier: suivant }] };
    }
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

const { creerDepotsPostgres } = await import("@/donnees/postgres");
const fabrication = await import("@/services/fabrication");

const CLE_DEPOTS = Symbol.for("studio-axion-ia.depots");
const URL = "postgres://essai@localhost/essai";

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
});
afterEach(() => {
  (globalThis as Record<symbol, unknown>)[CLE_DEPOTS] = avant;
});

describe("numéro du lien suivi : deux processus, une base", () => {
  it("B (copie des versions périmée) reçoit le numéro qui suit celui de A, jamais le même", async () => {
    const a = await processus();
    const b = await processus();
    const modele = (await a.versions.lister())[0]!;
    const hors = (await b.versions.lister()).length;
    expect(hors).toBeGreaterThan(0);

    (globalThis as Record<symbol, unknown>)[CLE_DEPOTS] = a;
    const nA = await fabrication.attribuerNumeroSuivi(false, async (n) => {
      await a.versions.enregistrer({ ...modele, id: "ver-a-1", videoId: "v-pg-a", numero: 1, numeroSuivi: n });
    });

    // La copie de B ne connaît pas la version de A.
    expect(await b.versions.obtenir("ver-a-1")).toBeNull();
    (globalThis as Record<symbol, unknown>)[CLE_DEPOTS] = b;
    const nB = await fabrication.attribuerNumeroSuivi(false, async (n) => {
      await b.versions.enregistrer({ ...modele, id: "ver-b-1", videoId: "v-pg-b", numero: 1, numeroSuivi: n });
    });
    expect(nB).toBe(nA + 1);
  });

  it("la démonstration a son propre compteur (≥ 9000), indépendant du réel", async () => {
    const a = await processus();
    (globalThis as Record<symbol, unknown>)[CLE_DEPOTS] = a;
    const reel = await fabrication.attribuerNumeroSuivi(false, async () => undefined);
    const demo = await fabrication.attribuerNumeroSuivi(true, async () => undefined);
    expect(reel).toBeLessThan(9000);
    expect(demo).toBeGreaterThanOrEqual(9000);
  });
});
