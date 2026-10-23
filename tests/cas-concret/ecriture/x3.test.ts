/**
 * X3 : la réponse d'un rôle SANS schéma n'a jamais de `donnees` (`lireSortie`, `fournisseurs/claude/inscription.ts`) ;
 * le chemin de dépense rend son texte BRUT (`texte`) et sa raison d'arrêt (`stopReason`). L'écriture et la reformulation
 * lisent ce texte. Doubles seulement : aucun appel réel.
 */
import { describe, expect, it } from "vitest";
import { construireRequete, type EntreeRole } from "@/generateur/roles/types";
import { trouverCas } from "@/formats/cas-concret/catalogue";
import { recettePour } from "@/formats/cas-concret/recette";
import {
  MAX_TOKENS_ECRITURE,
  REPONSE_COUPEE,
  ecrireFiche,
  reformulerPhrase,
  roleEcritureCasConcret,
  variableEcriture,
  type EntreeEcriture,
} from "@/moteurs/montage-cas-concret/ecriture";
import type { FicheEcrans } from "@/moteurs/montage-cas-concret/fiche";
import type { OutilsEcriture, ReponseAppelEcriture } from "@/moteurs/montage-cas-concret/outils";

const FIXE = { videoId: "video-1", versionId: "version-1", habillage: "charte-duo/1", origine: "porte-a" } as const;
const cas = trouverCas("recrutement-apporteurs")!;
const entree: EntreeEcriture = { ...FIXE, cas };

function ficheSimulee(): FicheEcrans {
  const sortie = roleEcritureCasConcret.simuler({ contexte: {}, variable: variableEcriture(cas, recettePour(cas), FIXE) });
  if (typeof sortie === "string") throw new Error("aucune fiche simulée");
  return sortie;
}

/** Forme RÉELLE d'une réponse de production d'un rôle sans schéma : `donnees` absent, `texte` rempli. */
const production = (texte: string, stopReason: string | null = "end_turn"): ReponseAppelEcriture => ({ ok: true, simule: false, texte, stopReason, coutUsd: 0.1 });

function double(reponses: ReponseAppelEcriture[]): OutilsEcriture & { appels: EntreeRole[] } {
  const appels: EntreeRole[] = [];
  return {
    appels,
    appeler: async (_role, e) => {
      appels.push(e);
      const r = reponses[appels.length - 1];
      if (!r) throw new Error("appel de trop");
      return r;
    },
    budget: { reserver: async () => ({ ok: true }) },
  };
}

describe("X3 · la réponse est lue par son texte", () => {
  it("écriture : une réponse de production (texte, sans `donnees`) donne la fiche en un appel", async () => {
    const d = double([production(JSON.stringify(ficheSimulee()))]);
    const r = await ecrireFiche(entree, d);
    expect(r.ok ? [] : r.refus).toEqual([]);
    expect(r.ok && r.appels).toBe(1);
    expect(r.ok && !r.simule).toBe(true);
  });

  it("écriture : `donnees` reste lu quand il existe", async () => {
    const d = double([{ ok: true, simule: true, donnees: ficheSimulee() }]);
    expect((await ecrireFiche(entree, d)).ok).toBe(true);
  });

  it("reformulation : une réponse de production (texte JSON, sans `donnees`) est lue", async () => {
    const phrase = "En 3 minutes, le dossier est prêt.";
    const d = double([production(JSON.stringify({ phrase: "Le dossier est prêt en 3 minutes." }))]);
    expect(await reformulerPhrase(phrase, [], d, { videoId: "v", appelId: "a" })).toEqual({ ok: true, phrase: "Le dossier est prêt en 3 minutes." });
  });

  it("reformulation : une réponse hors JSON est un REFUS, jamais lue comme une phrase (essai réel du 14/10)", async () => {
    const phrase = "On recrute nos collaborateurs en quinze minutes.";
    const refus = "PREUVE_MANQUANTE : aucun fait n'établit qu'un recrutement entier se fait en quinze minutes. Seul l'échange en visio dure 15 minutes.";
    const d = double([production(refus)]);
    const r = await reformulerPhrase(phrase, [], d, { videoId: "v", appelId: "a" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.raison).toContain("aucune phrase");
      expect(r.raison).toContain("PREUVE_MANQUANTE");
      expect(r.raison).not.toMatch(/nombres/);
    }
  });

  it("le plafond de 24 000 jetons de sortie est transmis à l'appel (15/10 : 12 000 coupait la fiche après la pensée)", () => {
    expect(MAX_TOKENS_ECRITURE).toBe(24000);
    expect(construireRequete(roleEcritureCasConcret, { contexte: {}, variable: "x" }).maxTokens).toBe(24000);
  });
});

describe("X3 · réponse coupée au plafond de jetons", () => {
  it("le refus dit qu'elle a été coupée, la relance demande une fiche plus courte", async () => {
    const texte = JSON.stringify(ficheSimulee());
    const d = double([production(texte.slice(0, 400), "max_tokens"), production(texte)]);
    const r = await ecrireFiche(entree, d);
    expect(r.ok && r.relance).toBe(true);
    const relance = d.appels[1].variable;
    expect(relance).toContain(REPONSE_COUPEE);
    expect(relance).toContain("plus courte");
    // La réponse coupée n'est pas renvoyée en entier.
    expect(relance).not.toContain(texte.slice(0, 400));
  });

  it("coupée deux fois : échec, le refus le dit", async () => {
    const d = double([production("{\"version\":", "max_tokens"), production("{\"version\":", "max_tokens")]);
    const r = await ecrireFiche(entree, d);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.refus.join(" ")).toContain("La réponse a été coupée avant la fin");
    expect(d.appels).toHaveLength(2);
  });

  it("une même fiche complète mais marquée coupée n'est pas acceptée", async () => {
    const d = double([production(JSON.stringify(ficheSimulee()), "max_tokens"), production(JSON.stringify(ficheSimulee()))]);
    const r = await ecrireFiche(entree, d);
    expect(r.ok && r.relance).toBe(true);
  });

  it("reformulation coupée : refusée en clair", async () => {
    const d = double([production("{\"phrase\": \"Le dossier", "max_tokens")]);
    const r = await reformulerPhrase("En 3 minutes, le dossier est prêt.", [], d, { videoId: "v", appelId: "a" });
    expect(r).toEqual({ ok: false, raison: REPONSE_COUPEE });
  });
});
