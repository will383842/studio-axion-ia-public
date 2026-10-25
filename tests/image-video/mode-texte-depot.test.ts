/**
 * MODE TEXTE (R6b) · le dépôt d'un texte par les VRAIS services (`deposerTexteImageVideo` → `lancerAvecAccord` → boucle
 * avec le VRAI moteur), concepteur SIMULÉ (`appelerConceptionEnSimulation`) : rien n'est payé, aucun fichier image n'existe.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { appelerConceptionEnSimulation } from "@/moteurs/montage-image-video/texte/simulation";
import { carteFixe, monde, outilsSimules } from "./doubles-fabrication";

vi.setConfig({ testTimeout: 120_000 });
vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const { PREFIXE_DECISIONS } = await import("@/services/image-video");
const ecran = await import("@/services/image-video-ecran");
const texte = await import("@/services/image-video-texte");
const { tourDeBoucle } = await import("@/services/boucle");
const { brancherServicesImageVideo } = await import("@/moteurs/montage-image-video");
const { RESEAUX_IV } = await import("@/domaine/image-video/plafonds");
const { ID_FORMAT_IMAGE_VIDEO } = await import("@/formats/image-video");

const MDP = "image-video-depot-texte";
const TEXTE = "Quand une facture client dépasse 30 jours, l'IA rédige une relance polie, l'envoie par e-mail et suit le paiement dans le tableur.";
const lectures: string[] = [];

beforeAll(async () => {
  process.env.SESSION_SECRET = "t".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  lectures.length = 0;
  await auth.seConnecter(MDP, false);
  brancherServicesImageVideo({
    outils: async (commande) => {
      const gardees = async () => lireParametre<Record<string, unknown> | null>(`${PREFIXE_DECISIONS}${commande.videoId}`, null);
      const base = outilsSimules(carteFixe("C"), monde());
      return {
        ...base,
        lireImageSource: async (cle) => {
          lectures.push(cle);
          return null;
        },
        lecture: { convertir: base.lecture.convertir, appeler: appelerConceptionEnSimulation() },
        decisions: { carte: async () => ((await gardees())?.carte ?? null) as never, script: async () => ((await gardees())?.script ?? null) as never },
      };
    },
  });
});

const videosIV = () => depots().videos.lister((v) => v.formatId === ID_FORMAT_IMAGE_VIDEO);

describe("Image → vidéo · mode texte · le dépôt", () => {
  it("refuse en phrases (vide, trop court, trop long) avant tout prix, brouillon ou dépense", async () => {
    await ecrireParametre(ecran.PARAM_ACCORD_ESSAI_IV, true);
    for (const t of ["", "   ", "Facture", "x".repeat(4001)]) {
      const issue = await texte.deposerTexteImageVideo({ texte: t, reseaux: [...RESEAUX_IV], accordCentimes: 100000 });
      expect(issue.statut, t).toBe("refusee");
      expect((issue as { phrase: string }).phrase).toMatch(/[a-zé]/);
    }
    expect(await videosIV()).toEqual([]);
  });

  it("sans accord du prix : le prix « au plus » est redemandé, rien n'est créé", async () => {
    await ecrireParametre(ecran.PARAM_ACCORD_ESSAI_IV, true);
    const issue = await texte.deposerTexteImageVideo({ texte: TEXTE, reseaux: [...RESEAUX_IV] });
    expect(issue).toMatchObject({ statut: "accord-requis", centimes: ecran.prixDuDepot(RESEAUX_IV, (await ecran.etatDepotImageVideo()).tauxUsdEur) });
    expect(await videosIV()).toEqual([]);
  });

  it("texte → carte à valider (conception simulée, aucun fichier lu)", async () => {
    await ecrireParametre(ecran.PARAM_ACCORD_ESSAI_IV, true);
    const montant = (await ecran.etatDepotImageVideo()).montantCentimes;
    const issue = await texte.deposerTexteImageVideo({ texte: TEXTE, reseaux: [...RESEAUX_IV], accordCentimes: montant });
    expect(issue, JSON.stringify(issue)).toMatchObject({ statut: "lancee" });
    if (issue.statut !== "lancee") return;
    const travail = await depots().travaux.trouver((t) => t.cibleId === issue.videoId);
    const version = (await depots().versions.obtenir(travail!.versionId!))!;
    expect(version.commande.entrees.imageVideo).toMatchObject({ texte: TEXTE, reseaux: [...RESEAUX_IV], accordEssaiReel: true, plafondCentimes: montant });
    expect((version.commande.entrees.imageVideo as { imageCle: string }).imageCle).toMatch(/^texte:[0-9a-f]{16}$/);
    expect((await depots().videos.obtenir(issue.videoId))?.coutEstime?.centimes).toBe(montant);

    for (let i = 0; i < 6; i++) {
      await tourDeBoucle();
      if ((await ecran.vueImageVideo(issue.videoId))?.ecran === "carte") break;
    }
    const vue = await ecran.vueImageVideo(issue.videoId);
    expect(vue?.ecran, JSON.stringify((await depots().travaux.obtenir(travail!.id))?.erreur)).toBe("carte");
    expect(vue!.fabrication.refus).toBeUndefined();
    expect(vue!.carte?.carte.image.cle.startsWith("texte:")).toBe(true);
    // Aucune lecture de fichier image : le stockage n'a jamais été sollicité pour cette vidéo.
    expect(lectures).toEqual([]);
  });
});
