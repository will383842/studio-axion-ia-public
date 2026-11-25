/**
 * AUD-1 · le dépôt du tutoriel crée un brouillon LANÇABLE : script rattaché et distribution par défaut (le double).
 * Dépôts en mémoire, la vraie garde de fabrication (`construireCommande`), aucun appel réel, 0 €.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

import { lireEntreesTutoriel } from "@/moteurs/montage-tutoriel-outil/entrees";

const { reinitialiserDepots } = await import("@/donnees/memoire");
const { depots } = await import("@/services/_commun");
const auth = await import("@/services/auth");
const { construireCommande } = await import("@/services/fabrication");
const d = await import("@/services/tutoriel-depot");

const MDP = "essai-depot-lancable-aud-1";
const phrase = { mode: "phrase" as const, phrase: "Un tableau de bord pour un atelier" };

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

/** Lancement simulé : ne lance rien, mais passe par la vraie garde de fabrication (script, distribution). */
function banc() {
  const compte = { gardes: 0, abandons: [] as string[] };
  const dep: import("@/services/tutoriel-depot").DependancesDepotTutoriel = {
    interrupteurs: async () => ({ formulaire: true, dossier: true, phrase: true }),
    equipe: async () => true,
    lancer: async (id) => {
      compte.gardes++;
      await construireCommande(id);
      return { statut: "lancee", travailId: "t-simule" };
    },
    abandonner: async (id) => void compte.abandons.push(id),
  };
  return { compte, dep };
}

describe("dépôt du tutoriel : brouillon lançable", () => {
  it("dépôt → brouillon avec script rattaché et distribution du double → la garde de fabrication passe", async () => {
    const { compte, dep } = banc();
    const r = await d.deposerTutoriel(phrase, dep);
    expect(r.statut).toBe("lancee");
    expect(compte.gardes).toBe(1);
    if (r.statut !== "lancee") return;
    const v = await depots().videos.obtenir(r.videoId);
    expect(v?.scriptId).toBeTruthy();
    expect(v?.distribution).toHaveLength(1);
    expect(v?.distribution[0]?.personnageId).toBeTruthy();
    expect(compte.abandons).toEqual([]);
    const commande = await construireCommande(r.videoId);
    expect(commande.distribution.length).toBeGreaterThanOrEqual(1);
  });

  it("sans voix avec la distribution par défaut : la VRAIE garde de fabrication passe, la commande est sansVoix", async () => {
    const { compte, dep } = banc();
    let sansVoix = false;
    const r = await d.deposerTutoriel({ ...phrase, modeVoix: "sans-voix" }, {
      ...dep,
      lancer: async (id) => {
        compte.gardes++;
        const commande = await construireCommande(id);
        sansVoix = lireEntreesTutoriel(commande.entrees).sansVoix === true;
        return { statut: "lancee", travailId: "t-simule" };
      },
    });
    expect(r.statut).toBe("lancee");
    expect(compte.gardes).toBe(1);
    expect(sansVoix).toBe(true);
  });

  it("aucune personne disponible : refus lisible, aucun brouillon créé, rien n'est lancé", async () => {
    const { compte, dep } = banc();
    for (const p of await depots().personnages.lister()) await depots().personnages.supprimer(p.id);
    const avant = (await depots().videos.lister()).length;
    const r = await d.deposerTutoriel(phrase, dep);
    expect(r).toEqual({ statut: "refusee", phrase: d.PHRASE_PERSONNE_ABSENTE });
    expect(compte.gardes).toBe(0);
    expect((await depots().videos.lister()).length).toBe(avant);
  });

  it("la distribution par défaut qui lève : refus lisible", async () => {
    const { dep } = banc();
    const r = await d.deposerTutoriel(phrase, { ...dep, distribution: async () => { throw new Error("panne"); } });
    expect(r).toEqual({ statut: "refusee", phrase: d.PHRASE_PERSONNE_ABSENTE });
  });
});
