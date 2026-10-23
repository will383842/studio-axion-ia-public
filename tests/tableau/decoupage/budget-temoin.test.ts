/**
 * Non-régression du DÉCOUPAGE VIDE (constat du 12/10 en production : script « Formation », style « blocs/2 », deux
 * appels payés, puis « La réponse est vide : aucune fiche rendue. ») :
 *  - la cause : le rôle du découpage n'a pas de schéma, et `lireSortie` ne remplit `donnees` que pour un rôle avec
 *    schéma ; le service lit désormais le texte brut (`reponseDecoupageDepuis`) ;
 *  - le budget : la fiche témoin « Formation » (10 scènes, écrans compris), rendue en JSON indenté, tient 2,5 fois dans
 *    le budget de texte, pensée comptée à part ; rejouée avec une réponse simulée de taille réelle, elle est acceptée ;
 *  - une réponse coupée donne l'issue « tronquee », sans relance.
 * Aucun appel réseau, rien de payé.
 */
import { describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../../helpers/next-mocks";
import { jetonsEstimes } from "../../../src/fournisseurs/claude/tarifs";
import {
  BUDGET_PENSEE_DECOUPAGE,
  BUDGET_TEXTE_DECOUPAGE,
  coutEstimeUsd,
  coutPireDecoupageUsd,
  decouperEnScenes,
  MAX_TOKENS_DECOUPAGE,
  roleDecoupageTableau,
  variableDecoupage,
  variableRelance,
  type EntreeDecoupage,
  type ReponseAppelDecoupage,
} from "../../../src/moteurs/montage-tableau/decoupage";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { contexteFormation, ficheFormation } from "../style-v2/temoin-formation";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { lireSortie } = await import("../../../src/fournisseurs/claude/inscription");
const { reponseDecoupageDepuis } = await import("../../../src/services/tableau-creation");
const { MARGE_CREDITS } = await import("../../../src/services/credits");
const { PLAFOND_DECOUPAGE_TABLEAU_USD } = await import("../../../src/services/depense-claude-video");

const fiche = ficheFormation();

/** L'entrée du découpage qui doit redonner la fiche témoin (dessins et preuves fournis : ceux de la fiche). */
function entree(): EntreeDecoupage {
  const { texteScript, ...controle } = contexteFormation();
  const dessins = [...new Set(fiche.scenes.flatMap((s) => s.elements.flatMap((e) => (e.type === "dessin" ? [e.dessinId] : []))))].map((id) => ({ id, motsCles: [id] }));
  const preuves = [...new Set(fiche.scenes.flatMap((s) => s.elements.flatMap((e) => (e.type === "preuve" ? [e.preuveId] : []))))].map((id) => ({ id, resume: id }));
  return { texteScript, structure: fiche.structure, serie: fiche.serie, douleur: fiche.douleur, gesteMinute: fiche.gesteMinute, preuves, dessins, videoId: fiche.videoId, versionId: fiche.versionId, habillage: fiche.habillage, stylo: fiche.stylo, ratio: fiche.ratio, controle };
}

function outils(reponses: ReponseAppelDecoupage[]) {
  const appels: string[] = [];
  return {
    appels,
    appeler: async (_r: unknown, e: { variable: string }) => {
      appels.push(e.variable);
      const r = reponses[appels.length - 1];
      if (!r) throw new Error("appel de trop");
      return r;
    },
    budget: { reserver: async () => ({ ok: true as const }) },
  };
}

describe("la cause exacte du découpage vide", () => {
  const reponseClaude = { texte: JSON.stringify(fiche), modeleDemande: "claude-opus-5-5", modele: "claude-opus-5-5", replis: [], stopReason: "end_turn", jetons: { entree: 1, cacheLu: 0, cacheEcrit: 0, sortie: 1 } };

  it("un rôle SANS schéma n'a jamais de `donnees` (lireSortie) : on ne lisait que `donnees`", () => {
    expect(roleDecoupageTableau).not.toHaveProperty("schema");
    expect(lireSortie(roleDecoupageTableau, reponseClaude).donnees).toBeUndefined();
  });

  it("désormais le texte brut est lu, avec la raison d'arrêt, les jetons et le coût réel", () => {
    const r = reponseDecoupageDepuis({ ok: true, simule: false, coutUsd: 0.083, modele: "claude-opus-5-5", texte: reponseClaude.texte, stopReason: "end_turn", jetons: reponseClaude.jetons });
    expect(r).toMatchObject({ ok: true, donnees: reponseClaude.texte, stopReason: "end_turn", coutUsd: 0.083, jetons: reponseClaude.jetons });
  });
});

describe("budget de sortie du découpage (fiche témoin « Formation », style blocs/2)", () => {
  const indentee = JSON.stringify(fiche, null, 2);

  it("la fiche témoin indentée tient 2,5 fois dans le budget de texte ; la pensée est comptée à part", () => {
    const jetons = jetonsEstimes(indentee);
    expect(jetons * 2.5).toBeLessThanOrEqual(BUDGET_TEXTE_DECOUPAGE);
    expect(MAX_TOKENS_DECOUPAGE).toBe(BUDGET_TEXTE_DECOUPAGE + BUDGET_PENSEE_DECOUPAGE);
    expect(roleDecoupageTableau.maxTokens).toBe(MAX_TOKENS_DECOUPAGE);
    // L'ancien plafond (8 000 jetons, pensée comprise) ne laissait que ≈ 3 000 jetons à la pensée.
    expect(8000 - jetons).toBeLessThan(BUDGET_PENSEE_DECOUPAGE);
  });

  it("rejouée avec une réponse simulée de taille réelle (indentée), la fiche est acceptée du premier coup", async () => {
    const o = outils([{ ok: true, simule: false, donnees: indentee, stopReason: "end_turn" }]);
    const r = await decouperEnScenes(entree(), o);
    expect(r.ok ? "ok" : `${r.motif} : ${r.refus.join(" | ")}`).toBe("ok");
    if (r.ok) expect(r.fiche.scenes).toHaveLength(fiche.scenes.length);
  });

  it("une réponse coupée au plafond donne l'issue « tronquee », sans relance", async () => {
    const o = outils([{ ok: true, simule: false, donnees: indentee.slice(0, Math.floor(indentee.length / 2)), stopReason: "max_tokens" }]);
    const r = await decouperEnScenes(entree(), o);
    expect(o.appels).toHaveLength(1);
    expect(r).toMatchObject({ ok: false, motif: "tronquee" });
    if (!r.ok) expect(r.message).toMatch(/coupée/);
  });

  it("le plafond propre (prix confirmé, marge comprise) couvre toujours les deux appels", () => {
    const e = entree();
    const base = variableDecoupage(e);
    const p1 = coutEstimeUsd(roleDecoupageTableau, { contexte: {}, variable: base });
    const p2 = coutEstimeUsd(roleDecoupageTableau, { contexte: {}, variable: variableRelance(base, indentee, ["x".repeat(4000)]) });
    const plafond = Math.max(PLAFOND_DECOUPAGE_TABLEAU_USD, coutPireDecoupageUsd(e) * (1 + MARGE_CREDITS));
    // Premier appel : sa réservation ; relance : le premier au pire payé, plus la réservation de la relance.
    expect(p1 * (1 + MARGE_CREDITS)).toBeLessThanOrEqual(plafond);
    expect(p1 + p2 * (1 + MARGE_CREDITS)).toBeLessThanOrEqual(plafond);
  });
});

describe("une fiche lisible refusée est rendue « à corriger »", () => {
  it("champs fixes remis à leur valeur, le reste tel que rendu", async () => {
    const abimee: FicheTableau = { ...fiche, videoId: "autre", scenes: fiche.scenes.map((s, i) => (i === 0 ? { ...s, texteDit: s.texteDit.replace("trois", "quatre") } : s)) };
    const o = outils([
      { ok: true, simule: false, donnees: JSON.stringify(abimee) },
      { ok: true, simule: false, donnees: JSON.stringify(abimee) },
    ]);
    const r = await decouperEnScenes(entree(), o);
    expect(r).toMatchObject({ ok: false, motif: "refusee" });
    if (r.ok) return;
    expect(r.aCorriger?.videoId).toBe(fiche.videoId);
    expect(r.aCorriger?.scenes[0].texteDit).toContain("quatre");
  });
});
