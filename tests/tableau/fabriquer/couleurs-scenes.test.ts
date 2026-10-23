/**
 * Essai du 11/10 (mesuré sur un vrai rendu Remotion + FFmpeg de `TableauScene`) : sans `crf`, la scène sort en
 * `yuvj420p` plage PLEINE (BT.601) ; la composition `complet` la lit en BT.709 plage TV, et la page ivoire #E9DCC8
 * ressortait délavée (253, 236, 213). Avec `crf` (→ `colorSpace: "bt709"`, plage TV) : (231, 219, 199).
 */
import { expect, it } from "vitest";
import { CRF_SCENE, fabriquerTableau } from "../../../src/moteurs/montage-tableau/fabriquer";
import { ficheDemonstration } from "../regles/exemples";
import { doubles } from "./doubles";

it("chaque scène est demandée en BT.709 plage TV (crf posé), comme la composition la lit", async () => {
  const d = doubles(ficheDemonstration, { fin: "Enregistrez cette vidéo pour la refaire" });
  await fabriquerTableau(d.outils);
  expect(d.scenesSoumises().length).toBeGreaterThan(0);
  for (const s of d.scenesSoumises()) expect((s.parametres as { crf?: number }).crf).toBe(CRF_SCENE);
  expect(CRF_SCENE).toBeGreaterThanOrEqual(0);
  expect(CRF_SCENE).toBeLessThanOrEqual(18);
});
