/** Z2-E · anti-doublon ENTRE outils : un contenu déjà parti par un outil ne repart pas par l'autre. */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { exemplesCommeVraies } from "../helpers/videos-reelles";
import { preparerMotDePasse } from "../helpers/g1a";
import { occupeBuffer, refusDoublonEntreOutils } from "@/domaine/buffer";
import { ErreurZernio, type CodeErreurZernio } from "@/fournisseurs/publication/zernio-erreurs";
import type { FournisseurPublication } from "@/fournisseurs/types";

process.env.FOURNISSEUR_PUBLICATION = "zernio";
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
/** Aucun appel réel : tout fetch global est compté et refusé. */
const appelsReseau: string[] = [];

beforeAll(async () => {
  await preparerMotDePasse("essai-z2e-doublon");
});

beforeEach(async () => {
  vi.unstubAllGlobals();
  reinitialiserDepots();
  await exemplesCommeVraies(depots(), { plusExemples: true });
  reinitialiserRequete();
  await auth.seConnecter("essai-z2e-doublon", false);
  appelsReseau.length = 0;
  vi.stubGlobal("fetch", async (url: unknown) => {
    appelsReseau.push(String(url));
    throw new Error("aucun appel réel dans ce test");
  });
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

  it("historique : contenu déjà parti par Buffer sur ce réseau (publication « buffer » lue) : Zernio refuse, aucun envoi", async () => {
    await depots().publications.enregistrer({
      id: "pub-exemple-b", videoId: VIDEO, reseau: "instagram", statut: "brouillon", via: "buffer", date: DEMAIN, texte: "exemple",
      etatEnvoi: "envoye", idExterne: "exemple-post", creeLe: DEMAIN, modifieLe: DEMAIN,
    } as never);
    const jamais = fauxZernio(new ErreurZernio("refuse", "ne doit pas être appelé"));
    const envoyer = vi.spyOn(jamais, "envoyer");
    const kit = (await pub.obtenirKit(VIDEO))!;
    await expect(pub.envoyerReel("zernio", jamais, kit, ["instagram"], DEMAIN, {}, {}, false)).rejects.toMatchObject({ message: "Déjà envoyée par Buffer pour ce réseau." });
    expect(envoyer).not.toHaveBeenCalled();
    expect(appelsReseau).toHaveLength(0);
  });

  it("envoyerVersBuffer garde son nom mais n'envoie plus par Buffer : sans clé Zernio, refus ZERNIO_NON_RELIE, aucun appel réseau", async () => {
    delete process.env.ZERNIO_API_KEY;
    await expect(pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN)).rejects.toMatchObject({ code: "ZERNIO_NON_RELIE" });
    expect(await depots().publications.lister((x) => x.videoId === VIDEO)).toHaveLength(0);
    expect(appelsReseau).toHaveLength(0);
  });

  /** Envoi direct par Buffer : refusé avant toute préparation (L0-13a), rien n'est écrit, rien ne part. */
  async function buffer_refuse() {
    const kit = (await pub.obtenirKit(VIDEO))!;
    await expect(pub.envoyerReel("buffer", fauxZernio(new ErreurZernio("refuse", "jamais appelé")), kit, ["instagram"], DEMAIN, {}, {}, false)).rejects.toMatchObject({ code: "OUTIL_RETIRE" });
    expect(appelsReseau).toHaveLength(0);
  }

  /** Faux outil Zernio dont l'envoi lève l'erreur donnée (après écriture côté outil). */
  function fauxZernio(leve: ErreurZernio): FournisseurPublication {
    return {
      id: "zernio", type: "publication", nom: "Faux", reelPrevu: "Zernio", mode: "reel", capacites: { asynchrone: false, accordExige: false },
      async envoyer() {
        throw leve;
      },
      async listerCanaux() {
        return [{ id: "exemple-ig", organisationId: "zernio", nom: "Exemple IG", service: "instagram", deconnecte: false }];
      },
    };
  }
  async function envoyerZernio(leve: ErreurZernio) {
    const kit = (await pub.obtenirKit(VIDEO))!;
    return pub.envoyerReel("zernio", fauxZernio(leve), kit, ["instagram"], DEMAIN, {}, {}, false);
  }

  it("réponse 2xx illisible chez Zernio : « à vérifier », puis Buffer est refusé (OUTIL_RETIRE)", async () => {
    const r = await envoyerZernio(new ErreurZernio("reponse-invalide", "illisible", { statut: 200 }));
    expect(r.publications[0]).toMatchObject({ via: "zernio", etatEnvoi: "a-verifier" });
    expect(JSON.stringify(r.problemes)).not.toMatch(/Buffer|Zernio/);
    await buffer_refuse();
    expect(await depots().publications.lister((x) => x.videoId === VIDEO)).toHaveLength(1);
  });

  it("doublon (409) arrivé jusqu'au service : « à vérifier » (le fournisseur a déjà comparé la clé), Buffer refusé ensuite (OUTIL_RETIRE)", async () => {
    const r = await envoyerZernio(new ErreurZernio("doublon", "identique", { statut: 409 }));
    expect(r.publications[0]).toMatchObject({ via: "zernio", etatEnvoi: "a-verifier" });
    await buffer_refuse();
  });

  it("creerPost répond 2xx avec une plateforme en échec : « à vérifier » (jamais refusé), Buffer refusé ensuite (OUTIL_RETIRE)", async () => {
    const r = await envoyerZernio(new ErreurZernio("creation-incomplete", "incomplet", { statut: 200 }));
    expect(r.publications[0]).toMatchObject({ via: "zernio", etatEnvoi: "a-verifier" });
    const ecrites = await depots().publications.lister((x) => x.via === "zernio");
    expect(occupeBuffer(ecrites[0])).toBe(true);
    await buffer_refuse();
  });

  it("refus sans statut levé avant le réseau reste un refus ; « refuse » avec un statut 2xx ou 5xx n'en est pas un", async () => {
    await expect(envoyerZernio(new ErreurZernio("refuse", "local"))).rejects.toMatchObject({ message: "L'outil de publication a refusé l'envoi : rien n'est parti." });
    const r = await envoyerZernio(new ErreurZernio("refuse", "tardif", { statut: 200 }));
    expect(r.publications[0]).toMatchObject({ etatEnvoi: "a-verifier" });
  });

  it("doublon (409) sans identifiant : « à vérifier », jamais « refusé »", async () => {
    const r = await envoyerZernio(new ErreurZernio("doublon", "identique", { statut: 409 }));
    expect(r.publications[0]).toMatchObject({ via: "zernio", etatEnvoi: "a-verifier" });
    await buffer_refuse();
  });

  it("refus net (4xx) : « refusé », message neutre à l'écran, ce refus ne bloque pas un nouvel essai", async () => {
    const codes: CodeErreurZernio[] = ["refuse"];
    for (const code of codes) {
      await expect(envoyerZernio(new ErreurZernio(code, "Zernio a refusé la demande.", { statut: 400 }))).rejects.toMatchObject({ message: "L'outil de publication a refusé l'envoi : rien n'est parti." });
    }
    const refusees = await depots().publications.lister((x) => x.via === "zernio");
    expect(refusees[0]).toMatchObject({ etatEnvoi: "refuse" });
    expect(occupeBuffer(refusees[0])).toBe(false);
  });
});
