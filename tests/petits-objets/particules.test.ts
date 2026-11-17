/** C10-11 — émetteur de particules à graine : confettis, onde de choc, pluie d'icônes (pièce pure non inscrite). */
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EXEMPLES_PARTICULES,
  OBJET_PARTICULES,
  emettre,
  type ParametresParticules,
} from "../../src/briques/motion/petits-objets/particules";
import { verifierDefinition, SURFACE_MAX, type TonObjet } from "../../src/briques/motion/petits-objets/contrat";
import { ZONE_VISAGE_OBJETS, BANDE_SOUS_TITRES, verifierZone } from "../../src/briques/motion/petits-objets/zones";
import { couleurDuTon } from "../../src/briques/motion/petits-objets/tons";
import { couleursSur, type FondAxion } from "../../src/briques/jetons-motion";

const ZONE = { x: 5, y: 70, largeur: 90, hauteur: 28 };
const ZONE_HAUTE = { x: 5, y: 2, largeur: 90, hauteur: 10 };
const D = 40;
const FONDS: FondAxion[] = ["ivoire", "noir"];
const TONS: TonObjet[] = ["neutre", "accent", "valide", "erreur"];
const MODES = ["confettis", "onde", "pluie-icones"] as const;
const P = (mode: (typeof MODES)[number], extra: Partial<ParametresParticules> = {}): ParametresParticules => ({ mode, zone: ZONE_HAUTE, ...extra });

function rendre(p: ParametresParticules, image: number, o: { graine?: number; fond?: FondAxion; ton?: TonObjet } = {}) {
  return renderToStaticMarkup(OBJET_PARTICULES.Rendu({ image, fps: 25, dureeImages: D, fond: o.fond ?? "ivoire", parametres: p, ton: o.ton, graine: o.graine ?? 7 }));
}
const dansZone = (x: number, y: number, z: typeof ZONE) => x >= z.x && x <= z.x + z.largeur && y >= z.y && y <= z.y + z.hauteur;

describe("C10-11 contrat", () => {
  it("définition valide, famille marque, capacité objet.marque, durée 0,6..2,5 s", () => {
    expect(verifierDefinition(OBJET_PARTICULES)).toBe("ok");
    expect(OBJET_PARTICULES.id).toBe("objet-particules");
    expect(OBJET_PARTICULES.famille).toBe("marque");
    expect(OBJET_PARTICULES.capacite).toBe("objet.marque");
    expect(OBJET_PARTICULES.donnees).toBe("aucune");
    expect(OBJET_PARTICULES.dureeSec.min).toBeGreaterThanOrEqual(0.6);
    expect(OBJET_PARTICULES.dureeSec.max).toBeLessThanOrEqual(2.5);
  });
  it("valider refuse les mauvaises entrées sans exception", () => {
    const mauvais: unknown[] = [
      undefined, null, {}, 42, "x",
      { mode: "confettis", zone: ZONE_HAUTE, nombre: 41 },
      { mode: "confettis", zone: ZONE_HAUTE, nombre: 0 },
      { mode: "confettis", zone: ZONE_HAUTE, nombre: 2.5 },
      { mode: "inconnu", zone: ZONE_HAUTE },
      { mode: "confettis", zone: { x: 30, y: 20, largeur: 20, hauteur: 10 } },
      { mode: "confettis", zone: { x: 10, y: 64, largeur: 30, hauteur: 4 } },
      { mode: "confettis", zone: { x: 0, y: 0, largeur: 100, hauteur: 100 } },
      { mode: "confettis", zone: { x: 0, y: 0, largeur: 100, hauteur: 61 } },
      { mode: "confettis", zone: { x: "a", y: 0, largeur: 1, hauteur: 1 } },
      { mode: "pluie-icones", zone: ZONE_HAUTE, icone: "lucide:inconnue-du-tout" },
      { mode: "pluie-icones", zone: ZONE_HAUTE, icone: "lucide:visage" },
      { mode: "pluie-icones", zone: ZONE_HAUTE, icone: 12 },
    ];
    for (const m of mauvais) expect(() => OBJET_PARTICULES.valider(m)).not.toThrow();
    for (const m of mauvais) expect(OBJET_PARTICULES.valider(m)).toBeNull();
  });
  it("valider accepte les exemples et 40 particules", () => {
    for (const e of EXEMPLES_PARTICULES) expect(OBJET_PARTICULES.valider(e)).not.toBeNull();
    expect(OBJET_PARTICULES.valider(P("confettis", { nombre: 40 }))).not.toBeNull();
    expect(EXEMPLES_PARTICULES.map((e) => e.mode).sort()).toEqual([...MODES].sort());
  });
  it("les zones des exemples passent verifierZone", () => {
    for (const e of EXEMPLES_PARTICULES) expect(verifierZone(e.zone)).toBe("ok");
    expect((ZONE.largeur * ZONE.hauteur) / 10000).toBeLessThanOrEqual(SURFACE_MAX);
  });
});

describe("C10-11 emettre", () => {
  it("même graine = mêmes particules ; graines différentes = positions différentes", () => {
    for (const m of MODES) {
      const p = P(m);
      expect(emettre(11, 8, D, p)).toEqual(emettre(11, 8, D, p));
      expect(emettre(11, 8, D, p).length).toBeGreaterThan(0);
    }
    const a = emettre(11, 8, D, P("confettis"));
    const b = emettre(12, 8, D, P("confettis"));
    expect(a.map((q) => [q.x, q.y])).not.toEqual(b.map((q) => [q.x, q.y]));
    const c = emettre(11, 8, D, P("pluie-icones"));
    const d = emettre(12, 8, D, P("pluie-icones"));
    expect(c.map((q) => [q.x, q.y])).not.toEqual(d.map((q) => [q.x, q.y]));
  });
  it("jamais plus de 40, aucune particule hors zone ni sur le visage, sur toutes les images", () => {
    for (const m of MODES) for (const zone of [ZONE, ZONE_HAUTE]) for (const graine of [1, 7, 99]) {
      for (let i = 0; i < D; i++) {
        const l = emettre(graine, i, D, { mode: m, zone, nombre: 40 });
        expect(l.length).toBeLessThanOrEqual(40);
        for (const q of l) {
          expect(dansZone(q.x, q.y, zone)).toBe(true);
          expect(dansZone(q.x, q.y, ZONE_VISAGE_OBJETS)).toBe(false);
          expect(dansZone(q.x, q.y, BANDE_SOUS_TITRES)).toBe(false);
        }
      }
    }
  });
  it("une zone qui contiendrait le visage ne donne aucune particule (jamais sur le visage)", () => {
    const large = { x: 0, y: 0, largeur: 100, hauteur: 60 };
    for (const m of MODES) for (let i = 0; i < D; i++)
      for (const q of emettre(3, i, D, { mode: m, zone: large, nombre: 40 })) expect(dansZone(q.x, q.y, ZONE_VISAGE_OBJETS)).toBe(false);
  });
  it("onde : 1 à 3 cercles ; confettis : tons accent, neutre, valide seulement ; entrées folles sans exception", () => {
    for (let i = 0; i < D; i++) expect(emettre(5, i, D, P("onde")).length).toBeLessThanOrEqual(3);
    const tons = new Set<string>();
    for (let i = 0; i < D; i++) for (const q of emettre(5, i, D, P("confettis", { nombre: 40 }))) tons.add(q.ton);
    expect([...tons].every((t) => ["accent", "neutre", "valide"].includes(t))).toBe(true);
    expect(() => emettre(NaN, -3, 0, null as never)).not.toThrow();
    expect(emettre(NaN, -3, 0, null as never)).toEqual([]);
  });
});

describe("C10-11 rendu", () => {
  it("déterministe, un seul <svg>, dernière image à opacité 0, sortie en 6 images", () => {
    for (const m of MODES) {
      const p = P(m);
      expect(rendre(p, 12)).toBe(rendre(p, 12));
      expect(rendre(p, 12).match(/<svg/g)?.length).toBe(1);
      expect(rendre(p, D - 1)).toMatch(/<g opacity="0"/);
      const sous = Array.from({ length: D }, (_, i) => i).filter((i) => i > 10 && !/<g opacity="1"/.test(rendre(p, i)));
      expect(sous).toEqual([34, 35, 36, 37, 38, 39]);
    }
  });
  it("couleurs ∈ couleurDuTon, aucun filter/mask/drop-shadow/gradient/flou", () => {
    for (const m of MODES) for (const fond of FONDS) for (const ton of TONS) {
      const mk = rendre(P(m), 10, { fond, ton });
      const permis = [...TONS.map((t) => couleurDuTon(t, fond)), couleursSur(fond).texte, "none", "currentColor"];
      for (const c of mk.matchAll(/(?:fill|stroke|color)="([^"]+)"/g)) expect(permis).toContain(c[1]);
      expect(mk).not.toMatch(/filter|mask|drop-shadow|gradient|blur|<text/i);
    }
  });
  it("la pluie d'icônes dessine les nœuds de l'icône en currentColor", () => {
    const mk = rendre(P("pluie-icones", { icone: "lucide:coche" }), 10);
    expect(mk).toContain("currentColor");
    expect(mk).toMatch(/<path/);
  });
});

describe("C10-11 garde statique du fichier (13 motifs de garde.test.ts:8-22, copiés)", () => {
  const texte = readFileSync(join(__dirname, "..", "..", "src", "briques", "motion", "petits-objets", "particules.tsx"), "utf8");
  const MOTIFS: [string, RegExp][] = [
    ["@/", /@\//], ["zod", /\bzod\b/], ["Math.random", /Math\.random/], ["remotion", /remotion/],
    ["moteurs/", /from\s+["'][^"']*moteurs\//], ["-v4", /from\s+["'][^"']*-v4/], ["VideoAnimeeV4", /VideoAnimeeV4/],
    ["briques-v4", /briques-v4/], ["faits-script", /faits-script/], ["droits", /from\s+["'][^"']*\/droits/],
    ["bibliotheque-video", /bibliotheque-video/], ["domaine", /src\/domaine|from\s+["'][^"']*\/domaine\//], ["services", /from\s+["'][^"']*\/services\//],
    ["habillage-commun", /habillage-commun/],
  ];
  it("aucun motif interdit", () => {
    expect(MOTIFS.filter(([, re]) => re.test(texte)).map(([n]) => n)).toEqual([]);
  });
  it("ni filtre, ni masque, ni courbe littérale, ni ressort", () => {
    expect(texte).not.toMatch(/drop-shadow|<mask|<filter|\bfilter\s*[=:]|gradient|cubic-bezier|Easing\.bezier|damping|stiffness|mass\s*:/i);
  });
});
