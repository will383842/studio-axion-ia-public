/** N-08b — compteur à rouleau : les chiffres défilent puis se posent sur la valeur dite. Pièce pure non inscrite. */
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXEMPLES_ROULEAU, OBJET_COMPTEUR_ROULEAU, type ParametresRouleau } from "../../src/briques/motion/petits-objets/compteur-rouleau";
import { ecrireNombreFr } from "../../src/briques/motion/petits-objets/gros-chiffre";
import { verifierDefinition, type DefinitionObjet, type TonObjet } from "../../src/briques/motion/petits-objets/contrat";
import { IMAGES_ENTREE } from "../../src/briques/motion/petits-objets/progres";
import { couleurDuTon } from "../../src/briques/motion/petits-objets/tons";
import { couleursSur, type FondAxion } from "../../src/briques/jetons-motion";

const DEF = OBJET_COMPTEUR_ROULEAU as unknown as DefinitionObjet<ParametresRouleau>;
const D = 60;
const TONS: TonObjet[] = ["neutre", "accent", "valide", "erreur"];
const FONDS: FondAxion[] = ["ivoire", "noir"];

function rendre(image: number, p: ParametresRouleau, o: { ton?: TonObjet; fond?: FondAxion } = {}) {
  return renderToStaticMarkup(DEF.Rendu({ image, fps: 25, dureeImages: D, fond: o.fond ?? "ivoire", parametres: p, ton: o.ton ?? "neutre", graine: 7 }));
}
const decalages = (m: string) => [...m.matchAll(/data-role="colonne" data-cible="(\d)" data-decalage="([^"]+)"/g)].map((x) => ({ cible: Number(x[1]), decalage: Number(x[2]) }));
const lisible = (m: string) => /aria-label="([^"]*)"/.exec(m)?.[1];

const VALEURS: ParametresRouleau[] = [
  { valeur: 0 }, { valeur: 7 }, { valeur: 20 }, { valeur: 999 }, { valeur: 1000 }, { valeur: 49505 }, { valeur: 1234567 },
  { valeur: 0, decimales: 1 }, { valeur: 3.5, decimales: 1 }, { valeur: 12.5, decimales: 1 }, { valeur: 99.9, decimales: 1 }, { valeur: 1250.5, decimales: 1 },
  { valeur: 0.05, decimales: 2 }, { valeur: 3.14, decimales: 2 }, { valeur: 12.25, decimales: 2 }, { valeur: 100, decimales: 2 }, { valeur: 4.2, decimales: 2 },
  { valeur: 98, prefixe: "+", suffixe: "%" }, { valeur: 25, suffixe: "min" }, { valeur: 1500, prefixe: "€", suffixe: "HT" },
];

describe("N-08b contrat", () => {
  it("identifiant propre, famille chiffre, capacité objet.chiffre, nombres dits", () => {
    expect(verifierDefinition(DEF)).toBe("ok");
    expect(DEF.id).toBe("objet-compteur-rouleau");
    expect(DEF.famille).toBe("chiffre");
    expect(DEF.capacite).toBe("objet.chiffre");
    expect(DEF.donnees).toBe("nombres-dits");
  });
  it("valider ne lève jamais ; négatif, NaN, infini, préfixe de 3 caractères → null", () => {
    for (const mauvais of [undefined, null, {}, 42, { valeur: "12" }, { valeur: NaN }, { valeur: Infinity }, { valeur: -Infinity }, { valeur: -3 },
      { valeur: 5, prefixe: "abc" }, { valeur: 5, suffixe: "abcde" }, { valeur: 5, prefixe: 4 }, { valeur: 5, decimales: 3 }, { valeur: 5, decimales: 1.5 },
      { valeur: 1.234 }, { valeur: 5, suffixe: "3x" }]) {
      expect(() => DEF.valider(mauvais)).not.toThrow();
      expect(DEF.valider(mauvais)).toBeNull();
    }
    expect(DEF.valider({ valeur: 12 })).toEqual({ valeur: 12 });
    // valeurs exactes à l'écriture mais pas au produit flottant (1234567.89 * 100 = 123456789.00000001)
    expect(DEF.valider({ valeur: 1234567.89, decimales: 2 })).toEqual({ valeur: 1234567.89, decimales: 2 });
    expect(DEF.valider({ valeur: 8888888.88, decimales: 2 })).toEqual({ valeur: 8888888.88, decimales: 2 });
    expect(DEF.valider({ valeur: 12, prefixe: "+", suffixe: "min", decimales: 0 })).toEqual({ valeur: 12, prefixe: "+", suffixe: "min", decimales: 0 });
  });
  it("exemples valides", () => {
    expect(EXEMPLES_ROULEAU.length).toBeGreaterThan(0);
    for (const e of EXEMPLES_ROULEAU) expect(DEF.valider(e)).not.toBeNull();
  });
});

describe("N-08b rendu", () => {
  it("à l'arrêt : le texte lisible = valeur fournie formatée (20 valeurs)", () => {
    expect(VALEURS.length).toBe(20);
    for (const p of VALEURS) {
      const attendu = `${p.prefixe ?? ""}${ecrireNombreFr(p.valeur, p.decimales ?? 0)}${p.suffixe ?? ""}`;
      const m = rendre(IMAGES_ENTREE + 5, p);
      expect(lisible(m)).toBe(attendu);
      const chiffres = decalages(m).map((c) => c.cible).join("");
      expect(chiffres).toBe(attendu.replace(/\D/g, ""));
    }
  });
  it("à l'arrêt, chaque colonne est posée exactement sur son chiffre (décalage = tours×10+chiffre)", () => {
    const m = rendre(IMAGES_ENTREE + 5, { valeur: 49505 });
    for (const c of decalages(m)) expect(c.decalage % 10).toBe(c.cible);
  });
  it("position de chaque colonne monotone jusqu'à l'arrêt, arrêt complet à la fin de l'entrée", () => {
    const p: ParametresRouleau = { valeur: 98765 };
    let avant = decalages(rendre(0, p));
    expect(avant.every((c) => c.decalage === 0)).toBe(true);
    for (let i = 1; i <= IMAGES_ENTREE + 3; i++) {
      const maintenant = decalages(rendre(i, p));
      maintenant.forEach((c, k) => expect(c.decalage).toBeGreaterThanOrEqual(avant[k]!.decalage));
      avant = maintenant;
    }
    const fin = decalages(rendre(IMAGES_ENTREE, p));
    expect(fin).toEqual(decalages(rendre(IMAGES_ENTREE + 20, p)));
    expect(decalages(rendre(IMAGES_ENTREE - 2, p)).some((c, k) => c.decalage < fin[k]!.decalage)).toBe(true);
  });
  it("les colonnes de droite tournent plus vite (course totale croissante vers la droite)", () => {
    const fin = decalages(rendre(IMAGES_ENTREE + 5, { valeur: 55555 }));
    for (let k = 1; k < fin.length; k++) expect(fin[k]!.decalage).toBeGreaterThanOrEqual(fin[k - 1]!.decalage);
    expect(fin[fin.length - 1]!.decalage).toBeGreaterThan(fin[0]!.decalage);
  });
  it("deux compteurs différents dans la même page n'ont aucun id de clipPath en commun", () => {
    const ids = (m: string) => [...m.matchAll(/<clipPath id="([^"]+)"/g)].map((x) => x[1]!);
    const a = ids(rendre(30, { valeur: 1234 }));
    const b = ids(rendre(30, { valeur: 98, prefixe: "+", suffixe: "%" }));
    expect(a.length).toBeGreaterThan(0);
    expect(new Set(a).size).toBe(a.length);
    for (const i of a) expect(b).not.toContain(i);
    for (const m of [rendre(30, { valeur: 1234 })]) for (const i of ids(m)) expect(m).toContain(`url(#${i})`);
  });
  it("aucun chiffre hors 0-9 dans les colonnes", () => {
    const m = rendre(8, { valeur: 1234567.89, decimales: 2 });
    const contenus = [...m.matchAll(/data-role="roue"[^>]*>([^<]*)</g)].map((x) => x[1]!);
    expect(contenus.length).toBeGreaterThan(0);
    for (const c of contenus) expect(c).toMatch(/^[0-9]$/);
  });
  it("déterministe ; dernière image → opacité 0 ; tenue pleine", () => {
    const p = { valeur: 4242 };
    expect(rendre(20, p)).toBe(rendre(20, p));
    expect(rendre(D - 1, p)).toMatch(/opacity="0"/);
    expect(rendre(30, p)).toMatch(/opacity="1"/);
  });
  it("couleurs de la charte seulement, aucun filter/mask/drop-shadow, Manrope", () => {
    for (const fond of FONDS) for (const ton of TONS) {
      const m = rendre(30, { valeur: 4242, suffixe: "min" }, { fond, ton });
      const permis = [couleurDuTon(ton, fond), couleursSur(fond).texte];
      for (const c of m.matchAll(/(?:stroke|fill)="([^"]+)"/g)) expect([...permis, "none"]).toContain(c[1]);
      expect(m).not.toMatch(/filter|mask|drop-shadow/i);
      expect(m).toContain("Axion Manrope");
      expect(m).toContain("tabular-nums");
    }
  });
});

describe("N-08b garde statique du fichier (13 motifs de garde.test.ts, copiés)", () => {
  const texte = readFileSync(join(__dirname, "..", "..", "src", "briques", "motion", "petits-objets", "compteur-rouleau.tsx"), "utf8");
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
