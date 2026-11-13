/**
 * GV2-01 : garde « plus d'avancement ». Un moteur qui répond « rien de neuf » sans fin n'est jamais en panne : après
 * 60 min (7 h pour l'avocat, jamais pour le tableau) le travail échoue (PANNE_SANS_NOUVELLE, réessayable).
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { MoteurVideo } from "@/moteurs";
import type { Travail } from "@/domaine/types";
import { delaiSansAvancementMs, empreinteAvancement } from "@/domaine/suivi";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const boucle = await import("@/services/boucle");
const { moteurSimulation } = await import("@/moteurs/simulation");

const MDP = "gv2-01-sans-avancement";
const MIN = 60_000;

beforeAll(async () => {
  process.env.SESSION_SECRET = "s".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  boucle.avancementsEnVol().clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  await auth.seConnecter(MDP, false);
  for (const x of await depots().travaux.lister((x) => x.statut === "en_cours" || x.statut === "en_file")) await depots().travaux.enregistrer({ ...x, statut: "termine" });
});

afterEach(() => {
  boucle.arreterBoucle();
  vi.useRealTimers();
});

const lire = async (id: string): Promise<Travail> => (await depots().travaux.obtenir(id))!;
const immobile = (id = "simulation"): MoteurVideo => ({ ...moteurSimulation, id, avancer: async (t) => ({ travail: { ...t, statut: "en_cours" } }) });
const tour = (m: MoteurVideo) => boucle.contenuDuTour({ choisirMoteur: () => m });
/** Avance l'horloge par tours de 5 min (la boucle tourne toutes les 5 s : jamais de grand trou entre deux observations). */
const apres = async (minutes: number, m: MoteurVideo) => {
  for (let fait = 0; fait < minutes; fait += 5) {
    vi.setSystemTime(Date.now() + Math.min(5, minutes - fait) * MIN);
    await tour(m);
  }
};

describe("GV2-01 · fonctions pures", () => {
  it("délais : tableau jamais, avocat 7 h, les autres 60 min", () => {
    expect(delaiSansAvancementMs("montage-tableau")).toBeNull();
    expect(delaiSansAvancementMs("montage-avocat")).toBe(7 * 60 * MIN);
    expect(delaiSansAvancementMs("simulation")).toBe(60 * MIN);
  });
  it("l'empreinte ignore modifieLe, reprise, finEstimee, urgent, garde et suit la progression", () => {
    const t = { statut: "en_cours", etapes: [{ cle: "a", statut: "en_cours", progression: 10 }], progression: 10, parametres: { x: 1 }, modifieLe: "1", urgent: false } as unknown as Travail;
    const e = empreinteAvancement(t);
    expect(empreinteAvancement({ ...t, modifieLe: "2", urgent: true, finEstimee: "x", reprise: { echecs: 1 }, garde: { empreinte: "z", depuis: "y" } } as unknown as Travail)).toBe(e);
    expect(empreinteAvancement({ ...t, progression: 11 })).not.toBe(e);
    expect(empreinteAvancement({ ...t, etapes: [{ cle: "a", statut: "terminee", progression: 100 }] } as unknown as Travail)).not.toBe(e);
  });
});

describe("GV2-01 · garde « plus d'avancement »", () => {
  it("même état pendant 60 min : échec PANNE_SANS_NOUVELLE réessayable, avec notification", async () => {
    const { travailId } = await fabrication.lancerFabrication("v-04", { confirme: true });
    const m = immobile();
    await tour(m);
    await apres(55, m);
    expect((await lire(travailId)).statut).toBe("en_cours");
    await apres(10, m);
    const t = await lire(travailId);
    expect(t.statut).toBe("echec");
    expect(t.erreur).toMatchObject({ code: "PANNE_SANS_NOUVELLE", reessayable: true });
    expect(t.erreur?.messagePourWill).toMatch(/n'a plus avancé depuis 6\d min/);
    expect(await depots().notifications.trouver((n) => n.type === "echec" && n.lien === "/videos/v-04")).toBeTruthy();
  });

  it("un long trou entre deux observations (arrêt, mise en ligne) ne compte pas comme « plus d'avancement »", async () => {
    const { travailId } = await fabrication.lancerFabrication("v-04", { confirme: true });
    const m = immobile();
    await tour(m);
    for (let i = 0; i < 3; i++) {
      vi.setSystemTime(Date.now() + 61 * MIN);
      await tour(m);
    }
    expect((await lire(travailId)).statut).toBe("en_cours");
  });

  it("un état qui change à chaque tour ne déclenche rien", async () => {
    const { travailId } = await fabrication.lancerFabrication("v-04", { confirme: true });
    let p = 1;
    const m: MoteurVideo = { ...moteurSimulation, avancer: async (t) => ({ travail: { ...t, statut: "en_cours", progression: p++ } }) };
    for (let i = 0; i < 8; i++) await apres(20, m);
    expect((await lire(travailId)).statut).toBe("en_cours");
  });

  it("montage-avocat : rien avant 7 h, échec après", async () => {
    const { travailId } = await fabrication.lancerFabrication("v-04", { confirme: true });
    const m = immobile("montage-avocat");
    await tour(m);
    await apres(6 * 60 + 55, m);
    expect((await lire(travailId)).statut).toBe("en_cours"); // 6 h 55
    await apres(15, m);
    expect((await lire(travailId)).erreur?.code).toBe("PANNE_SANS_NOUVELLE");
  });

  it("un travail en attente de crédit ne déclenche rien", async () => {
    const { travailId } = await fabrication.lancerFabrication("v-04", { confirme: true });
    const m = immobile();
    await tour(m);
    for (let i = 0; i < 4; i++) {
      const t = await lire(travailId);
      await depots().travaux.enregistrer({ ...t, reprise: { echecs: 1, premiereLe: t.creeLe, prochainEssai: new Date(Date.now() - MIN).toISOString(), motif: "credit" } as never });
      await apres(40, m);
    }
    expect((await lire(travailId)).statut).toBe("en_cours");
  });

  it("montage-tableau : jamais (il a sa propre garde)", async () => {
    const { travailId } = await fabrication.lancerFabrication("v-04", { confirme: true });
    const m = immobile("montage-tableau");
    await tour(m);
    await apres(10 * 60, m);
    expect((await lire(travailId)).statut).toBe("en_cours");
  });
});
