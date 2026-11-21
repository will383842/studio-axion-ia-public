import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { AVIS_COUT_MONTEUR, CLE_REGLAGE_PONT_MONTEUR, transmettreAuMonteur } from "@/services/retouche-chat/pont-monteur";

function deps(reglage: unknown, classique = true, discuter = vi.fn(async () => "ok")) {
  const lire = vi.fn(async (id: string) => {
    if (reglage === "lever") throw new Error("base");
    return id === CLE_REGLAGE_PONT_MONTEUR ? reglage : undefined;
  });
  return { lire, discuter, estFacecamClassique: vi.fn(async () => classique) };
}

describe("pont vers Mon monteur (C7-11-a)", () => {
  it("a) éteint : tout sauf true exact", async () => {
    for (const r of [undefined, false, "true", 1, "lever"]) {
      const d = deps(r);
      expect(await transmettreAuMonteur("v1", "salut", d)).toEqual({ statut: "eteint" });
      expect(d.discuter).not.toHaveBeenCalled();
    }
  });

  it("b) allumé mais autre générateur (ou lecture qui lève) → hors-format", async () => {
    const d = deps(true, false);
    expect(await transmettreAuMonteur("v1", "salut", d)).toEqual({ statut: "hors-format" });
    expect(d.discuter).not.toHaveBeenCalled();
    const d2 = { ...deps(true), estFacecamClassique: vi.fn(async () => { throw new Error("x"); }) };
    expect((await transmettreAuMonteur("v1", "salut", d2)).statut).toBe("hors-format");
    expect(d2.discuter).not.toHaveBeenCalled();
  });

  it("c) face caméra : un seul appel, deux arguments exacts, avis présent", async () => {
    const d = deps(true);
    const r = await transmettreAuMonteur("v1", "  coupe le début  ", d);
    expect(r).toEqual({ statut: "transmise", reponse: "ok", avis: AVIS_COUT_MONTEUR });
    expect(d.discuter).toHaveBeenCalledTimes(1);
    expect(d.discuter.mock.calls[0]).toEqual(["v1", "coupe le début"]);
    expect(AVIS_COUT_MONTEUR).not.toMatch(/\d|€|\$/);
  });

  it("d) 1 500 caractères → 1 000 ; espaces → vide", async () => {
    const d = deps(true);
    await transmettreAuMonteur("v1", "a".repeat(1500), d);
    expect((d.discuter.mock.calls[0] as unknown as string[])[1]).toHaveLength(1000);
    const d2 = deps(true);
    expect(await transmettreAuMonteur("v1", "   \n ", d2)).toEqual({ statut: "vide" });
    expect(d2.discuter).not.toHaveBeenCalled();
  });

  it("e) refus : aucun montant à l'écran, un seul essai", async () => {
    const d = deps(true, true, vi.fn(async () => { throw new Error("Plafond atteint : 1,50 €"); }));
    const r = await transmettreAuMonteur("v1", "salut", d);
    expect(r.statut).toBe("refusee");
    expect((r as { message: string }).message).not.toMatch(/\d|€/);
    expect(d.discuter).toHaveBeenCalledTimes(1);
    const d2 = deps(true, true, vi.fn(async () => { throw new Error("Écrivez ou dictez votre demande."); }));
    expect(await transmettreAuMonteur("v1", "x", d2)).toEqual({ statut: "refusee", message: "Écrivez ou dictez votre demande." });
    const d3 = deps(true, true, vi.fn(async () => { throw new Error("coûte 0.05 $"); }));
    expect((await transmettreAuMonteur("v1", "x", d3) as { message: string }).message).not.toMatch(/\d/);
  });

  it("f) gardes de texte : imports interdits, aucun importeur, pas de lireParametre", () => {
    const src = readFileSync("src/services/retouche-chat/pont-monteur.ts", "utf8");
    for (const interdit of ["monteur-facecam", "depense-claude-video", "./service", "./appliquer", "./rendu-generateurs"]) {
      expect(src).not.toMatch(new RegExp(`(?:from|import)\\s*\\(?\\s*["'][^"']*${interdit.replace(/[./]/g, "\\$&")}["']`));
    }
    expect(src).not.toContain("lireParametre(");
    const fichiers = (d: string): string[] =>
      readdirSync(d).flatMap((n) => {
        if (n === "node_modules") return [];
        const p = join(d, n);
        return statSync(p).isDirectory() ? fichiers(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
      });
    for (const f of fichiers("src")) {
      if (f.endsWith("pont-monteur.ts")) continue;
      expect(readFileSync(f, "utf8"), f).not.toMatch(/pont-monteur/);
    }
  });
});
