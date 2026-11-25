import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const lire = (chemin: string) => readFileSync(join(__dirname, "../..", chemin), "utf8");

describe("collage-chapitres : déclarée et aiguillée (lot UI-5)", () => {
  it("déclarée dans l'union des deux côtés et dans OPERATIONS", async () => {
    for (const f of ["studio-rendu/src/contrat.ts", "src/fournisseurs/types.ts"]) expect(lire(f)).toMatch(/\|\s*"collage-chapitres"/);
    const chemin = join(__dirname, "../..", "studio-rendu/src/contrat");
    const { OPERATIONS } = (await import(/* @vite-ignore */ chemin)) as { OPERATIONS: string[] };
    expect(OPERATIONS).toContain("collage-chapitres");
  });
  it("aiguillée dans index.ts, en import dynamique enveloppé par charger()", () => {
    const t = lire("studio-rendu/src/index.ts");
    expect(t).toContain('"collage-chapitres": async (d, c) => (await charger("collage-chapitres", () => import("./operations/collage-chapitres.js"))).collageChapitres(d, c),');
    expect(t).not.toMatch(/^import[^\n]*operations\/collage-chapitres/m);
  });
  it("verifierDemande accepte l'opération", async () => {
    const chemin = join(__dirname, "../..", "studio-rendu/src/contrat");
    const { verifierDemande } = (await import(/* @vite-ignore */ chemin)) as { verifierDemande: (d: unknown) => string | null };
    const demande = { idRendu: "x", operation: "collage-chapitres", file: "longue", entrees: {}, sortie: { urlDepot: "u", cle: "k" }, parametres: { morceaux: ["a"] } };
    expect(verifierDemande(demande)).toBeNull();
  });
  it("PlanDeScenes : sousTitres facultatif ; sans lui, aucun calque (rendu identique)", () => {
    const t = lire("studio-rendu/compositions/plan-scenes/PlanDeScenes.tsx");
    expect(t).toContain("sousTitres?: DonneesCalque;");
    expect(t).toContain("{sousTitres ? <CalqueSousTitres donnees={sousTitres} /> : null}");
    expect(t).toContain("<ImagePlan plan={plan} image={image} />");
    // le calque vient APRÈS le plan et rien d'autre n'a changé dans le rendu
    expect(t.indexOf("<ImagePlan")).toBeLessThan(t.indexOf("<CalqueSousTitres"));
    expect(t).toMatch(/PLAN_VIDE: ProprietesPlanDeScenes = \{\s*plan:/);
  });
});
