/**
 * Service du générateur de scripts du tableau animé, avec un CLIENT SIMULÉ (aucun réseau, `fetch` interdit) :
 * trois appels enchaînés, une seule relance, refus propre, estimation sans appel, trace seule en cas de refus.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";
import type { RequeteClaude, ReponseClaude } from "@/fournisseurs/claude/client";
import { CRITERES_GRILLE, QUESTIONS_IA, type AngleScript, type EcritureScript, type RelectureScript } from "@/domaine/scripts-tableau";
import { controlerEcriture } from "@/domaine/scripts-tableau-controles";
import { DEMANDE_MODELE, ecritureModele } from "./modele-valide";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const service = await import("@/services/tableau-scripts");
const { SCRIPT_TEMOIN } = await import("@/services/tableau-scripts/consignes");

const MDP = "tableau-scripts-service";
const JETONS = { entree: 1000, cacheLu: 0, cacheEcrit: 2000, sortie: 3000 };

const ANGLE: AngleScript = {
  angle: "Comment apprend-on vraiment à se servir de l'IA ?",
  douleur: "Des réponses plates qu'il faut tout réécrire.",
  accroches: [
    { type: "situation-vecue", dit: "Vous avez essayé l'IA trois fois.", ecran: "Essayé trois fois", pourquoi: "Tout le monde l'a vécu." },
    { type: "idee-recue-contredite", dit: "L'IA n'est pas un moteur de recherche.", ecran: "Pas un moteur", pourquoi: "Contredit une croyance." },
    { type: "chiffre-vrai", dit: "Cinq jours suffisent.", ecran: "Cinq jours", pourquoi: "Chiffre de la méthode, pas une statistique." },
    { type: "erreur-frequente", dit: "Vous changez de tâche chaque jour.", ecran: "Une tâche à la fois", pourquoi: "Erreur courante." },
    { type: "promesse-precise", dit: "Un modèle gardé en cinq jours.", ecran: "Un modèle gardé", pourquoi: "Promesse concrète." },
  ],
  retenue: 0,
  raison: "Elle fait dire « c'est moi » en moins de trois secondes.",
};

/** Sortie de la relecture : au plus 3 phrases corrigées, et la grille du texte corrigé. */
function relecture(e: EcritureScript, faux: string[] = [], corrections: RelectureScript["corrections"] = []): RelectureScript {
  return { corrections, grille: CRITERES_GRILLE.map((c) => ({ critere: c.id, respecte: !faux.includes(c.id), remarque: "" })), faiblesses: [], affirmations: e.affirmations, manques: [] };
}

function ecritureFautive(): EcritureScript {
  const e = ecritureModele();
  e.script.accroche[0].dit = "Bonjour à tous, ce devis collé dans ChatGPT contient trois données de trop.";
  return e;
}

/** Client simulé : rend les réponses dans l'ordre et garde les requêtes. */
function clientSimule(sorties: unknown[], modele = "claude-opus-5-5") {
  const requetes: RequeteClaude[] = [];
  return {
    requetes,
    client: {
      simule: true,
      async appeler(r: RequeteClaude): Promise<ReponseClaude> {
        requetes.push(r);
        const s = sorties.shift();
        if (s === undefined) throw new Error("Appel de trop.");
        return { texte: JSON.stringify(s), modeleDemande: r.modele, modele, replis: [], stopReason: "end_turn", jetons: { ...JETONS } };
      },
    },
  };
}

async function compterTout(): Promise<Record<string, number>> {
  const d = depots() as unknown as Record<string, { compter(): Promise<number> }>;
  const r: Record<string, number> = {};
  for (const k of Object.keys(d)) r[k] = await d[k].compter();
  return r;
}

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  vi.stubGlobal("fetch", async () => {
    throw new Error("réseau interdit dans les tests");
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("trois appels enchaînés", () => {
  it("livre le script après angle, écriture et relecture, avec Opus et l'exemple validé en témoin", async () => {
    const { client, requetes } = clientSimule([ANGLE, ecritureModele(), relecture(ecritureModele())]);
    const r = await service.genererScriptTableau(DEMANDE_MODELE, { client });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.appels).toBe(3);
    expect(requetes.map((q) => q.modele)).toEqual(["claude-opus-5-5", "claude-opus-5-5", "claude-opus-5-5"]);
    expect(requetes.every((q) => q.schema)).toBe(true);
    expect(requetes[0].systeme.map((b) => b.texte).join("\n")).toMatch(/PASSE 1 SUR 3/);
    expect(requetes[1].systeme.map((b) => b.texte).join("\n")).toContain(SCRIPT_TEMOIN);
    expect(requetes[1].systeme.map((b) => b.texte).join("\n")).toMatch(/catastrophique/);
    expect(requetes[2].systeme.map((b) => b.texte).join("\n")).toMatch(/SPECTATEUR PRESSÉ/);
    expect(r.resultat.note).toBe(10);
    expect(r.resultat.accroches).toHaveLength(5);
    expect(r.resultat.aPreparer.some((x) => /appel de diagnostic/.test(x))).toBe(true);
    // Les parties nommées, pour le découpage : dans l'ordre, et le texte dit exact quand on les met bout à bout.
    expect(r.resultat.parties?.map((x) => x.partie)).toEqual(["accroche", "douleur", "solution", "etape", "etape", "etape", "exemple", "a-retenir", "appel"]);
    expect(r.resultat).toMatchObject({ idee: ecritureModele().idee, gain: ecritureModele().gain, metierExemple: "cabinet comptable" });
    expect(r.resultat.parties?.map((x) => x.texte).join(" ")).toBe(service.versTexteDit(r.resultat.script));
    expect(r.resultat.affirmations?.length).toBeGreaterThan(0);
    // Coût réel : trois appels de 1 000 + 2 000 en cache + 3 000 en sortie, au tarif d'Opus 5.5.
    expect(r.coutUsd).toBeCloseTo(3 * ((1000 * 4 + 2000 * 5 + 3000 * 20) / 1_000_000), 6);
    const traces = await depots().tracesScriptsTableau.lister();
    expect(traces).toHaveLength(1);
    expect(traces[0]).toMatchObject({ issue: "livre", note: 10, simule: true });
    expect(traces[0].versions.map((v) => v.passe)).toEqual(["ecriture", "relecture"]);
  });

  it("coupe à 60 caractères un métier plus long au lieu de refuser la génération", async () => {
    const e = ecritureModele();
    e.metierExemple = "m".repeat(61);
    const { client } = clientSimule([ANGLE, e, relecture(e)]);
    const r = await service.genererScriptTableau(DEMANDE_MODELE, { client });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.resultat.metierExemple).toBe("m".repeat(60));
  });

  it("refuse un client qui répond avec Haiku", async () => {
    const { client } = clientSimule([ANGLE], "claude-haiku-4-5");
    const r = await service.genererScriptTableau(DEMANDE_MODELE, { client });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motifs.join(" ")).toMatch(/jamais Haiku/);
  });
});

describe("une seule relance", () => {
  it("relance l'écriture avec la liste précise des défauts, puis livre", async () => {
    const { client, requetes } = clientSimule([ANGLE, ecritureFautive(), ecritureModele(), relecture(ecritureModele())]);
    const r = await service.genererScriptTableau(DEMANDE_MODELE, { client });
    expect(r.ok).toBe(true);
    expect(r.appels).toBe(4);
    const relance = requetes[2].messages[0].contenu;
    expect(relance).toMatch(/<defauts_a_corriger>/);
    expect(relance).toMatch(/L'accroche salue/);
    const trace = (await depots().tracesScriptsTableau.lister())[0];
    expect(trace.versions.map((v) => v.passe)).toEqual(["ecriture", "relance", "relecture"]);
  });

  it("ne relance qu'une fois : deuxième échec → refus expliqué, sans relecture", async () => {
    const { client, requetes } = clientSimule([ANGLE, ecritureFautive(), ecritureFautive(), relecture(ecritureModele())]);
    const r = await service.genererScriptTableau(DEMANDE_MODELE, { client });
    expect(r.ok).toBe(false);
    expect(requetes).toHaveLength(3);
    if (!r.ok) {
      expect(r.motifs[0]).toMatch(/Après une relance/);
      expect(r.motifs.join(" ")).toMatch(/L'accroche salue/);
    }
  });
});

describe("refus propres", () => {
  it("refuse une note sous 8 ou un critère éliminatoire échoué", async () => {
    const { client } = clientSimule([ANGLE, ecritureModele(), relecture(ecritureModele(), ["gain", "verite", "cadre"])]);
    const r = await service.genererScriptTableau(DEMANDE_MODELE, { client });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.motifs.join(" ")).toMatch(/Critères éliminatoires non respectés : Un gain concret/);
      expect(r.motifs.join(" ")).toMatch(/Note 7 sur 10/);
    }
  });

  it("corrige en code la grille trop indulgente du modèle (une remarque de jargon ne rend faux aucun critère)", () => {
    const revise = ecritureModele();
    revise.script.appel.at(-1)!.dit = "Réservez un appel, promis.";
    const grille = service.grilleCorrigee(relecture(revise).grille, controlerEcriture(revise, DEMANDE_MODELE));
    expect(grille.find((l) => l.critere === "une-seule-demande")).toMatchObject({ respecte: false });
    expect(grille.filter((l) => l.respecte)).toHaveLength(9);
    const jargon = ecritureModele();
    jargon.script.douleur[3].dit = "Les paramètres changent.";
    const d = controlerEcriture(jargon, DEMANDE_MODELE);
    expect(d.map((x) => [x.code, x.eliminatoire])).toEqual([["jargon", false]]);
    expect(service.grilleCorrigee(relecture(jargon).grille, d).every((l) => l.respecte)).toBe(true);
  });

  it("complétude : un manque relevé par la relecture refuse le script, avec le manque dans les motifs", async () => {
    const r1 = relecture(ecritureModele());
    r1.manques = ["où trouver la signature dans Outlook"];
    const { client } = clientSimule([ANGLE, ecritureModele(), r1]);
    const r = await service.genererScriptTableau(DEMANDE_MODELE, { client });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motifs.join(" ")).toMatch(/Il manque encore, pour comprendre le réflexe : où trouver la signature dans Outlook/);
  });

  it("la relecture corrige les phrases faibles : ses corrections sont appliquées, la version corrigée est livrée", async () => {
    const correction = { avant: "Le client s'en aperçoit.", apres: "Le client s'aperçoit aussitôt.", ecran: "Il s'en aperçoit vite", pourquoi: "Plus concret." };
    const r1 = relecture(ecritureModele(), [], [correction]);
    const { client } = clientSimule([ANGLE, ecritureModele(), r1]);
    const r = await service.genererScriptTableau(DEMANDE_MODELE, { client });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(service.versTexteDit(r.resultat.script)).toContain("Le client s'aperçoit aussitôt.");
    expect(r.resultat.script.douleur[3].ecran).toBe("Il s'en aperçoit vite");
    expect(r.resultat.note).toBe(10);
    const trace = (await depots().tracesScriptsTableau.lister())[0];
    expect(trace.versions.map((v) => v.passe)).toEqual(["ecriture", "relecture"]);
  });

  it("BOGUE du 15/10 : la version corrigée échoue, la précédente est gardée — sa note n'est PAS celle du texte relu", async () => {
    // La relecture note 10 sur 10 un texte qu'elle a dégradé (dernière phrase avec une virgule) : le programme garde la
    // version d'avant, qui n'a pas été notée. Aucun 10 sur 10 sur un autre texte : refus sans note, la version gardée reste.
    const degradee = { avant: "Réservez un appel de diagnostic.", apres: "Réservez un appel, promis.", ecran: "Réservez un appel", pourquoi: "Plus chaleureux." };
    const { client } = clientSimule([ANGLE, ecritureModele(), relecture(ecritureModele(), [], [degradee])]);
    const r = await service.genererScriptTableau(DEMANDE_MODELE, { client });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.nature).toBe("refus");
    expect(r.motifs).toContain(service.MOTIF_SANS_NOTE);
    expect(r.motifs.join(" ")).not.toMatch(/Note 10/);
    expect(r.meilleure).toMatchObject({ passe: "ecriture", valide: true });
    expect(service.versTexteDit(r.meilleure!.ecriture.script)).toContain("Réservez un appel de diagnostic.");
    const trace = (await depots().tracesScriptsTableau.lister())[0];
    expect(trace).toMatchObject({ issue: "refuse", note: null, grille: [] });
    expect(trace.versions[1].defauts.some((d) => d.code === "cloture-virgule")).toBe(true);
    // Reprise depuis la trace (sans appel) : même verdict, jamais la grille de la relecture sur la version d'avant.
    const repris = service.livrerDepuisTrace({ ...trace, grille: relecture(ecritureModele()).grille });
    expect(repris.ok).toBe(false);
    if (!repris.ok) expect(repris.motifs).toEqual([service.MOTIF_SANS_NOTE]);
  });

  it("grilleDeLaVersion : la grille ne vaut que pour le texte qu'elle a jugé", () => {
    const g = relecture(ecritureModele()).grille;
    const autre = ecritureModele();
    autre.script.appel[1].dit = "Réservez votre appel de diagnostic.";
    expect(service.grilleDeLaVersion(g, ecritureModele(), { ecriture: ecritureModele() })).toEqual(g);
    expect(service.grilleDeLaVersion(g, autre, { ecriture: ecritureModele() })).toBeNull();
  });

  it("la relecture ne réécrit jamais tout : plus de 3 corrections, une phrase ajoutée ou introuvable sont écartées, et la note avec", async () => {
    const c = (avant: string, apres: string) => ({ avant, apres, ecran: "", pourquoi: "" });
    const corrections = [
      c("Un client appelle.", "Un client vous appelle."),
      c("Une phrase qui n'existe pas.", "Autre chose."),
      c("On fouille la boîte mail du collègue.", "On fouille la boîte mail du collègue. Et son prénom."),
      c("Puis on l'appelle en congé.", "Puis on l'appelle en congé pour tout refaire."),
      c("Réservez un appel de diagnostic.", "Réservez votre diagnostic."),
    ];
    const { client } = clientSimule([ANGLE, ecritureModele(), relecture(ecritureModele(), [], corrections)]);
    const r = await service.genererScriptTableau(DEMANDE_MODELE, { client });
    const trace = (await depots().tracesScriptsTableau.lister())[0];
    const texte = service.versTexteDit(trace.versions[1].ecriture.script);
    expect(texte).toContain("Un client vous appelle.");
    expect(texte).not.toContain("Et son prénom.");
    // Seules les 3 premières corrections sont lues : la quatrième et la cinquième ne touchent rien.
    expect(texte).toContain("Puis on l'appelle en congé.");
    expect(texte).toContain("Réservez un appel de diagnostic.");
    // Des corrections écartées : la grille notait un texte qui n'existe pas, le script n'a pas de note (relecture A09).
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motifs.join(" ")).toMatch(/4 corrections n'ont pas pu être appliquées.*« Une phrase qui n'existe pas\. » : phrase introuvable dans le script.*« On fouille la boîte mail du collègue\. » : elle ajoute une phrase/);
    expect(r.motifs.join(" ")).not.toMatch(/Note \d+ sur 10/);
    expect(trace).toMatchObject({ issue: "refuse", note: null, grille: [] });
  });

  it("une correction mal recopiée (accents perdus) n'est pas appliquée : pas de 10 sur 10 sur la phrase qu'elle voulait corriger", async () => {
    // Cas reproduit par la relecture A09 : `avant` sans accents, la correction est écartée, les contrôles sont vides.
    const mal = { avant: "On fouille la boite mail du collègue.", apres: "On fouille ses mails.", ecran: "", pourquoi: "Plus court." };
    const { client } = clientSimule([ANGLE, ecritureModele(), relecture(ecritureModele(), [], [mal])]);
    const r = await service.genererScriptTableau(DEMANDE_MODELE, { client });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motifs[0]).toMatch(/^La relecture a noté son texte corrigé, mais 1 correction n'a pas pu être appliquée/);
    expect(r.meilleure).toMatchObject({ valide: true });
    expect(service.versTexteDit(r.meilleure!.ecriture.script)).toContain("On fouille la boîte mail du collègue.");
  });

  it("refus : la meilleure version écrite est rendue (affichée, utilisable ou corrigeable), jamais jetée", async () => {
    const { client } = clientSimule([ANGLE, ecritureModele(), relecture(ecritureModele(), ["gain"])]);
    const r = await service.genererScriptTableau(DEMANDE_MODELE, { client });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.meilleure).toMatchObject({ passe: "relecture", valide: true });
  });

  it("relecture coupée (réponse illisible) : refus, mais la version écrite valide est gardée", async () => {
    const { client } = clientSimule([ANGLE, ecritureModele(), { grille: [] }]);
    const r = await service.genererScriptTableau(DEMANDE_MODELE, { client });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.meilleure).toMatchObject({ passe: "ecriture", valide: true });
  });

  it("la relecture corrige 3 phrases au plus, juge la valeur, et ne renvoie ni le script ni les variantes", async () => {
    const { client, requetes } = clientSimule([ANGLE, ecritureModele(), relecture(ecritureModele())]);
    await service.genererScriptTableau(DEMANDE_MODELE, { client });
    const consigne = requetes[2].systeme.map((b) => b.texte).join("\n");
    expect(consigne).toMatch(/les 3 phrases les plus FAIBLES/);
    expect(consigne).toMatch(/JAMAIS de réécriture totale, JAMAIS d'ajout/);
    expect(consigne).toMatch(/Jugez la VALEUR/);
    expect(JSON.stringify(requetes[2].schema)).not.toMatch(/variantes|"revise"/);
    expect(requetes[2].messages[0].contenu).not.toMatch(/"variantes"/);
    expect(requetes[2].messages[0].contenu).toMatch(/"idee"/);
  });

  it("le métier de l'exemple change : les 3 derniers métiers livrés vont à l'écriture et sont contrôlés", async () => {
    // Trois scripts livrés, le plus récent avec un cabinet : l'exemple suivant (encore un cabinet) est relancé.
    // La question sur l'IA tourne aussi (18/10) : la 1re, la 2e, la 3e formulation, puis la 4e.
    for (const [i, metier] of ["plombier", "comptable", "cabinet d'architectes"].entries()) {
      const e = ecritureModele(QUESTIONS_IA[i]);
      e.metierExemple = metier;
      const { client, requetes } = clientSimule([ANGLE, e, relecture(e)]);
      expect((await service.genererScriptTableau(DEMANDE_MODELE, { client })).ok, metier).toBe(true);
      expect(requetes[1].messages[0].contenu).toContain(`<question_ia>\n${QUESTIONS_IA[i]}\n</question_ia>`);
      await new Promise((ok) => setTimeout(ok, 5));
    }
    expect(await service.metiersRecents()).toEqual(["cabinet d'architectes", "comptable", "plombier"]);
    expect(await service.questionsIaRecentes()).toEqual([QUESTIONS_IA[2], QUESTIONS_IA[1], QUESTIONS_IA[0]]);
    const autre = ecritureModele(QUESTIONS_IA[3]);
    autre.metierExemple = "agent immobilier";
    const { client, requetes } = clientSimule([ANGLE, ecritureModele(QUESTIONS_IA[3]), autre, relecture(autre)]);
    const r = await service.genererScriptTableau(DEMANDE_MODELE, { client });
    expect(r.ok).toBe(true);
    expect(requetes[1].messages[0].contenu).toContain(`<question_ia>\n${QUESTIONS_IA[3]}\n</question_ia>`);
    expect(requetes[1].messages[0].contenu).toMatch(/<metiers_recents>\nMétiers des exemples des derniers scripts \(à ne pas reprendre\) : cabinet d'architectes, comptable, plombier\./);
    expect(requetes[2].messages[0].contenu).toMatch(/Le métier de l'exemple \(« cabinet comptable »\) est celui d'un des 3 derniers scripts/);
  });

  it("une trace livrée dont une version n'a pas d'écriture ne désactive pas la lecture des métiers ni des questions récents", async () => {
    const e = ecritureModele(QUESTIONS_IA[0]);
    e.metierExemple = "plombier";
    const { client } = clientSimule([ANGLE, e, relecture(e)]);
    expect((await service.genererScriptTableau(DEMANDE_MODELE, { client })).ok).toBe(true);
    const [trace] = await depots().tracesScriptsTableau.lister();
    await depots().tracesScriptsTableau.modifier(trace.id, { versions: [...trace.versions, { passe: "relecture", defauts: [] } as never] });
    expect(await service.metiersRecents()).toEqual(["plombier"]);
    expect(await service.questionsIaRecentes()).toEqual([QUESTIONS_IA[0]]);
  });

  it("écriture refusée : la meilleure version gardée est jugée avec la question tirée (pas sans options)", async () => {
    const mauvaise = ecritureModele(QUESTIONS_IA[1]);
    const { client } = clientSimule([ANGLE, mauvaise, mauvaise]);
    const r = await service.genererScriptTableau(DEMANDE_MODELE, { client });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.meilleure?.valide).toBe(false);
    expect(r.meilleure?.defauts.map((d) => d.code)).toContain("question-ia");
  });

  it("refuse une réponse illisible", async () => {
    const { client } = clientSimule([{ angle: "incomplet" }]);
    const r = await service.genererScriptTableau(DEMANDE_MODELE, { client });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motifs[0]).toMatch(/passe « angle » ne suit pas le format attendu/);
  });

  it("sans client fourni : refus, aucun appel", async () => {
    const r = await service.genererScriptTableau(DEMANDE_MODELE);
    expect(r).toMatchObject({ ok: false, appels: 0, coutUsd: 0 });
    if (!r.ok) expect(r.motifs[0]).toMatch(/pas encore relié/);
  });

  it("en cas de refus, rien n'est écrit en base sauf la trace du refus", async () => {
    const avant = await compterTout();
    const { client } = clientSimule([ANGLE, ecritureFautive(), ecritureFautive()]);
    const r = await service.genererScriptTableau(DEMANDE_MODELE, { client });
    expect(r.ok).toBe(false);
    const apres = await compterTout();
    const changes = Object.keys(apres).filter((k) => apres[k] !== avant[k]);
    expect(changes).toEqual(["tracesScriptsTableau"]);
    expect(apres.tracesScriptsTableau - avant.tracesScriptsTableau).toBe(1);
    const trace = (await depots().tracesScriptsTableau.lister())[0];
    expect(trace).toMatchObject({ issue: "refuse", retenue: 0 });
    expect(trace.accroches).toHaveLength(5);
    expect(trace.versions).toHaveLength(2);
    expect(trace.coutUsd).toBeGreaterThan(0);
  });

  it("refuse une demande invalide avant tout appel", async () => {
    const { client, requetes } = clientSimule([]);
    await expect(service.genererScriptTableau({ ...DEMANDE_MODELE, fin: { type: "commentaire", mot: "deux mots" } }, { client })).rejects.toThrow(/Un seul mot/);
    expect(requetes).toHaveLength(0);
  });
});

describe("coût et texte dit", () => {
  it("estime le coût AVANT, sans aucun appel ni écriture", async () => {
    const espion = vi.fn(async () => {
      throw new Error("réseau interdit");
    });
    vi.stubGlobal("fetch", espion);
    const avant = await compterTout();
    const e = service.estimerCoutScript(DEMANDE_MODELE);
    expect(espion).not.toHaveBeenCalled();
    expect(await compterTout()).toEqual(avant);
    expect(e.modele).toBe("claude-opus-5-5");
    expect(e.appels.map((a) => a.passe)).toEqual(["angle", "ecriture", "relance", "relecture"]);
    expect(e.estimationUsd).toBeGreaterThan(0);
    expect(e.pireCasUsd).toBeGreaterThan(e.estimationUsd);
    expect(e.pireCasEur.centimes).toBeGreaterThan(0);
  });

  it("le socle de Will est compté dans le prix : chaque passe le reçoit en entier", () => {
    const sans = service.estimerCoutScript(DEMANDE_MODELE);
    const jetons = service.jetonsDuSocle({ contexteAxion: "charte ".repeat(500), styleWill: "style ".repeat(500), preuves: "preuve ".repeat(200), gagnants: "ton ".repeat(200) });
    expect(jetons).toBeGreaterThan(1_000);
    expect(service.jetonsDuSocle(undefined)).toBe(0);
    const avec = service.estimerCoutScript(DEMANDE_MODELE, undefined, jetons);
    expect(avec.pireCasUsd).toBeGreaterThan(sans.pireCasUsd);
    avec.appels.forEach((a, i) => expect(a.pireCasUsd, a.passe).toBeGreaterThan(sans.appels[i].pireCasUsd));
  });

  it("le socle est compté au prix de l'écriture 1 h (point de cache du socle) : le prix annoncé n'est jamais sous-estimé", () => {
    const jetons = 7_500;
    const sans = service.estimerCoutScript(DEMANDE_MODELE);
    const avec = service.estimerCoutScript(DEMANDE_MODELE, undefined, jetons);
    // Opus 5.5 : écriture 1 h = 8 $ le million (2 × l'entrée), et non 5 $ (5 min).
    avec.appels.forEach((a, i) => expect(a.pireCasUsd - sans.appels[i].pireCasUsd, a.passe).toBeCloseTo((jetons * 8) / 1e6, 9));
  });

  it("versTexteDit rend les phrases dites, dans l'ordre, sans les mots à l'écran", () => {
    const t = service.versTexteDit(ecritureModele().script);
    expect(t.startsWith("Le seul qui connaît ce dossier client est en congé. Un client appelle.")).toBe(true);
    expect(t.endsWith("Axion-IA met cette fiche en place pour vous. Réservez un appel de diagnostic.")).toBe(true);
    expect(t).not.toContain("Dossier client, collègue en congé");
  });
});
