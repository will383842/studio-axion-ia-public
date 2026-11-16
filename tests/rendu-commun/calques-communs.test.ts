/**
 * G2-06 : composant commun `CalquesCommuns` (plan de scènes, calques ajoutés, sous-titres au-dessus).
 * Rendu statique seulement, aucun réseau. Se saute si les dépendances de studio-rendu ne sont pas installées.
 */
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

const AVEC_RENDU = existsSync("studio-rendu/node_modules/remotion/dist/esm/index.mjs");
vi.mock("../../studio-rendu/node_modules/remotion/dist/esm/index.mjs", async (origine) => {
  const vrai = await origine<Record<string, unknown>>();
  return { ...vrai, Sequence: (p: { children?: unknown }) => p.children ?? null, Audio: () => null, useCurrentFrame: () => 10, useVideoConfig: () => ({ fps: 25, width: 1080, height: 1920, durationInFrames: 250, id: "essai", defaultProps: {}, props: {}, defaultCodec: null }) };
});

import { donneesCalque } from "@/briques/sous-titres";
import type { SegmentRendu } from "@/briques/sous-titres/types-rendu";
import { planPourVideo, type MotEnSecondes } from "@/briques/plan-scenes-generateurs/video";
import type { PlanValide } from "@/briques/plan-scenes/schema";
// @ts-expect-error le react de studio-rendu n'a pas de types ici
const { createElement } = AVEC_RENDU ? ((await import("../../studio-rendu/node_modules/react/index.js")) as typeof import("react")) : ({} as typeof import("react"));
// @ts-expect-error le react de studio-rendu n'a pas de types ici
const { renderToStaticMarkup } = AVEC_RENDU ? ((await import("../../studio-rendu/node_modules/react-dom/server.js")) as typeof import("react-dom/server")) : ({} as typeof import("react-dom/server"));
// Chemin calculé : tsc (projet racine, qui exclut studio-rendu) ne suit pas ces imports, donc ne cherche pas `remotion` hors de studio-rendu.
const chemin = (c: string) => `../../studio-rendu/compositions/${c}`;
const SOUS_TITRES = AVEC_RENDU ? await import(/* @vite-ignore */ chemin("sous-titres/CalqueSousTitres")) : null;
const PLAN_SCENES = AVEC_RENDU ? await import(/* @vite-ignore */ chemin("plan-scenes/CalquePlanScenes")) : null;
const COMMUN = AVEC_RENDU ? await import(/* @vite-ignore */ chemin("commune/CalquesCommuns")) : null;

const SCRIPT = "Aujourd'hui je vous montre comment j'ai généré 12 000 euros de chiffre d'affaires en 30 jours. Résultat : 87 % de clients satisfaits et 3 fois plus de demandes.";
const MOTS: MotEnSecondes[] = SCRIPT.split(" ").map((texte, i) => ({ texte, debutSec: i * 0.4, finSec: i * 0.4 + 0.35 }));
const segment: SegmentRendu = { id: "s", debutSec: 0, finSec: 2, mots: [{ mot: "Exemple", debutSec: 0, finSec: 1 }, { mot: "fictif", debutSec: 1, finSec: 2 }] };
const donnees = donneesCalque({ segments: [segment], base: "karaoke", ratio: "9:16" });

async function plan(): Promise<PlanValide> {
  const m = await planPourVideo({ generateur: "facecam", mots: MOTS, dureeSec: MOTS.length * 0.4 + 0.5, facecam: true, format: { largeur: 1080, hauteur: 1920, fps: 25 } });
  if (!m.plan) throw new Error("plan absent");
  return m.plan;
}
const html = (el: unknown) => renderToStaticMarkup(el as never);

describe.skipIf(!AVEC_RENDU)("CalquesCommuns (G2-06)", () => {
  const C = () => COMMUN!.CalquesCommuns;
  const ST = () => SOUS_TITRES!.CalqueSousTitres;
  const PS = () => PLAN_SCENES!.CalquePlanScenes;

  it("(a) tout absent : chaîne vide", () => {
    expect(html(createElement(C(), {}))).toBe("");
  });
  it("(b) seulement sousTitres : identique à CalqueSousTitres seul", () => {
    expect(html(createElement(C(), { sousTitres: { donnees } }))).toBe(html(createElement(ST(), { donnees })));
  });
  it("(c) seulement planScenes : identique à CalquePlanScenes seul", async () => {
    const p = await plan();
    expect(html(createElement(C(), { planScenes: p }))).toBe(html(createElement(PS(), { plan: p })));
  });
  it("(d) les deux + un enfant : ordre plan, enfant, sous-titres", async () => {
    const p = await plan();
    const sortie = html(createElement(C(), { planScenes: p, sousTitres: { donnees } }, createElement("i", { id: "enfant-essai" })));
    const seul = (e: unknown) => html(e);
    const a = seul(createElement(PS(), { plan: p }));
    const b = '<i id="enfant-essai"></i>';
    const c = seul(createElement(ST(), { donnees }));
    expect(sortie).toBe(a + b + c);
  });
});

describe("garde statique", () => {
  it("(e) aucun import « @/ » dans CalquesCommuns.tsx", () => {
    expect(readFileSync("studio-rendu/compositions/commune/CalquesCommuns.tsx", "utf8")).not.toContain('from "@/');
  });
});
