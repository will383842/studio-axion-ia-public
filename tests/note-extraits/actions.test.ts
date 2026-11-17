/** X4-12b : gestes de la note côté serveur (service + 3 actions). Rien ne les appelle encore ; tout éteint. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ElementBibliotheque } from "@/domaine/types";
import type { FicheSourceExtraits, PlageExtrait } from "@/domaine/archive-extraits";
import type { Moment, NoteMoment, ResultatTri } from "@/briques/note-extraits";
import { SEUILS_PAR_DEFAUT } from "@/briques/note-extraits";
import { reporterGestes } from "@/briques/archive-extraits/inscription";

const m = vi.hoisted(() => ({
  exigerSession: vi.fn(),
  revalidatePath: vi.fn(),
  garder: vi.fn(),
  sujet: vi.fn(),
  chiffres: vi.fn(),
  simule: { actif: false },
}));
vi.mock("@/services/auth", () => ({ exigerSession: m.exigerSession }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidatePath }));
// Le service réel sert aux tests du service ; les actions le voient simulé quand `m.simule.actif`.
vi.mock("@/services/gestes-note-extraits", async (importOriginal) => {
  const vrai = await importOriginal<typeof import("@/services/gestes-note-extraits")>();
  return {
    ...vrai,
    garderQuandMemeExtrait: (...a: Parameters<typeof vrai.garderQuandMemeExtrait>) => (m.simule.actif ? m.garder(...a) : vrai.garderQuandMemeExtrait(...a)),
    changerSujetExtrait: (...a: Parameters<typeof vrai.changerSujetExtrait>) => (m.simule.actif ? m.sujet(...a) : vrai.changerSujetExtrait(...a)),
    marquerChiffresReelsVideo: (...a: Parameters<typeof vrai.marquerChiffresReelsVideo>) => (m.simule.actif ? m.chiffres(...a) : vrai.marquerChiffresReelsVideo(...a)),
  };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { idElementArchive, ficheDeLaVideo } = await import("@/services/archive-extraits");
const { ficheAvecTri } = await import("@/services/note-extraits");
const svc = await import("@/services/gestes-note-extraits");

const T0 = "2026-11-17T10:00:00.000Z";
const plage = (id: string, o: Partial<PlageExtrait> = {}): PlageExtrait => ({
  id, debutSec: 1, finSec: 8, texte: `Texte ${id}`, motsCles: [], avecVisage: false, texteIncruste: false, etat: "a_verifier", ...o,
});
const ports = () => ({ session: async () => ({}), maintenant: () => T0 });
const sansSession = { session: async () => { throw new Error("pas de session"); }, maintenant: () => T0 };

async function semer(videoId: string, plages: PlageExtrait[]) {
  const fiche = {
    videoId, versionId: "v", sortieId: "s", ratio: "9:16", licence: { type: "propre" }, famille: [], plages, rangee: false, sourcePreferee: true,
  } as unknown as FicheSourceExtraits;
  await depots().elements.enregistrer({
    id: idElementArchive(videoId), type: "source-extraits", nom: "x", motsCles: [], valeur: { type: "source-extraits", fiche },
    licence: { type: "propre" }, formatsParDefaut: [], creeLe: "2026-11-01T00:00:00.000Z", modifieLe: "2026-11-01T00:00:00.000Z",
  } as unknown as ElementBibliotheque);
}
const lire = async (id: string) => (await ficheDeLaVideo(id))!;
const journal = async () => (await depots().evenements.lister((e) => e.type === "archive-extraits")).map((e) => e.message);

beforeEach(() => {
  reinitialiserDepots();
  vi.restoreAllMocks();
});

describe("service : garde commune", () => {
  it("sans session : refus, aucune lecture ni écriture", async () => {
    await semer("a", [plage("p1")]);
    const lecture = vi.spyOn(depots().elements, "obtenir");
    const ecrit = vi.spyOn(depots().elements, "enregistrer");
    await expect(svc.garderQuandMemeExtrait("a", "p1", sansSession)).rejects.toThrow("pas de session");
    await expect(svc.changerSujetExtrait("a", "p1", "suivi-commercial", sansSession)).rejects.toThrow();
    await expect(svc.marquerChiffresReelsVideo("a", true, sansSession)).rejects.toThrow();
    expect(lecture).not.toHaveBeenCalled();
    expect(ecrit).not.toHaveBeenCalled();
    expect(await journal()).toHaveLength(0);
  });
  it("vidéo sans fiche et plage absente : refus polis, rien écrit", async () => {
    const ecrit = vi.spyOn(depots().elements, "enregistrer");
    const sans = { ok: false, message: "Cette vidéo n'a pas d'extraits archivés." };
    expect(await svc.garderQuandMemeExtrait("zz", "p1", ports())).toEqual(sans);
    expect(await svc.changerSujetExtrait("zz", "p1", "suivi-commercial", ports())).toEqual(sans);
    expect(await svc.marquerChiffresReelsVideo("zz", true, ports())).toEqual(sans);
    await semer("a", [plage("p1")]);
    ecrit.mockClear();
    const absente = { ok: false, message: "Cet extrait n'existe plus." };
    expect(await svc.garderQuandMemeExtrait("a", "nope", ports())).toEqual(absente);
    expect(await svc.changerSujetExtrait("a", "nope", "suivi-commercial", ports())).toEqual(absente);
    expect(ecrit).not.toHaveBeenCalled();
  });
});

describe("garderQuandMemeExtrait", () => {
  it("plage à vérifier notée 45 : utilisable, validée, raison retirée, journal", async () => {
    await semer("a", [plage("p1", { note: 45, raisonExclusion: "sous-le-seuil" })]);
    expect(await svc.garderQuandMemeExtrait("a", "p1", ports())).toEqual({ ok: true });
    const p = (await lire("a")).plages[0];
    expect(p).toMatchObject({ etat: "utilisable", valideeLe: T0, note: 45 });
    expect(p.raisonExclusion).toBeUndefined();
    expect(await journal()).toEqual(["Extrait gardé quand même"]);
    const el = await depots().elements.obtenir(idElementArchive("a"));
    expect(el?.modifieLe).toBe(T0);
  });
  it("survit à un recalcul (ficheAvecTri puis reporterGestes)", async () => {
    await semer("a", [plage("p1", { note: 45 })]);
    await svc.garderQuandMemeExtrait("a", "p1", ports());
    const fiche = await lire("a");
    const bas: Moment & NoteMoment = {
      id: "p1", origine: "ecran-demo", debutSec: 1, finSec: 8, montre: "interface", texte: "Texte p1", avecVisage: false, texteIncruste: false,
      note: 30, raisons: [], sujet: null, usages: [], decision: "peut-etre",
    };
    const tri: ResultatTri = { gardes: [], peutEtre: [bas], ignores: { nombre: 0, raisonPrincipale: null }, rienARetenir: false };
    const apres = ficheAvecTri(fiche, tri, SEUILS_PAR_DEFAUT);
    expect(apres.plages.find((p) => p.id === "p1")).toMatchObject({ etat: "utilisable", valideeLe: T0 });
    const reporte = reporterGestes(fiche.plages, [plage("p1", { etat: "a_verifier", raisonExclusion: "x" })]);
    expect(reporte[0]).toMatchObject({ etat: "utilisable", valideeLe: T0 });
  });
  it("plage exclue : refus du pur, rien écrit ; plage écartée : refus", async () => {
    await semer("a", [plage("e", { etat: "exclue", raisonExclusion: "visage" }), plage("x", { etat: "ecartee", ecarteeLe: "2026-11-01" })]);
    const ecrit = vi.spyOn(depots().elements, "enregistrer");
    expect(await svc.garderQuandMemeExtrait("a", "e", ports())).toEqual({ ok: false, message: "Cet extrait ne peut pas être gardé." });
    expect(await svc.garderQuandMemeExtrait("a", "x", ports())).toEqual({ ok: false, message: "Rétablissez d'abord cet extrait." });
    expect(ecrit).not.toHaveBeenCalled();
    expect(await journal()).toHaveLength(0);
  });
});

describe("changerSujetExtrait", () => {
  it("sujet inconnu refusé ; sujet connu posé avec sujetCorrigeLe", async () => {
    await semer("a", [plage("p1")]);
    expect(await svc.changerSujetExtrait("a", "p1", "inconnu", ports())).toEqual({ ok: false, message: "Ce sujet n'existe pas." });
    expect((await lire("a")).plages[0].sujet).toBeUndefined();
    expect(await journal()).toHaveLength(0);
    expect(await svc.changerSujetExtrait("a", "p1", "appels-offres", ports())).toEqual({ ok: true });
    expect((await lire("a")).plages[0]).toMatchObject({ sujet: "appels-offres", sujetCorrigeLe: T0 });
    expect(await journal()).toEqual(["Sujet d'un extrait corrigé"]);
  });
});

describe("marquerChiffresReelsVideo", () => {
  const avecChiffre = (id: string, usages?: string[]) => plage(id, { raisonsNote: [{ code: "chiffre", points: 10 }], usages });
  it("oui : preuve chiffrée sur les seules plages chiffre, sans doublon ; non : retirée", async () => {
    await semer("a", [avecChiffre("c1"), avecChiffre("c2", ["preuve-chiffree"]), plage("n1")]);
    expect(await svc.marquerChiffresReelsVideo("a", true, ports())).toEqual({ ok: true });
    let f = await lire("a");
    expect(f.chiffresReels).toBe(true);
    expect(f.plages[0].usages).toEqual(["preuve-chiffree"]);
    expect(f.plages[1].usages).toEqual(["preuve-chiffree"]);
    expect(f.plages[2].usages).toBeUndefined();
    expect(await svc.marquerChiffresReelsVideo("a", false, ports())).toEqual({ ok: true });
    f = await lire("a");
    expect(f.chiffresReels).toBe(false);
    expect(f.plages[0].usages).toEqual([]);
    expect(f.plages).toHaveLength(3);
    expect(await journal()).toEqual(["Chiffres réels cochés", "Chiffres réels décochés"]);
  });
});

import * as actions from "@/app/(studio)/bibliotheque/source-extraits/actions";

describe("actions (service simulé)", () => {
  type Cas = { nom: string; appeler: (...a: unknown[]) => Promise<{ ok: boolean }>; valides: unknown[]; invalides: unknown[][] };
  const cas: Cas[] = [
    { nom: "garderQuandMemeAction", appeler: actions.garderQuandMemeAction as Cas["appeler"], valides: ["v1", "p1"], invalides: [["", "p1"], ["v1", " "], [1, "p1"], ["v1", undefined]] },
    { nom: "changerSujetAction", appeler: actions.changerSujetAction as Cas["appeler"], valides: ["v1", "p1", "appels-offres"], invalides: [["", "p1", "s"], ["v1", "", "s"], ["v1", "p1", ""], ["v1", "p1", 3]] },
    { nom: "marquerChiffresReelsAction", appeler: actions.marquerChiffresReelsAction as Cas["appeler"], valides: ["v1", true], invalides: [["", true], ["v1", "oui"], ["v1", undefined]] },
  ];
  const gestes: Record<string, ReturnType<typeof vi.fn>> = {
    garderQuandMemeAction: m.garder, changerSujetAction: m.sujet, marquerChiffresReelsAction: m.chiffres,
  };
  beforeEach(() => {
    vi.clearAllMocks();
    m.exigerSession.mockResolvedValue(undefined);
    for (const g of Object.values(gestes)) g.mockResolvedValue({ ok: true });
    m.simule.actif = true;
  });
  afterEach(() => {
    m.simule.actif = false;
  });
  describe.each(cas)("$nom", (c) => {
    const geste = () => gestes[c.nom];
    it("sans session : refus, geste non appelé", async () => {
      m.exigerSession.mockRejectedValue(new Error("pas de session"));
      await expect(c.appeler(...c.valides)).rejects.toThrow("pas de session");
      expect(geste()).not.toHaveBeenCalled();
      expect(m.revalidatePath).not.toHaveBeenCalled();
    });
    it("argument vide ou mauvais type : refus en français, geste non appelé", async () => {
      for (const args of c.invalides) {
        const r = await c.appeler(...args);
        expect(r.ok).toBe(false);
        expect((r as unknown as { message: string }).message).toMatch(/[a-zé]{4,}/i);
      }
      expect(geste()).not.toHaveBeenCalled();
      expect(m.revalidatePath).not.toHaveBeenCalled();
    });
    it("refus du service renvoyé tel quel, sans revalidatePath", async () => {
      const refus = { ok: false, message: "Refus du service." };
      geste().mockResolvedValue(refus);
      expect(await c.appeler(...c.valides)).toEqual(refus);
      expect(m.revalidatePath).not.toHaveBeenCalled();
    });
    it("succès : un seul revalidatePath", async () => {
      expect(await c.appeler(...c.valides)).toEqual({ ok: true });
      expect(geste()).toHaveBeenCalledTimes(1);
      expect(m.revalidatePath).toHaveBeenCalledTimes(1);
      expect(m.revalidatePath).toHaveBeenCalledWith("/bibliotheque/source-extraits");
    });
  });
});
