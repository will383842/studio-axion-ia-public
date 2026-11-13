/**
 * GV2-20 · « Script à valider » sans issue manquante : la vidéo attend la validation, le fondateur a enregistré depuis un
 * script fourni (« Mon script »). `scriptFourniPlusRecent` le propose ; `validerScriptFourniPourVideo` le pose sur la vidéo
 * en attente puis relance par la fonction de relance existante (aucune ligne d'argent ici). Sans script plus récent : rien.
 * Base en mémoire, simulation : aucun appel réseau, rien de payé.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { creerServiceRenduSimule } = await import("@/fournisseurs/simulation/rendu");
const { creerMoteurMontageCasConcret } = await import("@/moteurs/montage-cas-concret");
const auth = await import("@/services/auth");
const b = await import("@/services/cas-concret-branchements");
const scripts = await import("@/services/cas-concret-scripts");
// L0a : « Valider ce script » réécrit le script de la vidéo (services/videos) : module chargé ici, pas pendant un test.
await import("@/services/videos");
const { CODE_SCRIPT_A_VALIDER } = await import("@/moteurs/montage-cas-concret/script-valide");

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
    entrees: { casConcret: { casId, porte: "porte-a", mot: "APPORT", avecMot: true, reseaux: [...RESEAUX], essai: true, codeSuivi: `cc-${casId}-abc123` } },
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

const { enregistrerScriptFourni, departMonScript } = await import("@/services/cas-concret-script-fourni");

async function videoEnAttente() {
  const { executer } = ecritureComptee();
  const moteur = moteurAvec({ rendu: renduImmediat(), attendre: async () => {}, executer, claudeActif: async () => false });
  const c = commande();
  const arrete = await jusquAuBout(moteur, c);
  expect(arrete.erreur?.code).toBe(CODE_SCRIPT_A_VALIDER);
  await rangerTravail(arrete, c);
  return arrete;
}

const textePropre = async () => (await departMonScript(CAS)).texte;

describe("GV2-20 · script fourni plus récent que la mise en attente", () => {
  it("aucun script fourni enregistré : rien n'est proposé, et la validation du script fourni est refusée sans relance", async () => {
    await videoEnAttente();
    expect(await scripts.scriptFourniPlusRecent(CAS, "2026-10-01")).toBeNull();
    const relancer = vi.fn();
    await expect(scripts.validerScriptFourniPourVideo(VIDEO, { relancer })).rejects.toMatchObject({ code: "SCRIPT_FOURNI_ABSENT" });
    expect(relancer).not.toHaveBeenCalled();
  });

  it("script fourni enregistré après la mise en attente : il est rendu ; enregistré avant : rien", async () => {
    await videoEnAttente();
    await enregistrerScriptFourni(CAS, await textePropre(), { maintenant: Date.UTC(2026, 10, 13) });
    const trouve = await scripts.scriptFourniPlusRecent(CAS, "2026-11-12T08:00:00.000Z");
    expect(trouve).toMatchObject({ casId: CAS, fourni: true, valideLe: "2026-11-13" });
    expect(await scripts.scriptFourniPlusRecent(CAS, "2026-11-14T08:00:00.000Z")).toBeNull();
    expect(await scripts.scriptFourniPlusRecent("autre-cas", "2026-11-12")).toBeNull();
  });

  it("un script validé NON fourni n'est jamais proposé comme « mon script »", async () => {
    await videoEnAttente();
    await scripts.validerScriptCasConcret(VIDEO, { maintenant: Date.UTC(2026, 10, 13) });
    expect(await scripts.scriptFourniPlusRecent(CAS, "2026-11-01")).toBeNull();
  });

  it("validerScriptFourniPourVideo pose CE script sur la vidéo (onglet Script) puis relance le travail en attente", async () => {
    const arrete = await videoEnAttente();
    const texte = await textePropre();
    await enregistrerScriptFourni(CAS, texte, { maintenant: Date.UTC(2026, 10, 13) });
    const relancer = vi.fn(async () => ({ statut: "relancee" as const, travailId: arrete.id }));
    const r = await scripts.validerScriptFourniPourVideo(VIDEO, { maintenant: Date.UTC(2026, 10, 13), relancer });
    expect(relancer).toHaveBeenCalledTimes(1);
    expect(relancer).toHaveBeenCalledWith(arrete.id, undefined);
    expect(r).toMatchObject({ casId: CAS, valideLe: "2026-11-13", issue: { statut: "relancee" } });
    const garde = (await scripts.scriptValideDuStudio(CAS))!;
    expect(garde.fourni).toBe(true);
    expect(garde.texteFourni).toBe(texte);
    const scriptVideo = (await depots().scripts.obtenir((await depots().videos.obtenir(VIDEO))!.scriptId!))!;
    expect(scriptVideo.blocs.map((x) => x.segments[0].texte).join(" ")).toBe(garde.ecrans.map((e) => e.texteDit.trim()).join(" "));
  });

  it("relance refusée : le script est quand même posé, la phrase du refus est rendue pour l'écran", async () => {
    await videoEnAttente();
    await enregistrerScriptFourni(CAS, await textePropre(), { maintenant: Date.UTC(2026, 10, 13) });
    const relancer = vi.fn(async () => ({ statut: "refusee" as const, phrase: "Pas maintenant." }));
    const r = await scripts.validerScriptFourniPourVideo(VIDEO, { maintenant: Date.UTC(2026, 10, 13), relancer });
    expect(r.issue).toEqual({ statut: "refusee", phrase: "Pas maintenant." });
  });
});
