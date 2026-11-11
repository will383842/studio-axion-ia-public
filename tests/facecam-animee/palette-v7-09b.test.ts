/**
 * V7-09b : motion-v2/lot1, motion-v4/lot1 et briques-v4 n'emploient que la palette Axion 2026.
 * Ivoire #FAF9F5, gris #E8E6DC, noir #141413, terracotta #B23F16, orange #D97757 et gris #B0AEA5 (sur noir),
 * texte secondaire #5E5D59 et blanc de carte #FFFFFF. #8F3412 reste exclu tant que D5 est ouverte. AUCUN rendu.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PALETTE, contrasteWcag } from "@/briques/charte/axion-2026";
import { COULEURS, accents } from "../../studio-rendu/compositions/interface-claire/motion-v4/communs/briques-v4";

const BASE = join(process.cwd(), "studio-rendu/compositions/interface-claire");
const PALETTE_HEX = new Set(["#faf9f5", "#e8e6dc", "#141413", "#b23f16", "#d97757", "#b0aea5", "#b8341c", "#5e5d59", "#ffffff"]);
const FICHIERS = ["motion-v2/lot1/commun-lot1.tsx", "motion-v4/lot1/commun-lot1.tsx", "motion-v4/communs/briques-v4.tsx"];

describe("V7-09b : couleurs en dur", () => {
  it.each(FICHIERS)("%s : aucun hex hors palette", (f) => {
    const src = readFileSync(join(BASE, f), "utf8");
    const hex = (src.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).map((h) => h.toLowerCase());
    // Exception unique : le magenta #FF00FF de la zone témoin du visage (mode "visage", banc de mesure PlancheLot5), repère technique laissé au cliquet.
    const permis = f === "motion-v4/communs/briques-v4.tsx" ? ["#ff00ff"] : [];
    expect(hex.filter((h) => !PALETTE_HEX.has(h) && !permis.includes(h))).toEqual([]);
  });

  it.each(FICHIERS)("%s : #8F3412 (D5 ouverte) n'est employé nulle part", (f) => {
    const src = readFileSync(join(BASE, f), "utf8");
    expect(src.toLowerCase()).not.toContain("#8f3412");
  });

  it("briques-v4 : blanc #FFFFFF, ACCENT_1 = terracotta, ACCENT_SOMBRE = orange (rôles réels)", () => {
    expect(COULEURS.BLANC.toUpperCase()).toBe("#FFFFFF");
    expect(accents().ACCENT_1).toBe(PALETTE.terracotta);
    expect(accents().ACCENT_CLAIR).toBe(PALETTE.terracotta);
    expect(accents().ACCENT_SOMBRE).toBe(PALETTE.orange);
    expect(COULEURS.ORANGE_MARQUE).toBe(PALETTE.terracotta);
  });

  it("contrastes réels : terracotta lisible avec du blanc (5,81) mais pas avec l'encre (3,17) ; orange lisible sur le noir (5,90) seulement", () => {
    expect(contrasteWcag(PALETTE.blanc, PALETTE.terracotta)).toBeCloseTo(5.81, 1);
    expect(contrasteWcag(PALETTE.noir, PALETTE.terracotta)).toBeCloseTo(3.17, 1);
    expect(contrasteWcag(PALETTE.orange, PALETTE.noir)).toBeCloseTo(5.9, 1);
    expect(contrasteWcag(PALETTE.terracotta, PALETTE.noir)).toBeLessThan(4.5);
  });

  const FONDS_PLAQUE = [
    ["ACCENT_1 (terracotta)", accents().ACCENT_1],
    ["ACCENT_2 (blanc)", accents().ACCENT_2],
    ["ENCRE", COULEURS.ENCRE],
    ["IVOIRE", COULEURS.IVOIRE],
    ["GRIS", COULEURS.GRIS],
  ] as const;

  it.each(FONDS_PLAQUE)("Plaque (motion-v4/lot1) sur fond %s : le texte par défaut a un contraste réel ≥ 4,5", async (_n, fond) => {
    const lot1 = await import("../../studio-rendu/compositions/interface-claire/motion-v4/lot1/commun-lot1");
    const html = renderToStaticMarkup(createElement(lot1.Plaque, { fond }, "TEXTE"));
    const bg = html.match(/background:\s*(#[0-9a-fA-F]{6})/)?.[1];
    const fg = html.match(/[^-]color:\s*(#[0-9a-fA-F]{6})/)?.[1];
    expect(bg?.toUpperCase()).toBe(fond.toUpperCase());
    expect(fg).toBeDefined();
    expect(contrasteWcag(fg!, bg!)).toBeGreaterThanOrEqual(4.5);
  });

  it("Plaque (motion-v4/lot1) sur terracotta : texte BLANC par défaut (5,81), jamais l'encre (3,17)", async () => {
    const lot1 = await import("../../studio-rendu/compositions/interface-claire/motion-v4/lot1/commun-lot1");
    const html = renderToStaticMarkup(createElement(lot1.Plaque, { fond: accents().ACCENT_1 }, "TEXTE"));
    expect(html.toLowerCase()).toMatch(/[^-]color:\s*#ffffff/);
  });

  it("briques-v4 : le texte d'une plaque terracotta (couleurTexte par défaut) a un contraste ≥ 4,5", async () => {
    const briques = await import("../../studio-rendu/compositions/interface-claire/motion-v4/communs/briques-v4");
    const html = renderToStaticMarkup(createElement(briques.Plaque, { texte: "TEXTE", fond: accents().ACCENT_1, corps: 60 }));
    const bg = html.match(/background:\s*(#[0-9a-fA-F]{6})/)?.[1];
    const fg = html.match(/[^-]color:\s*(#[0-9a-fA-F]{6})/)?.[1];
    expect(bg?.toUpperCase()).toBe(PALETTE.terracotta.toUpperCase());
    expect(contrasteWcag(fg!, bg!)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(["motion-v4/communs/briques-v4.tsx", "motion-v4/lot1/commun-lot1.tsx"])("%s : ACCENT_1 n'est jamais posé à côté de ENCRE (barre, contour, ombre)", (f) => {
    const src = readFileSync(join(BASE, f), "utf8");
    const lignes = src.split("\n");
    const fautes = lignes.map((l, i) => ({ l, n: i + 1 })).filter(({ l }) => /ACCENT_1/.test(l) && /\bENCRE\b|WebkitTextStroke/.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l)).map(({ n, l }) => `${f}:${n} ${l.trim().slice(0, 120)}`);
    expect(fautes).toEqual([]);
    for (const nom of ["BarreProgression", "TexteContour"]) {
      const i = src.indexOf(`function ${nom}`);
      if (i < 0) continue;
      const corps = src.slice(i, src.indexOf("\n}\n", i));
      expect(corps, `${nom} (fond ENCRE) doit utiliser ACCENT_SOMBRE`).not.toMatch(/\bACCENT_1\b/);
    }
  });

  it("lot1 : la barre de progression et le mot en cours (contour ENCRE) emploient ACCENT_SOMBRE", () => {
    const src = readFileSync(join(BASE, "motion-v4/lot1/commun-lot1.tsx"), "utf8");
    expect(src).toMatch(/accents\(palette\)\.ACCENT_SOMBRE/);
    expect(src).toMatch(/k === courant \? ACCENT_SOMBRE : BLANC/);
    const brq = readFileSync(join(BASE, "motion-v4/communs/briques-v4.tsx"), "utf8");
    expect(brq).toMatch(/enCours \? ACCENT_SOMBRE : COULEURS\.BLANC/);
  });

  it("motion-v2 : sableProfond et encreDouce = #5E5D59, distincts de l'encre", () => {
    const src = readFileSync(join(BASE, "motion-v2/lot1/commun-lot1.tsx"), "utf8");
    expect(src).toMatch(/sableProfond: "#5E5D59"/);
    expect(src).toMatch(/encreDouce: "#5E5D59"/);
    expect(src).toMatch(/encre: "#141413"/);
  });
});
