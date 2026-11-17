/** PR B · B12 : douterDossier sur dossier vide écrit toujours douteOpposition: true, même si neuf() ne le pose pas. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";

const magasin = vi.hoisted(() => ({ m: new Map<string, unknown>() }));
vi.mock("@/services/_commun", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  lireParametre: async (id: string, defaut: unknown) => (magasin.m.has(id) ? structuredClone(magasin.m.get(id)) : defaut),
  ecrireParametre: async (id: string, v: unknown) => { magasin.m.set(id, structuredClone(v)); },
  sousVerrou: async (f: () => Promise<unknown>) => f(),
}));
const { douterDossier } = await import("@/services/parcours-dossier");
beforeEach(() => magasin.m.clear());

describe("B12 douterDossier, dossier vide", () => {
  it("entrée créée avec douteOpposition true même si neuf() ne le pose pas", async () => {
    const neuf = () => ({ etat: "expire", reseau: "instagram", idCompte: "c", idCommentaire: "x", alias: [] }) as any;
    const r = await douterDossier("R1", neuf);
    expect(r).toHaveLength(1);
    expect(r[0].etat.douteOpposition).toBe(true);
    expect((magasin.m.get("parcours.conversations") as any).R1.douteOpposition).toBe(true);
  });
});
