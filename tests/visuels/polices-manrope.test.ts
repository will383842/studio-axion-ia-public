import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CARACTERES, METRIQUES } from "../../src/briques/sous-titres/metriques";
import { GRAISSE_TITRE, LARGEUR_TEXTE, POLICE_CORPS, POLICE_MANUSCRITE, POLICE_TITRE } from "../../studio-rendu/compositions/visuels/commun/constantes";
import { corpsPourMots, largeurMot, MARGE_MESURE, motLePlusLarge } from "../../src/briques/visuels/largeur-mot";

const lire = (chemin: string) => readFileSync(chemin, "utf8");
const AUTRES_POLICES = /\bInter\b|Kalam|Bricolage|Instrument|Montserrat|Poppins|Archivo|JetBrains/;
/** Source sans les commentaires : seul le code compte. */
const code = (chemin: string) => lire(chemin).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\b(FAMILLE_INTER|FAMILLE_KALAM|chargerPoliceInter|chargerPoliceKalam|policeInterPrete|policeKalamPrete)\b/g, "");
// Les trois identifiants hérités ci-dessus restent exportés par `polices.ts` pour les gabarits : ce sont des noms, pas des polices.

const SOURCES = {
  constantes: "studio-rendu/compositions/visuels/commun/constantes.ts",
  polices: "studio-rendu/compositions/visuels/polices.ts",
  continu: "studio-rendu/compositions/visuels/continu/polices-continu.ts",
  primitives: "studio-rendu/compositions/visuels/continu/commun/Primitives.tsx",
  largeur: "src/briques/visuels/largeur-mot.ts",
} as const;

describe("L2-02 : une page ne contient que Manrope", () => {
  it("constantes : les trois piles de polices sont Manrope, la graisse des titres existe dans Manrope (≤ 800)", () => {
    for (const pile of [POLICE_TITRE, POLICE_CORPS, POLICE_MANUSCRITE]) {
      expect(pile).toContain("Manrope");
      expect(pile).not.toMatch(AUTRES_POLICES);
    }
    expect(GRAISSE_TITRE).toBeLessThanOrEqual(800);
    expect(GRAISSE_TITRE).toBeGreaterThanOrEqual(700);
  });

  it.each(["constantes", "polices", "continu", "primitives", "largeur"] as const)("%s : aucune autre police dans le code", (cle) => {
    expect(code(SOURCES[cle])).not.toMatch(AUTRES_POLICES);
  });

  it("polices.ts : charge Manrope en local, via police-manrope.ts, aucun fichier ni face de repli", () => {
    const src = code(SOURCES.polices);
    expect(src).toContain('from "./police-manrope"');
    expect(src).not.toMatch(/\.ttf|FontFace/);
    expect(src).not.toMatch(/unicodeRange/);
    for (const nom of ["chargerPoliceTitre", "chargerPoliceInter", "chargerPoliceKalam", "policeTitrePrete", "policeInterPrete", "policeKalamPrete"]) {
      expect(lire(SOURCES.polices)).toContain(nom);
    }
  });

  it("polices-continu.ts : Manrope seulement, aucun fichier Bricolage, Instrument ou Inter", () => {
    const src = code(SOURCES.continu);
    expect(src).toContain('from "../police-manrope"');
    expect(src).not.toMatch(/\.ttf|FontFace/);
  });

  it("Primitives.tsx : titres, texte et accent en Manrope, jamais d'italique (Manrope n'en a pas)", () => {
    const src = code(SOURCES.primitives);
    expect(src).toMatch(/POLICE_TITRE\s*=.*Manrope/);
    expect(src).toMatch(/POLICE_SERIF\s*=\s*POLICE_TITRE/);
    expect(src).toMatch(/POLICE_TEXTE\s*=\s*POLICE_TITRE/);
    expect(src).not.toMatch(/FAMILLE_(BRICOLAGE|INSTRUMENT)/);
    expect(src).not.toMatch(/fontStyle:\s*italique\s*\?\s*"italic"/);
  });

  it("aucun poids demandé au-delà de 800 dans les primitives", () => {
    for (const m of code(SOURCES.primitives).matchAll(/police\((\d{3})/g)) expect(Number(m[1])).toBeLessThanOrEqual(800);
  });
});

describe("L2-02 : mesures de chasse Manrope (largeur-mot)", () => {
  const police = METRIQUES["Manrope ExtraBold"];
  const chasse = (c: string) => police.largeurs[CARACTERES.indexOf(c)] / police.unitesParEm;

  it("la largeur d'un mot suit la chasse de Manrope ExtraBold (borne haute du texte), marge de sécurité comprise", () => {
    const mot = "Professionnalisation";
    const attendu = [...mot].reduce((s, c) => s + chasse(c), 0) * 40 * MARGE_MESURE;
    expect(largeurMot(mot, 40)).toBeCloseTo(attendu, 6);
  });

  it("la chasse n'est plus celle d'Inter : « m » et « i » diffèrent de la table Inter Bold", () => {
    expect(largeurMot("m", 1000)).toBeCloseTo(chasse("m") * 1000 * MARGE_MESURE, 6);
    expect(largeurMot("i", 1000)).toBeCloseTo(chasse("i") * 1000 * MARGE_MESURE, 6);
  });

  it("un signe absent de la table compte comme le plus large (choix prudent)", () => {
    const plusLarge = Math.max(...police.largeurs) / police.unitesParEm;
    expect(largeurMot("☃", 100)).toBeCloseTo(plusLarge * 100 * MARGE_MESURE, 6);
  });

  it("l'espace fine insécable et l'espace insécable prennent la chasse de l'espace", () => {
    expect(largeurMot(" ", 100)).toBeCloseTo(chasse(" ") * 100 * MARGE_MESURE, 6);
    expect(largeurMot(" ", 100)).toBeCloseTo(chasse(" ") * 100 * MARGE_MESURE, 6);
  });

  it("corpus de référence : à la largeur de page, chaque mot tient au corps retenu (aucun débordement)", () => {
    const corpus = ["PROFESSIONNALISATION", "Anticonstitutionnellement", "Responsabilité", "Accompagnement", "Réglementation", "Qualité : obligatoire"];
    for (const texte of corpus) {
      const corps = corpsPourMots([texte], LARGEUR_TEXTE, 112, 20);
      expect(motLePlusLarge(texte, corps).largeur, texte).toBeLessThanOrEqual(LARGEUR_TEXTE);
    }
    const corps = corpsPourMots(corpus, LARGEUR_TEXTE, 112, 20);
    for (const texte of corpus) expect(motLePlusLarge(texte, corps).largeur, texte).toBeLessThanOrEqual(LARGEUR_TEXTE);
  });
});
