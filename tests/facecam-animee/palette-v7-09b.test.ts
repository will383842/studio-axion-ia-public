/**
 * V7-09b : motion-v2/lot1, motion-v4/lot1 et briques-v4 n'emploient que la palette Axion 2026.
 * Ivoire #FAF9F5, gris #E8E6DC, noir #141413, terracotta #B23F16, orange #D97757 et gris #B0AEA5 (sur noir),
 * texte secondaire #5E5D59 et blanc de carte #FFFFFF. #8F3412 reste exclu tant que D5 est ouverte. AUCUN rendu.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PALETTE, contrasteWcag } from "@/briques/charte/axion-2026";
import { COULEURS, accents } from "../../studio-rendu/compositions/interface-claire/motion-v4/communs/briques-v4";

const BASE = join(process.cwd(), "studio-rendu/compositions/interface-claire");
/** Tous les .tsx sous `dossier` (chemins relatifs à BASE, séparateur /). */
function tsxDe(dossier: string): string[] {
  const sortie: string[] = [];
  for (const e of readdirSync(join(BASE, dossier), { withFileTypes: true })) {
    const rel = `${dossier}/${e.name}`;
    if (e.isDirectory()) sortie.push(...tsxDe(rel));
    else if (e.name.endsWith(".tsx")) sortie.push(rel);
  }
  return sortie.sort();
}
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
    const src = readFileSync(join(BASE, f), "utf8").replace(/\r\n/g, "\n");
    const lignes = src.split("\n");
    const fautes = lignes.map((l, i) => ({ l, n: i + 1 })).filter(({ l }) => /ACCENT_1/.test(l) && /\bENCRE\b|WebkitTextStroke/.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l)).map(({ n, l }) => `${f}:${n} ${l.trim().slice(0, 120)}`);
    expect(fautes).toEqual([]);
    for (const nom of ["BarreProgression", "TexteContour"]) {
      const i = src.indexOf(`function ${nom}`);
      if (i < 0) continue;
      const fin = src.indexOf("\n}\n", i);
      expect(fin, `${f} : fin de la fonction ${nom} introuvable`).toBeGreaterThan(i);
      const corps = src.slice(i, fin);
      expect(corps, `${nom} (fond ENCRE) doit utiliser ACCENT_SOMBRE`).not.toMatch(/\bACCENT_1\b/);
    }
  });

  it.each(tsxDe("motion-v4"))("%s : ACCENT_1 n'est jamais la couleur d'un texte ou d'un glyphe posé sur ENCRE (3,17 ; ACCENT_SOMBRE donne ≈ 7)", (f) => {
    const lignes = readFileSync(join(BASE, f), "utf8").replace(/\r\n/g, "\n").split("\n");
    const roleTexte = /\b(color:\s*|couleurTexte\s*=\s*)[^,}]*ACCENT_1|texte(=\{|:\s*)(accents\(palette\)\.)?ACCENT_1|enCours \? ACCENT_1|fill=\{ACCENT_1\} stroke=\{ACCENT_1\}|melange\(COULEURS\.ENCRE, ACCENT_1|couleur = (p\.interjection|n === lettreCle)[^;]*ACCENT_1|couleurTexte\s*=\s*\[[^\]]*\bACCENT_1\b|couleur\w*\s*=\s*[^;]*\bACCENT_1\b/;
    const fautes = lignes.map((l, i) => ({ l, n: i + 1 })).filter(({ l }) => roleTexte.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l)).map(({ n, l }) => `${f}:${n} ${l.trim().slice(0, 120)}`);
    expect(fautes).toEqual([]);
  });

  it("texte posé sur fond ACCENT_1 (terracotta) : BLANC, jamais ENCRE (5,81 contre 3,17)", () => {
    const pw = readFileSync(join(BASE, "motion-v4/lot3/PageWebDefile.tsx"), "utf8").split(/\r?\n/).find((l) => l.includes("VOIR NOS SERVICES"))!;
    expect(pw).toMatch(/background: ACCENT_1/);
    expect(pw).toMatch(/color: COULEURS\.BLANC/);
    const cf = readFileSync(join(BASE, "motion-v4/lot3/CarrouselFeuillete.tsx"), "utf8").split(/\r?\n/).find((l) => l.includes("borderRadius: 35, background: ACCENT_1"))!;
    expect(cf).toMatch(/color: COULEURS\.BLANC/);
    expect(cf).toMatch(/stroke=\{COULEURS\.BLANC\}/);
    expect(cf).not.toMatch(/color: E\b|stroke=\{E\}/);
  });

  it("GRIS (#B0AEA5, réservé au noir) n'est plus un texte sur fond clair : texte secondaire #5E5D59", () => {
    expect(COULEURS.TEXTE_SECONDAIRE.toUpperCase()).toBe(PALETTE.texteSecondaire.toUpperCase());
    expect(contrasteWcag(COULEURS.TEXTE_SECONDAIRE, PALETTE.ivoire)).toBeGreaterThanOrEqual(4.5);
    expect(contrasteWcag(COULEURS.TEXTE_SECONDAIRE, COULEURS.BLANC)).toBeGreaterThanOrEqual(4.5);
    const cmd = readFileSync(join(BASE, "motion-v4/lot2/CarteCommande.tsx"), "utf8");
    expect(cmd).toMatch(/texteChamp \? ENCRE : COULEURS\.TEXTE_SECONDAIRE/);
    const l4 = readFileSync(join(BASE, "motion-v4/lot4/interfaces-lot4.tsx"), "utf8");
    expect(l4).not.toMatch(/txt\(\d+, GRIS\)/);
    expect((l4.match(/txt\(\d+, COULEURS\.TEXTE_SECONDAIRE\)/g) ?? []).length).toBe(3);
    for (const f of ["motion-v4/lot2/CarteCommentaire.tsx", "motion-v4/lot2/FriseEtapes.tsx"]) {
      const lignesTexte = readFileSync(join(BASE, f), "utf8").split(/\r?\n/).filter((l) => /\bcolor:/.test(l));
      expect(lignesTexte.length, `${f} : aucune couleur de texte trouvée`).toBeGreaterThan(0);
      for (const l of lignesTexte) expect(l, `${f} : texte GRIS sur fond clair`).not.toMatch(/: GRIS\b/);
      expect(lignesTexte.some((l) => /COULEURS\.TEXTE_SECONDAIRE/.test(l)), `${f} : texte secondaire attendu`).toBe(true);
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
