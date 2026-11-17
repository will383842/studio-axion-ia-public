/** C10-10 — icône qui tourne en rotateY (pièce pure non inscrite, icônes seulement, sans three.js). */
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXEMPLES_OBJET_TOURNE, OBJET_TOURNE, angleObjetTourne, type ParametresObjetTourne } from "../../src/briques/motion/petits-objets/objet-tourne";
import { verifierDefinition, SURFACE_MAX, type DefinitionObjet, type TonObjet } from "../../src/briques/motion/petits-objets/contrat";
import { IMAGES_SORTIE } from "../../src/briques/motion/petits-objets/progres";
import { couleurDuTon } from "../../src/briques/motion/petits-objets/tons";
import { couleursSur, type FondAxion } from "../../src/briques/jetons-motion";

const DEF = OBJET_TOURNE as unknown as DefinitionObjet<ParametresObjetTourne>;
const P: ParametresObjetTourne = { icone: "lucide:coche", tours: 1 };
const TONS: TonObjet[] = ["neutre", "accent", "valide", "erreur"];
const FONDS: FondAxion[] = ["ivoire", "noir"];
const D = 60;

function rendre(image: number, o: { graine?: number; ton?: TonObjet; fond?: FondAxion; p?: ParametresObjetTourne } = {}) {
  return renderToStaticMarkup(DEF.Rendu({ image, fps: 25, dureeImages: D, fond: o.fond ?? "ivoire", parametres: o.p ?? P, ton: o.ton ?? "neutre", graine: o.graine ?? 7 }));
}
const angle = (m: string) => Number(/rotateY\((-?[\d.]+)deg\)/.exec(m)?.[1]);

describe("C10-10 contrat", () => {
  it("identifiant propre, famille schema, capacité objet.schema, aucune donnée, durée 0,8..3 s", () => {
    expect(verifierDefinition(DEF)).toBe("ok");
    expect(DEF.id).toBe("objet-tourne");
    expect(DEF.famille).toBe("schema");
    expect(DEF.capacite).toBe("objet.schema");
    expect(DEF.donnees).toBe("aucune");
    expect(DEF.dureeSec.min).toBeGreaterThanOrEqual(0.8);
    expect(DEF.dureeSec.max).toBeLessThanOrEqual(3);
  });
  it("valider ne lève jamais et refuse les mauvaises entrées", () => {
    for (const mauvais of [undefined, null, {}, { icone: "inconnue" }, { icone: "facebook" }, { icone: "constructor" }, { icone: "lucide:visage" }, { icone: 3 }, 42, "lucide:coche", { icone: "lucide:coche", tours: 3 }, { icone: "lucide:coche", tours: "1" }]) {
      expect(() => DEF.valider(mauvais)).not.toThrow();
      expect(DEF.valider(mauvais)).toBeNull();
    }
    expect(DEF.valider({ icone: "lucide:coche" })).toEqual({ icone: "lucide:coche" });
    expect(DEF.valider({ icone: "lucide:coche", tours: 2 })).toEqual({ icone: "lucide:coche", tours: 2 });
  });
  it("exemples valides", () => {
    expect(EXEMPLES_OBJET_TOURNE.length).toBeGreaterThan(0);
    for (const e of EXEMPLES_OBJET_TOURNE) expect(DEF.valider(e)).not.toBeNull();
  });
});

describe("C10-10 rendu", () => {
  it("déterministe : même graine, même image, même balisage", () => {
    expect(rendre(20)).toBe(rendre(20));
    expect(rendre(20, { graine: 1 })).toBe(rendre(20, { graine: 1 }));
  });
  it("angle à 0 au départ, tours × 360 à la fin de la rotation, monotone", () => {
    const fin = D - 1 - IMAGES_SORTIE;
    for (const tours of [0.5, 1, 2] as const) {
      expect(angleObjetTourne(0, D, tours)).toBe(0);
      expect(angleObjetTourne(fin, D, tours)).toBeCloseTo(tours * 360, 6);
      expect(angle(rendre(0, { p: { icone: "lucide:coche", tours } }))).toBe(0);
      expect(angle(rendre(fin, { p: { icone: "lucide:coche", tours } }))).toBeCloseTo(tours * 360, 1);
      let prec = -1;
      for (let i = 0; i <= fin; i++) { const a = angleObjetTourne(i, D, tours); expect(a).toBeGreaterThanOrEqual(prec); prec = a; }
    }
    expect(Number.isFinite(angleObjetTourne(NaN, D, 1))).toBe(true);
  });
  it("perspective + rotateY, sans three.js", () => {
    const m = rendre(10);
    expect(m).toMatch(/perspective\(\d+px\) rotateY/);
    expect(m).not.toMatch(/three/i);
  });
  it("sortie en 6 images exactement, opacité 0 à la dernière", () => {
    expect(rendre(D - 1)).toMatch(/opacity:0/);
    const sous = Array.from({ length: D }, (_, i) => i).filter((i) => i > 10 && !/opacity:1[;"]/.test(rendre(i)));
    expect(sous).toEqual([54, 55, 56, 57, 58, 59]);
  });
  it("deux faces avec la même icône, aucun texte", () => {
    const m = rendre(20);
    expect(m.match(/<svg/g)?.length).toBe(2);
    expect(m).not.toContain("<text");
    const chemins = m.match(/<path d="[^"]+"/g) ?? [];
    expect(chemins.length % 2).toBe(0);
    expect(chemins.slice(0, chemins.length / 2)).toEqual(chemins.slice(chemins.length / 2));
  });
  it("taille : jamais au-delà de SURFACE_MAX du cadre", () => {
    const m = rendre(20);
    const l = Number(/width:(\d+(?:\.\d+)?)%/.exec(m)?.[1]);
    const h = Number(/height:(\d+(?:\.\d+)?)%/.exec(m)?.[1]);
    expect((l / 100) * (h / 100)).toBeLessThanOrEqual(SURFACE_MAX);
  });
  it("couleur : seulement couleurDuTon (4 tons × 2 fonds), aucun filter/mask/drop-shadow", () => {
    for (const fond of FONDS) for (const ton of TONS) {
      const m = rendre(20, { fond, ton });
      expect(m).toContain(`color:${couleurDuTon(ton, fond)}`);
      const permis = [couleurDuTon(ton, fond), couleursSur(fond).texte, "currentColor", "none"];
      for (const c of m.matchAll(/(?:stroke|fill)="([^"]+)"/g)) expect(permis).toContain(c[1]);
      expect(m).not.toMatch(/filter|mask|drop-shadow|three/i);
    }
  });
});

describe("C10-10 garde statique du fichier (13 motifs de garde.test.ts:8-22, copiés)", () => {
  const texte = readFileSync(join(__dirname, "..", "..", "src", "briques", "motion", "petits-objets", "objet-tourne.tsx"), "utf8");
  const MOTIFS: [string, RegExp][] = [
    ["@/", /@\//], ["zod", /\bzod\b/], ["Math.random", /Math\.random/], ["remotion", /remotion/],
    ["moteurs/", /from\s+["'][^"']*moteurs\//], ["-v4", /from\s+["'][^"']*-v4/], ["VideoAnimeeV4", /VideoAnimeeV4/],
    ["briques-v4", /briques-v4/], ["faits-script", /faits-script/], ["droits", /from\s+["'][^"']*\/droits/],
    ["bibliotheque-video", /bibliotheque-video/], ["domaine", /src\/domaine|from\s+["'][^"']*\/domaine\//], ["services", /from\s+["'][^"']*\/services\//],
  ];
  it("aucun motif interdit, aucun import de logos-outils", () => {
    expect(MOTIFS.filter(([, re]) => re.test(texte)).map(([n]) => n)).toEqual([]);
    expect(texte).not.toMatch(/logos-outils/);
  });
  it("ni filtre, ni masque, ni ombre, ni three, ni courbe littérale, ni ressort", () => {
    expect(texte).not.toMatch(/drop-shadow|<mask|<filter|\bfilter\s*[=:]|three|cubic-bezier|Easing\.bezier|damping|stiffness|mass\s*:/);
  });
});
