/**
 * GV-ST-12 · Le .srt d'une image → vidéo est celui des sous-titres variés réellement dessinés.
 *  (1) `baseDuMontageIV(...).segments` = `sousTitresVariesIV(ligne)` (protège l'identité si le style change plus tard) ;
 *  (2) `resultatDe` renvoie `sousTitres` du rendu de la première livraison ; un rendu d'avant (sans `sousTitres`) : rien.
 */
import { describe, expect, it, vi } from "vitest";
import { RESEAUX_IV } from "@/domaine/image-video/plafonds";
import { pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { BRUITAGES_V4_IV, type EtatFabricationIV } from "@/moteurs/montage-image-video/fabrication";
import { planDesFinsIV } from "@/moteurs/montage-image-video/fins";
import { resultatDe } from "@/moteurs/montage-image-video";
import { mettreEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { planMixageIV, type PisteVoixSeuleIV } from "@/moteurs/montage-image-video/assemblage";
import { sousTitresVariesIV } from "@/moteurs/montage-image-video/sous-titres-varies";
import { baseDuMontageIV } from "@/services/image-video-rendu";
import { carteFixe } from "./doubles-fabrication";

vi.mock("server-only", () => ({}));
vi.setConfig({ testTimeout: 120_000 });

function ligneEssai() {
  const carte = carteFixe("A");
  const fiche = FICHES_SIMULEES["essai-a"];
  const fin = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins.find((f) => f.reseaux.includes("youtube-shorts"))!;
  const simulee = pisteSimulee(fiche, fin.muet ? null : fin);
  const ligne = mettreEnSceneIV({ carte, fiche, voix: simulee, fin, reseaux: fin.reseaux, bruitagesValides: BRUITAGES_V4_IV }).ligne;
  const voix = { ...simulee, version: "v", reseaux: fin.reseaux, courte: false, cle: "voix", empreinte: "e" } as unknown as PisteVoixSeuleIV;
  return { ligne, voix };
}

describe("GV-ST-12 · .srt identique aux sous-titres dessinés", () => {
  it("la base du montage dessine exactement sousTitresVariesIV(ligne)", () => {
    const { ligne, voix } = ligneEssai();
    const mixage = planMixageIV(voix, ligne.bruitages, ligne.dureeSec);
    const base = baseDuMontageIV({ ligne, mixage, piste: voix }, []);
    expect(base.segments.length).toBeGreaterThan(0);
    expect(base.segments).toEqual(sousTitresVariesIV(ligne));
  });

  const segments = [{ debutSec: 0, finSec: 1.2, texte: "Bonjour é" }];
  const etatFini = (sousTitres?: typeof segments) =>
    ({
      livraison: [{ format: "9:16", fichierCle: "cle-b", dureeSec: 12 }],
      rendus: {
        a: { cle: "cle-a", dureeSec: 12, demande: "x", sousTitres: [{ debutSec: 9, finSec: 9.5, texte: "autre" }] },
        b: { cle: "cle-b", dureeSec: 12, demande: "y", ...(sousTitres ? { sousTitres } : {}) },
      },
      controles: undefined,
      caisse: { reservations: [] },
      journal: [],
    }) as unknown as EtatFabricationIV;

  it("resultatDe renvoie les sous-titres du rendu de la première livraison", () => {
    expect(resultatDe(etatFini(segments), 0).sousTitres).toEqual(segments);
  });

  it("rendu d'avant la fiche : aucun champ sousTitres", () => {
    expect(resultatDe(etatFini(), 0)).not.toHaveProperty("sousTitres");
  });
});
