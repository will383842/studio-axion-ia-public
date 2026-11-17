/** C10-08 — volet avant / après à poignée entre deux vraies captures : pièce pure non inscrite. */
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXEMPLES_VOLET, geometrieVolet, OBJET_VOLET_AVANT_APRES, type ParametresVoletAvantApres } from "../../src/briques/motion/petits-objets/volet-avant-apres";
import { verifierDefinition, type TonObjet } from "../../src/briques/motion/petits-objets/contrat";
import { couleurDuTon } from "../../src/briques/motion/petits-objets/tons";
import { couleursSur, type FondAxion } from "../../src/briques/jetons-motion";

const DEF = OBJET_VOLET_AVANT_APRES;
const P: ParametresVoletAvantApres = { avant: "a.png", apres: "b.png", etiquettes: true };
const TONS: TonObjet[] = ["neutre", "accent", "valide", "erreur"];
const FONDS: FondAxion[] = ["ivoire", "noir"];
const D = 60;

function rendre(image: number, o: { graine?: number; ton?: TonObjet; fond?: FondAxion; p?: ParametresVoletAvantApres } = {}) {
  return renderToStaticMarkup(DEF.Rendu({ image, fps: 25, dureeImages: D, fond: o.fond ?? "ivoire", parametres: o.p ?? P, ton: o.ton ?? "neutre", graine: o.graine ?? 7 }));
}
const opaciteGroupe = (m: string) => Number(/^<svg[^>]*><g opacity="([^"]+)"/.exec(m)?.[1]);

describe("C10-08 contrat", () => {
  it("identifiant propre, famille ecran, capacité objet.ecran, aucune donnée, durée 1,2..4 s", () => {
    expect(DEF.id).toBe("objet-volet-avant-apres");
    expect(verifierDefinition(DEF)).toBe("ok");
    expect(DEF.famille).toBe("ecran");
    expect(DEF.capacite).toBe("objet.ecran");
    expect(DEF.donnees).toBe("aucune");
    expect(DEF.dureeSec).toEqual({ min: 1.2, max: 4 });
  });
  it("valider ne lève jamais et refuse les mauvaises entrées", () => {
    for (const mauvais of [undefined, null, {}, { avant: "" }, { avant: "a", apres: "a" }, { avant: "a", apres: " " }, { avant: 1, apres: "b" }, { avant: "a", apres: "b", sens: "haut" }, { avant: "a", apres: "b", etiquettes: "oui" }, 42, "texte", []])
      expect(DEF.valider(mauvais)).toBeNull();
    expect(DEF.valider(P)).toEqual(P);
    expect(DEF.valider({ avant: "a", apres: "b", sens: "droite-gauche" })).toEqual({ avant: "a", apres: "b", sens: "droite-gauche" });
  });
  it("exemples valides", () => {
    for (const e of EXEMPLES_VOLET) expect(DEF.valider(e)).not.toBeNull();
  });
});

describe("C10-08 géométrie", () => {
  it("image 0 au bord de départ ; milieu de l'objet = 0,5 ; tenue à 0,5", () => {
    expect(geometrieVolet(0, D, "gauche-droite").coupure).toBe(0);
    expect(geometrieVolet(0, D, "droite-gauche").coupure).toBe(1);
    expect(geometrieVolet(D / 2, D).coupure).toBe(0.5);
    expect(geometrieVolet(D - 1, D).coupure).toBe(0.5);
  });
  it("glisse de façon croissante, même entrée = même sortie, sens inversé = symétrique", () => {
    let prec = -1;
    for (let i = 0; i <= 15; i++) {
      const g = geometrieVolet(i, D);
      expect(g.coupure).toBeGreaterThanOrEqual(prec);
      prec = g.coupure;
      expect(geometrieVolet(i, D)).toEqual(g);
      const inv = geometrieVolet(i, D, "droite-gauche");
      expect(inv.coupure).toBeCloseTo(1 - g.coupure, 10);
      expect(inv.poignee.x).toBeCloseTo(1000 - g.poignee.x, 6);
    }
  });
  it("entrées absurdes : jamais d'exception, coupure dans [0, 1]", () => {
    for (const i of [NaN, -3, Infinity]) {
      const c = geometrieVolet(i, D).coupure;
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
    }
  });
});

describe("C10-08 rendu", () => {
  it("déterministe (même graine = même balisage) ; dernière image : opacité 0 ; tenue pleine", () => {
    expect(rendre(20, { graine: 3 })).toBe(rendre(20, { graine: 3 }));
    expect(opaciteGroupe(rendre(D - 1))).toBe(0);
    expect(opaciteGroupe(rendre(30))).toBe(1);
  });
  it("sortie en 6 images exactement", () => {
    const sous = Array.from({ length: D }, (_, i) => i).filter((i) => i > 10 && opaciteGroupe(rendre(i)) < 1);
    expect(sous).toEqual([54, 55, 56, 57, 58, 59]);
  });
  it("aucune <img> ; trait et poignée présents ; aucun filter, mask, drop-shadow", () => {
    const m = rendre(30);
    expect(m).not.toMatch(/<img|<iframe|foreignObject/i);
    expect(m).not.toMatch(/filter|mask|drop-shadow/i);
    expect(m).toContain("<line");
    expect(m).toContain("<circle");
  });
  it("étiquettes : « Avant » / « Après » seulement si true, en Manrope, aucun chiffre dans le texte", () => {
    const avec = rendre(30);
    const textes = [...avec.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((x) => x[1]);
    expect(textes).toEqual(["Avant", "Après"]);
    for (const t of textes) expect(t).not.toMatch(/\d/);
    expect(avec).toContain("Manrope");
    expect(rendre(30, { p: { avant: "a", apres: "b" } })).not.toContain("<text");
    expect(rendre(30, { p: { avant: "a", apres: "b", etiquettes: false } })).not.toContain("<text");
  });
  it("sens inversé : « Après » passe à gauche", () => {
    const g = rendre(30, { p: { ...P, sens: "gauche-droite" } });
    const d = rendre(30, { p: { ...P, sens: "droite-gauche" } });
    const xs = (m: string, mot: string) => Number(new RegExp(`<text x="([^"]+)"[^>]*>${mot}<`).exec(m)?.[1]);
    expect(xs(g, "Avant")).toBeLessThan(xs(g, "Après"));
    expect(xs(d, "Après")).toBeLessThan(xs(d, "Avant"));
  });
  it("couleurs de la charte seulement, pour les 4 tons et les 2 fonds", () => {
    for (const fond of FONDS) for (const ton of TONS) {
      const m = rendre(30, { fond, ton });
      const c = couleursSur(fond);
      const permis = [couleurDuTon("neutre", fond), couleurDuTon(ton, fond), c.texte, c.fond, c.panneau, c.panneauRelief, c.filet, "none"];
      const vues = [...m.matchAll(/(?:stroke|fill)="([^"]+)"/g)];
      expect(vues.length).toBeGreaterThan(0);
      for (const x of vues) expect(permis).toContain(x[1]);
    }
  });
});

describe("C10-08 garde statique (13 motifs de garde.test.ts:8-22, copiés)", () => {
  const racine = join(__dirname, "..", "..");
  const texte = readFileSync(join(racine, "src", "briques", "motion", "petits-objets", "volet-avant-apres.tsx"), "utf8");
  const habillage = readFileSync(join(racine, "studio-rendu", "compositions", "petits-objets", "VoletAvantApres.tsx"), "utf8");
  const MOTIFS: [string, RegExp][] = [
    ["@/", /@\//], ["zod", /\bzod\b/], ["Math.random", /Math\.random/], ["remotion", /remotion/],
    ["moteurs/", /from\s+["'][^"']*moteurs\//], ["-v4", /from\s+["'][^"']*-v4/], ["VideoAnimeeV4", /VideoAnimeeV4/],
    ["briques-v4", /briques-v4/], ["faits-script", /faits-script/], ["droits", /from\s+["'][^"']*\/droits/],
    ["bibliotheque-video", /bibliotheque-video/], ["domaine", /src\/domaine|from\s+["'][^"']*\/domaine\//], ["services", /from\s+["'][^"']*\/services\//],
  ];
  it("aucun motif interdit dans le fichier de PO", () => {
    expect(MOTIFS.filter(([, re]) => re.test(texte)).map(([n]) => n)).toEqual([]);
  });
  it("ni filtre, ni masque, ni courbe littérale, ni ressort ; aucune <img", () => {
    expect(texte).not.toMatch(/drop-shadow|<mask|<filter|\bfilter\s*[=:]|cubic-bezier|Easing\.bezier|damping|stiffness|mass\s*:|<img|<Img/);
  });
  it("l'habillage n'importe ni @/ ni -v4 et n'utilise ni masque ni filtre", () => {
    expect(habillage).not.toMatch(/@\/|-v4|VideoAnimeeV4|briques-v4/);
    expect(habillage).not.toMatch(/\bmask|filter|drop-shadow/i);
    expect(habillage).toContain("clipPath");
  });
});
