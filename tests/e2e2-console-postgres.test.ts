/**
 * Vérification de bout en bout n° 2 — côté POSTGRES, avec un faux `pg` (aucune vraie base) qui garde les lignes et
 * note chaque requête :
 * - données n° 2 : l'étape 20 sur une base de production déjà semée (démonstration en place) masque les exemples,
 *   n'écrit que des INSERT … ON CONFLICT (aucun DELETE), ne fait disparaître aucune ligne, et se rejoue sans effet ;
 * - données n° 8 : une base injoignable au démarrage n'est plus « perdue à vie » : l'accès suivant recharge ;
 *   la sonde de santé interroge vraiment la base.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Ligne = { collection: string; id: string; data: unknown };
const etat = { lignes: new Map<string, Ligne>(), requetes: [] as string[], panne: false };

async function executer(sql: string, params: unknown[] = []): Promise<{ rows: unknown[] }> {
  etat.requetes.push(sql);
  if (etat.panne) throw new Error("connect ECONNREFUSED (essai)");
  const s = sql.trim();
  if (/^(CREATE TABLE|BEGIN|COMMIT|ROLLBACK|SELECT 1)/.test(s)) return { rows: [] };
  if (s.startsWith("SELECT collection, id, data FROM documents")) return { rows: [...etat.lignes.values()].map((l) => ({ ...l, data: structuredClone(l.data) })) };
  if (s.startsWith("INSERT INTO documents")) {
    const [collection, id, data] = params as [string, string, string];
    const cle = `${collection}/${id}`;
    if (/DO NOTHING/.test(s) && etat.lignes.has(cle)) return { rows: [] };
    etat.lignes.set(cle, { collection, id, data: JSON.parse(data) });
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
      if (etat.panne) throw new Error("connect ECONNREFUSED (essai)");
      return { query: (sql: string, params?: unknown[]) => executer(sql, params), release() {} };
    }
  },
}));

const { creerDepotsPostgres, sonderBasePostgres } = await import("@/donnees/postgres");
const { creerDonneesDemo } = await import("@/donnees/memoire/demo");
const { etape20Exemples } = await import("@/services/migrations/etape-20-exemples");

beforeEach(() => {
  etat.lignes.clear();
  etat.requetes = [];
  etat.panne = false;
});

/** Base « de production » : la démonstration déjà semée lors d'un ancien démarrage. */
function semerCommeEnProduction() {
  const demo = creerDonneesDemo() as unknown as Record<string, { id: string }[] | undefined>;
  for (const c of ["idees", "videos", "partages", "scripts", "parametres", "publications"]) {
    for (const e of demo[c] ?? []) etat.lignes.set(`${c}/${e.id}`, { collection: c, id: e.id, data: structuredClone(e) });
  }
}

describe("E2E-2 données n° 2 · étape 20 sur Postgres", () => {
  it("masque les exemples sans rien effacer, une seule fois", async () => {
    semerCommeEnProduction();
    const avant = new Set(etat.lignes.keys());
    const d = creerDepotsPostgres("postgresql://essai@base.invalid/studio");

    const r1 = await etape20Exemples(d, "2026-10-04T08:00:00.000Z");
    expect(r1).toMatchObject({ exemplesMasques: true });
    expect(r1!.liensCoupes).toBeGreaterThanOrEqual(1);
    expect((etat.lignes.get("parametres/afficherExemples")?.data as { valeur: boolean }).valeur).toBe(false);
    const lienDemo = [...etat.lignes.values()].find((l) => l.collection === "partages" && (l.data as { id: string }).id === "par-1");
    expect((lienDemo?.data as { revoqueLe?: string }).revoqueLe).toBe("2026-10-04T08:00:00.000Z");

    // Rien n'a disparu, aucune requête de suppression.
    for (const k of avant) expect(etat.lignes.has(k), k).toBe(true);
    expect(etat.requetes.some((q) => /\bDELETE\b|\bTRUNCATE\b|\bDROP\b/i.test(q))).toBe(false);

    // Rejeu (nouveau démarrage : rechargement depuis la base) : aucun changement.
    const instantane = JSON.stringify([...etat.lignes.entries()]);
    const d2 = creerDepotsPostgres("postgresql://essai@base.invalid/studio");
    expect(await etape20Exemples(d2, "2026-10-04T09:00:00.000Z")).toBeNull();
    expect(JSON.stringify([...etat.lignes.entries()])).toBe(instantane);
  });
});

describe("E2E-2 données n° 8 · base injoignable au démarrage, puis revenue", () => {
  it("le premier accès échoue, l'accès suivant recharge (plus d'erreur gardée à vie)", async () => {
    semerCommeEnProduction();
    etat.panne = true;
    const d = creerDepotsPostgres("postgresql://essai@base.invalid/studio");
    await expect(d.idees.compter()).rejects.toThrow(/ECONNREFUSED/);
    etat.panne = false;
    expect(await d.idees.compter()).toBeGreaterThan(0);
  });

  it("la sonde interroge la base : elle échoue quand la base tombe, même si la copie en mémoire est chargée", async () => {
    const d = creerDepotsPostgres("postgresql://essai@base.invalid/studio");
    await sonderBasePostgres(d);
    etat.panne = true;
    await expect(sonderBasePostgres(d)).rejects.toThrow();
    expect(await d.idees.compter()).toBeGreaterThanOrEqual(0); // la copie en mémoire, elle, répond encore
  });

  it("la sonde reconnaît la base même depuis une AUTRE copie du module (Next charge le module plusieurs fois)", async () => {
    // Constaté sur un serveur construit : les dépôts créés au démarrage étaient vus « memoire » par la route /api/sante.
    const d = creerDepotsPostgres("postgresql://essai@base.invalid/studio");
    vi.resetModules();
    const autreCopie = await import("@/donnees/postgres");
    const sonde = autreCopie.sonderBasePostgres(d);
    expect(sonde).not.toBeNull();
    await sonde;
  });
});
