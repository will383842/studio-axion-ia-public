/**
 * LOT 1 DES VIGNETTES — côté studio (17/10). Blocs : garde du texte (étape 2), branchement (étape 6).
 * Aucun appel réel : service de rendu simulé.
 */
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ambianceEtMises, famille, GABARITS_MINIATURE, interditsVignette, rangDeVideo } from "@/domaine/vignettes";
import { creerFournisseurMiniatureStudioRendu } from "@/fournisseurs/rendu/miniature";
import { creerServiceRenduSimule } from "@/fournisseurs/simulation/rendu";
import type { ServiceRendu, SourceMiniature } from "@/fournisseurs/types";
import type { DemandeRendu } from "../studio-rendu/src/contrat";
import { FilesRendu } from "../studio-rendu/src/files";
import { creerServeur } from "../studio-rendu/src/serveur";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

// Un studio-rendu local qui note les demandes « miniature » (aucun navigateur, aucun appel payant).
const recues: DemandeRendu[] = [];
const files = new FilesRendu({
  operations: {
    miniature: async (d) => {
      recues.push(d);
      return { mesures: { instant: Number(d.parametres.instantSec) } };
    },
  },
});
const serveur: Server = creerServeur(files);
await new Promise<void>((ok) => serveur.listen(0, "127.0.0.1", ok));
const ENV_AVANT = { ...process.env };
Object.assign(process.env, {
  STUDIO_RENDU_URL: `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`,
  FOURNISSEUR_MINIATURE: "studio-rendu",
  FOURNISSEUR_STOCKAGE: "r2",
  R2_ACCOUNT_ID: "compte-essai",
  R2_ACCESS_KEY_ID: "cle-essai",
  R2_SECRET_ACCESS_KEY: "secret-essai",
  R2_BUCKET: "studio-essai",
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const travaux = await import("@/services/travaux");
const { ecrireParametre } = await import("@/services/_commun");

afterAll(() => {
  serveur.close();
  for (const k of ["STUDIO_RENDU_URL", "FOURNISSEUR_MINIATURE", "FOURNISSEUR_STOCKAGE", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"]) {
    if (ENV_AVANT[k] === undefined) delete process.env[k];
    else process.env[k] = ENV_AVANT[k];
  }
});

describe("vignettes lot 1 · garde du texte de couverture", () => {
  it.each([
    "Villeexemple",
    "VILLEEXEMPLE",
    "Aucun gain garanti",
    "Certifexemple certifié",
    "certifié Certifexemple",
    "Certifexemple",
    "faites-le vous-même",
    "FAITES LE VOUS MEME",
    "faites‑le vous‑même",
    "faites-le vous-meme",
    "titre certifié",
  ])("refuse « %s »", (texte) => {
    expect(interditsVignette(texte).length).toBeGreaterThan(0);
  });

  // Relecture : une espace insécable, fine ou un caractère invisible ne doit pas faire passer un interdit (rendu identique).
  it.each(["Aucun gain\u00a0garanti", "AUCUN\u202fGAIN GARANTI", "Aucun gain\tgaranti", "GRE\u200bNOBLE", "Gre\u00adnoble"])("refuse aussi « %s » (espaces et invisibles)", (texte) => {
    expect(interditsVignette(texte).length).toBeGreaterThan(0);
  });

  it.each(["OÙ FUIT VOTRE TEMPS", "LICENCIÉ PAR SMS ?", "UN DEVIS EN 2 MINUTES"])("laisse passer « %s »", (texte) => {
    expect(interditsVignette(texte)).toEqual([]);
  });
});

describe("vignettes lot 1 · rotation des ambiances et familles", () => {
  it("gabarits : r4 d'abord (défaut), puis axion-v2", () => expect([...GABARITS_MINIATURE]).toEqual(["r4", "axion-v2"]));

  it("ambiance : alternance encre / ivoire d'une vidéo à l'autre ; trio m1, m2, m3", () => {
    expect(ambianceEtMises(4).ambiance).not.toBe(ambianceEtMises(5).ambiance);
    expect(ambianceEtMises(4).ambiance).toBe(ambianceEtMises(6).ambiance);
    expect(ambianceEtMises(0).mises).toEqual(["m1", "m2", "m3"]);
    expect(ambianceEtMises(Number.NaN).ambiance).toBe("encre");
    expect(ambianceEtMises(-3).ambiance).toBe(ambianceEtMises(3).ambiance);
  });

  it("rang d'une vidéo : le numéro de son code interne, sinon son épisode, sinon 0", () => {
    expect(rangDeVideo({ titre: "0005-FC-TT-L · sujet — v5" })).toBe(5);
    expect(rangDeVideo({ titre: "Sans code", episodeSerie: 7 })).toBe(7);
    expect(rangDeVideo({ titre: "Sans code" })).toBe(0);
  });

  it("famille : visage pour 8 générateurs, sans visage pour 4", () => {
    for (const id of ["avocat", "facecam", "facecam-animee", "selfie", "createur-b", "podcast", "ecran-partage", "ugc"]) expect(famille(id).visage, id).toBe(true);
    for (const id of ["tableau-anime", "cas-concret", "image-video", "motion"]) expect(famille(id).visage, id).toBe(false);
  });
});

describe("vignettes lot 1 · fournisseur (service de rendu simulé)", () => {
  const source = (extra: Partial<SourceMiniature> = {}): SourceMiniature => ({
    url: "https://exemple/v.mp4", dureeSec: 40, ratio: "16:9", instantsSec: [12, 20, 31],
    depots: [0, 1, 2].map((i) => ({ cle: `studio/dev/videos/v-1/miniatures/m-${i}.jpg`, urlDepot: `https://exemple/depot/${i}` })), ...extra,
  });
  function espion() {
    let t = 0;
    const service = creerServiceRenduSimule(() => t);
    const vus: DemandeRendu[] = [];
    const rendu: ServiceRendu = { soumettre: (d) => (vus.push(d), service.soumettre(d)), etat: service.etat };
    return { vus, f: creerFournisseurMiniatureStudioRendu({ rendu: () => rendu, attendre: async () => void (t += 1_000), maintenant: () => t }) };
  }

  it("sans gabarit : aucune clé de vignette dans les demandes (rien ne change)", async () => {
    const { f, vus } = espion();
    await f.proposer({ videoId: "v-1", titre: "T", nombre: 3, source: source(), couverture: { texte: "Où fuit votre temps", motCle: "temps" } });
    expect(vus).toHaveLength(3);
    for (const d of vus) for (const k of ["gabarit", "ambiance", "mise", "generateur"]) expect(d.parametres, k).not.toHaveProperty(k);
  });

  it("axion-v2 : 3 demandes m1, m2, m3, même ambiance, générateur = formatId", async () => {
    const { f, vus } = espion();
    const r = await f.proposer({ videoId: "v-1", titre: "T", nombre: 3, source: source({ gabarit: "axion-v2", formatId: "facecam", rangVideo: 4 }), couverture: { texte: "Où fuit votre temps", motCle: "temps" } });
    expect(vus.map((d) => d.parametres.mise)).toEqual(["m1", "m2", "m3"]);
    expect(new Set(vus.map((d) => d.parametres.ambiance)).size).toBe(1);
    for (const d of vus) expect(d.parametres).toMatchObject({ gabarit: "axion-v2", generateur: "facecam", couverture: "Où fuit votre temps" });
    expect(r.map((x) => x.mise)).toEqual(["m1", "m2", "m3"]);
    expect(r.every((x) => x.ambiance === vus[0].parametres.ambiance)).toBe(true);
  });

  it("axion-v2 : deux vidéos de rang voisin → ambiances différentes", async () => {
    const a = espion();
    const b = espion();
    const c = { texte: "Où fuit votre temps", motCle: "temps" };
    await a.f.proposer({ videoId: "v-1", titre: "T", nombre: 1, source: source({ gabarit: "axion-v2", formatId: "facecam", rangVideo: 4 }), couverture: c });
    await b.f.proposer({ videoId: "v-2", titre: "T", nombre: 1, source: source({ gabarit: "axion-v2", formatId: "facecam", rangVideo: 5 }), couverture: c });
    expect(a.vus[0].parametres.ambiance).not.toBe(b.vus[0].parametres.ambiance);
  });

  it("axion-v2 : titre avec « Villeexemple » → aucune demande, aucune proposition, journal sans le titre", async () => {
    const { f, vus } = espion();
    const journal: string[] = [];
    const avant = console.warn;
    console.warn = (...a: unknown[]) => void journal.push(a.join(" "));
    try {
      const r = await f.proposer({ videoId: "v-1", titre: "T", nombre: 3, source: source({ gabarit: "axion-v2", formatId: "facecam", rangVideo: 1 }), couverture: { texte: "Formez-vous à Villeexemple", motCle: "Villeexemple" } });
      expect(r).toEqual([]);
    } finally {
      console.warn = avant;
    }
    expect(vus).toHaveLength(0);
    expect(journal.length).toBeGreaterThan(0);
    expect(journal.join("\n")).not.toMatch(/villeexemple|formez/i);
  });
});

describe("vignettes lot 1 · chemin complet du studio derrière le réglage", () => {
  const MDP = "vignettes-lot1-studio";
  beforeAll(async () => {
    await preparerMotDePasse(MDP);
  });
  beforeEach(async () => {
    reinitialiserDepots();
    reinitialiserRequete();
    recues.length = 0;
    await auth.seConnecter(MDP, false);
  });

  /** Une vidéo prête devenue « vraie » (même préparation que `r4-miniatures-reel`). */
  async function vraieVideo(episode?: number) {
    const d = depots();
    const v = (await d.videos.lister((x) => !!x.estDemo && x.statut === "prete" && !!x.versionChoisieId))[0];
    await d.videos.modifier(v.id, { estDemo: false, titre: "Amende : l'erreur que tout le monde fait", ...(episode !== undefined ? { episodeSerie: episode } : {}) });
    for (const m of await d.miniatures.lister((x) => x.videoId === v.id)) await d.miniatures.modifier(m.id, { videoId: `${v.id}-ranges` });
    const sortie = (await d.sorties.lister((s) => s.versionId === v.versionChoisieId && s.ratio === v.ratios[0]))[0];
    await d.fichiers.modifier(sortie.fichierId, { cleStockage: `studio/dev/videos/${v.id}/finale.mp4` });
    return (await d.videos.obtenir(v.id))!;
  }

  it("réglage absent : demandes sans « gabarit » (aucun changement)", { timeout: 60_000 }, async () => {
    const v = await vraieVideo();
    await travaux.executerSuites([{ type: "finition", videoId: v.id, titre: v.titre, ratio: v.ratios[0] }]);
    expect(recues).toHaveLength(3);
    for (const d of recues) expect(d.parametres).not.toHaveProperty("gabarit");
  });

  it("réglage « axion-v2 » posé dans le test seulement : 3 demandes m1, m2, m3, générateur = formatId de la vidéo", { timeout: 60_000 }, async () => {
    await ecrireParametre("miniature.gabarit", "axion-v2");
    const v = await vraieVideo(4);
    await travaux.executerSuites([{ type: "finition", videoId: v.id, titre: v.titre, ratio: v.ratios[0] }]);
    expect(recues).toHaveLength(3);
    expect(recues.map((d) => d.parametres.mise).sort()).toEqual(["m1", "m2", "m3"]);
    for (const d of recues) expect(d.parametres).toMatchObject({ gabarit: "axion-v2", generateur: v.formatId });
    expect(new Set(recues.map((d) => d.parametres.ambiance)).size).toBe(1);
  });

  it("réglage invalide : retombe sur r4", { timeout: 60_000 }, async () => {
    await ecrireParametre("miniature.gabarit", "inconnu");
    const v = await vraieVideo();
    await travaux.executerSuites([{ type: "finition", videoId: v.id, titre: v.titre, ratio: v.ratios[0] }]);
    for (const d of recues) expect(d.parametres).not.toHaveProperty("gabarit");
  });
});
