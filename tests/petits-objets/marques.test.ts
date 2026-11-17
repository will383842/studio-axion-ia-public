/** C9-09 — marques : coche, croix, mot barré (pièces pures non inscrites). */
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EXEMPLES_MARQUES,
  OBJET_COCHE,
  OBJET_CROIX,
  OBJET_MOT_BARRE,
  type ParametresMarque,
} from "../../src/briques/motion/petits-objets/marques";
import { verifierDefinition, type DefinitionObjet, type TonObjet } from "../../src/briques/motion/petits-objets/contrat";
import { couleurDuTon } from "../../src/briques/motion/petits-objets/tons";
import { couleursSur, type FondAxion } from "../../src/briques/jetons-motion";
import { PALETTE } from "../../src/briques/charte/axion-2026";
import { garderObjet } from "../../src/briques/plan-scenes-objets/garde";

const TOUS = [OBJET_COCHE, OBJET_CROIX, OBJET_MOT_BARRE] as unknown as DefinitionObjet<ParametresMarque>[];
const P: ParametresMarque = { boite: { x: 20, y: 30, largeur: 40, hauteur: 25 } };
const TONS: TonObjet[] = ["neutre", "accent", "valide", "erreur"];
const FONDS: FondAxion[] = ["ivoire", "noir"];
const D = 60;

function rendre(def: DefinitionObjet<ParametresMarque>, image: number, o: { graine?: number; ton?: TonObjet; fond?: FondAxion; p?: ParametresMarque } = {}) {
  return renderToStaticMarkup(
    def.Rendu({ image, fps: 25, dureeImages: D, fond: o.fond ?? "ivoire", parametres: o.p ?? P, ton: o.ton ?? "neutre", graine: o.graine ?? 7 }),
  );
}
const decalages = (m: string) => [...m.matchAll(/stroke-dashoffset="([^"]+)"/g)].map((x) => Number(x[1]));

describe("C9-09 contrat", () => {
  it("identifiants propres, famille marque, capacité objet.marque", () => {
    expect(TOUS.map((d) => d.id)).toEqual(["objet-coche", "objet-croix", "objet-mot-barre"]);
    for (const d of TOUS) {
      expect(verifierDefinition(d)).toBe("ok");
      expect(d.famille).toBe("marque");
      expect(d.capacite).toBe("objet.marque");
    }
  });
  it("valider ne lève jamais et refuse les mauvaises entrées", () => {
    for (const d of TOUS) {
      for (const mauvais of [undefined, null, {}, 42, "un deux trois quatre cinq", { boite: { x: 1, y: 1 } }, { boite: { x: 0, y: 0, largeur: 100, hauteur: 100 } }, { boite: { x: 90, y: 0, largeur: 20, hauteur: 10 } }, { boite: { x: "a", y: 1, largeur: 2, hauteur: 2 } }])
        expect(d.valider(mauvais)).toBeNull();
      expect(d.valider(P)).toEqual(P);
    }
  });
  it("exemples valides", () => {
    for (const d of TOUS) for (const e of EXEMPLES_MARQUES) expect(d.valider(e)).not.toBeNull();
  });
});

describe("C9-09 rendu", () => {
  it("déterministe, tracé à 0 en image 0, opacité 0 à la dernière image, tenue pleine", () => {
    for (const d of TOUS) {
      expect(rendre(d, 20)).toBe(rendre(d, 20));
      expect(decalages(rendre(d, 0)).every((x) => x === 1)).toBe(true);
      expect(rendre(d, D - 1)).toMatch(/opacity="0"/);
      expect(decalages(rendre(d, 30)).every((x) => x === 0)).toBe(true);
      expect(rendre(d, 30)).toMatch(/opacity="1"/);
    }
  });
  it("sortie en 6 images exactement", () => {
    for (const d of TOUS) {
      const sous = Array.from({ length: D }, (_, i) => i).filter((i) => !/opacity="1"/.test(rendre(d, i)) && i > 10);
      expect(sous).toEqual([54, 55, 56, 57, 58, 59]);
    }
  });
  it("couleurs de la charte seulement, aucun filter/mask/drop-shadow, aucun #B8341C", () => {
    for (const d of TOUS) for (const fond of FONDS) for (const ton of TONS) {
      const m = rendre(d, 30, { fond, ton, p: { ...P, preuve: "ok", rond: true } });
      const permis = [couleurDuTon("neutre", fond), couleurDuTon("accent", fond), couleurDuTon("valide", fond), couleurDuTon("erreur", fond), couleursSur(fond).texte];
      for (const c of m.matchAll(/stroke="([^"]+)"/g)) expect(permis).toContain(c[1]);
      expect(m).not.toMatch(/filter|mask|drop-shadow/i);
      expect(m.toUpperCase()).not.toContain("#B8341C");
      if (fond === "ivoire") expect(m).not.toContain(PALETTE.orange);
    }
  });
  it("aucun texte dans le balisage", () => {
    for (const d of TOUS) expect(rendre(d, 30)).not.toMatch(/<text/);
  });
});

describe("C9-09 propres à la fiche", () => {
  const couleurs = (m: string) => [...new Set([...m.matchAll(/stroke="([^"]+)"/g)].map((x) => x[1]))];
  it("coche sans preuve : jamais sauge ; avec preuve : sauge", () => {
    for (const ton of TONS) for (const fond of FONDS) {
      expect(couleurs(rendre(OBJET_COCHE, 30, { ton, fond }))).not.toContain(PALETTE.reussite);
      expect(couleurs(rendre(OBJET_COCHE, 30, { ton, fond, p: { ...P, preuve: "   " } }))).not.toContain(PALETTE.reussite);
    }
    expect(couleurs(rendre(OBJET_COCHE, 30, { ton: "neutre", p: { ...P, preuve: "facture n°4" } }))).toEqual([PALETTE.reussite]);
  });
  it("coche : rond facultatif (un trait de plus)", () => {
    const sans = decalages(rendre(OBJET_COCHE, 30)).length;
    const avec = decalages(rendre(OBJET_COCHE, 30, { p: { ...P, rond: true } })).length;
    expect(avec).toBe(sans + 1);
  });
  it("garde Studio : coche sans preuve refusée, avec preuve acceptée", () => {
    const ctx = { mots: [], premier: 0, dernier: -1 } as never;
    const def = OBJET_COCHE as unknown as DefinitionObjet<unknown>;
    expect(garderObjet(def, { coche: true }, ctx)).toEqual({ refus: "validation sans preuve" });
    expect(garderObjet(def, { coche: true, preuve: "x" }, ctx)).toBe("ok");
  });
  it("croix : deux traits, le 2e 4 images après le 1er", () => {
    const d0 = (i: number) => decalages(rendre(OBJET_CROIX, i, { ton: "erreur" }));
    expect(d0(0)).toEqual([1, 1]);
    const [a, b] = d0(3);
    expect(a).toBeLessThan(1);
    expect(b).toBe(1);
    expect(d0(4)[1]).toBe(1);
    expect(d0(5)[1]).toBeLessThan(1);
    expect(d0(4)[0]).toBe(decalages(rendre(OBJET_CROIX, 4, { ton: "erreur" }))[0]);
    expect(d0(4)[0]).toBeLessThan(d0(3)[0]);
  });
  it("croix et barré : terracotta en ton erreur", () => {
    for (const d of [OBJET_CROIX, OBJET_MOT_BARRE] as unknown as DefinitionObjet<ParametresMarque>[])
      expect(couleurs(rendre(d, 30, { ton: "erreur" }))).toEqual([couleurDuTon("erreur", "ivoire")]);
  });
  it("mot barré : un seul trait en biais de 12° au plus", () => {
    for (const graine of [0, 1, 7, 99, 12345]) {
      const m = rendre(OBJET_MOT_BARRE, 30, { graine });
      const ds = [...m.matchAll(/ d="M ([\d.-]+) ([\d.-]+) L ([\d.-]+) ([\d.-]+)"/g)];
      expect(ds.length).toBe(1);
      const [, x1, y1, x2, y2] = ds[0].map(Number);
      const angle = (Math.atan2(Math.abs(y2 - y1), Math.abs(x2 - x1)) * 180) / Math.PI;
      expect(angle).toBeLessThanOrEqual(12.01);
      expect(Math.abs(x2 - x1)).toBeGreaterThan(300);
    }
  });
});

describe("C9-09 garde statique du fichier (13 motifs de garde.test.ts:8-22, copiés)", () => {
  const texte = readFileSync(join(__dirname, "..", "..", "src", "briques", "motion", "petits-objets", "marques.tsx"), "utf8");
  const MOTIFS: [string, RegExp][] = [
    ["@/", /@\//], ["zod", /\bzod\b/], ["Math.random", /Math\.random/], ["remotion", /remotion/],
    ["moteurs/", /from\s+["'][^"']*moteurs\//], ["-v4", /from\s+["'][^"']*-v4/], ["VideoAnimeeV4", /VideoAnimeeV4/],
    ["briques-v4", /briques-v4/], ["faits-script", /faits-script/], ["droits", /from\s+["'][^"']*\/droits/],
    ["bibliotheque-video", /bibliotheque-video/], ["domaine", /src\/domaine|from\s+["'][^"']*\/domaine\//], ["services", /from\s+["'][^"']*\/services\//],
  ];
  it("aucun motif interdit", () => {
    expect(MOTIFS.filter(([, re]) => re.test(texte)).map(([n]) => n)).toEqual([]);
  });
  it("ni filtre, ni masque, ni courbe littérale, ni ressort, ni #B8341C", () => {
    expect(texte).not.toMatch(/drop-shadow|<mask|<filter|\bfilter\s*[=:]|cubic-bezier|Easing\.bezier|damping|stiffness|mass\s*:/i);
    expect(texte.toUpperCase()).not.toContain("B8341C");
  });
});
