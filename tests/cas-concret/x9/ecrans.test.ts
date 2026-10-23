/**
 * X9 · points 5 et 7 (b) : le pli « Détail technique » et le texte de l'onglet « Sous-titres » (rendu statique, vues
 * écrites à la main : aucun appel).
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DetailTechniqueCasConcret, TEXTE_A_VENIR, TexteDitCasConcret } from "../../../src/components/formats/cas-concret/fiche-video/EcritureCasConcret";
import { ecritureDuTravail } from "../../../src/services/cas-concret-vue";

const texte = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

describe("X9 · onglet « Sous-titres » avant et après l'écriture", () => {
  it("avant l'écriture : « Le texte arrive après l'écriture », jamais la description du cas", () => {
    const html = texte(renderToStaticMarkup(createElement(TexteDitCasConcret, { vue: { texteDit: null } })));
    expect(html).toBe(TEXTE_A_VENIR);
    expect(TEXTE_A_VENIR).toBe("Le texte arrive après l'écriture");
  });

  it("après l'écriture : le texte réellement dit", () => {
    const html = texte(renderToStaticMarkup(createElement(TexteDitCasConcret, { vue: { texteDit: "On recrute nos collaborateurs en 15 minutes." } })));
    expect(html).toBe("On recrute nos collaborateurs en 15 minutes.");
  });

  it("le texte vient de la fiche écrite (journal de l'étape), sinon du projet de montage ; rien avant", () => {
    const fiche = { ecrans: [{ texteDit: "Première phrase." }, { texteDit: "Seconde phrase." }] };
    const travail = (sortie?: unknown) => ({ etapes: [], parametres: { casConcret: { journal: { etapes: sortie ? { ecriture: { sortie } } : {} } } } });
    expect(ecritureDuTravail(travail()).texteDit).toBeNull();
    expect(ecritureDuTravail(null).texteDit).toBeNull();
    expect(ecritureDuTravail(travail({ fiche })).texteDit).toBe("Première phrase. Seconde phrase.");
    expect(ecritureDuTravail(null, { casConcret: { fiche } }).texteDit).toBe("Première phrase. Seconde phrase.");
  });
});

describe("X9 · pli « Détail technique » de l'onglet « Historique »", () => {
  it("fermé par défaut, il montre la réponse brute", () => {
    const html = renderToStaticMarkup(createElement(DetailTechniqueCasConcret, { vue: { detailTechnique: "Réponse brute du dernier essai :\n{\"ecrans\": []}" } }));
    expect(html).toMatch(/^<details/);
    expect(html).not.toContain(" open");
    expect(texte(html)).toBe("Détail technique Réponse brute du dernier essai : {\"ecrans\": []}");
  });

  it("rien sans échec", () => {
    expect(renderToStaticMarkup(createElement(DetailTechniqueCasConcret, { vue: { detailTechnique: null } }))).toBe("");
  });
});
