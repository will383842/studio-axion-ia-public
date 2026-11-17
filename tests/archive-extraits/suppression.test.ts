/**
 * C3-UT-3.11 · P-7 (accord de Williams du 17/11/2026) : la fiche d'extraits part avec sa vidéo, UNIQUEMENT à la suppression
 * DÉFINITIVE décidée par Williams. L'id quitte les `famille` des autres fiches, qui restent intactes pour le reste.
 * Une archive (corbeille / non définitive) et une vidéo sans fiche ne touchent à AUCUNE fiche. Dépôts en mémoire.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const videos = await import("@/services/videos");
const suppression = await import("@/services/suppression-video");
import type { ElementBibliotheque } from "@/domaine/types";

const ID = "v-01";
const AUTRE = "v-03";
const H = { creeLe: "2026-10-01T00:00:00.000Z", modifieLe: "2026-10-01T00:00:00.000Z" };
const MDP = "essai-extraits-123";

beforeAll(async () => {
  process.env.SESSION_SECRET = "s".repeat(48);
  const empreinte = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  vi.restoreAllMocks();
  await auth.seConnecter(MDP, false);
});

const fiche = (videoId: string, famille: string[], extra: Partial<ElementBibliotheque> = {}): ElementBibliotheque =>
  ({
    id: `fiche-${videoId}`,
    type: "source-extraits",
    nom: `Extraits ${videoId}`,
    motsCles: [],
    valeur: {
      type: "source-extraits",
      fiche: {
        videoId,
        versionId: `${videoId}-ver`,
        sortieId: `${videoId}-sor`,
        ratio: "9:16",
        licence: { type: "propriete", usageCommercial: true, reseaux: [] },
        famille,
        plages: [{ texte: `paroles de ${videoId}` }],
        rangee: false,
        sourcePreferee: false,
      },
    },
    licence: { type: "propriete", usageCommercial: true, reseaux: [] },
    formatsParDefaut: [],
    marqueId: "m",
    ...H,
    ...extra,
  }) as unknown as ElementBibliotheque;

async function semer(avecFicheDeLaVideo = true) {
  const d = depots();
  if (avecFicheDeLaVideo) await d.elements.enregistrer(fiche(ID, [ID, AUTRE]));
  await d.elements.enregistrer(fiche(AUTRE, [AUTRE, ID]));
  await d.elements.enregistrer(fiche("v-04", ["v-04"]));
  await d.elements.enregistrer(fiche("v-05", ["v-05", ID], { derniereVideoId: ID, id: "fiche-double" }));
}

const tout = async () => JSON.stringify(await depots().elements.lister());
const citeId = (t: string) => new RegExp(`(?<![A-Za-z0-9_-])${ID}(?![A-Za-z0-9_-])`).test(t);

describe("suppression définitive : fiche d'extraits (P-7)", () => {
  it("la fiche de la vidéo est dans lot.supprimer, les autres fiches sont réécrites sans l'id", async () => {
    await semer();
    const plan = await suppression.planifierSuppression((await depots().videos.obtenir(ID))!);
    expect(plan.lot.supprimer).toContainEqual({ collection: "elements", id: `fiche-${ID}` });
    expect(plan.lot.supprimer.filter((x) => x.collection === "elements")).toHaveLength(1);
    const ecrits = plan.lot.enregistrer.filter((x) => x.collection === "elements");
    expect(ecrits.map((x) => x.entite.id).sort()).toEqual(["fiche-double", `fiche-${AUTRE}`]);
    for (const e of ecrits) expect(citeId(JSON.stringify(e.entite))).toBe(false);
  });

  it("applique le lot : plus aucune citation, fiches des autres vidéos intactes sauf l'id retiré", async () => {
    await semer();
    const avant = (await depots().elements.lister()).find((e) => e.id === "fiche-v-04");
    expect(await videos.supprimerVideoDefinitivement(ID)).toBe(true);
    const d = depots();
    expect(await d.elements.obtenir(`fiche-${ID}`)).toBeNull();
    expect(citeId(await tout())).toBe(false);
    expect(await d.elements.obtenir("fiche-v-04")).toEqual(avant);
    const autre = (await d.elements.obtenir(`fiche-${AUTRE}`))!;
    expect(autre.valeur).toMatchObject({ fiche: { videoId: AUTRE, famille: [AUTRE], plages: [{ texte: `paroles de ${AUTRE}` }] } });
  });

  it("fiche avec derniereVideoId = id ET famille contenant l'id : une seule écriture, les deux retraits faits", async () => {
    await semer();
    const plan = await suppression.planifierSuppression((await depots().videos.obtenir(ID))!);
    const doubles = plan.lot.enregistrer.filter((x) => x.collection === "elements" && x.entite.id === "fiche-double");
    expect(doubles).toHaveLength(1);
    const e = doubles[0].entite as unknown as ElementBibliotheque;
    expect(e.derniereVideoId).toBeUndefined();
    expect(e.valeur).toMatchObject({ fiche: { famille: ["v-05"] } });
  });

  it("vidéo sans fiche : le plan ne touche à aucune fiche d'extraits (et celles des autres, hors famille, restent)", async () => {
    const d = depots();
    await d.elements.enregistrer(fiche(AUTRE, [AUTRE]));
    await d.elements.enregistrer(fiche("v-04", ["v-04"]));
    const plan = await suppression.planifierSuppression((await d.videos.obtenir(ID))!);
    expect(plan.lot.supprimer.filter((x) => x.collection === "elements")).toEqual([]);
    expect(plan.lot.enregistrer.filter((x) => x.collection === "elements")).toEqual([]);
  });

  it("archive (suppression simple, non définitive) : aucune fiche d'extraits touchée", async () => {
    await semer();
    const avant = await tout();
    await videos.archiverVideos([ID]);
    expect((await depots().videos.obtenir(ID))?.statut).toBe("archivee");
    expect(await tout()).toBe(avant);
  });
});
