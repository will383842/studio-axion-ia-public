/**
 * Cas traités : le VRAI `reessayerTravail` (base en mémoire, moteur simulé, aucun appel réseau, rien de payé) et le
 * garde-fou du lancement. Une panne dont le cas est fini par une AUTRE vidéo n'est jamais relancée ; la vidéo en panne
 * elle-même, un cas non traité, une retouche / un réexport / des sous-titres, l'avocat et la porte B restent permis.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const travaux = await import("@/services/travaux");
const boucle = await import("@/services/boucle");
const { ecrireParametre } = await import("@/services/_commun");
const { PHRASE_CAS_TRAITE, PHRASE_RELANCE_CAS_TRAITE, TRAVAUX_SUR_VIDEO_FINIE } = await import("@/domaine/cas-traites");

import type { Video } from "@/domaine/types";

const MDP = "cas-traites-relance";
const CAS = "recrutement-apporteurs";

beforeAll(async () => {
  process.env.SESSION_SECRET = "r".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  for (const x of await depots().travaux.lister((t) => t.statut === "en_cours" || t.statut === "en_file")) await depots().travaux.enregistrer({ ...x, statut: "termine" });
  await ecrireParametre("budget.seuilConfirmation", { centimes: 1_000_000, devise: "EUR" });
});
afterEach(() => vi.useRealTimers());

/** Lance v-03 (moteur simulé) avec un échec simulé, fait tourner la boucle jusqu'à l'échec. */
async function travailEnEchec(): Promise<string> {
  const { travailId } = await fabrication.lancerFabrication("v-03", { confirme: true, simulerEchecEtape: "montage" });
  vi.useFakeTimers({ toFake: ["Date"] });
  for (let i = 0; i < 200; i++) {
    if ((await depots().travaux.obtenir(travailId))?.statut === "echec") break;
    vi.setSystemTime(Date.now() + 5_000);
    await boucle.tourDeBoucle();
  }
  vi.useRealTimers();
  expect((await depots().travaux.obtenir(travailId))?.statut).toBe("echec");
  return travailId;
}

/** Fait passer la panne pour celle d'un cas concret (la commande reste jouée par le moteur simulé). */
async function enCasConcret(travailId: string, entreesCas: Record<string, unknown> = { casId: CAS }): Promise<void> {
  const d = depots();
  const t = (await d.travaux.obtenir(travailId))!;
  const version = (await d.versions.obtenir(t.versionId!))!;
  await d.versions.modifier(version.id, { commande: { ...version.commande, moteurId: "simulation", formatId: "cas-concret", entrees: { ...version.commande.entrees, casConcret: entreesCas } } });
  await d.videos.modifier(t.cibleId, { formatId: "cas-concret", estDemo: false, entrees: { casConcret: entreesCas } });
}

const autreVideoFinie = () =>
  depots().videos.enregistrer({ id: "v-fini", titre: "Déjà faite", formatId: "cas-concret", statut: "prete", entrees: { casConcret: { casId: CAS } }, creeLe: "2026-10-01T00:00:00.000Z", modifieLe: "2026-10-01T00:00:00.000Z", terminee: "2026-10-01T00:00:00.000Z" } as unknown as Video);

describe("reessayerTravail (vrai service) et cas traités", () => {
  it("cas fini par une AUTRE vidéo : relance refusée, le travail reste en échec", async () => {
    const id = await travailEnEchec();
    await enCasConcret(id);
    await autreVideoFinie();
    await expect(travaux.reessayerTravail(id)).rejects.toMatchObject({ code: "CAS_TRAITE", message: PHRASE_RELANCE_CAS_TRAITE });
    expect((await depots().travaux.obtenir(id))?.statut).toBe("echec");
  });

  it("la vidéo en panne elle-même, cas non traité : la relance est permise", async () => {
    const id = await travailEnEchec();
    await enCasConcret(id);
    const r = await travaux.reessayerTravail(id);
    expect(r.id).toBe(id);
    expect((await depots().travaux.obtenir(id))?.statut).not.toBe("echec");
  });

  it("porte B : jamais « traité », la relance d'une panne n'est pas bloquée même si une vidéo du même cas est finie", async () => {
    const id = await travailEnEchec();
    await enCasConcret(id, { casId: CAS, porte: "porte-b" });
    await autreVideoFinie();
    const r = await travaux.reessayerTravail(id);
    expect(r.id).toBe(id);
  });

  it("porte B sous l'alias « b » : jamais traité non plus", async () => {
    const id = await travailEnEchec();
    await enCasConcret(id, { casId: CAS, porte: "b" });
    await autreVideoFinie();
    expect((await travaux.reessayerTravail(id)).id).toBe(id);
  });

  it("vidéo de démonstration ou dérivée : la garde de relance est sautée", async () => {
    for (const plus of [{ estDemo: true }, { sourceVideoId: "v-fini", typeDerive: "variante-reseau" }]) {
      reinitialiserDepots();
      reinitialiserRequete();
      await auth.seConnecter(MDP, false);
      const id = await travailEnEchec();
      await enCasConcret(id);
      await autreVideoFinie();
      await depots().videos.modifier((await depots().travaux.obtenir(id))!.cibleId, { estDemo: false, ...plus } as never);
      expect((await travaux.reessayerTravail(id)).id).toBe(id);
    }
  });

  it("l'avocat n'est pas touché par la garde", async () => {
    const id = await travailEnEchec();
    await autreVideoFinie();
    expect((await travaux.reessayerTravail(id)).id).toBe(id);
  });

  it.each(TRAVAUX_SUR_VIDEO_FINIE)("un travail « %s » sur un cas traité reste permis", async (type) => {
    const id = await travailEnEchec();
    await enCasConcret(id);
    await autreVideoFinie();
    await depots().travaux.modifier(id, { type } as never);
    const r = await travaux.reessayerTravail(id).catch((e: { code?: string }) => e);
    expect((r as { code?: string }).code).not.toBe("CAS_TRAITE");
  });

  it("la liste des travaux sur vidéo finie n'est écrite qu'à un endroit", async () => {
    const { readFileSync } = await import("node:fs");
    for (const f of ["src/services/travaux.ts", "src/services/cas-concret-relance.ts"]) expect(readFileSync(f, "utf8")).not.toMatch(/"retouche",\s*"reexport"/);
  });
});

describe("lancement : garde-fou en profondeur", () => {
  it("un cas concret dont le cas est fini par une autre vidéo ne part pas (avant toute réservation)", async () => {
    await depots().videos.modifier("v-03", { formatId: "cas-concret", estDemo: false, entrees: { casConcret: { casId: CAS } } });
    await autreVideoFinie();
    await expect(fabrication.lancerFabrication("v-03", { confirme: true })).rejects.toMatchObject({ code: "CAS_TRAITE", message: PHRASE_CAS_TRAITE });
    expect(await depots().reservations.compter((r) => r.videoId === "v-03" && r.statut === "active")).toBe(0);
  });

  it("une vidéo dérivée (variante) du même cas n'est pas bloquée par la garde", async () => {
    await depots().videos.modifier("v-03", { formatId: "cas-concret", estDemo: false, sourceVideoId: "v-fini", typeDerive: "variante-reseau", entrees: { casConcret: { casId: CAS } } } as never);
    await autreVideoFinie();
    const r = await fabrication.lancerFabrication("v-03", { confirme: true }).catch((e: { code?: string }) => e);
    expect((r as { code?: string }).code).not.toBe("CAS_TRAITE");
  });
});
