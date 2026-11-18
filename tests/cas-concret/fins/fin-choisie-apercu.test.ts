/**
 * FIX-CC-FIN-CHOIX-b2 · l'aperçu du script et « Vos fichiers » rejouent la fin « rendez-vous » choisie (`finDemandee`).
 * Sans le champ : identique à master (FIN_AUCUNE). Doubles en mémoire, aucun appel réseau, rien de payé.
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
const { vueCasConcret } = await import("@/services/cas-concret-vue");
const { FIN_AUCUNE } = await import("@/moteurs/montage-cas-concret/fins");
const { DIT_FIN_RENDEZ_VOUS } = await import("@/moteurs/montage-cas-concret/fin-choisie");
// L0a : « Valider ce script » réécrit le script de la vidéo (services/videos) : module chargé ici, pas pendant un test.
await import("@/services/videos");
const { CODE_SCRIPT_A_VALIDER, PHRASE_SCRIPT_A_VALIDER, scriptValideDuCatalogue } = await import("@/moteurs/montage-cas-concret/script-valide");
const { ErreurFabricationCasConcret, fabriquerCasConcret } = await import("@/moteurs/montage-cas-concret/fabriquer");
const { texteDuCorps } = await import("@/moteurs/montage-cas-concret/fiche");
const { doubles } = await import("../fabriquer/doubles");

import type { CommandeFabrication, Travail } from "@/domaine/types";
import type { DefinitionRole, EntreeRole } from "@/generateur/roles/types";
import type { DependancesBranchementsCasConcret } from "@/services/cas-concret-branchements";

const MDP = "cas-concret-fin-apercu";
const VIDEO = "v-03";
const CAS = "rappels-rendez-vous";
const RESEAUX = ["facebook", "instagram", "tiktok", "linkedin"] as const;

function renduImmediat() {
  let t = 0;
  return { service: creerServiceRenduSimule(() => (t += 60_000)), simule: true };
}

function commande(finDemandee?: unknown, casId = CAS): CommandeFabrication {
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
    entrees: { casConcret: { casId, porte: "porte-a", mot: "APPORT", avecMot: false, motSur: [], reseaux: [...RESEAUX], essai: true, codeSuivi: `cc-${casId}-abc123`, ...(finDemandee === undefined ? {} : { finDemandee }) } },
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

const FIN_RDV = "Prenez rendez-vous pour votre diagnostic IA gratuit de 45 minutes.";

/** Chaîne jusqu'à « à valider », rangée sous la dernière version avec ou sans `finDemandee`. */
async function apercuAvec(finDemandee?: unknown) {
  const { executer } = ecritureComptee();
  const moteur = moteurAvec({ rendu: renduImmediat(), attendre: async () => {}, executer, claudeActif: async () => false });
  const c = commande(finDemandee);
  const arrete = await jusquAuBout(moteur, c);
  await rangerTravail(arrete, c);
  return (await scripts.apercuScriptCasConcret(VIDEO))!;
}

describe("FIX-CC-FIN-CHOIX-b2 · aperçu du script", () => {
  it("avec finDemandee « rendez-vous » : la phrase de fin est dite et écrite mot pour mot", async () => {
    const a = await apercuAvec("rendez-vous");
    expect(a.fins.length).toBeGreaterThan(0);
    for (const f of a.fins) {
      expect(f.dit).toContain(FIN_RDV);
      expect(f.ecrits[0]).toBe("Prenez rendez-vous");
      expect(f.ecrits).toHaveLength(2);
      expect(f.ecrits[1]).toMatch(/^Diagnostic gratuit · lien/);
    }
    expect(FIN_RDV).toBe(DIT_FIN_RENDEZ_VOUS);
  });

  it("sans le champ (ou valeur inconnue) : FIN_AUCUNE, comme avant", async () => {
    for (const v of [undefined, "aucune", true]) {
      reinitialiserDepots();
      const a = await apercuAvec(v);
      expect(a.fins.length).toBeGreaterThan(0);
      for (const f of a.fins) expect(f).toMatchObject({ dit: FIN_AUCUNE, ecrits: [] });
    }
  });
});

describe("FIX-CC-FIN-CHOIX-b2 · « Vos fichiers »", () => {
  const urlDeCle = async (cle: string) => `https://stockage.test/${cle}?signature=abc`;
  async function vue(finDemandee?: unknown) {
    const d = depots();
    const video = (await d.videos.obtenir(VIDEO))!;
    const version = (await d.versions.obtenir(video.versionChoisieId!))!;
    await d.videos.modifier(VIDEO, { formatId: "cas-concret", estDemo: false });
    const entrees = commande(finDemandee).entrees;
    const fins = RESEAUX.map((r) => ({ id: `fin-${r}`, reseaux: [r], fichierCle: `studio/test/${r}.mp4`, dureeSec: 50 }));
    await d.versions.modifier(version.id, {
      estDemo: false,
      commande: { ...(version.commande as object), moteurId: "montage-cas-concret", entrees } as unknown as CommandeFabrication,
      projetMontage: { moteur: "montage-cas-concret", casConcret: { fins, liens: {}, publication: [], rapport: { verdict: "ok", resume: "ok", phrases: [] } } },
    } as never);
    return (await vueCasConcret(VIDEO, { urlDeCle }))!;
  }
  it("avec finDemandee « rendez-vous » : « Fin : diagnostic et lien » ; sans : aucune", async () => {
    const avec = await vue("rendez-vous");
    expect(avec.fichiers).toHaveLength(4);
    for (const f of avec.fichiers) expect(f.phraseFin).toBe("Fin : diagnostic et lien");
    const sans = await vue(undefined);
    for (const f of sans.fichiers) expect(f.phraseFin).toContain("Fin : aucune");
  });
});
