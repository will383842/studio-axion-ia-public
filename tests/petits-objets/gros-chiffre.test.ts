/** C9-13 — gros chiffre (préfixe « + », unité, étoile décorative) : pièce pure non inscrite. */
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXEMPLES_GROS_CHIFFRE, OBJET_GROS_CHIFFRE, ecrireNombreFr, type ParametresGrosChiffre } from "../../src/briques/motion/petits-objets/gros-chiffre";
import { verifierDefinition, type DefinitionObjet, type TonObjet } from "../../src/briques/motion/petits-objets/contrat";
import { couleurDuTon } from "../../src/briques/motion/petits-objets/tons";
import { couleursSur, type FondAxion } from "../../src/briques/jetons-motion";
import { PALETTE } from "../../src/briques/charte/axion-2026";
import { garderObjet } from "../../src/briques/plan-scenes-objets";
import { DIX_SCRIPTS, motsHorodates } from "../briques/faits-script/dix-scripts";

const DEF = OBJET_GROS_CHIFFRE as unknown as DefinitionObjet<ParametresGrosChiffre>;
const P: ParametresGrosChiffre = { valeur: 49505, prefixe: "+", unite: "minutes", etoile: true };
const TONS: TonObjet[] = ["neutre", "accent", "valide", "erreur"];
const FONDS: FondAxion[] = ["ivoire", "noir"];
const D = 60;
const FIN = "\u00a0";

function rendre(image: number, o: { graine?: number; ton?: TonObjet; fond?: FondAxion; p?: ParametresGrosChiffre } = {}) {
  return renderToStaticMarkup(DEF.Rendu({ image, fps: 25, dureeImages: D, fond: o.fond ?? "ivoire", parametres: o.p ?? P, ton: o.ton ?? "neutre", graine: o.graine ?? 7 }));
}
const decalages = (m: string) => [...m.matchAll(/stroke-dashoffset="([^"]+)"/g)].map((x) => Number(x[1]));
const chiffre = (m: string) => /<text[^>]*data-role="chiffre"[^>]*>([^<]*)<\/text>/.exec(m)?.[1];

describe("C9-13 contrat", () => {
  it("identifiant propre, famille chiffre, capacité objet.chiffre, nombres dits", () => {
    expect(verifierDefinition(DEF)).toBe("ok");
    expect(DEF.id).toBe("objet-gros-chiffre");
    expect(DEF.famille).toBe("chiffre");
    expect(DEF.capacite).toBe("objet.chiffre");
    expect(DEF.donnees).toBe("nombres-dits");
  });
  it("valider ne lève jamais et refuse les mauvaises entrées", () => {
    for (const mauvais of [undefined, null, {}, 42, "un deux trois quatre cinq", { valeur: "12" }, { valeur: NaN }, { valeur: Infinity }, { valeur: -3 }, { valeur: 1.234 },
      { valeur: 5, prefixe: "-" }, { valeur: 5, unite: "un deux trois" }, { valeur: 5, unite: "" }, { valeur: 5, unite: "3 fois" }, { valeur: 5, unite: 4 }, { valeur: 5, etoile: "oui" }]) {
      expect(() => DEF.valider(mauvais)).not.toThrow();
      expect(DEF.valider(mauvais)).toBeNull();
    }
    expect(DEF.valider(P)).toEqual(P);
    expect(DEF.valider({ valeur: 12 })).toEqual({ valeur: 12 });
  });
  it("exemples valides", () => {
    for (const e of EXEMPLES_GROS_CHIFFRE) expect(DEF.valider(e)).not.toBeNull();
  });
});

describe("C9-13 rendu", () => {
  it("déterministe, tracé à 0 en image 0, opacité 0 à la dernière image, tenue pleine", () => {
    expect(rendre(20)).toBe(rendre(20));
    expect(decalages(rendre(0)).every((x) => x === 1)).toBe(true);
    expect(rendre(D - 1)).toMatch(/opacity="0"/);
    expect(decalages(rendre(30)).every((x) => x === 0)).toBe(true);
    expect(rendre(30)).toMatch(/opacity="1"/);
  });
  it("sortie en 6 images exactement", () => {
    const sous = Array.from({ length: D }, (_, i) => i).filter((i) => !/opacity="1"/.test(rendre(i)) && i > 10);
    expect(sous).toEqual([54, 55, 56, 57, 58, 59]);
  });
  it("couleurs de la charte seulement, aucun filter/mask/drop-shadow, orange jamais sur ivoire", () => {
    for (const fond of FONDS) for (const ton of TONS) {
      const m = rendre(30, { fond, ton });
      const permis = [couleurDuTon(ton, fond), couleursSur(fond).texte];
      for (const c of m.matchAll(/(?:stroke|fill)="([^"]+)"/g)) expect([...permis, "none"]).toContain(c[1]);
      expect(m).not.toMatch(/filter|mask|drop-shadow/i);
      if (fond === "ivoire" && ton === "accent") expect(m).not.toContain(PALETTE.orange);
    }
  });
  it("texte en Manrope (FAMILLE_CSS)", () => {
    expect(rendre(30)).toContain("Axion Manrope");
  });
});

describe("C9-13 propres à la fiche", () => {
  it("écriture française : espace insécable pour les milliers, virgule décimale", () => {
    expect(ecrireNombreFr(49505)).toBe(`49${FIN}505`);
    expect(ecrireNombreFr(999)).toBe("999");
    expect(ecrireNombreFr(1000)).toBe(`1${FIN}000`);
    expect(ecrireNombreFr(1234567)).toBe(`1${FIN}234${FIN}567`);
    expect(ecrireNombreFr(12.5)).toBe("12,5");
    expect(ecrireNombreFr(0)).toBe("0");
  });
  it("image de tenue : le texte affiché est la valeur exacte formatée", () => {
    expect(chiffre(rendre(30))).toBe(`+49${FIN}505`);
    expect(chiffre(rendre(30, { p: { valeur: 20 } }))).toBe("20");
    expect(rendre(30)).toContain(">minutes<");
  });
  it("le chiffre monte vers la valeur pendant l'entrée, jamais au-delà", () => {
    const lire = (i: number) => Number((chiffre(rendre(i, { p: { valeur: 1000 } })) ?? "").replace(/[^\d]/g, ""));
    expect(lire(0)).toBe(0);
    expect(lire(3)).toBeGreaterThan(lire(1));
    expect(lire(5)).toBeGreaterThanOrEqual(lire(3));
    for (let i = 0; i < D - 1; i++) expect(lire(i)).toBeLessThanOrEqual(1000);
    expect(lire(30)).toBe(1000);
  });
  it("étoile : exactement un tracé quand etoile: true, aucun sinon", () => {
    expect(rendre(30).match(/<path/g)?.length).toBe(1);
    expect(rendre(30, { p: { valeur: 49505 } })).not.toContain("<path");
    expect(rendre(30, { p: { valeur: 49505, etoile: false } })).not.toContain("<path");
  });
  it("accord avec la garde C9-04 : 49 505 refusé s'il n'est pas dit, accepté s'il l'est", () => {
    const mots = motsHorodates(DIX_SCRIPTS[0]!).map((m) => ({ texte: m.texte, debutMs: m.debutMs, finMs: m.finMs }));
    const ctx = { mots: mots as never, premier: 0, dernier: mots.length - 1 };
    const g = DEF as unknown as DefinitionObjet<unknown>;
    const r = garderObjet(g, { valeur: 49505 }, ctx);
    expect(typeof r === "object" && "refus" in r).toBe(true);
    expect(garderObjet(g, { valeur: 20, prefixe: "+", unite: "minutes" }, ctx)).toBe("ok");
    const dits = [{ texte: "plus", debutMs: 0, finMs: 200 }, { texte: "49505", debutMs: 200, finMs: 600 }];
    expect(garderObjet(g, { valeur: 49505, prefixe: "+" }, { mots: dits as never, premier: 0, dernier: 1 })).toBe("ok");
  });
});

describe("C9-13 garde statique du fichier (13 motifs de garde.test.ts:8-22, copiés)", () => {
  const texte = readFileSync(join(__dirname, "..", "..", "src", "briques", "motion", "petits-objets", "gros-chiffre.tsx"), "utf8");
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
