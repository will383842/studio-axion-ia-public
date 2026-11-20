/**
 * Lot D · E13 : l'entrée de visuel du calendrier porte le message d'envoi de son créneau
 * (« à compléter » d'abord, sinon le dernier refus). Dépôts en mémoire, aucun appel réseau.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const { cleEnvoi } = await import("@/domaine/envoi-planifie");
const { PREFIXE_ETATS_ENVOI_CALENDRIER } = await import("@/services/branchement-envoi-calendrier");
const { entreesAvecMedias } = await import("@/app/(studio)/calendrier/charger-medias");

const pub = { id: "p1", reseau: "linkedin", statut: "programmee", via: "manuel", date: "2030-01-02T09:00:00.000Z", texte: "Titre du visuel", visuelId: "vis_1" };
const heure = "2030-01-02T09:00:00Z";

async function creneau(extra: Record<string, unknown> = {}): Promise<void> {
  await depots().creneauxEditoriaux.enregistrer({
    id: "c1", jourVise: "2030-01-02", heuresParReseau: { linkedin: heure }, compteCible: "compte-studio", visuelId: "vis_1",
    textes: { linkedin: { texte: "Une légende", premierCommentaire: "" } },
    statut: "programme", decalages: 0, valideeLe: "2029-12-30T10:00:00Z", valideePar: "le fondateur", ...extra,
  } as never);
}
const refus = async (raison: string, le: string): Promise<void> => {
  const cle = cleEnvoi("vis_1", "linkedin", 0);
  await ecrireParametre(`${PREFIXE_ETATS_ENVOI_CALENDRIER}dernier-refus-le:${cle}`, le);
  await ecrireParametre(`${PREFIXE_ETATS_ENVOI_CALENDRIER}dernier-refus:${cle}`, raison);
};

beforeEach(() => {
  reinitialiserDepots();
});

describe("Lot D · message d'envoi de l'entrée de visuel", () => {
  it("créneau sans texte → message « Légende à écrire… » et texte vide", async () => {
    await creneau({ textes: {} });
    const [e] = await entreesAvecMedias([pub]);
    expect(e.message).toMatch(/^Légende à écrire/);
    expect(e.texte).toBe("");
  });

  it("créneau avec texte et un dernier refus → « Dernier envoi refusé le JJ/MM à HH:MM : raison »", async () => {
    await creneau();
    await refus("Aucune page LinkedIn reliée.", "2030-01-01T14:05:00Z");
    const [e] = await entreesAvecMedias([pub]);
    expect(e.message).toBe("Dernier envoi refusé le 01/01 à 15:05 : Aucune page LinkedIn reliée.");
    expect(e.texte).toBe("Titre du visuel");
  });

  it("créneau retiré → aucun message", async () => {
    await creneau({ textes: {}, retireLe: "2029-12-31T10:00:00Z" });
    const [e] = await entreesAvecMedias([pub]);
    expect(e.message ?? null).toBeNull();
    expect(e.texte).toBe("Titre du visuel");
  });

  it("créneau refusé, ou sans heure sur ce réseau → aucun message", async () => {
    await creneau({ textes: {}, refuseLe: "2029-12-31T10:00:00Z" });
    expect((await entreesAvecMedias([pub]))[0].message ?? null).toBeNull();
    await creneau({ textes: {}, heuresParReseau: { instagram: heure } });
    expect((await entreesAvecMedias([pub]))[0].message ?? null).toBeNull();
  });

  it("lecture du plan qui échoue → pas de message, l'entrée reste affichée", async () => {
    vi.spyOn(depots().creneauxEditoriaux, "lister").mockRejectedValue(new Error("panne"));
    const [e] = await entreesAvecMedias([pub]);
    expect(e.message ?? null).toBeNull();
    expect(e.texte).toBe("Titre du visuel");
  });

  it("une seule lecture du plan par appel, même avec plusieurs entrées du même visuel", async () => {
    await creneau();
    const lister = vi.spyOn(depots().creneauxEditoriaux, "lister");
    await entreesAvecMedias([pub, { ...pub, id: "p2" }]);
    expect(lister).toHaveBeenCalledTimes(1);
  });
});
