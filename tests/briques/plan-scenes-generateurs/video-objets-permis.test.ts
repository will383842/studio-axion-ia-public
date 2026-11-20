/**
 * C9-37-a-v19c : `planPourVideo` accepte `objetsPermis` (facultatif). Personne ne le passe encore.
 * (a) absent ou vide = identique ; (b) liste donnée = règles fixes posent un objet ; (c) mémo ; (d) appelants sans la liste.
 * Aucun appel réel : Claude est simulé.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { planPourVideo, type MotEnSecondes } from "@/briques/plan-scenes-generateurs/video";
import type { FormatPlan } from "@/briques/plan-scenes/schema";
import type { RequeteClaude, ReponseClaude } from "@/fournisseurs/claude/client";

const FORMAT: FormatPlan = { largeur: 1080, hauteur: 1920, fps: 25 };
const SCRIPT = "Nous avons gagné 42 heures cette semaine.";
const mots: MotEnSecondes[] = SCRIPT.split(" ").map((texte, i) => ({ texte, debutSec: (i * 350) / 1000, finSec: (i * 350 + 300) / 1000 }));
const dureeSec = mots.at(-1)!.finSec;
// Les règles fixes ne posent pas de gros chiffre ici (le plan de repli couvre déjà le nombre dit : jauge/compteur) : on prend la règle « c'est fait » → coche (tests/plan-scenes-objets/regles.test.ts).
const MOTS_POSE: MotEnSecondes[] = "voilà le dossier est envoyé c'est fait".split(" ").map((texte, i) => ({ texte, debutSec: (i * 350) / 1000, finSec: (i * 350 + 300) / 1000 }));
const dureePose = MOTS_POSE.at(-1)!.finSec;
const lire = (chemin: string) => readFileSync(new URL(`../../../${chemin}`, import.meta.url), "utf8");

function faux() {
  const appels: RequeteClaude[] = [];
  const appeler = async (req: RequeteClaude): Promise<ReponseClaude> => {
    appels.push(req);
    const plan = { version: "plan-scenes-1", scenes: [{ id: "a", version: 1, mots: { premier: 0, dernier: 5 }, debutMs: 0, finMs: 2000, niveau: 1, position: "centre", piece: "carte-kpi", parametres: { valeur: "42", etiquette: "heures" } }] };
    return { texte: JSON.stringify(plan), stopReason: "end_turn" } as ReponseClaude;
  };
  return { appels, appeler };
}

describe("(a) éteint = identique", () => {
  for (const generateur of ["facecam", "facecam-animee"] as const) {
    const base = { generateur, mots, dureeSec, facecam: true, format: FORMAT };
    it(`${generateur} : sans LLM, liste absente = liste vide`, async () => {
      const a = await planPourVideo(base);
      const b = await planPourVideo({ ...base, objetsPermis: [] });
      expect(b).toEqual(a);
      expect(b.entree).toBe(a.entree);
      expect((a.plan?.scenes ?? []).some((s) => s.piece.startsWith("objet-"))).toBe(false);
    });
    it(`${generateur} : avec faux Claude, même entrée, même texte système au caractère près`, async () => {
      const f1 = faux();
      const f2 = faux();
      const a = await planPourVideo({ ...base, appeler: f1.appeler });
      const b = await planPourVideo({ ...base, appeler: f2.appeler, objetsPermis: [] });
      expect(b).toEqual(a);
      expect(f1.appels.length).toBeGreaterThan(0);
      expect(JSON.stringify(f2.appels)).toBe(JSON.stringify(f1.appels));
      expect(JSON.stringify(f1.appels)).not.toContain("objet-");
    });
  }
});

describe("(b) liste donnée : l'entrée change et les règles fixes posent l'objet", () => {
  it("objet-coche permis → scène objet-coche", async () => {
    const base = { generateur: "facecam" as const, mots: MOTS_POSE, dureeSec: dureePose, facecam: false, format: FORMAT };
    const sans = await planPourVideo(base);
    const avec = await planPourVideo({ ...base, objetsPermis: ["objet-coche"] });
    expect(avec.entree).not.toBe(sans.entree);
    expect((sans.plan?.scenes ?? []).some((s) => s.piece.startsWith("objet-"))).toBe(false);
    expect(avec.plan?.scenes.some((s) => s.piece === "objet-coche")).toBe(true);
  });
});

describe("(c) mémo", () => {
  it("un mémo sans liste n'est pas repris avec la liste ; un mémo avec la liste est repris (0 appel)", async () => {
    const base = { generateur: "facecam" as const, mots: MOTS_POSE, dureeSec: dureePose, facecam: false, format: FORMAT };
    const liste = ["objet-coche"];
    const sans = await planPourVideo({ ...base, appeler: faux().appeler });
    const f = faux();
    const avec = await planPourVideo({ ...base, appeler: f.appeler, objetsPermis: liste, memo: sans });
    expect(avec.entree).not.toBe(sans.entree);
    expect(f.appels.length).toBeGreaterThan(0);
    const reprise = faux();
    const encore = await planPourVideo({ ...base, appeler: reprise.appeler, objetsPermis: liste, memo: avec });
    expect(reprise.appels).toHaveLength(0);
    expect(encore).toBe(avec);
  });
});

// FIX-GARDE-OBJETS-PERMIS-v20f (20/11) : l'ancienne attente « aucune chaîne ne passe objetsPermis » datait d'avant
// C9-37-b (#1410) et C9-37-c (#1397), qui branchent la liste (vide par défaut). Remplacée par une attente au moins
// aussi stricte : chaque appel passe `objetsPermis`, et la valeur vient de la source réelle (jamais une liste en dur).
describe("(d) les appelants passent la liste venue de leur port, vide par défaut", () => {
  it.each([
    ["src/moteurs/montage-facecam/chaine.ts", "piecesPermisesDesEntrees(c.entrees)"],
    ["src/moteurs/montage-facecam-animee/chaine-v4.ts", "outils.planScenes.objetsPermis"],
  ])("%s : chaque appel planPourVideo( contient objetsPermis tiré de %s", (f, source) => {
    const texte = lire(f);
    const appels = texte.split("\n").filter((l) => l.includes("planPourVideo({"));
    expect(appels.length).toBeGreaterThan(0);
    for (const l of appels) {
      expect(l).toContain("objetsPermis");
      expect(l).toContain(source);
      expect(l).not.toMatch(/objetsPermis\s*:\s*\[/); // pas de liste écrite en dur
    }
  });
});
