/** Lot S (08/11, Williams) — pastilles de réseaux : sigles lisibles, nom en français, atténuées si non précis, « +n ». */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PastillesReseaux } from "@/components/videos/PastillesReseaux";

const html = (p: Parameters<typeof PastillesReseaux>[0]) => renderToStaticMarkup(createElement(PastillesReseaux, p));

describe("PastillesReseaux", () => {
  it("dit les réseaux en français pour les lecteurs d'écran", () => {
    const h = html({ reseaux: ["linkedin", "instagram"], precis: true });
    expect(h).toContain('aria-label="Pour LinkedIn, Instagram"');
    expect(h).toContain('data-precis="oui"');
    expect(h).not.toContain("opacity-60");
  });

  it("précis faux : atténuées, avec l'info-bulle « Réseaux prévus par défaut »", () => {
    const h = html({ reseaux: ["linkedin"], precis: false });
    expect(h).toContain("opacity-60");
    expect(h).toContain('title="Réseaux prévus par défaut"');
    expect(h).toContain('data-precis="non"');
  });

  it("4 au plus puis « +n », le nom de tous les réseaux restant dans le libellé", () => {
    const h = html({ reseaux: ["linkedin", "instagram", "facebook", "tiktok", "youtube", "youtube-shorts"], precis: true });
    expect(h).toContain("+2");
    expect((h.match(/role="img"/g) ?? []).length).toBe(4);
    expect(h).toContain("YouTube Shorts");
    expect(html({ reseaux: ["linkedin", "instagram", "facebook"], precis: true, max: 2 })).toContain("+1");
  });

  it("aucun réseau : rien", () => {
    expect(html({ reseaux: [], precis: true })).toBe("");
  });

  it("aucune couleur en dur (jetons du design system seulement)", () => {
    expect(html({ reseaux: ["linkedin", "instagram", "facebook", "tiktok", "youtube"], precis: true })).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|style=/i);
  });
});
