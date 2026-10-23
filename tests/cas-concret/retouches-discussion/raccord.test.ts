/**
 * P6 · raccord du réglage `casConcret.retouches` au moteur. `refusRetouche` est synchrone, la lecture du réglage ne l'est
 * pas : le service relit le réglage AVANT chaque chemin qui interroge le moteur (`actualiserReglageRetouches`) et le moteur
 * lit la dernière valeur connue. Éteint (défaut), inconnu ou illisible : le moteur refuse, comme avant le portage.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const auth = await import("@/services/auth");
const reglages = await import("@/services/cas-concret-reglages");
await import("@/services/cas-concret-branchements");
const { moteurDeCommande } = await import("@/moteurs");
const { banc } = await import("../moteur/doubles");

const MDP = "cas-concret-raccord";

beforeAll(async () => {
  process.env.SESSION_SECRET = "r".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  await reglages.actualiserReglageRetouches();
});

describe("P6 · le moteur du studio lit le réglage `casConcret.retouches`", () => {
  const commande = () => banc().commande();

  it("éteint (défaut) : refus comme avant, avant toute réservation", () => {
    expect(reglages.retouchesAllumeesConnues()).toBe(false);
    expect(moteurDeCommande(commande()).refusRetouche?.(commande())?.code).toBe("RETOUCHE_NON_PRISE_EN_CHARGE");
  });

  it("allumé puis relu : le moteur ne refuse plus ; éteint puis relu : il refuse de nouveau", async () => {
    await ecrireParametre("casConcret.retouches", true);
    // Tant que le réglage n'est pas relu, la dernière valeur connue (éteint) vaut : jamais une retouche par surprise.
    expect(moteurDeCommande(commande()).refusRetouche?.(commande())?.code).toBe("RETOUCHE_NON_PRISE_EN_CHARGE");
    await reglages.actualiserReglageRetouches();
    expect(moteurDeCommande(commande()).refusRetouche?.(commande())).toBeNull();
    await ecrireParametre("casConcret.retouches", false);
    await reglages.actualiserReglageRetouches();
    expect(moteurDeCommande(commande()).refusRetouche?.(commande())?.code).toBe("RETOUCHE_NON_PRISE_EN_CHARGE");
  });

  it("une valeur qui n'est pas exactement vraie (« true » en texte, 1) reste éteinte", async () => {
    for (const v of ["true", 1, "oui"]) {
      await ecrireParametre("casConcret.retouches", v);
      await reglages.actualiserReglageRetouches();
      expect(reglages.retouchesAllumeesConnues()).toBe(false);
    }
  });

  it("`preparerReglagesMoteur` ne lit le réglage que pour le cas concret", async () => {
    await ecrireParametre("casConcret.retouches", true);
    await reglages.preparerReglagesMoteur({ ...commande(), moteurId: "simulation" });
    expect(reglages.retouchesAllumeesConnues()).toBe(false);
    await reglages.preparerReglagesMoteur(commande());
    expect(reglages.retouchesAllumeesConnues()).toBe(true);
  });
});
