/**
 * E2E-1 n° 1 (BLOQUANT, 03/10) — la voix n'est JAMAIS relue (repayée) après une panne.
 * Preuve d'origine : `_VERIFICATION-STUDIO-2026-10-03/rendus-moteur/preuves-tests/repaye.test.ts` (4 lectures pour 3
 * pannes). Correctif : la phase « lecture » rend la voix payée SEULE (aucun appel suivant dans le même tour), le
 * travail l'enregistre avant tout appel à l'aligneur ou à studio-rendu ; un avancement qui dépasse son délai (lecture
 * longue) n'est jamais relancé tant qu'il est en vol, et son résultat est écrit à son retour. Aucun appel payant.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import type { FournisseurVoix, ServiceRendu, StockageFichiers } from "@/fournisseurs/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const boucle = await import("@/services/boucle");
const { ecrireParametre } = await import("@/services/_commun");
const { creerMoteurMontageAvocat } = await import("@/moteurs/montage-avocat");
const { fournisseurVoixSimulation } = await import("@/fournisseurs/simulation/autres");

const T0 = Date.UTC(2026, 9, 2, 9, 0, 0);
const MDP = "e2e1-moteur-voix";

beforeAll(async () => {
  process.env.SESSION_SECRET = "e".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  vi.restoreAllMocks();
  boucle.avancementsEnVol().clear();
  await auth.seConnecter(MDP, false);
  // 14/10 (voix de référence) : ce test porte sur le chemin de la voix SANS contrôle de ressemblance (réglage coupé) ;
  // l'avocat avec le contrôle actif est prouvé par tests/voix-reference/avocat.test.ts.
  await ecrireParametre("voix.ressemblance", { actif: false, relancesMax: 2 });
});

afterEach(() => {
  boucle.arreterBoucle();
});

const stockageSigne = (): StockageFichiers =>
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

describe("E2E-1 n° 1 · panne de studio-rendu juste après la voix", () => {
  it("3 pannes de studio-rendu puis reprise : la voix est lue UNE seule fois", async () => {
    const lire = vi.spyOn(fournisseurVoixSimulation, "lire");
    let pannes = 3;
    const etats = new Map<string, unknown>();
    const rendu: ServiceRendu = {
      soumettre: async (d) => {
        if (pannes-- > 0) throw Object.assign(new Error("503 studio-rendu"), { reessayable: true });
        etats.set(d.idRendu, { statut: "termine", sortieCle: d.sortie.cle });
        return { idRendu: d.idRendu };
      },
      etat: async (id) => (etats.get(id) as never) ?? { statut: "inconnu" },
    };
    const m = creerMoteurMontageAvocat({ rendu, stockage: stockageSigne });
    const c = await fabrication.construireCommande("v-03");
    let t = await m.lancer(c, { travailId: "t", versionId: "v", titre: "T", maintenant: T0 });
    let erreurs = 0;
    // Comme la boucle de fond : une panne laisse le travail tel qu'il a été ENREGISTRÉ au tour précédent.
    for (let i = 0; i < 6; i++) {
      try {
        t = (await m.avancer(t, c, T0 + i * 1000)).travail;
      } catch {
        erreurs++;
      }
    }
    expect(erreurs).toBe(3);
    expect(lire).toHaveBeenCalledTimes(1);
    // L'analyse a fini par partir, sur le son déjà payé.
    expect(["analyse", "nettoyage", "faite"]).toContain((t.parametres?.voix as { phase: string }).phase);
  });

  it("le tour de lecture ne fait QUE lire : la voix payée est rendue avant tout appel suivant", async () => {
    let soumissions = 0;
    const rendu: ServiceRendu = { soumettre: async (d) => (soumissions++, { idRendu: d.idRendu }), etat: async () => ({ statut: "en_cours" }) as never };
    const m = creerMoteurMontageAvocat({ rendu, stockage: stockageSigne });
    const c = await fabrication.construireCommande("v-03");
    const t = await m.lancer(c, { travailId: "t2", versionId: "v2", titre: "T", maintenant: T0 });
    const apres = (await m.avancer(t, c, T0)).travail;
    expect(soumissions).toBe(0);
    expect(apres.parametres?.voix).toMatchObject({ phase: "a-analyser", brut: expect.objectContaining({ coutCentimes: expect.any(Number) }) });
  });

  it("lecture plus longue que le délai de la boucle : jamais relancée en vol, son résultat est gardé à son retour", async () => {
    await ecrireParametre("moteur.avocat", "montage-avocat");
    // Seul ce travail avance (les travaux d'exemple en cours sont mis de côté).
    for (const x of await depots().travaux.lister((x) => x.statut === "en_cours" || x.statut === "en_file")) await depots().travaux.enregistrer({ ...x, statut: "termine" });
    const { travailId } = await fabrication.lancerFabrication("v-03", { confirme: true });
    let lectures = 0;
    const lente: FournisseurVoix = {
      ...fournisseurVoixSimulation,
      lire: async (d) => {
        lectures++;
        await new Promise((r) => setTimeout(r, 120));
        return fournisseurVoixSimulation.lire(d);
      },
    };
    const m = creerMoteurMontageAvocat({ voix: () => lente });
    const options = { choisirMoteur: () => m, delai: () => 20 };
    await boucle.contenuDuTour(options);
    // Délai dépassé : panne écrite, mais l'appel continue (en vol).
    expect(boucle.avancementsEnVol().has(travailId)).toBe(true);
    // Un tour pendant le vol ne relance rien, même si la reprise est due.
    const t0 = (await depots().travaux.obtenir(travailId))!;
    await depots().travaux.enregistrer({ ...t0, reprise: undefined });
    await boucle.contenuDuTour(options);
    expect(lectures).toBe(1);
    await boucle.avancementsEnVol().get(travailId);
    expect(boucle.avancementsEnVol().has(travailId)).toBe(false);
    const t = (await depots().travaux.obtenir(travailId))!;
    expect((t.parametres?.voix as { phase: string }).phase).toBe("a-analyser");
    // La suite part du son gardé : aucune seconde lecture.
    await boucle.contenuDuTour({ choisirMoteur: () => m });
    expect(lectures).toBe(1);
    expect((((await depots().travaux.obtenir(travailId))!.parametres?.voix) as { phase: string }).phase).not.toBe("a-lire");
  });
});
