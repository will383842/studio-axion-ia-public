/**
 * Mesure aux polices DESSINÉES (reprise visuelle) : la table de `src/briques/stylo/metriques-ecriture.ts` est celle des
 * fichiers de police du rendu (Montserrat ExtraBold, Inter Bold), et la mise en page mesure avec elle — plus avec
 * Poppins.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { INTER_BOLD as INTER_COMPOSITION } from "../../../src/briques/composition/metriques-inter";
import { largeurMotMotion } from "../../../src/briques/motion/mesure";
import { CARACTERES_ECRITURE, INTER_BOLD, INTER_MEDIUM, MONTSERRAT_EXTRABOLD } from "../../../src/briques/stylo/metriques-ecriture";
import { STYLE_ECRITURE_EXACTE, largeurEcrite, motsEcrits } from "../../../src/briques/stylo/mesure-ecriture";
import { largeurNiveau } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { CARACTERES_ECRITURE as ATTENDUS, FICHIER_INTER, FICHIER_INTER_MEDIUM, FICHIER_MONTSERRAT, tableDepuis } from "../polices/tables";

describe("tables de chasse", () => {
  it("égales à celles lues dans les fichiers de police du rendu", () => {
    expect(CARACTERES_ECRITURE).toBe(ATTENDUS);
    expect(MONTSERRAT_EXTRABOLD).toEqual(tableDepuis(FICHIER_MONTSERRAT));
    expect(INTER_BOLD).toEqual(tableDepuis(FICHIER_INTER));
    expect(INTER_MEDIUM).toEqual(tableDepuis(FICHIER_INTER_MEDIUM));
  });

  it("le lecteur de police retrouve la table d'Inter Bold de la brique composition (contrôle du lecteur)", () => {
    expect(INTER_BOLD.unitesParEm).toBe(INTER_COMPOSITION.unitesParEm);
    // Mêmes caractères des deux côtés, sauf le « % » de fin que la table composition n'a pas.
    const n = Math.min(INTER_BOLD.largeurs.length, INTER_COMPOSITION.largeurs.length);
    expect(INTER_BOLD.largeurs.slice(0, 95)).toEqual(INTER_COMPOSITION.largeurs.slice(0, 95));
    expect(n).toBeGreaterThan(130);
  });
});

describe("mesure", () => {
  it("titre en Montserrat ExtraBold, texte en Inter Bold, approche comprise ; plus Poppins", () => {
    const titre = largeurNiveau("Idées", "titre", 100);
    expect(titre).toBeCloseTo(largeurEcrite("Idées", "titre", 100, -0.02), 9);
    expect(largeurNiveau("Idées", "corps", 100)).toBeCloseTo(largeurEcrite("Idées", "texte", 100, -0.005), 9);
    expect(Math.abs(titre - largeurMotMotion("Idées", 100, 800, -0.02))).toBeGreaterThan(1);
  });

  it("les mots d'une ligne : positions additives (espaces compris), dernier mot au bord de la ligne", () => {
    const l = "Trois questions d'abord";
    const mots = motsEcrits(l, "texte", 77, -0.005);
    expect(mots.map((m) => m.texte)).toEqual(["Trois", "questions", "d'abord"]);
    const fin = mots[2].x + mots[2].largeur;
    expect(fin).toBeCloseTo(largeurEcrite(l, "texte", 77, -0.005), 6);
  });

  it("le rendu écrit sans crénage ni ligatures (la mesure est exacte)", () => {
    expect(STYLE_ECRITURE_EXACTE.fontKerning).toBe("none");
    const ligne = readFileSync(new URL("../../../studio-rendu/compositions/tableau/LigneEcrite.tsx", import.meta.url), "utf8");
    expect(ligne).toContain("...STYLE_ECRITURE_EXACTE");
  });
});
