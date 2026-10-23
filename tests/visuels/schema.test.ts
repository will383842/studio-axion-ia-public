import { describe, expect, it } from "vitest";
import { CarrouselSpec } from "@/domaine/visuels/schema";
import { capaciteCarte, PAGES, TYPES_PAGE } from "@/briques/visuels/registre-pages";
import { MINIS, TYPES_MINI } from "@/briques/visuels/registre-mini";
import { LIMITES } from "@/briques/visuels/limites";
import { DEFINITION_CARROUSEL } from "@/visuels/registre";
import { chargerReglesCarrousel } from "@/briques/visuels/regles/charger-regles";

const carte = { titre: "Étape un", corps: "Un texte", mini: "W01" };
const t01 = { type: "T01", titre: "Titre d'exemple", sousTitre: "Un sous-titre" };
const t02 = (n: number) => ({
  type: "T02",
  titre: "Page dense",
  cartes: Array.from({ length: n }, () => carte),
});
const spec = (extra: object = {}, pages: object[] = [t01, t02(3)]) => ({
  version: "carrousel/1",
  alt: "Carrousel d'exemple en deux pages",
  pages,
  ...extra,
});

describe("CarrouselSpec", () => {
  it("accepte une spec valide", () => {
    expect(CarrouselSpec.safeParse(spec()).success).toBe(true);
  });
  it("refuse alt vide", () => {
    expect(CarrouselSpec.safeParse(spec({ alt: "" })).success).toBe(false);
  });
  it("refuse alt de 126 signes, accepte 125", () => {
    expect(CarrouselSpec.safeParse(spec({ alt: "a".repeat(126) })).success).toBe(false);
    expect(CarrouselSpec.safeParse(spec({ alt: "a".repeat(125) })).success).toBe(true);
  });
  it("refuse un type de page inconnu", () => {
    expect(CarrouselSpec.safeParse(spec({}, [{ type: "T99", titre: "x" }])).success).toBe(false);
  });
  it("refuse 1 carte sur T02 (une page dense en veut au moins 2), accepte 2", () => {
    expect(CarrouselSpec.safeParse(spec({}, [t01, t02(1)])).success).toBe(false);
    expect(CarrouselSpec.safeParse(spec({}, [t01, t02(2)])).success).toBe(true);
  });
  it("refuse 7 cartes sur T02, accepte 6", () => {
    expect(CarrouselSpec.safeParse(spec({}, [t01, t02(7)])).success).toBe(false);
    expect(CarrouselSpec.safeParse(spec({}, [t01, t02(6)])).success).toBe(true);
  });
  it("refuse un mini-visuel inconnu", () => {
    const p = { ...t02(2), cartes: [{ ...carte, mini: "W99" }, carte] };
    expect(CarrouselSpec.safeParse(spec({}, [t01, p])).success).toBe(false);
  });
  it("refuse tout champ couleur (racine, page, carte)", () => {
    expect(CarrouselSpec.safeParse(spec({ couleur: "#FF0000" })).success).toBe(false);
    expect(CarrouselSpec.safeParse(spec({}, [{ ...t01, couleur: "#FF0000" }])).success).toBe(false);
    const p = { ...t02(2), cartes: [{ ...carte, couleur: "rouge" }, carte] };
    expect(CarrouselSpec.safeParse(spec({}, [t01, p])).success).toBe(false);
  });
  it("refuse une chaîne http dans un champ texte", () => {
    for (const v of ["http://exemple.test", "Voir https://exemple.test", "HTTP://X", "www.exemple.test"]) {
      expect(CarrouselSpec.safeParse(spec({}, [{ ...t01, titre: v }])).success).toBe(false);
      expect(CarrouselSpec.safeParse(spec({ alt: v })).success).toBe(false);
    }
  });
  it.each([
    "mailto:a@b.fr", "MAILTO:a@b.fr", "file:///etc/passwd", "ftp:x", "blob:abc", "vbscript:x", "javascript:alert(1)", "data:text/html,x",
    "exemple.com", "foo.fr/bar", "Voir axion-ia.com", "sous.domaine.exemple.org",
  ])("refuse le lien ou domaine nu : %s", (v) => {
    expect(CarrouselSpec.safeParse(spec({}, [{ ...t01, titre: v }])).success).toBe(false);
    expect(CarrouselSpec.safeParse(spec({ alt: v })).success).toBe(false);
  });
  it.each(["Étape 1: démarrer", "Note : prix 3.5 mm", "Version 1.2 sortie", "Et voilà. Fin."])(
    "accepte un texte ordinaire : %s",
    (v) => {
      expect(CarrouselSpec.safeParse(spec({}, [{ ...t01, titre: v }])).success).toBe(true);
    },
  );
  it.each([
    ["NUL", "a\u0000b"], ["tabulation", "a\tb"], ["retour chariot", "a\rb"], ["ESC", "a\u001Bb"],
    ["U+200B", "a\u200Bb"], ["U+200F", "a\u200Fb"], ["U+2028", "a\u2028b"], ["U+202E", "a\u202Eb"],
    ["U+2060", "a\u2060b"], ["U+FEFF", "a\uFEFFb"],
  ])("refuse le caractère de contrôle ou invisible : %s", (_nom, v) => {
    expect(CarrouselSpec.safeParse(spec({}, [{ ...t01, titre: v }])).success).toBe(false);
  });
  it("accepte le saut de ligne", () => {
    expect(CarrouselSpec.safeParse(spec({}, [{ ...t01, titre: "ligne un\nligne deux" }])).success).toBe(true);
  });
  it("refuse un texte fait d'espaces seuls", () => {
    expect(CarrouselSpec.safeParse(spec({}, [{ ...t01, titre: "   " }])).success).toBe(false);
    expect(CarrouselSpec.safeParse(spec({ alt: " \n " })).success).toBe(false);
  });
  it("n'a aucun champ URL dans le schéma (SEC-01)", () => {
    expect(JSON.stringify(CarrouselSpec.toJSONSchema()).toLowerCase()).not.toMatch(/"(url|href|src|lien|image)"|"format":"uri"/);
  });
  it("borne le nombre de pages", () => {
    const pages = Array.from({ length: LIMITES.pagesMax + 1 }, () => t01);
    expect(CarrouselSpec.safeParse(spec({}, pages)).success).toBe(false);
    expect(CarrouselSpec.safeParse(spec({}, [])).success).toBe(false);
  });
});

describe("fichier de règles unique (M0-03)", () => {
  it("LIMITES == JSON", () => {
    const { longueurs } = chargerReglesCarrousel();
    expect(LIMITES.titreMax).toBe(longueurs.titreMax);
    expect(LIMITES.corpsMax).toBe(longueurs.corpsMax);
    expect(LIMITES.altMax).toBe(longueurs.altMax);
  });
  it("cartes.min/max du JSON == bornes du schéma T02", () => {
    const { cartes } = chargerReglesCarrousel();
    expect(cartes.max).toBe(PAGES.T02.cartesMax);
    expect(CarrouselSpec.safeParse(spec({}, [t01, t02(cartes.min)])).success).toBe(true);
    expect(CarrouselSpec.safeParse(spec({}, [t01, t02(cartes.min - 1)])).success).toBe(false);
    expect(CarrouselSpec.safeParse(spec({}, [t01, t02(cartes.max + 1)])).success).toBe(false);
  });
  it("expose la liste privée « appels », vide", () => {
    expect(chargerReglesCarrousel().appels).toEqual([]);
  });
});

describe("registres", () => {
  it("pages T01, T01B, T01C, T02, T06, T08, T10, T20, T21", () => {
    expect([...TYPES_PAGE]).toEqual(["T01", "T01B", "T01C", "T02", "T06", "T08", "T10", "T20", "T21"]);
    expect(PAGES.T02.cartesMax).toBe(6);
  });
  it("mini-visuels W01,W02,W03,W06,W07,W25", () => {
    expect([...TYPES_MINI]).toEqual(["W01", "W02", "W03", "W06", "W07", "W25"]);
    expect(MINIS.W25.nom).toBeTruthy();
  });
  it("DefinitionVisuel du carrousel", () => {
    expect(DEFINITION_CARROUSEL.id).toBe("carrousel/1");
    expect(DEFINITION_CARROUSEL.charte).toBe("charte-carrousel/1");
    expect(DEFINITION_CARROUSEL.schema).toBe(CarrouselSpec);
  });

  // Budget de texte par carte, mesuré au rendu réel (studio-rendu/scripts/essai-capacite-cartes.ts) : au-delà, le texte serait coupé.
  it("budget de texte par carte : décroît avec le nombre de cartes et ne dépasse jamais les bornes du schéma", () => {
    for (let n = 1; n <= PAGES.T02.cartesMax; n++) {
      const c = capaciteCarte(n);
      expect(c.titre).toBeLessThanOrEqual(LIMITES.titreMax);
      expect(c.corps).toBeLessThanOrEqual(LIMITES.corpsMax);
      if (n > 1) expect(c.corps).toBeLessThanOrEqual(capaciteCarte(n - 1).corps);
    }
  });
  it.each([2, 3, 4, 5, 6])("%i carte(s) : le texte au maximum du budget passe, un caractère de plus est refusé", (n) => {
    const { titre, corps } = capaciteCarte(n);
    const page = (t: number, c: number) => ({ type: "T02", titre: "Page dense", cartes: Array.from({ length: n }, () => ({ titre: "a".repeat(t), corps: "b".repeat(c) })) });
    expect(CarrouselSpec.safeParse(spec({}, [t01, page(titre, corps)])).success).toBe(true);
    expect(CarrouselSpec.safeParse(spec({}, [t01, page(titre + 1, corps)])).success).toBe(false);
    expect(CarrouselSpec.safeParse(spec({}, [t01, page(titre, corps + 1)])).success).toBe(false);
  });
});
