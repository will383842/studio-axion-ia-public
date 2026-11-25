/**
 * ALLUMER-BIBLIO-DEFAUTS-v20g (Williams 20/11 : fini + gratuit = allumé par défaut dans le code).
 * Base vide → valeur par défaut du code (avocat, tableau-anime) ; une valeur en base l'emporte toujours (même `false`).
 * Aucun réseau, aucun euro.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { lireReglageBibliotheque } from "@/briques/bibliotheque-video/reglage";
import { ID } from "@/briques/bibliotheque-video/noms";
import { PROFIL_TABLEAU_ANIME } from "@/briques/bibliotheque-video/profils/tableau-anime";
import { VERSION_BIBLIOTHEQUE } from "@/briques/bibliotheque-video/version";
import type { EntreeBibliotheque } from "@/briques/bibliotheque-video/types";
import { piecesPermisesDesEntrees } from "@/briques/plan-scenes-objets/pieces-permises";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.setConfig({ testTimeout: 60_000 });

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const { ecrireParametre } = await import("@/services/_commun");
const { lireEntreeBibliotheque } = await import("@/briques/bibliotheque-video/schema");

const AVOCAT = [ID.texteNomOutilAutonome, ID.texteSortieAnimee, ID.texteStyleVarie];
const TABLEAU = [ID.objetChiffre, ID.objetEtape, ID.objetMarque];
const vide = async () => undefined;
const MDP = "v20g-defauts";

beforeAll(async () => {
  process.env.SESSION_SECRET = "c".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

describe("(a) base vide : valeur par défaut du code", () => {
  it("avocat : les 3 capacités de texte", async () => {
    expect(await lireReglageBibliotheque("avocat", vide)).toEqual({ actif: true, capacites: AVOCAT });
    expect(await lireReglageBibliotheque("avocat", async () => null)).toEqual({ actif: true, capacites: AVOCAT });
  });
  it("tableau-anime : les 3 objets", async () => {
    expect(await lireReglageBibliotheque("tableau-anime", vide)).toEqual({ actif: true, capacites: TABLEAU });
  });
  // FOND-FLOU-C10-04-b-v20l : facecam sort de la liste des éteints (carton magazine allumé, Williams 21/11 00:25).
  it("facecam : plan de scènes (dessin inchangé) + étiquette (carton magazine seul)", async () => {
    expect(await lireReglageBibliotheque("facecam", vide)).toEqual({ actif: true, capacites: [ID.planScenesFacecam, ID.objetEtiquette] });
  });
  it.each(["cas-concret", "facecam-animee", "inconnu"])("%s : éteint", async (f) => {
    expect(await lireReglageBibliotheque(f, vide)).toEqual({ actif: false });
  });
});

describe("(b) une valeur en base l'emporte", () => {
  it.each(["avocat", "tableau-anime"])("%s : false → éteint ; capacites vide → actif sans capacité ; lecture qui lève → éteint", async (f) => {
    expect(await lireReglageBibliotheque(f, async () => false)).toEqual({ actif: false });
    expect(await lireReglageBibliotheque(f, async () => ({ capacites: [] }))).toEqual({ actif: true, capacites: [] });
    expect(await lireReglageBibliotheque(f, async () => { throw new Error("no"); })).toEqual({ actif: false });
    expect(await lireReglageBibliotheque(f, () => Promise.reject(new Error("no")))).toEqual({ actif: false });
  });
});

describe("(c) tableau : le profil permet exactement les 3 objets de ALLUMER-OBJETS-TABLEAU-v20g, rien d'autre", () => {
  it("les 3 capacités du défaut sont permises ; seules les pièces de ces capacités sont ouvertes", () => {
    const entree: EntreeBibliotheque = {
      version: VERSION_BIBLIOTHEQUE,
      profil: { ...PROFIL_TABLEAU_ANIME, capacites: { ...PROFIL_TABLEAU_ANIME.capacites } },
      recents: [],
      graine: "G",
      figeeLe: "2026-11-20",
    };
    for (const id of TABLEAU) expect(entree.profil.capacites[id]?.permis).toBe(true);
    expect(Object.entries(entree.profil.capacites).filter(([, r]) => r?.permis === true).map(([id]) => id).sort()).toEqual([...TABLEAU].sort());
    expect([...piecesPermisesDesEntrees({ bibliothequeVideo: entree })].sort()).toEqual(["objet-anneau-donnees", "objet-barre-progression", "objet-chrono", "objet-coche", "objet-compteur-rouleau", "objet-croix", "objet-etape", "objet-etape-segments", "objet-gros-chiffre", "objet-mot-barre", "objet-particules"]);
  });
});

describe("(e) avocat allumé par défaut : commande et prix", () => {
  beforeEach(async () => {
    reinitialiserDepots();
    reinitialiserRequete();
    vi.restoreAllMocks();
    await auth.seConnecter(MDP, false);
  });
  async function videoAvocat() {
    const v = (await depots().videos.obtenir("v-03"))!;
    await depots().videos.enregistrer({ ...v, id: "v-g-avocat", formatId: "avocat", versionChoisieId: undefined } as never);
    return "v-g-avocat";
  }

  it("la commande porte l'entrée bibliothèque ; `false` en base la retire", async () => {
    const id = await videoAvocat();
    const c = await fabrication.construireCommande(id);
    const entree = lireEntreeBibliotheque(c.entrees);
    expect(entree).not.toBeNull();
    const permises = AVOCAT.filter((cap) => entree!.profil.capacites[cap]?.permis === true);
    expect(permises).toEqual(AVOCAT);
    await ecrireParametre("bibliothequeVideo.avocat", false);
    expect(Object.keys((await fabrication.construireCommande(id)).entrees)).not.toContain("bibliothequeVideo");
  });

  it("prix estimé identique à celui du cas éteint (C1-U10)", async () => {
    const id = await videoAvocat();
    const video = (await depots().videos.obtenir(id))!;
    const script = (await depots().scripts.lister())[0]!;
    const allume = await fabrication.construireCommandeEstimation(video, script);
    await ecrireParametre("bibliothequeVideo.avocat", false);
    const eteint = await fabrication.construireCommandeEstimation(video, script);
    const { moteurDeCommande } = await import("@/moteurs");
    const prix = async (c: typeof allume) => (await moteurDeCommande(c).estimer(c)).lignes;
    expect(await prix(allume)).toEqual(await prix(eteint));
  });
});
