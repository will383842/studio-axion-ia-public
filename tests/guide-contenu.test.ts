import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  REGLES_MOTS_INTERDITS,
  controlerTexteGuide,
  empreinteGuide,
  contientCaractereInterdit,
  jsonCanoniqueGuide,
  schemaContenuGuide,
  type ContenuGuide,
} from "@/domaine/guides-pdf/guide-contenu";

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
    expect(schemaContenuGuide.safeParse({ ...bon(), titre: "a\u202Eb" }).success).toBe(false);
  });
  it("refuse les caractères invisibles et bidirectionnels, dans tous les champs", () => {
    const invisibles = ["\u00AD", "\u061C", "\u180E", "\u200B", "\u200C", "\u200D", "\u200E", "\u200F", "\u2028", "\u2029", "\u202A", "\u202E", "\u2060", "\u2066", "\u2069", "\u206F", "\uFEFF"];
    for (const c of invisibles) {
      expect(schemaContenuGuide.safeParse({ ...bon(), titre: `a${c}b` }).success).toBe(false);
      expect(schemaContenuGuide.safeParse({ titre: "T", sections: [{ titre: "S", paragraphes: [`a${c}b`], puces: [] }] }).success).toBe(false);
      expect(schemaContenuGuide.safeParse({ titre: "T", sections: [{ titre: "S", paragraphes: ["x"], puces: [`a${c}b`] }] }).success).toBe(false);
    }
  });
  it("refuse abo\u200Bnné, abon\u00ADné, Gre\u200Dnoble (contournement des mots interdits)", () => {
    for (const mot of ["abo\u200Bnné", "abon\u00ADné", "Gre\u200Dnoble"]) {
      expect(schemaContenuGuide.safeParse({ ...bon(), titre: mot }).success).toBe(false);
    }
  });
  it("refuse les sélecteurs de variation, fillers hangul et étiquettes Unicode (abo\\uFE00nné…)", () => {
    for (const c of ["\uFE00", "\uFE0F", "\u115F", "\u1160", "\u3164", "\uFFA0", "\u{E0001}", "\u{E0041}", "\u{E007F}"]) {
      expect(contientCaractereInterdit(`a${c}b`)).toBe(true);
      expect(schemaContenuGuide.safeParse({ ...bon(), titre: `abo${c}nné` }).success).toBe(false);
      expect(schemaContenuGuide.safeParse({ titre: "T", sections: [{ titre: "S", paragraphes: [`a${c}b`], puces: [] }] }).success).toBe(false);
    }
  });
  it("refuse les demi-caractères Unicode isolés, accepte les paires valides", () => {
    expect(schemaContenuGuide.safeParse({ ...bon(), titre: "a\uD800b" }).success).toBe(false);
    expect(schemaContenuGuide.safeParse({ ...bon(), titre: "a\uDC00" }).success).toBe(false);
    expect(schemaContenuGuide.safeParse({ titre: "T", sections: [{ titre: "S", paragraphes: ["x\uD83D"], puces: [] }] }).success).toBe(false);
    expect(schemaContenuGuide.safeParse({ ...bon(), titre: "Un \u{1F600} valide" }).success).toBe(true);
  });
  it("accepte les espaces insécables et les caractères accentués usuels", () => {
    expect(schemaContenuGuide.safeParse({ ...bon(), titre: "Étape\u00A0un\u202Fici « à voir »" }).success).toBe(true);
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

const texteGuide = (texte: string): ContenuGuide => ({ titre: "Titre", sections: [{ titre: "S", paragraphes: [texte], puces: [] }] });
const refus = (texte: string) => controlerTexteGuide({ titre: "Titre", sections: [{ titre: "S", paragraphes: [texte], puces: [] }] });

describe("G1 · mots interdits, un par un (accents, majuscules)", () => {
  const cas: [string, string, string][] = [
    ["abonne", "Pour suivre, l'abonné reçoit", "abonne"],
    ["abonne", "ABONNEMENT mensuel", "abonne"],
    ["abonne", "Les abonnés", "abonne"],
    ["abonne", "Pour se désabonner", "abonne"],
    ["abonne", "Le réabonnement", "abonne"],
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
    ["euros-mot", "Cela coûte 100 euros", "euros-mot"],
    ["euros-mot", "Un euro", "euros-mot"],
    ["euros-mot", "50 EUR", "euros-mot"],
    ["pour-cent", "Trente pour cent de mieux", "pour-cent"],
    ["pour-cent", "Dix pourcent", "pour-cent"],
    ["n-fois-plus", "Deux fois plus vite", "n-fois-plus"],
    ["n-fois-plus", "Dix fois mieux", "n-fois-plus"],
    ["n-fois-plus", "Cent fois moins cher", "n-fois-plus"],
    ["multiplicateur", "Résultat x2", "multiplicateur"],
    ["multiplicateur", "Un gain de 3x", "multiplicateur"],
    ["multiplicateur", "Un gain \u00D75", "multiplicateur"],
    ["tutoiement", "Présente ton entreprise", "tutoiement"],
    ["tutoiement", "Ton activité grandit", "tutoiement"],
    ["tutoiement", "Sur ton site", "tutoiement"],
    ["n-fois-plus", "Dix fois plus : 3 fois mieux", "n-fois-plus"],
    ["n-fois-plus", "Résultat 3 fois plus rapide", "n-fois-plus"],
    ["multiplicateur", "Un résultat x3", "multiplicateur"],
    ["multiplicateur", "Un gain de x10", "multiplicateur"],
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
      expect(controlerTexteGuide(texteGuide(texte))).toEqual({ ok: false, regle: id });
    });
  }
  it("contrôle aussi le titre, le titre de section et les puces", () => {
    expect(controlerTexteGuide({ titre: "Grenoble", sections: bon().sections }).ok).toBe(false);
    expect(controlerTexteGuide({ titre: "T", sections: [{ titre: "Abonnés", paragraphes: ["x"], puces: [] }] }).ok).toBe(false);
    expect(controlerTexteGuide({ titre: "T", sections: [{ titre: "S", paragraphes: ["x"], puces: ["Qualiopi"] }] }).ok).toBe(false);
  });
  it("accepte les textes propres qui ressemblaient à des promesses (pour centraliser, 3 fois par semaine, formats)", () => {
    for (const t of ["Pour centraliser vos idées", "Publiez 3 fois par semaine", "Format 1080 x 1920", "Format 1080x1920", "Max 3 hashtags", "Sur X 2 publications", "Windows 10 x64", "Une taille de 1080 \u00D7 1920"]) {
      expect(refus(t)).toEqual({ ok: true });
    }
    expect(refus("Trois fois par semaine suffit").ok).toBe(true);
  });
  it("refuse toujours les vraies promesses chiffrées (x3, 3 fois plus)", () => {
    for (const t of ["Résultat x3", "3 fois plus de vues", "10 fois mieux", "Gain x10"]) expect(refus(t).ok).toBe(false);
  });
  it("accepte un texte propre (vouvoiement, « suivre le compte »)", () => {
    expect(refus("Suivez le compte pour recevoir la suite. Vous pouvez relire chaque étape.").ok).toBe(true);
    expect(refus("Une démarche simple et honnête.").ok).toBe(true);
    expect(refus("Le ton de la voix reste posé, sans promesse.").ok).toBe(true);
    expect(refus("Un ton chaleureux et clair.").ok).toBe(true);
  });
});

describe("G1 · fixture partagée des mots interdits", () => {
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/guide-mots-interdits.json", import.meta.url), "utf8"));
  it("est identique à la liste exportée (à copier à l'identique dans le site)", () => {
    expect(fixture).toEqual({ version: 3, normalisation: "NFKD, sans accents, minuscules, apostrophes droites", regles: REGLES_MOTS_INTERDITS });
  });
  it("chaque règle de la fixture compile et reconnaît ses exemples", () => {
    for (const r of fixture.regles) {
      expect(() => new RegExp(r.motif, "u")).not.toThrow();
      expect(r.exemples.length).toBeGreaterThan(0);
      for (const exemple of r.exemples) expect(controlerTexteGuide(texteGuide(exemple))).toEqual({ ok: false, regle: r.id });
    }
  });
});
