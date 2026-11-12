/**
 * GV-ST-09b : la clé de composition tient compte de la mise en valeur des mots (GV-ST-09), sans casser les journaux d'avant.
 */
import { describe, expect, it } from "vitest";
import { fabriquerTableau } from "../../src/moteurs/montage-tableau/fabriquer";
import { ficheDemonstration } from "./regles/exemples";
import { doubles } from "./fabriquer/doubles";

/** Clé de composition relevée sur le code d'avant GV-ST-09 (mêmes entrées : fiche de démonstration, doubles). */
const CLE_D_AVANT = "ecf147efa64efeca2e1a9bc7672a6e21";

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
