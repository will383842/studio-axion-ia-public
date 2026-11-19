/**
 * BR-OBJETS-2027-b : croquis et traits de feutre inscrits au plan de scènes, PORTE FERMÉE.
 * (a) permis : la scène `objet-feutre-soulignement` rendue par un Claude simulé est GARDÉE (vraie fonction `adapterPlan`) ;
 * (b) sans permis : consigne identique au caractère près et scène retirée ; (c) rendu par instants.
 * Aucun appel réel : Claude est simulé.
 */
import { describe, expect, it } from "vitest";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { adapterPlan, type EntreeAdaptateur } from "@/briques/plan-scenes-generateurs/adaptateur";
import { enMillisecondes, segmenterEnPhrases, type MotEnSecondes } from "@/briques/plan-scenes-generateurs/video";
import { RENDUS_OBJETS } from "@/briques/plan-scenes/briques/objets-inscrits";
import type { ProprietesBrique } from "@/briques/plan-scenes/briques/communs";
import { TOILES } from "@/briques/plan-scenes/toiles";
import type { RequeteClaude, ReponseClaude } from "@/fournisseurs/claude/client";
import { EXEMPLES_OBJETS_2027 } from "@/briques/motion/petits-objets/objets-2027";

const SCRIPT = "Ce n'est pas douze heures mais deux heures de travail par semaine pour chaque dossier ouvert ici";
const MOTS: MotEnSecondes[] = SCRIPT.split(" ").map((texte, i) => ({ texte, debutSec: (i * 350) / 1000, finSec: (i * 350 + 300) / 1000 }));
const entree = (objetsPermis?: string[]): EntreeAdaptateur => ({ generateur: "cas-concret", script: SCRIPT, segments: segmenterEnPhrases(enMillisecondes(MOTS)), format: { largeur: 1080, hauteur: 1920, fps: 25 }, facecam: false, ...(objetsPermis ? { objetsPermis } : {}) });

/** Claude simulé : un plan avec une scène « soulignement au feutre » calée sur les mots 2 à 5. */
function claudeSimule() {
  const requetes: RequeteClaude[] = [];
  const appeler = async (req: RequeteClaude): Promise<ReponseClaude> => {
    requetes.push(req);
    const plan = {
      version: "plan-scenes-1",
      scenes: [{ id: "f", version: 1, mots: { premier: 2, dernier: 5 }, debutMs: 700, finMs: 2400, niveau: 1, position: "centre", transition: { entree: "fondu", sortie: "fondu", dureeMs: 300 }, piece: "objet-feutre-soulignement", parametres: EXEMPLES_OBJETS_2027.feutreSoulignement[0] }],
    };
    return { texte: JSON.stringify(plan), stopReason: "end_turn" } as ReponseClaude;
  };
  return { requetes, appeler };
}
const pieces = (r: Awaited<ReturnType<typeof adapterPlan>>) => (r.plan?.scenes ?? []).map((s) => s.piece);

describe("(a) permis : la scène feutre est gardée", () => {
  it("objetsPermis contenant objet-feutre-soulignement → la scène est gardée", async () => {
    const c = claudeSimule();
    const r = await adapterPlan(entree(["objet-feutre-soulignement"]), { appeler: c.appeler });
    expect(c.requetes.length).toBeGreaterThan(0);
    expect(pieces(r)).toContain("objet-feutre-soulignement");
  });
});

describe("(b) porte fermée : identique à avant", () => {
  it("sans objetsPermis : consigne identique au caractère près, aucune scène objet-feutre", async () => {
    const a = claudeSimule();
    const b = claudeSimule();
    const sans = await adapterPlan(entree(), { appeler: a.appeler });
    const vide = await adapterPlan(entree([]), { appeler: b.appeler });
    expect(JSON.stringify(a.requetes)).toBe(JSON.stringify(b.requetes));
    expect(JSON.stringify(a.requetes)).not.toContain("objet-feutre");
    expect(JSON.stringify(a.requetes)).not.toContain("objet-croquis");
    expect(pieces(sans).some((p) => p.startsWith("objet-"))).toBe(false);
    expect(vide).toEqual(sans);
  });
  it("les 3 pièces ont une toile en dur identique à leur définition", () => {
    for (const id of ["objet-croquis", "objet-feutre-entourage", "objet-feutre-soulignement"] as const) expect(TOILES[id]).toEqual({ largeur: 1000, hauteur: 1000 });
  });
});

describe("(c) rendu par instants", () => {
  const exemples = { "objet-feutre-soulignement": EXEMPLES_OBJETS_2027.feutreSoulignement[0], "objet-croquis": EXEMPLES_OBJETS_2027.croquis[0] } as const;
  for (const id of ["objet-feutre-soulignement", "objet-croquis"] as const) {
    it(`${id} : 0 %, 50 %, 100 % donnent 3 sorties différentes`, () => {
      const R = RENDUS_OBJETS[id as keyof typeof RENDUS_OBJETS] as (p: ProprietesBrique<unknown>) => unknown;
      const fps = 25;
      const dureeImages = 50;
      const sortie = (image: number) => renderToStaticMarkup(createElement(R as never, { image, fps, dureeImages, fond: "noir", parametres: exemples[id] } as never) as never);
      const [a, b, c] = [sortie(0), sortie(dureeImages / 2), sortie(dureeImages)];
      expect(new Set([a, b, c]).size).toBe(3);
    });
  }
});
