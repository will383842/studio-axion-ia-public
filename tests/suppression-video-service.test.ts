/**
 * « Supprimer définitivement » une vidéo (décision écrite de Will du 17/10 : « Vraie suppression, dépenses gardées »).
 * Cascade complète (chaque collection vidée pour CETTE vidéo, aucune autre vidéo touchée), dépenses et réservations
 * gardées, fichiers partagés gardés, refus en fabrication ou publication programmée, lien privé → 410, idempotence.
 * Aucun appel réel : stockage simulé, son `supprimer` est observé.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots, prendreBail, rendreBail } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const videos = await import("@/services/videos");
const { resoudrePartage } = await import("@/services/partages");
const { stockageSimulation } = await import("@/fournisseurs/simulation/autres");
import type { Depot, Depots } from "@/domaine/depots";
import type { Fichier, Video } from "@/domaine/types";

const MDP_TEST = "essai-suppression-123";
const ID = "v-01";
const AUTRE = "v-03";
const H = { creeLe: "2026-10-01T00:00:00.000Z", modifieLe: "2026-10-01T00:00:00.000Z" };

beforeAll(async () => {
  process.env.SESSION_SECRET = "s".repeat(48);
  const empreinte = await hash(MDP_TEST, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  vi.restoreAllMocks();
  await auth.seConnecter(MDP_TEST, false);
});

const fichier = (id: string, cle: string, origine: Fichier["origine"] = "fabrication"): Fichier => ({ id, cleStockage: cle, nom: `${id}.mp4`, mime: "video/mp4", taille: 1, origine, statut: "pret", ...H });

/**
 * Tout ce qui, dans la base, cite encore une vidéo. Gardés exprès : dépenses et réservations (comptabilité), les
 * fichiers de démonstration (communs à tout le studio) et `Modele.creeDepuisVideoId` (le modèle vit sans la vidéo).
 */
async function citations(videoId: string): Promise<string[]> {
  const d = depots();
  const res: string[] = [];
  for (const c of Object.keys(d) as (keyof Depots)[]) {
    if (c === "depenses" || c === "reservations") continue;
    for (const e of await (d[c] as unknown as Depot<{ id: string; type?: string }>).lister()) {
      // Gardés exprès (décisions D2/D3 de Will) : tout le journal de la vidéo, les publications déjà publiées et leurs mesures.
      if (c === "evenements") continue;
      if (c === "publications" && (e as unknown as { statut: string }).statut === "publiee") continue;
      if (c === "fichiers" && (e as unknown as Fichier).origine === "demo") continue;
      if (c === "modeles" && JSON.stringify({ ...e, creeDepuisVideoId: undefined }).includes(`"${videoId}"`) === false) continue;
      if (JSON.stringify(e).includes(`"${videoId}"`) || e.id.endsWith(`.${videoId}`) || e.id.includes(`-${videoId}`)) res.push(`${c}/${e.id}`);
    }
  }
  return res;
}

async function instantane(): Promise<Record<string, string>> {
  const d = depots();
  const res: Record<string, string> = {};
  for (const c of Object.keys(d) as (keyof Depots)[]) for (const e of await (d[c] as unknown as Depot<{ id: string }>).lister()) res[`${c}/${e.id}`] = JSON.stringify(e);
  return res;
}

/** Remplit TOUTES les collections reliées à la vidéo, plus des fichiers partagés avec la bibliothèque et une autre vidéo. */
async function semer() {
  const d = depots();
  const v = (await d.videos.obtenir(ID))!;
  const versionId = v.versionChoisieId!;
  const autreVersion = (await d.videos.obtenir(AUTRE))!.versionChoisieId!;
  // Fichiers : un exclusif (sortie), un sous le dossier de la vidéo, un partagé avec un élément de la bibliothèque,
  // un partagé avec l'autre vidéo, un de démonstration.
  await d.fichiers.enregistrer(fichier("fic-exclusif", `studio/dev/videos/${ID}/sortie.mp4`));
  await d.fichiers.enregistrer(fichier("fic-dossier", `studio/dev/audio-maitre/${ID}/voix.wav`));
  await d.fichiers.enregistrer(fichier("fic-biblio", "studio/dev/elements/el/vignette.jpg"));
  await d.fichiers.enregistrer(fichier("fic-commun", "studio/dev/videos/commun/x.mp4"));
  await d.fichiers.enregistrer(fichier("fic-image", "studio/dev/entree/image-video/fic-image.png"));
  const [sortie] = await d.sorties.lister((s) => s.videoId === ID);
  await d.sorties.modifier(sortie.id, { fichierId: "fic-exclusif", vignetteFichierId: "fic-commun" });
  const [autreSortie] = await d.sorties.lister((s) => s.videoId === AUTRE);
  await d.sorties.modifier(autreSortie.id, { vignetteFichierId: "fic-commun" });
  const [el] = await d.elements.lister();
  await d.elements.modifier(el.id, { vignetteFichierId: "fic-biblio" });
  const [plan] = await d.plans.lister((p) => p.videoId === ID);
  await d.plans.modifier(plan.id, { vignetteFichierId: "fic-biblio" });
  await d.videos.modifier(ID, { entrees: { ...v.entrees, imageVideo: { fichierId: "fic-image" } } });
  await d.pistes.enregistrer({ id: "pis-a", versionId, type: "audio-maitre", fichierId: "fic-dossier", fournisseur: "simulation", ...H });
  await d.pistes.enregistrer({ id: "pis-brouillon", versionId: `${ID}-brouillon`, type: "voix", fournisseur: "simulation", ...H });
  await d.pistes.enregistrer({ id: "pis-autre", versionId: autreVersion, type: "voix", fournisseur: "simulation", ...H });
  await d.travaux.enregistrer({ id: `iv-lanceur-${ID}`, type: "fabrication", cibleId: ID, versionId, titre: "t", etapes: [], statut: "termine", progression: 100, tentatives: 1, cleIdempotence: "k", fournisseurUtilise: "simulation", ...H });
  await d.travaux.enregistrer({ id: "trv-autre", type: "fabrication", cibleId: AUTRE, titre: "t", etapes: [], statut: "termine", progression: 100, tentatives: 1, cleIdempotence: "k2", fournisseurUtilise: "simulation", ...H });
  await d.tracesTableau.enregistrer({ id: `tr:${ID}:a`, videoId: ID } as never);
  await d.tracesTableau.enregistrer({ id: `tr:${AUTRE}:a`, videoId: AUTRE } as never);
  await d.tracesScriptsTableau.enregistrer({ id: "tst-a", videoId: ID } as never);
  await d.tracesScriptsTableau.enregistrer({ id: "tst-autre", videoId: AUTRE } as never);
  for (const cle of [`imageVideo.decisions.${ID}`, `facecam.fil.${ID}`, `modifications.${ID}`, `illustrations.rang.${ID}`, `credits.lancementPret.${ID}`, `casConcret.appel.ccecr-${ID}-ver-1-0.abc.1`, `imageVideo.decisions.${AUTRE}`, `modifications.${ID}x`]) {
    await d.parametres.enregistrer({ id: cle, valeur: true, ...H });
  }
  await d.parametres.enregistrer({ id: "optionsPayantes.demandes", valeur: [{ videoId: ID, n: 1 }, { videoId: AUTRE, n: 2 }], ...H });
  await d.idees.enregistrer({ id: "idee-a", videoId: ID, titre: "idée" } as never);
  await d.sessionsTournage.enregistrer({ id: "ses-a", prises: [{ varianteId: "var-x", partie: "corps", videoId: ID, le: H.creeLe }, { varianteId: "var-y", partie: "corps", videoId: AUTRE, le: H.creeLe }], ...H } as never);
  await d.variantes.enregistrer({ id: "var-a", code: "0001-AV-TT", scriptId: "script-gen", videoId: ID, controlesReels: { videoId: ID }, ...H } as never);
  await d.evenements.enregistrer({ id: "ev-a", type: "video", message: "m", entite: "video", entiteId: ID, date: H.creeLe, ...H });
  await d.reservations.enregistrer({ id: "res-a", fournisseur: "heygen", videoId: ID, centimes: 100, devise: "USD", statut: "consommee", ...H });
  // Script provisoire de la vidéo (écrit depuis son brouillon, marqué à sa création) : supprimé avec elle.
  await d.scripts.enregistrer({ ...(await d.scripts.obtenir(v.scriptId!))!, id: "script-provisoire", reference: false, favori: false, creePourVideoId: ID });
  await d.videos.modifier(ID, { scriptId: "script-provisoire" });
}

describe("suppression définitive · cascade", () => {
  it("efface tout ce qui n'existe que pour la vidéo, garde les dépenses, les fichiers partagés et l'autre vidéo", async () => {
    await semer();
    const d = depots();
    const effaces: string[] = [];
    vi.spyOn(stockageSimulation, "supprimer").mockImplementation(async (cle) => void effaces.push(cle));
    const depensesAvant = await d.depenses.lister((x) => x.videoId === ID);
    expect(depensesAvant.length).toBeGreaterThan(0);
    const [partage] = await d.partages.lister((p) => p.videoId === ID);
    const autreAvant = Object.fromEntries(Object.entries(await instantane()).filter(([, j]) => j.includes(`"${AUTRE}"`) || j.includes(`${AUTRE}`)));
    const scriptAvant = (await d.videos.obtenir(ID))!.scriptId;
    expect(scriptAvant).toBe("script-provisoire");

    expect(await videos.supprimerVideoDefinitivement(ID)).toBe(true);

    expect(await d.videos.obtenir(ID)).toBeNull();
    expect(await citations(ID)).toEqual([]);
    for (const c of ["versions", "plans", "retouches", "miniatures", "sousTitres", "sorties", "kits", "partages"] as const) {
      expect(await (d[c] as unknown as Depot<{ id: string; videoId?: string }>).compter((x) => x.videoId === ID), c).toBe(0);
    }
    expect(await d.pistes.obtenir("pis-a")).toBeNull();
    expect(await d.pistes.obtenir("pis-brouillon")).toBeNull();
    expect(await d.pistes.obtenir("pis-autre")).not.toBeNull();
    expect(await d.travaux.obtenir(`iv-lanceur-${ID}`)).toBeNull();
    expect(await d.scripts.obtenir("script-provisoire")).toBeNull();
    // Réglages : seuls ceux de CETTE vidéo partent (`modifications.v-01x` n'est pas à elle).
    expect(await d.parametres.obtenir(`imageVideo.decisions.${AUTRE}`)).not.toBeNull();
    expect(await d.parametres.obtenir(`modifications.${ID}x`)).not.toBeNull();
    expect((await d.parametres.obtenir("optionsPayantes.demandes"))!.valeur).toEqual([{ videoId: AUTRE, n: 2 }]);
    // Références retirées, objets gardés.
    expect(await d.idees.obtenir("idee-a")).toMatchObject({ id: "idee-a" });
    expect((await d.idees.obtenir("idee-a"))!.videoId).toBeUndefined();
    expect((await d.sessionsTournage.obtenir("ses-a"))!.prises).toEqual([
      { varianteId: "var-x", partie: "corps", le: H.creeLe },
      { varianteId: "var-y", partie: "corps", videoId: AUTRE, le: H.creeLe },
    ]);
    const variante = (await d.variantes.obtenir("var-a"))!;
    expect(variante.videoId).toBeUndefined();
    expect(variante.controlesReels).toBeUndefined();
    // Comptabilité gardée telle quelle.
    expect(await d.depenses.lister((x) => x.videoId === ID)).toEqual(depensesAvant);
    expect(await d.reservations.obtenir("res-a")).toMatchObject({ videoId: ID });
    // Fichiers : exclusifs effacés (base ET stockage), partagés gardés, démonstration jamais touchée.
    for (const f of ["fic-exclusif", "fic-dossier", "fic-image"]) expect(await d.fichiers.obtenir(f), f).toBeNull();
    for (const f of ["fic-biblio", "fic-commun"]) expect(await d.fichiers.obtenir(f), f).not.toBeNull();
    expect(effaces.sort()).toEqual([`studio/dev/audio-maitre/${ID}/voix.wav`, "studio/dev/entree/image-video/fic-image.png", `studio/dev/videos/${ID}/sortie.mp4`]);
    expect(await d.fichiers.compter((f) => f.origine === "demo")).toBe(await reinitialiserEtCompterDemo());
    // L'autre vidéo et tout ce qui la cite : intacts (sauf la liste partagée des demandes, réécrite sans la vidéo).
    const apres = await instantane();
    for (const [cle, json] of Object.entries(autreAvant)) if (cle !== "parametres/optionsPayantes.demandes" && cle !== "sessionsTournage/ses-a") expect(apres[cle], cle).toBe(json);
    // Une trace, sans contenu.
    const traces = await d.evenements.lister((e) => e.type === "video_supprimee");
    expect(traces).toHaveLength(1);
    expect(traces[0]).toMatchObject({ entite: "video", entiteId: ID });
    expect(traces[0].message).toMatch(/« .+ » \(avocat\), .+ dépensés/);
    // Le lien privé répond « plus actif » (410 via src/proxy.ts), pas « introuvable » (404).
    expect(await resoudrePartage(partage.code)).toEqual({ etat: "revoque" });
    expect(await resoudrePartage("zzzzzzzz")).toEqual({ etat: "introuvable" });
    const { GET } = await import("@/app/api/partages/[code]/route");
    const reponse = await GET(new Request("http://studio/api"), { params: Promise.resolve({ code: partage.code }) });
    // src/proxy.ts : `actif: false` sans `introuvable` → 410 « Ce lien n'est plus actif ».
    expect(await reponse.json()).toEqual({ actif: false, introuvable: false });
  });

  it("décisions D2/D3 : le journal de la vidéo et les publications DÉJÀ PUBLIÉES (avec leurs mesures) sont gardés ; les autres partent", async () => {
    const d = depots();
    await d.publications.enregistrer({ id: "pub-brouillon", videoId: ID, reseau: "tiktok", statut: "brouillon", via: "manuel", date: H.creeLe, texte: "t", ...H } as never);
    await d.publications.enregistrer({ id: "pub-echec", videoId: ID, reseau: "tiktok", statut: "echec", via: "manuel", date: H.creeLe, texte: "t", ...H } as never);
    await d.evenements.enregistrer({ id: "ev-a", type: "video", message: "m", entite: "video", entiteId: ID, date: H.creeLe, ...H });
    const publiees = await d.publications.lister((p) => p.videoId === ID && p.statut === "publiee");
    expect(publiees.length).toBeGreaterThan(0);
    expect(publiees.some((p) => (p.stats?.vues ?? 0) > 0)).toBe(true);
    await videos.supprimerVideoDefinitivement(ID);
    expect(await d.publications.lister((p) => p.videoId === ID && p.statut === "publiee")).toEqual(publiees);
    expect(await d.publications.obtenir("pub-brouillon")).toBeNull();
    expect(await d.publications.obtenir("pub-echec")).toBeNull();
    expect(await d.evenements.obtenir("ev-a")).not.toBeNull();
    expect(await d.evenements.compter((e) => e.type === "video_supprimee" && e.entiteId === ID)).toBe(1);
  });

  it("un script de « Mes scripts » (antérieur à la vidéo) ou utilisé ailleurs est gardé", async () => {
    const d = depots();
    const v = (await d.videos.obtenir(ID))!;
    await videos.supprimerVideoDefinitivement(ID);
    expect(await d.scripts.obtenir(v.scriptId!)).not.toBeNull();
  });

  it("les comptes tolèrent la vidéo absente : la dépense compte toujours", async () => {
    const { tableauCouts, resumeBudget } = await import("@/services/couts");
    const avant = await tableauCouts();
    await videos.supprimerVideoDefinitivement(ID);
    const apres = await tableauCouts();
    expect(apres.parOutil).toEqual(avant.parOutil);
    await expect(resumeBudget()).resolves.toBeTruthy();
  });

  it("idempotent : un 2e appel ne fait rien, sans erreur", async () => {
    await videos.supprimerVideoDefinitivement(ID);
    const avant = await instantane();
    expect(await videos.supprimerVideoDefinitivement(ID)).toBe(false);
    expect(await instantane()).toEqual(avant);
  });

  it("une panne du stockage n'empêche pas la suppression (dite au journal du serveur)", async () => {
    await semer();
    vi.spyOn(stockageSimulation, "supprimer").mockRejectedValue(new Error("R2 DELETE 500"));
    const journal = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await videos.supprimerVideoDefinitivement(ID)).toBe(true);
    expect(await depots().videos.obtenir(ID)).toBeNull();
    expect(journal).toHaveBeenCalled();
  });

  it("les fiches de scènes du tableau animé (R2, sans document « fichiers ») sont effacées du stockage", async () => {
    const d = depots();
    const v = (await d.videos.obtenir(ID))!;
    await d.videos.modifier(ID, { entrees: { ...v.entrees, tableauCreation: { versions: [{ numero: 1 }, { numero: 2 }] }, tableau: { ficheScenesCle: `studio/prod/fiches-scenes/${ID}/b2.json` } } });
    const effaces: string[] = [];
    vi.spyOn(stockageSimulation, "supprimer").mockImplementation(async (cle) => void effaces.push(cle));
    await videos.supprimerVideoDefinitivement(ID);
    expect(effaces.sort()).toEqual([`studio/dev/fiches-scenes/${ID}/b1.json`, `studio/dev/fiches-scenes/${ID}/b2.json`, `studio/prod/fiches-scenes/${ID}/b2.json`]);
  });

  it("les notifications qui mènent à la vidéo partent avec elle ; les autres restent", async () => {
    const d = depots();
    const n = (id: string, lien?: string) => d.notifications.enregistrer({ id, type: "info", titre: "t", lue: false, ...(lien ? { lien } : {}), ...H } as never);
    await n("not-a", `/videos/${ID}`);
    await n("not-b", `/videos/${ID}/publier`);
    await n("not-c", `/image-video/${ID}`);
    await n("not-d", `/videos/${ID}x`);
    await n("not-e", `/videos/${AUTRE}`);
    await n("not-f");
    await videos.supprimerVideoDefinitivement(ID);
    for (const id of ["not-a", "not-b", "not-c"]) expect(await d.notifications.obtenir(id), id).toBeNull();
    for (const id of ["not-d", "not-e", "not-f"]) expect(await d.notifications.obtenir(id), id).not.toBeNull();
  });

  it("deux suppressions simultanées (sous le verrou du studio) : une seule trace, la seconde ne fait rien", async () => {
    const [a, b] = await Promise.all([videos.supprimerVideoDefinitivement(ID), videos.supprimerVideoDefinitivement(ID)]);
    expect([a, b].sort()).toEqual([false, true]);
    expect(await depots().evenements.compter((e) => e.type === "video_supprimee" && e.entiteId === ID)).toBe(1);
  });

  it("le bail expiré du lanceur image → vidéo est oublié", async () => {
    expect(await prendreBail(`lanceur-image-video:${ID}`, "x", -1)).toBe(true);
    await videos.supprimerVideoDefinitivement(ID);
    // Oublié : un autre titulaire le prend aussitôt, même sans expiration.
    expect(await prendreBail(`lanceur-image-video:${ID}`, "y", 60_000)).toBe(true);
    // Rendu : un bail tenu refuse la suppression (lanceur vivant), il ne doit pas gêner les essais suivants.
    await rendreBail(`lanceur-image-video:${ID}`, "y");
  });
});

describe("suppression définitive · refus", () => {
  it("en fabrication : refusée, rien n'est effacé", async () => {
    const d = depots();
    await d.videos.modifier(ID, { statut: "en_fabrication" } satisfies Partial<Video>);
    const avant = await instantane();
    await expect(videos.supprimerVideoDefinitivement(ID)).rejects.toMatchObject({ code: "EN_FABRICATION", message: expect.stringMatching(/arrêtez-la d'abord/) });
    expect(await instantane()).toEqual(avant);
  });

  it("un travail en file pour la vidéo : refusée", async () => {
    await depots().travaux.enregistrer({ id: "trv-file", type: "fabrication", cibleId: ID, titre: "t", etapes: [], statut: "en_file", progression: 0, tentatives: 0, cleIdempotence: "k", fournisseurUtilise: "simulation", ...H });
    await expect(videos.supprimerVideoDefinitivement(ID)).rejects.toMatchObject({ code: "EN_FABRICATION" });
  });

  it("publication programmée : refusée avec un message clair ; un lot refusé n'efface aucune vidéo", async () => {
    // v-02 (démonstration) a deux publications programmées.
    await expect(videos.supprimerVideoDefinitivement("v-02")).rejects.toMatchObject({ code: "PUBLICATION_PROGRAMMEE", message: expect.stringMatching(/2 publications programmées : annulez-les d'abord/) });
    await expect(videos.supprimerVideosDefinitivement([ID, "v-02"])).rejects.toMatchObject({ code: "PUBLICATION_PROGRAMMEE" });
    expect(await depots().videos.obtenir(ID)).not.toBeNull();
  });

  it("plusieurs vidéos d'un coup", async () => {
    expect(await videos.supprimerVideosDefinitivement([ID, AUTRE, ID, "absente"])).toEqual({ supprimees: 2 });
    expect(await citations(ID)).toEqual([]);
    expect(await citations(AUTRE)).toEqual([]);
  });
});

async function reinitialiserEtCompterDemo(): Promise<number> {
  const { creerDonneesDemo } = await import("@/donnees/memoire/demo");
  return (creerDonneesDemo().fichiers ?? []).filter((f) => f.origine === "demo").length;
}
