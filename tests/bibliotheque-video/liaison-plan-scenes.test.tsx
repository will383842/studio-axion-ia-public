/**
 * N-01b : filet « inscrit au plan de scènes → monté par le composant commun » pour les petits objets.
 * Toute pièce de famille `objet` du catalogue du plan de scènes doit avoir un rendu, une toile, une place au registre des objets,
 * une capacité `objet.*` qui est une ligne du catalogue de la bibliothèque, et être permise par la porte ; sinon le test casse en le disant.
 * Moitié « façade » : liaison-facade.test.ts (N-01a). Rendu statique seulement, aucun réseau ; se saute sans les dépendances de studio-rendu.
 */
import { existsSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

const AVEC_RENDU = existsSync("studio-rendu/node_modules/remotion/dist/esm/index.mjs");
vi.mock("../../studio-rendu/node_modules/remotion/dist/esm/index.mjs", async (origine) => {
  const vrai = await origine<Record<string, unknown>>();
  return { ...vrai, Sequence: (p: { children?: unknown }) => p.children ?? null, Audio: () => null, useCurrentFrame: () => 60, useVideoConfig: () => ({ fps: 25, width: 1080, height: 1920, durationInFrames: 250, id: "essai", defaultProps: {}, props: {}, defaultCodec: null }) };
});

import { ID } from "@/briques/bibliotheque-video/noms";
import { CATALOGUE_CAPACITES } from "@/briques/bibliotheque-video/catalogue";
import { profilNeutre } from "@/briques/bibliotheque-video/profils";
import type { EntreeBibliotheque, ProfilVideo, RegleProfilCapacite } from "@/briques/bibliotheque-video/types";
import { VERSION_BIBLIOTHEQUE } from "@/briques/bibliotheque-video/version";
import { PLAN_DEMO } from "@/briques/plan-scenes/demo";
import { CATALOGUE_BRIQUES } from "@/briques/plan-scenes/catalogue";
import { TOILES } from "@/briques/plan-scenes/toiles";
import { RENDUS_BRIQUES } from "@/briques/plan-scenes/briques";
import { BRIQUES_OBJETS } from "@/briques/plan-scenes/briques/objets-inscrits";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import { piecesPermisesDesEntrees } from "@/briques/plan-scenes-objets/pieces-permises";
import { definitionObjet } from "@/briques/plan-scenes-objets/registre";
import type { PlanValide } from "@/briques/plan-scenes/schema";
// @ts-expect-error le react de studio-rendu n'a pas de types ici
const { createElement } = AVEC_RENDU ? ((await import("../../studio-rendu/node_modules/react/index.js")) as typeof import("react")) : ({} as typeof import("react"));
// @ts-expect-error le react de studio-rendu n'a pas de types ici
const { renderToStaticMarkup } = AVEC_RENDU ? ((await import("../../studio-rendu/node_modules/react-dom/server.js")) as typeof import("react-dom/server")) : ({} as typeof import("react-dom/server"));
// Chemin calculé : tsc (projet racine, qui exclut studio-rendu) ne suit pas cet import, donc ne cherche pas `remotion` hors de studio-rendu.
const chemin = ["..", "..", "studio-rendu", "compositions", "commune", "CalquesCommuns"].join("/");
const COMMUN = AVEC_RENDU ? ((await import(/* @vite-ignore */ chemin)) as { CalquesCommuns: unknown }) : null;

/** Entrée bibliothèque qui permet les capacités données (recopié de tests/plan-scenes-objets/pieces-permises.test.ts). */
function entrees(capacites: Partial<Record<string, RegleProfilCapacite>> = {}, verrous: string[] = []) {
  const base = profilNeutre("format-essai");
  const profil: ProfilVideo = { ...base, capacites: capacites as ProfilVideo["capacites"], verrous };
  const e: EntreeBibliotheque = { version: VERSION_BIBLIOTHEQUE, profil, recents: [], graine: "G", figeeLe: "2026-11-17" };
  return { bibliothequeVideo: e };
}

interface Tables {
  catalogue: Record<string, { famille: string }>;
  rendus: Record<string, unknown>;
  toiles: Record<string, unknown>;
  definition: (id: string) => { capacite: string } | undefined;
}

/** Pour chaque pièce de famille `objet` du catalogue fourni : ce qui manque pour qu'elle soit montée, en clair. */
function objetsNonMontes(t: Tables): string[] {
  const manques: string[] = [];
  for (const id of Object.keys(t.catalogue).filter((i) => t.catalogue[i].famille === "objet")) {
    if (!t.rendus[id]) manques.push(`${id} : aucun rendu`);
    if (!t.toiles[id]) manques.push(`${id} : aucune toile`);
    const def = t.definition(id);
    if (!def) {
      manques.push(`${id} : absent du registre des objets`);
      continue;
    }
    if (!CATALOGUE_CAPACITES.some((l) => l.id === def.capacite)) manques.push(`${id} : sa capacité ${def.capacite} n'est pas une ligne du catalogue de la bibliothèque`);
    else if (!piecesPermisesDesEntrees(entrees({ [def.capacite]: { permis: true } })).includes(id as never)) manques.push(`${id} : la porte ne le permet jamais`);
  }
  return manques;
}

const VRAIES: Tables = { catalogue: CATALOGUE_BRIQUES as never, rendus: RENDUS_BRIQUES as never, toiles: TOILES as never, definition: definitionObjet };
const IDS_OBJETS = Object.keys(BRIQUES_OBJETS) as (keyof typeof BRIQUES_OBJETS)[];

const MOTS = "J'ai gagné 42 heures cette semaine".split(" ").map((texte, i) => ({ texte, debutMs: i * 400, finMs: i * 400 + 350 }));
const FORMAT = { largeur: 1080, hauteur: 1920, fps: 25 as const };
const contexte = { mots: MOTS, format: FORMAT, facecam: false };
/** Recopié de tests/briques/plan-scenes/objets-inscrits.test.ts : plan d'une scène autonome 0-4000 ms. */
const planAvec = (piece: string, parametres: unknown) => {
  const p = structuredClone(PLAN_DEMO) as unknown as { scenes: Record<string, unknown>[] };
  p.scenes = [{ id: "o", version: 1, mots: { premier: 0, dernier: MOTS.length - 1 }, debutMs: 0, finMs: 4000, niveau: 1, position: "centre", transition: { entree: "fondu", sortie: "fondu", dureeMs: 400 }, piece, parametres }];
  return p;
};
const html = (el: unknown) => renderToStaticMarkup(el as never);

describe("(a) tout objet du plan de scènes est monté, avec les vraies tables du Studio", () => {
  it("objetsNonMontes(vraies tables) = [] et au moins 4 objets contrôlés", () => {
    expect(objetsNonMontes(VRAIES)).toEqual([]);
    const controles = Object.keys(CATALOGUE_BRIQUES).filter((i) => i.startsWith("objet-"));
    expect(controles.length).toBeGreaterThanOrEqual(4);
    for (const id of ["objet-gros-chiffre", "objet-etape", "objet-cartes-coche", "objet-coche"]) expect(controles).toContain(id);
  });
  it("la liaison capacité → objet existe : objet.chiffre permis donne objet-gros-chiffre", () => {
    expect(piecesPermisesDesEntrees(entrees({ [ID.objetChiffre]: { permis: true } }))).toContain("objet-gros-chiffre");
  });
});

describe("(b) la garde mord", () => {
  it("un faux objet-fantome (sans rendu, toile ni registre) est signalé", () => {
    const r = objetsNonMontes({ ...VRAIES, catalogue: { ...(CATALOGUE_BRIQUES as never as Tables["catalogue"]), "objet-fantome": { famille: "objet" } } });
    expect(r).toEqual(expect.arrayContaining(["objet-fantome : aucun rendu", "objet-fantome : aucune toile", "objet-fantome : absent du registre des objets"]));
    expect(r.every((m) => m.startsWith("objet-fantome"))).toBe(true);
  });
  it("un vrai objet dont on retire le rendu : « aucun rendu »", () => {
    const { ["objet-coche"]: _retire, ...sans } = RENDUS_BRIQUES as never as Record<string, unknown>;
    expect(objetsNonMontes({ ...VRAIES, rendus: sans })).toEqual(["objet-coche : aucun rendu"]);
  });
  it("une toile retirée, un registre qui l'ignore, une capacité hors catalogue, une porte qui ne le rend jamais", () => {
    const { ["objet-etape"]: _t, ...sansToile } = TOILES as never as Record<string, unknown>;
    expect(objetsNonMontes({ ...VRAIES, toiles: sansToile })).toEqual(["objet-etape : aucune toile"]);
    expect(objetsNonMontes({ ...VRAIES, definition: (id) => (id === "objet-coche" ? undefined : definitionObjet(id)) })).toEqual(["objet-coche : absent du registre des objets"]);
    expect(objetsNonMontes({ ...VRAIES, definition: (id) => (id === "objet-coche" ? { capacite: "objet.inconnue" } : definitionObjet(id)) })).toEqual(["objet-coche : sa capacité objet.inconnue n'est pas une ligne du catalogue de la bibliothèque"]);
    expect(objetsNonMontes({ ...VRAIES, definition: (id) => (id === "objet-coche" ? { capacite: ID.objetChiffre } : definitionObjet(id)) })).toEqual(["objet-coche : la porte ne le permet jamais"]);
  });
});

describe.skipIf(!AVEC_RENDU)("(c) monté par le composant commun (CalquesCommuns)", () => {
  const Calques = () => COMMUN!.CalquesCommuns;
  it("rien sans plan", () => {
    expect(html(createElement(Calques() as never, {}))).toBe("");
  });
  it.each(IDS_OBJETS)("%s : validé avec sa capacité, gardé, et rendu non vide différent du plan sans cette scène", (id) => {
    const plan = planAvec(id, BRIQUES_OBJETS[id].exemple);
    const r = validerPlan(plan as never, { ...contexte, objetsPermis: [id] });
    expect(r.plan.scenes.map((s) => s.piece)).toEqual([id]);
    const avec = html(createElement(Calques() as never, { planScenes: r.plan as PlanValide }));
    expect(avec.length).toBeGreaterThan(0);
    const vide = { ...r.plan, scenes: [] } as PlanValide;
    expect(html(createElement(Calques() as never, { planScenes: vide }))).not.toBe(avec);
  });
});

describe("(d) porte fermée : rien ne passe sans capacité", () => {
  it.each(IDS_OBJETS)("%s : sans objetsPermis, aucune scène objet- gardée", (id) => {
    const r = validerPlan(planAvec(id, BRIQUES_OBJETS[id].exemple) as never, contexte);
    expect(r.plan.scenes.every((s) => !s.piece.startsWith("objet-"))).toBe(true);
  });
});
