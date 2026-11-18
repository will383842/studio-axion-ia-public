/** X1-02b : découpe « minimal dynamique ». Pur, éteint, non branché. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MARQUEURS } from "@/briques/sous-titres/marqueur";
import {
  MINIMAL_DYNAMIQUE,
  couleursMinimalDynamique,
  decouperMinimalDynamique,
  tailleTexteMinimale,
} from "@/briques/sous-titres/minimal-dynamique";
import type { MotRendu, SegmentRendu } from "@/briques/sous-titres/types-rendu";

const seg = (id: string, texte: string, valeur: number[] = [], fin?: number): SegmentRendu => {
  const mots: MotRendu[] = texte.split(" ").map((mot, i) => ({
    mot,
    debutSec: i * 0.4,
    finSec: i * 0.4 + 0.4,
    ...(valeur.includes(i) ? { enValeur: true } : {}),
  }));
  return { id, debutSec: 0, finSec: fin ?? mots.length * 0.4, mots };
};

const TEXTES = [
  "Vous avez le droit de contester la décision du propriétaire avant la fin du mois",
  "Il faut payer 67 000 € pour acheter le local de la rue du port",
  "Le bail dure 9 ans et le loyer est de 1 200 € par mois",
  "Non",
  "Un contrat de travail doit toujours être écrit et signé par les deux parties",
];

const sources = (dossier: string): string[] =>
  readdirSync(dossier).flatMap((n) => {
    const p = join(dossier, n);
    if (n === "node_modules") return [];
    return statSync(p).isDirectory() ? sources(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });

describe("X1-02b : découpe", () => {
  it("jamais plus de motsMax mots, jamais 0", () => {
    for (const max of [1, 2, 3] as const) {
      for (const t of TEXTES) {
        for (const g of decouperMinimalDynamique([seg("s", t)], { motsMax: max })) {
          expect(g.mots.length).toBeGreaterThanOrEqual(1);
          expect(g.mots.length).toBeLessThanOrEqual(max);
        }
      }
    }
    expect(MINIMAL_DYNAMIQUE.motsMax).toBe(3);
    for (const g of decouperMinimalDynamique([seg("s", TEXTES[0])])) expect(g.mots.length).toBeLessThanOrEqual(3);
  });

  it("aucun mot perdu ni ajouté, même ordre, mêmes objets", () => {
    const segs = TEXTES.map((t, i) => seg(`s${i}`, t, [2]));
    for (const max of [1, 2, 3] as const) {
      const mots = decouperMinimalDynamique(segs, { motsMax: max }).flatMap((g) => g.mots);
      expect(mots).toEqual(segs.flatMap((s) => s.mots));
      mots.forEach((m, i) => expect(m).toBe(segs.flatMap((s) => s.mots)[i]));
    }
  });

  it("« 67 000 € » jamais coupé", () => {
    const g = decouperMinimalDynamique([seg("s", TEXTES[1])]);
    const avec = g.find((x) => x.mots.some((m) => m.mot === "67"))!;
    expect(avec.mots.map((m) => m.mot)).toEqual(expect.arrayContaining(["67", "000", "€"]));
    const g2 = decouperMinimalDynamique([seg("s", TEXTES[2])]);
    const m1200 = g2.find((x) => x.mots.some((m) => m.mot === "1"))!;
    expect(m1200.mots.map((m) => m.mot)).toEqual(expect.arrayContaining(["1", "200", "€"]));
  });

  it("un mot outil ne termine jamais un groupe quand un mot suit", () => {
    for (const max of [2, 3] as const) {
      const g = decouperMinimalDynamique([seg("s", TEXTES[0])], { motsMax: max });
      g.slice(0, -1).forEach((x) => expect(["le", "la", "de", "du", "à", "avant"].includes(x.mots.at(-1)!.mot) && x.mots.at(-1)!.mot === "le").toBe(false));
    }
    const g = decouperMinimalDynamique([seg("s", "Il faut payer le local")], { motsMax: 3 });
    g.slice(0, -1).forEach((x) => expect(x.mots.at(-1)!.mot).not.toBe("le"));
    expect(g.map((x) => x.mots.map((m) => m.mot))).toEqual([["Il", "faut", "payer"], ["le", "local"]]);
  });

  it("0 ou 1 mot marqué ; premier enValeur seulement ; sinon null", () => {
    const g = decouperMinimalDynamique([seg("s", "Vous avez le droit de contester", [3, 4])]);
    for (const x of g) expect(x.marque === null || (x.marque >= 0 && x.marque < x.mots.length)).toBe(true);
    const deux = decouperMinimalDynamique([seg("s", "alpha beta gamma", [1, 2])]);
    expect(deux).toHaveLength(1);
    expect(deux[0].marque).toBe(1);
    expect(deux[0].mots[2].enValeur).toBe(true);
    expect(decouperMinimalDynamique([seg("s", "alpha beta gamma")])[0].marque).toBeNull();
  });

  it("minutage et id", () => {
    const s = seg("abc", "Un deux trois quatre cinq", [], 5);
    const g = decouperMinimalDynamique([s], { motsMax: 2 });
    expect(g.map((x) => x.id)).toEqual(["abc-0", "abc-1", "abc-2"]);
    expect(g[0].debutSec).toBe(s.mots[0].debutSec);
    expect(g[0].finSec).toBe(g[1].debutSec);
    expect(g.at(-1)!.finSec).toBe(5);
    expect(decouperMinimalDynamique([{ ...s, mots: [] }])).toEqual([]);
  });

  it("déterministe et entrée figée non modifiée", () => {
    const s = seg("s", TEXTES[1], [2]);
    s.mots.forEach(Object.freeze);
    Object.freeze(s.mots);
    Object.freeze(s);
    const a = decouperMinimalDynamique([s]);
    expect(decouperMinimalDynamique([s])).toEqual(a);
    expect(s.mots).toHaveLength(TEXTES[1].split(" ").length);
  });
});

describe("X1-02b : couleurs et taille", () => {
  it("couleurs prises dans MARQUEURS, terracotta par défaut", () => {
    expect(couleursMinimalDynamique()).toEqual({ fond: MARQUEURS.terracotta.fond, texte: MARQUEURS.terracotta.texte });
    for (const t of ["terracotta", "ivoire", "ardoise"] as const) {
      expect(couleursMinimalDynamique(t)).toEqual({ fond: MARQUEURS[t].fond, texte: MARQUEURS[t].texte });
    }
  });

  it("taille ≥ 3 % de la hauteur ; invalide → 0", () => {
    expect(tailleTexteMinimale(1920)).toBeGreaterThanOrEqual(0.03 * 1920);
    expect(tailleTexteMinimale(1920)).toBe(Math.ceil(57.6));
    for (const h of [0, -5, NaN, Infinity]) expect(tailleTexteMinimale(h)).toBe(0);
  });
});

describe("X1-02b : éteint, pur", () => {
  it("aucun `@/`, Math.random ni Date ; rien ne l'importe", () => {
    const code = readFileSync("src/briques/sous-titres/minimal-dynamique.ts", "utf8");
    expect(code).not.toMatch(/from\s+["']@\//);
    expect(code).not.toMatch(/Math\.random/);
    expect(code).not.toMatch(/\bDate\b/);
    for (const dossier of ["src", "studio-rendu"]) {
      for (const f of sources(dossier)) {
        if (f.endsWith("minimal-dynamique.ts")) continue;
        // 18/11/2026, BR-MINIMAL-IV-a (seconde lecture du pilote) : SEUL appelant autorisé, la fonction pure de l'image vers vidéo
        // (éteinte par `imageVideo.sousTitresMinimal`). Garde intacte : tout autre importeur reste refusé.
        if (f.replace(/\\/g, "/").endsWith("src/moteurs/montage-image-video/sous-titres-minimal.ts")) continue;
        expect(readFileSync(f, "utf8"), f).not.toMatch(/(from\s+|import\s*\(|require\()\s*["'][^"']*sous-titres\/minimal-dynamique["']|from\s+["']\.\/minimal-dynamique["']/);
      }
    }
  });
});
