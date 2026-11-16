import { describe, expect, it } from "vitest";
import { avecArtefacts, artefactsTutoriel } from "@/moteurs/montage-tutoriel-outil/artefacts-retouche";
import { etapesTutoriel } from "@/moteurs/montage-tutoriel-outil/etapes-tutoriel";
import { lireProjetTutoriel } from "@/moteurs/montage-tutoriel-outil";
import { avecEmpreintes, scenesARerendre } from "../../src/briques/plan-scenes/empreinte";
import { VERSION_PLAN_SCENES, type PlanDeScenes, type ScenePlan } from "../../src/briques/plan-scenes/schema";
import { SCRIPT } from "./doubles";

const transition = { entree: "glisse-haut", sortie: "fondu", dureeMs: 400 } as const;
function plan(): PlanDeScenes {
  const mots = Array.from({ length: 8 }, (_, i) => ({ texte: `m${i}`, debutMs: 1000 + i * 400, finMs: 1300 + i * 400 }));
  const scene = (id: string, premier: number, dernier: number) =>
    ({ id, version: 1, mots: { premier, dernier }, debutMs: mots[premier].debutMs, finMs: mots[dernier].finMs, niveau: 1, position: "centre", transition, piece: "carte-kpi",
      parametres: { libelle: "Devis", valeur: 38, prefixe: "+", suffixe: " %", decimales: 0, tendance: "hausse", variation: "vs septembre" } }) as ScenePlan;
  return { version: VERSION_PLAN_SCENES, format: { largeur: 1080, hauteur: 1920, fps: 25 }, facecam: false, dureeMs: 5000, habillage: { fond: "ivoire", accent: "terracotta" }, mots, scenes: [scene("s1", 0, 3), scene("s2", 4, 7)] };
}

const valide = avecEmpreintes(plan());
const projetAncien = () => ({ script: "s", audio: { fournisseur: "x", caracteres: 3 }, sousTitres: { a: 1 }, motsPlan: [{ mot: "a" }], plan: { plan: valide, source: "claude" } });
const mots = SCRIPT.split(/\s+/).map((mot, i) => ({ mot, debutSec: i, finSec: i + 0.5 }));

describe("clé de reprise : les champs neufs ne gênent pas (G5-06)", () => {
  it("projet sans nouveaux champs : lireProjetTutoriel rend le même objet", () => {
    const p = projetAncien();
    expect(lireProjetTutoriel({ tutoriel: p })).toBe(p);
    expect(lireProjetTutoriel(undefined)).toBeNull();
  });
  it("avecArtefacts(p, {}) égal à p", () => {
    const p = projetAncien();
    expect(avecArtefacts(p, {})).toEqual(p);
  });
  it("avec artefacts ajoutés, les cinq champs lus sont les mêmes", () => {
    const p = projetAncien();
    const a = artefactsTutoriel(etapesTutoriel({ script: SCRIPT, mots, dureeSec: 60 }));
    const lu = lireProjetTutoriel({ tutoriel: avecArtefacts(p, a) })!;
    for (const k of ["script", "audio", "sousTitres", "motsPlan", "plan"] as const) expect(lu[k]).toEqual(p[k]);
  });
  it("scenesARerendre(plan, plan) = [] avant et après ajout", () => {
    const p = projetAncien();
    expect(scenesARerendre(p.plan.plan, valide)).toEqual([]);
    const apres = lireProjetTutoriel({ tutoriel: avecArtefacts(p, { chapitres: [{ titre: "t", debutSec: 0 }] }) })!;
    expect(scenesARerendre(apres.plan!.plan, valide)).toEqual([]);
  });
  it("etapesTutoriel sur le script des doubles : valeur figée", () => {
    const r = etapesTutoriel({ script: SCRIPT, mots, dureeSec: 60 });
    expect(r).toEqual(etapesTutoriel({ script: SCRIPT, mots, dureeSec: 60 }));
    expect(JSON.stringify(r)).toMatchInlineSnapshot(`"{"etapes":[],"chapitres":[]}"`);
  });
});
