/** X3-07 : le cran « Sobre » / « Dynamique » est branché dans le cas concret et le tableau (tout éteint sans cran). */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { tirageDose } from "@/moteurs/montage-cas-concret/fabriquer";
import { variationSousTitresCasConcret } from "@/moteurs/montage-cas-concret/sous-titres-variete";
import { fabriquerSousTitres } from "@/briques/sous-titres";
import { intensiteSousTitresTableau } from "@/moteurs/montage-tableau/dosage";
import type { NiveauIntensite } from "@/domaine/types";
import { tirer, type Tirage } from "@/moteurs/montage-cas-concret/variete";

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), "utf8");
const FABRIQUER = lire("src/moteurs/montage-cas-concret/fabriquer.ts");
const INDEX_CAS = lire("src/moteurs/montage-cas-concret/index.ts");
const INDEX_TABLEAU = lire("src/moteurs/montage-tableau/index.ts");

const tirages = (): Tirage[] => Array.from({ length: 20 }, (_, i) => tirer({ videoId: `video-x3-07-${i}`, canaux: ["linkedin", "youtube-shorts"], historique: [] }));

/** Le vrai code de fabriquer.ts (exporté), appelé aux 2 endroits du moteur. */
const chemin = (t: Tirage, dosage?: "sobre" | "equilibre" | "dynamique") => tirageDose(t, dosage);

/** La ligne de montage-tableau/index.ts, lue dans la source et évaluée (le test rougit si elle change). */
const ligneTableau = INDEX_TABLEAU.split("\n").find((l) => l.includes("intensiteSousTitresTableau(commande"))!;
const corpsTableau = ligneTableau.trim().replace(/^\.\.\./, "").replace(/,$/, "");
const outilsTableau = (cran: "sobre" | "equilibre" | "dynamique" | undefined, actuelle: NiveauIntensite | undefined, reste?: "sobre") =>
  new Function("reste", "commande", "intensiteSousTitresTableau", `return ${corpsTableau};`)({ intensiteSousTitres: reste }, { dosageMotion: cran ? { cran } : undefined, sousTitres: actuelle ? { intensite: actuelle } : undefined }, intensiteSousTitresTableau) as { intensiteSousTitres?: string };

describe("X3-07 · cas concret : tirage", () => {
  it("éteint = identique sur 20 graines (même objet, code réel)", () => {
    for (const t of tirages()) {
      const avant = structuredClone(t);
      expect(chemin(t, undefined)).toBe(t);
      expect(t).toEqual(avant);
    }
  });
  it("aucun (forgé) lève au niveau de la fonction : index.ts ne le passe jamais", () => {
    expect(() => tirageDose(tirages()[0], "aucun")).toThrow();
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
  it("fabriquer.ts applique tirageDose après le tirage, aux deux endroits, sans toucher au hasard", () => {
    expect(FABRIQUER.match(/tirageDose\(/g)).toHaveLength(2); // les 2 appels (la définition est `tirageDose = (`)
    expect(FABRIQUER).toContain("tirage = tirageDose(tirage, o.dosage);");
    expect(FABRIQUER).toMatch(/const tirage = tirageDose\(journal\.tirage\?\.tirage \?\? heritee\?\.tirage \?\? tirer\(\{.*\}\), o\.dosage\);/);
    expect(FABRIQUER.indexOf("structure: structureEffective(cas.offre, tirage.structure) };")).toBeLessThan(FABRIQUER.indexOf("tirage = tirageDose(tirage, o.dosage);"));
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
    expect(ligneTableau).toBeTruthy();
    expect(ligneTableau).toContain("reste.intensiteSousTitres === undefined && n ? { intensiteSousTitres: n } : {}))(intensiteSousTitresTableau(commande.dosageMotion?.cran, commande.sousTitres?.intensite))");
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
  const TEXTE = "Le dossier était bloqué depuis neuf heures du matin. Puis tout a changé : la réponse est arrivée, gratuite, et le client a signé avant midi. Voilà comment on gagne du temps.";
  const DUREE = 12;
  it("avec chaque cran, les segments de sous-titres sont non vides (jamais de sous-titres coupés)", () => {
    for (const t of tirages()) {
      for (const c of ["sobre", "equilibre", "dynamique"] as const) {
        const st = chemin(t, c).sousTitres;
        const segments = fabriquerSousTitres({ texte: TEXTE, dureeSec: DUREE, base: "minimal", ratio: "9:16", reseaux: ["linkedin", "youtube-shorts"], ...variationSousTitresCasConcret(st, true) });
        expect(segments.length).toBeGreaterThan(3);
        expect(segments.every((x) => x.mots.length > 0 && x.finSec > x.debutSec)).toBe(true);
      }
    }
    for (const c of ["sobre", "equilibre", "dynamique"] as const) expect(intensiteSousTitresTableau(c, "equilibre")).toBeTruthy();
  });
});
