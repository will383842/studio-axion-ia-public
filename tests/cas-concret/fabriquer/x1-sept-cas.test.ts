/**
 * X1 · Les sept cas du catalogue, fabriqués en simulation de bout en bout (raccords simulés, rendu simulé, aucun appel
 * réseau) pour chaque réseau seul et les quatre ensemble, avec et sans le mot, avec la voix désignée par l'interface :
 *  - aucune fabrication ne s'arrête (en particulier sur la durée d'un écran, R05) ;
 *  - la sortie la plus courte dure au moins 35 s, la plus longue au plus 65 s (R21 ; V4-2 : la voix simulée lit plus vite
 *    que la visée de 40 à 47 s, estimée sur la voix réelle) ;
 *  - avec une voix rapide (4,4 mots par seconde, l'ancien débit de la voix d'essai), aucun écran trop court ne bloque.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots } = await import("@/donnees/memoire");
const { creerServiceRenduSimule } = await import("@/fournisseurs/simulation/rendu");
const { fournisseurVoixSimulation } = await import("@/fournisseurs/simulation/autres");
const { creerMoteurMontageCasConcret } = await import("@/moteurs/montage-cas-concret");
const b = await import("@/services/cas-concret-branchements");
const { CATALOGUE } = await import("@/formats/cas-concret/catalogue");

import type { CommandeFabrication, Travail } from "@/domaine/types";

/** V4-3 : ces essais exercent l'écriture de Claude comme avant (aucun script validé, aucun arrêt « à valider ») ; les deux ont leurs tests (`tests/cas-concret/script-valide/`). */
const SANS_SCRIPT_V4_3 = { scriptValide: async () => null, validationScript: false, numeroVersion: async () => 42 };

const TOUS = ["facebook", "instagram", "tiktok", "linkedin"];
const CHOIX_RESEAUX = [...TOUS.map((r) => [r]), TOUS];

function commande(casId: string, mot: string, avecMot: boolean, reseaux: string[]): CommandeFabrication {
  return {
    versionContrat: 2,
    moteurId: "montage-cas-concret",
    videoId: "v-03",
    formatId: "cas-concret",
    versionFormat: 1,
    profilRenduVersion: 1,
    dureeCibleSec: 50,
    ratios: ["9:16"],
    script: { blocs: [], texteComplet: "" },
    // La voix « Ma voix » (vitesse 1,05), celle que les essais d'interface désignent pour le format de l'avocat.
    distribution: [{ role: "voix", source: "double", personnageId: "p-will", fournisseurVoix: "simulation", voixId: "voix-will" }],
    styles: { sousTitres: null, decor: null, lut: null, musique: null },
    briques: { "sous-titres": true, etalonnage: false, illustrations: true, son: true, habillage: false, "texte-ecran": false, "mention-ia": false },
    entrees: { casConcret: { casId, porte: "A", mot, avecMot, reseaux, essai: false, codeSuivi: `cc-${casId}-abc123` } },
    reglages: {},
    plans: [],
    prononciations: [],
    mentionIA: { incrustee: false, position: "haut-droite", dureeSec: 0, texte: "", dansLegende: false },
    budgetMax: { centimes: 0, devise: "EUR" },
    construiteLe: "2026-10-12T09:00:00.000Z",
  } as unknown as CommandeFabrication;
}

interface Issue {
  libelle: string;
  statut: string;
  erreur?: string;
  durees: number[];
}

async function fabriquer(casId: string, mot: string, avecMot: boolean, reseaux: string[]): Promise<Issue> {
  reinitialiserDepots();
  let t = 0;
  const dep = { rendu: { service: creerServiceRenduSimule(() => (t += 60_000)), simule: true }, attendre: async () => {} };
  const moteur = creerMoteurMontageCasConcret({ outils: (c, travailId) => b.outilsCasConcret(c, travailId, { ...SANS_SCRIPT_V4_3, ...dep }) });
  const c = commande(casId, mot, avecMot, reseaux);
  let travail: Travail = await moteur.lancer(c, { travailId: "tr-x1", versionId: "ver-x1", titre: "Essai" } as never);
  let resultat: { projetMontage: { casConcret: { fins: { dureeSec: number }[] } } } | undefined;
  for (let i = 0; i < 400 && travail.statut !== "termine" && travail.statut !== "echec"; i++) {
    const r = await moteur.avancer(travail, c);
    travail = r.travail;
    if (r.resultat) resultat = r.resultat as unknown as typeof resultat;
  }
  return {
    libelle: `${casId} · ${reseaux.join("+")} · ${avecMot ? "avec" : "sans"} le mot`,
    statut: travail.statut,
    ...(travail.erreur?.messagePourWill ? { erreur: travail.erreur.messagePourWill.slice(0, 240) } : {}),
    durees: resultat?.projetMontage.casConcret.fins.map((f) => f.dureeSec) ?? [],
  };
}

async function toutFabriquer(): Promise<Issue[]> {
  const issues: Issue[] = [];
  for (const cas of CATALOGUE) for (const avecMot of [true, false]) for (const reseaux of CHOIX_RESEAUX) issues.push(await fabriquer(cas.id, cas.mot, avecMot, reseaux));
  return issues;
}

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    throw new Error("Aucun appel réseau dans ces tests.");
  });
});
afterEach(() => vi.restoreAllMocks());

describe("X1 · sept cas × réseaux × avec et sans le mot, en simulation", () => {
  it("aucune fabrication ne s'arrête ; la sortie la plus courte fait au moins 35 s, la plus longue au plus 65 s", async () => {
    const issues = await toutFabriquer();
    expect(issues).toHaveLength(CATALOGUE.length * 2 * CHOIX_RESEAUX.length);
    expect(issues.filter((x) => x.statut !== "termine")).toEqual([]);
    // V4-2 : la visée de l'écriture passe à 40–47 s, estimée sur la voix réelle (20,5 caractères par seconde) ; la
    // voix SIMULÉE lit environ 16 % plus vite (sorties vers 36 à 41 s) : le plancher contrôlé ici est la borne de refus
    // de R21 (35 s), et non plus la visée.
    expect(issues.filter((x) => !x.durees.length || Math.min(...x.durees) < 35 || Math.max(...x.durees) > 65).map((x) => `${x.libelle} : ${x.durees.join(", ")} s`)).toEqual([]);
  }, 300_000);

  it("voix rapide (4,4 mots par seconde) : aucun écran trop court n'arrête la fabrication", async () => {
    const lire = fournisseurVoixSimulation.lire.bind(fournisseurVoixSimulation);
    vi.spyOn(fournisseurVoixSimulation, "lire").mockImplementation(async (d) => lire({ ...d, motsParSeconde: 4.4 }));
    const issues = await toutFabriquer();
    expect(issues.filter((x) => x.statut !== "termine")).toEqual([]);
  }, 300_000);
});
