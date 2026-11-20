/**
 * S-12-BOUCLE-PURE-v20l : « regard → UNE page refaite → second regard » en module pur, ports injectés. 0 €, aucun appel.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { CodeDefautVu, VerdictRegard } from "../../../src/briques/regardeur";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { boucleDuRegard, type PortsBoucleRegard } from "../../../src/moteurs/montage-tableau/boucle-regard";
import { suiteDuRegard } from "../../../src/moteurs/montage-tableau/reprise-du-regard";
import { pageDePlus } from "../../../src/moteurs/montage-tableau/densite";

const temoin = JSON.parse(readFileSync(new URL("../temoins/blocage-fin-tiktok-2026-10-14.json", import.meta.url), "utf8")) as { ficheCalee: FicheTableau };
const fiche: FicheTableau = { ...structuredClone(temoin.ficheCalee), scenes: structuredClone(temoin.ficheCalee.scenes.filter((s) => s.page <= 4)) };
const dit = (f: FicheTableau) => f.scenes.map((s) => s.texteDit).join(" ");

const verdict = (...d: [CodeDefautVu, string | null][]): VerdictRegard =>
  ({
    defauts: d.map(([code, partieId], k) => ({ code, partieId, nom: `i0${k + 1}`, detail: code })),
    relues: 5,
    nonRelues: d.filter(([c]) => c === "non-relue").length,
    partiesFautives: [...new Set(d.flatMap(([, p]) => (p ? [p] : [])))],
  }) as unknown as VerdictRegard;

function monter(verdicts: (VerdictRegard | Error)[], extra: Partial<PortsBoucleRegard> = {}) {
  const regarder = vi.fn(async (_f: FicheTableau, rang: 1 | 2) => {
    const v = verdicts[rang - 1];
    if (v instanceof Error) throw v;
    return v ?? verdict();
  });
  const refaire = vi.fn(async (f: FicheTableau, pages: number[]) => {
    let c = f;
    for (const p of pages) c = pageDePlus(c, p) ?? c;
    return c;
  });
  const voix = vi.fn();
  const ports: PortsBoucleRegard = { regarder, suite: suiteDuRegard, refaire, ...extra };
  return { ports, regarder, refaire, voix };
}

describe("boucle du regard (S-12-BOUCLE-PURE-v20l)", () => {
  it("aucun défaut : 1 regard, rien refait", async () => {
    const m = monter([verdict()]);
    const r = await boucleDuRegard(fiche, m.ports);
    expect(r).toMatchObject({ regards: 1, refaites: 0, arret: "rien" });
    expect(r.fiche).toBe(fiche);
    expect(m.refaire).not.toHaveBeenCalled();
  });

  it("texte coupé page 3 : 1 page refaite, 2e regard, arrêt ; mots inchangés, voix jamais appelée", async () => {
    const m = monter([verdict(["texte-coupe", "page-3"]), verdict()]);
    const r = await boucleDuRegard(fiche, m.ports);
    expect(r).toMatchObject({ regards: 2, refaites: 1 });
    expect(m.refaire).toHaveBeenCalledTimes(1);
    expect(m.refaire).toHaveBeenCalledWith(fiche, [3]);
    expect(dit(r.fiche)).toBe(dit(fiche));
    expect(m.voix).not.toHaveBeenCalled();
  });

  it("2e regard encore fautif : on s'arrête, jamais de 2e page refaite ni de 3e regard", async () => {
    const m = monter([verdict(["texte-coupe", "page-3"]), verdict(["texte-coupe", "page-2"])]);
    const r = await boucleDuRegard(fiche, m.ports);
    expect(r).toMatchObject({ regards: 2, refaites: 1, arret: "rendre" });
    expect(m.regarder).toHaveBeenCalledTimes(2);
    expect(m.refaire).toHaveBeenCalledTimes(1);
  });

  it("« phrase-non-choisie » ou « fin-absente » : arrêt tout de suite, 1 regard, rien refait", async () => {
    for (const code of ["phrase-non-choisie", "fin-absente"] as const) {
      const m = monter([verdict([code, null], ["texte-coupe", "page-3"])]);
      const r = await boucleDuRegard(fiche, m.ports);
      expect(r).toMatchObject({ regards: 1, refaites: 0, arret: "rendre" });
      expect(m.refaire).not.toHaveBeenCalled();
    }
  });

  it("panne de `refaire` : la vidéo d'avant est gardée avec sa remarque, 1 regard", async () => {
    const m = monter([verdict(["texte-coupe", "page-3"])], { refaire: async () => { throw new Error("rendu en panne"); } });
    const r = await boucleDuRegard(fiche, m.ports);
    expect(r.fiche).toBe(fiche);
    expect(r).toMatchObject({ regards: 1, refaites: 0, arret: "refaire-en-panne" });
    expect(r.raisons.length).toBeGreaterThan(0);
  });

  it("`refaire` qui change les mots : refusé, la vidéo d'avant est gardée", async () => {
    const m = monter([verdict(["texte-coupe", "page-3"])], {
      refaire: async (f) => ({ ...structuredClone(f), scenes: f.scenes.map((s, i) => (i === 0 ? { ...s, texteDit: `${s.texteDit} en plus` } : s)) }),
    });
    const r = await boucleDuRegard(fiche, m.ports);
    expect(r.fiche).toBe(fiche);
    expect(r).toMatchObject({ refaites: 0, arret: "mots-changes" });
  });

  it("panne du regard : on rend la vidéo telle quelle, jamais d'exception", async () => {
    const m = monter([new Error("regard en panne")]);
    const r = await boucleDuRegard(fiche, m.ports);
    expect(r).toMatchObject({ regards: 0, refaites: 0, arret: "regard-en-panne" });
    expect(r.fiche).toBe(fiche);
  });

  it("panne du 2e regard : la fiche refaite est gardée, 1 seule page refaite", async () => {
    const m = monter([verdict(["texte-coupe", "page-3"]), new Error("2e regard en panne")]);
    const r = await boucleDuRegard(fiche, m.ports);
    expect(r).toMatchObject({ refaites: 1, arret: "second-regard-en-panne" });
    expect(m.refaire).toHaveBeenCalledTimes(1);
  });

  it("énumération : aucune suite de verdicts ne produit plus de 2 regards ni plus d'1 refaite", async () => {
    const codes: CodeDefautVu[] = ["phrase-non-choisie", "fin-absente", "page-vide", "texte-coupe", "hors-cadre", "desynchro", "noire", "illisible", "non-relue"];
    const pages = ["page-1", "page-2", "page-3", "page-4", null];
    const possibles: VerdictRegard[] = [verdict()];
    for (const c of codes) for (const p of pages) possibles.push(verdict([c, p]));
    possibles.push(verdict(["texte-coupe", "page-3"], ["hors-cadre", "page-4"]), verdict(["texte-coupe", "page-3"], ["fin-absente", null]));
    let cas = 0;
    for (const v1 of possibles)
      for (const v2 of possibles) {
        const m = monter([v1, v2]);
        const r = await boucleDuRegard(fiche, m.ports);
        expect(m.regarder.mock.calls.length).toBeLessThanOrEqual(2);
        expect(m.refaire.mock.calls.length).toBeLessThanOrEqual(1);
        expect(r.regards).toBeLessThanOrEqual(2);
        expect(r.refaites).toBeLessThanOrEqual(1);
        expect(dit(r.fiche)).toBe(dit(fiche));
        cas++;
      }
    expect(cas).toBe(possibles.length ** 2);
  });

  it("éteint : aucun importeur dans src/**, la fiche d'entrée reste intacte", async () => {
    const avant = structuredClone(fiche);
    await boucleDuRegard(fiche, monter([verdict(["texte-coupe", "page-3"]), verdict()]).ports);
    expect(fiche).toEqual(avant);
    const racine = new URL("../../../src", import.meta.url).pathname;
    const fichiers: string[] = [];
    const parcourir = (d: string) => { for (const n of readdirSync(d)) { const f = join(d, n); if (statSync(f).isDirectory()) parcourir(f); else if (/\.(ts|tsx)$/.test(n)) fichiers.push(f); } };
    parcourir(racine);
    expect(fichiers.filter((f) => !f.endsWith("boucle-regard.ts") && readFileSync(f, "utf8").includes("boucle-regard"))).toEqual([]);
    const source = readFileSync(new URL("../../../src/moteurs/montage-tableau/boucle-regard.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/from "[^"]*(reprise-du-regard|regardeur-tableau)"/);
    expect(source).not.toContain("server-only");
  });
});
