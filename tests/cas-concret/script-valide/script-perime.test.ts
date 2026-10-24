/**
 * Script validé PÉRIMÉ (24/10/2026, prod v-76133af2a7d2) : un script validé depuis le studio pour une autre version du cas est
 * traité comme ABSENT (Claude écrit un nouveau script, la fabrication s'arrête à « Script à valider », la voix n'est payée
 * qu'après la validation de Will). Un script validé de la version courante est rejoué à l'identique, sans appel d'écriture.
 * Un script du CATALOGUE périmé reste un refus (défaut de code). Base en mémoire, simulation : rien de payé.
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
const { trouverCas } = await import("@/formats/cas-concret/catalogue");

import type { CommandeFabrication, Travail } from "@/domaine/types";
import type { DefinitionRole, EntreeRole } from "@/generateur/roles/types";
import type { DependancesBranchementsCasConcret } from "@/services/cas-concret-branchements";

const MDP = "cas-concret-script";
const VIDEO = "v-03";
const CAS = "transporteur-demandes-de-cotation";
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

/** Le travail de la vidéo, arrêté à « Script à valider », puis le script validé par le chemin normal (la version courante). */
async function scriptValideDeLaVersionCourante() {
  const { executer } = ecritureComptee();
  const moteur = moteurAvec({ rendu: renduImmediat(), attendre: async () => {}, executer, claudeActif: async () => false });
  const c = commande();
  const arrete = await jusquAuBout(moteur, c);
  expect(arrete.erreur).toMatchObject({ code: CODE_SCRIPT_A_VALIDER });
  await rangerTravail(arrete, c);
  await scripts.validerScriptCasConcret(VIDEO, { maintenant: Date.UTC(2026, 9, 24) });
  return { c, courant: (await scripts.scriptValideDuStudio(CAS))! };
}

describe("script validé périmé", () => {
  it("studio : un script validé pour la version N-1 (réglage du studio) est traité comme absent ; validé de nouveau, la vidéo se fait sans réécriture", async () => {
    const lire = vi.spyOn(fournisseurVoixSimulation, "lire");
    const cas = trouverCas(CAS)!;
    const { c, courant } = await scriptValideDeLaVersionCourante();
    expect(courant.versionCas).toBe(cas.version);
    // Le réglage casConcret.scriptsValides porte un script de la version N-1 ; raccord par défaut (réglage du studio puis catalogue).
    await ecrireParametre(scripts.CLE_SCRIPTS_VALIDES, { [CAS]: { ...courant, versionCas: cas.version - 1 } });
    const { appels, executer } = ecritureComptee();
    const moteur = moteurAvec({ rendu: renduImmediat(), attendre: async () => {}, executer, claudeActif: async () => false });
    const arrete = await jusquAuBout(moteur, c);
    expect(arrete.statut).toBe("echec");
    expect(arrete.erreur).toMatchObject({ code: CODE_SCRIPT_A_VALIDER, reessayable: true, messagePourWill: PHRASE_SCRIPT_A_VALIDER });
    expect(appels.filter((x) => x === "ecriture-cas-concret")).toHaveLength(1);
    expect(lire).not.toHaveBeenCalled();

    // Will valide le nouveau script ; « Réessayer » : la vidéo se fait sans nouvel appel d'écriture.
    await rangerTravail(arrete, c);
    await scripts.validerScriptCasConcret(VIDEO, { maintenant: Date.UTC(2026, 9, 24) });
    expect((await scripts.scriptValideDuStudio(CAS))!.versionCas).toBe(cas.version);
    const fini = await jusquAuBout(moteur, c, await moteur.reessayer(arrete));
    expect(fini.statut).toBe("termine");
    expect(appels.filter((x) => x === "ecriture-cas-concret")).toHaveLength(1);
  });

  it("studio : un script validé de la version courante est rejoué à l'identique, sans aucun appel d'écriture", async () => {
    const { c, courant } = await scriptValideDeLaVersionCourante();
    const { appels, executer } = ecritureComptee();
    const rejoue = moteurAvec({ rendu: renduImmediat(), attendre: async () => {}, executer, claudeActif: async () => false });
    const fini = await jusquAuBout(rejoue, c);
    expect(fini.statut).toBe("termine");
    expect(appels.filter((x) => x === "ecriture-cas-concret")).toHaveLength(0);
    const fiche = scripts.ficheDuTravail(fini)!;
    expect(texteDuCorps(fiche)).toBe(texteDuCorps({ ecrans: courant.ecrans } as never));
  });

  it("« Nouveau script » : le script validé de la vidéo en version N-1 est traité comme absent (réessai sur « à valider », aucune voix)", async () => {
    const lire = vi.spyOn(fournisseurVoixSimulation, "lire");
    const cas = trouverCas(CAS)!;
    const { c, courant } = await scriptValideDeLaVersionCourante();
    const nouveau = { ...c, entrees: { casConcret: { ...(c.entrees as { casConcret: object }).casConcret, nouveauScript: 1 } } } as unknown as CommandeFabrication;
    const { appels, executer } = ecritureComptee();
    const moteur = moteurAvec({ rendu: renduImmediat(), attendre: async () => {}, executer, claudeActif: async () => false, scriptValideDeLaVideo: async () => ({ ...courant, versionCas: cas.version - 1 }) });
    const arrete = await jusquAuBout(moteur, nouveau);
    expect(arrete.erreur).toMatchObject({ code: CODE_SCRIPT_A_VALIDER, reessayable: true });
    expect(appels.filter((x) => x === "ecriture-cas-concret")).toHaveLength(1);
    expect(lire).not.toHaveBeenCalled();
  });

  it("catalogue : un réglage du studio périmé retombe sur le script du catalogue, valide pour la version courante (rejoué, sans écriture)", async () => {
    const cas = trouverCas("recrutement-apporteurs")!;
    const catalogue = scriptValideDuCatalogue("recrutement-apporteurs")!;
    expect(catalogue.versionCas).toBe(cas.version);
    const { appels, executer } = ecritureComptee();
    const moteur = moteurAvec({ rendu: renduImmediat(), attendre: async () => {}, executer, claudeActif: async () => false, scriptValide: async () => ({ ...catalogue, versionCas: cas.version - 1 }) });
    const travail = await jusquAuBout(moteur, commande("recrutement-apporteurs"));
    expect(travail.statut).toBe("termine");
    expect(appels.filter((x) => x === "ecriture-cas-concret")).toHaveLength(0);
  });

  it("catalogue : un script du catalogue périmé reste un refus (jamais écrit à nouveau en silence)", async () => {
    const script = scriptValideDuCatalogue("recrutement-apporteurs")!;
    const cas = trouverCas("recrutement-apporteurs")!;
    const avant = script.versionCas;
    (script as { versionCas: number }).versionCas = cas.version + 5;
    try {
      const { appels, executer } = ecritureComptee();
      const moteur = moteurAvec({ rendu: renduImmediat(), attendre: async () => {}, executer, claudeActif: async () => false });
      const travail = await jusquAuBout(moteur, commande("recrutement-apporteurs"));
      expect(travail.statut).toBe("echec");
      expect(travail.erreur?.code).not.toBe(CODE_SCRIPT_A_VALIDER);
      expect(travail.erreur?.messagePourWill ?? "").toContain("revalider");
      expect(appels.filter((x) => x === "ecriture-cas-concret")).toHaveLength(0);
    } finally {
      (script as { versionCas: number }).versionCas = avant;
    }
  });
});
