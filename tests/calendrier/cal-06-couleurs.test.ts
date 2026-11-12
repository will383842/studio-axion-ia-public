/**
 * CAL-06 : couleurs et pictogrammes par réseau dans le calendrier.
 * Chaque réseau a un jeton --res-<réseau> dans :root ET dans .theme-sombre ; aucune couleur en dur dans les composants ;
 * la couleur n'est jamais seule (pictogramme et nom à côté) ; libellé lisible (≥ 4,5:1).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BarreFiltres } from "@/components/calendrier/BarreFiltres";
import { CarteEntreeCalendrier } from "@/components/calendrier/CarteEntreeCalendrier";
import { PictoReseau } from "@/components/calendrier/PictoReseau";
import { COULEURS_RESEAUX, RESEAUX_COLORES, couleurReseau } from "@/components/calendrier/couleurs-reseaux";

const RACINE = join(__dirname, "../..");
const lire = (p: string) => readFileSync(join(RACINE, p), "utf-8");
const CSS = lire("src/app/globals.css");

function bloc(sel: string): string {
  const i = CSS.indexOf(`\n${sel} {`);
  expect(i, `bloc ${sel}`).toBeGreaterThanOrEqual(0);
  return CSS.slice(i, CSS.indexOf("\n}", i));
}
const racine = bloc(":root");
const sombre = bloc(".theme-sombre");

function valeur(b: string, nom: string): string {
  const m = new RegExp(`^\\s*--${nom}:\\s*(#[0-9a-fA-F]{6})\\s*;`, "m").exec(b);
  expect(m, `jeton --${nom} (valeur #rrggbb)`).not.toBeNull();
  return m![1]!;
}
function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}
function contraste(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const NOMS: Record<string, string> = { linkedin: "LinkedIn", instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", youtube: "YouTube", "youtube-shorts": "YouTube Shorts" };

describe("CAL-06 : jetons de réseau", () => {
  it("couvre les six réseaux", () => {
    expect([...RESEAUX_COLORES].sort()).toEqual(Object.keys(NOMS).sort());
  });
  it.each(Object.keys(NOMS))("%s a un jeton dans :root ET dans .theme-sombre", (r) => {
    expect(racine).toMatch(new RegExp(`^\\s*--res-${r}:`, "m"));
    expect(sombre).toMatch(new RegExp(`^\\s*--res-${r}:`, "m"));
  });
  it("YouTube = #cc0000 en clair", () => {
    expect(valeur(racine, "res-youtube").toLowerCase()).toBe("#cc0000");
  });
  it.each(Object.keys(NOMS))("%s : couleur → jeton CSS, jamais une couleur en dur", (r) => {
    expect(couleurReseau(r as never)).toBe(`var(--res-${r})`);
    expect(COULEURS_RESEAUX[r as keyof typeof COULEURS_RESEAUX]).toMatch(/^var\(--res-[a-z-]+\)$/);
  });
  it.each(["light", "sombre"] as const)("libellé lisible (≥ 4,5:1) et liseré visible (≥ 3:1), thème %s", (t) => {
    const b = t === "light" ? racine : sombre;
    const texte = valeur(b, "texte");
    const fond = valeur(b, "surface-1");
    expect(contraste(texte, fond)).toBeGreaterThanOrEqual(4.5);
    for (const r of Object.keys(NOMS)) expect(contraste(valeur(b, `res-${r}`), fond), r).toBeGreaterThanOrEqual(3);
  });
});

describe("CAL-06 : la couleur n'est jamais seule", () => {
  it.each(Object.entries(NOMS))("PictoReseau %s : picto décoratif et nom écrit", (r, nom) => {
    const html = renderToStaticMarkup(createElement(PictoReseau, { reseau: r as never }));
    expect(html).toContain(nom);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain(`data-reseau="${r}"`);
  });
  it.each(Object.entries(NOMS))("carte %s : liseré par --c, picto et nom", (r, nom) => {
    const html = renderToStaticMarkup(createElement(CarteEntreeCalendrier, { entree: { cle: "k", jour: "2026-11-12", reseau: r as never, type: "video", etat: "brouillon" } }));
    expect(html).toContain(`var(--res-${r}`);
    expect(html).toContain(nom);
    expect(html).toContain("data-picto");
  });
  it("légende : pastille, picto et nom pour chaque réseau", () => {
    const html = renderToStaticMarkup(createElement(BarreFiltres, { reseaux: RESEAUX_COLORES, actifs: RESEAUX_COLORES, onBasculer: () => {} }));
    for (const [r, nom] of Object.entries(NOMS)) {
      expect(html).toContain(nom);
      expect(html).toContain(`data-reseau="${r}"`);
    }
    expect((html.match(/data-picto/g) ?? []).length).toBe(RESEAUX_COLORES.length);
    expect((html.match(/data-pastille-couleur/g) ?? []).length).toBe(RESEAUX_COLORES.length);
  });
});

describe("CAL-06 : pas de couleur en dur", () => {
  it.each(["PictoReseau.tsx", "couleurs-reseaux.ts", "CarteEntreeCalendrier.tsx", "BarreFiltres.tsx"])("%s", (f) => {
    expect(lire(`src/components/calendrier/${f}`)).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
  });
  it("les statuts gardent leurs jetons et « Publié » reste en contour", () => {
    for (const s of ["brouillon", "fabrication", "valider", "retouche", "accepte", "programme", "publie", "corriger", "refuse"]) {
      expect(racine).toMatch(new RegExp(`--statut-${s}-fond:`));
      expect(sombre).toMatch(new RegExp(`--statut-${s}-fond:`));
    }
    expect(lire("src/domaine/libelles.ts")).toMatch(/publiee: \{ libelle: "Publiée", tonalite: "contour"/);
  });
});
