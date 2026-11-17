/** X3-07 : le cran « Sobre » / « Dynamique » est branché dans le cas concret et le tableau (tout éteint sans cran). */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { appliquerContraintes, contraintesDosageCasConcret } from "@/moteurs/montage-cas-concret/dosage";
import { intensiteSousTitresTableau } from "@/moteurs/montage-tableau/dosage";
import { tirer, type Tirage } from "@/moteurs/montage-cas-concret/variete";

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), "utf8");
const FABRIQUER = lire("src/moteurs/montage-cas-concret/fabriquer.ts");
const INDEX_CAS = lire("src/moteurs/montage-cas-concret/index.ts");
const INDEX_TABLEAU = lire("src/moteurs/montage-tableau/index.ts");

const tirages = (): Tirage[] => Array.from({ length: 20 }, (_, i) => tirer({ videoId: `video-x3-07-${i}`, canaux: ["linkedin", "youtube-shorts"], historique: [] }));

/** Le chemin de fabriquer.ts : `if (o.dosage) tirage = appliquerContraintes(tirage, contraintesDosageCasConcret(o.dosage))`. */
const chemin = (t: Tirage, dosage?: "sobre" | "equilibre" | "dynamique") => (dosage ? appliquerContraintes(t, contraintesDosageCasConcret(dosage)) : t);

/** Le branchement de montage-tableau/index.ts (copie de la ligne, garde `reste.intensiteSousTitres === undefined` comprise). */
const outilsTableau = (cran: "sobre" | "equilibre" | "dynamique" | undefined, actuelle: "sobre" | "equilibre" | "dynamique" | "tres-dynamique" | undefined, reste?: "sobre") =>
  ((n) => (reste === undefined && n ? { intensiteSousTitres: n } : {}))(intensiteSousTitresTableau(cran, actuelle));

describe("X3-07 · cas concret : tirage", () => {
  it("éteint = identique sur 20 graines", () => {
    for (const t of tirages()) expect(chemin(t, undefined)).toBe(t);
  });
  it("sobre : calme, légère, fond fort 0 ; tout le reste identique", () => {
    for (const t of tirages()) {
      const d = chemin(t, "sobre");
      expect(d.sousTitres.intensite).toBe("calme");
      expect(d.particules.densite).toBe("legere");
      expect(d.fondFort).toBe(0);
      expect({ ...d, sousTitres: { ...d.sousTitres, intensite: 0 }, particules: { ...d.particules, densite: 0 }, fondFort: 0 }).toEqual({ ...t, sousTitres: { ...t.sousTitres, intensite: 0 }, particules: { ...t.particules, densite: 0 }, fondFort: 0 });
    }
  });
  it("dynamique : sous-titres vifs, le reste identique ; équilibre : identique", () => {
    for (const t of tirages()) {
      const d = chemin(t, "dynamique");
      expect(d.sousTitres.intensite).toBe("vif");
      expect({ ...d, sousTitres: { ...d.sousTitres, intensite: 0 } }).toEqual({ ...t, sousTitres: { ...t.sousTitres, intensite: 0 } });
      expect(chemin(t, "equilibre")).toEqual(t);
    }
  });
  it("fabriquer.ts applique les contraintes après le tirage, aux deux endroits, sans toucher au hasard", () => {
    expect(FABRIQUER).toContain('import { appliquerContraintes, contraintesDosageCasConcret } from "./dosage";');
    expect(FABRIQUER.match(/if \(o\.dosage\) tirage = appliquerContraintes\(tirage, contraintesDosageCasConcret\(o\.dosage\)\);/g)).toHaveLength(2);
    expect(FABRIQUER.indexOf("structure: structureEffective(cas.offre, tirage.structure) };")).toBeLessThan(FABRIQUER.indexOf("if (o.dosage) tirage ="));
  });
});

describe("X3-07 · cas concret : index.ts", () => {
  const ligne = INDEX_CAS.split("\n").find((l) => l.includes("dosage: c"))!;
  const options = (cran: unknown) => (new Function("commande", `return ${ligne.trim().replace(/^\.\.\./, "").replace(/,$/, "")};`)({ dosageMotion: cran === undefined ? undefined : { cran } }) as { dosage?: string } | undefined);
  it("une seule ligne, à côté de styleVarie", () => {
    expect(ligne).toBeTruthy();
    expect(INDEX_CAS.split("\n").filter((l) => l.includes("dosage: c"))).toHaveLength(1);
  });
  it("sans dosageMotion : aucune clé dosage ; aucun (forgé) : aucune clé, jamais d'erreur ; sobre : dosage sobre", () => {
    expect(options(undefined)).toEqual({});
    expect("dosage" in (options("aucun") ?? {})).toBe(false);
    expect(options("sobre")).toEqual({ dosage: "sobre" });
    expect(options("dynamique")).toEqual({ dosage: "dynamique" });
    expect(options("equilibre")).toEqual({ dosage: "equilibre" });
  });
});

describe("X3-07 · tableau", () => {
  it("la ligne garde la condition reste.intensiteSousTitres === undefined et utilise le cran", () => {
    expect(INDEX_TABLEAU).toContain('import { intensiteSousTitresTableau } from "./dosage";');
    expect(INDEX_TABLEAU).toContain("reste.intensiteSousTitres === undefined && n ? { intensiteSousTitres: n } : {}))(intensiteSousTitresTableau(commande.dosageMotion?.cran, commande.sousTitres?.intensite))");
  });
  it("sans cran : intensité actuelle, présente ou absente", () => {
    expect(outilsTableau(undefined, undefined)).toEqual({});
    expect(outilsTableau(undefined, "sobre")).toEqual({ intensiteSousTitres: "sobre" });
  });
  it("dynamique sans sousTitres : tres-dynamique ; equilibre avec actuelle sobre : sobre ; outils fournis : ils l'emportent", () => {
    expect(outilsTableau("dynamique", undefined)).toEqual({ intensiteSousTitres: "tres-dynamique" });
    expect(outilsTableau("equilibre", "sobre")).toEqual({ intensiteSousTitres: "sobre" });
    expect(outilsTableau("dynamique", undefined, "sobre")).toEqual({});
  });
});

describe("X3-07 · les sous-titres restent", () => {
  it("chaque cran garde une intensité de sous-titres valide (jamais de sous-titres coupés)", () => {
    for (const t of tirages()) for (const c of ["sobre", "equilibre", "dynamique"] as const) expect(chemin(t, c).sousTitres.intensite).toBeTruthy();
    for (const c of ["sobre", "equilibre", "dynamique"] as const) expect(intensiteSousTitresTableau(c, "equilibre")).toBeTruthy();
  });
});
