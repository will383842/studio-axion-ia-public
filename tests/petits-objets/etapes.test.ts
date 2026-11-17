/** C9-14 — pastille « Étape n/N » et compteur « n/N » à segments : pièces pures non inscrites. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXEMPLES_ETAPES, OBJET_ETAPE, OBJET_ETAPE_SEGMENTS, type ParametresEtape } from "../../src/briques/motion/petits-objets/etapes";
import { verifierDefinition, type DefinitionObjet, type TonObjet } from "../../src/briques/motion/petits-objets/contrat";
import { couleurDuTon } from "../../src/briques/motion/petits-objets/tons";
import { couleursSur, type FondAxion } from "../../src/briques/jetons-motion";
import { FAMILLE_CSS, PALETTE } from "../../src/briques/charte/axion-2026";

const TOUS = [OBJET_ETAPE, OBJET_ETAPE_SEGMENTS] as unknown as DefinitionObjet<ParametresEtape>[];
const P: ParametresEtape = { n: 2, N: 5 };
const TONS: TonObjet[] = ["neutre", "accent", "valide", "erreur"];
const FONDS: FondAxion[] = ["ivoire", "noir"];
const D = 60;

function rendre(def: DefinitionObjet<ParametresEtape>, image: number, o: { graine?: number; ton?: TonObjet; fond?: FondAxion; p?: ParametresEtape } = {}) {
  return renderToStaticMarkup(
    def.Rendu({ image, fps: 25, dureeImages: D, fond: o.fond ?? "ivoire", parametres: o.p ?? P, ton: o.ton ?? "neutre", graine: o.graine ?? 7 }),
  );
}
const decalages = (m: string) => [...m.matchAll(/stroke-dashoffset="([^"]+)"/g)].map((x) => Number(x[1]));

describe("C9-14 contrat", () => {
  it("identifiants propres, famille chiffre, capacité objet.etape, données aucune", () => {
    expect(TOUS.map((d) => d.id)).toEqual(["objet-etape", "objet-etape-segments"]);
    for (const d of TOUS) {
      expect(verifierDefinition(d)).toBe("ok");
      expect(d.famille).toBe("chiffre");
      expect(d.capacite).toBe("objet.etape");
      expect(d.donnees).toBe("aucune");
    }
  });
  it("valider ne lève jamais et refuse les mauvaises entrées", () => {
    for (const d of TOUS) {
      for (const mauvais of [undefined, null, {}, 42, "un deux trois quatre cinq", { n: 3, N: 2 }, { n: 1, N: 10 }, { n: 1.5, N: 4 }, { n: 0, N: 4 }, { n: "1", N: 4 }, { n: 1 }, { n: NaN, N: 3 }])
        expect(d.valider(mauvais)).toBeNull();
      expect(d.valider(P)).toEqual(P);
      expect(d.valider({ n: 9, N: 9 })).toEqual({ n: 9, N: 9 });
    }
  });
  it("exemples valides", () => {
    for (const d of TOUS) for (const e of EXEMPLES_ETAPES) expect(d.valider(e)).not.toBeNull();
  });
});

describe("C9-14 rendu", () => {
  it("déterministe, tracé à 0 en image 0, opacité 0 à la dernière image, tenue pleine", () => {
    for (const d of TOUS) {
      expect(rendre(d, 20)).toBe(rendre(d, 20));
      expect(decalages(rendre(d, 0)).every((x) => x === 1)).toBe(true);
      expect(rendre(d, D - 1)).toMatch(/<g opacity="0">/);
      expect(decalages(rendre(d, 45)).every((x) => x === 0)).toBe(true);
      expect(rendre(d, 45)).toMatch(/<g opacity="1">/);
    }
  });
  it("sortie en 6 images exactement", () => {
    for (const d of TOUS) {
      const sous = Array.from({ length: D }, (_, i) => i).filter((i) => !/<g opacity="1">/.test(rendre(d, i)) && i > 40);
      expect(sous).toEqual([54, 55, 56, 57, 58, 59]);
    }
  });
  it("couleurs de la charte seulement, aucun filter/mask/drop-shadow, Manrope", () => {
    for (const d of TOUS) for (const fond of FONDS) for (const ton of TONS) {
      const m = rendre(d, 45, { fond, ton });
      const permis = [couleurDuTon(ton, fond), couleurDuTon("accent", fond), couleurDuTon("neutre", fond), couleursSur(fond).texte];
      for (const c of m.matchAll(/(?:stroke|fill)="([^"]+)"/g)) if (c[1] !== "none") expect(permis).toContain(c[1]);
      expect(m).not.toMatch(/filter|mask|drop-shadow/i);
      if (fond === "ivoire") expect(m).not.toContain(PALETTE.orange);
      if (m.includes("<text")) expect(m).toContain(FAMILLE_CSS);
    }
  });
});

describe("C9-14 propres à la fiche", () => {
  it("pastille : texte « Étape n/N » (≤ 4 mots)", () => {
    const m = rendre(OBJET_ETAPE, 45);
    expect(m).toContain("Étape");
    expect(m).toMatch(/2\/5/);
  });
  it("segments : N éléments, n en ton accent en tenue, les autres neutres à opacité réduite", () => {
    for (const fond of FONDS) {
      const m = rendre(OBJET_ETAPE_SEGMENTS, 45, { fond });
      const traits = [...m.matchAll(/<g data-segment="(\d+)"[^>]*><path [^>]*>/g)];
      expect(traits.length).toBe(5);
      const accent = couleurDuTon("accent", fond);
      const neutre = couleurDuTon("neutre", fond);
      traits.forEach((t, i) => {
        expect(t[0]).toContain(`stroke="${i < 2 ? accent : neutre}"`);
        if (i >= 2) expect(t[0]).toMatch(/<g [^>]*opacity="0\.\d+"/);
        else expect(t[0]).not.toMatch(/<g [^>]*opacity="0\.\d+"/);
      });
    }
  });
  it("segments : apparition à 3 images d'écart", () => {
    const dec = (i: number) => [...rendre(OBJET_ETAPE_SEGMENTS, i).matchAll(/<g data-segment[^>]*><path [^>]*stroke-dashoffset="([^"]+)"/g)].map((x) => Number(x[1]));
    expect(dec(3)[0]).toBeLessThan(1);
    expect(dec(3)[1]).toBe(1);
    expect(dec(4)[1]).toBeLessThan(1);
    expect(dec(6)[2]).toBe(1);
    expect(dec(7)[2]).toBeLessThan(1);
  });
  it("segments : N=9 tous tracés avant la sortie", () => {
    const m = rendre(OBJET_ETAPE_SEGMENTS, 45, { p: { n: 4, N: 9 } });
    expect([...m.matchAll(/data-segment/g)].length).toBe(9);
    expect(decalages(m).every((x) => x === 0)).toBe(true);
  });
});

describe("C9-14 garde statique du fichier (13 motifs de garde.test.ts:8-22, copiés)", () => {
  const texte = readFileSync(join(__dirname, "..", "..", "src", "briques", "motion", "petits-objets", "etapes.tsx"), "utf8");
  const MOTIFS: [string, RegExp][] = [
    ["@/", /@\//], ["zod", /\bzod\b/], ["Math.random", /Math\.random/], ["remotion", /remotion/],
    ["moteurs/", /from\s+["'][^"']*moteurs\//], ["-v4", /from\s+["'][^"']*-v4/], ["VideoAnimeeV4", /VideoAnimeeV4/],
    ["briques-v4", /briques-v4/], ["faits-script", /faits-script/], ["droits", /from\s+["'][^"']*\/droits/],
    ["bibliotheque-video", /bibliotheque-video/], ["domaine", /src\/domaine|from\s+["'][^"']*\/domaine\//], ["services", /from\s+["'][^"']*\/services\//],
  ];
  it("aucun motif interdit", () => {
    expect(MOTIFS.filter(([, re]) => re.test(texte)).map(([n]) => n)).toEqual([]);
  });
  it("ni filtre, ni masque, ni courbe littérale, ni ressort", () => {
    expect(texte).not.toMatch(/drop-shadow|<mask|<filter|\bfilter\s*[=:]|cubic-bezier|Easing\.bezier|damping|stiffness|mass\s*:/);
    expect(createElement).toBeTypeOf("function");
  });
});
