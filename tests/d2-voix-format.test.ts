/**
 * D2 — VOIX PAR DÉFAUT PAR FORMAT (lot « intensité · crédits · calage », 02/10).
 * Fiche personnage → « Vidéo type avocat → Voix avocat rapide » → nouvelle vidéo avocat : la bonne voix est choisie
 * d'office, modifiable vidéo par vidéo, et les prononciations de CETTE voix sont celles appliquées.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const personnages = await import("@/services/personnages");
const videos = await import("@/services/videos");
const fabrication = await import("@/services/fabrication");
const prononciations = await import("@/services/prononciations");
import { voixInitiale } from "@/assistant/express/logique";
import { voixPourFormat } from "@/domaine/voix-format";

const MDP_TEST = "essai-d2-voix-format";

beforeAll(async () => {
  process.env.SESSION_SECRET = "e".repeat(48);
  const empreinte = await hash(MDP_TEST, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP_TEST, false);
  // Will enregistre une voix « avocat » rapide (à côté de sa voix habituelle, rien n'est effacé).
  const base = (await depots().voix.obtenir("voix-will"))!;
  await depots().voix.enregistrer({ ...base, id: "voix-avocat", nom: "Voix avocat rapide", reglages: { ...base.reglages, vitesse: 1.15 } });
});

describe("voix par format", () => {
  it("se règle en une action dans la fiche personnage ; voix d'un autre personnage ou pas prête : refusée ; « habituelle » la retire", async () => {
    await personnages.choisirVoixPourFormat("p-will", "avocat", "voix-avocat");
    expect((await depots().personnages.obtenir("p-will"))!.voixParFormat).toEqual({ avocat: "voix-avocat" });
    expect((await depots().personnages.obtenir("p-will"))!.voixParDefautId).not.toBe("voix-avocat"); // la voix habituelle ne bouge pas
    await expect(personnages.choisirVoixPourFormat("p-will", "avocat", "voix-clara")).rejects.toMatchObject({ code: "INTROUVABLE" });
    await depots().voix.modifier("voix-avocat", { statut: "en_preparation" });
    await expect(personnages.choisirVoixPourFormat("p-will", "podcast", "voix-avocat")).rejects.toMatchObject({ code: "VOIX_PAS_PRETE" });
    await expect(personnages.choisirVoixPourFormat("p-will", "format-inconnu", "voix-will")).rejects.toMatchObject({ code: "INTROUVABLE" });
    await personnages.choisirVoixPourFormat("p-will", "avocat", null);
    expect((await depots().personnages.obtenir("p-will"))!.voixParFormat).toEqual({});
    expect(await depots().voix.compter((v) => v.personnageId === "p-will")).toBe(2); // rien d'effacé
  });

  it("parcours : fiche personnage → nouvelle vidéo avocat → la voix avocat est choisie d'office (et pas pour un autre format)", async () => {
    await personnages.choisirVoixPourFormat("p-will", "avocat", "voix-avocat");
    const avocat = await videos.creerBrouillon("avocat");
    expect((await depots().videos.obtenir(avocat))!.distribution[0]).toMatchObject({ personnageId: "p-will", voixId: "voix-avocat" });
    // L'assistant (page, Distribution, Votre vidéo) résout par la même fonction.
    const will = (await depots().personnages.obtenir("p-will"))!;
    const sesVoix = await depots().voix.lister((v) => v.personnageId === "p-will");
    expect(voixInitiale(sesVoix, will, "avocat")).toBe("voix-avocat");
    expect(voixPourFormat(sesVoix, will, "podcast")?.id).toBe(will.voixParDefautId ?? "voix-will");
  });

  it("modifiable vidéo par vidéo ; les prononciations de la voix choisie sont celles appliquées", async () => {
    await personnages.choisirVoixPourFormat("p-will", "avocat", "voix-avocat");
    await prononciations.ajouterPrononciation("Axion", "Ak-sion", { portee: { voixId: "voix-avocat" } });
    await prononciations.ajouterPrononciation("Axion", "Axe-ion", { portee: { voixId: "voix-will" } });
    const v = (await depots().videos.obtenir("v-03"))!;
    await depots().videos.modifier("v-03", { distribution: v.distribution.map((x, i) => (i === 0 ? { ...x, personnageId: "p-will", voixId: "voix-avocat" } : x)) });
    let c = await fabrication.construireCommande("v-03");
    expect(c.distribution[0]).toMatchObject({ voixId: "voix-avocat" });
    expect(c.prononciations?.find((p) => p.mot === "Axion")?.prononciation).toBe("Ak-sion");
    // Changée pour cette vidéo seulement : la voix et ses prononciations suivent ; le réglage du format reste.
    await depots().videos.modifier("v-03", { distribution: v.distribution.map((x, i) => (i === 0 ? { ...x, personnageId: "p-will", voixId: "voix-will" } : x)) });
    c = await fabrication.construireCommande("v-03");
    expect(c.distribution[0]).toMatchObject({ voixId: "voix-will" });
    expect(c.prononciations?.find((p) => p.mot === "Axion")?.prononciation).toBe("Axe-ion");
    expect((await depots().personnages.obtenir("p-will"))!.voixParFormat).toEqual({ avocat: "voix-avocat" });
  });
});
