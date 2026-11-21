import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { garderRegard, RAISON_NON_RELUE } from "../../../src/moteurs/montage-tableau/garde-regard";

const video = (cle: string) => ({ cle, dureeSec: 30 });
const bonne = { imagesLues: 6, remarques: [] as { image: number; raison: string }[] };
const nonRelue = { imagesLues: 0, remarques: [{ image: 1, raison: RAISON_NON_RELUE }] };

describe("garderRegard (S-10-GARDE-A-v20l) : au plus 2 regards, sortie principale seulement", () => {
  it("a) sortie principale : les 2 premiers appels passent, le 3e n'appelle rien et répond « non relue »", async () => {
    const relecteur = vi.fn(async () => bonne);
    const garde = garderRegard(relecteur, { clePrincipale: "p.mp4" });
    expect(await garde({}, {}, video("p.mp4"))).toBe(bonne);
    expect(await garde({}, {}, video("p.mp4"))).toBe(bonne);
    expect(await garde({}, {}, video("p.mp4"))).toEqual(nonRelue);
    expect(await garde({}, {}, video("p.mp4"))).toEqual(nonRelue);
    expect(relecteur).toHaveBeenCalledTimes(2);
  });

  it("b) sortie non principale : 0 appel, « non relue », et le compteur n'avance pas", async () => {
    const relecteur = vi.fn(async () => bonne);
    const garde = garderRegard(relecteur, { clePrincipale: "p.mp4" });
    expect(await garde({}, {}, video("autre.mp4"))).toEqual(nonRelue);
    expect(await garde({}, {}, video("autre.mp4"))).toEqual(nonRelue);
    expect(await garde({}, {}, video("autre.mp4"))).toEqual(nonRelue);
    expect(relecteur).not.toHaveBeenCalled();
    expect(await garde({}, {}, video("p.mp4"))).toBe(bonne);
    expect(await garde({}, {}, video("p.mp4"))).toBe(bonne);
    expect(relecteur).toHaveBeenCalledTimes(2);
  });

  it("c) panne du relecteur : « non relue » (jamais « rien à signaler »), et l'appel compte", async () => {
    const relecteur = vi.fn().mockRejectedValueOnce(new Error("panne")).mockResolvedValue(bonne);
    const garde = garderRegard(relecteur, { clePrincipale: "p.mp4" });
    expect(await garde({}, {}, video("p.mp4"))).toEqual(nonRelue);
    expect(await garde({}, {}, video("p.mp4"))).toBe(bonne);
    expect(await garde({}, {}, video("p.mp4"))).toEqual(nonRelue);
    expect(relecteur).toHaveBeenCalledTimes(2);
  });

  it("d) appels simultanés : le compteur est pris avant l'attente, jamais plus de 2 appels réels", async () => {
    const relecteur = vi.fn(async () => bonne);
    const garde = garderRegard(relecteur, { clePrincipale: "p.mp4" });
    const r = await Promise.all([1, 2, 3, 4].map(() => garde({}, {}, video("p.mp4"))));
    expect(relecteur).toHaveBeenCalledTimes(2);
    expect(r.filter((x) => x === bonne)).toHaveLength(2);
    expect(r.filter((x) => x.imagesLues === 0)).toHaveLength(2);
  });

  it("e) chaque garde a son propre compteur (une garde par vidéo) et transmet fiche, mise en page et vidéo", async () => {
    const relecteur = vi.fn(async () => bonne);
    const f = { fiche: 1 }, m = { mep: 2 }, v = video("p.mp4");
    await garderRegard(relecteur, { clePrincipale: "p.mp4" })(f, m, v);
    expect(relecteur).toHaveBeenCalledWith(f, m, v);
    const g2 = garderRegard(relecteur, { clePrincipale: "p.mp4" });
    await g2({}, {}, v); await g2({}, {}, v);
    expect(relecteur).toHaveBeenCalledTimes(3);
  });

  it("f) relecteur synchrone accepté ; plafond personnalisé borné à 2", async () => {
    const sync = vi.fn(() => bonne);
    const g = garderRegard(sync, { clePrincipale: "p.mp4", maxAppels: 9 });
    await g({}, {}, video("p.mp4")); await g({}, {}, video("p.mp4"));
    expect(await g({}, {}, video("p.mp4"))).toEqual(nonRelue);
    expect(sync).toHaveBeenCalledTimes(2);
    const un = vi.fn(() => bonne);
    const g1 = garderRegard(un, { clePrincipale: "p.mp4", maxAppels: 1 });
    await g1({}, {}, video("p.mp4"));
    expect(await g1({}, {}, video("p.mp4"))).toEqual(nonRelue);
    expect(un).toHaveBeenCalledTimes(1);
  });

  it("g) éteint : aucun fichier de src n'importe garde-regard ; le module ne cite pas les textes interdits", () => {
    const racine = new URL("../../../src", import.meta.url).pathname;
    const fichiers: string[] = [];
    const parcourir = (d: string) => { for (const n of readdirSync(d)) { const f = join(d, n); if (statSync(f).isDirectory()) parcourir(f); else if (/\.(ts|tsx)$/.test(n)) fichiers.push(f); } };
    parcourir(racine);
    expect(fichiers.filter((f) => !f.endsWith("garde-regard.ts") && readFileSync(f, "utf8").includes("garde-regard"))).toEqual([]);
    const source = readFileSync(join(racine, "moteurs/montage-tableau/garde-regard.ts"), "utf8");
    expect(source).not.toContain("reprise-du-regard");
    expect(source).not.toContain('services/regardeur-tableau"');
    expect(source).not.toMatch(/^\s*import /m);
  });
});
