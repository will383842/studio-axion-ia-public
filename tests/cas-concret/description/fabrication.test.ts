/**
 * Porte B (P2R) : les cas rendus par la simulation de la porte B, pour chacune des quatre offres (une automatisation et
 * des outils reliés pour l'intégration), passent ce que passe le catalogue durci : fabriqués en simulation de bout en
 * bout (écriture simulée, 22 règles, rendu simulé, aucun appel réseau) pour les quatre réseaux ensemble (une sortie par
 * fin, comme X7), avec et sans le mot branché, chaque sortie dure de 35 à 65 s (bornes de master). Et le contrôle avant le prix rejoue la garde.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
// Les cas de la porte B rejoignent le catalogue pour la seule simulation (rangés après les imports : la fabrique du
// double ne peut pas importer la porte B, qui importe elle-même le catalogue).
const ajoutes = vi.hoisted(() => new Map<string, unknown>());
vi.mock("@/formats/cas-concret/catalogue", async (importOriginal) => {
  const vrai = await importOriginal<typeof import("@/formats/cas-concret/catalogue")>();
  return { ...vrai, trouverCas: (id: string) => ajoutes.get(id) ?? vrai.trouverCas(id) };
});

const { reinitialiserDepots } = await import("@/donnees/memoire");
const { creerServiceRenduSimule } = await import("@/fournisseurs/simulation/rendu");
const { creerMoteurMontageCasConcret } = await import("@/moteurs/montage-cas-concret");
const b = await import("@/services/cas-concret-branchements");
const { casPorteB, DESCRIPTIONS } = await import("./cas-porte-b");
const { brouillonParGabarit, casDuBrouillon } = await import("@/moteurs/montage-cas-concret/description");
const { verifierCas } = await import("@/formats/cas-concret/cas");
const { PHRASES_AVANT_PRIX, refusAvantPrix } = await import("@/moteurs/montage-cas-concret/avant-prix");
const { MESSAGE_DESCRIPTION_COURTE, faitsAConfirmer } = await import("@/moteurs/montage-cas-concret/honnetete");
for (const c of casPorteB()) ajoutes.set(c.id, c);

import type { CommandeFabrication, Travail } from "@/domaine/types";

// Sur master (V4-3, L2-07) : pas de script validé pour ces cas, et le numéro de version pose le lien de suivi.
const SANS_SCRIPT_V4_3 = { scriptValide: async () => null, validationScript: false, numeroVersion: async () => 42 };

const TOUS = ["facebook", "instagram", "tiktok", "linkedin"];

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
    distribution: [{ role: "voix", source: "double", personnageId: "p-will", fournisseurVoix: "simulation", voixId: "voix-will" }],
    styles: { sousTitres: null, decor: null, lut: null, musique: null },
    briques: { "sous-titres": true, etalonnage: false, illustrations: true, son: true, habillage: false, "texte-ecran": false, "mention-ia": false },
    entrees: { casConcret: { casId, porte: "B", mot, avecMot, motSur: avecMot ? ["instagram", "facebook"].filter((r) => reseaux.includes(r)) : [], reseaux, essai: true, codeSuivi: `cc-${casId}-abc123` } },
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
  const dep = { rendu: { service: creerServiceRenduSimule(() => (t += 60_000)), simule: true }, attendre: async () => {}, ...SANS_SCRIPT_V4_3 };
  const moteur = creerMoteurMontageCasConcret({ outils: (c, travailId) => b.outilsCasConcret(c, travailId, dep) });
  const c = commande(casId, mot, avecMot, reseaux);
  let travail: Travail = await moteur.lancer(c, { travailId: "tr-b", versionId: "ver-b", titre: "Essai" } as never);
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

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    throw new Error("Aucun appel réseau dans ces tests.");
  });
});
afterEach(() => vi.restoreAllMocks());

describe("Porte B (P2R) : chaque cas simulé est fabriqué comme un cas du catalogue", () => {
  it("cinq cas, les quatre offres", () => {
    expect(new Set(casPorteB().map((c) => c.offre))).toEqual(new Set(["formation", "audit", "integration", "coaching"]));
    expect(new Set(casPorteB().map((c) => c.nature).filter(Boolean))).toEqual(new Set(["automatisation", "outils-relies"]));
  });

  it("aucune fabrication ne s'arrête ; chaque sortie dure de 35 à 65 s (bornes de master) ; les quatre réseaux, avec et sans le mot", async () => {
    const issues: Issue[] = [];
    for (const cas of casPorteB()) for (const avecMot of [false, true]) issues.push(await fabriquer(cas.id, cas.mot, avecMot, TOUS));
    expect(issues.filter((x) => x.statut !== "termine").map((x) => `${x.libelle} : ${x.erreur ?? x.statut}`)).toEqual([]);
    expect(issues.filter((x) => !x.durees.length || Math.min(...x.durees) < 35 || Math.max(...x.durees) > 65).map((x) => `${x.libelle} : ${x.durees.join(", ")} s`)).toEqual([]);
  }, 300_000);
});

describe("Porte B (P2S) : le cas gardé avec la vidéo, hors catalogue", () => {
  it("un cas que le catalogue ne connaît pas, porté par les entrées avec sa description, se fabrique de bout en bout", async () => {
    const texte = "Une boutique qui prépare chaque soir le point des ventes à la main, dans un tableau, pour 3 magasins.";
    const v = verifierCas(casDuBrouillon(brouillonParGabarit(texte), texte));
    if (!v.ok) throw new Error(v.raisons.join(" ; "));
    expect(ajoutes.has(v.cas.id)).toBe(false);
    reinitialiserDepots();
    let t = 0;
    const dep = { rendu: { service: creerServiceRenduSimule(() => (t += 60_000)), simule: true }, attendre: async () => {}, ...SANS_SCRIPT_V4_3 };
    const moteur = creerMoteurMontageCasConcret({ outils: (c, travailId) => b.outilsCasConcret(c, travailId, dep) });
    const c = commande(v.cas.id, v.cas.mot, false, TOUS);
    const e = (c.entrees as { casConcret: Record<string, unknown> }).casConcret;
    Object.assign(e, { porte: "porte-b", cas: v.cas, description: texte, faitsConfirmes: faitsAConfirmer(v.cas, texte).map((f) => f.id) });
    expect(moteur.refusAuLancement?.(c)).toBeNull();
    let travail: Travail = await moteur.lancer(c, { travailId: "tr-b2", versionId: "ver-b2", titre: "Essai" } as never);
    for (let i = 0; i < 400 && travail.statut !== "termine" && travail.statut !== "echec"; i++) travail = (await moteur.avancer(travail, c)).travail;
    expect(travail.erreur?.messagePourWill ?? travail.statut).toBe("termine");
  }, 120_000);
});

describe("Porte B (P2R) : refus avant le prix", () => {
  const demande = (i: number, description?: string) => ({ cas: casPorteB()[i], reseaux: TOUS as never, mot: casPorteB()[i].mot, avecMot: false, motSur: [], essai: true, ...(description !== undefined ? { description } : {}) });

  it("chaque cas de la porte B, avec sa description et ses faits confirmés, passe", () => {
    casPorteB().forEach((c, i) => expect(refusAvantPrix({ ...demande(i, DESCRIPTIONS[i]), faitsConfirmes: faitsAConfirmer(c, DESCRIPTIONS[i]).map((f) => f.id) })).toBeNull());
  });

  it("P2S : un fait réécrit (« dix » devenu « 10 ») est à confirmer et bloque tant que Will ne l'a pas confirmé", () => {
    const i = DESCRIPTIONS.findIndex((d) => / dix /.test(d));
    const aConfirmer = faitsAConfirmer(casPorteB()[i], DESCRIPTIONS[i]);
    expect(aConfirmer.map((f) => f.enonce)).toEqual([expect.stringContaining("10 personnes")]);
    expect(refusAvantPrix(demande(i, DESCRIPTIONS[i]))).toBe(PHRASES_AVANT_PRIX.aConfirmer);
    expect(refusAvantPrix({ ...demande(i, DESCRIPTIONS[i]), faitsConfirmes: aConfirmer.map((f) => f.id) })).toBeNull();
  });

  it("un nombre absent de la description est refusé avant le prix", () => {
    const d = demande(0, DESCRIPTIONS[0]);
    expect(refusAvantPrix({ ...d, cas: { ...d.cas, resultat: "Vous gagnez 3 heures par semaine." } })).toBe(PHRASES_AVANT_PRIX.honnetete);
  });

  it("une description trop courte est refusée avant le prix, avec la phrase de la porte B", () => {
    expect(refusAvantPrix(demande(0, "Un cabinet qui saisit ses factures seul."))).toBe(MESSAGE_DESCRIPTION_COURTE);
  });

  it("sans description (porte A) : la garde n'est pas rejouée", () => {
    const d = demande(0);
    expect(refusAvantPrix({ ...d, cas: { ...d.cas, resultat: "Vous gagnez 3 heures par semaine." } })).toBeNull();
  });
});
