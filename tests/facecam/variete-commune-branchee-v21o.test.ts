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
const voisinesRendues: { videoId: string; formatId: string; le: string; axes: { objets: string[] } }[] = [];

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
  voisinesDuReseau: async () => {
    if (voisinesEnPanne) throw new Error("voisines illisibles");
    return voisinesRendues.map((e) => ({ version: "1", ...e }));
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
