import { describe, expect, it } from "vitest";
import type { MotHorodate, SegmentSousTitres } from "@/domaine/types";
import { grouperUnites, recalerSurCoupes, sansChevauchement, unitesDe } from "@/briques/sous-titres/groupement";

/** Mots à 0,25 s chacun, collés les uns aux autres, à partir de `depart`. */
const mots = (textes: string[], depart = 0, pas = 0.25): MotHorodate[] =>
  textes.map((mot, i) => ({ mot, debutSec: depart + i * pas, finSec: depart + (i + 1) * pas }));

const seg = (id: string, debutSec: number, finSec: number, textes: string[] = ["a", "b"]): SegmentSousTitres => ({
  id,
  debutSec,
  finSec,
  mots: mots(textes, debutSec, (finSec - debutSec) / textes.length),
});

describe("unitesDe", () => {
  it("liste vide : aucune unité", () => {
    expect(unitesDe([])).toEqual([]);
  });

  it("mots ordinaires : une unité par mot, index et minutage repris", () => {
    const u = unitesDe(mots(["le", "chat", "dort"]));
    expect(u).toHaveLength(3);
    expect(u.map((x) => x.index)).toEqual([0, 1, 2]);
    expect(u.map((x) => x.mots.map((m) => m.mot))).toEqual([["le"], ["chat"], ["dort"]]);
    expect(u[1].debutSec).toBe(0.25);
    expect(u[1].finSec).toBe(0.5);
    expect(u.map((x) => x.montant)).toEqual([false, false, false]);
    expect(u.map((x) => x.outil)).toEqual([true, false, false]);
  });

  it("« 67 000 € » reste une seule unité insécable, montant, de 3 mots", () => {
    const u = unitesDe(mots(["il", "gagne", "67", "000", "€", "par", "an"]));
    expect(u).toHaveLength(5);
    expect(u[2].mots.map((m) => m.mot)).toEqual(["67", "000", "€"]);
    expect(u[2].index).toBe(2);
    expect(u[2].montant).toBe(true);
    expect(u[2].debutSec).toBe(0.5);
    expect(u[2].finSec).toBe(1.25);
    expect(u[3].index).toBe(5);
  });

  it("un nombre en fin de phrase n'avale pas le mot suivant ; fin de phrase et pause détectées", () => {
    const u = unitesDe(mots(["il", "y", "a", "12.", "000", "oui,", "non"]));
    const nombre = u.find((x) => x.montant)!;
    expect(nombre.mots.map((m) => m.mot)).toEqual(["12."]);
    expect(nombre.finPhrase).toBe(true);
    expect(u.find((x) => x.mots[0].mot === "oui,")!.pause).toBe(true);
  });

  it("enValeur sur un mot du bloc : l'unité est en valeur ; l'entrée n'est pas modifiée", () => {
    const entree = mots(["gratuit", "67", "000"]);
    entree[2].enValeur = true;
    const copie = JSON.parse(JSON.stringify(entree));
    const u = unitesDe(entree);
    expect(u.map((x) => x.valeur)).toEqual([false, true]);
    expect(entree).toEqual(copie);
  });
});

describe("grouperUnites", () => {
  it("liste vide : aucun groupe", () => {
    expect(grouperUnites([])).toEqual([]);
  });

  it("6 mots collés : jamais plus de 4 mots par groupe, tous les mots dans l'ordre", () => {
    const g = grouperUnites(mots(["nous", "allons", "voir", "ensemble", "comment", "faire"]));
    const tailles = g.map((x) => x.length);
    expect(tailles.every((t) => t >= 2 && t <= 4)).toBe(true);
    expect(g.flat().map((u) => u.mots[0].mot)).toEqual(["nous", "allons", "voir", "ensemble", "comment", "faire"]);
  });

  it("un blanc de plus de 0,3 s sépare toujours deux groupes", () => {
    const a = mots(["bonjour", "à", "tous"], 0);
    const b = mots(["merci", "beaucoup", "encore"], 3);
    const g = grouperUnites([...a, ...b]);
    expect(g.some((x) => x.some((u) => u.index < 3) && x.some((u) => u.index >= 3))).toBe(false);
    expect(g.flat()).toHaveLength(6);
  });

  it("un mot outil n'est jamais seul en fin de groupe (hors fin de morceau)", () => {
    const g = grouperUnites(mots(["il", "mange", "la", "pomme", "rouge", "de", "mon", "jardin"]));
    for (const x of g.slice(0, -1)) expect(x[x.length - 1].outil).toBe(false);
  });

  it("largeur : la mesure réelle borne la taille des groupes à plusieurs mots", () => {
    const mesurer = (m: string[]) => m.join(" ").length * 10;
    const g = grouperUnites(mots(["alpha", "beta", "gamma", "delta", "epsilon", "zeta"]), { largeurMaxPx: 120, mesurer });
    for (const x of g) if (x.length > 1) expect(mesurer(x.flatMap((u) => u.mots.map((m) => m.mot)))).toBeLessThanOrEqual(120);
  });

  it("l'entrée n'est pas modifiée", () => {
    const entree = mots(["un", "deux", "trois", "quatre", "cinq"]);
    const copie = JSON.parse(JSON.stringify(entree));
    grouperUnites(entree);
    expect(entree).toEqual(copie);
  });
});

describe("recalerSurCoupes", () => {
  it("sans coupe : copie identique, mais nouveaux objets", () => {
    const entree = [seg("a", 0, 1), seg("b", 1, 2)];
    const sortie = recalerSurCoupes(entree, []);
    expect(sortie).toEqual(entree);
    expect(sortie[0]).not.toBe(entree[0]);
  });

  it("liste vide : liste vide", () => {
    expect(recalerSurCoupes([], [1])).toEqual([]);
  });

  it("limite commune à moins de 0,2 s d'une coupe : déplacée des deux côtés", () => {
    const s = recalerSurCoupes([seg("a", 0, 1), seg("b", 1, 2)], [1.1]);
    expect([s[0].debutSec, s[0].finSec, s[1].debutSec, s[1].finSec]).toEqual([0, 1.1, 1.1, 2]);
  });

  it("coupe à 0,2 s ou plus : rien ne bouge", () => {
    const s = recalerSurCoupes([seg("a", 0, 1), seg("b", 1, 2)], [1.25, 0.7]);
    expect([s[0].finSec, s[1].debutSec]).toEqual([1, 1]);
  });

  it("le recalage est refusé si un groupe passerait sous la durée minimale", () => {
    const s = recalerSurCoupes([seg("a", 0, 0.5), seg("b", 0.5, 2)], [0.6], { dureeMinSec: 0.65 });
    expect([s[0].finSec, s[1].debutSec]).toEqual([0.5, 0.5]);
  });

  it("le début du premier groupe s'aligne sur une coupe proche ; les coupes ≤ 0 sont ignorées", () => {
    const s = recalerSurCoupes([seg("a", 0.1, 1)], [0.2, 0, -1]);
    expect(s[0].debutSec).toBe(0.2);
    const t = recalerSurCoupes([seg("a", 0.1, 1)], [0, -1]);
    expect(t[0].debutSec).toBe(0.1);
  });

  it("l'entrée n'est pas modifiée", () => {
    const entree = [seg("a", 0, 1), seg("b", 1, 2)];
    const copie = JSON.parse(JSON.stringify(entree));
    recalerSurCoupes(entree, [1.1]);
    expect(entree).toEqual(copie);
  });
});

describe("sansChevauchement", () => {
  it("liste vide : liste vide", () => {
    expect(sansChevauchement([])).toEqual([]);
  });

  it("un chevauchement est coupé au début du suivant", () => {
    const s = sansChevauchement([seg("a", 0, 1.5), seg("b", 1, 2)]);
    expect(s.map((x) => [x.id, x.debutSec, x.finSec])).toEqual([["a", 0, 1], ["b", 1, 2]]);
  });

  it("trie par début ; sans chevauchement, rien ne change", () => {
    const b = seg("b", 1, 2);
    const a = seg("a", 0, 1);
    const s = sansChevauchement([b, a]);
    expect(s.map((x) => x.id)).toEqual(["a", "b"]);
    expect(s[0]).toBe(a);
    expect(s[1]).toBe(b);
  });

  it("l'entrée n'est ni triée ni modifiée", () => {
    const entree = [seg("b", 1, 3), seg("a", 0, 1.5)];
    const copie = JSON.parse(JSON.stringify(entree));
    sansChevauchement(entree);
    expect(entree).toEqual(copie);
    expect(entree.map((x) => x.id)).toEqual(["b", "a"]);
  });
});
