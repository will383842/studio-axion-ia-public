/**
 * FACE CAMÉRA ANIMÉE — CATALOGUE « v4 » (17/10) : les 26 plaquettes gardées par Will vues par le réalisateur.
 * Chaque entrée correspond à un vrai .tsx (existence, `import React`, composant exporté), à un composant du registre de rendu
 * (`registre-v4.tsx`) et à la fiche studio (`motion-v4/catalogue-v4.ts`) ; la consigne du réalisateur dit la même chose que le catalogue.
 * AUCUN rendu, aucun réseau.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CATALOGUE_V4, COULISSE_V4, DESCENTE_V4, elementsV4Actifs, etatVisagePoseV4, evenementsDeLElementV4, ficheV4, GESTE_VIE_V4, gestesDeVieV4, ySousTitresV4, Y_SOUS_TITRES_MAX_V4, Y_SOUS_TITRES_MIN_V4,
} from "@/moteurs/montage-facecam-animee/realisateur/catalogue-v4";
import { consigneRealisateur } from "@/moteurs/montage-facecam-animee/realisateur/consignes";
import { SONS_V4 } from "@/moteurs/montage-facecam-animee/realisateur/regles-v4";

const RACINE = process.cwd();
const V4 = join(RACINE, "studio-rendu/compositions/interface-claire/motion-v4");
const lire = (chemin: string) => readFileSync(join(RACINE, chemin), "utf8");
const REGISTRE = readFileSync(join(V4, "registre-v4.tsx"), "utf8");
const STUDIO = readFileSync(join(V4, "catalogue-v4.ts"), "utf8");

/** Entrées du catalogue studio : id, composant, actif. */
const entreesStudio = [...STUDIO.matchAll(/\{ id: "([^"]+)", lot: (\d), composant: "([^"]+)".*?actif: (true|false)/g)].map((m) => ({ id: m[1], lot: Number(m[2]), composant: m[3], actif: m[4] === "true" }));

describe("catalogue v4 · les 26 plaquettes actives", () => {
  it("26 actives, ids uniques, 13 en coulisse : le catalogue du réalisateur et celui du studio disent la même chose", () => {
    expect(CATALOGUE_V4).toHaveLength(26);
    expect(elementsV4Actifs()).toHaveLength(26);
    expect(new Set(CATALOGUE_V4.map((f) => f.id)).size).toBe(26);
    expect(COULISSE_V4).toHaveLength(13);
    expect(entreesStudio).toHaveLength(39);
    expect(entreesStudio.filter((e) => e.actif).map((e) => e.id).sort()).toEqual(CATALOGUE_V4.map((f) => f.id).sort());
    expect(entreesStudio.filter((e) => !e.actif).map((e) => e.id).sort()).toEqual(COULISSE_V4.map((f) => f.id).sort());
    for (const f of CATALOGUE_V4) expect(f.actif).toBe(true);
    for (const c of COULISSE_V4) expect(ficheV4(c.id)?.actif).toBe(false);
    expect(ficheV4("n-existe-pas")).toBeUndefined();
  });

  it("chaque id a son composant : fichier .tsx qui commence par `import React`, composant exporté, entrée du registre de rendu", () => {
    for (const f of CATALOGUE_V4) {
      expect(existsSync(join(RACINE, f.fichier)), f.id).toBe(true);
      const src = lire(f.fichier);
      expect(src.startsWith('import React from "react";'), `${f.id} : première ligne`).toBe(true);
      expect(src, f.id).toMatch(new RegExp(`export (?:function|const) ${f.composant}\\b`));
      const cle = f.id.includes("-") ? `"${f.id}"` : f.id;
      expect(REGISTRE, `registre : ${f.id}`).toMatch(new RegExp(`^\\s+${cle}: \\(e, `, "m"));
      expect(REGISTRE, `géométrie : ${f.id}`).toMatch(new RegExp(`^\\s+${cle}: \\{ slot: "${f.slot}"`, "m"));
      const studio = entreesStudio.find((e) => e.id === f.id)!;
      expect(studio.composant, f.id).toBe(f.composant);
      expect(studio.lot, f.id).toBe(f.lot);
    }
    for (const fichier of ["registre-v4.tsx"]) expect(readFileSync(join(V4, fichier), "utf8").startsWith('import React from "react";')).toBe(true);
    expect(lire("studio-rendu/compositions/interface-claire/VideoAnimeeV4.tsx").startsWith('import React')).toBe(true);
  });

  it("la géométrie du registre (descente, sous-titres, couvre) est celle des fiches", () => {
    for (const f of CATALOGUE_V4) {
      const cle = f.id.includes("-") ? `"${f.id}"` : f.id;
      const ligne = REGISTRE.split("\n").find((l) => new RegExp(`^\\s+${cle}: \\{ slot:`).test(l))!;
      const descente = f.descente === 0 ? "D0" : f.descente === 0.06 ? "D1" : "D2";
      expect(ligne, f.id).toContain(`descente: DESCENTE.${descente}`);
      expect(ligne, f.id).toContain(`couvre: ${f.couvreVisage}`);
      // Positions fixes : constantes de la zone sûre dans le registre (Y_ST_MAX / Y_ST_MIN) ; égalité des valeurs dans zone-sure-sous-titres-v4.test.ts.
      const st = typeof f.sousTitres === "string" ? `"${f.sousTitres}"` : f.sousTitres === null ? "null" : Math.abs(f.sousTitres - Y_SOUS_TITRES_MAX_V4) < 1e-9 ? "Y_ST_MAX" : Math.abs(f.sousTitres - Y_SOUS_TITRES_MIN_V4) < 1e-9 ? "Y_ST_MIN" : String(f.sousTitres);
      expect(ligne, f.id).toContain(`sousTitres: ${st}`);
    }
    expect(DESCENTE_V4).toEqual({ D0: 0, D1: 0.06, D2: 0.26, D3: 0.32 });
  });

  it("fiches complètes : durées, gabarit, visage entier ou couvert (jamais à moitié), 3 images de visage partiel au plus", () => {
    for (const f of CATALOGUE_V4) {
      expect(f.dureeSec[0], f.id).toBeGreaterThan(0);
      expect(f.dureeSec[0], f.id).toBeLessThanOrEqual(f.dureeSec[1]);
      expect(f.quand.length, f.id).toBeGreaterThan(20);
      expect(f.contenu.length, f.id).toBeGreaterThan(20);
      expect(Object.isFrozen(f), f.id).toBe(true);
      expect(etatVisagePoseV4(f), f.id).toBe(f.couvreVisage ? "couvert" : "entier");
      expect(f.imagesVisagePartiel, f.id).toBeLessThanOrEqual(3);
      expect(f.coupDePoing, f.id).toBe(f.slot === "plein-cadre");
      expect(f.couvreVisage, f.id).toBe(f.slot === "fenetre" || f.slot === "plein-cadre");
    }
    expect(CATALOGUE_V4.filter((f) => f.slot === "tete")).toHaveLength(8);
    expect(CATALOGUE_V4.filter((f) => f.slot === "carte")).toHaveLength(8);
  });

  it("bruitages : tous des fichiers de sons/ (aucune musique)", () => {
    const dossiers = [join(RACINE, "studio-rendu/compositions/interface-claire/sons"), join(V4, "lot5/sons")];
    const presents = new Set(dossiers.flatMap((d) => readdirSync(d).filter((n) => n.endsWith(".wav")).map((n) => n.replace(/\.wav$/, ""))));
    for (const f of CATALOGUE_V4) for (const s of f.sons) {
      expect(presents.has(s), `${f.id} : ${s}`).toBe(true);
      expect(SONS_V4 as readonly string[], s).toContain(s);
    }
    for (const s of SONS_V4) expect(presents.has(s), s).toBe(true);
  });

  it("zéro turquoise dans le code des plaquettes v4", () => {
    const parcourir = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? parcourir(join(d, e.name)) : /\.(tsx?|mts)$/.test(e.name) ? [join(d, e.name)] : []));
    for (const fichier of parcourir(V4)) expect(readFileSync(fichier, "utf8"), fichier).not.toMatch(/5ce1e6|0a6e74|turquoise|cyan/i);
  });

  it("événements : AUCUNE durée autorisée d'aucune fiche ne crée un calme interne de plus de 22 images (0,75 s) — 18/10, v-8cc4d7703179", () => {
    const fautes: string[] = [];
    for (const f of CATALOGUE_V4.filter((x) => x.actif)) {
      for (let n = Math.round(f.dureeSec[0] * 30); n <= Math.round(f.dureeSec[1] * 30); n++) {
        // Comme `evenementsDuPlanV4` : les événements à moins de 4 images se regroupent en une salve.
        const e: number[] = [];
        for (const x of [...evenementsDeLElementV4(f, n), n]) if (!e.length || x - e[e.length - 1] >= 4) e.push(x);
        for (let k = 1; k < e.length; k++) if (e[k] - e[k - 1] > 22) { fautes.push(`${f.id} ${(n / 30).toFixed(2)} s : ${e[k] - e[k - 1]} images de calme`); break; }
      }
    }
    expect(fautes).toEqual([]);
  });

  it("événements : le geste de vie VISIBLE tient la plaquette en vie (aucun calme de plus de 0,75 s), et le rendu fait le même geste que le catalogue", () => {
    for (const f of CATALOGUE_V4) {
      const n = Math.round(f.dureeSec[0] * 30);
      const e = [...evenementsDeLElementV4(f, n), n];
      for (let k = 1; k < e.length; k++) expect(e[k] - e[k - 1], f.id).toBeLessThanOrEqual(22);
    }
    // Les constantes du catalogue du réalisateur sont celles du registre de rendu (`GesteVisible`) : mêmes images, mêmes gestes.
    const c = (nom: string) => Number(new RegExp(`export const ${nom} = (\\d+);`).exec(REGISTRE)?.[1]);
    expect(GESTE_VIE_V4).toEqual({ debut: c("DEBUT_GESTE_V4"), pas: c("PAS_GESTE_V4"), duree: c("DUREE_GESTE_V4"), margeFin: 5 });
    expect(REGISTRE).toMatch(/DEBUT_GESTE_V4 \+ rang \* PAS_GESTE_V4 \+ DUREE_GESTE_V4 > duree - 5/);
    expect(gestesDeVieV4(60)).toEqual([8, 21, 34, 47]);
    expect(gestesDeVieV4(20)).toEqual([8]);
    expect(gestesDeVieV4(18)).toEqual([]);
  });

  it("le geste de vie est VISIBLE : saut de 12 à 22 px, inclinaison de 1,2 à 2,2°, grossissement de 3 à 6 % (pas une pulsation de quelques %)", () => {
    expect(REGISTRE).toMatch(/tete: \[22, 2\.2, 0\.06\]/);
    expect(REGISTRE).toMatch(/carte: \[14, 1\.5, 0\.035\]/);
    expect(REGISTRE).toMatch(/"plein-cadre": \[0, 0, 0\.04\]/);
  });

  it("sous-titres : jamais sur la bande des yeux, calculés depuis la descente réelle", () => {
    for (const f of CATALOGUE_V4) {
      for (let d = 0; d <= 0.261; d += 0.01) {
        const y = ySousTitresV4(f, Math.min(d, f.descente || (f.sousTitres === "carte" ? 0.26 : 0)));
        if (y === null) continue;
        const dd = Math.min(d, f.descente || (f.sousTitres === "carte" ? 0.26 : 0));
        expect(y - 0.034 < 0.36 + dd && y + 0.034 > 0.27 + dd, `${f.id} d=${dd}`).toBe(false);
      }
    }
  });

  it("consigne du réalisateur : les 26 plaquettes actives y sont, aucune en coulisse, v4 seulement", () => {
    const c = consigneRealisateur([]);
    for (const f of CATALOGUE_V4) expect(c, f.id).toContain(`- ${f.id} — `);
    for (const x of COULISSE_V4) expect(c, x.id).not.toContain(`- ${x.id} — `);
    expect(c).toContain("elementsV4");
    expect(c).toContain("AUCUN turquoise");
    expect(c).toMatch(/2,2 événements/);
    expect(c).toMatch(/0,5 s d'affilée/);
    expect(c).not.toContain("elementsV3 » : les éléments v3");
    expect(c).not.toMatch(/#5CE1E6/i);
  });
});
