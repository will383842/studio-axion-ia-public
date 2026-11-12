/** MG-0 : contrat pur avec le catalogue du site (chemins, lecture défensive, mots, cibles, recherche, phrases de refus). Valeurs fictives. */
import { describe, expect, it } from "vitest";
import { RESEAUX_GUIDE } from "@/domaine/guide-reseau/crochet-zernio";
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
      cibleIntrouvable: false,
      divergent: false,
    });
  });
  it("cible absente du catalogue ou inactive => cibleIntrouvable, pas divergent", () => {
    const absente = lireLiaisons([
      {
        mot: "chatgpt",
        reseau: "tous",
        codeCible: "gde-absent01",
        actif: true,
      },
    ])!.liaisons;
    const r = cibleDuMot("CHATGPT", "tiktok", absente, catalogue);
    expect(r.element).toBeNull();
    expect(r.cibleIntrouvable).toBe(true);
    expect(r.divergent).toBe(false);
    const inactive = catalogue.find((x) => !x.actif);
    expect(inactive).toBeDefined();
    const liens = lireLiaisons([
      {
        mot: "chatgpt",
        reseau: "tous",
        codeCible: inactive!.code,
        actif: true,
      },
    ])!.liaisons;
    const i = cibleDuMot("CHATGPT", "tiktok", liens, catalogue);
    expect(i.cibleIntrouvable).toBe(true);
    expect(i.divergent).toBe(false);
  });
  it("cible active trouvée => ni introuvable ni divergent", () => {
    const r = cibleDuMot("CHATGPT", "instagram", liaisons, catalogue);
    expect(r.cibleIntrouvable).toBe(false);
    expect(r.divergent).toBe(false);
  });
  it("divergent : le site pointe une autre cible que celle attendue", () => {
    expect(
      cibleDuMot("CHATGPT", "facebook", liaisons, catalogue, "adr-essai02")
        .divergent,
    ).toBe(false);
    const r = cibleDuMot(
      "CHATGPT",
      "facebook",
      liaisons,
      catalogue,
      "gde-essai01",
    );
    expect(r.divergent).toBe(true);
    expect(r.cibleIntrouvable).toBe(false);
  });
  it("sans cible attendue, jamais divergent", () => {
    expect(
      cibleDuMot("CHATGPT", "facebook", liaisons, catalogue, null).divergent,
    ).toBe(false);
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
  it("page_guide n'a pas de réseau côté site => null (choix voulu)", () => {
    expect(reseauSite("page_guide")).toBeNull();
  });
  it("chaque réseau du guide est traduit ou volontairement null", () => {
    for (const r of RESEAUX_GUIDE) {
      expect(reseauSite(r) === null).toBe(r === "page_guide");
    }
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

/**
 * Codes de refus RÉELLEMENT émis par le site (axion-ia, PR #1969) : `controlerEntree`
 * (src/server/videos/entree.ts), la signature (signature.ts), `catalogue-cibles.ts`
 * et `validerAdresse`. Si le site en ajoute un, ajouter ici ET dans PHRASES_REFUS_SITE.
 */
const CODES_EMIS_PAR_LE_SITE = [
  // entrée signée
  "reception_eteinte",
  "reception_non_configuree",
  "base_indisponible",
  "trop_de_requetes",
  "entetes_invalides",
  "type_non_supporte",
  "corps_trop_gros",
  "horodatage_hors_fenetre",
  "signature_invalide",
  // routes du catalogue
  "introuvable",
  "corps_illisible",
  "corps_invalide",
  "code_invalide",
  "titre_invalide",
  "guide_sans_adresse",
  "chemin_pdf_invalide",
  "adresse_sans_pdf",
  "mot_invalide",
  "cible_inconnue",
  "cible_inactive",
  // validerAdresse
  "adresse_vide",
  "adresse_trop_longue",
  "adresse_caracteres_interdits",
  "adresse_illisible",
  "adresse_https_obligatoire",
  "adresse_identifiants_interdits",
  "adresse_fragment_interdit",
  "adresse_port_interdit",
  "adresse_hote_non_autorise",
];

describe("PHRASES_REFUS_SITE", () => {
  it("les clés sont exactement les codes émis par le site (un oubli rougit)", () => {
    expect(Object.keys(PHRASES_REFUS_SITE).sort()).toEqual(
      [...CODES_EMIS_PAR_LE_SITE].sort(),
    );
  });
  it("une phrase non vide par code, sans clé inventée", () => {
    for (const code of CODES_EMIS_PAR_LE_SITE) {
      expect(PHRASES_REFUS_SITE[code]).toBeTruthy();
    }
    expect(PHRASES_REFUS_SITE["site_eteint"]).toBeUndefined();
    expect(PHRASES_REFUS_SITE["trop_de_demandes"]).toBeUndefined();
  });
  it("404 = introuvable, 429 = trop_de_requetes", () => {
    expect(PHRASES_REFUS_SITE["introuvable"]).toMatch(/éteint/);
    expect(PHRASES_REFUS_SITE["trop_de_requetes"]).toMatch(/Trop de demandes/);
  });
  it("l'horloge qui dérive se distingue d'une mauvaise signature", () => {
    expect(PHRASES_REFUS_SITE["horodatage_hors_fenetre"]).not.toBe(
      PHRASES_REFUS_SITE["signature_invalide"],
    );
    expect(PHRASES_REFUS_SITE["horodatage_hors_fenetre"]).toMatch(/horloge/);
  });
  it("mot_invalide ne prétend pas décrire la règle du site", () => {
    expect(PHRASES_REFUS_SITE["mot_invalide"]).not.toMatch(/\b20\b/);
  });
  it("jamais le vocabulaire interdit", () => {
    for (const phrase of Object.values(PHRASES_REFUS_SITE)) {
      expect(phrase).not.toMatch(/abonn/i);
    }
  });
});
