/** Refonte R8b1 : « À publier » sans orange, statuts Programmé (vert) et Publié (contour), bouton secondaire de la saisie de matière. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const lire = (c: string) => readFileSync(c, "utf-8");
const CLASSE_ORANGE = /(?:bg|text|border|shadow|ring|outline)-orange|hover:border-orange|focus:border-orange/;

describe("R8b1 : À publier (maquette M5)", () => {
  for (const f of ["src/components/publication/ListeAPublier.tsx", "src/components/publication/LignesAPublier.tsx"]) {
    it(`${f} : aucune classe orange, accent à la place`, () => {
      const s = lire(f);
      expect(s).not.toMatch(CLASSE_ORANGE);
      expect(s).toContain("border-accent bg-accent-doux");
      expect(s).toContain("text-accent");
    });
  }

  it("Programmée est verte (sauge) et passe par PastilleStatut ; Publiée en contour", () => {
    const s = lire("src/components/publication/LignesAPublier.tsx");
    expect(s).toContain('programmee: "sauge"');
    expect(s).not.toContain('programmee: "orange"');
    expect(s).toContain('statut={c.etat === "programmee" ? "programme" : "publie"}');
    expect(s).toContain('programmee: "Programmée"');
    expect(s).toContain('publiee: "Publiée"');
  });

  it("les pastilles d'état n'ont plus de ton orange", () => {
    expect(lire("src/components/publication/LignesAPublier.tsx")).toContain('t === "orange" ? "ambre" : t');
    expect(lire("src/components/publication/ListeAPublier.tsx")).toContain('etat.ton === "orange" ? "ambre"');
  });

  it("SaisieMatiereSujet : variante réglable, principale par défaut", () => {
    const s = lire("src/components/generateur/SaisieMatiereSujet.tsx");
    expect(s).toContain('variante = "principal"');
    expect(s).toContain("variante={variante}");
  });

  it("fiche d'un sujet : « Ajouter et reprendre » est secondaire (la barre collée garde le seul orange plein)", () => {
    const f = lire("src/components/generateur/FicheSujet.tsx");
    expect(f).toContain('<SaisieMatiereSujet id={id} variante="secondaire" libelleBouton="Ajouter et reprendre"');
    expect(f).not.toMatch(/variante="secondaire" libelleBouton="Ajouter et écrire"/);
  });
});
