/**
 * Rendu de l'affiche : seule la PREMIÈRE scène la reçoit (propriété `affiche`) ; un premier bloc écran v4 passe par
 * `ImageVideoEcranFin` ; le montage final (segments de sous-titres) est le même avec ou sans affiche. PUR.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CarteImage } from "@/domaine/image-video/carte";
import { RESEAUX_IV } from "@/domaine/image-video/plafonds";
import { idElementBruitage, SONS_BANQUE } from "@/donnees/bruitages";
import type { BruitageValideIV } from "@/moteurs/montage-image-video/bruitages";
import { pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { planDesFinsIV } from "@/moteurs/montage-image-video/fins";
import { mettreEnSceneIV, type LigneDeTempsIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { COMPOSITIONS_RENDU_IV, scenesDeLaLigne } from "@/services/image-video-rendu";
import { sousTitresVariesIV } from "@/moteurs/montage-image-video/sous-titres-varies";

const VALIDES: BruitageValideIV[] = SONS_BANQUE.map((s) => ({ elementId: idElementBruitage(s), declencheur: s.declencheur, variante: s.variante, dureeSec: s.dureeSec }));
const carte: CarteImage = JSON.parse(readFileSync(join(process.cwd(), "tests/image-video/fixtures/cartes/A.json"), "utf8"));
const fiche = FICHES_SIMULEES["essai-a"];
const fin = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins[0];
const ligneDe = (format: "9:16" | "4:5"): LigneDeTempsIV => mettreEnSceneIV({ carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, format, bruitagesValides: VALIDES }).ligne;
const O = { env: "dev", videoId: "v-test" };

describe("scenesDeLaLigne · l'affiche", () => {
  for (const format of ["9:16", "4:5"] as const) {
    it(`${format} : la première scène porte l'affiche, pas les suivantes`, () => {
      const ligne = ligneDe(format);
      const scenes = scenesDeLaLigne(ligne, O);
      expect(scenes.length).toBeGreaterThan(1);
      expect((scenes[0].parametres.proprietes as { affiche?: unknown }).affiche).toEqual(ligne.affiche);
      for (const s of scenes.slice(1)) expect(s.parametres.proprietes).not.toHaveProperty("affiche");
      if (scenes[0].sorte === "ecran") expect(scenes[0].parametres.composition).toBe(COMPOSITIONS_RENDU_IV.ecranFin);
    });
  }

  it("un premier bloc écran v4 passe par ImageVideoEcranFin", () => {
    const ligne = ligneDe("9:16");
    const premier = ligne.blocs[0];
    const ecran = { ...ligne, blocs: [{ ...premier, sorte: "ecran" as const, ecran: { type: "accroche", id: "e01", fond: "sombre", debutMs: 0, finMs: 2000, evenements: [], lignes: ["Test"] } } as never, ...ligne.blocs.slice(1)] };
    if (premier.sorte === "ecran") return;
    const s = scenesDeLaLigne(ecran as LigneDeTempsIV, O)[0];
    expect(s.parametres.composition).toBe(COMPOSITIONS_RENDU_IV.ecranFin);
  });

  it("sans affiche : aucune propriété `affiche` (rendus inchangés)", () => {
    const { affiche: _a, ...sans } = ligneDe("9:16");
    void _a;
    for (const s of scenesDeLaLigne(sans as LigneDeTempsIV, O)) expect(s.parametres.proprietes).not.toHaveProperty("affiche");
  });

  it("le montage final ne change pas : mêmes segments de sous-titres avec ou sans affiche", () => {
    const ligne = ligneDe("9:16");
    const { affiche: _a, ...sans } = ligne;
    void _a;
    expect(sousTitresVariesIV(ligne)).toEqual(sousTitresVariesIV(sans as LigneDeTempsIV));
  });
});
