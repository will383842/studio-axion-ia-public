/**
 * CALIBRAGE DES CONTRÔLES DE COMPRÉHENSION (lot F, 19/10/2026) : fige les chiffres de
 * `docs/ecriture/CALIBRAGE-COMPREHENSION-2026-10-19.md`. Aucun appel payant ; les contrôles sont EXÉCUTÉS sur les témoins du
 * dépôt et sur des contre-exemples écrits à la main (`calibrage-comprehension-mesure.ts`). Aucun niveau n'est changé ici :
 * alerte → bloquant est une décision de Will ; le document ne fait que recommander.
 */
import { describe, expect, it } from "vitest";
import { NIVEAUX } from "@/domaine/controles-script";
import { ruptureDite } from "@/donnees/generateur/recette-script";
import {
  CODES_TABLEAU,
  CODES_VERSION,
  CONTRE_EXEMPLES,
  CONTRE_EXEMPLES_TABLEAU,
  LIMITES_CONNUES,
  PRESQUE_BONS,
  TEMOINS_ANCIENS_TABLEAU,
  TEMOINS_CORPUS,
  TEMOINS_RECETTE,
  TEMOINS_SOCLE,
  TEMOINS_TABLEAU,
  codesTableau,
  defautsTableau,
  fauxNegatifsTableau,
  fauxNegatifsVersion,
  fauxPositifsTableau,
  fauxPositifsVersion,
  leves,
  levesBloquants,
  mesureRessemblance,
  mesureSocle,
  MIN_CONTRE_EXEMPLES,
  recommandation,
  tableauBloque,
  type CodeTableau,
  type CodeVersion,
} from "./calibrage-comprehension-mesure";

const TOUS_VERSION = [...TEMOINS_RECETTE, ...TEMOINS_SOCLE, ...TEMOINS_CORPUS];

describe("les témoins sont ceux du dépôt, en nombre connu", () => {
  it("6 conformes à la recette, 5 du socle et du tableau, 60 du corpus honnête", () => {
    expect(TEMOINS_RECETTE).toHaveLength(6);
    expect(TEMOINS_SOCLE).toHaveLength(5);
    expect(TEMOINS_CORPUS).toHaveLength(60);
    expect(TEMOINS_TABLEAU).toHaveLength(4);
  });
  it("niveaux actuels INCHANGÉS : C95 bloquant, C96 à C99 en alerte côté machine ; Will en information", () => {
    expect(NIVEAUX.C95.machine).toBe("bloquant");
    for (const c of ["C96", "C97", "C98", "C99"]) expect(NIVEAUX[c], c).toEqual({ machine: "alerte", will: "info" });
  });
});

describe("contrôles de version C95 à C99", () => {
  it("les témoins bons ne déclenchent AUCUN contrôle bloquant (C95) : 0 sur 71", () => {
    for (const t of TOUS_VERSION) expect(levesBloquants(t.texte), t.id).toEqual([]);
  });
  it("les 6 textes conformes à la recette ne lèvent aucun des 5 contrôles", () => {
    for (const t of TEMOINS_RECETTE) expect(leves(t.texte), t.id).toEqual([]);
  });
  for (const code of ["C95", "C96", "C98"] as CodeVersion[]) {
    it(`${code} : 0 faux positif sur les 71 témoins bons (recette + socle + corpus de 60)`, () => {
      const fp = fauxPositifsVersion(code, TOUS_VERSION);
      expect(fp.ids).toEqual([]);
      expect(fp.taux.sur).toBe(71);
    });
  }
  it("C97 et C99 exigent un élément : sur les textes du socle (B1-B3, BON, v5), ils lèvent à juste titre", () => {
    // B1-B3 et BON : aucune question au spectateur (C97) ; la rupture est dite en promesse, pas dans le dernier segment du corps (C99).
    expect(fauxPositifsVersion("C97", TEMOINS_SOCLE).ids).toEqual(["B1-devis", "B2-factures", "B3-recrutement", "BON"]);
    expect(fauxPositifsVersion("C99", TEMOINS_SOCLE).ids).toEqual(["v5-01", "B1-devis", "B2-factures", "B3-recrutement", "BON"]);
    // Sur le corpus (hors recette) : 55 sans question valable, 60 sans rupture : ce n'est pas un faux positif, ces textes ne suivent pas la recette.
    expect(fauxPositifsVersion("C97", TEMOINS_CORPUS).taux.declenche).toBe(55);
    expect(fauxPositifsVersion("C99", TEMOINS_CORPUS).taux.declenche).toBe(60);
  });
  it("C97 et C99 : 0 faux positif sur les 6 textes conformes à la recette", () => {
    expect(fauxPositifsVersion("C97", TEMOINS_RECETTE).ids).toEqual([]);
    expect(fauxPositifsVersion("C99", TEMOINS_RECETTE).ids).toEqual([]);
  });
  it.each(CONTRE_EXEMPLES.map((c) => [c.id, c] as const))("contre-exemple %s : le contrôle attendu se lève", (_id, c) => {
    expect(leves(c.texte, c.options), c.defaut).toContain(c.code);
  });
  it.each(PRESQUE_BONS.map((c) => [c.id, c] as const))("presque-faute %s : le contrôle ne se lève pas", (_id, c) => {
    expect(leves(c.texte, c.options), c.defaut).not.toContain(c.code);
  });
  it("faux négatifs : 0 pour C95, C96, C97, C99 ; 1 pour C98 (accroche à 2 racines : limite connue)", () => {
    for (const c of ["C95", "C96", "C97", "C99"] as CodeVersion[]) expect(fauxNegatifsVersion(c).ids, c).toEqual([]);
    expect(fauxNegatifsVersion("C98").ids).toEqual(["c98-limite"]);
    for (const l of LIMITES_CONNUES) expect(leves(l.texte), l.defaut).not.toContain(l.code);
  });
  it("limite connue de C99 : « Axion-IA met cette fiche en place pour vous » (sujet nommé, formulation du témoin v5) n'est PAS vue comme la rupture", () => {
    expect(ruptureDite("Axion-IA met cette fiche en place pour vous.")).toBe(false);
    expect(ruptureDite("On met cette fiche en place pour vous.")).toBe(true);
  });
});

describe("contrôles du tableau (lot B)", () => {
  it("les 4 témoins bons ne lèvent aucun des 7 contrôles", () => {
    for (const t of TEMOINS_TABLEAU) expect(codesTableau(t.ecriture()), t.id).toEqual([]);
  });
  it("les 7 contrôles : 0 faux positif sur les 4 témoins bons", () => {
    for (const c of CODES_TABLEAU) expect(fauxPositifsTableau(c).ids, c).toEqual([]);
  });
  it("0 faux négatif sur les contre-exemples (9, un à deux par contrôle)", () => {
    expect(CONTRE_EXEMPLES_TABLEAU).toHaveLength(9);
    for (const c of CODES_TABLEAU) expect(fauxNegatifsTableau(c).ids, c).toEqual([]);
  });
  it("niveaux : positionnement et etape-imperatif sont ÉLIMINATOIRES (bloquants) ; les 5 autres restent des remarques", () => {
    const bloquants: Record<CodeTableau, boolean> = { positionnement: true, "etape-imperatif": true, "promesse-nombre": false, "question-spectateur": false, "redit-accroche": false, "densite-scene": false, "ecran-redit": false };
    for (const c of CONTRE_EXEMPLES_TABLEAU) {
      const e = TEMOINS_TABLEAU[0].ecriture();
      c.fabriquer(e);
      expect(tableauBloque(e, c.code), c.id).toBe(bloquants[c.code]);
    }
  });
  it("les anciens témoins (avant D1) lèvent les défauts qu'ils portent : le tutoriel de la v4, la promesse en nombre d'étapes", () => {
    const v4 = TEMOINS_ANCIENS_TABLEAU.find((t) => t.id.startsWith("v4-"))!;
    expect(codesTableau(v4.ecriture())).toEqual(expect.arrayContaining(["etape-imperatif", "promesse-nombre"]));
    // Les anciens ne sont pas des « bons » : la densité et l'absence de question y sont réelles (3 ou 4 constats longs, pas de question).
    for (const t of TEMOINS_ANCIENS_TABLEAU) expect(codesTableau(t.ecriture()), t.id).toContain("densite-scene");
  });
  it("un défaut éliminatoire n'est jamais levé sur un témoin bon", () => {
    for (const t of TEMOINS_TABLEAU) expect(defautsTableau(t.ecriture()).filter((d) => d.eliminatoire), t.id).toEqual([]);
  });
});

describe("ressemblance C1 et socle qualité (déjà calibrés, rejoués)", () => {
  it("ressemblance : 0 refus à tort sur le corpus de 60 et sur les 12 paires honnêtes ; les 18 reprises sont vues", () => {
    const r = mesureRessemblance();
    expect([r.corpus.declenche, r.corpus.sur]).toEqual([0, 60]);
    expect([r.paires.declenche, r.paires.sur]).toEqual([0, 12]);
    expect([r.reprises.declenche, r.reprises.sur]).toEqual([18, 18]);
  });
  it("socle : les 3 bons ne sont jamais rouges, les 3 mauvais sont rouges", () => {
    for (const x of mesureSocle()) expect(x.voyant === "rouge", x.id).toBe(x.nature === "mauvais");
  });
});

describe("recommandations (la règle : 0 faux positif, 0 faux négatif, borne haute à 95 % de 10 % au plus)", () => {
  const rv = (c: CodeVersion, temoins: typeof TOUS_VERSION) => recommandation(fauxPositifsVersion(c, temoins), fauxNegatifsVersion(c));
  it("C95, C96 et C98 restent en alerte pour un passage en bloquant : moins de 5 contre-exemples (C98 : faux négatif connu en plus) ; C95 est déjà bloquant, à maintenir", () => {
    for (const c of ["C95", "C96", "C98"] as CodeVersion[]) {
      expect(fauxPositifsVersion(c, TOUS_VERSION).taux.declenche, c).toBe(0);
      expect(fauxNegatifsVersion(c).taux.sur, c).toBeLessThan(MIN_CONTRE_EXEMPLES);
      expect(rv(c, TOUS_VERSION), c).toBe("reste en alerte");
    }
    expect(fauxNegatifsVersion("C96").taux.sur).toBe(2);
  });
  it("la règle des 5 contre-exemples : avec 5 contre-exemples et aucun écart, le passage serait recommandé", () => {
    const zero = { taux: { declenche: 0, sur: 71, bornePoint95: 3 / 71 } };
    expect(recommandation(zero, { taux: { declenche: 0, sur: MIN_CONTRE_EXEMPLES, bornePoint95: 0.6 } })).toBe("peut devenir bloquant");
    expect(recommandation(zero, { taux: { declenche: 0, sur: MIN_CONTRE_EXEMPLES - 1, bornePoint95: 0.75 } })).toBe("reste en alerte");
  });
  it("C97 et C99 restent en alerte : 6 témoins conformes seulement (borne haute 50 %)", () => {
    expect(rv("C97", TEMOINS_RECETTE)).toBe("reste en alerte");
    expect(rv("C99", TEMOINS_RECETTE)).toBe("reste en alerte");
  });
  it("la recommandation chiffrée des 7 contrôles du tableau est « reste en alerte » (4 témoins, borne haute 75 %, 1 à 2 contre-exemples) ; positionnement et etape-imperatif restent pourtant éliminatoires : à maintenir (document §7)", () => {
    for (const c of CODES_TABLEAU) expect(recommandation(fauxPositifsTableau(c), fauxNegatifsTableau(c)), c).toBe("reste en alerte");
  });
  it("tout couvre les mêmes codes que le document", () => {
    expect(CODES_VERSION).toEqual(["C95", "C96", "C97", "C98", "C99"]);
    expect(CODES_TABLEAU).toHaveLength(7);
  });
});
