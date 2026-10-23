/**
 * Contrôles qualité du face caméra (10/10, `docs/facecam/JOURNAL-CONTROLES-QUALITE.md`) : la carte « Qualité ·
 * Estimation » montrait les mêmes alertes sur la v1 et la v3 (synchro 5 images, visage 141, teinte 37°). Les alertes
 * viennent maintenant des contrôles de la PISTE MONTÉE (version 2) ; ceux d'avant (version 1) ne déclenchent plus rien
 * et une retouche refait la piste montée pour les remesurer.
 */
import { describe, expect, it } from "vitest";
import { alertesControles, LUMINANCE_VISAGE, TEINTE_PEAU, VERSION_CONTROLES, type ControlesMontage, type EtatChaine } from "@/moteurs/montage-facecam/chaine";
import { etatPourRetouche, type RepriseChaine } from "@/moteurs/montage-facecam/retouche";

const messages = (ctrl: ControlesMontage | undefined, mesures?: Parameters<typeof alertesControles>[1]) => alertesControles(ctrl, mesures, undefined, 0).map((a) => `${a.gravite}:${a.message}`);

describe("alertes des contrôles machine", () => {
  it("le cas de la v1 / v3 (contrôles version 1, mesures de la passe) ne donne plus d'alerte fausse", () => {
    // Exactement ce que la prod affichait : synchro 5 (bord de la fenêtre ± 5), visage 141, teinte 37° mesurés avant la LUT.
    expect(messages({ decalageSynchroImages: 5, niveauLufs: -14 }, { luminanceVisageApres: 141, teintePeauDeg: 37, bruitRatio: 0.8 })).toEqual([]);
  });

  it("version 2 : synchro décalée → bloquant, avec le sens", () => {
    expect(messages({ version: VERSION_CONTROLES, decalageSynchroImages: 3 })).toEqual(["bloquant:Son et image décalés de 3 image(s) (le son arrive après l'image)."]);
    expect(messages({ version: VERSION_CONTROLES, decalageSynchroImages: -2 })).toEqual(["bloquant:Son et image décalés de 2 image(s) (le son arrive avant l'image)."]);
    expect(messages({ version: VERSION_CONTROLES, decalageSynchroImages: 1 })).toEqual([]);
    expect(messages({ version: VERSION_CONTROLES, decalageSynchroImages: null })).toEqual([]);
  });

  it("version 2 : luminance du visage jugée sur la piste montée, bornes 90-190 (luma BT.709 0-255)", () => {
    expect(LUMINANCE_VISAGE).toEqual({ min: 90, max: 190 });
    expect(messages({ version: 2, visage: { luminance: 141, teinteDeg: 45 } })).toEqual([]);
    expect(messages({ version: 2, visage: { luminance: 158, teinteDeg: 51 } })).toEqual([]); // ColorChecker « light skin »
    expect(messages({ version: 2, visage: { luminance: 82, teinteDeg: 50 } })).toEqual(["attention:Visage trop sombre (82)."]);
    expect(messages({ version: 2, visage: { luminance: 205, teinteDeg: 50 } })).toEqual(["attention:Visage trop clair (205)."]);
  });

  it("version 2 : teinte de la peau 50° ± 20° (CIELAB h_ab)", () => {
    expect(TEINTE_PEAU).toEqual({ centreDeg: 50, toleranceDeg: 20 });
    expect(messages({ version: 2, visage: { luminance: 140, teinteDeg: 37 } })).toEqual([]);
    expect(messages({ version: 2, visage: { luminance: 140, teinteDeg: 25 } })).toEqual(["info:Teinte de peau hors des tons chair (25°)."]);
    expect(messages({ version: 2, visage: { luminance: 140, teinteDeg: 75 } })).toEqual(["info:Teinte de peau hors des tons chair (75°)."]);
  });

  it("le bruit et le ΔE de la passe restent jugés (comparaisons relatives à la prise / au Look Will)", () => {
    expect(messages({ version: 2 }, { bruitRatio: 1.2, deltaE00Peau: 5 })).toEqual(["bloquant:Le visage est plus granuleux que l'original.", "attention:Teint éloigné du Look Will (ΔE 5.0)."]);
  });
});

describe("retouche : contrôles périmés", () => {
  const reprise = (controles: Record<string, unknown>): RepriseChaine =>
    ({
      version: "reprise-facecam-1",
      signature: { coupes: [], image: {}, teinte: "neutre", son: { nettoyer: true, musique: true, volume: "normal" }, habillage: "x" },
      travaux: {
        son: { id: "s", statut: "termine", progression: 100, essais: 0, resultat: { fichierCle: "son.flac" } },
        passe: { id: "p", statut: "termine", progression: 100, essais: 0, resultat: { fichierCle: "image.mp4" } },
        cadrage: { id: "c", statut: "termine", progression: 100, essais: 0, resultat: { fichierCle: "montage.mov", controles } },
      },
      cartes: [],
      dureeSec: 30,
    }) as unknown as RepriseChaine;
  const travaux = (e: EtatChaine) => Object.keys(e.travaux).sort();

  it("contrôles version 1 : la piste montée est refaite (la passe image et le son sont gardés)", () => {
    expect(travaux(etatPourRetouche(reprise({ decalageSynchroImages: 5 }), { entrees: {} }, new Set(["habillage"]), []))).toEqual(["passe", "son"]);
  });

  it("contrôles version 2 : rien n'est refait pour un simple habillage", () => {
    expect(travaux(etatPourRetouche(reprise({ version: 2, decalageSynchroImages: 0 }), { entrees: {} }, new Set(["habillage"]), []))).toEqual(["cadrage", "passe", "son"]);
  });
});
