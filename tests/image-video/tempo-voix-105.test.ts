/**
 * 24/10/2026 (décision de Will « selon tes recommandations ») : le tempo appliqué APRÈS la lecture HeyGen passe de ×1,08 à ×1,05
 * pour Image → vidéo SEULEMENT (la voix lue par HeyGen reste à 1,1 ; la recette du cas concret reste à 1,08).
 */
import { describe, expect, it } from "vitest";
import type { MotHorodate } from "@/domaine/types";
import { DEBIT_MOTS_PAR_SEC } from "@/domaine/image-video/complexite";
import { RECETTE_VOIX_IV, TEMPO_IV } from "@/moteurs/montage-image-video/assemblage";
import { RECETTE_VOIX_CAS_CONCRET } from "@/moteurs/montage-image-video/emprunts";

describe("tempo de la voix Image → vidéo", () => {
  it("×1,05 pour Image → vidéo, la recette du cas concret reste à ×1,08, la vitesse HeyGen reste à 1,1", () => {
    expect(TEMPO_IV).toBe(1.05);
    expect(RECETTE_VOIX_IV.filtres.atempo).toBe(1.05);
    expect(RECETTE_VOIX_CAS_CONCRET.filtres.atempo).toBe(1.08);
    expect(RECETTE_VOIX_IV.synthese.vitesse).toBe(1.1);
    expect(RECETTE_VOIX_IV.filtres.volume).toBe(RECETTE_VOIX_CAS_CONCRET.filtres.volume);
    expect(RECETTE_VOIX_IV.resserrage).toEqual(RECETTE_VOIX_CAS_CONCRET.resserrage);
  });

  it("le débit de référence suit : 3,4 × 1,05 / 1,08 ≈ 3,3 mots par seconde", () => {
    expect(DEBIT_MOTS_PAR_SEC).toBeCloseTo((3.4 * 1.05) / 1.08, 1);
    expect(DEBIT_MOTS_PAR_SEC).toBe(3.3);
  });

  it("le plan de coupes ÷ 1,05 : 10 s de son resserré durent 9,52 s", async () => {
    const { planRaccordVoix } = await import("@/moteurs/montage-image-video/emprunts");
    const mots: MotHorodate[] = [{ mot: "Bonjour", debutSec: 0.5, finSec: 1 }];
    const p = planRaccordVoix({ mots, dureeSec: 2 }, undefined, RECETTE_VOIX_IV);
    expect(p.dureeSec).toBeCloseTo(p.dureeResserreeSec / 1.05 + RECETTE_VOIX_IV.fin.silenceSec, 3);
  });
});
