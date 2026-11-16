/**
 * C2-U5bis · image → vidéo : `styleVarie` (capacité `texte.style-varie`) est un paramètre facultatif, NON BRANCHÉ
 * (l'appelant `src/services/image-video-rendu.ts` est en zone interdite). Sans lui : comportement de `master`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MARQUEURS } from "@/briques/sous-titres/marqueur";
import { autoriserTexte } from "@/briques/charte/axion-2026";
import type { RecetteVarieteIV } from "@/briques/schema-motion/variete";
import type { CarteImage } from "@/domaine/image-video/carte";
import { RESEAUX_IV } from "@/domaine/image-video/plafonds";
import { idElementBruitage, SONS_BANQUE } from "@/donnees/bruitages";
import { pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { mettreEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { codeSousTitresIV, intensiteSousTitresIV, surlignageSousTitresIV, VARIANTE_PAR_VERSION } from "@/moteurs/montage-image-video/sous-titres-varies";
import { SURLIGNAGE_CAS_CONCRET } from "@/moteurs/montage-cas-concret/sous-titres-variete";
import { RECETTE_REFERENCE_IV } from "@/moteurs/montage-image-video/variete/tirage";
import { planDesFinsAvant as planDesFinsIV } from "../plan-des-fins-avant";

const carte = JSON.parse(readFileSync(join(process.cwd(), "tests/image-video/fixtures/cartes/A.json"), "utf8")) as CarteImage;
const VALIDES = SONS_BANQUE.map((s) => ({ elementId: idElementBruitage(s), declencheur: s.declencheur, variante: s.variante, dureeSec: s.dureeSec }));

function ligne(code: RecetteVarieteIV["sousTitres"]) {
  const fiche = FICHES_SIMULEES["essai-a" as keyof typeof FICHES_SIMULEES];
  const fin = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins.find((f) => f.reseaux.includes("youtube-shorts"))!;
  return mettreEnSceneIV({ carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides: VALIDES, variete: { ...RECETTE_REFERENCE_IV, sousTitres: code } }).ligne;
}

describe("C2-U5bis · image → vidéo (prêt, non branché)", () => {
  it("constantes inchangées", () => {
    expect(VARIANTE_PAR_VERSION).toBe(false);
    expect(SURLIGNAGE_CAS_CONCRET.fond).toBeTruthy();
  });
  it("sans 2e argument (et avec false) : identique à master pour SOU-B/C/D/E", () => {
    for (const code of ["SOU-B", "SOU-C", "SOU-D", "SOU-E"] as const) {
      const l = ligne(code);
      expect(surlignageSousTitresIV(l)).toEqual({});
      expect(surlignageSousTitresIV(l, false)).toEqual({});
      expect(codeSousTitresIV(l)).toBeUndefined();
      expect(intensiteSousTitresIV(l)).toBe("equilibre");
    }
  });
  it("styleVarie=true : SOU-D rend le marqueur terracotta de la charte, lisible", () => {
    const r = surlignageSousTitresIV(ligne("SOU-D"), true);
    expect(r).toEqual({ surlignage: MARQUEURS.terracotta });
    expect(autoriserTexte(r.surlignage!.texte, r.surlignage!.fond)).toBe(true);
    expect(r.surlignage).not.toBe(SURLIGNAGE_CAS_CONCRET);
  });
  it("styleVarie=true : SOU-B/SOU-E ne surlignent pas ; SOU-C devient très dynamique", () => {
    expect(surlignageSousTitresIV(ligne("SOU-B"), true)).toEqual({});
    expect(surlignageSousTitresIV(ligne("SOU-E"), true)).toEqual({});
    expect(intensiteSousTitresIV(ligne("SOU-C"), true)).toBe("tres-dynamique");
  });
});
