import { describe, expect, it } from "vitest";
import { controlerCarrousel } from "../../src/domaine/controles-visuel/porte.js";
import { premierChiffre, sortantsDans } from "../../src/domaine/controles-visuel/texte.js";
import type { ContextePorte } from "../../src/domaine/visuels/contrats.js";

const ctx: ContextePorte = { interditsDans: () => [], faitsDisponibles: false };
const couverture = { type: "T01", titre: "Mieux organiser sa semaine", sousTitre: "Des gestes simples pour souffler" };
const dense = {
  type: "T02",
  titre: "Les bases",
  cartes: [
    { titre: "Planifier", corps: "Poser ses priorités le lundi matin." },
    { titre: "Déléguer", corps: "Confier ce qui peut l’être." },
  ],
};
const liste = { type: "T06", titre: "Votre routine", points: [{ texte: "Un café avant de commencer" }, { texte: "Une liste courte et claire" }, { texte: "Une pause à midi" }] };
const avantApres = { type: "T08", titre: "Avant et après", avant: "Des journées qui débordent", apres: "Des journées plus calmes" };
const etapes = {
  type: "T20",
  titre: "Le parcours",
  etapes: [
    { titre: "Noter", corps: "Écrire ce qui compte." },
    { titre: "Trier", corps: "Garder l’essentiel." },
    { titre: "Agir", corps: "Avancer pas à pas." },
  ],
};
const citation = (message: string) => ({ type: "T10", message });
const fin = { type: "T21" };
const specAvec = (pages: object[], extra: object = {}) => ({ version: "carrousel/1", alt: "Carrousel d’exemple sur l’organisation", pages, ...extra });
const reference = (message = "Le calme se prépare") => specAvec([couverture, dense, liste, avantApres, etapes, citation(message), fin]);
const codes = (spec: unknown) => [...new Set(controlerCarrousel(spec, ctx).rapport.controles.map((x) => x.code))].sort();

describe("durcissement : CHIFFRE", () => {
  it("multiplicateurs", () => expect(codes(reference("Avancez x2 plus vite"))).toEqual(["CHIFFRE"]));
  it("codes lettre + chiffre", () => {
    expect(codes(reference("Un format A4"))).toEqual(["CHIFFRE"]);
    expect(codes(reference("Ouvert en H24"))).toEqual(["CHIFFRE"]);
  });
  it("symboles chiffrés", () => {
    for (const s of ["½ journée", "Étape ①", "Un 1⁰ rang"]) expect(codes(reference(s))).toEqual(["CHIFFRE"]);
  });
  it("pleine chasse et arabes", () => {
    expect(codes(reference("Pendant ３ heures"))).toEqual(["CHIFFRE"]);
    expect(codes(reference("Pendant ٣ heures"))).toEqual(["CHIFFRE"]);
  });
  it("chiffres romains", () => expect(codes(reference("Au XXIe siècle"))).toEqual(["CHIFFRE"]));
  it("ordinaux en lettres", () => {
    for (const s of ["Le deuxième pas", "Le vingtième pas"]) expect(codes(reference(s))).toEqual(["CHIFFRE"]);
  });
  it("premier, première, second, seconde : adjectifs, pas des chiffres (UI-1)", () => {
    for (const s of ["Le premier pas", "Le second pas", "Une première étape", "Une seconde chance"]) expect(codes(reference(s)), s).toEqual([]);
  });
  it("fractions et quantités", () => {
    for (const s of ["La moitié du temps", "Un demi tour", "Le tiers restant", "Un quart", "Le double", "Le triple", "Quadruple effet", "Une dizaine", "Une douzaine", "Une quinzaine", "Une vingtaine", "Une trentaine", "Une centaine", "Un millier"]) {
      expect(codes(reference(s)), s).toEqual(["CHIFFRE"]);
    }
  });
  it("belgicismes", () => {
    for (const s of ["Septante clients", "Huitante clients", "Nonante clients"]) expect(codes(reference(s)), s).toEqual(["CHIFFRE"]);
  });
  it("« neuf » adjectif ne compte pas", () => {
    expect(codes(reference("Un outil neuf"))).toEqual([]);
    expect(codes(reference("Quoi de neuf"))).toEqual([]);
    expect(codes(reference("Un outil flambant neuf"))).toEqual([]);
    expect(codes(reference("Neuf clients"))).toEqual(["CHIFFRE"]);
  });
  it("seul un numéro commençant par 0 ou + est un téléphone", () => {
    const r = controlerCarrousel(reference("Un budget de 10 000 000 €"), ctx).rapport;
    expect(r.controles.map((c) => c.code)).toEqual(["CHIFFRE"]);
    expect(codes(reference("Le 2026-10-19"))).toEqual(["CHIFFRE"]);
    expect(codes(reference("Appelez +33 6 12 34 56 78"))).toEqual(["SORTANT"]);
  });
});

describe("durcissement : entrée non bornée", () => {
  it("e-mail : 100 000 « a » en moins de 50 ms", () => {
    const t = "a".repeat(100_000);
    const d = performance.now();
    sortantsDans(t);
    premierChiffre(t);
    expect(performance.now() - d).toBeLessThan(50);
  });
  it("spec refusée et énorme : rapide", () => {
    const d = performance.now();
    controlerCarrousel({ pages: [{ type: "T99", titre: "a".repeat(100_000) }] }, ctx);
    expect(performance.now() - d).toBeLessThan(500);
  });
  it("spec refusée de 300 chaînes de 2000 caractères : moins de 200 ms", () => {
    const pages = Array.from({ length: 300 }, () => ({ type: "T99", titre: "a".repeat(2000) }));
    const d = performance.now();
    controlerCarrousel({ pages }, ctx);
    expect(performance.now() - d).toBeLessThan(200);
  });
  it("spec imbriquée sur 10 000 niveaux : SCHEMA sans erreur", () => {
    let o: unknown = "x";
    for (let i = 0; i < 10_000; i++) o = { a: o };
    const r = controlerCarrousel(o, ctx).rapport;
    expect(r.controles.map((c) => c.code)).toContain("SCHEMA");
  });
});

describe("durcissement : SCHEMA en français", () => {
  it("controlerCarrousel(null) sans « Invalid »", () => {
    const phrases = controlerCarrousel(null, ctx).rapport.controles.map((c) => c.phrase).join(" ");
    expect(phrases).not.toMatch(/Invalid|Expected|Required/);
    expect(phrases).toContain("n'a pas la bonne forme");
  });
  it("type de page inconnu", () => {
    const r = controlerCarrousel(specAvec([couverture, { type: "T99", titre: "x" }]), ctx).rapport;
    expect(r.controles.map((c) => c.phrase).join(" ")).not.toMatch(/Invalid/);
  });
});

describe("durcissement : TUTOIEMENT / J_AIDE", () => {
  it("« ton » tonalité n'est pas un tutoiement", () => {
    expect(codes(reference("Le bon ton"))).toEqual([]);
    expect(codes(reference("Ton sur ton"))).toEqual([]);
  });
  it("te, tien, tienne, tiens, tiennes", () => {
    for (const s of ["Je te montre", "Le tien", "La tienne", "Les tiens", "Les tiennes"]) expect(codes(reference(s)), s).toEqual(["TUTOIEMENT"]);
  });
  it("ton / ta / tes restent refusés", () => {
    expect(codes(reference("Prends ton temps"))).toEqual(["TUTOIEMENT"]);
    expect(codes(reference("TA TES voie"))).toEqual(["TUTOIEMENT"]);
  });
  it("apostrophes typographiques", () => {
    expect(codes(reference("Cela tʼaide"))).toEqual(["TUTOIEMENT"]);
    expect(codes(reference("Cela t‘aide"))).toEqual(["TUTOIEMENT"]);
    expect(codes(reference("Cela T'aide"))).toEqual(["TUTOIEMENT"]);
    expect(codes(reference("Jʼaide les équipes"))).toEqual(["J_AIDE"]);
    expect(codes(reference("J‘aide les équipes"))).toEqual(["J_AIDE"]);
  });
});

describe("durcissement : ANGLAIS par page", () => {
  it("« How to grow your business »", () => expect(codes(reference("How to grow your business"))).toEqual(["ANGLAIS"]));
  it("textes courts d'une même page concaténés", () => {
    const p = { type: "T02", titre: "How to", cartes: [{ titre: "grow your", corps: "business with the" }, { titre: "tools", corps: "you have" }] };
    expect(codes(specAvec([couverture, p, liste, avantApres, etapes, citation("Le calme se prépare"), fin]))).toContain("ANGLAIS");
  });
});

describe("durcissement : lieu", () => {
  it("le texte alternatif", () => {
    const r = controlerCarrousel({ ...reference(), alt: "Carrousel de 3 pages" }, ctx).rapport;
    const c = r.controles.find((x) => x.code === "CHIFFRE");
    expect(c?.phrase.startsWith("Le texte alternatif :")).toBe(true);
  });
  it("le carrousel (hors page, hors alt)", () => {
    const r = controlerCarrousel({ ...reference(), titre: "Tu gagnes" } as object, ctx).rapport;
    const c = r.controles.find((x) => x.code === "TUTOIEMENT");
    expect(c?.phrase.startsWith("Le carrousel :")).toBe(true);
  });
});
