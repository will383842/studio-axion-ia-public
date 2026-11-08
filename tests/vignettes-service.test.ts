/**
 * VIGNETTES (lot « vignettes ») — chemin COMPLET du studio avec un vrai `studio-rendu` local (serveur HTTP et files du
 * conteneur ; l'opération `miniature` y est remplacée par une opération d'essai qui note les demandes) :
 * outil choisi par `FOURNISSEUR_MINIATURE=studio-rendu`, stockage R2 (adresses signées localement, aucun envoi).
 * Aucune clé réelle, aucun appel payant.
 */
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import type { DemandeRendu } from "../studio-rendu/src/contrat";
import { FilesRendu } from "../studio-rendu/src/files";
import { creerServeur } from "../studio-rendu/src/serveur";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

// Un studio-rendu local : les demandes « miniature » sont notées et réussissent (instant retenu + 0,2 s).
const recues: DemandeRendu[] = [];
const files = new FilesRendu({
  operations: {
    miniature: async (d) => {
      recues.push(d);
      return { mesures: { instant: Number(d.parametres.instantSec) + 0.2 } };
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
const videos = await import("@/services/videos");

const MDP = "vignettes-service";

afterAll(() => {
  serveur.close();
  for (const k of ["STUDIO_RENDU_URL", "FOURNISSEUR_MINIATURE", "FOURNISSEUR_STOCKAGE", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"]) {
    if (ENV_AVANT[k] === undefined) delete process.env[k];
    else process.env[k] = ENV_AVANT[k];
  }
});

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  recues.length = 0;
  await auth.seConnecter(MDP, false);
});

/** Une vidéo prête devenue « vraie » : fichiers dans notre stockage, vidéo sans texte, aucune miniature. */
async function vraieVideo(avecMaster = true) {
  const d = depots();
  const v = (await d.videos.lister((x) => !!x.estDemo && x.statut === "prete" && !!x.versionChoisieId))[0];
  await d.videos.modifier(v.id, { estDemo: false, titre: "Amende : l'erreur que tout le monde fait" });
  for (const m of await d.miniatures.lister((x) => x.videoId === v.id)) await d.miniatures.modifier(m.id, { videoId: `${v.id}-ranges` });
  const sortie = (await d.sorties.lister((s) => s.versionId === v.versionChoisieId && s.ratio === v.ratios[0]))[0];
  await d.fichiers.modifier(sortie.fichierId, { cleStockage: `studio/dev/videos/${v.id}/finale.mp4` });
  if (!avecMaster) return (await d.videos.obtenir(v.id))!;
  const master = await d.fichiers.enregistrer({ id: "f-master-r4", cleStockage: `studio/dev/videos/${v.id}/master-sans-texte.mov`, nom: "master.mov", mime: "video/quicktime", taille: 1, origine: "fabrication", statut: "pret", creeLe: "2026-10-03T10:00:00.000Z", modifieLe: "2026-10-03T10:00:00.000Z" });
  await d.pistes.enregistrer({ id: "piste-master-r4", versionId: v.versionChoisieId!, type: "master-sans-texte", ratio: v.ratios[0], fichierId: master.id, fournisseur: "studio-rendu", creeLe: "2026-10-03T10:00:00.000Z", modifieLe: "2026-10-03T10:00:00.000Z" });
  return (await d.videos.obtenir(v.id))!;
}


const fabriquer = async (v: { id: string; titre: string; ratios: string[] }) => travaux.executerSuites([{ type: "finition", videoId: v.id, titre: v.titre, ratio: v.ratios[0] as never }]);

describe("vignettes · service", () => {
  it("gabarit Axion par défaut (réglage absent)", { timeout: 60_000 }, async () => {
    const v = await vraieVideo();
    await fabriquer(v);
    expect(recues.length).toBe(3);
    for (const d of recues) expect(d.parametres.gabarit).toBe("axion-v2");
  });

  it("sans piste master-sans-texte : jamais la vidéo finale, fond propre de la charte (aucune lecture)", { timeout: 60_000 }, async () => {
    const v = await vraieVideo(false);
    await fabriquer(v);
    expect(recues.length).toBe(3);
    for (const d of recues) {
      expect(d.parametres.fondPropre).toBe(true);
      expect(d.entrees.video).toBeUndefined();
    }
  });

  it("le titre fixé par Williams est celui de l'image ; il n'est jamais remplacé", { timeout: 60_000 }, async () => {
    const v = await vraieVideo();
    await depots().videos.modifier(v.id, { couvertureVignette: { texte: "Vos devis sans réponse", motCle: "devis", fixee: true } });
    await fabriquer(v);
    for (const d of recues) expect(d.parametres).toMatchObject({ couverture: "Vos devis sans réponse", motCle: "devis" });
    expect((await depots().videos.obtenir(v.id))!.couvertureVignette).toMatchObject({ texte: "Vos devis sans réponse", fixee: true });
  });

  it("à la création, un titre est PROPOSÉ depuis l'accroche du script et gardé (non fixé)", { timeout: 60_000 }, async () => {
    const v = await vraieVideo();
    await depots().scripts.enregistrer({ id: "scr-vign", formatId: v.formatId, blocs: [{ id: "b1", blocRecette: "accroche", segments: [{ id: "s1", texte: "Votre amende de 135 € n'est pas définitive, contestez-la dans les 45 jours." }] }] } as never);
    await depots().videos.modifier(v.id, { scriptId: "scr-vign" });
    await fabriquer(v);
    const c = (await depots().videos.obtenir(v.id))!.couvertureVignette!;
    expect(c.fixee).toBe(false);
    expect(c.texte.split(/\s+/).length).toBeLessThanOrEqual(5);
    expect(c.texte).toContain("135");
    for (const d of recues) expect(d.parametres.couverture).toBe(c.texte);
  });

  it("fixer le titre et le mot refait l'image choisie (l'ancienne reste)", { timeout: 60_000 }, async () => {
    const v = await vraieVideo();
    await fabriquer(v);
    const avant = (await depots().miniatures.lister((m) => m.videoId === v.id)).find((m) => m.choisie)!;
    recues.length = 0;
    await videos.fixerCouvertureVignette(v.id, "Vos devis sans réponse", "devis");
    expect(recues).toHaveLength(1);
    expect(recues[0].parametres).toMatchObject({ couverture: "Vos devis sans réponse", motCle: "devis" });
    const apres = (await depots().miniatures.obtenir(avant.id))!;
    expect(apres.fichierId).not.toBe(avant.fichierId);
    expect(await depots().fichiers.obtenir(avant.fichierId)).toBeTruthy();
    expect((await depots().videos.obtenir(v.id))!.couvertureVignette).toEqual({ texte: "Vos devis sans réponse", motCle: "devis", fixee: true });
  });

  it("un titre de 2 mots est refusé", async () => {
    const v = await vraieVideo();
    await expect(videos.fixerCouvertureVignette(v.id, "Devis", "")).rejects.toThrow(/3 mots/);
  });

  it("« Refaire les vignettes » ajoute de nouvelles miniatures, n'efface rien, choisit la nouvelle", { timeout: 60_000 }, async () => {
    const v = await vraieVideo();
    await fabriquer(v);
    const avant = await depots().miniatures.lister((m) => m.videoId === v.id);
    recues.length = 0;
    const { refaireVignettes } = await import("@/services/miniatures");
    const n = await refaireVignettes(v.id);
    expect(n).toBe(3);
    const apres = await depots().miniatures.lister((m) => m.videoId === v.id);
    expect(apres).toHaveLength(6);
    for (const a of avant) expect(apres.find((x) => x.id === a.id)!.fichierId).toBe(a.fichierId);
    const choisies = apres.filter((m) => m.choisie);
    expect(choisies).toHaveLength(1);
    expect(avant.map((a) => a.id)).not.toContain(choisies[0].id);
    expect((await depots().videos.obtenir(v.id))!.miniatureChoisieId).toBe(choisies[0].id);
  });

  it("par lot : les vidéos réelles sans vignette Axion sont refaites ; une vidéo déjà à jour est sautée", { timeout: 60_000 }, async () => {
    const v = await vraieVideo();
    await fabriquer(v);
    // État d'avant : les miniatures existantes ne portent pas encore le gabarit Axion.
    for (const m of await depots().miniatures.lister((x) => x.videoId === v.id)) await depots().miniatures.modifier(m.id, { gabarit: undefined });
    const { refaireToutesLesVignettes } = await import("@/services/miniatures");
    recues.length = 0;
    const r1 = await refaireToutesLesVignettes();
    expect(r1.videos).toBe(1);
    expect(r1.erreurs).toBe(0);
    recues.length = 0;
    const r2 = await refaireToutesLesVignettes();
    expect(r2.videos).toBe(0);
    expect(recues).toHaveLength(0);
  });
});
