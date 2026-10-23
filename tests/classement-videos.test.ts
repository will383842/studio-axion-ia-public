/**
 * LOT C1 — classement des vidéos : la barre latérale, les onglets de Mes vidéos et la page d'un format comptent et
 * montrent la même chose (toutes les vidéos non archivées, brouillons, maquettes, échecs compris). Un format absent du
 * registre a son onglet « Autres ». Aucun appel réseau.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const videos = await import("@/services/videos");
const formats = await import("@/services/formats");
const { ecrireParametre } = await import("@/services/_commun");
const { compteDansFormat, compteursMesVideos } = await import("@/domaine/mes-videos");
const { listerFormats } = await import("@/formats");

const MDP = "essai-classement-videos";
const STATUTS = ["brouillon", "maquette", "en_file", "en_fabrication", "prete", "echec", "annulee", "archivee"] as const;
const IDS = listerFormats({ inclureMasques: true, inclureReservesAWill: true }).map((f) => f.id);

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  await ecrireParametre("afficherExemples", false);
});

/** Une vidéo par (format, statut), formats du registre + un format qui n'existe plus. */
async function peupler(): Promise<void> {
  const modele = await videos.creerBrouillon("avocat");
  const base = (await depots().videos.obtenir(modele))!;
  await depots().videos.supprimer(modele);
  for (const formatId of [...IDS, "ancien-format"]) {
    for (const statut of STATUTS) {
      await depots().videos.enregistrer({ ...base, id: `v-${formatId}-${statut}`, formatId, statut, titre: `${formatId} ${statut}` });
    }
  }
}

describe("compteDansFormat", () => {
  it("tout compte sauf l'archivée", () => {
    for (const s of STATUTS) expect(compteDansFormat({ statut: s })).toBe(s !== "archivee");
  });
});

describe("compteursMesVideos : le compteur « Autres »", () => {
  it("compte les formats absents du registre, et eux seuls", () => {
    const c = compteursMesVideos(
      [
        { statut: "prete", format: { id: "avocat" } },
        { statut: "brouillon", format: { id: "ancien-format" } },
        { statut: "archivee", format: { id: "ancien-format" } },
      ],
      ["avocat"],
    );
    expect(c.autres).toBe(1);
    expect(c.toutes).toBe(2);
  });
});

describe("barre latérale = onglet = page du format", () => {
  it("12 formats + un ancien format × 8 statuts : même nombre partout, archivées à part", async () => {
    expect(IDS.length).toBeGreaterThanOrEqual(12);
    await peupler();
    const barre = await videos.compterVideosParFormat();
    const toutes = await videos.listerVideos({ inclureArchivees: true });
    const compteurs = compteursMesVideos(toutes, IDS);
    for (const id of IDS) {
      const fiche = await formats.obtenirFicheFormat(id);
      if (!fiche) continue; // format masqué sans fiche
      expect(fiche.videos.map((v) => v.statut).sort(), id).toEqual(STATUTS.filter((s) => s !== "archivee").sort());
      expect(barre[id], id).toBe(fiche.videos.length);
      expect(compteurs.parFormat[id], id).toBe(fiche.videos.length);
      expect(fiche.nbArchivees, id).toBe(1);
    }
    expect(compteurs.autres).toBe(STATUTS.length - 1);
    expect(compteurs.archivees).toBe(IDS.length + 1);
  });
});
