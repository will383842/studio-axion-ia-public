/**
 * X1 · « Votre voix n'est pas prête. » dit quoi faire. X8 : la voix du format cas concret est la voix EFFECTIVE du format
 * de l'avocat (celle désignée dans Personnages › Voix › Par format, sinon la voix habituelle), prête et de HeyGen (ou la
 * voix simulée des essais). Aucune désignation explicite n'est exigée. Base en mémoire.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../../../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const v = await import("@/services/cas-concret-voix");
const { VOIX_PAS_PRETE: VOIX_DU_MOTEUR } = await import("@/services/cas-concret-branchements");
const { CONSIGNE_VOIX_CAS_CONCRET } = await import("@/moteurs/montage-cas-concret/avant-prix");
const casConcret = await import("@/services/cas-concret");
const { VOIX_MAITRE_HEYGEN_ID } = await import("@/briques/voix-maitre");

beforeEach(() => reinitialiserDepots());

const moi = async () => (await depots().personnages.lister((p) => p.nature === "moi"))[0];

describe("X1 · état de la voix du format", () => {
  it("X8 · rien de désigné pour l'avocat : la voix habituelle prête de HeyGen suffit (essai réel en ligne)", async () => {
    const m = await moi();
    await depots().voix.modifier("voix-will", { fournisseur: "heygen", nom: "Ma voix HeyGen" } as never);
    await depots().ressourcesFournisseurs.modifier("rf-3", { fournisseur: "heygen", idExterne: VOIX_MAITRE_HEYGEN_ID } as never);
    await depots().personnages.modifier(m.id, { voixParDefautId: "voix-will", voixParFormat: {} } as never);
    expect(await v.etatVoixCasConcret()).toEqual({ prete: true, lien: `/personnages/${m.id}?onglet=voix` });
    expect(await casConcret.voixDeReference()).toEqual({ voixId: "voix-will", personnageId: m.id, fournisseur: "heygen" });
  });

  it("X8 · une voix prête désignée pour l'avocat passe avant la voix habituelle", async () => {
    const m = await moi();
    const base = (await depots().voix.obtenir("voix-will"))!;
    await depots().voix.enregistrer({ ...base, id: "voix-avocat", fournisseur: "heygen" });
    await depots().ressourcesFournisseurs.enregistrer({ ...(await depots().ressourcesFournisseurs.obtenir("rf-3"))!, id: "rf-avocat", entiteId: "voix-avocat", fournisseur: "heygen", idExterne: VOIX_MAITRE_HEYGEN_ID });
    await depots().personnages.modifier(m.id, { voixParDefautId: "voix-will", voixParFormat: { avocat: "voix-avocat" } } as never);
    expect((await casConcret.voixDeReference())?.voixId).toBe("voix-avocat");
    expect((await v.etatVoixCasConcret()).prete).toBe(true);
  });

  it("X8 · la voix désignée n'est pas prête : la voix habituelle prête la remplace", async () => {
    const m = await moi();
    const base = (await depots().voix.obtenir("voix-will"))!;
    await depots().voix.enregistrer({ ...base, id: "voix-avocat", statut: "brouillon" });
    await depots().personnages.modifier(m.id, { voixParDefautId: "voix-will", voixParFormat: { avocat: "voix-avocat" } } as never);
    expect((await casConcret.voixDeReference())?.voixId).toBe("voix-will");
  });

  it("X8 · aucune voix prête de HeyGen : pas prête, lien vers l'onglet Voix de « moi »", async () => {
    const m = await moi();
    await depots().voix.modifier("voix-will", { statut: "brouillon" } as never);
    expect(await v.etatVoixCasConcret()).toEqual({ prete: false, lien: `/personnages/${m.id}?onglet=voix` });
    await depots().voix.modifier("voix-will", { statut: "pret", fournisseur: "elevenlabs" } as never);
    expect(await casConcret.voixDeReference()).toBeNull();
    expect((await v.etatVoixCasConcret()).prete).toBe(false);
  });

  it("la consigne : une phrase, ce qu'il faut faire, sans identifiant", () => {
    expect(CONSIGNE_VOIX_CAS_CONCRET).toBe("Votre voix n'est pas prête : ouvrez Personnages, Voix, et vérifiez que votre voix HeyGen est reliée et prête.");
    expect(VOIX_DU_MOTEUR).toBe(CONSIGNE_VOIX_CAS_CONCRET);
  });

  it("le refus du lancement « Votre voix n'est pas prête. » devient la consigne", () => {
    expect(v.avecConsigneVoix({ statut: "refusee", phrase: "Votre voix n'est pas prête." })).toEqual({ statut: "refusee", phrase: CONSIGNE_VOIX_CAS_CONCRET });
    expect(v.avecConsigneVoix({ statut: "refusee", phrase: "Choisissez au moins un réseau." })).toEqual({ statut: "refusee", phrase: "Choisissez au moins un réseau." });
    const lancee = { statut: "lancee" as const, videoId: "v1", travailId: "t1" };
    expect(v.avecConsigneVoix(lancee)).toBe(lancee);
  });
});
