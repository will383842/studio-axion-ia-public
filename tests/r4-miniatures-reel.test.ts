/**
 * LOT R4 — miniatures réelles, chemin COMPLET du studio avec un vrai `studio-rendu` local (serveur HTTP et files du
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
const { estCleDemo } = await import("@/domaine/miniatures");

const MDP = "r4-miniatures-reel";

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
async function vraieVideo() {
  const d = depots();
  const v = (await d.videos.lister((x) => !!x.estDemo && x.statut === "prete" && !!x.versionChoisieId))[0];
  await d.videos.modifier(v.id, { estDemo: false, titre: "Amende : l'erreur que tout le monde fait" });
  for (const m of await d.miniatures.lister((x) => x.videoId === v.id)) await d.miniatures.modifier(m.id, { videoId: `${v.id}-ranges` });
  const sortie = (await d.sorties.lister((s) => s.versionId === v.versionChoisieId && s.ratio === v.ratios[0]))[0];
  await d.fichiers.modifier(sortie.fichierId, { cleStockage: `studio/dev/videos/${v.id}/finale.mp4` });
  const master = await d.fichiers.enregistrer({ id: "f-master-r4", cleStockage: `studio/dev/videos/${v.id}/master-sans-texte.mov`, nom: "master.mov", mime: "video/quicktime", taille: 1, origine: "fabrication", statut: "pret", creeLe: "2026-10-03T10:00:00.000Z", modifieLe: "2026-10-03T10:00:00.000Z" });
  await d.pistes.enregistrer({ id: "piste-master-r4", versionId: v.versionChoisieId!, type: "master-sans-texte", ratio: v.ratios[0], fichierId: master.id, fournisseur: "studio-rendu", creeLe: "2026-10-03T10:00:00.000Z", modifieLe: "2026-10-03T10:00:00.000Z" });
  return (await d.videos.obtenir(v.id))!;
}

describe("R4 · miniatures calculées par studio-rendu (chemin complet du studio)", () => {
  it("3 miniatures tirées de la vidéo SANS texte, titre écrit, la première choisie ; aucune image de démonstration", { timeout: 60_000 }, async () => {
    const v = await vraieVideo();
    await travaux.executerSuites([{ type: "finition", videoId: v.id, titre: v.titre, ratio: v.ratios[0] }]);
    expect(recues).toHaveLength(3);
    for (const d of recues) {
      expect(d.operation).toBe("miniature");
      // Lecture signée de la vidéo SANS texte (jamais la vidéo finale quand le master existe).
      expect(d.entrees.video).toContain("master-sans-texte.mov");
      expect(d.entrees.video).toMatch(/X-Amz-Signature=/);
      expect(d.sortie.cle).toMatch(new RegExp(`^studio/dev/videos/${v.id}/miniatures/miniature-\\d-[a-z0-9]+\\.jpg$`));
      expect(d.parametres.couverture).toBe("Amende : l'erreur");
      expect(d.parametres.motCle).toBe("erreur");
    }
    const minis = await depots().miniatures.lister((m) => m.videoId === v.id);
    expect(minis).toHaveLength(3);
    expect(minis.filter((m) => m.choisie)).toHaveLength(1);
    expect(minis.every((m) => m.incrustee && m.origine === "rendu" && m.titre === "Amende : l'erreur")).toBe(true);
    expect(minis.map((m) => m.variante)).toEqual([0, 1, 2]);
    expect(minis.map((m) => m.instantSec)).toEqual(recues.map((d) => Number(d.parametres.instantSec) + 0.2));
    for (const m of minis) expect(estCleDemo((await depots().fichiers.obtenir(m.fichierId))!.cleStockage)).toBe(false);
    expect((await depots().videos.obtenir(v.id))!.miniatureChoisieId).toBe(minis.find((m) => m.choisie)!.id);
  });

  it("couverture du générateur trop longue (non bornée par son schéma) → coupée à 5 mots sur l'image", { timeout: 60_000 }, async () => {
    const v = await vraieVideo();
    await depots().variantes.enregistrer({ id: "var-r4", couverture: { texte: "Votre employeur peut-il vraiment lire tous vos mails privés", motCle: "mails" }, publication: {} } as never);
    await depots().videos.modifier(v.id, { varianteId: "var-r4" });
    await travaux.executerSuites([{ type: "finition", videoId: v.id, titre: v.titre, ratio: v.ratios[0] }]);
    expect(recues.length).toBeGreaterThan(0);
    for (const d of recues) {
      const mots = String(d.parametres.couverture).split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m));
      expect(mots.length, String(d.parametres.couverture)).toBeLessThanOrEqual(5);
    }
  });

  it("titre de Will trop long : 5 mots au plus sur l'image, et le titre enregistré est EXACTEMENT celui de l'image", { timeout: 60_000 }, async () => {
    const v = await vraieVideo();
    await travaux.executerSuites([{ type: "finition", videoId: v.id, titre: v.titre, ratio: v.ratios[0] }]);
    const m = (await depots().miniatures.lister((x) => x.videoId === v.id))[0];
    recues.length = 0;
    await videos.choisirMiniature(v.id, m.id, "Un titre beaucoup trop long pour une miniature qui doit rester lisible sur un téléphone");
    expect(recues).toHaveLength(1);
    const ecrit = String(recues[0].parametres.couverture);
    expect(ecrit.split(/\s+/).filter((x) => /[\p{L}\p{N}]/u.test(x)).length, ecrit).toBeLessThanOrEqual(5);
    expect(ecrit.length).toBeLessThanOrEqual(60);
    expect((await depots().miniatures.obtenir(m.id))!.titre).toBe(ecrit);
  });

  it("un nouveau titre REFAIT l'image (même instant, même mise en page) ; l'ancienne image reste", { timeout: 60_000 }, async () => {
    const v = await vraieVideo();
    await travaux.executerSuites([{ type: "finition", videoId: v.id, titre: v.titre, ratio: v.ratios[0] }]);
    const seconde = (await depots().miniatures.lister((m) => m.videoId === v.id)).find((m) => m.variante === 1)!;
    recues.length = 0;
    await videos.choisirMiniature(v.id, seconde.id, "Votre PV de 135 €");
    expect(recues).toHaveLength(1);
    expect(recues[0].parametres).toMatchObject({ instantSec: seconde.instantSec, variante: 1, couverture: "Votre PV de 135 €", motCle: "135 €" });
    const apres = (await depots().miniatures.obtenir(seconde.id))!;
    expect(apres).toMatchObject({ choisie: true, titre: "Votre PV de 135 €" });
    expect(apres.fichierId).not.toBe(seconde.fichierId);
    expect(await depots().fichiers.obtenir(seconde.fichierId)).toBeTruthy();
    // Même titre : rien n'est refait.
    recues.length = 0;
    await videos.choisirMiniature(v.id, seconde.id, "Votre PV de 135 €");
    expect(recues).toHaveLength(0);
  });
});
