import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as carrousel from "@/briques/visuels/charte-carrousel";
import { PALETTE, choisirFond, type Fond } from "@/briques/charte/axion-2026";
import { PASTILLE_AXION, PASTILLE_AXION_ARDOISE } from "@/briques/sous-titres/pastille";

const autorises = new Set(Object.values(PALETTE).map((h) => h.toUpperCase()));
const hexDe = (src: string) => (src.match(/#[0-9A-Fa-f]{6}\b/g) ?? []).map((h) => h.toUpperCase());

describe("V7-02 : carrousels sur la charte Axion 2026", () => {
  it("charte-carrousel.ts n'écrit aucun hex en dur (tout vient de PALETTE)", () => {
    const src = readFileSync("src/briques/visuels/charte-carrousel.ts", "utf8");
    const code = src.split("\n").filter((l) => !/^\s*(\/\/|\/?\*)/.test(l)).filter((l) => !/HEX\s*=/.test(l)).join("\n");
    expect(hexDe(code)).toEqual([]);
  });

  it("garde les exports du carrousel continu (importés par continu/commun) sans dégradé dans les valeurs", () => {
    for (const nom of ["CHARTE_CONTINU", "alpha", "degrade", "DEGRADES_CONTINU"]) expect(Object.keys(carrousel)).toContain(nom);
    const D = carrousel.DEGRADES_CONTINU;
    expect(Object.keys(D)).toEqual(expect.arrayContaining(["tuile", "carte", "bouton", "barre"]));
    expect(Object.keys(D.tuile).sort()).toEqual(["g", "k", "o", "p", "w"]);
    expect(Object.keys(D.carte).sort()).toEqual(["k", "o", "pl"]);
    expect(JSON.stringify(D)).not.toMatch(/gradient/i);
    for (const v of Object.values(carrousel.CHARTE_CONTINU)) expect(autorises.has(v.toUpperCase())).toBe(true);
  });

  it("les couleurs du carrousel viennent de PALETTE (orange sur noir seulement)", () => {
    const c = carrousel.CHARTE_CARROUSEL.couleurs;
    expect(c.creme).toBe(PALETTE.ivoire);
    expect(c.blanc).toBe(PALETTE.blanc);
    expect(c.blanc).toBe("#FFFFFF");
    expect(carrousel.CHARTE_CONTINU.blancCarte).toBe(PALETTE.blanc);
    expect(c.pale).toBe(PALETTE.gris);
    expect(c.encre).toBe(PALETTE.noir);
    expect(c.orangeFonce).toBe(PALETTE.terracotta);
    expect(c.orange).toBe(PALETTE.orange);
    expect(carrousel.texteLisible(c.orangeFonce, c.creme, 30)).toBe(true);
    expect(carrousel.texteLisible(c.orange, c.encre, 30)).toBe(true);
  });

  it("D5 : aucune valeur de CHARTE_CONTINU ne vaut #8F3412 (survol, décision ouverte)", () => {
    for (const v of Object.values(carrousel.CHARTE_CONTINU)) expect(v.toUpperCase()).not.toBe("#8F3412");
  });

  it("deux rôles d'accent : accentSombre sur noir seulement, accentClair sur fonds clairs", () => {
    const C = carrousel.CHARTE_CONTINU;
    expect(carrousel.contrasteWcag(C.accentSombre, C.encre)).toBeGreaterThanOrEqual(3);
    // Sur blancCarte (#FFFFFF) l'orange fait 3,12 : la consigne « < 3 » y est fausse, l'interdit reste une règle de rôle (ESCALADE).
    for (const fond of [C.creme, carrousel.CHARTE_CARROUSEL.couleurs.pale]) expect(carrousel.contrasteWcag(C.accentSombre, fond)).toBeLessThan(3);
    for (const fond of [C.creme, C.blancCarte, carrousel.CHARTE_CARROUSEL.couleurs.pale]) expect(carrousel.contrasteWcag(C.accentClair, fond)).toBeGreaterThanOrEqual(3);
    for (const alias of [C.orange, C.orangeClair, C.orangeLumiere]) expect(alias).toBe(C.accentSombre);
  });

  it("tuiles k (noir) et w (blanche) différentes", () => {
    expect(carrousel.DEGRADES_CONTINU.tuile.k).not.toBe(carrousel.DEGRADES_CONTINU.tuile.w);
  });

  it("continu/ n'emploie que accentClair et accentSombre (jamais C.orange, C.orangeClair, C.orangeLumiere)", () => {
    const racine = "studio-rendu/compositions/visuels/continu";
    const fichiers: string[] = [];
    const parcourir = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) parcourir(p);
        else if (/\.tsx?$/.test(n)) fichiers.push(p);
      }
    };
    parcourir(racine);
    expect(fichiers.length).toBeGreaterThan(10);
    for (const f of fichiers) expect(readFileSync(f, "utf8"), f).not.toMatch(/C\.(orange|orangeClair|orangeLumiere)\b/);
  });

  it("pastille : couleurs de la palette, Manrope", () => {
    const src = readFileSync("src/briques/sous-titres/pastille.ts", "utf8");
    expect(hexDe(src).filter((h) => !autorises.has(h))).toEqual([]);
    expect(src).not.toMatch(/Inter|Poppins/);
    for (const p of [PASTILLE_AXION, PASTILLE_AXION_ARDOISE]) {
      for (const h of [p.fond, p.texte, p.motDit, ...(p.bord ? [p.bord.couleur] : [])]) expect(autorises.has(h.toUpperCase())).toBe(true);
      expect(carrousel.texteLisible(p.texte, p.fond, 62)).toBe(true);
      expect(carrousel.texteLisible(p.motDit, p.fond, 62)).toBe(true);
    }
  });

  it("choisirFond : jamais deux sombres de suite sur un carrousel entier", () => {
    const voulus: Fond[] = ["sombre", "sombre", "clair", "sombre", "sombre", "sombre", "clair"];
    let prec: Fond | null = null;
    const res = voulus.map((v, i) => (prec = choisirFond(i, prec, v)));
    expect(res.some((f, i) => f === "sombre" && res[i - 1] === "sombre")).toBe(false);
    expect(res[0]).toBe("sombre");
  });
});
