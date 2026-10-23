/**
 * P2S, lot A, point 1 · Porte B côté service : du texte libre de Will à la feuille « Votre vidéo », appel Claude détaché
 * (jamais attendu), garde d'honnêteté (« à confirmer » bloque, avec la même phrase à l'écran et au lancement), aucun
 * appel pour un texte trop court ou hors sujet, jamais au catalogue. Base en mémoire, Claude simulé par un double :
 * aucun appel réel, aucun `fetch`.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const auth = await import("@/services/auth");
const service = await import("@/services/cas-concret");
const porteB = await import("@/services/cas-concret-porte-b");
const { construireCommande } = await import("@/services/fabrication");
const { moteurMontageCasConcret } = await import("@/moteurs/montage-cas-concret");
const { PHRASES_AVANT_PRIX } = await import("@/moteurs/montage-cas-concret/avant-prix");
const { MESSAGE_DESCRIPTION_COURTE, MESSAGE_DESCRIPTION_HORS_SUJET } = await import("@/moteurs/montage-cas-concret/honnetete");

import type { DefinitionRole, EntreeRole } from "@/generateur/roles/types";
import type { ReponseAppelEcriture } from "@/moteurs/montage-cas-concret/outils";

const MDP = "cas-concret-porte-b";
const RESEAUX = ["facebook", "instagram", "tiktok", "linkedin"];
const CABINET = "Un cabinet comptable qui reçoit 200 factures par mois et les saisit à la main, une par une.";
const EQUIPE = "Une équipe de dix personnes qui veut apprendre à se servir de l'IA pour répondre à ses e-mails.";

beforeAll(async () => {
  process.env.SESSION_SECRET = "t".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

/** Double de Claude (la simulation du rôle) et des appels détachés : l'appel ne part qu'à `repondre()`. */
function doubles() {
  const executer = vi.fn(async (_videoId: string, role: DefinitionRole, entree: EntreeRole) => ({ ok: true as const, simule: true, donnees: role.simuler(entree) }));
  const enAttente = new Map<string, () => Promise<ReponseAppelEcriture>>();
  const reponses = new Map<string, ReponseAppelEcriture>();
  const appels = {
    lancer: (cle: string, appel: () => Promise<ReponseAppelEcriture>) => void enAttente.set(cle, appel),
    lire: async (cle: string) => reponses.get(cle) ?? null,
  };
  const repondre = async () => {
    for (const [cle, appel] of enAttente) reponses.set(cle, await appel());
    enAttente.clear();
  };
  return { dep: { executer, appels, claudeActif: async () => false }, executer, enAttente, repondre };
}

/** Jusqu'au cas prêt : chaque passage relit, l'appel lancé répond entre deux passages. */
async function jusquAuCas(texte: string, d = doubles()) {
  let etat = await porteB.demarrerPorteB(texte, d.dep);
  for (let i = 0; i < 6 && etat.statut === "en-cours"; i++) {
    await d.repondre();
    etat = await porteB.suivrePorteB(etat.videoId, d.dep);
  }
  return etat;
}

const lancer = vi.fn(async () => ({ travailId: "t-porte-b" }));
const videosCas = () => depots().videos.lister((v) => v.formatId === "cas-concret");

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  await ecrireParametre("casConcret.porteB", true); // allumé dans la base de test seulement
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    throw new Error("Aucun appel réseau dans ces tests.");
  });
});
afterEach(() => vi.restoreAllMocks());

describe("porte B : refus sans appel", () => {
  it("texte trop court : la phrase d'aide, aucune vidéo, aucun appel", async () => {
    const d = doubles();
    expect(await porteB.demarrerPorteB("montre comment on relance les devis", d.dep)).toEqual({ statut: "refusee", phrase: MESSAGE_DESCRIPTION_COURTE });
    expect(d.executer).not.toHaveBeenCalled();
    expect(await videosCas()).toHaveLength(0);
  });

  it("texte hors sujet : la phrase d'aide, aucune vidéo, aucun appel", async () => {
    const d = doubles();
    const r = await porteB.demarrerPorteB("Il fait très beau aujourd'hui et le ciel est vraiment bleu au-dessus de la mer.", d.dep);
    expect(r).toEqual({ statut: "refusee", phrase: MESSAGE_DESCRIPTION_HORS_SUJET });
    expect(d.executer).not.toHaveBeenCalled();
    expect(await videosCas()).toHaveLength(0);
  });
});

describe("porte B : l'appel est détaché", () => {
  it("le premier passage lance l'appel sans l'attendre ; tant qu'il n'a pas répondu, rien n'est relancé", async () => {
    const d = doubles();
    const premier = await porteB.demarrerPorteB(CABINET, d.dep);
    expect(premier).toMatchObject({ statut: "en-cours", phrase: porteB.PHRASE_PREPARATION });
    expect(d.enAttente.size).toBe(1);
    expect(d.executer).not.toHaveBeenCalled();
    if (premier.statut !== "en-cours") throw new Error("attendu en cours");
    // Deux relectures, et le même texte redemandé : jamais un second lancement.
    expect((await porteB.suivrePorteB(premier.videoId, d.dep)).statut).toBe("en-cours");
    expect((await porteB.demarrerPorteB(CABINET, d.dep)).statut).toBe("en-cours");
    expect(d.enAttente.size).toBe(1);
    await d.repondre();
    const pret = await porteB.suivrePorteB(premier.videoId, d.dep);
    expect(pret.statut).toBe("pret");
    expect(d.executer).toHaveBeenCalledTimes(1);
    expect(await videosCas()).toHaveLength(1);
  });

  it("le cas né de la porte B est gardé avec son brouillon et n'entre jamais au catalogue", async () => {
    const etat = await jusquAuCas(CABINET);
    if (etat.statut !== "pret") throw new Error(etat.statut);
    expect(etat.cas.posture).toBe("offre");
    expect(etat.cas.faits.flatMap((f) => f.valeurs)).toEqual([200]);
    expect(etat.aConfirmer).toEqual([]);
    const { valides, aValider } = await service.listerCas();
    expect([...valides, ...aValider].map((c) => c.cas.id)).not.toContain(etat.cas.id);
    expect(await depots().parametres.obtenir("casConcret.validations")).toBeFalsy();
    const v = (await depots().videos.obtenir(etat.videoId))!;
    expect((v.entrees as { casConcret: Record<string, unknown> }).casConcret).toMatchObject({ porte: "porte-b", description: CABINET, cas: etat.cas });
  });
});

describe("porte B : de la feuille au lancement", () => {
  it("un fait « à confirmer » bloque la feuille et le lancement avec la même phrase ; confirmé, la vidéo part", async () => {
    const etat = await jusquAuCas(EQUIPE);
    if (etat.statut !== "pret") throw new Error(etat.statut);
    expect(etat.aConfirmer).toEqual([{ id: expect.any(String), enonce: expect.stringContaining("10 personnes") }]);
    const choix = { porteB: etat.videoId, empreinteVue: etat.empreinte };
    expect((await service.estimerCas(etat.cas.id, RESEAUX, false, choix)).refus).toBe(PHRASES_AVANT_PRIX.aConfirmer);
    expect(await service.preparerEtLancer({ casId: etat.cas.id, reseaux: RESEAUX, mot: etat.cas.mot, avecMot: false, accordCentimes: 10_000, ...choix }, { lancer })).toEqual({ statut: "refusee", phrase: PHRASES_AVANT_PRIX.aConfirmer });
    expect(lancer).not.toHaveBeenCalled();

    const confirme = await porteB.confirmerFaitPorteB(etat.videoId, etat.aConfirmer[0].id, "confirmer");
    expect(confirme).toMatchObject({ statut: "pret", aConfirmer: [] });
    expect((await service.estimerCas(etat.cas.id, RESEAUX, false, choix)).refus).toBeUndefined();
    const r = await service.preparerEtLancer({ casId: etat.cas.id, reseaux: RESEAUX, mot: etat.cas.mot, avecMot: false, accordCentimes: 10_000, ...choix }, { lancer });
    expect(r).toMatchObject({ statut: "lancee", videoId: etat.videoId });
    // Une seule vidéo : le brouillon de la porte B, avec son cas ; le moteur rejoue la garde et ne refuse rien.
    expect(await videosCas()).toHaveLength(1);
    const commande = await construireCommande(etat.videoId);
    expect(commande.entrees.casConcret).toMatchObject({ porte: "porte-b", casId: etat.cas.id, cas: etat.cas, description: EQUIPE });
    expect(moteurMontageCasConcret.refusAuLancement?.(commande)).toBeNull();
    // Sans la confirmation, le moteur refuse avec la même phrase.
    const sans = { ...commande, entrees: { casConcret: { ...(commande.entrees.casConcret as object), faitsConfirmes: [] } } };
    expect(moteurMontageCasConcret.refusAuLancement?.(sans)).toEqual({ code: "CAS_CONCRET_REFUS_AVANT_PRIX", message: PHRASES_AVANT_PRIX.aConfirmer });
  });

  it("un fait retiré quitte le cas : nouvelle empreinte, plus rien à confirmer", async () => {
    const etat = await jusquAuCas(EQUIPE);
    if (etat.statut !== "pret") throw new Error(etat.statut);
    const retire = await porteB.confirmerFaitPorteB(etat.videoId, etat.aConfirmer[0].id, "retirer");
    if (retire.statut !== "pret") throw new Error(retire.statut);
    expect(retire.aConfirmer).toEqual([]);
    expect(retire.cas.faits.map((f) => f.id)).not.toContain(etat.aConfirmer[0].id);
    expect(retire.empreinte).not.toBe(etat.empreinte);
    // L'ancienne empreinte, vue à l'écran avant le retrait, est refusée.
    expect((await service.estimerCas(etat.cas.id, RESEAUX, false, { porteB: etat.videoId, empreinteVue: etat.empreinte })).refus).toBe(PHRASES_AVANT_PRIX.casChange);
  });

  it("un brouillon disparu : « Ce cas n'existe plus. »", async () => {
    await expect(service.estimerCas("description-0", RESEAUX, false, { porteB: "v-absente" })).rejects.toThrow(PHRASES_AVANT_PRIX.casAbsent);
    expect(await service.preparerEtLancer({ casId: "description-0", reseaux: RESEAUX, mot: "AUTO", avecMot: false, accordCentimes: 10_000, porteB: "v-absente" }, { lancer })).toEqual({ statut: "refusee", phrase: PHRASES_AVANT_PRIX.casAbsent });
  });
});

describe("porte B : nouvel essai après un échec (relecture Opus de #445)", () => {
  it("le même texte après un appel en échec relance un appel neuf : l'ancienne réponse n'est jamais relue, l'appel payé n'est jamais ignoré", async () => {
    const d = doubles();
    d.executer.mockImplementationOnce(async () => ({ ok: false as const, arret: "panne", message: "Claude ne répond pas." }) as never);
    let etat = await porteB.demarrerPorteB(CABINET, d.dep);
    await d.repondre();
    if (etat.statut !== "en-cours") throw new Error(etat.statut);
    etat = await porteB.suivrePorteB(etat.videoId, d.dep);
    expect(etat).toMatchObject({ statut: "echec", phrase: porteB.PHRASE_ECHEC_PORTE_B });

    // « Réessayer » : un appel neuf part ; tant qu'il n'a pas répondu, l'écran attend (jamais l'ancien échec).
    const reprise = await porteB.demarrerPorteB(CABINET, d.dep);
    expect(reprise.statut).toBe("en-cours");
    expect(d.enAttente.size).toBe(1);
    if (reprise.statut !== "en-cours") throw new Error(reprise.statut);
    expect((await porteB.suivrePorteB(reprise.videoId, d.dep)).statut).toBe("en-cours");
    await d.repondre();
    expect((await porteB.suivrePorteB(reprise.videoId, d.dep)).statut).toBe("pret");
    expect(d.executer).toHaveBeenCalledTimes(2);
    expect(await videosCas()).toHaveLength(1);
  });
});

describe("porte B : nouvel essai après deux refus (relecture Opus de #445)", () => {
  it("le même texte refusé deux fois : les réponses arrivées sont relues, aucun appel n'est repayé", async () => {
    const d = doubles();
    d.executer.mockImplementation(async () => ({ ok: true as const, simule: true, donnees: { offre: "audit" } }) as never);
    let etat = await porteB.demarrerPorteB(CABINET, d.dep);
    for (let i = 0; i < 6 && etat.statut === "en-cours"; i++) {
      await d.repondre();
      etat = await porteB.suivrePorteB(etat.videoId, d.dep);
    }
    expect(etat.statut).toBe("echec");
    expect(d.executer).toHaveBeenCalledTimes(2);
    const reprise = await porteB.demarrerPorteB(CABINET, d.dep);
    expect(reprise.statut).toBe("echec");
    expect(d.enAttente.size).toBe(0);
    expect(d.executer).toHaveBeenCalledTimes(2);
  });
});
