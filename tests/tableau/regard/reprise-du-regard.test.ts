import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CodeDefautVu, VerdictRegard } from "../../../src/briques/regardeur";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { suiteDuRegard } from "../../../src/moteurs/montage-tableau/reprise-du-regard";
import { pageDePlus } from "../../../src/moteurs/montage-tableau/densite";
import { textesEcransScene, textesEcrits } from "../../../src/moteurs/montage-tableau/regles";
import { texteDitDe } from "../../../src/moteurs/montage-tableau/variantes-fin";

const temoin = JSON.parse(readFileSync(new URL("../temoins/blocage-fin-tiktok-2026-10-14.json", import.meta.url), "utf8")) as { ficheCalee: FicheTableau };
const plein = temoin.ficheCalee;
// Le témoin est déjà au plafond de 6 pages : on garde ses 4 premières pages pour qu'il reste de la place.
const fiche: FicheTableau = { ...structuredClone(plein), scenes: structuredClone(plein.scenes.filter((s) => s.page <= 4)) };
const pagesDe = (f: FicheTableau) => Math.max(...f.scenes.map((s) => s.page));
const ecrits = (f: FicheTableau) => f.scenes.flatMap((s) => [...s.elements.flatMap(textesEcrits), ...textesEcransScene(s)]).sort();

const verdict = (...d: [CodeDefautVu, string | null][]): VerdictRegard => ({
  defauts: d.map(([code, partieId], k) => ({ code, partieId, nom: `i0${k + 1}`, detail: code === "texte-coupe" ? "texte coupé : « abc »" : code })),
  relues: 5, nonRelues: d.filter(([c]) => c === "non-relue").length, partiesFautives: [...new Set(d.flatMap(([, p]) => (p ? [p] : [])))],
}) as unknown as VerdictRegard;

describe("suiteDuRegard (S-12-TABLEAU-REPRISE-v19c)", () => {
  it("a) aucun défaut, ou seulement « non relue » : rien", () => {
    expect(suiteDuRegard(fiche, verdict(), { tour: 0 })).toEqual({ suite: "rien" });
    expect(suiteDuRegard(fiche, verdict(["non-relue", null]), { tour: 0 })).toEqual({ suite: "rien" });
  });

  it("b) texte coupé page 3 : refaire [3], mêmes mots, une page de plus", () => {
    const r = suiteDuRegard(fiche, verdict(["texte-coupe", "page-3"]), { tour: 0 });
    expect(r.suite).toBe("refaire");
    if (r.suite !== "refaire") return;
    expect(r.pages).toEqual([3]);
    expect(texteDitDe(r.fiche)).toBe(texteDitDe(fiche));
    expect(ecrits(r.fiche)).toEqual(ecrits(fiche));
    expect(pagesDe(r.fiche)).toBe(pagesDe(fiche) + 1);
  });

  it("c) pages 3 et 4 : les deux refaites, de la plus haute à la plus basse", () => {
    const r = suiteDuRegard(fiche, verdict(["texte-coupe", "page-3"], ["hors-cadre", "page-4"]), { tour: 0 });
    expect(r.suite).toBe("refaire");
    if (r.suite !== "refaire") return;
    expect(r.pages).toEqual([4, 3]);
    expect(pagesDe(r.fiche)).toBe(pagesDe(fiche) + 2);
    expect(texteDitDe(r.fiche)).toBe(texteDitDe(fiche));
  });

  it("d) phrase non choisie ou fin absente : rendre, même avec un texte coupé", () => {
    for (const code of ["phrase-non-choisie", "fin-absente"] as const) {
      const r = suiteDuRegard(fiche, verdict(["texte-coupe", "page-3"], [code, "page-1"]), { tour: 0 });
      expect(r.suite).toBe("rendre");
      if (r.suite === "rendre") expect(r.raisons.length).toBeGreaterThan(0);
    }
  });

  it("e) tour 1 : rendre", () => {
    const r = suiteDuRegard(fiche, verdict(["texte-coupe", "page-3"]), { tour: 1 });
    expect(r.suite).toBe("rendre");
  });

  it("f) page sans page de plus possible : rendre si seule, remarque sinon", () => {
    const pleine = plein;
    const seule = suiteDuRegard(pleine, verdict(["texte-coupe", `page-${pagesDe(pleine)}`]), { tour: 0 });
    expect(seule.suite).toBe("rendre");
    const sansPage = suiteDuRegard(fiche, verdict(["texte-coupe", "page-3"], ["texte-coupe", "page-99"]), { tour: 0 });
    expect(sansPage.suite).toBe("refaire");
    if (sansPage.suite === "refaire") { expect(sansPage.pages).toEqual([3]); expect(sansPage.remarques.length).toBeGreaterThan(0); }
  });

  it("g) désynchro seule : rendre, avec une raison", () => {
    const r = suiteDuRegard(fiche, verdict(["desynchro", "page-2"]), { tour: 0 });
    expect(r.suite).toBe("rendre");
    if (r.suite === "rendre") expect(r.raisons.length).toBeGreaterThan(0);
  });

  it("g bis) défaut non réparé ici en plus d'une page refaite : en remarque", () => {
    const r = suiteDuRegard(fiche, verdict(["texte-coupe", "page-3"], ["page-vide", "page-1"]), { tour: 0 });
    expect(r.suite).toBe("refaire");
    if (r.suite === "refaire") expect(r.remarques.length).toBeGreaterThan(0);
  });

  it("h) éteint = identique : fiche d'entrée intacte, aucun importeur dans src/**", () => {
    const avant = structuredClone(fiche);
    suiteDuRegard(fiche, verdict(["texte-coupe", "page-3"], ["texte-coupe", "page-4"]), { tour: 0 });
    suiteDuRegard(fiche, verdict(["desynchro", "page-2"]), { tour: 0 });
    expect(fiche).toEqual(avant);
    const racine = new URL("../../../src", import.meta.url).pathname;
    const fichiers: string[] = [];
    const parcourir = (d: string) => { for (const n of readdirSync(d)) { const f = join(d, n); if (statSync(f).isDirectory()) parcourir(f); else if (/\.(ts|tsx)$/.test(n)) fichiers.push(f); } };
    parcourir(racine);
    expect(fichiers.filter((f) => !f.endsWith("reprise-du-regard.ts") && readFileSync(f, "utf8").includes("reprise-du-regard"))).toEqual([]);
  });
});
