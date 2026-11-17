/** X3-09a : bouton « Animations » à 4 crans. Rendu serveur seulement (pas de jsdom) ; le clic est testé par la fonction de choix extraite. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PHRASE_CRAN_GRISE, type IdGenerateurDosage } from "@/briques/dosage-motion";
import { BoutonDosage, choisirCran } from "@/components/dosage-motion/BoutonDosage";

const rendre = (generateur: IdGenerateurDosage, valeur: "aucun" | "sobre" | "equilibre" | "dynamique" = "equilibre") =>
  renderToStaticMarkup(createElement(BoutonDosage, { generateur, valeur, surChoix: () => undefined }));
/** Balise ouvrante du bouton portant ce libellé. */
const bouton = (html: string, libelle: string) => html.match(new RegExp(`<button[^>]*>(?:(?!</button>)[\\s\\S])*?${libelle}`))?.[0] ?? "";
const grise = (html: string, libelle: string) => /disabled=""/.test(bouton(html, libelle).split(">")[0]);
const echappe = (s: string) => s.replace(/'/g, "&#x27;");

describe("BoutonDosage", () => {
  it("affiche le titre et les 4 libellés", () => {
    const html = rendre("avocat");
    for (const l of ["Animations", "Aucun", "Sobre", "Équilibré", "Dynamique"]) expect(html).toContain(l);
  });
  it("avocat : 4 crans actifs, aucune phrase grisée", () => {
    const html = rendre("avocat");
    for (const l of ["Aucun", "Sobre", "Équilibré", "Dynamique"]) expect(grise(html, l)).toBe(false);
    expect(html).not.toContain(echappe(PHRASE_CRAN_GRISE.animations));
  });
  it("tableau : « Aucun » grisé avec sa phrase", () => {
    const html = rendre("tableau");
    expect(grise(html, "Aucun")).toBe(true);
    expect(grise(html, "Sobre")).toBe(false);
    expect(html).toContain(echappe(PHRASE_CRAN_GRISE.animations));
  });
  it("facecam-animee : seul « Dynamique » actif, phrase v4", () => {
    const html = rendre("facecam-animee", "dynamique");
    expect(grise(html, "Dynamique")).toBe(false);
    for (const l of ["Aucun", "Sobre", "Équilibré"]) expect(grise(html, l)).toBe(true);
    expect(html).toContain(echappe(PHRASE_CRAN_GRISE.v4));
  });
  it("aide sous le cran choisi", () => {
    expect(rendre("avocat", "aucun")).toContain("Sous-titres seuls, image fixe, coupes franches");
    expect(rendre("avocat", "sobre")).toContain(echappe("Peu d'animations, calmes"));
    expect(rendre("avocat", "equilibre")).toContain("Comme d&#x27;habitude");
    expect(rendre("avocat", "dynamique")).toContain("Plus d&#x27;animations, plus de rythme");
  });
  it("choix : « Aucun » en avocat appelle surChoix(\"aucun\"), en tableau rien", () => {
    const f = vi.fn();
    choisirCran("avocat", "aucun", f);
    expect(f).toHaveBeenCalledWith("aucun");
    const g = vi.fn();
    choisirCran("tableau", "aucun", g);
    expect(g).not.toHaveBeenCalled();
  });
});
