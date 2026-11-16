/**
 * C1-U9 · C-3 : la retouche ne touche pas à l'entrée bibliothèque. Avec `options.entrees`, la nouvelle version a
 * exactement ces entrées ; sans, elle garde celles de la version courante ; `entreeBibliothequeDuLancement` n'est
 * jamais appelée pendant une retouche. Aucun réseau, aucun euro (retouche simulée comme les tests existants).
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.setConfig({ testTimeout: 60_000 });

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const biblio = await import("@/services/bibliotheque-video");
const boucle = await import("@/services/boucle");

const MDP = "c1-u9-retouche";
const ENTREE_COURANTE = { choix: [{ capacite: "texte.style-varie", cle: "courant" }] };
const ENTREE_NEUVE = { choix: [{ capacite: "texte.style-varie", cle: "neuf" }] };

beforeAll(async () => {
  process.env.SESSION_SECRET = "c".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  boucle.avancementsEnVol().clear();
  vi.restoreAllMocks();
  await auth.seConnecter(MDP, false);
});

/** v-03 (exemple) : sa version choisie porte une commande avec `bibliothequeVideo`. */
async function videoAvecEntree() {
  const v = (await depots().videos.obtenir("v-03"))!;
  const ver = (await depots().versions.obtenir(v.versionChoisieId!))!;
  await depots().versions.modifier(ver.id, { commande: { ...ver.commande, entrees: { ...ver.commande.entrees, bibliothequeVideo: ENTREE_COURANTE } } });
  const plan = (await depots().plans.lister((p) => p.versionId === ver.id))[0];
  return { video: v, ver, plan };
}

async function nouvelleVersion(videoId: string, avantIds: string[]) {
  const versions = await depots().versions.lister((x) => x.videoId === videoId && !avantIds.includes(x.id));
  expect(versions).toHaveLength(1);
  return versions[0];
}

describe("C1-U9 · retouche et entrée bibliothèque", () => {
  it("avec options.entrees : la nouvelle version a exactement ces entrées, sans appel à l'entrée bibliothèque", async () => {
    const { video, ver, plan } = await videoAvecEntree();
    const avant = (await depots().versions.lister((x) => x.videoId === video.id)).map((x) => x.id);
    const espion = vi.spyOn(biblio, "entreeBibliothequeDuLancement");
    const entrees = { ...ver.commande.entrees, bibliothequeVideo: ENTREE_NEUVE };
    await fabrication.lancerRetouche(video.id, [plan.id], "plus net", { confirme: true, entrees });
    const neuve = await nouvelleVersion(video.id, avant);
    expect(neuve.commande.entrees).toEqual(entrees);
    expect(espion).not.toHaveBeenCalled();
  });

  it("sans options.entrees : la nouvelle version garde l'entrée de la version courante, sans appel", async () => {
    const { video, ver, plan } = await videoAvecEntree();
    const avant = (await depots().versions.lister((x) => x.videoId === video.id)).map((x) => x.id);
    const espion = vi.spyOn(biblio, "entreeBibliothequeDuLancement");
    await fabrication.lancerRetouche(video.id, [plan.id], "plus net", { confirme: true });
    const neuve = await nouvelleVersion(video.id, avant);
    expect((neuve.commande.entrees as Record<string, unknown>).bibliothequeVideo).toEqual(ENTREE_COURANTE);
    expect(neuve.commande.entrees).toEqual((await depots().versions.obtenir(ver.id))!.commande.entrees);
    expect(espion).not.toHaveBeenCalled();
  });
});
