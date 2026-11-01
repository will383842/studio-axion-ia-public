/** Z2-E · anti-doublon ENTRE outils : un contenu déjà parti par un outil ne repart pas par l'autre. */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { exemplesCommeVraies } from "../helpers/videos-reelles";
import { preparerMotDePasse } from "../helpers/g1a";
import { fauxBuffer } from "../helpers/r1-buffer";
import { occupeBuffer, refusDoublonEntreOutils } from "@/domaine/buffer";

process.env.BUFFER_API_KEY = "exemple-cle-fictive-ne-pas-utiliser-0002";
process.env.FOURNISSEUR_PUBLICATION = "buffer";
process.env.R2_ACCOUNT_ID = "compte-essai";
process.env.R2_ACCESS_KEY_ID = "ACCES-ESSAI";
process.env.R2_SECRET_ACCESS_KEY = "secret-essai";
process.env.R2_BUCKET = "seau-essai";
process.env.FOURNISSEUR_STOCKAGE = "r2";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const pub = await import("@/services/publications");

const VIDEO = "v-15";
const DEMAIN = new Date(Date.now() + 26 * 3600_000).toISOString();
let buffer: ReturnType<typeof fauxBuffer>;

beforeAll(async () => {
  await preparerMotDePasse("essai-z2e-doublon");
});

beforeEach(async () => {
  vi.unstubAllGlobals();
  reinitialiserDepots();
  await exemplesCommeVraies(depots(), { plusExemples: true });
  reinitialiserRequete();
  await auth.seConnecter("essai-z2e-doublon", false);
  buffer = fauxBuffer({});
  vi.stubGlobal("fetch", buffer.appeler);
  for (const c of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier(VIDEO, c, true);
});

describe("z2e · anti-doublon entre outils", () => {
  it("occupeBuffer regarde les deux outils", () => {
    expect(occupeBuffer({ via: "buffer", statut: "brouillon", etatEnvoi: "envoye" })).toBe(true);
    expect(occupeBuffer({ via: "zernio", statut: "brouillon", etatEnvoi: "envoye" })).toBe(true);
    expect(occupeBuffer({ via: "zernio", statut: "echec", etatEnvoi: "refuse" })).toBe(false);
    expect(occupeBuffer({ via: "manuel", statut: "publiee" })).toBe(false);
  });

  it("phrase de refus : le nom est celui de l'outil déjà passé", () => {
    expect(refusDoublonEntreOutils([{ via: "buffer", statut: "brouillon", etatEnvoi: "envoye" }], "zernio")).toBe("Déjà envoyée par Buffer pour ce réseau.");
    expect(refusDoublonEntreOutils([{ via: "zernio", statut: "brouillon", etatEnvoi: "envoye" }], "buffer")).toBe("Déjà envoyée par Zernio pour ce réseau.");
    expect(refusDoublonEntreOutils([{ via: "buffer", statut: "brouillon", etatEnvoi: "envoye" }], "buffer")).toBeNull();
    expect(refusDoublonEntreOutils([{ via: "buffer", statut: "echec", etatEnvoi: "refuse" }], "zernio")).toBeNull();
  });

  it("contenu déjà parti par l'autre outil sur ce réseau : refus, aucun appel au réseau", async () => {
    await depots().publications.enregistrer({
      id: "pub-exemple-z", videoId: VIDEO, reseau: "instagram", statut: "brouillon", via: "zernio", date: DEMAIN, texte: "exemple",
      etatEnvoi: "envoye", idExterne: "exemple-post", creeLe: DEMAIN, modifieLe: DEMAIN,
    } as never);
    await expect(pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN)).rejects.toMatchObject({ code: "DEJA_CHEZ_UN_AUTRE_OUTIL", message: "Déjà envoyée par Zernio pour ce réseau." });
    expect(buffer.mutations()).toHaveLength(0);
  });
});
