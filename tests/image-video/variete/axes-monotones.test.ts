/**
 * Variété IV · issue 124 : les axes ne doivent pas se figer sur un code. Mesure sur un grand nombre de graines (sans historique :
 * le tirage brut), et déterminisme. Les cartes A et B (pas de lien, pas de chiffre) n'ont qu'une variante sur plusieurs axes :
 * on ne les mesure que là où une vraie alternative existe (transitions).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AXES_VARIETE, type AxeVariete } from "@/briques/schema-motion/variete";
import type { CarteImage } from "@/domaine/image-video/carte";
import { variantesPossiblesIV } from "@/moteurs/montage-image-video/fabrication";
import { tirerVarieteIV } from "@/moteurs/montage-image-video/variete/tirage";

const carteDe = (nom: string): CarteImage => JSON.parse(readFileSync(join(process.cwd(), "tests/image-video/fixtures/cartes", `${nom}.json`), "utf8"));
const GRAINES = 400;
const AXES_CINQ: AxeVariete[] = ["ouverture", "recit", "chiffres", "camera", "transitions"];

function part(nom: string, axe: AxeVariete) {
  const carte = carteDe(nom);
  const n: Record<string, number> = {};
  for (let i = 0; i < GRAINES; i++) {
    const c = tirerVarieteIV({ graine: `monotone-${nom}-${i}`, carte, format: "9:16" })[axe];
    n[c] = (n[c] ?? 0) + 1;
  }
  return Object.entries(n).map(([code, x]) => ({ code, part: x / GRAINES, nb: Object.keys(n).length }));
}

describe("répartition des codes sur 400 graines", () => {
  for (const nom of ["C", "D", "F"]) {
    for (const axe of ["recit", "chiffres", "camera", "transitions"] as const) {
      it(`carte ${nom} · ${axe} : aucun code au-delà de 45 %`, () => {
        // 3 codes au moins : à 400 graines l'écart-type d'une part de 1/3 est ≈ 2,4 points, 45 % laisse > 4 écarts-types de marge (déterministe de toute façon).
        const p = part(nom, axe);
        expect(p.length, `${nom} ${axe} : nombre de codes tirés`).toBeGreaterThanOrEqual(3);
        for (const x of p) expect(x.part, `${nom} ${axe} ${x.code}`).toBeLessThanOrEqual(0.45);
      });
    }
  }
  it("carte D · transitions : la référence TRA-A est tirée, TRA-D n'a plus 60 %", () => {
    const p = part("D", "transitions");
    expect(p.map((x) => x.code).sort()).toEqual(["TRA-A", "TRA-C", "TRA-D"]);
    expect(Math.max(...p.map((x) => x.part)), "D transitions").toBeLessThan(0.4);
  });
  it("carte E · récit, chiffres, caméra ne sont plus figés (au plus 65 % d'un code)", () => {
    for (const axe of ["recit", "chiffres", "camera"] as const) {
      const p = part("E", axe);
      expect(p.length, axe).toBeGreaterThanOrEqual(2);
      expect(Math.max(...p.map((x) => x.part)), axe).toBeLessThanOrEqual(0.65);
    }
  });
  it("cartes A et B · transitions : deux codes, aucun au-delà de 65 %", () => {
    for (const nom of ["A", "B"]) {
      const p = part(nom, "transitions");
      expect(p.length, `${nom} transitions : nombre de codes`).toBe(2);
      expect(Math.max(...p.map((x) => x.part)), `${nom} transitions`).toBeLessThanOrEqual(0.65);
    }
  });
});

describe("cartes A et B (issue 124 reste ouverte)", () => {
  // OUV-C exige une heure ou un objet du quotidien dans l'image, CAM-E un embranchement à deux branches : A et B n'ont ni l'un ni l'autre,
  // et on n'invente pas ce que l'image ne contient pas. Seules les transitions y gagnent : on borne donc les paires qui ont les mêmes transitions.
  it("deux vidéos A ou B ont les mêmes transitions dans au plus 55 % des paires", () => {
    for (const nom of ["A", "B"]) {
      const carte = carteDe(nom);
      const t = Array.from({ length: 200 }, (_, i) => tirerVarieteIV({ graine: `ab-${nom}-${i}`, carte, format: "9:16" }).transitions);
      let paires = 0;
      let egales = 0;
      for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) { paires++; if (t[i] === t[j]) egales++; }
      expect(egales / paires, `${nom} transitions`).toBeLessThanOrEqual(0.55);
    }
  });
});

describe("le code tiré est toujours proposé à l'utilisateur", () => {
  it("6 cartes × 60 graines : chaque code tiré figure dans variantesPossiblesIV (écran et retour au code tiré)", () => {
    for (const nom of ["A", "B", "C", "D", "E", "F"]) {
      const carte = carteDe(nom);
      const proposes = variantesPossiblesIV(carte);
      for (let i = 0; i < 60; i++) {
        const r = tirerVarieteIV({ graine: `ecran-${nom}-${i}`, carte, format: "9:16" });
        for (const axe of AXES_VARIETE) if (proposes[axe].length) expect(proposes[axe], `${nom} ${axe} ${r[axe]}`).toContain(r[axe]);
      }
    }
  });
});

describe("sujets différents", () => {
  it("deux graines sur la même carte ont rarement les cinq mêmes axes (moins de 10 %)", () => {
    for (const nom of ["C", "D", "E", "F"]) {
      const carte = carteDe(nom);
      const cles = Array.from({ length: 200 }, (_, i) => {
        const r = tirerVarieteIV({ graine: `sujet-${nom}-${i}`, carte, format: "9:16" });
        return AXES_CINQ.map((a) => r[a]).join("/");
      });
      let paires = 0;
      let egales = 0;
      for (let i = 0; i < cles.length; i++) for (let j = i + 1; j < cles.length; j++) { paires++; if (cles[i] === cles[j]) egales++; }
      expect(egales / paires, nom).toBeLessThan(0.1);
    }
  });
});

const FIGEE = {
  apparition: "APP-B", camera: "CAM-C", chiffres: "CHI-B", entete: "ENT-B", fin: "FIN-C", fond: "FON-A", matiere: "MAT-B",
  objets: "OBJ-B", ouverture: "OUV-B", rail: "RAI-B", recit: "REC-A", sousTitres: "SOU-E", texte: "TYP-C", transitions: "TRA-D",
};

describe("déterminisme", () => {
  it("avec un historique de 10 recettes variées (repli k > 0) : deux appels égaux et une valeur figée", () => {
    const carte = carteDe("C");
    const historique = Array.from({ length: 10 }, (_, i) => tirerVarieteIV({ graine: `hist-${i}`, carte, format: "9:16" }));
    const o = { graine: "repli-1", carte, format: "9:16" as const, historique };
    const a = tirerVarieteIV(o);
    expect(tirerVarieteIV(o)).toEqual(a);
    expect(a, "le repli diffère du premier tirage : k > 0 est bien atteint").not.toEqual(tirerVarieteIV({ ...o, historique: [] }));
    expect(a).toEqual(FIGEE);
  });
  it("même graine, même carte, même format → même recette, avec ou sans historique", () => {
    for (const nom of ["A", "C", "E"]) {
      const carte = carteDe(nom);
      for (let i = 0; i < 20; i++) {
        const o = { graine: `det-${i}`, carte, format: "9:16" as const };
        const a = tirerVarieteIV(o);
        expect(tirerVarieteIV(o)).toEqual(a);
        expect(tirerVarieteIV({ ...o, historique: [a] })).toEqual(tirerVarieteIV({ ...o, historique: [a] }));
      }
    }
  });
});
