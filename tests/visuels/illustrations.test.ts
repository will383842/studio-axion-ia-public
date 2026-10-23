/** L8 : banque d'illustrations et d'icônes — couleurs de la charte seulement, aucun texte, liste fermée, droits couverts. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DROITS, trouverDroit } from "../../src/briques/droits";
import { CHARTE_CARROUSEL } from "../../src/briques/visuels/charte-carrousel";
import { ICONES, ILLUSTRATIONS, REGISTRE_DESSINS, chercherDessins, dessinConnu, trouverDessin, type IdIllustration } from "../../src/briques/visuels/registre-illustrations";
import { COMPOSANTS_ILLUSTRATIONS } from "../../studio-rendu/compositions/visuels/illustrations";
import { Icone2Tons } from "../../studio-rendu/compositions/visuels/icones/Icone2Tons";
import { LUCIDE, NOMS_LUCIDE } from "../../studio-rendu/compositions/visuels/icones/lucide";
import { BLANC_CARTE } from "../../src/briques/visuels/couleur-papier";
import { palette } from "../../studio-rendu/compositions/visuels/illustrations/palette";

const RACINE_RENDU = fileURLToPath(new URL("../../studio-rendu/", import.meta.url));
const AUTORISEES = new Set([...Object.values(CHARTE_CARROUSEL.couleurs), BLANC_CARTE].map((c) => c.toLowerCase()));
const NEUTRES = new Set(["none", "transparent"]);

function rendu(id: string, taille = 200): string {
  if (id.startsWith("icone-")) return renderToStaticMarkup(createElement(Icone2Tons, { nom: id.slice(6) as never, taille }));
  return renderToStaticMarkup(createElement(COMPOSANTS_ILLUSTRATIONS[id as keyof typeof COMPOSANTS_ILLUSTRATIONS], { taille }));
}

/** Primitives autorisées, illustration par illustration (aucun <image>, <text>, <use>, <foreignObject>…). */
const BASE = ["svg", "g", "path", "rect", "circle"];
const PRIMITIVES: Record<IdIllustration, readonly string[]> = {
  I01: BASE, I02: [...BASE, "ellipse"], I03: [...BASE, "ellipse"], I04: [...BASE, "ellipse"], I05: [...BASE, "ellipse"], I06: [...BASE, "ellipse"],
  I07: [...BASE, "ellipse"], I08: BASE, I09: [...BASE, "ellipse"], I10: [...BASE, "ellipse"], I11: [...BASE, "ellipse"], I12: [...BASE, "ellipse"],
};

interface Rond { cx: number; cy: number; r: number; plein: boolean }

function ronds(svg: string): Rond[] {
  return [...svg.matchAll(/<(circle|ellipse)\b([^>]*)>/g)].map(([, balise, attrs]) => {
    const v = (n: string) => Number(attrs.match(new RegExp(`\\b${n}="([^"]*)"`))?.[1] ?? 0);
    const fill = attrs.match(/\bfill="([^"]*)"/)?.[1];
    const r = balise === "circle" ? v("r") : Math.max(v("rx"), v("ry"));
    return { cx: v("cx"), cy: v("cy"), r, plein: fill !== undefined && fill !== "none" };
  });
}

/**
 * Forme de visage : un grand cercle (r ≥ 10) avec, DANS ou JUSTE AU-DESSUS de lui, deux petits cercles pleins
 * (entre 6 % et 35 % de son rayon : des yeux, pas un semis de points) à la même hauteur et symétriques par rapport à son axe,
 * peints APRÈS lui (sinon il les cache : c'est le cas du semis de points des fonds, peint avant tout le reste).
 */
function ressembleAVisage(svg: string): boolean {
  const tous = ronds(svg);
  return tous.some((t, k) => t.r >= 10 && tous.some((a, i) => tous.some((b, j) => {
    if (j <= i || i <= k || !a.plein || !b.plein) return false;
    if (a.r < 0.06 * t.r || a.r > 0.35 * t.r || Math.abs(a.r - b.r) > 0.25 * a.r) return false;
    if (Math.abs(a.cy - b.cy) > 1.5 || Math.abs(a.cx - b.cx) < a.r * 2) return false;
    if (Math.abs((a.cx + b.cx) / 2 - t.cx) > 0.15 * t.r) return false;
    return a.cy > t.cy - 1.6 * t.r && a.cy < t.cy + 0.3 * t.r && Math.abs(a.cx - t.cx) < t.r;
  })));
}

function couleursUtilisees(svg: string): string[] {
  return [...svg.matchAll(/\b(?:fill|stroke|stop-color|flood-color)="([^"]*)"/g)].map((m) => m[1].toLowerCase());
}

describe("registre des illustrations", () => {
  it("12 illustrations I01…I12 et 40 icônes", () => {
    expect(ILLUSTRATIONS.map((d) => d.id)).toEqual(Array.from({ length: 12 }, (_, i) => `I${String(i + 1).padStart(2, "0")}`));
    expect(ICONES).toHaveLength(40);
  });
  it("identifiants uniques et métadonnées complètes", () => {
    const ids = REGISTRE_DESSINS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const d of REGISTRE_DESSINS) {
      expect(d.nom.trim(), d.id).not.toBe("");
      expect(d.motsCles.length, d.id).toBeGreaterThanOrEqual(3);
      expect(d.licence.trim(), d.id).not.toBe("");
    }
  });
  it("chaque identifiant du registre a un composant, et inversement", () => {
    for (const d of ILLUSTRATIONS) expect(typeof COMPOSANTS_ILLUSTRATIONS[d.id as keyof typeof COMPOSANTS_ILLUSTRATIONS], d.id).toBe("function");
    expect(Object.keys(COMPOSANTS_ILLUSTRATIONS).sort()).toEqual(ILLUSTRATIONS.map((d) => d.id).sort());
    expect(ICONES.map((d) => d.nom).sort()).toEqual([...NOMS_LUCIDE].sort());
  });
  it("liste fermée : un identifiant inconnu ou piégé n'est pas accepté", () => {
    expect(dessinConnu("I01")).toBe(true);
    expect(dessinConnu("icone-courrier")).toBe(true);
    for (const piege of ["", "I13", "<svg onload=x>", "../I01", "i01", "icone-"]) expect(dessinConnu(piege), piege).toBe(false);
    expect(trouverDessin("I13")).toBeUndefined();
  });
  it("recherche par mot-clé", () => {
    expect(chercherDessins("facture").map((d) => d.id)).toContain("I11");
    expect(chercherDessins("  ")).toEqual([]);
  });
});

describe("rendu SVG", () => {
  it.each(REGISTRE_DESSINS.map((d) => d.id))("%s : du SVG, couleurs de la charte seulement, aucun texte", (id) => {
    const svg = rendu(id);
    expect(svg.startsWith("<svg")).toBe(true);
    const couleurs = couleursUtilisees(svg);
    expect(couleurs.length).toBeGreaterThan(0);
    for (const c of couleurs) expect(AUTORISEES.has(c) || NEUTRES.has(c), `${id} : ${c}`).toBe(true);
    expect(svg).not.toMatch(/<text|<tspan|<foreignObject|<image|<script|<style|url\(|href=|onload|style="/i);
  });
  it.each(ILLUSTRATIONS.map((d) => d.id))("%s : rendu à la taille demandée (attribut width à 120 et 560 px)", (id) => {
    expect(rendu(id, 120)).toMatch(/width="120"/);
    expect(rendu(id, 560)).toMatch(/width="560"/);
  });
  it("les illustrations sont toutes DIFFÉRENTES et utilisent l'orange ET l'encre", () => {
    const rendus = ILLUSTRATIONS.map((d) => rendu(d.id));
    expect(new Set(rendus).size).toBe(12);
    for (const s of rendus) {
      expect(s).toContain(CHARTE_CARROUSEL.couleurs.orange);
      expect(s).toContain(CHARTE_CARROUSEL.couleurs.encre);
    }
  });
  it("les couleurs facultatives remplacent celles de la charte", () => {
    const svg = renderToStaticMarkup(createElement(COMPOSANTS_ILLUSTRATIONS.I03, { taille: 100, orange: CHARTE_CARROUSEL.couleurs.orangeFonce }));
    expect(svg).toContain(CHARTE_CARROUSEL.couleurs.orangeFonce);
    expect(svg).not.toContain(CHARTE_CARROUSEL.couleurs.orange);
  });
  it("les couleurs sont typées sur la charte : une chaîne libre est refusée à la compilation", () => {
    // @ts-expect-error — couleur hors charte
    const refusee = palette({ orange: "#112233" });
    expect(refusee.orange).toBe("#112233");
    expect(palette({ orange: CHARTE_CARROUSEL.couleurs.pale }).orange).toBe(CHARTE_CARROUSEL.couleurs.pale);
  });
  it("aucun identifiant (id=) dupliqué dans un rendu", () => {
    for (const d of REGISTRE_DESSINS) {
      const ids = [...rendu(d.id).matchAll(/\bid="([^"]*)"/g)].map((m) => m[1]);
      expect(new Set(ids).size, d.id).toBe(ids.length);
    }
  });
  it("aucun code couleur littéral dans les composants (le blanc de carte vit dans src/briques/visuels/couleur-papier.ts)", () => {
    for (const dossier of ["illustrations", "icones"]) {
      for (const f of readdirSync(join(RACINE_RENDU, "compositions/visuels", dossier)).filter((n) => /\.tsx?$/.test(n) && n !== "palette.ts")) {
        expect(readFileSync(join(RACINE_RENDU, "compositions/visuels", dossier, f), "utf8"), f).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
      }
    }
  });
  it.each(ILLUSTRATIONS.map((d) => d.id))("%s : seules les primitives SVG de sa liste blanche", (id) => {
    const balises = new Set([...rendu(id).matchAll(/<([a-zA-Z]+)/g)].map((m) => m[1]));
    for (const b of balises) expect(PRIMITIVES[id as IdIllustration], `${id} : <${b}>`).toContain(b);
  });
  it.each(ILLUSTRATIONS.map((d) => d.id))("%s : aucune forme de visage (grand cercle + deux petits cercles pleins symétriques)", (id) => {
    expect(ressembleAVisage(rendu(id))).toBe(false);
  });
  it("le détecteur de visage reconnaît bien un visage (contrôle du contrôle)", () => {
    const tete = '<svg><circle cx="100" cy="100" r="40" fill="#F2DFCB"/><circle cx="86" cy="92" r="5" fill="#0D0A07"/><circle cx="114" cy="92" r="5" fill="#0D0A07"/></svg>';
    const silhouette = '<svg><circle cx="100" cy="60" r="20" fill="#F2DFCB"/><circle cx="93" cy="56" r="3" fill="#0D0A07"/><circle cx="107" cy="56" r="3" fill="#0D0A07"/></svg>';
    expect(ressembleAVisage(tete)).toBe(true);
    expect(ressembleAVisage(silhouette)).toBe(true);
    expect(ressembleAVisage('<svg><circle cx="100" cy="100" r="40" fill="#F2DFCB"/><circle cx="86" cy="92" r="5" fill="none"/><circle cx="114" cy="92" r="5" fill="none"/></svg>')).toBe(false);
  });
});

describe("icônes Lucide", () => {
  const source = readFileSync(join(RACINE_RENDU, "compositions/visuels/icones/lucide.ts"), "utf8");
  it("40 icônes, chacune avec au moins un nœud", () => {
    expect(NOMS_LUCIDE).toHaveLength(40);
    for (const n of NOMS_LUCIDE) expect(LUCIDE[n].length, n).toBeGreaterThan(0);
  });
  it("le fichier porte l'en-tête de licence ISC et cite le texte de la licence", () => {
    const entete = source.slice(0, source.indexOf("export type"));
    expect(entete).toMatch(/ISC License/);
    expect(entete).toMatch(/Lucide Contributors/);
    expect(entete).toMatch(/Cole Bemis/);
    expect(entete).toMatch(/LICENCE-Lucide-ISC\.txt/);
  });
  it("copie de la licence présente", () => {
    const texte = readFileSync(join(RACINE_RENDU, "compositions/visuels/icones/LICENCE-Lucide-ISC.txt"), "utf8");
    expect(texte).toMatch(/ISC License/);
    expect(texte).toMatch(/Permission to use, copy, modify, and\/or distribute/);
  });
  it("chaque icône est précédée de son nom Lucide d'origine (traçabilité)", () => {
    expect(source.match(/\/\*\* \[[a-z0-9-]+\] \*\//g)).toHaveLength(40);
  });
});

describe("pas de lucide-react dans studio-rendu", () => {
  function fichiers(dossier: string): string[] {
    return readdirSync(dossier).flatMap((f) => {
      if (f === "node_modules" || f.startsWith(".")) return [];
      const p = join(dossier, f);
      return statSync(p).isDirectory() ? fichiers(p) : /\.(tsx?|json)$/.test(f) && f !== "package-lock.json" ? [p] : [];
    });
  }
  it("aucun import ni dépendance lucide-react", () => {
    for (const f of fichiers(RACINE_RENDU)) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/lucide-react/);
    }
  });
});

describe("droits", () => {
  it("chaque dessin du registre pointe vers une entrée du registre des droits, valide", () => {
    for (const d of REGISTRE_DESSINS) {
      const droit = trouverDroit(d.droit);
      expect(droit, d.id).toBeDefined();
      expect(droit?.type).toBe("dessin");
    }
  });
  it("dessins maison : propriété Axion-IA ; icônes : ISC", () => {
    expect(trouverDroit("illustrations-maison-axion")?.licence).toBe("Création interne Axion-IA");
    expect(trouverDroit("icones-lucide-visuels")?.licence).toBe("ISC");
  });
  it("les nouvelles entrées n'empiètent pas sur le décompte des anciens dessins", () => {
    expect(DROITS.filter((d) => d.id.startsWith("dessin-"))).toHaveLength(40);
  });
});
