/** Script fourni : la lecture du texte (étiquettes, alias, accents, puces, règles de forme, bornes). Pur, aucun appel. */
import { describe, expect, it } from "vitest";
import { trouverCas } from "@/formats/cas-concret/catalogue";
import { lireTexteFourni } from "@/moteurs/montage-cas-concret/script-fourni";

const cas = trouverCas("transporteur-demandes-de-cotation")!;
const formes = (texte: string) => {
  const r = lireTexteFourni(texte, cas);
  if (!r.ok) throw new Error(r.refus.map((x) => x.message).join(" | "));
  return r.lignes.map((l) => l.forme);
};
const refus = (texte: unknown) => {
  const r = lireTexteFourni(texte, cas);
  return r.ok ? [] : r.refus.map((x) => x.message);
};

describe("étiquettes", () => {
  it("toutes les formes, avec leurs alias, sans tenir compte de la casse ni des accents", () => {
    const t = [
      "[ACCROCHE] a",
      "[Chiffre] b",
      "[avant] c",
      "[titre] d",
      "[Méthode] e",
      "[bascule] f",
      "[étape] g",
      "[ETAPE 3] h",
      "[etape2] i",
      "[détail] j",
      "[objet] k",
      "[humain] l",
      "[preuve] m",
      "[Résultat] n",
      "[question] o ?",
    ].join("\n");
    expect(formes(t)).toEqual(["accroche", "chiffre", "avant", "bascule", "bascule", "bascule", "etape", "etape", "etape", "detail", "detail", "humain", "preuve", "resultat", "question"]);
  });

  it("le rang d'étape donné par l'étiquette est gardé ; sinon l'étape suivante ; un détail s'attache à l'étape d'avant", () => {
    const r = lireTexteFourni(["[accroche] a", "[bascule] b", "[étape 3] c", "[détail] d", "[étape] e", "[question] f ?"].join("\n"), cas);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.lignes.map((l) => l.etapeCas ?? null)).toEqual([null, null, 3, 3, 4, null]);
  });

  it("une étiquette inconnue : le message dit les étiquettes possibles", () => {
    expect(refus("[xyz] Bonjour.")[0]).toBe("Ligne 1 : l'étiquette [xyz] est inconnue. Étiquettes possibles : [accroche] [chiffre] [avant] [bascule] [étape] [détail] [humain] [preuve] [résultat] [question].");
  });

  it("un détail sans étape avant lui est refusé", () => {
    expect(refus(["[accroche] a", "[détail] b", "[question] c ?"].join("\n"))[0]).toContain("Ligne 2 : un détail complète l'étape d'avant");
  });
});

describe("nettoyage", () => {
  it("CRLF, lignes vides, puces de tête (tiret, point, astérisque, « 1. », « 1) »), espaces : rien n'est réécrit d'autre", () => {
    const r = lireTexteFourni("- Un.\r\n\r\n• Deux.\n* Trois.\n1. Quatre.\n2) Cinq.\n   Six.   ", cas);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.lignes.map((l) => l.texte)).toEqual(["Un.", "Deux.", "Trois.", "Quatre.", "Cinq.", "Six."]);
  });

  it("les caractères de contrôle sont retirés (sauf le saut de ligne)", () => {
    const r = lireTexteFourni("Bon\u0000jour\u0007.\nDeux.\u001b", cas);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.lignes.map((l) => l.texte)).toEqual(["Bonjour.", "Deux."]);
  });
});

describe("bornes", () => {
  it("texte vide, pas un texte, plus de 4000 caractères, plus de 26 lignes, ligne de plus de 400 caractères", () => {
    expect(refus("  \n \n")[0]).toBe("Le script est vide : écrivez une ligne par écran.");
    expect(refus(12)[0]).toBe("Le script doit être un texte.");
    expect(refus("a".repeat(4001))[0]).toBe("Le script est trop long : 4000 caractères au plus (il en compte 4001).");
    expect(refus(Array.from({ length: 27 }, (_, i) => `Phrase ${i}.`).join("\n"))[0]).toBe("Le script compte 27 lignes ; 26 au plus (une ligne = un écran).");
    expect(refus(["Bien.", "b".repeat(401)].join("\n"))[0]).toBe("Ligne 2 : la ligne compte 401 caractères ; 400 au plus. Coupez-la en deux lignes.");
    expect(refus("[accroche]")[0]).toBe("Ligne 1 : la ligne est vide après son étiquette ; écrivez la phrase dite.");
  });
});

describe("formes devinées (règles a à f)", () => {
  it("(a) « Avant… » et « Résultat… » ; (b) première = accroche, dernière = question", () => {
    expect(formes(["Bonjour ici.", "Avant : x.", "Un texte.", "Résultat : y.", "Fin ?"].join("\n"))).toEqual(["accroche", "avant", "bascule", "resultat", "question"]);
  });
  it("(c) sans résultat : la ligne juste avant la question", () => {
    expect(formes(["a b.", "Avant : c.", "d e.", "f g.", "h ?"].join("\n"))).toEqual(["accroche", "avant", "bascule", "resultat", "question"]);
  });
  it("(d) sans bascule ni avant : la ligne 2 est l'avant, la suivante la bascule", () => {
    expect(formes(["a b.", "c d.", "e f.", "g h.", "i j.", "k ?"].join("\n")).slice(0, 3)).toEqual(["accroche", "avant", "bascule"]);
  });
  it("(e) la partie humaine dite mot pour mot entre la bascule et le résultat ; les autres lignes sont des étapes", () => {
    const f = formes(["a b.", "Avant : c.", "Voici la suite.", "Une étape.", cas.resteHumain, "Autre étape.", "Résultat : fin.", "Et vous ?"].join("\n"));
    expect(f).toEqual(["accroche", "avant", "bascule", "etape", "humain", "etape", "resultat", "question"]);
  });
});
