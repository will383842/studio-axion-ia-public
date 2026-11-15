/** Refonte REF-CARR-PDF : pages des carrousels (maquettes M0, M2, M5). Habillage seulement. */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CarteCarrousel } from "@/components/visuels/CarteCarrousel";

const lire = (c: string) => readFileSync(c, "utf-8");
const FICHIERS = [
  "src/components/visuels/BarreValidation.tsx",
  "src/components/visuels/FormulaireNouveauCarrousel.tsx",
  "src/components/visuels/CarteCarrousel.tsx",
  "src/components/visuels/VisionneusePages.tsx",
  "src/app/(studio)/carrousels/[id]/page.tsx",
];

describe("REF-CARR-PDF : carrousels", () => {
  for (const f of FICHIERS) {
    it(`${f} : aucune classe orange d'accent`, () => {
      expect(lire(f)).not.toMatch(/(?:bg|text|border|ring|outline)-orange|hover:border-orange|focus:border-orange/);
    });
  }

  it("sélection et focus du formulaire : jetons accent", () => {
    const s = lire("src/components/visuels/FormulaireNouveauCarrousel.tsx");
    expect(s).toContain("border-accent bg-accent-doux text-accent");
    expect(s).toContain("focus:border-accent");
  });

  it("« Préparer pour les réseaux » est un Bouton secondaire (pas de bouton écrit à la main)", () => {
    const s = lire("src/app/(studio)/carrousels/[id]/page.tsx");
    expect(s).toMatch(/<Bouton[^>]*variante="secondaire"[^>]*>\s*Préparer pour les réseaux\s*<\/Bouton>/);
    expect(s).not.toMatch(/<button/);
    expect(s).toContain("PastilleReseau");
  });

  it("boutons de la visionneuse : cible de 44 px, texte alternatif conservé", () => {
    const s = lire("src/components/visuels/VisionneusePages.tsx");
    expect(s).toContain('const bouton = "min-h-11 ');
    expect(s).toContain("Agrandir la page");
    expect(s).toContain("(pas encore rendue)");
  });

  it("carte : pastille Carrousel, statut en pastille avec le mot écrit", () => {
    const base = { id: "vis_a", titre: "T", libelleStatut: "À valider", nbPages: 2, modifieLe: "2026-10-23T10:00:00.000Z" };
    const h = renderToStaticMarkup(createElement(CarteCarrousel, { carrousel: { ...base, statut: "a_valider" } }));
    expect(h).toContain('data-famille="carrousel"');
    expect(h).toContain('data-statut="valider"');
    expect(h).toContain("À valider");
    const v = renderToStaticMarkup(createElement(CarteCarrousel, { carrousel: { ...base, statut: "valide", libelleStatut: "Validé" } }));
    expect(v).toContain("Validé");
    expect(v).not.toContain("data-statut=");
    expect(v).toContain('data-famille="carrousel"');
  });
});
