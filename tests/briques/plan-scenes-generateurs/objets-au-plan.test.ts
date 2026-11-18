/**
 * BR-OBJETS-b (= C9-36b) : poser les petits objets par règles fixes dans les trous du plan, par la VRAIE fonction de
 * fabrication `adapterPlan` (aucun appel à Claude : `appeler` n'est jamais passé). Éteint (sans `objetsPermis`) = identique.
 * (f) rendu statique de `CalquePlanScenes` à l'instant du gros chiffre ; se saute sans les dépendances de studio-rendu.
 */
import { existsSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

const AVEC_RENDU = existsSync("studio-rendu/node_modules/remotion/dist/esm/index.mjs");
const instant = vi.hoisted(() => ({ image: 10 }));
vi.mock("../../../studio-rendu/node_modules/remotion/dist/esm/index.mjs", async (origine) => {
  const vrai = await origine<Record<string, unknown>>();
  return { ...vrai, Sequence: (p: { children?: unknown }) => p.children ?? null, Audio: () => null, useCurrentFrame: () => instant.image, useVideoConfig: () => ({ fps: 25, width: 1080, height: 1920, durationInFrames: 1000, id: "essai", defaultProps: {}, props: {}, defaultCodec: null }) };
});

import { adapterPlan, type EntreeAdaptateur } from "@/briques/plan-scenes-generateurs/adaptateur";
import { poserObjetsAuPlan } from "@/briques/plan-scenes-generateurs/objets-au-plan";
import { OBJETS_PAR_VIDEO_MAX } from "@/briques/motion/petits-objets/contrat";
import type { MotMinute, PlanDeScenes } from "@/briques/plan-scenes/schema";
// @ts-expect-error le react de studio-rendu n'a pas de types ici
const { createElement } = AVEC_RENDU ? ((await import("../../../studio-rendu/node_modules/react/index.js")) as typeof import("react")) : ({} as typeof import("react"));
// @ts-expect-error le react de studio-rendu n'a pas de types ici
const { renderToStaticMarkup } = AVEC_RENDU ? ((await import("../../../studio-rendu/node_modules/react-dom/server.js")) as typeof import("react-dom/server")) : ({} as typeof import("react-dom/server"));
// Chemin calculé : tsc (projet racine) ne suit pas cet import et ne cherche pas `remotion` hors de studio-rendu.
const cheminCalque = ["..", "..", "..", "studio-rendu", "compositions", "plan-scenes", "CalquePlanScenes"].join("/");
const CALQUE = AVEC_RENDU ? ((await import(/* @vite-ignore */ cheminCalque)) as { CalquePlanScenes: unknown }) : null;

const FORMAT = { largeur: 1080, hauteur: 1920, fps: 25 as const };
const GROS = "objet-gros-chiffre";
const COCHE = "objet-coche";
const PHRASE = "Bonjour à tous. On gagne 3 heures par semaine avec cet outil. Le devis part tout seul chaque matin. Et voilà c'est fait.";
const mots = (texte: string, pas = 0.4): MotMinute[] => texte.split(/\s+/).map((t, i) => ({ texte: t, debutMs: Math.round(i * pas * 1000), finMs: Math.round((i * pas + 0.35) * 1000) }));
const segmentsDe = (texte: string) => {
  const m = mots(texte);
  return [{ texte, debutMs: 0, finMs: m.at(-1)!.finMs, mots: m }];
};
const entree = (texte: string, plus: Partial<EntreeAdaptateur> = {}): EntreeAdaptateur => ({ generateur: "cas-concret", script: texte, segments: segmentsDe(texte), format: FORMAT, facecam: false, ...plus });
type SceneLue = { piece: string; debutMs: number; finMs: number; parametres: unknown };
const objetsDe = (p: { scenes: unknown[] } | null): SceneLue[] => ((p?.scenes ?? []) as SceneLue[]).filter((s) => s.piece.startsWith("objet-"));
/** Faux Claude (jamais un appel réel) : une seule scène sur « Bonjour à tous. », donc des trous aux autres endroits. */
const fauxClaude = () => {
  const appels: unknown[] = [];
  const appeler = async (req: unknown) => (appels.push(req), { texte: JSON.stringify({ version: "plan-scenes-1", scenes: [{ id: "a", version: 1, mots: { premier: 0, dernier: 2 }, debutMs: 0, finMs: 1100, niveau: 1, position: "centre", piece: "legende", parametres: { texte: "Bonjour à tous", sousTexte: "", style: "etiquette" } }] }), stopReason: "end_turn" }) as never;
  return { appels, appeler };
};
const chevauche = (p: { scenes: { debutMs: number; finMs: number }[] }) => p.scenes.some((a, i) => p.scenes.some((b, j) => i < j && a.debutMs < b.finMs && b.debutMs < a.finMs));

describe("BR-OBJETS-b · objets au plan par règles fixes", () => {
  it("(a) sans objetsPermis (absent ou vide) : résultat identique, aucun objet, aucun appel ajouté", async () => {
    const avant = await adapterPlan(entree(PHRASE));
    const vide = await adapterPlan(entree(PHRASE, { objetsPermis: [] }));
    expect(vide).toEqual(avant);
    expect(objetsDe(avant.plan)).toEqual([]);
    // avec un faux Claude : même plan et même nombre d'appels, objetsPermis absent ou vide
    const f1 = fauxClaude();
    const f2 = fauxClaude();
    const r1 = await adapterPlan(entree(PHRASE), { appeler: f1.appeler });
    const r2 = await adapterPlan(entree(PHRASE, { objetsPermis: [] }), { appeler: f2.appeler });
    expect(r2).toEqual(r1);
    expect(f2.appels.length).toBe(f1.appels.length);
    expect(objetsDe(r1.plan)).toEqual([]);
    // pure : permis vide = le MÊME objet
    const plan = avant.plan as unknown as PlanDeScenes;
    expect(poserObjetsAuPlan(plan, mots(PHRASE), [])).toBe(plan);
  });

  it("(b) « 3 heures » + « c'est fait » + objets permis : 1 gros chiffre (3 recopié) et 1 coche, aux instants des mots", async () => {
    const m = mots(PHRASE);
    const r = await adapterPlan(entree(PHRASE, { objetsPermis: [GROS, COCHE] }), { appeler: fauxClaude().appeler });
    const objets = objetsDe(r.plan);
    const gros = objets.filter((s) => s.piece === GROS);
    const coches = objets.filter((s) => s.piece === COCHE);
    expect(gros).toHaveLength(1);
    expect(coches).toHaveLength(1);
    expect(JSON.stringify(gros[0]!.parametres)).toContain('"valeur":3');
    const iTrois = m.findIndex((x) => x.texte === "3");
    expect(gros[0]!.debutMs).toBeGreaterThanOrEqual(m[iTrois]!.debutMs - 1);
    expect(gros[0]!.debutMs).toBeLessThan(m[iTrois + 1]!.finMs);
    const iFait = m.findIndex((x) => x.texte === "fait.");
    expect(coches[0]!.debutMs).toBeGreaterThanOrEqual(m[iFait - 2]!.debutMs - 1);
    expect(coches[0]!.debutMs).toBeLessThanOrEqual(m[iFait]!.finMs);
    expect(r.plan && chevauche(r.plan)).toBe(false);
    expect(r.plan!.scenes.map((s) => s.debutMs)).toEqual([...r.plan!.scenes.map((s) => s.debutMs)].sort((a, b) => a - b));
  });

  it("(c) une proposition qui tombe sur une scène existante est abandonnée", () => {
    const m = mots(PHRASE);
    const iTrois = m.findIndex((x) => x.texte === "3");
    const plan = {
      version: 1, format: FORMAT, facecam: false, dureeMs: 9000, habillage: { fond: "ivoire", accent: "terracotta" }, mots: m,
      scenes: [{ id: "s1", version: 1, mots: { premier: iTrois, dernier: iTrois + 1 }, debutMs: m[iTrois]!.debutMs - 100, finMs: m[iTrois + 1]!.finMs + 300, niveau: 1, position: "centre", transition: { entree: "fondu", sortie: "fondu", dureeMs: 400 }, piece: "texte-accent", parametres: { texte: "x" } }],
    } as unknown as PlanDeScenes;
    const sortie = poserObjetsAuPlan(plan, m, [GROS]);
    expect(objetsDe(sortie)).toEqual([]);
    expect(sortie.scenes).toHaveLength(1);
  });

  it("(d) un objet non permis est absent (coche seule permise : pas de gros chiffre)", async () => {
    const r = await adapterPlan(entree(PHRASE, { objetsPermis: [COCHE] }), { appeler: fauxClaude().appeler });
    expect(objetsDe(r.plan).map((s) => s.piece)).toEqual([COCHE]);
    // sans plan de Claude, le stock occupe déjà « 3 heures » : le gros chiffre abandonné, la coche (hors stock) posée
    const stock = await adapterPlan(entree("Bonjour tout le monde, ça marche vraiment bien. Et voilà c'est fait.", { objetsPermis: [GROS, COCHE] }));
    expect(objetsDe(stock.plan).map((s) => s.piece)).toEqual([COCHE]);
  });

  it("(e) jamais plus de OBJETS_PAR_VIDEO_MAX, ids o1, o2…", async () => {
    const long = "On gagne 3 heures. Puis 5 jours. Puis 7 mois. Puis 9 ans. Puis 4 clients. Puis 6 devis. Et voilà c'est fait.";
    const r = await adapterPlan(entree(long, { objetsPermis: [GROS, COCHE, "objet-etape", "objet-cartes-coche"] }), { appeler: fauxClaude().appeler });
    expect(objetsDe(r.plan).length).toBeLessThanOrEqual(OBJETS_PAR_VIDEO_MAX);
    expect(objetsDe(r.plan).length).toBeGreaterThan(0);
    expect(r.plan && chevauche(r.plan)).toBe(false);
  });

  it("(g) ne lève jamais : entrées absurdes = plan inchangé", () => {
    const plan = { scenes: [], dureeMs: 1000 } as unknown as PlanDeScenes;
    expect(poserObjetsAuPlan(plan, null as never, [GROS])).toBe(plan);
    expect(poserObjetsAuPlan(plan, [{ texte: 3, debutMs: "a", finMs: 1 } as never], [GROS])).toBe(plan);
  });

  it.skipIf(!AVEC_RENDU)("(f) rendu : CalquePlanScenes à l'instant du gros chiffre montre « 3 », et plus rien hors de la scène", async () => {
    const r = await adapterPlan(entree(PHRASE, { objetsPermis: [GROS] }), { appeler: fauxClaude().appeler });
    const gros = r.plan!.scenes.find((s) => s.piece === GROS)!;
    const C = (CALQUE as unknown as { CalquePlanScenes: never }).CalquePlanScenes;
    instant.image = Math.round(((gros.debutMs + gros.finMs) / 2 / 1000) * 25);
    const dedans = renderToStaticMarkup(createElement(C, { plan: r.plan }) as never);
    expect(dedans).toMatch(/>\s*3\s*</);
    instant.image = Math.round(((gros.finMs + 1500) / 1000) * 25);
    const dehors = renderToStaticMarkup(createElement(C, { plan: r.plan }) as never);
    expect(dehors).not.toMatch(/>\s*3\s*</);
    instant.image = 10;
  });
});
