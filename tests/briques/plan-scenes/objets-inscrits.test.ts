/**
 * BR-OBJETS-a (= C9-34b) — les 4 petits objets des règles fixes C9-36a sont inscrits au plan de scènes, PORTE FERMÉE.
 * (a) éteint = identique ; (b) permis : gardé si valide, retiré (jamais l'exemple) si invalide ; (c) rendu statique ;
 * (d) toiles et identifiants. La preuve « par la vraie fabrication » est dans tests/demo-facecam/objets-permis-demo.test.ts.
 */
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

const AVEC_RENDU = existsSync("studio-rendu/node_modules/remotion/dist/esm/index.mjs");
vi.mock("../../../studio-rendu/node_modules/remotion/dist/esm/index.mjs", async (origine) => {
  const vrai = await origine<Record<string, unknown>>();
  return { ...vrai, Sequence: (p: { children?: unknown }) => p.children ?? null, Audio: () => null, useCurrentFrame: () => 60, useVideoConfig: () => ({ fps: 25, width: 1080, height: 1920, durationInFrames: 250, id: "essai", defaultProps: {}, props: {}, defaultCodec: null }) };
});

import { CATALOGUE_BRIQUES, IDS_PIECES, pieceLaPlusProche } from "@/briques/plan-scenes/catalogue";
import { consignePlan } from "@/briques/plan-scenes/generateur";
import { TOILES } from "@/briques/plan-scenes/toiles";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import { PLAN_DEMO } from "@/briques/plan-scenes/demo";
import { RENDUS_BRIQUES } from "@/briques/plan-scenes/briques";
import { BRIQUES_OBJETS, graineObjet } from "@/briques/plan-scenes/briques/objets-inscrits";
import type { PlanValide } from "@/briques/plan-scenes/schema";
// @ts-expect-error le react de studio-rendu n'a pas de types ici
const { createElement } = AVEC_RENDU ? ((await import("../../../studio-rendu/node_modules/react/index.js")) as typeof import("react")) : ({} as typeof import("react"));
// @ts-expect-error le react de studio-rendu n'a pas de types ici
const { renderToStaticMarkup } = AVEC_RENDU ? ((await import("../../../studio-rendu/node_modules/react-dom/server.js")) as typeof import("react-dom/server")) : ({} as typeof import("react-dom/server"));
// Chemin calculé : tsc (projet racine, qui exclut studio-rendu) ne suit pas cet import.
const chemin = ["..", "..", "..", "studio-rendu", "compositions", "plan-scenes", "CalquePlanScenes"].join("/");
const PLAN_SCENES = AVEC_RENDU ? ((await import(/* @vite-ignore */ chemin)) as { CalquePlanScenes: unknown }) : null;

const IDS = ["objet-gros-chiffre", "objet-etape", "objet-cartes-coche", "objet-coche"] as const;
const AVANT = readFileSync(new URL("./__fixtures__/consigne-avant-porte.txt", import.meta.url), "utf8");
const MOTS = "J'ai gagné 42 heures cette semaine".split(" ").map((texte, i) => ({ texte, debutMs: i * 400, finMs: i * 400 + 350 }));
const FORMAT = { largeur: 1080, hauteur: 1920, fps: 25 as const };
const planAvec = (piece: string, parametres: unknown) => {
  const p = structuredClone(PLAN_DEMO) as unknown as { scenes: Record<string, unknown>[] };
  p.scenes = [{ id: "o", version: 1, mots: { premier: 0, dernier: MOTS.length - 1 }, debutMs: 0, finMs: 4000, niveau: 1, position: "centre", transition: { entree: "fondu", sortie: "fondu", dureeMs: 400 }, piece, parametres }];
  return p;
};
const contexte = { mots: MOTS, format: FORMAT, facecam: false };

describe("(a) porte fermée : tout est identique à avant", () => {
  it("consignePlan() sans permis ne contient aucun objet-, identique à la référence figée d'avant la porte", () => {
    expect(consignePlan()).toBe(AVANT);
    expect(consignePlan([])).toBe(AVANT);
    expect(consignePlan()).not.toContain("objet-");
    for (const id of IDS) expect(consignePlan([id])).toContain(`- ${id} (`);
  });
  it("pieceLaPlusProche d'un objet sans permis ne rend pas un objet", () => {
    for (const id of IDS) expect(pieceLaPlusProche(id).startsWith("objet-")).toBe(false);
    expect(pieceLaPlusProche("objet-coche").startsWith("objet-")).toBe(false);
  });
  it("un plan qui demande objet-gros-chiffre sans permis est replié comme aujourd'hui", () => {
    const r = validerPlan(planAvec("objet-gros-chiffre", { valeur: 42 }), contexte);
    expect(r.plan.scenes.every((s) => !s.piece.startsWith("objet-"))).toBe(true);
    expect(r.remarques.some((x) => x.code === "OBJET_NON_PERMIS")).toBe(true);
  });
});

describe("(b) permis : gardé si valide, retiré si invalide (jamais l'exemple)", () => {
  it("scène valide gardée telle quelle", () => {
    const r = validerPlan(planAvec("objet-gros-chiffre", { valeur: 42, unite: "heures" }), { ...contexte, objetsPermis: ["objet-gros-chiffre"] });
    const s = r.plan.scenes.find((x) => x.piece === "objet-gros-chiffre");
    expect(s).toBeDefined();
    expect(s!.parametres).toEqual({ valeur: 42, unite: "heures" });
  });
  it("paramètres invalides : scène retirée, aucun exemple substitué", () => {
    const r = validerPlan(planAvec("objet-gros-chiffre", { valeur: "beaucoup" }), { ...contexte, objetsPermis: ["objet-gros-chiffre"] });
    expect(r.plan.scenes.some((x) => x.piece.startsWith("objet-"))).toBe(false);
    expect(r.remarques.some((x) => x.code === "SCENE_RETIREE" && /objet/i.test(x.message))).toBe(true);
    expect(JSON.stringify(r.plan)).not.toContain('"valeur":20');
  });
  it("calque objet invalide retiré, calque valide gardé", () => {
    const p = planAvec("legende", { texte: "Essai", sousTexte: "", style: "bandeau" }) as unknown as { scenes: Record<string, unknown>[] };
    p.scenes[0]!.niveau = 2;
    p.scenes[0]!.calques = [
      { piece: "objet-coche", parametres: { boite: "nulle part" }, debutMs: 0, zone: "plein" },
      { piece: "objet-coche", parametres: { boite: { x: 20, y: 30, largeur: 40, hauteur: 25 } }, debutMs: 500, zone: "plein" },
    ];
    const r = validerPlan(p, { ...contexte, objetsPermis: ["objet-coche"] });
    const calques = r.plan.scenes[0]!.calques ?? [];
    expect(calques.filter((c) => c.piece === "objet-coche")).toHaveLength(1);
    expect(r.remarques.some((x) => x.code === "CALQUE_RETIRE")).toBe(true);
  });
});

describe.skipIf(!AVEC_RENDU)("(c) rendu statique", () => {
  it("CalquePlanScenes d'un plan validé avec un gros chiffre « 42 » montre « 42 » au milieu de la scène", () => {
    const r = validerPlan(planAvec("objet-gros-chiffre", { valeur: 42, unite: "heures" }), { ...contexte, objetsPermis: ["objet-gros-chiffre"] });
    expect(r.plan.scenes[0]!.piece).toBe("objet-gros-chiffre");
    const html = renderToStaticMarkup(createElement((PLAN_SCENES as { CalquePlanScenes: never }).CalquePlanScenes, { plan: r.plan as PlanValide }));
    expect(html).toContain("42");
  });
});

describe("(d) toiles, identifiants, graine", () => {
  it("TOILES[id] égale la toile de la définition ; les 4 ids sont au catalogue, sans doublon, avec un rendu", () => {
    for (const id of IDS) {
      expect(TOILES[id]).toEqual(BRIQUES_OBJETS[id].toile);
      expect(CATALOGUE_BRIQUES[id].famille).toBe("objet");
      expect(IDS_PIECES).toContain(id);
      expect(RENDUS_BRIQUES[id]).toBeTypeOf("function");
      expect(CATALOGUE_BRIQUES[id].schema.safeParse(CATALOGUE_BRIQUES[id].exemple).success).toBe(true);
    }
    expect(new Set(IDS_PIECES).size).toBe(IDS_PIECES.length);
  });
  it("graineObjet est pure et fixe", () => {
    expect(graineObjet("objet-coche")).toBe(graineObjet("objet-coche"));
    expect(graineObjet("a")).toBe(97);
  });
});
