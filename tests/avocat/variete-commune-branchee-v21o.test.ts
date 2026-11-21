/**
 * BR-VARIETE-AVOCAT-v21o (X2-13) : la mémoire des cartes de l'avocat passe aussi par la variété commune (voisines du même
 * réseau, tous générateurs). Chemin réel `entreesAvocatDuLancement` + dépôts simulés ; aucun appel réel.
 * ÉTEINT : `varieteCommune` à `false` (ou valeur étrangère) = sortie identique à celle d'avant.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { depots, reinitialiserDepots } from "@/donnees/memoire";
import { entreesAvocatDuLancement } from "@/services/avocat-branchements";
import { ENTREE_MOTION_AVOCAT, PARAM_MOTION_AVOCAT } from "@/moteurs/montage-avocat/motion";

const CLE = "varieteCommune";
const ligne = (extra: Record<string, unknown> = {}) => ({ id: "EN_COURS", entrees: {}, ...extra }) as never;

async function regler(id: string, valeur: unknown) {
  await depots().parametres.enregistrer({ id, valeur, creeLe: "x", modifieLe: "x" } as never);
}

/** Une vidéo d'un AUTRE générateur (face caméra), publiée sur LinkedIn, dont la carte d'ouverture est « frise ». */
async function voisineLinkedin(videoId = "AUTRE", modele = "frise") {
  await depots().publications.enregistrer({
    id: `p-${videoId}`, videoId, reseau: "linkedin", statut: "publiee", via: "zernio", date: "2026-11-10T10:00:00Z", texte: "t", creeLe: "x", modifieLe: "x",
  } as never);
  await depots().versions.enregistrer({
    id: `v-${videoId}`, videoId, numero: 1, commande: { formatId: "facecam", moteurId: "montage-facecam" }, statut: "prete", choisie: true,
    creeLe: "2026-11-09T10:00:00Z", modifieLe: "2026-11-09T10:00:00Z",
    projetMontage: { moteur: "montage-facecam", motionCommune: { cartes: [{ ratio: "9:16", debutSec: 1, modele, statut: "posee" }] } },
  } as never);
}

beforeEach(() => {
  reinitialiserDepots();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("BR-VARIETE-AVOCAT-v21o · avocat × variété commune", () => {
  it("a) éteinte (false, \"true\", {}, 1) : sortie ÉGALE à celle d'avant, même avec une voisine LinkedIn publiée", async () => {
    await voisineLinkedin();
    const base = await entreesAvocatDuLancement(ligne());
    expect(base).toEqual({ [ENTREE_MOTION_AVOCAT]: { actif: true } });
    for (const v of [false, "true", {}, 1]) {
      reinitialiserDepots();
      await voisineLinkedin();
      await regler(CLE, v);
      expect(await entreesAvocatDuLancement(ligne({ reseau: "linkedin" })), `valeur ${JSON.stringify(v)}`).toEqual(base);
    }
  });

  it("b) allumée, vidéo LinkedIn : la carte d'une voisine d'un autre générateur est évitée et devient l'ouverture précédente", async () => {
    await voisineLinkedin("AUTRE", "frise");
    await regler(CLE, true);
    const sortie = await entreesAvocatDuLancement(ligne({ reseau: "linkedin" }));
    expect(sortie[ENTREE_MOTION_AVOCAT]).toMatchObject({ actif: true, dejaServis: ["frise"], ouverturePrecedente: "frise" });
  });

  it("b bis) allumée, une autre voisine d'un autre réseau n'est pas comptée", async () => {
    await voisineLinkedin("AUTRE", "frise");
    await regler(CLE, true);
    expect(await entreesAvocatDuLancement(ligne({ reseau: "facebook" }))).toEqual({ [ENTREE_MOTION_AVOCAT]: { actif: true } });
  });

  it("c) motion avocat coupée + variété allumée : sortie vide, `varieteCommune` jamais lu", async () => {
    await voisineLinkedin();
    await regler(PARAM_MOTION_AVOCAT, false);
    await regler(CLE, true);
    const lus: string[] = [];
    const vrai = depots().parametres.obtenir.bind(depots().parametres);
    vi.spyOn(depots().parametres, "obtenir").mockImplementation((id: string) => (lus.push(id), vrai(id)));
    expect(await entreesAvocatDuLancement(ligne({ reseau: "linkedin" }))).toEqual({});
    expect(lus).not.toContain(CLE);
  });

  it("d) allumée, lecture des voisines en panne : mémoire d'entrée conservée, jamais bloquant", async () => {
    await regler(CLE, true);
    vi.spyOn(depots().publications, "lister").mockRejectedValue(new Error("panne"));
    expect(await entreesAvocatDuLancement(ligne({ reseau: "linkedin" }))).toEqual({ [ENTREE_MOTION_AVOCAT]: { actif: true } });
  });

  it("e) allumée, vidéo sans `reseau` : identique à éteinte, voisines non lues", async () => {
    await voisineLinkedin();
    await regler(CLE, true);
    const lister = vi.spyOn(depots().publications, "lister");
    expect(await entreesAvocatDuLancement(ligne())).toEqual({ [ENTREE_MOTION_AVOCAT]: { actif: true } });
    expect(lister).not.toHaveBeenCalled();
  });

  it("f) allumée, la vidéo en cours déjà publiée sur LinkedIn (aucune autre voisine) : exclue de ses propres voisines", async () => {
    await voisineLinkedin("EN_COURS", "frise");
    await regler(CLE, true);
    expect(await entreesAvocatDuLancement(ligne({ reseau: "linkedin" }))).toEqual({ [ENTREE_MOTION_AVOCAT]: { actif: true } });
  });

  it("la mémoire propre de l'avocat reste en tête (ses 5 dernières vidéos), les voisines s'y ajoutent", async () => {
    await depots().versions.enregistrer({
      id: "va", videoId: "AVOC", numero: 1, commande: {}, statut: "prete", choisie: false, creeLe: "2026-11-01T10:00:00Z", modifieLe: "2026-11-01T10:00:00Z",
      projetMontage: { moteur: "montage-avocat", motionCommune: { cartes: [{ ratio: "9:16", debutSec: 1, modele: "liste", statut: "posee" }] } },
    } as never);
    await voisineLinkedin("AUTRE", "frise");
    await regler(CLE, true);
    const sortie = await entreesAvocatDuLancement(ligne({ reseau: "linkedin" }));
    expect(sortie[ENTREE_MOTION_AVOCAT]).toMatchObject({ actif: true, dejaServis: ["liste", "frise"], ouverturePrecedente: "liste" });
  });
});
