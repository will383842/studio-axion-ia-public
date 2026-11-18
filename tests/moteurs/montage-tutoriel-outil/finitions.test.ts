import { describe, expect, it } from "vitest";
import type { CommandeFabrication } from "@/domaine/types";
import { CIBLE_LUFS_DEFAUT, CRETE_MAX_DEFAUT_DBTP, TOLERANCE_LUFS_TUTORIEL, cibleSon, lireMesure, parametresMesure, parametresMixage, parametresVignette, rapportSon } from "@/moteurs/montage-tutoriel-outil/finitions";

const commande = (profilSon: unknown): Pick<CommandeFabrication, "styles"> => ({ styles: { sousTitres: null, decor: null, profilSon, lut: null, musique: null } }) as never;
const CIBLE = { lufs: -14, creteVraieMaxDbtp: -1.5 };

describe("finitions du tutoriel : cible et paramètres", () => {
  it("cibleSon : profil absent → −14 / −1,5 ; profil −16 → −16", () => {
    expect(cibleSon(commande(null))).toEqual({ lufs: CIBLE_LUFS_DEFAUT, creteVraieMaxDbtp: CRETE_MAX_DEFAUT_DBTP });
    expect(cibleSon(commande({ valeur: { niveauCibleLufs: -16 } }))).toEqual({ lufs: -16, creteVraieMaxDbtp: -1.5 });
    expect(TOLERANCE_LUFS_TUTORIEL).toBe(0.5);
  });
  it("paramètres : mixage sur la durée de la voix, mesure sans pauses, vignette sans couverture", () => {
    expect(parametresMixage(CIBLE, 12)).toEqual({ lufs: -14, creteVraieMaxDbtp: -1.5, dureeSec: 12 });
    expect(parametresMesure()).toEqual({ pauses: [] });
    const v = parametresVignette("4:5", 20);
    expect(v).toEqual({ gabarit: "image-video-v3", ratio: "4:5", dureeSec: 20, instantSec: 0 });
    expect("couverture" in v).toBe(false);
  });
  it("lireMesure : seulement des nombres finis", () => {
    expect(lireMesure({ lufs: -14.2 })).toEqual({ lufs: -14.2 });
    expect(lireMesure({ lufs: -14, creteVraieDbtp: -2 })).toEqual({ lufs: -14, creteVraieDbtp: -2 });
    expect(lireMesure({ lufs: Number.NaN })).toBeNull();
    expect(lireMesure({ lufs: "-14" })).toBeNull();
    expect(lireMesure(null)).toBeNull();
    expect(lireMesure(undefined)).toBeNull();
  });
});

describe("finitions du tutoriel : rapportSon dit le vrai", () => {
  it("−14,3 : vérifié, valeur mesurée arrondie au dixième", () => {
    expect(rapportSon({ lufs: -14.3 }, CIBLE, true)).toEqual({ niveauSonoreLufs: -14.3, sonVerifie: true });
    expect(rapportSon({ lufs: -14.26 }, CIBLE, true).niveauSonoreLufs).toBe(-14.3);
  });
  it("−12,9 : non vérifié, alerte avec la valeur mesurée", () => {
    const r = rapportSon({ lufs: -12.9 }, CIBLE, true);
    expect(r.sonVerifie).toBe(false);
    expect(r.niveauSonoreLufs).toBe(-12.9);
    expect(r.alerte).toContain("−12,9");
    expect(r.alerte).toContain("−14");
  });
  it("crête trop haute : non vérifié", () => {
    expect(rapportSon({ lufs: -14, creteVraieDbtp: -0.5 }, CIBLE, true).sonVerifie).toBe(false);
  });
  it("pas de mesure : la cible, non vérifié, « non mesuré »", () => {
    const r = rapportSon(null, CIBLE, true);
    expect(r).toMatchObject({ niveauSonoreLufs: -14, sonVerifie: false });
    expect(r.alerte).toContain("non mesuré");
  });
  it("vidéo muette : non vérifié", () => {
    const r = rapportSon({ lufs: -14 }, CIBLE, false);
    expect(r.sonVerifie).toBe(false);
    expect(r.alerte).toContain("sans voix");
  });
});
