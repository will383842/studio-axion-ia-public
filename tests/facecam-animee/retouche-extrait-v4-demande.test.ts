/**
 * R4-03-d1 : le service qui relit la demande « changer un extrait », la lie à la version choisie et lance la retouche.
 * Doubles injectés (`lancer`, `lireVideo`), aucun appel réel, 0 €. Rien dans `src/**` n'importe le service.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { demanderRetoucheExtraitV4 } = await import("@/services/retouche-extrait-v4-demande");

const REMPLACER = { action: "remplacer", rang: 0, recherche: "dirigeant devis" };
const ENTREES = { facecamAnimee: { priseCle: "prise/k.mov" }, facecam: { a: 1 }, retoucheExtraitV4: { action: "retirer", rang: 9 } };
const VERSION = { id: "ver-3", commande: { entrees: ENTREES } };
const lireVideo = async () => VERSION;
const lancerOk = () => vi.fn(async () => ({ retoucheId: "r1", travailId: "t1" }));

describe("R4-03-d1 · demanderRetoucheExtraitV4", () => {
  it("a) éteint (false) ou qui lève : refusée, lancer jamais appelé", async () => {
    for (const actif of [async () => false, async () => { throw new Error("boum"); }]) {
      const lancer = lancerOk();
      const r = await demanderRetoucheExtraitV4("v1", REMPLACER, { actif, lancer, lireVideo });
      expect(r).toEqual({ statut: "refusee", raison: "retouche d'extrait éteinte" });
      expect(lancer).not.toHaveBeenCalled();
    }
  });

  it("b) demande illisible : refusée, lancer jamais appelé", async () => {
    for (const d of [null, undefined, {}, { action: "remplacer", rang: 0 }, { action: "retirer", rang: -1 }, "x"]) {
      const lancer = lancerOk();
      const r = await demanderRetoucheExtraitV4("v1", d, { actif: async () => true, lancer, lireVideo });
      expect(r.statut).toBe("refusee");
      expect(lancer).not.toHaveBeenCalled();
    }
  });

  it("vidéo ou version choisie absente : refusée, lancer jamais appelé", async () => {
    const lancer = lancerOk();
    const r = await demanderRetoucheExtraitV4("v1", REMPLACER, { actif: async () => true, lancer, lireVideo: async () => null });
    expect(r.statut).toBe("refusee");
    expect(lancer).not.toHaveBeenCalled();
  });

  it("c) cas normal : lancer une fois, planIds [], entrées de la version choisie + demande relue + pourVersionId", async () => {
    const lancer = lancerOk();
    const r = await demanderRetoucheExtraitV4("v1", { ...REMPLACER, recherche: "  dirigeant devis  " }, { actif: async () => true, lancer, lireVideo });
    expect(r).toEqual({ statut: "lancee", travailId: "t1" });
    expect(lancer).toHaveBeenCalledTimes(1);
    const [videoId, planIds, consigne, options] = lancer.mock.calls[0] as unknown as [string, string[], string, { entrees: Record<string, unknown> }];
    expect(videoId).toBe("v1");
    expect(planIds).toEqual([]);
    expect(typeof consigne).toBe("string");
    const { retoucheExtraitV4, ...reste } = options.entrees;
    const { retoucheExtraitV4: _ancienne, ...resteVersion } = ENTREES;
    void _ancienne;
    expect(JSON.stringify(reste)).toBe(JSON.stringify(resteVersion));
    expect((reste.facecamAnimee as { priseCle: string }).priseCle).toBe("prise/k.mov");
    expect(retoucheExtraitV4).toEqual({ action: "remplacer", rang: 0, recherche: "dirigeant devis", pourVersionId: "ver-3" });
  });

  it("d) une ancienne retoucheExtraitV4 est remplacée, pas fusionnée", async () => {
    const lancer = lancerOk();
    await demanderRetoucheExtraitV4("v1", { action: "deplacer", rang: 1, debut: 2, fin: 4 }, { actif: async () => true, lancer, lireVideo });
    const { entrees } = (lancer.mock.calls[0] as unknown as [string, string[], string, { entrees: Record<string, unknown> }])[3];
    expect(entrees.retoucheExtraitV4).toEqual({ action: "deplacer", rang: 1, debut: 2, fin: 4, pourVersionId: "ver-3" });
  });

  it("version sans entrées : la demande part seule avec ses entrées vides", async () => {
    const lancer = lancerOk();
    await demanderRetoucheExtraitV4("v1", { action: "retirer", rang: 0 }, { actif: async () => true, lancer, lireVideo: async () => ({ id: "ver-1", commande: {} }) });
    const { entrees } = (lancer.mock.calls[0] as unknown as [string, string[], string, { entrees: Record<string, unknown> }])[3];
    expect(entrees).toEqual({ retoucheExtraitV4: { action: "retirer", rang: 0, pourVersionId: "ver-1" } });
  });

  it("e) lancer qui lève : l'erreur remonte telle quelle", async () => {
    const erreur = new Error("crédit insuffisant");
    const lancer = vi.fn(async () => { throw erreur; });
    await expect(demanderRetoucheExtraitV4("v1", REMPLACER, { actif: async () => true, lancer, lireVideo })).rejects.toBe(erreur);
  });
});

describe("R4-03-d1 · gardes statiques", () => {
  const src = readFileSync(join(__dirname, "..", "..", "src/services/retouche-extrait-v4-demande.ts"), "utf8");
  it("f) server-only, aucun réglage, aucun import de videos.ts, aucun chiffre d'argent", () => {
    expect(src).toContain('import "server-only"');
    expect(src).not.toMatch(/lireParametre/);
    expect(src).not.toMatch(/from\s+["'][^"']*\/videos["']/);
    expect(src).not.toMatch(/^import .*(credits|budget|depense|couts|plafond|fournisseurs)/m);
    expect(src).not.toMatch(/\d+\s*(€|eur|usd|\$)/i);
    expect(src).not.toContain('services/retouche-extrait-v4"');
  });
});
