/**
 * L2-13 (correction après relecture) — le moteur du montage avocat transmet l'origine de la commande
 * (`commande.origine`) jusqu'au fournisseur d'illustration. Aucun réseau : fournisseur injecté (`deps.illustration`)
 * dont la fabrication relève seulement l'origine qu'elle reçoit.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import type { FournisseurIllustration, ServiceRendu, StockageFichiers } from "@/fournisseurs/types";
import type { FabricationParEtapes } from "@/fournisseurs/illustration/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const boucle = await import("@/services/boucle");
const pf = await import("@/services/plafond-fournisseur");
const { creerMoteurMontageAvocat } = await import("@/moteurs/montage-avocat");
const { fournisseurIllustrationSimulation } = await import("@/fournisseurs/simulation/autres");

const T0 = Date.UTC(2026, 9, 2, 9, 0, 0);
const MDP = "l2-13-moteur";

beforeAll(async () => {
  process.env.SESSION_SECRET = "m".repeat(48);
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 })).toString("base64");
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  boucle.avancementsEnVol().clear();
  await auth.seConnecter(MDP, false);
});
afterEach(() => boucle.arreterBoucle());

const stockage = (): StockageFichiers =>
  ({ id: "r2", type: "stockage", nom: "S", reelPrevu: "R2", mode: "reel", capacites: { asynchrone: false, accordExige: false }, preparerDepot: async () => ({ cleStockage: "x", urlDepot: "" }), confirmerDepot: async () => ({ ok: true }), urlLecture: async (c: string) => `https://r2/${c}`, urlLectureDuree: async (c: string, s: number) => `https://r2/${c}?${s}`, urlDepotDuree: async (c: string, s: number) => `https://r2/${c}?d=${s}` }) as unknown as StockageFichiers;
/** studio-rendu injecté : chaque demande se termine tout de suite (comme tests/m4-montage-avocat.test.ts). */
function fauxRendu(): ServiceRendu {
  const etats = new Map<string, unknown>();
  return {
    soumettre: async (d) => {
      etats.set(d.idRendu, { statut: "termine", sortieCle: d.sortie.cle });
      return { idRendu: d.idRendu };
    },
    etat: async (id) => (etats.get(id) as never) ?? { statut: "inconnu" },
  };
}

async function origineVueParLeFournisseur(origine: "usine" | undefined): Promise<(string | undefined)[]> {
  const vues: string[] = [];
  const fab: FabricationParEtapes = {
    async soumettre() {
      vues.push(pf.origineFournisseurCourante());
      throw Object.assign(new Error("arrêt du test"), { erreur: { code: "refuse", reessayable: false, message: "arrêt du test" } });
    },
    async suivre() {
      return { statut: "en_cours" };
    },
  };
  const f = { ...fournisseurIllustrationSimulation, id: "reel", mode: "reel" as const, fabrication: fab } as FournisseurIllustration;
  const m = creerMoteurMontageAvocat({ rendu: fauxRendu(), stockage, illustration: () => f });
  const base = await fabrication.construireCommande("v-03");
  // `lancerFabrication` fige l'origine dans la commande (`commande.origine`) ; le test pose la même valeur.
  const c = { ...base, ...(origine ? { origine } : {}), plans: base.plans.map((p) => ({ ...p, sourceImage: "illustration" as const, illustration: { source: "generee-ia" as const, requete: "un accusé de réception de lettre recommandée", verrouille: false, candidats: [] } })), briques: { ...base.briques, illustrations: true } };
  let t = await m.lancer(c, { travailId: "t", versionId: "v", titre: "T", maintenant: T0 });
  for (let i = 0; i < 1200 && vues.length === 0; i++) {
    try {
      t = (await m.avancer(t, c, T0 + i * 500)).travail;
    } catch {
      /* panne d'un tour : la boucle réelle reprend au tour suivant */
    }
  }
  return vues;
}

describe("moteur du montage avocat : l'origine de la commande suit jusqu'au fournisseur d'illustration", () => {
  it("commande « usine » : la fabrication reçoit l'origine « usine »", async () => {
    const vues = await origineVueParLeFournisseur("usine");
    expect(vues.length).toBeGreaterThan(0);
    expect(new Set(vues)).toEqual(new Set(["usine"]));
  });
  it("commande du fondateur (origine non précisée) : « studio », jamais bloquée", async () => {
    const vues = await origineVueParLeFournisseur(undefined);
    expect(vues.length).toBeGreaterThan(0);
    expect(new Set(vues)).toEqual(new Set(["studio"]));
  });
});
