import { describe, expect, it } from "vitest";
import { avecEmpreintes, scenesARerendre } from "../../src/briques/plan-scenes/empreinte";
import { empreinteRendu, scenesARedessiner } from "../../src/briques/plan-scenes/empreinte-rendu";
import type { MotMinute, PlanDeScenes, ScenePlan } from "../../src/briques/plan-scenes/schema";
import { VERSION_PLAN_SCENES } from "../../src/briques/plan-scenes/schema";

const TAILLES = [4, 4, 4, 4, 4]; // 5 scènes de 4 mots
const transition = { entree: "glisse-haut", sortie: "fondu", dureeMs: 400 } as const;

function construire(tailles: number[], texteScene: Record<number, string> = {}, mot: (i: number) => string = (i) => `mot${i}`): PlanDeScenes {
  const mots: MotMinute[] = [];
  const scenes: ScenePlan[] = [];
  let t = 1000;
  tailles.forEach((n, k) => {
    const premier = mots.length;
    const debut = t;
    for (let j = 0; j < n; j++) {
      mots.push({ texte: mot(mots.length), debutMs: t, finMs: t + 300 });
      t += 400;
    }
    scenes.push({
      id: `s${k + 1}`, version: 1, mots: { premier, dernier: mots.length - 1 }, debutMs: debut, finMs: t, niveau: 1, position: "centre", transition,
      texte: texteScene[k + 1], piece: "carte-kpi",
      parametres: { libelle: "Devis", valeur: 38, prefixe: "+", suffixe: " %", decimales: 0, tendance: "hausse", variation: "vs septembre" },
    } as ScenePlan);
  });
  return { version: VERSION_PLAN_SCENES, format: { largeur: 1080, hauteur: 1920, fps: 25 }, facecam: false, dureeMs: t + 500, habillage: { fond: "ivoire", accent: "terracotta" }, mots, scenes };
}

// Le mot « coupé » : on retire 2 mots de la scène 2 (les mots restants gardent leur texte, tout se décale).
function planCoupe(): PlanDeScenes {
  const noms = (i: number) => `mot${i < 6 ? i : i + 2}`;
  return construire([4, 2, 4, 4, 4], {}, noms);
}

describe("empreinteRendu / scenesARedessiner", () => {
  const ancien = construire(TAILLES);

  it("même plan : rien à redessiner", () => {
    expect(scenesARedessiner(ancien, construire(TAILLES))).toEqual([]);
  });

  it("couper 2 mots dans la scène 2 : scenesARerendre = [2,3,4,5] (constat), scenesARedessiner = [2]", () => {
    const coupe = planCoupe();
    expect(scenesARerendre(avecEmpreintes(ancien), avecEmpreintes(coupe))).toEqual(["s2", "s3", "s4", "s5"]);
    expect(scenesARedessiner(ancien, coupe)).toEqual(["s2"]);
  });

  it("changer le texte de la scène 4 : [s4]", () => {
    expect(scenesARedessiner(ancien, construire(TAILLES, { 4: "Nouveau titre" }))).toEqual(["s4"]);
  });

  it("changer l'habillage : toutes les scènes", () => {
    const autre = { ...construire(TAILLES), habillage: { fond: "noir", accent: "orange" } } as PlanDeScenes;
    expect(scenesARedessiner(ancien, autre)).toEqual(["s1", "s2", "s3", "s4", "s5"]);
  });

  it("empreinteRendu ignore les temps absolus, la version et l'empreinte", () => {
    const a = ancien.scenes[2]!;
    const decale = { ...a, debutMs: a.debutMs + 777, finMs: a.finMs + 777, version: 9 } as ScenePlan;
    const p2 = { ...ancien, mots: ancien.mots.map((m) => ({ ...m, debutMs: m.debutMs + 777, finMs: m.finMs + 777 })) };
    expect(empreinteRendu(decale, p2)).toBe(empreinteRendu(a, ancien));
  });

  it("empreinteRendu change si la durée ou un mot lu change", () => {
    const a = ancien.scenes[2]!;
    expect(empreinteRendu({ ...a, finMs: a.finMs + 40 }, ancien)).not.toBe(empreinteRendu(a, ancien));
    expect(empreinteRendu(a, construire(TAILLES, {}, (i) => (i === 9 ? "autre" : `mot${i}`)))).not.toBe(empreinteRendu(a, ancien));
  });

  it("scène renommée : redessinée (l'id fait partie du contenu)", () => {
    const renomme = { ...ancien, scenes: ancien.scenes.map((s, i) => (i === 4 ? { ...s, id: "s9" } : s)) } as PlanDeScenes;
    expect(scenesARedessiner(ancien, renomme)).toEqual(["s9"]);
  });
});
