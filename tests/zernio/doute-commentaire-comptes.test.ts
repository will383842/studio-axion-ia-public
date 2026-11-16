/** PR B · B11 : un événement doute n'est compté pour AUCUN mot (stats-mots, suivi-mots). */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deposerCommentaire, evenement } from "./aides/conversation";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const Stats = await import("@/services/stats-mots");
const Suivi = await import("@/services/suivi-mots");

beforeEach(() => {
  reinitialiserDepots();
  Stats.reinitialiserCacheStatsMots();
  Suivi.reinitialiserCacheSuivi();
});

describe("B11 · un doute n'est compté pour aucun mot", () => {
  it("stats-mots : mêmes chiffres avec ou sans l'événement doute", async () => {
    const T = Date.parse("2026-10-18T10:05:00.000Z");
    const avant = JSON.stringify(await Stats.lireStatsMots({ maintenantMs: T }));
    const id = await deposerCommentaire(depots, { motSeul: null });
    const ev = await evenement(depots, id);
    await depots().evenementsFournisseurs.modifier(ev.id, { charge: { ...ev.charge, doute: true } });
    Stats.reinitialiserCacheStatsMots();
    expect(JSON.stringify(await Stats.lireStatsMots({ maintenantMs: T }))).toBe(avant);
  });
  it("suivi-mots : mêmes chiffres avec ou sans l'événement doute", async () => {
    const T = Date.parse("2026-10-18T10:05:00.000Z");
    const lecture = (evts: any[]) => ({ evenements: async () => evts, conversations: async () => [] });
    const doute = { idEvenement: "e1", recuLe: "2026-10-18T10:00:00.000Z", motSeul: null, etat: "a_faire", idPostPlateforme: "p", reseau: "facebook" };
    const sans = await Suivi.lireTableauSuivi({ maintenantMs: T, lecture: lecture([]), env: {} });
    Suivi.reinitialiserCacheSuivi();
    const avec = await Suivi.lireTableauSuivi({ maintenantMs: T, lecture: lecture([doute]), env: {} });
    expect(JSON.stringify(avec)).toBe(JSON.stringify(sans));
  });
});
