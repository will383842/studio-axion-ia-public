/**
 * Crayon du tableau animé (reprise visuelle) : calcul sur les boîtes, image par image, sur les 4 fiches d'exemple et
 * les variantes que le calage accepte. Le corps du crayon ne recouvre JAMAIS un texte déjà écrit (seule la cible d'une
 * marque, que le crayon vise, peut l'être ; le cône taillé, qui touche la page là où il écrit, n'est pas compté) ; il
 * part de la pointe vers le bas à droite par défaut ; il reste dans l'image ; au repos, il est dans la marge droite.
 */
import { describe, expect, it } from "vitest";
import { polygoneDans, polygoneTouche } from "../../../src/briques/stylo/empreinte";
import { stylo } from "../../../src/briques/stylo/registre";
import { empreinte, planifierScene, poseStylo, textesEcrits, type Action, type PlanScene } from "../../../studio-rendu/compositions/tableau/plan";
import type { ProprietesTableauScene } from "../../../studio-rendu/compositions/tableau/types";
import { VARIANTES } from "../mise-en-page/variantes";
import { EXEMPLES } from "../regles/exemples";
import { scenesExemple } from "../compositions/outils";

/** Élément que le crayon a le droit de toucher : la cible de la marque en cours, ou (en trajet) de celle d'avant et d'après. */
function permis(p: ProprietesTableauScene, plan: PlanScene, t: number): string[] {
  const actions = plan.actions.filter((a) => a.duree > 0);
  const cible = (a: Action | undefined) => {
    if (!a || a.sorte === "ecrire" || a.sorte === "dessiner" || a.sorte === "cadre" || a.sorte === "tourner") return [];
    return [p.page.gestes.find((g) => g.elementId === a.elementId)?.cibleId ?? a.elementId];
  };
  const enCours = actions.find((a) => t >= a.debut && t < a.debut + a.duree);
  if (enCours) return cible(enCours);
  return [...cible(actions.filter((a) => a.debut + a.duree <= t).at(-1)), ...cible(actions.find((a) => a.debut > t))];
}

function verifier(scenes: ProprietesTableauScene[]) {
  const sur: string[] = [];
  const hors: string[] = [];
  for (const p of scenes) {
    const plan = planifierScene(p);
    const tourner = plan.actions.find((a) => a.sorte === "tourner");
    for (let i = 0; i < plan.images; i++) {
      const t = i / plan.fps;
      if (tourner && t < tourner.debut + tourner.duree) continue;
      const { pointe, angle } = poseStylo(plan, t);
      const corps = empreinte(plan, pointe, angle, true);
      const ok = permis(p, plan, t);
      for (const m of textesEcrits(plan, t)) if (!ok.includes(m.elementId) && polygoneTouche(corps, m.px)) sur.push(`${p.scene.id} image ${i} : sur « ${m.elementId} » (${m.partie})`);
      if (!polygoneDans(empreinte(plan, pointe, angle), { x: 0, y: 0, largeur: plan.largeur, hauteur: plan.hauteur })) hors.push(`${p.scene.id} image ${i}`);
    }
  }
  return { sur, hors };
}

describe.each(Object.entries(EXEMPLES))("fiche d'exemple %s", (_nom, fiche) => {
  const scenes = scenesExemple(fiche);

  it("le crayon ne recouvre jamais un texte déjà écrit et reste entièrement dans l'image, à chaque image", () => {
    const { sur, hors } = verifier(scenes);
    expect(sur).toEqual([]);
    expect(hors).toEqual([]);
  });

  it("au repos, le crayon est dans la marge droite, hors de tout texte, le corps vers le bas", () => {
    for (const p of scenes) {
      const plan = planifierScene(p);
      expect(plan.repos.x).toBeGreaterThan(p.cadre.px.x + p.cadre.px.largeur);
      expect(plan.angleRepos).toBeGreaterThan(90);
      expect(plan.angleRepos).toBeLessThan(180);
      const poly = empreinte(plan, plan.repos, plan.angleRepos);
      for (const e of p.page.elements) expect(polygoneTouche(poly, e.px)).toBe(false);
    }
  });

  it("pendant l'écriture, le corps part de la pointe vers le bas à droite dans la plupart des cas", () => {
    const ecritures = scenes.flatMap((p) => planifierScene(p).actions.filter((a) => a.sorte === "ecrire"));
    const basDroite = ecritures.filter((a) => a.angle > 90 && a.angle < 180);
    expect(basDroite.length / ecritures.length).toBeGreaterThanOrEqual(0.9);
  });
});

describe("variantes de la mise en page que le calage accepte", () => {
  const calees = VARIANTES.flatMap((v) => {
    try {
      return [{ nom: v.nom, scenes: scenesExemple(v.fiche) }];
    } catch {
      return []; // règle 4 de la fiche (largeur d'une ligne d'un seul tenant) : variante non calable, hors sujet ici
    }
  });

  it("au moins 10 variantes, et le crayon n'y recouvre jamais un texte déjà écrit", () => {
    expect(calees.length).toBeGreaterThanOrEqual(10);
    for (const v of calees) expect(verifier(v.scenes).sur, v.nom).toEqual([]);
  });

  it("il ne sort presque jamais de l'image (moins de 0,5 % des images)", () => {
    let total = 0;
    let hors = 0;
    for (const v of calees) {
      total += v.scenes.reduce((n, p) => n + planifierScene(p).images, 0);
      hors += verifier(v.scenes).hors.length;
    }
    expect(hors / total).toBeLessThan(0.005);
  });
});

describe("stylo", () => {
  it("le crayon/1 est incliné au repos vers le bas à droite et son empreinte part de la pointe dans ce sens", () => {
    const s = stylo("crayon/1");
    expect(s.angle).toBeGreaterThan(90);
    expect(s.angle).toBeLessThan(180);
    const plan = { stylo: "crayon/1", hauteurStylo: 300 };
    const poly = empreinte(plan, { x: 500, y: 500 }, s.angle);
    // La pointe est un sommet ; tout le reste est en bas à droite d'elle.
    expect(poly.some((q) => Math.hypot(q.x - 500, q.y - 500) < 1e-6)).toBe(true);
    for (const q of poly) {
      expect(q.x).toBeGreaterThanOrEqual(500 - 20);
      expect(q.y).toBeGreaterThanOrEqual(500 - 20);
    }
  });
});
