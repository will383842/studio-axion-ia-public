/**
 * C9-34-TRAITS-v19c : double soulignement, soulignement ondulé, surligneur, flèche droite, flèche courbe et flèche en pointillés
 * inscrits au plan de scènes, PORTE FERMÉE (aucun profil ne permet `objet.trait`).
 * (a) inscription, toile, capacité, exemple valide ; (b) éteint = identique ; (c) permis : gardé / retiré ;
 * (d) rendu par instants ; (e) une ligne « ce que la pièce montre ».
 * Aides recopiées de objets-n05-inscrits.test.ts (non importé). Aucun appel réel : Claude est simulé.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { adapterPlan, type EntreeAdaptateur } from "@/briques/plan-scenes-generateurs/adaptateur";
import { enMillisecondes, segmenterEnPhrases, type MotEnSecondes } from "@/briques/plan-scenes-generateurs/video";
import { BRIQUES_OBJETS, RENDUS_OBJETS } from "@/briques/plan-scenes/briques/objets-inscrits";
import type { ProprietesBrique } from "@/briques/plan-scenes/briques/communs";
import { IDS_PIECES } from "@/briques/plan-scenes/catalogue";
import { consignePlan } from "@/briques/plan-scenes/generateur";
import { TOILES } from "@/briques/plan-scenes/toiles";
import { MONTRE_PAR_PIECE } from "@/briques/note-extraits/moments-ecran";
import { consigneRetouche } from "@/services/retouche-chat/comprendre";
import type { RequeteClaude, ReponseClaude } from "@/fournisseurs/claude/client";
import { EXEMPLES_SOULIGNEMENTS } from "@/briques/motion/petits-objets/soulignements";
import { EXEMPLES_FLECHES } from "@/briques/motion/petits-objets/fleches";
import { definitionObjet } from "@/briques/plan-scenes-objets/registre";

const IDS = ["objet-soulignement-vague", "objet-soulignement-double", "objet-surligneur", "objet-fleche-droite", "objet-fleche-courbe", "objet-fleche-pointillee"] as const;
type Id = (typeof IDS)[number];
const EXEMPLES: Record<Id, unknown> = {
  "objet-soulignement-vague": EXEMPLES_SOULIGNEMENTS[0],
  "objet-soulignement-double": EXEMPLES_SOULIGNEMENTS[0],
  "objet-surligneur": EXEMPLES_SOULIGNEMENTS[0],
  "objet-fleche-droite": EXEMPLES_FLECHES[0],
  "objet-fleche-courbe": EXEMPLES_FLECHES[1],
  "objet-fleche-pointillee": EXEMPLES_FLECHES[2],
};
/** Empreinte (sha256) des requêtes envoyées au Claude simulé, SANS objetsPermis, relevée sur master f709ff8a avant la modification. */
const EMPREINTE_MASTER = "f076a4248790c6baa3fa772c26d979be55bb1327d415173d3900dda0c95461e2";

const SCRIPT = "Ce n'est pas douze heures mais deux heures de travail par semaine pour chaque dossier ouvert ici";
const mots = (s: string): MotEnSecondes[] => s.split(" ").map((texte, i) => ({ texte, debutSec: (i * 350) / 1000, finSec: (i * 350 + 300) / 1000 }));
const entree = (objetsPermis?: string[]): EntreeAdaptateur => ({ generateur: "cas-concret", script: SCRIPT, segments: segmenterEnPhrases(enMillisecondes(mots(SCRIPT))), format: { largeur: 1080, hauteur: 1920, fps: 25 }, facecam: false, ...(objetsPermis ? { objetsPermis } : {}) });

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
const FLECHE = (parametres: unknown): Scene => ({ id: "a", piece: "objet-fleche-droite", parametres, mots: { premier: 2, dernier: 5 }, debutMs: 700, finMs: 1900 });

describe("(a) inscription, toile, capacité, exemple", () => {
  it.each(IDS)("%s : dans la liste des pièces, avec rendu, toile recopiée, capacité objet.trait, exemple valide", (id) => {
    expect(IDS_PIECES).toContain(id);
    expect(RENDUS_OBJETS[id]).toBeTypeOf("function");
    const def = definitionObjet(id);
    expect(def?.id).toBe(id);
    expect(def?.capacite).toBe("objet.trait");
    expect(TOILES[id]).toEqual(def?.toile);
    expect(BRIQUES_OBJETS[id].toile).toEqual(def?.toile);
    expect(def?.valider(EXEMPLES[id])).not.toBeNull();
  });
});

describe("(b) porte fermée : identique à avant", () => {
  it("consignes inchangées, empreinte des requêtes identique à master, aucune scène objet-*", async () => {
    expect(consignePlan()).toBe(readFileSync(new URL("./__fixtures__/consigne-avant-porte.txt", import.meta.url), "utf8"));
    expect(consignePlan([])).toBe(consignePlan());
    expect(consigneRetouche()).toBe(readFileSync(new URL("./__fixtures__/consigne-retouche-avant-objets.txt", import.meta.url), "utf8"));
    const a = claudeSimule([FLECHE(EXEMPLES["objet-fleche-droite"])]);
    const sans = await adapterPlan(entree(), { appeler: a.appeler });
    expect(createHash("sha256").update(JSON.stringify(a.requetes)).digest("hex")).toBe(EMPREINTE_MASTER);
    for (const id of IDS) expect(JSON.stringify(a.requetes)).not.toContain(id);
    expect(pieces(sans).some((p) => p.startsWith("objet-"))).toBe(false);
  });
});

describe("(c) permis", () => {
  it("paramètres valides → scène gardée ; invalides → scène retirée ; la consigne liste la pièce seulement si permise", async () => {
    const bon = claudeSimule([FLECHE(EXEMPLES["objet-fleche-droite"])]);
    const r = await adapterPlan(entree([...IDS]), { appeler: bon.appeler });
    expect(pieces(r)).toContain("objet-fleche-droite");
    const mauvais = claudeSimule([FLECHE({ de: "ici", vers: 3 })]);
    const r2 = await adapterPlan(entree([...IDS]), { appeler: mauvais.appeler });
    expect(pieces(r2)).not.toContain("objet-fleche-droite");
    expect(consignePlan([...IDS])).toContain("- objet-fleche-droite (");
    expect(consignePlan()).not.toContain("- objet-fleche-droite (");
  });
});

describe("(d) rendu par instants", () => {
  it.each(IDS)("%s : début, milieu, fin sans erreur, début ≠ fin", (id) => {
    const R = RENDUS_OBJETS[id] as (p: ProprietesBrique<unknown>) => unknown;
    const dureeImages = 50;
    const sortie = (image: number) => renderToStaticMarkup(createElement(R as never, { image, fps: 25, dureeImages, fond: "noir", parametres: EXEMPLES[id] } as never) as never);
    const [debut, milieu, fin] = [sortie(0), sortie(dureeImages / 2), sortie(dureeImages)];
    expect(debut).not.toBe(fin);
    expect(typeof milieu).toBe("string");
  });
});

describe("(e) chaque pièce a sa ligne « ce qu'elle montre »", () => {
  it.each(IDS)("%s", (id) => {
    expect(MONTRE_PAR_PIECE[id]).toBeDefined();
  });
});
