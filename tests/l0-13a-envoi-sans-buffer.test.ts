/**
 * L0-13a · Serveur : plus aucun envoi possible par Buffer. Faux clients seulement, aucun appel réel.
 * Ce qui est déjà en base au nom de Buffer reste LU, jamais effacé ni réécrit.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { exemplesCommeVraies } from "./helpers/videos-reelles";
import { preparerMotDePasse } from "./helpers/g1a";
import { CLE_FICTIVE } from "./zernio/aides/faux-zernio";
import type { FournisseurPublication } from "@/fournisseurs/types";

process.env.BUFFER_API_KEY = "cle-buffer-fictive-l0-13a-0001";
process.env.ZERNIO_API_KEY = CLE_FICTIVE;
process.env.R2_ACCOUNT_ID = "compte-essai";
process.env.R2_ACCESS_KEY_ID = "ACCES-ESSAI";
process.env.R2_SECRET_ACCESS_KEY = "secret-essai";
process.env.R2_BUCKET = "seau-essai";
process.env.FOURNISSEUR_STOCKAGE = "r2";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const pub = await import("@/services/publications");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const { definirRoutage, lireRoutage, outilDeEnvoi, PARAM_ROUTAGE } = await import("@/services/routage-publication");
const { envoyerParOutilAction } = await import("@/services/a-publier-zernio");
const outils = await import("@/domaine/outil-publication");

const MDP = "essai-l0-13a";
const VIDEO = "v-15";
const DEMAIN = new Date(Date.now() + 26 * 3600_000).toISOString();
let fetchAppels: string[] = [];
let journal: ReturnType<typeof vi.spyOn>;

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  vi.stubEnv("STUDIO_BUFFER_GEL_DEFAUT", "");
  fetchAppels = [];
  vi.stubGlobal("fetch", (url: unknown) => {
    fetchAppels.push(String(url));
    return Promise.reject(new Error("aucun appel réel dans ce test"));
  });
  journal = vi.spyOn(console, "log").mockImplementation(() => undefined);
  reinitialiserDepots();
  await exemplesCommeVraies(depots(), { plusExemples: true });
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  for (const c of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier(VIDEO, c, true);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const journauxEnvoi = () => journal.mock.calls.filter((a: unknown[]) => String(a[0]).startsWith("studio_envoi"));

describe("L0-13a · choix du fournisseur", () => {
  it("BUFFER_API_KEY posée : fournisseurParId('publication', 'buffer') refuse, Zernio reste", async () => {
    const { fournisseurParId } = await import("@/fournisseurs");
    expect(() => fournisseurParId("publication", "buffer")).toThrow();
    expect(fournisseurParId("publication", "zernio").id).toBe("zernio");
  });

  it("inscription.ts ne rend plus que Zernio", async () => {
    const { publicationBuffer } = await import("@/fournisseurs/publication/inscription");
    expect(Object.keys(publicationBuffer({ BUFFER_API_KEY: "cle-fictive-0002", ZERNIO_API_KEY: CLE_FICTIVE } as never))).toEqual(["zernio"]);
    expect(Object.keys(publicationBuffer({ BUFFER_API_KEY: "cle-fictive-0002" } as never))).toEqual([]);
  });

  it("fournisseur.publication = 'buffer' (base) : lu comme 'zernio', pas de simulation en silence", async () => {
    const f = await import("@/fournisseurs");
    expect(f.choixFournisseur("publication", "buffer")).toMatchObject({ demande: "zernio", source: "base" });
    expect(f.estSimule("publication", "buffer")).toBe(false);
    expect(f.etatConnexion("publication", "buffer")).toBe("relie");
    expect(f.resoudreFournisseur("publication", "buffer").id).toBe("zernio");
  });

  it("FOURNISSEUR_PUBLICATION=buffer (environnement) : lu comme 'zernio'", async () => {
    vi.stubEnv("FOURNISSEUR_PUBLICATION", "buffer");
    const f = await import("@/fournisseurs");
    expect(f.choixFournisseur("publication")).toMatchObject({ demande: "zernio", source: "environnement" });
    expect(f.estSimule("publication")).toBe(false);
  });

  it("Zernio non relié : 'buffer' lu comme 'zernio', état « à relier » (jamais « essai »)", async () => {
    vi.resetModules();
    const cle = process.env.ZERNIO_API_KEY;
    delete process.env.ZERNIO_API_KEY;
    try {
      const f = await import("@/fournisseurs");
      expect(f.choixFournisseur("publication", "buffer").demande).toBe("zernio");
      expect(f.etatConnexion("publication", "buffer")).toBe("a-relier");
    } finally {
      process.env.ZERNIO_API_KEY = cle;
    }
  });

  it("les autres types de fournisseur ne sont pas touchés (« buffer » n'est pas réécrit hors publication)", async () => {
    const f = await import("@/fournisseurs");
    expect(f.choixFournisseur("stockage", "buffer").demande).toBe("buffer");
  });
});

describe("L0-13a · liste de lecture et liste d'envoi", () => {
  it("OUTILS (lecture) reste buffer + zernio ; OUTILS_ENVOI = zernio seul", () => {
    expect([...outils.OUTILS]).toEqual(["buffer", "zernio"]);
    expect([...outils.OUTILS_ENVOI]).toEqual(["zernio"]);
  });
  it("outilsProposes ne propose que Zernio, quel que soit l'outil actuel", () => {
    expect(outils.outilsProposes("zernio").map((o) => o.outil)).toEqual(["zernio"]);
    expect(outils.outilsProposes("buffer").map((o) => o.outil)).toEqual(["zernio"]);
  });
  it("outilDe({ via: 'buffer' }) rend toujours 'buffer' (historique lu)", () => {
    expect(outils.outilDe({ via: "buffer" })).toBe("buffer");
    expect(outils.outilPour({ instagram: "buffer" }, "instagram")).toBe("buffer");
  });
  it("envoyerVersBuffer reste exportée (mêmes arguments)", () => {
    expect(typeof pub.envoyerVersBuffer).toBe("function");
    expect(pub.envoyerVersBuffer.length).toBeGreaterThanOrEqual(3);
  });
});

describe("L0-13a · routage", () => {
  it("definirRoutage(cle, 'buffer') refuse OUTIL_RETIRE ; le réglage en base est identique (même dégelé)", async () => {
    await ecrireParametre("buffer.gele", false);
    await ecrireParametre(PARAM_ROUTAGE, { linkedin: "buffer", instagram: "zernio" });
    const avant = JSON.stringify(await lireParametre(PARAM_ROUTAGE, null));
    await expect(definirRoutage("instagram", "buffer")).rejects.toMatchObject({ code: "OUTIL_RETIRE" });
    expect(JSON.stringify(await lireParametre(PARAM_ROUTAGE, null))).toBe(avant);
  });

  it("choisir Zernio ou retirer une clé reste libre", async () => {
    expect(await definirRoutage("instagram", "zernio")).toEqual({ instagram: "zernio" });
    expect(await definirRoutage("instagram", null)).toEqual({});
  });

  it("routage { instagram: 'buffer' } : part par 'zernio' ; la valeur 'buffer' reste en base", async () => {
    await ecrireParametre("buffer.gele", false);
    await ecrireParametre(PARAM_ROUTAGE, { instagram: "buffer" });
    expect(await outilDeEnvoi("instagram")).toBe("zernio");
    expect(await lireParametre(PARAM_ROUTAGE, null)).toEqual({ instagram: "buffer" });
    expect(await lireRoutage()).toEqual({ instagram: "buffer" });
  });

  it("routage 'buffer' et Zernio non relié : ZERNIO_NON_RELIE, valeur toujours en base", async () => {
    await ecrireParametre(PARAM_ROUTAGE, { instagram: "buffer" });
    const cle = process.env.ZERNIO_API_KEY;
    delete process.env.ZERNIO_API_KEY;
    try {
      await expect(outilDeEnvoi("instagram")).rejects.toMatchObject({ code: "ZERNIO_NON_RELIE" });
    } finally {
      process.env.ZERNIO_API_KEY = cle;
    }
    expect(await lireParametre(PARAM_ROUTAGE, null)).toEqual({ instagram: "buffer" });
  });
});

describe("L0-13a · aucun chemin d'envoi n'écrit via 'buffer'", () => {
  it("envoyerParOutilAction({ outil: 'buffer' }) : OUTIL_REFUSE avant tout effet, quel que soit le routage", async () => {
    for (const routage of [{}, { instagram: "zernio" }, { instagram: "buffer" }]) {
      await ecrireParametre("buffer.gele", false);
      await ecrireParametre(PARAM_ROUTAGE, routage);
      const avant = (await depots().publications.lister()).length;
      const r = await envoyerParOutilAction(VIDEO, "instagram", DEMAIN, { outil: "buffer" });
      expect(r).toMatchObject({ ok: false, code: "OUTIL_REFUSE" });
      expect((await depots().publications.lister()).length).toBe(avant);
      expect(fetchAppels).toEqual([]);
      expect(journauxEnvoi()).toEqual([]);
    }
  });

  it("envoyerVersBuffer avec routage 'buffer' dégelé : jamais via 'buffer', jamais d'appel à Buffer", async () => {
    await ecrireParametre("buffer.gele", false);
    await ecrireParametre(PARAM_ROUTAGE, { instagram: "buffer" });
    await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN).catch(() => undefined);
    const vias = (await depots().publications.lister()).filter((p) => p.videoId === VIDEO).map((p) => p.via);
    expect(vias.filter((v) => v === "buffer")).toEqual([]);
    expect(fetchAppels.filter((u) => /buffer/i.test(u))).toEqual([]);
  });

  it("envoyerReel('buffer', …) (appel direct, premier commentaire compris) : refus OUTIL_RETIRE, rien n'est créé ni envoyé", async () => {
    const envoyer = vi.fn();
    const faux = { id: "buffer", type: "publication", nom: "Faux", reelPrevu: "Buffer", mode: "reel", capacites: { asynchrone: false, accordExige: false }, envoyer, listerCanaux: async () => [] } as unknown as FournisseurPublication;
    const kit = (await pub.obtenirKit(VIDEO))!;
    const avant = (await depots().publications.lister()).length;
    await expect(pub.envoyerReel("buffer", faux, kit, ["instagram"], DEMAIN, {}, { instagram: "premier commentaire" }, true)).rejects.toMatchObject({ code: "OUTIL_RETIRE" });
    expect(envoyer).not.toHaveBeenCalled();
    expect((await depots().publications.lister()).length).toBe(avant);
  });

  it("envoyerReel('zernio', …) : la publication créée a via 'zernio'", async () => {
    const envoyer = vi.fn(async () => ({ idExterne: "exemple-post-1", via: "zernio" as const, statut: "brouillon" as const }));
    const faux = { id: "zernio", type: "publication", nom: "Faux", reelPrevu: "Zernio", mode: "reel", capacites: { asynchrone: false, accordExige: false }, envoyer, listerCanaux: async () => [{ id: "exemple-ig", organisationId: "zernio", nom: "Exemple IG", service: "instagram", deconnecte: false }] } as unknown as FournisseurPublication;
    const kit = (await pub.obtenirKit(VIDEO))!;
    const r = await pub.envoyerReel("zernio", faux, kit, ["instagram"], DEMAIN, {}, {}, false);
    expect(r.publications.map((p) => p.via)).toEqual(["zernio"]);
  });
});
