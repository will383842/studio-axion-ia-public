/** FIX-ECRAN-SCENES-COMPLET : l'écran « Ce que chaque fichier dira et écrira ». Aucun rendu, aucun appel réel. */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ApercuSorties } from "../../../src/components/formats/tableau-anime/ApercuSorties";
import type { ApercuSortie } from "../../../src/moteurs/montage-tableau/apercu-sorties";

const base = (sortie: string, libelle: string, extra: Partial<ApercuSortie> = {}): ApercuSortie => ({
  sortie: sortie as ApercuSortie["sortie"],
  libelle,
  dit: "Un début. Une fin ajoutée.",
  phrasesAjoutees: [],
  pages: [{ numero: 1, lignes: [{ texte: "Un début", ajout: false }, { texte: "axion-ia.com", ajout: true }] }],
  ...extra,
});

describe("écran d'aperçu", () => {
  it("« Ajouté par le Studio » à côté de axion-ia.com", () => {
    const h = renderToStaticMarkup(<ApercuSorties apercu={[base("vertical", "Vertical")]} />);
    expect(h).toMatch(/axion-ia\.com<\/span>.*Ajouté par le Studio/);
    expect(h).toContain("Page 1 :");
    expect(h).toContain("La voix dit :");
  });
  it("une phrase ajoutée est affichée en tête", () => {
    const h = renderToStaticMarkup(<ApercuSorties apercu={[base("vertical-liens", "Liens", { phrasesAjoutees: ["Une fin ajoutée."] })]} />);
    expect(h.indexOf("Une fin ajoutée.")).toBeLessThan(h.indexOf("La voix dit"));
  });
  it("« Identique au fichier » pour deux sorties identiques", () => {
    const h = renderToStaticMarkup(<ApercuSorties apercu={[base("vertical", "Vertical"), base("carre", "Carré")]} />);
    expect(h).toContain("Identique au fichier Vertical");
  });
  it("sans aperçu : rien", () => {
    expect(renderToStaticMarkup(<ApercuSorties apercu={[]} />)).toBe("");
  });
});
