import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PAIRES_TEXTE, contrasteWcag } from "@/briques/charte/axion-2026";
import { formatTutorielOutil } from "@/formats/tutoriel-outil";
import { DUREE_CIBLE_SEC, DUREE_CIBLE_SEC as DUREE_CIBLE_SOURCE } from "@/moteurs/montage-tutoriel-outil/equipe/chef-de-projet";
import { controlerAvantValidation } from "@/moteurs/montage-tutoriel-outil/equipe/controleur";
import {
  CONTRASTE_MIN_GRAND_TEXTE,
  CONTRASTE_MIN_TEXTE,
  LANGUES_V1,
  MUSIQUE_V1,
  PART_HAUTEUR_TEXTE_MIN,
  RATIOS_PLUS_TARD,
  RATIOS_V1,
  RATIO_PRINCIPAL,
  controlerContraste,
  controlerDiffusion,
  controlerDureeMesuree,
  controlerLangue,
  controlerLongueurScript,
  controlerRatios,
  controlerTailleTexte,
  controlesDiffusion,
  pairesReserveesAuxTitres,
  tailleEffectivePx,
  tailleTexteMinPx,
} from "@/moteurs/montage-tutoriel-outil/diffusion-tutoriel";

const mots = (n: number): string => Array.from({ length: n }, () => "mot").join(" ");

describe("constantes", () => {
  it("formats, langue, musique", () => {
    expect(RATIOS_V1).toEqual(["4:5", "9:16", "1:1"]);
    expect(RATIO_PRINCIPAL).toBe("4:5");
    expect(RATIOS_PLUS_TARD).toEqual(["16:9"]);
    expect(LANGUES_V1).toEqual(["fr"]);
    expect(MUSIQUE_V1).toBe(false);
    expect(CONTRASTE_MIN_TEXTE).toBe(4.5);
    expect(CONTRASTE_MIN_GRAND_TEXTE).toBe(3);
    expect(PART_HAUTEUR_TEXTE_MIN).toBe(0.03);
  });
});

describe("ratios", () => {
  it("les trois formats : ok", () => expect(controlerRatios(["4:5", "9:16", "1:1"])).toEqual([]));
  it("9:16 seul : refus (4:5 manquant)", () => expect(controlerRatios(["9:16"]).length).toBe(1));
  it("16:9 : la phrase attendue", () => {
    const r = controlerRatios(["4:5", "16:9"]);
    expect(r.map((x) => x.message)).toContain("Le format 16:9 viendra plus tard : il n'est pas proposé en V1.");
  });
  it("ne lève jamais", () => expect(() => controlerRatios(null as unknown as string[])).not.toThrow());
});

describe("durée : une seule source", () => {
  it("aucune constante propre dans src ; DUREE_CIBLE_SEC importée", () => {
    const src = readFileSync("src/moteurs/montage-tutoriel-outil/diffusion-tutoriel.ts", "utf8");
    expect(src).toMatch(/import \{ DUREE_CIBLE_SEC \} from "\.\/equipe\/chef-de-projet"/);
    expect(DUREE_CIBLE_SEC).toBe(DUREE_CIBLE_SOURCE);
    expect(src).not.toMatch(/DUREE_MIN_SEC|DUREE_MAX_SEC/);
  });
  it("la zone du format égale DUREE_CIBLE_SEC", () => expect((formatTutorielOutil.durees as { zoneSec: readonly number[] }).zoneSec).toEqual(DUREE_CIBLE_SEC));
  it("script de 104 mots (≈ 40 s) + fin 0 : rien à dire", () => expect(controlerLongueurScript(mots(104), 0)).toEqual([]));
  it("80 mots : remarque avec bornes en mots, non bloquante", () => {
    const r = controlerLongueurScript(mots(80), 0);
    expect(r).toHaveLength(1);
    expect(r[0].message).toBe("Votre script ferait environ 31 s : visez 40 à 55 s (environ 104 à 143 mots).");
    expect(r[0].bloquante).toBe(false);
  });
  it("160 mots : remarque", () => expect(controlerLongueurScript(mots(160), 0)[0]?.code).toBe("DUREE_SCRIPT"));
  it("la fin compte dans la durée", () => {
    expect(controlerLongueurScript(mots(104), 5000)).toEqual([]);
    expect(controlerLongueurScript(mots(143), 5000)).toHaveLength(1);
    expect(controlerLongueurScript(mots(80), 10000)).toEqual([]);
  });
  it("voix mesurée : bornes à la milliseconde", () => {
    expect(controlerDureeMesuree(39_999, 0)).toHaveLength(1);
    expect(controlerDureeMesuree(40_000, 0)).toEqual([]);
    expect(controlerDureeMesuree(55_000, 0)).toEqual([]);
    expect(controlerDureeMesuree(55_001, 0)).toHaveLength(1);
    expect(controlerDureeMesuree(35_000, 5_000)).toEqual([]);
    expect(controlerDureeMesuree(55_000, 1)).toHaveLength(1);
  });
  it("jamais un refus : aucune remarque de durée ne bloque", () => {
    const v = controlerDiffusion({ texteScript: mots(10), dureeVoixMs: 90_000 });
    expect(v.remarques.map((r) => r.code).sort()).toEqual(["DUREE_MESUREE", "DUREE_SCRIPT"]);
    expect(v.ok).toBe(true);
  });
  it("valeurs non finies : sans lever", () => {
    expect(() => controlerDureeMesuree(NaN, NaN)).not.toThrow();
    expect(() => controlerLongueurScript(undefined as unknown as string, NaN)).not.toThrow();
  });
});

describe("langue", () => {
  it("fr et fr-FR ok", () => {
    expect(controlerLangue("fr")).toEqual([]);
    expect(controlerLangue("fr-FR")).toEqual([]);
  });
  it("en-US refusé", () => expect(controlerLangue("en-US")[0].message).toBe("Le tutoriel est en français seulement pour le moment."));
});

describe("contraste", () => {
  const attendu: [string, string, number][] = [
    ["#141413", "#FAF9F5", 17.5],
    ["#141413", "#E8E6DC", 14.73],
    ["#B23F16", "#FAF9F5", 5.51],
    ["#B23F16", "#E8E6DC", 4.64],
    ["#FAF9F5", "#141413", 17.5],
    ["#E8E6DC", "#141413", 14.73],
    ["#D97757", "#141413", 5.9],
    ["#B0AEA5", "#141413", 8.29],
    ["#FFFFFF", "#B23F16", 5.81],
    ["#FFFFFF", "#8F3412", 7.87],
    ["#5E5D59", "#FAF9F5", 6.26],
    ["#5E5D59", "#E8E6DC", 5.27],
    ["#141413", "#FFFFFF", 18.43],
  ];
  it("chaque paire de la charte est calculée et classée", () => {
    expect(PAIRES_TEXTE).toHaveLength(attendu.length);
    PAIRES_TEXTE.forEach(([t, f], i) => {
      expect([t.toUpperCase(), f.toUpperCase()]).toEqual([attendu[i][0], attendu[i][1]]);
      expect(contrasteWcag(t, f)).toBeCloseTo(attendu[i][2], 2);
    });
    // Aujourd'hui toutes atteignent le seuil du texte courant : aucune n'est réservée aux titres.
    expect(pairesReserveesAuxTitres()).toEqual([]);
  });
  it("fonds ivoire et noir passent", () => {
    expect(controlerContraste({ fond: "ivoire", accent: "terracotta" })).toEqual([]);
    expect(controlerContraste({ fond: "noir", accent: "orange" })).toEqual([]);
  });
});

describe("taille du texte", () => {
  it("minimum par format", () => {
    expect(tailleTexteMinPx("4:5")).toBe(41);
    expect(tailleTexteMinPx("9:16")).toBe(58);
    expect(tailleTexteMinPx("1:1")).toBe(33);
  });
  it("14 px, scénario 1440, format 1080, zoom 1 : 10,5 px", () => {
    expect(tailleEffectivePx({ taillePoliceCssPx: 14, largeurScenarioPx: 1440, largeurFormatPx: 1080, zoom: 1 })).toBeCloseTo(10.5, 5);
    const r = controlerTailleTexte([{ etapeId: "e1", taillePoliceCssPx: 14, zoom: 1 }], { largeur: 1440 }, "4:5");
    expect(r[0].message).toBe("Étape e1 : le texte montré serait trop petit (10,5 px) : zoomez davantage ou agrandissez-le dans la maquette.");
  });
  it("zoom 4 : 42 px, ok", () => expect(controlerTailleTexte([{ etapeId: "e1", taillePoliceCssPx: 14, zoom: 4 }], { largeur: 1440 }, "4:5")).toEqual([]));
  it("scénario illisible : remarque sans lever", () => expect(controlerTailleTexte([{ etapeId: "e", taillePoliceCssPx: 14, zoom: 4 }], { largeur: 0 }, "4:5")).toHaveLength(1));
});

describe("format du tutoriel", () => {
  it("durees, ratios, musique", () => {
    expect(formatTutorielOutil.durees).toEqual({ mode: "depuis-script", zoneSec: [40, 55], zoneOrangeSec: [55, 75], ciblesGenerationSec: [40, 50, 55], cibleParDefautSec: 50 });
    expect(formatTutorielOutil.ratios).toEqual(["4:5", "9:16", "1:1"]);
    expect(formatTutorielOutil.ratioMaitre).toBe("4:5");
    expect(formatTutorielOutil.musique).toBe("interdite");
  });
});

describe("messages", () => {
  it("aucun montant, aucun jargon", () => {
    const v = controlerDiffusion({
      ratios: ["9:16", "16:9"],
      texteScript: mots(5),
      dureeVoixMs: 1,
      langue: "en",
      tailleTexte: { cibles: [{ etapeId: "e1", taillePoliceCssPx: 14, zoom: 1 }], scenario: { largeur: 1440 }, ratio: "4:5" },
    });
    expect(v.remarques.length).toBeGreaterThanOrEqual(6);
    for (const r of v.remarques) {
      expect(r.message).not.toMatch(/LUFS|WCAG|ratio|€|\$|euro/i);
      expect(r.message).not.toMatch(/\btu\b|\bton\b|\bta\b/i);
    }
    expect(v.ok).toBe(false);
  });
});

describe("branchement du contrôleur", () => {
  it("controlesDiffusion ne double pas la durée mesurée", () => {
    const c = controlesDiffusion({ dureeVoixMs: 90_000, langue: "fr" });
    expect(c.map((x) => x.etat)).toEqual(["reussi", "reussi"]);
  });
  it("la longueur du script est une remarque non bloquante ; la langue bloque", () => {
    const c = controlesDiffusion({ texteScript: mots(5), langue: "en" });
    expect(c[0]).toMatchObject({ id: "TUT-DIFFUSION", etat: "echoue", bloquant: true });
    expect(c[1]).toMatchObject({ id: "TUT-DIFFUSION-DUREE", etat: "echoue", bloquant: false });
  });
  it("controleur : le champ diffusion est facultatif et relié", () => {
    const src = readFileSync("src/moteurs/montage-tutoriel-outil/equipe/controleur.ts", "utf8");
    expect(src).toContain("controlesDiffusion(e.diffusion)");
    expect(typeof controlerAvantValidation).toBe("function");
  });
});
