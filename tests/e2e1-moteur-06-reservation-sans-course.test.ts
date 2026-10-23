/**
 * E2E-1 n° 6 (MINEUR, 03/10) — une seule chaîne contrôler → réserver, d'un seul tenant (verrou des crédits) : deux
 * lancements SIMULTANÉS sur un crédit qui n'en couvre qu'un ne passent pas tous les deux. Lecteurs de solde injectés,
 * aucun appel payant.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import type { LecteurCredit } from "@/fournisseurs/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const credits = await import("@/services/credits");

const MDP = "e2e1-moteur-course";

beforeAll(async () => {
  process.env.SESSION_SECRET = "h".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  credits.injecterLecteursPourEssai(null);
  await auth.seConnecter(MDP, false);
});

afterEach(() => credits.injecterLecteursPourEssai(null));

/** HeyGen d'essai : la lecture du solde prend un peu de temps (c'est là que deux lancements se croisaient). */
function heygenLent(solde: number): LecteurCredit {
  return {
    fournisseur: "heygen",
    nom: "HeyGen",
    mode: "reel",
    urlRecharge: "https://app.heygen.com/settings/api",
    variableCle: "HEYGEN_API_KEY",
    async lireSolde() {
      await new Promise((r) => setTimeout(r, 30));
      return { fournisseur: "heygen", centimes: solde, devise: "USD", luLe: new Date().toISOString() };
    },
    async testerConnexion() {
      return { ok: true, finCle: "…essai", message: "ok", testeLe: new Date().toISOString() };
    },
  };
}

async function besoinHeygen(videoId: string): Promise<number> {
  const c = await fabrication.construireCommande(videoId);
  const { moteurDeCommande } = await import("@/moteurs");
  const e = await moteurDeCommande(c).estimer(c);
  return (await credits.besoinsDeLEstimation(e.lignes)).find((b) => b.fournisseur === "heygen")?.avecMarge ?? 0;
}

describe("E2E-1 n° 6 · contrôle et réservation sans course", () => {
  it("deux lancements simultanés, crédit pour un seul : un part, l'autre est refusé, une seule réservation", async () => {
    for (const v of await depots().voix.lister()) await depots().voix.modifier(v.id, { fournisseur: "heygen" });
    await depots().videos.modifier("v-04", { statut: "brouillon" });
    credits.injecterLecteursPourEssai([heygenLent(0)], ["heygen"]);
    const b3 = await besoinHeygen("v-03");
    const b4 = await besoinHeygen("v-04");
    expect(b3).toBeGreaterThan(0);
    credits.injecterLecteursPourEssai([heygenLent(Math.max(b3, b4) + Math.floor(Math.min(b3, b4) / 2))], ["heygen"]);
    const r = await Promise.allSettled([fabrication.lancerFabrication("v-03", { confirme: true }), fabrication.lancerFabrication("v-04", { confirme: true })]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    const refus = r.find((x) => x.status === "rejected") as PromiseRejectedResult;
    expect(refus.reason).toMatchObject({ code: "CREDIT_INSUFFISANT" });
    expect(await depots().reservations.compter((x) => x.statut === "active")).toBe(1);
  });

  it("refus après la réservation (lancement qui échoue ensuite) : la réservation est libérée", async () => {
    credits.injecterLecteursPourEssai([heygenLent(1_000_000)], ["heygen"]);
    for (const v of await depots().voix.lister()) await depots().voix.modifier(v.id, { fournisseur: "heygen" });
    await credits.verifierEtReserver({ lignes: [{ etape: "Voix", fournisseur: "heygen", unite: "caractere", quantite: 1000, prixUnitaire: { centimes: 0, devise: "EUR" }, total: { centimes: 50, devise: "EUR" }, nature: "estime" }], total: { centimes: 50, devise: "EUR" } }, true, "Essai", { videoId: "v-03", travailId: "trav-essai" });
    expect(await depots().reservations.compter((x) => x.travailId === "trav-essai" && x.statut === "active")).toBe(1);
    await credits.libererReservation("trav-essai", "liberee");
    expect(await depots().reservations.compter((x) => x.travailId === "trav-essai" && x.statut === "active")).toBe(0);
  });
});
