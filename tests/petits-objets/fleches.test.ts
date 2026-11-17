/** C9-06 — flèches (droite, courbe, pointillée, main levée) : pièces pures non inscrites. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EXEMPLES_FLECHES,
  OBJET_FLECHE_COURBE,
  OBJET_FLECHE_DROITE,
  OBJET_FLECHE_MAIN_LEVEE,
  OBJET_FLECHE_POINTILLEE,
  type ParametresFleche,
} from "../../src/briques/motion/petits-objets/fleches";
import { verifierDefinition, type DefinitionObjet, type TonObjet } from "../../src/briques/motion/petits-objets/contrat";
import { cheminFlecheObjet } from "../../src/briques/motion/petits-objets/TraceSvg";
import { couleurDuTon } from "../../src/briques/motion/petits-objets/tons";
import { couleursSur, type FondAxion } from "../../src/briques/jetons-motion";
import { PALETTE } from "../../src/briques/charte/axion-2026";

const TOUS = [OBJET_FLECHE_DROITE, OBJET_FLECHE_COURBE, OBJET_FLECHE_POINTILLEE, OBJET_FLECHE_MAIN_LEVEE] as unknown as DefinitionObjet<ParametresFleche>[];
const P: ParametresFleche = { de: { x: 15, y: 20 }, vers: { x: 70, y: 55 } };
const TONS: TonObjet[] = ["neutre", "accent", "valide", "erreur"];
const FONDS: FondAxion[] = ["ivoire", "noir"];
const D = 60;

function rendre(def: DefinitionObjet<ParametresFleche>, image: number, o: { graine?: number; ton?: TonObjet; fond?: FondAxion; p?: ParametresFleche } = {}) {
  return renderToStaticMarkup(
    def.Rendu({ image, fps: 25, dureeImages: D, fond: o.fond ?? "ivoire", parametres: o.p ?? P, ton: o.ton ?? "neutre", graine: o.graine ?? 7 }),
  );
}
const decalages = (m: string) => [...m.matchAll(/stroke-dashoffset="([^"]+)"/g)].map((x) => Number(x[1]));

describe("C9-06 contrat", () => {
  it("quatre identifiants propres, famille trait, capacité objet.trait", () => {
    expect(TOUS.map((d) => d.id)).toEqual(["objet-fleche-droite", "objet-fleche-courbe", "objet-fleche-pointillee", "objet-fleche-main-levee"]);
    for (const d of TOUS) {
      expect(verifierDefinition(d)).toBe("ok");
      expect(d.famille).toBe("trait");
      expect(d.capacite).toBe("objet.trait");
      expect(d.donnees).toBe("aucune");
    }
  });
  it("valider ne lève jamais et refuse les mauvaises entrées", () => {
    for (const d of TOUS) {
      for (const mauvais of [undefined, null, {}, 42, "un deux trois quatre cinq", { de: { x: 1, y: 1 } }, { de: { x: 5, y: 5 }, vers: { x: 5, y: 5 } }, { de: { x: "a", y: 1 }, vers: { x: 2, y: 2 } }, { de: { x: 0, y: 0 }, vers: { x: 100, y: 100 } }])
        expect(d.valider(mauvais)).toBeNull();
      expect(d.valider(P)).toEqual(P);
    }
  });
  it("exemples valides", () => {
    for (const d of TOUS) for (const e of EXEMPLES_FLECHES) expect(d.valider(e)).not.toBeNull();
  });
});

describe("C9-06 rendu", () => {
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
  it("couleurs de la charte seulement, aucun filter/mask/drop-shadow", () => {
    for (const d of TOUS) for (const fond of FONDS) for (const ton of TONS) {
      const m = rendre(d, 30, { fond, ton });
      const permis = [couleurDuTon(ton, fond), couleursSur(fond).texte];
      for (const c of m.matchAll(/stroke="([^"]+)"/g)) expect(permis).toContain(c[1]);
      expect(m).not.toMatch(/filter|mask|drop-shadow/i);
      if (fond === "ivoire" && ton === "accent") expect(m).not.toContain(PALETTE.orange);
    }
  });
  it("pointe : deux petits traits, tracés dans le dernier quart seulement", () => {
    const m = rendre(OBJET_FLECHE_DROITE, 4);
    expect(decalages(m).length).toBe(3);
    const tot = decalages(rendre(OBJET_FLECHE_DROITE, 2));
    expect(tot[1]).toBe(1);
    expect(tot[2]).toBe(1);
  });
});

describe("C9-06 propres à la fiche", () => {
  it("courbe : d identique à cheminFlecheObjet", () => {
    const { debut, fin } = cheminFlecheObjet(100, 200, 300, 80, 1000, 1000);
    const p: ParametresFleche = { de: { x: debut.x / 10, y: debut.y / 10 }, vers: { x: fin.x / 10, y: fin.y / 10 } };
    const attendu = cheminFlecheObjet(100, 200, 300, 80, 1000, 1000).d;
    expect(rendre(OBJET_FLECHE_COURBE, 30, { p })).toContain(`d="${attendu}"`);
  });
  it("pointillée : tirets visibles croissants, tous visibles en tenue", () => {
    const vus = (i: number) => decalages(rendre(OBJET_FLECHE_POINTILLEE, i)).filter((x) => x < 1).length;
    expect(vus(0)).toBe(0);
    expect(vus(3)).toBeGreaterThan(vus(1));
    expect(vus(5)).toBeGreaterThanOrEqual(vus(3));
    expect(decalages(rendre(OBJET_FLECHE_POINTILLEE, 30)).every((x) => x === 0)).toBe(true);
    expect(decalages(rendre(OBJET_FLECHE_POINTILLEE, 30)).length).toBeGreaterThan(5);
  });
  it("main levée : graines différentes = tracés différents, même graine = identiques", () => {
    expect(rendre(OBJET_FLECHE_MAIN_LEVEE, 30, { graine: 1 })).toBe(rendre(OBJET_FLECHE_MAIN_LEVEE, 30, { graine: 1 }));
    expect(rendre(OBJET_FLECHE_MAIN_LEVEE, 30, { graine: 1 })).not.toBe(rendre(OBJET_FLECHE_MAIN_LEVEE, 30, { graine: 2 }));
  });
});

describe("C9-06 garde statique du fichier (13 motifs de garde.test.ts:8-22, copiés)", () => {
  const texte = readFileSync(join(__dirname, "..", "..", "src", "briques", "motion", "petits-objets", "fleches.tsx"), "utf8");
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
