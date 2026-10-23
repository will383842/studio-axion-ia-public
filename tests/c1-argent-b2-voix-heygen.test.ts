/**
 * CORRECTEUR 1 (argent) — B2 : la voix HeyGen n'est jamais payée deux fois.
 *  - le son payé (adresse et identifiant de la demande) est GARDÉ dès la réponse de HeyGen ; sa copie dans le stockage
 *    se fait au tour suivant, et une copie ratée se refait sans relire (ni repayer) la voix ;
 *  - un avancement jeté parce que le travail a été touché pendant le tour (recharge déclarée…) n'est plus perdu ;
 *    arrêté pendant le tour, la voix payée est quand même enregistrée en dépense.
 * Faux client HeyGen, faux stockage, aucun réseau, aucune clé.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import type { FournisseurVoix, StockageFichiers } from "@/fournisseurs/types";
import type { ClientHeygen } from "@/fournisseurs/heygen/client";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const travaux = await import("@/services/travaux");
const boucle = await import("@/services/boucle");
const { ecrireParametre } = await import("@/services/_commun");
const { creerFournisseurVoixHeygen } = await import("@/fournisseurs/heygen/voix");
const { creerMoteurMontageAvocat } = await import("@/moteurs/montage-avocat");
const { fournisseurVoixSimulation } = await import("@/fournisseurs/simulation/autres");

const MDP = "c1-argent-b2";
const T0 = Date.UTC(2026, 9, 3, 9, 0, 0);

beforeAll(async () => {
  process.env.SESSION_SECRET = "a".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  vi.restoreAllMocks();
  boucle.avancementsEnVol().clear();
  await auth.seConnecter(MDP, false);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const stockageReel = (): StockageFichiers =>
  ({
    id: "r2",
    type: "stockage",
    nom: "S",
    reelPrevu: "R2",
    mode: "reel",
    capacites: { asynchrone: false, accordExige: false },
    preparerDepot: async () => ({ cleStockage: "x", urlDepot: "" }),
    confirmerDepot: async () => ({ ok: true }),
    urlLecture: async (c: string) => `https://r2/${c}`,
    urlLectureDuree: async (c: string, s: number) => `https://r2/${c}?${s}`,
    urlDepotDuree: async (c: string, s: number) => `https://r2/${c}?d=${s}`,
  }) as unknown as StockageFichiers;

/** Faux client HeyGen : la parole est « payée » à chaque POST ; le téléchargement du son peut tomber. */
function clientHeygen(o: { telechargementEnPanne: () => boolean }) {
  const compte = { paroles: 0, telechargements: 0 };
  const client: ClientHeygen = {
    async requete<T>(methode: string, chemin: string) {
      if (methode === "POST" && chemin === "/v3/voices/speech") {
        compte.paroles++;
        return { audio_url: "https://resource2.heygen.ai/tts/son.wav", duration: 2, request_id: "req-123", word_timestamps: [{ word: "Bonjour", start: 0.1, end: 0.6 }] } as T;
      }
      throw new Error(`inattendu : ${methode} ${chemin}`);
    },
    async requeteEntiere<T>() {
      return {} as T;
    },
    async telecharger() {
      compte.telechargements++;
      if (o.telechargementEnPanne()) throw new Error("coupure");
      return { octets: new Uint8Array([1, 2, 3]), mime: "audio/mpeg" };
    },
  };
  return { client, compte };
}

const demande = { idExterne: "voix-will", texte: "Bonjour", reglages: { vitesse: 1, stabilite: 50, emotion: 50 }, prononciations: [] };

describe("B2 · fournisseur voix HeyGen", () => {
  it("copie du son en panne : la voix payée est RENDUE (adresse et demande gardées), pas une erreur à relancer", async () => {
    const { client, compte } = clientHeygen({ telechargementEnPanne: () => true });
    const voix = creerFournisseurVoixHeygen({ client, stockage: stockageReel, environnement: "test" });
    const r = await voix.lire(demande);
    expect(compte.paroles).toBe(1);
    expect(r.copieEnAttente).toEqual({ adresse: "https://resource2.heygen.ai/tts/son.wav", idDemande: "req-123" });
    expect(r.cout.centimes).toBeGreaterThanOrEqual(0);
  });

  it("copie différée (fabrication) : aucune copie dans l'appel payant, elle se fait ensuite sans relire la voix", async () => {
    const { client, compte } = clientHeygen({ telechargementEnPanne: () => false });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 200 })));
    const voix = creerFournisseurVoixHeygen({ client, stockage: stockageReel, environnement: "test" });
    const r = await voix.lire({ ...demande, copieDifferee: true });
    expect(compte.telechargements).toBe(0);
    expect(r.copieEnAttente?.idDemande).toBe("req-123");
    const cle = await voix.copierSon!(r.copieEnAttente!.adresse, "voix-will", r.copieEnAttente!.idDemande);
    expect(cle).toMatch(/^studio\/test\/voix\/voix-will\/req-123\./);
    expect(compte.paroles).toBe(1);
  });
});

describe("B2 · moteur avocat : la copie se refait au tour suivant, la voix n'est lue qu'une fois", () => {
  it("copie ratée deux fois puis réussie : une seule lecture, le son finit dans le stockage", async () => {
    let lectures = 0;
    let copies = 0;
    const voix: FournisseurVoix = {
      ...fournisseurVoixSimulation,
      lire: async (d) => {
        lectures++;
        const r = await fournisseurVoixSimulation.lire(d);
        return { ...r, fichierCle: "https://resource2.heygen.ai/tts/son.wav", copieEnAttente: { adresse: "https://resource2.heygen.ai/tts/son.wav", idDemande: "req-9" } };
      },
      copierSon: async () => {
        copies++;
        if (copies < 3) throw Object.assign(new Error("stockage indisponible"), { reessayable: true });
        return "studio/test/voix/voix-will/req-9.mp3";
      },
    };
    const m = creerMoteurMontageAvocat({ voix: () => voix, stockage: stockageReel, rendu: { soumettre: async (d) => ({ idRendu: d.idRendu }), etat: async () => ({ statut: "en_cours" }) as never } });
    const c = await fabrication.construireCommande("v-03");
    let t = await m.lancer(c, { travailId: "t-b2", versionId: "v-b2", titre: "T", maintenant: T0 });
    for (let i = 0; i < 6; i++) {
      try {
        t = (await m.avancer(t, c, T0 + i * 1000)).travail;
      } catch {
        /* panne : le travail reste tel qu'enregistré */
      }
    }
    expect(lectures).toBe(1);
    expect(copies).toBe(3);
    const etat = t.parametres?.voix as { phase: string; brut?: { fichierCle: string } };
    expect(etat.phase).not.toBe("a-lire");
    expect(etat.brut?.fichierCle ?? "").toBe("studio/test/voix/voix-will/req-9.mp3");
  });
});

describe("B2 · avancement jeté pendant le tour", () => {
  async function lancerEtLire() {
    await ecrireParametre("moteur.avocat", "montage-avocat");
    for (const x of await depots().travaux.lister((x) => x.statut === "en_cours" || x.statut === "en_file")) await depots().travaux.enregistrer({ ...x, statut: "termine" });
    await depots().videos.modifier("v-03", { estDemo: false });
    const { travailId } = await fabrication.lancerFabrication("v-03", { confirme: true });
    const m = creerMoteurMontageAvocat({ stockage: stockageReel, rendu: { soumettre: async (d) => ({ idRendu: d.idRendu }), etat: async () => ({ statut: "en_cours" }) as never } });
    const [lu] = (await travaux.lireTravauxAAvancer(Date.now(), () => m)).filter((x) => x.travail.id === travailId);
    const sortie = await m.avancer(lu.travail, lu.commande);
    expect((sortie.travail.parametres?.voix as { phase: string }).phase).not.toBe("a-lire");
    return { travailId, lu, sortie };
  }

  it("seule la reprise a bougé (recharge déclarée pendant le tour) : la voix lue est gardée", async () => {
    const { travailId, lu, sortie } = await lancerEtLire();
    const t = (await depots().travaux.obtenir(travailId))!;
    await depots().travaux.modifier(travailId, { reprise: { echecs: 1, premiereLe: t.creeLe, prochainEssai: new Date().toISOString(), motif: "credit" } });
    await new Promise((r) => setTimeout(r, 5));
    const { ecrit } = await travaux.ecrireAvancement(lu, sortie);
    expect(ecrit).toBe(true);
    expect(((await depots().travaux.obtenir(travailId))!.parametres?.voix as { phase: string }).phase).not.toBe("a-lire");
  });

  it("arrêté pendant le tour : rien n'est réécrit, mais la voix payée est enregistrée en dépense", async () => {
    const { travailId, lu, sortie } = await lancerEtLire();
    await depots().travaux.modifier(travailId, { statut: "annule" });
    const avant = await depots().depenses.compter((d) => d.travailId === travailId);
    const { ecrit } = await travaux.ecrireAvancement(lu, sortie);
    expect(ecrit).toBe(false);
    const deps = await depots().depenses.lister((d) => d.travailId === travailId);
    expect(deps.length).toBeGreaterThan(avant);
    expect(deps.flatMap((d) => d.lignes).some((l) => l.etape === "Voix")).toBe(true);
  });
});
