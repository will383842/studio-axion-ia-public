/**
 * Affiche de la première image (aperçu des réseaux) : l'OUV-D dans son état final, calculée depuis la carte et la fiche
 * (PUR : aucun rendu, aucun appel). Durée, voix, blocs et événements ne changent pas.
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
import { mettreEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { afficheIV, IMAGES_AFFICHE_IV } from "@/moteurs/montage-image-video/variete/axes/ouverture";
import type { AfficheIV as AfficheRendu } from "../../studio-rendu/compositions/image-video/variete/ouverture/donnees";

const VALIDES: BruitageValideIV[] = SONS_BANQUE.map((s) => ({ elementId: idElementBruitage(s), declencheur: s.declencheur, variante: s.variante, dureeSec: s.dureeSec }));
const IMAGES = { A: "essai-a", C: "essai-c", D: "essai-d" } as const;
const carteDe = (nom: keyof typeof IMAGES): CarteImage => JSON.parse(readFileSync(join(process.cwd(), "tests/image-video/fixtures/cartes", `${nom}.json`), "utf8"));

describe("afficheIV · la première image montre l'accroche écrite en entier", () => {
  for (const nom of Object.keys(IMAGES) as (keyof typeof IMAGES)[]) {
    it(`${nom} : OUV-D final, 1 à 8 mots à t = 0, un seul mot orange, une image`, () => {
      const carte = carteDe(nom);
      const fiche = FICHES_SIMULEES[IMAGES[nom]];
      const a = afficheIV(carte, fiche);
      expect(a).not.toBeNull();
      const aff: AfficheRendu = a!; // les données du moteur s'assignent au type recopié du rendu
      expect(aff.donnees.code).toBe("OUV-D");
      expect(aff.donnees.mots.length).toBeGreaterThanOrEqual(1);
      expect(aff.donnees.mots.length).toBeLessThanOrEqual(8);
      expect(aff.donnees.mots.every((m) => m.t === 0)).toBe(true);
      expect(aff.donnees.mots.filter((m) => m.orange)).toHaveLength(1);
      expect(aff.donnees.situation).toBe(carte.automatisation);
      expect(aff.fond).toBe(fiche.ecrans[0].fond);
      expect(aff.images).toBe(IMAGES_AFFICHE_IV);
      expect(aff.images).toBe(1);
    });
    for (const format of ["9:16", "4:5"] as const) {
      it(`${nom} ${format} : la ligne de temps porte l'affiche, sans toucher à la durée ni aux blocs`, () => {
        const carte = carteDe(nom);
        const fiche = FICHES_SIMULEES[IMAGES[nom]];
        const fin = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins[0];
        const ligne = mettreEnSceneIV({ carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, format, bruitagesValides: VALIDES }).ligne;
        expect(ligne.affiche).toEqual(afficheIV(carte, fiche));
        expect(ligne.affiche).toBeDefined();
      });
    }
  }

  it("sans aucun texte d'accroche : pas d'affiche (et pas de clé)", () => {
    const carte = carteDe("A");
    const fiche = FICHES_SIMULEES["essai-a"];
    const vide = { ...fiche, ecrans: fiche.ecrans.map((e) => (e.partie === "accroche" ? { ...e, textesEcran: [] } : e)) };
    expect(afficheIV(carte, vide)).toBeNull();
  });
});
