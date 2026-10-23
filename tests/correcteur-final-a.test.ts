/**
 * CORRECTEUR FINAL A — TEST-UI-REEL U1 et U2 (les bloquants 2 à 7 de VERIF-E2E-1 sont couverts par les tests
 * `e2e-verif1-*`, repassés de `it.fails` en `it`). Aucun appel réseau, aucune clé.
 *
 * U1 (BLOQUANT) : le personnage d'EXEMPLE « p-will » (masqué) comptait comme « Moi » : Will ne pouvait pas se créer.
 * U2 : la durée d'un texte collé (et donc le prix) se calculait à 4,4 mots/s, alors que la voix HeyGen de Will lit à
 * environ 2,6 mots/s (mesure du 02/10) : 55 mots annoncés 12 s au lieu d'environ 21 s.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const personnages = await import("@/services/personnages");
const { moiExiste } = await import("@/services/B-personnages-bibliotheque");
const { trouverMoi } = await import("@/services/moi");
const { choisirMoi, estMoiReel } = await import("@/domaine/moi");
const videos = await import("@/services/videos");
const fabrication = await import("@/services/fabrication");
const { ecrireParametre } = await import("@/services/_commun");
const { DEBIT_VOIX_HEYGEN_MESURE, debitLecture, dureeVideo, estimerDureeTexte, obtenirFormat } = await import("@/formats");
const { texteScript } = await import("@/domaine/derivations");

const MDP = "essai-correcteur-final-a";

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

describe("U1 — le personnage d'exemple n'est jamais « Moi »", () => {
  it("exemples masqués : « Moi » n'existe pas encore, Will se crée, une seule fois ; l'exemple n'est pas effacé", async () => {
    await ecrireParametre("afficherExemples", false);
    const exemple = (await depots().personnages.obtenir("p-will"))!;
    expect(exemple).toMatchObject({ nature: "moi", estDemo: true });
    // La liste est vide (exemples masqués) et le choix « Moi » n'est plus grisé.
    expect(await personnages.listerPersonnages()).toEqual([]);
    expect(await moiExiste()).toBe(false);
    expect(await trouverMoi()).toBeNull();
    const id = await personnages.creerPersonnage({ nom: "Williams", nature: "moi" });
    expect(await moiExiste()).toBe(true);
    expect((await trouverMoi())?.id).toBe(id);
    expect((await depots().personnages.obtenir(id))?.principal).toBe(true);
    // Une seconde fois : refusé (un seul vrai « Moi »).
    await expect(personnages.creerPersonnage({ nom: "Williams", nature: "moi" })).rejects.toMatchObject({ code: "DEJA_MOI" });
    // Rien n'est effacé : l'exemple reste en base.
    expect(await depots().personnages.obtenir("p-will")).toBeTruthy();
  });

  it("exemples affichés : le vrai « Moi » passe avant l'exemple (nouvelle vidéo, voix par défaut)", async () => {
    // Avant que Will existe, l'exemple sert (exemples affichés) ; dès qu'il existe, c'est lui.
    expect((await trouverMoi())?.id).toBe("p-will");
    expect(await moiExiste()).toBe(false);
    const id = await personnages.creerPersonnage({ nom: "Williams", nature: "moi" });
    expect((await trouverMoi())?.id).toBe(id);
    const videoId = await videos.creerBrouillon("avocat");
    expect((await depots().videos.obtenir(videoId))?.distribution[0]?.personnageId).toBe(id);
  });

  it("exemples masqués : une nouvelle vidéo ne prend jamais le personnage d'exemple", async () => {
    await ecrireParametre("afficherExemples", false);
    const videoId = await videos.creerBrouillon("avocat");
    expect((await depots().videos.obtenir(videoId))?.distribution[0]?.personnageId).not.toBe("p-will");
  });

  it("règle pure : le vrai d'abord, l'exemple seulement s'il est affiché", () => {
    const exemple = { id: "p-will", nature: "moi" as const, estDemo: true, principal: true };
    const will = { id: "p-1", nature: "moi" as const, estDemo: false, principal: false };
    const autre = { id: "p-2", nature: "reel" as const, estDemo: false, principal: false };
    expect(estMoiReel(exemple)).toBe(false);
    expect(estMoiReel(will)).toBe(true);
    expect(choisirMoi([exemple, will, autre], (p) => p, true)?.id).toBe("p-1");
    expect(choisirMoi([exemple, autre], (p) => p, true)?.id).toBe("p-will");
    expect(choisirMoi([exemple, autre], (p) => p, false)).toBeUndefined();
  });
});

describe("U2 — la durée d'un texte collé suit la vraie voix (et donc le prix)", () => {
  const texte55 = Array.from({ length: 55 }, (_, i) => (i % 9 === 8 ? "dossier." : "client")).join(" ");

  it("55 mots lus par la voix HeyGen de Will : environ 21 s, plus 12 s", () => {
    const avocat = obtenirFormat("avocat");
    expect(estimerDureeTexte(avocat, texte55)).toBe(12); // avant : la recette seule (débit d'écriture du double), « ≈ 12 s »
    const heygen = { fournisseur: "heygen", reglages: { vitesse: 1 } };
    expect(debitLecture(avocat, heygen)).toBe(DEBIT_VOIX_HEYGEN_MESURE);
    expect(estimerDureeTexte(avocat, texte55, debitLecture(avocat, heygen))).toBe(21);
    // La vitesse réglée sur la voix compte ; une voix d'essai garde la recette du format.
    expect(debitLecture(avocat, { fournisseur: "heygen", reglages: { vitesse: 1.5 } })).toBeCloseTo(3.9, 6);
    expect(debitLecture(avocat, { fournisseur: "simulation", reglages: { vitesse: 1 } })).toBe(4.4);
    expect(dureeVideo(avocat, texte55, 30, debitLecture(avocat, heygen))).toBe(21);
  });

  it("la commande (donc le prix) d'une vidéo lue par la voix HeyGen prend la vraie durée", async () => {
    const video = (await depots().videos.obtenir("v-07"))!;
    const script = (await depots().scripts.obtenir(video.scriptId!))!;
    const mots = texteScript(script.blocs).trim().split(/\s+/).filter(Boolean).length;
    const voixId = (await fabrication.construireCommande("v-07")).distribution[0]?.voixId;
    expect(voixId).toBeTruthy();
    const avant = await fabrication.construireCommande("v-07");
    expect(avant.dureeCibleSec).toBe(Math.max(1, Math.round(mots / 4.4)));
    await depots().voix.modifier(voixId!, { fournisseur: "heygen", reglages: { vitesse: 1, stabilite: 60, emotion: 45 } });
    const apres = await fabrication.construireCommande("v-07");
    expect(apres.dureeCibleSec).toBe(Math.max(1, Math.round(mots / DEBIT_VOIX_HEYGEN_MESURE)));
    expect(apres.dureeCibleSec).toBeGreaterThan(avant.dureeCibleSec);
  });
});
