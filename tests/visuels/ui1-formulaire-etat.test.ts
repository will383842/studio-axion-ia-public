/** UI-1 tour 2 : le formulaire garde le texte après une erreur et dit « éteint » quand l'action le renvoie. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EtatCreation } from "@/domaine/visuels/etat-creation";
import { aideFormat } from "@/visuels/texte/aide-format";

let etatSimule: EtatCreation = { erreurs: [] };
vi.mock("react", async (importOriginal) => {
  const reel = await importOriginal<typeof import("react")>();
  return { ...reel, useActionState: (_action: unknown, initial: unknown) => [etatSimule ?? initial, () => undefined, false] };
});

async function rendu(entreeInitiale: "sujet" | "depot" = "depot") {
  const { FormulaireNouveauCarrousel } = await import("@/components/visuels/FormulaireNouveauCarrousel");
  return renderToStaticMarkup(createElement(FormulaireNouveauCarrousel, { creer: async () => ({ erreurs: [] }), aide: aideFormat(), entreeInitiale }));
}
const bouton = (h: string) => h.match(/<button[^>]*>(?:(?!<\/button>)[\s\S])*Créer le carrousel/g) ?? [];

beforeEach(() => {
  etatSimule = { erreurs: [] };
});

describe("action : générateur éteint dans un autre onglet", () => {
  it("une phrase role=alert et les deux boutons grisés", async () => {
    etatSimule = { eteint: true, sujet: "Mon sujet" };
    const h = await rendu();
    expect(h).toMatch(/role="alert"[^>]*>[^<]*éteint/);
    expect(bouton(h)).toHaveLength(2);
    for (const b of bouton(h)) expect(b).toMatch(/\sdisabled(?:=|\s|>)/);
  });
  it("sans état éteint : pas d'alerte, bouton du sujet actif", async () => {
    const h = await rendu();
    expect(h).not.toMatch(/éteint/);
    expect(bouton(h)[0]).not.toMatch(/\sdisabled(?:=|\s|>)/);
  });
});

describe("texte collé : reste après une erreur", () => {
  it("le dépôt revient dans le champ", async () => {
    etatSimule = { erreurs: ["Le texte déposé est illisible"], contenu: '{"a": 1} &amp; reste' };
    const h = await rendu();
    expect(h).toContain("Le texte déposé est illisible");
    expect(h).toMatch(/<textarea[^>]*>\{&quot;a&quot;: 1\} &amp;amp; reste<\/textarea>/);
  });
  it("le sujet revient dans le champ", async () => {
    etatSimule = { erreurs: ["Le sujet fait de 3 à 200 signes, sans lien"], sujet: "Mon sujet gardé" };
    expect(await rendu("sujet")).toContain('value="Mon sujet gardé"');
  });
});
