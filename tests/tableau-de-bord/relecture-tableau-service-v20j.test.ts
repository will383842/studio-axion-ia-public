import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ouvrirRelectureTableau, validerRelectureTableau } from "@/services/tableau-de-bord-relecture";
import type { ResultatLectureCaptureClaude } from "@/services/lecture-capture-claude";
import type { TableauDeBord } from "@/briques/donnees-video/types";

const image = { base64: "AAAA", type: "image/png" as const, largeur: 800, hauteur: 600 };

const brouillon = {
  version: "tableau-de-bord.v1",
  titre: "Tableau de bord",
  periode: { debut: "2026-10-01", fin: "2026-10-31", libelle: "Octobre" },
  source: "Capture",
  indicateurs: [{ id: "visites", libelle: "Visites", valeur: 120, unite: "visites", precision: 0, sens: "hausse-bonne" }],
  series: [{ id: "jour", libelle: "Par jour", unite: "visites", points: [{ x: "1", valeur: 10 }, { x: "2", valeur: 12 }] }],
  comparaisons: [],
  alertes: [],
  calculs: [],
} as unknown as TableauDeBord;
const aRelire = [
  { cle: "indicateur:visites", libelle: "Visites", valeur: 120, unite: "visites" },
  { cle: "point:jour:0", libelle: "Par jour · 1", valeur: 10, unite: "visites" },
  { cle: "point:jour:1", libelle: "Par jour · 2", valeur: 12, unite: "visites" },
];
const lecture: ResultatLectureCaptureClaude = { ok: true, brouillon, aRelire, source: "claude" };
const tout = (type: "valide" | "refuse" = "valide") => Object.fromEntries(aRelire.map((c) => [c.cle, { type }]));

describe("G4-08-b1 · ouvrirRelectureTableau", () => {
  it("a) lecture réussie : relecture avec le brouillon et les chiffres rendus par la lecture", async () => {
    const r = await ouvrirRelectureTableau("v1", image, "studio", { lireCapture: async () => lecture });
    expect(r).toEqual({ etape: "relecture", brouillon, aRelire });
  });

  it("b) repli saisie manuelle : rendu tel quel, raison comprise", async () => {
    const r = await ouvrirRelectureTableau("v1", image, "studio", { lireCapture: async () => ({ ok: false, repli: "saisie-manuelle", raison: "Éteint. Saisis à la main." }) });
    expect(r).toEqual({ etape: "saisie-manuelle", raison: "Éteint. Saisis à la main." });
  });

  it("c) UN seul appel, avec videoId, image, origine et deps inchangés ; une exception donne saisie-manuelle", async () => {
    const lireCapture = vi.fn(async () => lecture);
    const deps = { lireCapture, taux: async () => 1 };
    await ouvrirRelectureTableau("v7", image, "usine", deps);
    expect(lireCapture).toHaveBeenCalledTimes(1);
    expect(lireCapture.mock.calls[0]).toEqual(["v7", image, "usine", deps]);

    const echec = vi.fn(async () => {
      throw new Error("panne");
    });
    const r = await ouvrirRelectureTableau("v7", image, "studio", { lireCapture: echec });
    expect(echec).toHaveBeenCalledTimes(1);
    expect(r).toEqual({ etape: "saisie-manuelle", raison: "La lecture n'a pas abouti : rien n'a été payé en plus. Saisis les chiffres à la main." });
  });
});

describe("G4-08-b1 · validerRelectureTableau", () => {
  it("d) chiffre corrigé : valeur remplacée", () => {
    const r = validerRelectureTableau(brouillon, { ...tout(), "indicateur:visites": { type: "corrige", valeur: 130 } });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.donnee.indicateurs[0]?.valeur).toBe(130);
  });
  it("d) chiffre refusé : ok false avec raison ; chiffre non relu : ok false", () => {
    const refus = validerRelectureTableau(brouillon, tout("refuse"));
    expect(refus.ok).toBe(false);
    if (!refus.ok) expect(refus.raisons.length).toBeGreaterThan(0);
    const partiel = validerRelectureTableau(brouillon, { "indicateur:visites": { type: "valide" } });
    expect(partiel.ok).toBe(false);
    if (!partiel.ok) expect(partiel.raisons[0]).toMatch(/pas encore relu/);
  });
});

describe("G4-08-b1 · gardes statiques", () => {
  const racine = join(__dirname, "..", "..");
  const chemin = join(racine, "src", "services", "tableau-de-bord-relecture.ts");
  const source = readFileSync(chemin, "utf8");

  it("e) server-only, aucun réglage lu, aucun montant en dur, aucun fournisseur ni module d'argent", () => {
    expect(source).toMatch(/import "server-only"/);
    expect(source).not.toMatch(/lireParametre/);
    expect(source).not.toMatch(/\d+\s*(€|eur|usd|\$)/i);
    const imports = [...source.matchAll(/(?:from|import)\s+["']([^"']+)["']/g)].map((m) => m[1]);
    for (const i of imports) expect(i).not.toMatch(/@\/fournisseurs\/|generation-claude|depense-claude-|credits/);
  });

  it("f) rien dans src/ n'importe tableau-de-bord-relecture (monté nulle part)", () => {
    const trouves: string[] = [];
    const parcourir = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) parcourir(p);
        else if (/\.(ts|tsx|mjs|js)$/.test(n) && p !== chemin && /tableau-de-bord-relecture/.test(readFileSync(p, "utf8"))) trouves.push(p);
      }
    };
    parcourir(join(racine, "src"));
    expect(trouves).toEqual([join(racine, "src", "app", "(studio)", "videos", "actions-tableau-de-bord.ts")]);
  });
});
