import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { etapeApresRetouche, type EntreeEtapeApresRetouche } from "@/domaine/etape-apres-retouche";

const base = (o: Partial<EntreeEtapeApresRetouche> = {}): EntreeEtapeApresRetouche => ({
  video: { id: "v1", statut: "prete", etapeEditoriale: "a_relire" },
  versionChoisieId: "ver2",
  sortieIdCourante: "s2",
  publications: [],
  creneaux: [],
  envois: [],
  typeTravail: "retouche",
  ...o,
});

describe("etapeApresRetouche (G6-06, règle CAL-25)", () => {
  it("brouillon sans lien : a_relire, listes vides", () => {
    const r = etapeApresRetouche(base({ video: { id: "v1", statut: "brouillon" } }));
    expect(r.etape).toBe("a_relire");
    expect(r.creneauxARevalider).toEqual([]);
    expect(r.envoisARevalider).toEqual([]);
    expect(r.avertissements).toEqual([]);
  });
  it("étape validee sans créneau : a_relire, raison citée", () => {
    const r = etapeApresRetouche(base({ video: { id: "v1", statut: "prete", etapeEditoriale: "validee" } }));
    expect(r.etape).toBe("a_relire");
    expect(r.raisons.some((x) => x.includes("validee"))).toBe(true);
  });
  it("créneaux valide + programme + propose : seuls les deux premiers à revalider", () => {
    const r = etapeApresRetouche(base({ creneaux: [
      { id: "c1", statut: "valide" }, { id: "c2", statut: "programme" }, { id: "c3", statut: "propose" },
    ] }));
    expect(r.creneauxARevalider).toEqual(["c1", "c2"]);
  });
  it("envoi programme ou confirmé : à revalider ; brouillon non", () => {
    const r = etapeApresRetouche(base({ envois: [
      { id: "e1", statut: "programme" }, { id: "e2", statut: "confirmé" }, { id: "e3", statut: "brouillon" },
    ] }));
    expect(r.envoisARevalider).toEqual(["e1", "e2"]);
  });
  it("publication programmee sur ancienne sortie : un avertissement ; via simulation : aucun", () => {
    const p = { id: "p1", statut: "programmee", sortieId: "s1", via: "buffer" };
    const r = etapeApresRetouche(base({ publications: [p] }));
    expect(r.avertissements).toEqual([
      { publicationId: "p1", texte: "La publication p1 est programmée avec l'ancien fichier : à revoir avant son départ." },
    ]);
    const s = etapeApresRetouche(base({ publications: [{ ...p, via: "simulation" }] }));
    expect(s.avertissements).toEqual([]);
  });
  it("étape publiee : reste publiee (accord avec travaux.ts:261)", () => {
    const r = etapeApresRetouche(base({ video: { id: "v1", statut: "prete", etapeEditoriale: "publiee" } }));
    expect(r.etape).toBe("publiee");
    expect(r.raisons.length).toBeGreaterThan(0);
  });
  it("écart CAL-25 attendu (W3) : validee + créneau valide → créneau à revalider (travaux.ts ne le fait pas aujourd'hui)", () => {
    const r = etapeApresRetouche(base({
      video: { id: "v1", statut: "prete", etapeEditoriale: "validee" },
      creneaux: [{ id: "c1", statut: "valide" }],
    }));
    expect(r.etape).toBe("a_relire");
    expect(r.creneauxARevalider).toEqual(["c1"]);
  });
  it("pure : l'entrée n'est pas modifiée", () => {
    const e = base({ creneaux: [{ id: "c1", statut: "valide" }] });
    const copie = JSON.parse(JSON.stringify(e));
    etapeApresRetouche(e);
    expect(e).toEqual(copie);
  });
  it("garde statique : aucun import interdit", () => {
    const src = readFileSync("src/domaine/etape-apres-retouche.ts", "utf8");
    const imports = src.split("\n").filter((l) => /^\s*(import|export)\b.*\bfrom\b/.test(l)).join("\n");
    for (const interdit of ["calendrier", "publications", "zernio", "buffer", "cadence", "travaux", "@/services"]) {
      expect(imports).not.toContain(interdit);
    }
    expect(src).not.toMatch(/Date\.now\(/);
  });
});
