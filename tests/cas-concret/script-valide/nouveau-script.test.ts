/**
 * LOT F · « Nouveau script (autre structure) » pour un cas dont le script est déjà validé. Base en mémoire, lancement et
 * fabrication simulés : aucun appel réseau, rien de payé.
 *
 * - L'option écarte le script validé POUR CETTE VIDÉO : une écriture, arrêt à « Script à valider », voix non payée ;
 *   l'ancien script n'est ni modifié ni retiré (aucune version de plus) ; le prix compte l'écriture ; aucun repère
 *   « script relu » n'est exigé (il n'y a rien à relire).
 * - Dès que Will valide un script plus récent, c'est lui qui est rejoué (aucune écriture de plus).
 * - Sans l'option : rien ne change (entrées de la vidéo identiques, repère toujours exigé).
 */
import { hash } from "@node-rs/argon2";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
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
const service = await import("@/services/cas-concret");
await import("@/services/videos");
const { SCRIPT_V4_RECRUTEMENT } = await import("@/moteurs/montage-cas-concret/scripts-valides/recrutement-apporteurs");
const { estimerDepuisCas } = await import("@/moteurs/montage-cas-concret");
const { lireEntreesCasConcret } = await import("@/moteurs/montage-cas-concret/etapes");
const { trouverCas } = await import("@/formats/cas-concret/catalogue");
const { ContenuVotreVideo, LIBELLE_NOUVEAU_SCRIPT } = await import("../../../src/components/formats/cas-concret/entree/FeuilleVotreVideo");
const { versVueCas } = await import("../../../src/components/formats/cas-concret/entree/vue");
const { empreinteCas } = await import("@/formats/cas-concret/cas");
const { apercuDesEcrans } = await import("@/moteurs/montage-cas-concret/script-valide");

import type { CommandeFabrication, Travail } from "@/domaine/types";
import type { OutilsVariete } from "@/moteurs/montage-cas-concret/outils";
import type { ScriptValide } from "@/moteurs/montage-cas-concret/script-valide";

const MDP = "nouveau-script";
const CAS = "recrutement-apporteurs";
const RESEAUX = ["facebook", "instagram", "tiktok", "linkedin"];
const COPIE_CATALOGUE = structuredClone(SCRIPT_V4_RECRUTEMENT);
const NOUVELLE = "On recrute nos collaborateurs sans";
const cas = trouverCas(CAS)!;

beforeAll(async () => {
  process.env.SESSION_SECRET = "t".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  const d = depots();
  const base = (await d.voix.obtenir("voix-will"))!;
  await d.voix.enregistrer({ ...base, id: "voix-avocat-test", nom: "Voix avocat", statut: "pret" });
  await d.personnages.modifier("p-will", { voixParDefautId: "voix-will", voixParFormat: { avocat: "voix-avocat-test" } });
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    throw new Error("Aucun appel réseau dans ces tests.");
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  // Le script du catalogue n'est JAMAIS modifié en place.
  expect(SCRIPT_V4_RECRUTEMENT).toEqual(COPIE_CATALOGUE);
});

const entreesCasConcret = async (): Promise<Record<string, unknown>> => {
  const [v] = await depots().videos.lister((x) => x.formatId === "cas-concret");
  return (v!.entrees as { casConcret: Record<string, unknown> }).casConcret;
};

describe("service : le lancement avec l'option", () => {
  let n = 0;
  const lancer = vi.fn(async () => ({ travailId: `t-ns-${++n}` }));
  const demande = (o: Partial<Parameters<typeof service.preparerEtLancer>[0]> = {}) => ({ casId: CAS, reseaux: RESEAUX, mot: "IA", avecMot: false, accordCentimes: 10_000, ...o });

  it("sans repère « script relu » : lancée ; le numéro du script écarté est gardé, aucun repère ; l'ancien script est intact", async () => {
    // Le repère du script validé est envoyé : il n'est pas gardé (rien à relire pour un script neuf).
    const r = await service.preparerEtLancer(demande({ nouveauScript: true, empreinteScriptRelu: scripts.empreinteScriptValide(SCRIPT_V4_RECRUTEMENT) }), { lancer });
    expect(r.statut).toBe("lancee");
    const e = await entreesCasConcret();
    expect(e.nouveauScript).toBe(1);
    expect("scriptRelu" in e).toBe(false);
    // Même avec un repère envoyé par erreur, il n'est pas gardé (rien à relire).
    expect(await scripts.scriptValideDuStudio(CAS)).toEqual(SCRIPT_V4_RECRUTEMENT);
    expect(await scripts.historiqueScriptsValides(CAS)).toEqual([]);
  });

  it("le prix compte l'écriture (même plafond « au plus ») : l'accord du script rejoué ne suffit plus", async () => {
    const sans = await service.estimerCas(CAS, RESEAUX, false);
    const avec = await service.estimerCas(CAS, RESEAUX, false, { nouveauScript: true });
    expect(avec.centimes).toBeGreaterThan(sans.centimes);
    const attendu = estimerDepuisCas(cas, RESEAUX as never, false, { nouveauScript: true });
    expect(estimerDepuisCas(cas, RESEAUX as never, false).lignes.some((l) => l.etape === "Écriture")).toBe(false);
    expect(attendu.lignes.some((l) => l.etape === "Écriture")).toBe(true);
    const r = await service.preparerEtLancer(demande({ nouveauScript: true, accordCentimes: sans.centimes }), { lancer });
    expect(r.statut).toBe("accord-requis");
    if (r.statut === "accord-requis") expect(r.centimes).toBeGreaterThanOrEqual(avec.centimes);
  });

  it("sans l'option, rien ne change : repère toujours exigé, entrées de la vidéo sans la nouvelle clé", async () => {
    expect(await service.preparerEtLancer(demande(), { lancer })).toEqual({ statut: "refusee", phrase: scripts.PHRASE_SCRIPT_NON_RELU });
    const relu = scripts.empreinteScriptValide(SCRIPT_V4_RECRUTEMENT);
    expect((await service.preparerEtLancer(demande({ empreinteScriptRelu: relu }), { lancer })).statut).toBe("lancee");
    const e = await entreesCasConcret();
    expect(Object.keys(e).sort()).toEqual(["avecMot", "casId", "codeSuivi", "empreinteCas", "essai", "mot", "motDit", "motSur", "porte", "reseaux", "scriptRelu"]);
    // `nouveauScript: false` vaut « sans l'option ».
    expect(await service.preparerEtLancer(demande({ nouveauScript: false }), { lancer })).toEqual({ statut: "refusee", phrase: scripts.PHRASE_SCRIPT_NON_RELU });
  });

  it("un cas sans script validé : l'option est ignorée (rien n'est écarté, rien n'est gardé)", async () => {
    const r = await service.preparerEtLancer({ casId: "rappels-rendez-vous", reseaux: RESEAUX, mot: "IA", avecMot: false, accordCentimes: 10_000, essai: true, nouveauScript: true }, { lancer });
    expect(r.statut).toBe("lancee");
    expect("nouveauScript" in (await entreesCasConcret())).toBe(false);
  });
});

describe("moteur : l'écriture est faite, la vidéo s'arrête à « Script à valider », la voix n'est pas payée", () => {
  function commande(videoId: string, nouveau: boolean): CommandeFabrication {
    return {
      versionContrat: 2,
      moteurId: "montage-cas-concret",
      videoId,
      formatId: "cas-concret",
      versionFormat: 1,
      profilRenduVersion: 1,
      dureeCibleSec: 50,
      ratios: ["9:16"],
      script: { blocs: [], texteComplet: "" },
      distribution: [{ role: "voix", source: "double", personnageId: "p-clara", fournisseurVoix: "simulation", voixId: "voix-clara" }],
      styles: { sousTitres: null, decor: null, lut: null, musique: null },
      briques: { "sous-titres": true, etalonnage: false, illustrations: true, son: true, habillage: false, "texte-ecran": false, "mention-ia": false },
      entrees: { casConcret: { casId: CAS, porte: "porte-a", mot: "IA", avecMot: false, reseaux: RESEAUX, essai: true, codeSuivi: `cc-${CAS}-abc123`, ...(nouveau ? { nouveauScript: 1 } : {}) } },
      reglages: {},
      plans: [],
      prononciations: [],
      mentionIA: { incrustee: false, position: "haut-droite", dureeSec: 0, texte: "", dansLegende: false },
      budgetMax: { centimes: 0, devise: "EUR" },
      construiteLe: "2026-10-15T09:00:00.000Z",
    } as unknown as CommandeFabrication;
  }

  /** Les rôles Claude appelés (l'écriture seulement ici), dans l'ordre. */
  let appels: string[] = [];

  async function jouer(c: CommandeFabrication, travailId: string, extra: { scriptValide?: (casId: string) => Promise<ScriptValide | null>; variete?: OutilsVariete } = {}): Promise<Travail> {
    appels = [];
    let t = 0;
    const moteur = creerMoteurMontageCasConcret({
      outils: (cmd, id) =>
        b.outilsCasConcret(cmd, id, {
          numeroVersion: async () => 42,
          rendu: { service: creerServiceRenduSimule(() => (t += 60_000)), simule: true },
          attendre: async () => {},
          claudeActif: async () => true,
          verifierBudget: async () => {},
          verifierEtReserver: async () => {},
          scriptsAnterieurs: async () => [],
          ...extra,
          // Forme RÉELLE de `executerRolePourVideo` pour un rôle sans schéma : le texte du gabarit tient lieu de réponse de Claude.
          executer: async (_v, role, entree) => {
            appels.push(role.id);
            const sortie = role.simuler(entree);
            return { ok: true, simule: false, texte: typeof sortie === "string" ? sortie : JSON.stringify(sortie), stopReason: "end_turn", coutUsd: 0.2 };
          },
        }),
    });
    let travail: Travail = await moteur.lancer(c, { travailId, versionId: `ver-${travailId}`, titre: "Essai" } as never);
    for (let i = 0; i < 400 && travail.statut !== "termine" && travail.statut !== "echec"; i++) travail = (await moteur.avancer(travail, c)).travail;
    return travail;
  }

  const journalDe = (t: Travail) => (t.parametres as { casConcret: { journal: { etapes: Record<string, { empreinte: string; sortie: Record<string, unknown> }> } } }).casConcret.journal;

  it("l'écriture est faite (pas le script validé), arrêt à « Script à valider », aucune lecture de voix", async () => {
    const lire = vi.spyOn(fournisseurVoixSimulation, "lire");
    const travail = await jouer(commande("v-ns1", true), "tr-ns1");
    expect(travail.statut).toBe("echec");
    expect(travail.erreur?.code).toBe("CAS_CONCRET_SCRIPT_A_VALIDER");
    expect(scripts.attendValidation(travail)).toBe(true);
    expect(appels).toEqual(["ecriture-cas-concret"]);
    const ecriture = journalDe(travail).etapes.ecriture!.sortie;
    expect(ecriture.scriptValide).toBeUndefined();
    expect(ecriture.appels).toBe(1);
    expect(lire).not.toHaveBeenCalled();
    expect(await scripts.historiqueScriptsValides(CAS)).toEqual([]);
  });

  it("sans l'option : le script validé est rejoué à l'identique, sans écriture (comme avant)", async () => {
    const travail = await jouer(commande("v-ns2", false), "tr-ns2");
    expect(travail.statut).toBe("termine");
    expect(journalDe(travail).etapes.ecriture!.sortie.scriptValide).toBe(true);
    expect(journalDe(travail).etapes.ecriture!.sortie.appels).toBe(0);
    expect(appels).toEqual([]);
  });

  it("deux vidéos « nouveau script » : la clé de l'étape d'écriture diffère (la réponse de l'une n'est jamais reprise par l'autre)", async () => {
    const a = await jouer(commande("v-ns3", true), "tr-ns3");
    const c = await jouer(commande("v-ns4", true), "tr-ns4");
    expect(journalDe(a).etapes.ecriture!.empreinte).not.toBe(journalDe(c).etapes.ecriture!.empreinte);
  });

  it("l'écriture reçoit la structure écartée : le tirage de la vidéo (outils de variété branchés) n'est pas celle du script écarté", async () => {
    const { tirer, STRUCTURES } = await import("@/moteurs/montage-cas-concret/variete");
    // Une vidéo dont le tirage naturel est la v4 (la structure du script du catalogue).
    let id = "";
    for (let i = 0; i < 500 && !id; i++) if (tirer({ videoId: `v-str-${i}`, canaux: RESEAUX, historique: [] }).structure === STRUCTURES[0]) id = `v-str-${i}`;
    expect(id).not.toBe("");
    const variete: OutilsVariete = { lireHistorique: async () => [], ajouter: async () => undefined };
    const travail = await jouer(commande(id, true), "tr-str", { variete });
    const tirage = (travail.parametres as { casConcret: { journal: { tirage: { tirage: { structure: string } } } } }).casConcret.journal.tirage.tirage;
    expect(tirage.structure).not.toBe(STRUCTURES[0]);
    // Sans l'option, le même cas garde son tirage naturel.
    const sans = await jouer(commande(id, false), "tr-str2", { variete });
    expect((sans.parametres as { casConcret: { journal: { tirage: { tirage: { structure: string } } } } }).casConcret.journal.tirage.tirage.structure).toBe(STRUCTURES[0]);
  });

  /** Deux versions validées : v2 (texte de A) et v3 (autre texte), contrôlées par le service ; sans vidéo d'origine. */
  async function deuxVersions(): Promise<{ v2: ScriptValide; v3: ScriptValide }> {
    await scripts.modifierScriptValideCasConcret(CAS, [{ rang: 1, texteDit: NOUVELLE }]);
    const v2 = (await scripts.scriptValideDuStudio(CAS))!;
    await scripts.modifierScriptValideCasConcret(CAS, [{ rang: 1, texteDit: `${NOUVELLE} stress` }]);
    const v3 = (await scripts.scriptValideDuStudio(CAS))!;
    expect([v2.numero, v3.numero]).toEqual([2, 3]);
    return { v2, v3 };
  }

  it("A et B (« nouveau script »), A validée puis rejouée, B validée ensuite, « Réessayer » sur A : aucun nouvel appel d'écriture, le script de A est rejoué", async () => {
    const { v2, v3 } = await deuxVersions();
    const deA: ScriptValide = { ...v2, videoId: "v-A" };
    const deB: ScriptValide = { ...v3, videoId: "v-B" };
    const lire = vi.spyOn(fournisseurVoixSimulation, "lire");
    const historique = [deA];
    const outil = { scriptValide: async () => historique.at(-1)!, scriptValideDeLaVideo: async (_c: string, v: string) => historique.filter((x) => x.videoId === v).at(-1) ?? null };
    const premiere = await jouer(commande("v-A", true), "tr-A1", outil);
    expect(premiere.statut).toBe("termine");
    expect(appels).toEqual([]);
    expect(String(lire.mock.calls[0]![0].texte)).toContain(NOUVELLE);
    // Will valide ensuite le script de B (version 3, origine B) ; « Réessayer » sur A.
    historique.push(deB);
    lire.mockClear();
    const reessai = await jouer(commande("v-A", true), "tr-A2", outil);
    expect(reessai.statut).toBe("termine");
    expect(appels).toEqual([]);
    expect(journalDe(reessai).etapes.ecriture!.sortie.appels).toBe(0);
    const dit = String(lire.mock.calls[0]![0].texte);
    expect(dit).toContain(NOUVELLE);
    expect(dit).not.toContain("stress");
    // B, elle, rejoue le sien.
    lire.mockClear();
    const pourB = await jouer(commande("v-B", true), "tr-B", outil);
    expect(pourB.statut).toBe("termine");
    expect(appels).toEqual([]);
    expect(String(lire.mock.calls[0]![0].texte)).toContain("stress");
  });

  it("le script validé d'une AUTRE vidéo n'est jamais rejoué : B reste à « Script à valider », voix non payée", async () => {
    const { v2 } = await deuxVersions();
    const deA: ScriptValide = { ...v2, videoId: "v-A" };
    const lire = vi.spyOn(fournisseurVoixSimulation, "lire");
    const outil = { scriptValide: async () => deA, scriptValideDeLaVideo: async (_c: string, v: string) => (v === "v-A" ? deA : null) };
    const pourB = await jouer(commande("v-B", true), "tr-B", outil);
    expect(pourB.statut).toBe("echec");
    expect(pourB.erreur?.code).toBe("CAS_CONCRET_SCRIPT_A_VALIDER");
    expect(appels).toEqual(["ecriture-cas-concret"]);
    expect(lire).not.toHaveBeenCalled();
  });

  it("un script modifié à la relecture pendant que B est en route (sans vidéo d'origine) n'est pas rejoué par B", async () => {
    // Le service réel : l'historique ne contient que des versions modifiées (aucune validée depuis une vidéo).
    await scripts.modifierScriptValideCasConcret(CAS, [{ rang: 1, texteDit: NOUVELLE }]);
    expect((await scripts.historiqueScriptsValides(CAS)).every((x) => x.videoId === undefined)).toBe(true);
    expect(await scripts.scriptValideDeLaVideo(CAS, "v-B")).toBeNull();
    const lire = vi.spyOn(fournisseurVoixSimulation, "lire");
    const travail = await jouer(commande("v-B", true), "tr-ns5");
    expect(travail.statut).toBe("echec");
    expect(travail.erreur?.code).toBe("CAS_CONCRET_SCRIPT_A_VALIDER");
    expect(appels).toEqual(["ecriture-cas-concret"]);
    expect(lire).not.toHaveBeenCalled();
    // Rien n'est retiré : l'historique garde les deux versions.
    expect((await scripts.historiqueScriptsValides(CAS)).map((x) => x.numero)).toEqual([1, 2]);
  });

  it("la recherche réelle : la dernière version validée dont la vidéo d'origine est la bonne", async () => {
    const { v2 } = await deuxVersions();
    expect(await scripts.scriptValideDeLaVideo(CAS, "v-A")).toBeNull();
    const { ecrireParametre } = await import("@/services/_commun");
    const historique = await scripts.historiqueScriptsValides(CAS);
    await ecrireParametre(scripts.CLE_HISTORIQUE_SCRIPTS, { [CAS]: [historique[0], { ...v2, videoId: "v-A" }, { ...historique[2], videoId: "v-B" }, { ...historique[2], numero: 4, videoId: "v-A" }] });
    expect((await scripts.scriptValideDeLaVideo(CAS, "v-A"))?.numero).toBe(4);
    expect((await scripts.scriptValideDeLaVideo(CAS, "v-B"))?.numero).toBe(3);
    expect(await scripts.scriptValideDeLaVideo(CAS, "v-C")).toBeNull();
  });
});

describe("feuille « Votre vidéo » : le choix", () => {
  const rendre = (vue: ReturnType<typeof versVueCas>, avec: boolean) =>
    renderToStaticMarkup(createElement(ContenuVotreVideo, { cas: vue, essai: false, reseaux: ["facebook"], onReseaux: () => undefined, mot: "IA", onMot: () => undefined, avecMot: false, onAvecMot: () => undefined, onValider: () => undefined, ...(avec ? { nouveauScript: false, onNouveauScript: () => undefined } : {}) } as never));

  it("visible seulement pour un cas qui a un script validé", () => {
    const avecScript = versVueCas(cas, empreinteCas(cas), true, apercuDesEcrans(SCRIPT_V4_RECRUTEMENT.ecrans));
    const sansScript = versVueCas(cas, empreinteCas(cas), true);
    expect(rendre(avecScript, true)).toContain(LIBELLE_NOUVEAU_SCRIPT);
    expect(rendre(sansScript, true)).not.toContain(LIBELLE_NOUVEAU_SCRIPT);
    // Sans le geste fourni par l'écran : la feuille est celle d'avant.
    expect(rendre(avecScript, false)).not.toContain(LIBELLE_NOUVEAU_SCRIPT);
  });

  it("« Nouveau script » coché : le script validé n'est plus montré (il n'est pas utilisé pour cette vidéo)", () => {
    const vue = versVueCas(cas, empreinteCas(cas), true, apercuDesEcrans(SCRIPT_V4_RECRUTEMENT.ecrans));
    const rendu = (nouveauScript: boolean) => renderToStaticMarkup(createElement(ContenuVotreVideo, { cas: vue, essai: false, reseaux: ["facebook"], onReseaux: () => undefined, mot: "IA", onMot: () => undefined, avecMot: false, onAvecMot: () => undefined, onValider: () => undefined, nouveauScript, onNouveauScript: () => undefined } as never));
    expect(rendu(false)).toContain("Le script validé, dit mot pour mot");
    expect(rendu(true)).not.toContain("Le script validé, dit mot pour mot");
    expect(rendu(true)).toContain(LIBELLE_NOUVEAU_SCRIPT);
  });

  it("l'entrée lue par le moteur est tolérante : un nombre entier à partir de 1, sinon absente", () => {
    const lire = (v: unknown) => lireEntreesCasConcret({ casConcret: { nouveauScript: v } } as never).nouveauScript;
    expect(lire(1)).toBe(1);
    expect(lire(3)).toBe(3);
    for (const mauvais of [0, -1, 1.5, "1", true, null, undefined]) expect(lire(mauvais)).toBeUndefined();
  });
});
