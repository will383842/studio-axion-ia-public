/**
 * N-05-v19b : carton magazine, icône qui tourne, particules, panneau de réglages et anneau de données inscrits
 * au plan de scènes, PORTE FERMÉE.
 * (a) permis : les scènes rendues par un Claude simulé sont GARDÉES (vraie fonction `adapterPlan`) ;
 * (b) sans permis : consigne identique au caractère près (empreinte relevée sur master avant la modification) ;
 * (c) toile, capacité et registre ; (d) rendu par instants ; (e) anneau : le chiffre affiché est le chiffre fourni.
 * Aucun appel réel : Claude est simulé.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { adapterPlan, type EntreeAdaptateur } from "@/briques/plan-scenes-generateurs/adaptateur";
import { enMillisecondes, segmenterEnPhrases, type MotEnSecondes } from "@/briques/plan-scenes-generateurs/video";
import { BRIQUES_OBJETS, RENDUS_OBJETS } from "@/briques/plan-scenes/briques/objets-inscrits";
import type { ProprietesBrique } from "@/briques/plan-scenes/briques/communs";
import { TOILES } from "@/briques/plan-scenes/toiles";
import type { RequeteClaude, ReponseClaude } from "@/fournisseurs/claude/client";
import { EXEMPLES_CARTON_MAGAZINE } from "@/briques/motion/petits-objets/carton-magazine";
import { EXEMPLES_OBJET_TOURNE } from "@/briques/motion/petits-objets/objet-tourne";
import { EXEMPLES_PARTICULES } from "@/briques/motion/petits-objets/particules";
import { EXEMPLES_PANNEAU_REGLAGES } from "@/briques/motion/petits-objets/panneau-reglages";
import { EXEMPLES_ANNEAU } from "@/briques/motion/petits-objets/anneau-donnees";
import { definitionObjet } from "@/briques/plan-scenes-objets/registre";
import { PROFIL_CAS_CONCRET } from "@/briques/bibliotheque-video/profils/cas-concret";

const IDS = ["objet-carton-magazine", "objet-tourne", "objet-particules", "objet-panneau-reglages", "objet-anneau-donnees"] as const;
type Id = (typeof IDS)[number];
const EXEMPLES: Record<Id, unknown> = {
  "objet-carton-magazine": EXEMPLES_CARTON_MAGAZINE[0],
  "objet-tourne": EXEMPLES_OBJET_TOURNE[0],
  "objet-particules": EXEMPLES_PARTICULES[0],
  "objet-panneau-reglages": EXEMPLES_PANNEAU_REGLAGES[0],
  "objet-anneau-donnees": EXEMPLES_ANNEAU[0],
};
/** Empreinte (sha256) des requêtes envoyées au Claude simulé, SANS objetsPermis, relevée sur master 10c36421 avant la modification. */
const EMPREINTE_MASTER = "f076a4248790c6baa3fa772c26d979be55bb1327d415173d3900dda0c95461e2";

const SCRIPT = "Ce n'est pas douze heures mais deux heures de travail par semaine pour chaque dossier ouvert ici";
const SCRIPT_30 = "Déjà 30 % des visiteurs reviennent chaque semaine sur le site";
const mots = (s: string): MotEnSecondes[] => s.split(" ").map((texte, i) => ({ texte, debutSec: (i * 350) / 1000, finSec: (i * 350 + 300) / 1000 }));
const entree = (script: string, objetsPermis?: string[]): EntreeAdaptateur => ({ generateur: "cas-concret", script, segments: segmenterEnPhrases(enMillisecondes(mots(script))), format: { largeur: 1080, hauteur: 1920, fps: 25 }, facecam: false, ...(objetsPermis ? { objetsPermis } : {}) });

type Scene = { id: string; piece: string; parametres: unknown; mots: { premier: number; dernier: number }; debutMs: number; finMs: number };
function claudeSimule(scenes: Scene[]) {
  const requetes: RequeteClaude[] = [];
  const appeler = async (req: RequeteClaude): Promise<ReponseClaude> => {
    requetes.push(req);
    const plan = { version: "plan-scenes-1", scenes: scenes.map((s) => ({ ...s, version: 1, niveau: 1, position: "centre", transition: { entree: "fondu", sortie: "fondu", dureeMs: 300 } })) };
    return { texte: JSON.stringify(plan), stopReason: "end_turn" } as ReponseClaude;
  };
  return { requetes, appeler };
}
const pieces = (r: Awaited<ReturnType<typeof adapterPlan>>) => (r.plan?.scenes ?? []).map((s) => s.piece);
const DEUX: Scene[] = [
  { id: "a", piece: "objet-carton-magazine", parametres: EXEMPLES["objet-carton-magazine"], mots: { premier: 2, dernier: 5 }, debutMs: 700, finMs: 1900 },
  { id: "b", piece: "objet-particules", parametres: EXEMPLES["objet-particules"], mots: { premier: 8, dernier: 11 }, debutMs: 2800, finMs: 4000 },
];

describe("(a) permis : les scènes sont gardées", () => {
  it("carton magazine et particules permis → les deux scènes sont gardées", async () => {
    const c = claudeSimule(DEUX);
    const r = await adapterPlan(entree(SCRIPT, [...IDS]), { appeler: c.appeler });
    expect(c.requetes.length).toBeGreaterThan(0);
    expect(pieces(r)).toEqual(expect.arrayContaining(["objet-carton-magazine", "objet-particules"]));
  });
});

describe("(b) porte fermée : identique à avant", () => {
  it("sans objetsPermis : consigne identique à master au caractère près, aucune scène objet-*", async () => {
    const a = claudeSimule(DEUX);
    const b = claudeSimule(DEUX);
    const sans = await adapterPlan(entree(SCRIPT), { appeler: a.appeler });
    const vide = await adapterPlan(entree(SCRIPT, []), { appeler: b.appeler });
    expect(createHash("sha256").update(JSON.stringify(a.requetes)).digest("hex")).toBe(EMPREINTE_MASTER);
    expect(JSON.stringify(a.requetes)).toBe(JSON.stringify(b.requetes));
    for (const id of IDS) expect(JSON.stringify(a.requetes)).not.toContain(id);
    expect(pieces(sans).some((p) => p.startsWith("objet-"))).toBe(false);
    expect(vide).toEqual(sans);
  });
});

describe("(c) toile, capacité, registre", () => {
  it.each(IDS)("%s : toile, capacité au profil, définition au registre", (id) => {
    expect(TOILES[id]).toEqual(BRIQUES_OBJETS[id].toile);
    const def = definitionObjet(id);
    expect(def?.id).toBe(id);
    expect(Object.keys(PROFIL_CAS_CONCRET.capacites)).toContain(def?.capacite);
  });
});

describe("(d) rendu par instants", () => {
  it.each(IDS)("%s : 0 %, 50 %, 100 % donnent 3 sorties différentes, sans image", (id) => {
    const R = RENDUS_OBJETS[id] as (p: ProprietesBrique<unknown>) => unknown;
    const dureeImages = 50;
    const sortie = (image: number) => renderToStaticMarkup(createElement(R as never, { image, fps: 25, dureeImages, fond: "noir", parametres: EXEMPLES[id] } as never) as never);
    const [a, b, c] = [sortie(0), sortie(dureeImages / 2), sortie(dureeImages)];
    expect(new Set([a, b, c]).size).toBe(3);
    for (const s of [a, b, c]) expect(s).not.toContain("<img");
  });
});

describe("(e) anneau de données : le chiffre affiché est le chiffre fourni", () => {
  it("scène anneau gardée quand il est permis, et « 30 » est affiché", async () => {
    const scene: Scene = { id: "n", piece: "objet-anneau-donnees", parametres: { valeur: 30, libelle: "des visiteurs" }, mots: { premier: 1, dernier: 3 }, debutMs: 350, finMs: 1500 };
    const c = claudeSimule([scene]);
    const r = await adapterPlan(entree(SCRIPT_30, ["objet-anneau-donnees"]), { appeler: c.appeler });
    expect(pieces(r)).toContain("objet-anneau-donnees");
    const R = RENDUS_OBJETS["objet-anneau-donnees"] as (p: ProprietesBrique<unknown>) => unknown;
    const html = renderToStaticMarkup(createElement(R as never, { image: 50, fps: 25, dureeImages: 50, fond: "noir", parametres: scene.parametres } as never) as never);
    expect(html).toContain("30");
  });
});
