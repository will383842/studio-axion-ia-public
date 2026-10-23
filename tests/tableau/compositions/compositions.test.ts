/**
 * Compositions du tableau animé (TB-05) : propriétés par défaut valides, propriétés tirées des 4 fiches d'exemple
 * (calage + mise en page), plan de chaque scène (ordre, heures, fin écrite à la dernière image, page qui se remplit
 * sans effacer, accroche visible dès la première image, crayon jamais immobile plus de 2 s, rien dans la bande des
 * sous-titres), déterminisme, et garde-fous du code (aucune couleur ni police en dur, rien de `src/moteurs/`).
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COULEURS_VIDEO } from "../../../src/briques/habillage/charte-video";
import { mettreEnPage, type MiseEnPageTableau as MiseEnPageMoteur } from "../../../src/moteurs/montage-tableau/mise-en-page";
import type { ElementCale as ElementCaleMoteur } from "../../../src/moteurs/montage-tableau/calage";
import { BULLE_EXEMPLE, LIGNE_EXEMPLE, SCENE_EXEMPLE } from "../../../studio-rendu/compositions/tableau/exemples";
import { avancement, dateTest, disposerBulle, planifierScene, planPagePleine, positionStylo, REGLAGES_TABLEAU, type PlanScene } from "../../../studio-rendu/compositions/tableau/plan";
import { controlerProprietes, imagesScene } from "../../../studio-rendu/compositions/tableau/proprietes";
import type { ElementCale, MiseEnPageTableau } from "../../../studio-rendu/compositions/tableau/types";
import { texteChiffre } from "../../../studio-rendu/compositions/tableau/textes-chiffres";
import { EXEMPLES, ficheErreurCorrigee } from "../regles/exemples";
import { scenesExemple } from "./outils";

const DOSSIER = join(process.cwd(), "studio-rendu/compositions/tableau");
/** Code des compositions, sans les commentaires (ils peuvent nommer une police ou une couleur). */
const sansCommentaires = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
/** Brique pure où vivent désormais `types`, `plan` et `proprietes` (ré-exportés par le dossier des compositions). */
const BRIQUE = join(process.cwd(), "src/briques/tableau-scene");
const sources = () =>
  [DOSSIER, BRIQUE].flatMap((d) => readdirSync(d).filter((f) => /\.tsx?$/.test(f)).map((f) => ({ f: d === BRIQUE ? `tableau-scene/${f}` : f, texte: sansCommentaires(readFileSync(join(d, f), "utf8")) })));

/** Instants de chaque image d'une scène. */
const instants = (plan: PlanScene) => Array.from({ length: plan.images }, (_, i) => i / plan.fps);
const derniere = (plan: PlanScene) => (plan.images - 1) / plan.fps;

describe("types recopiés", () => {
  it("la sortie de la mise en page et les heures du calage entrent telles quelles", () => {
    const mp: MiseEnPageMoteur = mettreEnPage(ficheErreurCorrigee);
    const copie: MiseEnPageTableau = mp;
    const h: ElementCaleMoteur = { elementId: "e01", sceneId: "s01", debutMs: 0 };
    const hc: ElementCale = h;
    expect(copie.pages.length).toBeGreaterThan(0);
    expect(hc.debutMs).toBe(0);
  });
});

describe("propriétés par défaut de chaque composition", () => {
  it.each([
    ["TableauScene", SCENE_EXEMPLE],
    ["TableauLigneEcrite", LIGNE_EXEMPLE],
    ["TableauBullePreuve", BULLE_EXEMPLE],
  ] as const)("%s : valides, 1080 × 1920 à 25 i/s, durée = fin − début", (_id, p) => {
    expect(controlerProprietes(p)).toEqual([]);
    expect(imagesScene(p)).toBe(Math.round(((p.scene.finMs - p.scene.debutMs) / 1000) * 25));
    const plan = planifierScene(p);
    expect(plan.actions.length).toBeGreaterThan(0);
    for (const a of plan.actions) expect(a.debut + a.duree).toBeLessThanOrEqual(derniere(plan) + 1e-9);
  });

  it("la bulle d'exemple montre la phrase testée, sa ligne de résultat surlignée et « Testé le 09/10 »", () => {
    const plan = planifierScene(BULLE_EXEMPLE);
    const b = plan.bulles.e10;
    expect(b.omis).toEqual([]);
    expect(b.phrase.map((l) => l.texte).join(" ")).toBe("« Posez une question fermée »");
    expect(b.date?.texte).toBe("Testé le 09/10");
    expect(plan.actions.filter((a) => a.partie.startsWith("surligne:"))).toHaveLength(1);
    expect(b.cadre.y + b.cadre.hauteur).toBeLessThanOrEqual(BULLE_EXEMPLE.bandeSousTitres.px.y);
  });

  it("le mot important de la ligne d'exemple est souligné dès que sa ligne est écrite, puis la ligne", () => {
    const plan = planifierScene(LIGNE_EXEMPLE);
    const parties = plan.actions.map((a) => a.partie);
    expect(parties).toEqual(["ligne:0", "important:0", "marque:0", "ligne:1", "marque:1"]);
    expect(plan.actions[0].debut).toBeCloseTo(0.3, 9);
  });
});

describe.each(Object.entries(EXEMPLES))("fiche d'exemple %s", (_nom, fiche) => {
  const scenes = scenesExemple(fiche, { e06: ["questions"] });

  it("une scène = une composition, propriétés valides", () => {
    expect(scenes.map((s) => s.scene.id)).toEqual(fiche.scenes.map((s) => s.id));
    for (const p of scenes) expect(controlerProprietes(p)).toEqual([]);
    // Les scènes se suivent : la somme des durées = la durée de la voix.
    expect(scenes.reduce((n, p) => n + (p.scene.finMs - p.scene.debutMs), 0)).toBe(scenes.at(-1)!.scene.finMs);
  });

  it("la page se remplit sans effacer : ce que les scènes précédentes de la page ont écrit est là dès la première image", () => {
    scenes.forEach((p, k) => {
      const plan = planifierScene(p);
      const avant = scenes.slice(0, k).filter((x) => x.scene.page === p.scene.page).map((x) => x.scene.id);
      const attendus = [...p.page.elements, ...p.page.gestes].filter((e) => avant.includes(e.sceneId)).map((e) => e.elementId);
      expect([...p.dejaEcrits].sort()).toEqual(attendus.sort());
      for (const id of attendus) expect(avancement(plan, id, "ligne:0", 0)).toBe(1);
      // Rien d'une scène suivante de la page.
      const apres = p.page.elements.filter((e) => !avant.includes(e.sceneId) && e.sceneId !== p.scene.id);
      for (const e of apres) expect(plan.etats[e.elementId]).toBeUndefined();
    });
  });

  it("chaque action part au plus tôt à l'heure de son élément, une à la fois, et tout est écrit à la dernière image", () => {
    for (const p of scenes) {
      const plan = planifierScene(p);
      const heures = new Map(p.heures.map((h) => [h.elementId, (h.debutMs - p.scene.debutMs) / 1000]));
      const fin = derniere(plan);
      let precedent = -Infinity;
      for (const a of plan.actions) {
        if (a.sorte !== "tourner") expect(a.debut).toBeGreaterThanOrEqual(Math.min(heures.get(a.elementId)!, fin) - 1e-9);
        expect(a.debut).toBeGreaterThanOrEqual(precedent - 1e-9);
        precedent = a.debut + a.duree;
        expect(a.debut + a.duree).toBeLessThanOrEqual(fin + 1e-9);
        if (a.sorte !== "tourner") expect(avancement(plan, a.elementId, a.partie, fin)).toBe(1);
      }
      expect(plan.reduction).toBeGreaterThanOrEqual(REGLAGES_TABLEAU.reductionMin);
    }
  });

  it("une scène qui ouvre une nouvelle page la fait glisser d'un geste du crayon en 0,3 s ; jamais sur la page 1", () => {
    scenes.forEach((p, k) => {
      const plan = planifierScene(p);
      const tourner = plan.actions.filter((a) => a.sorte === "tourner");
      const nouvelle = k > 0 && scenes[k - 1].scene.page !== p.scene.page;
      expect(tourner.length).toBe(nouvelle ? 1 : 0);
      if (nouvelle) {
        expect(tourner[0]).toMatchObject({ debut: 0, duree: REGLAGES_TABLEAU.tournerSec });
        expect(p.pagePrecedente?.page).toBe(scenes[k - 1].scene.page);
        // Aucune écriture pendant le geste ; la page tournée est pleine.
        for (const a of plan.actions.filter((x) => x.sorte !== "tourner")) expect(a.debut).toBeGreaterThanOrEqual(REGLAGES_TABLEAU.tournerSec);
        const pleine = planPagePleine(p, p.pagePrecedente!);
        expect(Object.values(pleine.etats).every((e) => e === "deja")).toBe(true);
        expect(pleine.actions).toEqual([]);
      }
    });
  });

  it("le crayon ne reste jamais immobile plus de 2 s et ne descend jamais dans la bande des sous-titres", () => {
    for (const p of scenes) {
      const plan = planifierScene(p);
      const pos = instants(plan).map((t) => positionStylo(plan, t));
      const bande = p.bandeSousTitres.px;
      for (const q of pos) expect(q.y).toBeLessThan(bande.y);
      const fenetre = 2 * plan.fps;
      for (let i = 0; i + fenetre < pos.length; i++) {
        const bouge = pos.slice(i, i + fenetre + 1).some((q, j, t) => j > 0 && Math.hypot(q.x - t[j - 1].x, q.y - t[j - 1].y) > 0.5);
        expect(bouge, `${p.scene.id} immobile à partir de l'image ${i}`).toBe(true);
      }
    }
  });

  it("rien ne se dessine dans la bande des sous-titres (éléments, bulles, cibles des gestes)", () => {
    for (const p of scenes) {
      const plan = planifierScene(p);
      const bande = p.bandeSousTitres.px.y;
      for (const e of p.page.elements) expect(e.px.y + e.px.hauteur).toBeLessThanOrEqual(bande);
      for (const b of Object.values(plan.bulles)) expect(b.cadre.y + b.cadre.hauteur).toBeLessThanOrEqual(bande);
      for (const a of plan.actions) if (a.sorte !== "tourner" && a.sorte !== "souligner") expect(a.cible.y + a.cible.hauteur).toBeLessThanOrEqual(bande);
    }
  });

  it("déterministe : deux plans de la même scène sont identiques, image par image", () => {
    for (const p of scenes) {
      const a = planifierScene(structuredClone(p));
      const b = planifierScene(structuredClone(p));
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      expect(instants(a).map((t) => positionStylo(a, t))).toEqual(instants(b).map((t) => positionStylo(b, t)));
    }
  });
});

describe("première image de la vidéo", () => {
  it.each(Object.entries(EXEMPLES))("%s : l'accroche est entièrement écrite dès l'image 0", (_nom, fiche) => {
    const p = scenesExemple(fiche)[0];
    expect(p.scene.premiere).toBe(true);
    const plan = planifierScene(p);
    const accroche = p.page.elements.filter((e) => e.sceneId === p.scene.id && p.heures.find((h) => h.elementId === e.elementId)!.debutMs === p.scene.debutMs);
    expect(accroche.some((e) => e.type === "ligne")).toBe(true);
    for (const e of accroche) {
      e.lignes.forEach((_, i) => expect(avancement(plan, e.elementId, `ligne:${i}`, 0)).toBe(1));
      expect(plan.actions.some((a) => a.elementId === e.elementId && a.sorte === "ecrire")).toBe(false);
    }
  });

  it("une scène suivante, elle, part d'une ligne vide (l'écriture se voit)", () => {
    const p = scenesExemple(ficheErreurCorrigee)[1];
    const plan = planifierScene(p);
    expect(avancement(plan, "e03", "ligne:0", 0)).toBe(0);
  });
});

describe("pièces", () => {
  it("bulle : sans place, la phrase et la date sont omises et nommées ; jamais de chevauchement", () => {
    const el = { px: { x: 141, y: 345, largeur: 669, hauteur: 236 } };
    const d = disposerBulle(el, { phrase: "Posez une question fermée", testeLe: "2026-10-09" }, 1920, 1080, 0, 0);
    expect(d.omis).toEqual(["phrase", "date"]);
    expect(d.cadre).toEqual(el.px);
    expect(dateTest("2026-01-05")).toBe("Testé le 05/01");
  });

  it("chiffre qui compte : de 0 à sa valeur, même écriture à la fin", () => {
    expect(texteChiffre("2 jours", 0)).toBe("0 jours");
    expect(texteChiffre("2 jours", 1)).toBe("2 jours");
    expect(texteChiffre("12,5 %", 0.999)).toMatch(/^\d+,\d %$/);
    expect(texteChiffre("sans nombre", 0.5)).toBe("sans nombre");
  });
});

describe("garde-fous du code des compositions", () => {
  it("aucune couleur ni police en dur : tout vient de l'habillage", () => {
    for (const { f, texte } of sources()) {
      if (f === "exemples.ts") continue;
      expect(texte.match(/#[0-9a-f]{3,8}\b/gi) ?? [], f).toEqual([]);
      expect(texte.match(/rgba?\(|hsl\(|["'`][^"'`\n]*\b(Montserrat|Inter|Poppins)\b/g) ?? [], f).toEqual([]);
    }
    // L'orange n'est jamais une couleur de texte.
    const ligne = sources().find((s) => s.f === "LigneEcrite.tsx")!.texte;
    expect(ligne).toContain("color: COULEURS_VIDEO.ecriture");
    expect(ligne).not.toContain("soulignement");
    expect(COULEURS_VIDEO.ecriture).not.toBe(COULEURS_VIDEO.soulignement);
  });

  it("rien de `src/moteurs/`, aucun alias « @/ », aucun hasard ni horloge", () => {
    for (const { f, texte } of sources()) {
      expect(texte, f).not.toMatch(/from\s+["'][^"']*moteurs\//);
      expect(texte, f).not.toMatch(/from\s+["']@\//);
      expect(texte, f).not.toMatch(/Math\.random|Date\.now|new Date|performance\.now/);
    }
  });

  it("seulement des briques copiées dans l'image de rendu (habillage, stylo, dessins/traces, motion, sous-titres, tableau-scene)", () => {
    const permis = /^\.\.\/\.\.\/\.\.\/src\/briques\/(habillage|stylo|motion|sous-titres|tableau-scene)\/|^\.\.\/\.\.\/\.\.\/src\/briques\/dessins\/traces$/;
    for (const { f, texte } of sources()) {
      for (const m of texte.matchAll(/from\s+["'](\.\.\/\.\.\/\.\.\/[^"']+)["']/g)) expect(m[1], f).toMatch(permis);
    }
  });

  it("une seule composition de scène, inscrite par `tableau/Compositions.tsx`", () => {
    const racine = readFileSync(join(process.cwd(), "studio-rendu/compositions/Racine.tsx"), "utf8");
    expect(racine.match(/CompositionsTableau/g)).toHaveLength(2);
    const compositions = readFileSync(join(DOSSIER, "Compositions.tsx"), "utf8");
    expect(compositions).toContain("component={TableauScene}");
  });
});
