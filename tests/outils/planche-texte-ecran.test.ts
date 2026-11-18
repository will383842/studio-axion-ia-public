/**
 * C2-U15a : la planche de référence du texte à l'écran (outils/captures-sous-titres/planche-texte-ecran.mts) doit
 * produire exactement les planches qu'elle annonce, dans les deux formats et sur les deux fonds, et son rapport
 * (docs/captures/texte-ecran/planche.txt) doit rester d'accord avec le script, les images et le calcul pur de la sortie U19.
 * On exécute la vraie construction (`construirePlanches()`, calcul pur, aucun rendu à l'import) et on vérifie son résultat,
 * puis on le recoupe avec le rapport et les images déjà poussés.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SORTIE_PAR_DEFAUT, SORTIE_ACTIVE, sortieDuGroupe } from "@/briques/sous-titres/sortie";

const RACINE = process.cwd();
const SOURCE = readFileSync(join(RACINE, "outils/captures-sous-titres/planche-texte-ecran.mts"), "utf8");
/** `outils/` est hors du projet tsc : on charge le script par chemin (aucun rendu à l'import), avec le type minimal utilisé ici. */
interface CaseTest { legende: string; fond: { image?: string; couleur?: string }; sortie?: { opacite: number; decalageYPx: number }; escalier?: { geometrie: { lignes: { texte: string }[] } | null; couleur: string; fond: string; ligneActive: number } }
interface PlancheTest { nom: string; ratio: "9:16" | "16:9"; cellules: CaseTest[] }
const CHEMIN_SCRIPT = join(RACINE, "outils/captures-sous-titres/planche-texte-ecran.mts");
const { construirePlanches } = (await import(/* @vite-ignore */ CHEMIN_SCRIPT)) as { construirePlanches: () => { planches: PlancheTest[]; rapport: string[] } };
const CONSTRUIT = construirePlanches();
const DOSSIER = join(RACINE, "docs/captures/texte-ecran");
const RAPPORT = readFileSync(join(DOSSIER, "planche.txt"), "utf8").split("\n").filter(Boolean);

const FORMATS = ["9x16", "16x9"] as const;
const THEMES = ["clair", "sombre"] as const;
/** Familles avec thème clair/sombre, puis le tableau (un fichier par format, sans thème), avec le nombre de cases attendu. */
const FAMILLES: Record<string, number> = { marqueur: 6, pave: 3, outils: 3, "bandeau-nom": 2, styles: 5, "pastille-3-textes": 3, "sortie-u19": 3, escalier: 3 };
const CASES_TABLEAU = 4;

const attendues: { nom: string; cases: number }[] = [];
for (const [famille, cases] of Object.entries(FAMILLES)) for (const f of FORMATS) for (const t of THEMES) attendues.push({ nom: `${famille}-${f}-${t}`, cases });
for (const f of FORMATS) attendues.push({ nom: `tableau-${f}`, cases: CASES_TABLEAU });

const lignesPlanches = RAPPORT.map((l) => /^(.+)\.png : (\d+) case\(s\)$/.exec(l)).filter((m): m is RegExpExecArray => m !== null);

describe("planche de référence du texte à l'écran (C2-U15a)", () => {
  it("la construction produit exactement les planches attendues, avec leur nombre de cases, sans refus ni case manquante", () => {
    const vues = CONSTRUIT.planches.map((p) => ({ nom: p.nom, cases: p.cellules.length }));
    expect(vues.map((v) => v.nom).sort()).toEqual(attendues.map((a) => a.nom).sort());
    for (const a of attendues) expect(vues.find((v) => v.nom === a.nom)?.cases, a.nom).toBe(a.cases);
    expect(CONSTRUIT.rapport.filter((l) => /aucun mot trouvé|aucune case|aucune étiquette|refusé|non produite/.test(l))).toEqual([]);
    for (const p of CONSTRUIT.planches) {
      expect(p.ratio, p.nom).toBe(p.nom.includes("9x16") ? "9:16" : "16:9");
      for (const c of p.cellules) expect(c.legende.length, p.nom).toBeGreaterThan(0);
    }
    // Deux fonds : clair (image) et sombre (couleur), pour chaque famille hors tableau.
    for (const p of CONSTRUIT.planches.filter((q) => !q.nom.startsWith("tableau-"))) {
      for (const c of p.cellules) expect(Boolean(c.fond.image), p.nom).toBe(p.nom.endsWith("-clair"));
    }
  });

  it("les lignes « sortie » construites collent au calcul pur de la sortie U19 (opacité, glissement × largeur/1080)", () => {
    const sorties = CONSTRUIT.rapport.filter((l) => l.startsWith("sortie "));
    expect(sorties).toHaveLength(4);
    const mi = sortieDuGroupe(SORTIE_PAR_DEFAUT, 10, 10 + SORTIE_PAR_DEFAUT.dureeSec / 2)!;
    expect(mi).not.toBeNull();
    for (const l of sorties) {
      const m = /^sortie (9:16|16:9)\/(clair|sombre) : mi-sortie opacité ([\d.]+), glissement ([\d.]+) px$/.exec(l);
      expect(m, l).not.toBeNull();
      expect(Number(m![3])).toBeCloseTo(mi.opacite, 2);
      const echelle = m![1] === "9:16" ? 1 : 1920 / 1080;
      expect(Number(m![4])).toBeCloseTo(mi.decalageYPx * echelle, 1);
    }
    // La case « pendant » porte le même décalage que la ligne du rapport.
    for (const p of CONSTRUIT.planches.filter((q) => q.nom.startsWith("sortie-u19-"))) {
      const echelle = p.ratio === "9:16" ? 1 : 1920 / 1080;
      const pendant = p.cellules[1].sortie!;
      expect(pendant.opacite, p.nom).toBeCloseTo(mi.opacite, 2);
      expect(pendant.decalageYPx, p.nom).toBeCloseTo(mi.decalageYPx * echelle, 1);
    }
  });

  it("l'interrupteur n'est jamais modifié par le script", () => {
    expect(SOURCE).not.toMatch(/SORTIE_ACTIVE\s*=/);
  });

  it("le rapport liste exactement les planches attendues, dans les deux formats et les deux thèmes, avec leur nombre de cases", () => {
    const vues = lignesPlanches.map((m) => ({ nom: m[1], cases: Number(m[2]) }));
    expect(vues).toHaveLength(attendues.length);
    expect(attendues).toHaveLength(8 * 4 + 2);
    for (const p of CONSTRUIT.planches) expect(vues.find((v) => v.nom === p.nom)?.cases, p.nom).toBe(p.cellules.length);
    expect(vues.map((v) => v.nom).sort()).toEqual(attendues.map((a) => a.nom).sort());
    for (const a of attendues) expect(vues.find((v) => v.nom === a.nom)?.cases, a.nom).toBe(a.cases);
  });

  it("chaque planche du rapport a son image PNG, et le dossier ne contient pas d'image non annoncée", () => {
    for (const a of attendues) {
      const f = join(DOSSIER, `${a.nom}.png`);
      expect(existsSync(f), a.nom).toBe(true);
      // Signature PNG : une vraie image, pas un fichier vide.
      expect(readFileSync(f).subarray(0, 4).toString("hex"), a.nom).toBe("89504e47");
    }
    const presentes = readdirSync(DOSSIER).filter((f) => f.endsWith(".png")).sort();
    expect(presentes).toEqual(attendues.map((a) => `${a.nom}.png`).sort());
  });

  it("le rapport garde la mention du temps de rendu, et aucune planche vide ni refus n'y est consigné", () => {
    expect(RAPPORT.some((l) => /^Temps de rendu total : \d+(\.\d+)? s$/.test(l))).toBe(true);
    expect(RAPPORT.filter((l) => /aucun mot trouvé|aucune case|aucune étiquette|refusé|non produite/.test(l))).toEqual([]);
  });

  it("C2-U15b : chaque case de l'escalier porte une géométrie non nulle de 2, 4 puis 6 lignes, ligne active dans les bornes", () => {
    const planches = CONSTRUIT.planches.filter((q) => q.nom.startsWith("escalier-"));
    expect(planches).toHaveLength(4);
    for (const p of planches) {
      expect(p.cellules, p.nom).toHaveLength(3);
      const attendu = [2, 4, 6];
      p.cellules.forEach((c, i) => {
        const e = c.escalier;
        expect(e, `${p.nom} case ${i}`).toBeDefined();
        expect(e!.geometrie, `${p.nom} case ${i}`).not.toBeNull();
        const n = e!.geometrie!.lignes.length;
        expect(n, `${p.nom} case ${i}`).toBe(attendu[i]);
        expect(e!.ligneActive).toBeGreaterThanOrEqual(0);
        expect(e!.ligneActive).toBeLessThan(n);
        expect(e!.couleur.length).toBeGreaterThan(0);
      });
      // Case du milieu : 4 lignes, active = la 3e, donc exactement 2 lignes passées (mémoire floue).
      expect(p.cellules[1].escalier!.ligneActive, p.nom).toBe(2);
      expect(p.cellules[0].escalier!.ligneActive, p.nom).toBe(1);
      expect(p.cellules[2].escalier!.ligneActive, p.nom).toBe(5);
    }
  });

  it("C2-U15b : le script n'écrit jamais l'interrupteur de l'escalier", () => {
    expect(SOURCE).not.toMatch(/ESCALIER_ACTIF\s*=/);
  });

  // MISE À JOUR DE RÉFÉRENCE 18/11 (BR-SORTIE-ANIMEE, seconde lecture du pilote) : SORTIE_ACTIVE vaut true côté code ; sans le
  // champ `sortie` (posé seulement quand la capacité est permise) rien ne change. Garde conservée, déplacée.
  it("la sortie n'est posée par aucune planche à elle seule : le champ vient de `parametres.ts`, derrière la porte", () => {
    expect(SORTIE_ACTIVE).toBe(true);
    expect(readFileSync("src/briques/composition/parametres.ts", "utf8")).toMatch(/sortieAnimeePermise\(c\.entrees\)\s*\?\s*\{\s*sortie\s*:/);
  });
});
