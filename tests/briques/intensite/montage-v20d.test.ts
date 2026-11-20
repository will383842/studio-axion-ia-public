/**
 * T-INTENSITE-MONTAGE-v20d — tests directs de l'application du dosage d'intensité au montage :
 * appliquerAuxPlans, appliquerAuxSousTitres, declencheursVus, allegerStructure, avecChoixBruitages.
 * Entrées construites à la main, aucun réseau, aucune horloge.
 */
import { describe, expect, it } from "vitest";
import type { SegmentSousTitres } from "@/domaine/types";
import type { PlanProduit } from "@/moteurs/types";
import type { DecisionEffet } from "@/briques/intensite/types";
import { allegerStructure, appliquerAuxPlans, appliquerAuxSousTitres, avecChoixBruitages, declencheursVus } from "@/briques/intensite/montage";

const plan = (ordre: number, debutSec: number, finSec: number, extra: Partial<PlanProduit> = {}): PlanProduit =>
  ({
    ordre,
    debutSec,
    finSec,
    texte: `t${ordre}`,
    segmentId: `seg-${ordre}`,
    sourceImage: "double",
    motsEnValeur: [],
    cadrage: { pointInteret: { x: 0.5, y: 0.5 }, zoom: 1 },
    transition: "coupe",
    ...extra,
  }) as PlanProduit;

const segment = (id: string, extra: Partial<SegmentSousTitres> = {}): SegmentSousTitres => ({
  id,
  debutSec: 0,
  finSec: 1,
  mots: [
    { mot: "un", debutSec: 0, finSec: 0.4 },
    { mot: "mot", debutSec: 0.4, finSec: 1 },
  ],
  style: "impact",
  importance: 3,
  souligne: 1,
  position: "haut",
  inclinaison: 4,
  ...extra,
});

const dec = (id: string, decision: DecisionEffet["decision"], debutSec = 0, finSec = 1): [string, DecisionEffet] => [id, { id, decision, debutSec, finSec }];

describe("appliquerAuxPlans", () => {
  it("sans décision : plans inchangés (mêmes valeurs)", () => {
    const plans = [plan(1, 0, 4, { cadrage: { pointInteret: { x: 0.5, y: 0.5 }, zoom: 1, zoomFin: 1.06 }, incrustation: { type: "montant", texte: "100 €" } })];
    expect(appliquerAuxPlans(plans, new Map())).toEqual(plans);
  });

  it("zoom-lent sauté : seul le plan visé redevient fixe", () => {
    const plans = [
      plan(1, 0, 4, { cadrage: { pointInteret: { x: 0.5, y: 0.5 }, zoom: 1, zoomFin: 1.06 } }),
      plan(2, 4, 8, { cadrage: { pointInteret: { x: 0.5, y: 0.5 }, zoom: 1, zoomFin: 1.06 } }),
    ];
    const r = appliquerAuxPlans(plans, new Map([dec("plan-2:zoom-lent", "saute", 4, 8)]));
    expect(r[0].cadrage.zoomFin).toBe(1.06);
    expect(r[1].cadrage.zoomFin).toBeUndefined();
    expect(r[1].cadrage.zoom).toBe(1);
  });

  it("incrustation sautée : retirée du seul plan visé", () => {
    const plans = [plan(1, 0, 4, { incrustation: { type: "objet", texte: "a" } }), plan(2, 4, 8, { incrustation: { type: "objet", texte: "b" } })];
    const r = appliquerAuxPlans(plans, new Map([dec("plan-1:incrustation", "saute", 0, 4)]));
    expect(r[0].incrustation).toBeUndefined();
    expect(r[1].incrustation).toEqual({ type: "objet", texte: "b" });
  });

  it("incrustation décalée : decalageSec = début décidé − début du plan", () => {
    const plans = [plan(1, 10, 14, { incrustation: { type: "objet", texte: "a" } })];
    const r = appliquerAuxPlans(plans, new Map([dec("plan-1:incrustation", "decale", 11.5, 14)]));
    expect(r[0].incrustation?.decalageSec).toBe(1.5);
  });

  it("incrustation gardée à l'instant du plan : aucun decalageSec résiduel", () => {
    const plans = [plan(1, 10, 14, { incrustation: { type: "objet", texte: "a", decalageSec: 2 } })];
    const r = appliquerAuxPlans(plans, new Map([dec("plan-1:incrustation", "garde", 10, 14)]));
    expect(r[0].incrustation).toEqual({ type: "objet", texte: "a" });
    expect("decalageSec" in (r[0].incrustation ?? {})).toBe(false);
  });

  it("ne modifie pas les plans reçus", () => {
    const plans = [plan(1, 0, 4, { incrustation: { type: "objet", texte: "a" } })];
    appliquerAuxPlans(plans, new Map([dec("plan-1:incrustation", "saute")]));
    expect(plans[0].incrustation).toEqual({ type: "objet", texte: "a" });
  });
});

describe("appliquerAuxSousTitres", () => {
  it("sans décision : groupes inchangés", () => {
    const segs = [segment("a")];
    expect(appliquerAuxSousTitres(segs, new Map())).toEqual(segs);
  });

  it("impact sauté : le groupe redevient la base (importance ≤ 2, position auto, inclinaison 0)", () => {
    const r = appliquerAuxSousTitres([segment("a")], new Map([dec("st-a:impact", "saute")]));
    expect(r[0].style).toBe("base");
    expect(r[0].importance).toBe(2);
    expect(r[0].position).toBe("auto");
    expect(r[0].inclinaison).toBe(0);
  });

  it("souligné sauté : souligne = null, style conservé", () => {
    const r = appliquerAuxSousTitres([segment("a")], new Map([dec("st-a:souligne", "saute")]));
    expect(r[0].souligne).toBeNull();
    expect(r[0].style).toBe("impact");
  });

  it("un groupe verrouillé ne bouge jamais", () => {
    const v = segment("a", { verrouille: true });
    const r = appliquerAuxSousTitres([v], new Map([dec("st-a:impact", "saute"), dec("st-a:souligne", "saute")]));
    expect(r[0]).toBe(v);
  });

  it("l'accent sauté d'un groupe n'atteint pas les autres", () => {
    const r = appliquerAuxSousTitres([segment("a"), segment("b")], new Map([dec("st-b:impact", "saute")]));
    expect(r[0].style).toBe("impact");
    expect(r[1].style).toBe("base");
  });
});

describe("declencheursVus", () => {
  it("rien à l'image : aucun déclencheur", () => {
    expect(declencheursVus([plan(1, 0, 4)], [segment("a", { style: "base" })])).toEqual([]);
  });

  it("montant : « chiffre » à l'instant du plan + décalage", () => {
    const r = declencheursVus([plan(1, 10, 14, { incrustation: { type: "montant", texte: "5 €", decalageSec: 1.5 } })], []);
    expect(r).toEqual([{ declencheur: "chiffre", instantSec: 11.5, planId: "plan-1" }]);
  });

  it("illustration « téléphone » : déclencheur téléphone au début du plan", () => {
    const r = declencheursVus([plan(2, 4, 8, { sourceImage: "illustration", illustration: { source: "aucune", requete: "un SMS reçu", verrouille: false, candidats: [] } })], []);
    expect(r).toEqual([{ declencheur: "telephone", instantSec: 4, planId: "plan-2" }]);
  });

  it("Impact avec chiffre : « chiffre » ; sans chiffre : « impact » ; liste sans doublon exact", () => {
    const avecChiffre = segment("a", { debutSec: 1, mots: [{ mot: "300", debutSec: 1, finSec: 1.5 }] });
    const sansChiffre = segment("b", { debutSec: 2 });
    const r = declencheursVus([], [avecChiffre, sansChiffre]);
    expect(r).toEqual([
      { declencheur: "chiffre", instantSec: 1 },
      { declencheur: "impact", instantSec: 2 },
    ]);
    expect(new Set(r.map((x) => JSON.stringify(x))).size).toBe(r.length);
  });
});

describe("allegerStructure", () => {
  const rafale = () => {
    // 6 plans de 0,5 s, cadrages alternés : 5 coupes (poids 1) dans 3 s, au-dessus du plafond « sobre » (3), sous « équilibré » (5).
    const v = ["large", "poitrine"] as const;
    return [0, 1, 2, 3, 4, 5].map((i) => plan(i + 1, i / 2, (i + 1) / 2, { cadrage: { pointInteret: { x: 0.5, y: 0.5 }, zoom: 1, valeur: v[i % 2] } }));
  };

  it("sous le plafond : rien n'est retiré (mêmes plans)", () => {
    const plans = [plan(1, 0, 5), plan(2, 5, 10)];
    expect(allegerStructure(plans, "sobre", { plafondPlanSec: 20 })).toEqual(plans);
  });

  it("niveau le plus bas retire plus de coupes que le plus haut", () => {
    const sobre = allegerStructure(rafale(), "sobre", { plafondPlanSec: 20 });
    const haut = allegerStructure(rafale(), "tres-dynamique", { plafondPlanSec: 20 });
    expect(sobre.length).toBeLessThan(haut.length);
    expect(haut).toHaveLength(6);
  });

  it("renumérote les plans de 1 à n sans trou", () => {
    const r = allegerStructure(rafale(), "sobre", { plafondPlanSec: 20 });
    expect(r.map((p) => p.ordre)).toEqual(r.map((_, i) => i + 1));
  });

  it("la fusion garde le début du premier et la fin du dernier plan : couverture continue", () => {
    const r = allegerStructure(rafale(), "sobre", { plafondPlanSec: 20 });
    expect(r[0].debutSec).toBe(0);
    expect(r.at(-1)?.finSec).toBe(3);
    for (let i = 1; i < r.length; i++) expect(r[i].debutSec).toBe(r[i - 1].finSec);
  });

  it("plafondPlanSec trop court : aucune fusion", () => {
    expect(allegerStructure(rafale(), "sobre", { plafondPlanSec: 0.5 })).toHaveLength(6);
  });

  it("coupes protégées : jamais retirées", () => {
    const r = allegerStructure(rafale(), "sobre", { plafondPlanSec: 20, coupesProtegees: [0.5, 1, 1.5, 2, 2.5] });
    expect(r).toHaveLength(6);
  });

  it("ne modifie pas les plans reçus", () => {
    const plans = rafale();
    const copie = JSON.parse(JSON.stringify(plans));
    allegerStructure(plans, "sobre", { plafondPlanSec: 20 });
    expect(plans).toEqual(copie);
  });
});

describe("avecChoixBruitages", () => {
  const retirer = { mode: "retire" } as never;
  const ajouter = { mode: "ajoute", elementId: "son-existant" } as never;
  type P = { ordre: number; segmentId?: string; bruitage?: PlanProduit["bruitage"] };
  const p = (ordre: number, segmentId: string): P => ({ ordre, segmentId });

  it("conserve ordre et segmentId, sans choix : aucun bruitage", () => {
    const r = avecChoixBruitages([{ ordre: 3, segmentId: "s1" }], []);
    expect(r).toEqual([{ ordre: 3, segmentId: "s1" }]);
  });

  it("choix par ordre (après fabrication) : posé sur le plan visé, ordre et segmentId conservés", () => {
    const r = avecChoixBruitages([{ ordre: 1, segmentId: "s1" }, { ordre: 2, segmentId: "s2" }], [], { "2": ajouter });
    expect(r[0]).toEqual({ ordre: 1, segmentId: "s1" });
    expect(r[1]).toEqual({ ordre: 2, segmentId: "s2", bruitage: ajouter });
  });

  it("choix par ordre à null : l'ancien bruitage est retiré", () => {
    const r = avecChoixBruitages([{ ordre: 1, segmentId: "s1", bruitage: ajouter }], [], { "1": null });
    expect(r).toEqual([{ ordre: 1, segmentId: "s1" }]);
  });

  it("indicatif « retire » : vaut pour tous les plans de la même phrase", () => {
    const r = avecChoixBruitages([p(1, "s1"), p(2, "s1")], [{ segmentId: "s1", bruitage: retirer }]);
    expect(r.map((p) => p.bruitage)).toEqual([retirer, retirer]);
  });

  it("indicatif « ajoute » : seulement le premier plan de la phrase", () => {
    const r = avecChoixBruitages([p(1, "s1"), p(2, "s1"), p(3, "s2")], [{ segmentId: "s1", bruitage: ajouter }]);
    expect(r[0].bruitage).toBe(ajouter);
    expect(r[1].bruitage).toBeUndefined();
    expect(r[2].bruitage).toBeUndefined();
    expect(r.map((p) => p.ordre)).toEqual([1, 2, 3]);
  });
});
