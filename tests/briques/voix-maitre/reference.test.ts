/**
 * VOIX DE RÉFÉRENCE (14/10) : la mesure de `studio-rendu` (portage de `docs/voix-reference/comparer-voix.py`) redonne
 * les constantes de la référence, et la comparaison PURE (tolérances, meilleure prise, réglage, lectures au plus).
 */
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { choisirMeilleurePrise, CLES_MESURE_VOIX, comparerAReference, lecturesVoixMax, lireReglageRessemblance, mesureVoixDesMesures, REFERENCE_V4, type MesureVoix } from "@/briques/voix-maitre/reference";
import { FREQUENCE_MESURE_VOIX, mesurerVoix, mesurerVoixFichier, mesuresVoixAPlat } from "../../../studio-rendu/src/audio/voix";
import { nettoyerFichier } from "../../../studio-rendu/src/operations/nettoyage-audio";

const REF = "docs/voix-reference/voix-reference-v4-25-30s.wav";
const ffmpegPresent = spawnSync("ffmpeg", ["-version"]).status === 0;

describe("mesure d'une voix (studio-rendu)", () => {
  it("un sinus de 150 Hz donne une hauteur ≈ 150 Hz, sans variation, tout en parole", () => {
    const x = new Float32Array(2 * FREQUENCE_MESURE_VOIX);
    for (let i = 0; i < x.length; i++) x[i] = 0.3 * Math.sin((2 * Math.PI * 150 * i) / FREQUENCE_MESURE_VOIX);
    const m = mesurerVoix(x);
    expect(Math.abs(m.hauteurHz - 150)).toBeLessThan(2);
    expect(m.variationHz).toBeLessThan(0.5);
    expect(m.partieParole).toBe(1);
    expect(m.energie).toBeCloseTo(0.3 / Math.SQRT2, 2);
  });

  it("un silence : aucune parole, hauteur illisible (jamais « ressemblant »)", () => {
    const m = mesurerVoix(new Float32Array(FREQUENCE_MESURE_VOIX));
    // Mesure version 2 (15/10) : sans aucune fenêtre de parole, la part de parole est illisible (NaN).
    expect(Number.isNaN(m.partieParole)).toBe(true);
    expect(Number.isNaN(m.hauteurHz)).toBe(true);
    expect(comparerAReference(m).ressemblante).toBe(false);
    // Une mesure illisible n'entre pas dans l'état d'un rendu (des nombres seulement).
    expect(Object.keys(mesuresVoixAPlat(m))).not.toContain("voix.hauteurHz");
  });

  // Skippé : média retiré de la version publique (voix de référence).
  it.skip("le WAV de référence redonne les constantes de la référence à ± 3 %", async () => {
    const m = await mesurerVoixFichier(REF);
    for (const k of CLES_MESURE_VOIX) expect(Math.abs(m[k] - REFERENCE_V4[k]) / REFERENCE_V4[k], k).toBeLessThanOrEqual(0.03);
    expect(comparerAReference(m).ressemblante).toBe(true);
  });

  it.skip("opération nettoyage-audio, mode « mesure-voix » : les six mesures à plat, relues par le studio", async () => {
    const r = await nettoyerFichier(REF, { mode: "mesure-voix" });
    expect(r.wav).toBeUndefined();
    expect(r.mesures.dureeSec).toBeCloseTo(5, 1);
    const m = mesureVoixDesMesures(r.mesures);
    expect(m).not.toBeNull();
    expect(comparerAReference(m!).ressemblante).toBe(true);
  });
});

describe("comparaison à la référence (pur)", () => {
  const ref: MesureVoix = { ...REFERENCE_V4 };
  it("la référence est ressemblante ; l'essai du 14/10 (hauteur +9 %, variation +22 %) ne l'est pas", () => {
    expect(comparerAReference(ref)).toEqual({ ressemblante: true, ecarts: [] });
    const essai = comparerAReference({ ...ref, hauteurHz: ref.hauteurHz * 1.09, variationHz: ref.variationHz * 1.22 });
    expect(essai.ressemblante).toBe(false);
    expect(essai.ecarts.map((e) => e.mesure)).toEqual(["hauteurHz"]);
    expect(essai.ecarts[0].libelle).toBe("hauteur +9 % (toléré 8 %)");
  });

  it("meilleure prise : le plus petit écart pondéré ; aucune prise : -1", () => {
    const loin = { mesure: { ...ref, hauteurHz: ref.hauteurHz * 1.15 } };
    const proche = { mesure: { ...ref, hauteurHz: ref.hauteurHz * 1.09 } };
    const illisible = { mesure: { ...ref, hauteurHz: Number.NaN } };
    expect(choisirMeilleurePrise([loin, proche, illisible])).toBe(1);
    expect(choisirMeilleurePrise([illisible, loin])).toBe(1);
    expect(choisirMeilleurePrise([])).toBe(-1);
  });

  it("mesures à plat incomplètes : null", () => {
    expect(mesureVoixDesMesures({ "voix.hauteurHz": 150 })).toBeNull();
    expect(mesureVoixDesMesures(undefined)).toBeNull();
  });

  it("réglage : actif par défaut avec 1 relance (2 lectures), plafond réglable à 2 relances ; coupé = une lecture", () => {
    expect(lireReglageRessemblance(undefined)).toEqual({ actif: true, relancesMax: 1 });
    expect(lireReglageRessemblance({ actif: true })).toEqual({ actif: true, relancesMax: 1 });
    expect(lecturesVoixMax(lireReglageRessemblance(undefined))).toBe(2);
    expect(lecturesVoixMax(lireReglageRessemblance({ actif: true, relancesMax: 2 }))).toBe(3);
    expect(lireReglageRessemblance({ actif: true, relancesMax: 9 })).toEqual({ actif: true, relancesMax: 2 });
    expect(lireReglageRessemblance({ actif: false, relancesMax: 1 })).toEqual({ actif: false, relancesMax: 1 });
    expect(lecturesVoixMax({ actif: true, relancesMax: 2 })).toBe(3);
    expect(lecturesVoixMax({ actif: true, relancesMax: 1 })).toBe(2);
    expect(lecturesVoixMax({ actif: false, relancesMax: 2 })).toBe(1);
    expect(lecturesVoixMax(undefined)).toBe(1);
  });
});
