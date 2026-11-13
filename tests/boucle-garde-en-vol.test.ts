/**
 * GV2-01 : chien de garde commun. Un appel qui ne revient jamais finit par un échec clair (il ne garde plus sa place
 * dans la file), une lecture de voix en vol n'est JAMAIS relancée, un refus tardif est écrit, un travail qui lève ne
 * fait pas tomber le tour. Aucun appel réel : moteurs d'essai, horloge simulée (Date seulement).
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { MoteurVideo } from "@/moteurs";
import type { Travail } from "@/domaine/types";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import type { FournisseurVoix } from "@/fournisseurs/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const boucle = await import("@/services/boucle");
const travaux = await import("@/services/travaux");
const { ecrireParametre } = await import("@/services/_commun");
const { moteurSimulation } = await import("@/moteurs/simulation");
const { creerMoteurMontageAvocat } = await import("@/moteurs/montage-avocat");
const { fournisseurVoixSimulation } = await import("@/fournisseurs/simulation/autres");

const MDP = "gv2-01-garde-en-vol";
const MIN = 60_000;

beforeAll(async () => {
  process.env.SESSION_SECRET = "g".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  vi.restoreAllMocks();
  boucle.avancementsEnVol().clear();
  travaux.avancementsEnVolDepuis().clear();
  await auth.seConnecter(MDP, false);
  await ecrireParametre("voix.ressemblance", { actif: false, relancesMax: 2 });
  // Seuls les travaux de ce test avancent (les travaux d'exemple en cours sont mis de côté).
  for (const x of await depots().travaux.lister((x) => x.statut === "en_cours" || x.statut === "en_file")) await depots().travaux.enregistrer({ ...x, statut: "termine" });
});

afterEach(() => {
  boucle.arreterBoucle();
  vi.useRealTimers();
});

const lire = async (id: string): Promise<Travail> => (await depots().travaux.obtenir(id))!;
const options = (choisirMoteur: (c: { videoId: string }) => MoteurVideo) => ({ choisirMoteur: choisirMoteur as never, delai: () => 20 });
const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Moteur d'essai : `avancer` fourni, tout le reste du moteur simulé. */
const moteurAvec = (avancer: MoteurVideo["avancer"]): MoteurVideo => ({ ...moteurSimulation, avancer });

describe("GV2-01 · un appel qui ne revient jamais", () => {
  it("31 min plus tard : reprise programmée ; à terme échec avec notification ; la vidéo suivante en file démarre", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    await ecrireParametre("fabrication.concurrence", 2);
    const ids = [];
    for (const v of ["v-04", "v-05", "v-06"]) ids.push((await fabrication.lancerFabrication(v, { confirme: true })).travailId);
    // Les exemples (estDemo) ne prennent jamais de place : ces trois travaux sont de vrais travaux.
    for (const id of ids) await depots().travaux.enregistrer({ ...(await lire(id)), estDemo: false });
    let appelsC = 0;
    const figee = moteurAvec(() => new Promise(() => undefined));
    const normale = moteurAvec(async (t, cmd, i) => (appelsC++, moteurSimulation.avancer(t, cmd, i)));
    // Les deux premiers (selon la file) se figent ; le troisième attend sa place.
    let videoNormale = "";
    const choisir = (cmd: { videoId: string }) => (cmd.videoId === videoNormale ? normale : figee);
    await boucle.contenuDuTour(options(choisir));
    const c = (await depots().travaux.lister((x) => x.statut === "en_file")).map((x) => x.id)[0]!;
    videoNormale = (await lire(c)).cibleId;
    const [a, b] = ids.filter((i) => i !== c) as [string, string];
    expect((await lire(a)).statut).toBe("en_cours");
    expect(boucle.avancementsEnVol().has(a)).toBe(true);
    // 31 min plus tard : l'appel figé est abandonné, le travail a une reprise programmée et peut repartir.
    vi.setSystemTime(Date.now() + 31 * MIN);
    await boucle.contenuDuTour(options(choisir));
    expect((await lire(a)).reprise?.echecs).toBeGreaterThanOrEqual(2);
    // Il repart (nouvel appel, figé lui aussi) : on laisse passer les 24 h d'attente.
    for (let i = 0; i < 90 && ((await lire(a)).statut !== "echec" || (await lire(b)).statut !== "echec"); i++) {
      vi.setSystemTime(Date.now() + 31 * MIN);
      await boucle.contenuDuTour(options(choisir));
    }
    const lienA = `/videos/${(await lire(a)).cibleId}`;
    expect((await lire(a)).statut).toBe("echec");
    expect((await lire(b)).statut).toBe("echec");
    expect(await depots().notifications.trouver((n) => n.type === "echec" && n.lien === lienA)).toBeTruthy();
    // La place libérée : le 3e travail démarre.
    await boucle.contenuDuTour(options(choisir));
    expect((await lire(c)).statut).not.toBe("en_file");
    expect(appelsC).toBeGreaterThan(0);
  }, 60_000);

  it("avec une lecture de voix en vol : le moteur n'est JAMAIS rappelé", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    await ecrireParametre("moteur.avocat", "montage-avocat");
    const { travailId } = await fabrication.lancerFabrication("v-03", { confirme: true });
    let lectures = 0;
    const infinie: FournisseurVoix = { ...fournisseurVoixSimulation, lire: () => (lectures++, new Promise(() => undefined)) };
    const m = creerMoteurMontageAvocat({ voix: () => infinie });
    const opt = { choisirMoteur: () => m, delai: () => 20 };
    await boucle.contenuDuTour(opt);
    expect(lectures).toBe(1);
    for (let i = 0; i < 4; i++) {
      vi.setSystemTime(Date.now() + 31 * MIN);
      const t0 = await lire(travailId);
      await depots().travaux.enregistrer({ ...t0, reprise: undefined });
      await boucle.contenuDuTour(opt);
    }
    expect(lectures).toBe(1);
    expect(boucle.avancementsEnVol().has(travailId)).toBe(true);
    expect((await lire(travailId)).statut).toBe("en_cours");
  });

  it("une étape de plus de 30 s qui finit par un refus définitif : échec dès ce retour, avec la phrase du refus", async () => {
    const { travailId } = await fabrication.lancerFabrication("v-04", { confirme: true });
    const refus = moteurAvec(async () => {
      await attendre(80);
      throw Object.assign(new Error("Le fournisseur refuse ce texte."), { reessayable: false, messagePourWill: "Le fournisseur refuse ce texte." });
    });
    await boucle.contenuDuTour(options(() => refus));
    expect((await lire(travailId)).statut).toBe("en_cours");
    await boucle.avancementsEnVol().get(travailId);
    const t = await lire(travailId);
    expect(t.statut).toBe("echec");
    expect(t.erreur?.messagePourWill).toContain("Le fournisseur refuse ce texte.");
    expect(await depots().notifications.trouver((n) => n.type === "echec" && n.lien === "/videos/v-04")).toBeTruthy();
  });

  it("un refus passager tardif : une seule panne comptée", async () => {
    const { travailId } = await fabrication.lancerFabrication("v-04", { confirme: true });
    const passager = moteurAvec(async () => {
      await attendre(80);
      throw Object.assign(new Error("503"), { reessayable: true });
    });
    await boucle.contenuDuTour(options(() => passager));
    await boucle.avancementsEnVol().get(travailId);
    const t = await lire(travailId);
    expect(t.statut).toBe("en_cours");
    expect(t.reprise?.echecs).toBe(1);
  });

  it("le retour d'un appel abandonné n'écrit rien dans le travail", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const { travailId } = await fabrication.lancerFabrication("v-04", { confirme: true });
    let rendre!: () => void;
    const tardive = moteurAvec((t) => new Promise((r) => (rendre = () => r({ travail: { ...t, progression: 88 } }))).then((x) => x as never));
    await boucle.contenuDuTour(options(() => tardive));
    vi.setSystemTime(Date.now() + 31 * MIN);
    await boucle.contenuDuTour(options(() => moteurAvec(() => new Promise(() => undefined))));
    const avant = (await lire(travailId)).progression;
    rendre();
    await attendre(30);
    expect((await lire(travailId)).progression).toBe(avant);
  });
});

describe("GV2-01 · un travail qui lève ne fait pas tomber le tour", () => {
  it("l'écriture de A lève : B du même tour est quand même écrit", async () => {
    const a = (await fabrication.lancerFabrication("v-04", { confirme: true })).travailId;
    const b = (await fabrication.lancerFabrication("v-05", { confirme: true })).travailId;
    const originale = depots().travaux.enregistrer.bind(depots().travaux);
    vi.spyOn(depots().travaux, "enregistrer").mockImplementation(async (t: Travail) => {
      if (t.id === a && t.progression === 77) throw new Error("écriture impossible");
      return originale(t);
    });
    const e = (progression: number) => moteurAvec(async (t) => ({ travail: { ...t, statut: "en_cours" as const, progression } }));
    await boucle.contenuDuTour(options((cmd) => (cmd.videoId === "v-04" ? e(77) : e(55))));
    expect((await lire(b)).progression).toBe(55);
    expect((await lire(a)).progression).not.toBe(77);
    // Le travail est relu au tour suivant.
    expect(boucle.avancementsEnVol().has(a)).toBe(false);
  });
});
