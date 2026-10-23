/**
 * Numéro du lien suivi sur un VRAI Postgres jetable (deux processus, compteur atomique). Sauté sans
 * `STUDIO_ESSAI_PG_URL` (ex. `postgres://essai@127.0.0.1:55432/postgres`) : jamais la base du studio, une base vide
 * d'essai seulement. Clé d'essai unique par passage (le compteur de production n'est pas touché). 0 €.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "./helpers/next-mocks";
import type { Depots } from "@/domaine/depots";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const URL_ESSAI = process.env.STUDIO_ESSAI_PG_URL;

describe.skipIf(!URL_ESSAI)("numéro du lien suivi sur un vrai Postgres (deux processus)", () => {
  const CLE_DEPOTS = Symbol.for("studio-axion-ia.depots");
  const avant = (globalThis as Record<symbol, unknown>)[CLE_DEPOTS];
  const suffixe = Date.now().toString(36);
  let pg: typeof import("@/donnees/postgres");

  beforeAll(async () => {
    pg = await import("@/donnees/postgres");
  });
  afterAll(async () => {
    (globalThis as Record<symbol, unknown>)[CLE_DEPOTS] = avant;
    // le pool est privé dans la base accrochée aux dépôts par ce symbole global : on le ferme pour ne laisser aucune connexion ouverte
    for (const d of ouverts) await (d as unknown as Record<symbol, { pool: { end(): Promise<void> } }>)[Symbol.for("studio-axion-ia.base-postgres")].pool.end();
  });

  const ouverts: Depots[] = [];
  const processus = async (): Promise<Depots> => {
    const d = pg.creerDepotsPostgres(URL_ESSAI!);
    ouverts.push(d);
    await d.parametres.lister();
    return d;
  };
  const suivant = (d: Depots, cle: string, min: number, max: number) => pg.numeroSuiviPostgres(d)!.suivant(cle, min, max);

  it("20 appels parallèles sur 2 processus : 20 numéros distincts et consécutifs", async () => {
    const a = await processus();
    const b = await processus();
    const cle = `essai-${suffixe}-parallele`;
    const numeros = await Promise.all(Array.from({ length: 20 }, (_, i) => suivant(i % 2 ? a : b, cle, 1, 8999)));
    expect(new Set(numeros).size).toBe(20);
    const tries = [...numeros].sort((x, y) => x - y);
    expect(tries.at(-1)! - tries[0]!).toBe(19);
  });

  it("une version de numero 4321 déjà là (écrite par un autre chemin) : le premier numéro est ≥ 4322", async () => {
    const a = await processus();
    const modele = (await a.versions.lister())[0]!;
    await a.versions.enregistrer({ ...modele, id: `ver-essai-${suffixe}-4321`, videoId: `v-essai-${suffixe}`, numero: 4321, numeroSuivi: undefined });
    try {
      expect(await suivant(a, `essai-${suffixe}-amorce`, 1, 8999)).toBeGreaterThanOrEqual(4322);
    } finally {
      await a.versions.supprimer(`ver-essai-${suffixe}-4321`);
    }
  });

  it("la plus haute version supprimée : le numéro suivant est plus haut (le compteur ne redescend pas)", async () => {
    const a = await processus();
    const modele = (await a.versions.lister())[0]!;
    const cle = `essai-${suffixe}-suppression`;
    const n = await suivant(a, cle, 1, 8999);
    const id = `ver-essai-${suffixe}-sup`;
    await a.versions.enregistrer({ ...modele, id, videoId: `v-essai-${suffixe}-s`, numero: 1, numeroSuivi: n });
    await a.versions.supprimer(id);
    expect(await suivant(a, cle, 1, 8999)).toBeGreaterThan(n);
  });
});
