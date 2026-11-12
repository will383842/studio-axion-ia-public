/** MG-0 : contrat pur avec le catalogue du site (chemins, lecture défensive, mots, cibles, recherche, phrases de refus). Valeurs fictives. */
import { describe, expect, it } from "vitest";
import catalogueFictif from "./fixtures/catalogue-reseau-fictif.json";
import {
  CHEMIN_CATALOGUE_RESEAU,
  CHEMIN_CIBLES_RESEAU,
  CHEMIN_MOTS_CIBLES,
  CODE_GUIDE_DEPART,
  PHRASES_REFUS_SITE,
  RE_CODE_CIBLE,
  cibleDuMot,
  lireCatalogue,
  lireLiaisons,
  motVersSite,
  rechercherCibles,
  reseauSite,
} from "@/domaine/guide-reseau/cibles-contrat";

const lu = lireCatalogue(catalogueFictif);
const catalogue = lu?.elements ?? [];

describe("constantes", () => {
  it("chemins et règle de code", () => {
    expect(CHEMIN_CATALOGUE_RESEAU).toBe("/api/interne/catalogue-reseau");
    expect(CHEMIN_MOTS_CIBLES).toBe("/api/interne/mots-cibles");
    expect(CHEMIN_CIBLES_RESEAU).toBe("/api/interne/cibles-reseau");
    expect(RE_CODE_CIBLE.test("gde-essai01")).toBe(true);
    expect(RE_CODE_CIBLE.test("adr-ab")).toBe(false);
    expect(CODE_GUIDE_DEPART).toBe("guide-ia");
  });
});

describe("motVersSite", () => {
  it("« STOP » et « 123 » refusés", () => {
    expect(motVersSite("STOP")).toBeNull();
    expect(motVersSite("123")).toBeNull();
  });
  it("« Chatgpt » => « chatgpt »", () => {
    expect(motVersSite("Chatgpt")).toBe("chatgpt");
  });
});

describe("lireCatalogue", () => {
  it("forme illisible => null", () => {
    expect(lireCatalogue("x")).toBeNull();
    expect(lireCatalogue({})).toBeNull();
    expect(lireCatalogue(null)).toBeNull();
  });
  it("jette l'url et le cheminPdf, ne garde que 5 champs", () => {
    const e = catalogue.find((x) => x.code === "adr-essai02");
    expect(e).toEqual({
      code: "adr-essai02",
      type: "adresse",
      titre: "Prière du soir (page fictive)",
      actif: true,
      test: false,
    });
    expect(JSON.stringify(catalogue)).not.toContain("exemple.test");
    expect(JSON.stringify(catalogue)).not.toContain("cheminPdf");
  });
  it("accepte guide-ia, ignore et compte le code mal formé", () => {
    expect(catalogue.some((x) => x.code === "guide-ia")).toBe(true);
    expect(catalogue.some((x) => x.code === "n-importe-quoi")).toBe(false);
    expect(lu?.ignores).toBe(1);
  });
});

describe("lireLiaisons", () => {
  it("une ligne de 25 lettres du site est ignorée et comptée", () => {
    const r = lireLiaisons([
      { mot: "chatgpt", reseau: "tous", codeCible: "gde-essai01", actif: true },
      {
        mot: "a".repeat(25),
        reseau: "tous",
        codeCible: "gde-essai01",
        actif: true,
      },
      { mot: "stop", reseau: "tous", codeCible: "gde-essai01", actif: true },
    ]);
    expect(r?.liaisons).toEqual([
      { mot: "CHATGPT", reseau: "tous", codeCible: "gde-essai01", actif: true },
    ]);
    expect(r?.ignores).toBe(2);
  });
  it("forme illisible => null", () => {
    expect(lireLiaisons({ a: 1 })).toBeNull();
  });
});

describe("cibleDuMot", () => {
  const liaisons = lireLiaisons([
    { mot: "chatgpt", reseau: "tous", codeCible: "gde-essai01", actif: true },
    {
      mot: "chatgpt",
      reseau: "facebook",
      codeCible: "adr-essai02",
      actif: true,
    },
  ])!.liaisons;
  it("la ligne propre au réseau l'emporte sur 'tous'", () => {
    const r = cibleDuMot("CHATGPT", "facebook", liaisons, catalogue);
    expect(r.element?.code).toBe("adr-essai02");
    expect(r.source).toBe("reseau");
    const t = cibleDuMot("CHATGPT", "instagram", liaisons, catalogue);
    expect(t.element?.code).toBe("gde-essai01");
    expect(t.source).toBe("tous");
  });
  it("mot sans ligne => rien", () => {
    expect(cibleDuMot("AUTRE", "tiktok", liaisons, catalogue)).toEqual({
      element: null,
      source: null,
      divergent: false,
    });
  });
});

describe("reseauSite", () => {
  it("linkedin_page et linkedin_profil => linkedin", () => {
    expect(reseauSite("linkedin")).toBe("linkedin");
    expect(reseauSite("linkedin_page")).toBe("linkedin");
    expect(reseauSite("linkedin_profil")).toBe("linkedin");
    expect(reseauSite("facebook")).toBe("facebook");
    expect(reseauSite("youtube")).toBeNull();
  });
});

describe("rechercherCibles", () => {
  it("« priere » trouve « Prière », cibles test en dernier, inactives exclues", () => {
    const r = rechercherCibles(catalogue, "priere");
    expect(r.map((x) => x.code)).toEqual(["adr-essai02", "gde-essai04"]);
  });
  it("filtre par type et plafonne", () => {
    expect(
      rechercherCibles(catalogue, "", { type: "guide" }).every(
        (x) => x.type === "guide",
      ),
    ).toBe(true);
    expect(rechercherCibles(catalogue, "", { max: 1 })).toHaveLength(1);
    expect(rechercherCibles(catalogue, "guide fictif b")).toHaveLength(0);
  });
});

describe("PHRASES_REFUS_SITE", () => {
  it("une phrase simple par code", () => {
    for (const code of [
      "mot_invalide",
      "cible_inconnue",
      "cible_inactive",
      "titre_invalide",
      "corps_invalide",
      "signature_invalide",
      "adresse_vide",
      "adresse_hote_non_autorise",
      "site_eteint",
      "trop_de_demandes",
    ]) {
      expect(PHRASES_REFUS_SITE[code]).toBeTruthy();
    }
  });
});
