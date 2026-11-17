/**
 * C3-UT-3.10a : les cinq gestes de Williams sur l'archive des extraits (service seul). Base en mémoire, session simulée.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ElementBibliotheque } from "@/domaine/types";
import type { FicheSourceExtraits, PlageExtrait } from "@/domaine/archive-extraits";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { lireParametre } = await import("@/services/_commun");
const svc = await import("@/services/archive-extraits");

const T0 = "2026-11-17T10:00:00.000Z";
const plage = (id: string, o: Partial<PlageExtrait> = {}): PlageExtrait => ({
  id, debutSec: 1, finSec: 8, texte: `Texte ${id}`, motsCles: [], avecVisage: false, texteIncruste: false, etat: "a_verifier", ...o,
});
const ok = { session: async () => ({}) };
const ports = () => ({ ...ok, maintenant: () => T0 });
const sansSession = { session: async () => { throw new Error("pas de session"); } };

async function semer(videoId: string, plages: PlageExtrait[]) {
  const fiche = {
    videoId, versionId: "v", sortieId: "s", ratio: "9:16", licence: { type: "propre" }, famille: [], plages, rangee: false, sourcePreferee: true,
  } as unknown as FicheSourceExtraits;
  await depots().elements.enregistrer({
    id: svc.idElementArchive(videoId), type: "source-extraits", nom: "x", motsCles: [], valeur: { type: "source-extraits", fiche },
    licence: { type: "propre" }, formatsParDefaut: [], creeLe: "2026-11-01T00:00:00.000Z", modifieLe: "2026-11-01T00:00:00.000Z",
  } as unknown as ElementBibliotheque);
}
const lire = async (id: string) => (await svc.ficheDeLaVideo(id))!;
const lignesJournal = async () => (await depots().evenements.lister((e) => e.type === "archive-extraits")).length;

beforeEach(() => {
  reinitialiserDepots();
  vi.restoreAllMocks();
});

describe("garde commune", () => {
  it("sans session : refus, zéro écriture", async () => {
    await semer("a", [plage("p1")]);
    const ecrit = vi.spyOn(depots().elements, "enregistrer");
    const ecritParam = vi.spyOn(depots().parametres, "enregistrer");
    const p = { ...sansSession, maintenant: () => T0 };
    await expect(svc.ecarterPlage("a", "p1", p)).rejects.toThrow();
    await expect(svc.retablirPlage("a", "p1", p)).rejects.toThrow();
    await expect(svc.validerPlage("a", "p1", p)).rejects.toThrow();
    await expect(svc.rangerSource("a", true, p)).rejects.toThrow();
    await expect(svc.cocherVideo("a", true, p)).rejects.toThrow();
    expect(ecrit).not.toHaveBeenCalled();
    expect(ecritParam).not.toHaveBeenCalled();
    expect(await lignesJournal()).toBe(0);
  });
  it("fiche absente : refus poli, zéro écriture", async () => {
    const ecrit = vi.spyOn(depots().elements, "enregistrer");
    const msg = { ok: false, message: "Cette vidéo n'a pas d'extraits archivés." };
    expect(await svc.ecarterPlage("zz", "p1", ports())).toEqual(msg);
    expect(await svc.retablirPlage("zz", "p1", ports())).toEqual(msg);
    expect(await svc.validerPlage("zz", "p1", ports())).toEqual(msg);
    expect(await svc.rangerSource("zz", true, ports())).toEqual(msg);
    expect(await svc.cocherVideo("zz", true, ports())).toEqual(msg);
    expect(ecrit).not.toHaveBeenCalled();
    expect(await lignesJournal()).toBe(0);
  });
});

describe("ecarterPlage / retablirPlage", () => {
  it("écarte, pose ecarteeLe, une ligne de journal", async () => {
    await semer("a", [plage("p1", { etat: "utilisable" })]);
    expect(await svc.ecarterPlage("a", "p1", ports())).toEqual({ ok: true });
    const p = (await lire("a")).plages[0];
    expect(p.etat).toBe("ecartee");
    expect(p.ecarteeLe).toBe(T0);
    expect(await lignesJournal()).toBe(1);
  });
  it("une plage inconnue est refusée poliment", async () => {
    await semer("a", [plage("p1")]);
    expect((await svc.ecarterPlage("a", "nope", ports())).ok).toBe(false);
  });
  it("une passe d'inscription ne la rétablit pas", async () => {
    const { reporterGestes } = await import("@/briques/archive-extraits/inscription");
    await semer("a", [plage("p1", { etat: "utilisable" })]);
    await svc.ecarterPlage("a", "p1", ports());
    const apres = reporterGestes((await lire("a")).plages, [plage("p1", { etat: "utilisable" })]);
    expect(apres[0].etat).toBe("ecartee");
    expect(apres[0].ecarteeLe).toBe(T0);
  });
  it("rétablit sans jamais passer à utilisable sans validation", async () => {
    await semer("a", [plage("p1", { etat: "utilisable" })]);
    await svc.ecarterPlage("a", "p1", ports());
    expect(await svc.retablirPlage("a", "p1", ports())).toEqual({ ok: true });
    const p = (await lire("a")).plages[0];
    expect(p.ecarteeLe).toBeUndefined();
    expect(p.etat).toBe("a_verifier");
    expect(await lignesJournal()).toBe(2);
  });
  it("rétablit en « utilisable » une plage déjà validée par Williams", async () => {
    await semer("a", [plage("p1", { etat: "ecartee", ecarteeLe: T0, valideeLe: T0 })]);
    await svc.retablirPlage("a", "p1", ports());
    expect((await lire("a")).plages[0].etat).toBe("utilisable");
  });
});

describe("validerPlage", () => {
  it("a_verifier → utilisable + valideeLe", async () => {
    await semer("a", [plage("p1", { etat: "a_verifier", raisonExclusion: "fenêtre inconnue" })]);
    expect(await svc.validerPlage("a", "p1", ports())).toEqual({ ok: true });
    const p = (await lire("a")).plages[0];
    expect(p.etat).toBe("utilisable");
    expect(p.valideeLe).toBe(T0);
    expect(p.raisonExclusion).toBeUndefined();
    expect(await lignesJournal()).toBe(1);
  });
  it("une exclue ne se valide pas", async () => {
    await semer("a", [plage("p1", { etat: "exclue", raisonExclusion: "visage" })]);
    const ecrit = vi.spyOn(depots().elements, "enregistrer");
    expect(await svc.validerPlage("a", "p1", ports())).toEqual({ ok: false, message: "Une exclusion automatique ne se valide pas." });
    expect(ecrit).not.toHaveBeenCalled();
    expect((await lire("a")).plages[0].etat).toBe("exclue");
    expect(await lignesJournal()).toBe(0);
  });
  it("une écartée ne se valide pas directement", async () => {
    await semer("a", [plage("p1", { etat: "ecartee", ecarteeLe: T0 })]);
    expect((await svc.validerPlage("a", "p1", ports())).ok).toBe(false);
  });
});

describe("rangerSource", () => {
  it("ranger puis remettre : rangee et archiveLe cohérents, rien supprimé", async () => {
    await semer("a", [plage("p1")]);
    expect(await svc.rangerSource("a", true, ports())).toEqual({ ok: true });
    let el = (await depots().elements.obtenir(svc.idElementArchive("a")))!;
    expect(el.archiveLe).toBe(T0);
    expect((await lire("a")).rangee).toBe(true);
    expect(await svc.rangerSource("a", false, ports())).toEqual({ ok: true });
    el = (await depots().elements.obtenir(svc.idElementArchive("a")))!;
    expect(el.archiveLe).toBeUndefined();
    expect((await lire("a")).rangee).toBe(false);
    expect((await lire("a")).plages).toHaveLength(1);
    expect(await lignesJournal()).toBe(2);
  });
});

describe("cocherVideo", () => {
  it("cocher deux fois : une seule entrée ; décocher la retire", async () => {
    await semer("a", [plage("p1")]);
    await svc.cocherVideo("a", true, ports());
    await svc.cocherVideo("a", true, ports());
    expect(await lireParametre<string[]>(svc.DONNEE_COCHEES, [])).toEqual(["a"]);
    await svc.cocherVideo("a", false, ports());
    expect(await lireParametre<string[]>(svc.DONNEE_COCHEES, [])).toEqual([]);
    expect(await lignesJournal()).toBe(3);
  });
  it("n'allume aucun réglage", async () => {
    await semer("a", [plage("p1")]);
    await svc.cocherVideo("a", true, ports());
    expect(await lireParametre<unknown>(svc.REGLAGE_SOURCES, null)).toBeNull();
    expect(await lireParametre<unknown>(svc.REGLAGE_INSCRIPTION, false)).toBe(false);
  });
});
