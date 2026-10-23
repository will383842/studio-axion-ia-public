/** Réserve du comité : une idée jugée trop vieille (plus de 7 jours, à l'heure de Paris) n'est plus montrée ni comptée. */
import { beforeEach, describe, expect, it } from "vitest";
import { JOUR_MS } from "@/lib/dates";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const comite = await import("@/services/comite-editorial");

const ilYA = (jours: number) => new Date(Date.now() - jours * JOUR_MS).toISOString();
const jugee = (n: number, jours: number) => ({ id: `ij-${n}`, signature: `s${n}`, idee: "x", textes: {}, notes: { douleur: 8, cible: 8, angleDifferent: 8, potentiel: 8 }, total: 32, verdict: "garder" as const, raison: "r", angle: "a", date: ilYA(jours), source: "lot" as const, creeLe: "", modifieLe: "" });

beforeEach(() => reinitialiserDepots());

describe("âge des idées jugées", () => {
  it("la borne par défaut est de 7 jours", () => {
    expect(comite.AGE_MAX_IDEE_JUGEE_JOURS).toBe(7);
  });

  it("les journées se comptent à l'heure de Paris, pas en tranches de 24 h", () => {
    // 23 h 30 à Paris le 9 → 00 h 30 à Paris le 10 : un seul changement de jour, donc 1 jour d'âge.
    expect(comite.ageEnJoursParis("2026-10-09T21:30:00Z", "2026-10-09T22:30:00Z")).toBe(1);
    expect(comite.ageEnJoursParis("2026-10-10T00:00:00Z", "2026-10-17T00:00:00Z")).toBe(7);
  });

  it("une idée de 8 jours est ignorée, une de 6 jours est gardée", async () => {
    await depots().ideesJugees.enregistrer(jugee(8, 8));
    await depots().ideesJugees.enregistrer(jugee(6, 6));
    expect((await comite.listerIdeesJugees()).map((i) => i.id)).toEqual(["ij-6"]);
    expect(await comite.tailleReserve()).toBe(1);
    expect((await comite.listerIdeesJugees({ verdict: "garder" })).map((i) => i.id)).toEqual(["ij-6"]);
  });
});
