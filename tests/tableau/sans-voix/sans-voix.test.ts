/**
 * TA-SV : mode sans voix du tableau animé. Module pur (rythme de lecture, coût 0), étapes du moteur (pas d'étape « voix »),
 * lecture des entrées. Aucun appel réseau, aucun HeyGen.
 */
import { describe, expect, it } from "vitest";
import { dureeDiteSec } from "@/domaine/duree-tableau";
import { lireEntreesTableau, etapesTableau } from "../../../src/moteurs/montage-tableau/etapes";
import { DETAIL_SANS_VOIX, COUT_VOIX_SANS_VOIX_CENTIMES, LECTURE_MIN_SCENE_SEC, LIBELLE_SANS_VOIX, MOTEUR_SANS_VOIX_PRET, dureeSceneSansVoixSec, planSansVoix, remarqueDuree } from "../../../src/moteurs/montage-tableau/sans-voix";

describe("rythme de lecture sans voix", () => {
  it("le libellé de l'écran est celui de la consigne ; le coût de la voix est 0", () => {
    expect(LIBELLE_SANS_VOIX).toBe("Sans voix (sous-titres et texte à l'écran)");
    expect(COUT_VOIX_SANS_VOIX_CENTIMES).toBe(0);
    // L'écran avant « Fabriquer » n'affiche jamais de montant.
    expect(`${LIBELLE_SANS_VOIX} ${DETAIL_SANS_VOIX}`).not.toMatch(/€/);
  });
  it("une scène reste au moins le plancher, et au moins le temps de dire son texte (estimation existante)", () => {
    expect(dureeSceneSansVoixSec("Oui.")).toBe(LECTURE_MIN_SCENE_SEC);
    expect(dureeSceneSansVoixSec("")).toBe(LECTURE_MIN_SCENE_SEC);
    const long = "Votre facture arrive en retard chaque mois et personne ne sait pourquoi cela se produit encore une fois cette année.";
    expect(dureeSceneSansVoixSec(long)).toBeGreaterThanOrEqual(dureeDiteSec(long));
  });
  it("les scènes sont posées bout à bout, sans trou ni chevauchement", () => {
    const p = planSansVoix([{ id: "s01", texteDit: "Premier texte assez long pour dépasser le plancher de lecture d'une scène." }, { id: "s02", texteDit: "Deux." }]);
    expect(p.scenes[0].debutSec).toBe(0);
    expect(p.scenes[1].debutSec).toBe(p.scenes[0].finSec);
    expect(p.dureeSec).toBe(p.scenes[1].finSec);
  });
  it("la durée cible est une remarque, jamais un refus", () => {
    expect(remarqueDuree(40, 30)).toContain("40 s");
    expect(remarqueDuree(20, 30)).toBeNull();
    expect(remarqueDuree(20, undefined)).toBeNull();
  });
  it("le moteur n'est pas déclaré prêt tant que fabriquer.ts ne gère pas le mode", () => {
    expect(MOTEUR_SANS_VOIX_PRET).toBe(false);
  });
});

describe("étapes et entrées", () => {
  const base = { distribution: [{ role: "voix" as const, source: "double" as const, personnageId: "p1" }], dureeCibleSec: 30 };
  it("avec voix (défaut) : l'étape « voix » existe ; le calage en dépend", () => {
    const e = etapesTableau({ ...base, entrees: { tableau: { ficheScenesCle: "k" } } });
    expect(e.map((x) => x.cle)).toContain("voix");
    expect(e.find((x) => x.cle === "calage")?.dependDe).toEqual(["voix"]);
  });
  it("sans voix : aucune étape « voix », le calage suit la fiche", () => {
    const e = etapesTableau({ ...base, entrees: { tableau: { ficheScenesCle: "k", sansVoix: true } } });
    expect(e.map((x) => x.cle)).not.toContain("voix");
    expect(e.find((x) => x.cle === "calage")?.dependDe).toEqual(["fiche"]);
  });
  it("lecture tolérante : seul `true` active le mode", () => {
    expect(lireEntreesTableau({ tableau: { sansVoix: true } } as never).sansVoix).toBe(true);
    expect(lireEntreesTableau({ tableau: { sansVoix: "oui" } } as never).sansVoix).toBeUndefined();
    expect(lireEntreesTableau({} as never).sansVoix).toBeUndefined();
  });
});
