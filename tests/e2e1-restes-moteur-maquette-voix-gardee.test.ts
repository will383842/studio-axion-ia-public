/**
 * Reste du correcteur moteur (03/10) — la MAQUETTE RAPIDE qui tombe en panne APRÈS la lecture de la voix enregistrait
 * bien la dépense (E2E-1 n° 3), mais la maquette suivante relisait (et repayait) la voix : le son brut n'était pas
 * gardé. Désormais il est gardé sur la vidéo et repris par la maquette suivante, sans relecture ni seconde dépense,
 * tant que le texte, la voix et les prononciations n'ont pas changé. Aucun appel payant (voix simulée, espionnée).
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import type { ServiceRendu } from "@/fournisseurs/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const { ecrireParametre } = await import("@/services/_commun");
const { creerMoteurMontageAvocat, moteurMontageAvocat } = await import("@/moteurs/montage-avocat");
const { fournisseurVoixSimulation } = await import("@/fournisseurs/simulation/autres");

const MDP = "e2e1-restes-maquette-voix";

beforeAll(async () => {
  process.env.SESSION_SECRET = "f".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  // 14/10 (voix de référence) : ce test porte sur le chemin de la voix SANS contrôle de ressemblance (réglage coupé) ;
  // l'avocat avec le contrôle actif est prouvé par tests/voix-reference/avocat.test.ts.
  await ecrireParametre("voix.ressemblance", { actif: false, relancesMax: 2 });
  await ecrireParametre("moteur.avocat", "montage-avocat");
});

afterEach(() => vi.restoreAllMocks());

/** studio-rendu qui refuse (son illisible) : la maquette tombe en panne juste après la lecture de la voix. */
const renduRefus: ServiceRendu = {
  soumettre: async () => {
    throw Object.assign(new Error("son illisible"), { reessayable: false });
  },
  etat: async () => ({ statut: "inconnu" }),
};

const voixPayees = async (videoId: string) =>
  (await depots().depenses.lister((d) => d.videoId === videoId)).flatMap((d) => d.lignes).filter((l) => l.etape === "Voix" && l.total.centimes > 0);

describe("maquette rapide en panne après la voix : le son brut payé est gardé et repris", () => {
  it("la maquette suivante ne relit pas la voix et ne la compte pas deux fois", async () => {
    const enPanne = creerMoteurMontageAvocat({ rendu: renduRefus, pauseMs: 0 });
    const saine = creerMoteurMontageAvocat({ pauseMs: 0 });
    let appel = 0;
    // 1re maquette : rendu en panne ; 2e : rendu simulé normal. Le service passe ce qu'il a gardé.
    vi.spyOn(moteurMontageAvocat, "maquette").mockImplementation((c, o) => (++appel === 1 ? enPanne.maquette(c, o) : saine.maquette(c, o)));
    const lire = vi.spyOn(fournisseurVoixSimulation, "lire");
    const avant = (await voixPayees("v-03")).length; // dépenses de démonstration déjà là

    await expect(fabrication.maquetteRapide("v-03")).rejects.toBeTruthy();
    expect(lire).toHaveBeenCalledTimes(1);
    expect(await voixPayees("v-03")).toHaveLength(avant + 1);
    expect((await depots().videos.obtenir("v-03"))!.voixMaquettePayee?.fichierCle).toBeTruthy();

    const m = await fabrication.maquetteRapide("v-03");
    expect(m.dureeSec).toBeGreaterThan(0);
    expect(m.audioUrl).toBeTruthy();
    // La voix n'a pas été relue, et elle n'est comptée qu'une fois.
    expect(lire).toHaveBeenCalledTimes(1);
    expect(await voixPayees("v-03")).toHaveLength(avant + 1);
    // Une fois la maquette réussie, l'audio maître est rangé : le son brut gardé ne sert plus.
    expect((await depots().videos.obtenir("v-03"))!.voixMaquettePayee).toBeUndefined();
  });

  it("si le texte change entre-temps, la voix est relue (le son gardé ne correspond plus)", async () => {
    const enPanne = creerMoteurMontageAvocat({ rendu: renduRefus, pauseMs: 0 });
    const saine = creerMoteurMontageAvocat({ pauseMs: 0 });
    let appel = 0;
    vi.spyOn(moteurMontageAvocat, "maquette").mockImplementation((c, o) => (++appel === 1 ? enPanne.maquette(c, o) : saine.maquette(c, o)));
    const lire = vi.spyOn(fournisseurVoixSimulation, "lire");

    await expect(fabrication.maquetteRapide("v-03")).rejects.toBeTruthy();
    const v = (await depots().videos.obtenir("v-03"))!;
    const s = (await depots().scripts.obtenir(v.scriptId!))!;
    const b0 = s.blocs[0];
    await depots().scripts.modifier(s.id, { blocs: [{ ...b0, segments: [{ ...b0.segments[0], texte: `${b0.segments[0].texte} Autrement dit.` }, ...b0.segments.slice(1)] }, ...s.blocs.slice(1)] });

    await fabrication.maquetteRapide("v-03");
    expect(lire).toHaveBeenCalledTimes(2);
  });
});
