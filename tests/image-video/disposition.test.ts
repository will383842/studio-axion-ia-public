/**
 * L2 · Disposition du schéma sur la toile et scène « Ensemble » : aucun chevauchement (C, D, E, F, faux schéma à 16
 * nœuds, aux deux échelles), branche majoritaire à gauche et en orange, aucun texte de plus de 3 mots ni sous le
 * plancher dans « Ensemble », résultat indépendant de l'ordre des listes, module pur importable par `studio-rendu`.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { CarteImage } from "@/domaine/image-video/carte";
import { chevauche, disposerEnsemble, disposerToile } from "@/briques/schema-motion/disposition";
import { controlerEnsemble, nombreDeMots, PLANCHER_IV } from "@/briques/schema-motion/lisibilite";
import { ECRAN_IV, ZONE_CONTENU_IV, type DispositionToile } from "@/briques/schema-motion/types";

const DOSSIER = join(process.cwd(), "tests/image-video/fixtures/cartes");
const lire = (nom: string): CarteImage => JSON.parse(readFileSync(join(DOSSIER, `${nom}.json`), "utf8"));
const SCHEMAS = ["C", "D", "E", "F", "faux-16-noeuds"] as const;
const TOUTES = ["A", "B", ...SCHEMAS] as const;

function melange<T>(liste: readonly T[]): T[] {
  const r = [...liste].reverse();
  const m = Math.ceil(r.length / 2);
  return [...r.slice(m), ...r.slice(0, m)];
}

function chevauchements(rects: { id: string; x: number; y: number; largeur: number; hauteur: number }[]): string[] {
  const res: string[] = [];
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) if (chevauche(rects[i], rects[j])) res.push(`${rects[i].id}/${rects[j].id}`);
  return res;
}

const toiles = Object.fromEntries(TOUTES.map((n) => [n, disposerToile(lire(n))])) as Record<(typeof TOUTES)[number], DispositionToile>;

describe("toile : aucun chevauchement", () => {
  for (const nom of TOUTES) {
    it(`${nom} : toutes les boîtes posées, aucune ne touche une autre, toile ≤ 3 × 3 écrans`, () => {
      const carte = lire(nom);
      const t = toiles[nom];
      expect(t.boites.map((b) => b.id).sort()).toEqual(carte.noeuds.map((n) => n.id).sort());
      expect(chevauchements(t.boites)).toEqual([]);
      for (const b of t.boites) {
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.x + b.largeur).toBeLessThanOrEqual(t.largeur);
        expect(b.y + b.hauteur).toBeLessThanOrEqual(t.hauteur);
      }
      expect(t.largeur).toBeLessThanOrEqual(3 * ECRAN_IV.largeur);
      expect(t.hauteur).toBeLessThanOrEqual(3 * ECRAN_IV.hauteur);
    });
  }
  it("une flèche descend toujours vers une couche plus basse (hors retour en arrière)", () => {
    for (const nom of SCHEMAS) {
      const t = toiles[nom];
      const couche = new Map(t.boites.map((b) => [b.id, b.couche]));
      for (const f of t.fleches) expect(couche.get(f.vers)!, `${nom} ${f.id}`).toBeGreaterThan(couche.get(f.de)!);
    }
  });
});

describe("branches : la majoritaire à gauche, en orange", () => {
  for (const nom of ["C", "D", "faux-16-noeuds"] as const) {
    it(nom, () => {
      const carte = lire(nom);
      const t = toiles[nom];
      const majoritaire = t.branches.find((b) => b.majoritaire)!;
      expect(majoritaire.rang).toBe(0);
      expect(majoritaire.couleur).toBe("orange");
      expect(t.branches.filter((b) => b.couleur === "orange")).toHaveLength(1);
      const groupe = carte.groupes.find((g) => g.id === majoritaire.id)!;
      const droiteMaj = Math.max(...t.boites.filter((b) => groupe.noeuds.includes(b.id)).map((b) => b.x + b.largeur));
      for (const autre of t.branches.filter((b) => !b.majoritaire)) {
        const g = carte.groupes.find((x) => x.id === autre.id)!;
        const gaucheAutre = Math.min(...t.boites.filter((b) => g.noeuds.includes(b.id)).map((b) => b.x));
        expect(gaucheAutre).toBeGreaterThan(droiteMaj);
      }
    });
  }
  it("l'orange de la majoritaire vaut aussi pour ses boîtes et ses flèches ; aucune autre branche en orange", () => {
    for (const nom of ["C", "D", "faux-16-noeuds"] as const) {
      const t = toiles[nom];
      const maj = t.branches.find((b) => b.majoritaire)!.id;
      const colonne = new Map(t.boites.map((b) => [b.id, b.colonne]));
      for (const b of t.boites.filter((x) => x.colonne === maj)) expect(["orange", "vert"], `${nom} ${b.id}`).toContain(b.couleur);
      for (const b of t.boites.filter((x) => x.colonne !== null && x.colonne !== maj)) expect(b.couleur, `${nom} ${b.id}`).not.toBe("orange");
      for (const f of t.fleches) {
        const c = colonne.get(f.vers);
        if (c === maj) expect(f.couleur, `${nom} ${f.id}`).toBe("orange");
        else if (c !== null) expect(f.couleur, `${nom} ${f.id}`).not.toBe("orange");
      }
    }
    // Image qui colorait sa branche majoritaire en noir : la toile la repeint quand même en orange.
    const carte = lire("C");
    const inverse = { ...carte, noeuds: carte.noeuds.map((n) => ({ ...n, couleur: n.couleur === "orange" ? ("noir" as const) : n.couleur === "noir" ? ("orange" as const) : n.couleur })), liens: carte.liens.map((l) => ({ ...l, couleur: l.couleur === "orange" ? ("noir" as const) : ("orange" as const) })) };
    const t = disposerToile(inverse);
    expect(t.boites.find((b) => b.id === "n03")!.couleur).toBe("orange");
    expect(t.boites.find((b) => b.id === "n07")!.couleur).toBe("noir");
    expect(t.fleches.find((f) => f.id === "l02")!.couleur).toBe("orange");
    expect(t.fleches.find((f) => f.id === "l06")!.couleur).toBe("noir");
  });

  it("sans branche marquée, la plus grosse part passe à gauche", () => {
    const carte = lire("C");
    const sansMarque = { ...carte, groupes: carte.groupes.map((g) => ({ ...g, majoritaire: undefined })) };
    expect(disposerToile(sansMarque).branches[0].id).toBe("g-branche-a");
  });
});

describe("déterminisme", () => {
  for (const nom of SCHEMAS) {
    it(`${nom} : même disposition quel que soit l'ordre des listes, 20 fois`, () => {
      const carte = lire(nom);
      const premiere = disposerToile(carte);
      for (let i = 0; i < 20; i++) expect(disposerToile(carte)).toEqual(premiere);
      expect(disposerToile({ ...carte, noeuds: melange(carte.noeuds), liens: melange(carte.liens), groupes: melange(carte.groupes) })).toEqual(premiere);
    });
  }
});

describe("scène « Ensemble » : le schéma entier à l'échelle d'un écran, sans texte à lire", () => {
  for (const nom of SCHEMAS) {
    it(`${nom} : pastilles dans la bande de contenu, sans chevauchement ; textes ≤ 3 mots et au plancher`, () => {
      const carte = lire(nom);
      const e = disposerEnsemble(toiles[nom], carte);
      expect(e.pastilles).toHaveLength(carte.noeuds.length);
      const carres = e.pastilles.map((p) => ({ id: p.id, x: p.cx - p.rayon, y: p.cy - p.rayon, largeur: 2 * p.rayon, hauteur: 2 * p.rayon }));
      expect(chevauchements(carres)).toEqual([]);
      for (const c of carres) {
        expect(c.x).toBeGreaterThanOrEqual(0);
        expect(c.x + c.largeur).toBeLessThanOrEqual(ECRAN_IV.largeur);
        expect(c.y).toBeGreaterThanOrEqual(ZONE_CONTENU_IV.haut * ECRAN_IV.hauteur - 1e-6);
        expect(c.y + c.hauteur).toBeLessThanOrEqual(ZONE_CONTENU_IV.bas * ECRAN_IV.hauteur + 1e-6);
      }
      const textes = [...e.chiffresCles.map((c) => c.texte), ...e.pastilles.flatMap((p) => (p.numero ? [p.numero.texte] : []))];
      for (const t of textes) expect(nombreDeMots(t), t).toBeLessThanOrEqual(3);
      for (const c of e.chiffresCles) expect(c.taille).toBeGreaterThanOrEqual(PLANCHER_IV);
      for (const p of e.pastilles) if (p.numero) expect(p.numero.taille).toBeGreaterThanOrEqual(PLANCHER_IV);
      expect(e.chiffresCles.length).toBeLessThanOrEqual(3);
      expect(controlerEnsemble(e)).toEqual([]);
    });
  }
  it("un chiffre-clé de plus de 3 mots n'est jamais écrit", () => {
    const e = disposerEnsemble(toiles.C, lire("C"), { chiffresCles: ["80 % résolus instantanément sans attendre", "24h/24"] });
    expect(e.chiffresCles.map((c) => c.texte)).toEqual(["24h/24"]);
  });
  it("le bloc courant est allumé, les autres atténués", () => {
    const e = disposerEnsemble(toiles["faux-16-noeuds"], lire("faux-16-noeuds"), { allumes: ["n07", "n08", "n09", "n10"] });
    expect(e.pastilles.filter((p) => p.allume).map((p) => p.id)).toEqual(["n07", "n08", "n09", "n10"]);
  });
  it("le contrôle repère un texte trop long ou trop petit", () => {
    const e = disposerEnsemble(toiles.C, lire("C"));
    const fautif = { ...e, chiffresCles: [{ texte: "quatre mots bien trop longs", x: 0, y: 0, largeur: 100, taille: PLANCHER_IV / 2 }] };
    expect(controlerEnsemble(fautif)).toHaveLength(2);
  });
});

describe("module pur, importable par studio-rendu", () => {
  it("aucun alias « @/ », aucun paquet (React, Zod, node:) dans tout ce que charge l'index", () => {
    const vus = new Set<string>();
    const visiter = (fichier: string) => {
      if (vus.has(fichier)) return;
      vus.add(fichier);
      const texte = readFileSync(fichier, "utf8");
      for (const m of texte.matchAll(/\b(?:import|export)\s+[^;"'`]*?\bfrom\s*["']([^"']+)["']/g)) {
        const spec = m[1];
        expect(spec.startsWith("."), `${fichier} importe « ${spec} »`).toBe(true);
        visiter(resolve(dirname(fichier), `${spec}.ts`));
      }
    };
    visiter(join(process.cwd(), "src/briques/schema-motion/index.ts"));
    for (const f of vus) expect(f.startsWith(join(process.cwd(), "src/briques/"))).toBe(true);
    expect(vus.size).toBeGreaterThanOrEqual(5);
  });
});
