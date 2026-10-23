/**
 * Panne du 15/10 (studio 3c8db069) : le dépôt de l'écran `/image-video` était refusé (« Il manque le texte de la
 * vidéo. ») parce que le brouillon partait sans script alors que ce format écrit son texte APRÈS la lecture de l'image.
 * Les tests de l'écran passaient : `lancer` y était un double.
 *
 * Ici, AUCUN double du lancement : les VRAIS services `deposerImageVideo` → `lancerAvecAccord` → `lancerFabrication`,
 * puis le premier tour de la VRAIE boucle avec le VRAI moteur `montage-image-video` (format masqué, accord d'essai réel
 * de Will posé), jusqu'à l'arrêt « carte à valider », puis la vue de `/image-video/<id>`. Base en mémoire ; seuls les
 * fournisseurs payants (Claude, HeyGen, rendu, stockage) sont des doubles (`outilsSimules`) : rien n'est payé.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { carteFixe, monde, outilsSimules } from "./doubles-fabrication";

vi.setConfig({ testTimeout: 120_000 });
vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const { PREFIXE_DECISIONS } = await import("@/services/image-video");
const { deposerFichierSimule } = await import("@/services/fichiers");
const ecran = await import("@/services/image-video-ecran");
const { tourDeBoucle } = await import("@/services/boucle");
const { brancherServicesImageVideo, PHRASE_FORMAT_MASQUE } = await import("@/moteurs/montage-image-video");
const { RESEAUX_IV } = await import("@/domaine/image-video/plafonds");
const { ID_FORMAT_IMAGE_VIDEO } = await import("@/formats/image-video");

const MDP = "image-video-depot-studio";
const carte = carteFixe("C");

beforeAll(async () => {
  process.env.SESSION_SECRET = "t".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  // Fournisseurs payants en doubles, branchés APRÈS l'import de la boucle (qui branche les outils réels). Les décisions de
  // Will sont celles gardées par le studio, comme en production : le double seul n'en a pas. Avant le raccord de la boucle,
  // le premier chargement tardif de `image-video.ts` (par l'écran) écrasait ce double et fournissait ces décisions sans le dire.
  brancherServicesImageVideo({
    outils: async (commande) => {
      const gardees = async () => lireParametre<Record<string, unknown> | null>(`${PREFIXE_DECISIONS}${commande.videoId}`, null);
      return { ...outilsSimules(carte, monde()), decisions: { carte: async () => ((await gardees())?.carte ?? null) as never, script: async () => ((await gardees())?.script ?? null) as never } };
    },
  });
});

/** L'image du chatbot déposée par l'écran (dépôt simulé du studio, aucun octet envoyé). */
async function imageDeposee() {
  const f = await deposerFichierSimule({ nom: "chatbot-24h.png", mime: "image/png", taille: 400_000, typeEntite: "entree", entiteId: "image-video" });
  // Empreinte de l'image du jeu d'essai : l'écriture simulée retrouve sa fiche par elle.
  return depots().fichiers.modifier(f.id, { sha256: carte.image.empreinte });
}

const videosIV = () => depots().videos.lister((v) => v.formatId === ID_FORMAT_IMAGE_VIDEO);

describe("Image → vidéo · le dépôt du studio lance la fabrication (script écrit après la lecture)", () => {
  it("4 réseaux, accord = montant affiché : lancée, puis la boucle s'arrête sur la carte à valider", async () => {
    await ecrireParametre(ecran.PARAM_ACCORD_ESSAI_IV, true);
    const fichier = await imageDeposee();
    const etat = await ecran.etatDepotImageVideo();
    expect(etat.blocage).toBeUndefined();
    const montant = etat.montantCentimes;
    expect(montant).toBe(ecran.prixDuDepot(RESEAUX_IV, etat.tauxUsdEur));

    const issue = await ecran.deposerImageVideo({ fichierId: fichier.id, reseaux: [...RESEAUX_IV], largeur: carte.image.largeur, hauteur: carte.image.hauteur, accordCentimes: montant });
    expect(issue, JSON.stringify(issue)).toMatchObject({ statut: "lancee" });
    if (issue.statut !== "lancee") return;

    const travail = await depots().travaux.trouver((t) => t.cibleId === issue.videoId);
    expect(travail?.erreur).toBeUndefined();
    expect(travail?.statut).toMatch(/en_file|en_cours/);
    // La commande figée : le VRAI moteur, l'accord d'essai réel de Will, la durée du format (aucun texte encore écrit),
    // donc le prix réservé est celui affiché sur le bouton et confirmé.
    const video = (await depots().videos.obtenir(issue.videoId))!;
    const version = (await depots().versions.obtenir(travail!.versionId!))!;
    expect(version.commande.moteurId).toBe("montage-image-video");
    expect(version.commande.dureeCibleSec).toBe(50);
    expect(version.commande.entrees.imageVideo).toMatchObject({ imageCle: fichier.cleStockage, reseaux: [...RESEAUX_IV], accordEssaiReel: true });
    expect(version.commande.distribution[0]?.voixId).toBeTruthy();
    expect(video.coutEstime?.centimes).toBe(montant);
    expect(video.scriptId).toBeTruthy();

    // Premier tour de la vraie boucle (moteur réel, outils simulés) : jusqu'à l'arrêt « carte à valider ».
    for (let i = 0; i < 6; i++) {
      await tourDeBoucle();
      const t = await depots().travaux.obtenir(travail!.id);
      if (t?.statut === "echec") break;
    }
    const apres = await depots().travaux.obtenir(travail!.id);
    const vue = await ecran.vueImageVideo(issue.videoId);
    expect(vue, JSON.stringify(apres?.erreur)).not.toBeNull();
    expect(vue!.ecran, JSON.stringify(apres?.erreur)).toBe("carte");
    expect(vue!.fabrication.refus).toBeUndefined();
    expect(vue!.carte?.carte.noeuds.length).toBe(carte.noeuds.length);

    // « Valider la carte » (vrais services) puis la boucle : le script est écrit d'après la lecture, arrêt sur « Votre script ».
    expect(await ecran.validerCarteEtReprendre(issue.videoId, undefined)).toEqual({ statut: "reprise" });
    for (let i = 0; i < 6; i++) {
      await tourDeBoucle();
      if ((await ecran.vueImageVideo(issue.videoId))?.ecran === "script") break;
    }
    const vueScript = await ecran.vueImageVideo(issue.videoId);
    expect(vueScript?.ecran, JSON.stringify((await depots().travaux.obtenir(travail!.id))?.erreur)).toBe("script");
    expect(vueScript?.script?.fiche.ecrans.length).toBeGreaterThan(0);
  });

  it("deux réseaux cochés : le prix du lancement est celui du bouton, la vidéo part", async () => {
    await ecrireParametre(ecran.PARAM_ACCORD_ESSAI_IV, true);
    const fichier = await imageDeposee();
    const { tauxUsdEur } = await ecran.etatDepotImageVideo();
    const montant = ecran.prixDuDepot(["youtube-shorts", "linkedin"], tauxUsdEur);
    const issue = await ecran.deposerImageVideo({ fichierId: fichier.id, reseaux: ["linkedin", "youtube-shorts"], offre: "audit", largeur: carte.image.largeur, hauteur: carte.image.hauteur, accordCentimes: montant });
    expect(issue, JSON.stringify(issue)).toMatchObject({ statut: "lancee" });
    if (issue.statut !== "lancee") return;
    expect((await depots().videos.obtenir(issue.videoId))?.coutEstime?.centimes).toBe(montant);
  });

  it("lancement refusé (accord d'essai réel absent, format masqué) : la phrase, et aucun brouillon orphelin", async () => {
    await ecrireParametre(ecran.PARAM_ACCORD_ESSAI_IV, false);
    const fichier = await imageDeposee();
    const autre = (await depots().videos.lister())[0];
    const montant = (await ecran.etatDepotImageVideo()).montantCentimes;
    const issue = await ecran.deposerImageVideo({ fichierId: fichier.id, reseaux: [...RESEAUX_IV], largeur: carte.image.largeur, hauteur: carte.image.hauteur, accordCentimes: montant });
    expect(issue).toEqual({ statut: "refusee", phrase: PHRASE_FORMAT_MASQUE });
    // Rien n'est effacé (ordre permanent) : le brouillon de ce dépôt est archivé, aucun ne reste en brouillon.
    const videos = await videosIV();
    expect(videos.map((v) => v.statut)).toEqual(["archivee"]);
    expect(videos[0].statutAvantArchive).toBe("brouillon");
    expect(await ecran.dernieresImageVideo()).toEqual([]);
    expect(await depots().travaux.lister((t) => t.cibleId === videos[0].id)).toEqual([]);
    expect(await depots().versions.lister((v) => v.videoId === videos[0].id)).toEqual([]);
    // Les autres vidéos du studio ne sont pas touchées.
    if (autre) expect((await depots().videos.obtenir(autre.id))?.statut).toBe(autre.statut);
  });
});
