import { describe, expect, it } from "vitest";
import { controlerCarrousel } from "../../src/domaine/controles-visuel/porte.js";
import { premierChiffre, tutoiementDans } from "../../src/domaine/controles-visuel/texte.js";
import type { ContextePorte } from "../../src/domaine/visuels/contrats.js";
import { FIXTURES } from "../../src/visuels/texte/fixtures.js";

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
const reference = (message = "Le calme se prépare") => ({ version: "carrousel/1", alt: "Carrousel d’exemple sur l’organisation", pages: [couverture, dense, liste, avantApres, etapes, citation(message), fin] });
const codes = (spec: unknown) => [...new Set(controlerCarrousel(spec, ctx).rapport.controles.map((x) => x.code))].sort();

describe("tour 2 : TUTOIEMENT, bornes de mot", () => {
  it("« ton » possessif précédé d'un verbe ou d'une préposition", () => {
    for (const s of ["Lance ton projet", "Aide ton équipe", "Garde ton cap", "Demande ton devis", "Contrôle ton budget", "Parle de ton projet", "Clique sur ton profil"]) expect(codes(reference(s)), s).toEqual(["TUTOIEMENT"]);
  });
  it("« ton » tonalité reste verte", () => {
    for (const s of ["Le bon ton", "Ton sur ton", "Changez de ton", "Le ton juste", "Baisser de ton"]) expect(codes(reference(s)), s).toEqual([]);
  });
  it("« tiens » et « tienne » verbes ne sont pas des possessifs", () => {
    for (const s of ["Je tiens à préciser", "Que l'équipe tienne le rythme"]) expect(codes(reference(s)), s).toEqual([]);
    for (const s of ["Tiens, regardez", "Le tien", "Les tiennes"]) expect(codes(reference(s)), s).toEqual(["TUTOIEMENT"]);
  });
});

describe("tour 2 : SORTANT en pleine chasse", () => {
  it("numéro et e-mail en caractères pleine chasse", () => {
    expect(codes(reference("Appelez ０６ １２ ３４ ５６ ７８"))).toContain("SORTANT");
    expect(codes(reference("nom＠exemple.fr"))).toContain("SORTANT");
  });
});

describe("tour 2 : chiffres romains", () => {
  it("mots courants en majuscules : verts", () => {
    for (const s of ["Envoyez votre CV", "IL FAUT AGIR", "Notre CLIC", "Taille XXL"]) expect(codes(reference(s)), s).toEqual([]);
  });
  it("vrais romains : rouges", () => {
    for (const s of ["Au XXIe siècle", "François Ier", "Louis XIV", "Le chapitre IV"]) expect(codes(reference(s)), s).toEqual(["CHIFFRE"]);
  });
});

describe("tour 2 : ordinaux et « neuf »", () => {
  it("ordinaux en -ante et grands nombres", () => {
    for (const s of ["Le quarantieme anniversaire", "Le cinquantieme client", "Le millionieme visiteur"]) expect(codes(reference(s)), s).toEqual(["CHIFFRE"]);
  });
  it("« neuf » adjectif ou nombre", () => {
    for (const s of ["Un regard neuf sur vos dossiers", "Quoi de neuf", "Un outil neuf", "Un outil flambant neuf"]) expect(codes(reference(s)), s).toEqual([]);
    for (const s of ["Il en reste neuf.", "Neuf clients", "Neuf cents clients"]) expect(codes(reference(s)), s).toEqual(["CHIFFRE"]);
  });
  it("décision prudente : tiers, zéro, quart restent rouges", () => {
    for (const s of ["Un tiers du temps", "Zéro stress", "Un quart d'heure"]) expect(codes(reference(s)), s).toEqual(["CHIFFRE"]);
  });
});

describe("tour 2 : SCHEMA en français", () => {
  const phrases = (spec: unknown) => controlerCarrousel(spec, ctx).rapport.controles.filter((c) => c.code === "SCHEMA").map((c) => c.phrase).join(" ");
  it("valeur non reconnue hors du champ type", () => {
    const p = phrases({ ...reference(), version: "carrousel/2" });
    expect(p).toContain("valeur non reconnue");
    expect(p).not.toContain("type de page inconnu");
  });
  it("type de page inconnu", () => expect(phrases({ ...reference(), pages: [couverture, { type: "T99", titre: "x" }] })).toContain("type de page inconnu"));
  it("le message français d'une règle de format est conservé", () => {
    const spec = { ...reference(), pages: [{ ...couverture, titre: "Voir https://exemple.fr" }, ...reference().pages.slice(1)] };
    const p = phrases(spec);
    expect(p).toContain("Aucun lien");
    expect(p).not.toMatch(/Invalid/);
  });
});

describe("tour 2 : performance du filet de chiffres", () => {
  it("premierChiffre sur 100 000 « a » en moins de 50 ms", () => {
    const d = performance.now();
    expect(premierChiffre("a".repeat(100_000))).toBeUndefined();
    expect(performance.now() - d).toBeLessThan(50);
  });
  it("le filet rend un extrait borné", () => {
    expect(premierChiffre("zz A4 zz")).toBe("A4");
    expect(premierChiffre("a".repeat(500) + "1")!.length).toBeLessThanOrEqual(41);
  });
});

describe("fixtures du fournisseur de simulation", () => {
  it("passent la porte sans aucun rouge", () => {
    for (const f of FIXTURES) {
      const rouges = controlerCarrousel(f.spec, ctx).rapport.controles.filter((c) => c.niveau === "rouge");
      expect(rouges.map((c) => c.phrase), f.id).toEqual([]);
    }
  });
});

describe("finitions V3-G : tutoiement et lenteur", () => {
  it.each(["Adaptez votre ton", "Votre ton de voix", "Notre ton", "Son ton", "Leur ton", "Mon ton", "Quel ton adopter", "Quelle ton"])("« %s » n'est pas un tutoiement", (t) => {
    expect(tutoiementDans(t)).toBeUndefined();
  });
  it.each(["Parle de ton projet", "Clique sur ton profil", "Tiens bon"])("« %s » reste un tutoiement", (t) => {
    expect(tutoiementDans(t)).toBeDefined();
  });
  it.each(["J'y tiens", "J’en tiens compte", "J‘y tiens", "Jʼy tiens", "Jʼen tiens compte", "Nous tiens", "Je tiens à vous"])("« %s » n'est pas un tutoiement", (t) => {
    expect(tutoiementDans(t)).toBeUndefined();
  });
  it("premierChiffre sur « I I I … » : résultat exact et borne large", () => {
    const piege = "I ".repeat(1000);
    expect(premierChiffre(piege)).toBeUndefined();
    expect(premierChiffre(`${piege}Louis XIV`)).toBeUndefined(); // au-delà du plafond de 200 essais (limite documentée)
    expect(premierChiffre("Louis XIV")).toBe("XIV");
    const chaines = Array.from({ length: 300 }, () => piege);
    const d = performance.now();
    for (const c of chaines) premierChiffre(c);
    expect(performance.now() - d).toBeLessThan(1500);
  });
});
