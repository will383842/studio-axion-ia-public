/**
 * X3-10b-c : la carte « Animations par défaut » est posée dans la rubrique « Vidéos et voix » de la page Réglages,
 * seulement si `dosageMotion.actif` vaut exactement `true`. Lecture statique de la page (modèle rubriques-page.test.ts).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dosageActif } from "@/briques/dosage-motion/reglage";

const PAGE = readFileSync("src/app/(studio)/reglages/page.tsx", "utf8");
const INTERDIT = /zernio|buffer|\bapi\b|simulation|\$|€/i;

describe("Réglages : carte « Animations par défaut »", () => {
  it("la carte est dans la rubrique videos, avant publication, sous la condition defautsDosage &&", () => {
    const debut = PAGE.indexOf('<Rubrique id="videos">');
    const fin = PAGE.indexOf('<Rubrique id="publication">');
    const carte = PAGE.indexOf('id="animations"');
    expect(debut).toBeGreaterThan(0);
    expect(carte).toBeGreaterThan(debut);
    expect(carte).toBeLessThan(fin);
    const avant = PAGE.slice(debut, carte);
    expect(avant.lastIndexOf("{defautsDosage && (")).toBeGreaterThan(avant.lastIndexOf("</Apparition>"));
    expect(PAGE).toContain("definirDefautDosageAction");
    expect(PAGE).toContain("<DefautsDosage actif");
  });

  it("lireDefautsDosage n'est appelé que si le dosage est actif (une seule lecture de réglage sinon)", () => {
    const appels = PAGE.match(/lireDefautsDosage\(/g) ?? [];
    expect(appels).toHaveLength(1);
    expect(PAGE).toMatch(/\(await dosageActif\([^;]*\)\)\s*\?\s*await lireDefautsDosage\(\)\s*:\s*null/);
  });

  it("le titre et le résumé de la carte ne contiennent aucun mot interdit", () => {
    const bloc = PAGE.slice(PAGE.indexOf('id="animations"'), PAGE.indexOf("</CartePliante>", PAGE.indexOf('id="animations"')));
    const titre = /titre="([^"]+)"/.exec(bloc)?.[1] ?? "";
    const resume = /resume="([^"]+)"/.exec(bloc)?.[1] ?? "";
    expect(titre).toBe("Animations par défaut");
    expect(titre).not.toMatch(INTERDIT);
    expect(resume).not.toMatch(INTERDIT);
  });

// ALLUME-VAGUE-A-CODE 18/11/2026 : défaut du code allumé (autorisation de Williams 17/11 22:25) ; l'éteint se teste désormais avec false écrit en base.
  it("éteint : false ou \"true\" → dosage inactif, donc carte absente ; absent → carte présente", async () => {
    expect(await dosageActif(async (_id, d) => d)).toBe(true);
    expect(await dosageActif(async () => false)).toBe(false);
    expect(await dosageActif(async () => "true")).toBe(false);
    expect(await dosageActif(async () => true)).toBe(true);
  });
});
