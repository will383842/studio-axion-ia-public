/** PR 7 : aperçu d'une épingle avant envoi. Pur, aucun appel réseau. */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ApercuEpingle } from "@/components/visuels/ApercuEpingle";
import { hoteDuLien, limitesEpingle, tronquer } from "@/domaine/epingles/apercu";

const base = {
  imageUrl: "https://exemple.fr/img/epingle.png",
  titre: "Cinq idées pour un jardin sobre",
  description: "Une courte description du jardin.",
  texteAlternatif: "Un balcon fleuri vu de face, avec trois bacs en bois.",
  lien: "https://exemple.fr/blog/jardin-sobre?utm=x",
  tableau: "Jardin",
  contenuIA: false,
};

describe("domaine/epingles/apercu", () => {
  it("hoteDuLien rend l'hôte seul, ou null si le lien est illisible", () => {
    expect(hoteDuLien("https://exemple.fr/a/b?c=d")).toBe("exemple.fr");
    expect(hoteDuLien("pas un lien")).toBeNull();
    expect(hoteDuLien("")).toBeNull();
  });
  it("tronquer coupe avec une ellipse seulement au-delà du maximum", () => {
    expect(tronquer("abc", 3)).toBe("abc");
    expect(tronquer("abcd", 3)).toBe("ab…");
  });
  it("limitesEpingle signale titre > 100, description > 800, alt vide ou > 500, lien non https", () => {
    expect(limitesEpingle(base)).toEqual([]);
    const codes = limitesEpingle({ ...base, titre: "x".repeat(101), description: "y".repeat(801), texteAlternatif: "", lien: "http://exemple.fr" }).map((p) => p.code);
    expect(codes).toEqual(["titre-trop-long", "description-trop-longue", "alt-absent", "lien-non-https"]);
    expect(limitesEpingle({ ...base, texteAlternatif: "z".repeat(501) }).map((p) => p.code)).toEqual(["alt-trop-long"]);
    expect(limitesEpingle({ ...base, titre: " " }).map((p) => p.code)).toEqual(["titre-absent"]);
  });
});

describe("ApercuEpingle", () => {
  it("montre l'image 2:3 avec son texte alternatif comme alt ET en clair, le titre, la description, l'hôte et le tableau", () => {
    const h = renderToStaticMarkup(<ApercuEpingle {...base} />);
    expect(h).toContain('src="https://exemple.fr/img/epingle.png"');
    expect(h).toContain(`alt="${base.texteAlternatif}"`);
    expect(h).toContain("aspect-ratio:2 / 3");
    expect(h).toContain("Texte alternatif");
    expect(h.split(base.texteAlternatif).length - 1).toBe(2); // attribut + texte visible
    expect(h).toContain(base.titre);
    expect(h).toContain(base.description);
    expect(h).toContain("exemple.fr");
    expect(h).not.toContain("jardin-sobre");
    expect(h).toContain("Jardin");
  });
  it("tronque un titre long comme le fera Pinterest et garde le titre entier lisible", () => {
    const long = "T".repeat(120);
    const h = renderToStaticMarkup(<ApercuEpingle {...base} titre={long} />);
    expect(h).toContain("T".repeat(99) + "…");
    expect(h).toContain("Titre trop long");
  });
  it("affiche la mention « modifié par IA » seulement si contenuIA", () => {
    expect(renderToStaticMarkup(<ApercuEpingle {...base} />)).not.toContain("modifié par IA");
    expect(renderToStaticMarkup(<ApercuEpingle {...base} contenuIA />)).toContain("modifié par IA");
  });
  it("sans image lisible ou sans texte alternatif, le dit en mots (pas par la couleur seule)", () => {
    const h = renderToStaticMarkup(<ApercuEpingle {...base} imageUrl={null} texteAlternatif="" />);
    expect(h).toContain("Image indisponible");
    expect(h).toContain("Texte alternatif manquant");
    expect(h).toContain('role="alert"');
  });
  it("n'utilise aucune couleur en dur (jetons du thème seulement)", () => {
    expect(renderToStaticMarkup(<ApercuEpingle {...base} contenuIA />)).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(/i);
  });
});
