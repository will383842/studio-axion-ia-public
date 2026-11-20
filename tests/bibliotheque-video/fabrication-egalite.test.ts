/**
 * C1-U9 : `commandeDeLaVideo` étale `entreeBibliothequeDuLancement` en dernier dans `entrees`.
 * Éteint = commande identique (trois formats) ; allumé = seule la clé `bibliothequeVideo` s'ajoute ; estimation = rien.
 * Aucun réseau, aucun euro.
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
const { ecrireParametre } = await import("@/services/_commun");
const { lireEntreeBibliotheque } = await import("@/briques/bibliotheque-video/schema");

const MDP = "c1-u9-egalite";
const FORMATS = ["avocat", "facecam", "cas-concret"] as const;

beforeAll(async () => {
  process.env.SESSION_SECRET = "c".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  vi.restoreAllMocks();
  await auth.seConnecter(MDP, false);
});

/** Une vidéo de fixture par format : copie de l'exemple v-03, au format voulu. */
async function videoDuFormat(formatId: string) {
  const v = (await depots().videos.obtenir("v-03"))!;
  const id = `v-u9-${formatId}`;
  await depots().videos.enregistrer({ ...v, id, formatId, versionChoisieId: undefined } as never);
  return id;
}

const sansDates = (c: unknown) => JSON.parse(JSON.stringify(c, (cle, v) => (cle === "construiteLe" ? "-" : v)));

describe("C1-U9 · réglage éteint : commande identique à celle d'avant", () => {
  it.each(FORMATS)("%s : absent ou false → aucune clé bibliothequeVideo, commande égale à celle avec l'entrée simulée à {}", async (formatId) => {
    const id = await videoDuFormat(formatId);
    // v20g : avocat est allumé par défaut quand la base est vide ; on écrit `false` pour rester « sans bibliothèque ».
    if (formatId === "avocat") await ecrireParametre("bibliothequeVideo.avocat", false);
    const absent = await fabrication.construireCommande(id);
    expect(Object.keys(absent.entrees)).not.toContain("bibliothequeVideo");
    await ecrireParametre(`bibliothequeVideo.${formatId}`, false);
    const faux = await fabrication.construireCommande(id);
    expect(Object.keys(faux.entrees)).not.toContain("bibliothequeVideo");
    const simulee = vi.spyOn(biblio, "entreeBibliothequeDuLancement").mockResolvedValue({});
    const reference = await fabrication.construireCommande(id);
    expect(simulee).toHaveBeenCalled();
    expect(sansDates(absent)).toEqual(sansDates(reference));
    expect(sansDates(faux)).toEqual(sansDates(reference));
  });
});

describe("C1-U9 · réglage allumé", () => {
  it("cas-concret : la clé est lisible, toutes les autres clés de la commande sont celles du cas éteint", async () => {
    const id = await videoDuFormat("cas-concret");
    const eteint = await fabrication.construireCommande(id);
    await ecrireParametre("bibliothequeVideo.cas-concret", true);
    const allume = await fabrication.construireCommande(id);
    expect(lireEntreeBibliotheque(allume.entrees)).not.toBeNull();
    const { bibliothequeVideo, ...autresEntrees } = allume.entrees as Record<string, unknown>;
    expect(bibliothequeVideo).toBeDefined();
    expect(sansDates({ ...allume, entrees: autresEntrees })).toEqual(sansDates(eteint));
  });
});

describe("C1-U9 · estimation (C-2)", () => {
  it("réglage allumé : aucune clé bibliothequeVideo, prix estimé identique au cas éteint", async () => {
    const id = await videoDuFormat("cas-concret");
    const video = (await depots().videos.obtenir(id))!;
    const script = (await depots().scripts.lister())[0];
    expect(script).toBeTruthy();
    const eteint = await fabrication.construireCommandeEstimation(video, script);
    await ecrireParametre("bibliothequeVideo.cas-concret", true);
    const espion = vi.spyOn(biblio, "entreeBibliothequeDuLancement");
    const allume = await fabrication.construireCommandeEstimation(video, script);
    expect(espion).toHaveBeenCalledWith(expect.anything(), { estimation: true });
    expect(Object.keys(allume.entrees)).not.toContain("bibliothequeVideo");
    expect(sansDates(allume)).toEqual(sansDates(eteint));
    const { moteurDeCommande } = await import("@/moteurs");
    const prix = async (c: typeof allume) => (await moteurDeCommande(c).estimer(c)).lignes;
    expect(await prix(allume)).toEqual(await prix(eteint));
  });
});
