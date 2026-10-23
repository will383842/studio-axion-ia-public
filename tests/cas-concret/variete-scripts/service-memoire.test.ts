/** Mémoire anti-copie lue par le service : catalogue, scripts validés du studio, vidéos non supprimées. Base en mémoire. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const scripts = await import("@/services/cas-concret-scripts");
const { SCRIPT_V4_RECRUTEMENT } = await import("@/moteurs/montage-cas-concret/scripts-valides/recrutement-apporteurs");
const { ecrireParametre } = await import("@/services/_commun");

const texteV4 = SCRIPT_V4_RECRUTEMENT.ecrans.map((e) => e.texteDit.trim()).join(" ");

function travailAvecFiche(id: string, texte: string) {
  return { id, parametres: { casConcret: { journal: { etapes: { ecriture: { sortie: { fiche: { casId: "x", ecrans: [{ texteDit: texte }] } } } } } } } };
}

beforeEach(() => reinitialiserDepots());

describe("scriptsDejaEcrits", () => {
  it("contient toujours le script du catalogue (la v4)", async () => {
    expect(await scripts.scriptsDejaEcrits()).toContain(texteV4);
  });

  it("grossit avec les scripts des vidéos non supprimées, sauf la vidéo qui s'écrit, sans doublon", async () => {
    const d = depots();
    await d.travaux.enregistrer(travailAvecFiche("t1", "Le colis part avant la nuit, sans personne.") as never);
    await d.travaux.enregistrer(travailAvecFiche("t2", "Le planning se range tout seul chaque soir.") as never);
    const version = (id: string, videoId: string, travailId: string, creeLe: string) => ({ id, videoId, travailId, creeLe, numero: 1, commande: { moteurId: "montage-cas-concret" } });
    await d.versions.enregistrer(version("v1", "video-a", "t1", "2026-10-01T00:00:00Z") as never);
    await d.versions.enregistrer(version("v2", "video-b", "t2", "2026-10-02T00:00:00Z") as never);
    const tous = await scripts.scriptsDejaEcrits();
    expect(tous).toEqual([texteV4, "Le colis part avant la nuit, sans personne.", "Le planning se range tout seul chaque soir."]);
    const sansB = await scripts.scriptsDejaEcrits("video-b");
    expect(sansB).not.toContain("Le planning se range tout seul chaque soir.");
    expect(sansB).toContain("Le colis part avant la nuit, sans personne.");
  });

  it("une vidéo supprimée (version retirée) n'est plus dans la mémoire", async () => {
    const d = depots();
    await d.travaux.enregistrer(travailAvecFiche("t1", "Le colis part avant la nuit, sans personne.") as never);
    await d.versions.enregistrer({ id: "v1", videoId: "video-a", travailId: "t1", creeLe: "2026-10-01T00:00:00Z", numero: 1, commande: { moteurId: "montage-cas-concret" } } as never);
    await d.versions.supprimer("v1");
    expect(await scripts.scriptsDejaEcrits()).toEqual([texteV4]);
  });

  it("ajoute les versions validées depuis le studio (historique)", async () => {
    await ecrireParametre(scripts.CLE_HISTORIQUE_SCRIPTS, { "autre-cas": [{ ...SCRIPT_V4_RECRUTEMENT, casId: "autre-cas", numero: 2, ecrans: [{ ...SCRIPT_V4_RECRUTEMENT.ecrans[0], texteDit: "Texte validé du studio, unique." }] }] });
    expect(await scripts.scriptsDejaEcrits()).toContain("Texte validé du studio, unique.");
  });
});
