/**
 * Partie commune de la création d'un format (S0) : brouillon d'un format masqué, lancement refusé sans montant confirmé.
 * Dépôts en mémoire, lancement doublé : aucun appel réseau, rien de payé.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { nouveauBrouillonFormat, lancerAvecAccord } = await import("@/services/creation-format");
const { trouverFormat } = await import("@/formats");

const MDP = "creation-format";

beforeAll(async () => {
  process.env.SESSION_SECRET = "t".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

describe("nouveauBrouillonFormat", () => {
  it("crée le brouillon d'un format (ici le tableau animé)", async () => {
    expect(trouverFormat("tableau-anime")?.statut).toBe("actif");
    const v = await nouveauBrouillonFormat({ formatId: "tableau-anime", titre: "Un titre", sujet: "Un sujet", distribution: [{ role: "voix", source: "double" }], entrees: { monFormat: { a: 1 } } });
    const lue = await depots().videos.obtenir(v.id);
    expect(lue).toMatchObject({ formatId: "tableau-anime", statut: "brouillon", titre: "Un titre", sujet: "Un sujet", entrees: { monFormat: { a: 1 } } });
    expect(lue?.distribution).toEqual([{ role: "voix", source: "double" }]);
  });

  it("refuse un format inconnu", async () => {
    await expect(nouveauBrouillonFormat({ formatId: "n-existe-pas", titre: "t", sujet: "s", distribution: [], entrees: {} })).rejects.toThrow(/n'existe pas/);
  });
});

describe("lancerAvecAccord", () => {
  it.each([[undefined], [false], [true], [499], ["500"]])("sans montant confirmé suffisant (%s), rien n'est lancé", async (accord) => {
    const lancer = vi.fn(async () => ({ travailId: "t1" }));
    const r = await lancerAvecAccord("v1", accord, 500, { lancer });
    expect(r).toMatchObject({ statut: "accord-requis", centimes: 500 });
    expect(lancer).not.toHaveBeenCalled();
  });

  it("avec un montant au moins égal, lance une fois avec ce montant", async () => {
    const lancer = vi.fn(async () => ({ travailId: "t1" }));
    expect(await lancerAvecAccord("v1", 500, 500, { lancer })).toEqual({ statut: "lancee", travailId: "t1" });
    expect(await lancerAvecAccord("v1", 800, 500, { lancer })).toEqual({ statut: "lancee", travailId: "t1" });
    expect(lancer).toHaveBeenCalledTimes(2);
    expect(lancer).toHaveBeenLastCalledWith("v1", 800);
  });
});
