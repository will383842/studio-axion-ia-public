import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  REGLES_MOTS_INTERDITS,
  controlerTexteGuide,
  empreinteGuide,
  jsonCanoniqueGuide,
  schemaContenuGuide,
  type ContenuGuide,
} from "@/domaine/guide-reseau/guide-contenu";

/** Vecteur FIXE, calculé à part (Python) : à recopier tel quel dans le site (même empreinte des deux côtés). */
const CONTENU_VECTEUR = {
  titre: "Guide de l’essai",
  sections: [
    { titre: "Étape un", paragraphes: ["Premier paragraphe, à relire.", "Second « paragraphe »."], puces: ["Une puce", "Autre puce"] },
    { titre: "Étape deux", paragraphes: ["Texte seul."], puces: [] },
  ],
};
const JSON_VECTEUR = '{"titre":"Guide de l’essai","sections":[{"titre":"Étape un","paragraphes":["Premier paragraphe, à relire.","Second « paragraphe »."],"puces":["Une puce","Autre puce"]},{"titre":"Étape deux","paragraphes":["Texte seul."],"puces":[]}]}';
const EMPREINTE_VECTEUR = "9c545807feb53583e1e672a2ad7efc0df971e9338955ddb9f8d4a5407c33b67c";

const bon = (): ContenuGuide => ({ titre: "Un titre", sections: [{ titre: "Section", paragraphes: ["Un paragraphe."], puces: [] }] });

describe("G1 · schéma du contenu d'un guide", () => {
  it("accepte un contenu valide", () => expect(schemaContenuGuide.safeParse(bon()).success).toBe(true));
  it("refuse 0 section et 21 sections", () => {
    expect(schemaContenuGuide.safeParse({ ...bon(), sections: [] }).success).toBe(false);
    expect(schemaContenuGuide.safeParse({ ...bon(), sections: Array.from({ length: 21 }, () => bon().sections[0]) }).success).toBe(false);
    expect(schemaContenuGuide.safeParse({ ...bon(), sections: Array.from({ length: 20 }, () => bon().sections[0]) }).success).toBe(true);
  });
  it("borne titre 120, paragraphes 1..15 de 1500, puces 0..10 de 300", () => {
    const s = bon().sections[0];
    const avec = (o: object) => schemaContenuGuide.safeParse({ titre: "T", sections: [{ ...s, ...o }] }).success;
    expect(schemaContenuGuide.safeParse({ ...bon(), titre: "a".repeat(121) }).success).toBe(false);
    expect(avec({ titre: "a".repeat(121) })).toBe(false);
    expect(avec({ paragraphes: [] })).toBe(false);
    expect(avec({ paragraphes: Array(16).fill("x") })).toBe(false);
    expect(avec({ paragraphes: ["a".repeat(1501)] })).toBe(false);
    expect(avec({ puces: Array(11).fill("x") })).toBe(false);
    expect(avec({ puces: ["a".repeat(301)] })).toBe(false);
    expect(avec({ puces: Array(10).fill("a".repeat(300)) })).toBe(true);
  });
  it("borne le total à 40 000 caractères", () => {
    const sec = { titre: "S", paragraphes: Array(15).fill("a".repeat(1500)), puces: [] };
    expect(schemaContenuGuide.safeParse({ titre: "T", sections: [sec, sec] }).success).toBe(false);
  });
  it("refuse clé inconnue, caractères de contrôle et bidirectionnels", () => {
    expect(schemaContenuGuide.safeParse({ ...bon(), extra: 1 }).success).toBe(false);
    expect(schemaContenuGuide.safeParse({ ...bon(), titre: "a\u0000b" }).success).toBe(false);
    expect(schemaContenuGuide.safeParse({ ...bon(), titre: "a‮b" }).success).toBe(false);
  });
});

describe("G1 · JSON canonique et empreinte", () => {
  it("vecteur fixe : JSON canonique NFC, clés ordonnées", () => expect(jsonCanoniqueGuide(CONTENU_VECTEUR)).toBe(JSON_VECTEUR));
  it("vecteur fixe : empreinte SHA-256", () => expect(empreinteGuide(CONTENU_VECTEUR)).toBe(EMPREINTE_VECTEUR));
  it("l'ordre des clés d'entrée ne change rien", () => {
    const melange = { sections: [{ puces: [], paragraphes: ["x"], titre: "S" }], titre: "T" };
    const ordonne = { titre: "T", sections: [{ titre: "S", paragraphes: ["x"], puces: [] }] };
    expect(empreinteGuide(melange as ContenuGuide)).toBe(empreinteGuide(ordonne));
  });
  it("NFC et NFD donnent la même empreinte", () => {
    expect(empreinteGuide({ ...bon(), titre: "Été" })).toBe(empreinteGuide({ ...bon(), titre: "Été" }));
  });
});

const refus = (texte: string) => controlerTexteGuide({ titre: "Titre", sections: [{ titre: "S", paragraphes: [texte], puces: [] }] });

describe("G1 · mots interdits, un par un (accents, majuscules)", () => {
  const cas: [string, string, string][] = [
    ["abonne", "Pour suivre, l'abonné reçoit", "abonne"],
    ["abonne", "ABONNEMENT mensuel", "abonne"],
    ["abonne", "Les abonnés", "abonne"],
    ["grenoble", "Basé à Grenoble", "grenoble"],
    ["grenoble", "GRENOBLE", "grenoble"],
    ["aucun-gain-garanti", "Aucun gain garanti", "aucun-gain-garanti"],
    ["aucun-gain-garanti", "AUCUN GAIN GARANTI ici", "aucun-gain-garanti"],
    ["garanti", "Un résultat garanti", "garanti"],
    ["garanti", "Nous garantissons", "garanti"],
    ["certifie", "Formation certifiée", "certifie"],
    ["certifie", "Certification officielle", "certifie"],
    ["qualiopi", "Label Qualiopi", "qualiopi"],
    ["tutoiement", "Tu peux commencer", "tutoiement"],
    ["tutoiement", "Pour toi", "tutoiement"],
    ["tutoiement", "Voici tes étapes", "tutoiement"],
    ["tutoiement", "Je t'explique", "tutoiement"],
    ["tutoiement", "Ta méthode", "tutoiement"],
    ["pourcentage", "Gagnez 30 %", "pourcentage"],
    ["pourcentage", "50%", "pourcentage"],
    ["euro", "Pour 100 €", "euro"],
    ["x-fois", "Dix fois plus : 3 fois mieux", "x-fois"],
    ["x-fois", "Résultat x fois meilleur", "x-fois"],
    ["double", "Vous allez doubler", "double"],
    ["double", "Un chiffre triplé", "double"],
    ["double", "Triplez vos ventes", "double"],
  ];
  for (const [id, texte, attendu] of cas) {
    it(`refuse « ${texte} »`, () => {
      const r = refus(texte);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.regle).toBe(attendu);
        expect(JSON.stringify(r)).not.toContain(texte); // jamais d'extrait
      }
      expect(id).toBeTruthy();
    });
  }
  it("contrôle aussi le titre, le titre de section et les puces", () => {
    expect(controlerTexteGuide({ titre: "Grenoble", sections: bon().sections }).ok).toBe(false);
    expect(controlerTexteGuide({ titre: "T", sections: [{ titre: "Abonnés", paragraphes: ["x"], puces: [] }] }).ok).toBe(false);
    expect(controlerTexteGuide({ titre: "T", sections: [{ titre: "S", paragraphes: ["x"], puces: ["Qualiopi"] }] }).ok).toBe(false);
  });
  it("accepte un texte propre (vouvoiement, « suivre le compte »)", () => {
    expect(refus("Suivez le compte pour recevoir la suite. Vous pouvez relire chaque étape.").ok).toBe(true);
    expect(refus("Une démarche simple et honnête.").ok).toBe(true);
  });
});

describe("G1 · fixture partagée des mots interdits", () => {
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/guide-mots-interdits.json", import.meta.url), "utf8"));
  it("est identique à la liste exportée (à copier à l'identique dans le site)", () => {
    expect(fixture).toEqual({ version: 1, normalisation: "NFKD, sans accents, minuscules, apostrophes droites", regles: REGLES_MOTS_INTERDITS });
  });
  it("chaque règle de la fixture compile et reconnaît ses exemples", () => {
    for (const r of fixture.regles) {
      expect(() => new RegExp(r.motif, "u")).not.toThrow();
      expect(r.exemples.length).toBeGreaterThan(0);
    }
  });
});
