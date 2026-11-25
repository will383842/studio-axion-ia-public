/**
 * FIX-ROUGES-ETEINTS-RENDU-v21r — une vidéo d'ESSAI (toutes ses sorties sont des clés de démonstration) ne fait aucune demande
 * de vignette au serveur de rendu en finition automatique ; les vraies vidéos et « Refaire les vignettes » sont inchangés.
 * Même montage que tests/vignettes-service.test.ts : chemin COMPLET du studio avec un vrai `studio-rendu` local (serveur HTTP et files du
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

const MDP = "miniatures-essai-sans-rendu";

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

/** Une vidéo prête NON démo, sans miniature ; `reelle` : sa sortie pointe un fichier de NOTRE stockage ; sinon elle garde la clé de démonstration. */
async function videoPrete(reelle: boolean) {
  const d = depots();
  const v = (await d.videos.lister((x) => !!x.estDemo && x.statut === "prete" && !!x.versionChoisieId))[0];
  await d.videos.modifier(v.id, { estDemo: false, titre: "Amende : l'erreur que tout le monde fait" });
  for (const m of await d.miniatures.lister((x) => x.videoId === v.id)) await d.miniatures.modifier(m.id, { videoId: `${v.id}-ranges` });
  const sorties = await d.sorties.lister((s) => s.versionId === v.versionChoisieId);
  for (const s of sorties) {
    if (reelle && s.ratio === v.ratios[0]) await d.fichiers.modifier(s.fichierId, { cleStockage: `studio/dev/videos/${v.id}/finale.mp4` });
    else if (!reelle) await d.fichiers.modifier(s.fichierId, { cleStockage: `demo/finale-${s.id}.mp4` });
  }
  return (await d.videos.obtenir(v.id))!;
}

const fabriquer = async (v: { id: string; titre: string; ratios: string[] }) => travaux.executerSuites([{ type: "finition", videoId: v.id, titre: v.titre, ratio: v.ratios[0] as never }]);
const nbMiniatures = async (id: string) => (await depots().miniatures.lister((m) => m.videoId === id)).length;

describe("miniatures · vidéo d'essai sans demande au serveur de rendu", () => {
  it("(a) toutes les sorties sont des clés de démonstration : 0 demande au serveur, 0 miniature", { timeout: 60_000 }, async () => {
    const v = await videoPrete(false);
    await fabriquer(v);
    expect(recues).toHaveLength(0);
    expect(await nbMiniatures(v.id)).toBe(0);
  });

  it("(b) 2e appel sur la même vidéo : toujours 0 demande, 0 miniature", { timeout: 60_000 }, async () => {
    const v = await videoPrete(false);
    await fabriquer(v);
    await fabriquer(v);
    expect(recues).toHaveLength(0);
    expect(await nbMiniatures(v.id)).toBe(0);
  });

  it("(c) vraie vidéo (sortie dans notre stockage) : 1 demande au serveur et une miniature créée", { timeout: 60_000 }, async () => {
    const v = await videoPrete(true);
    await fabriquer(v);
    expect(recues).toHaveLength(1);
    expect(await nbMiniatures(v.id)).toBeGreaterThan(0);
  });

  it("(d) vraie vidéo sans piste lisible, gabarit axion-v2 : la demande part avec fondPropre", { timeout: 60_000 }, async () => {
    await (await import("@/services/_commun")).ecrireParametre("miniature.gabarit", "axion-v2");
    const v = await videoPrete(true);
    await fabriquer(v);
    expect(recues.length).toBeGreaterThan(0);
    for (const r of recues) expect(r.parametres.fondPropre).toBe(true);
  });

  it("(e) « Refaire les vignettes » sur une sortie de démonstration : la demande part avec fondPropre (geste de Williams)", { timeout: 60_000 }, async () => {
    const v = await videoPrete(false);
    const { refaireVignettes } = await import("@/services/miniatures");
    await refaireVignettes(v.id);
    expect(recues.length).toBeGreaterThan(0);
    expect(recues[0].parametres.fondPropre).toBe(true);
    expect(recues[0].entrees.video).toBeUndefined();
  });

  it("(f) aucune sortie : pas d'« essai » déduit d'une liste vide, la demande part comme avant", { timeout: 60_000 }, async () => {
    const v = await videoPrete(false);
    for (const s of await depots().sorties.lister((x) => x.versionId === v.versionChoisieId)) await depots().sorties.supprimer(s.id);
    await fabriquer(v);
    expect(recues.length).toBeGreaterThan(0);
  });

  it("(g) une sortie réelle parmi des sorties de démonstration : ce n'est pas un essai, la demande part", { timeout: 60_000 }, async () => {
    const v = await videoPrete(true);
    const d = depots();
    const sortie = (await d.sorties.lister((x) => x.versionId === v.versionChoisieId))[0];
    const fichier = (await d.fichiers.obtenir(sortie.fichierId))!;
    const demo = await d.fichiers.enregistrer({ ...fichier, id: "f-sortie-demo-g", cleStockage: "demo/autre.mp4" });
    await d.sorties.enregistrer({ ...sortie, id: "sortie-demo-g", fichierId: demo.id });
    await fabriquer(v);
    expect(recues).toHaveLength(1);
  });
});
