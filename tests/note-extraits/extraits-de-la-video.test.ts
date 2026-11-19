/**
 * X4-13b-a : lecture serveur des propriétés de la ligne « Extraits gardés » (aucun appelant).
 * Ports espions, aucun dépôt réel. Éteint = rien lu de plus, rendu vide.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ExtraitsDeLaVideo } from "@/components/bibliotheque/ExtraitsDeLaVideo";
import type { FicheSourceExtraits, PlageExtrait } from "@/domaine/archive-extraits";
import { LIEN_EXTRAITS, proprietesExtraitsDeLaVideo } from "@/services/extraits-de-la-video";

const plage = (id: string, o: Partial<PlageExtrait> = {}): PlageExtrait => ({
  id, debutSec: 0, finSec: 5, texte: "x", motsCles: [], avecVisage: false, texteIncruste: false, etat: "utilisable", ...o,
});
const fiche: FicheSourceExtraits = {
  videoId: "v1", versionId: "ver1", sortieId: "s1", ratio: "9:16",
  licence: { type: "propriete", usageCommercial: true, reseaux: [] } as unknown as FicheSourceExtraits["licence"],
  famille: [],
  plages: [plage("a", { note: 80 }), plage("b", { note: 65 }), plage("c", { note: 30 })],
  rangee: true, sourcePreferee: false,
};
const reglages = (valeurs: Record<string, unknown>) =>
  vi.fn(async (id: string, defaut: unknown) => (id in valeurs ? valeurs[id] : defaut));
const INSCRIPTION = "bibliothequeVideo.archive.inscription";
const NOTE = "archiveExtraits.noteInteret";
const rendre = (p: Awaited<ReturnType<typeof proprietesExtraitsDeLaVideo>>) =>
  renderToStaticMarkup(createElement(ExtraitsDeLaVideo, p));

afterEach(() => vi.restoreAllMocks());

describe("proprietesExtraitsDeLaVideo", () => {
  it.each([["absent", {}], ["false", { [INSCRIPTION]: false }], ["chaîne", { [INSCRIPTION]: "true" }]])(
    "archive éteinte (%s) → rien, une seule lecture",
    async (_n, valeurs) => {
      const lire = reglages(valeurs);
      const f = vi.fn(async () => fiche);
      const p = await proprietesExtraitsDeLaVideo("v1", { lire, fiche: f });
      expect(p).toMatchObject({ fiche: null, archiveActive: false, noteActive: false, seuilGarde: 60, lien: LIEN_EXTRAITS });
      expect(lire).toHaveBeenCalledTimes(1);
      expect(f).not.toHaveBeenCalled();
      expect(rendre(p)).toBe("");
    },
  );

  it("archive : lecture qui lève → éteint", async () => {
    const lire = vi.fn(async () => { throw new Error("panne"); });
    const f = vi.fn(async () => fiche);
    const p = await proprietesExtraitsDeLaVideo("v1", { lire, fiche: f });
    expect(p.archiveActive).toBe(false);
    expect(p.fiche).toBeNull();
    expect(lire).toHaveBeenCalledTimes(1);
    expect(f).not.toHaveBeenCalled();
    expect(rendre(p)).toBe("");
  });

  it("archive allumée, note éteinte → fiche non lue, rendu vide", async () => {
    const f = vi.fn(async () => fiche);
    const p = await proprietesExtraitsDeLaVideo("v1", { lire: reglages({ [INSCRIPTION]: true }), fiche: f });
    expect(p).toMatchObject({ fiche: null, archiveActive: true, noteActive: false });
    expect(f).not.toHaveBeenCalled();
    expect(rendre(p)).toBe("");
  });

  it("les deux allumées → fiche transmise, seuil 60, rendu avec 2 et le lien", async () => {
    const f = vi.fn(async () => fiche);
    const p = await proprietesExtraitsDeLaVideo("v1", { lire: reglages({ [INSCRIPTION]: true, [NOTE]: true }), fiche: f });
    expect(p).toMatchObject({ fiche, archiveActive: true, noteActive: true, seuilGarde: 60, lien: "/bibliotheque/source-extraits" });
    expect(f).toHaveBeenCalledWith("v1");
    const html = rendre(p);
    expect(html).toContain(">2<");
    expect(html).toContain('href="/bibliotheque/source-extraits"');
  });

  it("seuil personnalisé 80", async () => {
    const lire = reglages({ [INSCRIPTION]: true, [NOTE]: { actif: true, seuils: { garde: 80, peutEtre: 40, gardesMax: 8 } } });
    const p = await proprietesExtraitsDeLaVideo("v1", { lire, fiche: async () => fiche });
    expect(p.seuilGarde).toBe(80);
  });

  it("fiche qui lève → fiche nulle, avertissement, aucune exception", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const p = await proprietesExtraitsDeLaVideo("v1", {
      lire: reglages({ [INSCRIPTION]: true, [NOTE]: true }),
      fiche: async () => { throw new Error("lecture"); },
    });
    expect(p.fiche).toBeNull();
    expect(p.archiveActive).toBe(true);
    expect(warn).toHaveBeenCalled();
  });
});

describe("garde statique", () => {
  const racine = join(__dirname, "..", "..");
  const source = readFileSync(join(racine, "src", "services", "extraits-de-la-video.ts"), "utf8");
  it("n'importe aucune zone interdite", () => {
    const imports = source.split("\n").filter((l) => /^\s*(import|export)\b.*from\s/.test(l)).join("\n");
    for (const interdit of ["publications", "fabrication", "reglages", "travaux", "@/components"]) {
      expect(imports).not.toContain(interdit);
    }
  });
  it("seule la page de la vidéo l'importe", () => {
    const parcourir = (d: string): string[] =>
      readdirSync(d).flatMap((n) => {
        const c = join(d, n);
        return statSync(c).isDirectory() ? parcourir(c) : /\.(ts|tsx)$/.test(n) ? [c] : [];
      });
    const trouves = parcourir(join(racine, "src", "app")).filter((c) => readFileSync(c, "utf8").includes("extraits-de-la-video"));
    const rel = (c: string) => c.slice(racine.length + 1).split("\\").join("/");
    expect(trouves.map(rel)).toEqual(["src/app/(studio)/videos/[id]/page.tsx"]);
  });
});
