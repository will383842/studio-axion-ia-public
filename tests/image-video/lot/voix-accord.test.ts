/**
 * LOT D'IMAGES · L7 — l'accord de la voix d'une vidéo du lot (plan § c.5) : le seul accord implicite est le prix accordé
 * POUR CETTE VIDÉO (`entrees.imageVideo.lot.accordParVideoCentimes`), jamais plus ; une vidéo seule garde son comportement.
 * Dépôts mémoire, faux HeyGen, aucun réseau.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LecteurCredit } from "@/fournisseurs/types";
import type { DemandeDepenseIV } from "@/moteurs/montage-image-video";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }), headers: async () => new Headers() }));
vi.mock("@/services/auth", () => ({ exigerSession: async () => ({}) }));

const { reinitialiserDepots } = await import("@/donnees/memoire");
const credits = await import("@/services/credits");
const couts = await import("@/services/couts");
const iv = await import("@/services/image-video");

const heygen: LecteurCredit = {
  fournisseur: "heygen",
  nom: "HeyGen",
  mode: "reel",
  urlRecharge: "",
  variableCle: "HEYGEN_API_KEY",
  async lireSolde() {
    return { fournisseur: "heygen", centimes: 1_000_000, devise: "USD", luLe: new Date().toISOString() };
  },
  async testerConnexion() {
    return { ok: true, finCle: "…x", message: "ok", testeLe: new Date().toISOString() };
  },
};

const voix = (centimes: number): DemandeDepenseIV => ({ appelId: "iv-voix-1-1", videoId: "v1", etape: "voix", fournisseur: "heygen", centimes, caracteres: 1000 });

beforeEach(async () => {
  reinitialiserDepots();
  credits.injecterLecteursPourEssai([heygen], ["heygen"]);
  // Seuil de confirmation bas : toute voix de plus d'un euro demande un accord MONTANT.
  await couts.definirBudget(100_000, 100);
});
afterEach(() => credits.injecterLecteursPourEssai(null));

async function reserver(d: DemandeDepenseIV, accordLotCentimes?: number) {
  const lignes = iv.lignesDeDepense(d);
  try {
    await credits.verifierEtReserver({ lignes, total: lignes[0].total }, iv.accordDeLaVoixIV(d.centimes, accordLotCentimes), "Cette vidéo", { videoId: d.videoId, travailId: "t1" });
    return "ok";
  } catch (e) {
    return (e as { code: string }).code;
  }
}

describe("accord de la voix", () => {
  it("accordDeLaVoixIV : l'accord du lot s'il y en a un, sinon le coût de la voix (comme avant)", () => {
    expect(iv.accordDeLaVoixIV(300, 220)).toBe(220);
    expect(iv.accordDeLaVoixIV(300, undefined)).toBe(300);
    expect(iv.accordDeLaVoixIV(300, 0)).toBe(0);
  });

  it("vidéo du lot : une voix au-dessus du seuil passe sans demander de confirmation, dans le prix accordé", async () => {
    expect(await reserver(voix(200), 220)).toBe("ok");
  });

  it("vidéo du lot : une voix qui dépasse le prix accordé pour la vidéo est refusée (jamais plus que l'accord)", async () => {
    expect(await reserver(voix(300), 220)).toBe("CONFIRMATION_REQUISE");
  });

  it("vidéo seule : comportement actuel (la voix est réservée sur son propre coût)", async () => {
    expect(await reserver(voix(300))).toBe("ok");
  });

  it("le raccord du moteur donne l'accord par vidéo du lot aux outils, rien pour une vidéo seule", () => {
    const commande = (lot?: unknown) => ({ entrees: { imageVideo: { imageCle: "k", reseaux: ["linkedin"], plafondCentimes: 220, ...(lot ? { lot } : {}) } } }) as never;
    expect(iv.accordLotDeLaCommandeIV(commande({ id: "lot-iv-aaaaaaaaaaaa", rang: 1, accordParVideoCentimes: 220 }))).toBe(220);
    expect(iv.accordLotDeLaCommandeIV(commande())).toBeUndefined();
  });
});
