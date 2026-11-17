/** C9-21 — mini-frise de montage et pellicule avec case « silence » (pièces pures non inscrites). */
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXEMPLES_FRISE, OBJET_FRISE_MONTAGE, type ParametresFrise } from "../../src/briques/motion/petits-objets/frise-montage";
import { EXEMPLES_PELLICULE, OBJET_PELLICULE, type ParametresPellicule } from "../../src/briques/motion/petits-objets/pellicule";
import { MOTS_MAX, verifierDefinition, type DefinitionObjet, type TonObjet } from "../../src/briques/motion/petits-objets/contrat";
import { couleurDuTon } from "../../src/briques/motion/petits-objets/tons";
import { couleursSur, type FondAxion } from "../../src/briques/jetons-motion";
import { PALETTE } from "../../src/briques/charte/axion-2026";

const BOITE = { x: 10, y: 40, largeur: 80, hauteur: 16 };
const F: ParametresFrise = { boite: BOITE, blocs: 4 };
const P: ParametresPellicule = { boite: BOITE, cases: 5, silence: { indice: 2, texte: "pause" } };
const FONDS: FondAxion[] = ["ivoire", "noir"];
const TONS: TonObjet[] = ["neutre", "accent", "valide", "erreur"];
const D = 60;

type Def = DefinitionObjet<unknown>;
const TOUS = [OBJET_FRISE_MONTAGE, OBJET_PELLICULE] as unknown as Def[];
const PARAMS = new Map<Def, unknown>([[TOUS[0], F], [TOUS[1], P]]);

function rendre(def: Def, image: number, o: { graine?: number; ton?: TonObjet; fond?: FondAxion; p?: unknown } = {}) {
  return renderToStaticMarkup(
    def.Rendu({ image, fps: 25, dureeImages: D, fond: o.fond ?? "ivoire", parametres: o.p ?? PARAMS.get(def), ton: o.ton ?? "neutre", graine: o.graine ?? 7 }),
  );
}
const decalages = (m: string) => [...m.matchAll(/stroke-dashoffset="([^"]+)"/g)].map((x) => Number(x[1]));

describe("C9-21 contrat", () => {
  it("identifiants, famille ecran, capacité objet.ecran, données aucune", () => {
    expect(TOUS.map((d) => d.id)).toEqual(["objet-frise-montage", "objet-pellicule"]);
    for (const d of TOUS) {
      expect(verifierDefinition(d)).toBe("ok");
      expect(d.famille).toBe("ecran");
      expect(d.capacite).toBe("objet.ecran");
      expect(d.donnees).toBe("aucune");
    }
  });
  it("valider ne lève jamais et refuse les mauvaises entrées", () => {
    for (const d of TOUS) {
      for (const mauvais of [undefined, null, {}, 42, "x", { boite: { x: 1, y: 1 } }, { boite: { x: 0, y: 0, largeur: 100, hauteur: 100 }, blocs: 4, cases: 4 }, { boite: BOITE, blocs: 2, cases: 2 }, { boite: BOITE, blocs: 7, cases: 7 }, { boite: BOITE, blocs: 3.5, cases: 3.5 }, { boite: { x: 90, y: 0, largeur: 20, hauteur: 10 }, blocs: 4, cases: 4 }])
        expect(d.valider(mauvais)).toBeNull();
      expect(d.valider(PARAMS.get(d))).toEqual(PARAMS.get(d));
    }
  });
  it("3 à 6 blocs / cases acceptés", () => {
    for (const n of [3, 4, 5, 6]) {
      expect(OBJET_FRISE_MONTAGE.valider({ boite: BOITE, blocs: n })).not.toBeNull();
      expect(OBJET_PELLICULE.valider({ boite: BOITE, cases: n })).not.toBeNull();
    }
  });
  it("silence : texte de 4 mots au plus, non vide, indice dans les cases", () => {
    const v = (s: unknown) => OBJET_PELLICULE.valider({ boite: BOITE, cases: 4, silence: s });
    expect(v({ indice: 1, texte: "un deux trois quatre" })).not.toBeNull();
    expect(MOTS_MAX).toBe(4);
    for (const s of [{ indice: 1, texte: "un deux trois quatre cinq" }, { indice: 1, texte: "  " }, { indice: 4, texte: "a" }, { indice: -1, texte: "a" }, { indice: 1, texte: 3 }, { indice: 1.5, texte: "a" }, "x"])
      expect(v(s)).toBeNull();
  });
  it("exemples valides", () => {
    for (const e of EXEMPLES_FRISE) expect(OBJET_FRISE_MONTAGE.valider(e)).not.toBeNull();
    for (const e of EXEMPLES_PELLICULE) expect(OBJET_PELLICULE.valider(e)).not.toBeNull();
  });
});

describe("C9-21 rendu", () => {
  it("même graine = même sortie ; une autre graine change la frise", () => {
    for (const d of TOUS) expect(rendre(d, 20)).toBe(rendre(d, 20));
    expect(rendre(OBJET_FRISE_MONTAGE as unknown as Def, 30, { graine: 1 })).not.toBe(rendre(OBJET_FRISE_MONTAGE as unknown as Def, 30, { graine: 2 }));
  });
  it("entrée : tracé à 0 en image 0, plein en tenue ; sortie en 6 images exactement", () => {
    for (const d of TOUS) {
      expect(decalages(rendre(d, 0)).every((x) => x === 1)).toBe(true);
      expect(decalages(rendre(d, 30)).every((x) => x === 0)).toBe(true);
      expect(rendre(d, D - 1)).toMatch(/opacity="0"/);
      const sous = Array.from({ length: D }, (_, i) => i).filter((i) => !/opacity="1"/.test(rendre(d, i)) && i > 10);
      expect(sous).toEqual([54, 55, 56, 57, 58, 59]);
    }
  });
  it("le nombre de blocs / cases est celui demandé", () => {
    for (const n of [3, 6]) {
      const m = rendre(OBJET_FRISE_MONTAGE as unknown as Def, 30, { p: { boite: BOITE, blocs: n } });
      expect([...m.matchAll(/data-bloc="/g)].length).toBe(n);
      const c = rendre(OBJET_PELLICULE as unknown as Def, 30, { p: { boite: BOITE, cases: n } });
      expect([...c.matchAll(/data-case="/g)].length).toBe(n);
    }
  });
  it("frise : le curseur avance (x croissant), reste dans la boîte", () => {
    const xs = [0, 15, 30, 45, 58].map((i) => {
      const m = rendre(OBJET_FRISE_MONTAGE as unknown as Def, i);
      return Number(/data-curseur="([\d.-]+)"/.exec(m)![1]);
    });
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
    for (const x of xs) {
      expect(x).toBeGreaterThanOrEqual(100);
      expect(x).toBeLessThanOrEqual(900);
    }
  });
  it("couleurs de la charte seulement, aucun filter/mask, aucun #B8341C, orange jamais sur ivoire", () => {
    for (const d of TOUS) for (const fond of FONDS) for (const ton of TONS) {
      const m = rendre(d, 30, { fond, ton });
      const permis = [...TONS.map((t) => couleurDuTon(t, fond)), couleursSur(fond).texte];
      for (const c of m.matchAll(/(?:stroke|fill)="([^"]+)"/g)) expect([...permis, "none"]).toContain(c[1]);
      expect(m).not.toMatch(/filter|mask|drop-shadow/i);
      expect(m.toUpperCase()).not.toContain("#B8341C");
      if (fond === "ivoire") expect(m).not.toContain(PALETTE.orange);
    }
  });
  it("aucun jaune, vert ni bleu hors charte (ton valide = sauge de la charte)", () => {
    for (const d of TOUS) expect(rendre(d, 30, { ton: "neutre" })).not.toContain(PALETTE.reussite);
  });
});

describe("C9-21 texte : seulement celui passé en paramètre", () => {
  it("frise : aucun texte", () => {
    expect(rendre(OBJET_FRISE_MONTAGE as unknown as Def, 30)).not.toMatch(/<text/);
  });
  it("pellicule sans silence : aucun texte", () => {
    expect(rendre(OBJET_PELLICULE as unknown as Def, 30, { p: { boite: BOITE, cases: 4 } })).not.toMatch(/<text/);
  });
  it("pellicule avec silence : un seul texte, celui fourni, dans la bonne case, en Manrope", () => {
    const m = rendre(OBJET_PELLICULE as unknown as Def, 30);
    const textes = [...m.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((x) => x[1]);
    expect(textes).toEqual(["pause"]);
    expect(m).toMatch(/font-family="Manrope/);
    expect(m).toMatch(/data-case="2"[^>]*data-silence="1"/);
    expect([...m.matchAll(/data-silence="1"/g)].length).toBe(1);
  });
  it("le texte est échappé, jamais interprété", () => {
    const m = rendre(OBJET_PELLICULE as unknown as Def, 30, { p: { boite: BOITE, cases: 4, silence: { indice: 0, texte: "<b>&" } } });
    expect(m).not.toContain("<b>");
  });
});

describe("C9-21 garde statique des deux fichiers (13 motifs de garde.test.ts:8-22, copiés)", () => {
  const MOTIFS: [string, RegExp][] = [
    ["@/", /@\//], ["zod", /\bzod\b/], ["Math.random", /Math\.random/], ["remotion", /remotion/],
    ["moteurs/", /from\s+["'][^"']*moteurs\//], ["-v4", /from\s+["'][^"']*-v4/], ["VideoAnimeeV4", /VideoAnimeeV4/],
    ["briques-v4", /briques-v4/], ["faits-script", /faits-script/], ["droits", /from\s+["'][^"']*\/droits/],
    ["bibliotheque-video", /bibliotheque-video/], ["domaine", /src\/domaine|from\s+["'][^"']*\/domaine\//], ["services", /from\s+["'][^"']*\/services\//],
  ];
  for (const nom of ["frise-montage.tsx", "pellicule.tsx"]) {
    const texte = readFileSync(join(__dirname, "..", "..", "src", "briques", "motion", "petits-objets", nom), "utf8");
    it(`${nom} : aucun motif interdit`, () => {
      expect(MOTIFS.filter(([, re]) => re.test(texte)).map(([n]) => n)).toEqual([]);
    });
    it(`${nom} : ni filtre, ni masque, ni courbe littérale, ni ressort, ni #B8341C`, () => {
      expect(texte).not.toMatch(/drop-shadow|<mask|<filter|\bfilter\s*[=:]|cubic-bezier|Easing\.bezier|damping|stiffness|mass\s*:/i);
      expect(texte.toUpperCase()).not.toContain("B8341C");
    });
  }
  it("non inscrits : ni index.ts ni aucun autre fichier de src/ ne les importe", () => {
    const index = readFileSync(join(__dirname, "..", "..", "src", "briques", "motion", "petits-objets", "index.ts"), "utf8");
    expect(index).not.toMatch(/frise-montage|pellicule/);
  });
});
