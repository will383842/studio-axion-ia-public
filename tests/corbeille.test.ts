/**
 * CORBEILLE 30 JOURS (décision de Will du 18/10) : « Mettre à la corbeille » ne supprime rien ; la vidéo est RESTAURABLE
 * pendant 30 jours puis supprimée pour de bon. Horloge simulée (Date seule), dépôts en mémoire, stockage simulé : aucun
 * appel réel, rien de payé.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { compteursMesVideos, videosDeToutes } from "@/domaine/mes-videos";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const videos = await import("@/services/videos");
const corbeille = await import("@/services/corbeille");
const { resoudrePartage } = await import("@/services/partages");
const { stockageSimulation, deposerObjetSimule, objetsSimulesRestants, viderObjetsSimules } = await import("@/fournisseurs/simulation/autres");
import type { Depot, Depots } from "@/domaine/depots";

const MDP_TEST = "essai-corbeille-123";
const ID = "v-01";
const AUTRE = "v-03";
const JOUR = 86_400_000;
const H = { creeLe: "2026-10-01T00:00:00.000Z", modifieLe: "2026-10-01T00:00:00.000Z" };
const fetchInterdit = () => Promise.reject(new Error("fetch interdit dans les tests"));
let t0 = 0;

beforeAll(async () => {
  process.env.SESSION_SECRET = "s".repeat(48);
  const empreinte = await hash(MDP_TEST, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  viderObjetsSimules();
  vi.restoreAllMocks();
  vi.stubGlobal("fetch", fetchInterdit);
  await auth.seConnecter(MDP_TEST, false);
  t0 = Date.now();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(t0);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const apres = (jours: number, plusMs = 0) => vi.setSystemTime(t0 + jours * JOUR + plusMs);

/** Tout ce qui, dans la base, cite encore une vidéo (hors dépenses, réservations, trace de suppression). */
async function citations(videoId: string): Promise<string[]> {
  const d = depots();
  const res: string[] = [];
  for (const c of Object.keys(d) as (keyof Depots)[]) {
    if (c === "depenses" || c === "reservations") continue;
    for (const e of await (d[c] as unknown as Depot<{ id: string; type?: string; origine?: string }>).lister()) {
      // Gardés exprès (décisions D2/D3 de Will, #484) : tout le journal de la vidéo, les publications déjà publiées.
      if (c === "evenements") continue;
      if (c === "publications" && (e as unknown as { statut: string }).statut === "publiee") continue;
      if (c === "fichiers" && e.origine === "demo") continue;
      if (c === "modeles") continue; // le modèle vit sans la vidéo (`creeDepuisVideoId`), comme pour la suppression définitive
      if (JSON.stringify(e).includes(`"${videoId}"`) || e.id.endsWith(`.${videoId}`) || e.id.includes(`-${videoId}`)) res.push(`${c}/${e.id}`);
    }
  }
  return res;
}

async function codePartage(): Promise<string> {
  const [p] = await depots().partages.lister((x) => x.videoId === ID);
  return p.code;
}

describe("mettre à la corbeille", () => {
  it("absente de Toutes, de la fiche du format et d'Archivées, présente dans la Corbeille ; partage en 410 ; rien d'effacé", async () => {
    const code = await codePartage();
    expect((await resoudrePartage(code, { compterVue: false })).etat).toBe("ok");
    const formatId = (await depots().videos.obtenir(ID))!.formatId;
    await corbeille.mettreALaCorbeille([ID]);

    const v = (await depots().videos.obtenir(ID))!;
    expect(v.statut).toBe("archivee");
    expect(v.statutAvantArchive).toBe("prete");
    expect(v.corbeilleLe).toBe(new Date(t0).toISOString());
    expect((await videos.listerVideos()).some((c) => c.id === ID)).toBe(false);
    expect((await videos.listerVideos({ formatId })).some((c) => c.id === ID)).toBe(false);
    expect((await videos.listerVideos({ statut: "archivee" })).some((c) => c.id === ID)).toBe(false);
    expect((await videos.compterVideosParFormat())[formatId]).toBe((await videos.listerVideos({ formatId })).length);
    const dedans = await corbeille.listerCorbeille();
    expect(dedans.map((c) => c.id)).toEqual([ID]);
    expect(dedans[0].joursRestants).toBe(30);
    // Les compteurs de l'écran : la corbeille n'est ni dans Toutes ni dans Archivées.
    const lignes = [{ statut: "archivee", corbeilleLe: v.corbeilleLe, format: { id: formatId } }, { statut: "archivee", format: { id: formatId } }, { statut: "prete", format: { id: formatId } }];
    const c = compteursMesVideos(lignes, [formatId]);
    expect(c).toMatchObject({ toutes: 1, archivees: 1, corbeille: 1 });
    expect(c.parFormat[formatId]).toBe(1);
    expect(videosDeToutes(lignes)).toHaveLength(1);
    expect((await resoudrePartage(code, { compterVue: false })).etat).toBe("revoque");
    // Rien n'est effacé : la vidéo garde sa version, sa sortie, son lien.
    expect(await depots().sorties.compter((s) => s.videoId === ID)).toBeGreaterThan(0);
    expect(await depots().partages.compter((p) => p.videoId === ID)).toBe(1);
  });

  it("retire la copie du site avant de la mettre de côté", async () => {
    const site = await import("@/services/site-videos");
    const retrait = vi.spyOn(site, "retirerAvantSuppression").mockResolvedValue(undefined);
    await corbeille.mettreALaCorbeille([ID]);
    expect(retrait).toHaveBeenCalledWith([ID]);
  });

  it("refuse une fabrication en cours et une publication programmée, sans rien changer", async () => {
    const d = depots();
    await d.publications.enregistrer({ id: "pub-a", videoId: ID, reseau: "tiktok", statut: "programmee", date: new Date(t0 + 3 * JOUR).toISOString(), ...H } as never);
    await expect(corbeille.mettreALaCorbeille([ID])).rejects.toMatchObject({ code: "PUBLICATION_PROGRAMMEE" });
    await d.publications.supprimer("pub-a");
    await d.videos.modifier(AUTRE, { statut: "en_fabrication" });
    await expect(corbeille.mettreALaCorbeille([ID, AUTRE])).rejects.toMatchObject({ code: "EN_FABRICATION" });
    expect((await d.videos.obtenir(ID))!.corbeilleLe).toBeUndefined();
    expect((await d.videos.obtenir(ID))!.statut).not.toBe("archivee");
  });

  it("dit combien de brouillons restent dans Buffer", async () => {
    await depots().publications.enregistrer({ id: "pub-b", videoId: ID, reseau: "tiktok", statut: "brouillon", via: "buffer", idExterne: "buf-1", date: new Date(t0 + JOUR).toISOString(), ...H } as never);
    const r = await corbeille.mettreALaCorbeille([ID]);
    expect(r).toMatchObject({ mises: 1, brouillonsBuffer: 1 });
  });

  it("exige une session", async () => {
    await auth.seDeconnecter();
    reinitialiserRequete();
    await expect(corbeille.mettreALaCorbeille([ID])).rejects.toBeTruthy();
    await expect(corbeille.restaurerDeLaCorbeille([ID])).rejects.toBeTruthy();
    await expect(corbeille.viderCorbeille([ID])).rejects.toBeTruthy();
  });
});

describe("restaurer", () => {
  it("rétablit le statut d'avant, retire la date et réactive le lien", async () => {
    const code = await codePartage();
    await corbeille.mettreALaCorbeille([ID]);
    apres(0, 5 * 60_000);
    await corbeille.restaurerDeLaCorbeille([ID]);
    const v = (await depots().videos.obtenir(ID))!;
    expect(v.statut).toBe("prete");
    expect(v.corbeilleLe).toBeUndefined();
    expect(v.statutAvantArchive).toBeUndefined();
    expect((await resoudrePartage(code, { compterVue: false })).etat).toBe("ok");
    expect((await videos.listerVideos()).some((c) => c.id === ID)).toBe(true);
    expect(await corbeille.listerCorbeille()).toEqual([]);
  });
});

describe("vider la corbeille (suppression définitive manuelle)", () => {
  it("ne supprime que les vidéos de la corbeille : une archivée simple reste", async () => {
    await corbeille.mettreALaCorbeille([ID]);
    await depots().videos.modifier(AUTRE, { statut: "archivee", statutAvantArchive: "prete" });
    const r = await corbeille.viderCorbeille([ID, AUTRE]);
    expect(r.supprimees).toBe(1);
    expect(await depots().videos.obtenir(ID)).toBeNull();
    expect(await depots().videos.obtenir(AUTRE)).not.toBeNull();
  });
});

describe("purge automatique", () => {
  async function avecObjets() {
    deposerObjetSimule(`studio/dev/videos/${ID}/sortie.mp4`);
    const d = depots();
    await d.fichiers.enregistrer({ id: "fic-corb", cleStockage: `studio/dev/videos/${ID}/sortie.mp4`, nom: "s.mp4", mime: "video/mp4", taille: 1, origine: "fabrication", statut: "pret", ...H });
    const [sortie] = await d.sorties.lister((s) => s.videoId === ID);
    await d.sorties.modifier(sortie.id, { fichierId: "fic-corb" });
  }

  it("à 29 jours rien ; à 30 jours + 1 s la vidéo est supprimée, sans orphelin", async () => {
    await avecObjets();
    await corbeille.mettreALaCorbeille([ID]);
    apres(29, 23 * 3_600_000);
    expect(await corbeille.purgerCorbeille()).toMatchObject({ supprimees: 0 });
    expect(await depots().videos.obtenir(ID)).not.toBeNull();
    apres(30, 1000);
    expect(await corbeille.purgerCorbeille()).toMatchObject({ supprimees: 1 });
    expect(await depots().videos.obtenir(ID)).toBeNull();
    expect(await citations(ID)).toEqual([]);
    expect(objetsSimulesRestants().filter((c) => c.includes(`/${ID}/`))).toEqual([]);
    expect(await depots().videos.obtenir(AUTRE)).not.toBeNull();
  });

  it("n'a pas besoin de session", async () => {
    await corbeille.mettreALaCorbeille([ID]);
    await auth.seDeconnecter();
    reinitialiserRequete();
    apres(31);
    expect(await corbeille.purgerCorbeille()).toMatchObject({ supprimees: 1 });
  });

  it("au plus une fois par heure", async () => {
    await corbeille.mettreALaCorbeille([ID]);
    apres(10);
    await corbeille.purgerCorbeille();
    apres(31);
    await depots().parametres.enregistrer({ id: "corbeille.dernierPassage", valeur: new Date(t0 + 31 * JOUR - 30 * 60_000).toISOString(), ...H });
    expect(await corbeille.purgerCorbeille()).toMatchObject({ supprimees: 0, saute: true });
    expect(await depots().videos.obtenir(ID)).not.toBeNull();
    apres(31, 31 * 60_000);
    expect(await corbeille.purgerCorbeille()).toMatchObject({ supprimees: 1 });
  });

  it("une archivée SANS date de corbeille, vieille d'un an, reste intacte", async () => {
    const d = depots();
    await d.videos.modifier(AUTRE, { statut: "archivee", statutAvantArchive: "prete", modifieLe: new Date(t0 - 365 * JOUR).toISOString() });
    apres(400);
    expect(await corbeille.purgerCorbeille()).toMatchObject({ supprimees: 0 });
    const v = (await d.videos.obtenir(AUTRE))!;
    expect(v.statut).toBe("archivee");
    expect(v.statutAvantArchive).toBe("prete");
    expect(await d.sorties.compter((s) => s.videoId === AUTRE)).toBeGreaterThan(0);
  });

  it("un refus (publication programmée) garde la vidéo et ne notifie qu'UNE fois", async () => {
    const d = depots();
    await corbeille.mettreALaCorbeille([ID]);
    await d.publications.enregistrer({ id: "pub-c", videoId: ID, reseau: "tiktok", statut: "programmee", date: new Date(t0 + 60 * JOUR).toISOString(), ...H } as never);
    apres(31);
    expect(await corbeille.purgerCorbeille()).toMatchObject({ supprimees: 0, refusees: 1 });
    apres(31, 2 * 3_600_000);
    await corbeille.purgerCorbeille();
    apres(32);
    await corbeille.purgerCorbeille();
    expect(await d.videos.obtenir(ID)).not.toBeNull();
    expect(await d.notifications.compter((n) => n.lien === `/videos/${ID}`)).toBe(1);
  });

  it("traite par paquets de 10", async () => {
    const d = depots();
    const modele = (await d.videos.obtenir(AUTRE))!;
    for (let i = 0; i < 12; i++) await d.videos.enregistrer({ ...modele, id: `v-corb-${i}`, versionChoisieId: undefined, statut: "archivee", statutAvantArchive: "brouillon", corbeilleLe: new Date(t0 - 40 * JOUR).toISOString() });
    expect(await corbeille.purgerCorbeille()).toMatchObject({ supprimees: 10 });
    expect(await d.videos.compter((v) => v.id.startsWith("v-corb-"))).toBe(2);
  });
});

describe("restauration pendant la purge", () => {
  it("une vidéo restaurée pendant que les précédentes sont effacées reste", async () => {
    const d = depots();
    const modele = (await d.videos.obtenir(AUTRE))!;
    for (const i of [1, 2]) await d.videos.enregistrer({ ...modele, id: `v-rest-${i}`, versionChoisieId: undefined, statut: "archivee", statutAvantArchive: "brouillon", corbeilleLe: new Date(t0 - (40 - i) * JOUR).toISOString() });
    // Will restaure la 2e au moment où la 1re est effacée (appels réseau entre deux effacements).
    const supprimer = d.videos.supprimer.bind(d.videos);
    vi.spyOn(d.videos, "supprimer").mockImplementation(async (id: string) => {
      const r = await supprimer(id);
      // Sans l'attendre : la restauration prend le verrou, que la purge tient pendant cet effacement.
      if (id === "v-rest-1") restauration = corbeille.restaurerDeLaCorbeille(["v-rest-2"]);
      return r;
    });
    let restauration: Promise<{ restaurees: number }> | undefined;
    await corbeille.purgerCorbeille();
    const rendu = await restauration!;
    expect(await d.videos.obtenir("v-rest-1")).toBeNull();
    // Selon qui prend le verrou en premier, la 2e est restaurée (et reste) ou déjà effacée (restaurées = 0) : jamais « restaurée » puis effacée.
    if (rendu.restaurees === 1) expect(await d.videos.obtenir("v-rest-2")).toMatchObject({ statut: "brouillon" });
    else expect(await d.videos.obtenir("v-rest-2")).toBeNull();
  });

  // Relecture #479 2e tour, A : la restauration prend le verrou. Quel que soit l'instant (lecture n° k de la purge), « restaurée » ne ment jamais.
  it.each([1, 2, 3, 4, 5, 6])("restauration lancée pendant la lecture n°%i de la purge : « restaurée » ⇒ la vidéo existe", async (k) => {
    const d = depots();
    const modele = (await d.videos.obtenir(AUTRE))!;
    await d.videos.enregistrer({ ...modele, id: "v-pur", versionChoisieId: undefined, statut: "archivee", statutAvantArchive: "brouillon", corbeilleLe: new Date(t0 - 40 * JOUR).toISOString() });
    const compter = d.publications.compter.bind(d.publications);
    let appels = 0;
    let restauration: Promise<{ restaurees: number }> | undefined;
    vi.spyOn(d.publications, "compter").mockImplementation(async (...a: Parameters<typeof compter>) => {
      if (++appels === k) {
        restauration = corbeille.restaurerDeLaCorbeille(["v-pur"]);
        // Laisse 100 ms à la restauration : sans verrou elle aboutit ICI, en pleine vérification de la purge.
        await Promise.race([restauration, new Promise((r) => setTimeout(r, 100))]);
      }
      return compter(...a);
    });
    await corbeille.purgerCorbeille();
    const rendu = restauration ? await restauration : { restaurees: 0 };
    const reste = await d.videos.obtenir("v-pur");
    if (rendu.restaurees === 1) expect(reste, "restaurée annoncée ⇒ la vidéo existe").toMatchObject({ statut: "brouillon" });
    else expect(reste === null || reste.statut === "archivee").toBe(true);
  });

  it("desarchiverVideo lancée pendant la purge : si elle a rendu le statut, la vidéo existe", async () => {
    const d = depots();
    const modele = (await d.videos.obtenir(AUTRE))!;
    await d.videos.enregistrer({ ...modele, id: "v-pur2", versionChoisieId: undefined, statut: "archivee", statutAvantArchive: "brouillon", corbeilleLe: new Date(t0 - 40 * JOUR).toISOString() });
    const compter = d.publications.compter.bind(d.publications);
    let appels = 0;
    let restauration: Promise<boolean> | undefined;
    let rendue = false;
    vi.spyOn(d.publications, "compter").mockImplementation(async (...a: Parameters<typeof compter>) => {
      if (++appels === 3) {
        restauration = videos.desarchiverVideo("v-pur2");
        await Promise.race([restauration, new Promise((r) => setTimeout(r, 100))]);
        rendue = (await d.videos.obtenir("v-pur2"))?.statut === "brouillon";
      }
      return compter(...a);
    });
    await corbeille.purgerCorbeille();
    await restauration;
    if (rendue) expect(await d.videos.obtenir("v-pur2"), "statut rendu ⇒ la vidéo n'est pas effacée").toMatchObject({ statut: "brouillon" });
  });

  it("la garde sous le verrou : une vidéo qui n'est plus à la corbeille n'est pas effacée", async () => {
    const { supprimerVideosSansSession } = videos;
    expect(await supprimerVideosSansSession([AUTRE], { garde: (v) => v.statut === "archivee" && !!v.corbeilleLe })).toEqual({ supprimees: 0 });
    expect(await depots().videos.obtenir(AUTRE)).not.toBeNull();
  });

  it("archivée, puis corbeille, puis restaurée : retrouve le statut d'avant l'archivage", async () => {
    await videos.archiverVideos([ID]);
    expect((await depots().videos.obtenir(ID))!.statutAvantArchive).toBe("prete");
    await corbeille.mettreALaCorbeille([ID]);
    await corbeille.restaurerDeLaCorbeille([ID]);
    expect(await depots().videos.obtenir(ID)).toMatchObject({ statut: "prete", corbeilleLe: undefined, statutAvantArchive: undefined });
  });

  it("restaurer par le bandeau efface aussi la trace du refus notifié", async () => {
    const d = depots();
    await corbeille.mettreALaCorbeille([ID]);
    await d.parametres.enregistrer({ id: `corbeille.refusNotifie.${ID}`, valeur: new Date().toISOString(), ...H });
    await videos.desarchiverVideo(ID);
    expect(await d.parametres.obtenir(`corbeille.refusNotifie.${ID}`)).toBeNull();
  });
});

describe("refus durables", () => {
  it("dix vidéos refusées ne bloquent pas les autres (elles passent après), chacune retentée une fois par passage au plus", async () => {
    const d = depots();
    const modele = (await d.videos.obtenir(AUTRE))!;
    for (let i = 0; i < 10; i++) {
      await d.videos.enregistrer({ ...modele, id: `v-ref-${i}`, versionChoisieId: undefined, statut: "archivee", statutAvantArchive: "brouillon", corbeilleLe: new Date(t0 - 90 * JOUR).toISOString() });
      await d.publications.enregistrer({ id: `pub-ref-${i}`, videoId: `v-ref-${i}`, reseau: "tiktok", statut: "programmee", date: new Date(t0 + 60 * JOUR).toISOString(), ...H } as never);
      await d.parametres.enregistrer({ id: `corbeille.refusNotifie.v-ref-${i}`, valeur: new Date(t0 - JOUR).toISOString(), ...H });
    }
    await d.videos.enregistrer({ ...modele, id: "v-ok", versionChoisieId: undefined, statut: "archivee", statutAvantArchive: "brouillon", corbeilleLe: new Date(t0 - 31 * JOUR).toISOString() });
    expect(await corbeille.purgerCorbeille()).toMatchObject({ supprimees: 1, refusees: 9 });
    expect(await d.videos.obtenir("v-ok")).toBeNull();
  });
});

describe("lot d'images vers vidéo", () => {
  it("une vidéo mise à la corbeille est mise de côté : rien n'est lancé ni payé", async () => {
    const lot = await import("@/services/image-video-lot");
    expect(typeof lot.avancerLotsIV).toBe("function");
    expect(lot.videoEcartee).toBeTypeOf("function");
    await corbeille.mettreALaCorbeille([ID]);
    expect(await lot.videoEcartee(ID)).toBe(true);
    expect(await lot.videoEcartee(AUTRE)).toBe(false);
    expect(await lot.videoEcartee("v-inconnue")).toBe(true);
    expect(stockageSimulation).toBeTruthy();
  });
});

describe("relecture #479 · garde-fous", () => {
  it("défaut 1 : une vidéo restaurée pendant la purge n'est JAMAIS effacée", async () => {
    const d = depots();
    await corbeille.mettreALaCorbeille([ID]);
    const site = await import("@/services/site-videos");
    // Will restaure la vidéo pendant que la purge efface les précédentes (appel réseau avant le verrou).
    vi.spyOn(site, "retirerAvantSuppression").mockImplementation(async () => {
      await d.videos.modifier(ID, { statut: "prete", statutAvantArchive: undefined, corbeilleLe: undefined });
    });
    apres(31);
    expect(await corbeille.purgerCorbeille()).toMatchObject({ supprimees: 0, refusees: 0 });
    expect((await d.videos.obtenir(ID))!.statut).toBe("prete");
    expect(await d.sorties.compter((s) => s.videoId === ID)).toBeGreaterThan(0);
  });

  it("défaut 1 : « Supprimer définitivement » ne prend pas une vidéo restaurée entre-temps", async () => {
    const d = depots();
    await corbeille.mettreALaCorbeille([ID]);
    const site = await import("@/services/site-videos");
    vi.spyOn(site, "retirerAvantSuppression").mockImplementation(async () => {
      await d.videos.modifier(ID, { statut: "prete", statutAvantArchive: undefined, corbeilleLe: undefined });
    });
    expect(await corbeille.viderCorbeille([ID])).toMatchObject({ supprimees: 0 });
    expect(await d.videos.obtenir(ID)).not.toBeNull();
  });

  it("défaut 4 : l'ancienne suppression immédiate n'est plus une action du serveur", async () => {
    const actions = await import("@/app/(studio)/videos/actions");
    expect((actions as Record<string, unknown>).supprimerVideosAction).toBeUndefined();
    expect(typeof actions.viderCorbeilleAction).toBe("function");
  });

  it("défaut 5 : restaurer par le bandeau (désarchiver) efface aussi la note « refus déjà notifié »", async () => {
    const d = depots();
    await corbeille.mettreALaCorbeille([ID]);
    await d.parametres.enregistrer({ id: `corbeille.refusNotifie.${ID}`, valeur: "x", ...H });
    await videos.desarchiverVideo(ID);
    expect(await d.parametres.obtenir(`corbeille.refusNotifie.${ID}`)).toBeNull();
    expect((await d.videos.obtenir(ID))!.corbeilleLe).toBeUndefined();
  });

  it("défaut 6 : dit quand la page du site a été retirée", async () => {
    const d = depots();
    const site = await import("@/services/site-videos");
    const kit = await d.kits.trouver((k) => k.videoId === ID);
    if (!kit) throw new Error("kit de démonstration attendu");
    await d.kits.modifier(kit.id, { site: { etat: "en-ligne", fichiersPublics: [] } } as never);
    // Le retrait du site (appel réseau réel hors test) : la page n'est plus en ligne après lui.
    vi.spyOn(site, "retirerAvantSuppression").mockImplementation(async () => void (await d.kits.modifier(kit.id, { site: { etat: "retiree", fichiersPublics: [] } } as never)));
    expect(await corbeille.mettreALaCorbeille([ID])).toMatchObject({ mises: 1, pagesRetirees: 1 });
    const { messageCorbeille } = await import("@/domaine/corbeille");
    expect(messageCorbeille(1, 0, 1)).toBe("Vidéo mise à la corbeille. Restaurable pendant 30 jours. La page du site est retirée : à republier après la restauration.");
    expect(messageCorbeille(1, 0, 0)).not.toMatch(/site/);
  });

  it("défaut 7 : des refus durables ne bloquent pas les autres vidéos échues", async () => {
    const d = depots();
    const modele = (await d.videos.obtenir(AUTRE))!;
    for (let i = 0; i < 10; i++) {
      await d.videos.enregistrer({ ...modele, id: `v-refus-${i}`, versionChoisieId: undefined, statut: "archivee", statutAvantArchive: "brouillon", corbeilleLe: new Date(t0 - (60 + i) * JOUR).toISOString() });
      await d.parametres.enregistrer({ id: `corbeille.refusNotifie.v-refus-${i}`, valeur: "x", ...H });
      await d.publications.enregistrer({ id: `pub-refus-${i}`, videoId: `v-refus-${i}`, reseau: "tiktok", statut: "programmee", date: new Date(t0 + 90 * JOUR).toISOString(), ...H } as never);
    }
    await d.videos.enregistrer({ ...modele, id: "v-recente", versionChoisieId: undefined, statut: "archivee", statutAvantArchive: "brouillon", corbeilleLe: new Date(t0 - 31 * JOUR).toISOString() });
    expect(await corbeille.purgerCorbeille()).toMatchObject({ supprimees: 1 });
    expect(await d.videos.obtenir("v-recente")).toBeNull();
  });

  it("archivée, puis mise à la corbeille, puis restaurée : le statut d'avant l'archivage revient", async () => {
    const d = depots();
    await videos.archiverVideos([ID]);
    expect((await d.videos.obtenir(ID))!.statutAvantArchive).toBe("prete");
    await corbeille.mettreALaCorbeille([ID]);
    expect((await d.videos.obtenir(ID))!.statutAvantArchive).toBe("prete");
    await corbeille.restaurerDeLaCorbeille([ID]);
    expect((await d.videos.obtenir(ID))!.statut).toBe("prete");
  });
});

describe("relecture #479, 2e tour", () => {
  it("A : la restauration prend le verrou : jamais « restaurée » pour une vidéo que la purge efface", async () => {
    const d = depots();
    // Déjà échue (sans voyage dans le temps : la session de Will doit rester valable pour « Restaurer »).
    await d.videos.modifier(ID, { statut: "archivee", statutAvantArchive: "prete", corbeilleLe: new Date(t0 - 31 * JOUR).toISOString() });
    // Pendant une lecture de la purge SOUS verrou, Will clique « Restaurer » (sans attendre).
    const vraie = d.publications.compter.bind(d.publications);
    let restauration: Promise<{ restaurees: number }> | null = null;
    let appels = 0;
    // 1er contrôle des refus : avant le verrou (appels 1 et 2) ; le 2e, SOUS le verrou, commence à l'appel 3.
    vi.spyOn(d.publications, "compter").mockImplementation(async (filtre?: Parameters<typeof vraie>[0]) => {
      if (++appels === 3) {
        restauration = corbeille.restaurerDeLaCorbeille([ID]);
        // Sans verrou, la restauration aboutit ici même ; avec le verrou, elle attend la fin de la purge (délai réel, seul `Date` est simulé).
        await Promise.race([restauration, new Promise((fin) => setTimeout(fin, 150))]);
      }
      return vraie(filtre);
    });
    await corbeille.purgerCorbeille();
    expect(restauration).not.toBeNull();
    const r = await restauration!;
    const existe = (await d.videos.obtenir(ID)) !== null;
    // Cohérence : « restaurée » seulement si la vidéo existe, et prête.
    expect(r.restaurees === 1).toBe(existe);
    if (existe) expect((await d.videos.obtenir(ID))!.statut).toBe("prete");
  });

  it("A : la restauration d'une vidéo disparue est dite comme telle (aucune « Vidéo restaurée » pour rien)", async () => {
    const actions = await import("@/app/(studio)/videos/actions");
    const r = await actions.restaurerDeLaCorbeilleAction(["v-inconnue"]);
    expect(r.ok).toBe(false);
  });

  it("B : la note « page du site non remise » n'est montrée que pour une vidéo venue de la corbeille", async () => {
    const { noteRestauration } = await import("@/domaine/corbeille");
    expect(noteRestauration("2026-10-01T00:00:00.000Z")).toMatch(/page du site/);
    expect(noteRestauration(undefined)).toBe("");
    const { readFileSync } = await import("node:fs");
    for (const f of ["src/components/videos/BandeauArchivee.tsx", "src/components/videos/EnTeteVideo.tsx", "src/components/videos/GalerieVideos.tsx"]) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/\$\{NOTE_RESTAURATION\}/);
    }
  });
});

