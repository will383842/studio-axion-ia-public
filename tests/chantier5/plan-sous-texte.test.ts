/**
 * Chantier 5 (5.05a) : `PlanSousTexte`, dessin du plan de scènes à un instant `t`, sous le texte. Composant monté nulle part.
 * Rendu statique, aucun réseau. Se saute si les dépendances de studio-rendu ne sont pas installées.
 * `useCurrentFrame` est simulé pour LEVER une erreur : preuve que le composant ne le lit pas.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

const AVEC_RENDU = existsSync("studio-rendu/node_modules/remotion/dist/esm/index.mjs");
vi.mock("../../studio-rendu/node_modules/remotion/dist/esm/index.mjs", async (origine) => {
  const vrai = await origine<Record<string, unknown>>();
  return {
    ...vrai,
    useCurrentFrame: () => {
      throw new Error("useCurrentFrame ne doit pas être lu");
    },
  };
});

import { imagePlanAuTemps } from "@/briques/composition/scene";
import { PLAN_DEMO } from "@/briques/plan-scenes/demo";
import { ImagePlan } from "@/briques/plan-scenes/rendu";
import { validerPlan } from "@/briques/plan-scenes/validateur";

// Chemin calculé : même remotion que celui du vi.mock et du composant.
const { AbsoluteFill } = AVEC_RENDU ? ((await import(/* @vite-ignore */ ["..", "..", "studio-rendu", "node_modules", "remotion", "dist", "esm", "index.mjs"].join("/"))) as unknown as { AbsoluteFill: never }) : ({} as { AbsoluteFill: never });
// @ts-expect-error le react de studio-rendu n'a pas de types ici
const { createElement } = AVEC_RENDU ? ((await import("../../studio-rendu/node_modules/react/index.js")) as typeof import("react")) : ({} as typeof import("react"));
// @ts-expect-error le react de studio-rendu n'a pas de types ici
const { renderToStaticMarkup } = AVEC_RENDU ? ((await import("../../studio-rendu/node_modules/react-dom/server.js")) as typeof import("react-dom/server")) : ({} as typeof import("react-dom/server"));
// Chemin calculé : tsc (projet racine) ne suit pas ces imports.
const chemin = (c: string) => `../../studio-rendu/compositions/${c}`;
const MODULE = AVEC_RENDU ? await import(/* @vite-ignore */ chemin("commune/PlanSousTexte")) : null;

const html = (el: unknown) => renderToStaticMarkup(el as never);
const plan = validerPlan({ ...PLAN_DEMO, facecam: true }).plan;
const dessin = (p: unknown, t: number, largeur = 1080, hauteur = 1920) => html(createElement(MODULE!.PlanSousTexte, { plan: p, t, largeur, hauteur }));

describe.skipIf(!AVEC_RENDU)("PlanSousTexte (5.05a)", () => {
  it("plan absent : HTML vide", () => {
    expect(dessin(undefined, 2)).toBe("");
  });
  it("4:5 : vide ; 9:16 : non vide dans une scène", () => {
    expect(dessin(plan, 2, 1080, 1350)).toBe("");
    expect(dessin(plan, 2, 1080, 1920)).not.toBe("");
  });
  it("t hors de toute scène : vide", () => {
    expect(dessin(plan, 99)).toBe("");
  });
  it("dans une scène : égal à ImagePlan (fond transparent)", () => {
    const image = imagePlanAuTemps(plan, 2)!;
    expect(image).not.toBeNull();
    const obtenu = dessin(plan, 2);
    expect(obtenu).toContain("transparent");
    expect(obtenu).toBe(html(createElement(AbsoluteFill, { style: { pointerEvents: "none" } }, createElement(ImagePlan as never, { plan: { ...plan, facecam: true }, image }))));
  });
  it("deux scènes différentes : HTML différent", () => {
    expect(dessin(plan, 2)).not.toBe(dessin(plan, 7));
  });
  it("même t : même HTML", () => {
    expect(dessin(plan, 7)).toBe(dessin(plan, 7));
  });
});

function fichiers(dossier: string): string[] {
  if (!existsSync(dossier)) return [];
  return readdirSync(dossier).flatMap((n) => {
    if (n === "node_modules") return [];
    const c = join(dossier, n);
    return statSync(c).isDirectory() ? fichiers(c) : /\.(tsx?|mjs|js)$/.test(n) ? [c] : [];
  });
}

describe("PlanSousTexte (5.05a) : garde statique", () => {
  // BR-DESSIN-FACECAM-b-v20a (20/11) : attente DÉPLACÉE, non affaiblie : « monté nulle part » devient « monté UNE seule fois » (TexteCompose).
  it("monté UNE seule fois, par TexteCompose", () => {
    const touches = ["src", "studio-rendu/src", "studio-rendu/compositions"]
      .flatMap(fichiers)
      .filter((f) => !f.endsWith("commune/PlanSousTexte.tsx"))
      .filter((f) => readFileSync(f, "utf8").includes("PlanSousTexte"));
    expect(touches).toEqual(["studio-rendu/compositions/commune/TexteCompose.tsx"]);
  });
});
