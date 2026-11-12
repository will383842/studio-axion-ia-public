/**
 * L3-06 · LIEN SUIVI DES VISUELS ET DES POSTS (décision « lien suivi, version 2 » : nature « post » ouverte).
 * Une seule valeur de utm_medium (« post ») pour les visuels et les posts ; code de la forme de la vidéo ; code de format « VS ».
 */
import { describe, expect, it } from "vitest";
import { construireLienSuivi, ErreurLienSuivi, NATURES_LIEN } from "@/domaine/mesures";
import { listerCodes, entreeDuCode, MOTIF_CODE_FORMAT } from "@/formats/registre-codes";
import { questionsPlausible } from "@/fournisseurs/mesures/plausible";
import fixtures from "./lien-suivi/0002-lien-suivi-unique.v2.fixtures.json";

const base = { typeLien: "post", reseau: "linkedin", code: "0042-VS-LI", activite: "clients", page: "/fr/appel" };
const refus = (e: object) => {
  try {
    construireLienSuivi({ ...base, ...e });
  } catch (err) {
    expect(err).toBeInstanceOf(ErreurLienSuivi);
    return (err as ErreurLienSuivi).refus;
  }
  return "aucun refus";
};

describe("critère 1 · R02 donne l'adresse attendue", () => {
  it("R02 est un cas valide des fixtures v2 (plus un refus)", () => {
    expect(fixtures.construction.refus.some((r) => r.id === "R02")).toBe(false);
    const r02 = fixtures.construction.valides.find((v) => v.id === "R02")!;
    expect(r02.entree.type_lien).toBe("post");
    expect(construireLienSuivi({ typeLien: r02.entree.type_lien, reseau: r02.entree.reseau, code: r02.entree.code, activite: r02.entree.activite, page: r02.entree.page })).toBe(r02.attendu);
  });
  it("adresse exacte, utm_medium=post, depuis=post-<réseau> sur /fr/appel seulement", () => {
    expect(construireLienSuivi(base)).toBe("https://axion-ia.com/fr/appel?utm_source=linkedin&utm_medium=post&utm_campaign=0042-VS-LI&utm_content=clients&depuis=post-linkedin");
    expect(construireLienSuivi({ ...base, page: "/fr/guide-ia" })).toBe("https://axion-ia.com/fr/guide-ia?utm_source=linkedin&utm_medium=post&utm_campaign=0042-VS-LI&utm_content=clients");
  });
  it("« post » est une nature permise, la liste des réservées est vide, la nature est ramenée en minuscules", () => {
    expect(NATURES_LIEN).toContain("post");
    expect(fixtures.regles.natures_reservees).toEqual([]);
    expect(construireLienSuivi({ ...base, typeLien: "POST" })).toBe(construireLienSuivi(base));
  });
  it("chaque réseau permis accepte un post (le message privé reste réservé aux trois réseaux de messagerie)", () => {
    for (const r of fixtures.regles.reseaux) expect(new URL(construireLienSuivi({ ...base, reseau: r })).searchParams.get("utm_source")).toBe(r);
  });
});

describe("critère 2 · le format du code de sa nature est exigé", () => {
  it("« mot-x » sur un post : code_version_attendu", () => {
    expect(refus({ code: "mot-guide" })).toBe("code_version_attendu");
  });
  it("code de version en minuscules, vide ou mal formé sur un post : refusé, jamais corrigé", () => {
    expect(refus({ code: "0042-vs-li" })).toBe("code_version_attendu");
    expect(refus({ code: "" })).toBe("caractere_interdit");
    expect(refus({ code: "0042" })).toBe("code_version_attendu");
  });
  it("vidéo inchangée : 0042-TB-IG en majuscules ; message ou profil : mot-… en minuscules", () => {
    expect(refus({ typeLien: "video", code: "mot-guide" })).toBe("code_version_attendu");
    expect(refus({ typeLien: "message", code: "0042-VS-LI" })).toBe("code_mot_attendu");
    expect(refus({ typeLien: "profil", code: "0042-VS-LI" })).toBe("code_mot_attendu");
  });
  it("limites : 60 signes exactement passent, 61 sont trop longs ; page et activité inconnues refusées", () => {
    const soixante = "0042-VS-LI" + "-AAAAAAAA".repeat(5) + "-AAAA";
    expect(soixante).toHaveLength(60);
    expect(construireLienSuivi({ ...base, code: soixante })).toContain(`utm_campaign=${soixante}`);
    expect(refus({ code: soixante + "A" })).toBe("trop_long");
    expect(refus({ page: "/fr/tarifs" })).toBe("page_interdite");
    expect(refus({ activite: "prospects" })).toBe("activite_inconnue");
    expect(refus({ typeLien: "story" })).toBe("nature_inconnue");
  });
  it("toutes les fixtures v2 : valides égales à l'attendu, refus avec le bon motif", () => {
    for (const v of fixtures.construction.valides) {
      expect(construireLienSuivi({ typeLien: v.entree.type_lien, reseau: v.entree.reseau, code: v.entree.code, activite: v.entree.activite, page: v.entree.page }), v.id).toBe(v.attendu);
    }
    for (const r of fixtures.construction.refus) {
      expect(refus({ typeLien: r.entree.type_lien, reseau: r.entree.reseau, code: r.entree.code, activite: r.entree.activite, page: r.entree.page }), r.id).toBe(r.refus);
    }
  });
});

describe("critère 3 · la casse de utm_campaign est conservée", () => {
  it("le code sort tel qu'entré, majuscules comprises, suffixe de reprise compris", () => {
    for (const code of ["0042-VS-LI", "0042-VS-LI-R1", "123456-VS-FB"]) {
      expect(new URL(construireLienSuivi({ ...base, code })).searchParams.get("utm_campaign")).toBe(code);
    }
  });
});

describe("code de format « VS » (ajout seul, en fin de registre)", () => {
  it("VS est bien formé, unique, réservé au visuel et placé en dernier", () => {
    const liste = listerCodes();
    expect(liste[liste.length - 1].code).toBe("VS");
    expect("VS").toMatch(MOTIF_CODE_FORMAT);
    expect(liste.filter((e) => e.code === "VS")).toHaveLength(1);
    expect(entreeDuCode("VS")?.formatId).toBe("visuel");
  });
  it("rien n'est renuméroté : les codes d'avant gardent leur ordre et leur format", () => {
    const avant = ["AV", "PO", "EP", "UG", "SE", "MO", "WC", "SAR", "BUR", "TE", "TST", "FC", "TB", "CC", "FA", "IV", "TO", "DF"];
    expect(listerCodes().slice(0, avant.length).map((e) => e.code)).toEqual(avant);
    expect(entreeDuCode("TB")?.formatId).toBe("tableau-anime");
  });
});

describe("critère 4 · le filtre des mesures prend utm_medium dans [video, post]", () => {
  it("avec les natures voulues, visites et rendez-vous filtrent sur video et post", () => {
    const q = questionsPlausible("axion-ia.com", { natures: ["video", "post"] });
    expect(q.visites.filters).toContainEqual(["is", "visit:utm_medium", ["video", "post"]]);
    expect(q.rendezVous.filters).toContainEqual(["is", "visit:utm_medium", ["video", "post"]]);
  });
  it("sans option, la question reste celle d'avant (vidéo seule)", () => {
    expect(questionsPlausible("axion-ia.com").visites.filters).toEqual([["is", "visit:utm_medium", ["video"]]]);
  });
});
