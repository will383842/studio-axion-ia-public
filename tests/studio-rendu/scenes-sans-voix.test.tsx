/**
 * QUAL-3 · Dessin du tutoriel sans voix composé : DessinSansVoix sur des images synthétiques (textes, curseur, barre,
 * couleurs de la charte seulement, aucune police < 32 px) ; TutorielOutil sans `compositionSansVoix` : HTML identique à
 * celui de l'arbre d'origin/master (comparaison à un arbre de référence construit dans le test) ; avec : ScenesSansVoix rendu. Rendu statique, aucun réseau.
 */
import { existsSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

const AVEC_RENDU = existsSync("studio-rendu/node_modules/remotion/dist/esm/index.mjs");
const etat = vi.hoisted(() => ({ image: 0 }));
vi.mock("../../studio-rendu/node_modules/remotion/dist/esm/index.mjs", async (origine) => {
  const vrai = await origine<Record<string, unknown>>();
  return {
    ...vrai,
    Sequence: (p: { children?: unknown }) => p.children ?? null,
    Audio: () => null,
    useCurrentFrame: () => etat.image,
    useVideoConfig: () => ({ fps: 25, width: 1080, height: 1350, durationInFrames: 400, id: "essai", defaultProps: {}, props: {}, defaultCodec: null }),
  };
});

import { imageSansVoixA } from "@/briques/plan-scenes/tutoriel/sans-voix/geometrie";
import { PALETTE } from "@/briques/charte/axion-2026";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import type { ElementVisible, ImageSansVoix } from "@/briques/plan-scenes/tutoriel/sans-voix/types";
import { PLAN_SANS_VOIX_STOCKS } from "../tutoriel-outil/fixtures/plan-sans-voix-stocks";
import { HABILLAGE_TUTORIEL, formatDuRatio, planCarteFin } from "@/moteurs/montage-tutoriel-outil/proprietes";
// @ts-expect-error le react de studio-rendu n'a pas de types ici
const { createElement } = AVEC_RENDU ? ((await import("../../studio-rendu/node_modules/react/index.js")) as typeof import("react")) : ({} as typeof import("react"));
// @ts-expect-error le react de studio-rendu n'a pas de types ici
const { renderToStaticMarkup } = AVEC_RENDU ? ((await import("../../studio-rendu/node_modules/react-dom/server.js")) as typeof import("react-dom/server")) : ({} as typeof import("react-dom/server"));
const chemin = (c: string) => `../../studio-rendu/compositions/${c}`;
const REMOTION = AVEC_RENDU ? await import(/* @vite-ignore */ "../../studio-rendu/node_modules/remotion/dist/esm/index.mjs") : null;
const PLAN_DE_SCENES = AVEC_RENDU ? await import(/* @vite-ignore */ chemin("plan-scenes/PlanDeScenes")) : null;
const DESSIN = AVEC_RENDU ? await import(/* @vite-ignore */ chemin("plan-scenes/tutoriel-sans-voix/DessinSansVoix")) : null;
const TUTORIEL = AVEC_RENDU ? await import(/* @vite-ignore */ chemin("plan-scenes/TutorielOutil")) : null;

const html = (el: unknown) => renderToStaticMarkup(el as never);
const FORMAT = { largeur: 1080, hauteur: 1350, fps: 25 };
const FIN = { titre: "Axion IA", sousTitre: "axion-ia.com" };
const CHARTE = new Set(Object.values(PALETTE).map((c) => c.toLowerCase()));

const el = (e: Partial<ElementVisible> & Pick<ElementVisible, "id" | "genre">): ElementVisible => ({ rect: { x: 100, y: 100, largeur: 400, hauteur: 80 }, opacite: 1, z: 1, ...e });

function image(): ImageSansVoix {
  return {
    tMs: 4000,
    fond: "ivoire",
    elements: [
      el({ id: "curseur", genre: "curseur", z: 50, rect: { x: 600, y: 700, largeur: 44, hauteur: 56 }, opacite: 1, pointe: { x: 600, y: 700 }, anneauClic: 0.4, cibleId: "ligne" }),
      el({ id: "titre", genre: "texte", z: 3, texte: "Tableau de bord", lignes: ["Tableau", "de bord"], taillePx: 64, graisse: 800, couleur: "noir", alignement: "centre", rect: { x: 100, y: 120, largeur: 880, hauteur: 160 } }),
      el({ id: "carte", genre: "forme", z: 1, remplissage: "blanc", contour: "gris", rayonPx: 28, ombre: true, rect: { x: 80, y: 400, largeur: 920, hauteur: 500 } }),
      el({ id: "avant", genre: "texte", z: 2, texte: "une heure", lignes: ["une heure"], taillePx: 56, graisse: 700, couleur: "grisTexte", barre: 1, rect: { x: 120, y: 450, largeur: 400, hauteur: 70 } }),
      el({ id: "barre", genre: "forme", z: 2, remplissage: "gris", rayonPx: 12, progression: 0.5, rect: { x: 120, y: 560, largeur: 600, hauteur: 24 } }),
      el({ id: "cloche", genre: "forme", z: 2, icone: "cloche", remplissage: "terracotta", rect: { x: 120, y: 620, largeur: 48, hauteur: 48 } }),
      el({ id: "horloge", genre: "forme", z: 2, icone: "horloge", couleur: "noir", rect: { x: 200, y: 620, largeur: 48, hauteur: 48 } }),
      el({ id: "invisible", genre: "texte", z: 2, texte: "Fantôme", lignes: ["Fantôme"], taillePx: 40, opacite: 0, rect: { x: 100, y: 1000, largeur: 300, hauteur: 60 } }),
    ],
  };
}

function planTuto(): PlanValide {
  const base = { version: 1, format: formatDuRatio("4:5"), habillage: HABILLAGE_TUTORIEL } as unknown as PlanValide;
  return planCarteFin({ plan: base, fin: { titre: "Une automatisation simple", sousTitre: "de bout en bout" }, finMs: 6000 });
}

describe.skipIf(!AVEC_RENDU)("DessinSansVoix (QUAL-3)", () => {
  const sortie = () => html(createElement(DESSIN!.DessinSansVoix, { image: image(), format: FORMAT }));

  it("dessine les textes (une ligne par div), le curseur, l'anneau et la barre", () => {
    const h = sortie();
    expect(h).toContain(">Tableau</div>");
    expect(h).toContain(">de bord</div>");
    expect(h).toContain("une heure");
    expect(h).toContain("M1 1 L1 22 L6.5 17"); // flèche du curseur
    expect(h).toMatch(/border:4px solid #B23F16/); // anneau de clic
    expect(h).toContain('width="100%"'); // trait de barre
    expect(h).toContain("font-family:Manrope, sans-serif");
    expect(h).not.toContain("Fantôme"); // opacité 0 : non dessiné
  });

  it("progression : le rect est déjà le rectangle actuel (largeur du rect, pas multipliée) ; z croissant = ordre de dessin", () => {
    const h = sortie();
    expect(h).toContain("width:600px;height:24px");
    expect(h).not.toContain("width:300px");
    expect(h.indexOf('data-id="carte"')).toBeLessThan(h.indexOf('data-id="titre"'));
  });

  it("aucune couleur hors charte et aucune police sous 32 px", () => {
    const h = sortie();
    const hex = h.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    expect(hex.length).toBeGreaterThan(0);
    for (const c of hex) expect(CHARTE.has(c.toLowerCase())).toBe(true);
    for (const m of h.matchAll(/font-size:([\d.]+)px/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(32);
    expect(h).not.toMatch(/#D97757/i);
  });
});

describe.skipIf(!AVEC_RENDU)("TutorielOutil et compositionSansVoix (QUAL-3)", () => {
  const rendre = (extra: object = {}) => html(createElement(TUTORIEL!.TutorielOutil, { plan: planTuto(), fin: FIN, finMs: 2500, ...extra }));

  // Arbre de référence : celui de TutorielOutil d'origin/master (sans sous-titres, audio ni schéma de flux).
  const reference = () => {
    const plan = planTuto();
    const images = Math.max(1, Math.round((plan.dureeMs * plan.format.fps) / 1000));
    const { AbsoluteFill, Sequence } = REMOTION as unknown as Record<string, unknown>;
    const el = createElement as unknown as (...a: unknown[]) => unknown;
    return html(
      el(AbsoluteFill, null, el(Sequence, { durationInFrames: images }, el(PLAN_DE_SCENES!.PlanDeScenes, { plan })), el(Sequence, { from: images }, el(PLAN_DE_SCENES!.PlanDeScenes, { plan: planCarteFin({ plan, fin: FIN, finMs: 2500 }) }))),
    );
  };

  it("sans le champ : HTML identique à l'arbre de référence d'origin/master", () => {
    etat.image = 5;
    expect(rendre()).toBe(reference());
  });

  it("avec le champ : le plan composé est dessiné (data-id, textes, positions du rect de imageSansVoixA)", () => {
    etat.image = 300; // 12 000 ms à 25 i/s
    const sans = rendre();
    const avec = rendre({ compositionSansVoix: PLAN_SANS_VOIX_STOCKS });
    expect(avec).not.toBe(sans);
    const attendu = imageSansVoixA(PLAN_SANS_VOIX_STOCKS, 12000).elements.filter((e) => e.opacite > 0.005 && e.genre !== "curseur");
    expect(attendu.length).toBeGreaterThan(3);
    expect(avec).toContain("Tableau de bord");
    for (const e of attendu) {
      expect(sans).not.toContain(`data-id="${e.id}"`);
      const { x, y, largeur, hauteur } = e.rect;
      expect(avec).toContain(`data-id="${e.id}" style="position:absolute;left:${x}px;top:${y}px;width:${largeur}px;height:${hauteur}px`);
    }
  });

  it("plan des stocks à 5 instants : textes de la scène, couleurs de la charte, aucune police sous 32 px, jamais un fond nu", () => {
    const attendu: [number, string][] = [[1000, "Suivre ses stocks"], [12000, "Tableau de bord"], [20000, "Tableau de bord"], [30000, "Tableau de bord"], [38000, ""]];
    for (const [ms, texte] of attendu) {
      etat.image = Math.round((ms * 25) / 1000);
      const h = rendre({ compositionSansVoix: PLAN_SANS_VOIX_STOCKS });
      if (texte) expect(h).toContain(texte);
      for (const c of h.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []) expect(CHARTE.has(c.toLowerCase())).toBe(true);
      for (const m of h.matchAll(/font-size:([\d.]+)px/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(32);
      expect(h).toContain("data-id=");
    }
  });
});
