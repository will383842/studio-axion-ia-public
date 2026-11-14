/**
 * GV-MD-05c — mémoire des cartes animées de l'avocat : lue au lancement et figée dans la commande.
 * Dépôts simulés (mémoire), aucun appel réel.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { depots, reinitialiserDepots } from "@/donnees/memoire";
import { memoireCartesAvocat, entreesAvocatDuLancement } from "@/services/avocat-branchements";
import { optionMotionAvocat, PARAM_MOTION_AVOCAT } from "@/moteurs/montage-avocat/motion";

type Carte = { ratio: string; debutSec: number; modele: string; statut: string };

async function version(id: string, videoId: string, creeLe: string, cartes: Carte[], opts: { moteur?: string; statut?: string } = {}) {
  await depots().versions.enregistrer({
    id,
    videoId,
    numero: 1,
    commande: {},
    statut: opts.statut ?? "prete",
    choisie: false,
    creeLe,
    modifieLe: creeLe,
    projetMontage: { moteur: opts.moteur ?? "montage-avocat", motionCommune: { cartes } },
  } as never);
}

const c = (ratio: string, debutSec: number, modele: string, statut = "posee"): Carte => ({ ratio, debutSec, modele, statut });

beforeEach(() => {
  reinitialiserDepots();
});
afterEach(() => vi.restoreAllMocks());

describe("memoireCartesAvocat", () => {
  it("trois vidéos : la plus récente d'abord, échec ignoré, ratios doublés comptés une fois, vidéo en cours exclue", async () => {
    await version("v1", "A", "2026-01-01T10:00:00Z", [c("9:16", 5, "liste"), c("9:16", 1, "chiffre"), c("16:9", 2, "graphique")]);
    await version("v2", "B", "2026-01-02T10:00:00Z", [c("9:16", 3, "citation"), c("9:16", 1, "ratage", "echec")]);
    await version("v3", "C", "2026-01-03T10:00:00Z", [c("9:16", 4, "frise"), c("9:16", 2, "chiffre")]);
    await version("v4", "EN_COURS", "2026-01-04T10:00:00Z", [c("9:16", 1, "exclu")]);
    const m = await memoireCartesAvocat("EN_COURS");
    expect(m.dejaServis).toEqual(["chiffre", "frise", "citation", "chiffre", "liste"]);
    expect(m.ouverturePrecedente).toBe("chiffre");
  });

  it("ignore les autres moteurs et les versions non prêtes ; une seule version par vidéo (la plus récente)", async () => {
    await version("v1", "A", "2026-01-01T10:00:00Z", [c("9:16", 1, "ancien")]);
    await version("v2", "A", "2026-01-02T10:00:00Z", [c("9:16", 1, "recent")]);
    await version("v3", "B", "2026-01-03T10:00:00Z", [c("9:16", 1, "facecam")], { moteur: "montage-facecam" });
    await version("v4", "C", "2026-01-04T10:00:00Z", [c("9:16", 1, "encours")], { statut: "en_cours" });
    expect(await memoireCartesAvocat()).toEqual({ dejaServis: ["recent"], ouverturePrecedente: "recent" });
  });

  it("5 vidéos au plus", async () => {
    for (let i = 1; i <= 7; i++) await version(`v${i}`, `V${i}`, `2026-01-0${i}T10:00:00Z`, [c("9:16", 1, `m${i}`)]);
    expect((await memoireCartesAvocat()).dejaServis).toEqual(["m7", "m6", "m5", "m4", "m3"]);
  });

  it("rien d'utile : liste vide, sans ouverture", async () => {
    expect(await memoireCartesAvocat()).toEqual({ dejaServis: [] });
  });

  it("une lecture qui échoue donne une liste vide et un avertissement", async () => {
    vi.spyOn(depots().versions, "lister").mockRejectedValue(new Error("panne"));
    const avert = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await memoireCartesAvocat()).toEqual({ dejaServis: [] });
    expect(avert).toHaveBeenCalled();
  });
});

describe("entreesAvocatDuLancement", () => {
  const ligne = { entrees: {} } as never;

  const regler = (valeur: unknown) => depots().parametres.enregistrer({ id: PARAM_MOTION_AVOCAT, valeur, creeLe: "x", modifieLe: "x" } as never);

  it("sans réglage : allumée par défaut (GV2-51), avec la mémoire quand elle existe", async () => {
    expect(await entreesAvocatDuLancement(ligne)).toEqual({ avocatMotionCommune: { actif: true } });
    await version("v1", "A", "2026-01-01T10:00:00Z", [c("9:16", 1, "liste")]);
    expect(await entreesAvocatDuLancement(ligne)).toEqual({ avocatMotionCommune: { actif: true, dejaServis: ["liste"], ouverturePrecedente: "liste" } });
  });

  it("coupe-circuit : réglage `false` → sortie vide, aucune lecture des versions", async () => {
    await regler(false);
    const lire = vi.spyOn(depots().versions, "lister");
    expect(await entreesAvocatDuLancement(ligne)).toEqual({});
    expect(lire).not.toHaveBeenCalled();
  });

  it("coupe-circuit : réglage `{ actif: false }` → sortie vide", async () => {
    await regler({ actif: false });
    expect(await entreesAvocatDuLancement(ligne)).toEqual({});
  });

  it("valeur étrange → allumée ; l'habitude est gardée", async () => {
    await regler("n'importe quoi");
    expect(await entreesAvocatDuLancement(ligne)).toEqual({ avocatMotionCommune: { actif: true } });
    await regler({ habitude: ["sobre"] });
    expect(await entreesAvocatDuLancement(ligne)).toEqual({ avocatMotionCommune: { actif: true, habitude: ["sobre"] } });
  });

  it("lecture du réglage en panne → allumée, mémoire vide", async () => {
    const vrai = depots().parametres.obtenir.bind(depots().parametres);
    vi.spyOn(depots().parametres, "obtenir").mockImplementation((id: string) => (id === PARAM_MOTION_AVOCAT ? Promise.reject(new Error("panne")) : vrai(id)));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await entreesAvocatDuLancement(ligne)).toEqual({ avocatMotionCommune: { actif: true } });
  });

  it("réglage allumé sans historique : comme avant (actif seul)", async () => {
    await depots().parametres.enregistrer({ id: PARAM_MOTION_AVOCAT, valeur: { actif: true }, creeLe: "x", modifieLe: "x" } as never);
    expect(await entreesAvocatDuLancement(ligne)).toEqual({ avocatMotionCommune: { actif: true } });
  });

  it("réglage allumé : la mémoire est figée, relue telle quelle par optionMotionAvocat, vidéo en cours exclue", async () => {
    await depots().parametres.enregistrer({ id: PARAM_MOTION_AVOCAT, valeur: { actif: true }, creeLe: "x", modifieLe: "x" } as never);
    await version("v1", "A", "2026-01-01T10:00:00Z", [c("9:16", 1, "liste"), c("9:16", 4, "chiffre")]);
    await version("v2", "ENCOURS", "2026-01-02T10:00:00Z", [c("9:16", 1, "exclu")]);
    const sortie = await entreesAvocatDuLancement({ id: "ENCOURS", entrees: {} } as never);
    expect(sortie.avocatMotionCommune).toMatchObject({ actif: true, dejaServis: ["liste", "chiffre"], ouverturePrecedente: "liste" });
    expect(optionMotionAvocat({ entrees: sortie })).toMatchObject({ actif: true, dejaServis: ["liste", "chiffre"], ouverturePrecedente: "liste" });
  });
});
