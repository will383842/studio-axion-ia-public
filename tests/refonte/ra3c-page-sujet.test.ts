// Refonte du Studio, fiche REF-RA3 : la page d'un sujet n'a pas d'orange d'accent.
// Règle de la maquette M0 : un seul orange plein par écran, réservé au bouton principal.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(join(process.cwd(), "src/app/(studio)/ecrire/sujets/[id]/page.tsx"), "utf8");

describe("page d'un sujet : couleurs", () => {
  it("la pastille du format n'est pas orange, et le nom du format reste écrit", () => {
    expect(page).not.toMatch(/<Pastille[^>]*ton="orange"/);
    expect(page).toMatch(/<Pastille key=\{f\} ton="encre"/);
  });

  it("aucune classe d'orange d'accent dans la page", () => {
    expect(page).not.toMatch(/(?:bg|text|border|ring|outline)-orange(?:-vif|-doux)?\b/);
  });
});
