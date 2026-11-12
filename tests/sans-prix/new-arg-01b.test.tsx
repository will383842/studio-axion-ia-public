/**
 * NEW-ARG-01b · aucun montant à l'écran dans les six fichiers du lot. Les coûts restent enregistrés (centimes conservés),
 * seul ce qui est renvoyé à l'affichage change. Aucun appel réel : les services sont remplacés par des doublures.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { centimes } from "@/lib/montants";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/services/auth", () => ({ exigerSession: async () => undefined }));
vi.mock("@/services/fabrication-reseaux", () => ({
  confirmerFabricationComplete: async () => undefined,
  fabriquerSecondeOuverture: async () => undefined,
  monterJeLis: async () => undefined,
  planFabricationSujet: async () => ({
    versions: [{ varianteId: "v1", cout: centimes(1234), videoId: undefined }, { varianteId: "v2", cout: centimes(560), videoId: undefined }],
    total: centimes(1794),
    sansDeclinaison: centimes(900),
    avatarParle: undefined,
  }),
}));

const SANS_ARGENT = /€|\$|euros?\b|dollars?\b|\bUSD\b|\bEUR\b|\d[.,]\d{2}/i;
const FICHIERS = [
  "src/app/(studio)/_accueil/EnCours.tsx",
  "src/app/(studio)/ecrire/atelier/page.tsx",
  "src/app/(studio)/ecrire/sujets/[id]/page.tsx",
  "src/app/(studio)/ecrire/sujets/actions.ts",
  "src/app/(studio)/page.tsx",
  "src/app/(studio)/styleguide/Vitrine.tsx",
];

describe("NEW-ARG-01b", () => {
  it("le prix des formats cochés ne renvoie aucun montant lisible, mais garde les centimes", { timeout: 60000 }, async () => {
    const { planFabricationNAction } = await import("@/app/(studio)/ecrire/sujets/actions");
    const r = await planFabricationNAction("s1", []);
    expect(r.ok).toBe(true);
    if (!r.ok || !r.donnees) throw new Error("plan attendu");
    const d = r.donnees;
    expect(JSON.stringify({ v: d.versions.map((x) => x.prix), t: d.total, s: d.sansDeclinaison })).not.toMatch(SANS_ARGENT);
    expect(d.totalCentimes).toBe(1794);
    expect(d.versions.map((x) => x.varianteId)).toEqual(["v1", "v2"]);
  });

  it.each(FICHIERS)("%s : aucun symbole d'argent ni « euros » dans le source", (f) => {
    expect(readFileSync(f, "utf8")).not.toMatch(/€|euros?\b/i);
  });
});
