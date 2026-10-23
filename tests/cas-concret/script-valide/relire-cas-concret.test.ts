/**
 * BRIQUE 3 · RELIRE ET MODIFIER LE SCRIPT DU CAS CONCRET AVANT LA VIDÉO (demande de Will). Base en mémoire, lancement et
 * fabrication simulés : aucun appel réseau, rien de payé.
 *
 * - Un script DÉJÀ validé se relit et se modifie avant le lancement : chaque modification crée une NOUVELLE version
 *   validée (historique), jamais une modification en place ; le script du catalogue « recrutement-apporteurs » reste tel
 *   quel. La fabrication utilise la nouvelle version (pas de blocage « validé pour une ancienne version »).
 * - Le lancement de Will exige le repère « script relu » (empreinte du texte relu) ; il est gardé dans les entrées, que les
 *   relances reprennent telles quelles.
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
const service = await import("@/services/cas-concret");
const { construireCommande } = await import("@/services/fabrication");
await import("@/services/videos");
const { apercuDesEcrans, scriptValideDuCatalogue } = await import("@/moteurs/montage-cas-concret/script-valide");
const { lignesDesEcrans, modificationsDesDifferences, rangDeLigne } = await import("@/moteurs/montage-cas-concret/relecture");
const { appliquerSaisie, differences, empreinte } = await import("@/domaine/relecture-script");
const { SCRIPT_V4_RECRUTEMENT } = await import("@/moteurs/montage-cas-concret/scripts-valides/recrutement-apporteurs");

import type { CommandeFabrication, Travail } from "@/domaine/types";

const MDP = "relire-cas-concret";
const CAS = "recrutement-apporteurs";
const RESEAUX = ["facebook", "instagram", "tiktok", "linkedin"];
const COPIE_CATALOGUE = structuredClone(SCRIPT_V4_RECRUTEMENT);
const NOUVELLE = "On recrute nos collaborateurs sans";

const lignesCatalogue = () => lignesDesEcrans(apercuDesEcrans(scriptValideDuCatalogue(CAS)!.ecrans));

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

describe("adaptateur : une ligne par écran, le chiffre tiré d'un fait verrouillé", () => {
  it("lignes e01…, groupes par type d'écran, « 15 minutes » non modifiable", () => {
    const lignes = lignesCatalogue();
    expect(lignes[0]).toMatchObject({ id: "e01", groupe: "Accroche", dit: "Nos collaborateurs, on les recrute en" });
    const chiffre = lignes[1];
    expect(chiffre.groupe).toBe("Chiffre");
    expect(chiffre.ecrits?.[0]).toEqual({ texte: "15 minutes", modifiable: false });
    expect(chiffre.ecrits?.slice(1).every((e) => e.modifiable)).toBe(true);
    // Une frappe sur le chiffre ne change rien ; sur une pastille, oui.
    expect(appliquerSaisie(lignes, "e02", { ecrit: { index: 0, texte: "5 minutes" } })).toEqual(lignes);
    expect(appliquerSaisie(lignes, "e02", { ecrit: { index: 1, texte: "0 CV" } })[1].ecrits?.[1].texte).toBe("0 CV");
  });

  it("les différences reviennent en modifications par rang", () => {
    const avant = lignesCatalogue();
    const apres = appliquerSaisie(appliquerSaisie(avant, "e01", { dit: NOUVELLE }), "e02", { ecrit: { index: 2, texte: "Aucune relance" } });
    expect(modificationsDesDifferences(differences(avant, apres))).toEqual([
      { rang: 1, texteDit: NOUVELLE },
      { rang: 2, ecrits: [null, null, "Aucune relance", null] },
    ]);
    expect(rangDeLigne("e12")).toBe(12);
    expect(rangDeLigne("p3")).toBeNull();
  });
});

describe("script déjà validé : une modification crée une NOUVELLE version", () => {
  it("version 2 gardée, version 1 (catalogue) à l'historique ; la même modification ne crée rien de plus", async () => {
    const r = await scripts.modifierScriptValideCasConcret(CAS, [{ rang: 1, texteDit: NOUVELLE }], { maintenant: Date.UTC(2026, 9, 15) });
    expect(r).toMatchObject({ casId: CAS, numero: 2, modifie: true });
    const courant = (await scripts.scriptValideDuStudio(CAS))!;
    expect(courant).toMatchObject({ numero: 2, remplace: 1, versionCas: 2, valideLe: "2026-10-15" });
    expect(courant.ecrans[0].texteDit).toBe(NOUVELLE);
    expect(r.empreinte).toBe(scripts.empreinteScriptValide(courant));
    const historique = await scripts.historiqueScriptsValides(CAS);
    expect(historique.map((s) => s.numero)).toEqual([1, 2]);
    expect(historique[0].ecrans).toEqual(COPIE_CATALOGUE.ecrans);
    // Rejouée (prix redemandé, double clic) : même texte, aucune version de plus.
    const encore = await scripts.modifierScriptValideCasConcret(CAS, [{ rang: 1, texteDit: NOUVELLE }]);
    expect(encore).toMatchObject({ numero: 2, modifie: false, empreinte: r.empreinte });
    expect((await scripts.historiqueScriptsValides(CAS)).map((s) => s.numero)).toEqual([1, 2]);
  });

  it("une deuxième modification : version 3 ; les versions 1 et 2 restent intactes", async () => {
    await scripts.modifierScriptValideCasConcret(CAS, [{ rang: 1, texteDit: NOUVELLE }]);
    const v2 = structuredClone((await scripts.historiqueScriptsValides(CAS))[1]);
    await scripts.modifierScriptValideCasConcret(CAS, [{ rang: 2, ecrits: [null, null, "Aucune relance", null] }]);
    const h = await scripts.historiqueScriptsValides(CAS);
    expect(h.map((s) => [s.numero, s.remplace])).toEqual([
      [1, undefined],
      [2, 1],
      [3, 2],
    ]);
    expect(h[1]).toEqual(v2);
    expect(h[2].ecrans[0].texteDit).toBe(NOUVELLE);
  });

  it("refus : chiffre tiré d'un fait, phrase vide, contrôles ; rien n'est gardé", async () => {
    await expect(scripts.modifierScriptValideCasConcret(CAS, [{ rang: 2, ecrits: ["5 minutes", null, null, null] }])).rejects.toThrow(/vient d'un fait du cas/);
    await expect(scripts.modifierScriptValideCasConcret(CAS, [{ rang: 1, texteDit: "  " }])).rejects.toThrow(/ne peut pas être vide/);
    const trop = Array.from({ length: 60 }, () => "vraiment").join(" ");
    await expect(scripts.modifierScriptValideCasConcret(CAS, [{ rang: 1, texteDit: trop }])).rejects.toThrow(/ne passe pas les contrôles/);
    expect(await scripts.historiqueScriptsValides(CAS)).toEqual([]);
    expect(await scripts.scriptValideDuStudio(CAS)).toEqual(SCRIPT_V4_RECRUTEMENT);
  });

  it("contrôle gratuit pendant la relecture : rien sans modification, la ligne fautive est désignée, rien n'est écrit", async () => {
    expect(await scripts.controlerScriptValideCasConcret(CAS, [])).toEqual([]);
    expect(await scripts.controlerScriptValideCasConcret(CAS, [{ rang: 1, texteDit: NOUVELLE }])).toEqual([]);
    const trop = Array.from({ length: 60 }, () => "vraiment").join(" ");
    const p = await scripts.controlerScriptValideCasConcret(CAS, [{ rang: 1, texteDit: trop }]);
    expect(p.length).toBeGreaterThan(0);
    expect(p.every((x) => x.niveau === "bloquant")).toBe(true);
    expect(p.some((x) => x.ligneId === "e01")).toBe(true);
    expect(await scripts.historiqueScriptsValides(CAS)).toEqual([]);
  });
});

describe("lancement : repère « script relu » exigé côté serveur", () => {
  let n = 0;
  const lancer = vi.fn(async () => ({ travailId: `t-relu-${++n}` }));
  const demande = (o: Partial<Parameters<typeof service.preparerEtLancer>[0]> = {}) => ({ casId: CAS, reseaux: RESEAUX, mot: "IA", avecMot: false, accordCentimes: 10_000, ...o });

  it("sans repère, ou avec celui d'un autre texte : refus en phrase, aucune vidéo créée", async () => {
    expect(await service.preparerEtLancer(demande(), { lancer })).toEqual({ statut: "refusee", phrase: scripts.PHRASE_SCRIPT_NON_RELU });
    expect(await service.preparerEtLancer(demande({ empreinteScriptRelu: "relu-0000" }), { lancer })).toEqual({ statut: "refusee", phrase: scripts.PHRASE_SCRIPT_CHANGE });
    expect(await depots().videos.lister((v) => v.formatId === "cas-concret")).toHaveLength(0);
    expect(lancer).not.toHaveBeenCalled();
  });

  it("avec l'empreinte du texte relu : lancé, repère gardé dans les entrées et dans la commande (relances)", async () => {
    const relu = empreinte(lignesCatalogue());
    expect(relu).toBe(scripts.empreinteScriptValide(SCRIPT_V4_RECRUTEMENT));
    const r = await service.preparerEtLancer(demande({ empreinteScriptRelu: relu }), { lancer });
    expect(r.statut).toBe("lancee");
    const [v] = await depots().videos.lister((x) => x.formatId === "cas-concret");
    expect((v.entrees as { casConcret: Record<string, unknown> }).casConcret.scriptRelu).toBe(relu);
    const c = await construireCommande(v.id);
    expect((c.entrees as { casConcret: Record<string, unknown> }).casConcret.scriptRelu).toBe(relu);
  });

  it("un cas sans script validé : aucun repère exigé (la fabrication s'arrêtera « à relire » avant la voix)", async () => {
    const r = await service.preparerEtLancer({ casId: "rappels-rendez-vous", reseaux: RESEAUX, mot: "IA", avecMot: false, accordCentimes: 10_000, essai: true }, { lancer });
    expect(r.statut).toBe("lancee");
  });

  it("après modification : l'ancien repère est refusé, le nouveau accepté", async () => {
    const ancien = scripts.empreinteScriptValide(SCRIPT_V4_RECRUTEMENT);
    const m = await scripts.modifierScriptValideCasConcret(CAS, [{ rang: 1, texteDit: NOUVELLE }]);
    expect(await service.preparerEtLancer(demande({ empreinteScriptRelu: ancien }), { lancer })).toEqual({ statut: "refusee", phrase: scripts.PHRASE_SCRIPT_CHANGE });
    expect((await service.preparerEtLancer(demande({ empreinteScriptRelu: m.empreinte }), { lancer })).statut).toBe("lancee");
  });

  it("l'empreinte calculée par l'écran sur les lignes relues est celle que le serveur rend après modification", async () => {
    const avant = lignesCatalogue();
    const apres = appliquerSaisie(avant, "e01", { dit: NOUVELLE });
    const m = await scripts.modifierScriptValideCasConcret(CAS, modificationsDesDifferences(differences(avant, apres)));
    expect(m.empreinte).toBe(empreinte(apres));
  });
});

describe("de bout en bout : modifié, la fabrication utilise la NOUVELLE version", () => {
  function commande(): CommandeFabrication {
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
      distribution: [{ role: "voix", source: "double", personnageId: "p-clara", fournisseurVoix: "simulation", voixId: "voix-clara" }],
      styles: { sousTitres: null, decor: null, lut: null, musique: null },
      briques: { "sous-titres": true, etalonnage: false, illustrations: true, son: true, habillage: false, "texte-ecran": false, "mention-ia": false },
      entrees: { casConcret: { casId: CAS, porte: "porte-a", mot: "IA", avecMot: false, reseaux: RESEAUX, essai: true, codeSuivi: `cc-${CAS}-abc123` } },
      reglages: {},
      plans: [],
      prononciations: [],
      mentionIA: { incrustee: false, position: "haut-droite", dureeSec: 0, texte: "", dansLegende: false },
      budgetMax: { centimes: 0, devise: "EUR" },
      construiteLe: "2026-10-15T09:00:00.000Z",
    } as unknown as CommandeFabrication;
  }

  it("relu, modifié, lancé : la voix dit le texte modifié, sans écriture ni arrêt", async () => {
    const lire = vi.spyOn(fournisseurVoixSimulation, "lire");
    const ecritures: string[] = [];
    let t = 0;
    const moteur = creerMoteurMontageCasConcret({
      outils: (c, travailId) =>
        b.outilsCasConcret(c, travailId, {
          numeroVersion: async () => 42,
          rendu: { service: creerServiceRenduSimule(() => (t += 60_000)), simule: true },
          attendre: async () => {},
          claudeActif: async () => false,
          executer: async (_v, role) => {
            ecritures.push(role.id);
            return { ok: false, simule: true, texte: "" } as never;
          },
        }),
    });
    const avant = lignesCatalogue();
    const apres = appliquerSaisie(avant, "e01", { dit: NOUVELLE });
    await scripts.modifierScriptValideCasConcret(CAS, modificationsDesDifferences(differences(avant, apres)));
    const c = commande();
    let travail: Travail = await moteur.lancer(c, { travailId: "tr-relu", versionId: "ver-relu", titre: "Essai" } as never);
    for (let i = 0; i < 400 && travail.statut !== "termine" && travail.statut !== "echec"; i++) travail = (await moteur.avancer(travail, c)).travail;
    expect(travail.erreur?.messagePourWill).toBeUndefined();
    expect(travail.statut).toBe("termine");
    expect(ecritures).toEqual([]);
    expect(String(lire.mock.calls[0][0].texte)).toContain(NOUVELLE);
  });
});
