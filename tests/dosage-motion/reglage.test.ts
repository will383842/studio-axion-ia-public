import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CLE_ACTIF, CLE_DEFAUTS, dosageActif, defautsLus, dosageRetenu } from "@/briques/dosage-motion/reglage";
import { DOSAGE_DEFAUT_CODE } from "@/briques/dosage-motion/crans";

const lireVal = (v: unknown) => async () => v;
const lireEchec = async () => { throw new Error("lecture en échec"); };

describe("dosage-motion : réglages", () => {
  it("clés", () => {
    expect(CLE_ACTIF).toBe("dosageMotion.actif");
    expect(CLE_DEFAUTS).toBe("dosageMotion.defauts");
  });
  it("dosageActif : seul true exact allume", async () => {
    expect(await dosageActif(lireVal(true))).toBe(true);
    for (const v of ["true", 1, null, undefined, false, {}, "oui"]) expect(await dosageActif(lireVal(v))).toBe(false);
    expect(await dosageActif(lireEchec)).toBe(false);
  });
  it("dosageActif : lit la bonne clé avec défaut false", async () => {
    const vus: unknown[][] = [];
    await dosageActif(async (id, d) => { vus.push([id, d]); return d; });
    expect(vus).toEqual([["dosageMotion.actif", false]]);
  });
  it("defautsLus : valeurs valides gardées, inconnues ou non permises = défaut du code", async () => {
    const r = await defautsLus(lireVal({ avocat: "sobre", tableau: "aucun", "cas-concret": "bizarre", facecam: 3, "facecam-animee": "sobre", "demo-facecam": "aucun" }));
    expect(r.avocat).toBe("sobre");
    expect(r.tableau).toBe(DOSAGE_DEFAUT_CODE.tableau);
    expect(r["cas-concret"]).toBe(DOSAGE_DEFAUT_CODE["cas-concret"]);
    expect(r.facecam).toBe(DOSAGE_DEFAUT_CODE.facecam);
    expect(r["facecam-animee"]).toBe("dynamique");
    expect(r["demo-facecam"]).toBe("aucun");
    expect(r["image-video"]).toBe("equilibre");
  });
  it("defautsLus : absent, non objet, échec = tous les défauts du code", async () => {
    for (const l of [lireVal(undefined), lireVal(null), lireVal("x"), lireVal([1]), lireEchec]) {
      expect(await defautsLus(l)).toEqual(DOSAGE_DEFAUT_CODE);
    }
  });
  it("dosageRetenu : priorité vidéo > générateur > code", () => {
    expect(dosageRetenu({ choixVideo: "sobre", defautGenerateur: "dynamique", generateur: "avocat" })).toEqual({ dosage: "sobre", ramene: false });
    expect(dosageRetenu({ defautGenerateur: "dynamique", generateur: "avocat" })).toEqual({ dosage: "dynamique", ramene: false });
    expect(dosageRetenu({ generateur: "avocat" })).toEqual({ dosage: "equilibre", ramene: false });
    expect(dosageRetenu({ choixVideo: "aucun", generateur: "avocat" })).toEqual({ dosage: "aucun", ramene: false });
  });
  it("dosageRetenu : aucun en tableau → défaut du générateur, ramene true", () => {
    expect(dosageRetenu({ choixVideo: "aucun", defautGenerateur: "sobre", generateur: "tableau" })).toEqual({ dosage: "sobre", ramene: true });
    expect(dosageRetenu({ choixVideo: "aucun", generateur: "tableau" })).toEqual({ dosage: "equilibre", ramene: true });
    expect(dosageRetenu({ choixVideo: "aucun", defautGenerateur: "aucun", generateur: "tableau" })).toEqual({ dosage: "equilibre", ramene: true });
  });
  it("dosageRetenu : v4 toujours dynamique", () => {
    for (const choixVideo of [undefined, "aucun", "sobre", "equilibre"] as const) {
      expect(dosageRetenu({ choixVideo, defautGenerateur: "sobre", generateur: "facecam-animee" }).dosage).toBe("dynamique");
    }
    expect(dosageRetenu({ choixVideo: "sobre", generateur: "facecam-animee" }).ramene).toBe(true);
    expect(dosageRetenu({ choixVideo: "dynamique", generateur: "facecam-animee" }).ramene).toBe(false);
  });
  it("dosageRetenu : valeur inconnue ignorée", () => {
    expect(dosageRetenu({ choixVideo: "zzz" as never, generateur: "avocat" })).toEqual({ dosage: "equilibre", ramene: true });
  });
  it("garde statique : pur, aucun service, aucun hasard", () => {
    const src = readFileSync(join(process.cwd(), "src/briques/dosage-motion/reglage.ts"), "utf8");
    expect(src).not.toMatch(/@\/services\/|studio-rendu|Math\.random|Date\./);
  });
});
