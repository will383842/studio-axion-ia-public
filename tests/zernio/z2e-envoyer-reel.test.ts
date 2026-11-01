/** Z2-E · envoi réel par outil : clé neutre, second clic sans 2e post, TikTok côté serveur, cibles explicites, messages neutres. */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { exemplesCommeVraies } from "../helpers/videos-reelles";
import { preparerMotDePasse } from "../helpers/g1a";
import { cleEnvoiPublication } from "@/domaine/outil-publication";
import { ErreurZernio } from "@/fournisseurs/publication/zernio-erreurs";
import type { CanalPublication, DemandePublication, FournisseurPublication } from "@/fournisseurs/types";

process.env.R2_ACCOUNT_ID = "compte-essai";
process.env.R2_ACCESS_KEY_ID = "ACCES-ESSAI";
process.env.R2_SECRET_ACCESS_KEY = "secret-essai";
process.env.R2_BUCKET = "seau-essai";
process.env.FOURNISSEUR_STOCKAGE = "r2";
process.env.ZERNIO_API_KEY = "exemple-cle-fictive-ne-pas-utiliser-0003";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const pub = await import("@/services/publications");

const VIDEO = "v-15";
const DEMAIN = new Date(Date.now() + 26 * 3600_000).toISOString();
const CANAUX: CanalPublication[] = [
  { id: "exemple-ig", organisationId: "zernio", nom: "Exemple IG", service: "instagram" },
  { id: "exemple-fb:fb:exemple-page-1", organisationId: "zernio", nom: "Exemple page 1", service: "facebook", genre: "page" },
  { id: "exemple-fb:fb:exemple-page-2", organisationId: "zernio", nom: "Exemple page 2", service: "facebook", genre: "page" },
  { id: "exemple-tt", organisationId: "zernio", nom: "Exemple TT", service: "tiktok" },
];

let demandes: DemandePublication[] = [];
let comportement: "ok" | "a-verifier" = "ok";
function faux(): FournisseurPublication {
  return {
    id: "zernio", type: "publication", nom: "Faux", reelPrevu: "Zernio", mode: "reel", capacites: { asynchrone: false, accordExige: false },
    async envoyer(d) {
      demandes.push(d);
      if (comportement === "a-verifier") throw new ErreurZernio("a-verifier", "délai dépassé");
      return { idExterne: `exemple-post-${demandes.length}`, via: "zernio" as const, statut: "brouillon" as const };
    },
    async listerCanaux() {
      return CANAUX;
    },
  };
}

async function envoyer(reseau: "instagram" | "facebook" | "tiktok", choisis: string[] | undefined, extras = {}) {
  const kit = (await pub.obtenirKit(VIDEO))!;
  return pub.envoyerReel("zernio", faux(), kit, [reseau], DEMAIN, choisis ? { [reseau]: choisis } : {}, {}, false, extras);
}

beforeAll(async () => {
  await preparerMotDePasse("essai-z2e-envoi");
});

beforeEach(async () => {
  vi.stubGlobal("fetch", () => Promise.reject(new Error("fetch interdit")));
  reinitialiserDepots();
  await exemplesCommeVraies(depots(), { plusExemples: true });
  reinitialiserRequete();
  await auth.seConnecter("essai-z2e-envoi", false);
  demandes = [];
  comportement = "ok";
  for (const c of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier(VIDEO, c, true);
});

describe("z2e · envoyerReel(outil, …)", () => {
  it("envoi par l'autre outil : via zernio, clé neutre, cible explicite", async () => {
    const r = await envoyer("instagram", undefined);
    expect(r.publications[0]).toMatchObject({ via: "zernio", etatEnvoi: "envoye", canalId: "exemple-ig", cleEnvoi: cleEnvoiPublication(VIDEO, "instagram", DEMAIN, "exemple-ig") });
    expect(demandes[0]).toMatchObject({ cible: "exemple-ig", cleEnvoi: cleEnvoiPublication(VIDEO, "instagram", DEMAIN, "exemple-ig") });
    expect(demandes[0].cleEnvoi).toMatch(/^[0-9a-f]{64}$/);
  });

  it("second clic : aucun 2e post", async () => {
    await envoyer("instagram", undefined);
    const r2 = await envoyer("instagram", undefined);
    expect(demandes).toHaveLength(1);
    expect(r2.publications).toHaveLength(1);
  });

  it("déjà parti par Buffer sur ce réseau : « Déjà envoyée par Buffer pour ce réseau. »", async () => {
    await depots().publications.enregistrer({ id: "pub-exemple-b", videoId: VIDEO, reseau: "instagram", statut: "brouillon", via: "buffer", date: DEMAIN, texte: "exemple", etatEnvoi: "envoye", idExterne: "exemple-b", creeLe: DEMAIN, modifieLe: DEMAIN } as never);
    await expect(envoyer("instagram", undefined)).rejects.toMatchObject({ message: "Déjà envoyée par Buffer pour ce réseau." });
    expect(demandes).toHaveLength(0);
  });

  it("TikTok sans case cochée : refus serveur ; cochée : la case part avec l'envoi", async () => {
    await expect(envoyer("tiktok", undefined)).rejects.toMatchObject({ code: "TIKTOK_CASE" });
    await expect(envoyer("tiktok", undefined, { consentementTiktok: false })).rejects.toMatchObject({ code: "TIKTOK_CASE" });
    expect(demandes).toHaveLength(0);
    await envoyer("tiktok", undefined, { consentementTiktok: true, niveauConfidentialiteTiktok: "SELF_ONLY" });
    expect(demandes[0]).toMatchObject({ consentementTiktok: true, niveauConfidentialiteTiktok: "SELF_ONLY", cible: "exemple-tt" });
  });

  it("Facebook sans cible : refus, jamais la page par défaut ; cible inconnue : refus ; cible explicite : part", async () => {
    await expect(envoyer("facebook", undefined)).rejects.toMatchObject({ code: "CIBLE_ZERNIO" });
    await expect(envoyer("facebook", ["exemple-fb:fb:autre-page"])).rejects.toMatchObject({ code: "CIBLE_ZERNIO" });
    expect(demandes).toHaveLength(0);
    await envoyer("facebook", ["exemple-fb:fb:exemple-page-2"]);
    expect(demandes[0].cible).toBe("exemple-fb:fb:exemple-page-2");
  });

  it("date non future : refus avant tout envoi", async () => {
    const kit = (await pub.obtenirKit(VIDEO))!;
    await expect(pub.envoyerReel("zernio", faux(), kit, ["instagram"], new Date(Date.now() - 3600_000).toISOString(), {}, {}, false)).rejects.toMatchObject({ code: "DATE_PASSEE" });
    expect(demandes).toHaveLength(0);
  });

  it("réponse perdue : « à vérifier », jamais de renvoi à l'aveugle, message neutre", async () => {
    comportement = "a-verifier";
    const r = await envoyer("instagram", undefined);
    expect(r.publications[0]).toMatchObject({ via: "zernio", etatEnvoi: "a-verifier" });
    expect(JSON.stringify(r.problemes)).not.toMatch(/Buffer|Zernio/);
    comportement = "ok";
    await expect(envoyer("instagram", undefined)).rejects.toMatchObject({ code: "ENVOI_A_VERIFIER" });
    expect(demandes).toHaveLength(1);
  });

  it("envoyerVersBuffer reste exportée, mêmes arguments", () => {
    expect(typeof pub.envoyerVersBuffer).toBe("function");
    expect(pub.envoyerVersBuffer.length).toBeLessThanOrEqual(4);
  });
});
