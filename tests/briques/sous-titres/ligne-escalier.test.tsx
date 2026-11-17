/** C2-U20b-a (AM-09) : dessin de l'escalier de lignes. Composant monté nulle part, aucun calcul de mise en page. */
import React from "react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
// `polices.ts` importe « remotion », installé seulement dans studio-rendu (hors espace pnpm, absent du job « nouveaux tests »).
// Doublure minimale : le rendu serveur ne charge aucune police (chargerPolices sort si `document` est absent).
vi.mock("remotion", () => ({ delayRender: () => 0, continueRender: () => undefined }));
import { geometrieEscalier } from "@/briques/sous-titres/escalier";
import { LigneEscalier, MEMOIRE_FLOUE } from "../../../studio-rendu/compositions/sous-titres/LigneEscalier";

const zone = { xPx: 54, yPx: 200, largeurPx: 972, hauteurPx: 1200 };
const geo = geometrieEscalier(["Un", "Deux", "Trois"], 1080, 1920, zone, 60)!;
const rendre = (g: typeof geo | null, active = 2) =>
  renderToStaticMarkup(<LigneEscalier geometrie={g} couleur="#111111" fond="#eeeeee" ligneActive={active} />);

const sources = (dossier: string): string[] =>
  readdirSync(dossier).flatMap((n) => {
    const p = join(dossier, n);
    if (n === "node_modules") return [];
    return statSync(p).isDirectory() ? sources(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });

describe("C2-U20b-a : LigneEscalier", () => {
  it("la géométrie de test existe", () => expect(geo).not.toBeNull());

  it("3 lignes → 3 éléments, dans l'ordre, texte inchangé", () => {
    const html = rendre(geo);
    expect(html.match(/data-ligne-escalier="/g)).toHaveLength(3);
    const i = ["Un", "Deux", "Trois"].map((t) => html.indexOf(`>${t}<`));
    expect(i.every((x) => x > 0)).toBe(true);
    expect([...i].sort((a, b) => a - b)).toEqual(i);
  });

  it("null → balisage vide", () => expect(rendre(null)).toBe(""));

  it("ligne active nette, lignes passées floues (AM-09 : 5 px, 40 %)", () => {
    expect(MEMOIRE_FLOUE).toEqual({ flouPx: 5, opacite: 0.4 });
    const html = rendre(geo, 2);
    expect(html.match(/blur\(5px\)/g)).toHaveLength(2);
    expect(html.match(/opacity:0\.4/g)).toHaveLength(2);
    expect(rendre(geo, 0)).not.toContain("blur(");
  });

  it("positions absolues et échelle venues de la géométrie", () => {
    const html = rendre(geo);
    for (const l of geo.lignes) {
      expect(html).toContain(`left:${l.xPx}px`);
      expect(html).toContain(`top:${l.yPx}px`);
      expect(html).toContain(`scale(${l.echelle})`);
    }
  });

  it("Manrope, couleurs reçues en propriétés", () => {
    const html = rendre(geo);
    expect(html).toMatch(/Manrope/);
    expect(html).toContain("#111111");
    expect(html).not.toMatch(/orange/i);
  });

  it("même entrée = même balisage", () => expect(rendre(geo)).toBe(rendre(geo)));
});

describe("C2-U20b-a : éteint = identique", () => {
  it("rien n'importe LigneEscalier (src, studio-rendu/src, studio-rendu/compositions)", () => {
    const hors = [...sources("src"), ...sources("studio-rendu/src"), ...sources("studio-rendu/compositions")].filter(
      (f) => !f.endsWith("sous-titres/LigneEscalier.tsx") && /(from|import)\s*\(?\s*["'][^"']*LigneEscalier["']/.test(readFileSync(f, "utf8")),
    );
    expect(hors).toEqual([]);
  });
});
