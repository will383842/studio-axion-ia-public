/**
 * IV-SV · (2) sans voix, le montage n'envoie aucune `audioCle` (le serveur passe par `preparerSilence`) ; avec voix, inchangé.
 * (3) garde « studio relié » d'`outilsImageVideo` : en production, une voix simulée n'arrête PAS le mode sans voix, mais le
 * stockage simulé ou le rendu simulé l'arrêtent toujours ; avec voix, une voix simulée arrête toujours.
 */
import { describe, expect, it, vi } from "vitest";
import type { DemandeRenduIV } from "@/moteurs/montage-image-video/fabrication";
import { planMixageIV, type PisteVoixSeuleIV } from "@/moteurs/montage-image-video/assemblage";
import { pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { mettreEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { planDesFinsIV } from "@/moteurs/montage-image-video/fins";
import { BRUITAGES_V4_IV } from "@/moteurs/montage-image-video/fabrication";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { RESEAUX_IV } from "@/domaine/image-video/plafonds";
import { carteFixe } from "./doubles-fabrication";

const etat = vi.hoisted(() => ({ stockage: "reel" as "reel" | "simulation", voix: "simulation" as "reel" | "simulation", rendu: false }));
vi.mock("@/fournisseurs", () => ({
  resoudreFournisseur: (role: string) => {
    if (role === "stockage") return { mode: etat.stockage, urlLecture: async () => "", urlDepotDuree: async () => "" };
    if (role === "voix") return { mode: etat.voix, capacites: {} };
    return { mode: "reel", capacites: {} };
  },
}));
vi.mock("@/fournisseurs/rendu/client", () => ({ obtenirServiceRendu: () => ({}), renduSimule: () => etat.rendu }));

const { baseDuMontageIV } = await import("@/services/image-video-rendu");
const { outilsImageVideo, STUDIO_NON_RELIE_IV } = await import("@/services/image-video");

function demande(plus: Partial<DemandeRenduIV> = {}): DemandeRenduIV {
  const carte = carteFixe("A");
  const fiche = FICHES_SIMULEES["essai-a"];
  const fin = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins.find((f) => f.reseaux.includes("youtube-shorts"))!;
  const simulee = pisteSimulee(fiche, fin.muet ? null : fin);
  const ligne = mettreEnSceneIV({ carte, fiche, voix: simulee, fin, reseaux: fin.reseaux, bruitagesValides: BRUITAGES_V4_IV }).ligne;
  const piste = { ...simulee, version: "v", reseaux: fin.reseaux, courte: false, cle: "voix-seule/v.wav", empreinte: "e" } as unknown as PisteVoixSeuleIV;
  const mixage = planMixageIV(piste, [], ligne.dureeSec);
  return { id: "d", videoId: "v-sv", version: "v", reseaux: fin.reseaux, ligne, mixage, piste, ...plus } as unknown as DemandeRenduIV;
}

describe("IV-SV · le montage sans voix n'envoie pas d'audioCle", () => {
  it("sans voix : aucune clé audio, aucun bruitage ; avec voix : la piste voix seule, comme avant", () => {
    const sans = baseDuMontageIV(demande({ sansVoix: true }), []);
    expect("audioCle" in sans).toBe(false);
    expect(sans.bruitages).toBeUndefined();
    expect(baseDuMontageIV(demande(), []).audioCle).toBe("voix-seule/v.wav");
  });
});

describe("IV-SV · garde « studio relié » d'outilsImageVideo (production)", () => {
  const prod = { videoId: "v-sv", travailId: "t-sv", production: true };
  const reinit = (o: Partial<typeof etat> = {}) => Object.assign(etat, { stockage: "reel", voix: "simulation", rendu: false }, o);

  it("voix simulée : arrête le mode avec voix, laisse passer le mode sans voix", async () => {
    reinit();
    await expect(outilsImageVideo(prod)).rejects.toThrow(STUDIO_NON_RELIE_IV);
    const o = await outilsImageVideo({ ...prod, sansVoix: true });
    expect(typeof o.pisteMuette).toBe("function");
  });

  it("sans voix : un stockage simulé ou un rendu simulé arrêtent toujours (rien n'est dépensé)", async () => {
    reinit({ stockage: "simulation" });
    await expect(outilsImageVideo({ ...prod, sansVoix: true })).rejects.toThrow(STUDIO_NON_RELIE_IV);
    reinit({ rendu: true });
    await expect(outilsImageVideo({ ...prod, sansVoix: true })).rejects.toThrow(STUDIO_NON_RELIE_IV);
  });

  it("avec voix réelle : passe, et n'expose pas de piste muette", async () => {
    reinit({ voix: "reel" });
    const o = await outilsImageVideo(prod);
    expect(o.pisteMuette).toBeUndefined();
  });
});
