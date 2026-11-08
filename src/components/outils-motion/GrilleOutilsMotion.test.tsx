import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CATALOGUE_OUTILS_MOTION } from "@/outils-motion/catalogue";
import { GrilleOutilsMotion } from "./GrilleOutilsMotion";

describe("grille des outils motion design", () => {
  it("montre une carte par pièce", () => {
    const html = renderToStaticMarkup(<GrilleOutilsMotion outils={CATALOGUE_OUTILS_MOTION} />);
    expect((html.match(/data-outil=/g) ?? []).length).toBe(CATALOGUE_OUTILS_MOTION.length);
    expect(html).toContain("Carte KPI");
  });
  it("liste vide : un état vide, pas une page blanche", () => {
    const html = renderToStaticMarkup(<GrilleOutilsMotion outils={[]} />);
    expect(html).toContain("Aucun outil pour le moment");
  });
});
