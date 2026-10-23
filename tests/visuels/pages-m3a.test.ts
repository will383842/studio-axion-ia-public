import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CarrouselSpec } from "@/domaine/visuels/schema";
import { TYPES_DECOR } from "@/briques/visuels/registre-decor";
import { CAPACITE_CITATION, CAPACITE_PANNEAU, capaciteEtape, capaciteListe, PAGES, TYPES_PAGE, type TypePage } from "@/briques/visuels/registre-pages";
import { TEXTES_FIXES } from "@/briques/visuels/textes-fixes";
import { casMax, casMin, CONTENU_ESSAI_M3A, CONTENU_ESSAI_M3A_C, FICHIER_COUVERTURE_C_M3A, FICHIER_T08_MAX_M3A, FICHIERS_ESSAI_M3A, specUnePage } from "../../studio-rendu/scripts/contenu-essai-visuel";

const valide = (page: object) => CarrouselSpec.safeParse(specUnePage(page as Record<string, unknown>)).success;
const spec = (pages: object[]) => ({ version: "carrousel/1", alt: "Carrousel d'exemple", pages });
const couv = { type: "T01", titre: "Une couverture" };
const sombre = { type: "T21" };

describe("registre des pages : rôles documentés", () => {
  it.each(TYPES_PAGE)("%s : nom, rôle, bornes cohérentes", (type) => {
    const p = PAGES[type];
    expect(p.id).toBe(type);
    expect(p.nom.length).toBeGreaterThan(2);
    expect(p.role.length).toBeGreaterThan(20);
    expect(p.elements.min).toBeLessThanOrEqual(p.elements.max);
    expect(p.titreMax).toBeLessThanOrEqual(60);
  });
  it("rôles attendus", () => {
    expect(PAGES.T06.role).toMatch(/liste/i);
    expect(PAGES.T08.role).toMatch(/avant/i);
    expect(PAGES.T10.role).toMatch(/message/i);
    expect(PAGES.T20.role).toMatch(/étapes/i);
    expect(PAGES.T21.role).toMatch(/dernière/i);
    expect(PAGES.T21.role).toMatch(/sombre/i);
  });
  it("3 à 5 éléments pour la liste et le processus", () => {
    expect(PAGES.T06.elements).toEqual({ min: 3, max: 5 });
    expect(PAGES.T20.elements).toEqual({ min: 3, max: 5 });
  });
});

describe("contenu MAXIMAL et MINIMAL de chaque type passent le schéma", () => {
  it.each(TYPES_PAGE)("%s", (type) => {
    for (const cas of [...casMax(type), ...casMin(type)]) expect(valide(cas.page), `${type} ${cas.nom}`).toBe(true);
  });
  it.each(TYPES_PAGE.filter((t: TypePage) => PAGES[t].titreMax > 0))("%s : un signe de plus au titre est refusé", (type) => {
    const page = casMax(type)[0].page;
    expect(valide({ ...page, titre: `${page.titre as string}x` })).toBe(false);
  });
});

describe("T01B et T01C : même schéma que T01, avec un élément décoratif facultatif", () => {
  it.each(["T01B", "T01C"])("%s accepte titre, sous-titre et deco", (type) => {
    expect(valide({ type, titre: "Titre", sousTitre: "Sous-titre", deco: "E07" })).toBe(true);
    expect(valide({ type, titre: "Titre" })).toBe(true);
    expect(valide({ type, titre: "Titre", deco: "E16" })).toBe(false);
    expect(valide({ type, titre: "Titre", cartes: [] })).toBe(false);
  });
  it("T01 n'a pas d'élément décoratif", () => {
    expect(valide({ type: "T01", titre: "Titre", deco: "E01" })).toBe(false);
  });
});

describe("T06 liste numérotée", () => {
  const p = (n: number, texte = "Un point") => ({ type: "T06", titre: "Une liste", points: Array.from({ length: n }, () => ({ texte })) });
  it("3 à 5 points", () => {
    expect([2, 3, 4, 5, 6].map((n) => valide(p(n)))).toEqual([false, true, true, true, false]);
  });
  it.each([3, 4, 5])("%i points : le budget passe, un signe de plus est refusé", (n) => {
    const { texte } = capaciteListe(n);
    expect(valide(p(n, "a".repeat(texte)))).toBe(true);
    expect(valide(p(n, "a".repeat(texte + 1)))).toBe(false);
  });
});

describe("T08 avant / après", () => {
  const p = (avant: string, apres: string) => ({ type: "T08", titre: "Un contraste", avant, apres });
  it("deux textes bornés", () => {
    expect(valide(p("a".repeat(CAPACITE_PANNEAU.texte), "b".repeat(CAPACITE_PANNEAU.texte)))).toBe(true);
    expect(valide(p("a".repeat(CAPACITE_PANNEAU.texte + 1), "b"))).toBe(false);
    expect(valide(p("a", "b".repeat(CAPACITE_PANNEAU.texte + 1)))).toBe(false);
    expect(valide({ type: "T08", titre: "Un contraste", avant: "a" })).toBe(false);
  });
});

describe("T10 citation / message clé", () => {
  it("message borné, légende et décor facultatifs, pas de titre", () => {
    expect(valide({ type: "T10", message: "a".repeat(CAPACITE_CITATION.message) })).toBe(true);
    expect(valide({ type: "T10", message: "a".repeat(CAPACITE_CITATION.message + 1) })).toBe(false);
    expect(valide({ type: "T10", message: "Un message", legende: "a".repeat(CAPACITE_CITATION.legende + 1) })).toBe(false);
    expect(valide({ type: "T10", message: "Un message", legende: "Une légende", deco: "E03" })).toBe(true);
    expect(valide({ type: "T10", message: "Un message", titre: "x" })).toBe(false);
  });
});

describe("T20 étapes", () => {
  const p = (n: number, titre = "Une étape", corps = "Un texte") => ({ type: "T20", titre: "Un processus", etapes: Array.from({ length: n }, () => ({ titre, corps })) });
  it("3 à 5 étapes", () => {
    expect([2, 3, 4, 5, 6].map((n) => valide(p(n)))).toEqual([false, true, true, true, false]);
  });
  it.each([3, 4, 5])("%i étapes : le budget passe, un signe de plus est refusé", (n) => {
    const c = capaciteEtape(n);
    expect(valide(p(n, "a".repeat(c.titre), "b".repeat(c.corps)))).toBe(true);
    expect(valide(p(n, "a".repeat(c.titre + 1), "b"))).toBe(false);
    expect(valide(p(n, "a", "b".repeat(c.corps + 1)))).toBe(false);
  });
  it("pas de mini-visuel sur une étape", () => {
    expect(valide({ type: "T20", titre: "Un processus", etapes: Array.from({ length: 3 }, () => ({ titre: "a", corps: "b", mini: "W01" })) })).toBe(false);
  });
});

describe("T21 dernière page sombre", () => {
  it("ne porte aucun champ : texte générique posé par le code", () => {
    expect(valide({ type: "T21" })).toBe(true);
    for (const extra of [{ titre: "x" }, { lien: "x" }, { texte: "Commentez MOT" }, { nom: "x" }]) expect(valide({ type: "T21", ...extra })).toBe(false);
  });
  it("une seule page sombre, et c'est la dernière", () => {
    expect(CarrouselSpec.safeParse(spec([couv, sombre])).success).toBe(true);
    expect(CarrouselSpec.safeParse(spec([sombre, couv])).success).toBe(false);
    expect(CarrouselSpec.safeParse(spec([couv, sombre, sombre])).success).toBe(false);
    // T21 seule : ne peut pas échouer seul (la page 0 doit être une couverture), donc pas un cas isolé
    // expect(CarrouselSpec.safeParse(spec([sombre])).success).toBe(false);
    expect(CarrouselSpec.safeParse(spec([{ type: "T06", titre: "Une liste", points: [{ texte: "a" }, { texte: "b" }, { texte: "c" }] }, sombre])).success).toBe(false); // page de contenu en page 0 refusée
    expect(CarrouselSpec.safeParse(spec([couv, couv, sombre])).success).toBe(false);
  });
  it("le texte posé par le code : sans lien, sans nom, sans « Commentez MOT », sans chiffre", () => {
    const textes = [TEXTES_FIXES.t21Titre, TEXTES_FIXES.t21Ligne];
    for (const t of textes) {
      expect(t).not.toMatch(/https?:|www\.|@|\/\/|commentez|\d/i);
      // il passe le même filtre que tout texte de carrousel (aucun domaine nu)
      expect(CarrouselSpec.safeParse({ ...spec([couv]), alt: t }).success, t).toBe(true);
    }
    expect(TEXTES_FIXES.t21Titre).toMatch(/message priv/i);
  });
});

describe("registre des éléments décoratifs E01–E15", () => {
  it("quinze éléments, de E01 à E15", () => {
    expect([...TYPES_DECOR]).toEqual(Array.from({ length: 15 }, (_, i) => `E${String(i + 1).padStart(2, "0")}`));
  });
});

describe("contenu d'essai M3a", () => {
  it("passe le schéma, sans chiffre ni adresse, et chaque page est d'un type différent", () => {
    expect(CarrouselSpec.safeParse(CONTENU_ESSAI_M3A).success).toBe(true);
    expect(CarrouselSpec.safeParse(CONTENU_ESSAI_M3A_C).success).toBe(true);
    expect(CONTENU_ESSAI_M3A.pages.map((p) => p.type)).toEqual(["T01B", "T06", "T08", "T10", "T20", "T21"]);
    expect(FICHIERS_ESSAI_M3A).toHaveLength(CONTENU_ESSAI_M3A.pages.length);
    expect(JSON.stringify(CONTENU_ESSAI_M3A, (cle, v) => (cle === "version" || cle === "type" || cle === "deco" ? undefined : v))).not.toMatch(/\d/);
  });
  it("les JPEG de l'essai sont versionnés", () => {
    for (const f of [...FICHIERS_ESSAI_M3A, FICHIER_COUVERTURE_C_M3A, FICHIER_T08_MAX_M3A, "e01-e15-decors.jpg"]) {
      const octets = readFileSync(new URL(`../../studio-rendu/essais-visuels/m3a/${f}`, import.meta.url));
      expect([...octets.subarray(0, 3)], f).toEqual([0xff, 0xd8, 0xff]);
    }
  });
});
