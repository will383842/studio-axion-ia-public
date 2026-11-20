/**
 * C9-34-FIN-v20h : les 10 derniers petits objets (dossier, chrono, barre de progression, étape en segments, 3 appels, frise de montage,
 * pellicule, onde) sont inscrits au plan de scènes, PORTE FERMÉE. `objet-volet-avant-apres` est inscrit ensuite par N-05-VOLET-d-v20j, sans adresse.
 * (a) inscription, toile, moment ; (b) volet non inscrit ; (c) consigne sans permis IDENTIQUE à master ; (d) aucun profil ne permet ces objets.
 * Aucun appel réel : Claude est simulé.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { ID } from "@/briques/bibliotheque-video/noms";
import { PROFILS_DU_CODE } from "@/briques/bibliotheque-video/profils";
import type { EntreeBibliotheque } from "@/briques/bibliotheque-video/types";
import { VERSION_BIBLIOTHEQUE } from "@/briques/bibliotheque-video/version";
import { MONTRE_PAR_PIECE } from "@/briques/note-extraits/moments-ecran";
import { adapterPlan, type EntreeAdaptateur } from "@/briques/plan-scenes-generateurs/adaptateur";
import { enMillisecondes, segmenterEnPhrases, type MotEnSecondes } from "@/briques/plan-scenes-generateurs/video";
import { piecesPermisesDesEntrees } from "@/briques/plan-scenes-objets/pieces-permises";
import { definitionObjet } from "@/briques/plan-scenes-objets/registre";
import { BRIQUES_OBJETS, RENDUS_OBJETS } from "@/briques/plan-scenes/briques/objets-inscrits";
import { CATALOGUE_BRIQUES, IDS_PIECES } from "@/briques/plan-scenes/catalogue";
import { consignePlan } from "@/briques/plan-scenes/generateur";
import { TOILES } from "@/briques/plan-scenes/toiles";
import { EXEMPLES_DOSSIER_CHRONO_BARRE } from "@/briques/motion/petits-objets/dossier-chrono-barre";
import { EXEMPLES_ETAPES } from "@/briques/motion/petits-objets/etapes";
import { EXEMPLES_APPEL_ACTION } from "@/briques/motion/petits-objets/appel-action";
import { EXEMPLES_APPEL_MOT } from "@/briques/motion/petits-objets/appel-mot";
import { EXEMPLES_APPEL_RDV } from "@/briques/motion/petits-objets/appel-rdv";
import { EXEMPLES_FRISE } from "@/briques/motion/petits-objets/frise-montage";
import { EXEMPLES_PELLICULE } from "@/briques/motion/petits-objets/pellicule";
import { EXEMPLES_ONDE } from "@/briques/motion/petits-objets/onde";
import { consigneRetouche } from "@/services/retouche-chat/comprendre";
import type { ReponseClaude, RequeteClaude } from "@/fournisseurs/claude/client";

const IDS = ["objet-dossier", "objet-chrono", "objet-barre-progression", "objet-etape-segments", "objet-appel-action", "objet-appel-mot", "objet-appel-rdv", "objet-frise-montage", "objet-pellicule", "objet-onde-motif"] as const;
const EXEMPLES: Record<(typeof IDS)[number], unknown> = {
  "objet-dossier": EXEMPLES_DOSSIER_CHRONO_BARRE.dossier[0], "objet-chrono": EXEMPLES_DOSSIER_CHRONO_BARRE.chrono[0], "objet-barre-progression": EXEMPLES_DOSSIER_CHRONO_BARRE.barre[0],
  "objet-etape-segments": EXEMPLES_ETAPES[0], "objet-appel-action": EXEMPLES_APPEL_ACTION[0], "objet-appel-mot": EXEMPLES_APPEL_MOT[0], "objet-appel-rdv": EXEMPLES_APPEL_RDV[0],
  "objet-frise-montage": EXEMPLES_FRISE[0], "objet-pellicule": EXEMPLES_PELLICULE[0], "objet-onde-motif": EXEMPLES_ONDE[0],
};
/** Empreinte (sha256) des requêtes envoyées au Claude simulé SANS objetsPermis : valeur de objets-schemas-inscrits.test.ts, relevée sur master avant toute inscription. */
const EMPREINTE_BASE = "f076a4248790c6baa3fa772c26d979be55bb1327d415173d3900dda0c95461e2";

const SCRIPT = "Ce n'est pas douze heures mais deux heures de travail par semaine pour chaque dossier ouvert ici";
const mots = (s: string): MotEnSecondes[] => s.split(" ").map((texte, i) => ({ texte, debutSec: (i * 350) / 1000, finSec: (i * 350 + 300) / 1000 }));
const entree = (objetsPermis?: string[]): EntreeAdaptateur => ({ generateur: "cas-concret", script: SCRIPT, segments: segmenterEnPhrases(enMillisecondes(mots(SCRIPT))), format: { largeur: 1080, hauteur: 1920, fps: 25 }, facecam: false, ...(objetsPermis ? { objetsPermis } : {}) });

describe("(a) inscription, toile, moment", () => {
  it.each(IDS)("%s : dans la liste des pièces, avec rendu, toile recopiée du registre, moment", (id) => {
    expect(IDS_PIECES).toContain(id);
    expect(CATALOGUE_BRIQUES).toHaveProperty(id);
    expect(RENDUS_OBJETS[id]).toBeTypeOf("function");
    const def = definitionObjet(id);
    expect(def?.id).toBe(id);
    expect(TOILES[id]).toEqual(def?.toile);
    expect(BRIQUES_OBJETS[id].toile).toEqual(def?.toile);
    expect(MONTRE_PAR_PIECE[id]).toBeDefined();
    expect(def?.valider(EXEMPLES[id])).not.toBeNull();
  });
});

describe("(b) le volet avant/après est inscrit au plan de scènes SANS adresse (N-05-VOLET-d-v20j, seconde lecture du pilote)", () => {
  it("objet-volet-avant-apres inscrit, toile 1000 × 625, exemple sans avant ni apres, adresses refusées", () => {
    expect(IDS_PIECES as readonly string[]).toContain("objet-volet-avant-apres");
    const def = (CATALOGUE_BRIQUES as Record<string, { exemple: unknown; schema: { safeParse: (x: unknown) => { success: boolean } } }>)["objet-volet-avant-apres"];
    expect(def).toBeDefined();
    expect(TOILES["objet-volet-avant-apres" as keyof typeof TOILES]).toEqual({ largeur: 1000, hauteur: 625 });
    expect(def.exemple).toEqual({ etiquettes: true });
    expect(def.exemple).not.toHaveProperty("avant");
    expect(def.exemple).not.toHaveProperty("apres");
    expect(def.schema.safeParse({ avant: "a", apres: "b" }).success).toBe(false);
  });
});

describe("(c) porte fermée : consigne sans permis identique à master", () => {
  it("consignes identiques aux fichiers figés, empreinte des requêtes identique, aucun de ces objets cité", async () => {
    expect(consignePlan()).toBe(readFileSync(new URL("./__fixtures__/consigne-avant-porte.txt", import.meta.url), "utf8"));
    expect(consignePlan([])).toBe(consignePlan());
    expect(consigneRetouche()).toBe(readFileSync(new URL("./__fixtures__/consigne-retouche-avant-objets.txt", import.meta.url), "utf8"));
    const requetes: RequeteClaude[] = [];
    /* Même plan simulé que objets-schemas-inscrits.test.ts (une scène objet-schema-flux) : les requêtes envoyées sont donc comparables à son empreinte. */
    const plan = { version: "plan-scenes-1", scenes: [{ id: "a", piece: "objet-schema-flux", parametres: { etapes: 42 }, mots: { premier: 2, dernier: 5 }, debutMs: 700, finMs: 1900, version: 1, niveau: 1, position: "centre", transition: { entree: "fondu", sortie: "fondu", dureeMs: 300 } }] };
    const appeler = async (req: RequeteClaude): Promise<ReponseClaude> => (requetes.push(req), { texte: JSON.stringify(plan), stopReason: "end_turn" } as ReponseClaude);
    await adapterPlan(entree(), { appeler });
    expect(createHash("sha256").update(JSON.stringify(requetes)).digest("hex")).toBe(EMPREINTE_BASE);
    for (const id of IDS) expect(JSON.stringify(requetes)).not.toContain(id);
  });
});

describe("(d) aucun profil ne permet ces objets", () => {
  it("chaque profil du code : liste des pièces permises vide", () => {
    for (const [nom, profil] of Object.entries(PROFILS_DU_CODE)) {
      const e: EntreeBibliotheque = { version: VERSION_BIBLIOTHEQUE, profil, recents: [], graine: "G", figeeLe: "2026-11-20" };
      const permises = piecesPermisesDesEntrees({ bibliothequeVideo: e });
      for (const id of IDS) expect(permises, `${nom} / ${id}`).not.toContain(id);
    }
    expect(ID.objetAppel).toBe("objet.appel");
  });
});
