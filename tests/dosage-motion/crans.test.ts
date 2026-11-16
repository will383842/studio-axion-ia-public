import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DOSAGES } from "@/briques/dosage-motion/types";
import type { IdGenerateurDosage, RetraitsDosage } from "@/briques/dosage-motion/types";
import {
  NIVEAU_DU_DOSAGE, RETRAITS, CRANS_PERMIS, DOSAGE_DEFAUT_CODE, PHRASE_CRAN_GRISE,
} from "@/briques/dosage-motion/crans";

const NIVEAUX = ["sobre", "equilibre", "tres-dynamique"];
const GENERATEURS = Object.keys(CRANS_PERMIS) as IdGenerateurDosage[];

describe("dosage-motion : table des crans", () => {
  it("4 crans distincts", () => {
    expect([...DOSAGES]).toEqual(["aucun", "sobre", "equilibre", "dynamique"]);
    expect(new Set(DOSAGES).size).toBe(4);
  });
  it("NIVEAU_DU_DOSAGE ne rend que des NiveauIntensite", () => {
    expect(NIVEAU_DU_DOSAGE).toEqual({ aucun: "sobre", sobre: "sobre", equilibre: "equilibre", dynamique: "tres-dynamique" });
    for (const d of DOSAGES) expect(NIVEAUX).toContain(NIVEAU_DU_DOSAGE[d]);
  });
  it("aucun cran ne retire les sous-titres (pas de champ)", () => {
    const cles = Object.keys(RETRAITS.aucun).sort();
    expect(cles).toEqual(["bandeauNom", "bruitagesParDefaut", "cartes", "effetsSpeciaux", "illustrations", "texteEcran", "transitions", "zooms"]);
    for (const d of DOSAGES) {
      expect(Object.keys(RETRAITS[d]).some((k) => /sous-?titre|segments/i.test(k))).toBe(false);
    }
  });
  it("seul aucun retire", () => {
    const r: RetraitsDosage = RETRAITS.aucun;
    expect(r).toEqual({ cartes: true, illustrations: true, texteEcran: true, zooms: true, transitions: "franches", bandeauNom: true, effetsSpeciaux: true, bruitagesParDefaut: "aucun" });
    for (const d of ["sobre", "equilibre", "dynamique"] as const) {
      expect(RETRAITS[d]).toMatchObject({ cartes: false, illustrations: false, texteEcran: false, zooms: false, bandeauNom: false, effetsSpeciaux: false, bruitagesParDefaut: "reglage" });
    }
    expect(RETRAITS.sobre.transitions).toBe("douces");
    expect(RETRAITS.equilibre.transitions).toBe("inchangees");
    expect(RETRAITS.dynamique.transitions).toBe("inchangees");
  });
  it("chaque défaut est dans les crans permis", () => {
    for (const g of GENERATEURS) expect(CRANS_PERMIS[g]).toContain(DOSAGE_DEFAUT_CODE[g]);
  });
  it("défauts : équilibré partout, dynamique en v4", () => {
    for (const g of GENERATEURS) expect(DOSAGE_DEFAUT_CODE[g]).toBe(g === "facecam-animee" ? "dynamique" : "equilibre");
  });
  it("v4 n'a que dynamique", () => {
    expect(CRANS_PERMIS["facecam-animee"]).toEqual(["dynamique"]);
  });
  it("aucun absent de cas concret, tableau, image-vidéo ; présent ailleurs", () => {
    for (const g of ["cas-concret", "tableau", "image-video"] as const) {
      expect(CRANS_PERMIS[g]).toEqual(["sobre", "equilibre", "dynamique"]);
    }
    for (const g of ["avocat", "facecam", "demo-facecam", "tutoriel-outil"] as const) {
      expect(CRANS_PERMIS[g]).toEqual([...DOSAGES]);
    }
  });
  it("les 8 générateurs", () => {
    expect(GENERATEURS.sort()).toEqual(["avocat", "cas-concret", "demo-facecam", "facecam", "facecam-animee", "image-video", "tableau", "tutoriel-outil"]);
  });
  it("phrases du cran grisé", () => {
    expect(PHRASE_CRAN_GRISE.animations).toBe("Ce générateur est fait d'animations : on peut les calmer, pas les retirer.");
    expect(PHRASE_CRAN_GRISE.v4).toBe("Rendu validé : la v4 reste telle quelle. Pour une vidéo face caméra sans animation, choisissez Face caméra.");
  });
  it("garde statique : brique pure", () => {
    const dir = join(process.cwd(), "src/briques/dosage-motion");
    for (const f of ["types.ts", "crans.ts", "index.ts"]) {
      const src = readFileSync(join(dir, f), "utf8");
      const imports = src.split("\n").filter((l) => /^\s*(import|export)\b.*\bfrom\b/.test(l)).join("\n");
      expect(imports).not.toMatch(/@\/services\/|studio-rendu|credits|couts|depense|budget/);
      expect(src).not.toMatch(/\bDate\b|Math\.random/);
    }
  });
});
