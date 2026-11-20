/**
 * T-ORCHESTRATEUR-INTENSITE-v20h : tests DIRECTS, à attente exacte, des 7 fonctions exportées de
 * `src/briques/intensite/orchestrateur.ts` (le scénario 20 scripts × 3 niveaux reste dans `tests/d1-orchestrateur.test.ts`).
 * Aucun mock, aucune entrée modifiée.
 */
import { describe, expect, it } from "vitest";
import { chargeA, effetsRetenus, estFort, orchestrerIntensite, prioriteEffective, rapportDe, verifierIntensite, type EffetPlace } from "@/briques/intensite/orchestrateur";
import type { DemandeEffet, ResultatOrchestration } from "@/briques/intensite/types";

const PLAFOND = "plafond de la fenêtre de 3 s atteint";
const D = (id: string, type: DemandeEffet["type"], debutSec: number, finSec: number, extra: Partial<DemandeEffet> = {}): DemandeEffet => ({ id, type, debutSec, finSec, priorite: "normale", origine: "test", ...extra });
const P = (id: string, type: EffetPlace["type"], debutSec: number, finSec: number, poids: number, verrouille = false): EffetPlace => ({ id, type, debutSec, finSec, poids, verrouille });
const COMPTE = { effetsGardes: 0, effetsDecales: 0, effetsSautes: 0 };
const copie = <T>(x: T): T => structuredClone(x);

describe("estFort", () => {
  it("les effets de poids ≥ 2 sont forts", () => {
    for (const t of ["impact", "illustration", "incrustation", "bandeau"] as const) expect(estFort(t)).toBe(true);
  });
  it("les effets de poids < 2 sont légers", () => {
    for (const t of ["coupe", "poitrine", "souligne", "bruitage", "second-angle", "zoom-lent"] as const) expect(estFort(t)).toBe(false);
  });
});

describe("prioriteEffective", () => {
  it("normale avant 2 s → accroche ; à 2 s pile → normale", () => {
    expect(prioriteEffective(D("a", "coupe", 0, 1))).toBe("accroche");
    expect(prioriteEffective(D("a", "coupe", 1.9, 2.5))).toBe("accroche");
    expect(prioriteEffective(D("a", "coupe", 2, 3))).toBe("normale");
  });
  it("normale près d'une relance (≤ 1 s, bord inclus) → relance ; au-delà → normale", () => {
    expect(prioriteEffective(D("a", "coupe", 5, 6), [5.5])).toBe("relance");
    expect(prioriteEffective(D("a", "coupe", 5, 6), [4])).toBe("relance");
    expect(prioriteEffective(D("a", "coupe", 5, 6), [6.2])).toBe("normale");
    expect(prioriteEffective(D("a", "coupe", 5, 6))).toBe("normale");
  });
  it("une priorité déjà donnée reste inchangée (verrouille, accroche, relance), même avant 2 s ou près d'une relance", () => {
    expect(prioriteEffective(D("a", "coupe", 1, 2, { priorite: "verrouille" }), [1])).toBe("verrouille");
    expect(prioriteEffective(D("a", "coupe", 9, 10, { priorite: "accroche" }))).toBe("accroche");
    expect(prioriteEffective(D("a", "coupe", 9, 10, { priorite: "relance" }))).toBe("relance");
  });
});

describe("chargeA", () => {
  const effets = [
    { debutSec: 0, poids: 1 },
    { debutSec: 1, poids: 2 },
    { debutSec: 3, poids: 0.5 },
    { debutSec: 3.5, poids: 1 },
  ];
  it("somme les poids apparus dans ]t − 3 ; t] (borne haute incluse, borne basse exclue)", () => {
    expect(chargeA(effets, 2)).toBe(3);
    expect(chargeA(effets, 3)).toBe(2.5);
    expect(chargeA(effets, 3.5)).toBe(3.5);
    expect(chargeA(effets, 0)).toBe(1);
    expect(chargeA(effets, 4)).toBe(1.5);
  });
  it("liste vide ou fenêtre vide → 0", () => {
    expect(chargeA([], 5)).toBe(0);
    expect(chargeA(effets, 10)).toBe(0);
    expect(chargeA(effets, -1)).toBe(0);
  });
  it("arrondit au centième (pas au dixième)", () => {
    expect(chargeA([{ debutSec: 1, poids: 0.125 }, { debutSec: 1, poids: 0.5 }], 1)).toBe(0.63);
    expect(chargeA([{ debutSec: 1, poids: 0.1 }, { debutSec: 1, poids: 0.2 }], 1)).toBe(0.3);
    expect(chargeA([{ debutSec: 1, poids: 0.333 }, { debutSec: 1, poids: 0.333 }, { debutSec: 1, poids: 0.333 }], 1)).toBe(1);
  });
  it("ne modifie pas l'entrée", () => {
    const avant = copie(effets);
    chargeA(effets, 3);
    expect(effets).toEqual(avant);
  });
});

describe("rapportDe", () => {
  const A = P("a", "illustration", 0, 1, 2);
  const B = P("b", "incrustation", 1, 2, 2);
  it("liste vide : courbe à 0 tous les 0,5 s, aucun dépassement, plafond du niveau", () => {
    expect(rapportDe([], "equilibre", 1, COMPTE)).toEqual({
      niveau: "equilibre",
      plafond: 5,
      courbe: [{ tSec: 0, charge: 0 }, { tSec: 0.5, charge: 0 }, { tSec: 1, charge: 0 }],
      depassements: [],
      ...COMPTE,
    });
  });
  it("courbe exacte et un dépassement (sobre, plafond 3) sur 2 effets facultatifs ; le compte est recopié", () => {
    const r = rapportDe([A, B], "sobre", 3, { effetsGardes: 2, effetsDecales: 1, effetsSautes: 3 });
    expect(r.plafond).toBe(3);
    expect(r.courbe).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3].map((tSec, i) => ({ tSec, charge: [2, 2, 4, 4, 4, 4, 2][i] })));
    expect(r.depassements).toEqual([{ debutSec: 0, finSec: 1, charge: 4 }]);
    expect([r.effetsGardes, r.effetsDecales, r.effetsSautes]).toEqual([2, 1, 3]);
  });
  it("à plafond égal : aucun dépassement (equilibre, plafond 5, charge 4)", () => {
    expect(rapportDe([A, B], "equilibre", 3, COMPTE).depassements).toEqual([]);
  });
  it("dépassements voisins fusionnés (fin repoussée, charge maximale) ; éloignés : séparés", () => {
    expect(rapportDe([A, B, P("c", "bandeau", 2, 3, 2)], "sobre", 3, COMPTE).depassements).toEqual([{ debutSec: 0, finSec: 2, charge: 6 }]);
    const loin = [P("a", "impact", 1, 2, 2), P("b", "impact", 1, 2, 2), P("c", "impact", 5, 6, 2), P("d", "impact", 5, 6, 2)];
    expect(rapportDe(loin, "sobre", 6, COMPTE).depassements).toEqual([
      { debutSec: 0, finSec: 1, charge: 4 },
      { debutSec: 2, finSec: 5, charge: 4 },
    ]);
  });
  it("un surplus fait seulement de verrouillés n'est pas un dépassement, mais la courbe le montre", () => {
    const r = rapportDe([P("a", "illustration", 0, 1, 2, true), P("b", "incrustation", 1, 2, 2, true)], "sobre", 2, COMPTE);
    expect(r.depassements).toEqual([]);
    expect(r.courbe.find((c) => c.tSec === 1)).toEqual({ tSec: 1, charge: 4 });
  });
  it("ne modifie pas l'entrée", () => {
    const places = [copie(A), copie(B)];
    const avant = copie(places);
    rapportDe(places, "sobre", 3, COMPTE);
    expect(places).toEqual(avant);
  });
});

describe("verifierIntensite", () => {
  it("un seul effet : aucun manquement", () => {
    expect(verifierIntensite([P("a", "impact", 1, 2, 3)], "sobre")).toEqual([]);
    expect(verifierIntensite([], "sobre")).toEqual([]);
  });
  it("plafond dépassé + respiration trop courte, en clair", () => {
    const fautes = verifierIntensite([P("a", "illustration", 0, 1, 2), P("b", "incrustation", 1, 2, 2)], "sobre");
    expect(fautes).toEqual(["fenêtre finissant à 1.00 s : charge 4 > 3", "a puis b : respiration trop courte"]);
  });
  it("deux forts en même temps", () => {
    expect(verifierIntensite([P("x", "impact", 0, 2, 3), P("y", "bandeau", 1, 3, 2)], "equilibre")).toEqual(["x et y : deux effets forts en même temps"]);
  });
  it("deux forts verrouillés ensemble : jamais une faute, même au-dessus du plafond", () => {
    expect(verifierIntensite([P("x", "impact", 0, 2, 3, true), P("y", "bandeau", 1, 3, 2, true)], "sobre")).toEqual([]);
  });
  it("respiration juste respectée (1,5 s après la fin d'un fort) : conforme", () => {
    expect(verifierIntensite([P("a", "impact", 0, 1, 3), P("b", "bandeau", 2.5, 3.5, 2)], "tres-dynamique")).toEqual([]);
  });
  it("ne modifie pas l'entrée", () => {
    const places = [P("b", "incrustation", 1, 2, 2), P("a", "illustration", 0, 1, 2)];
    const avant = copie(places);
    verifierIntensite(places, "sobre");
    expect(places).toEqual(avant);
  });
});

describe("orchestrerIntensite", () => {
  const options = { niveau: "sobre", dureeSec: 10 } as const;
  it("un effet seul : gardé tel quel, compte 1/0/0", () => {
    const r = orchestrerIntensite([D("u", "coupe", 1, 2)], options);
    expect(r.decisions).toEqual([{ id: "u", decision: "garde", debutSec: 1, finSec: 2 }]);
    expect(r.rapport).toMatchObject({ niveau: "sobre", plafond: 3, depassements: [], effetsGardes: 1, effetsDecales: 0, effetsSautes: 0 });
  });
  it("aucune demande : rien, courbe à 0", () => {
    const r = orchestrerIntensite([], { niveau: "equilibre", dureeSec: 1 });
    expect(r.decisions).toEqual([]);
    expect(r.rapport.courbe).toEqual([{ tSec: 0, charge: 0 }, { tSec: 0.5, charge: 0 }, { tSec: 1, charge: 0 }]);
  });
  it("sans décalage admis : le second effet qui ne tient pas est sauté, la raison est écrite", () => {
    const r = orchestrerIntensite([D("a", "impact", 5, 6), D("b", "impact", 5, 6)], options);
    expect(r.decisions).toEqual([
      { id: "a", decision: "garde", debutSec: 5, finSec: 6 },
      { id: "b", decision: "saute", debutSec: 5, finSec: 6, raison: PLAFOND },
    ]);
    expect([r.rapport.effetsGardes, r.rapport.effetsDecales, r.rapport.effetsSautes]).toEqual([1, 0, 1]);
  });
  it("avec décalage admis : décalé au premier instant libre (+0,1 s par pas), raison = premier obstacle", () => {
    const r = orchestrerIntensite([D("a", "impact", 5, 6), D("b", "impact", 5, 6, { decalageMaxSec: 3, decalageSens: "plus-tard" })], options);
    expect(r.decisions[1]).toEqual({ id: "b", decision: "decale", debutSec: 8, finSec: 9, raison: PLAFOND });
    expect([r.rapport.effetsGardes, r.rapport.effetsDecales, r.rapport.effetsSautes]).toEqual([1, 1, 0]);
    expect(r.rapport.depassements).toEqual([]);
    expect(r.rapport.courbe).toEqual(Array.from({ length: 21 }, (_, i) => ({ tSec: i * 0.5, charge: i >= 10 ? 3 : 0 })));
  });
  it("décalage trop court ou qui sortirait de la vidéo : sauté", () => {
    expect(orchestrerIntensite([D("a", "impact", 5, 6), D("b", "impact", 5, 6, { decalageMaxSec: 1, decalageSens: "plus-tard" })], options).decisions[1].decision).toBe("saute");
    const fin = orchestrerIntensite([D("a", "impact", 9, 10), D("b", "impact", 9, 10, { decalageMaxSec: 3, decalageSens: "plus-tard" })], options);
    expect(fin.decisions[1]).toMatchObject({ decision: "saute", debutSec: 9, finSec: 10 });
  });
  it("un verrouillé passe toujours, avant les autres, même au-dessus du plafond, sans que ce soit un dépassement", () => {
    const r = orchestrerIntensite([D("n", "impact", 5, 6), D("v1", "impact", 5, 6, { priorite: "verrouille" }), D("v2", "impact", 5, 6, { priorite: "verrouille" })], options);
    expect(r.decisions.map((d) => [d.id, d.decision, d.debutSec])).toEqual([["n", "saute", 5], ["v1", "garde", 5], ["v2", "garde", 5]]);
    expect(r.rapport.depassements).toEqual([]);
  });
  it("l'accroche (avant 2 s) passe avant la normale, même demandée après", () => {
    const r = orchestrerIntensite([D("tard", "illustration", 3, 4), D("tot", "illustration", 1, 2)], { niveau: "sobre", dureeSec: 10 });
    expect(r.decisions).toEqual([
      { id: "tard", decision: "saute", debutSec: 3, finSec: 4, raison: PLAFOND },
      { id: "tot", decision: "garde", debutSec: 1, finSec: 2 },
    ]);
  });
  it("ne modifie pas les demandes", () => {
    const demandes = [D("a", "impact", 5, 6), D("b", "impact", 5, 6, { decalageMaxSec: 3 })];
    const avant = copie(demandes);
    orchestrerIntensite(demandes, options);
    expect(demandes).toEqual(avant);
  });
  it("déterministe", () => {
    const demandes = [D("a", "impact", 5, 6), D("b", "bandeau", 5.5, 7, { decalageMaxSec: 2 }), D("c", "coupe", 1, 2)];
    expect(orchestrerIntensite(demandes, options)).toEqual(orchestrerIntensite(demandes, options));
  });
});

describe("effetsRetenus", () => {
  it("exclut les sautés, reprend les verrouillés (types, poids, instants)", () => {
    const demandes = [D("v", "illustration", 5, 6, { priorite: "verrouille" }), D("w", "impact", 5, 6, { priorite: "verrouille" }), D("s", "impact", 5.2, 6)];
    const resultat = orchestrerIntensite(demandes, { niveau: "sobre", dureeSec: 10 });
    expect(effetsRetenus(demandes, resultat)).toEqual([P("v", "illustration", 5, 6, 2, true), P("w", "impact", 5, 6, 3, true)]);
  });
  it("prend les instants décidés (décalés) et marque verrouillé selon la priorité effective (relances comprises)", () => {
    const demandes = [D("a", "coupe", 5, 6), D("b", "bandeau", 9, 10)];
    const resultat = { decisions: [{ id: "a", decision: "decale", debutSec: 5.5, finSec: 6.5 }, { id: "b", decision: "garde", debutSec: 9, finSec: 10 }] } as ResultatOrchestration;
    expect(effetsRetenus(demandes, resultat)).toEqual([P("a", "coupe", 5.5, 6.5, 1), P("b", "bandeau", 9, 10, 2)]);
    expect(effetsRetenus(demandes, resultat, [5.5]).map((e) => e.verrouille)).toEqual([false, false]);
    const verrouilles = [D("a", "coupe", 5, 6, { priorite: "verrouille" }), D("b", "bandeau", 9, 10)];
    expect(effetsRetenus(verrouilles, resultat).map((e) => e.verrouille)).toEqual([true, false]);
  });
  it("demande sans décision : ignorée ; aucune demande : liste vide ; entrées non modifiées", () => {
    const demandes = [D("a", "coupe", 5, 6), D("zz", "coupe", 7, 8)];
    const resultat = { decisions: [{ id: "a", decision: "garde", debutSec: 5, finSec: 6 }] } as ResultatOrchestration;
    const avant = copie({ demandes, resultat });
    expect(effetsRetenus(demandes, resultat).map((e) => e.id)).toEqual(["a"]);
    expect(effetsRetenus([], resultat)).toEqual([]);
    expect({ demandes, resultat }).toEqual(avant);
  });
});
