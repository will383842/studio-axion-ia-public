/** VL-03 : fiche du format « Vidéo longue » (masquée, inscrite dans `formats/index.ts`, absente des listes et de la navigation). */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { listerFormats, listerFormatsNavigation } from "@/formats";
import { MOTIF_CODE_FORMAT, codeDuFormat, entreeDuCode, listerCodes } from "@/formats/registre-codes";
import { CODE_FORMAT_VIDEO_LONGUE, ID_FORMAT_VIDEO_LONGUE, formatVideoLongue } from "@/formats/video-longue";

describe("format video-longue (VL-03)", () => {
  it("a une fiche valide : masquée, 16:9, une seule voix, aucune musique", () => {
    const f = formatVideoLongue;
    expect(f.id).toBe("video-longue");
    expect(f.statut).toBe("masque");
    expect(f.ouvertDansLaNavigation).toBe(true);
    expect(f.reserveAWill).toBeUndefined();
    expect(f.adresseCreation).toBe("/videos/longue");
    expect(f.ratios).toEqual(["16:9"]);
    expect(f.ratioMaitre).toBe("16:9");
    expect(f.musique).toBe("interdite");
    expect(f.moteur).toBe("montage-video-longue");
    expect(f.codeClassement).toBe(CODE_FORMAT_VIDEO_LONGUE);
    expect(f.reglages.schema.parse({})).toEqual({});
    expect(f.recetteScript.blocs.length).toBeGreaterThan(0);
    expect(f.recetteScript.motsParSeconde).toBeGreaterThan(0);
  });

  it("a une adresse de création qui a une page", () => {
    expect(existsSync(join(process.cwd(), "src/app/(studio)/videos/longue/page.tsx"))).toBe(true);
  });

  it("prend sa durée du script : zone 240-720 s, au-delà une remarque, jamais un refus", () => {
    const d = formatVideoLongue.durees;
    if (d.mode !== "depuis-script") throw new Error("la durée doit venir du script");
    expect(d.zoneSec).toEqual([240, 720]);
    expect(d.zoneOrangeSec[0]).toBe(d.zoneSec[1]);
    expect(d.cibleParDefautSec).toBeGreaterThanOrEqual(d.zoneSec[0]);
    expect(d.cibleParDefautSec).toBeLessThanOrEqual(d.zoneSec[1]);
    for (const c of d.ciblesGenerationSec) {
      expect(c).toBeGreaterThanOrEqual(d.zoneSec[0]);
      expect(c).toBeLessThanOrEqual(d.zoneSec[1]);
    }
  });

  it("a un code unique, VL, rattaché au format, bien formé", () => {
    expect(ID_FORMAT_VIDEO_LONGUE).toBe("video-longue");
    expect(CODE_FORMAT_VIDEO_LONGUE).toBe("VL");
    expect(MOTIF_CODE_FORMAT.test("VL")).toBe(true);
    expect(codeDuFormat("video-longue")).toBe("VL");
    expect(entreeDuCode("VL")?.formatId).toBe("video-longue");
    expect(listerCodes().filter((e) => e.code === "VL")).toHaveLength(1);
    const codes = listerCodes().map((e) => e.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("ne change aucun autre format : inscrit en « masque », absent des listes, présent dans la navigation, fiches existantes intactes", () => {
    expect(listerFormats({ inclureMasques: true }).some((f) => f.id === "video-longue")).toBe(true);
    expect(listerFormats({ inclureMasques: true }).find((f) => f.id === "video-longue")?.statut).toBe("masque");
    expect(listerFormats().some((f) => f.id === "video-longue")).toBe(false);
    expect(listerFormatsNavigation().some((f) => f.id === "video-longue")).toBe(true);
    for (const f of listerFormats({ inclureMasques: true })) expect(f.codeClassement).toBe(codeDuFormat(f.id));
    expect(codeDuFormat("avocat")).toBe("AV");
    expect(codeDuFormat("visuel")).toBe("VS");
  });

  it("s'adresse à l'utilisateur au vouvoiement, sans couleur ni police en dur", () => {
    const textes = JSON.stringify([formatVideoLongue.description, formatVideoLongue.accroche, formatVideoLongue.recetteScript, formatVideoLongue.aFournir]);
    expect(textes).not.toMatch(/\b(tu|ton|ta|tes|toi)\b/i);
    expect(textes).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});
