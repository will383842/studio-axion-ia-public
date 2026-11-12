/** L4-16 : bandeau « Aujourd'hui » du calendrier. Aucun réseau, données fictives. */
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BandeauAujourdhui, compterAujourdhui, lienJournee } from "../../src/components/calendrier/BandeauAujourdhui";
import type { EntreeCarte } from "../../src/components/calendrier/CarteEntreeCalendrier";

const AUJ = "2026-11-12";
const e = (cle: string, jour: string, etat: string, reseau: EntreeCarte["reseau"] = "linkedin"): EntreeCarte => ({ cle, jour, reseau, type: "image", etat, heure: "09:00" });
const CINQ = [
  e("a", AUJ, "a_valider"),
  e("b", AUJ, "programme", "instagram"),
  e("c", AUJ, "a_valider", "facebook"),
  e("d", AUJ, "publie"),
  e("e", AUJ, "a_corriger", "tiktok"),
];
const rendre = (entrees: EntreeCarte[], aujourdhui = AUJ) => renderToStaticMarkup(createElement(BandeauAujourdhui, { entrees, aujourdhui }));
const texte = (html: string) => html.replace(/<[^>]*>/g, "").replace(/&#x27;|&#39;/g, "'");

describe("BandeauAujourdhui", () => {
  it("comptes exacts sur 5 créneaux : 5 publications, dont 2 à valider", () => {
    expect(compterAujourdhui(CINQ, AUJ)).toEqual({ total: 5, aValider: 2 });
    expect(texte(rendre(CINQ))).toBe("Aujourd'hui, jeudi 12 novembre : 5 publications, dont 2 à valider. Voir la journée");
  });
  it("ignore les autres jours et les idées de l'IA", () => {
    const l = [...CINQ, e("f", "2026-11-11", "a_valider"), e("g", "2026-11-13", "a_valider"), e("h", AUJ, "idee")];
    expect(compterAujourdhui(l, AUJ)).toEqual({ total: 5, aValider: 2 });
  });
  it("journée vide : 0 publication, dont 0 à valider", () => {
    expect(compterAujourdhui([], AUJ)).toEqual({ total: 0, aValider: 0 });
    expect(texte(rendre([]))).toBe("Aujourd'hui, jeudi 12 novembre : 0 publications, dont 0 à valider. Voir la journée");
  });
  it("une seule publication : « 1 publication » au singulier", () => {
    expect(texte(rendre([e("a", AUJ, "a_valider")]))).toBe("Aujourd'hui, jeudi 12 novembre : 1 publication, dont 1 à valider. Voir la journée");
  });
  it("le lien ouvre la vue Jour d'aujourd'hui", () => {
    expect(lienJournee(AUJ)).toBe("/calendrier?vue=jour&date=2026-11-12");
    expect(rendre(CINQ)).toContain('href="/calendrier?vue=jour&amp;date=2026-11-12"');
  });
  it("jour illisible : rien n'est affiché", () => {
    expect(rendre(CINQ, "demain")).toBe("");
    expect(rendre(CINQ, "")).toBe("");
    expect(rendre(CINQ, "2026-02-30")).toBe("");
  });
  it("entrée au jour illisible : ignorée, sans erreur", () => {
    expect(compterAujourdhui([e("x", "", "a_valider"), ...CINQ], AUJ)).toEqual({ total: 5, aValider: 2 });
  });
});
