import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/components/calendrier/VueAgenda.tsx", "utf8");

describe("CAL-12c : jour courant de l'agenda en jetons accent", () => {
  it("n'emploie plus les classes orange pour le jour courant", () => {
    expect(source).not.toMatch(/border-orange\b/);
    expect(source).not.toContain("text-orange-vif");
  });

  it("marque le jour courant par border-accent et text-accent", () => {
    expect(source).toContain("border-accent bg-surface-2");
    expect(source).toContain('"text-accent" : "text-texte-doux"');
  });
});
