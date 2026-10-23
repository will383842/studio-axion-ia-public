/**
 * L1 · `chiffresDe` (I1) : brut, valeur et unité justes sur toutes les chaînes des 6 images d'essai.
 */
import { describe, expect, it } from "vitest";
import { chiffresDe, cleChiffre } from "@/domaine/image-video/chiffres";
import { lectureChiffres } from "@/moteurs/montage-image-video/regles";

describe("chiffresDe — chaînes des 6 images", () => {
  const cas: [string, { brut: string; valeur: number | null; unite: string }[]][] = [
    ["Message client entrant — 23h14", [{ brut: "23h14", valeur: 23 * 60 + 14, unite: "heure" }]],
    ["24h/24", [{ brut: "24h/24", valeur: null, unite: "autre" }]],
    ["Envoyée en 4 sec", [{ brut: "4 sec", valeur: 4, unite: "sec" }]],
    ["80 % — Réponse connue", [{ brut: "80 %", valeur: 80, unite: "%" }]],
    ["19 min/commande", [{ brut: "19 min/commande", valeur: 19, unite: "min" }]],
    ["Sur 20 cmd/jour = 6h récupérées", [{ brut: "20 cmd/jour", valeur: 20, unite: "nombre" }, { brut: "6h", valeur: 6, unite: "h" }]],
    ["45 sec · risque erreur : zéro", [{ brut: "45 sec", valeur: 45, unite: "sec" }]],
    ["2h récupérées/jour", [{ brut: "2h", valeur: 2, unite: "h" }]],
    ["Réponse sous 2h", [{ brut: "2h", valeur: 2, unite: "h" }]],
    ["Vous cherchez. Vous trouvez. En 3 secondes.", [{ brut: "3 secondes", valeur: 3, unite: "sec" }]],
    ["Recherche : 23 min", [{ brut: "23 min", valeur: 23, unite: "min" }]],
    ["impact mesurable dès le 1er jour", [{ brut: "1er jour", valeur: 1, unite: "jour" }]],
    ["0 demande perdue", [{ brut: "0 demande", valeur: 0, unite: "nombre" }]],
    ["0 question sans réponse", [{ brut: "0 question", valeur: 0, unite: "nombre" }]],
    ["Même à 3h du matin.", [{ brut: "3h", valeur: 180, unite: "heure" }]],
    ["Réponse en 2 minutes", [{ brut: "2 minutes", valeur: 2, unite: "min" }]],
    ["20 e-mails entrants", [{ brut: "20 e-mails", valeur: 20, unite: "nombre" }]],
    ["Saisie CRM 8 min", [{ brut: "8 min", valeur: 8, unite: "min" }]],
    ["Résolu sans intervention humaine", []],
  ];
  for (const [texte, attendu] of cas) {
    it(`« ${texte} »`, () => {
      expect(chiffresDe(texte)).toEqual(attendu);
    });
  }
});

describe("chiffresDe — cas limites", () => {
  it("sommes et totaux : chaque nombre à part, dans l'ordre", () => {
    expect(chiffresDe("8 + 6 + 5 = 19").map((c) => c.valeur)).toEqual([8, 6, 5, 19]);
  });
  it("virgule décimale, euros, secondes abrégées « s »", () => {
    expect(chiffresDe("1,5 s pour 12 €")).toEqual([
      { brut: "1,5 s", valeur: 1.5, unite: "sec" },
      { brut: "12 €", valeur: 12, unite: "€" },
    ]);
  });
  it("« 5 sources » n'est pas lu comme des secondes", () => {
    expect(chiffresDe("5 sources")).toEqual([{ brut: "5 sources", valeur: 5, unite: "nombre" }]);
  });
  it("« 6 h 20 » écrit avec espaces : une seule heure, comme le script la lit (PR #252) ; « 6 h 20 min » reste deux durées", () => {
    expect(chiffresDe("6 h 20")).toEqual([{ brut: "6 h 20", valeur: 380, unite: "heure" }]);
    expect(chiffresDe("6 h 20 min").map((c) => c.unite)).toEqual(["h", "min"]);
  });
  it("heure espacée suivie d'un montant en milliers : la minute n'avale pas le premier chiffre (relecture de #252)", () => {
    const v = (t: string) => chiffresDe(t).map((c) => `${c.valeur}|${c.unite}`);
    expect(v("Gagnez 2 h 5 000 € par mois")).toEqual(["2|h", "5000|€"]);
    expect(v("En 1 h 2 500 e-mails triés")).toEqual(["1|h", "2500|nombre"]);
    expect(v("3 h 2 000 €")).toEqual(["3|h", "2000|€"]);
    expect(v("2 h 50 000 €")).toEqual(["2|h", "50000|€"]);
    expect(v("Gagnez 2 h\n5 000 € économisés")).toEqual(["2|h", "5000|€"]);
    expect(v("6 h 05")).toEqual(["365|heure"]);
  });
  it("« 6 h 20 » durée (bandeau « = 6 h 20 récupérées ») : même lecture côté image et côté script, écrit ou dit", () => {
    const image = (t: string) => chiffresDe(t).map((c) => `${c.valeur}|${c.unite}`);
    const script = (t: string) => lectureChiffres(t).chiffres.map((c) => `${c.valeur}|${c.unite}`);
    for (const [ecrit, dits] of [
      ["6 h 20", ["6 h 20", "6h20", "six heures vingt"]],
      ["6 h 20 récupérées", ["6 h 20 récupérées", "6h20 récupérées", "six heures vingt récupérées"]],
      ["Sur 20 cmd/jour = 6 h 20 récupérées", ["Sur 20 cmd/jour = 6 h 20 récupérées"]],
      ["6 h 20 de gagnées", ["six heures vingt de gagnées"]],
      ["2 h 15 par jour", ["deux heures quinze par jour", "2h15 par jour"]],
      ["6 h 20 min", ["six heures vingt minutes", "6h 20 min"]],
    ] as const) {
      const attendu = image(ecrit);
      expect(attendu.length, ecrit).toBeGreaterThan(0);
      expect(script(ecrit), ecrit).toEqual(attendu);
      for (const d of dits) expect(script(d), `${ecrit} ← ${d}`).toEqual(attendu);
    }
    expect(image("6 h 20 récupérées")).not.toEqual(image("6 h 10 récupérées"));
    expect(script("sept heures vingt récupérées")).not.toEqual(image("6 h 20 récupérées"));
  });
  it("une heure impossible (« 25h70 ») n'est pas une heure d'horloge", () => {
    expect(chiffresDe("25h70").some((c) => c.unite === "heure")).toBe(false);
  });
  it("aucun chiffre écrit en lettres n'est inventé", () => {
    expect(chiffresDe("Une saisie. Trois outils. Zéro erreur.")).toEqual([]);
  });
  it("même résultat à chaque appel (aucun état gardé entre deux appels)", () => {
    const a = chiffresDe("23h14 puis 4 sec puis 80 %");
    for (let i = 0; i < 20; i++) expect(chiffresDe("23h14 puis 4 sec puis 80 %")).toEqual(a);
  });
  it("clé de comparaison : « 80% » = « 80 % »", () => {
    expect(cleChiffre("80%")).toBe(cleChiffre("80 %"));
  });
});

describe("chiffresDe — séparateur de milliers (relecture de L1)", () => {
  it("« 1 900 € » (espace normale) est UN chiffre : 1900 €", () => {
    expect(chiffresDe("1 900 €")).toEqual([{ brut: "1 900 €", valeur: 1900, unite: "€" }]);
  });
  it("« 1 900 € » avec une espace fine insécable (U+202F) ou insécable (U+00A0) : 1900 €", () => {
    expect(chiffresDe("1 900 €").map((c) => [c.valeur, c.unite])).toEqual([[1900, "€"]]);
    expect(chiffresDe("1 900 €").map((c) => [c.valeur, c.unite])).toEqual([[1900, "€"]]);
  });
  it("plusieurs groupes et décimale : « 12 500 000,5 € »", () => {
    expect(chiffresDe("12 500 000,5 €").map((c) => c.valeur)).toEqual([12500000.5]);
  });
  it("un groupe qui n'a pas 3 chiffres reste deux nombres (« 8 + 6 », « 1 90 », « 1 9000 »)", () => {
    expect(chiffresDe("1 90").map((c) => c.valeur)).toEqual([1, 90]);
    expect(chiffresDe("1 9000").map((c) => c.valeur)).toEqual([1, 9000]);
  });
});
