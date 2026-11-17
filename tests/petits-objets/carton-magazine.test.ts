/** C10-04a — carton « magazine » : ligne fine et mot-clé géant, sans fond (pièce pure non inscrite). */
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXEMPLES_CARTON_MAGAZINE, OBJET_CARTON_MAGAZINE, RAPPORT_TAILLES, taillesCarton, type ParametresCartonMagazine } from "../../src/briques/motion/petits-objets/carton-magazine";
import { IMAGES_ENTREE } from "../../src/briques/motion/petits-objets/progres";
import { MOTS_MAX, verifierDefinition, type TonObjet } from "../../src/briques/motion/petits-objets/contrat";
import { couleurDuTon } from "../../src/briques/motion/petits-objets/tons";
import { couleursSur, type FondAxion } from "../../src/briques/jetons-motion";

const DEF = OBJET_CARTON_MAGAZINE;
const P: ParametresCartonMagazine = { ligne: "Le secret", motCle: "Simplicité" };
const D = 32;
const TONS: TonObjet[] = ["neutre", "accent", "valide", "erreur"];
const FONDS: FondAxion[] = ["ivoire", "noir"];

function rendre(image: number, o: { ton?: TonObjet; fond?: FondAxion; p?: ParametresCartonMagazine; graine?: number } = {}) {
  return renderToStaticMarkup(DEF.Rendu({ image, fps: 25, dureeImages: D, fond: o.fond ?? "ivoire", parametres: o.p ?? P, ton: o.ton ?? "neutre", graine: o.graine ?? 7 }));
}
const opaciteGroupe = (m: string) => Number(/^<svg[^>]*><g opacity="([^"]+)"/.exec(m)?.[1]);

describe("C10-04a contrat", () => {
  it("identifiant propre, capacité objet.etiquette, durée 1..1,5 s, MOTS_MAX = 4", () => {
    expect(DEF.id).toBe("objet-carton-magazine");
    expect(verifierDefinition(DEF)).toBe("ok");
    expect(DEF.capacite).toBe("objet.etiquette");
    expect(DEF.dureeSec).toEqual({ min: 1, max: 1.5 });
    expect(MOTS_MAX).toBe(4);
  });
  it("valider refuse ligne vide, mot-clé de 2 mots, total > 4 mots, undefined et le reste", () => {
    for (const mauvais of [undefined, null, {}, 42, "texte", [], { ligne: "", motCle: "Mot" }, { ligne: " ", motCle: "Mot" }, { ligne: "a b", motCle: "deux mots" }, { ligne: "a b c d", motCle: "Mot" }, { ligne: "a", motCle: "" }, { ligne: 1, motCle: "Mot" }, { ligne: "a", motCle: 2 }])
      expect(DEF.valider(mauvais)).toBeNull();
    expect(DEF.valider(P)).toEqual(P);
    expect(DEF.valider({ ligne: "a b c", motCle: "Mot" })).toEqual({ ligne: "a b c", motCle: "Mot" });
  });
  it("exemples valides", () => {
    expect(EXEMPLES_CARTON_MAGAZINE.length).toBeGreaterThan(0);
    for (const e of EXEMPLES_CARTON_MAGAZINE) expect(DEF.valider(e)).not.toBeNull();
  });
});

describe("C10-04a tailles", () => {
  it("rapport constant dans [2 ; 2,5]", () => {
    expect(RAPPORT_TAILLES).toBeGreaterThanOrEqual(2);
    expect(RAPPORT_TAILLES).toBeLessThanOrEqual(2.5);
    for (const e of [...EXEMPLES_CARTON_MAGAZINE, { ligne: "a", motCle: "Anticonstitutionnellement" }]) {
      const t = taillesCarton(e);
      expect(t.motCle / t.ligne).toBeGreaterThanOrEqual(2);
      expect(t.motCle / t.ligne).toBeLessThanOrEqual(2.5);
    }
  });
});

describe("C10-04a rendu", () => {
  it("graisses 300 et 800, Manrope, texte rendu tel quel, aucun chiffre ajouté", () => {
    const m = rendre(15);
    expect(m).toContain('font-weight="300"');
    expect(m).toContain('font-weight="800"');
    expect(m).toContain("Manrope");
    const textes = [...m.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((x) => x[1]);
    expect(textes).toEqual(["Le secret", "Simplicité"]);
  });
  it("entrée : les deux textes sont à opacité 0 à l'image 0 et pleins à la fin de l'entrée", () => {
    const ops = (m: string) => [...m.matchAll(/<text[^>]*opacity="([^"]+)"/g)].map((x) => Number(x[1]));
    const debut = ops(rendre(0));
    expect(debut).toHaveLength(2);
    for (const o of debut) expect(o).toBeLessThan(0.05);
    const fin = ops(rendre(IMAGES_ENTREE));
    expect(fin).toHaveLength(2);
    for (const o of fin) expect(o).toBe(1);
  });
  it("dernière image : opacité 0 ; tenue pleine ; sortie en 6 images", () => {
    expect(opaciteGroupe(rendre(D - 1))).toBe(0);
    expect(opaciteGroupe(rendre(15))).toBe(1);
    const sous = Array.from({ length: D }, (_, i) => i).filter((i) => i > 10 && opaciteGroupe(rendre(i)) < 1);
    expect(sous).toEqual([26, 27, 28, 29, 30, 31]);
  });
  it("même entrée = même balisage ; aucun fond, <img, filter, mask, drop-shadow", () => {
    expect(rendre(10, { graine: 3 })).toBe(rendre(10, { graine: 3 }));
    const m = rendre(15);
    expect(m).not.toMatch(/<img|<image|<rect|filter|mask|drop-shadow|foreignObject/i);
  });
  it("couleurs de la charte seulement, 4 tons, 2 fonds", () => {
    for (const fond of FONDS) for (const ton of TONS) {
      const c = couleursSur(fond);
      const permis = [couleurDuTon("neutre", fond), couleurDuTon(ton, fond), c.texte, c.fond, "none"];
      const vues = [...rendre(15, { fond, ton }).matchAll(/(?:stroke|fill)="([^"]+)"/g)];
      expect(vues.length).toBeGreaterThan(0);
      for (const x of vues) expect(permis).toContain(x[1]);
    }
  });
});

describe("C10-04a garde statique (13 motifs de garde.test.ts:8-22, copiés)", () => {
  const texte = readFileSync(join(__dirname, "..", "..", "src", "briques", "motion", "petits-objets", "carton-magazine.tsx"), "utf8");
  const MOTIFS: [string, RegExp][] = [
    ["@/", /@\//], ["zod", /\bzod\b/], ["Math.random", /Math\.random/], ["remotion", /remotion/],
    ["moteurs/", /from\s+["'][^"']*moteurs\//], ["-v4", /from\s+["'][^"']*-v4/], ["VideoAnimeeV4", /VideoAnimeeV4/],
    ["briques-v4", /briques-v4/], ["faits-script", /faits-script/], ["droits", /from\s+["'][^"']*\/droits/],
    ["bibliotheque-video", /bibliotheque-video/], ["domaine", /src\/domaine|from\s+["'][^"']*\/domaine\//], ["services", /from\s+["'][^"']*\/services\//],
  ];
  it("aucun motif interdit", () => {
    expect(MOTIFS.filter(([, re]) => re.test(texte)).map(([n]) => n)).toEqual([]);
  });
  it("ni filtre, ni masque, ni courbe littérale, ni ressort ; aucune <img", () => {
    expect(texte).not.toMatch(/drop-shadow|<mask|<filter|\bfilter\s*[=:]|cubic-bezier|Easing\.bezier|damping|stiffness|mass\s*:|<img|<Img/);
  });
});
