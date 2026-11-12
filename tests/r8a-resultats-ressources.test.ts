/** R8a (refonte du Studio) : Illustrations en une tuile, Animations présente, onglets de Résultats, renvoi ?onglet=studio. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { pagesTrouvees } from "@/components/coquille/pages-recherche";

const lire = (f: string) => readFileSync(join(__dirname, "..", f), "utf8");

describe("R8a", () => {
  const page = lire("src/app/(studio)/bibliotheque/page.tsx");
  it("une seule tuile Illustrations, sans tuile illustration-video séparée", () => {
    expect(page).toMatch(/nom: "Illustrations"/);
    expect(page).toMatch(/t\.type === "illustration-video" \? \[\]/);
  });
  it("la tuile Animations est toujours présente", () => {
    expect(page).toMatch(/const ANIMATIONS = \{ type: "animations", nom: "Animations"/);
    expect(page).toMatch(/RUSHS, ANIMATIONS\]/);
  });
  it("les onglets de Résultats mènent à /mesures et /mesures/ce-qui-marche", () => {
    const o = lire("src/components/mesures/OngletsResultats.tsx");
    expect(o).toContain('href: "/mesures"');
    expect(o).toContain('href: "/mesures/ce-qui-marche"');
  });
  it("la page Animations lit ?onglet=studio ; la recherche « animations » y mène", () => {
    expect(lire("src/app/(studio)/bibliotheque/animations/page.tsx")).toMatch(/onglet === "studio"/);
    const p = pagesTrouvees("animations", {}).find((x) => x.href.startsWith("/bibliotheque/animations"));
    expect(p?.href).toBe("/bibliotheque/animations?onglet=studio");
    expect(p?.libelle).toBe("Animations du studio");
  });
});
