/**
 * IMAGE → VIDÉO · référence recalibrée sur la nouvelle voix HeyGen (23/10/2026, Will : « cette voix me convient »).
 * Prod : v-6e4a06b9c718 refusée (hauteur +19 %, variation +35 %) contre l'ancienne voix. Les deux prises ont été mesurées
 * (« video-finie » v3) ; la prise 2, retenue, fixe la référence. Un « non » enregistré à mesure à jour est rejugé gratuitement
 * sur sa mesure gardée ; un « oui » n'est jamais rejugé. Aucune lecture, aucun appel payant.
 */
import { describe, expect, it } from "vitest";
import { refusReessayableIV } from "@/components/formats/image-video/vue";
import { comparerAReference, REFERENCE_V4, VERSION_MESURE_VOIX, type MesureVoix } from "@/briques/voix-maitre/reference";
import { REFERENCE_V4_IV } from "@/domaine/image-video/reference-voix";
import { ecartHorsReference, voixAcceptableParLaRegleDesFinsIV } from "@/moteurs/montage-image-video/secours";
import { verdictVoixFaite, type EtatVoixIV } from "@/moteurs/montage-image-video/voix";
import type { PriseVoix } from "@/moteurs/montage-image-video/emprunts";

const PRISE_1: MesureVoix = { hauteurHz: 192.77108, variationHz: 41.75259, energie: 0.13292, dynamique: 0.52929, rythmePicsParSec: 4.83368, partieParole: 0.704 };
const PRISE_2: MesureVoix = { hauteurHz: 188.23529, variationHz: 42.27422, energie: 0.13313, dynamique: 0.52493, rythmePicsParSec: 5.02898, partieParole: 0.70003 };
/** La mesure refusée en prod : l'ancienne référence (v4 à 158,4 Hz) contre la nouvelle voix. */
const ANCIENNE_REF: MesureVoix = { ...REFERENCE_V4, hauteurHz: 158.4 };

function prise(mesure: MesureVoix, ressemblante: boolean, versionMesure: number | undefined = VERSION_MESURE_VOIX, ecarts: string[] = ressemblante ? [] : ["hauteur +19 % (toléré 8 %)", "variation de hauteur +35 % (toléré 25 %)"]): PriseVoix {
  return {
    texte: "t",
    empreinte: "e",
    etat: { phase: "faite", audio: { ressemblance: { prises: [{ empreinteDemande: "x#lecture-1", fichierCle: "b.mp3", coutCentimes: 4, caracteres: 139, mesure, ...(versionMesure !== undefined ? { versionMesure } : {}), ressemblante, ecarts }], retenue: 0, ressemblante } } },
    controle: { ok: true },
  } as unknown as PriseVoix;
}

function etatVoix(corps: PriseVoix): EtatVoixIV {
  return {
    segments: { fins: [] },
    voix: { corps: { texte: "c", lectures: 1, retenu: true, prise: corps }, fins: [], payees: [], reformulations: [], issue: { statut: "faite" } },
  } as unknown as EtatVoixIV;
}

describe("référence Image → vidéo recalibrée sur la nouvelle voix", () => {
  it("la constante reprend la prise 2 arrondie ; la v4 de l'avocat ne bouge pas", () => {
    expect(REFERENCE_V4_IV).toEqual({ hauteurHz: 188.2, variationHz: 42.3, energie: 0.133, dynamique: 0.525, rythmePicsParSec: 5.03, partieParole: 0.7 });
    expect(Object.isFrozen(REFERENCE_V4_IV)).toBe(true);
    expect(REFERENCE_V4.hauteurHz).toBe(152.4);
  });

  it("les deux prises réelles (1 et 2) ressemblent à la nouvelle référence", () => {
    expect(comparerAReference(PRISE_2, REFERENCE_V4_IV)).toEqual({ ressemblante: true, ecarts: [] });
    expect(comparerAReference(PRISE_1, REFERENCE_V4_IV)).toEqual({ ressemblante: true, ecarts: [] });
  });

  it("une prise +19 % de hauteur reste refusée", () => {
    const m = { ...PRISE_2, hauteurHz: REFERENCE_V4_IV.hauteurHz * 1.19 };
    const c = comparerAReference(m, REFERENCE_V4_IV);
    expect(c.ressemblante).toBe(false);
    expect(c.ecarts[0].libelle).toMatch(/^hauteur \+19 %/);
    expect(ecartHorsReference(prise(m, false))).toMatch(/^hauteur \+19 %/);
  });

  it("un « non » enregistré avec la mesure réelle à la version 3 est rejugé : plus aucun écart, voix « faite », « Refaire » proposé", () => {
    const corps = prise(PRISE_2, false, VERSION_MESURE_VOIX);
    expect(ecartHorsReference(corps)).toBeNull();
    expect(verdictVoixFaite(etatVoix(corps))).toEqual({ statut: "faite" });
    expect(voixAcceptableParLaRegleDesFinsIV(etatVoix(corps))).toBe(true);
    const refus = { etape: "voix", code: "IV_VOIX", message: "La voix du corps ne ressemble pas assez à la voix de référence (hauteur +19 % (toléré 8 %), variation de hauteur +35 % (toléré 25 %)), même après ses relectures.", reessayable: false };
    expect(refusReessayableIV({ refus, voix: etatVoix(corps) } as unknown as Parameters<typeof refusReessayableIV>[0])).toBe(true);
  });

  it("une mesure de version 2 : les écarts enregistrés sont rendus tels quels (pas de rejugement)", () => {
    const corps = prise(PRISE_2, false, 2);
    expect(ecartHorsReference(corps)).toBe("hauteur +19 % (toléré 8 %), variation de hauteur +35 % (toléré 25 %)");
    expect(verdictVoixFaite(etatVoix(corps))).toMatchObject({ statut: "refus", controle: "Q16" });
  });

  it("une mesure sans version (v1) : écarts enregistrés rendus tels quels", () => {
    expect(ecartHorsReference(prise(PRISE_2, false, 1))).toContain("hauteur +19 %");
  });

  it("une prise « oui » enregistrée n'est jamais rejugée, même hors de la nouvelle référence", () => {
    expect(ecartHorsReference(prise(ANCIENNE_REF, true))).toBeNull();
  });

  it("un « non » dont la mesure reste loin de la nouvelle référence reste refusé, avec les écarts recalculés", () => {
    const e = ecartHorsReference(prise(ANCIENNE_REF, false));
    expect(e).toContain("hauteur");
    expect(e).toContain("(toléré 8 %)");
    expect(verdictVoixFaite(etatVoix(prise(ANCIENNE_REF, false)))).toMatchObject({ statut: "refus", controle: "Q16" });
  });
});
