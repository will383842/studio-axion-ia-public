/**
 * L7-17a : « Infographies » sous Mes contenus ; « À traiter » sous Publier seulement quand on le demande (configuration seule).
 */
import { describe, expect, it } from "vitest";
import * as nav from "../src/components/coquille/navigation";
import { pagesTrouvees } from "../src/components/coquille/pages-recherche";

const sous = (id: string) => nav.RUBRIQUES_NAV.find((r) => r.id === id)!.enfants!.map((e) => e.libelle);
const publier = (...args: Parameters<typeof nav.rubriquesLaterales>) => nav.rubriquesLaterales(...args).find((r) => r.id === "publier")!;

describe("Mes contenus", () => {
  it("trois enfants dans l'ordre : Vidéos, Carrousels, Infographies", () => {
    expect(sous("contenus")).toEqual(["Vidéos", "Carrousels", "Infographies"]);
    const info = nav.RUBRIQUES_NAV.find((r) => r.id === "contenus")!.enfants![2];
    expect(info).toMatchObject({ href: "/infographies", icone: "image" });
  });
  it("le reste du menu ne change pas : 7 rubriques, même ordre, mêmes id", () => {
    expect(nav.RUBRIQUES_NAV.map((r) => r.id)).toEqual(["accueil", "ecrire", "contenus", "calendrier", "publier", "resultats", "ressources"]);
  });
  it("la recherche trouve « infographie »", () => {
    expect(pagesTrouvees("infographie").map((p) => p.href)).toContain("/infographies");
  });
});

describe("À traiter", () => {
  it("l'entrée est exportée", () => {
    expect(nav.ENTREE_A_TRAITER).toEqual({ href: "/a-traiter", libelle: "À traiter", icone: "mail" });
  });
  it("jamais visible par défaut", () => {
    expect(publier().enfants!.map((e) => e.libelle)).toEqual(["Réponses automatiques"]);
    expect(nav.navigationLaterale([]).some((e) => e.href === "/a-traiter")).toBe(false);
    expect(nav.tuilesPlusMobile().some((e) => e.href === "/a-traiter")).toBe(false);
    expect(nav.NAV_LATERALE.some((e) => e.href === "/a-traiter")).toBe(false);
  });
  it("avecATraiter : ajouté EN DERNIER dans Publier, après Réponses automatiques", () => {
    expect(publier(false, false, true).enfants!.map((e) => e.libelle)).toEqual(["Réponses automatiques", "À traiter"]);
    expect(publier(true, true, true).enfants!.map((e) => e.libelle)).toEqual(["Vidéos validées", "Sur le site", "Réponses automatiques", "À traiter"]);
  });
  it("les autres fonctions suivent le 3e paramètre", () => {
    expect(nav.hrefCourant("/a-traiter")).toBeNull();
    expect(nav.hrefCourant("/a-traiter", false, false, true)).toBe("/a-traiter");
    expect(nav.rubriqueDeLaPage("/a-traiter", false, false, true)).toBe("publier");
    expect(nav.navigationLaterale([], false, false, true).map((e) => e.href)).toContain("/a-traiter");
    expect(nav.tuilesPlusMobile(false, false, true).map((e) => e.href)).toContain("/a-traiter");
    const sec = nav.sectionsPlusMobile(false, false, true).find((s) => s.titre === "Publier")!;
    expect(sec.entrees.map((e) => e.libelle)).toEqual(["Réponses automatiques", "À traiter"]);
  });
  it("la recherche ne propose pas « À traiter »", () => {
    expect(pagesTrouvees("à traiter").map((p) => p.href)).not.toContain("/a-traiter");
  });
  it("aucun compteur ni pastille dans les entrées", () => {
    expect(Object.keys(nav.ENTREE_A_TRAITER).sort()).toEqual(["href", "icone", "libelle"]);
  });
});
