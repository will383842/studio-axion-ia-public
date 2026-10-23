/**
 * P2C · ajout après X9 : la feuille « Votre vidéo » montre DÈS LE DÉPART le montant que le lancement réserve, pour UNE
 * seule confirmation. Depuis X11, ce format (`publication: "aucune"`) n'a plus la ligne « Textes des réseaux » : le
 * montant de la feuille est celui du lancement commun (`avecTextesDesReseaux`), même avec Claude actif pour les textes.
 * Claude « actif » pour les textes (double) : aucun appel, rien de payé ; lancement par un double.
 * Portage P9 : la version de #167 ne passait pas `empreinteScriptRelu` ; sur master (V4-3) un cas à script validé ne part que
 * relu, la demande porte donc l'empreinte du script relu (`RELU_RECRUTEMENT`). Le reste de l'attente est celui de #167.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";
import { RELU_RECRUTEMENT } from "../../helpers/script-relu";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
// Claude écrirait les textes des réseaux en fin de fabrication : la ligne « Textes des réseaux » existe.
vi.mock("@/services/depense-claude-video", async (original) => ({ ...(await original<typeof import("@/services/depense-claude-video")>()), claudeTextesActif: async () => true }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const service = await import("@/services/cas-concret");
const { avecTextesDesReseaux } = await import("@/services/publications");
const { estimerDepuisCas } = await import("@/moteurs/montage-cas-concret");
const { trouverCas } = await import("@/formats/cas-concret/catalogue");

const MDP = "cas-concret-p2c-prix";
const RESEAUX = ["facebook", "instagram", "tiktok", "linkedin"];

beforeAll(async () => {
  process.env.SESSION_SECRET = "t".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

describe("P2C · une seule confirmation, au montant complet", () => {
  it.each(["recrutement-apporteurs", "cycle-de-formation", "email-difficile"])("%s : la feuille montre le montant du lancement ; un seul accord lance la vidéo", async (casId) => {
    const cas = trouverCas(casId)!;
    const feuille = await service.estimerCas(casId, RESEAUX, false, { essai: true });
    const sansTextes = estimerDepuisCas(cas, RESEAUX as never, false, {}).total.centimes;
    const lancer = vi.fn(async () => ({ travailId: "t-p2c" }));
    const r = await service.preparerEtLancer({ casId, reseaux: RESEAUX, mot: "IA", avecMot: false, essai: true, accordCentimes: feuille.centimes, ...(casId === "recrutement-apporteurs" ? { empreinteScriptRelu: RELU_RECRUTEMENT } : {}) }, { lancer });
    // Essai : jamais de textes payés, la ligne n'existe pas ; le montant est celui de la feuille.
    expect(r.statut).toBe("lancee");
    expect(feuille.centimes).toBeGreaterThanOrEqual(sansTextes);
  });

  it("hors essai, Claude actif pour les textes : le montant de la feuille est celui du lancement (un accord suffit)", async () => {
    const casId = "recrutement-apporteurs";
    const cas = trouverCas(casId)!;
    // Cas validé et voix prête : le lancement hors essai est permis.
    const { confirmerCas } = service;
    await confirmerCas(casId);
    const d = depots();
    const voix = (await d.voix.obtenir("voix-will"))!;
    await d.voix.enregistrer({ ...voix, id: "voix-avocat-p2c", statut: "pret" });
    await d.personnages.modifier("p-will", { voixParFormat: { avocat: "voix-avocat-p2c" } });

    const feuille = await service.estimerCas(casId, RESEAUX, false, { mot: "IA" });
    expect(feuille.refus).toBeUndefined();
    const lancer = vi.fn(async () => ({ travailId: "t-p2c" }));
    const r = await service.preparerEtLancer({ casId, reseaux: RESEAUX, mot: "IA", avecMot: false, accordCentimes: feuille.centimes, empreinteScriptRelu: RELU_RECRUTEMENT }, { lancer });
    expect(r.statut).toBe("lancee");
    expect(lancer).toHaveBeenCalledTimes(1);
    expect(lancer).toHaveBeenCalledWith(expect.any(String), feuille.centimes);

    // Le même calcul que le lancement commun, sur le brouillon créé : aucune ligne « Textes des réseaux » (X11), même total.
    const videoId = r.statut === "lancee" ? r.videoId : "";
    const base = estimerDepuisCas(cas, RESEAUX as never, false, { voix: { fournisseur: voix.fournisseur }, motSur: [] });
    const commun = await avecTextesDesReseaux(videoId, base);
    expect(commun.textesReseaux).toBeUndefined();
    expect(feuille.centimes).toBe(commun.total.centimes);
  });
});
