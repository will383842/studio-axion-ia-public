/**
 * LOT L6 · IMAGE DÉJÀ TRAITÉE DANS « IMAGE → VIDÉO ». Le contrôle `verifierSujet` joue dans `deposerImageVideo`, SEULEMENT pour
 * un nouveau dépôt, AVANT le prix, le brouillon et toute dépense ; dans un lot, l'image déjà traitée est SAUTÉE et dite.
 * Clé exacte : empreinte sha256, sinon nom + taille, sinon référence du fichier. Dépôts en mémoire, lancement en double.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Id, Travail, Video } from "@/domaine/types";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }), headers: async () => new Headers() }));
vi.mock("@/services/auth", () => ({ exigerSession: async () => ({}) }));
// Petite banque de l'Usine : jamais d'import à froid du fichier de 2,8 Mo.
vi.mock("@/donnees/bases-usine", () => {
  const ligne = (code: string, titre: string) => ({ code, titre, cible: "m1", etat: "valide", probleme: "", ceQueCaChange: "", accroche: "", sujet: "" });
  return { metiers: () => [{ code: "m1" }], casUsage: () => [ligne("c1", "Trier les CV reçus"), ligne("c2", "Compte rendu de visio"), ligne("c3", "Facturer les formateurs"), ligne("c4", "Agenda des rendez-vous")] };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const ecran = await import("@/services/image-video-ecran");
const lots = await import("@/services/image-video-lot");
const { ecrireParametre } = await import("@/services/_commun");
const sujet = await import("@/components/formats/image-video/sujet-deja-traite");
const { montantApresControle } = await import("@/components/formats/commun/avant-prix");
const reseau = vi.spyOn(globalThis, "fetch");

const horo = () => ({ creeLe: new Date().toISOString(), modifieLe: new Date().toISOString() });
const RESEAUX = ["youtube-shorts"];
const PRIX = ecran.prixDuDepot(["youtube-shorts"], 0.9);
let n = 0;
const lancees: Id[] = [];

/** Fichiers connus du double : l'id donne l'empreinte (`sha-<id>`), sauf ceux listés `sansSha`. */
const sansSha = new Set<string>();
const dep = (plus: Record<string, unknown> = {}) => ({
  formatOuvert: () => true,
  voix: async () => ({ voixId: "vx", personnageId: "px" }),
  fichier: async (id: string) => ({ id, cleStockage: `k/${id}`, mime: "image/png", taille: 1000 + id.length, nom: `${id}.png`, ...(sansSha.has(id) ? {} : { sha256: `sha-${id}` }) }),
  accordEssai: async () => true,
  taux: async () => 0.9,
  brouillon: async (e: { titre: string; entrees: Record<string, unknown> }) => {
    const id = `v-${n++}`;
    await depots().videos.enregistrer({ id, titre: e.titre, entrees: e.entrees, statut: "brouillon", formatId: "image-video", ...horo() } as unknown as Video);
    return { id };
  },
  abandonner: async () => undefined,
  // Le vrai lancement passe la vidéo « en_file » : c'est ce qui la fait compter au registre.
  lancer: async (videoId: Id) => {
    lancees.push(videoId);
    await depots().videos.modifier(videoId, { statut: "en_file" } as never);
    await depots().travaux.enregistrer({ id: `t-${videoId}`, type: "video", cibleId: videoId, titre: videoId, etapes: [], statut: "en_cours", progression: 0, tentatives: 1, cleIdempotence: videoId, fournisseurUtilise: "x", parametres: {}, ...horo() } as unknown as Travail);
    return { statut: "lancee" as const, travailId: `t-${videoId}` };
  },
  lancerVideo: async (videoId: Id) => {
    lancees.push(videoId);
    return { travailId: `t-${videoId}` };
  },
  ...plus,
});

/** Une vidéo Image → vidéo déjà faite pour l'image `id` (même empreinte, même fichier). */
async function videoDeLImage(id: string, statut: Video["statut"] = "prete", extra: Partial<Video> = {}, avecSha = true) {
  await depots().videos.enregistrer({
    id: `v-${id}-${statut}`,
    titre: `Chatbot ${id}`,
    formatId: "image-video",
    statut,
    entrees: { imageVideo: { imageCle: `k/${id}`, fichierId: id, ...(avecSha ? { empreinte: `sha-${id}` } : {}), reseaux: RESEAUX, largeur: 1080, hauteur: 1350 } },
    ...horo(),
    ...extra,
  } as unknown as Video);
}

const demande = (fichierId: string, plus: Record<string, unknown> = {}) => ({ fichierId, reseaux: RESEAUX, largeur: 1080, hauteur: 1350, ...plus });
const deposer = (fichierId: string, plus: Record<string, unknown> = {}, deps: Record<string, unknown> = {}) => ecran.deposerImageVideo(demande(fichierId, plus) as never, dep(deps) as never);
const compter = async () => ({ videos: await depots().videos.compter(), travaux: await depots().travaux.compter(), depenses: await depots().depenses.compter() });

beforeEach(() => {
  reinitialiserDepots();
  n = 0;
  lancees.length = 0;
  sansSha.clear();
});
afterEach(() => {
  expect(reseau).not.toHaveBeenCalled();
});

describe("image seule : la même image déposée deux fois est refusée, rien n'est créé ni payé", () => {
  it("vidéo prête sur la même empreinte : refus AVANT le prix (sans accord), avec précédents et lien", async () => {
    await videoDeLImage("A");
    const avant = await compter();
    const r = await deposer("A");
    expect(r.statut).toBe("sujet-deja-traite");
    if (r.statut !== "sujet-deja-traite") return;
    expect(r.niveau).toBe("identique");
    expect(r.precedents.map((p) => p.videoId)).toEqual(["v-A-prete"]);
    expect(r.precedents[0]!.lien).toBe("/videos/v-A-prete");
    expect(r.jeton).toMatch(/^[0-9a-f]{16}$/);
    expect(r.suggestions.length).toBeLessThanOrEqual(3);
    expect(r.phrase).toBe(ecran.PHRASE_IMAGE_DEJA_TRAITEE);
    expect(await compter()).toEqual(avant);
    expect(lancees).toEqual([]);
  });

  it("même refus AVEC un accord déjà donné : rien n'est créé, aucune tâche, aucune dépense", async () => {
    await videoDeLImage("A");
    const avant = await compter();
    const r = await deposer("A", { accordCentimes: PRIX });
    expect(r.statut).toBe("sujet-deja-traite");
    expect(await compter()).toEqual(avant);
    expect(lancees).toEqual([]);
  });

  it("une image différente passe : on arrive au prix, puis elle est lancée", async () => {
    await videoDeLImage("A");
    expect((await deposer("B")).statut).toBe("accord-requis");
    const r = await deposer("B", { accordCentimes: PRIX });
    expect(r.statut).toBe("lancee");
    expect(lancees.length).toBe(1);
  });

  it("sans empreinte des deux côtés : le nom normalisé + la taille font la clé", async () => {
    sansSha.add("A");
    await depots().fichiers.enregistrer({ id: "A", cleStockage: "k/A", nom: "A.png", taille: 1001, mime: "image/png", ...horo() } as never);
    await videoDeLImage("A", "prete", {}, false);
    expect((await deposer("A")).statut).toBe("sujet-deja-traite");
  });

  it("sans empreinte ni fichier connu : la clé de stockage (même fichier) suffit", async () => {
    sansSha.add("A");
    await videoDeLImage("A", "prete", {}, false);
    expect((await deposer("A")).statut).toBe("sujet-deja-traite");
  });

  it("deux images de même nom mais d'empreintes différentes sont deux images", async () => {
    await videoDeLImage("A");
    const r = await deposer("B", {}, { fichier: async () => ({ id: "B", cleStockage: "k/B", mime: "image/png", taille: 1001, nom: "A.png", sha256: "sha-B" }) });
    expect(r.statut).toBe("accord-requis");
  });

  it("l'archivée ne compte pas ; une prête archivée compte encore", async () => {
    await videoDeLImage("A", "archivee");
    expect((await deposer("A")).statut).toBe("accord-requis");
    await videoDeLImage("C", "archivee", { statutAvantArchive: "prete" } as never);
    expect((await deposer("C")).statut).toBe("sujet-deja-traite");
  });
});

describe("échec puis relance : libre", () => {
  it("une vidéo en échec ne compte pas : redéposer l'image part", async () => {
    await videoDeLImage("A", "echec");
    const r = await deposer("A", { accordCentimes: PRIX });
    expect(r.statut).toBe("lancee");
  });

  it("« réessayer » après échec ne passe pas par le dépôt : le contrôle n'y est pas appelé", async () => {
    await videoDeLImage("A", "echec");
    const travail = { id: "t1", type: "video", cibleId: "v-A-echec", statut: "echec", parametres: {}, ...horo() } as unknown as Travail;
    const reessayer = vi.fn(async () => undefined);
    const r = await ecran.reessayerImageVideo("v-A-echec", undefined, { travail: async () => travail, reessayer });
    expect(r.statut).toBe("reprise");
    expect(reessayer).toHaveBeenCalledTimes(1);
  });

  it("« Refaire » d'une vidéo du lot (voulu) : aucun contrôle, même si une vidéo prête existe", async () => {
    await videoDeLImage("A");
    const lot = { version: "lot-iv/1", id: "lot-x", creeLe: "2026-01-01T00:00:00.000Z", cleIdempotence: "c", reseaux: RESEAUX, prixParVideoCentimes: PRIX, accordCentimes: PRIX, plafondCentimes: PRIX, tauxUsdEur: 0.9, videos: [{ rang: 1, videoId: "v-A-prete", fichierId: "A", nom: "A.png", statut: "faite" }], statut: "terminee", pannesDeSuite: 0, journal: [] };
    await ecrireParametre(`${lots.PREFIXE_LOT_IV}lot-x`, lot);
    const r = await lots.refaireVideoDuLot("lot-x", 1, { accordCentimes: PRIX }, dep() as never);
    expect(r.statut).toBe("lancee");
  });
});

describe("« Refaire quand même » : jeton", () => {
  it("bon jeton : le dépôt part (après le prix), avec la trace au journal", async () => {
    await videoDeLImage("A");
    const refus = await deposer("A");
    if (refus.statut !== "sujet-deja-traite") throw new Error(JSON.stringify(refus));
    const choix = { sujet: { choix: "refaire" as const, jeton: refus.jeton } };
    expect((await deposer("A", choix)).statut).toBe("accord-requis");
    const r = await deposer("A", { ...choix, accordCentimes: PRIX });
    expect(r.statut).toBe("lancee");
    if (r.statut !== "lancee") return;
    const journal = await depots().evenements.lister((e) => e.entiteId === r.videoId);
    expect(journal.some((e) => /image déjà traitée.*choix « refaire »/.test(e.message))).toBe(true);
  });

  it("jeton périmé (une autre vidéo est apparue) : refus de nouveau, rien créé", async () => {
    await videoDeLImage("A");
    const refus = await deposer("A");
    if (refus.statut !== "sujet-deja-traite") throw new Error(JSON.stringify(refus));
    await videoDeLImage("A", "en_file", { id: "v-autre" } as never);
    const avant = await compter();
    const r = await deposer("A", { accordCentimes: PRIX, sujet: { choix: "refaire", jeton: refus.jeton } });
    expect(r.statut).toBe("sujet-deja-traite");
    if (r.statut === "sujet-deja-traite") expect(r.jetonPerime).toBe(true);
    expect(await compter()).toEqual(avant);
  });

  it("jeton d'une autre image : refusé", async () => {
    await videoDeLImage("A");
    await videoDeLImage("B");
    const refusA = await deposer("A");
    if (refusA.statut !== "sujet-deja-traite") throw new Error("attendu");
    const r = await deposer("B", { accordCentimes: PRIX, sujet: { choix: "refaire", jeton: refusA.jeton } });
    expect(r.statut).toBe("sujet-deja-traite");
  });

  it("jeton inventé ou mal formé : refusé, rien créé", async () => {
    await videoDeLImage("A");
    for (const sujetBrut of [{ choix: "refaire", jeton: "0000000000000000" }, { choix: "n-importe-quoi", jeton: "x" }, { jeton: "x" }, "oui"]) {
      expect((await deposer("A", { accordCentimes: PRIX, sujet: sujetBrut })).statut).toBe("sujet-deja-traite");
    }
    expect(lancees).toEqual([]);
  });
});

describe("double clic : un seul dépôt", () => {
  it("deux dépôts simultanés de la même image : un seul part, l'autre est refusé", async () => {
    const [a, b] = await Promise.all([deposer("A", { accordCentimes: PRIX }), deposer("A", { accordCentimes: PRIX })]);
    expect([a.statut, b.statut].sort()).toEqual(["lancee", "sujet-deja-traite"]);
    expect(lancees.length).toBe(1);
  });
});

describe("réglage sujets.garde", () => {
  it("« eteint » : exactement comme avant (même issue, mêmes champs), avec ou sans vidéo prête", async () => {
    await ecrireParametre("sujets.garde", "eteint");
    const sans = await deposer("A", { accordCentimes: PRIX });
    reinitialiserDepots();
    await ecrireParametre("sujets.garde", "eteint");
    await videoDeLImage("A");
    const avec = await deposer("A", { accordCentimes: PRIX });
    expect(sans.statut).toBe("lancee");
    expect(avec.statut).toBe("lancee");
    expect(Object.keys(avec).sort()).toEqual(Object.keys(sans).sort());
    expect(avec).not.toHaveProperty("avertissement");
  });

  it("« avertissement » : l'image déjà traitée passe, avec l'avertissement", async () => {
    await ecrireParametre("sujets.garde", "avertissement");
    await videoDeLImage("A");
    const r = await deposer("A", { accordCentimes: PRIX });
    expect(r.statut).toBe("lancee");
    if (r.statut === "lancee") expect(r.avertissement?.precedents.map((p) => p.videoId)).toEqual(["v-A-prete"]);
  });
});

describe("D1 : la même image dans un AUTRE générateur prévient sans bloquer", () => {
  it("prise de face caméra animée sur le même fichier : lancée, avec avertissement", async () => {
    await depots().videos.enregistrer({ id: "v-fca", titre: "Face caméra", formatId: "facecam-animee", statut: "prete", entrees: { facecamAnimee: { fichierId: "A" } }, ...horo() } as unknown as Video);
    const r = await deposer("A", { accordCentimes: PRIX });
    expect(r.statut).toBe("lancee");
    if (r.statut === "lancee") expect(r.avertissement).toMatchObject({ precedents: [{ videoId: "v-fca", generateur: "facecam-animee" }] });
  });
});

describe("lot : l'image déjà traitée est sautée et dite, les autres partent", () => {
  const images = (...ids: string[]) => ids.map((fichierId) => ({ fichierId, largeur: 1080, hauteur: 1350 }));
  const lot = (ids: string[], plus: Record<string, unknown> = {}, accord = PRIX * ids.length) => lots.deposerLotImageVideo({ images: images(...ids), reseaux: RESEAUX, accordCentimes: accord }, dep(plus) as never);

  it("3 images dont 1 déjà prête : un lot de 2, la sautée est nommée dans la réponse, le journal et la phrase", async () => {
    await videoDeLImage("B");
    const avant = await depots().videos.compter();
    const r = await lot(["A", "B", "C"]);
    expect(r.statut).toBe("lancee");
    if (r.statut !== "lancee") return;
    expect(r.sautees).toEqual([{ nom: "B.png", precedents: ["Chatbot B"] }]);
    expect(r.phraseSautees).toContain("1 image est déjà traitée et sautée (B.png)");
    expect(r.phraseSautees).toContain("2 vidéos partent");
    const l = (await lots.lireLotIV(r.lotId))!;
    expect(l.videos.map((v) => v.fichierId)).toEqual(["A", "C"]);
    expect(l.journal.some((j) => j.includes("B.png"))).toBe(true);
    expect(l.plafondCentimes).toBe(PRIX * 2);
    expect(await depots().videos.compter()).toBe(avant + 2);
  });

  it("sans accord : le prix demandé est celui des images gardées, et la phrase dit ce qui est sauté ; rien n'est créé", async () => {
    await videoDeLImage("B");
    const avant = await compter();
    const r = await lots.deposerLotImageVideo({ images: images("A", "B", "C"), reseaux: RESEAUX }, dep() as never);
    expect(r.statut).toBe("accord-requis");
    if (r.statut === "accord-requis") {
      expect(r.centimes).toBe(PRIX * 2);
      expect(r.phrase).toContain("B.png");
      expect(r.sautees?.length).toBe(1);
    }
    expect(await compter()).toEqual(avant);
  });

  it("la même image deux fois dans le lot : seule la première part", async () => {
    const r = await lot(["A", "B", "C"], { fichier: async (id: string) => ({ id, cleStockage: `k/${id}`, mime: "image/png", taille: 5000, nom: `${id}.png`, sha256: id === "C" ? "sha-A" : `sha-${id}` }) });
    expect(r.statut).toBe("lancee");
    if (r.statut === "lancee") expect(r.sautees).toEqual([{ nom: "C.png", precedents: [] }]);
  });

  it("une seule image reste : refusé avec la phrase, rien créé ni payé", async () => {
    await videoDeLImage("A");
    await videoDeLImage("B");
    const avant = await compter();
    const r = await lot(["A", "B", "C"]);
    expect(r.statut).toBe("refusee");
    if (r.statut === "refusee") {
      expect(r.phrase).toContain("2 images sont déjà traitées et sautées (A.png, B.png)");
      expect(r.phrase).toContain("Déposez-la seule");
    }
    expect(await compter()).toEqual(avant);
  });

  it("toutes déjà traitées : refusé, rien créé", async () => {
    await videoDeLImage("A");
    await videoDeLImage("B");
    const avant = await compter();
    const r = await lot(["A", "B"]);
    expect(r.statut).toBe("refusee");
    expect(await compter()).toEqual(avant);
  });

  it("une image dont la vidéo a échoué n'est pas sautée", async () => {
    await videoDeLImage("B", "echec");
    const r = await lot(["A", "B"]);
    expect(r.statut).toBe("lancee");
    if (r.statut === "lancee") expect(r.sautees).toBeUndefined();
  });

  it("le même lot redéposé rend le même lot (idempotence), même si une vidéo est partie entre-temps", async () => {
    const premier = await lot(["A", "B", "C"]);
    if (premier.statut !== "lancee") throw new Error(JSON.stringify(premier));
    const avant = await depots().videos.compter();
    // Une vidéo du lot est maintenant lancée : elle compte au registre.
    const videos = (await lots.lireLotIV(premier.lotId))!.videos;
    await depots().videos.modifier(videos[0]!.videoId, { statut: "en_file" } as never);
    const second = await lot(["A", "B", "C"]);
    expect(second).toMatchObject({ statut: "lancee", lotId: premier.lotId });
    expect(await depots().videos.compter()).toBe(avant);
  });

  it("lot déposé et pas encore lancé (brouillons) : la même image seule est refusée, rien n'est payé deux fois", async () => {
    const l = await lot(["A", "B"]);
    expect(l.statut).toBe("lancee");
    const avant = await compter();
    expect((await deposer("A")).statut).toBe("sujet-deja-traite");
    expect((await deposer("A", { accordCentimes: PRIX })).statut).toBe("sujet-deja-traite");
    expect(await compter()).toEqual(avant);
  });

  it("lot déposé et pas encore lancé : la même image dans un 2e lot est sautée", async () => {
    await lot(["A", "B"]);
    const r = await lot(["A", "C", "D"]);
    expect(r.statut).toBe("lancee");
    if (r.statut === "lancee") expect(r.sautees).toEqual([{ nom: "A.png", precedents: expect.any(Array) }]);
  });

  it("un lot arrêté ne retient plus ses images (sinon bloquées pour toujours)", async () => {
    const l = await lot(["A", "B"]);
    if (l.statut !== "lancee") throw new Error("attendu");
    const lu = (await lots.lireLotIV(l.lotId))!;
    await ecrireParametre(`${lots.PREFIXE_LOT_IV}${l.lotId}`, { ...lu, statut: "arrete" });
    expect((await deposer("A")).statut).toBe("accord-requis");
  });

  it("lot de 2 dont une vidéo est partie (en_file), rejoué : même lot, pas de « déposez-la seule »", async () => {
    const premier = await lot(["A", "B"]);
    if (premier.statut !== "lancee") throw new Error(JSON.stringify(premier));
    const videos = (await lots.lireLotIV(premier.lotId))!.videos;
    await depots().videos.modifier(videos[0]!.videoId, { statut: "en_file" } as never);
    const avant = await depots().videos.compter();
    const second = await lot(["A", "B"]);
    expect(second).toMatchObject({ statut: "lancee", lotId: premier.lotId });
    expect(await depots().videos.compter()).toBe(avant);
  });

  it("« eteint » : le lot part en entier, comme avant", async () => {
    await ecrireParametre("sujets.garde", "eteint");
    await videoDeLImage("B");
    const r = await lot(["A", "B", "C"]);
    expect(r.statut).toBe("lancee");
    if (r.statut === "lancee") {
      expect(r.sautees).toBeUndefined();
      expect((await lots.lireLotIV(r.lotId))!.videos.length).toBe(3);
    }
  });
});

describe("ordre de l'écran : le contrôle passe avant le prix", () => {
  it("règles du prix redemandé et du prix gardé", () => {
    expect(sujet.controleServeurAvantPrix()).toBe(true);
    expect(sujet.accordApresRefus({ jetonPerime: true }, 132)).toBeUndefined();
    expect(sujet.accordApresRefus({}, 132)).toBe(132);
    expect([0, 1, 2, 3].filter((essai) => sujet.prixRedemandable(essai)).length).toBe(sujet.RELANCES_PRIX_MAX);
    expect(sujet.PHRASE_PRIX_CHANGE).toMatch(/prix a changé/);
  });

  it("bouton : le contrôle refuse (false) -> la fenêtre de prix ne s'ouvre pas (null) ; il passe -> le prix affiché ; { centimes } -> ce montant", async () => {
    expect(await montantApresControle(500, async () => false)).toBeNull();
    expect(await montantApresControle(500, async () => true)).toBe(500);
    expect(await montantApresControle(500, async () => ({ centimes: 320 }))).toBe(320);
    expect(await montantApresControle(500)).toBe(500);
  });

  it("anti double clic : un second clic pendant l'envoi est ignoré", () => {
    expect(sujet.clicIgnore(true)).toBe(true);
    expect(sujet.clicIgnore(false)).toBe(false);
  });

  it("phrase du lot : une image, plusieurs images, aucune", () => {
    expect(sujet.phraseImagesSautees([], 3)).toBe("");
    expect(sujet.phraseImagesSautees([{ nom: "a.png" }], 4)).toBe("1 image est déjà traitée et sautée (a.png) : 4 vidéos partent.");
    expect(sujet.phraseImagesSautees([{ nom: "a.png" }, { nom: "b.png" }], 3)).toBe("2 images sont déjà traitées et sautées (a.png, b.png) : 3 vidéos partent.");
    expect(sujet.phraseImagesSautees([{ nom: "a.png" }], 1)).toContain("1 seule reste");
  });
});
