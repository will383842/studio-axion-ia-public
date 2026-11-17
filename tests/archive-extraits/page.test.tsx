/** C3-UT-3.10b-d : page « Extraits de vos vidéos » et son lien client avec les 5 actions. Services doublés, aucun réseau. */
import { existsSync, readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FicheSourceExtraits, PlageExtrait } from "@/domaine/archive-extraits";

const ordre: string[] = [];
let reglages: Record<string, unknown> = {};
let elements: unknown[] = [];
const exigerSession = vi.fn(async () => {
  ordre.push("session");
  return {};
});
const lireParametre = vi.fn(async (cle: string, defaut: unknown) => {
  ordre.push("lecture");
  return cle in reglages ? reglages[cle] : defaut;
});
const listerElements = vi.fn(async () => {
  ordre.push("lecture");
  return elements;
});
const resultat = { ok: true } as { ok: boolean; message?: string };
const ecarterPlageAction = vi.fn(async (_v: string, _p: string) => resultat);
const retablirPlageAction = vi.fn(async (_v: string, _p: string) => resultat);
const validerPlageAction = vi.fn(async (_v: string, _p: string) => resultat);
const rangerSourceAction = vi.fn(async (_v: string, _r: boolean) => resultat);
const cocherVideoAction = vi.fn(async (_v: string, _c: boolean) => resultat);

vi.mock("@/services/auth", () => ({ exigerSession: () => exigerSession() }));
vi.mock("@/services/_commun", () => ({
  lireParametre: (c: string, d: unknown) => lireParametre(c, d),
  depots: () => ({ videos: { lister: async () => [{ id: "v1", titre: "Ma vidéo" }, { id: "v2", titre: "Autre" }] } }),
}));
vi.mock("@/services/bibliotheque", () => ({ listerElements: () => listerElements() }));
vi.mock("@/app/(studio)/bibliotheque/source-extraits/actions", () => ({
  ecarterPlageAction: (v: string, p: string) => ecarterPlageAction(v, p),
  retablirPlageAction: (v: string, p: string) => retablirPlageAction(v, p),
  validerPlageAction: (v: string, p: string) => validerPlageAction(v, p),
  rangerSourceAction: (v: string, r: boolean) => rangerSourceAction(v, r),
  cocherVideoAction: (v: string, c: boolean) => cocherVideoAction(v, c),
}));

// Pas de jsdom : le clic est rejoué en appelant les rappels reçus par l'écran, et l'état est doublé.
let proprietes: Record<string, (...a: unknown[]) => void> = {};
let refusInitial: string | null = null;
const poserRefus = vi.fn();
vi.mock("@/components/bibliotheque/EcranSourcesExtraits", () => ({
  EcranSourcesExtraits: (p: Record<string, (...a: unknown[]) => void>) => {
    proprietes = p;
    return null;
  },
}));
vi.mock("react", async (importer) => {
  const vrai = await importer<typeof import("react")>();
  return {
    ...vrai,
    useTransition: () => [false, (f: () => unknown) => void f()],
    useState: (i: unknown) => (i === null ? [refusInitial, poserRefus] : vrai.useState(i)),
  };
});

const { default: Page, dynamic, metadata } = await import("../../src/app/(studio)/bibliotheque/source-extraits/page");
const { EcranSourcesExtraitsBranche } = await import("@/components/bibliotheque/EcranSourcesExtraitsBranche");

const plage = (id: string): PlageExtrait => ({ id, debutSec: 0, finSec: 12, texte: `Texte ${id}`, motsCles: [], avecVisage: false, texteIncruste: false, etat: "utilisable" });
const fiche: FicheSourceExtraits = {
  videoId: "v1", versionId: "ver1", sortieId: "s1", ratio: "9:16", licence: {} as FicheSourceExtraits["licence"],
  famille: [], plages: [plage("a"), plage("b"), plage("c")], rangee: false, sourcePreferee: false,
};
const element = { type: "source-extraits", valeur: { type: "source-extraits", fiche } };
const attendre = () => new Promise((r) => setTimeout(r, 0));

async function ecran(): Promise<Record<string, unknown>> {
  proprietes = {};
  renderToStaticMarkup(await Page());
  return proprietes;
}

beforeEach(() => {
  ordre.length = 0;
  reglages = {};
  elements = [];
  refusInitial = null;
  resultat.ok = true;
  delete resultat.message;
  vi.clearAllMocks();
});

describe("route statique", () => {
  it("le fichier existe, force-dynamic, titre en français", () => {
    expect(existsSync("src/app/(studio)/bibliotheque/source-extraits/page.tsx")).toBe(true);
    expect(dynamic).toBe("force-dynamic");
    expect(metadata.title).toBe("Extraits de vos vidéos");
  });
  it("aucun lien écrit en dur vers la page ailleurs que la page elle-même (aucune tuile)", () => {
    expect(readFileSync("src/domaine/libelles.ts", "utf8")).not.toContain("source-extraits");
  });
});

describe("page", () => {
  it("la session est exigée avant toute lecture", async () => {
    await ecran();
    expect(ordre[0]).toBe("session");
    expect(ordre.length).toBeGreaterThan(1);
  });
  it("réglage absent : l'écran reçoit « éteint » et aucune écriture n'a lieu", async () => {
    elements = [element];
    const p = await ecran();
    expect(p.inscriptionActive).toBe(false);
    expect(p.politique).toBe("publiees");
  });
  it("seul `true` exact allume", async () => {
    reglages = { "bibliothequeVideo.archive.inscription": "true" };
    expect((await ecran()).inscriptionActive).toBe(false);
    reglages = { "bibliothequeVideo.archive.inscription": true };
    expect((await ecran()).inscriptionActive).toBe(true);
  });
  it("1 fiche de 3 plages et son titre transmis ; vidéo sans fiche absente des titres", async () => {
    reglages = { "bibliothequeVideo.archive.inscription": true };
    elements = [element];
    const p = await ecran();
    expect((p.fiches as FicheSourceExtraits[])[0].plages).toHaveLength(3);
    expect(p.titres).toEqual({ v1: "Ma vidéo" });
  });
  it("politique inconnue ou « notees » traitée comme « publiees » ; « cochees » gardée ; cochées filtrées", async () => {
    for (const v of ["notees", 3, null]) {
      reglages = { "bibliothequeVideo.archive.sources": v };
      expect((await ecran()).politique).toBe("publiees");
    }
    reglages = { "bibliothequeVideo.archive.sources": "cochees", "bibliothequeVideo.archive.cochees": ["v1", 4] };
    const p = await ecran();
    expect(p.politique).toBe("cochees");
    expect(p.cochees).toEqual(["v1"]);
  });
});

describe("branche client", () => {
  const monter = (cochees: string[] = []) => {
    renderToStaticMarkup(
      createElement(EcranSourcesExtraitsBranche, { fiches: [fiche], titres: { v1: "Ma vidéo" }, inscriptionActive: true, politique: "cochees", cochees }),
    );
  };
  it("Écarter, Rétablir, Valider, Ranger appellent la bonne action une fois", async () => {
    monter();
    proprietes.surEcarter("v1", "a");
    proprietes.surRetablir("v1", "b");
    proprietes.surValider("v1", "c");
    proprietes.surRanger("v1");
    await attendre();
    expect(ecarterPlageAction).toHaveBeenCalledExactlyOnceWith("v1", "a");
    expect(retablirPlageAction).toHaveBeenCalledExactlyOnceWith("v1", "b");
    expect(validerPlageAction).toHaveBeenCalledExactlyOnceWith("v1", "c");
    expect(rangerSourceAction).toHaveBeenCalledExactlyOnceWith("v1", true);
  });
  it("Cocher : vidéo non cochée → true ; déjà cochée → false", async () => {
    monter();
    proprietes.surCocher("v1");
    await attendre();
    expect(cocherVideoAction).toHaveBeenLastCalledWith("v1", true);
    monter(["v1"]);
    proprietes.surCocher("v1");
    await attendre();
    expect(cocherVideoAction).toHaveBeenLastCalledWith("v1", false);
  });
  it("refus du service : le message est gardé tel quel ; succès : effacé", async () => {
    monter();
    resultat.ok = false;
    resultat.message = "Cette vidéo n'a pas d'extraits archivés.";
    proprietes.surEcarter("v1", "a");
    await attendre();
    expect(poserRefus).toHaveBeenLastCalledWith("Cette vidéo n'a pas d'extraits archivés.");
    resultat.ok = true;
    proprietes.surEcarter("v1", "a");
    await attendre();
    expect(poserRefus).toHaveBeenLastCalledWith(null);
  });
  it("le message de refus est affiché dans un <p role=\"status\">", () => {
    refusInitial = "Demande incomplète.";
    const h = renderToStaticMarkup(
      createElement(EcranSourcesExtraitsBranche, { fiches: [], titres: {}, inscriptionActive: true, politique: "publiees", cochees: [] }),
    );
    expect(h).toContain("Demande incomplète.");
    expect(h).toMatch(/<p role="status"[^>]*>Demande incomplète\.<\/p>/);
  });
});
