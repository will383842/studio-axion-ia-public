import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { engagementVideo, type EntreeEngagement } from "@/domaine/engagement-video";

const base = (o: Partial<EntreeEngagement> = {}): EntreeEngagement => ({
  video: { id: "v1", statut: "prete", etapeEditoriale: "a_relire" },
  versionChoisieId: "ver2",
  sortieIdCourante: "s2",
  publications: [],
  creneaux: [],
  envois: [],
  ...o,
});

describe("engagementVideo (G6-05)", () => {
  it("brouillon sans lien : non engagée", () => {
    const r = engagementVideo(base({ video: { id: "v1", statut: "brouillon" } }));
    expect(r).toEqual({ engagee: false, raisons: [], liensPerimes: [] });
  });
  it("listes vides : non engagée", () => {
    expect(engagementVideo(base()).engagee).toBe(false);
  });
  it.each(["validee", "programmee", "publiee"] as const)("étape %s : engagée", (etape) => {
    const r = engagementVideo(base({ video: { id: "v1", statut: "prete", etapeEditoriale: etape } }));
    expect(r.engagee).toBe(true);
    expect(r.raisons.length).toBe(1);
  });
  it("publication programmée sur l'ancienne sortie : engagée + lien périmé", () => {
    const r = engagementVideo(base({ publications: [{ id: "p1", statut: "programmee", sortieId: "s1", via: "buffer" }] }));
    expect(r.engagee).toBe(true);
    expect(r.liensPerimes).toEqual([{ type: "publication", id: "p1", raison: expect.any(String) }]);
  });
  it("publication programmée sur la sortie courante : engagée, pas périmée", () => {
    const r = engagementVideo(base({ publications: [{ id: "p1", statut: "publiee", sortieId: "s2" }] }));
    expect(r.engagee).toBe(true);
    expect(r.liensPerimes).toEqual([]);
  });
  it("publication simulation jamais comptée comme programmée (AV2.4-4)", () => {
    const r = engagementVideo(base({ publications: [{ id: "p1", statut: "programmee", sortieId: "s1", via: "simulation" }] }));
    expect(r).toEqual({ engagee: false, raisons: [], liensPerimes: [] });
  });
  it("publication brouillon ou en échec : pas engagée", () => {
    const r = engagementVideo(base({ publications: [{ id: "a", statut: "brouillon" }, { id: "b", statut: "echec" }] }));
    expect(r.engagee).toBe(false);
  });
  it("créneau validé/programmé et envoi programmé/confirmé : engagée", () => {
    expect(engagementVideo(base({ creneaux: [{ id: "c", statut: "valide" }] })).engagee).toBe(true);
    expect(engagementVideo(base({ creneaux: [{ id: "c", statut: "programmé" }] })).engagee).toBe(true);
    expect(engagementVideo(base({ envois: [{ id: "e", statut: "programme" }] })).engagee).toBe(true);
    expect(engagementVideo(base({ envois: [{ id: "e", statut: "confirmé" }] })).engagee).toBe(true);
    expect(engagementVideo(base({ envois: [{ id: "e", statut: "brouillon" }] })).engagee).toBe(false);
  });
  it("créneau ou envoi sur une autre version : lien périmé", () => {
    const r = engagementVideo(base({
      creneaux: [{ id: "c", statut: "valide", versionId: "ver1" }],
      envois: [{ id: "e", statut: "confirme", versionId: "ver2" }, { id: "f", statut: "programme", versionId: "ver1" }],
    }));
    expect(r.liensPerimes.map((l) => `${l.type}:${l.id}`)).toEqual(["creneau:c", "envoi:f"]);
  });
  it("sans sortie courante, aucune publication n'est dite périmée", () => {
    const r = engagementVideo(base({ sortieIdCourante: undefined, publications: [{ id: "p", statut: "programmee", sortieId: "s1" }] }));
    expect(r.liensPerimes).toEqual([]);
  });
  it("pure : n'altère pas l'entrée", () => {
    const e = base({ publications: [{ id: "p", statut: "programmee", sortieId: "s1" }] });
    const copie = JSON.stringify(e);
    engagementVideo(e);
    expect(JSON.stringify(e)).toBe(copie);
  });
  it("garde statique : aucun import interdit", () => {
    const src = readFileSync("src/domaine/engagement-video.ts", "utf8");
    const imports = src.split("\n").filter((l) => /^\s*(import|export)\b.*\bfrom\b/.test(l) || /require\(|import\(/.test(l));
    for (const l of imports) expect(l).not.toMatch(/calendrier|publications|zernio|buffer|cadence/i);
  });
});
