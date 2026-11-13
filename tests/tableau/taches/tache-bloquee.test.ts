/**
 * TÂCHE BLOQUÉE (GV2-02) : une écriture dont l'appel ne revient jamais ne gèle plus toutes les tâches du tableau.
 * Après le délai, la tâche passe « interrompue » (jamais relancée seule : « Reprendre » redemande le prix), son id sort de
 * `tachesEnCours()`, et la tâche suivante est traitée. Dépôts en mémoire, horloge simulée, aucun appel réel.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";
import { preparerMotDePasse } from "../../helpers/g1a";
import { DEMANDE_MODELE } from "../../tableau-scripts/modele-valide";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ replace() {}, push() {}, refresh() {} }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const creation = await import("@/services/tableau-creation");
const taches = await import("@/services/tableau-taches");

const MDP = "tableau-tache-bloquee";
const DEMANDE = { ...DEMANDE_MODELE, vraiCas: null };

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  taches.tachesEnCours().clear();
  await auth.seConnecter(MDP, false);
  vi.stubGlobal("fetch", (async () => {
    throw new Error("réseau interdit");
  }) as typeof fetch);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function nouvelleEcriture(): Promise<string> {
  const prix = (await creation.ecranCreationTableau()).ecriture.coutCentimes;
  const r = await creation.ecrireScriptTableau(DEMANDE, { accord: prix }, { client: { simule: true, appeler: () => new Promise<never>(() => undefined) } });
  if (r.statut !== "en-cours") throw new Error(JSON.stringify(r));
  return r.videoId;
}
const tacheDe = async (videoId: string) => taches.tacheDe(await depots().videos.obtenir(videoId));

describe("une tâche dont l'exécution ne revient jamais", () => {
  it("passe « interrompue » après le délai, sort de la liste « en cours », et la tâche suivante est traitée", async () => {
    const premiere = await nouvelleEcriture();
    await new Promise((r) => setTimeout(r, 5));
    const seconde = await nouvelleEcriture();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    const vues: string[] = [];
    const travail = taches.travaillerTaches(async (videoId) => {
      vues.push(videoId);
      if (videoId === premiere) return new Promise<void>(() => undefined);
      // La seconde tâche se termine normalement (sinon la boucle la reprendrait).
      await taches.modifierTache(videoId, null, (t) => t && { ...t, statut: "terminee" });
    });

    await vi.advanceTimersByTimeAsync(taches.DELAI_TACHE_TABLEAU_MS - 1_000);
    expect(taches.tachesEnCours().size).toBe(1);
    expect((await tacheDe(premiere))?.statut).not.toBe("interrompue");

    await vi.advanceTimersByTimeAsync(2_000);
    const faites = await travail;

    expect(faites).toBe(2);
    expect(vues).toEqual([premiere, seconde]);
    expect(await tacheDe(premiere)).toMatchObject({ statut: "interrompue", message: "L'écriture ne répond plus : reprenez-la." });
    expect(taches.tachesEnCours().size).toBe(0);
    // Jamais relancée seule : « Reprendre » reste un geste du fondateur (le prix est redemandé).
    expect(vues.filter((v) => v === premiere)).toHaveLength(1);
    expect(taches.vueTache((await tacheDe(premiere))!, true).phrase).toContain("L'écriture ne répond plus : reprenez-la.");
  });
});
