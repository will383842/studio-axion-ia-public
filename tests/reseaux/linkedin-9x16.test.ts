/**
 * Décision de Will (24/10/2026, « fais tout selon tes recommandations ») : pour Image → vidéo SEULEMENT, LinkedIn et le fil
 * Facebook sortent en 4:5, Instagram et le Reel Facebook en 9:16. Cela REMPLACE, pour ce générateur, la décision du 19/10
 * « LinkedIn en 9:16 » (#580). Les autres générateurs gardent LinkedIn en 9:16 (`ratioPrefere`, `formatsVoulus`, etc.).
 * Remplace aussi la décision du 18/10 « LinkedIn = 4:5 partout ».
 */
import { describe, expect, it } from "vitest";
import type { Ratio } from "@/domaine/types";
import { formatsVoulus, meilleureSortie, sortiesVoulues } from "@/reseaux/sorties";
import { ratiosDeLaMere } from "@/briques/declinaison";
import { obtenirReseau } from "@/reseaux";
import { FORMATS_PAR_RESEAU_IV, reseauxParFormatIV } from "@/moteurs/montage-image-video/fabrication";

const TOUS: Ratio[] = ["9:16", "4:5", "1:1"];

describe("LinkedIn en 9:16 (autres générateurs) · 4:5 pour Image → vidéo", () => {
  it("le format préféré de LinkedIn est le 9:16", () => {
    expect(obtenirReseau("linkedin").ratioPrefere).toBe("9:16");
  });

  it("formatsVoulus : pas de 4:5 ajouté pour LinkedIn", () => {
    expect(formatsVoulus(["9:16"], ["linkedin", "instagram"], TOUS)).toEqual(["9:16"]);
  });

  it("ratiosDeLaMere : 9:16 seul, la case 4:5 cochée est respectée", () => {
    expect(ratiosDeLaMere([], ["linkedin"], TOUS)).toEqual(["9:16"]);
    expect(ratiosDeLaMere(["4:5"], ["linkedin"], TOUS)).toEqual(["9:16", "4:5"]);
  });

  it("sortiesVoulues : deux fichiers 9:16 (au mot, et sans appel au mot)", () => {
    const sorties = sortiesVoulues(["linkedin", "instagram", "tiktok", "youtube-shorts"]);
    expect(sorties.map((s) => ({ ratio: s.ratio, appelAuMot: s.appelAuMot, libelle: s.libelle, reseaux: s.reseaux }))).toEqual([
      { ratio: "9:16", appelAuMot: true, libelle: "9:16", reseaux: ["instagram"] },
      { ratio: "9:16", appelAuMot: false, libelle: "9:16 · sans appel au mot", reseaux: ["linkedin", "tiktok", "youtube-shorts"] },
    ]);
  });

  it("meilleureSortie : une ancienne vidéo 4:5 reste livrable à LinkedIn", () => {
    const ancienne = { ratio: "4:5" as Ratio, appelAuMot: false, reseaux: ["linkedin" as const] };
    expect(meilleureSortie("linkedin", [ancienne])).toBe(ancienne);
  });

  it("image → vidéo (décision du 24/10) : LinkedIn en 4:5, Facebook 9:16 + 4:5, Instagram en 9:16", () => {
    expect(FORMATS_PAR_RESEAU_IV.linkedin).toEqual(["4:5"]);
    expect(FORMATS_PAR_RESEAU_IV.facebook).toEqual(["9:16", "4:5"]);
    expect(FORMATS_PAR_RESEAU_IV.instagram).toEqual(["9:16"]);
    expect(reseauxParFormatIV(["linkedin", "facebook"])).toEqual([
      { format: "9:16", reseaux: ["facebook"] },
      { format: "4:5", reseaux: ["linkedin", "facebook"] },
    ]);
  });
});
