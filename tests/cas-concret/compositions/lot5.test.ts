/**
 * Lot 5 des compositions « Cas concret MD » (R5) : six objets des autres offres — `calendrier`, `programme`,
 * `rapport`, `carte-taches`, `outils-relies`, `e-mail`. Les tests appellent les plans purs et lisent les fichiers
 * comme du texte.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { largeurTexte, type BoitePx } from "../../../src/briques/ecrans-motion";
import { planCalendrier } from "../../../studio-rendu/compositions/cas-concret/plans/Calendrier";
import { planCarteTaches } from "../../../studio-rendu/compositions/cas-concret/plans/CarteTaches";
import type { ProprietesObjet } from "../../../studio-rendu/compositions/cas-concret/plans/commun";
import { planEMail } from "../../../studio-rendu/compositions/cas-concret/plans/EMail";
import { planOutilsRelies, surContour } from "../../../studio-rendu/compositions/cas-concret/plans/OutilsRelies";
import { planProgramme } from "../../../studio-rendu/compositions/cas-concret/plans/Programme";
import { planRapport } from "../../../studio-rendu/compositions/cas-concret/plans/Rapport";
import { DOSSIER } from "./outils";

const FPS = 25;
const BOITE: BoitePx = { x: 0, y: 0, largeur: 520, hauteur: 600 };
const objet = (textes: string[] | undefined, t: number, boite: BoitePx = BOITE): ProprietesObjet => ({ boite, t, tVideo: t, fond: "ivoire", ...(textes ? { textes } : {}) });
const FIN = 4;

type Textes = { texte: string; boite: BoitePx; taille: number; tient: boolean; lignes?: string[] };
const dedans = (b: BoitePx, z: BoitePx) => b.x >= -0.01 && b.y >= -0.01 && b.x + b.largeur <= z.largeur + 0.01 && b.y + b.hauteur <= z.hauteur + 0.01;

/** Les textes posés par un plan (tous les champs qui portent `texte` et `boite`). */
function textesPoses(noeud: unknown, trouves: Textes[] = []): Textes[] {
  if (Array.isArray(noeud)) noeud.forEach((x) => textesPoses(x, trouves));
  else if (noeud && typeof noeud === "object") {
    const o = noeud as Record<string, unknown>;
    if (typeof o.texte === "string" && o.boite && typeof o.taille === "number") trouves.push(o as unknown as Textes);
    else Object.values(o).forEach((v) => textesPoses(v, trouves));
  }
  return trouves;
}

const OBJETS = [
  { nom: "calendrier", plan: planCalendrier, textes: ["Octobre", "14"] },
  { nom: "programme", plan: planProgramme, textes: ["Les bases", "La pratique", "Les outils", "Le suivi"] },
  { nom: "rapport", plan: planRapport, textes: ["Rapport du mois", "Heures gagnées"] },
  { nom: "carte-taches", plan: planCarteTaches, textes: ["Tâches du lundi"] },
  { nom: "outils-relies", plan: planOutilsRelies, textes: ["Agenda", "Messagerie", "Tableau"] },
  { nom: "e-mail", plan: planEMail, textes: ["Votre rendez-vous est confirmé"] },
] as const;

describe.each(OBJETS)("$nom", ({ plan, textes }) => {
  it("rend les textes fournis à la fin, et aucun avant son entrée", () => {
    const fin = plan(objet([...textes], FIN)).textes;
    expect(fin).toEqual(expect.arrayContaining([...textes]));
    expect(fin).toHaveLength(textes.length);
    const debut = plan(objet([...textes], 0)).textes;
    // Les textes qui entrent ou apparaissent plus tard ne sont pas là à l'image 0 ; ceux du fond de l'objet peuvent l'être.
    expect(debut.length).toBeLessThanOrEqual(fin.length);
  });

  it("aucun texte hors de sa boîte, ni de l'objet, à toute image et pour trois tailles", () => {
    for (const boite of [BOITE, { x: 0, y: 0, largeur: 400, hauteur: 760 }, { x: 0, y: 0, largeur: 340, hauteur: 420 }]) {
      for (const t of [0, 0.5, 1, 2, FIN]) {
        const posees = textesPoses(plan(objet([...textes], t, boite)));
        for (const x of posees) {
          expect(dedans(x.boite, boite), `${x.texte} @${t}s`).toBe(true);
          expect(x.tient, `${x.texte} @${t}s`).toBe(true);
          const lignes = x.lignes ?? [x.texte];
          expect(lignes.join(" ")).toBe(x.texte);
          for (const l of lignes) expect(largeurTexte(l, "inter-gras", x.taille)).toBeLessThanOrEqual(x.boite.largeur + 0.01);
          expect(lignes.length * x.taille * 1.2).toBeLessThanOrEqual(x.boite.hauteur + 0.01);
        }
      }
    }
  });

  it("sans texte fourni, le plan se rend sans erreur et sans texte", () => {
    const p = plan(objet(undefined, FIN));
    expect(p.textes).toEqual([]);
    expect(textesPoses(p)).toEqual([]);
  });

  it("déterministe, et même résultat par le temps ou par l'image", () => {
    expect(plan(objet([...textes], 1.2))).toEqual(plan(objet([...textes], 1.2)));
    expect(plan(objet([...textes], 99), Math.round(1.2 * FPS))).toEqual(plan(objet([...textes], 1.2)));
  });
});

describe("micro-animations", () => {
  it("calendrier : un jour s'allume, puis la coche surgit", () => {
    const c = (t: number) => planCalendrier(objet(["Octobre", "14"], t));
    expect(c(0.2).jour.progres).toBe(0);
    expect(c(0.2).coche.opacite).toBe(0);
    expect(c(0.85).jour.progres).toBeGreaterThan(0);
    expect(c(0.85).jour.progres).toBeLessThan(1);
    expect(c(FIN).jour.progres).toBe(1);
    expect(c(FIN).coche.opacite).toBe(1);
    expect(c(FIN).coche.echelle).toBeCloseTo(1, 5);
    expect(c(FIN).cellules).toHaveLength(35);
  });

  it("programme : les titres entrent un à un", () => {
    const opacites = (t: number) => planProgramme(objet(["A", "B", "C", "D"], t)).modules.map((m) => m.opacite);
    expect(opacites(0)).toEqual([0, 0, 0, 0]);
    expect(opacites(0.6).map((x) => x > 0)).toEqual([true, false, false, false]);
    expect(opacites(0.95).map((x) => x > 0)).toEqual([true, true, false, false]);
    expect(opacites(1.3).map((x) => x > 0)).toEqual([true, true, true, false]);
    expect(opacites(FIN)).toEqual([1, 1, 1, 1]);
    expect(planProgramme(objet(["A", "B", "C", "D", "E", "F"], FIN)).modules).toHaveLength(4);
  });

  it("rapport : les pages se déploient, la barre orange se remplit", () => {
    const r = (t: number) => planRapport(objet(["Rapport", "Gain"], t));
    expect(r(0).pages.map((x) => Math.abs(x.rotation))).toEqual([0, 0]);
    expect(r(0).devant.barre.largeur).toBe(0);
    expect(Math.abs(r(FIN).pages[0].rotation)).toBeGreaterThan(0);
    expect(r(FIN).pages[0].rotation).toBe(-r(FIN).pages[1].rotation);
    expect(r(FIN).devant.barre.largeur).toBeGreaterThan(0);
    expect(r(FIN).devant.barre.largeur).toBeLessThan(r(FIN).devant.piste.boite.largeur);
  });

  it("carte-taches : douze cases, trois passent à l'orange", () => {
    const k = (t: number) => planCarteTaches(objet(["Tâches"], t));
    expect(k(0).cases).toHaveLength(12);
    expect(k(0).nombreOrange).toBe(0);
    expect(k(0.85).nombreOrange).toBe(0);
    expect(k(FIN).nombreOrange).toBe(3);
    expect(k(FIN).cases.filter((x) => x.orange >= 1).map((x) => x.index)).toEqual([1, 6, 10]);
  });

  it("outils-relies : trois pastilles nommées, un fil, un point qui circule", () => {
    const o = (t: number) => planOutilsRelies(objet(["A", "B", "C"], t));
    expect(o(0).pastilles.map((x) => x.opacite)).toEqual([0, 0, 0]);
    expect(o(0).fil.trace).toBe(0);
    expect(o(0).point.visible).toBe(false);
    expect(o(FIN).pastilles.map((x) => x.texte?.texte)).toEqual(["A", "B", "C"]);
    expect(o(FIN).fil.trace).toBe(1);
    expect(o(FIN).point.visible).toBe(true);
    expect(o(FIN + 0.5).point.x).not.toBe(o(FIN).point.x);
    // Le point reste sur le contour du fil.
    const pts = o(FIN).fil.points;
    expect(surContour(pts, 0)).toEqual(pts[0]);
    expect(surContour(pts, 1)).toEqual(pts[0]);
  });

  it("e-mail : le rabat s'ouvre, le message sort avec son objet, la coche surgit", () => {
    const m = (t: number) => planEMail(objet(["Confirmé"], t));
    expect(m(0).rabat.echelleY).toBe(1);
    expect(m(0).message.visible).toBe(false);
    expect(m(0).textes).toEqual([]);
    expect(m(FIN).rabat.echelleY).toBe(-1);
    expect(m(FIN).message.visible).toBe(true);
    expect(m(FIN).message.boite.y).toBeLessThan(m(0).message.boite.y);
    expect(m(FIN).textes).toEqual(["Confirmé"]);
    expect(m(FIN).coche.opacite).toBe(1);
  });
});

describe("fichiers du lot", () => {
  const noms = ["Calendrier", "Programme", "Rapport", "CarteTaches", "OutilsRelies", "EMail"];
  const fichiers = [...noms.map((n) => `plans/${n}.ts`), ...noms.map((n) => `objets/${n}.tsx`)];
  const lire = (f: string) => readFileSync(join(DOSSIER, f), "utf8");

  it("les douze fichiers existent et portent une fonction `plan…` (plans) ou le composant (objets)", () => {
    for (const n of noms) {
      expect(lire(`plans/${n}.ts`)).toMatch(new RegExp(`export function plan${n}\\(`));
      expect(lire(`objets/${n}.tsx`)).toMatch(new RegExp(`export function ${n}\\(`));
    }
  });

  it("aucune couleur ni police en dur", () => {
    for (const f of fichiers) {
      const t = lire(f);
      expect(t.match(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/gi) ?? [], f).toEqual([]);
      expect(t.match(/["'`][^"'`\n]*\b(Anton|Inter|Arial|Helvetica|serif)\b/g) ?? [], f).toEqual([]);
    }
  });

  it("aucun personnage, aucune silhouette, aucun visage, aucun logo", () => {
    for (const f of fichiers) expect(lire(f).match(/personnage|silhouette|visage|logo/gi) ?? [], f).toEqual([]);
  });

  it("les plans sont purs, sans hasard ni date", () => {
    for (const f of fichiers.filter((x) => x.startsWith("plans/"))) {
      const t = lire(f);
      expect(t.match(/from\s+["'](remotion|react)/g) ?? [], f).toEqual([]);
      expect(t.match(/Math\.random|Date\.now|new Date/g) ?? [], f).toEqual([]);
    }
  });
});
