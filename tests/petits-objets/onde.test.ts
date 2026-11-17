/** C9-22 — onde sonore en motif déclaré (jamais une mesure) : pièce pure non inscrite. */
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXEMPLES_ONDE, OBJET_ONDE_MOTIF, type ParametresOnde } from "../../src/briques/motion/petits-objets/onde";
import { verifierDefinition, type TonObjet } from "../../src/briques/motion/petits-objets/contrat";
import { couleurDuTon } from "../../src/briques/motion/petits-objets/tons";
import { couleursSur, type FondAxion } from "../../src/briques/jetons-motion";
import { PALETTE } from "../../src/briques/charte/axion-2026";

const def = OBJET_ONDE_MOTIF;
const P: ParametresOnde = { barres: 24 };
const TONS: TonObjet[] = ["neutre", "accent", "valide", "erreur"];
const FONDS: FondAxion[] = ["ivoire", "noir"];
const D = 60;

function rendre(image: number, o: { graine?: number; ton?: TonObjet; fond?: FondAxion; p?: ParametresOnde } = {}) {
  return renderToStaticMarkup(
    def.Rendu({ image, fps: 25, dureeImages: D, fond: o.fond ?? "ivoire", parametres: o.p ?? P, ton: o.ton ?? "neutre", graine: o.graine ?? 7 }),
  );
}
const decalages = (m: string) => [...m.matchAll(/stroke-dashoffset="([^"]+)"/g)].map((x) => Number(x[1]));
const traces = (m: string) => [...m.matchAll(/ d="([^"]+)"/g)].map((x) => x[1]);

describe("C9-22 contrat", () => {
  it("identifiant propre, famille schema, capacité objet.schema, aucune donnée", () => {
    expect(def.id).toBe("objet-onde-motif");
    expect(verifierDefinition(def)).toBe("ok");
    expect(def.famille).toBe("schema");
    expect(def.capacite).toBe("objet.schema");
    expect(def.donnees).toBe("aucune");
  });
  it("valider ne lève jamais et refuse les mauvaises entrées", () => {
    for (const mauvais of [undefined, null, {}, 42, "un deux trois quatre cinq", { barres: 11 }, { barres: 49 }, { barres: 20.5 }, { barres: "20" }, { barres: NaN }, [1, 2, 3]])
      expect(def.valider(mauvais)).toBeNull();
    expect(def.valider(P)).toEqual(P);
    expect(def.valider({ barres: 12 })).toEqual({ barres: 12 });
    expect(def.valider({ barres: 48 })).toEqual({ barres: 48 });
  });
  it("aucun niveau sonore accepté", () => {
    for (const cle of ["niveaux", "volumes", "audio"]) expect(def.valider({ barres: 24, [cle]: [0.2, 0.5] })).toBeNull();
    expect(def.valider({ barres: 24, niveaux: [1, 2, 3] })).toBeNull();
    expect(def.valider([0.1, 0.5, 0.9])).toBeNull();
  });
  it("exemples valides", () => {
    for (const e of EXEMPLES_ONDE) expect(def.valider(e)).not.toBeNull();
  });
});

describe("C9-22 rendu", () => {
  it("déterministe ; tracé à 0 en image 0 ; opacité 0 à la dernière image ; tenue pleine", () => {
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
  it("une barre par unité demandée", () => {
    expect(decalages(rendre(30, { p: { barres: 12 } })).length).toBe(12);
    expect(decalages(rendre(30, { p: { barres: 48 } })).length).toBe(48);
  });
  it("couleurs de la charte seulement, aucun filter/mask/drop-shadow", () => {
    for (const fond of FONDS) for (const ton of TONS) {
      const m = rendre(30, { fond, ton });
      const permis = [couleurDuTon(ton, fond), couleursSur(fond).texte];
      for (const c of m.matchAll(/stroke="([^"]+)"/g)) expect(permis).toContain(c[1]);
      expect(m).not.toMatch(/filter|mask|drop-shadow/i);
      if (fond === "ivoire" && ton === "accent") expect(m).not.toContain(PALETTE.orange);
    }
  });
});

describe("C9-22 propres à la fiche", () => {
  it("même graine = mêmes hauteurs ; graines différentes = motifs différents", () => {
    expect(traces(rendre(30, { graine: 3 }))).toEqual(traces(rendre(30, { graine: 3 })));
    expect(traces(rendre(30, { graine: 3 }))).not.toEqual(traces(rendre(30, { graine: 4 })));
  });
  it("le sinus anime les hauteurs d'une image à l'autre", () => {
    expect(traces(rendre(20))).not.toEqual(traces(rendre(30)));
  });
  it("aucune balise <text>, aucun chiffre affiché", () => {
    const m = rendre(30);
    expect(m).not.toMatch(/<text|<tspan/);
    expect(m.replace(/<[^>]*>/g, "")).toBe("");
  });
  it("le fichier déclare un motif décoratif, jamais une mesure", () => {
    expect(texte).toMatch(/motif décoratif, jamais une mesure de la voix/);
  });
});

const texte = readFileSync(join(__dirname, "..", "..", "src", "briques", "motion", "petits-objets", "onde.tsx"), "utf8");
describe("C9-22 garde statique du fichier (13 motifs de garde.test.ts:8-22, copiés)", () => {
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
  it("rien n'importe le fichier (non inscrit)", () => {
    const index = readFileSync(join(__dirname, "..", "..", "src", "briques", "motion", "petits-objets", "index.ts"), "utf8");
    expect(index).not.toMatch(/onde/);
  });
});
