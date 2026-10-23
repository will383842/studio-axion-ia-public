/**
 * L9b · Les 12 micro-objets (K11) : banque fermée, proposition déterministe sur les bénéfices des images A et B, un
 * dessin par nom (React en tête de fichier, aucun JSX de niveau module : le chargement « comme la prod » est vérifié par
 * `react-module.test.ts`, qui parcourt aussi `micro-objets/`), micro-animation qui bouge puis se pose, rendu
 * identique d'un appel à l'autre.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CarteImage } from "@/domaine/image-video/carte";
import { avanceMicroObjet, DUREE_MAX_MICRO_OBJET_S, estMicroObjet, MICRO_OBJETS, microObjet, NOMS_MICRO_OBJETS, proposerMicroObjet, type NomMicroObjet } from "@/briques/schema-motion/micro-objets";
import type { ProprietesMicroObjet } from "../../studio-rendu/compositions/image-video/micro-objets/commun";
import { BoutonDecider } from "../../studio-rendu/compositions/image-video/micro-objets/BoutonDecider";
import { Calendrier } from "../../studio-rendu/compositions/image-video/micro-objets/Calendrier";
import { Cible } from "../../studio-rendu/compositions/image-video/micro-objets/Cible";
import { Course } from "../../studio-rendu/compositions/image-video/micro-objets/Course";
import { Engrenages } from "../../studio-rendu/compositions/image-video/micro-objets/Engrenages";
import { Escalier } from "../../studio-rendu/compositions/image-video/micro-objets/Escalier";
import { GrapheMonte } from "../../studio-rendu/compositions/image-video/micro-objets/GrapheMonte";
import { HorlogeEnvers } from "../../studio-rendu/compositions/image-video/micro-objets/HorlogeEnvers";
import { Jauge } from "../../studio-rendu/compositions/image-video/micro-objets/Jauge";
import { PostIt } from "../../studio-rendu/compositions/image-video/micro-objets/PostIt";
import { TachesCochees } from "../../studio-rendu/compositions/image-video/micro-objets/TachesCochees";
import { Tirelire } from "../../studio-rendu/compositions/image-video/micro-objets/Tirelire";

const RACINE = process.cwd();
const DOSSIER = join(RACINE, "studio-rendu/compositions/image-video");
const carte = (k: string): CarteImage => JSON.parse(readFileSync(join(RACINE, `tests/image-video/fixtures/cartes/${k}.json`), "utf8"));

/** Même table que l'aiguillage de `MicroObjet.tsx` (qui charge les polices : non importable ici). */
const DESSINS: Record<NomMicroObjet, (p: ProprietesMicroObjet) => unknown> = {
  "horloge-envers": HorlogeEnvers,
  "taches-cochees": TachesCochees,
  "post-it": PostIt,
  jauge: Jauge,
  tirelire: Tirelire,
  cible: Cible,
  "graphe-monte": GrapheMonte,
  "bouton-decider": BoutonDecider,
  course: Course,
  escalier: Escalier,
  calendrier: Calendrier,
  engrenages: Engrenages,
};

const rendre = (nom: NomMicroObjet, t: number, fond: "ivoire" | "sombre" = "ivoire") =>
  renderToStaticMarkup(createElement(DESSINS[nom] as (p: ProprietesMicroObjet) => React.ReactElement, { t, taille: 200, fond }));

describe("banque fermée des 12 micro-objets", () => {
  it("12 noms uniques, dans l'ordre de la banque, titres uniques, durées dans le plafond", () => {
    expect(NOMS_MICRO_OBJETS).toHaveLength(12);
    expect(new Set(NOMS_MICRO_OBJETS).size).toBe(12);
    expect(MICRO_OBJETS.map((m) => m.nom)).toEqual([...NOMS_MICRO_OBJETS]);
    expect(new Set(MICRO_OBJETS.map((m) => m.titre)).size).toBe(12);
    for (const m of MICRO_OBJETS) {
      expect(m.dureeS).toBeGreaterThan(0);
      expect(m.dureeS).toBeLessThanOrEqual(DUREE_MAX_MICRO_OBJET_S);
      expect(m.motsCles.length).toBeGreaterThan(0);
      for (const mot of m.motsCles) expect(mot).toBe(mot.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase());
    }
  });
  it("contient ceux que nomme le plan (horloge à l'envers, jauge, cible, post-it, escalier)", () => {
    for (const n of ["horloge-envers", "jauge", "cible", "post-it", "escalier"]) expect(estMicroObjet(n)).toBe(true);
  });
  it("un nom hors banque est refusé, jamais de dessin par défaut", () => {
    expect(estMicroObjet("rond")).toBe(false);
    expect(() => microObjet("rond")).toThrow(/banque est fermée/);
  });
  it("avancement borné 0 → 1", () => {
    expect(avanceMicroObjet("jauge", -1)).toBe(0);
    expect(avanceMicroObjet("jauge", 0.75)).toBeCloseTo(0.5);
    expect(avanceMicroObjet("jauge", 9)).toBe(1);
  });
});

describe("proposition déterministe sur les bénéfices des images A et B", () => {
  const proposer = (k: string) => {
    const pris: NomMicroObjet[] = [];
    for (const n of carte(k).noeuds.filter((x) => x.role === "benefice").sort((a, b) => a.ordre - b.ordre)) {
      const m = proposerMicroObjet(`${n.libelle} ${n.detail ?? ""}`, pris);
      expect(m, n.libelle).not.toBeNull();
      pris.push(m!);
    }
    return pris;
  };
  it("A : horloge, post-it, jauge, tirelire, cible", () => {
    expect(proposer("A")).toEqual(["horloge-envers", "post-it", "jauge", "tirelire", "cible"]);
  });
  it("B : horloge, bouton « décider », course, escalier, courbe", () => {
    expect(proposer("B")).toEqual(["horloge-envers", "bouton-decider", "course", "escalier", "graphe-monte"]);
  });
  it("même résultat à chaque appel ; rien de trouvé → null ; un nom exclu n'est pas reproposé", () => {
    const premier = proposerMicroObjet("Gagnez du temps");
    for (let i = 0; i < 20; i++) expect(proposerMicroObjet("Gagnez du temps")).toBe(premier);
    expect(proposerMicroObjet("Bonjour")).toBeNull();
    expect(proposerMicroObjet("Gagnez du temps", ["horloge-envers"])).not.toBe("horloge-envers");
  });
});

describe("les 12 dessins", () => {
  const fichiers = readdirSync(join(DOSSIER, "micro-objets")).filter((f) => f.endsWith(".tsx")).sort();
  it("un fichier par dessin (+ le cadre commun) ; chaque .tsx commence par l'import React", () => {
    expect(fichiers.filter((f) => f !== "Cadre.tsx")).toHaveLength(12);
    for (const f of [...fichiers.map((f) => join("micro-objets", f)), "MicroObjet.tsx"]) {
      expect(readFileSync(join(DOSSIER, f), "utf8").split("\n")[0], f).toBe('import React from "react";');
    }
  });
  it("l'aiguillage de MicroObjet.tsx est une fonction qui couvre les 12 noms", () => {
    const source = readFileSync(join(DOSSIER, "MicroObjet.tsx"), "utf8");
    expect(source).toMatch(/export function dessinMicroObjet\(/);
    for (const n of NOMS_MICRO_OBJETS) expect(source).toContain(`case "${n}":`);
  });
  for (const nom of NOMS_MICRO_OBJETS) {
    it(`${nom} : bouge pendant sa micro-animation, se pose ensuite, rendu identique d'un appel à l'autre`, () => {
      const d = microObjet(nom).dureeS;
      const instants = [0.15, 0.5, 0.9, 1.3, d, d + 0.01];
      const images = instants.map((t) => rendre(nom, t));
      for (const img of images) expect(img).not.toMatch(/NaN|Infinity|undefined/);
      // la micro-animation change l'image au moins 4 fois sur ses instants clés
      expect(new Set(images.slice(0, 5)).size).toBeGreaterThanOrEqual(4);
      expect(rendre(nom, 0.9)).toBe(images[2]);
      expect(rendre(nom, 0.9, "sombre")).not.toBe(images[2]);
      // aucun texte dans le dessin : le titre du bénéfice est porté par la carte
      expect(images[4]).not.toMatch(/<text/);
    });
  }
});
