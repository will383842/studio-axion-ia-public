/** Raisons des envois refusés par mot (pur). Valeurs fictives. */
import { describe, expect, it } from "vitest";
import {
  agregerStatsMots,
  type ConversationStat,
} from "@/domaine/guide-reseau/stats-mots";

const MAINTENANT = Date.parse("2026-06-30T12:00:00.000Z");
const JOUR = 86_400_000;
const il_y_a = (ms: number): string => new Date(MAINTENANT - ms).toISOString();
const refus = (
  o: Partial<ConversationStat> & { cle: string },
): ConversationStat => ({
  etat: "m1_refuse",
  creeLe: il_y_a(JOUR),
  m1Le: null,
  ...o,
});
const GUIDE = (convs: ConversationStat[]) =>
  agregerStatsMots([], convs, MAINTENANT).find((s) => s.mot === "GUIDE")!;
const R = (
  motif: "fenetre-7-jours-depassee" | "droits-manquants" | "limite-meta",
  dApresMessage = false,
) => ({ motif, dApresMessage });

function invariant(s: ReturnType<typeof GUIDE>) {
  for (const w of ["j7", "j30", "total"] as const)
    expect(
      s.raisonsRefus.reduce((n, l) => n + l.f[w], 0) + s.refusSansRaison[w],
    ).toBe(s.envoisRefuses[w]);
}

describe("raisons de refus", () => {
  it("une ligne par motif, source phrase séparée, tri total décroissant puis motif", () => {
    const s = GUIDE([
      refus({ cle: "a", raison: R("limite-meta") }),
      refus({ cle: "b", raison: R("droits-manquants") }),
      refus({ cle: "c", raison: R("droits-manquants") }),
      refus({ cle: "d", raison: R("droits-manquants", true) }),
    ]);
    expect(
      s.raisonsRefus.map((l) => [l.motif, l.dApresMessage, l.f.total]),
    ).toEqual([
      ["droits-manquants", false, 2],
      ["droits-manquants", true, 1],
      ["limite-meta", false, 1],
    ]);
    expect(s.refusSansRaison.total).toBe(0);
    invariant(s);
  });
  it("invariant de somme sur toutes les fenêtres, bornes comprises", () => {
    const s = GUIDE([
      refus({ cle: "a", refuseLe: il_y_a(7 * JOUR), raison: R("limite-meta") }),
      refus({
        cle: "b",
        refuseLe: il_y_a(7 * JOUR + 1),
        raison: R("limite-meta"),
      }),
      refus({ cle: "c", refuseLe: il_y_a(30 * JOUR) }),
      refus({
        cle: "d",
        refuseLe: il_y_a(30 * JOUR + 1),
        raison: R("droits-manquants"),
      }),
      refus({ cle: "e", refuseLe: "illisible", creeLe: il_y_a(2 * JOUR) }),
    ]);
    expect(s.envoisRefuses).toEqual({ j7: 2, j30: 4, total: 5 });
    invariant(s);
  });
  it("deux conversations refusées d'une même personne : comptée une fois, raison la plus ancienne", () => {
    const s = GUIDE([
      refus({
        cle: "p|2",
        refuseLe: il_y_a(1 * JOUR),
        raison: R("limite-meta"),
      }),
      refus({
        cle: "p",
        refuseLe: il_y_a(5 * JOUR),
        raison: R("droits-manquants"),
      }),
    ]);
    expect(s.envoisRefuses.total).toBe(1);
    expect(s.raisonsRefus.map((l) => l.motif)).toEqual(["droits-manquants"]);
    invariant(s);
  });
  it("la plus ancienne sans raison : une autre refusée de la même personne qui en a une", () => {
    const s = GUIDE([
      refus({ cle: "p", refuseLe: il_y_a(5 * JOUR) }),
      refus({
        cle: "p|2",
        refuseLe: il_y_a(1 * JOUR),
        raison: R("limite-meta"),
      }),
    ]);
    expect(s.raisonsRefus.map((l) => l.motif)).toEqual(["limite-meta"]);
    expect(s.refusSansRaison.total).toBe(0);
    invariant(s);
  });
  it("refus sans raison compté dans « sans raison »", () => {
    const s = GUIDE([refus({ cle: "a" }), refus({ cle: "b", raison: null })]);
    expect(s.raisonsRefus).toEqual([]);
    expect(s.refusSansRaison.total).toBe(2);
    invariant(s);
  });
  it("raison posée sur une conversation non refusée : ignorée", () => {
    const s = GUIDE([
      refus({ cle: "a", etat: "attente_email", raison: R("limite-meta") }),
      refus({ cle: "b" }),
      refus({
        cle: "b|2",
        etat: "attente_email",
        raison: R("droits-manquants"),
      }),
    ]);
    expect(s.envoisRefuses.total).toBe(1);
    expect(s.raisonsRefus).toEqual([]);
    expect(s.refusSansRaison.total).toBe(1);
    invariant(s);
  });
  it("T1 : refusée il y a 10 jours sans raison, puis il y a 1 jour avec raison : invariant sur chaque fenêtre", () => {
    const s = GUIDE([
      refus({ cle: "p", refuseLe: il_y_a(10 * JOUR) }),
      refus({
        cle: "p|2",
        refuseLe: il_y_a(1 * JOUR),
        raison: R("limite-meta"),
      }),
    ]);
    expect(s.envoisRefuses).toEqual({ j7: 0, j30: 1, total: 1 });
    expect(s.raisonsRefus).toHaveLength(1);
    expect(s.raisonsRefus[0].f).toEqual({ j7: 0, j30: 1, total: 1 });
    expect(s.refusSansRaison).toEqual({ j7: 0, j30: 0, total: 0 });
    invariant(s);
  });
  it("T2 : la raison de la refusée la plus ancienne, qu'elle soit en dernier ou en premier dans la liste", () => {
    const ancienne = refus({
      cle: "p",
      refuseLe: il_y_a(9 * JOUR),
      raison: R("droits-manquants"),
    });
    const recente = refus({
      cle: "p|2",
      refuseLe: il_y_a(2 * JOUR),
      raison: R("limite-meta"),
    });
    for (const liste of [
      [recente, ancienne],
      [ancienne, recente],
    ]) {
      const s = GUIDE(liste);
      expect(s.raisonsRefus.map((l) => l.motif)).toEqual(["droits-manquants"]);
      invariant(s);
    }
  });
});
