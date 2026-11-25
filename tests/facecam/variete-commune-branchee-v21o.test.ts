/**
 * BR-VARIETE-FACECAM-v21o — le service `memoireCartes` RÉELLEMENT branché passe par la mémoire commune (réglage
 * `varieteCommune`), sans changer la mémoire propre de la face caméra quand c'est éteint ; GV-FIN-01 : une lecture en
 * panne remonte.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const versionsSimulees: Record<string, unknown>[] = [];
const videosSimulees: Record<string, unknown>[] = [];
const reglages: Record<string, unknown> = {};
let versionsEnPanne = false;
let videosEnPanne = false;
let voisinesEnPanne = false;
const voisinesRendues: { videoId: string; formatId: string; le: string; axes: { objets: string[]; ouverture?: string[] } }[] = [];
const demandesVoisines: { reseau: string; videoIdEnCours?: string }[] = [];

vi.mock("@/services/_commun", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  lireParametre: async (cle: string, defaut: unknown) => (cle in reglages ? reglages[cle] : defaut),
  depots: () => ({
    versions: {
      lister: async (filtre: (v: never) => boolean) => {
        if (versionsEnPanne) throw new Error("base illisible");
        return versionsSimulees.filter((v) => filtre(v as never));
      },
    },
    videos: {
      obtenir: async (id: string) => {
        if (videosEnPanne) throw new Error("vidéos illisibles");
        return videosSimulees.find((v) => v.id === id) ?? null;
      },
    },
  }),
}));
vi.mock("@/services/variete-commune/voisines", () => ({
  // Double fidèle : la vraie lecture exclut la vidéo en cours (`videoIdEnCours`).
  voisinesDuReseau: async (d: { reseau: string; videoIdEnCours?: string }) => {
    demandesVoisines.push(d);
    if (voisinesEnPanne) throw new Error("voisines illisibles");
    return voisinesRendues.filter((e) => e.videoId !== d.videoIdEnCours).map((e) => ({ version: "1", ...e }));
  },
}));

import type { CommandeFabrication } from "@/domaine/types";
import { servicesFacecam } from "@/moteurs/montage-facecam/dependances";
import { memoireCartesFacecam } from "@/services/facecam-branchements";

const commande = (videoId: string) => ({ videoId }) as unknown as CommandeFabrication;
const appeler = (videoId = "en-cours") => servicesFacecam().memoireCartes!(commande(videoId));

function version(videoId: string, creeLe: string, modeles: string[]) {
  return {
    id: `ver-${videoId}`,
    videoId,
    creeLe,
    statut: "prete",
    commande: { moteurId: "montage-facecam" },
    projetMontage: { cartesAuto: modeles.map((modele, i) => ({ modele, etat: "posee", debutSec: i })) },
  };
}

describe("face caméra : mémoire des cartes commune (BR-VARIETE-FACECAM-v21o)", () => {
  beforeEach(() => {
    versionsSimulees.length = 0;
    videosSimulees.length = 0;
    voisinesRendues.length = 0;
    demandesVoisines.length = 0;
    for (const k of Object.keys(reglages)) delete reglages[k];
    versionsEnPanne = videosEnPanne = voisinesEnPanne = false;
    versionsSimulees.push(version("v1", "2026-01-01", ["m1", "m2"]));
    videosSimulees.push({ id: "en-cours", reseau: "linkedin" });
    voisinesRendues.push({ videoId: "av1", formatId: "avocat", le: "2026-11-02", axes: { objets: ["autre:cartes:chiffre", "autre:cartes:liste"] } });
  });

  it.each([["false", false], ['"true"', "true"], ["{}", {}], ["1", 1]])("a) réglage %s → égal à memoireCartesFacecam", async (_n, v) => {
    reglages.varieteCommune = v;
    expect(await appeler()).toEqual(await memoireCartesFacecam("en-cours"));
  });

  it("b) allumé : la carte d'une voisine LinkedIn entre dans dejaServis, dont l'ouverture", async () => {
    reglages.varieteCommune = true;
    const propre = await memoireCartesFacecam("en-cours");
    expect(propre.dejaServis).toEqual(["m1", "m2"]);
    const r = await appeler();
    expect(r.dejaServis).toEqual(expect.arrayContaining(["m1", "m2", "chiffre", "liste"]));
    expect(r.ouverturePrecedente).toBeDefined();
    expect(r).not.toEqual(propre);
  });

  it("b1) allumé, voisine avec ouverture X et objets X, Y, mémoire propre SANS ouverture : ouverturePrecedente = X (la carte qui a ouvert la voisine)", async () => {
    reglages.varieteCommune = true;
    versionsSimulees.length = 0;
    voisinesRendues.length = 0;
    voisinesRendues.push({ videoId: "av1", formatId: "avocat", le: "2026-11-02", axes: { ouverture: ["autre:cartes:X"], objets: ["autre:cartes:X", "autre:cartes:Y"] } });
    expect(await memoireCartesFacecam("en-cours")).toEqual({ dejaServis: [] });
    expect(await appeler()).toEqual({ dejaServis: ["X", "Y"], ouverturePrecedente: "X" });
    expect(demandesVoisines.map((d) => d.reseau)).toEqual(["linkedin"]);
  });

  it("b2) même voisine, mémoire propre avec ouverture m1 : ouverturePrecedente reste m1 (limite connue : une voisine plus récente ne la remplace pas, faute de ouvertureDuJourLe)", async () => {
    reglages.varieteCommune = true;
    voisinesRendues.length = 0;
    voisinesRendues.push({ videoId: "av1", formatId: "avocat", le: "2026-11-02", axes: { ouverture: ["autre:cartes:X"], objets: ["autre:cartes:X", "autre:cartes:Y"] } });
    const r = await appeler();
    expect(r.ouverturePrecedente).toBe("m1");
    expect(r.dejaServis).toEqual(expect.arrayContaining(["m1", "m2", "X", "Y"]));
  });

  it("b3) la vidéo en cours est transmise (videoIdEnCours) et sa propre empreinte n'est pas comptée parmi ses voisines", async () => {
    reglages.varieteCommune = true;
    voisinesRendues.length = 0;
    voisinesRendues.push({ videoId: "en-cours", formatId: "facecam", le: "2026-11-03", axes: { ouverture: ["autre:cartes:Z"], objets: ["autre:cartes:Z"] } });
    const r = await appeler();
    expect(demandesVoisines).toEqual([expect.objectContaining({ reseau: "linkedin", videoIdEnCours: "en-cours" })]);
    expect(r.dejaServis).not.toContain("Z");
    expect(r).toEqual(await memoireCartesFacecam("en-cours"));
  });

  it("c) allumé, vidéo sans réseau ou absente des dépôts → identique à la mémoire propre", async () => {
    reglages.varieteCommune = true;
    videosSimulees.length = 0;
    expect(await appeler()).toEqual(await memoireCartesFacecam("en-cours"));
    videosSimulees.push({ id: "en-cours" });
    expect(await appeler()).toEqual(await memoireCartesFacecam("en-cours"));
  });

  it("c bis) lecture de la vidéo en panne → mémoire propre, jamais bloquant", async () => {
    reglages.varieteCommune = true;
    videosEnPanne = true;
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await appeler()).toEqual(await memoireCartesFacecam("en-cours"));
  });

  it("d) allumé, lecture des voisines qui lève → mémoire d'entrée", async () => {
    reglages.varieteCommune = true;
    voisinesEnPanne = true;
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await appeler()).toEqual(await memoireCartesFacecam("en-cours"));
  });

  it("e) GV-FIN-01 : lecture des versions en panne → le service branché REJETTE, même allumé", async () => {
    reglages.varieteCommune = true;
    versionsEnPanne = true;
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(appeler()).rejects.toThrow("base illisible");
  });
});
