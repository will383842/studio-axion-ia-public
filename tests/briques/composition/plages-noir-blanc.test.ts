import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { NOIR_BLANC_ACTIF, plagesNoirBlancDesFaits } from "../../../src/briques/composition/plages-noir-blanc";
import type { MotFait } from "../../../src/briques/faits-script";

const SRC = new URL("../../../src/briques/composition/plages-noir-blanc.ts", import.meta.url);

/** Mots à 350 ms, avec des débuts imposés par indice (en ms). */
function mots(script: string, debuts: Record<number, number> = {}): MotFait[] {
  return script.split(/\s+/).filter(Boolean).map((texte, i) => {
    const debutMs = debuts[i] ?? i * 350;
    return { texte, debutMs, finMs: debutMs + 300 };
  });
}
const PASSAGE = "on passe de 2 heures à 20 minutes par semaine"; // « 2 » = mot 3, « 20 » = mot 6
const ON = { actif: true, dureeSec: 60 };
const passage = (debut: number, fin: number) => mots(PASSAGE, { 3: debut, 6: fin });

describe("plagesNoirBlancDesFaits", () => {
  it("(a) passage → plage exacte, en secondes", () => {
    expect(plagesNoirBlancDesFaits(mots(PASSAGE), ON)).toEqual([[1.05, 2.1]]);
    expect(plagesNoirBlancDesFaits(passage(3450, 5000), ON)).toEqual([[3.45, 5]]);
    expect(plagesNoirBlancDesFaits(mots("on passe de 12 à 3 heures", { 5: 2600 }), ON)).toHaveLength(1);
  });
  it("(b) argent ignoré", () => {
    expect(plagesNoirBlancDesFaits(mots("on passe de 30 € à 10 € par mois"), ON)).toEqual([]);
    expect(plagesNoirBlancDesFaits(mots("on passe de 30 à 10 euros par mois"), ON)).toEqual([]);
  });
  it("(c) bornes de durée : 0,99 ignorée, 1 et 4 gardées, 4,01 ignorée", () => {
    expect(plagesNoirBlancDesFaits(passage(2000, 2990), ON)).toEqual([]);
    expect(plagesNoirBlancDesFaits(passage(2000, 3000), ON)).toEqual([[2, 3]]);
    expect(plagesNoirBlancDesFaits(passage(2000, 6000), ON)).toEqual([[2, 6]]);
    expect(plagesNoirBlancDesFaits(passage(2000, 6010), ON)).toEqual([]);
  });
  it("(d) au plus 2 plages, les 2 premières dans le temps", () => {
    const m = mots(`${PASSAGE} et de 5 heures à 4 heures par jour puis de 9 jours à 8 jours ici`, {});
    const t = m.map((x, i) => ({ ...x, debutMs: 1000 + i * 350, finMs: 1000 + i * 350 + 300 }));
    const r = plagesNoirBlancDesFaits(t, { actif: true, dureeSec: 120 });
    expect(r).toHaveLength(2);
    expect(r[0]![0]).toBeLessThan(r[1]![0]);
    // Les 2 PREMIERS passages dans le temps (pas les 2 derniers) : débuts exacts du « 2 » (mot 3) et du « 5 » (mot 12), fins du « 20 » (mot 6) et du « 4 » (mot 15).
    const s = (i: number) => t[i]!.debutMs / 1000;
    expect(r).toEqual([[s(3), s(6)], [s(12), s(15)]]);
  });
  it("(e) gardes de bord : 0,49 ignorée, 0,50 gardée, fin à durée − 0,49 ignorée", () => {
    expect(plagesNoirBlancDesFaits(passage(490, 2000), ON)).toEqual([]);
    expect(plagesNoirBlancDesFaits(passage(500, 2000), ON)).toEqual([[0.5, 2]]);
    expect(plagesNoirBlancDesFaits(passage(2000, 5000), { actif: true, dureeSec: 5.49 })).toEqual([]);
    expect(plagesNoirBlancDesFaits(passage(2000, 5000), { actif: true, dureeSec: 5.5 })).toEqual([[2, 5]]);
  });
  it("(f) plans interdits (visage) : touche d'1 ms ignorée, disjointe gardée", () => {
    expect(plagesNoirBlancDesFaits(passage(2000, 4000), { ...ON, plansInterdits: [[3.999, 6]] })).toEqual([]);
    expect(plagesNoirBlancDesFaits(passage(2000, 4000), { ...ON, plansInterdits: [[4, 6]] })).toEqual([[2, 4]]);
    expect(plagesNoirBlancDesFaits(passage(2000, 4000), { ...ON, plansInterdits: [[0, 2]] })).toEqual([[2, 4]]);
  });
  it("(g) éteint par défaut, entrées vides ou invalides, 2e appel identique, mots intacts", () => {
    expect(NOIR_BLANC_ACTIF).toBe(false);
    expect(plagesNoirBlancDesFaits(mots(PASSAGE), { dureeSec: 60 })).toEqual([]);
    expect(plagesNoirBlancDesFaits([], ON)).toEqual([]);
    expect(plagesNoirBlancDesFaits(mots(PASSAGE), { actif: true, dureeSec: 0 })).toEqual([]);
    expect(plagesNoirBlancDesFaits(mots(PASSAGE), { actif: true, dureeSec: Number.NaN })).toEqual([]);
    const m = mots(PASSAGE);
    const avant = JSON.stringify(m);
    const r1 = plagesNoirBlancDesFaits(m, ON);
    expect(plagesNoirBlancDesFaits(m, ON)).toEqual(r1);
    expect(JSON.stringify(m)).toBe(avant);
  });
  it("(h) gardes de texte : imports relatifs seuls, importeur unique : parametres.ts (NOIR-BLANC-b)", () => {
    const src = readFileSync(SRC, "utf8");
    for (const interdit of ["@/", "react", "remotion", "studio-rendu", "v4"]) expect(src).not.toContain(`from "${interdit}`);
    expect(/from "(@\/|react|remotion|[^"]*studio-rendu|[^"]*v4)/.test(src)).toBe(false);
    // Sans importeur : aucun fichier de src/** ni de studio-rendu/** (hors le fichier lui-même) ne cite « plages-noir-blanc ».
    const soi = fileURLToPath(SRC);
    const citeurs: string[] = [];
    const parcourir = (dossier: string) => {
      for (const e of readdirSync(dossier, { withFileTypes: true })) {
        const chemin = `${dossier}/${e.name}`;
        if (e.isDirectory()) { if (e.name !== "node_modules" && e.name !== ".git") parcourir(chemin); }
        else if (/\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/.test(e.name) && chemin !== soi && readFileSync(chemin, "utf8").includes("plages-noir-blanc")) citeurs.push(chemin);
      }
    };
    parcourir(fileURLToPath(new URL("../../../src", import.meta.url)).replace(/\/$/, ""));
    parcourir(fileURLToPath(new URL("../../../studio-rendu", import.meta.url)).replace(/\/$/, ""));
    // MAJ 25/11 (NOIR-BLANC-b-v21s, voulue, à relire) : `parametres.ts` est le SEUL importeur permis (il porte les plages jusqu'au filtre, derrière NOIR_BLANC_ACTIF = false) ; tout AUTRE fichier reste refusé.
    expect(citeurs).toEqual([fileURLToPath(new URL("../../../src/briques/composition/parametres.ts", import.meta.url))]);
  });
});
