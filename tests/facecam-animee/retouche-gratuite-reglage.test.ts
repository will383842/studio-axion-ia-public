/**
 * G12-09b-b · le réglage `retoucheChat.facecamAnimee` ouvre la retouche gratuite de la face caméra animée v4, relu avant chaque
 * chemin de retouche (crochet `preparerReglagesMoteur`). Éteint par défaut : seul `true` exact allume ; lecture qui lève = éteint.
 * Preuve par le chemin réel : `preparerReglagesMoteur` + `lireParametre` réel sur le dépôt `parametres` mémoire + vrai moteur.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => undefined) }));

import type { CommandeFabrication } from "@/domaine/types";
import { CLE_RETOUCHE_GRATUITE_FA, ID_MOTEUR_FACECAM_ANIMEE, moteurMontageFacecamAnimee } from "@/moteurs/montage-facecam-animee";
import { preparerReglagesMoteur } from "@/services/cas-concret-reglages";
import { ecrireParametre } from "@/services/_commun";
import { actualiserRetoucheGratuiteFA } from "@/services/facecam-animee-retouche";

const CLE = "retoucheChat.facecamAnimee";
const FA = { moteurId: ID_MOTEUR_FACECAM_ANIMEE } as Pick<CommandeFabrication, "moteurId">;
const AVEC_PRISE = { videoId: "v-1", formatId: "facecam-animee", moteurId: ID_MOTEUR_FACECAM_ANIMEE, ratios: ["9:16"], briques: {}, distribution: [], entrees: { facecamAnimee: { priseCle: "studio/dev/entree/facecam-animee/f-1.mov", fichierId: "f-1" } } } as unknown as CommandeFabrication;

const regler = (valeur: unknown) => ecrireParametre(CLE, valeur);

const refus = () => moteurMontageFacecamAnimee.refusRetouche?.(AVEC_PRISE) ?? null;
const poser = (v: unknown) => ((globalThis as Record<symbol, unknown>)[CLE_RETOUCHE_GRATUITE_FA] = v);

beforeEach(() => {
  poser(undefined);
});

describe("G12-09b-b · réglage retoucheChat.facecamAnimee", () => {
  it("(a) absent : retouche refusée comme aujourd'hui", async () => {
    await preparerReglagesMoteur(FA);
    expect(moteurMontageFacecamAnimee.capacites.retoucheParPlan).toBe(false);
    expect(refus()?.code).toBe("RETOUCHE_NON_PRISE_EN_CHARGE");
  });

  it.each([false, "true", 1])("(a) valeur %j : reste éteint", async (v) => {
    await regler(v);
    await preparerReglagesMoteur(FA);
    expect(moteurMontageFacecamAnimee.capacites.retoucheParPlan).toBe(false);
    expect(refus()).not.toBeNull();
  });

  it("(a) lecture qui lève : éteint, sans lever", async () => {
    poser(true);
    await actualiserRetoucheGratuiteFA(async () => {
      throw new Error("base indisponible");
    });
    expect(moteurMontageFacecamAnimee.capacites.retoucheParPlan).toBe(false);
  });

  it("(b) true : allume ; remis à false puis crochet : de nouveau refusé", async () => {
    await regler(true);
    await preparerReglagesMoteur(FA);
    expect(moteurMontageFacecamAnimee.capacites.retoucheParPlan).toBe(true);
    expect(refus()).toBeNull();
    await regler(false);
    await preparerReglagesMoteur(FA);
    expect(moteurMontageFacecamAnimee.capacites.retoucheParPlan).toBe(false);
    expect(refus()).not.toBeNull();
  });

  it("(c) commande d'un autre moteur : le réglage n'est pas relu", async () => {
    await regler(true);
    for (const moteurId of ["montage-cas-concret", "montage-facecam", "cas-concret", "facecam"]) {
      await preparerReglagesMoteur({ moteurId } as Pick<CommandeFabrication, "moteurId">);
    }
    expect(moteurMontageFacecamAnimee.capacites.retoucheParPlan).toBe(false);
  });
});
