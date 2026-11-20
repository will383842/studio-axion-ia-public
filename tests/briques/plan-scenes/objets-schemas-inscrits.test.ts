/**
 * C9-34-SCHEMAS-v20g : 6 schémas (flux, étoile, icônes reliées, agents-globe, grille pointillée, vignettes numérotées),
 * fenêtre d'application et terminal inscrits au plan de scènes, PORTE FERMÉE (aucun profil ne permet ces objets).
 * (a) inscription, toile, capacité, exemple valide ; (b) éteint = identique ; (c) permis : gardé / retiré ;
 * (d) rendu par instants ; (e) une ligne « ce que la pièce montre ».
 * Modèle : objets-etiquettes-inscrits.test.ts, recopié. Aucun appel réel : Claude est simulé.
 * Note : `chargerJetBrainsMono` n'est appelé par personne, le terminal se rend en police de secours (acceptable porte fermée).
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
import { EXEMPLES_FLUX } from "@/briques/motion/petits-objets/schema-flux";
import { EXEMPLES_SCHEMAS } from "@/briques/motion/petits-objets/schemas-relies";
import { EXEMPLES_GRILLE, EXEMPLES_VIGNETTES } from "@/briques/motion/petits-objets/grille-vignettes";
import { EXEMPLES_FENETRE_APP } from "@/briques/motion/petits-objets/fenetre-app";
import { EXEMPLES_TERMINAL_COMMANDE } from "@/briques/motion/petits-objets/terminal-commande";
import { definitionObjet } from "@/briques/plan-scenes-objets/registre";

const IDS = ["objet-schema-flux", "objet-schema-etoile", "objet-icones-reliees", "objet-agents-globe", "objet-grille-pointillee", "objet-vignettes-numerotees", "objet-fenetre-app", "objet-terminal-commande"] as const;
type Id = (typeof IDS)[number];
const EXEMPLES: Record<Id, unknown> = {
  "objet-schema-flux": EXEMPLES_FLUX[0],
  "objet-schema-etoile": EXEMPLES_SCHEMAS.etoile[0],
  "objet-icones-reliees": EXEMPLES_SCHEMAS.icones[0],
  "objet-agents-globe": EXEMPLES_SCHEMAS.agents[0],
  "objet-grille-pointillee": EXEMPLES_GRILLE[0],
  "objet-vignettes-numerotees": EXEMPLES_VIGNETTES[0],
  "objet-fenetre-app": EXEMPLES_FENETRE_APP[0],
  "objet-terminal-commande": EXEMPLES_TERMINAL_COMMANDE[0],
};
const CAPACITE: Record<Id, string> = {
  "objet-schema-flux": "objet.reseau-schema", "objet-schema-etoile": "objet.schema", "objet-icones-reliees": "objet.reseau-schema", "objet-agents-globe": "objet.reseau-schema",
  "objet-grille-pointillee": "objet.schema", "objet-vignettes-numerotees": "objet.schema", "objet-fenetre-app": "objet.ecran", "objet-terminal-commande": "objet.ecran",
};
/** Empreinte (sha256) des requêtes envoyées au Claude simulé, SANS objetsPermis, relevée sur master (430cc7e, avant C9-34-SCHEMAS-v20g : valeur reprise du test ETIQUETTES, rejouée verte sur master daf253c avant toute modification). */
const EMPREINTE_BASE = "f076a4248790c6baa3fa772c26d979be55bb1327d415173d3900dda0c95461e2";

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
const FLUX = (parametres: unknown): Scene => ({ id: "a", piece: "objet-schema-flux", parametres, mots: { premier: 2, dernier: 5 }, debutMs: 700, finMs: 1900 });

describe("(a) inscription, toile, capacité, exemple", () => {
  it.each(IDS)("%s : dans la liste des pièces, avec rendu, toile recopiée, capacité attendue, exemple valide", (id) => {
    expect(IDS_PIECES).toContain(id);
    expect(RENDUS_OBJETS[id]).toBeTypeOf("function");
    const def = definitionObjet(id);
    expect(def?.id).toBe(id);
    expect(def?.capacite).toBe(CAPACITE[id]);
    expect(TOILES[id]).toEqual(def?.toile);
    expect(BRIQUES_OBJETS[id].toile).toEqual(def?.toile);
    expect(def?.valider(EXEMPLES[id])).not.toBeNull();
  });
});

describe("(b) porte fermée : identique à avant", () => {
  it("consignes inchangées, empreinte des requêtes identique à la base, aucune scène objet-*", async () => {
    expect(consignePlan()).toBe(readFileSync(new URL("./__fixtures__/consigne-avant-porte.txt", import.meta.url), "utf8"));
    expect(consignePlan([])).toBe(consignePlan());
    expect(consigneRetouche()).toBe(readFileSync(new URL("./__fixtures__/consigne-retouche-avant-objets.txt", import.meta.url), "utf8"));
    const a = claudeSimule([FLUX(EXEMPLES["objet-schema-flux"])]);
    const sans = await adapterPlan(entree(), { appeler: a.appeler });
    expect(createHash("sha256").update(JSON.stringify(a.requetes)).digest("hex")).toBe(EMPREINTE_BASE);
    for (const id of IDS) expect(JSON.stringify(a.requetes)).not.toContain(id);
    expect(pieces(sans).some((p) => p.startsWith("objet-"))).toBe(false);
  });
});

describe("(c) permis", () => {
  it("paramètres valides → scène gardée ; invalides → scène retirée ; la consigne liste la pièce seulement si permise", async () => {
    const bon = claudeSimule([FLUX(EXEMPLES["objet-schema-flux"])]);
    const r = await adapterPlan(entree([...IDS]), { appeler: bon.appeler });
    expect(pieces(r)).toContain("objet-schema-flux");
    const mauvais = claudeSimule([FLUX({ etapes: 42 })]);
    const r2 = await adapterPlan(entree([...IDS]), { appeler: mauvais.appeler });
    expect(pieces(r2)).not.toContain("objet-schema-flux");
    expect(consignePlan([...IDS])).toContain("- objet-schema-flux (");
    expect(consignePlan()).not.toContain("- objet-schema-flux (");
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
