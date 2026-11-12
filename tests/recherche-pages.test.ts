/** Recherche des pages du studio (08/11, Williams) : « réglages », « paramètres », « calendrier »… mènent à la page. */
import { describe, expect, it } from "vitest";
import { pagesTrouvees, simplifier } from "@/components/coquille/pages-recherche";

const hrefs = (q: string, o = {}) => pagesTrouvees(q, o).map((p) => p.href);

describe("pagesTrouvees", () => {
  it("trouve par le nom, sans accent ni casse", () => {
    expect(hrefs("reglages")[0]).toBe("/reglages");
    expect(hrefs("RÉGLAGES")[0]).toBe("/reglages");
    expect(hrefs("calendrier")[0]).toBe("/calendrier");
  });
  it("trouve par synonyme", () => {
    expect(hrefs("paramètres")).toContain("/reglages");
    expect(hrefs("planning")).toContain("/calendrier");
    expect(hrefs("agenda")).toContain("/calendrier");
    expect(hrefs("stats")).toContain("/mesures");
    expect(hrefs("statistiques")).toContain("/mesures");
    expect(hrefs("scripts")).toContain("/ecrire");
    expect(hrefs("idées")).toContain("/ecrire");
    expect(hrefs("mots-clés")).toContain("/mots");
    expect(hrefs("commentaires")).toContain("/mots");
    expect(hrefs("réponses")).toContain("/mots");
  });
  // R8a (décision de Williams, 12/11) : les animations sont regroupées dans Bibliothèque › Animations.
  it("Veille, Outils motion design, Mesures et Résultats mènent à la bonne page", () => {
    expect(hrefs("veille")).toContain("/veille");
    expect(hrefs("nouveautés")).toContain("/veille");
    expect(hrefs("motion")).toContain("/bibliotheque/animations?onglet=studio");
    expect(hrefs("animations")).toContain("/bibliotheque/animations?onglet=studio");
    expect(hrefs("mesures")).toContain("/mesures");
    expect(hrefs("résultats")).toContain("/mesures");
    expect(hrefs("nouvelle")).toContain("/nouvelle");
  });
  it("propose les pages hors menu", () => {
    expect(hrefs("ce qui marche")).toContain("/mesures/ce-qui-marche");
    expect(hrefs("ranger")).toContain("/videos/a-ranger");
  });
  it("« Vidéos validées » (ex « À publier », décision de Williams du 08/11) et « Sur le site » seulement quand elles sont allumées", () => {
    expect(hrefs("publier")).not.toContain("/a-publier");
    expect(hrefs("publier", { aPublier: true })).toContain("/a-publier");
    expect(hrefs("vidéos validées", { aPublier: true })).toContain("/a-publier");
    expect(hrefs("site")).not.toContain("/sur-le-site");
    expect(hrefs("site", { surLeSite: true })).toContain("/sur-le-site");
  });
  it("au plus 5 résultats, rien sous deux lettres, rien si rien ne correspond", () => {
    expect(pagesTrouvees("e", {}).length).toBe(0);
    expect(pagesTrouvees("es", { aPublier: true, surLeSite: true }).length).toBeLessThanOrEqual(5);
    expect(hrefs("zzzzqq")).toEqual([]);
  });
  it("simplifier retire accents et majuscules", () => {
    expect(simplifier("  Écrire ")).toBe("ecrire");
  });
});
