/**
 * Reprise d'un travail lancé par le lanceur : son état n'a pas de numéro de version, or les contrôles posent les liens
 * suivis (« 0042-IV-YS ») avec lui. La reprise le relit dans la version du travail ; rien d'autre ne change.
 */
import { describe, expect, it, vi } from "vitest";
import type { CommandeFabrication } from "@/domaine/types";
import { etatInitialIV, type EtatFabricationIV } from "@/moteurs/montage-image-video/fabrication";
import { creerMoteurMontageImageVideo, travailVitrineIV } from "@/moteurs/montage-image-video";
import { carteFixe, demandeEssai } from "./doubles-fabrication";

vi.setConfig({ testTimeout: 60_000 });

const commande = { moteurId: "montage-image-video", formatId: "image-video", videoId: "v-essai", entrees: {} } as unknown as CommandeFabrication;

function travailRefuse(numeroVersion?: number) {
  const e: EtatFabricationIV = etatInitialIV(demandeEssai(carteFixe("C")));
  delete e.demande.numeroVersion;
  if (numeroVersion !== undefined) e.demande.numeroVersion = numeroVersion;
  e.refus = { etape: "controles", code: "IV_CONTROLES", message: "Panne.", reessayable: true } as EtatFabricationIV["refus"];
  e.etape = "refusee";
  return { ...travailVitrineIV({ travailId: "t", versionId: "ver-x", titre: "Essai" }, commande, e), statut: "echec" as const };
}

const numeroDe = (t: { parametres?: Record<string, unknown> }) => (t.parametres?.imageVideo as EtatFabricationIV).demande.numeroVersion;

describe("reprise : numéro de version relu dans la version du travail", () => {
  it("état sans numéro de version → la reprise le pose (lien suivi possible aux contrôles)", async () => {
    const moteur = creerMoteurMontageImageVideo({ numeroVersion: async (v) => (v === "ver-x" ? 7 : undefined) });
    const repris = await moteur.reessayer(travailRefuse());
    expect(numeroDe(repris)).toBe(7);
  });

  it("numéro déjà dans l'état → inchangé", async () => {
    const moteur = creerMoteurMontageImageVideo({ numeroVersion: async () => 7 });
    const repris = await moteur.reessayer(travailRefuse(3));
    expect(numeroDe(repris)).toBe(3);
  });

  it("version sans numéro → l'état reste sans numéro (les contrôles le diront)", async () => {
    const moteur = creerMoteurMontageImageVideo({ numeroVersion: async () => undefined });
    const repris = await moteur.reessayer(travailRefuse());
    expect(numeroDe(repris)).toBeUndefined();
  });
});
