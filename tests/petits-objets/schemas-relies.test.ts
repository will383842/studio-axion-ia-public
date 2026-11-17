/** C9-16 — schéma en étoile, icônes reliées, rangée d'agents et globe : pièces pures non inscrites. */
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXEMPLES_SCHEMAS, OBJET_AGENTS_GLOBE, OBJET_ICONES_RELIEES, OBJET_SCHEMA_ETOILE } from "../../src/briques/motion/petits-objets/schemas-relies";
import { verifierDefinition, type DefinitionObjet, type TonObjet } from "../../src/briques/motion/petits-objets/contrat";
import { couleurDuTon } from "../../src/briques/motion/petits-objets/tons";
import { couleursSur, type FondAxion } from "../../src/briques/jetons-motion";
import { FAMILLE_CSS, PALETTE } from "../../src/briques/charte/axion-2026";

type Def = DefinitionObjet<unknown>;
const OBJETS: { def: Def; ok: unknown }[] = [
  { def: OBJET_SCHEMA_ETOILE as unknown as Def, ok: EXEMPLES_SCHEMAS.etoile[0] },
  { def: OBJET_ICONES_RELIEES as unknown as Def, ok: EXEMPLES_SCHEMAS.icones[0] },
  { def: OBJET_AGENTS_GLOBE as unknown as Def, ok: EXEMPLES_SCHEMAS.agents[0] },
];
const TONS: TonObjet[] = ["neutre", "accent", "valide", "erreur"];
const FONDS: FondAxion[] = ["ivoire", "noir"];
const D = 60;

function rendre(def: Def, p: unknown, image: number, o: { graine?: number; ton?: TonObjet; fond?: FondAxion } = {}) {
  return renderToStaticMarkup(def.Rendu({ image, fps: 25, dureeImages: D, fond: o.fond ?? "ivoire", parametres: p, ton: o.ton ?? "neutre", graine: o.graine ?? 7 }));
}
const decalages = (m: string) => [...m.matchAll(/stroke-dashoffset="([^"]+)"/g)].map((x) => Number(x[1]));
const el = (n: number, role = "personne") => Array.from({ length: n }, () => ({ role }));

describe("C9-16 contrat", () => {
  it("identifiants propres, famille schema, capacités du contrat, données aucune", () => {
    expect(OBJETS.map((o) => o.def.id)).toEqual(["objet-schema-etoile", "objet-icones-reliees", "objet-agents-globe"]);
    for (const { def } of OBJETS) {
      expect(verifierDefinition(def)).toBe("ok");
      expect(def.famille).toBe("schema");
      expect(def.donnees).toBe("aucune");
    }
  });
  it("valider ne lève jamais et refuse les mauvaises entrées", () => {
    for (const { def, ok } of OBJETS) {
      for (const mauvais of [undefined, null, {}, 42, "un deux trois quatre cinq"]) expect(def.valider(mauvais)).toBeNull();
      expect(def.valider(ok)).not.toBeNull();
    }
  });
  it("exemples valides", () => {
    for (const e of EXEMPLES_SCHEMAS.etoile) expect(OBJET_SCHEMA_ETOILE.valider(e)).not.toBeNull();
    for (const e of EXEMPLES_SCHEMAS.icones) expect(OBJET_ICONES_RELIEES.valider(e)).not.toBeNull();
    for (const e of EXEMPLES_SCHEMAS.agents) expect(OBJET_AGENTS_GLOBE.valider(e)).not.toBeNull();
  });
});

describe("C9-16 rendu", () => {
  it("déterministe, tracé à 0 en image 0, opacité 0 à la dernière image, tenue pleine", () => {
    for (const { def, ok } of OBJETS) {
      const p = def.valider(ok);
      expect(rendre(def, p, 20)).toBe(rendre(def, p, 20));
      expect(decalages(rendre(def, p, 0)).every((x) => x === 1)).toBe(true);
      expect(rendre(def, p, D - 1)).toMatch(/<g opacity="0">/);
      expect(decalages(rendre(def, p, 45)).length).toBeGreaterThan(0);
      expect(decalages(rendre(def, p, 45)).every((x) => x === 0)).toBe(true);
    }
  });
  it("sortie en 6 images exactement", () => {
    for (const { def, ok } of OBJETS) {
      const p = def.valider(ok);
      const sous = Array.from({ length: D }, (_, i) => i).filter((i) => !/^<svg[^>]*><g opacity="1">/.test(rendre(def, p, i)) && i > 40);
      expect(sous).toEqual([54, 55, 56, 57, 58, 59]);
    }
  });
  it("couleurs de la charte seulement, aucun filter/mask/drop-shadow, Manrope, orange jamais sur ivoire", () => {
    for (const { def, ok } of OBJETS) for (const fond of FONDS) for (const ton of TONS) {
      const m = rendre(def, def.valider(ok), 45, { fond, ton });
      const permis = [couleurDuTon(ton, fond), couleurDuTon("neutre", fond), couleursSur(fond).texte];
      for (const c of m.matchAll(/(?:stroke|fill)="([^"]+)"/g)) if (c[1] !== "none") expect(permis).toContain(c[1]);
      expect(m).not.toMatch(/filter|mask|drop-shadow/i);
      if (fond === "ivoire") expect(m).not.toContain(PALETTE.orange);
      if (m.includes("<text")) expect(m).toContain(FAMILLE_CSS);
    }
  });
});

describe("C9-16 propres à la fiche", () => {
  it("étoile : 3 à 6 satellites ; 7 → null, 2 → null", () => {
    const centre = { role: "personne" };
    expect(OBJET_SCHEMA_ETOILE.valider({ centre, satellites: el(7) })).toBeNull();
    expect(OBJET_SCHEMA_ETOILE.valider({ centre, satellites: el(2) })).toBeNull();
    for (const n of [3, 4, 5, 6]) expect(OBJET_SCHEMA_ETOILE.valider({ centre, satellites: el(n) })).not.toBeNull();
  });
  it("icônes reliées : 1 → null, 6 → null, 2 à 5 valides", () => {
    expect(OBJET_ICONES_RELIEES.valider({ icones: el(1) })).toBeNull();
    expect(OBJET_ICONES_RELIEES.valider({ icones: el(6) })).toBeNull();
    for (const n of [2, 3, 4, 5]) expect(OBJET_ICONES_RELIEES.valider({ icones: el(n) })).not.toBeNull();
  });
  it("agents : 1 → null, 6 → null, 2 à 5 valides", () => {
    expect(OBJET_AGENTS_GLOBE.valider({ agents: el(1) })).toBeNull();
    expect(OBJET_AGENTS_GLOBE.valider({ agents: el(6) })).toBeNull();
    for (const n of [2, 3, 4, 5]) expect(OBJET_AGENTS_GLOBE.valider({ agents: el(n) })).not.toBeNull();
  });
  it("rôle inconnu ou icône absente (globe) → null", () => {
    expect(OBJET_ICONES_RELIEES.valider({ icones: [{ role: "personne" }, { role: "inconnu" }] })).toBeNull();
    expect(OBJET_ICONES_RELIEES.valider({ icones: [{ role: "personne" }, { role: "globe" }] })).toBeNull();
    expect(OBJET_ICONES_RELIEES.valider({ icones: [{ role: "personne" }, { role: "__proto__" }] })).toBeNull();
  });
  it("étiquette : ≤ 4 mots, 5 mots → null, facultative", () => {
    expect(OBJET_ICONES_RELIEES.valider({ icones: [{ role: "personne", etiquette: "un deux trois quatre" }, { role: "lien" }] })).not.toBeNull();
    expect(OBJET_ICONES_RELIEES.valider({ icones: [{ role: "personne", etiquette: "un deux trois quatre cinq" }, { role: "lien" }] })).toBeNull();
    expect(OBJET_ICONES_RELIEES.valider({ icones: [{ role: "personne", etiquette: "" }, { role: "lien" }] })).toBeNull();
    expect(OBJET_AGENTS_GLOBE.valider({ agents: el(2), etiquetteGlobe: "un deux trois quatre cinq" })).toBeNull();
  });
  it("boîte > 60 % du cadre → null ; boîte ≤ 60 % acceptée", () => {
    const base = { icones: el(3) };
    expect(OBJET_ICONES_RELIEES.valider({ ...base, zone: { x: 0, y: 0, largeur: 90, hauteur: 80 } })).toBeNull();
    expect(OBJET_ICONES_RELIEES.valider({ ...base, zone: { x: 10, y: 10, largeur: 70, hauteur: 40 } })).not.toBeNull();
    expect(OBJET_ICONES_RELIEES.valider({ ...base, zone: { x: 50, y: 50, largeur: 60, hauteur: 10 } })).toBeNull();
    expect(OBJET_ICONES_RELIEES.valider({ ...base, zone: "x" })).toBeNull();
  });
  it("chaque lien à t = 1 en tenue ; le lien de rang k reste à 0 avant son tour", () => {
    for (const { def, ok } of OBJETS) {
      const p = def.valider(ok);
      const liens = [...rendre(def, p, 45).matchAll(/<g data-lien="\d+"><path [^>]*stroke-dashoffset="([^"]+)"/g)];
      expect(liens.length).toBeGreaterThan(0);
      expect(liens.every((x) => Number(x[1]) === 0)).toBe(true);
    }
    const p = OBJET_ICONES_RELIEES.valider(EXEMPLES_SCHEMAS.icones[1]);
    const tot = (i: number) => [...rendre(OBJET_ICONES_RELIEES, p, i).matchAll(/<g data-lien="(\d+)"><path [^>]*stroke-dashoffset="([^"]+)"/g)].map((x) => Number(x[2]));
    expect(tot(4)[0]).toBeLessThan(1);
    expect(tot(4)[3]).toBe(1);
  });
  it("étoile : un lien par satellite, tout dans la toile 1000×600, donc dans la zone en 9:16", () => {
    const p = OBJET_SCHEMA_ETOILE.valider(EXEMPLES_SCHEMAS.etoile[1]);
    const m = rendre(OBJET_SCHEMA_ETOILE, p, 45);
    expect([...m.matchAll(/data-lien=/g)].length).toBe(6);
    expect(m).toContain('viewBox="0 0 1000 600"');
    expect(m).not.toContain("preserveAspectRatio=\"none\"");
    for (const c of m.matchAll(/<path d="M ([\d.]+) ([\d.]+) A ([\d.]+) /g)) {
      const [x, y, r] = [Number(c[1]) + Number(c[3]), Number(c[2]), Number(c[3])];
      expect(x - r).toBeGreaterThanOrEqual(0);
      expect(x + r).toBeLessThanOrEqual(1000);
      expect(y - r).toBeGreaterThanOrEqual(0);
      expect(y + r).toBeLessThanOrEqual(600);
    }
  });
  it("agents : un globe et un lien par agent", () => {
    const m = rendre(OBJET_AGENTS_GLOBE, OBJET_AGENTS_GLOBE.valider(EXEMPLES_SCHEMAS.agents[1]), 45);
    expect([...m.matchAll(/data-globe=/g)].length).toBe(1);
    expect([...m.matchAll(/data-lien=/g)].length).toBe(5);
  });
  it("aucun nom de marque", () => {
    const marques = /linkedin|facebook|instagram|tiktok|youtube|whatsapp|google|openai|chatgpt|claude|twitter|x\.com|meta\b/i;
    for (const { def, ok } of OBJETS) expect(rendre(def, def.valider(ok), 45)).not.toMatch(marques);
    expect(readFileSync(join(__dirname, "..", "..", "src", "briques", "motion", "petits-objets", "schemas-relies.tsx"), "utf8").replace(/Claude Code/g, "")).not.toMatch(/linkedin|facebook|instagram|tiktok|youtube|whatsapp|openai|chatgpt/i);
  });
});

describe("C9-16 garde statique du fichier (13 motifs de garde.test.ts:8-22, copiés)", () => {
  const texte = readFileSync(join(__dirname, "..", "..", "src", "briques", "motion", "petits-objets", "schemas-relies.tsx"), "utf8");
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
