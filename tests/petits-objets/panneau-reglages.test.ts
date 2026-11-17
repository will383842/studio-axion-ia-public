/** C10-12 — panneau de réglages (interrupteur qui bascule, curseur, pastilles) : pièce pure non inscrite. */
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXEMPLES_PANNEAU_REGLAGES, OBJET_PANNEAU_REGLAGES, type ParametresPanneauReglages } from "../../src/briques/motion/petits-objets/panneau-reglages";
import { SURFACE_MAX, verifierDefinition, type TonObjet } from "../../src/briques/motion/petits-objets/contrat";
import { couleurDuTon } from "../../src/briques/motion/petits-objets/tons";
import { couleursSur, type FondAxion } from "../../src/briques/jetons-motion";
import { PALETTE } from "../../src/briques/charte/axion-2026";

const DEF = OBJET_PANNEAU_REGLAGES;
const P: ParametresPanneauReglages = { largeur: 50, hauteur: 50, interrupteur: true, curseur: 70, pastilles: 3, selection: 1 };
const TONS: TonObjet[] = ["neutre", "accent", "valide", "erreur"];
const FONDS: FondAxion[] = ["ivoire", "noir"];
const D = 60;

function rendre(image: number, o: { fond?: FondAxion; p?: ParametresPanneauReglages } = {}) {
  return renderToStaticMarkup(DEF.Rendu({ image, fps: 25, dureeImages: D, fond: o.fond ?? "ivoire", parametres: o.p ?? P, ton: "neutre", graine: 7 }));
}
const opaciteGroupe = (m: string) => Number(/^<svg[^>]*><g opacity="([^"]+)"/.exec(m)?.[1]);
const bouton = (m: string) => Number(/data-role="bouton" cx="([^"]+)"/.exec(m)?.[1]);

describe("C10-12 contrat", () => {
  it("identifiant propre, famille ecran, capacité objet.ecran, aucune donnée", () => {
    expect(DEF.id).toBe("objet-panneau-reglages");
    expect(verifierDefinition(DEF)).toBe("ok");
    expect(DEF.famille).toBe("ecran");
    expect(DEF.capacite).toBe("objet.ecran");
    expect(DEF.donnees).toBe("aucune");
  });
  it("valider ne lève jamais et refuse les mauvaises entrées", () => {
    const base = { largeur: 50, hauteur: 50, interrupteur: true, curseur: 50, pastilles: 2 };
    for (const mauvais of [undefined, null, {}, 42, "texte", { ...base, largeur: 80, hauteur: 80 }, { ...base, curseur: -1 }, { ...base, curseur: 101 }, { ...base, curseur: NaN },
      { ...base, pastilles: 0 }, { ...base, pastilles: 4 }, { ...base, pastilles: 1.5 }, { ...base, selection: 2 }, { ...base, selection: -1 }, { ...base, interrupteur: "oui" }, { ...base, largeur: 10 }])
      expect(DEF.valider(mauvais)).toBeNull();
    expect(DEF.valider(P)).toEqual(P);
    expect(DEF.valider({ largeur: 100, hauteur: SURFACE_MAX * 100, interrupteur: false, curseur: 0, pastilles: 1 })).not.toBeNull();
  });
  it("exemples valides", () => {
    for (const e of EXEMPLES_PANNEAU_REGLAGES) expect(DEF.valider(e)).not.toBeNull();
  });
});

describe("C10-12 rendu", () => {
  it("déterministe ; dernière image : opacité 0 ; tenue pleine ; sortie en 6 images", () => {
    expect(rendre(20)).toBe(rendre(20));
    expect(opaciteGroupe(rendre(D - 1))).toBe(0);
    expect(opaciteGroupe(rendre(30))).toBe(1);
    const sous = Array.from({ length: D }, (_, i) => i).filter((i) => i > 10 && opaciteGroupe(rendre(i)) < 1);
    expect(sous).toEqual([54, 55, 56, 57, 58, 59]);
  });
  it("image 0 : tracé à 0 et panneau invisible", () => {
    expect([...rendre(0).matchAll(/stroke-dashoffset="([^"]+)"/g)].every((x) => Number(x[1]) === 1)).toBe(true);
    expect(rendre(0)).toMatch(/fill-opacity="0"/);
  });
  it("l'interrupteur bascule quand il est vrai, reste en place quand il est faux", () => {
    const debut = bouton(rendre(0));
    const fin = bouton(rendre(50));
    expect(fin).toBeGreaterThan(debut);
    const faux = { ...P, interrupteur: false };
    expect(bouton(rendre(20, { p: faux }))).toBe(bouton(rendre(50, { p: faux })));
    expect(bouton(rendre(20))).toBeGreaterThan(debut);
    expect(bouton(rendre(20))).toBeLessThan(fin);
    expect(bouton(rendre(50, { p: faux }))).toBe(debut);
    // la bascule se fait en 6 images au plus, puis tient
    expect(bouton(rendre(40))).toBe(fin);
  });
  it("curseur à la bonne place et pastilles en nombre demandé", () => {
    const x = (c: number) => Number(/data-role="poignee" cx="([^"]+)"/.exec(rendre(30, { p: { ...P, curseur: c } }))?.[1]);
    expect(x(0)).toBeLessThan(x(50));
    expect(x(50)).toBeLessThan(x(100));
    for (const n of [1, 2, 3]) expect((rendre(30, { p: { ...P, pastilles: n, selection: 0 } }).match(/data-role="pastille"/g) ?? []).length).toBe(n);
  });
  it("couleurs de la charte seulement, orange jamais sur ivoire, aucun filter/mask/drop-shadow, aucun texte", () => {
    for (const fond of FONDS) for (const ton of TONS) {
      const m = rendre(30, { fond });
      const c = couleursSur(fond);
      const permis = [couleurDuTon("neutre", fond), couleurDuTon("accent", fond), c.texte, c.panneau, c.panneauRelief, c.filet, c.fond, "none"];
      for (const y of m.matchAll(/(?:stroke|fill)="([^"]+)"/g)) expect(permis).toContain(y[1]);
      expect(m).not.toMatch(/filter|mask|drop-shadow|gradient|<text|<iframe|<img|foreignObject/i);
      if (fond === "ivoire") expect(m).not.toContain(PALETTE.orange);
      void ton;
    }
  });
  it("aucune teinte jaune, verte ou bleue", () => {
    const teinte = (h: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
      if (d < 0.08) return -1;
      const t = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return (t * 60 + 360) % 360;
    };
    let vues = 0;
    for (const fond of FONDS) for (const x of rendre(30, { fond }).toLowerCase().matchAll(/#[0-9a-f]{6}/g)) {
      vues++;
      const h = teinte(x[0]);
      if (h < 0) continue;
      expect(h >= 45 && h <= 70).toBe(false);
      expect(h >= 75 && h <= 165).toBe(false);
      expect(h >= 180 && h <= 260).toBe(false);
    }
    expect(vues).toBeGreaterThan(0);
  });
});

describe("C10-12 garde statique du fichier (13 motifs de garde.test.ts:8-22, copiés)", () => {
  const texte = readFileSync(join(__dirname, "..", "..", "src", "briques", "motion", "petits-objets", "panneau-reglages.tsx"), "utf8");
  const MOTIFS: [string, RegExp][] = [
    ["@/", /@\//], ["zod", /\bzod\b/], ["Math.random", /Math\.random/], ["remotion", /remotion/],
    ["moteurs/", /from\s+["'][^"']*moteurs\//], ["-v4", /from\s+["'][^"']*-v4/], ["VideoAnimeeV4", /VideoAnimeeV4/],
    ["briques-v4", /briques-v4/], ["faits-script", /faits-script/], ["droits", /from\s+["'][^"']*\/droits/],
    ["bibliotheque-video", /bibliotheque-video/], ["domaine", /src\/domaine|from\s+["'][^"']*\/domaine\//], ["services", /from\s+["'][^"']*\/services\//],
  ];
  it("aucun motif interdit", () => {
    expect(MOTIFS.filter(([, re]) => re.test(texte)).map(([n]) => n)).toEqual([]);
  });
  it("ni filtre, ni masque, ni courbe littérale, ni ressort, ni fenetre-app importé", () => {
    expect(texte).not.toMatch(/drop-shadow|<mask|<filter|\bfilter\s*[=:]|cubic-bezier|Easing\.bezier|damping|stiffness|mass\s*:|fenetre-app/);
  });
});
