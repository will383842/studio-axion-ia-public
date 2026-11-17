/** C9-15 — cartes à coche (1 à 4), pièce pure non inscrite, réutilise la coche sauge de C9-09. */
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXEMPLES_CARTES, OBJET_CARTES_COCHE as DEF, type ParametresCartes } from "../../src/briques/motion/petits-objets/cartes";
import { verifierDefinition, type TonObjet } from "../../src/briques/motion/petits-objets/contrat";
import { couleurDuTon } from "../../src/briques/motion/petits-objets/tons";
import { couleursSur, type FondAxion } from "../../src/briques/jetons-motion";
import { PALETTE } from "../../src/briques/charte/axion-2026";
import { garderObjet } from "../../src/briques/plan-scenes-objets/garde";
import type { DefinitionObjet } from "../../src/briques/motion/petits-objets/contrat";

const P: ParametresCartes = { boite: { x: 15, y: 30, largeur: 70, hauteur: 28 }, cartes: ["Premier point", "Deuxième point"] };
const FONDS: FondAxion[] = ["ivoire", "noir"];
const TONS: TonObjet[] = ["neutre", "accent", "valide", "erreur"];
const D = 80;
const rendre = (image: number, o: { fond?: FondAxion; ton?: TonObjet; p?: ParametresCartes; graine?: number } = {}) =>
  renderToStaticMarkup(DEF.Rendu({ image, fps: 25, dureeImages: D, fond: o.fond ?? "ivoire", parametres: o.p ?? P, ton: o.ton ?? "neutre", graine: o.graine ?? 7 }));
const decalages = (m: string) => [...m.matchAll(/stroke-dashoffset="([^"]+)"/g)].map((x) => Number(x[1]));

describe("C9-15 contrat", () => {
  it("identifiant propre, capacité objet.cartes", () => {
    expect(verifierDefinition(DEF)).toBe("ok");
    expect(DEF.id).toBe("objet-cartes-coche");
    expect(DEF.capacite).toBe("objet.cartes");
    expect(DEF.donnees).toBe("mots-dits");
  });
  it("valider ne lève jamais et refuse les mauvaises entrées", () => {
    const b = P.boite;
    for (const mauvais of [undefined, null, {}, 42, "x", { boite: b }, { boite: b, cartes: [] }, { boite: b, cartes: ["a", "b", "c", "d", "e"] }, { boite: b, cartes: ["un deux trois quatre cinq"] }, { boite: b, cartes: [""] }, { boite: b, cartes: [3] }, { boite: b, cartes: ["a".repeat(41)] }, { boite: { x: 0, y: 0, largeur: 100, hauteur: 100 }, cartes: ["a"] }, { boite: b, cartes: ["a"], preuve: 3 }])
      expect(DEF.valider(mauvais)).toBeNull();
    expect(DEF.valider(P)).toEqual(P);
  });
  it("exemples valides, de 1 à 4 cartes", () => {
    expect(EXEMPLES_CARTES.map((e) => e.cartes.length)).toEqual([1, 2, 4]);
    for (const e of EXEMPLES_CARTES) expect(DEF.valider(e)).not.toBeNull();
  });
});

describe("C9-15 rendu", () => {
  it("déterministe, tracé à 0 en image 0, opacité 0 à la dernière image, tenue pleine", () => {
    expect(rendre(20)).toBe(rendre(20));
    expect(decalages(rendre(0)).every((x) => x === 1)).toBe(true);
    expect(rendre(D - 1)).toMatch(/opacity="0"/);
    expect(decalages(rendre(40)).every((x) => x === 0)).toBe(true);
    expect(rendre(40)).toMatch(/opacity="1"/);
  });
  it("sortie en 6 images exactement", () => {
    const sous = Array.from({ length: D }, (_, i) => i).filter((i) => i > 20 && !/<g opacity="1"/.test(rendre(i)));
    expect(sous).toEqual([74, 75, 76, 77, 78, 79]);
  });
  it("une carte = un cadre + une coche + un texte ; la 2e carte démarre 4 images après", () => {
    for (const e of EXEMPLES_CARTES) {
      const m = rendre(40, { p: e });
      expect((m.match(/<path/g) ?? []).length).toBe(2 * e.cartes.length);
      expect((m.match(/<text/g) ?? []).length).toBe(e.cartes.length);
    }
    const d0 = decalages(rendre(3));
    const d1 = decalages(rendre(7));
    expect(d1[0]).toBeLessThan(d0[0]);
    expect(d0[2]).toBe(1);
    expect(d1[2]).toBeLessThan(1);
  });
  it("coche sauge seulement avec preuve non vide", () => {
    const sauge = PALETTE.reussite;
    for (const fond of FONDS) {
      expect(rendre(40, { fond, p: P })).not.toContain(sauge);
      expect(rendre(40, { fond, p: { ...P, preuve: "  " } })).not.toContain(sauge);
      expect(rendre(40, { fond, p: { ...P, preuve: "dit" } })).toContain(sauge);
    }
  });
  it("couleurs de la charte seulement, orange jamais sur ivoire, aucun filter/mask/drop-shadow ni #B8341C", () => {
    for (const fond of FONDS) for (const ton of TONS) {
      const m = rendre(40, { fond, ton, p: { ...P, preuve: "ok" } });
      const permis = [...TONS.map((t) => couleurDuTon(t, fond)), couleursSur(fond).texte];
      for (const c of m.matchAll(/(?:stroke|fill)="([^"]+)"/g)) expect([...permis, "none"]).toContain(c[1]);
      expect(m).not.toMatch(/filter|mask|drop-shadow/i);
      expect(m.toUpperCase()).not.toContain("#B8341C");
      if (fond === "ivoire") expect(m).not.toContain(PALETTE.orange);
    }
  });
  it("texte en Manrope et sans `valide` demandé sans preuve", () => {
    expect(rendre(40)).toContain("Axion Manrope");
    expect(rendre(40, { ton: "valide" })).not.toContain(PALETTE.reussite);
  });
});

describe("C9-15 accord avec la garde Studio (C9-04)", () => {
  const def = DEF as unknown as DefinitionObjet<unknown>;
  const mots = "premier point puis deuxième point".split(" ").map((texte, i) => ({ texte, debut: i, fin: i + 0.5 }));
  const ctx = { mots, premier: 0, dernier: mots.length - 1 } as never;
  it("mots dits acceptés, mots inventés refusés, coche sans preuve refusée", () => {
    expect(garderObjet(def, { cartes: ["premier point"] }, ctx)).toBe("ok");
    expect(garderObjet(def, { cartes: ["mot inventé"] }, ctx)).not.toBe("ok");
    expect(garderObjet(def, { cartes: ["premier point"], coche: true }, ctx)).not.toBe("ok");
    expect(garderObjet(def, { cartes: ["premier point"], coche: true, preuve: "x" }, ctx)).toBe("ok");
  });
});

describe("C9-15 garde statique", () => {
  const texte = readFileSync(join(__dirname, "..", "..", "src", "briques", "motion", "petits-objets", "cartes.tsx"), "utf8");
  const interdits = [/@\//, /\bzod\b/, /Math\.random/, /remotion/, /from\s+["'][^"']*moteurs\//, /-v4/, /faits-script/, /from\s+["'][^"']*\/droits/, /bibliotheque-video/, /from\s+["'][^"']*\/domaine\//, /from\s+["'][^"']*\/services\//, /plan-scenes-objets/, /cubic-bezier|Easing\.bezier|damping|stiffness/];
  it("aucun import ni appel interdit", () => {
    for (const re of interdits) expect(texte).not.toMatch(re);
  });
  it("non inscrit : aucun autre fichier de src n'importe cartes", () => {
    expect(readFileSync(join(__dirname, "..", "..", "src", "briques", "motion", "petits-objets", "index.ts"), "utf8")).not.toMatch(/cartes/);
  });
});
