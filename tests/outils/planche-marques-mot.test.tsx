/** C11-T3-PLANCHE-v19c : planche d'attente (outil local) des 4 marques sous le mot à plaque. */
import React from "react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { couleursMarque, MARQUES_MOT, MARQUES_MOT_ACTIF, type MarqueMot } from "../../src/briques/sous-titres/marques-mot";
import { couleursSur } from "../../src/briques/jetons-motion";
import { formeDe, MOTS_MARQUE, PlancheMarquesMot, TAILLE_PX } from "../../outils/planche-marques-mot/PlancheMarquesMot";

const RACINE = join(__dirname, "..", "..");
const lire = (p: string) => readFileSync(join(RACINE, p), "utf8");
const rendre = () => renderToStaticMarkup(<PlancheMarquesMot />);
const FONDS = ["ivoire", "noir"] as const;
const TEINTES = ["terracotta", "ivoire"] as const;
const attr = (s: string, n: string): string | null => s.match(new RegExp(`(?:^|[\\s<])${n}="([^"]*)"`))?.[1] ?? null;

interface Svg { marque: MarqueMot; teinte: "terracotta" | "ivoire"; fond: "ivoire" | "noir"; mot: string; html: string }
function svgs(h: string): Svg[] {
  return (h.match(/<svg[\s\S]*?<\/svg>/g) ?? []).map((html) => ({
    marque: attr(html, "data-marque") as MarqueMot,
    teinte: attr(html, "data-teinte") as Svg["teinte"],
    fond: attr(html, "data-fond") as Svg["fond"],
    mot: attr(html, "data-mot") as string,
    html,
  }));
}
const trouver = (l: Svg[], marque: MarqueMot, teinte: string, fond: string, mot: string): Svg => {
  const s = l.find((x) => x.marque === marque && x.teinte === teinte && x.fond === fond && x.mot === mot);
  if (!s) throw new Error(`svg ${marque}/${teinte}/${fond}/${mot} absent`);
  return s;
};
const forme = (s: Svg) => formeDe(s.marque, s.mot)!;
const minus = (c: string) => c.toLowerCase();
function sources(dossier: string): string[] {
  return readdirSync(join(RACINE, dossier)).flatMap((n) => {
    const rel = `${dossier}/${n}`;
    if (n === "node_modules" || n.startsWith(".")) return [];
    return statSync(join(RACINE, rel)).isDirectory() ? sources(rel) : /\.(ts|tsx)$/.test(n) ? [rel] : [];
  });
}

describe("C11-T3-PLANCHE-v19c planche des marques du mot", () => {
  const h = rendre();
  const liste = svgs(h);
  it("2 fonds × 2 teintes × 4 marques × 3 mots = 48 svg ; pinceau et papier : d = chemin", () => {
    expect(MOTS_MARQUE).toHaveLength(3);
    expect(liste).toHaveLength(48);
    for (const fond of FONDS) for (const teinte of TEINTES) for (const marque of MARQUES_MOT) for (const mot of MOTS_MARQUE) {
      const s = trouver(liste, marque, teinte, fond, mot);
      if (marque === "pinceau" || marque === "papier") {
        const f = forme(s);
        expect(f.chemin).toBeTruthy();
        expect(attr(s.html.match(/<path[^>]*>/)![0], "d")).toBe(f.chemin);
      }
    }
  });
  it("evide : fill none, aucun path ; chevauche : y du rect = base.y + decalageYPx, décalage < 0", () => {
    for (const s of liste) {
      const f = forme(s);
      if (s.marque === "evide") {
        expect(s.html).toContain('fill="none"');
        expect(s.html).not.toContain("<path");
        expect(f.contourSeul).toBe(true);
      }
      if (s.marque === "chevauche") {
        expect(f.decalageYPx).toBeLessThan(0);
        const rect = s.html.match(/<rect[^>]*>/)![0];
        expect(Number(attr(rect, "y"))).toBeCloseTo(f.base.y + f.decalageYPx!, 2);
      }
    }
  });
  it("couleurs de chaque plaque et de chaque mot = couleursMarque (hex sans casse) ; fond de la planche = couleursSur", () => {
    for (const s of liste) {
      const c = couleursMarque(s.marque, s.teinte);
      const fondPage = couleursSur(s.fond).fond;
      expect(minus(s.html)).toContain(`background:${minus(fondPage)}`);
      const texte = s.html.match(/<text[^>]*>/)![0];
      expect(minus(attr(texte, "fill")!)).toBe(minus(c.texte));
      if (s.marque === "evide") expect(minus(attr(s.html.match(/<rect[^>]*>/)![0], "stroke")!)).toBe(minus(c.fond));
      else expect(minus(attr(s.html.match(/<(?:path|rect)[^>]*>/)![0], "fill")!)).toBe(minus(c.fond));
    }
  });
  it("repère « bas du mot hors plaque » pour chevauche seulement, calculé", () => {
    for (const s of liste) {
      const f = forme(s);
      const attendu = f.base.y + (f.decalageYPx ?? 0) + f.base.hauteur < 40 + TAILLE_PX ? "oui" : "non";
      const bloc = h.slice(h.indexOf(s.html), h.indexOf(s.html) + s.html.length + 400);
      if (s.marque === "chevauche") expect(bloc).toContain(`bas du mot hors plaque : ${attendu}`);
      else expect(bloc.slice(s.html.length)).not.toContain("bas du mot hors plaque");
    }
  });
  it("même rendu deux fois = même balisage ; aucune image ni lien ; Manrope ; titre", () => {
    expect(h).not.toMatch(/<img|<image|href=/);
    expect(rendre()).toBe(h);
    expect(h).toContain("Manrope");
    expect(h).toContain("Planche d&#x27;attente C11-T3 : rien n&#x27;est branché");
  });
  it("éteint = identique : interrupteur éteint, personne ne cite la planche, listes fermées des citeurs inchangées", () => {
    expect(MARQUES_MOT_ACTIF).toBe(false);
    const fichiers = [...sources("src"), ...sources("studio-rendu")];
    for (const f of fichiers) expect(lire(f), f).not.toMatch(/planche-marques-mot|PlancheMarquesMot/);
    // même relevé que marques-mot.test.ts (citeurs de marques-mot / MarqueMot) et pave-geometrie.test.ts (citeurs du pavé)
    const hors = (a: string[], fins: string[]) => a.filter((f) => !fins.some((x) => f.endsWith(x)));
    const marques = hors(fichiers, ["marques-mot.ts", "MarqueMot.tsx"]).filter((f) => /marques-mot|MarqueMot/.test(lire(f))).sort();
    expect(marques).toEqual(["src/briques/composition/parametres.ts", "src/briques/sous-titres/scene.ts", "studio-rendu/compositions/sous-titres/CalqueSousTitres.tsx"]);
    const paves = hors(fichiers, ["pave.ts", "MotPave.tsx"]).filter((f) => !f.includes("studio-rendu/node_modules") && /MotPave|geometriePave|instantsPaves/.test(lire(f))).sort();
    expect(paves).toEqual(["studio-rendu/compositions/sous-titres/CalqueSousTitres.tsx", "studio-rendu/src/composition/texte-instants.ts"]);
  });
  it("gardes statiques du composant et du script", () => {
    for (const f of ["outils/planche-marques-mot/PlancheMarquesMot.tsx", "outils/planche-marques-mot/planche.mts"]) {
      expect(lire(f), f).not.toMatch(/from\s+["']@\/|@\/services|fournisseurs|remotion|studio-rendu\/compositions|MarqueMot\.tsx|MotPave/);
    }
    expect(lire("outils/planche-marques-mot/PlancheMarquesMot.tsx")).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });
});
