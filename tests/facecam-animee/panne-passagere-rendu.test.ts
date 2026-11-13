/**
 * GV2-04 · une panne passagère n'est plus un échec : le service de montage muet attend (60 tours au plus, ≈ 5 min), le conteneur de
 * transcription injoignable attend 30 min au plus (la file normale n'est jamais comptée), une lecture ratée des mots est réessayable,
 * une exception inconnue réessayable est relevée vers la boucle, le message d'échec nomme l'étape. Doubles seulement : aucun réseau.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import type { CommandeFabrication, MotHorodate, Travail } from "@/domaine/types";
import { ErreurRendu } from "@/fournisseurs/rendu/client";
import { creerMoteurMontageFacecamAnimee } from "@/moteurs/montage-facecam-animee";
import { avancerChaineV4, EnCoursChaineV4, ErreurChaineV4, etatInitialV4, type EtatChaineV4, type OutilsChaineV4 } from "@/moteurs/montage-facecam-animee/chaine-v4";
import type { MotTranscrit } from "@/moteurs/montage-facecam-animee/realisateur";
import { outilsFacecamAnimee } from "@/services/facecam-animee";

const RACINE = join(__dirname, "..", "..");
const REPETITION = join(RACINE, "docs/facecam-animee-v4/repetition-generale");
const TRANS = JSON.parse(readFileSync(join(REPETITION, "transcription.json"), "utf8")) as { dureeMonteeSec: number; gardes: { debutSec: number; finSec: number }[]; motsMontesTexteValide: MotTranscrit[] };
const PLAN_VALIDE = JSON.parse(readFileSync(join(REPETITION, "plan-realisateur.json"), "utf8")) as PlanFacecamAnimee;
const BRUT = JSON.parse(readFileSync(join(RACINE, "tests/fixtures/img7747-v2-montage-reel.json"), "utf8")) as { mots: MotHorodate[] };

const COMMANDE = { videoId: "v-1", formatId: "facecam-animee", moteurId: "montage-facecam-animee", ratios: ["9:16"], entrees: { facecamAnimee: { priseCle: "k.mov", fichierId: "f-1", accordEssaiReel: true } }, briques: {}, distribution: [] } as unknown as CommandeFabrication;
const PLAN_SANS_VIDEO: PlanFacecamAnimee = { ...PLAN_VALIDE, elementsV4: (PLAN_VALIDE.elementsV4 ?? []).filter((e) => !["AvantApres", "MosaiqueVideos", "duel-video"].includes(e.id)) };
const etatRendu = (): EtatChaineV4 => ({
  ...etatInitialV4({ videoId: "v-1", versionId: "v", priseCle: "k.mov" }),
  etape: "rendu",
  coupes: { gardes: TRANS.gardes, dureeSec: TRANS.dureeMonteeSec, mots: TRANS.motsMontesTexteValide },
  realisation: { version: "complete", essais: 1, avertissements: 0, plan: PLAN_SANS_VIDEO },
});
const travailEnRendu = async (moteur: ReturnType<typeof creerMoteurMontageFacecamAnimee>): Promise<Travail> => {
  const t = await moteur.lancer(COMMANDE, { travailId: "t-1", versionId: "v", titre: "Essai" });
  return { ...t, parametres: { ...t.parametres, facecamAnimeeV4: etatRendu() } };
};
const etatDe = (t: Travail) => t.parametres?.facecamAnimeeV4 as EtatChaineV4;

describe("GV2-04 · service de montage muet : attente bornée", () => {
  const signer = { lecture: async (c: string) => `https://l.invalid/${c}`, depot: async (c: string) => `https://d.invalid/${c}` };
  const silence = () => new ErreurRendu({ code: "indisponible", message: "silence", reessayable: true });
  const termine = { statut: "termine" as const, sortieCle: "c.mp4", mesures: { dureeSec: 80, taille: 5 } };

  it("une interrogation qui lève puis « terminé » : jamais d'échec, vidéo prête (moteur + vrais outils du service)", async () => {
    const etat = vi.fn().mockRejectedValueOnce(silence()).mockResolvedValueOnce(termine);
    const outils = await outilsFacecamAnimee({ videoId: "v-1", travailId: "t-1", production: false, signer, rendu: { soumettre: vi.fn(), etat } });
    const moteur = creerMoteurMontageFacecamAnimee({ outils: async () => outils, statutFormat: "masque" });
    let t = await travailEnRendu(moteur);
    const r1 = await moteur.avancer(t, COMMANDE);
    expect(r1.travail.statut).toBe("en_cours");
    expect(etatDe(r1.travail).muets?.rendu).toBe(1);
    t = r1.travail;
    const r2 = await moteur.avancer(t, COMMANDE);
    expect(r2.travail.statut).toBe("termine");
    expect(r2.resultat).toBeDefined();
  });

  it("une réponse remet le compte à zéro (un tour muet, un tour « en cours », un tour muet : 1 et non 2)", async () => {
    const etat = vi.fn().mockRejectedValueOnce(silence()).mockResolvedValueOnce({ statut: "en_cours", progression: 10 }).mockRejectedValueOnce(silence());
    const outils = await outilsFacecamAnimee({ videoId: "v-1", travailId: "t-1", production: false, signer, rendu: { soumettre: vi.fn(), etat } });
    const moteur = creerMoteurMontageFacecamAnimee({ outils: async () => outils, statutFormat: "masque" });
    let t = await travailEnRendu(moteur);
    for (const attendu of [1, 0, 1]) {
      t = (await moteur.avancer(t, COMMANDE)).travail;
      expect(t.statut).toBe("en_cours");
      expect(etatDe(t).muets?.rendu ?? 0).toBe(attendu);
    }
  });

  it("60 tours muets de suite attendent ; le 61e : échec réessayable avec la phrase claire", async () => {
    const etat = vi.fn(async () => {
      throw silence();
    });
    const outils = await outilsFacecamAnimee({ videoId: "v-1", travailId: "t-1", production: false, signer, rendu: { soumettre: vi.fn(), etat } });
    const moteur = creerMoteurMontageFacecamAnimee({ outils: async () => outils, statutFormat: "masque" });
    let t = await travailEnRendu(moteur);
    for (let k = 1; k <= 60; k++) {
      t = (await moteur.avancer(t, COMMANDE)).travail;
      expect(t.statut).toBe("en_cours");
    }
    const dernier = await moteur.avancer(t, COMMANDE);
    expect(dernier.travail.statut).toBe("echec");
    expect(dernier.travail.erreur).toMatchObject({ reessayable: true, messagePourWill: "Le service de montage ne répond plus depuis 5 minutes." });
  });

  it("un vrai échec du rendu (service qui répond « echec ») n'est PAS une panne passagère : échec tout de suite", async () => {
    const etat = vi.fn(async () => ({ statut: "echec" as const, erreur: { code: "x", message: "m", reessayable: true } }) as never);
    const outils = await outilsFacecamAnimee({ videoId: "v-1", travailId: "t-1", production: false, signer, rendu: { soumettre: vi.fn(), etat } });
    const moteur = creerMoteurMontageFacecamAnimee({ outils: async () => outils, statutFormat: "masque" });
    const r = await moteur.avancer(await travailEnRendu(moteur), COMMANDE);
    expect(r.travail.statut).toBe("echec");
    expect(r.travail.erreur?.messagePourWill).toMatch(/Le montage de la vidéo n'a pas abouti/);
  });
});

describe("GV2-04 · conteneur de transcription injoignable : 30 min au plus", () => {
  const etat0 = etatInitialV4({ videoId: "v-1", versionId: "v", priseCle: "k.mov" });
  const MIN = 60_000;
  const T0 = Date.UTC(2026, 10, 13, 10, 0, 0);
  const injoignable = () => {
    throw new EnCoursChaineV4("La transcription", undefined, "injoignable");
  };

  it("29 min : en cours (début de la panne gardé dans l'état) ; 31 min : échec réessayable avec la phrase claire", async () => {
    const outils = { transcrire: vi.fn(async () => injoignable()) } as unknown as OutilsChaineV4;
    const premier = await avancerChaineV4(etat0, outils, 1, T0).catch((e) => e);
    expect(premier).toBeInstanceOf(EnCoursChaineV4);
    expect(premier.etat.injoignableDepuis.transcription).toBe(new Date(T0).toISOString());
    const a29 = await avancerChaineV4(premier.etat, outils, 1, T0 + 29 * MIN).catch((e) => e);
    expect(a29).toBeInstanceOf(EnCoursChaineV4);
    expect(a29.etat.injoignableDepuis.transcription).toBe(new Date(T0).toISOString());
    const a31 = await avancerChaineV4(premier.etat, outils, 1, T0 + 31 * MIN).catch((e) => e);
    expect(a31).toBeInstanceOf(ErreurChaineV4);
    expect(a31).toMatchObject({ reessayable: true, message: "L'outil de transcription ne répond plus depuis 30 minutes." });
  });

  it("la file normale (« en_file », « en_cours ») n'est jamais comptée, et une réponse efface le début de la panne", async () => {
    const enFile = { transcrire: vi.fn(async () => { throw new EnCoursChaineV4("La transcription"); }) } as unknown as OutilsChaineV4;
    // Une heure de file normale : toujours en cours, aucun début de panne posé.
    const r = await avancerChaineV4(etat0, enFile, 1, T0 + 60 * MIN).catch((e) => e);
    expect(r).toBeInstanceOf(EnCoursChaineV4);
    expect(r.etat).toBeUndefined();
    // La panne avait commencé, puis le conteneur répond « en cours » : début effacé.
    const avecPanne: EtatChaineV4 = { ...etat0, injoignableDepuis: { transcription: new Date(T0).toISOString() } };
    const r2 = await avancerChaineV4(avecPanne, enFile, 1, T0 + 10 * MIN).catch((e) => e);
    expect(r2.etat.injoignableDepuis).toBeUndefined();
    // Réussite : plus de trace de la panne dans l'état suivant.
    const ok = { transcrire: vi.fn(async () => ({ mots: BRUT.mots, dureeSec: 130.732 })) } as unknown as OutilsChaineV4;
    const suite = await avancerChaineV4(avecPanne, ok, 1, T0 + 10 * MIN);
    expect(suite.etape).toBe("coupes");
    expect(suite.injoignableDepuis).toBeUndefined();
  });

  it("moteur : l'état de la panne est enregistré dans le travail (sans lui, l'horloge repartirait de zéro à chaque tour)", async () => {
    const outils = { transcrire: vi.fn(async () => injoignable()) } as unknown as OutilsChaineV4;
    const moteur = creerMoteurMontageFacecamAnimee({ outils: async () => outils, statutFormat: "masque" });
    const t0 = await moteur.lancer(COMMANDE, { travailId: "t-1", versionId: "v", titre: "Essai" });
    const r1 = await moteur.avancer(t0, COMMANDE, T0);
    expect(r1.travail.statut).toBe("en_cours");
    expect(etatDe(r1.travail).injoignableDepuis?.transcription).toBe(new Date(T0).toISOString());
    expect((await moteur.avancer(r1.travail, COMMANDE, T0 + 29 * MIN)).travail.statut).toBe("en_cours");
    const r3 = await moteur.avancer(r1.travail, COMMANDE, T0 + 31 * MIN);
    expect(r3.travail.statut).toBe("echec");
    expect(r3.travail.erreur?.messagePourWill).toBe("L'outil de transcription ne répond plus depuis 30 minutes.");
  });
});

describe("GV2-04 · service : transcription injoignable et lecture ratée", () => {
  const signer = { lecture: async (c: string) => `https://l.invalid/${c}`, depot: async (c: string) => `https://d.invalid/${c}` };
  it("« injoignable » du conteneur est reconnu comme tel (pas la file normale) ; la lecture ratée des mots est réessayable, pas « aucun mot »", async () => {
    vi.resetModules();
    const etats: unknown[] = [
      { statut: "echec", erreur: { code: "x", message: "m", reessayable: true, injoignable: true } },
      { statut: "en_cours" },
      { statut: "termine", resultat: { transcriptionCle: "cle-illisible.json.gz", dureeSec: 20 } },
    ];
    vi.doMock("@/fournisseurs/facecam", () => ({ fournisseurFacecam: () => ({ suivre: async () => etats.shift(), soumettre: vi.fn() }) }));
    vi.doMock("@/services/monteur-facecam", async (importOriginal) => ({ ...(await importOriginal<object>()), lireJsonGz: async () => { throw new Error("lecture ratée"); } }));
    const { outilsFacecamAnimee: fabrique } = await import("@/services/facecam-animee");
    const { EnCoursChaineV4: EnCours, ErreurChaineV4: Erreur } = await import("@/moteurs/montage-facecam-animee/chaine-v4");
    const o = await fabrique({ videoId: "v-1", travailId: "t-1", production: false, signer, rendu: { soumettre: vi.fn(), etat: vi.fn() } });
    const injoignable = await o.transcrire({ priseCle: "k", appelId: "a" }).catch((e) => e);
    expect(injoignable).toBeInstanceOf(EnCours);
    expect(injoignable.nature).toBe("injoignable");
    const file = await o.transcrire({ priseCle: "k", appelId: "a" }).catch((e) => e);
    expect(file).toBeInstanceOf(EnCours);
    expect(file.nature).toBeUndefined();
    const lecture = await o.transcrire({ priseCle: "k", appelId: "a" }).catch((e) => e);
    expect(lecture).toBeInstanceOf(Erreur);
    expect(lecture).toMatchObject({ reessayable: true, message: "La transcription n'a pas pu être relue." });
    vi.doUnmock("@/fournisseurs/facecam");
    vi.doUnmock("@/services/monteur-facecam");
  });
});

describe("GV2-04 · exception inconnue et message d'échec", () => {
  it("exception inconnue réessayable : `avancer` la relève (la boucle fait ses essais espacés)", async () => {
    const boum = Object.assign(new Error("5xx"), { reessayable: true });
    const outils = { transcrire: vi.fn(async () => { throw boum; }) } as unknown as OutilsChaineV4;
    const moteur = creerMoteurMontageFacecamAnimee({ outils: async () => outils, statutFormat: "masque" });
    const t0 = await moteur.lancer(COMMANDE, { travailId: "t-1", versionId: "v", titre: "Essai" });
    await expect(moteur.avancer(t0, COMMANDE)).rejects.toBe(boum);
  });

  it("exception inconnue NON réessayable : échec immédiat, avec le nom de l'étape (« Le montage »)", async () => {
    const outils = { rendre: vi.fn(async () => { throw new Error("boum"); }) } as unknown as OutilsChaineV4;
    const moteur = creerMoteurMontageFacecamAnimee({ outils: async () => outils, statutFormat: "masque" });
    const r = await moteur.avancer(await travailEnRendu(moteur), COMMANDE);
    expect(r.travail.statut).toBe("echec");
    expect(r.travail.erreur).toMatchObject({ reessayable: true, messagePourWill: "L'étape « Le montage » n'a pas abouti. Vous pouvez réessayer." });
  });

  it("avant la chaîne (étape « Vos mots »), le nom change avec l'étape", async () => {
    const outils = { transcrire: vi.fn(async () => { throw new Error("boum"); }) } as unknown as OutilsChaineV4;
    const moteur = creerMoteurMontageFacecamAnimee({ outils: async () => outils, statutFormat: "masque" });
    const r = await moteur.avancer(await moteur.lancer(COMMANDE, { travailId: "t-1", versionId: "v", titre: "Essai" }), COMMANDE);
    expect(r.travail.erreur?.messagePourWill).toBe("L'étape « Vos mots » n'a pas abouti. Vous pouvez réessayer.");
  });
});
