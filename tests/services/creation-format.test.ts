/**
 * Règle r32 du fondateur (25/10 « prix non bloquant », 08/11 « budget inopérant ») : le prix informe, il ne bloque pas. Le mode est
 * toujours indicatif : une vidéo « studio » est lancée au prix du jour (trace « Prix accepté sans confirmation »).
 * La garde par montant confirmé ne tient plus que pour une vidéo d'origine « usine » (`commande.origine`) : sans accord suffisant, rien n'est lancé.
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

const CAS_ACCORD = [[undefined], [false], [true], [499], ["500"]];

async function videoAvecOrigine(id: string, origine: "usine" | "studio") {
  const d = new Date().toISOString();
  await depots().versions.enregistrer({ id: `ver-${id}`, videoId: id, numero: 1, commande: { origine, entrees: {} }, creeLe: d, modifieLe: d } as never);
}
const tracesPrix = async () => ({
  journal: (await depots().evenements.lister((e) => e.type === "budget" && e.message.includes("accepté sans confirmation"))).length,
  cloche: (await depots().notifications.lister((n) => n.titre === "Prix accepté sans confirmation")).length,
});

describe("lancerAvecAccord", () => {
  describe("vidéo d'origine « usine » : la garde par montant confirmé", () => {
    beforeEach(() => videoAvecOrigine("v1", "usine"));
    it.each(CAS_ACCORD)("sans montant confirmé suffisant (%s), rien n'est lancé", async (accord) => {
      const lancer = vi.fn(async () => ({ travailId: "t1" }));
      const r = await lancerAvecAccord("v1", accord, 500, { lancer });
      expect(r).toMatchObject({ statut: "accord-requis", centimes: 500 });
      expect(lancer).not.toHaveBeenCalled();
      expect(await tracesPrix()).toEqual({ journal: 0, cloche: 0 });
    });
  });

  describe("vidéo d'origine « studio » (mode indicatif) : le prix du jour vaut accord", () => {
    beforeEach(() => videoAvecOrigine("v1", "studio"));
    it.each(CAS_ACCORD)("sans montant confirmé suffisant (%s), lancée au prix du jour avec trace", async (accord) => {
      const lancer = vi.fn(async () => ({ travailId: "t1" }));
      expect(await lancerAvecAccord("v1", accord, 500, { lancer })).toEqual({ statut: "lancee", travailId: "t1" });
      expect(lancer).toHaveBeenCalledTimes(1);
      const [, montant] = lancer.mock.calls[0] as unknown as [string, number];
      expect(montant).toBeGreaterThanOrEqual(500);
      expect(await tracesPrix()).toEqual({ journal: 1, cloche: 1 });
    });

    it("un accord numérique suffisant ne signale rien", async () => {
      const lancer = vi.fn(async () => ({ travailId: "t1" }));
      await lancerAvecAccord("v1", 500, 500, { lancer });
      expect(await tracesPrix()).toEqual({ journal: 0, cloche: 0 });
    });
  });

  it("avec un montant au moins égal, lance une fois avec ce montant", async () => {
    const lancer = vi.fn(async () => ({ travailId: "t1" }));
    expect(await lancerAvecAccord("v1", 500, 500, { lancer })).toEqual({ statut: "lancee", travailId: "t1" });
    expect(await lancerAvecAccord("v1", 800, 500, { lancer })).toEqual({ statut: "lancee", travailId: "t1" });
    expect(lancer).toHaveBeenCalledTimes(2);
    expect(lancer).toHaveBeenLastCalledWith("v1", 800);
  });
});
