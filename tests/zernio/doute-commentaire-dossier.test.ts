/** PR A · douterDossier : pose douteOpposition sans rien changer d'autre, sans registre ni file. Magasin en mémoire, aucune donnée réelle. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";

const magasin = vi.hoisted(() => ({ m: new Map<string, unknown>(), ecrits: [] as string[] }));
vi.mock("@/services/_commun", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  lireParametre: async (id: string, defaut: unknown) => (magasin.m.has(id) ? structuredClone(magasin.m.get(id)) : defaut),
  ecrireParametre: async (id: string, v: unknown) => { magasin.ecrits.push(id); magasin.m.set(id, structuredClone(v)); },
  sousVerrou: async (f: () => Promise<unknown>) => f(),
}));
const { douterDossier } = await import("@/services/parcours-dossier");

const P = "parcours.conversations";
const conv = (o: Record<string, unknown> = {}): any => ({
  etat: "attente_email", reseau: "instagram", idCompte: "c", idCommentaire: "com-1", idPostPlateforme: "p", versionTexteM1: "mp-m1-v2", guide: "guide-ia",
  cleIdempotenceGuide: "a".repeat(64), creeLe: "2026-10-18T10:00:00.000Z", m1Le: "2026-10-18T10:01:00.000Z", occurredAt: null, m2Envoye: false, essaisSite: 0, essaisPub: 0, essaisM1: 0, prochainEssaiLe: 123, dernierCode: null, alias: ["al1"], ...o,
});
beforeEach(() => { magasin.m.clear(); magasin.ecrits.length = 0; });

describe("A9 douterDossier", () => {
  it("dossier vide : une entrée à la clé racine, neuf() appelé", async () => {
    magasin.m.set("autre.param", { x: 1 });
    const r = await douterDossier("R1", () => conv({ douteOpposition: true }));
    expect(r).toHaveLength(1);
    expect(r[0].cle).toBe("R1");
    expect(Object.keys(magasin.m.get(P) as object)).toEqual(["R1"]);
    expect(magasin.m.get("autre.param")).toEqual({ x: 1 });
  });
  it("deux entrées : les deux marquées, tout le reste inchangé", async () => {
    const a = conv({ etat: "attente_email" });
    const b = conv({ etat: "pub_ok", prochainEssaiLe: 999, alias: ["z"] });
    magasin.m.set(P, { "R1|a": a, "R1|b": b, "R2|c": conv() });
    const r = await douterDossier("R1", () => conv());
    expect(r.map((x) => x.cle).sort()).toEqual(["R1|a", "R1|b"]);
    const apres = magasin.m.get(P) as any;
    expect(apres["R1|a"]).toEqual({ ...a, douteOpposition: true });
    expect(apres["R1|b"]).toEqual({ ...b, douteOpposition: true });
    expect(apres["R2|c"].douteOpposition).toBeUndefined();
    expect(Object.keys(apres).length).toBeGreaterThanOrEqual(3);
  });
  it("une entrée « oppose » reste intacte", async () => {
    const o = conv({ etat: "oppose", prochainEssaiLe: null });
    const v = conv();
    magasin.m.set(P, { "R1|o": o, "R1|v": v });
    const r = await douterDossier("R1", () => conv());
    const apres = magasin.m.get(P) as any;
    expect(apres["R1|o"]).toEqual(o);
    expect("douteOpposition" in apres["R1|o"]).toBe(false);
    expect(apres["R1|v"].douteOpposition).toBe(true);
    expect(r.map((x) => x.cle)).toEqual(["R1|v"]);
  });
  it("jamais de baisse du nombre de clés ; aucun autre paramètre écrit (registre, file)", async () => {
    magasin.m.set(P, { "R1|a": conv(), "R1|b": conv() });
    magasin.m.set("mots.oppositions", [{ x: 1 }]);
    magasin.m.set("parcours.oppositions.site", { y: 2 });
    await douterDossier("R1", () => conv());
    expect(Object.keys(magasin.m.get(P) as object)).toHaveLength(2);
    expect(magasin.ecrits).toEqual([P]);
    expect(magasin.m.get("mots.oppositions")).toEqual([{ x: 1 }]);
    expect(magasin.m.get("parcours.oppositions.site")).toEqual({ y: 2 });
  });
  it("dossier fait que d'entrées « oppose » : rien n'est écrit", async () => {
    magasin.m.set(P, { "R1|o": conv({ etat: "oppose" }) });
    expect(await douterDossier("R1", () => conv())).toEqual([]);
    expect(magasin.ecrits).toEqual([]);
  });
});
