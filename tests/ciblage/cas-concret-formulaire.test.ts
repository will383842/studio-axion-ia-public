/** Lot E · formulaire « Ajouter un cas » : la cible se choisit à côté de « Pour qui ». Rendu serveur. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { choixCibleVersPhrase } from "@/components/formats/cas-concret/ajouter/formulaire-cas";

describe("formulaire cas concret · cible", () => {
  it("la phrase « Pour qui » est préremplie avec le libellé tant qu'elle est vide ou venait d'un précédent choix", () => {
    expect(choixCibleVersPhrase("", "", "plombier")).toBe("plombier");
    expect(choixCibleVersPhrase("plombier", "plombier", "électricien")).toBe("électricien");
    expect(choixCibleVersPhrase("Un plombier pressé.", "plombier", "électricien")).toBe("Un plombier pressé.");
    expect(choixCibleVersPhrase("", "", "")).toBe("");
  });
  it("le formulaire pose le choix de cible juste avant « Pour qui »", () => {
    const src = readFileSync("src/components/formats/cas-concret/ajouter/FormulaireCas.tsx", "utf8");
    expect(src).toContain('from "@/components/ciblage/ChoixCible"');
    expect(src.indexOf("<ChoixCible")).toBeGreaterThan(-1);
    expect(src.indexOf("<ChoixCible")).toBeLessThan(src.indexOf('libelle="Pour qui"'));
  });
});
