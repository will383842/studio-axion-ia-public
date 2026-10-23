/**
 * ORG-07a (U-5, partie 1) : l'ancien chemin du nettoyage (moteur avocat) et la brique `voix-maitre` exportent
 * EXACTEMENT les mêmes fonctions et constantes (mêmes objets, pas des copies) ; les types `AudioBrut`, `AudioMaitre`
 * et la copie locale de `PlanProduit` sont identiques à ceux d'avant.
 */
import { describe, expect, expectTypeOf, it } from "vitest";
import * as ancien from "@/moteurs/montage-avocat/nettoyage";
import * as brique from "@/briques/voix-maitre";
import * as briqueNettoyage from "@/briques/voix-maitre/nettoyage";
import type { AudioMaitre as AudioMaitreAvocat } from "@/moteurs/montage-avocat";
import type { AudioBrut, AudioMaitre } from "@/briques/voix-maitre";
import type { PlanProduit } from "@/moteurs/types";

const NOMS_ATTENDUS = [
  "FIN_APRES_DERNIER_MOT_SEC",
  "REGLES_NETTOYAGE_PAR_DEFAUT",
  "blancsLongs",
  "calculerCoupures",
  "coupuresAppliquees",
  "debitEtVitesseConseillee",
  "decalerMots",
  "decalerTemps",
  "intervallesDesMesures",
];

describe("brique voix-maitre : ré-export de l'ancien chemin", () => {
  it("l'ancien chemin et la brique exportent les mêmes noms", () => {
    expect(Object.keys(ancien).sort()).toEqual(NOMS_ATTENDUS);
    expect(Object.keys(briqueNettoyage).sort()).toEqual(NOMS_ATTENDUS);
    expect(Object.keys(brique).sort()).toEqual(NOMS_ATTENDUS);
  });

  it("chaque export est le MÊME objet (déplacé, pas recopié)", () => {
    for (const nom of NOMS_ATTENDUS) {
      const a = (ancien as Record<string, unknown>)[nom];
      expect(a, nom).toBeDefined();
      expect(a, nom).toBe((brique as Record<string, unknown>)[nom]);
      expect(a, nom).toBe((briqueNettoyage as Record<string, unknown>)[nom]);
    }
  });

  it("les types de la voix maître sont ceux du moteur avocat", () => {
    expectTypeOf<AudioMaitreAvocat>().toEqualTypeOf<AudioMaitre>();
    expectTypeOf<NonNullable<AudioMaitre["plansAssembles"]>[number]>().toEqualTypeOf<PlanProduit>();
    expectTypeOf<AudioBrut>().toHaveProperty("copieEnAttente");
  });
});
