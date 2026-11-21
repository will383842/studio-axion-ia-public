/** AUD-6 : le bilan de reprise est rangé après « Réessayer » ; le dossier zip n'est téléchargé qu'une fois par fichier. 0 €, aucun appel réel. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Travail } from "@/domaine/types";
import { creerMoteurTutorielOutil } from "@/moteurs/montage-tutoriel-outil";
import { commandeTutoriel, outilsDoubles, une, type Journal } from "./doubles";

const T0 = Date.UTC(2026, 10, 21, 9);

describe("reprise lisible : bilanReprise après « Réessayer »", () => {
  it("la phrase est rangée dans les paramètres du travail, sans montant", async () => {
    const j: Journal = { voix: [], claude: [], rendus: [] };
    const moteur = creerMoteurTutorielOutil({ outils: une(outilsDoubles(j)) });
    const c = commandeTutoriel();
    const t0 = await moteur.lancer(c, { travailId: "t-aud6", versionId: "v", titre: "Tuto", maintenant: T0 });
    const enEchec: Travail = {
      ...t0,
      statut: "echec",
      etapes: t0.etapes.map((e) => (e.cle === "montage" ? { ...e, statut: "echec" as const } : e)),
    };
    const repris = await moteur.reessayer!(enEchec, T0 + 1000);
    const reprise = (repris.parametres as { reprise?: { phrase: string; refait: string[]; garde: string[] } }).reprise;
    expect(reprise?.phrase).toEqual(expect.any(String));
    expect(reprise?.phrase.length).toBeGreaterThan(0);
    expect(reprise?.phrase).not.toMatch(/€|\$|USD/);
    expect(repris.statut).toBe("en_cours");
    expect(repris.tentatives).toBe(enEchec.tentatives + 1);
  });
});

const fetchSimule = vi.fn(async (adresse: string) => (void adresse, { ok: true, arrayBuffer: async () => new ArrayBuffer(4) }));
const extraire = vi.fn(async (octets: Uint8Array, o: { attestationImages: boolean }) => (void octets, void o, { ok: true as const, fichiers: new Map([["index.html", new Uint8Array([1, 2, 3])]]), rapport: {} }));
let cleStockage = "cle-a";

vi.mock("@/services/fichiers", () => ({ fichierEnvoye: vi.fn(async () => ({ cleStockage })) }));
vi.mock("@/services/_commun", () => ({ fournisseur: vi.fn(async () => ({ urlLecture: async (c: string) => `https://exemple.invalide/${c}` })) }));
vi.mock("@/services/zip-tutoriel", async (orig) => ({ ...(await orig<object>()), extraireZipSur: (o: Uint8Array, opt: { attestationImages: boolean }) => extraire(o, opt) }));

describe("cache borné du dossier extrait", () => {
  beforeEach(async () => {
    vi.stubGlobal("fetch", fetchSimule);
    fetchSimule.mockClear();
    extraire.mockClear();
    cleStockage = "cle-a";
    (await import("@/services/tutoriel-equipe")).purgerCacheDossier();
  });

  async function lire(fichierId: string, attestation = false) {
    const { portsEquipe } = await import("@/services/tutoriel-equipe");
    const commande = { origine: "studio", entrees: { tutorielOutil: { depot: { mode: "dossier", fichierId, attestationImages: attestation } } } };
    // Le chemin réel de `fichiersParDefaut` : aucun `fichiersDuDossier` injecté.
    return portsEquipe(commande as never, "v-1" as never, {}).lireDossier();
  }

  it("2 appels du même fichier = 1 seul téléchargement et 1 seule extraction", async () => {
    await lire("f-1");
    await lire("f-1");
    expect(fetchSimule).toHaveBeenCalledTimes(1);
    expect(extraire).toHaveBeenCalledTimes(1);
  });

  it("fichierId différent = nouveau téléchargement", async () => {
    await lire("f-1");
    await lire("f-2");
    expect(fetchSimule).toHaveBeenCalledTimes(2);
  });

  it("l'attestation d'images ou une clé de stockage changée ne ressert jamais l'ancienne extraction", async () => {
    await lire("f-1", false);
    await lire("f-1", true);
    expect(extraire).toHaveBeenCalledTimes(2);
    cleStockage = "cle-b";
    await lire("f-1", true);
    expect(extraire).toHaveBeenCalledTimes(3);
  });

  it("borné à 2 entrées : la plus ancienne est évincée (LRU)", async () => {
    await lire("f-1");
    await lire("f-2");
    await lire("f-1"); // f-1 redevient la plus récente
    await lire("f-3"); // évince f-2
    fetchSimule.mockClear();
    await lire("f-1");
    expect(fetchSimule).not.toHaveBeenCalled();
    await lire("f-2");
    expect(fetchSimule).toHaveBeenCalledTimes(1);
  });

  it("une extraction refusée n'est jamais gardée", async () => {
    extraire.mockResolvedValueOnce({ ok: false } as never);
    expect(await lire("f-9")).toBeNull();
    await lire("f-9");
    expect(fetchSimule).toHaveBeenCalledTimes(2);
  });

  it("la purge vide le cache", async () => {
    await lire("f-1");
    (await import("@/services/tutoriel-equipe")).purgerCacheDossier();
    await lire("f-1");
    expect(fetchSimule).toHaveBeenCalledTimes(2);
  });
});
