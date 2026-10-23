/**
 * Coaching · le cadeau « Déroulé de l'accompagnement » (décision de Will, option A) : le cas coaching d'essai est fabriqué
 * en simulation, les quatre réseaux ensemble, le mot branché sur Instagram et Facebook (aucun appel réseau, aucune dépense).
 *  - la fabrication se termine ; les sorties durent de 35 à 65 s ;
 *  - Instagram a son propre fichier, avec la fin au mot et l'abonnement (`fin-ig-mot-abonnement`) ;
 *  - TikTok et LinkedIn gardent la fin « diagnostic » ;
 *  - aucune fin ne contient « gain garanti », « Villeexemple » ni « societeexemple ».
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../../helpers/next-mocks";
import { casCoaching } from "../x5/cas-coaching";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
// Le cas « coaching » d'essai rejoint le catalogue pour la seule simulation.
vi.mock("@/formats/cas-concret/catalogue", async (importOriginal) => {
  const vrai = await importOriginal<typeof import("@/formats/cas-concret/catalogue")>();
  const { casCoaching: coaching } = await import("../x5/cas-coaching");
  return { ...vrai, trouverCas: (id: string) => (id === coaching.id ? coaching : vrai.trouverCas(id)) };
});

const { reinitialiserDepots } = await import("@/donnees/memoire");
const { creerServiceRenduSimule } = await import("@/fournisseurs/simulation/rendu");
const { creerMoteurMontageCasConcret } = await import("@/moteurs/montage-cas-concret");
const b = await import("@/services/cas-concret-branchements");
const { finsParReseau } = await import("@/formats/cas-concret");
const { TABLE_FINS_DIAGNOSTIC } = await import("@/briques/fins");

import type { CommandeFabrication, Travail } from "@/domaine/types";

const SANS_SCRIPT_V4_3 = { scriptValide: async () => null, validationScript: false, numeroVersion: async () => 42 };
const TOUS = ["facebook", "instagram", "tiktok", "linkedin"];

function commande(): CommandeFabrication {
  const casId = casCoaching.id;
  return {
    versionContrat: 2,
    moteurId: "montage-cas-concret",
    videoId: "v-07",
    formatId: "cas-concret",
    versionFormat: 1,
    profilRenduVersion: 1,
    dureeCibleSec: 50,
    ratios: ["9:16"],
    script: { blocs: [], texteComplet: "" },
    distribution: [{ role: "voix", source: "double", personnageId: "p-will", fournisseurVoix: "simulation", voixId: "voix-will" }],
    styles: { sousTitres: null, decor: null, lut: null, musique: null },
    briques: { "sous-titres": true, etalonnage: false, illustrations: true, son: true, habillage: false, "texte-ecran": false, "mention-ia": false },
    entrees: { casConcret: { casId, porte: "A", mot: casCoaching.mot, avecMot: true, motSur: ["instagram", "facebook"], reseaux: TOUS, essai: false, codeSuivi: `cc-${casId}-abc123` } },
    reglages: {},
    plans: [],
    prononciations: [],
    mentionIA: { incrustee: false, position: "haut-droite", dureeSec: 0, texte: "", dansLegende: false },
    budgetMax: { centimes: 0, devise: "EUR" },
    construiteLe: "2026-10-12T09:00:00.000Z",
  } as unknown as CommandeFabrication;
}

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    throw new Error("Aucun appel réseau dans ces tests.");
  });
});
afterEach(() => vi.restoreAllMocks());

describe("Coaching · mot branché sur Instagram et Facebook", () => {
  it("se fabrique ; Instagram a son propre fichier ; sorties de 35 à 65 s", async () => {
    reinitialiserDepots();
    let t = 0;
    const dep = { rendu: { service: creerServiceRenduSimule(() => (t += 60_000)), simule: true }, attendre: async () => {} };
    const moteur = creerMoteurMontageCasConcret({ outils: (c, travailId) => b.outilsCasConcret(c, travailId, { ...SANS_SCRIPT_V4_3, ...dep }) });
    const c = commande();
    let travail: Travail = await moteur.lancer(c, { travailId: "tr-co", versionId: "ver-co", titre: "Essai" } as never);
    let resultat: { projetMontage: { casConcret: { fins: { dureeSec: number; reseaux: string[] }[] } } } | undefined;
    for (let i = 0; i < 400 && travail.statut !== "termine" && travail.statut !== "echec"; i++) {
      const r = await moteur.avancer(travail, c);
      travail = r.travail;
      if (r.resultat) resultat = r.resultat as unknown as typeof resultat;
    }
    expect({ statut: travail.statut, erreur: travail.erreur?.messagePourWill }).toEqual({ statut: "termine", erreur: undefined });
    const fins = resultat?.projetMontage.casConcret.fins ?? [];
    expect(fins.length).toBeGreaterThan(0);
    // Instagram a son propre fichier (la fin au mot avec l'abonnement) : il n'est groupé avec aucun autre réseau.
    expect(fins.some((f) => f.reseaux.length === 1 && f.reseaux[0] === "instagram")).toBe(true);
    const durees = fins.map((f) => f.dureeSec);
    expect(Math.min(...durees)).toBeGreaterThanOrEqual(35);
    expect(Math.max(...durees)).toBeLessThanOrEqual(65);
  }, 300_000);

  it("fins par réseau : Instagram au mot avec l'abonnement, TikTok et LinkedIn en « diagnostic », aucun mot interdit", () => {
    const f = finsParReseau(casCoaching.offre, ["instagram", "facebook"], casCoaching.nature);
    expect(f.instagram).toEqual(["fin-ig-mot-abonnement"]);
    expect(f.facebook).toEqual(["fin-if-mot", "fin-if-envoi-structure"]);
    expect(f.tiktok).toEqual(["fin-ty-diagnostic-gratuit", "fin-tt-lien-profil"]);
    expect(f.linkedin).toEqual(["fin-li-diagnostic-gratuit", "fin-li-lien-commentaire"]);
    const textes = Object.values(f).flat().map((id) => {
      const l = TABLE_FINS_DIAGNOSTIC.find((x) => x.id === id);
      expect(l, id).toBeDefined();
      return `${l!.dit} ${l!.ecran}`;
    });
    for (const txt of textes) expect(txt).not.toMatch(/gain garanti|villeexemple|societeexemple/i);
  });
});
