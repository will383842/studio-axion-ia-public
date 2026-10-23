/**
 * V4-3 · UN CAS SANS SCRIPT VALIDÉ : Claude écrit (trame imposée par le cas), la fiche est relue, puis la fabrication
 * S'ARRÊTE avant toute voix : le script attend Will (« à valider »). « Valider ce script » (action serveur) en fait le
 * script validé du cas ; « Réessayer » fabrique alors la vidéo SANS nouvel appel d'écriture. Raccords par défaut :
 * script du studio puis du catalogue, validation exigée. Base en mémoire, simulation : aucun appel réseau, rien de payé.
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
const { ErreurFabricationCasConcret, fabriquerCasConcret } = await import("@/moteurs/montage-cas-concret/fabriquer");
const { texteDuCorps } = await import("@/moteurs/montage-cas-concret/fiche");
const { doubles } = await import("../fabriquer/doubles");

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

describe("V4-3 · chaîne : un script écrit attend la validation, avant toute voix", () => {
  it("fabrication : écriture puis relecture, arrêt « à valider » ; validé, la reprise ne réécrit pas et va au bout", async () => {
    const d = doubles({ casId: CAS });
    d.options.outils.contexte = { ...d.options.outils.contexte, exigerScriptValide: true };
    const err = await fabriquerCasConcret(d.options).then(() => null, (e: unknown) => e);
    expect(err).toBeInstanceOf(ErreurFabricationCasConcret);
    expect((err as InstanceType<typeof ErreurFabricationCasConcret>).etape).toBe("fiche");
    expect((err as InstanceType<typeof ErreurFabricationCasConcret>).raisons).toEqual([PHRASE_SCRIPT_A_VALIDER]);
    expect(d.appelsEcriture()).toBe(1);
    expect(d.lus).toEqual([]);
  });

  it("raccords par défaut : script du catalogue pour « recrutement-apporteurs », validation exigée", async () => {
    const o = await b.outilsCasConcret(commande("recrutement-apporteurs"), "tr-cc", { rendu: renduImmediat() });
    expect(o.contexte.exigerScriptValide).toBe(true);
    expect(await o.scriptValide!("recrutement-apporteurs")).toEqual(scriptValideDuCatalogue("recrutement-apporteurs"));
    expect(await o.scriptValide!(CAS)).toBeNull();
  });
});

describe("V4-3 · services : aperçu, « Valider ce script », reprise sans nouvelle écriture", () => {
  it("de bout en bout : arrêt à valider (aucune voix), aperçu, validation, « Réessayer » → vidéo faite avec ce texte", async () => {
    const lire = vi.spyOn(fournisseurVoixSimulation, "lire");
    const { appels, executer } = ecritureComptee();
    const moteur = moteurAvec({ rendu: renduImmediat(), attendre: async () => {}, executer, claudeActif: async () => false });
    const c = commande();
    const arrete = await jusquAuBout(moteur, c);
    expect(arrete.statut).toBe("echec");
    expect(arrete.erreur).toMatchObject({ code: CODE_SCRIPT_A_VALIDER, reessayable: true, messagePourWill: PHRASE_SCRIPT_A_VALIDER });
    expect(arrete.etapes.find((e) => e.statut === "echec")?.cle).toBe("fiche");
    expect(lire).not.toHaveBeenCalled();
    expect(appels.filter((x) => x === "ecriture-cas-concret")).toHaveLength(1);

    await rangerTravail(arrete, c);
    const apercu = (await scripts.apercuScriptCasConcret(VIDEO))!;
    expect(apercu.etat).toBe("a-valider");
    expect(apercu.casId).toBe(CAS);
    expect(apercu.ecrans[0]).toMatchObject({ rang: 1, type: "accroche", nom: "Accroche" });
    expect(apercu.ecrans[apercu.ecrans.length - 1].type).toBe("question");
    expect(apercu.ecrans.every((e) => e.texteDit.length > 0)).toBe(true);

    const v = await scripts.validerScriptCasConcret(VIDEO, { maintenant: Date.UTC(2026, 9, 14) });
    expect(v).toEqual({ casId: CAS, valideLe: "2026-10-14", modifie: false });
    const garde = (await scripts.scriptValideDuStudio(CAS))!;
    expect(texteDuCorps({ ecrans: garde.ecrans } as never)).toBe(apercu.texteDit);
    expect(garde.ecrans.every((e) => !("id" in e) && !("marque" in e))).toBe(true);
    // Brique 3 : la validation crée une version (la 1ʳᵉ), gardée à l'historique.
    expect(garde.numero).toBe(1);
    expect((await scripts.historiqueScriptsValides(CAS)).map((s) => s.numero)).toEqual([1]);
    // L0a : l'onglet Script de la vidéo montre le texte validé, écran par écran (plus la trame du cas).
    const scriptVideo = (await depots().scripts.obtenir((await depots().videos.obtenir(VIDEO))!.scriptId!))!;
    expect(scriptVideo.blocs.map((x) => x.segments[0].texte)).toEqual(apercu.ecrans.map((e) => e.texteDit.trim()));

    const fini = await jusquAuBout(moteur, c, await moteur.reessayer(arrete));
    expect(fini.erreur?.messagePourWill).toBeUndefined();
    expect(fini.statut).toBe("termine");
    expect(appels.filter((x) => x === "ecriture-cas-concret")).toHaveLength(1);
    expect(lire).toHaveBeenCalled();
    expect(String(lire.mock.calls[0][0].texte)).toContain(apercu.ecrans[1].texteDit.split(" ").slice(0, 3).join(" "));
  });

  it("Will MODIFIE le script avant de le valider (14/10) : la version modifiée est gardée, puis dite telle quelle", async () => {
    const lire = vi.spyOn(fournisseurVoixSimulation, "lire");
    const { executer } = ecritureComptee();
    const moteur = moteurAvec({ rendu: renduImmediat(), attendre: async () => {}, executer, claudeActif: async () => false });
    const c = commande();
    const arrete = await jusquAuBout(moteur, c);
    await rangerTravail(arrete, c);
    const apercu = (await scripts.apercuScriptCasConcret(VIDEO))!;
    const e2 = apercu.ecrans[1];
    expect(e2.ecrits?.length).toBeGreaterThan(0);
    const nouvelle = "Plus aucun rendez-vous oublié.";
    const ecritModifie = e2.modifiables!.findIndex((m) => m);
    const ecrits = e2.ecrits!.map((t, k) => (k === ecritModifie ? `${t.replace(/\*/g, "")} !` : null));
    const v = await scripts.validerScriptCasConcret(VIDEO, { maintenant: Date.UTC(2026, 9, 14), modifications: [{ rang: 2, texteDit: nouvelle, ecrits }] });
    expect(v.modifie).toBe(true);
    const garde = (await scripts.scriptValideDuStudio(CAS))!;
    expect(garde.ecrans[1].texteDit).toBe(nouvelle);
    expect(garde.numero).toBe(1);
    const fini = await jusquAuBout(moteur, c, await moteur.reessayer(arrete));
    expect(fini.statut).toBe("termine");
    expect(String(lire.mock.calls[0][0].texte)).toContain(nouvelle);
  });

  it("une modification refusée par les contrôles n'est PAS gardée, la raison est dite", async () => {
    const { executer } = ecritureComptee();
    const moteur = moteurAvec({ rendu: renduImmediat(), attendre: async () => {}, executer, claudeActif: async () => false });
    const c = commande();
    const arrete = await jusquAuBout(moteur, c);
    await rangerTravail(arrete, c);
    const trop = Array.from({ length: 60 }, () => "vraiment").join(" ");
    await expect(scripts.validerScriptCasConcret(VIDEO, { modifications: [{ rang: 2, texteDit: trop }] })).rejects.toThrow(/ne passe pas les contrôles/);
    await expect(scripts.validerScriptCasConcret(VIDEO, { modifications: [{ rang: 2, texteDit: "   " }] })).rejects.toThrow(/ne peut pas être vide/);
    expect(await scripts.scriptValideDuStudio(CAS)).toBeNull();
  });

  it("aucun script n'attend : la validation est refusée en phrase", async () => {
    await expect(scripts.validerScriptCasConcret(VIDEO)).rejects.toThrow("Aucun script n'attend votre validation pour cette vidéo.");
  });

  it("L0c · l'aperçu montre à Will où l'image ne suit pas la parole (écran 2 : cases décalées), sans bloquer", () => {
    const liste = {
      id: "e02",
      type: "liste-avant",
      fond: "ivoire",
      texteDit: "Avant, c'était ça : trouver un sujet, écrire, vérifier, chercher une photo, mettre en ligne.",
      taches: ["Le sujet", "L'article long", "Le référencement", "La photo"],
      evenements: [3, 6, 8, 11].map((surMot, i) => ({ cible: `tache-${i + 1}`, surMot, avanceMs: 0 })),
    };
    const accroche = { id: "e01", type: "accroche", fond: "sombre", texteDit: "Deux cents articles par jour.", lignes: ["Deux cents", "articles"], motOrange: "articles", evenements: [] };
    const travail = {
      statut: "echec",
      erreur: { code: CODE_SCRIPT_A_VALIDER, reessayable: true, messagePourWill: PHRASE_SCRIPT_A_VALIDER },
      etapes: [],
      parametres: { casConcret: { journal: { etapes: { ecriture: { sortie: { fiche: { casId: CAS, ecrans: [accroche, liste] } } } } } } },
    } as unknown as Travail;
    const apercu = scripts.apercuDuTravail(travail)!;
    expect(apercu.etat).toBe("a-valider");
    expect(apercu.avertissements.length).toBeGreaterThan(0);
    expect(apercu.avertissements.every((a) => a.rang === 2)).toBe(true);
    expect(apercu.avertissements.map((a) => a.detail).join(" ")).toContain("« La photo » apparaît sur « mettre »");
  });
});
