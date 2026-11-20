/** R4-03-d0 : petit panneau « Changer un extrait » (v4). Composant seul, monté nulle part, rien d'envoyé, 0 €. */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { demandeDuPanneauV4, PHRASES_PANNEAU_EXTRAITS_V4, type TelephonePanneauV4, type SourcePanneauV4 } from "@/components/formats/facecam-animee/extraits-v4";
import { PanneauExtraitsV4 } from "@/components/formats/facecam-animee/PanneauExtraitsV4";

const base = { rang: 2, recherche: "", sourceVideoId: "", debut: "", fin: "" };
const telephones: TelephonePanneauV4[] = [
  { rang: 1, libelle: "Téléphone du début", debut: 1, fin: 4 },
  { rang: 2, libelle: "Téléphone du milieu", debut: 6, fin: 9 },
];
const sources: SourcePanneauV4[] = [
  { videoId: "v1", titre: "Vidéo de mardi" },
  { videoId: "v2", titre: "Vidéo de jeudi" },
];
const rendre = (extra: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(PanneauExtraitsV4, { telephones, sources, surDemande: vi.fn(), ...extra }));

describe("demandeDuPanneauV4 (a)", () => {
  it("remplacer : forme exacte, sourceVideoId absent quand vide", () => {
    const r = demandeDuPanneauV4("remplacer", { ...base, recherche: "un plan de mardi" });
    expect(r).toEqual({ demande: { action: "remplacer", rang: 2, recherche: "un plan de mardi" } });
    expect(Object.keys((r as { demande: object }).demande).sort()).toEqual(["action", "rang", "recherche"]);
  });
  it("remplacer avec vidéo choisie", () => {
    expect(demandeDuPanneauV4("remplacer", { ...base, recherche: "x", sourceVideoId: "v1" })).toEqual({
      demande: { action: "remplacer", rang: 2, recherche: "x", sourceVideoId: "v1" },
    });
  });
  it("texte vide + vidéo : recherche = titre coupé à 54", () => {
    const titre = "T".repeat(80);
    const r = demandeDuPanneauV4("remplacer", { ...base, sourceVideoId: "v1" }, [{ videoId: "v1", titre }]);
    expect(r).toEqual({ demande: { action: "remplacer", rang: 2, recherche: "T".repeat(54), sourceVideoId: "v1" } });
  });
  it("retirer : forme exacte", () => {
    const r = demandeDuPanneauV4("retirer", base);
    expect(r).toEqual({ demande: { action: "retirer", rang: 2 } });
    expect(Object.keys((r as { demande: object }).demande).sort()).toEqual(["action", "rang"]);
  });
  it("déplacer : « 12,5 » = 12.5, forme exacte, jamais de pourVersionId", () => {
    const r = demandeDuPanneauV4("deplacer", { ...base, debut: "12,5", fin: "14.25" });
    expect(r).toEqual({ demande: { action: "deplacer", rang: 2, debut: 12.5, fin: 14.25 } });
    expect(JSON.stringify(r)).not.toContain("pourVersionId");
  });
  it("erreurs : phrases exactes", () => {
    expect(demandeDuPanneauV4("retirer", { ...base, rang: null })).toEqual({ erreur: "Choisissez d'abord un téléphone." });
    expect(demandeDuPanneauV4("remplacer", base)).toEqual({ erreur: "Dites ce que le téléphone doit montrer." });
    expect(demandeDuPanneauV4("remplacer", { ...base, recherche: "a".repeat(55) })).toEqual({ erreur: "Ce texte est trop long." });
    expect(demandeDuPanneauV4("remplacer", { ...base, recherche: "a".repeat(54) })).toHaveProperty("demande");
    for (const [debut, fin] of [["", "3"], ["abc", "3"], ["5", "5"], ["6", "5"], ["1", "x"]]) {
      expect(demandeDuPanneauV4("deplacer", { ...base, debut, fin })).toEqual({ erreur: "Indiquez un début et une fin valides." });
    }
  });
  it("phrases gelées", () => {
    expect(Object.isFrozen(PHRASES_PANNEAU_EXTRAITS_V4)).toBe(true);
  });
});

describe("rendu (b, c)", () => {
  it("2 téléphones, 2 sources, 3 boutons, un seul principal, libellé du champ", () => {
    const h = rendre();
    for (const t of ["Téléphone du début", "Téléphone du milieu", "Vidéo de mardi", "Vidéo de jeudi"]) expect(h).toContain(t);
    expect(h).toContain("Que doit montrer ce téléphone ?");
    for (const b of ["Remplacer", "Retirer", "Déplacer"]) expect(h).toContain(`>${b}<`);
    expect((h.match(/<button/g) ?? []).filter(() => true).length).toBeGreaterThanOrEqual(3);
    expect(h.match(/bg-orange text-sur-orange/g)?.length).toBe(1);
    expect(h).toContain("N&#x27;importe laquelle");
  });
  it("aucun téléphone : la phrase, 0 bouton", () => {
    const h = rendre({ telephones: [] });
    expect(h).toContain("Cette version n&#x27;a aucun téléphone qui joue un extrait.");
    expect(h).not.toContain("<button");
  });
});

function fichiers(dossier: string, sortie: string[] = []): string[] {
  for (const n of readdirSync(dossier)) {
    const p = join(dossier, n);
    if (statSync(p).isDirectory()) fichiers(p, sortie);
    else if (/\.(ts|tsx)$/.test(n)) sortie.push(p);
  }
  return sortie;
}
const SOURCES = ["src/components/formats/facecam-animee/extraits-v4.ts", "src/components/formats/facecam-animee/PanneauExtraitsV4.tsx"];

describe("éteint = identique (d)", () => {
  it("rien dans src/** n'importe le panneau ni extraits-v4", () => {
    for (const f of fichiers("src")) {
      if ([...SOURCES, "src/components/formats/facecam-animee/ChangerExtraitV4.tsx"].includes(f)) continue;
      const t = readFileSync(f, "utf8");
      expect(t, f).not.toMatch(/PanneauExtraitsV4/);
      expect(t, f).not.toMatch(/extraits-v4["']/);
    }
  });
  it("le panneau n'appelle aucune action ni service", () => {
    for (const f of SOURCES) {
      const t = readFileSync(f, "utf8");
      expect(t).not.toMatch(/@\/app\//);
      expect(t).not.toMatch(/@\/services\//);
      expect(t).not.toMatch(/\bfetch\s*\(/);
    }
  });
});

describe("gardes (e)", () => {
  it("aucun symbole monétaire dans le rendu ni dans les sources", () => {
    const h = rendre();
    expect(h).not.toMatch(/[€$£]|\d\s*(€|\$|EUR|USD)/);
    for (const f of SOURCES) expect(readFileSync(f, "utf8")).not.toMatch(/[€£]|\d\s*\$|\$\s*\d/);
  });
  it("aucune police nommée autre que Manrope", () => {
    const h = rendre();
    expect(h).not.toMatch(/font-family|font-\[/i);
    for (const f of SOURCES) expect(readFileSync(f, "utf8")).not.toMatch(/font-family|fontFamily|Montserrat|Inter\b|Roboto/);
  });
  it("aucune apostrophe droite non échappée dans le texte JSX", () => {
    const t = readFileSync(SOURCES[1], "utf8");
    // texte entre > et < sur une ligne : pas d'apostrophe droite
    for (const m of t.matchAll(/>([^<>{}\n]+)</g)) expect(m[1], m[0]).not.toContain("'");
  });
});
