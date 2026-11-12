/** CAL-01 · origine de la date : « choisie par vous » / « proposée par l'usine » ; une date choisie à la main n'est jamais écrasée. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FicheEntree, type EntreeFiche } from "@/components/calendrier/FicheEntree";
import { ecritureDatePermise, libelleOrigineDate } from "@/domaine/plan-editorial/origine-date";
import { ORIGINES_ENTREE } from "@/domaine/plan-editorial/statuts";
import type { OrigineEntree } from "@/domaine/plan-editorial/types";

const entree: EntreeFiche = { cle: "creneau:c1|linkedin", jour: "2026-12-10", reseau: "linkedin", type: "texte", etat: "brouillon", heure: "09:30", texte: "Texte fictif." };
const rendre = (o?: OrigineEntree) => renderToStaticMarkup(createElement(FicheEntree, { entree: { ...entree, ...(o ? { origineDate: o } : {}) }, aujourdhui: "2026-12-01" }));

describe("CAL-01 · garde : une date choisie à la main n'est jamais écrasée", () => {
  it("la nouvelle date de l'usine ne remplace pas une date choisie par le fondateur", () => {
    const r = ecritureDatePermise("vous", "usine");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.raison).toMatch(/choisie par vous/);
  });
  it("une date choisie par le fondateur se remplace par un geste du fondateur (rejeu compris)", () => {
    expect(ecritureDatePermise("vous", "vous").ok).toBe(true);
    expect(ecritureDatePermise("vous", "vous").ok).toBe(true);
  });
  it("une date proposée par l'usine se remplace par l'usine ou par le fondateur", () => {
    expect(ecritureDatePermise("usine", "usine").ok).toBe(true);
    expect(ecritureDatePermise("usine", "vous").ok).toBe(true);
  });
  it("origine actuelle absente (entrée ancienne) : traitée comme choisie à la main, donc protégée", () => {
    expect(ecritureDatePermise(undefined, "usine").ok).toBe(false);
    expect(ecritureDatePermise(undefined, "vous").ok).toBe(true);
  });
  it("origine illisible ou nouvelle origine absente : refusé", () => {
    for (const mauvaise of [null, "", "studio", 42, {}, []]) {
      expect(ecritureDatePermise("usine", mauvaise as never).ok).toBe(false);
      expect(ecritureDatePermise(mauvaise as never, "vous").ok).toBe(false);
    }
    expect(ecritureDatePermise("usine", undefined as never).ok).toBe(false);
  });
  it("toutes les combinaisons des deux seules origines : seule usine sur vous est refusée", () => {
    for (const a of ORIGINES_ENTREE) for (const n of ORIGINES_ENTREE) expect(ecritureDatePermise(a, n).ok).toBe(!(a === "vous" && n === "usine"));
  });
});

describe("CAL-01 · libellés et fiche", () => {
  it("une libellé par origine", () => {
    expect(libelleOrigineDate("vous")).toBe("choisie par vous");
    expect(libelleOrigineDate("usine")).toBe("proposée par l'usine");
    expect(libelleOrigineDate(undefined)).toBe("choisie par vous");
    expect(libelleOrigineDate("autre" as never)).toBe("choisie par vous");
  });
  it("la fiche affiche « choisie par vous » ou « proposée par l'usine »", () => {
    expect(rendre("vous")).toContain("Date choisie par vous");
    expect(rendre("vous")).not.toContain("proposée par l&#x27;usine");
    const usine = rendre("usine");
    expect(usine).toMatch(/Date proposée par l(&#x27;|')usine/);
    expect(usine).not.toContain("choisie par vous");
  });
  it("entrée sans origine : « choisie par vous » (rien ne l'alimente en V1)", () => {
    expect(rendre()).toContain("Date choisie par vous");
  });
  it("la date illisible n'affiche pas d'origine", () => {
    const html = renderToStaticMarkup(createElement(FicheEntree, { entree: { ...entree, jour: "n'importe quoi", origineDate: "vous" }, aujourdhui: "2026-12-01" }));
    expect(html).not.toContain("choisie par vous");
  });
  it("les origines sont les deux valeurs de types.ts", () => {
    expect([...ORIGINES_ENTREE]).toEqual(["vous", "usine"]);
  });
});
