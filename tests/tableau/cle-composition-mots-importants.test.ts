/**
 * GV-ST-09b : la clé de composition tient compte de la mise en valeur des mots (GV-ST-09), sans casser les journaux d'avant.
 */
import { describe, expect, it } from "vitest";
import { fabriquerTableau } from "../../src/moteurs/montage-tableau/fabriquer";
import { ficheDemonstration } from "./regles/exemples";
import { doubles } from "./fabriquer/doubles";

/**
 * Clé de composition SANS le marqueur de GV-ST-09, pour la fiche de démonstration et les doubles. Relevée de nouveau
 * après GV2-16 : la voix des doubles finit juste après son dernier mot, son silence de fin est donc complété et la durée
 * change. Une vidéo existante reprend sa voix du journal (même durée) et garde sa clé : seul ce jeu d'essai change.
 */
const CLE_D_AVANT = "3851db02f185592fd0af7c8241000452";

const cleDe = (d: ReturnType<typeof doubles>) => d.journal.valeur!.etapes.composition!.empreinte;

describe("clé de composition et mots mis en valeur", () => {
  it("une fabrication neuve n'a pas la clé qu'elle aurait eue avant", async () => {
    const d = doubles(ficheDemonstration);
    await fabriquerTableau(d.outils);
    expect(cleDe(d)).not.toBe(CLE_D_AVANT);
  }, 120_000);

  it("un journal d'avant (composition déjà gardée) garde sa clé et reprend sans refaire", async () => {
    const d = doubles(ficheDemonstration);
    await fabriquerTableau(d.outils);
    // Le journal d'avant GV-ST-09 : la composition est gardée sous l'ancienne clé.
    const j = d.journal.valeur!;
    j.etapes.composition!.empreinte = CLE_D_AVANT;
    if (j.composition) j.composition.empreinte = CLE_D_AVANT;
    const r = await fabriquerTableau(d.outils);
    expect(cleDe(d)).toBe(CLE_D_AVANT);
    expect(r.etapes.find((e) => e.etape === "composition")?.statut).toBe("reprise");
    expect(d.compositionsSoumises()).toHaveLength(1);
  }, 120_000);
});
