/** C9-17 — schéma de flux (3 à 5 carrés reliés, coche finale, colonne en 9:16) : pièce pure non inscrite. */
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXEMPLES_FLUX, OBJET_SCHEMA_FLUX } from "../../src/briques/motion/petits-objets/schema-flux";
import { verifierDefinition, type DefinitionObjet, type TonObjet } from "../../src/briques/motion/petits-objets/contrat";
import { couleurDuTon } from "../../src/briques/motion/petits-objets/tons";
import { couleursSur, type FondAxion } from "../../src/briques/jetons-motion";
import { FAMILLE_CSS, PALETTE } from "../../src/briques/charte/axion-2026";

const def = OBJET_SCHEMA_FLUX as unknown as DefinitionObjet<unknown>;
const TONS: TonObjet[] = ["neutre", "accent", "valide", "erreur"];
const FONDS: FondAxion[] = ["ivoire", "noir"];
const D = 60;
const FICHIER = join(__dirname, "..", "..", "src", "briques", "motion", "petits-objets", "schema-flux.tsx");

function rendre(p: unknown, image: number, o: { graine?: number; ton?: TonObjet; fond?: FondAxion } = {}) {
  return renderToStaticMarkup(def.Rendu({ image, fps: 25, dureeImages: D, fond: o.fond ?? "ivoire", parametres: p, ton: o.ton ?? "neutre", graine: o.graine ?? 7 }));
}
const decalages = (m: string) => [...m.matchAll(/stroke-dashoffset="([^"]+)"/g)].map((x) => Number(x[1]));
const etapes = (n: number) => Array.from({ length: n }, (_, i) => ({ etiquette: `Étape ${i + 1}` }));

describe("C9-17 contrat", () => {
  it("identifiant propre, famille schema, capacité du contrat", () => {
    expect(def.id).toBe("objet-schema-flux");
    expect(verifierDefinition(def)).toBe("ok");
    expect(def.famille).toBe("schema");
    expect(def.donnees).toBe("aucune");
  });
  it("valider ne lève jamais et refuse les mauvaises entrées", () => {
    for (const mauvais of [undefined, null, {}, 42, "un deux trois quatre cinq"]) expect(def.valider(mauvais)).toBeNull();
    for (const e of EXEMPLES_FLUX) expect(def.valider(e)).not.toBeNull();
  });
});

describe("C9-17 rendu", () => {
  it("déterministe, tracé à 0 en image 0, opacité 0 à la dernière image, tenue pleine", () => {
    for (const ex of EXEMPLES_FLUX) {
      const p = def.valider(ex);
      expect(rendre(p, 20)).toBe(rendre(p, 20));
      expect(decalages(rendre(p, 0)).every((x) => x === 1)).toBe(true);
      expect(rendre(p, D - 1)).toMatch(/<g opacity="0">/);
      expect(decalages(rendre(p, 45)).every((x) => x === 0)).toBe(true);
    }
  });
  it("sortie en 6 images exactement", () => {
    const p = def.valider(EXEMPLES_FLUX[0]);
    const sous = Array.from({ length: D }, (_, i) => i).filter((i) => !/^<svg[^>]*><g opacity="1">/.test(rendre(p, i)) && i > 40);
    expect(sous).toEqual([54, 55, 56, 57, 58, 59]);
  });
  it("couleurs de la charte, aucun filter/mask/drop-shadow, Manrope, orange jamais sur ivoire", () => {
    for (const ex of EXEMPLES_FLUX) for (const fond of FONDS) for (const ton of TONS) {
      const m = rendre(def.valider(ex), 45, { fond, ton });
      const permis = [couleurDuTon(ton, fond), couleurDuTon("neutre", fond), couleursSur(fond).texte];
      for (const c of m.matchAll(/(?:stroke|fill)="([^"]+)"/g)) if (c[1] !== "none") expect(permis).toContain(c[1]);
      expect(m).not.toMatch(/filter|mask|drop-shadow/i);
      if (fond === "ivoire") expect(m).not.toContain(PALETTE.orange);
      if (m.includes("<text")) expect(m).toContain(FAMILLE_CSS);
    }
  });
});

describe("C9-17 propres à la fiche", () => {
  it("3 à 5 carrés ; 2 → null, 6 → null", () => {
    expect(def.valider({ etapes: etapes(2) })).toBeNull();
    expect(def.valider({ etapes: etapes(6) })).toBeNull();
    for (const n of [3, 4, 5]) expect(def.valider({ etapes: etapes(n) })).not.toBeNull();
  });
  it("orientation : ligne ou colonne, autre → null", () => {
    expect(def.valider({ etapes: etapes(3), orientation: "colonne" })).not.toBeNull();
    expect(def.valider({ etapes: etapes(3), orientation: "ligne" })).not.toBeNull();
    expect(def.valider({ etapes: etapes(3), orientation: "diagonale" })).toBeNull();
  });
  it("rôle inconnu, étiquette de 5 mots, carré vide → null", () => {
    expect(def.valider({ etapes: [{ role: "inconnu" }, ...etapes(2)] })).toBeNull();
    expect(def.valider({ etapes: [{ role: "__proto__" }, ...etapes(2)] })).toBeNull();
    expect(def.valider({ etapes: [{ etiquette: "un deux trois quatre cinq" }, ...etapes(2)] })).toBeNull();
    expect(def.valider({ etapes: [{}, ...etapes(2)] })).toBeNull();
    expect(def.valider({ etapes: [{ role: "personne" }, { etiquette: "un deux trois quatre" }, { role: "lien", etiquette: "Fin" }] })).not.toBeNull();
  });
  it("boîte > 60 % du cadre → null", () => {
    expect(def.valider({ etapes: etapes(3), zone: { x: 0, y: 0, largeur: 90, hauteur: 80 } })).toBeNull();
    expect(def.valider({ etapes: etapes(3), zone: { x: 10, y: 10, largeur: 70, hauteur: 40 } })).not.toBeNull();
  });
  it("chaque lien et la coche à t = 1 en tenue ; la coche n'est pas tracée avant le dernier carré", () => {
    const p = def.valider({ etapes: etapes(4) });
    const m = rendre(p, 45);
    expect([...m.matchAll(/<g data-lien="\d+"><path [^>]*stroke-dashoffset="([^"]+)"/g)].length).toBe(4);
    expect([...m.matchAll(/<g data-lien="\d+"><path [^>]*stroke-dashoffset="([^"]+)"/g)].every((x) => Number(x[1]) === 0)).toBe(true);
    expect([...m.matchAll(/data-coche="1"/g)].length).toBe(1);
    expect(m).toMatch(/<g data-coche="1"[^>]*><path [^>]*stroke-dashoffset="0"/);
    expect(rendre(p, 4)).toMatch(/<g data-coche="1"[^>]*><path [^>]*stroke-dashoffset="1"/);
  });
  it("colonne : carrés alignés verticalement et dans la toile 1000×600 ; ligne : alignés horizontalement", () => {
    for (const [orientation, axe] of [["colonne", "x"], ["ligne", "y"]] as const) {
      const m = rendre(def.valider({ etapes: etapes(5), orientation }), 45);
      expect(m).toContain('viewBox="0 0 1000 600"');
      const boites = [...m.matchAll(/<g data-carre="(\d+)" data-x="([\d.]+)" data-y="([\d.]+)" data-l="([\d.]+)" data-h="([\d.]+)"/g)].map((x) => ({ x: +x[2]!, y: +x[3]!, l: +x[4]!, h: +x[5]! }));
      expect(boites.length).toBe(5);
      expect(new Set(boites.map((b) => b[axe])).size).toBe(1);
      for (const b of boites) {
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.x + b.l).toBeLessThanOrEqual(1000);
        expect(b.y + b.h).toBeLessThanOrEqual(600);
      }
    }
  });
  it("aucun nom de marque", () => {
    const marques = /linkedin|facebook|instagram|tiktok|youtube|whatsapp|google|openai|chatgpt|claude|twitter|x\.com|meta\b/i;
    for (const ex of EXEMPLES_FLUX) expect(rendre(def.valider(ex), 45)).not.toMatch(marques);
    expect(readFileSync(FICHIER, "utf8")).not.toMatch(/linkedin|facebook|instagram|tiktok|youtube|whatsapp|openai|chatgpt/i);
  });
});

describe("C9-17 garde statique du fichier (13 motifs de garde.test.ts:8-22, copiés)", () => {
  const texte = readFileSync(FICHIER, "utf8");
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
