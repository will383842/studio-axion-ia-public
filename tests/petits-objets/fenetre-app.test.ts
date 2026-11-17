/** C9-18 — fenêtre d'application à trois points, contenu neutre, ≤ 60 % du cadre : pièce pure non inscrite. */
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXEMPLES_FENETRE_APP, OBJET_FENETRE_APP, type ParametresFenetreApp } from "../../src/briques/motion/petits-objets/fenetre-app";
import { SURFACE_MAX, verifierDefinition, type TonObjet } from "../../src/briques/motion/petits-objets/contrat";
import { couleurDuTon } from "../../src/briques/motion/petits-objets/tons";
import { couleursSur, type FondAxion } from "../../src/briques/jetons-motion";
import { PALETTE } from "../../src/briques/charte/axion-2026";

const DEF = OBJET_FENETRE_APP;
const P: ParametresFenetreApp = { largeur: 60, hauteur: 50, titre: "Mon espace" };
const TONS: TonObjet[] = ["neutre", "accent", "valide", "erreur"];
const FONDS: FondAxion[] = ["ivoire", "noir"];
const D = 60;

function rendre(image: number, o: { graine?: number; ton?: TonObjet; fond?: FondAxion; p?: ParametresFenetreApp } = {}) {
  return renderToStaticMarkup(DEF.Rendu({ image, fps: 25, dureeImages: D, fond: o.fond ?? "ivoire", parametres: o.p ?? P, ton: o.ton ?? "neutre", graine: o.graine ?? 7 }));
}
const decalages = (m: string) => [...m.matchAll(/stroke-dashoffset="([^"]+)"/g)].map((x) => Number(x[1]));
const opaciteGroupe = (m: string) => Number(/^<svg[^>]*><g opacity="([^"]+)"/.exec(m)?.[1]);

describe("C9-18 contrat", () => {
  it("identifiant propre, famille ecran, capacité objet.ecran, aucune donnée", () => {
    expect(DEF.id).toBe("objet-fenetre-app");
    expect(verifierDefinition(DEF)).toBe("ok");
    expect(DEF.famille).toBe("ecran");
    expect(DEF.capacite).toBe("objet.ecran");
    expect(DEF.donnees).toBe("aucune");
  });
  it("valider ne lève jamais et refuse les mauvaises entrées", () => {
    for (const mauvais of [undefined, null, {}, 42, "texte", { largeur: 50 }, { largeur: "a", hauteur: 40 }, { largeur: NaN, hauteur: 40 }, { largeur: 50, hauteur: 40, titre: "un deux trois quatre cinq" }, { largeur: 50, hauteur: 40, titre: 3 }, { largeur: 0, hauteur: 40 }, { largeur: 101, hauteur: 10 }])
      expect(DEF.valider(mauvais)).toBeNull();
    expect(DEF.valider(P)).toEqual(P);
    expect(DEF.valider({ largeur: 50, hauteur: 40 })).toEqual({ largeur: 50, hauteur: 40 });
  });
  it("exemples valides", () => {
    for (const e of EXEMPLES_FENETRE_APP) expect(DEF.valider(e)).not.toBeNull();
  });
});

describe("C9-18 rendu", () => {
  it("déterministe ; image 0 : tracé à 0 ; dernière image : opacité 0 ; tenue pleine", () => {
    expect(rendre(20)).toBe(rendre(20));
    expect(decalages(rendre(0)).every((x) => x === 1)).toBe(true);
    expect(opaciteGroupe(rendre(D - 1))).toBe(0);
    expect(decalages(rendre(30)).every((x) => x === 0)).toBe(true);
    expect(opaciteGroupe(rendre(30))).toBe(1);
  });
  it("sortie en 6 images exactement", () => {
    const sous = Array.from({ length: D }, (_, i) => i).filter((i) => i > 10 && opaciteGroupe(rendre(i)) < 1);
    expect(sous).toEqual([54, 55, 56, 57, 58, 59]);
  });
  it("panneau en fondu après le contour, trois points", () => {
    expect((rendre(30).match(/<circle/g) ?? []).length).toBe(3);
    expect(rendre(0)).toMatch(/fill-opacity="0"/);
    expect(rendre(30)).toMatch(/fill-opacity="1"/);
  });
  it("ordre : pendant le tracé le panneau est invisible ; le fondu ne monte qu'une fois le contour fini", () => {
    let enCours = 0;
    let fonduVu = 0;
    for (let i = 0; i < D - 6; i++) {
      const m = rendre(i);
      const d = decalages(m)[0];
      const fo = [...m.matchAll(/fill-opacity="([^"]+)"/g)].map((x) => Number(x[1]));
      if (d > 0 && d < 1) { enCours++; expect(fo.every((v) => v === 0)).toBe(true); }
      if (fo.some((v) => v > 0)) { fonduVu++; expect(d).toBe(0); }
    }
    expect(enCours).toBeGreaterThan(0);
    expect(fonduVu).toBeGreaterThan(0);
  });
  it("couleurs de la charte seulement, orange jamais sur ivoire, aucun filter/mask/drop-shadow", () => {
    for (const fond of FONDS) for (const ton of TONS) {
      const m = rendre(30, { fond, ton });
      const c = couleursSur(fond);
      const permis = [couleurDuTon("neutre", fond), couleurDuTon(ton, fond), c.texte, c.panneau, c.panneauRelief, c.filet, "none"];
      for (const x of m.matchAll(/(?:stroke|fill)="([^"]+)"/g)) expect(permis).toContain(x[1]);
      expect(m).not.toMatch(/filter|mask|drop-shadow/i);
      if (fond === "ivoire") expect(m).not.toContain(PALETTE.orange);
    }
  });
});

describe("C9-18 propres à la fiche", () => {
  it("surface > 60 % → null ; 60 % exactement accepté", () => {
    expect(DEF.valider({ largeur: 80, hauteur: 80 })).toBeNull();
    expect(DEF.valider({ largeur: 100, hauteur: 61 })).toBeNull();
    expect(DEF.valider({ largeur: 100, hauteur: SURFACE_MAX * 100 })).not.toBeNull();
  });
  it("aucune teinte jaune, verte ou bleue dans le balisage (teinte HSL hors des plages interdites)", () => {
    const hex = Object.values(PALETTE).map((v) => String(v).toLowerCase());
    const teinte = (h: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
      if (d < 0.08) return -1; // gris : pas de teinte
      const t = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return (t * 60 + 360) % 360;
    };
    let vues = 0;
    for (const fond of FONDS) for (const ton of TONS) {
      const m = rendre(30, { fond, ton }).toLowerCase();
      for (const x of m.matchAll(/#[0-9a-f]{6}/g)) {
        vues++;
        expect(hex).toContain(x[0]);
        const h = teinte(x[0]);
        if (h < 0) continue;
        expect(h >= 45 && h <= 70).toBe(false);
        expect(h >= 75 && h <= 165).toBe(false);
        expect(h >= 180 && h <= 260).toBe(false);
      }
    }
    expect(vues).toBeGreaterThan(0);
  });
  it("balisage sans iframe, img ni foreignObject ; pas de nom de marque dans le titre par défaut", () => {
    const m = rendre(30, { p: { largeur: 50, hauteur: 40 } });
    expect(m).not.toMatch(/<iframe|<img|foreignObject/i);
    expect(m).not.toContain("<text");
  });
  it("titre rendu en Manrope", () => {
    expect(rendre(30)).toContain("Manrope");
  });
});

describe("C9-18 garde statique du fichier (13 motifs de garde.test.ts:8-22, copiés)", () => {
  const texte = readFileSync(join(__dirname, "..", "..", "src", "briques", "motion", "petits-objets", "fenetre-app.tsx"), "utf8");
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
