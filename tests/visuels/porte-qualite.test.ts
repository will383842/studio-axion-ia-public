import { describe, expect, it } from "vitest";
import { controlerCarrousel } from "../../src/domaine/controles-visuel/porte.js";
import type { ContextePorte } from "../../src/domaine/visuels/contrats.js";

const ctx: ContextePorte = { interditsDans: () => [], faitsDisponibles: false };
const ctxInterdit: ContextePorte = { interditsDans: (t) => (t.includes("motinterdit") ? ["motinterdit"] : []), faitsDisponibles: false };

// Spec de référence INVENTÉE : sept pages, sept types distincts, aucun chiffre, aucune faute de rythme.
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
const codes = (spec: unknown, c: ContextePorte = ctx) => [...new Set(controlerCarrousel(spec, c).rapport.controles.map((x) => x.code))].sort();

describe("porte qualité : spec propre", () => {
  it("la spec de référence est verte, sans contrôle ni correction", () => {
    const { rapport } = controlerCarrousel(reference(), ctx);
    expect(rapport).toEqual({ version: "porte-carrousel/1", verdict: "vert", controles: [], corrections: [] });
  });
});

describe("porte qualité : chaque défaut rougit exactement son code", () => {
  it("CHIFFRE : un chiffre en nombre, avec la phrase en français", () => {
    const { rapport } = controlerCarrousel(reference("Nous gagnons 3 heures"), ctx);
    expect(rapport.verdict).toBe("rouge");
    expect(rapport.controles).toHaveLength(1);
    expect(rapport.controles[0]).toMatchObject({ code: "CHIFFRE", niveau: "rouge", page: 6 });
    expect(rapport.controles[0].phrase).toBe("Page 6 : un chiffre est écrit (\"3 heures\") ; aucun chiffre tant que la liste de faits n'est pas validée.");
  });
  it("CHIFFRE : un chiffre en lettres", () => {
    expect(codes(reference("Nous gagnons trois heures"))).toEqual(["CHIFFRE"]);
    expect(codes(reference("Quatre-vingt choses"))).toEqual(["CHIFFRE"]);
  });
  it("CHIFFRE : « un » et « une » (articles) ne comptent pas", () => {
    expect(codes(reference("Une idée, un geste"))).toEqual([]);
  });
  it("INTERDIT : ce que renvoie interditsDans", () => {
    expect(codes(reference("Un motinterdit ici"), ctxInterdit)).toEqual(["INTERDIT"]);
    expect(codes(reference("Un motinterdit ici"), ctx)).toEqual([]);
  });
  it("TUTOIEMENT : tu / ton / ta / tes / toi / t' en mots entiers", () => {
    expect(codes(reference("Tu gagnes du temps"))).toEqual(["TUTOIEMENT"]);
    expect(codes(reference("Prends ton temps"))).toEqual(["TUTOIEMENT"]);
    expect(codes(reference("Cela t’aide vraiment"))).toEqual(["TUTOIEMENT"]);
    expect(codes(reference("Pour toi seul"))).toEqual(["TUTOIEMENT"]);
  });
  it("TUTOIEMENT : ne s'accroche pas au milieu d'un mot", () => {
    expect(codes(reference("Une attitude sûre, toute tranquille"))).toEqual([]);
  });
  it("J_AIDE : « J'aide »", () => {
    expect(codes(reference("J'aide les équipes"))).toEqual(["J_AIDE"]);
    expect(codes(reference("J’aide les équipes"))).toEqual(["J_AIDE"]);
  });
  it("SORTANT : e-mail (le schéma refuse aussi le nom de domaine, d'où SCHEMA en plus)", () => {
    expect(codes(reference("écrivez à nom@exemple.fr"))).toEqual(["SCHEMA", "SORTANT"]);
  });
  it("SORTANT : @pseudo, #hashtag, téléphone (sans compter le téléphone comme CHIFFRE)", () => {
    expect(codes(reference("Suivez @monpseudo"))).toEqual(["SORTANT"]);
    expect(codes(reference("Lisez #astuce"))).toEqual(["SORTANT"]);
    expect(codes(reference("Appelez 06 12 34 56 78"))).toEqual(["SORTANT"]);
    expect(codes(reference("Appelez 0612345678"))).toEqual(["SORTANT"]);
  });
  it("ANGLAIS : plus de 15 % de mots-outils anglais sur au moins 6 mots", () => {
    expect(codes(reference("This is a great tool for you"))).toEqual(["ANGLAIS"]);
  });
  it("ANGLAIS : un texte français ou trop court ne rougit pas", () => {
    expect(codes(reference("Le calme se prépare"))).toEqual([]);
    expect(codes(reference("The tool"))).toEqual([]);
  });
  it("DENSITE : la page la plus dense que le schéma accepte reste sous 200 mots (le contrôle est une ceinture de sécurité, les budgets du lot L1 passent avant)", () => {
    const mots = (n: number) => Array.from({ length: n }, () => "a").join(" ");
    const carte = (titre: number, corps: number) => ({ titre: mots(titre), corps: mots(corps) });
    const plus = specAvec([couverture, { type: "T02", titre: mots(15), cartes: [carte(24, 65), carte(24, 65)] }, liste, avantApres, etapes, citation("Le calme se prépare"), fin]);
    const r = controlerCarrousel(plus, ctx).rapport;
    expect(r.controles.filter((c) => c.code === "DENSITE")).toEqual([]);
    // Au-delà du schéma, la lecture du texte (même d'une spec refusée) ne rougit pas la densité : c'est le schéma qui refuse.
    const trop = specAvec([couverture, { type: "T02", titre: "Les bases", cartes: [carte(1, 100), carte(1, 100)] }, liste, avantApres, etapes, citation("Le calme se prépare"), fin]);
    expect(controlerCarrousel(trop, ctx).rapport.controles.some((c) => c.code === "SCHEMA" && c.page === 2)).toBe(true);
  });
  it("RYTHME : deux pages de suite de même type", () => {
    const autre = { ...dense, titre: "Les bases bis" };
    expect(codes(specAvec([couverture, dense, autre, liste, avantApres, etapes, fin]))).toEqual(["RYTHME"]);
  });
  it("TITRE_DOUBLE : deux titres identiques une fois normalisés", () => {
    const meme = { ...avantApres, titre: "LES  bases !" };
    expect(codes(specAvec([couverture, dense, liste, meme, etapes, citation("Le calme se prépare"), fin]))).toEqual(["TITRE_DOUBLE"]);
  });
  it("PAGES : moins de 6 pages (orange)", () => {
    const r = controlerCarrousel(specAvec([couverture, dense, liste, avantApres, fin]), ctx).rapport;
    expect(r.controles.map((c) => [c.code, c.niveau])).toEqual([["PAGES", "orange"]]);
    expect(r.verdict).toBe("orange");
  });
  it("PAGES : T21 absente (orange)", () => {
    const r = controlerCarrousel(specAvec([couverture, dense, liste, avantApres, etapes, citation("Le calme se prépare")]), ctx).rapport;
    expect(r.controles.map((c) => [c.code, c.niveau])).toEqual([["PAGES", "orange"]]);
  });
  it("VARIETE : moins de 4 types distincts (orange)", () => {
    const d2 = { ...dense, titre: "Autre page dense" };
    const d3 = { ...dense, titre: "Encore une page dense" };
    const l2 = { ...liste, titre: "Autre liste" };
    const pages = [couverture, dense, liste, d2, l2, d3, fin];
    // Types : T01, T02, T06, T02, T06, T02, T21 = 4 types distincts : pas de VARIETE.
    // Avec 3 types seulement (couverture, pages denses, fin), les pages denses se suivent : RYTHME sort aussi, c'est normal.
    const trois = [couverture, dense, { ...dense, titre: "Deux" }, { ...dense, titre: "Trois" }, { ...dense, titre: "Quatre" }, { ...dense, titre: "Cinq" }, fin];
    expect(codes(specAvec(pages))).toEqual([]);
    const r = controlerCarrousel(specAvec(trois), ctx).rapport;
    expect(r.controles.filter((c) => c.code === "VARIETE").map((c) => c.niveau)).toEqual(["orange"]);
  });
  it("un défaut placé dans `alt` est signalé au texte alternatif", () => {
    const r = controlerCarrousel({ ...reference(), alt: "Tu gagnes du temps" }, ctx).rapport;
    const c = r.controles.find((x) => x.code === "TUTOIEMENT");
    expect(c).toMatchObject({ chemin: "alt" });
    expect(c?.page).toBeUndefined();
    expect(c?.phrase.startsWith("Le texte alternatif :")).toBe(true);
  });
  it("SERIE : plus de 3 « Scénario type » (orange)", () => {
    const sc = (titre: string) => ({ ...dense, titre });
    const scl = (titre: string) => ({ ...liste, titre });
    const quatre = specAvec([couverture, sc("Scénario type : A"), scl("Scénario type : B"), sc("Scénario type : C"), scl("Scénario type : D"), etapes, fin]);
    expect(codes(quatre)).toEqual(["SERIE"]);
    const trois = specAvec([couverture, sc("Scénario type : A"), scl("Scénario type : B"), sc("Scénario type : C"), avantApres, etapes, fin]);
    expect(codes(trois)).toEqual([]);
    expect(controlerCarrousel(quatre, ctx).rapport.controles[0].niveau).toBe("orange");
  });
  it("SCHEMA : une spec que CarrouselSpec refuse est rouge", () => {
    const r = controlerCarrousel(specAvec([couverture, { type: "T99", titre: "x" }]), ctx).rapport;
    expect(r.verdict).toBe("rouge");
    expect([...new Set(r.controles.map((c) => c.code))]).toEqual(["SCHEMA"]);
    expect(codes(null)).toEqual(["SCHEMA"]);
  });
  it("le verdict est le pire niveau, et une phrase est toujours donnée", () => {
    const r = controlerCarrousel(specAvec([couverture, dense, liste, citation("Tu gagnes 3 heures"), fin]), ctx).rapport;
    expect(r.verdict).toBe("rouge");
    expect(r.controles.map((c) => c.code).sort()).toEqual(["CHIFFRE", "PAGES", "TUTOIEMENT"]);
    for (const c of r.controles) expect(c.phrase.length).toBeGreaterThan(10);
  });
});
