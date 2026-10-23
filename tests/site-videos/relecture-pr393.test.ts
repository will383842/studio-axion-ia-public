/**
 * Relecture de la PR #393 : deux gardes ajoutées après la revue.
 * 1. La retouche du passeport n'écrit QUE les champs retouchables (une action serveur reçoit un objet quelconque) :
 *    ni `transcription`, ni `contenuGenere` (mention IA), ni `origines`. Le lien conseillé reste une adresse du site.
 * 2. Le vrai site ne reçoit jamais une page dont les fichiers ne sont qu'en mémoire (seau public pas branché, D7).
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";
import { mp4Test, preparerVideoPublicable } from "./helpers-publiable";
import { preparerBase, preparerMotDePasse, MDP_SITE } from "./helpers";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

// Le vrai client « http » n'est inscrit qu'avec ses deux variables, lues au chargement du registre.
vi.stubEnv("SITE_VIDEOS_URL", "https://site-reel.invalid");
vi.stubEnv("SITE_VIDEOS_SECRET", "secret-du-vrai-site-pour-ce-test");

const { depots } = await import("@/donnees/memoire");
const site = await import("@/services/site-videos");
const { ecrireParametre } = await import("@/services/_commun");
const { creerSiteFactice, injecterSiteFactice } = await import("@/fournisseurs/site/simulation");

const VIDEO = "v-01";
let appelsReseau = 0;

beforeAll(async () => {
  await preparerMotDePasse(MDP_SITE);
});

beforeEach(async () => {
  await preparerBase();
  appelsReseau = 0;
  vi.stubGlobal("fetch", async () => {
    appelsReseau++;
    throw new Error("réseau interdit");
  });
  injecterSiteFactice(creerSiteFactice({ secret: "secret-relecture" }));
});
afterEach(() => {
  injecterSiteFactice(null);
  site.injecterStockagesSite(null);
  vi.unstubAllGlobals();
});

const passeport = async () => (await depots().kits.trouver((k) => k.videoId === VIDEO))!.passeportWeb!;

describe("retouche : seuls les champs retouchables sont écrits", () => {
  it("transcription, mention IA, origines et version envoyés par l'action sont ignorés", async () => {
    await preparerVideoPublicable(VIDEO);
    const avant = await passeport();
    const retouche = { resume: "Un résumé retouché, clair et court.", transcription: "Texte inventé", contenuGenere: !avant.contenuGenere, origines: {}, version: 99 };
    const p = await site.modifierPasseport(VIDEO, retouche as never);
    expect(p.resume).toBe("Un résumé retouché, clair et court.");
    expect(p.transcription).toBe(avant.transcription);
    expect(p.contenuGenere).toBe(avant.contenuGenere);
    expect(p.origines.titreWeb).toBe(avant.origines.titreWeb);
    expect(p.version).toBe(avant.version + 1);
  });

  it("le lien conseillé est une adresse du site (« /fr/… »), jamais un autre domaine", async () => {
    await preparerVideoPublicable(VIDEO);
    for (const lien of ["https://ailleurs.example/x", "//ailleurs.example/x", "javascript:alert(1)"]) {
      await expect(site.modifierPasseport(VIDEO, { lienService: lien })).rejects.toMatchObject({ code: "LIEN_INVALIDE" });
    }
    expect((await site.modifierPasseport(VIDEO, { lienService: "/fr/formations/devis" })).lienService).toBe("/fr/formations/devis");
  });
});

describe("vrai site choisi, seau public pas branché", () => {
  it("refus clair, aucun appel au site, aucun fichier copié", async () => {
    await preparerVideoPublicable(VIDEO);
    site.injecterStockagesSite({ prive: { lireDebut: async () => mp4Test(true) } });
    await ecrireParametre("fournisseur.site", "http");
    await expect(site.publierSurLeSite(VIDEO)).rejects.toMatchObject({ code: "STOCKAGE_PUBLIC_A_RELIER" });
    expect(appelsReseau).toBe(0);
    const e = (await depots().kits.trouver((k) => k.videoId === VIDEO))!.site!;
    expect(e.etat).not.toBe("envoi-en-cours");
    expect(e.fichiersPublics).toEqual([]);
  });
});
