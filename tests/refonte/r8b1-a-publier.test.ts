/** Refonte R8b1 : « À publier » sans orange, statuts Programmé (vert) et Publié (contour), bouton secondaire de la saisie de matière. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { tonEtatAffiche } from "@/components/publication/ton-etat-affiche";

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

  it("détail d'envoi : Programmée verte, Publiée en contour, libellés au féminin inchangés", () => {
    const s = lire("src/components/publication/LignesAPublier.tsx");
    expect(s).toContain('programmee: "sauge", publiee: "contour"');
    expect(s).not.toContain("PastilleStatut");
    expect(s).toContain('programmee: "Programmée"');
    expect(s).toContain('publiee: "Publiée"');
  });

  it("ton affiché d'un état : vert, contour, jamais d'orange", () => {
    expect(tonEtatAffiche("Programmée", "orange")).toBe("sauge");
    expect(tonEtatAffiche("Publiée", "sauge")).toBe("contour");
    expect(tonEtatAffiche("À envoyer", "orange")).toBe("ambre");
    expect(tonEtatAffiche("Problème", "brique")).toBe("brique");
    for (const f of ["LignesAPublier.tsx", "ListeAPublier.tsx"]) {
      const s = lire(`src/components/publication/${f}`);
      expect(s).toContain("tonEtatAffiche(");
      expect(s).not.toMatch(/ton=\{[^}]*\.ton\}/);
    }
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
