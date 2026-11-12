/**
 * GV-EC-01c — double compte de la réservation gardée à la reprise après validation : il n'est PAS établi ; ce test garantit qu'il n'existe pas.
 * Un travail en attente de validation garde sa réservation ; Williams valide, le travail reprend. Combien de
 * réservations ACTIVES (et d'engagements budget) le travail compte-t-il après la reprise ?
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import type { Travail } from "@/domaine/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const travaux = await import("@/services/travaux");
const credits = await import("@/services/credits");
const couts = await import("@/services/couts");
const { moteurDeCommande } = await import("@/moteurs");
const { ecrireParametre, horodatage } = await import("@/services/_commun");

const MDP = "gv-ec-01c";

beforeAll(async () => {
  process.env.SESSION_SECRET = "b".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  credits.injecterLecteursPourEssai(null);
  await auth.seConnecter(MDP, false);
  for (const x of await depots().travaux.lister((t) => t.statut === "en_cours" || t.statut === "en_file")) await depots().travaux.enregistrer({ ...x, statut: "termine" });
  await ecrireParametre("budget.seuilConfirmation", { centimes: 1_000_000, devise: "EUR" });
});

afterEach(() => {
  credits.injecterLecteursPourEssai(null);
});

/** Lance v-03 puis range le travail comme le ferait le chemin commun quand le moteur renvoie ce code. */
async function mettreEnEchec(code: string, origine?: "studio" | "usine"): Promise<{ travailId: string; avant: Travail }> {
  const { travailId } = await fabrication.lancerFabrication("v-03", { confirme: true });
  const t = (await depots().travaux.obtenir(travailId))!;
  const version = (await depots().versions.obtenir(t.versionId!))!;
  if (origine) await depots().versions.modifier(version.id, { commande: { ...version.commande, origine } });
  const commande = origine ? { ...version.commande, origine } : version.commande;
  const moteur = moteurDeCommande(commande);
  // Le lancement simulé ne réserve rien : on pose la réservation et l'engagement qu'un vrai lancement aurait posés.
  await depots().reservations.enregistrer({ id: `res-${travailId}`, fournisseur: "fal", videoId: t.cibleId, travailId, centimes: 120, devise: "USD", statut: "active", ...horodatage() });
  await couts.engagerBudget(travailId, { centimes: 100, devise: "EUR" }, t.cibleId);
  const iso = new Date().toISOString();
  const sortie: Travail = {
    ...t,
    statut: "echec",
    erreur: { code, reessayable: true, messagePourWill: "Cette étape attend votre décision.", detailTechnique: "pause" },
    etapes: t.etapes.map((e, i) => (i === 0 ? { ...e, statut: "echec" as const } : e)),
    modifieLe: iso,
  };
  const r = await travaux.ecrireAvancement({ travail: t, commande, moteur }, { travail: sortie });
  expect(r.ecrit).toBe(true);
  return { travailId, avant: t };
}


/** Tous les compteurs de quota de l'usine (`plafond.compteur.*`), triés : doivent rester identiques à la reprise. */
const compteursDeQuota = async () => (await depots().parametres.lister((p) => p.id.startsWith("plafond.compteur."))).map((p) => [p.id, p.valeur]).sort();

const reservationsActives = (travailId: string) => depots().reservations.compter((r) => r.travailId === travailId && r.statut === "active");

describe("double compte à la reprise après validation", () => {
  it.each(["studio", "usine"] as const)("commande %s : une seule réservation active et un seul engagement après la reprise", async (origine) => {
    const { travailId } = await mettreEnEchec("IV_SCRIPT_A_VALIDER", origine);
    expect(await reservationsActives(travailId)).toBe(1);
    const compteursAvant = await compteursDeQuota();
    const r = await travaux.reessayerTravail(travailId);
    expect(r.statut).not.toBe("echec");
    expect(await reservationsActives(travailId)).toBe(1);
    // Le quota de l'usine n'est pas recompté par la reprise.
    expect(await compteursDeQuota()).toEqual(compteursAvant);
    // Un tour de la boucle de fond après la reprise : toujours une seule réservation active.
    const { tourDeBoucle } = await import("@/services/boucle");
    await tourDeBoucle();
    expect(await reservationsActives(travailId)).toBe(1);
    expect(await compteursDeQuota()).toEqual(compteursAvant);
    expect(await depots().reservations.compter((x) => x.travailId === travailId)).toBe(1);
    expect((await couts.resumeBudget()).engage.centimes).toBe(100);
  });
});
