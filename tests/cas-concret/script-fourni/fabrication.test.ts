/**
 * Script FOURNI par Will : enregistré par le service, il est rejoué mot pour mot par la fabrication, SANS aucun appel d'écriture
 * (le double d'écriture n'est jamais appelé) ; le texte dit est celui que Will a collé. Base en mémoire, simulation, rien de payé.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { creerServiceRenduSimule } = await import("@/fournisseurs/simulation/rendu");
const { fournisseurVoixSimulation } = await import("@/fournisseurs/simulation/autres");
const { creerMoteurMontageCasConcret } = await import("@/moteurs/montage-cas-concret");
const auth = await import("@/services/auth");
const b = await import("@/services/cas-concret-branchements");
const scripts = await import("@/services/cas-concret-scripts");
// L0a : « Valider ce script » réécrit le script de la vidéo (services/videos) : module chargé ici, pas pendant un test.
await import("@/services/videos");
const { CODE_SCRIPT_A_VALIDER, PHRASE_SCRIPT_A_VALIDER, scriptValideDuCatalogue } = await import("@/moteurs/montage-cas-concret/script-valide");
const { texteDuCorps } = await import("@/moteurs/montage-cas-concret/fiche");
const { ecrireParametre } = await import("@/services/_commun");
const fourni = await import("@/services/cas-concret-script-fourni");
const { dureesDesFins, ficheParGabarit } = await import("@/moteurs/montage-cas-concret/ecriture");
const { bornesDesFins, texteFourniDesEcrans } = await import("@/moteurs/montage-cas-concret/script-fourni");
const { trouverCas } = await import("@/formats/cas-concret/catalogue");

import type { CommandeFabrication, Travail } from "@/domaine/types";
import type { DefinitionRole, EntreeRole } from "@/generateur/roles/types";
import type { DependancesBranchementsCasConcret } from "@/services/cas-concret-branchements";

const MDP = "cas-concret-script";
const VIDEO = "v-03";
const CAS = "rappels-rendez-vous";
const RESEAUX = ["facebook", "instagram", "tiktok", "linkedin"] as const;

function renduImmediat() {
  let t = 0;
  return { service: creerServiceRenduSimule(() => (t += 60_000)), simule: true };
}

function commande(casId = CAS): CommandeFabrication {
  const mot = trouverCas(casId)!.mot;
  return {
    versionContrat: 2,
    moteurId: "montage-cas-concret",
    videoId: VIDEO,
    formatId: "cas-concret",
    versionFormat: 1,
    profilRenduVersion: 1,
    dureeCibleSec: 50,
    ratios: ["9:16"],
    script: { blocs: [], texteComplet: "" },
    distribution: [{ role: "voix", source: "double", personnageId: "p-clara", fournisseurVoix: "simulation", voixId: "voix-clara" }],
    styles: { sousTitres: null, decor: null, lut: null, musique: null },
    briques: { "sous-titres": true, etalonnage: false, illustrations: true, son: true, habillage: false, "texte-ecran": false, "mention-ia": false },
    entrees: { casConcret: { casId, porte: "porte-a", mot, avecMot: true, reseaux: [...RESEAUX], essai: true, codeSuivi: `cc-${casId}-abc123` } },
    reglages: {},
    plans: [],
    prononciations: [],
    mentionIA: { incrustee: false, position: "haut-droite", dureeSec: 0, texte: "", dansLegende: false },
    budgetMax: { centimes: 0, devise: "EUR" },
    construiteLe: "2026-10-14T09:00:00.000Z",
  } as unknown as CommandeFabrication;
}

/** Écriture simulée comptée (le rôle simule la réponse de Claude). */
function ecritureComptee() {
  const appels: string[] = [];
  const executer: DependancesBranchementsCasConcret["executer"] = async (_v, role: DefinitionRole, entree: EntreeRole) => {
    appels.push(role.id);
    const sortie = role.simuler?.(entree);
    return { ok: true, simule: true, texte: typeof sortie === "string" ? sortie : JSON.stringify(sortie) };
  };
  return { appels, executer };
}

function moteurAvec(dep: DependancesBranchementsCasConcret) {
  return creerMoteurMontageCasConcret({ outils: (c, travailId) => b.outilsCasConcret(c, travailId, { numeroVersion: async () => 42, ...dep }) });
}

async function jusquAuBout(moteur: ReturnType<typeof moteurAvec>, c: CommandeFabrication, depart?: Travail) {
  let travail = depart ?? (await moteur.lancer(c, { travailId: "tr-cc", versionId: "ver-cc", titre: "Essai" } as never));
  for (let i = 0; i < 400 && travail.statut !== "termine" && travail.statut !== "echec"; i++) travail = (await moteur.avancer(travail, c)).travail;
  return travail;
}

/** Range le travail sous la dernière version de la vidéo (comme la fabrication réelle). */
async function rangerTravail(travail: Travail, c: CommandeFabrication) {
  const d = depots();
  const video = (await d.videos.obtenir(VIDEO))!;
  await d.videos.modifier(VIDEO, { formatId: "cas-concret", estDemo: false });
  await d.versions.modifier(video.versionChoisieId!, { commande: c, travailId: travail.id, numero: 99 });
  await d.travaux.enregistrer({ ...travail, cibleId: VIDEO, versionId: video.versionChoisieId! });
}

beforeAll(async () => {
  process.env.SESSION_SECRET = "t".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    throw new Error("Aucun appel réseau dans ces tests.");
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("script fourni et fabrication", () => {
  it("enregistré, il est rejoué sans AUCUN appel d'écriture, et c'est son texte qui est dit", async () => {
    const lire = vi.spyOn(fournisseurVoixSimulation, "lire");
    const cas = trouverCas(CAS)!;
    const b = bornesDesFins(cas);
    const gabarit = ficheParGabarit(cas, { videoId: "v", versionId: "v", habillage: "charte-duo/1", origine: "porte-a" }, dureesDesFins([b.courte, b.longue]));
    const lignes = texteFourniDesEcrans(gabarit.ecrans, cas).split("\n");
    // Un texte à Will : la question finale est la sienne.
    lignes[lignes.length - 1] = "[question] Et chez vous, qui rappelle encore vos rendez-vous à la main ?";
    const texte = lignes.join("\n");
    const e = await fourni.enregistrerScriptFourni(CAS, texte);
    expect(e.modifie).toBe(true);

    const { appels, executer } = ecritureComptee();
    const moteur = moteurAvec({ rendu: renduImmediat(), attendre: async () => {}, executer, claudeActif: async () => false });
    const fini = await jusquAuBout(moteur, commande());
    expect(fini.statut).toBe("termine");
    expect(appels.filter((x) => x === "ecriture-cas-concret")).toHaveLength(0);
    expect(appels).toHaveLength(0);
    const dit = texteDuCorps(scripts.ficheDuTravail(fini)!);
    expect(dit).toContain("qui rappelle encore vos rendez-vous à la main ?");
    expect(String(lire.mock.calls[0][0].texte)).toContain("qui rappelle encore vos rendez-vous à la main");
  }, 60_000);
});
