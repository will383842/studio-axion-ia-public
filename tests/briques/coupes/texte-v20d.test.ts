import { describe, expect, it } from "vitest";
import type { MotHorodate } from "@/domaine/types";
import { estHesitation, estMotInacheve, finitPhrase, jetonsDits, memeMot } from "@/briques/coupes/texte";

function mot(m: string, i: number): MotHorodate {
  return { mot: m, debutSec: i, finSec: i + 0.5 };
}

describe("estHesitation", () => {
  it("reconnaît euh, hum, bah", () => {
    expect(estHesitation("euh")).toBe(true);
    expect(estHesitation("hum")).toBe(true);
    expect(estHesitation("bah")).toBe(true);
  });
  it("ignore la casse, la ponctuation et les espaces autour", () => {
    expect(estHesitation("Euh,")).toBe(true);
    expect(estHesitation("HEU…")).toBe(true);
  });
  it("refuse un vrai mot", () => {
    expect(estHesitation("bonjour")).toBe(false);
    expect(estHesitation("")).toBe(false);
  });
});

describe("estMotInacheve", () => {
  it("un mot terminé par un tiret ou des points de suspension est inachevé", () => {
    expect(estMotInacheve("pro-")).toBe(true);
    expect(estMotInacheve("impor–")).toBe(true);
    expect(estMotInacheve("pro…")).toBe(true);
    expect(estMotInacheve("pro...")).toBe(true);
    expect(estMotInacheve("  pro-  ")).toBe(true);
  });
  it("un mot entier ne l'est pas", () => {
    expect(estMotInacheve("projet")).toBe(false);
    expect(estMotInacheve("porte-monnaie")).toBe(false);
  });
});

describe("finitPhrase", () => {
  it("point, point d'interrogation, d'exclamation et suspension finissent la phrase", () => {
    expect(finitPhrase("fin.")).toBe(true);
    expect(finitPhrase("fin ?")).toBe(true);
    expect(finitPhrase("fin!")).toBe(true);
    expect(finitPhrase("fin…")).toBe(true);
  });
  it("accepte un guillemet fermant après le signe", () => {
    expect(finitPhrase("fin.»")).toBe(true);
  });
  it("un mot sans signe final ne finit pas la phrase", () => {
    expect(finitPhrase("fin")).toBe(false);
    expect(finitPhrase("fin,")).toBe(false);
  });
});

describe("memeMot", () => {
  it("formes identiques", () => {
    expect(memeMot("devis", "devis")).toBe(true);
  });
  it("accord entendu ou non (3 lettres et plus)", () => {
    expect(memeMot("quel", "quelle")).toBe(true);
    expect(memeMot("leur", "leurs")).toBe(true);
  });
  it("que et quel restent différents", () => {
    expect(memeMot("que", "quel")).toBe(false);
  });
  it("mots courts différents : faux", () => {
    expect(memeMot("pas", "bas")).toBe(false);
  });
  it("proximité tolérée à partir de 5 lettres (1 faute sur 10)", () => {
    expect(memeMot("calliopee", "calliopes")).toBe(true);
    expect(memeMot("entreprise", "entreprisse")).toBe(true);
  });
  it("mots longs très différents : faux", () => {
    expect(memeMot("entreprise", "formation")).toBe(false);
  });
});

describe("jetonsDits", () => {
  it("découpe l'apostrophe, ramène les nombres en lettres et retire la ponctuation", () => {
    const mots = ["L'équipe", "a", "45", "ans."].map(mot);
    const j = jetonsDits(mots, () => true);
    expect(j.map((x) => x.forme)).toEqual(["l", "equipe", "a", "quarante", "cinq", "ans"]);
    expect(j.map((x) => x.mot)).toEqual([0, 0, 1, 2, 2, 3]);
  });
  it("ne garde que les mots retenus, avec leur index d'origine", () => {
    const mots = ["euh", "bonjour", "hum", "tout", "le", "monde"].map(mot);
    const j = jetonsDits(mots, (i) => !estHesitation(mots[i].mot));
    expect(j).toEqual([
      { forme: "bonjour", mot: 1 },
      { forme: "tout", mot: 3 },
      { forme: "le", mot: 4 },
      { forme: "monde", mot: 5 },
    ]);
  });
  it("liste vide ou rien retenu : tableau vide", () => {
    expect(jetonsDits([], () => true)).toEqual([]);
    expect(jetonsDits([mot("bonjour", 0)], () => false)).toEqual([]);
  });
  it("un mot fait seulement de ponctuation ne donne aucun jeton", () => {
    expect(jetonsDits([mot("—", 0), mot("oui", 1)], () => true)).toEqual([{ forme: "oui", mot: 1 }]);
  });
});
