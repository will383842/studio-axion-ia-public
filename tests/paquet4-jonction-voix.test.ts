/**
 * INTÉGRATION PAQUET 4 — garde « aucun maillon d'essai en production » (équipe 3, B11) × garde « voix d'essai » de
 * l'avatar (équipe 5, B4). Les deux ne doivent jamais donner à Will deux consignes contraires :
 *  - voix reliée dans Réglages > Connexions, mais la voix du PERSONNAGE est une voix d'essai → les deux gardes disent
 *    « Reliez d'abord votre voix HeyGen dans Personnages. » (jamais « Reliez cet outil dans Réglages > Connexions ») ;
 *  - voix pas reliée du tout dans Connexions → B11 renvoie bien vers Réglages > Connexions.
 * Aucun appel réseau : seules des estimations sont lues (valeurs factices de serveur, aucune vraie clé).
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import type { CommandeFabrication, LigneCout } from "@/domaine/types";

process.env.HEYGEN_API_KEY = "cle-heygen-factice-paquet4";
process.env.FOURNISSEUR_VOIX = "heygen";
process.env.R2_ACCOUNT_ID = "compte-essai";
process.env.R2_ACCESS_KEY_ID = "ACCES-ESSAI";
process.env.R2_SECRET_ACCESS_KEY = "secret-essai";
process.env.R2_BUCKET = "seau-essai";
process.env.FOURNISSEUR_STOCKAGE = "r2";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.stubGlobal("fetch", (async () => {
  throw new Error("réseau interdit");
}) as typeof fetch);

const { reinitialiserDepots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { refusSimulationEnProduction } = await import("@/services/fabrication");
const { refusVoixEssai, MESSAGE_VOIX_ESSAI } = await import("@/moteurs/montage-avocat");
const { ecrireParametre } = await import("@/services/_commun");
const { centimes } = await import("@/lib/montants");

const MDP = "paquet4-jonction-voix";
const PROD = { NODE_ENV: "production", STUDIO_RENDU_URL: "http://studio-rendu.essai" };
const COMMANDE = { moteurId: "montage-avocat", formatId: "avocat" };

const ligne = (etape: string, fournisseur: string, c: number): LigneCout => ({ etape, fournisseur, unite: "forfait", quantite: 1, prixUnitaire: centimes(c), total: centimes(c), nature: "estime" });
/** Le double est payé pour de vrai ; la voix de la vidéo est celle d'essai du personnage. */
const LIGNES = [ligne("Voix", "simulation", 0), ligne("Votre double", "heygen", 900)];

beforeAll(async () => preparerMotDePasse(MDP));
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});
afterEach(() => vi.unstubAllEnvs());

describe("B11 × B4 : une seule consigne pour la voix", () => {
  it("voix reliée dans Connexions, voix d'essai du personnage : B11 dit « Personnages », comme la garde de l'avatar", async () => {
    const b11 = await refusSimulationEnProduction(COMMANDE, LIGNES, PROD);
    expect(b11).toContain(MESSAGE_VOIX_ESSAI);
    expect(b11).toContain("Rien n'a été payé");
    expect(b11).not.toContain("Réglages > Connexions");
    const b4 = refusVoixEssai({ distribution: [{ fournisseurVoix: "simulation" }] as CommandeFabrication["distribution"], prises: undefined });
    expect(b4).toBe(MESSAGE_VOIX_ESSAI);
  });

  it("voix pas reliée dans Connexions : B11 renvoie vers Réglages > Connexions", async () => {
    await ecrireParametre("fournisseur.voix", "simulation");
    const b11 = await refusSimulationEnProduction(COMMANDE, LIGNES, PROD);
    expect(b11).toMatch(/la voix est encore en essai/);
    expect(b11).toContain("Réglages > Connexions");
  });

  it("tout est relié (voix HeyGen du personnage) : ni B11 ni B4 ne bloquent", async () => {
    expect(await refusSimulationEnProduction(COMMANDE, [ligne("Voix", "heygen", 0), ligne("Votre double", "heygen", 900)], PROD)).toBeNull();
    expect(refusVoixEssai({ distribution: [{ fournisseurVoix: "heygen" }] as CommandeFabrication["distribution"], prises: undefined })).toBeNull();
  });

  it("hors production : B11 ne bloque rien (essais), quelle que soit la voix", async () => {
    expect(await refusSimulationEnProduction(COMMANDE, LIGNES, { NODE_ENV: "test", STUDIO_RENDU_URL: PROD.STUDIO_RENDU_URL })).toBeNull();
  });
});
