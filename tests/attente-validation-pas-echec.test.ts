/**
 * GV-EC-01b — une attente de validation (carte ou script à relire par Williams) n'est plus un échec :
 * réservation gardée, aucune notification d'erreur, ligne durable de famille « attente-validation », reprise sans
 * contrôle de budget (commande de Williams ou de l'usine). Un vrai échec ne change pas. Faux dépôts, aucun réseau.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import type { Travail } from "@/domaine/types";
import { CODES_ATTENTE_VALIDATION } from "@/domaine/sujets-traites";
import { TYPE_EVENEMENT_ECHEC, type EvenementEchec } from "@/domaine/journal-echecs";

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

const MDP = "gv-ec-01b";

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
  evenementsEchecAvant = (await depots().evenements.lister((e) => e.type === "echec")).length;
  notifsEchecAvant = (await depots().notifications.lister((n) => n.type === "echec")).length;
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

const reservationsActives = (travailId: string) => depots().reservations.compter((r) => r.travailId === travailId && r.statut === "active");
let notifsEchecAvant = 0;
const notifsEchec = async () => (await depots().notifications.lister((n) => n.type === "echec")).slice(notifsEchecAvant);
let evenementsEchecAvant = 0;
const evenementsEchec = async () => (await depots().evenements.lister((e) => e.type === "echec")).slice(evenementsEchecAvant);
const lignesDurables = async () => (await depots().evenements.lister((e) => e.type === TYPE_EVENEMENT_ECHEC)) as EvenementEchec[];

describe("une attente de validation n'est pas un échec", () => {
  it("la liste fermée contient bien les trois codes attendus", () => {
    expect([...CODES_ATTENTE_VALIDATION].sort()).toEqual(["CAS_CONCRET_SCRIPT_A_VALIDER", "IV_CARTE_A_VALIDER", "IV_SCRIPT_A_VALIDER"]);
  });

  it.each(CODES_ATTENTE_VALIDATION)("%s : réservation gardée, pas d'alerte d'échec, ligne durable « attente-validation »", async (code) => {
    const { travailId: id } = await mettreEnEchec(code);
    expect(await reservationsActives(id)).toBe(1);
    expect(await notifsEchec()).toHaveLength(0);
    expect(await evenementsEchec()).toHaveLength(0);
    const infos = await depots().notifications.lister((n) => n.type === "info" && /attend votre/.test(n.titre));
    expect(infos).toHaveLength(1);
    expect(infos[0].titre).toBe(/CARTE/.test(code) ? "Une carte attend votre validation" : "Un script attend votre relecture");
    // Aucun montant dans le message ni dans le journal.
    expect(`${infos[0].titre} ${infos[0].message ?? ""}`).not.toMatch(/\d\s*(€|euros?)|€/);
    const attentes = await depots().evenements.lister((e) => e.type === "attente");
    expect(attentes).toHaveLength(1);
    expect(attentes[0].message).not.toMatch(/€|\d+[.,]\d+/);
    const lignes = await lignesDurables();
    expect(lignes).toHaveLength(1);
    expect(lignes[0].echec.famille).toBe("attente-validation");
    expect(lignes[0].echec.code).toBe(code);
    // Statuts en base inchangés : le travail et la vidéo restent « echec ».
    expect((await depots().travaux.obtenir(id))?.statut).toBe("echec");
  });
});

describe("reprise après validation", () => {
  it("commande de Williams (studio) : acceptée même si le budget du mois est dépassé entre-temps", async () => {
    const { travailId } = await mettreEnEchec("IV_SCRIPT_A_VALIDER", "studio");
    const depense = (await couts.resumeBudget()).depense.centimes;
    await ecrireParametre("budget.mensuel", { centimes: depense, devise: "EUR" });
    const r = await travaux.reessayerTravail(travailId);
    expect(r.statut).not.toBe("echec");
    expect(await reservationsActives(travailId)).toBeGreaterThan(0);
    // Rien n'est recompté : l'engagement posé à la commande compte une seule fois (100 centimes posés plus haut).
    expect((await couts.resumeBudget()).engage.centimes).toBe(100);
  });

  it("commande de l'usine : acceptée, quota non recompté, même sans budget reçu de l'usine", async () => {
    const { travailId } = await mettreEnEchec("IV_CARTE_A_VALIDER", "usine");
    const depense = (await couts.resumeBudget()).depense.centimes;
    await ecrireParametre("budget.mensuel", { centimes: depense, devise: "EUR" });
    const r = await travaux.reessayerTravail(travailId);
    expect(r.statut).not.toBe("echec");
    expect((await couts.resumeBudget()).engage.centimes).toBe(100);
  });

  it("« Arrêter » pendant l'attente libère la réservation gardée", async () => {
    const { travailId } = await mettreEnEchec("IV_SCRIPT_A_VALIDER");
    expect(await reservationsActives(travailId)).toBeGreaterThan(0);
    await travaux.annulerTravail(travailId);
    expect(await reservationsActives(travailId)).toBe(0);
    expect((await depots().travaux.obtenir(travailId))?.statut).toBe("annule");
  });
});

describe("un vrai échec ne change pas", () => {
  it("IV_CONTROLES : réservation libérée, notification d'échec, événement d'échec, reprise contrôlée", async () => {
    const { travailId } = await mettreEnEchec("IV_CONTROLES", "studio");
    expect(await reservationsActives(travailId)).toBe(0);
    expect(await notifsEchec()).toHaveLength(1);
    expect(await evenementsEchec()).toHaveLength(1);
    expect(await depots().evenements.lister((e) => e.type === "attente")).toHaveLength(0);
    const lignes = await lignesDurables();
    expect(lignes[0].echec.famille).not.toBe("attente-validation");
    // La reprise d'un vrai échec passe toujours par le contrôle d'argent (refus couverts par c1-argent-b5-reessayer) :
    // ici on vérifie qu'elle réactive la réservation libérée.
    const r = await travaux.reessayerTravail(travailId);
    expect(r.statut).not.toBe("echec");
    expect(await reservationsActives(travailId)).toBe(1);
  });
});

describe("GV-EC-01c : vidéo supprimée pendant l'attente de validation", () => {
  const videos = () => import("@/services/videos");
  const reservationsLiberees = (travailId: string) => depots().reservations.compter((r) => r.travailId === travailId && r.statut === "liberee");

  it("la réservation gardée est rendue une seule fois ; une seconde suppression ne libère rien de plus", async () => {
    const { travailId } = await mettreEnEchec("IV_SCRIPT_A_VALIDER");
    const cible = (await depots().travaux.obtenir(travailId))!.cibleId;
    expect(await reservationsActives(travailId)).toBe(1);
    const espion = vi.spyOn(credits, "libererReservation");
    try {
      expect(await (await videos()).supprimerVideoDefinitivement(cible)).toBe(true);
      expect(await reservationsActives(travailId)).toBe(0);
      expect(await reservationsLiberees(travailId)).toBe(1);
      expect(espion.mock.calls.filter((c) => c[0] === travailId)).toEqual([[travailId, "liberee"]]);
      // Suppression relancée : la vidéo n'existe plus, aucune libération supplémentaire.
      await (await videos()).supprimerVideoDefinitivement(cible).catch(() => undefined);
      expect(espion.mock.calls.filter((c) => c[0] === travailId)).toHaveLength(1);
      expect(await reservationsLiberees(travailId)).toBe(1);
      // La réservation reste en comptabilité (jamais effacée), l'engagement du budget est rendu.
      expect(await depots().reservations.compter((r) => r.travailId === travailId)).toBe(1);
      expect((await couts.resumeBudget()).engage.centimes).toBe(0);
    } finally {
      espion.mockRestore();
    }
  });

  it("vidéo sans attente de validation (vrai échec) : aucun appel de libération par la suppression", async () => {
    const { travailId } = await mettreEnEchec("IV_CONTROLES");
    const cible = (await depots().travaux.obtenir(travailId))!.cibleId;
    const espion = vi.spyOn(credits, "libererReservation");
    try {
      expect(await (await videos()).supprimerVideoDefinitivement(cible)).toBe(true);
      expect(espion).not.toHaveBeenCalled();
    } finally {
      espion.mockRestore();
    }
  });
});
