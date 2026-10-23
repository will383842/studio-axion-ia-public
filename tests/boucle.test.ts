/**
 * LOT M1b — boucle de fond, file, reprise, « Arrêter », service de rendu (B.9 ter).
 * Tous les tests tournent sans clé ni réseau : moteur simulé (ou moteurs d'essai injectés), horloge simulée.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { MoteurVideo } from "@/moteurs";
import type { Travail } from "@/domaine/types";
import { apresPanne, ATTENTE_MAX_MS, calculerFile, DELAIS_REPRISE_MS, finEstimee, formaterHeure, minutesRestantes, RELANCE_ATTENTE_MS } from "@/domaine/suivi";
import { creerServiceRenduHttp, suivreRendu } from "@/fournisseurs/rendu/client";
import { creerServiceRenduSimule } from "@/fournisseurs/simulation/rendu";
import type { DemandeRendu } from "@/fournisseurs";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const travaux = await import("@/services/travaux");
const boucle = await import("@/services/boucle");
const { moteurSimulation } = await import("@/moteurs/simulation");
const { sousVerrou } = await import("@/services/_commun");

const MDP_TEST = "essai-boucle-123";

beforeAll(async () => {
  process.env.SESSION_SECRET = "b".repeat(48);
  const empreinte = await hash(MDP_TEST, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP_TEST, false);
});

afterEach(() => {
  boucle.arreterBoucle();
  vi.useRealTimers();
});

function travailDe(id: string): Promise<Travail> {
  return depots().travaux.obtenir(id).then((t) => t!);
}

/* ------------------------------------------------------------------ */
describe("boucle de fond : minuterie sans empilement", () => {
  it("tour de 12 s, minuterie de 5 s : une seule exécution à la fois, les tours en trop sont sautés", async () => {
    vi.useFakeTimers();
    let enCours = 0;
    let maximum = 0;
    let faits = 0;
    const tour = async () => {
      enCours++;
      maximum = Math.max(maximum, enCours);
      await new Promise((r) => setTimeout(r, 12_000));
      enCours--;
      faits++;
    };
    expect(boucle.demarrerBoucle({ intervalleMs: 5_000, tour })).toBe(true);
    // Une seule boucle par processus.
    expect(boucle.demarrerBoucle({ intervalleMs: 5_000, tour })).toBe(false);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(maximum).toBe(1);
    // 60 s / 12 s ≈ 5 tours faits ; les autres déclenchements (toutes les 5 s) ont été SAUTÉS, pas mis en file.
    expect(faits).toBeGreaterThanOrEqual(4);
    expect(faits).toBeLessThanOrEqual(5);
    expect(boucle.etatBoucle().toursSautes).toBeGreaterThan(0);
    boucle.arreterBoucle();
    const apres = faits;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(faits - apres).toBeLessThanOrEqual(1); // le tour déjà commencé se termine, rien d'autre
    expect(boucle.boucleActive()).toBe(false);
  });

  it("un appel direct pendant un tour est sauté (aucune mise en file)", async () => {
    let relacher!: () => void;
    const lent = boucle.executerTour(() => new Promise<void>((r) => (relacher = r)));
    expect(await boucle.executerTour(async () => undefined)).toEqual({ saute: true });
    relacher();
    expect(await lent).toEqual({ saute: false });
  });

  it("délai maximal : 90 s tant que la voix n'est pas faite, 30 s ensuite", () => {
    const t = { etapes: [{ cle: "voix", statut: "en_cours" }] } as unknown as Travail;
    expect(boucle.delaiPour(t)).toBe(90_000);
    expect(boucle.delaiPour({ etapes: [{ cle: "voix", statut: "terminee" }] } as unknown as Travail)).toBe(30_000);
  });
});

/* ------------------------------------------------------------------ */
describe("une fabrication avance SANS aucune lecture de page", () => {
  it("lancée, puis seulement des tours de boucle : la vidéo devient « prête », notification et miniatures créées", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const { travailId } = await fabrication.lancerFabrication("v-04", { confirme: true });
    for (let i = 0; i < 60 && (await travailDe(travailId)).statut !== "termine"; i++) {
      vi.setSystemTime(Date.now() + 5_000);
      await boucle.tourDeBoucle();
    }
    const t = await travailDe(travailId);
    expect(t.statut).toBe("termine");
    expect((await depots().videos.obtenir("v-04"))!.statut).toBe("prete");
    expect(await depots().notifications.trouver((n) => n.type === "video-prete" && n.lien === "/videos/v-04")).toBeTruthy();
    expect(await depots().miniatures.compter((m) => m.videoId === "v-04")).toBeGreaterThan(0);
    // Coût en direct : chaque étape terminée porte son coût réel.
    expect(t.etapes.filter((e) => e.statut === "terminee").every((e) => e.coutReel !== undefined)).toBe(true);
  });

  it("lire les travaux n'avance plus rien", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const { travailId } = await fabrication.lancerFabrication("v-04", { confirme: true });
    vi.setSystemTime(Date.now() + 10 * 60_000);
    await travaux.listerTravaux();
    await travaux.obtenirTravail(travailId);
    expect((await travailDe(travailId)).statut).toBe("en_file");
  });
});

/* ------------------------------------------------------------------ */
describe("« Arrêter » pendant un tour", () => {
  it("l'état annulé n'est jamais réécrit ; seules les étapes terminées sont payées ; le verrou reste libre pendant l'appel", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const { travailId } = await fabrication.lancerFabrication("v-04", { confirme: true });
    // La voix (≈ 6 s) se termine : une étape payée.
    vi.setSystemTime(Date.now() + 8_000);
    await boucle.tourDeBoucle();
    const avant = await travailDe(travailId);
    const terminees = avant.etapes.filter((e) => e.statut === "terminee");
    expect(terminees.length).toBeGreaterThan(0);
    const attendu = terminees.reduce((s, e) => s + (e.coutReel?.centimes ?? 0), 0);

    // Un moteur LENT pour ce travail : l'appel reste en suspens pendant qu'on arrête.
    let relacher!: (v: { travail: Travail }) => void;
    let signalerAppel!: () => void;
    const appel = new Promise<void>((r) => (signalerAppel = r));
    const lent: MoteurVideo = {
      ...moteurSimulation,
      async avancer(t, c, m) {
        if (t.id !== travailId) return moteurSimulation.avancer(t, c, m);
        signalerAppel();
        return new Promise((r) => (relacher = r));
      },
    };
    const tour = boucle.tourDeBoucle({ choisirMoteur: () => lent });
    await appel;
    // Aucun appel réseau sous le verrou : il est libre pendant que le fournisseur répond.
    await expect(sousVerrou(async () => "libre")).resolves.toBe("libre");
    const r = await travaux.annulerTravail(travailId);
    expect(r?.depense.centimes).toBe(attendu);
    relacher({ travail: { ...avant, statut: "en_cours", progression: 77, modifieLe: new Date(Date.now() + 1).toISOString() } });
    await tour;

    const apres = await travailDe(travailId);
    expect(apres.statut).toBe("annule");
    expect(apres.progression).not.toBe(77);
    expect((await depots().videos.obtenir("v-04"))!.statut).toBe("annulee");
    const depense = await depots().depenses.trouver((d) => d.travailId === travailId);
    expect(depense?.total.centimes).toBe(attendu);
    expect(depense?.lignes.every((l) => l.nature === "reel")).toBe(true);
    // Les tours suivants n'y touchent plus.
    vi.setSystemTime(Date.now() + 10 * 60_000);
    await boucle.tourDeBoucle();
    expect((await travailDe(travailId)).statut).toBe("annule");
  });

  it("le coût de la vidéo et de la version suit la dépense des étapes faites", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const avant = (await depots().videos.obtenir("v-04"))!.coutReel?.centimes ?? 0;
    const { travailId, versionId } = await fabrication.lancerFabrication("v-04", { confirme: true });
    vi.setSystemTime(Date.now() + 8_000);
    await boucle.tourDeBoucle();
    const r = await travaux.annulerTravail(travailId);
    expect((await depots().videos.obtenir("v-04"))!.coutReel?.centimes).toBe(avant + r!.depense.centimes);
    expect((await depots().versions.obtenir(versionId))!.statut).toBe("annulee");
  });
});

/* ------------------------------------------------------------------ */
describe("reprise automatique après une panne du fournisseur", () => {
  function moteurEnPanne(travailId: string, compteur: { n: number }, panne = true, definitive = false): MoteurVideo {
    return {
      ...moteurSimulation,
      async avancer(t, c, m) {
        if (t.id !== travailId || !panne) return moteurSimulation.avancer(t, c, m);
        compteur.n++;
        throw Object.assign(new Error("Service indisponible (503)"), { reessayable: !definitive });
      },
    };
  }

  it("3 essais espacés, puis « en attente du fournisseur » relancée toutes les 10 min, échec et notification après 24 h", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const { travailId } = await fabrication.lancerFabrication("v-04", { confirme: true });
    const appels = { n: 0 };
    const choisirMoteur = () => moteurEnPanne(travailId, appels);
    const tour = async (ms = 0) => {
      vi.setSystemTime(Date.now() + ms);
      await boucle.tourDeBoucle({ choisirMoteur });
    };

    await tour();
    expect(appels.n).toBe(1);
    expect((await travailDe(travailId)).reprise?.echecs).toBe(1);
    await tour(1_000); // trop tôt : pas d'appel
    expect(appels.n).toBe(1);
    await tour(DELAIS_REPRISE_MS[0]);
    expect(appels.n).toBe(2);
    await tour(DELAIS_REPRISE_MS[1]);
    expect(appels.n).toBe(3);
    await tour(DELAIS_REPRISE_MS[2]);
    expect(appels.n).toBe(4);
    const enAttente = await travailDe(travailId);
    expect(enAttente.reprise?.attenteDepuis).toBeTruthy();
    expect(enAttente.statut).not.toBe("echec");
    expect((await travaux.obtenirTravail(travailId))!.enAttenteFournisseur).toBe(true);
    await tour(5 * 60_000); // pas avant 10 min
    expect(appels.n).toBe(4);
    await tour(RELANCE_ATTENTE_MS);
    expect(appels.n).toBe(5);
    expect((await travailDe(travailId)).statut).not.toBe("echec");

    await tour(ATTENTE_MAX_MS);
    const echoue = await travailDe(travailId);
    expect(echoue.statut).toBe("echec");
    expect(echoue.erreur?.reessayable).toBe(true);
    expect(echoue.etapes.some((e) => e.statut === "echec")).toBe(true);
    expect((await depots().videos.obtenir("v-04"))!.statut).toBe("echec");
    expect(await depots().notifications.trouver((n) => n.type === "echec" && n.lien === "/videos/v-04")).toBeTruthy();

    // « Réessayer » reste possible (24 h plus tard : nouvelle connexion) ; quand l'outil revient, la fabrication repart.
    await auth.seConnecter(MDP_TEST, false);
    await travaux.reessayerTravail(travailId);
    expect((await travailDe(travailId)).reprise).toBeUndefined();
    for (let i = 0; i < 60 && (await travailDe(travailId)).statut !== "termine"; i++) {
      vi.setSystemTime(Date.now() + 5_000);
      await boucle.tourDeBoucle();
    }
    expect((await travailDe(travailId)).statut).toBe("termine");
  });

  it("un refus définitif (non réessayable) passe en échec tout de suite", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const { travailId } = await fabrication.lancerFabrication("v-04", { confirme: true });
    await boucle.tourDeBoucle({ choisirMoteur: () => moteurEnPanne(travailId, { n: 0 }, true, true) });
    const t = await travailDe(travailId);
    expect(t.statut).toBe("echec");
    expect(t.erreur?.code).toBe("FOURNISSEUR_REFUS");
  });

  it("une panne passagère : l'essai suivant réussit et efface la reprise", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const { travailId } = await fabrication.lancerFabrication("v-04", { confirme: true });
    await boucle.tourDeBoucle({ choisirMoteur: () => moteurEnPanne(travailId, { n: 0 }) });
    expect((await travailDe(travailId)).reprise?.echecs).toBe(1);
    vi.setSystemTime(Date.now() + DELAIS_REPRISE_MS[0]);
    await boucle.tourDeBoucle();
    expect((await travailDe(travailId)).reprise).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
describe("file d'attente", () => {
  it("2 vidéos en parallèle ; la 3ᵉ attend avec son rang et son heure de début ; « Passer devant » la fait passer", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const ids: string[] = [];
    for (const v of ["v-03", "v-04", "v-01"]) {
      // Les vidéos d'exemple ne prennent jamais de place dans la file : on les traite comme de vraies vidéos.
      await depots().videos.modifier(v, { estDemo: false });
      vi.setSystemTime(Date.now() + 10);
      ids.push((await fabrication.lancerFabrication(v, { confirme: true })).travailId);
    }
    const vues = await travaux.listerTravaux();
    const troisieme = vues.find((t) => t.id === ids[2])!;
    expect(troisieme.rang).toBe(1);
    expect(troisieme.debutVers).toMatch(/^\d{1,2} h \d{2}$/);
    expect(vues.find((t) => t.id === ids[0])!.rang).toBeUndefined();

    await travaux.rendreUrgent(ids[2]);
    const apres = await travaux.listerTravaux();
    expect(apres.find((t) => t.id === ids[2])!.rang).toBeUndefined();
    expect(apres.find((t) => t.id === ids[1])!.rang).toBe(1);

    // La boucle ne fait avancer que les 2 premiers ; le 3ᵉ attend.
    vi.setSystemTime(Date.now() + 2_000);
    await boucle.tourDeBoucle();
    expect((await travailDe(ids[1])).statut).toBe("en_file");
    expect((await travailDe(ids[2])).statut).toBe("en_cours");
  });

  it("calculerFile : un travail commencé garde sa place, les exemples ne prennent jamais de place", () => {
    const t = (id: string, statut: Travail["statut"], creeLe: string, extra: Partial<Travail> = {}) => ({ id, statut, creeLe, progression: 0, etapes: [], ...extra }) as unknown as Travail;
    const actifs = [t("a", "en_file", "2026-10-01T10:00:00Z"), t("b", "en_cours", "2026-10-01T10:05:00Z"), t("demo", "en_cours", "2026-10-01T09:00:00Z", { estDemo: true }), t("c", "en_file", "2026-10-01T10:01:00Z")];
    const { aAvancer, enAttente } = calculerFile(actifs, 2, Date.parse("2026-10-01T10:10:00Z"));
    expect(aAvancer.map((x) => x.id).sort()).toEqual(["a", "b", "demo"]);
    expect(enAttente.get("c")?.rang).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
describe("temps restant et reprise (fonctions pures)", () => {
  const T = Date.parse("2026-10-01T13:00:00Z");
  it("minutes restantes arrondies au-dessus, heure de fin à Paris", () => {
    const t = { statut: "en_cours", progression: 40, debuteLe: new Date(T - 60_000).toISOString(), finEstimee: new Date(T + 150_000).toISOString() } as unknown as Travail;
    expect(minutesRestantes(t, T)).toBe(3);
    expect(formaterHeure(T + 150_000)).toBe("15 h 02");
  });

  it("fin dépassée : extrapolée d'après le temps réellement passé", () => {
    const t = { statut: "en_cours", progression: 50, debuteLe: new Date(T - 4 * 60_000).toISOString(), finEstimee: new Date(T - 60_000).toISOString() } as unknown as Travail;
    expect(finEstimee(t, T)).toBe(T + 4 * 60_000);
  });

  it("apresPanne : 30 s, 2 min, 5 min, puis attente de 10 min, abandon après 24 h d'attente", () => {
    let r = apresPanne(undefined, T, "503");
    expect(Date.parse(r.reprise.prochainEssai) - T).toBe(30_000);
    r = apresPanne(r.reprise, T, "503");
    r = apresPanne(r.reprise, T, "503");
    expect(r.reprise.attenteDepuis).toBeUndefined();
    r = apresPanne(r.reprise, T, "503");
    expect(r.reprise.attenteDepuis).toBe(new Date(T).toISOString());
    expect(Date.parse(r.reprise.prochainEssai) - T).toBe(RELANCE_ATTENTE_MS);
    expect(r.abandon).toBe(false);
    expect(apresPanne(r.reprise, T + ATTENTE_MAX_MS - 1, "503").abandon).toBe(false);
    expect(apresPanne(r.reprise, T + ATTENTE_MAX_MS, "503").abandon).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
describe("service de rendu : reprise après un redémarrage de studio-rendu", () => {
  const demande: DemandeRendu = { idRendu: "rendu-v04-voix-1", operation: "nettoyage-audio", file: "courte", entrees: { audio: "https://r2/signee" }, sortie: { urlDepot: "https://r2/depot", cle: "studio/dev/pistes/v-04/audio.mp3" }, parametres: {} };

  it("404 de studio-rendu : la même demande est soumise à nouveau, avec le MÊME idRendu", async () => {
    const appels: { methode: string; url: string; corps?: string }[] = [];
    const fetchFaux = (async (url: string, init?: RequestInit) => {
      appels.push({ methode: init?.method ?? "GET", url, corps: init?.body as string | undefined });
      if ((init?.method ?? "GET") === "GET") return new Response("introuvable", { status: 404 });
      return Response.json({ idRendu: JSON.parse(init!.body as string).idRendu }, { status: 202 });
    }) as typeof fetch;
    const service = creerServiceRenduHttp("http://studio-rendu:4100/", { fetch: fetchFaux, cle: "secret-interne" });
    const etat = await suivreRendu(service, demande);
    expect(etat).toMatchObject({ statut: "en_file", resoumis: true });
    expect(appels.map((a) => a.methode)).toEqual(["GET", "POST"]);
    expect(appels[0].url).toBe("http://studio-rendu:4100/rendus/rendu-v04-voix-1");
    expect(JSON.parse(appels[1].corps!).idRendu).toBe(demande.idRendu);
  });

  it("service simulé : oublié au redémarrage, resoumis, puis terminé ; 5xx = panne réessayable", async () => {
    let maintenant = 1_000_000;
    const s = creerServiceRenduSimule(() => maintenant);
    await s.soumettre(demande);
    s.oublierTout();
    expect(await s.etat(demande.idRendu)).toEqual({ statut: "inconnu" });
    expect((await suivreRendu(s, demande)).resoumis).toBe(true);
    expect(s.soumissions(demande.idRendu)).toBe(2);
    maintenant += 3_000;
    expect(await suivreRendu(s, demande)).toEqual({ statut: "termine", sortieCle: demande.sortie.cle });

    const enPanne = creerServiceRenduHttp("http://studio-rendu:4100", { fetch: (async () => new Response("", { status: 503 })) as unknown as typeof fetch });
    await expect(enPanne.etat("x")).rejects.toMatchObject({ reessayable: true });
  });
});
