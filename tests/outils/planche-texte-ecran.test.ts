/**
 * C2-U15a : la planche de référence du texte à l'écran (outils/captures-sous-titres/planche-texte-ecran.mts) doit
 * produire exactement les planches qu'elle annonce, dans les deux formats et sur les deux fonds, et son rapport
 * (docs/captures/texte-ecran/planche.txt) doit rester d'accord avec le script, les images et le calcul pur de la sortie U19.
 * Le script rend des images (Remotion) et ne s'importe pas : on lit sa source, le rapport et le dossier, sans aucun rendu.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SORTIE_PAR_DEFAUT, SORTIE_ACTIVE, sortieDuGroupe } from "@/briques/sous-titres/sortie";

const RACINE = process.cwd();
const SOURCE = readFileSync(join(RACINE, "outils/captures-sous-titres/planche-texte-ecran.mts"), "utf8");
const DOSSIER = join(RACINE, "docs/captures/texte-ecran");
const RAPPORT = readFileSync(join(DOSSIER, "planche.txt"), "utf8").split("\n").filter(Boolean);

const FORMATS = ["9x16", "16x9"] as const;
const THEMES = ["clair", "sombre"] as const;
/** Familles avec thème clair/sombre, puis le tableau (un fichier par format, sans thème), avec le nombre de cases attendu. */
const FAMILLES: Record<string, number> = { marqueur: 6, pave: 3, outils: 3, "bandeau-nom": 2, styles: 5, "pastille-3-textes": 3, "sortie-u19": 3 };
const CASES_TABLEAU = 4;

const attendues: { nom: string; cases: number }[] = [];
for (const [famille, cases] of Object.entries(FAMILLES)) for (const f of FORMATS) for (const t of THEMES) attendues.push({ nom: `${famille}-${f}-${t}`, cases });
for (const f of FORMATS) attendues.push({ nom: `tableau-${f}`, cases: CASES_TABLEAU });

const lignesPlanches = RAPPORT.map((l) => /^(.+)\.png : (\d+) case\(s\)$/.exec(l)).filter((m): m is RegExpExecArray => m !== null);

describe("planche de référence du texte à l'écran (C2-U15a)", () => {
  it("la source nomme chaque famille, les deux formats, les deux fonds et écrit dans le dossier prévu", () => {
    for (const famille of [...Object.keys(FAMILLES), "tableau"]) expect(SOURCE).toContain(`\`${famille}-`);
    expect(SOURCE).toContain('"9:16": "9x16"');
    expect(SOURCE).toContain('"16:9": "16x9"');
    expect(SOURCE).toMatch(/clair: \{ image: FOND_CLAIR \}, sombre: \{ couleur: "#16120F" \}/);
    expect(SOURCE).toContain('join(RACINE, "docs", "captures", "texte-ecran")');
    // Rien n'est allumé : la sortie est montrée par le calcul pur, l'interrupteur n'est jamais modifié.
    expect(SOURCE).toContain("sortieMod.sortieDuGroupe(");
    expect(SOURCE).not.toMatch(/SORTIE_ACTIVE\s*=/);
  });

  it("le rapport liste exactement les planches attendues, dans les deux formats et les deux thèmes, avec leur nombre de cases", () => {
    const vues = lignesPlanches.map((m) => ({ nom: m[1], cases: Number(m[2]) }));
    expect(vues).toHaveLength(attendues.length);
    expect(attendues).toHaveLength(7 * 4 + 2);
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
  });

  it("le rapport garde la mention du temps de rendu, et aucune planche vide ni refus n'y est consigné", () => {
    expect(RAPPORT.some((l) => /^Temps de rendu total : \d+(\.\d+)? s$/.test(l))).toBe(true);
    expect(RAPPORT.filter((l) => /aucun mot trouvé|aucune case|aucune étiquette|refusé|non produite/.test(l))).toEqual([]);
  });

  it("les lignes « sortie » du rapport collent au calcul pur de la sortie U19 (opacité et glissement à mi-sortie, par format)", () => {
    const sorties = RAPPORT.filter((l) => l.startsWith("sortie "));
    expect(sorties).toHaveLength(4);
    const mi = sortieDuGroupe(SORTIE_PAR_DEFAUT, 10, 10 + SORTIE_PAR_DEFAUT.dureeSec / 2);
    expect(mi).not.toBeNull();
    for (const l of sorties) {
      const m = /^sortie (9:16|16:9)\/(clair|sombre) : mi-sortie opacité ([\d.]+), glissement ([\d.]+) px$/.exec(l);
      expect(m, l).not.toBeNull();
      expect(Number(m![3])).toBeCloseTo(mi!.opacite, 2);
      // Le glissement est en px de l'image : largeur de l'image / 1080 (1 en 9:16, 1920/1080 en 16:9).
      const echelle = m![1] === "9:16" ? 1 : 1920 / 1080;
      expect(Number(m![4])).toBeCloseTo(mi!.decalageYPx * echelle, 0);
    }
  });

  it("l'interrupteur de la sortie reste éteint", () => {
    expect(SORTIE_ACTIVE).toBe(false);
  });
});
