/**
 * LOT S1 — « supprimer une vidéo l'efface PARTOUT ». Chaque collection a une décision écrite (`TRAITEMENT_SUPPRESSION`),
 * plus aucune citation de l'identifiant ne reste hors de la liste des choses gardées exprès, les objets du stockage de la
 * vidéo (quatre dossiers + fiches de scènes + fichiers cités) partent, mais jamais ceux d'un voisin (`v-010`, autre vidéo).
 * Aucun appel réel : stockage simulé en mémoire.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const videos = await import("@/services/videos");
const suppression = await import("@/services/suppression-video");
const siteVideos = await import("@/services/site-videos");
const { stockageSimulation, deposerObjetSimule, objetsSimulesRestants, viderObjetsSimules } = await import("@/fournisseurs/simulation/autres");
import type { Depot, Depots } from "@/domaine/depots";
import type { Fichier } from "@/domaine/types";

const ID = "v-01";
const AUTRE = "v-03";
const H = { creeLe: "2026-10-01T00:00:00.000Z", modifieLe: "2026-10-01T00:00:00.000Z" };
const MDP = "essai-orphelins-123";

beforeAll(async () => {
  process.env.SESSION_SECRET = "s".repeat(48);
  const empreinte = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  viderObjetsSimules();
  vi.restoreAllMocks();
  await auth.seConnecter(MDP, false);
});

const fichier = (id: string, cle: string): Fichier => ({ id, cleStockage: cle, nom: `${id}.mp4`, mime: "video/mp4", taille: 1, origine: "fabrication", statut: "pret", ...H });
const param = (id: string, valeur: unknown) => depots().parametres.enregistrer({ id, valeur, ...H });
const cite = (texte: string, id = ID) => new RegExp(`(?<![A-Za-z0-9_-])${id}(?![A-Za-z0-9_-])`).test(texte);

/** Tout ce qui cite encore la vidéo, sauf ce que la suppression garde exprès (`GARDES_APRES_SUPPRESSION`). */
async function citations(videoId: string): Promise<string[]> {
  const d = depots();
  const res: string[] = [];
  for (const c of Object.keys(d) as (keyof Depots)[]) {
    for (const e of await (d[c] as unknown as Depot<{ id: string; origine?: string }>).lister()) {
      if (c === "fichiers" && e.origine === "demo") continue;
      if (suppression.GARDES_APRES_SUPPRESSION.some((g) => g.collection === c && g.correspond(e))) continue;
      if (cite(JSON.stringify(e), videoId) || cite(e.id, videoId)) res.push(`${c}/${e.id}`);
    }
  }
  return res;
}

const DOSSIERS = ["audio-maitre", "videos", "facecam-animee", "image-video", "fiches-scenes"];

async function semer() {
  const d = depots();
  const v = (await d.videos.obtenir(ID))!;
  // Fichier désigné seulement par sa clé de stockage dans un document effacé (pas par son id).
  await d.fichiers.enregistrer(fichier("fic-cle-citee", "studio/dev/divers/cite-par-la-video.mp4"));
  await d.fichiers.enregistrer(fichier("fic-lot", "studio/dev/entree/image-video/fic-lot.png"));
  await d.videos.modifier(ID, { entrees: { ...v.entrees, imageVideo: { fichierId: "fic-lot" }, notes: "rendu : studio/dev/divers/cite-par-la-video.mp4 et studio/dev/divers/objet-cite.bin et studio/prod/divers/partage.bin" } });
  // Objet cité aussi par l'AUTRE vidéo : gardé.
  const autre = (await d.videos.obtenir(AUTRE))!;
  await d.videos.modifier(AUTRE, { entrees: { ...autre.entrees, notes: "studio/prod/divers/partage.bin" } });
  for (const k of ["studio/dev/divers/cite-par-la-video.mp4", "studio/dev/divers/objet-cite.bin", "studio/prod/divers/partage.bin"]) deposerObjetSimule(k);
  for (const dos of DOSSIERS) {
    deposerObjetSimule(`studio/dev/${dos}/${ID}/a.bin`);
    deposerObjetSimule(`studio/dev/${dos}/${ID}/sous/b.bin`);
    deposerObjetSimule(`studio/dev/${dos}/${ID}0/leurre.bin`); // id voisin
    deposerObjetSimule(`studio/dev/${dos}/${AUTRE}/autre.bin`);
  }
  // Réglages qui désignent la vidéo.
  await param(`casConcret.discussion.${ID}`, { demande: "x" });
  await param(`casConcret.discussion.${ID}0`, { demande: "voisin" });
  await param(`casConcret.discussion.${AUTRE}`, { demande: "autre" });
  await param("generateur.fabricationN.op-mere", { mereVideoId: ID, videoIds: [ID, "v-fille"] });
  await param("generateur.fabricationN.op-membre", { mereVideoId: AUTRE, videoIds: [AUTRE, ID] });
  await param("imageVideo.lot.lot-iv-aaaaaaaaaaaa", {
    version: "lot-iv/1",
    id: "lot-iv-aaaaaaaaaaaa",
    videos: [
      { rang: 1, videoId: ID, fichierId: "fic-lot", nom: "a.png", statut: "faite" },
      { rang: 2, videoId: AUTRE, fichierId: "fic-autre-image", nom: "b.png", statut: "faite" },
    ],
    statut: "termine",
    journal: [],
  });
  const n = (id: string, lien: string) => d.notifications.enregistrer({ id, type: "info", titre: "t", lue: false, lien, ...H } as never);
  await n("not-cc", `/cas-concret/document/${ID}`);
  await n("not-cc2", `/cas-concret/document/${ID}?x=1`);
  await n("not-voisin", `/cas-concret/document/${ID}0`);
  await d.evenements.enregistrer({ id: "ev-a", type: "video", message: "m", entite: "video", entiteId: ID, date: H.creeLe, ...H });
}

describe("décision écrite pour chaque collection", () => {
  it("TRAITEMENT_SUPPRESSION a exactement les clés de depots(), avec des valeurs permises", () => {
    const permis = ["efface", "detache", "efface-si-exclusif", "garde-comptabilite", "garde-journal", "garde-publiees", "sans-lien"];
    expect(Object.keys(suppression.TRAITEMENT_SUPPRESSION).sort()).toEqual(Object.keys(depots()).sort());
    for (const [c, t] of Object.entries(suppression.TRAITEMENT_SUPPRESSION)) expect(permis, c).toContain(t);
    expect(suppression.TRAITEMENT_SUPPRESSION.depenses).toBe("garde-comptabilite");
    expect(suppression.TRAITEMENT_SUPPRESSION.reservations).toBe("garde-comptabilite");
    expect(suppression.TRAITEMENT_SUPPRESSION.evenements).toBe("garde-journal");
    expect(suppression.TRAITEMENT_SUPPRESSION.publications).toBe("garde-publiees");
  });
});

describe("plus aucune citation de la vidéo", () => {
  it("réglages, notifications, lot d'images, fabrication des N : tout est nettoyé, sauf ce qui est gardé exprès", async () => {
    await semer();
    expect(await citations(ID)).not.toEqual([]);
    await videos.supprimerVideoDefinitivement(ID);
    expect(await citations(ID)).toEqual([]);
    const d = depots();
    // Voisins intacts.
    for (const id of [`casConcret.discussion.${ID}0`, `casConcret.discussion.${AUTRE}`]) expect(await d.parametres.obtenir(id), id).not.toBeNull();
    expect(await d.notifications.obtenir("not-voisin")).not.toBeNull();
    // Fabrication des N : la mère efface l'opération, un membre est retiré de la liste.
    expect(await d.parametres.obtenir("generateur.fabricationN.op-mere")).toBeNull();
    expect((await d.parametres.obtenir("generateur.fabricationN.op-membre"))!.valeur).toEqual({ mereVideoId: AUTRE, videoIds: [AUTRE] });
    // Lot d'images : l'entrée reste, « Supprimée. », sans fichier ; l'autre entrée est intacte.
    const lot = (await d.parametres.obtenir("imageVideo.lot.lot-iv-aaaaaaaaaaaa"))!.valeur as { videos: { rang: number; statut: string; fichierId?: string; miseDeCote?: { motif: string } }[] };
    expect(lot.videos[0]).toMatchObject({ rang: 1, statut: "mise-de-cote", miseDeCote: { motif: "Supprimée." } });
    expect(lot.videos[0].fichierId || "").toBe("");
    expect(lot.videos[1]).toMatchObject({ rang: 2, statut: "faite", fichierId: "fic-autre-image" });
    // La page du lot ne propose plus de lien « voir » pour l'entrée supprimée.
    const { construireVueLotIV } = await import("@/services/image-video-lot");
    const vue = construireVueLotIV(lot as never, { imageUrl: () => null, etape: () => undefined });
    expect(vue.videos[0].voir).toBeUndefined();
    expect(vue.videos[1].voir).toBe(`/image-video/${AUTRE}`);
  });

  it("le lot d'images : le fichier de l'entrée supprimée n'est plus retenu par le lot", async () => {
    await semer();
    await videos.supprimerVideoDefinitivement(ID);
    // fic-lot était cité par le lot ET sous aucun dossier de la vidéo : il n'a pas à survivre s'il n'est plus cité nulle part.
    expect(await depots().fichiers.obtenir("fic-lot")).toBeNull();
  });
});

describe("objets du stockage", () => {
  it("quatre dossiers + fiches de scènes + fichier et objets cités effacés ; leurres, voisin et objet partagé gardés", async () => {
    await semer();
    await videos.supprimerVideoDefinitivement(ID);
    const restants = objetsSimulesRestants();
    for (const dos of DOSSIERS) {
      expect(restants, dos).not.toContain(`studio/dev/${dos}/${ID}/a.bin`);
      expect(restants, dos).not.toContain(`studio/dev/${dos}/${ID}/sous/b.bin`);
      expect(restants, dos).toContain(`studio/dev/${dos}/${ID}0/leurre.bin`);
      expect(restants, dos).toContain(`studio/dev/${dos}/${AUTRE}/autre.bin`);
    }
    // Fichier enregistré, retenu par sa seule clé citée mais hors des dossiers de la vidéo : gardé (base ET stockage).
    expect(restants).toContain("studio/dev/divers/cite-par-la-video.mp4");
    // Liste blanche (revue de #484) : une clé citée HORS des dossiers propres de la vidéo n'est jamais effacée.
    expect(restants).toContain("studio/dev/divers/objet-cite.bin");
    expect(restants).toContain("studio/prod/divers/partage.bin");
    expect(await depots().fichiers.obtenir("fic-cle-citee")).not.toBeNull();
  });

  it("leurre : un fichier ENREGISTRÉ sous le dossier d'une AUTRE vidéo, cité seulement par la vidéo supprimée, reste (document et objet)", async () => {
    const d = depots();
    const v = (await d.videos.obtenir(ID))!;
    const cleMere = `studio/dev/audio-maitre/${AUTRE}/mere-enregistree.wav`;
    const propre = `studio/dev/videos/${ID}/propre-enregistre.mp4`;
    await d.fichiers.enregistrer(fichier("fic-mere-autre", cleMere));
    await d.fichiers.enregistrer(fichier("fic-propre-cle", propre));
    await d.videos.modifier(ID, { entrees: { ...v.entrees, notes: `${cleMere} ${propre}` } });
    deposerObjetSimule(cleMere);
    deposerObjetSimule(propre);
    await videos.supprimerVideoDefinitivement(ID);
    const restants = objetsSimulesRestants();
    expect(restants).toContain(cleMere);
    expect(await d.fichiers.obtenir("fic-mere-autre")).not.toBeNull();
    expect(restants).not.toContain(propre);
    expect(await d.fichiers.obtenir("fic-propre-cle")).toBeNull();
  });

  it("leurres : la clé du dossier d'une AUTRE vidéo et une illustration PARTAGÉE, citées par la vidéo supprimée seule, ne sont pas effacées", async () => {
    const d = depots();
    const v = (await d.videos.obtenir(ID))!;
    const audioMere = `studio/dev/audio-maitre/${AUTRE}/mere.wav`;
    const illustration = "studio/dev/illustrations/pexels/0123456789abcdef01234567.mp4";
    const propre = `studio/dev/videos/${ID}/cite-propre.bin`;
    await d.videos.modifier(ID, { entrees: { ...v.entrees, notes: `${audioMere} ${illustration} ${propre} studio/dev/elements/el/x.png studio/dev/decors/d.png` } });
    for (const k of [audioMere, illustration, propre, "studio/dev/elements/el/x.png", "studio/dev/decors/d.png"]) deposerObjetSimule(k);
    await videos.supprimerVideoDefinitivement(ID);
    const restants = objetsSimulesRestants();
    for (const k of [audioMere, illustration, "studio/dev/elements/el/x.png", "studio/dev/decors/d.png"]) expect(restants, k).toContain(k);
    expect(restants).not.toContain(propre);
  });

  it("course : une clé du plan citée entre-temps par un document (vidéo fabriquée avec le même média) n'est pas effacée", async () => {
    const d = depots();
    const v = (await d.videos.obtenir(ID))!;
    const cle = `studio/dev/entree/image-video/partagee.png`;
    await d.fichiers.enregistrer(fichier("fic-course", cle));
    await d.videos.modifier(ID, { entrees: { ...v.entrees, imageVideo: { fichierId: "fic-course" } } });
    deposerObjetSimule(cle);
    deposerObjetSimule(`studio/dev/videos/${ID}/b.bin`);
    const aEffacer = await suppression.appliquerSuppression((await d.videos.obtenir(ID))!);
    expect(aEffacer).toContain(cle);
    // Après le verrou : une autre vidéo se fabrique avec le même média, son plan cite la clé.
    await param("generateur.fabrication.op-b", { videoId: AUTRE, media: cle });
    await suppression.effacerDuStockage(aEffacer);
    expect(objetsSimulesRestants()).toContain(cle);
    expect(objetsSimulesRestants()).not.toContain(`studio/dev/videos/${ID}/b.bin`);
  });

  it("un fichier cité par sa clé dans un document gardé n'est pas effacé", async () => {
    await semer();
    await depots().fichiers.enregistrer(fichier("fic-voisin", "studio/dev/divers/objet-cite.bin"));
    await depots().scripts.enregistrer({ ...(await depots().scripts.obtenir((await depots().videos.obtenir(AUTRE))!.scriptId!))!, id: "script-cite", corps: "studio/dev/divers/objet-cite.bin" } as never);
    await videos.supprimerVideoDefinitivement(ID);
    expect(await depots().fichiers.obtenir("fic-voisin")).not.toBeNull();
    expect(objetsSimulesRestants()).toContain("studio/dev/divers/objet-cite.bin");
  });
});

describe("panne du stockage après l'effacement en base", () => {
  it("l'appel n'échoue pas (la vidéo est déjà effacée), l'erreur est journalisée et UNE notification part", async () => {
    const d = depots();
    deposerObjetSimule(`studio/dev/videos/${ID}/a.bin`);
    let fini = false;
    const listerOrigine = stockageSimulation.listerPrefixe!.bind(stockageSimulation);
    vi.spyOn(stockageSimulation, "listerPrefixe").mockImplementation(async (p) => {
      fini = true;
      return listerOrigine(p);
    });
    const listerFichiers = d.fichiers.lister.bind(d.fichiers);
    vi.spyOn(d.fichiers, "lister").mockImplementation(((...a: unknown[]) => (fini ? Promise.reject(new Error("panne de lecture")) : (listerFichiers as (...x: unknown[]) => unknown)(...a))) as never);
    const journal = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(videos.supprimerVideoDefinitivement(ID)).resolves.toBe(true);
    expect(await d.videos.obtenir(ID)).toBeNull();
    expect(journal).toHaveBeenCalledWith(expect.stringContaining("[suppression] objets du stockage non effacés"), expect.anything(), expect.any(Error));
    expect(await d.notifications.compter((n) => n.type === "echec" && /stockage/i.test(n.message ?? ""))).toBe(1);
  });
});

describe("vidéos filles", () => {
  async function fille(attendMere: boolean) {
    const d = depots();
    const modele = (await d.videos.obtenir(AUTRE))!;
    await d.videos.enregistrer({
      ...modele,
      id: "v-fille",
      statut: "brouillon",
      sourceVideoId: ID,
      entrees: { declinaison: { role: "variante", scriptMaitreId: "sm", operationId: "op", mereVideoId: ID, ...(attendMere ? { attendMere: true } : {}) } },
    });
  }

  it("une fille qui attend sa mère : suppression de la mère seule refusée (VERSIONS_EN_ATTENTE), rien n'est effacé", async () => {
    await fille(true);
    await expect(videos.supprimerVideoDefinitivement(ID)).rejects.toMatchObject({ code: "VERSIONS_EN_ATTENTE" });
    expect(await depots().videos.obtenir(ID)).not.toBeNull();
  });

  it("la mère et sa fille choisies ensemble : acceptées", async () => {
    await fille(true);
    expect((await videos.supprimerVideosDefinitivement([ID, "v-fille"])).supprimees).toBe(2);
    expect(await depots().videos.obtenir("v-fille")).toBeNull();
  });

  it("une fille qui n'attend plus sa mère est détachée, pas effacée", async () => {
    await fille(false);
    await videos.supprimerVideoDefinitivement(ID);
    const f = (await depots().videos.obtenir("v-fille"))!;
    expect(f.sourceVideoId).toBeUndefined();
    expect(JSON.stringify(f.entrees)).not.toContain(ID);
  });
});

describe("séquence de la suppression de plusieurs vidéos", () => {
  it("la 2e échoue : les fichiers de la 1re sont quand même effacés du stockage", async () => {
    await semer();
    const vraie = suppression.appliquerSuppression;
    let n = 0;
    vi.spyOn(suppression, "appliquerSuppression").mockImplementation(async (v) => {
      n++;
      if (n === 2) throw new Error("panne simulée");
      return vraie(v);
    });
    await expect(videos.supprimerVideosDefinitivement([ID, AUTRE])).rejects.toThrow("panne simulée");
    expect(await depots().videos.obtenir(ID)).toBeNull();
    expect(objetsSimulesRestants()).not.toContain(`studio/dev/videos/${ID}/a.bin`);
    expect(objetsSimulesRestants()).toContain(`studio/dev/videos/${AUTRE}/autre.bin`);
  });

  it("un identifiant hors convention : refus AVANT le retrait du site, la vidéo reste", async () => {
    const d = depots();
    const v = (await d.videos.obtenir(ID))!;
    await d.videos.enregistrer({ ...v, id: "v hors/convention" });
    const retrait = vi.spyOn(siteVideos, "retirerAvantSuppression");
    await expect(videos.supprimerVideosDefinitivement(["v hors/convention"])).rejects.toThrow(/hors convention/);
    expect(retrait).not.toHaveBeenCalled();
    expect(await d.videos.obtenir("v hors/convention")).not.toBeNull();
  });

  it("une vidéo refusée : le site n'est pas touché et rien n'est effacé", async () => {
    await semer();
    await depots().videos.modifier(AUTRE, { statut: "en_fabrication" });
    const retrait = vi.spyOn(siteVideos, "retirerAvantSuppression");
    const supprime = vi.spyOn(stockageSimulation, "supprimer");
    await expect(videos.supprimerVideosDefinitivement([ID, AUTRE])).rejects.toMatchObject({ code: "EN_FABRICATION" });
    expect(retrait).not.toHaveBeenCalled();
    expect(supprime).not.toHaveBeenCalled();
    expect(await depots().videos.obtenir(ID)).not.toBeNull();
  });
});

describe("relecture : objets de dossier gardés quand un fichier ou un document restant les cite, lot « refaite »", () => {
  it("l'objet d'un dossier qui est le fichier d'un modèle gardé n'est pas effacé", async () => {
    const d = depots();
    await d.fichiers.enregistrer(fichier("fic-vignette", `studio/dev/videos/${ID}/vignette.jpg`));
    deposerObjetSimule(`studio/dev/videos/${ID}/vignette.jpg`);
    deposerObjetSimule(`studio/dev/videos/${ID}/autre.mp4`);
    const [m] = await d.modeles.lister();
    await d.modeles.modifier(m.id, { vignetteFichierId: "fic-vignette" } as never);
    await videos.supprimerVideoDefinitivement(ID);
    expect(await d.fichiers.obtenir("fic-vignette")).not.toBeNull();
    expect(objetsSimulesRestants()).toContain(`studio/dev/videos/${ID}/vignette.jpg`);
    expect(objetsSimulesRestants()).not.toContain(`studio/dev/videos/${ID}/autre.mp4`);
  });

  it("lot d'images : ancienne vidéo supprimée garde le lien vers la refaite ; nouvelle supprimée : l'image peut être refaite", async () => {
    const d = depots();
    const lot = (v: unknown[]) => param("imageVideo.lot.lot-iv-bbbbbbbbbbbb", { version: "lot-iv/1", id: "lot-iv-bbbbbbbbbbbb", videos: v, statut: "termine", journal: [] });
    await lot([{ rang: 1, videoId: ID, fichierId: "f", nom: "a", statut: "refaite", refaiteEn: "v-nouvelle" }]);
    await videos.supprimerVideoDefinitivement(ID);
    let e = ((await d.parametres.obtenir("imageVideo.lot.lot-iv-bbbbbbbbbbbb"))!.valeur as { videos: Record<string, unknown>[] }).videos[0];
    expect(e).toMatchObject({ statut: "refaite", refaiteEn: "v-nouvelle" });
    await lot([{ rang: 1, videoId: AUTRE, fichierId: "f", nom: "a", statut: "refaite", refaiteEn: "v-nv" }]);
    await d.videos.enregistrer({ ...(await d.videos.obtenir(AUTRE))!, id: "v-nv", statut: "brouillon", entrees: {} });
    await videos.supprimerVideoDefinitivement("v-nv");
    e = ((await d.parametres.obtenir("imageVideo.lot.lot-iv-bbbbbbbbbbbb"))!.valeur as { videos: Record<string, unknown>[] }).videos[0];
    expect(e.statut).toBe("mise-de-cote");
    expect(e.refaiteEn).toBeUndefined();
  });
});
