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
  it("par défaut : UNE image tirée de la vidéo FINALE, sans titre ni mot-clé (gabarit image-video-v3)", { timeout: 60_000 }, async () => {
    const v = await vraieVideo();
    await fabriquer(v);
    expect(recues.length).toBe(1);
    expect(recues[0].parametres).toMatchObject({ gabarit: "image-video-v3", couverture: "", motCle: "" });
    expect(recues[0].parametres.fondPropre).toBeUndefined();
    expect(recues[0].entrees.video).toContain("finale.mp4");
    const m = (await depots().miniatures.lister((x) => x.videoId === v.id))[0];
    expect(m).toMatchObject({ gabarit: "image-video-v3b", choisie: true });
    expect(m.incrustee).toBeFalsy();
    expect(m.titre).toBe("");
  });

  it("la vidéo finale sert même sans piste master-sans-texte ; sans fichier de sortie réel : carte de la charte", { timeout: 60_000 }, async () => {
    const v = await vraieVideo(false);
    await fabriquer(v);
    expect(recues.length).toBe(1);
    expect(recues[0].entrees.video).toContain("finale.mp4");
    const d = depots();
    const sortie = (await d.sorties.lister((s) => s.versionId === v.versionChoisieId))[0];
    await d.fichiers.modifier(sortie.fichierId, { cleStockage: "demo/finale.mp4" });
    recues.length = 0;
    const { refaireVignettes } = await import("@/services/miniatures");
    await refaireVignettes(v.id);
    expect(recues[0].parametres.fondPropre).toBe(true);
    expect(recues[0].entrees.video).toBeUndefined();
  });

  it("le titre fixé par Williams est celui de l'image ; il n'est jamais remplacé", { timeout: 60_000 }, async () => {
    const v = await vraieVideo();
    await depots().videos.modifier(v.id, { couvertureVignette: { texte: "Vos devis sans réponse", motCle: "devis", fixee: true } });
    await fabriquer(v);
    expect(recues).toHaveLength(1);
    for (const d of recues) expect(d.parametres).toMatchObject({ couverture: "Vos devis sans réponse", motCle: "devis" });
    expect((await depots().videos.obtenir(v.id))!.couvertureVignette).toMatchObject({ texte: "Vos devis sans réponse", fixee: true });
  });

  it("GV-N9 · titre sur la fiche : une panne de lecture du gabarit au moment du titre centré ne fait pas échouer la couverture, et titreCentre est absent", { timeout: 60_000 }, async () => {
    const v = await vraieVideo();
    await depots().videos.modifier(v.id, { couvertureVignette: { texte: "Vos devis sans réponse", motCle: "devis", fixee: true } });
    const d = depots();
    const obtenir = d.parametres.obtenir.bind(d.parametres);
    // Seule la PREMIÈRE lecture du gabarit tombe en panne : c'est celle de titreCentreImageVideo (appelée avant preparerSource,
    // qui relit le gabarit sans protection, miniatures.ts, preparerSource). Les lectures suivantes réussissent.
    let lecturesGabarit = 0;
    const espion = vi.spyOn(d.parametres, "obtenir").mockImplementation(async (id: string) => {
      if (id === "miniature.gabarit" && lecturesGabarit++ === 0) throw new Error("panne de lecture du gabarit");
      return obtenir(id);
    });
    try {
      await fabriquer(v);
    } finally {
      espion.mockRestore();
    }
    expect(lecturesGabarit).toBeGreaterThanOrEqual(2);
    expect(recues).toHaveLength(1);
    expect(recues[0].parametres).toMatchObject({ couverture: "Vos devis sans réponse", motCle: "devis" });
    expect(recues[0].parametres).not.toHaveProperty("titreCentre");
  });

  it("GV-N1 · réglage éteint : un titre saisi à la main est centré comme le titre automatique", { timeout: 60_000 }, async () => {
    const v = await vraieVideo();
    await depots().videos.modifier(v.id, { couvertureVignette: { texte: "Vos devis sans réponse", motCle: "devis", fixee: true } });
    await fabriquer(v);
    expect(recues).toHaveLength(1);
    expect(recues[0].parametres.titreCentre).toBe(true);
  });

  it("GV-N1 · gabarit r4 forcé : un titre sur la fiche n'a pas de clé titreCentre", { timeout: 60_000 }, async () => {
    const { GABARITS_MINIATURE } = await import("@/domaine/vignettes");
    await (await import("@/services/_commun")).ecrireParametre("miniature.gabarit", GABARITS_MINIATURE[0]);
    const v = await vraieVideo();
    await depots().videos.modifier(v.id, { couvertureVignette: { texte: "Vos devis sans réponse", motCle: "devis", fixee: true } });
    await fabriquer(v);
    expect(recues.length).toBeGreaterThan(0);
    for (const r of recues) expect(r.parametres).not.toHaveProperty("titreCentre");
  });

  it("à la création, AUCUN titre n'est proposé ni écrit, même avec un script (champs vides par défaut)", { timeout: 60_000 }, async () => {
    const v = await vraieVideo();
    await depots().scripts.enregistrer({ id: "scr-vign", formatId: v.formatId, blocs: [{ id: "b1", blocRecette: "accroche", segments: [{ id: "s1", texte: "Votre amende de 135 € n'est pas définitive, contestez-la dans les 45 jours." }] }] } as never);
    await depots().videos.modifier(v.id, { scriptId: "scr-vign" });
    await fabriquer(v);
    expect((await depots().videos.obtenir(v.id))!.couvertureVignette).toBeUndefined();
    for (const d of recues) expect(d.parametres.couverture).toBe("");
  });

  describe("réglage couverture.titreParDefaut (GV-VG-04)", () => {
    const accroche = async (v: { id: string; formatId: string }, texte: string) => {
      await depots().scripts.enregistrer({ id: "scr-vign", formatId: v.formatId, blocs: [{ id: "b1", blocRecette: "accroche", segments: [{ id: "s1", texte }] }] } as never);
      await depots().videos.modifier(v.id, { scriptId: "scr-vign" });
    };
    const allumer = async () => (await import("@/services/_commun")).ecrireParametre("couverture.titreParDefaut", true);

    it("éteint (ou faux) : couverture vide comme avant", { timeout: 60_000 }, async () => {
      const v = await vraieVideo();
      await accroche(v, "Votre amende de 135 € n'est pas définitive, contestez-la dans les 45 jours.");
      await (await import("@/services/_commun")).ecrireParametre("couverture.titreParDefaut", false);
      await fabriquer(v);
      expect(recues[0].parametres).toMatchObject({ couverture: "", motCle: "" });
      expect((await depots().videos.obtenir(v.id))!.couvertureVignette).toBeUndefined();
    });

    it("allumé : un titre de 3 à 5 mots tiré de l'accroche, gardé sur la fiche", { timeout: 60_000 }, async () => {
      const v = await vraieVideo();
      await accroche(v, "Votre amende n'est pas définitive, contestez-la vite.");
      await allumer();
      await fabriquer(v);
      const titre = String(recues[0].parametres.couverture);
      const mots = titre.split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m));
      expect(mots.length).toBeGreaterThanOrEqual(3);
      expect(mots.length).toBeLessThanOrEqual(5);
      expect((await depots().videos.obtenir(v.id))!.couvertureVignette).toMatchObject({ texte: titre, fixee: false });
    });

    it("GV-VG-04c · éteint : aucune clé titreCentre en plus", { timeout: 60_000 }, async () => {
      const v = await vraieVideo();
      await accroche(v, "Votre amende n'est pas définitive, contestez-la vite.");
      await (await import("@/services/_commun")).ecrireParametre("couverture.titreParDefaut", false);
      await fabriquer(v);
      expect(recues[0].parametres).not.toHaveProperty("titreCentre");
    });

    it("GV-VG-04c · allumé : titreCentre: true est envoyé, y compris quand le titre est déjà sur la fiche", { timeout: 60_000 }, async () => {
      const v = await vraieVideo();
      await accroche(v, "Votre amende n'est pas définitive, contestez-la vite.");
      await allumer();
      await fabriquer(v);
      expect(recues[0].parametres.titreCentre).toBe(true);
      recues.length = 0;
      const { refaireVignettes } = await import("@/services/miniatures");
      await refaireVignettes(v.id);
      expect(recues[0].parametres.titreCentre).toBe(true);
    });

    it("allumé, accroche avec un mot interdit : pas de titre", { timeout: 60_000 }, async () => {
      const v = await vraieVideo();
      await accroche(v, "Faites-le vous-même sans attendre");
      await allumer();
      await fabriquer(v);
      expect(recues[0].parametres).toMatchObject({ couverture: "", motCle: "" });
      expect((await depots().videos.obtenir(v.id))!.couvertureVignette).toBeUndefined();
    });
  });

  it("saisir un titre pose le titre sur une NOUVELLE image (l'ancienne reste) ; le vider revient à l'image seule", { timeout: 60_000 }, async () => {
    const v = await vraieVideo();
    await fabriquer(v);
    const avant = (await depots().miniatures.lister((m) => m.videoId === v.id)).find((m) => m.choisie)!;
    recues.length = 0;
    await videos.fixerCouvertureVignette(v.id, "Vos devis sans réponse", "devis");
    expect(recues).toHaveLength(1);
    expect(recues[0].parametres).toMatchObject({ couverture: "Vos devis sans réponse", motCle: "devis" });
    const apres = (await depots().miniatures.lister((m) => m.videoId === v.id)).find((m) => m.choisie)!;
    expect(apres.id).not.toBe(avant.id);
    expect(await depots().fichiers.obtenir(avant.fichierId)).toBeTruthy();
    expect((await depots().videos.obtenir(v.id))!.couvertureVignette).toEqual({ texte: "Vos devis sans réponse", motCle: "devis", fixee: true });
    recues.length = 0;
    await videos.fixerCouvertureVignette(v.id, "", "");
    expect(recues).toHaveLength(1);
    expect(recues[0].parametres).toMatchObject({ couverture: "", motCle: "" });
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
    expect(n).toBe(1);
    const apres = await depots().miniatures.lister((m) => m.videoId === v.id);
    expect(apres).toHaveLength(2);
    for (const a of avant) expect(apres.find((x) => x.id === a.id)!.fichierId).toBe(a.fichierId);
    const choisies = apres.filter((m) => m.choisie);
    expect(choisies).toHaveLength(1);
    expect(avant.map((a) => a.id)).not.toContain(choisies[0].id);
    expect((await depots().videos.obtenir(v.id))!.miniatureChoisieId).toBe(choisies[0].id);
  });

  it("par lot : les vidéos réelles sans vignette Axion sont refaites ; une vidéo déjà à jour est sautée", { timeout: 60_000 }, async () => {
    const v = await vraieVideo();
    await fabriquer(v);
    // État d'avant : les miniatures existantes sont des cartes-titre (gabarit Axion v2, lot #261).
    for (const m of await depots().miniatures.lister((x) => x.videoId === v.id)) await depots().miniatures.modifier(m.id, { gabarit: "axion-v2" });
    const { refaireToutesLesVignettes } = await import("@/services/miniatures");
    recues.length = 0;
    const r1 = await refaireToutesLesVignettes();
    expect(r1.videos).toBe(1);
    expect(r1.erreurs).toBe(0);
    recues.length = 0;
    const r2 = await refaireToutesLesVignettes();
    expect(r2.videos).toBe(0);
    expect(r2.restantes).toBe(0);
    expect(recues).toHaveLength(0);
    // Rien n'est effacé : les cartes-titre restent.
    expect((await depots().miniatures.lister((x) => x.videoId === v.id && x.gabarit === "axion-v2")).length).toBeGreaterThan(0);
  });
});

describe("vignettes · ratio réel de la sortie", () => {
  /** Vidéo dont video.ratios = [9:16] mais dont la seule sortie a le ratio donné (fichier réel). */
  async function videoSortieUnique(ratio: "1:1" | "16:9" | "9:16" | "4:5") {
    const v = await vraieVideo();
    const d = depots();
    const sorties = await d.sorties.lister((s) => s.versionId === v.versionChoisieId);
    for (const s of sorties.slice(1)) await d.sorties.supprimer(s.id);
    await d.sorties.modifier(sorties[0].id, { ratio });
    await d.videos.modifier(v.id, { ratios: ["9:16"] });
    return v;
  }
  const cas = [["1:1", 1080, 1080], ["4:5", 1080, 1350], ["16:9", 1280, 720], ["9:16", 1080, 1920]] as const;
  for (const [ratio, l, h] of cas) {
    it(`sortie ${ratio} avec video.ratios=[9:16] : image ${ratio} non rognée, ratio et marqueur enregistrés`, { timeout: 60_000 }, async () => {
      const v = await videoSortieUnique(ratio);
      await fabriquer(v);
      expect(recues).toHaveLength(1);
      expect(recues[0].parametres.ratio).toBe(ratio);
      const m = (await depots().miniatures.lister((x) => x.videoId === v.id))[0];
      expect(m).toMatchObject({ ratio, gabarit: "image-video-v3b" });
      expect(await depots().fichiers.obtenir(m.fichierId)).toMatchObject({ largeur: l, hauteur: h });
    });
  }

  it("« Refaire toutes les vignettes » recompte une image v3 au mauvais ratio, laisse la bonne, n'efface rien", { timeout: 60_000 }, async () => {
    const v = await videoSortieUnique("1:1");
    await fabriquer(v);
    const d = depots();
    const m = (await d.miniatures.lister((x) => x.videoId === v.id))[0];
    const { videosAVignettesAnciennes, refaireToutesLesVignettes } = await import("@/services/miniatures");
    expect(await videosAVignettesAnciennes()).toHaveLength(0);
    await d.miniatures.modifier(m.id, { gabarit: "image-video-v3", ratio: "9:16" });
    expect(await videosAVignettesAnciennes()).toHaveLength(1);
    await d.miniatures.modifier(m.id, { ratio: "1:1" });
    expect(await videosAVignettesAnciennes()).toHaveLength(0);
    await d.miniatures.modifier(m.id, { ratio: "9:16" });
    recues.length = 0;
    expect((await refaireToutesLesVignettes()).videos).toBe(1);
    expect(recues[0].parametres.ratio).toBe("1:1");
    expect(await d.miniatures.obtenir(m.id)).toBeTruthy();
    expect(await videosAVignettesAnciennes()).toHaveLength(0);
  });
});
