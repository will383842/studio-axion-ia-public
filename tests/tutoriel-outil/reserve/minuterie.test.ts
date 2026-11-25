/** RES-4 : minuterie de la réserve (démarrage unique, arrêt, tour avec doubles : pas dû / dû). Aucun réseau, aucune dépense. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { REGLAGES_RESERVE_DEFAUT, type IssueTirage, type LigneHistorique } from "@/domaine/tutoriel-reserve";
import { arreterTirageReserve, DEPART_RESERVE_MS, demarrerTirageReserve, INTERVALLE_RESERVE_MS, tourReserve } from "@/services/tutoriel-reserve-minuterie";

const MAINTENANT = new Date("2026-11-18T10:00:00.000Z"); // mercredi
const actif = { ...REGLAGES_RESERVE_DEFAUT, actif: true, parSemaine: 2 };
const vide: IssueTirage = { etat: "reserve_vide" };

beforeEach(() => {
  vi.useFakeTimers();
  arreterTirageReserve();
});
afterEach(() => {
  arreterTirageReserve();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("minuterie", () => {
  it("un second démarrage est refusé, l'arrêt permet de repartir", () => {
    expect(demarrerTirageReserve()).toBe(true);
    expect(demarrerTirageReserve()).toBe(false);
    arreterTirageReserve();
    expect(demarrerTirageReserve()).toBe(true);
  });
  it("démarrée : 2 minuteries ; arrêtée : 0 ; délais attendus", () => {
    expect(INTERVALLE_RESERVE_MS).toBe(10 * 60_000);
    expect(DEPART_RESERVE_MS).toBe(2 * 60_000);
    expect(vi.getTimerCount()).toBe(0);
    expect(demarrerTirageReserve()).toBe(true);
    expect(vi.getTimerCount()).toBe(2);
    arreterTirageReserve();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("tourReserve", () => {
  it("pas dû (éteint) : le suivi passe, aucun tirage", async () => {
    const suivre = vi.fn(async () => ({ faits: 0, echecs: 0 }));
    const tirer = vi.fn(async () => vide);
    const r = await tourReserve({ maintenant: () => MAINTENANT, reglages: async () => REGLAGES_RESERVE_DEFAUT, historique: async () => [], suivre, tirer });
    expect(r).toEqual({ tire: false, saute: false });
    expect(suivre).toHaveBeenCalledTimes(1);
    expect(tirer).not.toHaveBeenCalled();
  });
  it("pas dû (quota de la semaine atteint) : aucun tirage", async () => {
    const h: LigneHistorique[] = [
      { le: "2026-11-16T08:00:00.000Z", declencheur: "rythme", elementId: "res-aaaaaaaa" },
      { le: "2026-11-17T20:00:00.000Z", declencheur: "rythme", elementId: "res-bbbbbbbb" },
    ];
    const tirer = vi.fn(async () => vide);
    await tourReserve({ maintenant: () => MAINTENANT, reglages: async () => actif, historique: async () => h, suivre: async () => ({}), tirer });
    expect(tirer).not.toHaveBeenCalled();
  });
  it("dû : un seul appel, déclencheur rythme, clé de rythme de la semaine", async () => {
    const tirer = vi.fn(async () => vide);
    const r = await tourReserve({ maintenant: () => MAINTENANT, reglages: async () => actif, historique: async () => [], suivre: async () => ({}), tirer });
    expect(r.tire).toBe(true);
    expect(tirer).toHaveBeenCalledTimes(1);
    expect(tirer).toHaveBeenCalledWith({ declencheur: "rythme", cle: "rythme-2026-11-16-1" });
  });
  it("le suivi est fait même si la réserve est éteinte, et sa panne n'empêche pas le tirage", async () => {
    const tirer = vi.fn(async () => vide);
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await tourReserve({ maintenant: () => MAINTENANT, reglages: async () => actif, historique: async () => [], suivre: async () => { throw new Error("panne SECRET"); }, tirer });
    expect(tirer).toHaveBeenCalledTimes(1);
    expect(err.mock.calls.flat().join(" ")).not.toContain("SECRET");
  });
  it("ne lève jamais (tirage en panne) et libère le drapeau", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const tirer = vi.fn(async (): Promise<IssueTirage> => { throw new Error("boum"); });
    const dep = { maintenant: () => MAINTENANT, reglages: async () => actif, historique: async () => [], suivre: async () => ({}), tirer };
    await expect(tourReserve(dep)).resolves.toEqual({ tire: false, saute: false });
    await tourReserve(dep);
    expect(tirer).toHaveBeenCalledTimes(2);
  });
  it("un tour à la fois : un tour en vol saute le suivant", async () => {
    let ouvrir!: () => void;
    const attente = new Promise<void>((ok) => (ouvrir = ok));
    const tirer = vi.fn(async () => { await attente; return vide; });
    const dep = { maintenant: () => MAINTENANT, reglages: async () => actif, historique: async () => [], suivre: async () => ({}), tirer };
    const premier = tourReserve(dep);
    await vi.advanceTimersByTimeAsync(0);
    expect(await tourReserve(dep)).toEqual({ tire: false, saute: true });
    ouvrir();
    await premier;
    expect(tirer).toHaveBeenCalledTimes(1);
  });
});
