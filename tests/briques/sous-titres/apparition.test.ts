/**
 * C11-T4-a : apparition au mot des sous-titres (mot à venir invisible, entrée flou → net en 0,2 s, gabarit « ligne de
 * contexte + mot-clé seul »), fonctions PURES, éteintes. Les fonctions du Studio elles-mêmes, aucun mock.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APPARITION, APPARITION_ACTIVE, etatMotApparition, gabaritContexteMotCle, tailleContexte, tailleMotCle } from "@/briques/sous-titres/apparition";
import { donneesCalque } from "@/briques/sous-titres";
import { largeurLibrePx } from "@/briques/sous-titres/largeur";
import { largeurMot } from "@/briques/sous-titres/mesure";
import { LEXIQUE_FORTS } from "@/briques/sous-titres/mots-importants";
import { FLOU_MAX_PX } from "@/briques/motion/texte-effets/effets";
import type { SegmentRendu } from "@/briques/sous-titres/types-rendu";

describe("(a) etatMotApparition", () => {
  const D = 2;
  it("avant le mot : invisible, opacité 0, flou max (la place reste réservée : aucune mesure ici)", () => {
    for (const t of [-1, 0, 1.99]) {
      const e = etatMotApparition(t, D);
      expect(e.visible).toBe(false);
      expect(e.opacite).toBe(0);
    }
  });
  it("début + 0,1 s : opacité ≈ 0,5 et flou ≈ 3 px ; début + 0,2 s et après : net", () => {
    const m = etatMotApparition(D + 0.1, D);
    expect(m.visible).toBe(true);
    expect(m.opacite).toBeCloseTo(0.5, 5);
    expect(m.flouPx).toBeCloseTo(FLOU_MAX_PX / 2, 5);
    for (const t of [D + 0.2, D + 0.5, D + 100]) expect(etatMotApparition(t, D)).toEqual({ visible: true, opacite: 1, flouPx: 0 });
  });
  it("au début exact : visible, opacité 0, flou max ; jamais de flou > 6 px, opacité dans [0, 1]", () => {
    expect(etatMotApparition(D, D)).toEqual({ visible: true, opacite: 0, flouPx: FLOU_MAX_PX });
    for (let t = 1.9; t < 2.4; t += 0.01) {
      const e = etatMotApparition(t, D, { flouMaxPx: 50 });
      expect(e.flouPx).toBeLessThanOrEqual(6);
      expect(e.opacite).toBeGreaterThanOrEqual(0);
      expect(e.opacite).toBeLessThanOrEqual(1);
    }
  });
  it("monotone sur la fenêtre et déterministe (même entrée = même sortie)", () => {
    let precedent = -1;
    for (let t = D; t <= D + 0.2; t += 0.01) {
      const e = etatMotApparition(t, D);
      expect(e.opacite).toBeGreaterThanOrEqual(precedent);
      precedent = e.opacite;
      expect(etatMotApparition(t, D)).toEqual(e);
    }
  });
  it("entrées non finies : net, sans lever", () => {
    for (const [t, d] of [[NaN, 1], [1, NaN], [Infinity, 1], [-Infinity, 1], [1, Infinity]] as const) {
      expect(() => etatMotApparition(t, d)).not.toThrow();
      expect(etatMotApparition(t, d)).toEqual({ visible: true, opacite: 1, flouPx: 0 });
    }
    expect(etatMotApparition(2.1, 2, { dureeS: NaN })).toEqual({ visible: true, opacite: 1, flouPx: 0 });
  });
});

const mot = (m: string, i: number) => ({ mot: m, debutSec: i * 0.4, finSec: i * 0.4 + 0.35 });
const seg = (id: string, mots: string[]): SegmentRendu => ({ id, debutSec: 0, finSec: mots.length * 0.4, mots: mots.map(mot) });

describe("(b) gabaritContexteMotCle sur de vrais groupes de donneesCalque", () => {
  const d = donneesCalque({
    segments: [seg("a", ["Vous", "perdez", "jamais", "vos", "clients"]), seg("b", ["jamais", "plus"]), seg("c", ["Vous", "gagnez", "du", "temps"]), seg("d", ["Il", "ne", "faut", "rien", "oublier"])],
    base: "karaoke",
    ratio: "9:16",
  });
  const g = (id: string) => gabaritContexteMotCle(d.segments.find((s) => s.id === id)!);
  it("un mot fort : `cle` = son indice, `contexte` = les autres dans l'ordre", () => {
    expect(g("a")).toEqual({ cle: 2, contexte: [0, 1, 3, 4] });
    expect(g("d")).toEqual({ cle: 3, contexte: [0, 1, 2, 4] });
  });
  it("groupe de 2 mots ou sans mot fort : null", () => {
    expect(g("b")).toBeNull();
    expect(g("c")).toBeNull();
    expect(gabaritContexteMotCle({ mots: [] })).toBeNull();
  });
  it("jamais le mot souligné ; ne lève jamais sur une entrée vide", () => {
    expect(gabaritContexteMotCle({ mots: [{ mot: "jamais" }, { mot: "vos" }, { mot: "clients" }], souligne: 0 })).toBeNull();
    expect(() => gabaritContexteMotCle({ mots: undefined as never })).not.toThrow();
  });
});

describe("(c) tailles", () => {
  const libre = largeurLibrePx("9:16", []);
  const plusLongs = [...LEXIQUE_FORTS].sort((a, b) => b.length - a.length).slice(0, 20);
  it("1,6 × la taille et 0,7 × sans mot ; plafond non touché pour un mot court", () => {
    expect(tailleMotCle(70)).toBeCloseTo(112, 5);
    expect(tailleContexte(70)).toBeCloseTo(49, 5);
    expect(tailleMotCle(70, "or", libre)).toBeCloseTo(112, 5);
  });
  it("le mot-clé seul tient dans la zone libre pour les 20 mots forts les plus longs", () => {
    expect(plusLongs).toHaveLength(20);
    for (const m of plusLongs) {
      const t = tailleMotCle(70, m, libre);
      expect(t, m).toBeGreaterThan(0);
      expect(t, m).toBeLessThanOrEqual(112);
      expect(largeurMot(m, "Manrope ExtraBold", t), m).toBeLessThanOrEqual(libre);
    }
    // au moins un de ces mots a dû être plafonné (sinon le plafond ne prouve rien)
    expect(plusLongs.some((m) => tailleMotCle(70, m, libre) < 112)).toBe(true);
  });
  it("entrées non valides : 0, sans lever", () => {
    expect(tailleMotCle(NaN)).toBe(0);
    expect(tailleContexte(-5)).toBe(0);
  });
});

describe("(d) éteint et montée nulle part", () => {
  it("interrupteur éteint, constantes figées", () => {
    expect(APPARITION_ACTIVE).toBe(false);
    expect(APPARITION).toEqual({ dureeS: 0.2, facteurMotCle: 1.6, facteurContexte: 0.7, motsMin: 3 });
  });
  it("aucun fichier de src/ ni de studio-rendu/ n'importe apparition.ts", () => {
    const sources = (dossier: string): string[] =>
      readdirSync(dossier).flatMap((n) => {
        const p = join(dossier, n);
        if (n === "node_modules") return [];
        return statSync(p).isDirectory() ? sources(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
      });
    const importeurs = [...sources("src"), ...sources("studio-rendu")]
      .filter((f) => !f.endsWith("sous-titres/apparition.ts"))
      // D'autres modules s'appellent « apparition » (image-video/variete) : on ne compte que les imports qui visent CE fichier.
      .filter((f) => {
        const texte = readFileSync(f, "utf8");
        const chemins = [...texte.matchAll(/(?:from\s+|import\(\s*)["']([^"']+)["']/g)].map((m) => m[1]);
        const dansSousTitres = f.replace(/\\/g, "/").startsWith("src/briques/sous-titres/");
        return chemins.some((c) => /sous-titres\/apparition$/.test(c) || (dansSousTitres && c === "./apparition"));
      });
    expect(importeurs).toEqual([]);
  });
  it("pièce pure : imports relatifs seulement (importable par Remotion), ni horloge ni hasard", () => {
    const src = readFileSync("src/briques/sous-titres/apparition.ts", "utf8");
    expect(src).not.toMatch(/from\s+["']@\//);
    expect(src).not.toMatch(/Date\.now|new Date|Math\.random|performance\.now/);
  });
});
