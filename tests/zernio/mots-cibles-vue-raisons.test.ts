/** Vue serveur : code de motif -> libellé français, aucun code ne sort. Valeurs fictives. */
import { describe, expect, it } from "vitest";
import { LIBELLES_MOTIF_REFUS } from "@/domaine/guide-reseau/raison-refus";
import type { StatsMotChiffrees } from "@/domaine/guide-reseau/stats-mots";
import { versChiffres } from "@/services/mots-cibles-vue";

const f = (j7: number, j30: number, total: number) => ({ j7, j30, total });
const stats = {
  mot: "DEVIS",
  ecrits: f(1, 1, 1),
  envoyes: f(0, 0, 0),
  suivent: f(0, 0, 0),
  commentaires: f(1, 1, 1),
  reponsesPubliques: f(0, 0, 0),
  premiersMessages: f(0, 0, 0),
  erreurs: f(0, 0, 0),
  incertains: f(0, 0, 0),
  commentairesBloques: f(0, 0, 0),
  envoisRefuses: f(1, 3, 4),
  raisonsRefus: [
    { motif: "fenetre-7-jours-depassee", dApresMessage: false, f: f(1, 2, 3) },
    { motif: "limite-meta", dApresMessage: true, f: f(0, 1, 1) },
  ],
  refusSansRaison: f(0, 0, 0),
  personnes: f(1, 1, 1),
  auMoins: 0,
} as unknown as StatsMotChiffrees;

describe("versChiffres : raisons de refus", () => {
  it("libellés français, aucun code", () => {
    const c = versChiffres(stats);
    expect(c.raisonsRefus).toEqual([
      {
        libelle: LIBELLES_MOTIF_REFUS["fenetre-7-jours-depassee"],
        dApresMessage: false,
        f: f(1, 2, 3),
      },
      {
        libelle: LIBELLES_MOTIF_REFUS["limite-meta"],
        dApresMessage: true,
        f: f(0, 1, 1),
      },
    ]);
    expect(c.raisonsRefus![0].libelle).toBe(
      "Commentaire de plus de 7 jours : réponse privée impossible",
    );
    const texte = JSON.stringify(c);
    expect(texte).not.toContain("fenetre-7-jours-depassee");
    expect(texte).not.toContain("limite-meta");
    expect(texte).not.toContain("motif");
  });
});
