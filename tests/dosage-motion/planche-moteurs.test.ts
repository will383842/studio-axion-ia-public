/**
 * X3-13b-a : la planche du dosage et les moteurs purs déjà fusionnés (face caméra, cas concret, tableau) disent la
 * même chose. Test seul : aucun code de production, aucun rendu, aucun réseau. L'image→vidéo vient avec X3-13b-b.
 */
import { describe, expect, it } from "vitest";
import { RETRAITS, NIVEAU_DU_DOSAGE } from "@/briques/dosage-motion/crans";
import { cartesAutoSelonDosage } from "@/moteurs/montage-facecam/dosage";
import { appliquerContraintes, contraintesDosageCasConcret } from "@/moteurs/montage-cas-concret/dosage";
import { intensiteSousTitresTableau } from "@/moteurs/montage-tableau/dosage";
import { DENSITES_PARTICULES, FONDS_FORTS, INCLINAISONS, INTENSITES, ACCENTS, HAUTEURS_SOUS_TITRES, type Tirage } from "@/moteurs/montage-cas-concret/variete";
import { tableauDosage } from "../../scripts/dosage-motion/planche";

function tirageSimule(i: number): Tirage {
  return {
    graine: i * 7919,
    sel: i % 3,
    fondFort: FONDS_FORTS[i % 3],
    particules: { groupe: i % 6, densite: DENSITES_PARTICULES[i % 3] },
    sousTitres: { inclinaison: INCLINAISONS[i % 2], intensite: INTENSITES[i % 3], accent: ACCENTS[i % 2], hauteur: HAUTEURS_SOUS_TITRES[i % 2] },
    relache: i % 4,
  } as unknown as Tirage;
}

const QUATRE_CARTES = [0, 1, 2, 3].map((i) => ({ idStable: `carte-${i}`, etat: "posee" }));
const RETIRES_ATTENDUS = { aucun: 4, sobre: 2, equilibre: 0, dynamique: 0 } as const;

const LIGNES = tableauDosage();

describe("planche du dosage × moteurs purs", () => {
  it("la planche n'est pas vide", () => {
    expect(LIGNES.length).toBeGreaterThan(0);
  });

  describe.each(LIGNES.map((l) => [`${l.generateur} · ${l.cran}`, l] as const))("%s", (_nom, l) => {
    it("sous-titres présents", () => {
      expect(l.sousTitresPresents).toBe(true);
    });

    it("tableau : la commande et le moteur ne se contredisent pas", () => {
      const dite = l.commande.sousTitres?.intensite;
      const moteur = intensiteSousTitresTableau(l.cran, dite);
      expect(moteur).toBe(dite);
      expect(moteur).toBe(NIVEAU_DU_DOSAGE[l.cran]);
    });

    it.skipIf(l.generateur !== "cas-concret")("cas concret : jamais aucun, contraintes sans erreur, sous-titres gardés sur 20 tirages", () => {
      expect(l.cran).not.toBe("aucun");
      expect(() => contraintesDosageCasConcret(l.cran)).not.toThrow();
      const c = contraintesDosageCasConcret(l.cran);
      for (let i = 0; i < 20; i++) {
        const t = appliquerContraintes(tirageSimule(i), c);
        expect(typeof t.sousTitres).toBe("object");
        expect(t.sousTitres).not.toBeNull();
      }
    });

    it("face caméra : les retraits de cartes de la planche = ceux du moteur", () => {
      const retirees = cartesAutoSelonDosage(l.cran, QUATRE_CARTES);
      expect(retirees).toHaveLength(RETIRES_ATTENDUS[l.cran]);
      if (RETRAITS[l.cran].cartes === true) expect(retirees).toHaveLength(QUATRE_CARTES.length);
      else expect(retirees.length).toBeLessThan(QUATRE_CARTES.length);
    });
  });

  it.todo("image-video : X3-13b-b, après X3-08a/X3-08b");
});
