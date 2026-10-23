/**
 * Visionneuse des pages d'un carrousel : navigation pure + grille rendue côté serveur.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RangeePages } from "@/components/visuels/RangeePages";
import { Visionneuse } from "@/components/visuels/VisionneusePages";
import { actionClavier, borner, compteur, estClicFond, precedent, suivant, urlGrandeVue } from "@/domaine/visuels/navigation-pages";

describe("navigation-pages (calcul pur)", () => {
  it("suivant / précédent sans dépasser", () => {
    expect(suivant(0, 7)).toBe(1);
    expect(suivant(6, 7)).toBe(6);
    expect(precedent(3, 7)).toBe(2);
    expect(precedent(0, 7)).toBe(0);
  });
  it("index borné, y compris liste vide ou valeur folle", () => {
    expect(borner(-4, 7)).toBe(0);
    expect(borner(99, 7)).toBe(6);
    expect(borner(2.7, 7)).toBe(2);
    expect(borner(Number.NaN, 7)).toBe(0);
    expect(borner(3, 0)).toBe(0);
  });
  it("compteur en base 1 : « 3 / 7 »", () => {
    expect(compteur(2, 7)).toBe("3 / 7");
    expect(compteur(0, 1)).toBe("1 / 1");
  });
  it("grande vue : ×2 si présente, sinon ×1", () => {
    expect(urlGrandeVue({ urlX1: "/a1.jpg", urlX2: "/a2.jpg" })).toBe("/a2.jpg");
    expect(urlGrandeVue({ urlX1: "/a1.jpg" })).toBe("/a1.jpg");
    expect(urlGrandeVue({})).toBeUndefined();
  });
});

describe("RangeePages : grille", () => {
  const pages = Array.from({ length: 7 }, (_, i) => ({ index: i, type: "contenu", urlX1: `/p/${i}.jpg`, urlX2: `/p/${i}x2.jpg` }));
  const html = renderToStaticMarkup(createElement(RangeePages, { titre: "Mon carrousel", pages }));
  it("7 vignettes-boutons numérotées, plus de bande masquée", () => {
    expect(html.match(/<button /g)).toHaveLength(7);
    expect(html.match(/<img /g)).toHaveLength(7);
    expect(html).toContain("grid-cols-2");
    expect(html).toContain("lg:grid-cols-4");
    expect(html).toContain("aspect-[4/5]");
    expect(html).not.toContain("sans-barre");
    expect(html).not.toContain("overflow-x-auto");
    expect(html).toContain('alt="Page 7 : Mon carrousel"');
  });
  it("lazy sauf les 2 premières", () => {
    expect(html.match(/loading="lazy"/g)).toHaveLength(5);
  });
  it("visionneuse fermée au départ", () => {
    expect(html).not.toContain("aria-modal");
  });
});

describe("Visionneuse ouverte", () => {
  const pages = [1, 2, 3].map((n) => ({ n, urlX1: `/p/${n}.jpg`, urlX2: `/p/${n}x2.jpg` }));
  const rendre = (liste: typeof pages, index: number) =>
    renderToStaticMarkup(createElement(Visionneuse, { pages: liste, titre: "Mon carrousel", index, onChange: () => {}, onFermer: () => {} }));

  it("dialogue modal focalisable avec compteur, image ×2 et alt", () => {
    const html = rendre(pages, 0);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain("1 / 3");
    expect(html).toContain('src="/p/1x2.jpg"');
    expect(html).not.toContain('src="/p/1.jpg"');
    expect(html).toContain('alt="Page 1 : Mon carrousel"');
  });
  it("première page : Précédent désactivé seul", () => {
    const html = rendre(pages, 0);
    expect(html).toMatch(/aria-disabled="true"[^>]*>Précédent/);
    expect(html).toMatch(/aria-disabled="false"[^>]*>Suivant/);
  });
  it("dernière page : Suivant désactivé seul", () => {
    const html = rendre(pages, 2);
    expect(html).toContain("3 / 3");
    expect(html).toMatch(/aria-disabled="false"[^>]*>Précédent/);
    expect(html).toMatch(/aria-disabled="true"[^>]*>Suivant/);
  });
  it("page unique : les deux désactivés", () => {
    const html = rendre(pages.slice(0, 1), 0);
    expect(html).toContain("1 / 1");
    expect(html).toMatch(/aria-disabled="true"[^>]*>Précédent/);
    expect(html).toMatch(/aria-disabled="true"[^>]*>Suivant/);
  });
});

describe("RangeePages : page sans image", () => {
  it("pas de bouton « Agrandir » pour une page pas encore rendue", () => {
    const html = renderToStaticMarkup(createElement(RangeePages, { titre: "T", pages: [{ index: 0, type: "contenu", urlX1: "/p/0.jpg" }, { index: 1, type: "contenu" }] }));
    expect(html.match(/<button /g)).toHaveLength(1);
    expect(html).toContain("pas encore rendue");
  });
});

describe("clavier et clic sur le fond (logique pure)", () => {
  it("Échap ferme", () => {
    expect(actionClavier("Escape", 2, 7)).toEqual({ type: "fermer" });
  });
  it("flèches changent de page, avec bornes", () => {
    expect(actionClavier("ArrowRight", 2, 7)).toEqual({ type: "aller", index: 3 });
    expect(actionClavier("ArrowRight", 6, 7)).toEqual({ type: "aller", index: 6 });
    expect(actionClavier("ArrowLeft", 2, 7)).toEqual({ type: "aller", index: 1 });
    expect(actionClavier("ArrowLeft", 0, 7)).toEqual({ type: "aller", index: 0 });
  });
  it("autres touches : rien", () => {
    expect(actionClavier("a", 0, 7)).toBeNull();
    expect(actionClavier("Tab", 0, 7)).toBeNull();
  });
  it("clic : fond seulement, pas un enfant", () => {
    const fond = {};
    expect(estClicFond(fond, fond)).toBe(true);
    expect(estClicFond({}, fond)).toBe(false);
  });
});
