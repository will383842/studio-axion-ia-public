/** C9-23 — grille en pointillé et vignettes numérotées : pièces pures non inscrites. */
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EXEMPLES_GRILLE,
  EXEMPLES_VIGNETTES,
  OBJET_GRILLE_POINTILLEE,
  OBJET_VIGNETTES_NUMEROTEES,
  caseSelectionnee,
  type ParametresGrille,
  type ParametresVignettes,
} from "../../src/briques/motion/petits-objets/grille-vignettes";
import { verifierDefinition, type DefinitionObjet, type TonObjet } from "../../src/briques/motion/petits-objets/contrat";
import { couleurDuTon } from "../../src/briques/motion/petits-objets/tons";
import { couleursSur, type FondAxion } from "../../src/briques/jetons-motion";
import { PALETTE } from "../../src/briques/charte/axion-2026";

const TOUS = [OBJET_GRILLE_POINTILLEE, OBJET_VIGNETTES_NUMEROTEES] as unknown as DefinitionObjet<unknown>[];
const PG: ParametresGrille = { colonnes: 3, lignes: 2, interrogations: [1, 4] };
const PV: ParametresVignettes = { n: 5 };
const TONS: TonObjet[] = ["neutre", "accent", "valide", "erreur"];
const FONDS: FondAxion[] = ["ivoire", "noir"];
const D = 90;

function rendre(def: DefinitionObjet<unknown>, image: number, o: { graine?: number; ton?: TonObjet; fond?: FondAxion; p?: unknown } = {}) {
  const p = o.p ?? (def.id === "objet-grille-pointillee" ? PG : PV);
  return renderToStaticMarkup(def.Rendu({ image, fps: 25, dureeImages: D, fond: o.fond ?? "ivoire", parametres: p, ton: o.ton ?? "neutre", graine: o.graine ?? 7 }));
}
const decalages = (m: string) => [...m.matchAll(/stroke-dashoffset="([^"]+)"/g)].map((x) => Number(x[1]));

describe("C9-23 contrat", () => {
  it("identifiants propres, famille schema, capacité objet.schema", () => {
    expect(TOUS.map((d) => d.id)).toEqual(["objet-grille-pointillee", "objet-vignettes-numerotees"]);
    for (const d of TOUS) {
      expect(verifierDefinition(d)).toBe("ok");
      expect(d.famille).toBe("schema");
      expect(d.capacite).toBe("objet.schema");
      expect(d.donnees).toBe("aucune");
    }
  });
  it("valider ne lève jamais et refuse les mauvaises entrées", () => {
    for (const d of TOUS) for (const mauvais of [undefined, null, {}, 42, "un deux trois quatre cinq"]) expect(d.valider(mauvais)).toBeNull();
    expect(OBJET_GRILLE_POINTILLEE.valider(PG)).toEqual(PG);
    expect(OBJET_VIGNETTES_NUMEROTEES.valider(PV)).toEqual(PV);
  });
  it("exemples valides", () => {
    for (const e of EXEMPLES_GRILLE) expect(OBJET_GRILLE_POINTILLEE.valider(e)).not.toBeNull();
    for (const e of EXEMPLES_VIGNETTES) expect(OBJET_VIGNETTES_NUMEROTEES.valider(e)).not.toBeNull();
  });
});

describe("C9-23 rendu", () => {
  it("déterministe, tracé à 0 en image 0, opacité 0 à la dernière image, tenue pleine", () => {
    for (const d of TOUS) {
      expect(rendre(d, 20)).toBe(rendre(d, 20));
      expect(decalages(rendre(d, 0)).every((x) => x === 1)).toBe(true);
      expect(rendre(d, D - 1)).toMatch(/opacity="0"/);
      expect(decalages(rendre(d, 40)).every((x) => x === 0)).toBe(true);
      expect(rendre(d, 40)).toMatch(/opacity="1"/);
    }
  });
  it("sortie en 6 images exactement", () => {
    for (const d of TOUS) {
      const sous = Array.from({ length: D }, (_, i) => i).filter((i) => !/<g opacity="1"/.test(rendre(d, i)) && i > 10);
      expect(sous).toEqual([84, 85, 86, 87, 88, 89]);
    }
  });
  it("couleurs de la charte seulement, aucun filter/mask/drop-shadow/image", () => {
    for (const d of TOUS) for (const fond of FONDS) for (const ton of TONS) {
      const m = rendre(d, 40, { fond, ton });
      const permis = [couleurDuTon(ton, fond), couleurDuTon("accent", fond), couleursSur(fond).texte];
      for (const c of m.matchAll(/(?:stroke|fill)="([^"]+)"/g)) if (c[1] !== "none") expect(permis).toContain(c[1]);
      expect(m).not.toMatch(/filter|mask|drop-shadow|<image/i);
      if (fond === "ivoire") expect(m).not.toContain(PALETTE.orange);
    }
  });
  it("textes en Manrope", () => {
    for (const d of TOUS) expect(rendre(d, 40)).toContain("Axion Manrope");
  });
});

describe("C9-23 propres à la fiche", () => {
  it("N hors 2..9 → null ; grille invalide → null", () => {
    for (const n of [0, 1, 10, 2.5, -3, NaN, "4"]) expect(OBJET_VIGNETTES_NUMEROTEES.valider({ n })).toBeNull();
    for (const n of [2, 9]) expect(OBJET_VIGNETTES_NUMEROTEES.valider({ n })).toEqual({ n });
    for (const mauvais of [{ colonnes: 1, lignes: 1 }, { colonnes: 5, lignes: 2 }, { colonnes: 3, lignes: 2, interrogations: [6] }, { colonnes: 3, lignes: 2, interrogations: [1, 1] }, { colonnes: 3, lignes: 2, interrogations: "x" }])
      expect(OBJET_GRILLE_POINTILLEE.valider(mauvais)).toBeNull();
  });
  it("grille : un « ? » par case marquée, rien d'autre", () => {
    const m = rendre(OBJET_GRILLE_POINTILLEE, 40);
    expect(m.match(/>\?</g)?.length).toBe(2);
    expect(rendre(OBJET_GRILLE_POINTILLEE, 40, { p: { colonnes: 2, lignes: 2 } })).not.toContain("?");
  });
  it("vignettes : numéros 1..N, aucune balise image", () => {
    const m = rendre(OBJET_VIGNETTES_NUMEROTEES, 40);
    for (let i = 1; i <= 5; i++) expect(m).toContain(`>${i}<`);
    expect(m).not.toContain(">6<");
    expect(m).not.toContain("<image");
  });
  it("la sélection est sur la case attendue à l'image donnée et avance", () => {
    expect(caseSelectionnee(0, D, 5)).toBe(0);
    let prec = -1;
    for (let i = 0; i < D; i++) {
      const c = caseSelectionnee(i, D, 5);
      expect(c).toBeGreaterThanOrEqual(prec);
      expect(c).toBeLessThan(5);
      prec = c;
    }
    expect(caseSelectionnee(D - 1, D, 5)).toBe(4);
    const m = rendre(OBJET_VIGNETTES_NUMEROTEES, 40);
    const c = caseSelectionnee(40, D, 5);
    expect(m).toContain(`data-selection="${c}"`);
    expect(m.match(/data-selection=/g)?.length).toBe(1);
  });
});

describe("C9-23 garde statique du fichier (13 motifs de garde.test.ts:8-22, copiés)", () => {
  const texte = readFileSync(join(__dirname, "..", "..", "src", "briques", "motion", "petits-objets", "grille-vignettes.tsx"), "utf8");
  const MOTIFS: [string, RegExp][] = [
    ["@/", /@\//], ["zod", /\bzod\b/], ["Math.random", /Math\.random/], ["remotion", /remotion/],
    ["moteurs/", /from\s+["'][^"']*moteurs\//], ["-v4", /from\s+["'][^"']*-v4/], ["VideoAnimeeV4", /VideoAnimeeV4/],
    ["briques-v4", /briques-v4/], ["faits-script", /faits-script/], ["droits", /from\s+["'][^"']*\/droits/],
    ["bibliotheque-video", /bibliotheque-video/], ["domaine", /src\/domaine|from\s+["'][^"']*\/domaine\//], ["services", /from\s+["'][^"']*\/services\//],
  ];
  it("aucun motif interdit", () => {
    expect(MOTIFS.filter(([, re]) => re.test(texte)).map(([n]) => n)).toEqual([]);
  });
  it("ni filtre, ni masque, ni courbe littérale, ni ressort, ni image", () => {
    expect(texte).not.toMatch(/drop-shadow|<mask|<filter|\bfilter\s*[=:]|cubic-bezier|Easing\.bezier|damping|stiffness|mass\s*:|<image/);
  });
});
