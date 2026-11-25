/**
 * PHRASE-1 : l'écran « Votre maquette » et « En proposer une autre » suivent les appels déjà faits au maquettiste.
 * Les 2 appels permis (PROPOSITIONS_PIECE_MAX) faits : plus d'autre proposition (écran et geste). Doubles seulement : 0 €.
 */
import { describe, expect, it } from "vitest";
import { lireDescriptionMaquette, type DescriptionMaquette } from "@/moteurs/montage-tutoriel-outil/description-maquette";
import { exempleSortieMaquette } from "@/moteurs/montage-tutoriel-outil/equipe/maquettiste";
import { empreinteDescription, PROPOSITIONS_PIECE_MAX } from "@/moteurs/montage-tutoriel-outil/maquette-creee";
import { autreProposition, etatEcranDepuisPiece, NOMS_ECRANS_OUTILS, NOMS_NEUTRES, vuePieceCreee, type DependancesPiece, type DepotPiece } from "@/services/tutoriel-piece-creee";

const VIDEO = "v-1";
const description = (): DescriptionMaquette => {
  const r = lireDescriptionMaquette(exempleSortieMaquette().contenu, { interdits: [] });
  if (!r.ok) throw new Error(r.erreurs.join(" "));
  return r.description;
};

/** L'équipe rangée dans le travail : la pièce et le nombre d'appels faits au maquettiste. */
function monde(appels: number, proposition: 1 | 2 = 1) {
  const d = description();
  const equipe = { demande: { phrase: "un tableau de bord pour un atelier" }, appels: { maquettiste: appels }, pieceCreee: { genre: "maquette" as const, proposition, contenu: d, empreinte: empreinteDescription(d), statut: "a-construire" as const } };
  const compteurs = { ecritures: 0, relances: 0 };
  const depot: DepotPiece = { lire: async () => etatEcranDepuisPiece(equipe), ecrire: async () => void compteurs.ecritures++ };
  const dep: DependancesPiece = {
    reglage: async <T,>(id: string, defaut: T) => (id === "tutoriel.entreePhrase" || id === "tutoriel.pieceCreeeClaude" ? (true as T) : defaut),
    session: async () => ({}),
    depot,
    relancer: async () => void compteurs.relances++,
    maintenant: () => "2026-11-25T10:00:00.000Z",
    urls: async () => ({}),
    interdits: NOMS_NEUTRES.interdits,
    nomsPermis: [...NOMS_ECRANS_OUTILS.interdits],
  };
  return { dep, compteurs, equipe };
}

describe("PHRASE-1 · « En proposer une autre » et les appels déjà faits", () => {
  it("2 appels faits (refus puis reprise) : l'écran n'offre plus d'autre proposition, le geste refuse avec une phrase claire, rien n'est écrit ni relancé", async () => {
    const m = monde(PROPOSITIONS_PIECE_MAX);
    expect(etatEcranDepuisPiece(m.equipe)?.appelsEpuises).toBe(true);
    const vue = await vuePieceCreee(VIDEO, m.dep);
    expect(vue?.propositionsRestantes).toBe(0);
    const r = await autreProposition(VIDEO, m.dep);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/plus d'autre proposition/);
    expect(r.message).not.toMatch(/€|\$|euros?|appel/i);
    expect(m.compteurs).toEqual({ ecritures: 0, relances: 0 });
  });

  it("1 seul appel fait : une autre proposition reste permise (comportement d'avant)", async () => {
    const m = monde(1);
    expect(etatEcranDepuisPiece(m.equipe)?.appelsEpuises).toBeUndefined();
    expect((await vuePieceCreee(VIDEO, m.dep))?.propositionsRestantes).toBe(1);
    expect(await autreProposition(VIDEO, m.dep)).toMatchObject({ ok: true, statut: "a-construire" });
    expect(m.compteurs).toEqual({ ecritures: 1, relances: 1 });
  });

  it("déjà à la proposition 2 : toujours refusé, avec la phrase d'avant", async () => {
    const m = monde(2, 2);
    expect(await autreProposition(VIDEO, m.dep)).toEqual({ ok: false, message: "Vous avez déjà demandé une autre proposition" });
  });
});
