/**
 * PHRASE-1 : l'écran « Votre maquette » et « En proposer une autre » suivent les appels déjà faits au maquettiste.
 * Les 2 appels permis (PROPOSITIONS_PIECE_MAX) faits : plus d'autre proposition (écran et geste). Doubles seulement : 0 €.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PieceCreee } from "@/components/tutoriel-outil/PieceCreee";
import { lireDescriptionMaquette, type DescriptionMaquette } from "@/moteurs/montage-tutoriel-outil/description-maquette";
import { MESSAGE_PLUS_DE_PROPOSITION } from "@/moteurs/montage-tutoriel-outil/equipe/pas-piece-creee";
import { exempleSortieMaquette } from "@/moteurs/montage-tutoriel-outil/equipe/maquettiste";
import { empreinteDescription, PROPOSITIONS_PIECE_MAX, VERSION_APERCU } from "@/moteurs/montage-tutoriel-outil/maquette-creee";
import { autreProposition, corrigerTexte, etatEcranDepuisPiece, garderPiece, NOMS_ECRANS_OUTILS, NOMS_NEUTRES, vuePieceCreee, type DependancesPiece, type DepotPiece, type EtatPieceCreee } from "@/services/tutoriel-piece-creee";

const VIDEO = "v-1";
const description = (): DescriptionMaquette => {
  const r = lireDescriptionMaquette(exempleSortieMaquette().contenu, { interdits: [] });
  if (!r.ok) throw new Error(r.erreurs.join(" "));
  return r.description;
};

/** L'équipe rangée dans le travail : la pièce et le nombre d'appels faits au maquettiste. */
function monde(appels: number, proposition: 1 | 2 = 1, statut: "a-construire" | "a-revoir" | "gardee" | "refusee" = "a-construire") {
  const d = description();
  const equipe = { demande: { phrase: "un tableau de bord pour un atelier" }, appels: { maquettiste: appels }, pieceCreee: { genre: "maquette" as const, proposition, contenu: d, empreinte: empreinteDescription(d), statut, ...(statut === "a-revoir" ? { erreurs: ["« x » : un libellé court, pas une phrase (6 mots au plus, sans point final)."] } : {}) } };
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

describe("PHRASE-1 · l'écran quand les 2 essais sont faits", () => {
  const rendu = (vue: NonNullable<Awaited<ReturnType<typeof vuePieceCreee>>>) => renderToStaticMarkup(createElement(PieceCreee, { videoId: VIDEO, vue }));

  it("proposition n° 1 et 2 appels faits : le texte dit que les deux essais sont faits, jamais « une autre proposition déjà demandée »", async () => {
    const vue = await vuePieceCreee(VIDEO, monde(PROPOSITIONS_PIECE_MAX).dep);
    expect(vue?.essaisEpuises).toBe(true);
    const html = rendu(vue!);
    expect(html).toContain("Les deux essais de création sont faits : il n&#x27;y a pas d&#x27;autre proposition possible.");
    expect(html).not.toContain("Vous avez déjà demandé une autre proposition");
  });

  it("proposition n° 2 demandée par Williams : le texte d'avant reste", async () => {
    const vue = await vuePieceCreee(VIDEO, monde(2, 2).dep);
    expect(vue?.essaisEpuises).toBeUndefined();
    expect(rendu(vue!)).toContain("Vous avez déjà demandé une autre proposition");
  });

  it("un seul essai fait : « Il vous reste 1 autre proposition »", async () => {
    const vue = await vuePieceCreee(VIDEO, monde(1).dep);
    expect(rendu(vue!)).toContain("Il vous reste 1 autre proposition.");
  });

  it("pièce « à revoir » après 2 essais : le geste ne propose que d'arrêter, sans parler de garder ou corriger", async () => {
    const m = monde(PROPOSITIONS_PIECE_MAX, 1, "a-revoir");
    const r = await autreProposition(VIDEO, m.dep);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/plus d'autre proposition/);
    expect(r.message).toMatch(/arrêter/);
    expect(r.message).not.toMatch(/Gardez|corrigez/);
    expect(m.compteurs).toEqual({ ecritures: 0, relances: 0 });
  });
});

describe("PHRASE-1 · l'écran d'une pièce « à revoir » ne propose plus d'en demander une autre quand il n'y a plus d'appel", () => {
  it("reprise épuisée (2 appels, proposition n° 1) : le message est celui de « plus d'autre proposition »", async () => {
    const vue = await vuePieceCreee(VIDEO, monde(PROPOSITIONS_PIECE_MAX, 1, "a-revoir").dep);
    expect(vue).toMatchObject({ statut: "a-revoir", propositionsRestantes: 0, message: MESSAGE_PLUS_DE_PROPOSITION });
    expect(vue!.message).not.toMatch(/en demander une autre/);
  });

  it("proposition n° 2 « à revoir » : même message", async () => {
    const vue = await vuePieceCreee(VIDEO, monde(2, 2, "a-revoir").dep);
    expect(vue).toMatchObject({ statut: "a-revoir", propositionsRestantes: 0, message: MESSAGE_PLUS_DE_PROPOSITION });
  });

  it("un seul appel fait et pièce « à revoir » : « vous pouvez en demander une autre » reste vrai et reste dit", async () => {
    const vue = await vuePieceCreee(VIDEO, monde(1, 1, "a-revoir").dep);
    expect(vue).toMatchObject({ propositionsRestantes: 1 });
    expect(vue!.message).toMatch(/en demander une autre/);
  });

  it("une pièce gardée ou arrêtée dont les appels sont épuisés : « n'est plus modifiable » (pas « gardez-la, corrigez… »)", async () => {
    for (const statut of ["gardee", "refusee"] as const) {
      const m = monde(PROPOSITIONS_PIECE_MAX, 1, statut);
      const r = await autreProposition(VIDEO, m.dep);
      expect(r).toEqual({ ok: false, message: "Cette maquette n'est plus modifiable." });
      expect(m.compteurs).toEqual({ ecritures: 0, relances: 0 });
    }
  });
});

describe("PHRASE-1 · aperçu à défauts après la reprise : Williams peut encore corriger", () => {
  const avecDefauts = () => {
    const m = monde(PROPOSITIONS_PIECE_MAX, 1, "a-construire");
    const d = description();
    const empreinte = empreinteDescription(d);
    let etat: EtatPieceCreee = { ...etatEcranDepuisPiece(m.equipe)!, statut: "a-valider", apercu: { version: VERSION_APERCU, empreinteDescription: empreinte, images: [], controle: { ok: false, defauts: ["Un texte déborde."] } } };
    m.dep.depot = { lire: async () => etat, ecrire: async (_id, e) => void (etat = e) };
    return { m, empreinte, lire: () => etat };
  };

  it("la vue ne dit ni « demandez-en une autre » ni « plus de proposition » : le statut reste « à valider »", async () => {
    const { m } = avecDefauts();
    const vue = await vuePieceCreee(VIDEO, m.dep);
    expect(vue).toMatchObject({ statut: "a-valider", propositionsRestantes: 0, message: null });
    expect(vue?.defauts).toContain("Un texte déborde.");
  });

  it("aperçu bon, appels épuisés : la vue n'offre aucune autre proposition (message vide, bouton fermé, texte des essais faits)", async () => {
    const { m, empreinte } = avecDefauts();
    const etat = (await m.dep.depot!.lire(VIDEO))!;
    const bon: EtatPieceCreee = { ...etat, apercu: { ...etat.apercu!, empreinteDescription: empreinte, controle: { ok: true, defauts: [] } } };
    m.dep.depot = { lire: async () => bon, ecrire: async () => undefined };
    const vue = await vuePieceCreee(VIDEO, m.dep);
    expect(vue).toMatchObject({ statut: "a-valider", propositionsRestantes: 0, message: null });
    const html = renderToStaticMarkup(createElement(PieceCreee, { videoId: VIDEO, vue: vue! }));
    expect(html).not.toMatch(/Il vous reste 1 autre proposition/);
  });

  it("garder est refusé sans proposer une autre proposition ; corriger un texte reste accepté", async () => {
    const { m, empreinte } = avecDefauts();
    const g = await garderPiece(VIDEO, { empreinte }, m.dep);
    expect(g.ok).toBe(false);
    expect(g.message).toBe("L'aperçu a des défauts : corrigez les textes concernés ou arrêtez cette demande.");
    const zone = description().ecrans[0]!.zones[0]!;
    const r = await corrigerTexte(VIDEO, { ecranId: description().ecrans[0]!.id, avant: zone.libelle, apres: "Mon suivi du jour" }, m.dep);
    expect(r).toMatchObject({ ok: true, statut: "a-construire" });
  });
});

describe("PHRASE-1 · flux « à revoir » sans appel restant", () => {
  it("MESSAGE_PLUS_DE_PROPOSITION_FLUX parle d'automatisation, jamais de maquette", async () => {
    const { MESSAGE_PLUS_DE_PROPOSITION_FLUX } = await import("@/moteurs/montage-tutoriel-outil/equipe/pas-piece-creee");
    expect(MESSAGE_PLUS_DE_PROPOSITION_FLUX).toMatch(/automatisation/);
    expect(MESSAGE_PLUS_DE_PROPOSITION_FLUX).not.toMatch(/maquette/);
  });
});
