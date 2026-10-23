/** Brique `ecrans-motion` (B1a) : types, métriques générées depuis les polices dessinées, mesure et ajustement du texte. */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ajuster, enCapitales, largeurTexte, motsBalises, PAS_AJUSTEMENT_PX, sansBalises } from "../../../src/briques/ecrans-motion/mesure";
import { ANTON, CARACTERES as CARACTERES_ANTON } from "../../../src/briques/ecrans-motion/metriques-anton";
import { CARACTERES as CARACTERES_INTER, INTER_GRAS } from "../../../src/briques/ecrans-motion/metriques-inter-gras";
import { FONDS_ECRAN, FPS_ECRANS, IDS_OBJETS, MARQUE_ECRANS, TYPES_ECRAN } from "../../../src/briques/ecrans-motion/types";
import { POLICES_DUO } from "../../../src/briques/habillage/charte-duo";
import { CARACTERES_ECRITURE, FICHIER_INTER, tableDepuis } from "../../tableau/polices/tables";

const DOSSIER = "src/briques/ecrans-motion";
const FICHIER_ANTON = "studio-rendu/compositions/commune/polices/Anton-Regular.ttf";

describe("types des écrans", () => {
  it("12 types, 17 objets, deux fonds, 25 images par seconde, la marque", () => {
    expect(TYPES_ECRAN).toHaveLength(12);
    expect(new Set(TYPES_ECRAN).size).toBe(12);
    expect(IDS_OBJETS).toHaveLength(17);
    expect(new Set(IDS_OBJETS).size).toBe(17);
    expect([...FONDS_ECRAN]).toEqual(["sombre", "ivoire"]);
    expect(FPS_ECRANS).toBe(25);
    expect(MARQUE_ECRANS).toBe("axion-ia.com");
  });
});

describe("métriques générées", () => {
  it("égales aux chasses lues dans les fichiers de police du rendu (régénérer : generer-metriques.mts)", () => {
    expect(CARACTERES_ANTON).toBe(CARACTERES_ECRITURE);
    expect(CARACTERES_INTER).toBe(CARACTERES_ECRITURE);
    expect(ANTON).toEqual(tableDepuis(FICHIER_ANTON));
    expect(INTER_GRAS).toEqual(tableDepuis(FICHIER_INTER));
  });

  it("ce sont les polices de la charte `charte-duo/1`", () => {
    expect(POLICES_DUO.affiche.voulue).toBe("Anton");
    expect(POLICES_DUO.texte.voulue).toBe("Inter");
    expect(POLICES_DUO.texte.graisse).toBe(700);
  });
});

describe("mesure du texte", () => {
  it("additionne les chasses, l'approche après chaque caractère, sans compter le balisage", () => {
    const a = largeurTexte("AB", "anton", 100);
    expect(a).toBeCloseTo(((ANTON.largeurs[CARACTERES_ECRITURE.indexOf("A")] + ANTON.largeurs[CARACTERES_ECRITURE.indexOf("B")]) / ANTON.unitesParEm) * 100, 9);
    expect(largeurTexte("AB", "anton", 100, 0.1)).toBeCloseTo(a + 2 * 0.1 * 100, 9);
    expect(largeurTexte("C'était *ça.*", "inter-gras", 42)).toBe(largeurTexte("C'était ça.", "inter-gras", 42));
    expect(largeurTexte("", "anton", 100)).toBe(0);
    // Proportionnelle à la taille ; Anton (étroite) plus étroite qu'Inter Bold.
    expect(largeurTexte("MINUTES", "anton", 200)).toBeCloseTo(2 * largeurTexte("MINUTES", "anton", 100), 9);
    expect(largeurTexte("MINUTES", "anton", 100)).toBeLessThan(largeurTexte("MINUTES", "inter-gras", 100));
  });

  it("balisage et capitales", () => {
    expect(sansBalises("Le *rendez-vous*")).toBe("Le rendez-vous");
    expect(enCapitales("l'inscription")).toBe("L'INSCRIPTION");
    expect(motsBalises("tout *automatisé.*")).toEqual([
      { mot: "tout", accent: false },
      { mot: "automatisé.", accent: true },
    ]);
    expect(motsBalises("On vous envoie *toute la structure* ici")).toEqual([
      { mot: "On", accent: false },
      { mot: "vous", accent: false },
      { mot: "envoie", accent: false },
      { mot: "toute", accent: true },
      { mot: "la", accent: true },
      { mot: "structure", accent: true },
      { mot: "ici", accent: false },
    ]);
    expect(motsBalises("*en…*")).toEqual([{ mot: "en…", accent: true }]);
  });
});

describe("ajuster", () => {
  it("« NOS COLLABORATEURS » en Anton à 150 px tient dans 1000 px", () => {
    const r = ajuster("NOS COLLABORATEURS", "anton", 150, 1000, 60);
    expect(r.tient).toBe(true);
    expect(r.taille).toBeLessThanOrEqual(150);
    expect(r.taille).toBeGreaterThanOrEqual(60);
    expect(largeurTexte("NOS COLLABORATEURS", "anton", r.taille)).toBeLessThanOrEqual(1000);
  });

  it("ne réduit pas un texte qui tient déjà", () => {
    expect(ajuster("ÉTAPE", "anton", 190, 1000, 60)).toEqual({ taille: 190, tient: true });
  });

  it("réduit par pas de 4 px, à la plus grande taille qui tient", () => {
    const r = ajuster("DES HEURES GAGNÉES.", "anton", 250, 900, 60);
    expect(r.tient).toBe(true);
    expect((250 - r.taille) % PAS_AJUSTEMENT_PX).toBe(0);
    expect(largeurTexte("DES HEURES GAGNÉES.", "anton", r.taille + PAS_AJUSTEMENT_PX)).toBeGreaterThan(900);
  });

  it("un titre de 40 lettres descend au plancher puis ne tient pas", () => {
    const titre = "ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMN";
    expect(Array.from(titre)).toHaveLength(40);
    const r = ajuster(titre, "anton", 150, 1000, 60);
    expect(r).toEqual({ taille: 60, tient: false });
  });

  it("le plancher n'est jamais franchi, même avec un pas qui ne tombe pas juste", () => {
    expect(ajuster("ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMN", "anton", 151, 1000, 62).taille).toBe(62);
  });

  it("déterministe", () => {
    const a = [ajuster("NOS COLLABORATEURS", "anton", 150, 1000, 60), largeurTexte("Le rappel part tout seul.", "inter-gras", 42, 0.02)];
    const b = [ajuster("NOS COLLABORATEURS", "anton", 150, 1000, 60), largeurTexte("Le rappel part tout seul.", "inter-gras", 42, 0.02)];
    expect(a).toEqual(b);
  });
});

describe("pureté du dossier", () => {
  const fichiers = readdirSync(DOSSIER).filter((f) => f.endsWith(".ts"));

  it("aucun import « @/ », ni React, ni Zod, ni Remotion", () => {
    expect(fichiers.length).toBeGreaterThan(0);
    for (const f of fichiers) {
      const texte = readFileSync(join(DOSSIER, f), "utf8");
      expect(texte, f).not.toMatch(/from\s+["']@\//);
      expect(texte, f).not.toMatch(/from\s+["'](react|zod|remotion)["']/);
      expect(texte, f).not.toMatch(/import\(\s*["']@\//);
    }
  });
});
