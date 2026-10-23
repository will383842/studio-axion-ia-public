/**
 * Suppression définitive d'une vidéo (décision de Will du 17/10, « vraie suppression, dépenses gardées ») — couche
 * DÉPÔTS : `supprimer(id)` efface vraiment (mémoire et Postgres), et un lot d'écritures part en UNE transaction
 * (tout ou rien) avec un faux `pg` qui garde les lignes et note chaque requête (aucune vraie base).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Ligne = { collection: string; id: string; data: unknown };
const etat = { lignes: new Map<string, Ligne>(), requetes: [] as string[], panneSur: null as RegExp | null, enTransaction: null as Map<string, Ligne> | null };

async function executer(sql: string, params: unknown[] = []): Promise<{ rows: unknown[] }> {
  etat.requetes.push(sql);
  const s = sql.trim();
  if (etat.panneSur?.test(s)) throw new Error("panne (essai)");
  if (s.startsWith("SELECT 1 FROM documents WHERE collection = $1 AND id = $2 AND (data->>'expireLe')")) {
    const [collection, id] = params as [string, string];
    const l = etat.lignes.get(`${collection}/${id}`);
    return { rows: l && new Date((l.data as { expireLe: string }).expireLe).getTime() > Date.now() ? [{}] : [] };
  }
  if (/^(CREATE TABLE|SELECT 1)/.test(s)) return { rows: [] };
  if (s === "BEGIN") {
    etat.enTransaction = new Map(etat.lignes);
    return { rows: [] };
  }
  if (s === "COMMIT") {
    etat.enTransaction = null;
    return { rows: [] };
  }
  if (s === "ROLLBACK") {
    if (etat.enTransaction) etat.lignes = etat.enTransaction;
    etat.enTransaction = null;
    return { rows: [] };
  }
  if (s.startsWith("SELECT collection, id, data FROM documents")) return { rows: [...etat.lignes.values()].map((l) => ({ ...l, data: structuredClone(l.data) })) };
  if (s.startsWith("INSERT INTO documents")) {
    const [collection, id, data] = params as [string, string, string];
    etat.lignes.set(`${collection}/${id}`, { collection, id, data: JSON.parse(data) });
    return { rows: [] };
  }
  if (s.startsWith("DELETE FROM documents WHERE collection = $1 AND id = $2")) {
    const [collection, id] = params as [string, string];
    const l = etat.lignes.get(`${collection}/${id}`);
    if (/expireLe/.test(s) && l && new Date((l.data as { expireLe: string }).expireLe).getTime() > Date.now()) return { rows: [] };
    etat.lignes.delete(`${collection}/${id}`);
    return { rows: [] };
  }
  throw new Error(`Requête inattendue : ${s.slice(0, 60)}`);
}

vi.mock("pg", () => ({
  Pool: class {
    on() {}
    query(sql: string, params?: unknown[]) {
      return executer(sql, params);
    }
    async connect() {
      return { query: (sql: string, params?: unknown[]) => executer(sql, params), release() {} };
    }
  },
}));

const { creerDepotsPostgres, appliquerLotPostgres, bailPostgres } = await import("@/donnees/postgres");
const { DepotMemoire } = await import("@/donnees/memoire");

const ligne = (collection: string, id: string, data: Record<string, unknown> = {}) => etat.lignes.set(`${collection}/${id}`, { collection, id, data: { id, ...data } });

beforeEach(() => {
  etat.lignes = new Map();
  etat.requetes = [];
  etat.panneSur = null;
  etat.enTransaction = null;
  ligne("videos", "v-a", { titre: "A" });
  ligne("videos", "v-b", { titre: "B" });
  ligne("plans", "p-a", { videoId: "v-a" });
});

describe("Depot.supprimer", () => {
  it("mémoire : efface vraiment, une seule fois", async () => {
    const d = new DepotMemoire<{ id: string; n: number }>([{ id: "x", n: 1 }, { id: "y", n: 2 }]);
    expect(await d.supprimer("x")).toBe(true);
    expect(await d.obtenir("x")).toBeNull();
    expect(await d.supprimer("x")).toBe(false);
    expect((await d.lister()).map((e) => e.id)).toEqual(["y"]);
  });

  it("Postgres : DELETE réel de la ligne, la copie suit ; l'autre vidéo reste ; un 2e appel ne fait rien", async () => {
    const d = creerDepotsPostgres("postgresql://essai@base.invalid/studio");
    expect(await d.videos.supprimer("v-a")).toBe(true);
    expect(etat.lignes.has("videos/v-a")).toBe(false);
    expect(etat.lignes.has("videos/v-b")).toBe(true);
    expect(await d.videos.obtenir("v-a")).toBeNull();
    const n = etat.requetes.length;
    expect(await d.videos.supprimer("v-a")).toBe(false);
    expect(etat.requetes.length).toBe(n);
  });
});

describe("Lot d'écritures (Postgres)", () => {
  it("une transaction : effacements et enregistrements, puis la copie en mémoire", async () => {
    const d = creerDepotsPostgres("postgresql://essai@base.invalid/studio");
    await d.videos.lister();
    await appliquerLotPostgres(d, { supprimer: [{ collection: "videos", id: "v-a" }, { collection: "plans", id: "p-a" }], enregistrer: [{ collection: "idees", entite: { id: "i-1", videoId: null } as never }] });
    const q = etat.requetes.map((r) => r.trim());
    expect(q.indexOf("BEGIN")).toBeGreaterThanOrEqual(0);
    expect(q.indexOf("COMMIT")).toBeGreaterThan(q.indexOf("BEGIN"));
    expect(etat.lignes.has("videos/v-a")).toBe(false);
    expect(etat.lignes.has("plans/p-a")).toBe(false);
    expect(await d.plans.obtenir("p-a")).toBeNull();
    expect(await d.idees.obtenir("i-1")).toMatchObject({ id: "i-1" });
  });

  it("un échec en route : ROLLBACK, la base ET la copie restent comme avant", async () => {
    const d = creerDepotsPostgres("postgresql://essai@base.invalid/studio");
    await d.videos.lister();
    etat.panneSur = /^INSERT/;
    await expect(appliquerLotPostgres(d, { supprimer: [{ collection: "videos", id: "v-a" }], enregistrer: [{ collection: "idees", entite: { id: "i-1" } as never }] })).rejects.toThrow();
    expect(etat.requetes.map((r) => r.trim())).toContain("ROLLBACK");
    expect(etat.lignes.has("videos/v-a")).toBe(true);
    expect(await d.videos.obtenir("v-a")).not.toBeNull();
  });

  it("bail : seul un bail expiré est oublié", async () => {
    const d = creerDepotsPostgres("postgresql://essai@base.invalid/studio");
    ligne("baux", "lanceur-image-video:v-a", { titulaire: "x", expireLe: new Date(Date.now() - 1000).toISOString() });
    ligne("baux", "lanceur-image-video:v-b", { titulaire: "x", expireLe: new Date(Date.now() + 60_000).toISOString() });
    await bailPostgres(d)!.oublierExpire("lanceur-image-video:v-a");
    await bailPostgres(d)!.oublierExpire("lanceur-image-video:v-b");
    expect(etat.lignes.has("baux/lanceur-image-video:v-a")).toBe(false);
    expect(etat.lignes.has("baux/lanceur-image-video:v-b")).toBe(true);
  });

  it("bail : « tenu » seulement s'il n'est pas expiré (le refus de suppression du lanceur image → vidéo le lit)", async () => {
    const d = creerDepotsPostgres("postgresql://essai@base.invalid/studio");
    ligne("baux", "lanceur-image-video:v-a", { titulaire: "x", expireLe: new Date(Date.now() - 1000).toISOString() });
    ligne("baux", "lanceur-image-video:v-b", { titulaire: "x", expireLe: new Date(Date.now() + 60_000).toISOString() });
    expect(await bailPostgres(d)!.tenu("lanceur-image-video:v-a")).toBe(false);
    expect(await bailPostgres(d)!.tenu("lanceur-image-video:v-b")).toBe(true);
    expect(await bailPostgres(d)!.tenu("lanceur-image-video:v-c")).toBe(false);
  });
});
