/** N-08a — anneau (ou camembert) de part : pièce pure non inscrite. */
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXEMPLES_ANNEAU, OBJET_ANNEAU_DONNEES, type ParametresAnneauDonnees } from "../../src/briques/motion/petits-objets/anneau-donnees";
import { verifierDefinition, type DefinitionObjet, type TonObjet } from "../../src/briques/motion/petits-objets/contrat";
import { couleurDuTon } from "../../src/briques/motion/petits-objets/tons";
import { couleursSur, type FondAxion } from "../../src/briques/jetons-motion";

const DEF = OBJET_ANNEAU_DONNEES as unknown as DefinitionObjet<ParametresAnneauDonnees>;
const D = 60;
const FONDS: FondAxion[] = ["ivoire", "noir"];

function rendre(image: number, p: ParametresAnneauDonnees = { valeur: 30 }, fond: FondAxion = "ivoire", ton: TonObjet = "neutre") {
  return renderToStaticMarkup(DEF.Rendu({ image, fps: 25, dureeImages: D, fond, parametres: p, ton, graine: 7 }));
}
const angle = (m: string) => Number(/data-role="part"[^>]*data-angle="([^"]+)"/.exec(m)?.[1] ?? /data-angle="([^"]+)"[^>]*data-role="part"/.exec(m)?.[1]);
const chiffre = (m: string) => /<text[^>]*data-role="chiffre"[^>]*>([^<]*)<\/text>/.exec(m)?.[1];

describe("N-08a contrat", () => {
  it("définition valide, famille chiffre, nombres dits", () => {
    expect(verifierDefinition(DEF)).toBe("ok");
    expect(DEF.id).toBe("objet-anneau-donnees");
    expect(DEF.famille).toBe("chiffre");
    expect(DEF.capacite).toBe("objet.chiffre");
    expect(DEF.donnees).toBe("nombres-dits");
  });
  it("0 et total acceptés ; hors bornes, NaN, chaîne refusés sans lever", () => {
    expect(DEF.valider({ valeur: 0 })).not.toBeNull();
    expect(DEF.valider({ valeur: 100 })).not.toBeNull();
    expect(DEF.valider({ valeur: 4, total: 4 })).not.toBeNull();
    for (const mauvais of [undefined, null, {}, 3, "30", { valeur: -1 }, { valeur: 101 }, { valeur: 5, total: 4 }, { valeur: NaN }, { valeur: Infinity }, { valeur: "30" },
      { valeur: 1, total: 0 }, { valeur: 1, total: "x" }, { valeur: 30, forme: "carre" }, { valeur: 30, libelle: "un deux trois quatre" }, { valeur: 30, libelle: "3 fois" }, { valeur: 30, libelle: "" }, { valeur: 1.234 }]) {
      expect(() => DEF.valider(mauvais)).not.toThrow();
      expect(DEF.valider(mauvais)).toBeNull();
    }
  });
  it("exemples valides", () => {
    for (const e of EXEMPLES_ANNEAU) expect(DEF.valider(e)).not.toBeNull();
  });
});

describe("N-08a rendu", () => {
  it("30/100 → arc final de 108° (±0,5°), anneau comme camembert", () => {
    expect(Math.abs(angle(rendre(40)) - 108)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(angle(rendre(40, { valeur: 30, forme: "camembert" })) - 108)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(angle(rendre(40, { valeur: 3, total: 4 })) - 270)).toBeLessThanOrEqual(0.5);
  });
  it("valeur 0 → arc nul ; valeur = total → 360°", () => {
    expect(angle(rendre(40, { valeur: 0 }))).toBe(0);
    expect(angle(rendre(40, { valeur: 100 }))).toBe(360);
    expect(angle(rendre(40, { valeur: 100, forme: "camembert" }))).toBe(360);
  });
  it("chiffre affiché = chiffre fourni (20 valeurs, décimales comprises), à toute image", () => {
    const vals = [0, 1, 2, 5, 7, 12, 18, 25, 30, 33, 42, 50, 61, 66, 75, 80, 90, 99, 12.5, 99.99];
    expect(vals.length).toBe(20);
    for (const v of vals) {
      const attendu = String(v).replace(".", ",");
      for (const i of [0, 3, 30]) expect(chiffre(rendre(i, { valeur: v }))).toBe(attendu);
    }
  });
  it("montée monotone de 0 à la part, tenue ensuite", () => {
    let prec = -1;
    for (let i = 0; i <= 12; i++) {
      const a = angle(rendre(i));
      expect(a).toBeGreaterThanOrEqual(prec);
      expect(a).toBeLessThanOrEqual(108.01);
      prec = a;
    }
    expect(angle(rendre(0))).toBe(0);
    expect(angle(rendre(30))).toBe(angle(rendre(45)));
  });
  it("déterministe ; dernière image → opacité 0 ; tenue → opacité 1", () => {
    expect(rendre(20)).toBe(rendre(20));
    expect(rendre(D - 1)).toMatch(/opacity="0"/);
    expect(rendre(30)).toMatch(/opacity="1"/);
  });
  it("couleurs de la charte, aucun filter/mask/drop-shadow, Manrope", () => {
    for (const fond of FONDS) for (const forme of ["anneau", "camembert"] as const) {
      const m = rendre(30, { valeur: 30, forme, libelle: "des visiteurs" }, fond);
      const permis = [couleurDuTon("accent", fond), couleurDuTon("neutre", fond), couleursSur(fond).texte, "none"];
      for (const c of m.matchAll(/(?:stroke|fill)="([^"]+)"/g)) expect(permis).toContain(c[1]);
      expect(m).not.toMatch(/filter|mask|drop-shadow/i);
      expect(m).toContain("Axion Manrope");
      expect(m).toContain(">des visiteurs<");
    }
  });
});

describe("N-08a garde statique du fichier (13 motifs de garde.test.ts:8-22, copiés)", () => {
  const texte = readFileSync(join(__dirname, "..", "..", "src", "briques", "motion", "petits-objets", "anneau-donnees.tsx"), "utf8");
  const MOTIFS: [string, RegExp][] = [
    ["@/", /@\//], ["zod", /\bzod\b/], ["Math.random", /Math\.random/], ["remotion", /remotion/],
    ["moteurs/", /from\s+["'][^"']*moteurs\//], ["-v4", /from\s+["'][^"']*-v4/], ["VideoAnimeeV4", /VideoAnimeeV4/],
    ["briques-v4", /briques-v4/], ["faits-script", /faits-script/], ["droits", /from\s+["'][^"']*\/droits/],
    ["bibliotheque-video", /bibliotheque-video/], ["domaine", /src\/domaine|from\s+["'][^"']*\/domaine\//], ["services", /from\s+["'][^"']*\/services\//],
  ];
  it("aucun motif interdit", () => {
    expect(MOTIFS.filter(([, re]) => re.test(texte)).map(([n]) => n)).toEqual([]);
  });
  it("ni filtre, ni masque, ni courbe littérale, ni ressort, ni jaune/vert/bleu", () => {
    expect(texte).not.toMatch(/drop-shadow|<mask|<filter|\bfilter\s*[=:]|cubic-bezier|Easing\.bezier|damping|stiffness|mass\s*:/);
  });
});
