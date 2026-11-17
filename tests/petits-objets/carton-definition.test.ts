/** C10-09 — carton « mot + définition » tiré d'une phrase dite : pièce pure non inscrite + règle d'extraction côté Studio. */
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXEMPLES_CARTON_DEFINITION, OBJET_CARTON_DEFINITION, type ParametresCartonDefinition } from "../../src/briques/motion/petits-objets/carton-definition";
import { definitionDite } from "../../src/briques/plan-scenes-objets/definition-dite";
import { garderObjet } from "../../src/briques/plan-scenes-objets/garde";
import { MOTS_MAX, verifierDefinition, type DefinitionObjet, type TonObjet } from "../../src/briques/motion/petits-objets/contrat";
import { couleurDuTon } from "../../src/briques/motion/petits-objets/tons";
import { couleursSur, type FondAxion } from "../../src/briques/jetons-motion";
import type { MotMinute } from "../../src/briques/plan-scenes/schema";

const DEF = OBJET_CARTON_DEFINITION as unknown as DefinitionObjet<ParametresCartonDefinition>;
const dits = (phrase: string): MotMinute[] => phrase.split(" ").map((texte, i) => ({ texte, debutMs: i * 300, finMs: i * 300 + 250 }));
const P: ParametresCartonDefinition = { mot: "le ROI", definition: "ce que tu gagnes" };
const TONS: TonObjet[] = ["neutre", "accent", "valide", "erreur"];
const FONDS: FondAxion[] = ["ivoire", "noir"];
const D = 75;

function rendre(image: number, o: { graine?: number; ton?: TonObjet; fond?: FondAxion; p?: ParametresCartonDefinition } = {}) {
  return renderToStaticMarkup(DEF.Rendu({ image, fps: 25, dureeImages: D, fond: o.fond ?? "ivoire", parametres: o.p ?? P, ton: o.ton ?? "neutre", graine: o.graine ?? 7 }));
}

describe("C10-09 règle d'extraction", () => {
  it("« le ROI, c'est ce que tu gagnes »", () => {
    const mots = dits("le ROI, c'est ce que tu gagnes");
    expect(definitionDite(mots, 0, mots.length - 1)).toEqual({ mot: "le ROI", definition: "ce que tu gagnes", premier: 0, dernier: 6 });
  });
  it("les quatre formes", () => {
    const cas: [string, string, string][] = [
      ["le churn, ça veut dire les départs", "le churn", "les départs"],
      ["un lead signifie un contact chaud", "un lead", "un contact chaud"],
      ["on appelle SEO, le référencement naturel", "SEO", "le référencement naturel"],
      ["la marge, c'est ce qui reste.", "la marge", "ce qui reste"],
    ];
    for (const [phrase, mot, definition] of cas) {
      const mots = dits(phrase);
      expect(definitionDite(mots, 0, mots.length - 1)).toMatchObject({ mot, definition });
    }
  });
  it("une phrase qui précède ne gêne pas ; les indices pointent la plage trouvée", () => {
    const mots = dits("Bonjour à tous. Le ROI, c'est ce que tu gagnes. Merci");
    expect(definitionDite(mots, 0, mots.length - 1)).toEqual({ mot: "Le ROI", definition: "ce que tu gagnes", premier: 3, dernier: 9 });
  });
  it("rien trouvé, ambiguïté, définition trop longue, nombre : null", () => {
    for (const phrase of [
      "bonjour à tous et bienvenue",
      "c'est important",
      "le ROI, c'est ce que tu gagnes vraiment sur ton budget",
      "le ROI, c'est 30 pourcent",
      "le ROI, c'est ce que tu gagnes et le CPA, c'est ce que tu paies",
      "ça, c'est utile",
      "on appelle ROI ce que tu gagnes",
      "un deux trois quatre, c'est cinq",
      "le CPA, c'est ce qu'on paie vraiment",
    ]) {
      const mots = dits(phrase);
      expect(definitionDite(mots, 0, mots.length - 1)).toBeNull();
    }
  });
  it("déterministe ; entrée vide, nulle ou mauvaise : null sans exception", () => {
    const mots = dits("le ROI, c'est ce que tu gagnes");
    expect(definitionDite(mots, 0, 6)).toEqual(definitionDite(mots, 0, 6));
    for (const m of [[], null, undefined, 42, "texte", [null], [{}], [{ texte: 3 }]]) expect(definitionDite(m as never, 0, 3)).toBeNull();
    expect(definitionDite(mots, NaN, 99)).toBeDefined();
    expect(definitionDite(mots, 5, 2)).toBeNull();
  });
});

describe("C10-09 accord avec la garde d'honnêteté", () => {
  it("tout résultat non nul de la règle passe valider et la garde", () => {
    for (const phrase of [
      "le ROI, c'est ce que tu gagnes", "le churn, ça veut dire les départs", "un lead signifie un contact chaud",
      "on appelle SEO, le référencement naturel", "le CPA, c'est ce qu'on paie vraiment", "la marge, c'est ce qui reste.",
      "Bonjour à tous. Le ROI, c'est ce que tu gagnes. Merci", "l'ROI, c'est l'argent gagné",
    ]) {
      const mots = dits(phrase);
      const r = definitionDite(mots, 0, mots.length - 1);
      if (r === null) continue;
      expect(DEF.valider({ mot: r.mot, definition: r.definition })).not.toBeNull();
      expect(garderObjet(DEF as DefinitionObjet<unknown>, { mot: r.mot, definition: r.definition }, { mots, premier: r.premier, dernier: r.dernier })).toBe("ok");
    }
  });
  it("chaque cas trouvé est accepté ; un mot non dit glissé est refusé", () => {
    for (const phrase of ["le ROI, c'est ce que tu gagnes", "le churn, ça veut dire les départs", "un lead signifie un contact chaud", "on appelle SEO, le référencement naturel"]) {
      const mots = dits(phrase);
      const r = definitionDite(mots, 0, mots.length - 1);
      expect(r).not.toBeNull();
      expect(garderObjet(DEF as DefinitionObjet<unknown>, { mot: r!.mot, definition: r!.definition }, { mots, premier: r!.premier, dernier: r!.dernier })).toBe("ok");
    }
    const mots = dits("le ROI, c'est ce que tu gagnes");
    expect(garderObjet(DEF as DefinitionObjet<unknown>, { mot: "le ROI", definition: "ce que tu inventes" }, { mots, premier: 0, dernier: 6 })).toEqual({ refus: "mots non dits" });
  });
});

describe("C10-09 contrat de la pièce", () => {
  it("identifiant propre, famille etiquette, capacité objet.etiquette, mots-dits, durée 1,5..4 s", () => {
    expect(verifierDefinition(DEF)).toBe("ok");
    expect(DEF.id).toBe("objet-carton-definition");
    expect(DEF.famille).toBe("etiquette");
    expect(DEF.capacite).toBe("objet.etiquette");
    expect(DEF.donnees).toBe("mots-dits");
    expect(DEF.dureeSec.min).toBeGreaterThanOrEqual(1.5);
    expect(DEF.dureeSec.max).toBeLessThanOrEqual(4);
  });
  it("valider ne lève jamais : mauvaises entrées → null", () => {
    for (const mauvais of [undefined, null, {}, 42, "un deux trois quatre cinq", { mot: "", definition: "x" }, { mot: "x", definition: " " }, { mot: "un deux trois quatre cinq", definition: "x" }, { mot: "x", definition: "un deux trois quatre cinq" }, { mot: 1, definition: "x" }])
      expect(DEF.valider(mauvais)).toBeNull();
    expect(DEF.valider(P)).toEqual(P);
    expect(MOTS_MAX).toBe(4);
  });
  it("exemples valides", () => {
    for (const e of EXEMPLES_CARTON_DEFINITION) expect(DEF.valider(e)).not.toBeNull();
  });
});

describe("C10-09 rendu", () => {
  it("même graine = même balisage ; textes recopiés", () => {
    expect(rendre(30, { graine: 3 })).toBe(rendre(30, { graine: 3 }));
    expect(rendre(30)).toContain("le ROI");
    expect(rendre(30)).toContain("ce que tu gagnes");
    expect(rendre(30)).toMatch(/Manrope/);
  });
  it("dernière image : opacité 0 ; tenue pleine ; sortie en 6 images", () => {
    const opaciteExterne = (i: number) => Number(rendre(i).match(/opacity="([^"]+)"/)![1]);
    expect(opaciteExterne(D - 1)).toBe(0);
    expect(opaciteExterne(30)).toBe(1);
    const sous = Array.from({ length: D }, (_, i) => i).filter((i) => i > 10 && opaciteExterne(i) < 1);
    expect(sous).toEqual([69, 70, 71, 72, 73, 74]);
  });
  it("couleurs de la charte seulement ; aucun filter, mask, drop-shadow", () => {
    for (const fond of FONDS) for (const ton of TONS) {
      const m = rendre(30, { fond, ton });
      const c = couleursSur(fond);
      const permis = [couleurDuTon(ton, fond), c.texte, c.texteDoux, c.panneauRelief, c.panneau];
      for (const x of m.matchAll(/(?:stroke|fill)="([^"]+)"/g)) expect(["none", ...permis]).toContain(x[1]);
      expect(m).not.toMatch(/filter|mask|drop-shadow/i);
    }
  });
});

describe("C10-09 gardes statiques", () => {
  const racine = join(__dirname, "..", "..", "src", "briques");
  const tsx = readFileSync(join(racine, "motion", "petits-objets", "carton-definition.tsx"), "utf8");
  const MOTIFS: [string, RegExp][] = [
    ["@/", /@\//], ["zod", /\bzod\b/], ["Math.random", /Math\.random/], ["remotion", /remotion/],
    ["moteurs/", /from\s+["'][^"']*moteurs\//], ["-v4", /from\s+["'][^"']*-v4/], ["VideoAnimeeV4", /VideoAnimeeV4/],
    ["briques-v4", /briques-v4/], ["faits-script", /faits-script/], ["droits", /from\s+["'][^"']*\/droits/],
    ["bibliotheque-video", /bibliotheque-video/], ["domaine", /src\/domaine|from\s+["'][^"']*\/domaine\//], ["services", /from\s+["'][^"']*\/services\//],
  ];
  it("le .tsx : aucun motif interdit, ni filtre, ni courbe littérale, ni ressort, ni plan-scenes-objets", () => {
    expect(MOTIFS.filter(([, re]) => re.test(tsx)).map(([n]) => n)).toEqual([]);
    expect(tsx).not.toMatch(/drop-shadow|<mask|<filter|\bfilter\s*[=:]|cubic-bezier|Easing\.bezier|damping|stiffness|mass\s*:|plan-scenes-objets/);
  });
  it("definition-dite.ts n'importe ni @/, ni faits-script, ni services", () => {
    const t = readFileSync(join(racine, "plan-scenes-objets", "definition-dite.ts"), "utf8");
    expect(t).not.toMatch(/@\/|faits-script|\/services\/|Math\.random/);
  });
  it("rien n'importe les deux pièces (non inscrites)", () => {
    const index = readFileSync(join(racine, "plan-scenes-objets", "index.ts"), "utf8");
    expect(index).not.toMatch(/definition-dite|carton-definition/);
    expect(readFileSync(join(racine, "motion", "petits-objets", "index.ts"), "utf8")).not.toMatch(/carton-definition/);
  });
});
