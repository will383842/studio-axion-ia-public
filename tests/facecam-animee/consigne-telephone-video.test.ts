/** C4-U4.9b-a : bloc de consigne du téléphone qui joue un extrait et lecture du réglage (purs, non branchés). */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { PREFIXE_AXION } from "@/moteurs/montage-facecam-animee/extraits-maison/recherche";
import { DUREE_MIN_EXTRAIT_V4_SEC } from "@/moteurs/montage-facecam-animee/extraits-maison/types";
import {
  PARAM_TELEPHONE_VIDEO_FA,
  blocTelephoneVideo,
  telephoneVideoActif,
} from "@/moteurs/montage-facecam-animee/realisateur/consigne-telephone-video";

const FICHIER_NEUF = "src/moteurs/montage-facecam-animee/realisateur/consigne-telephone-video.ts";

describe("telephoneVideoActif", () => {
  it("seul true allume", async () => {
    expect(await telephoneVideoActif(async () => true)).toBe(true);
    for (const v of [undefined, false, "true", 1]) {
      expect(await telephoneVideoActif(async () => v)).toBe(false);
    }
  });

  it("une lecture qui lève éteint", async () => {
    expect(await telephoneVideoActif(async () => { throw new Error("panne"); })).toBe(false);
  });

  it("lit le bon réglage une seule fois avec le défaut false", async () => {
    const lire = vi.fn(async () => false);
    await telephoneVideoActif(lire);
    expect(lire).toHaveBeenCalledTimes(1);
    expect(lire).toHaveBeenCalledWith("facecamAnimee.telephoneVideo", false);
    expect(PARAM_TELEPHONE_VIDEO_FA).toBe("facecamAnimee.telephoneVideo");
  });
});

describe("blocTelephoneVideo", () => {
  it.each([undefined, null, false, "true", 1, {}])("éteint (%j) : chaîne vide", (v) => {
    expect(blocTelephoneVideo(v)).toBe("");
  });

  it("allumé : id, préfixe axion: et durée minimale", () => {
    const t = blocTelephoneVideo(true);
    expect(t).toContain("telephone-video");
    expect(t).toContain(PREFIXE_AXION);
    expect(t).toContain(String(DUREE_MIN_EXTRAIT_V4_SEC));
    const lignes = t.split("\n").length;
    expect(lignes).toBeGreaterThanOrEqual(4);
    expect(lignes).toBeLessThanOrEqual(6);
  });

  it("aucune mention de son", () => {
    expect(blocTelephoneVideo(true)).not.toMatch(/son|musique|bruit/i);
  });

  it("déterministe", () => {
    expect(blocTelephoneVideo(true)).toBe(blocTelephoneVideo(true));
  });

  it("l'id cité est celui du rendu (lu dans le texte, sans import)", () => {
    const rendu = readFileSync(
      join(process.cwd(), ["studio-rendu", "compositions", "interface-claire", "motion-v4", "lot6", "rendus-lot6.tsx"].join("/")),
      "utf8",
    );
    const m = rendu.match(/export const ID_TELEPHONE_VIDEO = "([^"]+)"/);
    expect(m).not.toBeNull();
    expect(blocTelephoneVideo(true)).toContain(m![1]);
  });
});

describe("rien n'est branché", () => {
  it("aucun fichier de src/ n'importe le fichier neuf", () => {
    const cites: string[] = [];
    const parcourir = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) parcourir(p);
        else if (/\.(ts|tsx)$/.test(n) && !p.endsWith("consigne-telephone-video.ts") && readFileSync(p, "utf8").includes("consigne-telephone-video")) cites.push(p);
      }
    };
    parcourir(join(process.cwd(), "src"));
    // MAJ 2026-11-17 (BR-TELEPHONE-a, branchement voulu par le pilote) : la liste vide devient la liste EXACTE des 2 importeurs de la fiche (chaine-v4.ts ne l importe pas, il reçoit un booléen) ; tout autre importeur reste refusé.
    expect(cites.map((c) => c.slice(process.cwd().length + 1).split("\\").join("/")).sort()).toEqual([
      "src/moteurs/montage-facecam-animee/realisateur/index.ts",
      "src/services/facecam-animee.ts",
    ]);
  });

  it("garde statique du fichier neuf", () => {
    const src = readFileSync(join(process.cwd(), FICHIER_NEUF), "utf8");
    expect(src).not.toContain("lireParametre");
    for (const interdit of ["server-only", "@/services/", "studio-rendu", "@/fournisseurs/", "Date.now", "Math.random"]) {
      expect(src).not.toContain(interdit);
    }
  });
});
