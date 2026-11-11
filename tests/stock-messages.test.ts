/**
 * STK-01 : collection « stock de messages ». Aller-retour mémoire et faux `pg`, archivage sans suppression.
 * Aucun appel réel, données fictives.
 */
import { describe, expect, it, vi } from "vitest";
import { archiverMessage, type MessageStock } from "@/domaine/stock-messages";

const fauxPg = vi.hoisted(() => {
  const lignes = new Map<string, { collection: string; id: string; data: unknown }>();
  const cle = (c: string, id: string) => `${c}\u0000${id}`;
  async function requete(sql: string, params: unknown[] = []): Promise<{ rows: unknown[] }> {
    const s = sql.replace(/\s+/g, " ").trim();
    if (/^INSERT INTO documents/.test(s)) {
      const [collection, id, json] = params as [string, string, string];
      if (/DO NOTHING/.test(s) && lignes.has(cle(collection, id))) return { rows: [] };
      lignes.set(cle(collection, id), { collection, id, data: JSON.parse(json) });
      return { rows: [] };
    }
    if (/^DELETE FROM documents/.test(s)) {
      lignes.delete(cle(String(params[0]), String(params[1])));
      return { rows: [] };
    }
    if (/^SELECT collection, id, data FROM documents/.test(s)) return { rows: [...lignes.values()].map((l) => JSON.parse(JSON.stringify(l))) };
    return { rows: [] };
  }
  class Client {
    async connect() {}
    query(sql: string, params?: unknown[]) { return requete(sql, params); }
    on() { return this; }
    async end() {}
    release() {}
  }
  class Pool {
    on() { return this; }
    query(sql: string, params?: unknown[]) { return requete(sql, params); }
    async connect() { return new Client(); }
  }
  return { lignes, Client, Pool };
});
vi.mock("pg", () => ({ Client: fauxPg.Client, Pool: fauxPg.Pool, default: { Client: fauxPg.Client, Pool: fauxPg.Pool } }));

const { creerDepotsPostgres } = await import("@/donnees/postgres");
const { depots } = await import("@/donnees/memoire");

const message: MessageStock = {
  id: "msg-1",
  texte: "Message fictif pour l'essai.",
  reseau: "linkedin",
  creeLe: "2026-11-20T10:00:00.000Z",
};

async function allerRetour(d: ReturnType<typeof depots>) {
  await d.stockMessages.enregistrer(message);
  expect(await d.stockMessages.obtenir("msg-1")).toEqual(message);
  expect(await d.stockMessages.lister()).toEqual([message]);
}

async function archivage(d: ReturnType<typeof depots>) {
  await d.stockMessages.enregistrer(message);
  const archive = archiverMessage(message, "2026-11-21T09:00:00.000Z");
  await d.stockMessages.enregistrer(archive);
  expect(await d.stockMessages.compter()).toBe(1);
  const relu = await d.stockMessages.obtenir("msg-1");
  expect(relu).toMatchObject({ texte: message.texte, creeLe: message.creeLe, archiveLe: "2026-11-21T09:00:00.000Z" });
}

describe("STK-01 stock de messages", () => {
  it("relu à l'identique depuis le dépôt mémoire", async () => {
    await allerRetour(depots());
  });

  it("archiver ne supprime pas : lisible et daté (mémoire)", async () => {
    await archivage(depots());
  });

  it("archiver ne modifie pas l'original", () => {
    const copie = structuredClone(message);
    archiverMessage(message, "2026-11-21T09:00:00.000Z");
    expect(message).toEqual(copie);
  });

  it("relu à l'identique depuis postgres (faux pg), y compris par un second processus", async () => {
    fauxPg.lignes.clear();
    const a = creerDepotsPostgres("postgres://essai@localhost/essai");
    await a.parametres.lister();
    await allerRetour(a);
    const b = creerDepotsPostgres("postgres://essai@localhost/essai");
    await b.parametres.lister();
    expect(await b.stockMessages.obtenir("msg-1")).toEqual(message);
  });

  it("archiver ne supprime pas : lisible et daté (postgres)", async () => {
    fauxPg.lignes.clear();
    const a = creerDepotsPostgres("postgres://essai@localhost/essai");
    await a.parametres.lister();
    await archivage(a);
    const b = creerDepotsPostgres("postgres://essai@localhost/essai");
    await b.parametres.lister();
    expect(await b.stockMessages.obtenir("msg-1")).toMatchObject({ archiveLe: "2026-11-21T09:00:00.000Z" });
  });
});
