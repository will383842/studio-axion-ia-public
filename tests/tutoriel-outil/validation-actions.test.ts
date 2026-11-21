/**
 * T-EXT-33 · gestes de l'écran de validation (importés par T-EXT-24). Dépôts en mémoire, aucun appel réel, aucun appel
 * payant, 0 €. Éteint (`tutoriel.formulaire`) : chaque action refuse et rien n'est écrit.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const session = vi.hoisted(() => ({ ouverte: true }));
vi.mock("@/services/auth", () => ({
  exigerSession: vi.fn(async () => {
    if (!session.ouverte) throw new Error("session exigée");
    return {};
  }),
}));

import type { Travail } from "@/domaine/types";
import { ENTREE_DEVIS_TUTORIEL, lireAccordDevis } from "@/moteurs/montage-tutoriel-outil/devis-tutoriel";
import type { RegistreTextes } from "@/moteurs/montage-tutoriel-outil/equipe/registre-textes";
import { VERSION_SCRIPTS, type PropositionScripts } from "@/moteurs/montage-tutoriel-outil/equipe/scenariste";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const a = await import("@/app/(studio)/tutoriel-outil/actions");
const v = await import("@/services/tutoriel-validation");

const LE = "2026-11-19T08:00:00.000Z";
const PHRASES_A = ["Chaque lundi, vous perdez une heure sur vos chiffres.", "Votre tableau se remplit tout seul.", "Vous gagnez une heure par semaine."];
const PHRASES_B = ["Vos chiffres du lundi vous prennent du temps.", "Le tableau se met à jour sans vous.", "Votre semaine commence plus sereinement."];
const version = (id: "A" | "B", phrases: string[]) => ({ id, source: "ecrit" as const, empreinte: `e${id}`, phrases: phrases.map((texte) => ({ texte, temps: "situation" as const, apport: "x" })) });
const PROPOSITION: PropositionScripts = { version: VERSION_SCRIPTS, versions: [version("A", PHRASES_A), version("B", PHRASES_B)] };

async function installer(options: { equipe?: Record<string, unknown> | null; entrees?: Record<string, unknown> } = {}) {
  const equipe = options.equipe === undefined ? { propositionScripts: PROPOSITION, propositions: [{ id: "prop-1", texte: "Un titre proposé par le Studio", etapeId: "e1" }] } : options.equipe;
  await depots().videos.enregistrer({ id: "v1", titre: "Mon tutoriel", formatId: "tutoriel-outil", statut: "en_fabrication", entrees: { tutorielOutil: { fin: "aucune" }, ...options.entrees }, creeLe: LE, modifieLe: LE } as never);
  await depots().versions.enregistrer({ id: "ver1", videoId: "v1", numero: 1, statut: "en_fabrication", commande: { entrees: { tutorielOutil: { fin: "aucune" } } }, creeLe: LE, modifieLe: LE } as never);
  await depots().travaux.enregistrer({
    id: "t1", type: "fabrication", cibleId: "v1", versionId: "ver1", titre: "Mon tutoriel", statut: "en_file", progression: 10, tentatives: 1, cleIdempotence: "k", fournisseurUtilise: "studio",
    etapes: [{ cle: "script", nom: "Script", icone: "x", dependDe: [], statut: "terminee", progression: 100, sortieFichierIds: [] }],
    parametres: { pause: { code: "TO_SCRIPT_A_VALIDER", message: "x" }, tutoriel: { ratios: ["4:5"], rendus: [], reserves: [], proposition: "Texte proposé", ...(equipe === null ? {} : { equipe }) } },
    creeLe: LE, modifieLe: LE,
  } as never);
}
const allumer = () => ecrireParametre("tutoriel.formulaire", true);
const travail = async () => (await depots().travaux.obtenir("t1"))!;
const equipe = async () => (travail().then((t) => (t.parametres as { tutoriel: { equipe: Record<string, any> } }).tutoriel.equipe)); // eslint-disable-line @typescript-eslint/no-explicit-any
const instantane = async () => JSON.stringify([await depots().travaux.lister(), await depots().videos.lister(), await depots().versions.lister()]);

beforeEach(() => {
  reinitialiserDepots();
  session.ouverte = true;
});

describe("éteint : chaque action refuse, rien n'est écrit", () => {
  it("sans l'interrupteur, ou avec \"true\" en chaîne", async () => {
    await installer();
    const avant = await instantane();
    for (const etat of ["absent", "chaine"]) {
      if (etat === "chaine") await ecrireParametre("tutoriel.formulaire", "true");
      const r = [
        await a.choisirVersionAction("v1", "A"),
        await a.corrigerScriptAction("v1", [{ id: "voix-1", dit: "x" }]),
        await a.choisirPropositionAction("v1", "prop-1", true),
        await a.refaireEcrireAction("v1"),
        await a.validerTutorielAction("v1", { empreinteDevis: "abc" }),
      ];
      for (const x of r) expect(x).toMatchObject({ ok: false, message: "Le tutoriel n'est pas encore ouvert : votre demande n'est pas envoyée." });
      expect(await instantane()).toBe(avant);
    }
  });
  it("sans session : refus", async () => {
    await installer();
    await allumer();
    session.ouverte = false;
    expect((await a.choisirVersionAction("v1", "A")).ok).toBe(false);
    expect((await a.validerTutorielAction("v1")).ok).toBe(false);
  });
});

describe("sans la forme de l'équipe : « Rien à valider pour l'instant », rien n'est écrit", () => {
  it.each([[null], [{}], [{ autre: 1 }]])("équipe %j", async (eq) => {
    await installer({ equipe: eq as never });
    await allumer();
    const avant = await instantane();
    const r = [
      await a.choisirVersionAction("v1", "A"),
      await a.corrigerScriptAction("v1", []),
      await a.choisirPropositionAction("v1", "prop-1", true),
      await a.refaireEcrireAction("v1"),
      await a.validerTutorielAction("v1", { empreinteDevis: "abc" }),
    ];
    for (const x of r) expect(x).toEqual({ ok: true, donnees: { statut: "refusee", phrase: "Rien à valider pour l'instant." } });
    expect(await instantane()).toBe(avant);
  });
  it("vidéo sans fabrication : même phrase", async () => {
    await allumer();
    expect(await a.choisirVersionAction("inconnue", "A")).toEqual({ ok: true, donnees: { statut: "refusee", phrase: "Rien à valider pour l'instant." } });
  });
});

describe("seulement en pause de validation du script", () => {
  const cas: [string, Record<string, unknown>][] = [
    ["termine", { statut: "termine" }],
    ["echec", { statut: "echec" }],
    ["annule", { statut: "annule" }],
    ["en_file sans pause", { statut: "en_file", sansPause: true }],
    ["en_file, autre code de pause", { statut: "en_file", code: "TO_SCRIPT_ABSENT" }],
    ["en_cours sans pause", { statut: "en_cours", sansPause: true }],
    ["en_cours, autre code de pause", { statut: "en_cours", code: "TO_SCRIPT_ABSENT" }],
  ];
  for (const [nom, mod] of cas) {
    it(`${nom} : les 5 gestes refusent, rien n'est écrit`, async () => {
      await installer();
      await allumer();
      const t = await travail();
      const { pause: _p, ...sansPause } = t.parametres ?? {};
      void _p;
      const parametres = mod.sansPause ? sansPause : mod.code ? { ...sansPause, pause: { code: mod.code, message: "x" } } : t.parametres;
      await depots().travaux.modifier("t1", { statut: mod.statut as never, parametres });
      const avant = await instantane();
      const r = [
        await a.choisirVersionAction("v1", "A"),
        await a.corrigerScriptAction("v1", [{ id: "voix-1", dit: "Autre" }]),
        await a.choisirPropositionAction("v1", "prop-1", true),
        await a.refaireEcrireAction("v1"),
        await a.validerTutorielAction("v1", { empreinteDevis: "abc" }),
      ];
      for (const x of r) expect(x).toEqual({ ok: true, donnees: { statut: "refusee", phrase: "Rien à valider pour l'instant." } });
      expect(await instantane()).toBe(avant);
    });
  }
});

describe("choisir, corriger, valider", () => {
  it("valider sans version choisie : refus, rien d'écrit", async () => {
    await installer();
    await allumer();
    const avant = await instantane();
    expect(await a.validerTutorielAction("v1", { empreinteDevis: "abc" })).toEqual({ ok: true, donnees: { statut: "refusee", phrase: "Choisissez d'abord une version du script." } });
    expect(await instantane()).toBe(avant);
  });
  it("choisir B puis valider : registre figé, le texte B est repris par la fabrication", async () => {
    await installer();
    await allumer();
    expect((await a.choisirVersionAction("v1", "B")).ok).toBe(true);
    expect((await equipe()).scriptChoisi.texte).toBe(PHRASES_B.join(" "));
    expect((await equipe()).registre.fige).toBeUndefined();
    const r = await a.validerTutorielAction("v1");
    expect(r).toMatchObject({ ok: true, donnees: { statut: "ok" } });
    const t = await travail();
    const reg = (await equipe()).registre as RegistreTextes;
    expect(reg.fige?.empreinte).toBeTruthy();
    expect(reg.entrees.filter((e) => e.ou === "voix").map((e) => e.texte)).toEqual(PHRASES_B);
    expect(t.statut).toBe("en_cours");
    expect(t.parametres).not.toHaveProperty("pause");
    const etat = (t.parametres as { tutoriel: { script: { texte: string; source: string }; proposition?: string } }).tutoriel;
    expect(etat.script).toMatchObject({ texte: PHRASES_B.join(" "), source: "valide" });
    expect(etat.proposition).toBeUndefined();
  });
  it("choisir A : le texte A ; une version inconnue est refusée", async () => {
    await installer();
    await allumer();
    expect((await a.choisirVersionAction("v1", "C" as never)).ok && true).toBe(true);
    expect(await a.choisirVersionAction("v1", "C" as never)).toMatchObject({ ok: true, donnees: { statut: "refusee" } });
    expect((await equipe()).scriptChoisi).toBeUndefined();
    await a.choisirVersionAction("v1", "A");
    expect((await equipe()).scriptChoisi.texte).toBe(PHRASES_A.join(" "));
  });
  it("correction : seules les différences sont gardées, le reste mot pour mot, le texte de Williams n'est pas réécrit", async () => {
    await installer();
    await allumer();
    await a.choisirVersionAction("v1", "A");
    const texteWilliams = "Chaque lundi,  vous gagnez UNE heure !";
    const r = await a.corrigerScriptAction("v1", [{ id: "voix-1", dit: texteWilliams }, { id: "voix-9", dit: "ignorée" }, { id: "inconnue", dit: "ignorée" }]);
    expect(r).toMatchObject({ ok: true, donnees: { statut: "ok" } });
    const sc = (await equipe()).scriptChoisi;
    expect(sc.phrases.map((p: { texte: string }) => p.texte)).toEqual([texteWilliams, PHRASES_A[1], PHRASES_A[2]]);
    expect(sc.source).toBe("corrige");
    expect(sc.phrases[0].aRevoir).toBe(true);
    expect(sc.phrases[1].aRevoir).toBe(false);
    const reg = (await equipe()).registre as RegistreTextes;
    expect(reg.entrees.filter((e) => e.ou === "voix").map((e) => [e.texte, e.origine])).toEqual([[texteWilliams, "script-corrige"], [PHRASES_A[1], "script-corrige"], [PHRASES_A[2], "script-corrige"]]);
  });
  it("correction sans effet (identique, vide, trop longue, sans version) : refus, rien d'écrit", async () => {
    await installer();
    await allumer();
    expect(await a.corrigerScriptAction("v1", [{ id: "voix-1", dit: "x" }])).toMatchObject({ ok: true, donnees: { statut: "refusee", phrase: "Choisissez d'abord une version du script." } });
    await a.choisirVersionAction("v1", "A");
    const avant = await instantane();
    for (const diffs of [[], [{ id: "voix-1", dit: PHRASES_A[0] }], [{ id: "voix-1", dit: "   " }], [{ id: "voix-1", dit: "a".repeat(601) }], "pas une liste" as never]) {
      expect(await a.corrigerScriptAction("v1", diffs)).toMatchObject({ ok: true, donnees: { statut: "refusee" } });
    }
    expect(await instantane()).toBe(avant);
  });
  it("propositions : cochées par Williams seulement, et gardées quand le script est corrigé", async () => {
    await installer();
    await allumer();
    await a.choisirVersionAction("v1", "A");
    let reg = (await equipe()).registre as RegistreTextes;
    expect(reg.entrees.find((e) => e.id === "prop-1")?.choisi).toBe(false);
    expect((await a.choisirPropositionAction("v1", "prop-1", true)).ok).toBe(true);
    reg = (await equipe()).registre as RegistreTextes;
    expect(reg.entrees.find((e) => e.id === "prop-1")?.choisi).toBe(true);
    expect(await a.choisirPropositionAction("v1", "voix-1", true)).toMatchObject({ ok: true, donnees: { statut: "refusee" } });
    await a.corrigerScriptAction("v1", [{ id: "voix-2", dit: "Votre tableau se remplit sans vous." }]);
    expect(((await equipe()).registre as RegistreTextes).entrees.find((e) => e.id === "prop-1")?.choisi).toBe(true);
  });
  it("registre déjà figé puis correction : nouveau registre (non figé), nouvelle validation exigée ; proposition refusée tant qu'il est figé", async () => {
    await installer();
    await allumer();
    await a.choisirVersionAction("v1", "A");
    await a.validerTutorielAction("v1");
    // AUTORISATION PERMANENTE (c) : la validation reprend la fabrication (en_cours) ; on remet la pause de validation pour mesurer la même chose
    await depots().travaux.modifier("t1", { statut: "en_file", parametres: { ...(await travail()).parametres, pause: { code: "TO_SCRIPT_A_VALIDER", message: "x" } } });
    const figeAvant = ((await equipe()).registre as RegistreTextes).fige?.empreinte;
    expect(figeAvant).toBeTruthy();
    expect(await a.choisirPropositionAction("v1", "prop-1", true)).toMatchObject({ ok: true, donnees: { statut: "refusee", phrase: "Le texte est déjà validé : choisissez ou corrigez à nouveau, puis validez de nouveau." } });
    await a.corrigerScriptAction("v1", [{ id: "voix-3", dit: "Vous gagnez enfin une heure." }]);
    const reg = (await equipe()).registre as RegistreTextes;
    expect(reg.fige).toBeUndefined();
    await a.validerTutorielAction("v1");
    const apres = ((await equipe()).registre as RegistreTextes).fige?.empreinte;
    expect(apres).toBeTruthy();
    expect(apres).not.toBe(figeAvant);
  });
  it("refaire écrire : l'étape du script repasse en attente, plus de script choisi ni de registre, aucune dépense", async () => {
    await installer();
    await allumer();
    await a.choisirVersionAction("v1", "A");
    const depensesAvant = (await depots().depenses.lister()).length;
    const r = await a.refaireEcrireAction("v1");
    expect(r).toMatchObject({ ok: true, donnees: { statut: "ok" } });
    const t = await travail();
    expect(t.etapes.find((e) => e.cle === "script")).toMatchObject({ statut: "en_attente", progression: 0 });
    expect(t.statut).toBe("en_file");
    expect(t.parametres).not.toHaveProperty("pause");
    const eq = await equipe();
    expect(eq.scriptChoisi).toBeUndefined();
    expect(eq.registre).toBeUndefined();
    expect(eq.propositionScripts).toBeTruthy();
    expect((await depots().depenses.lister()).length).toBe(depensesAvant);
  });
});

describe("l'accord du devis est écrit par la validation", () => {
  it("empreinteDevis : tutorielOutilDevis { empreinte, le } dans la vidéo ET dans la version, lisible par lireAccordDevis", async () => {
    await installer();
    await allumer();
    await a.choisirVersionAction("v1", "A");
    expect((await a.validerTutorielAction("v1", { empreinteDevis: " abc123 " })).ok).toBe(true);
    const video = (await depots().videos.obtenir("v1"))!;
    const ver = (await depots().versions.obtenir("ver1"))!;
    expect(ENTREE_DEVIS_TUTORIEL).toBe("tutorielOutilDevis");
    for (const entrees of [video.entrees, ver.commande.entrees]) {
      const accord = lireAccordDevis(entrees as Record<string, unknown>);
      expect(accord?.empreinte).toBe("abc123");
      expect(accord?.le).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(Object.keys((entrees as Record<string, unknown>).tutorielOutilDevis as object).sort()).toEqual(["empreinte", "le"]);
    }
    expect((video.entrees as Record<string, unknown>).tutorielOutil).toEqual({ fin: "aucune" });
    expect((ver.commande.entrees as Record<string, unknown>).tutorielOutil).toEqual({ fin: "aucune" });
  });
  it("sans empreinte : aucune entrée de devis ; empreinte invalide : refus, rien d'écrit", async () => {
    await installer();
    await allumer();
    await a.choisirVersionAction("v1", "A");
    const avant = await instantane();
    for (const empreinteDevis of ["", "   ", 5 as never, "x".repeat(201)]) {
      expect(await a.validerTutorielAction("v1", { empreinteDevis })).toMatchObject({ ok: true, donnees: { statut: "refusee" } });
    }
    expect(await instantane()).toBe(avant);
    expect((await a.validerTutorielAction("v1")).ok).toBe(true);
    expect((await depots().videos.obtenir("v1"))!.entrees).not.toHaveProperty("tutorielOutilDevis");
    expect((await depots().versions.obtenir("ver1"))!.commande.entrees).not.toHaveProperty("tutorielOutilDevis");
  });
});

describe("0 € et conformité", () => {
  it("aucune dépense, aucun fetch, aucun mot de prix dans les phrases rendues", async () => {
    const fetchRefuse = vi.fn(() => {
      throw new Error("fetch interdit dans ce test");
    });
    vi.stubGlobal("fetch", fetchRefuse);
    try {
      await installer();
      await allumer();
      const depensesAvant = (await depots().depenses.lister()).length;
      const sorties = [
        await a.choisirVersionAction("v1", "A"),
        await a.corrigerScriptAction("v1", [{ id: "voix-1", dit: "Une phrase de Williams." }]),
        await a.choisirPropositionAction("v1", "prop-1", true),
        await a.refaireEcrireAction("v1"),
        await a.choisirVersionAction("v1", "B"),
        await a.validerTutorielAction("v1", { empreinteDevis: "abc" }),
      ];
      expect(JSON.stringify(sorties)).not.toMatch(/€|euros?\b|\bprix\b|\bco[ûu]ts?\b/i);
      expect((await depots().depenses.lister()).length).toBe(depensesAvant);
      expect(fetchRefuse).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("les noms des actions sont ceux fixés par la fiche (T-EXT-24 les importe)", () => {
    for (const nom of ["deposerTutorielAction", "choisirVersionAction", "corrigerScriptAction", "choisirPropositionAction", "refaireEcrireAction", "validerTutorielAction"]) expect(typeof (a as Record<string, unknown>)[nom]).toBe("function");
    expect(typeof v.lignesDuScript).toBe("function");
  });
  it("chaque action commence par la garde exigerTutorielAllume (lecture du fichier)", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/app/(studio)/tutoriel-outil/actions.ts", "utf8");
    expect(src.match(/await exigerTutorielAllume\(\)/g)).toHaveLength(2);
    expect(src).toMatch(/async function geste/);
    for (const nom of ["choisirVersionAction", "corrigerScriptAction", "choisirPropositionAction", "refaireEcrireAction", "validerTutorielAction"]) {
      expect(src).toMatch(new RegExp(`export async function ${nom}\\([^\\n]*\\{\\n  return geste\\(`));
    }
  });
});

describe("par la vraie boucle (lireTravauxAAvancer + moteur.avancer + ecrireAvancement)", () => {
  it("la pause de validation est enregistrée « en_cours » (jamais remise « en_file ») : les gestes agissent et la validation passe", async () => {
    const { lireTravauxAAvancer, ecrireAvancement } = await import("@/services/travaux");
    await installer();
    await allumer();
    // Départ réel : le travail est en file, sans pause ; le moteur rend, comme le vrai (index.ts), `en_file` + la pause du script.
    const t0 = await travail();
    const { pause: _p, ...sansPause } = t0.parametres ?? {};
    void _p;
    await depots().travaux.modifier("t1", { parametres: sansPause });
    const { creerMoteurTutorielOutil } = await import("@/moteurs/montage-tutoriel-outil");
    const moteur = {
      ...creerMoteurTutorielOutil({ outils: async () => { throw new Error("aucun outil : le moteur est doublé"); } }),
      avancer: async (t: Travail) => ({ travail: { ...t, statut: "en_file" as const, parametres: { ...t.parametres, pause: { code: "TO_SCRIPT_A_VALIDER", message: "x" } } } }),
    };
    for (const lu of await lireTravauxAAvancer(Date.now(), () => moteur as never)) await ecrireAvancement(lu, await moteur.avancer(lu.travail));
    const enPause = await travail();
    expect(enPause.statut).toBe("en_cours");
    expect((enPause.parametres?.pause as { code: string }).code).toBe("TO_SCRIPT_A_VALIDER");
    expect(await a.choisirVersionAction("v1", "A")).toEqual({ ok: true, donnees: { statut: "ok", phrase: expect.any(String) } });
    const r = await a.validerTutorielAction("v1", { empreinteDevis: "abc" });
    expect(r).toMatchObject({ ok: true, donnees: { statut: "ok" } });
    expect((await travail()).parametres?.pause).toBeUndefined();
  }, 30_000);
});
