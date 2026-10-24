/** UI-1 : faux positifs de la porte (ordinaux, « N pages » du texte alternatif) et explications de la simulation. */
import { describe, expect, it } from "vitest";
import { FIXTURES_AXION } from "@/visuels/texte/fixtures";
import { controlerCarrousel } from "@/domaine/controles-visuel/porte";
import { classementDans, premierChiffre } from "@/domaine/controles-visuel/texte";
import type { ContextePorte } from "@/domaine/visuels/contrats";
import { creerFournisseurSimulation } from "@/visuels/texte/simulation";

const ctx: ContextePorte = { interditsDans: () => [], faitsDisponibles: false };
const specDe = (titre: string, alt = "Carrousel d’exemple sur l’organisation") => ({
  version: "carrousel/1",
  alt,
  pages: [
    { type: "T01", titre, sousTitre: "Des gestes simples pour souffler" },
    { type: "T02", titre: "Les bases", cartes: [{ titre: "Planifier", corps: "Poser ses priorités le lundi matin." }, { titre: "Déléguer", corps: "Confier ce qui peut l’être." }] },
    { type: "T06", titre: "Votre routine", points: [{ texte: "Un café avant de commencer" }, { texte: "Une liste courte et claire" }, { texte: "Une pause à midi" }] },
    { type: "T08", titre: "Avant et après", avant: "Des journées qui débordent", apres: "Des journées plus calmes" },
    { type: "T20", titre: "Le parcours", etapes: [{ titre: "Noter", corps: "Écrire ce qui compte." }, { titre: "Trier", corps: "Garder l’essentiel." }, { titre: "Agir", corps: "Avancer pas à pas." }] },
    { type: "T10", message: "Le calme se prépare" },
    { type: "T21" },
  ],
});
const codes = (spec: unknown) => [...new Set(controlerCarrousel(spec, ctx).rapport.controles.map((c) => c.code))].sort();

describe("porte : les ordinaux adjectifs ne sont pas des chiffres", () => {
  it.each(["Un premier devis", "Une première étape", "Le second regard", "Une seconde chance", "Les premiers pas", "Les premières idées"])("« %s » passe", (titre) => {
    expect(codes(specDe(titre))).toEqual([]);
  });
  it.each(["3 tâches à confier", "Trois clients sur quatre", "40 % de temps gagné", "Le 1er jour", "Le deuxième pas", "Le vingtième pas", "Au XXIe siècle", "Quelques secondes"])("« %s » reste bloqué", (titre) => {
    expect(codes(specDe(titre))).toEqual(["CHIFFRE"]);
  });
  it("premierChiffre : « 1er » écrit en chiffre est un chiffre, « premier » non", () => {
    expect(premierChiffre("Le 1er jour")).toBeDefined();
    expect(premierChiffre("Un premier devis")).toBeUndefined();
  });
});

describe("porte : « N pages » dans le texte alternatif", () => {
  it("le nombre de pages du carrousel lui-même est admis (en lettres ou en chiffres)", () => {
    expect(codes(specDe("Mieux s’organiser", "Carrousel en sept pages sur l’organisation"))).toEqual([]);
    expect(codes(specDe("Mieux s’organiser", "Carrousel en 7 pages sur l’organisation"))).toEqual([]);
  });
  it("un autre nombre de pages, ou un autre chiffre, reste bloqué", () => {
    expect(codes(specDe("Mieux s’organiser", "Carrousel en cinq pages sur l’organisation"))).toEqual(["CHIFFRE"]);
    expect(codes(specDe("Mieux s’organiser", "Carrousel de sept pages pour trois clients"))).toEqual(["CHIFFRE"]);
  });
  it("hors du texte alternatif, « cinq pages » est bloqué", () => {
    expect(codes(specDe("Cinq pages pour souffler"))).toEqual(["CHIFFRE"]);
  });
});

describe("simulation : explication quand le sujet n'est pas repris, et « Refaire » qui change", () => {
  const f = creerFournisseurSimulation();
  it("sujet avec un nombre : note qui le dit, titre = modèle", async () => {
    const r = await f.ecrire({ type: "sujet", sujet: "Cinq tâches à confier à l'IA dès lundi" });
    expect(r.titre).not.toContain("Cinq");
    expect(r.note).toBe("votre sujet n'a pas été repris comme titre parce qu'il contient un nombre");
  });
  it("sujet avec une formule à éviter : note", async () => {
    const r = await f.ecrire({ type: "sujet", sujet: "Nos solutions à Grenoble" });
    expect(r.note).toMatch(/parce qu'il contient un mot ou une formule à éviter/);
  });
  it("sujet trop long pour la couverture : note", async () => {
    const r = await f.ecrire({ type: "sujet", sujet: "Un sujet très très long pour tenir sur une couverture de carrousel" });
    expect(r.note).toMatch(/parce qu'il est trop long pour la couverture/);
  });
  it("sujet repris : pas de note ; « un premier devis » est repris", async () => {
    const r = await f.ecrire({ type: "sujet", sujet: "Un premier devis" });
    expect(r.titre).toBe("Un premier devis");
    expect(r.note).toBeUndefined();
  });
  it("« Refaire » (version suivante) choisit un autre modèle", async () => {
    expect(FIXTURES_AXION.length).toBeGreaterThan(1);
    const sujet = "Cinq tâches à confier à l'IA dès lundi";
    const a = await f.ecrire({ type: "sujet", sujet, version: 1 });
    const b = await f.ecrire({ type: "sujet", sujet, version: 2 });
    expect(JSON.stringify(b.spec)).not.toBe(JSON.stringify(a.spec));
    expect((await f.ecrire({ type: "sujet", sujet })).titre).toBe(a.titre);
  });
});

describe("porte : classements et durées (tour 2, tour 3)", () => {
  it.each([
    "Le premier cabinet de France",
    "Premier du marché",
    "Première solution au monde",
    "À la première place",
    "Au premier rang",
    "En première position",
    "Le leader du secteur",
    "Leader sur son marché",
    "Le numéro un des cabinets",
    "Le n° un du conseil",
  ])("« %s » est un classement sans source", (titre) => {
    expect(codes(specDe(titre))).toEqual(["CLASSEMENT"]);
  });
  it("la phrase du classement est dédiée, pas celle du chiffre", () => {
    const c = controlerCarrousel(specDe("Le leader du secteur"), ctx).rapport.controles.find((x) => x.code === "CLASSEMENT");
    expect(c?.phrase).toContain('classement sans source : "leader du"');
    expect(c?.phrase).toContain("retirez-le ou citez la source");
    expect(c?.phrase).not.toContain("un chiffre est écrit");
  });
  it.each(["En une seconde", "Un gain d’une seconde", "Chaque seconde compte"])("« %s » : durée, bloquée comme chiffre", (titre) => {
    expect(codes(specDe(titre))).toEqual(["CHIFFRE"]);
  });
  it.each([
    "La seconde étape",
    "Une seconde chance",
    "La première étape de la méthode",
    "Un premier devis",
    "Le premier devis",
    "Le premier du mois, envoyez la facture",
    "Le premier des réflexes : sauvegarder",
    "Le premier de la liste à appeler",
    "Faites-le en premier de la journée",
    "Votre première place de parking",
    "Premier pas en France pour votre site",
    "Un team leader attentif",
    "La seconde de trop",
    "À la seconde près",
  ])("« %s » passe", (titre) => {
    expect(codes(specDe(titre))).toEqual([]);
  });
});

describe("porte : un classement porte sur l'entreprise face aux autres, pas sur un événement", () => {
  it.each(["Nous sommes leaders.", "Premier sur son marché", "Le premier fournisseur du département", "Le meilleur artisan de la région"])("« %s » est un classement", (texte) => {
    expect(classementDans(texte)).toBeDefined();
    expect(codes(specDe(texte))).toEqual(["CLASSEMENT"]);
  });
  it.each(["Le premier client de la région nous a fait confiance", "Le premier salon du métier", "Leaders, voici la méthode"])("« %s » n'est pas un classement", (texte) => {
    expect(classementDans(texte)).toBeUndefined();
    expect(codes(specDe(texte))).not.toContain("CLASSEMENT");
  });
});

describe("porte : zone nationale sans acteur exigé, zone locale avec acteur (tour 3)", () => {
  it.each([
    "Le premier banque de France",
    "Le premier site du marché",
    "Le premier opérateur de France",
    "Le premier assureur national",
    "Leader incontesté depuis 10 ans",
    "Leader français du conseil",
  ])("« %s » est un classement", (texte) => {
    expect(classementDans(texte)).toBeDefined();
    expect(codes(specDe(texte))).toContain("CLASSEMENT");
  });
  it.each(["Un premier devis", "Une première étape", "Le ton reste le même", "Leaders, voici la méthode", "Premier pas en France pour votre site", "Le premier salon du métier"])("« %s » passe", (texte) => {
    expect(classementDans(texte)).toBeUndefined();
    expect(codes(specDe(texte))).toEqual([]);
  });
});

describe("porte : « ton » nom commun n'est pas un tutoiement (tour 2)", () => {
  it.each(["Ton variable", "Ton constant", "Le ton reste le même", "Ton sur ton"])("« %s » passe", (titre) => {
    expect(codes(specDe(titre))).toEqual([]);
  });
  it.each(["Ton équipe", "Ton devis", "Voici ton devis", "Prépare ton équipe"])("« %s » reste bloqué", (titre) => {
    expect(codes(specDe(titre))).toEqual(["TUTOIEMENT"]);
  });
  it("une même phrase n'est pas répétée dans la liste des contrôles", () => {
    const phrases = controlerCarrousel(specDe("Ton équipe"), ctx).rapport.controles.map((c) => c.phrase);
    expect(new Set(phrases).size).toBe(phrases.length);
  });
});
