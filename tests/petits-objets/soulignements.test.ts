/** C9-08 — soulignements (droit, vague, double) et surligneur : pièces pures non inscrites. */
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EXEMPLES_SOULIGNEMENTS,
  OBJET_SOULIGNEMENT_DOUBLE,
  OBJET_SOULIGNEMENT_DROIT,
  OBJET_SOULIGNEMENT_VAGUE,
  OBJET_SURLIGNEUR,
  type ParametresSoulignement,
} from "../../src/briques/motion/petits-objets/soulignements";
import { verifierDefinition, type DefinitionObjet, type TonObjet } from "../../src/briques/motion/petits-objets/contrat";
import { couleurDuTon } from "../../src/briques/motion/petits-objets/tons";
import { couleursSur, type FondAxion } from "../../src/briques/jetons-motion";
import { PALETTE } from "../../src/briques/charte/axion-2026";

const TOUS = [OBJET_SOULIGNEMENT_DROIT, OBJET_SOULIGNEMENT_VAGUE, OBJET_SOULIGNEMENT_DOUBLE, OBJET_SURLIGNEUR] as unknown as DefinitionObjet<ParametresSoulignement>[];
const P: ParametresSoulignement = { x: 10, y: 50, largeur: 60 };
const TONS: TonObjet[] = ["neutre", "accent", "valide", "erreur"];
const FONDS: FondAxion[] = ["ivoire", "noir"];
const D = 60;

function rendre(def: DefinitionObjet<ParametresSoulignement>, image: number, o: { graine?: number; ton?: TonObjet; fond?: FondAxion; p?: ParametresSoulignement } = {}) {
  return renderToStaticMarkup(
    def.Rendu({ image, fps: 25, dureeImages: D, fond: o.fond ?? "ivoire", parametres: o.p ?? P, ton: o.ton, graine: o.graine ?? 7 }),
  );
}
const decalages = (m: string) => [...m.matchAll(/stroke-dashoffset="([^"]+)"/g)].map((x) => Number(x[1]));
const largeurs = (m: string) => [...m.matchAll(/<rect[^>]*\swidth="([^"]+)"/g)].map((x) => Number(x[1]));

describe("C9-08 contrat", () => {
  it("quatre identifiants propres, famille trait, capacité objet.trait", () => {
    expect(TOUS.map((d) => d.id)).toEqual(["objet-soulignement-droit", "objet-soulignement-vague", "objet-soulignement-double", "objet-surligneur"]);
    for (const d of TOUS) {
      expect(verifierDefinition(d)).toBe("ok");
      expect(d.famille).toBe("trait");
      expect(d.capacite).toBe("objet.trait");
      expect(d.donnees).toBe("aucune");
    }
  });
  it("valider ne lève jamais et refuse les mauvaises entrées", () => {
    for (const d of TOUS) {
      for (const mauvais of [undefined, null, {}, 42, "un deux trois quatre cinq", { x: 5, y: 5 }, { x: "a", y: 1, largeur: 2 }, { x: 10, y: 10, largeur: 0 }, { x: 80, y: 10, largeur: 40 }, { x: -1, y: 10, largeur: 20 }, { x: 5, y: 101, largeur: 20 }])
        expect(d.valider(mauvais)).toBeNull();
      expect(d.valider(P)).toEqual(P);
    }
  });
  it("exemples valides", () => {
    for (const d of TOUS) for (const e of EXEMPLES_SOULIGNEMENTS) expect(d.valider(e)).not.toBeNull();
  });
});

describe("C9-08 rendu", () => {
  it("déterministe, tracé à 0 en image 0, opacité 0 à la dernière image, tenue pleine", () => {
    for (const d of TOUS) {
      expect(rendre(d, 20)).toBe(rendre(d, 20));
      expect(rendre(d, D - 1)).toMatch(/opacity="0"/);
      expect(rendre(d, 30)).toMatch(/opacity="1"/);
      if (d !== OBJET_SURLIGNEUR) {
        expect(decalages(rendre(d, 0)).every((x) => x === 1)).toBe(true);
        expect(decalages(rendre(d, 30)).every((x) => x === 0)).toBe(true);
      }
    }
  });
  it("sortie en 6 images exactement", () => {
    for (const d of TOUS) {
      const sous = Array.from({ length: D }, (_, i) => i).filter((i) => !/<g opacity="1"/.test(rendre(d, i)) && i > 10);
      expect(sous).toEqual([54, 55, 56, 57, 58, 59]);
    }
  });
  it("couleurs de la charte seulement, aucun filter/mask/drop-shadow", () => {
    for (const d of TOUS) for (const fond of FONDS) for (const ton of TONS) {
      const m = rendre(d, 30, { fond, ton });
      const permis = [couleurDuTon(ton, fond), couleursSur(fond).texte];
      for (const c of m.matchAll(/(?:stroke|fill)="([^"]+)"/g)) expect([...permis, "none"]).toContain(c[1]);
      expect(m).not.toMatch(/filter|mask|drop-shadow/i);
      if (fond === "ivoire" && ton === "accent") expect(m).not.toContain(PALETTE.orange);
    }
  });
});

describe("C9-08 propres à la fiche", () => {
  it("double : le 2e trait commence 4 images après le 1er", () => {
    for (const i of [0, 2, 4]) expect(decalages(rendre(OBJET_SOULIGNEMENT_DOUBLE, i))[1]).toBe(1);
    const d = (i: number) => decalages(rendre(OBJET_SOULIGNEMENT_DOUBLE, i));
    expect(d(3)[0]).toBeLessThan(1);
    expect(d(4)[1]).toBe(1);
    expect(d(5)[1]).toBeLessThan(1);
    expect(d(30)).toEqual([0, 0]);
  });
  it("vague : amplitude bornée, graine différente = tracé différent", () => {
    const m = rendre(OBJET_SOULIGNEMENT_VAGUE, 30, { graine: 1 });
    expect(m).toBe(rendre(OBJET_SOULIGNEMENT_VAGUE, 30, { graine: 1 }));
    expect(m).not.toBe(rendre(OBJET_SOULIGNEMENT_VAGUE, 30, { graine: 2 }));
    const ys = [...(m.match(/ d="([^"]+)"/)?.[1] ?? "").matchAll(/[ML] [\d.-]+ ([\d.-]+)/g)].map((x) => Number(x[1]));
    expect(ys.length).toBeGreaterThan(10);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThanOrEqual(24);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(2);
  });
  it("surligneur : largeur 0 à l'image 0, pleine en tenue ; opacité ≤ 0,35 ; ton accent par défaut", () => {
    expect(largeurs(rendre(OBJET_SURLIGNEUR, 0))).toEqual([0]);
    expect(largeurs(rendre(OBJET_SURLIGNEUR, 30))).toEqual([600]);
    const mid = largeurs(rendre(OBJET_SURLIGNEUR, 3))[0];
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(600);
    for (const i of [0, 3, 30, 58]) for (const c of rendre(OBJET_SURLIGNEUR, i).matchAll(/fill-opacity="([^"]+)"/g)) expect(Number(c[1])).toBeLessThanOrEqual(0.35);
    for (const fond of FONDS) expect(rendre(OBJET_SURLIGNEUR, 30, { fond })).toContain(`fill="${couleurDuTon("accent", fond)}"`);
  });
});

describe("C9-08 garde statique du fichier (13 motifs de garde.test.ts:8-22, copiés)", () => {
  const texte = readFileSync(join(__dirname, "..", "..", "src", "briques", "motion", "petits-objets", "soulignements.tsx"), "utf8");
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
  });
});
