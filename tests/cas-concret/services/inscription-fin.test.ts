/**
 * Cas traités, É3 : à la fin d'une fabrication de cas concret, le cas est inscrit durablement. L'avocat et les autres
 * formats n'inscrivent rien ; un essai simulé n'inscrit rien ; une erreur d'écriture ne fait JAMAIS échouer la fin de
 * fabrication (la vidéo reste « prête »). Moteur simulé, base en mémoire, aucun appel réseau, rien de payé.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const etat = vi.hoisted(() => ({ essai: false, echec: false, appels: [] as string[] }));
vi.mock("@/moteurs", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/moteurs")>()), commandeEnEssai: () => etat.essai }));
vi.mock("@/services/cas-concret-traites", async (importOriginal) => {
  const reel = await importOriginal<typeof import("@/services/cas-concret-traites")>();
  return {
    ...reel,
    noterCasTraite: vi.fn(async (video: { id: string; formatId: string }, ...reste: unknown[]) => {
      etat.appels.push(video.id);
      if (etat.echec) throw new Error("écriture impossible");
      return (reel.noterCasTraite as (...a: unknown[]) => Promise<boolean>)(video, ...reste);
    }),
  };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const boucle = await import("@/services/boucle");

const MDP_TEST = "essai-inscription-fin";

beforeAll(async () => {
  process.env.SESSION_SECRET = "i".repeat(48);
  const empreinte = await hash(MDP_TEST, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  etat.essai = false;
  etat.echec = false;
  etat.appels = [];
  await auth.seConnecter(MDP_TEST, false);
});
afterEach(() => {
  boucle.arreterBoucle();
  vi.useRealTimers();
});

/** Fabrique la vidéo `v-04` (démonstration de l'avocat) jusqu'au bout, avec le format donné. */
async function fabriquerJusquAuBout(formatId: string): Promise<void> {
  const d = depots();
  vi.useFakeTimers({ toFake: ["Date"] });
  // Lancée comme l'avocat (moteur simulé, aucun appel réel) ; le format de la vidéo change juste avant la fin, pour jouer la fin de fabrication d'un cas concret.
  const { travailId } = await fabrication.lancerFabrication("v-04", { confirme: true });
  await d.videos.modifier("v-04", { formatId, estDemo: false, entrees: { casConcret: { casId: "recrutement-apporteurs" } } });
  for (let i = 0; i < 60 && (await d.travaux.obtenir(travailId))!.statut !== "termine"; i++) {
    vi.setSystemTime(Date.now() + 5_000);
    await boucle.tourDeBoucle();
  }
  expect((await d.travaux.obtenir(travailId))!.statut).toBe("termine");
}

describe("inscription du cas à la fin de la fabrication", () => {
  it("cas concret : le cas est inscrit, une seule fois", async () => {
    await fabriquerJusquAuBout("cas-concret");
    expect(etat.appels).toEqual(["v-04"]);
    const { lireParametre } = await import("@/services/_commun");
    const inscrits = await lireParametre<Record<string, { videoId: string }>>("casConcret.casTraites", {});
    expect(inscrits["recrutement-apporteurs"]?.videoId).toBe("v-04");
  });

  it("l'avocat n'inscrit rien", async () => {
    await fabriquerJusquAuBout("avocat");
    expect(etat.appels).toEqual([]);
  });

  it("un essai simulé n'inscrit rien", async () => {
    etat.essai = true;
    await fabriquerJusquAuBout("cas-concret");
    expect(etat.appels).toEqual([]);
  });

  it("erreur d'écriture : la fin de fabrication n'échoue pas, la vidéo reste prête", async () => {
    etat.echec = true;
    await fabriquerJusquAuBout("cas-concret");
    expect(etat.appels).toEqual(["v-04"]);
    expect((await depots().videos.obtenir("v-04"))!.statut).toBe("prete");
  });
});
