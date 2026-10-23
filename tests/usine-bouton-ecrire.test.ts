/** Idées jugées : le bouton « Écrire » n'est offert que si l'idée a des `parts` et que l'Usine l'offre encore. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { VueIdeesUsine } from "@/components/ecrire/VueIdeesUsine";
import { boutonEcrireOffert, ideeDuComite, perimetreCouvre, type IdeeDuComite, type IdeeUsine } from "@/domaine/usine";

describe("boutonEcrireOffert", () => {
  const avec = { signature: "a", parts: { metier: "m" } };
  it("offert avec des parts, tant que la porte n'a pas répondu ou qu'elle offre la signature", () => {
    expect(boutonEcrireOffert(avec)).toBe(true);
    expect(boutonEcrireOffert(avec, new Set(["a", "b"]))).toBe(true);
  });
  it("retiré sans parts", () => {
    expect(boutonEcrireOffert({ signature: "a", parts: {} })).toBe(false);
    expect(boutonEcrireOffert({ signature: "a", parts: {} }, new Set(["a"]))).toBe(false);
    expect(boutonEcrireOffert(ideeDuComite({ signature: "a", idee: "x", textes: {}, raison: "r" }))).toBe(false);
  });
  it("retiré si la signature n'est plus dans la dernière réponse de la porte", () => {
    expect(boutonEcrireOffert(avec, new Set(["b"]))).toBe(false);
  });
  it("signature absente mais combinaison hors du périmètre couvert : le bouton reste", () => {
    expect(boutonEcrireOffert(avec, new Set(["b"]), false)).toBe(true);
  });
});

describe("perimetreCouvre", () => {
  const f = { metiers: ["plomb"], tailles: ["TPE"] };
  it("couverte si métier et taille sont dans les filtres, ou filtres vides", () => {
    expect(perimetreCouvre({ metier: "plomb", taille: "TPE" }, f)).toBe(true);
    expect(perimetreCouvre({ metier: "x" }, { metiers: [], tailles: [] })).toBe(true);
  });
  it("non couverte pour un autre métier ou une autre taille, ou une part inconnue", () => {
    expect(perimetreCouvre({ metier: "coiff", taille: "TPE" }, f)).toBe(false);
    expect(perimetreCouvre({ metier: "plomb", taille: "PME" }, f)).toBe(false);
    expect(perimetreCouvre({ metier: "plomb", taille: null }, f)).toBe(false);
  });
});

describe("carte d'une idée retenue", () => {
  const brute: IdeeUsine = { signature: "autre", parts: { m: "x" }, metier: "Plombier", taille: "TPE", douleur: "Douleur brute", casUsage: "" };
  const retenue = ideeDuComite({ signature: "a", parts: { m: "x" }, idee: "i", textes: { douleur: "Douleur retenue" }, raison: "r" });
  const vue = (idees: IdeeUsine[]) =>
    renderToStaticMarkup(createElement(VueIdeesUsine, { filtres: { metiers: [], tailles: [], reseaux: [] }, onFiltres: () => {}, metiers: [], idees, enCours: false, ecritureEn: null, erreur: null, onProposer: () => {}, onEcrire: () => {}, comite: { retenues: [retenue], ecartees: [] } }));
  const vueFiltree = (idees: IdeeUsine[], r: IdeeDuComite, metiers: string[], tailles: string[]) =>
    renderToStaticMarkup(createElement(VueIdeesUsine, { filtres: { metiers, tailles, reseaux: [] }, onFiltres: () => {}, metiers: [], idees, enCours: false, ecritureEn: null, erreur: null, onProposer: () => {}, onEcrire: () => {}, comite: { retenues: [r], ecartees: [] } }));
  const brutePlomb: IdeeUsine = { ...brute, parts: { metier: "plomb", taille: "TPE" } };
  it("(a) idée retenue d'un autre métier que celui filtré : le bouton reste", () => {
    const r = ideeDuComite({ signature: "a", parts: { metier: "coiff", taille: "TPE" }, idee: "i", textes: {}, raison: "r" });
    const html = vueFiltree([brutePlomb], r, ["plomb"], []);
    expect(html).not.toContain("Plus disponible");
    expect(html).toContain("Écrire ce sujet");
  });
  it("(b) même métier et même taille, signature absente : « Plus disponible »", () => {
    const r = ideeDuComite({ signature: "a", parts: { metier: "plomb", taille: "TPE" }, idee: "i", textes: {}, raison: "r" });
    expect(vueFiltree([brutePlomb], r, ["plomb"], ["TPE"])).toContain("Plus disponible");
  });
  it("(c) sans parts : « Plus disponible »", () => {
    const r = ideeDuComite({ signature: "a", idee: "i", textes: {}, raison: "r" });
    expect(vueFiltree([brutePlomb], r, ["plomb"], [])).toContain("Plus disponible");
  });
  it("« Plus disponible » quand la porte ne l'offre plus, le bouton sinon", () => {
    expect(vue([brute])).toContain("Plus disponible");
    expect(vue([])).not.toContain("Plus disponible");
    expect(vue([{ ...brute, signature: "a" }])).not.toContain("Plus disponible");
  });
});
