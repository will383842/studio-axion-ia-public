/**
 * L1-06 — dépôts des créneaux éditoriaux et du journal des décalages.
 * Aller-retour en mémoire et avec un FAUX `pg` (une base en mémoire). Aucun appel réel, données fictives.
 */
import { describe, expect, it, vi } from "vitest";
import type { JournalDecalage } from "@/domaine/depots";
import type { CreneauEditorial } from "@/domaine/plan-editorial/types";

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
const { TRAITEMENT_SUPPRESSION, GARDES_APRES_SUPPRESSION } = await import("@/services/suppression-video");

const creneau: CreneauEditorial = {
  id: "cre-1",
  jourVise: "2026-11-25",
  heuresParReseau: { linkedin: "2026-11-25T08:30:00.000Z" },
  compteCible: "compte-fictif-1",
  videoId: "vid-1",
  statut: "propose",
  decalages: 0,
};
const decalage: JournalDecalage = {
  id: "dec-1",
  creneauId: "cre-1",
  ancienJour: "2026-11-25",
  nouveauJour: "2026-11-26",
  raison: "essai fictif",
  creeLe: "2026-11-20T10:00:00.000Z",
};

async function allerRetour(d: ReturnType<typeof depots>) {
  await d.creneauxEditoriaux.enregistrer(creneau);
  await d.journalDecalages.enregistrer(decalage);
  expect(await d.creneauxEditoriaux.obtenir("cre-1")).toEqual(creneau);
  expect(await d.journalDecalages.lister((x) => x.creneauId === "cre-1")).toEqual([decalage]);
  const modifie = await d.creneauxEditoriaux.modifier("cre-1", { statut: "a_valider", decalages: 1 });
  expect(modifie.statut).toBe("a_valider");
  expect(await d.creneauxEditoriaux.compter()).toBe(1);
}

describe("L1-06 dépôts du calendrier", () => {
  it("aller-retour en mémoire", async () => {
    await allerRetour(depots());
  });

  it("aller-retour avec Postgres (faux pg) et rechargement par un second processus", async () => {
    fauxPg.lignes.clear();
    const a = creerDepotsPostgres("postgres://essai@localhost/essai");
    await a.parametres.lister();
    await allerRetour(a);
    const b = creerDepotsPostgres("postgres://essai@localhost/essai");
    await b.parametres.lister();
    expect(await b.creneauxEditoriaux.obtenir("cre-1")).toMatchObject({ id: "cre-1", decalages: 1 });
    expect(await b.journalDecalages.obtenir("dec-1")).toEqual(decalage);
    expect([...fauxPg.lignes.values()].map((l) => l.collection).filter((c) => c === "creneauxEditoriaux" || c === "journalDecalages").sort()).toEqual(["creneauxEditoriaux", "journalDecalages"]);
  });

  it("suppression d'une vidéo : une décision écrite pour chacune des deux collections (constat de relecture)", () => {
    expect(Object.keys(TRAITEMENT_SUPPRESSION).sort()).toEqual(Object.keys(depots()).sort());
    expect(TRAITEMENT_SUPPRESSION.creneauxEditoriaux).toBe("detache"); // CORRECTIF STK-01 : détaché, plus effacé
    expect(TRAITEMENT_SUPPRESSION.journalDecalages).toBe("sans-lien");
    const g = GARDES_APRES_SUPPRESSION.find((x) => x.collection === "creneauxEditoriaux");
    expect(g?.correspond({ ...creneau })).toBe(false);
    expect(g?.correspond({ ...creneau, statut: "publie" })).toBe(true);
    expect(g?.correspond({ ...creneau, statut: "archive" })).toBe(true);
  });

  it("journal des décalages : ajout seul (type restreint, ni modifier ni supprimer)", async () => {
    const d = depots();
    await d.journalDecalages.enregistrer(decalage);
    expect(await d.journalDecalages.compter()).toBe(1);
    // @ts-expect-error — le journal est en ajout seul : `modifier` n'existe pas sur son type.
    void d.journalDecalages.modifier;
    // @ts-expect-error — idem pour `supprimer`.
    void d.journalDecalages.supprimer;
  });
});
