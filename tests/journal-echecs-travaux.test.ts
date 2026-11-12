/**
 * GV-EC-01a — journal durable des échecs : la cause d'un échec reste lisible après « Réessayer »
 * (les moteurs vident `travail.erreur` à la relance). Faux dépôts en mémoire, aucun réseau.
 */
import { beforeEach, describe, expect, it } from "vitest";
import type { Travail } from "@/domaine/types";
import { TYPE_EVENEMENT_ECHEC, type EvenementEchec } from "@/domaine/journal-echecs";
import { depots, reinitialiserDepots } from "@/donnees/memoire";
import { consignerEchec } from "@/services/journal-echecs";

const iso = "2026-11-12T10:00:00.000Z";
const commande = { formatId: "avocat", moteurId: "montage-avocat" };

function travailEnEchec(tentatives: number, code = "FOURNISSEUR_REFUS"): Travail {
  return {
    id: "tr-1",
    type: "fabrication",
    cibleId: "v-1",
    titre: "Vidéo",
    etapes: [{ cle: "voix", nom: "La voix", icone: "x", dependDe: [], statut: "echec", progression: 0, sortieFichierIds: [] }],
    statut: "echec",
    progression: 0,
    tentatives,
    cleIdempotence: "k",
    fournisseurUtilise: "simulation",
    erreur: { code, reessayable: true, messagePourWill: "Un outil a refusé cette étape.", detailTechnique: "HTTP 500 token=abcdefghijklmnopqrstuvwxyz0123" },
    creeLe: iso,
    modifieLe: iso,
  };
}

async function lignes() {
  const evs = await depots().evenements.lister((e) => e.type === TYPE_EVENEMENT_ECHEC);
  return evs as EvenementEchec[];
}

beforeEach(() => {
  reinitialiserDepots();
});

describe("journal durable des échecs", () => {
  it("un échec puis « Réessayer » garde UNE ligne durable alors que l'erreur du travail est vidée", async () => {
    const echec = travailEnEchec(1);
    await consignerEchec(echec, commande);
    // « Réessayer » d'un moteur : l'erreur du travail est effacée.
    const relance: Travail = { ...echec, statut: "en_file", erreur: undefined, tentatives: 2 };
    await depots().travaux.enregistrer(relance);
    expect((await depots().travaux.obtenir("tr-1"))?.erreur).toBeUndefined();

    const l = await lignes();
    expect(l).toHaveLength(1);
    expect(l[0].id).toBe("ev-echec-tr-1-1");
    expect(l[0].echec).toMatchObject({ generateur: "avocat", etape: "La voix", code: "FOURNISSEUR_REFUS", famille: "fournisseur", travailId: "tr-1", videoId: "v-1", essai: 1 });
    expect(l[0].echec.detail).not.toContain("abcdefghijklmnopqrstuvwxyz0123");
  });

  it("rejouer la consignation du même échec n'écrit pas deux fois", async () => {
    const echec = travailEnEchec(1);
    await consignerEchec(echec, commande);
    await consignerEchec(echec, commande);
    expect(await lignes()).toHaveLength(1);
  });

  it("deux échecs successifs donnent deux lignes", async () => {
    await consignerEchec(travailEnEchec(1), commande);
    await consignerEchec(travailEnEchec(2, "FOURNISSEUR_INDISPONIBLE"), commande);
    const l = await lignes();
    expect(l).toHaveLength(2);
    expect(l.map((x) => x.echec.essai).sort()).toEqual([1, 2]);
  });

  it("un travail sans erreur n'écrit rien", async () => {
    await consignerEchec({ ...travailEnEchec(1), erreur: undefined }, commande);
    expect(await lignes()).toHaveLength(0);
  });
});
