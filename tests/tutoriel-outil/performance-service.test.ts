/**
 * T-EXT-48a · lecture seule des tutoriels mesurés. Dépôts en mémoire, lecteur double, aucun appel réseau, 0 €.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { collecterTutorielsMesures, lirePerformanceTutoriel, traitsDuProjet } = await import("@/services/tutoriel-performance");

const LE = "2026-11-10T08:00:00.000Z";
const projet = (gabarit: string, devient = "plus-sereine") => ({ tutoriel: { cahier: { gabarits: [gabarit], cas: 1 }, ficheValeur: { gainEntreprise: { devient } } } });
const fetchRefuse = vi.fn(() => { throw new Error("fetch interdit dans ce test"); });

async function tutoriel(i: number, o: { pub?: Record<string, unknown>; video?: Record<string, unknown>; projetMontage?: Record<string, unknown> | null } = {}) {
  await depots().videos.enregistrer({ id: `exemple-v${i}`, titre: `Espace démo · métier ${i}`, formatId: "tutoriel-outil", statut: "prete", dureeCibleSec: 45, creeLe: LE, modifieLe: LE, ...o.video } as never);
  if (o.projetMontage !== null) await depots().versions.enregistrer({ id: `ver${i}`, videoId: `exemple-v${i}`, numero: 1, statut: "prete", choisie: true, projetMontage: o.projetMontage ?? projet("G-Decision"), creeLe: LE, modifieLe: LE } as never);
  await depots().publications.enregistrer({ id: `pub${i}`, videoId: `exemple-v${i}`, reseau: "instagram", statut: "publiee", via: "zernio", date: LE, texte: "", idExterne: `ext${i}`, creeLe: LE, modifieLe: LE, ...o.pub } as never);
}

beforeEach(() => { reinitialiserDepots(); vi.stubGlobal("fetch", fetchRefuse); });
afterEach(() => { vi.unstubAllGlobals(); fetchRefuse.mockClear(); });

describe("collecterTutorielsMesures", () => {
  it("lit les chiffres déjà importés et les traits du projet de la version", async () => {
    await tutoriel(1, { pub: { stats: { vues: 120, likes: 0, commentaires: 0, partages: 0, tauxAbandon3s: 35 } } });
    const r = await collecterTutorielsMesures({ depots });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ formatId: "tutoriel-outil", structure: "G-Decision", ouverture: "plus-sereine", pilier: "cas-1", reseau: "instagram" });
    expect(r[0].resultats).toMatchObject({ vues: 120, tauxAbandon3s: 35 });
  });

  it("ignore une publication simulée, non publiée, d'un autre format ou d'une vidéo archivée", async () => {
    await tutoriel(1, { pub: { via: "simulation", stats: { vues: 50 } } });
    await tutoriel(2, { pub: { statut: "programmee", stats: { vues: 50 } } });
    await tutoriel(3, { video: { formatId: "avocat-v4" }, pub: { stats: { vues: 50 } } });
    await tutoriel(4, { video: { statut: "archivee" }, pub: { stats: { vues: 50 } } });
    expect(await collecterTutorielsMesures({ depots })).toEqual([]);
  });

  it("ignore un exemple quand « Afficher les exemples » est éteint", async () => {
    await tutoriel(1, { pub: { estDemo: true, stats: { vues: 50 } } });
    await depots().parametres.enregistrer({ id: "afficherExemples", valeur: false, creeLe: LE, modifieLe: LE } as never);
    expect(await collecterTutorielsMesures({ depots })).toEqual([]);
  });

  it("stats absentes + lecteur qui rend vues: null → pas de chiffres, jamais 0", async () => {
    await tutoriel(1);
    const lireStats = vi.fn(async () => ({ vues: null, portee: null, partages: null, commentaires: null }));
    expect(await collecterTutorielsMesures({ depots, lireStats })).toEqual([]);
    expect(lireStats).toHaveBeenCalledWith("ext1");
  });

  it("stats absentes + lecteur qui rend des vues → vues lues ; les autres chiffres restent absents", async () => {
    await tutoriel(1);
    const r = await collecterTutorielsMesures({ depots, lireStats: async () => ({ vues: 77, portee: null, partages: null, commentaires: null }) });
    expect(r[0].resultats).toEqual({ vues: 77, tauxAbandon3s: undefined, dureeMoyenneVueSec: undefined, partagesParPortee: undefined, visites: undefined, rendezVous: undefined });
  });

  it("lecteur en échec → la vidéo reste sans chiffres, aucune exception", async () => {
    await tutoriel(1);
    await expect(collecterTutorielsMesures({ depots, lireStats: async () => { throw new Error("refus"); } })).resolves.toEqual([]);
  });

  it("les stats déjà importées ne déclenchent aucune lecture", async () => {
    await tutoriel(1, { pub: { stats: { vues: 10, likes: 0, commentaires: 0, partages: 0 } } });
    const lireStats = vi.fn(async () => null);
    await collecterTutorielsMesures({ depots, lireStats });
    expect(lireStats).not.toHaveBeenCalled();
  });

  it("rendez-vous : seulement avec un lien suivi qui a une ligne ; sinon absent", async () => {
    const stats = { vues: 10, likes: 0, commentaires: 0, partages: 0 };
    await tutoriel(1, { pub: { stats, lienSuivi: "https://exemple.invalid/?utm_campaign=0001-TO-IG" } });
    await tutoriel(2, { pub: { stats } });
    const r = await collecterTutorielsMesures({ depots, liensSuivis: [{ campagne: "0001-TO-IG", visites: 30, rendezVous: 2 }] });
    const un = r.find((v) => v.publicationId === "pub1")!;
    const deux = r.find((v) => v.publicationId === "pub2")!;
    expect(un.resultats).toMatchObject({ visites: 30, rendezVous: 2 });
    expect(deux.resultats.rendezVous).toBeUndefined();
  });

  it("projet absent ou sans cahier : la vidéo est comptée sans gabarit, jamais devinée", async () => {
    await tutoriel(1, { projetMontage: null, pub: { stats: { vues: 10, likes: 0, commentaires: 0, partages: 0 } } });
    const r = await collecterTutorielsMesures({ depots });
    expect(r).toHaveLength(1);
    expect(r[0].structure).toBeUndefined();
    expect(r[0].ouverture).toBeUndefined();
  });

  it("n'écrit rien dans les dépôts et n'appelle aucun réseau", async () => {
    await tutoriel(1, { pub: { stats: { vues: 10, likes: 0, commentaires: 0, partages: 0 } } });
    const avant = JSON.stringify(await depots().publications.lister(() => true));
    await collecterTutorielsMesures({ depots });
    expect(JSON.stringify(await depots().publications.lister(() => true))).toBe(avant);
    expect(fetchRefuse).not.toHaveBeenCalled();
  });
});

describe("lirePerformanceTutoriel", () => {
  it("3 G-Décision + 2 G-Flux : G-Flux trop tôt, G-Décision lisible", async () => {
    for (let i = 1; i <= 5; i++) {
      await tutoriel(i, { projetMontage: projet(i <= 3 ? "G-Decision" : "G-Flux"), pub: { date: `2026-11-${10 + i}T08:00:00.000Z`, stats: { vues: 100 * i, likes: 0, commentaires: 0, partages: 0 } } });
    }
    const l = await lirePerformanceTutoriel({ depots });
    expect(l.nombre).toBe(5);
    expect(l.parGabarit.find((g) => g.valeur === "G-Flux")?.tropTot).toBe(true);
    expect(l.parGabarit.find((g) => g.valeur === "G-Decision")?.tropTot).toBe(false);
  });
});

describe("traitsDuProjet", () => {
  it("rejette un gabarit ou un cas hors liste, sans rien deviner", () => {
    expect(traitsDuProjet(undefined)).toEqual({});
    expect(traitsDuProjet({ tutoriel: { cahier: { gabarits: ["G-Inconnu"], cas: 9 } } })).toEqual({});
    expect(traitsDuProjet(projet("G-Reponse", "plus-solide"))).toEqual({ gabarit: "G-Reponse", cas: 1, devient: "plus-solide" });
  });
});
