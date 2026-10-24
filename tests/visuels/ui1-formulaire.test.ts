/** UI-1 : formulaire de création (aide au format, générateur éteint, erreurs) rendu côté serveur. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TYPES_PAGE } from "@/briques/visuels/registre-pages";
import { BandeauGenerateurEteint } from "@/components/visuels/BandeauGenerateurEteint";
import { FormulaireNouveauCarrousel } from "@/components/visuels/FormulaireNouveauCarrousel";
import { aideFormat } from "@/visuels/texte/aide-format";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const creer = async () => ({ erreurs: [] });
const rendu = (props: { allume?: boolean; entreeInitiale?: "sujet" | "depot" } = {}) => renderToStaticMarkup(createElement(FormulaireNouveauCarrousel, { creer, aide: aideFormat(), ...props }));

describe("écran « Déposer un texte écrit en session »", () => {
  const h = rendu({ entreeInitiale: "depot" });
  it("bloc dépliable « Format attendu », bouton « Copier le modèle », modèle JSON", () => {
    expect(h).toContain("Format attendu");
    expect(h).toContain("<details");
    expect(h).toContain("Copier le modèle");
    expect(h).toContain("paquet-session-carrousel/1");
  });
  it("tous les types de pages du registre sont listés avec leurs limites", () => {
    for (const id of TYPES_PAGE) expect(h).toContain(`<code class="mr-2 font-mono">${id}</code>`);
    expect(h).toContain("signes au plus");
  });
});

describe("générateur éteint", () => {
  it("boutons « Créer le carrousel » grisés et reliés à l'explication", () => {
    const h = rendu({ allume: false });
    const boutons = h.match(/<button[^>]*>(?:(?!<\/button>)[\s\S])*Créer le carrousel/g) ?? [];
    expect(boutons).toHaveLength(2);
    for (const b of boutons) {
      expect(b).toMatch(/\sdisabled(?:=|\s|>)/);
      expect(b).toContain('aria-describedby="bandeau-generateur-eteint"');
    }
  });
  it("allumé : boutons actifs (le texte déposé vide garde le sien)", () => {
    const boutons = rendu({ allume: true }).match(/<button[^>]*>(?:(?!<\/button>)[\s\S])*Créer le carrousel/g) ?? [];
    expect(boutons[0]).not.toMatch(/\sdisabled(?:=|\s|>)/);
  });
  it("le formulaire ne répète pas le message : « éteint » vient du seul bandeau", () => {
    expect(rendu({ allume: false })).not.toMatch(/éteint/i);
    const bandeau = renderToStaticMarkup(createElement(BandeauGenerateurEteint));
    expect(bandeau).toContain('id="bandeau-generateur-eteint"');
    expect(bandeau.match(/éteint/g)).toHaveLength(1);
  });
  it("la page n'ajoute pas un second message « éteint » (adresse ?erreur=GENERATEUR_ETEINT)", () => {
    const page = readFileSync(join(process.cwd(), "src/app/(studio)/carrousels/nouveau/page.tsx"), "utf8");
    expect(page).toMatch(/GENERATEUR_ETEINT" && !allume/);
  });
  it("Réglages › Carrousels : plus de renvoi vers « Réglages › Carrousels » sur cette page même", () => {
    const page = readFileSync(join(process.cwd(), "src/app/(studio)/reglages/carrousels/page.tsx"), "utf8");
    expect(page).not.toContain("PHRASE_GENERATEUR_ETEINT");
    expect(page).not.toContain("Le générateur est éteint");
  });
});

describe("sujet : texte d'exemple", () => {
  it("le formulaire dit que le texte est un exemple de simulation", () => {
    expect(rendu()).toContain("exemple de simulation");
  });
});
