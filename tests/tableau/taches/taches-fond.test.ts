/**
 * TÂCHES DE FOND DU TABLEAU ANIMÉ (constat du 12/10 en production : l'écriture tenait plus de 3 minutes dans UNE action
 * serveur, Cloudflare la coupait à 100 s, l'écran tombait sur l'erreur générique, trois appels payés, rien de gardé).
 *  - l'action rend la main sans attendre aucun appel ; la trace existe dès le départ ;
 *  - l'état avance étape par étape (accroches, écriture, relecture), gardé après chaque appel ;
 *  - reprise après une interruption (redémarrage pendant un appel) : les appels déjà payés ne sont JAMAIS repayés ;
 *  - erreur → trace, message en français, journal du serveur, « Reprendre » ;
 *  - plafond de l'écriture : couvre les quatre appels ; dépassé → refus expliqué, aucune exception ; une nouvelle
 *    écriture de la même vidéo a sa propre enveloppe ;
 *  - un brouillon payé sans résultat (comme `v-ab6eb972eb39`) : « Écriture interrompue », « Reprendre » relance ;
 *  - les brouillons récents, le suivi à l'écran, les actions courtes refusées pendant une tâche, la boucle de fond.
 * Dépôts en mémoire, doubles de Claude (aucun réseau réel), rien de payé.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";
import { preparerMotDePasse } from "../../helpers/g1a";
import { CLE_ESSAI_CLAUDE, fluxReussi, reponseFlux } from "../../helpers/g0";
import { exemplesCommeVraies } from "../../helpers/videos-reelles";
import type { RequeteClaude, ReponseClaude } from "@/fournisseurs/claude/client";
import type { EntreeRole } from "../../../src/generateur/roles/types";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import type { OutilsDecoupage } from "../../../src/moteurs/montage-tableau/decoupage";
import { CRITERES_GRILLE, type AngleScript, type EcritureScript } from "@/domaine/scripts-tableau";
import { repereTexte } from "@/domaine/relecture-tableau";
import { DEMANDE_MODELE, ecritureModele } from "../../tableau-scripts/modele-valide";
import { auStyleDemande, AUJOURDHUI_EXEMPLES, contexteExemple, copie, ficheErreurCorrigee, texteScriptDe } from "../regles/exemples";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ replace() {}, push() {}, refresh() {} }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const creation = await import("@/services/tableau-creation");
const taches = await import("@/services/tableau-taches");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const { ecrireParametre } = await import("@/services/_commun");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
const { ecrireScriptTableauAction, suiviTacheTableauAction, reprendreTacheTableauAction } = await import("@/app/(studio)/tableau/nouvelle/actions");
const { NouvelleVideoTableau } = await import("@/components/formats/tableau-anime/NouvelleVideoTableau");
const { BrouillonsRecentsTableau } = await import("@/components/formats/tableau-anime/BrouillonsRecents");
const { requeteAngle, requeteEcriture, requeteRelecture } = await import("@/services/tableau-scripts/consignes");
const { roleDeRequete, socleWillTableau } = await import("@/services/tableau-scripts/client-studio");
const { pireCasRole } = await import("@/generateur/roles/types");
const { MARGE_CREDITS } = await import("@/services/credits");
const boucle = await import("@/services/boucle");

const MDP = "tableau-taches-fond";
const JETONS = { entree: 1000, cacheLu: 0, cacheEcrit: 2000, sortie: 3000 };
const ANGLE: AngleScript = {
  angle: "Comment apprend-on vraiment à se servir de l'IA ?",
  douleur: "Des réponses plates qu'il faut tout réécrire.",
  accroches: [
    { type: "situation-vecue", dit: "Vous avez essayé l'IA trois fois.", ecran: "Essayé trois fois", pourquoi: "Vécu." },
    { type: "idee-recue-contredite", dit: "L'IA n'est pas un moteur de recherche.", ecran: "Pas un moteur", pourquoi: "Contredit." },
    { type: "chiffre-vrai", dit: "Cinq jours suffisent.", ecran: "Cinq jours", pourquoi: "Méthode." },
    { type: "erreur-frequente", dit: "Vous changez de tâche chaque jour.", ecran: "Une tâche", pourquoi: "Erreur." },
    { type: "promesse-precise", dit: "Un modèle gardé en cinq jours.", ecran: "Un modèle gardé", pourquoi: "Promesse." },
  ],
  retenue: 0,
  raison: "Elle fait dire « c'est moi ».",
};
/** Sortie de la relecture : le script réécrit ENTIER, sans les variantes (gardées de l'écriture). */
const relecture = (e: EcritureScript) => ({ corrections: [], grille: CRITERES_GRILLE.map((c) => ({ critere: c.id, respecte: true, remarque: "" })), faiblesses: [], affirmations: e.affirmations, manques: [] });

/** « Découper en scènes » avec le prix confirmé (le serveur refuse sans lui). */
async function decouperConfirme(donnees: unknown, aujourdhui: string) {
  const relu = repereTexte((donnees as { texte: string }).texte);
  const p = await creation.decouperScriptTableau(donnees, { relu }, { aujourdhui });
  if (p.statut !== "accord-requis") throw new Error(JSON.stringify(p));
  return creation.decouperScriptTableau(donnees, { accord: p.centimes, relu }, { aujourdhui });
}
const fautive = () => {
  const e = ecritureModele();
  e.script.accroche[0].dit = "Bonjour à tous, vous avez essayé l'IA.";
  return e;
};
const DEMANDE = { ...DEMANDE_MODELE, vraiCas: null };

const reponse = (r: RequeteClaude, s: unknown): ReponseClaude => ({ texte: JSON.stringify(s), modeleDemande: r.modele, modele: "claude-opus-5-5", replis: [], stopReason: "end_turn", jetons: { ...JETONS } });

/** Client simulé : rend les réponses dans l'ordre (une `Error` est levée), garde les passes demandées. */
function clientSimule(sorties: unknown[]) {
  const passes: string[] = [];
  return {
    passes,
    client: {
      simule: true,
      async appeler(r: RequeteClaude, passe: string): Promise<ReponseClaude> {
        passes.push(passe);
        const s = sorties.shift();
        if (s === undefined) throw new Error("Appel de trop.");
        if (s instanceof Error) throw s;
        return reponse(r, s);
      },
    },
  };
}

/** Client pas à pas : chaque appel attend qu'on lui donne sa réponse (`repondre`). */
function clientPasAPas() {
  const enAttente: { passe: string; repondre: (s: unknown) => void }[] = [];
  const passes: string[] = [];
  return {
    passes,
    enAttente,
    client: {
      simule: true,
      appeler(r: RequeteClaude, passe: string): Promise<ReponseClaude> {
        passes.push(passe);
        return new Promise((ok) => enAttente.push({ passe, repondre: (s) => ok(reponse(r, s)) }));
      },
    },
    /** Attend que la passe soit demandée, et rend de quoi y répondre. */
    async attendre(passe: string) {
      await vi.waitFor(() => expect(enAttente.at(-1)?.passe).toBe(passe));
      return enAttente.at(-1)!;
    },
  };
}

async function prix(): Promise<number> {
  return (await creation.ecranCreationTableau()).ecriture.coutCentimes;
}
async function brouillon(videoId: string) {
  return creation.lireBrouillonTableau(await depots().videos.obtenir(videoId))!;
}

const fetchInterdit = (async () => {
  throw new Error("réseau interdit");
}) as typeof fetch;

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  taches.tachesEnCours().clear();
  await auth.seConnecter(MDP, false);
  vi.stubGlobal("fetch", fetchInterdit);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  credits.injecterLecteursPourEssai(null);
  gc.injecterClaudePourEssai(null);
});

/** Claude « relié » pour les textes, par un faux `fetch` : `reponses` servies dans l'ordre ; absent : ne répond jamais. */
async function brancherClaude(reponses?: { texte: string; entree?: number; sortie?: number }[]) {
  await exemplesCommeVraies(depots());
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, fetchInterdit)], ["anthropic"]);
  await ecrireParametre("fournisseur.texte-reseaux", "claude");
  await credits.declarerRecharge("anthropic", 500);
  const appels: unknown[] = [];
  const f = (async (_u: string | URL | Request, init?: RequestInit) => {
    appels.push(init?.body);
    const r = reponses?.shift();
    if (!r) return new Promise<Response>(() => undefined);
    return reponseFlux(fluxReussi({ texte: r.texte, modele: "claude-opus-5-5", entree: r.entree, sortie: r.sortie, cacheEcrit: 0 }));
  }) as typeof fetch;
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: f, attenteMs: () => 0 });
  return appels;
}

describe("l'action rend la main sans attendre les appels", () => {
  it("par l'action de l'écran : en moins de 2 s, aucun appel parti, tâche en attente, trace ouverte", async () => {
    const appels = await brancherClaude();
    const debut = Date.now();
    const r = await ecrireScriptTableauAction(DEMANDE, { accord: await prix() });
    expect(Date.now() - debut).toBeLessThan(2_000);
    expect(r).toMatchObject({ ok: true, donnees: { statut: "en-cours" } });
    if (!r.ok || r.donnees.statut !== "en-cours") return;
    const videoId = r.donnees.videoId;
    expect(appels).toHaveLength(0);
    expect(await depots().depenses.compter((x) => x.videoId === videoId)).toBe(0);
    const b = await brouillon(r.donnees.videoId);
    expect(b.tache).toMatchObject({ type: "ecriture", statut: "en-attente", etape: "accroches", demande: DEMANDE, journal: [] });
    // La trace existe dès le départ, avant tout appel.
    expect(await depots().tracesScriptsTableau.obtenir(r.donnees.traceId)).toMatchObject({ issue: "en-cours", videoId: r.donnees.videoId, tacheId: b.tache!.id, appels: [] });
    // L'écran suit l'état sans rien attendre non plus.
    expect(await suiviTacheTableauAction(r.donnees.videoId)).toMatchObject({ ok: true, donnees: { statut: "en-attente" } });
  });

  it("le découpage aussi : la demande est enregistrée, la boucle de fond découpera", async () => {
    const fiche = ficheErreurCorrigee;
    const donnees = { texte: texteScriptDe(fiche), serieCode: "formation", structure: fiche.structure, douleur: fiche.douleur, gesteMinute: fiche.gesteMinute, finId: null, reseaux: ["verticaux"] };
    const r = await decouperConfirme(donnees, AUJOURDHUI_EXEMPLES);
    expect(r).toMatchObject({ statut: "en-cours" });
    if (r.statut !== "en-cours") return;
    expect((await brouillon(r.videoId)).tache).toMatchObject({ type: "decoupage", statut: "en-attente", etape: "decoupage", versionId: "b1" });
    // Un second clic pendant le travail est refusé en clair (jamais deux tâches à la fois).
    expect(await creation.decouperScriptTableau(donnees, { videoId: r.videoId })).toMatchObject({ statut: "refusee", phrase: expect.stringMatching(/déjà en cours/) });
  });
});

describe("l'état avance étape par étape", () => {
  it("accroches, écriture, relecture : chaque appel est gardé dès son retour, la trace est complétée à chaque étape", async () => {
    const pas = clientPasAPas();
    const r = await creation.ecrireScriptTableau(DEMANDE, { accord: await prix() }, { client: pas.client });
    if (r.statut !== "en-cours") throw new Error(JSON.stringify(r));
    const travail = creation.travaillerTachesTableau({ client: pas.client });

    const angle = await pas.attendre("angle");
    expect(await creation.suiviTacheTableau(r.videoId)).toMatchObject({ statut: "en-cours", etape: "accroches", phrase: "Je cherche cinq accroches…", appels: 0 });
    expect((await brouillon(r.videoId)).tache!.enVol).toMatchObject({ etape: "accroches" });
    angle.repondre(ANGLE);

    const ecriture = await pas.attendre("ecriture");
    expect(await creation.suiviTacheTableau(r.videoId)).toMatchObject({ etape: "ecriture", phrase: "J'écris le script…", appels: 1 });
    expect((await brouillon(r.videoId)).tache!.journal.map((a) => a.passe)).toEqual(["angle"]);
    expect(await depots().tracesScriptsTableau.obtenir(r.traceId)).toMatchObject({ issue: "en-cours", etape: "accroches", accroches: ANGLE.accroches });
    ecriture.repondre(ecritureModele());

    const relu = await pas.attendre("relecture");
    expect(await creation.suiviTacheTableau(r.videoId)).toMatchObject({ etape: "relecture", phrase: "Je le relis…", appels: 2 });
    const trace = await depots().tracesScriptsTableau.obtenir(r.traceId);
    expect(trace).toMatchObject({ issue: "en-cours", etape: "ecriture" });
    expect(trace!.versions).toHaveLength(1);
    expect(trace!.appels).toHaveLength(2);
    relu.repondre(relecture(ecritureModele()));

    await travail;
    const b = await brouillon(r.videoId);
    expect(b.tache).toMatchObject({ statut: "terminee", enVol: undefined });
    expect(b.generation?.issue.ok).toBe(true);
    expect(await creation.suiviTacheTableau(r.videoId)).toMatchObject({ statut: "terminee", phrase: "Script écrit." });
    const fin = await depots().tracesScriptsTableau.obtenir(r.traceId);
    expect(fin).toMatchObject({ issue: "livre", etape: "relecture" });
    expect(fin!.appels.map((a) => a.passe)).toEqual(["angle", "ecriture", "relecture"]);
    expect(fin!.appels.every((a) => typeof a.dureeMs === "number")).toBe(true);
    expect(pas.passes).toEqual(["angle", "ecriture", "relecture"]);
  });
});

describe("reprise après interruption, sans repayer", () => {
  it("redémarrage pendant la relecture : « interrompue », puis « Reprendre » ne refait QUE la relecture", async () => {
    const pas = clientPasAPas();
    const r = await creation.ecrireScriptTableau(DEMANDE, { accord: await prix() }, { client: pas.client });
    if (r.statut !== "en-cours") throw new Error(JSON.stringify(r));
    void creation.travaillerTachesTableau({ client: pas.client });
    (await pas.attendre("angle")).repondre(ANGLE);
    (await pas.attendre("ecriture")).repondre(ecritureModele());
    await pas.attendre("relecture");
    // Le processus s'arrête ici (mise en ligne) : la relecture partie ne reviendra jamais.
    taches.tachesEnCours().clear();
    const apres = clientSimule([relecture(ecritureModele())]);
    await creation.travaillerTachesTableau({ client: apres.client });
    expect(apres.passes).toEqual([]);
    const vue = await creation.suiviTacheTableau(r.videoId);
    expect(vue).toMatchObject({ statut: "interrompue", appels: 2 });
    expect(vue!.phrase).toMatch(/Écriture interrompue.*Les 2 appels déjà faits sont gardés/);
    expect(await depots().tracesScriptsTableau.obtenir(r.traceId)).toMatchObject({ issue: "interrompu", erreur: expect.stringMatching(/relecture/) });

    // Page fermée puis rouverte : le brouillon montre l'interruption et « Reprendre ».
    const ecran = await creation.ecranCreationTableau(r.videoId);
    const html = renderToStaticMarkup(createElement(NouvelleVideoTableau, { ecran }));
    expect(html).toContain("Écriture interrompue");
    expect(html).toMatch(/Reprendre\s*<\/button>/);
    expect(html).not.toContain("Un souci est survenu");

    // « Reprendre » : le prix est confirmé à nouveau ; les deux appels faits sont rejoués, seule la relecture part.
    expect(await reprendreTacheTableauAction(r.videoId)).toMatchObject({ ok: true, donnees: { statut: "accord-requis" } });
    expect(await reprendreTacheTableauAction(r.videoId, await prix())).toMatchObject({ ok: true, donnees: { statut: "en-cours" } });
    await creation.travaillerTachesTableau({ client: apres.client });
    expect(apres.passes).toEqual(["relecture"]);
    expect(pas.passes).toEqual(["angle", "ecriture", "relecture"]);
    expect((await brouillon(r.videoId)).tache).toMatchObject({ statut: "terminee" });
    const trace = await depots().tracesScriptsTableau.obtenir(r.traceId);
    expect(trace).toMatchObject({ issue: "livre" });
    expect(trace!.appels.map((a) => a.passe)).toEqual(["angle", "ecriture", "relecture"]);
  });

  it("découpage : une réponse payée est rejouée à la reprise, jamais redemandée", async () => {
    const fiche = ficheErreurCorrigee;
    const { texteScript: _s, ...regles } = contexteExemple(fiche);
    void _s;
    for (const p of regles.preuves) await depots().preuves.enregistrer(p as never);
    for (const m of regles.matieres) await depots().matieres.enregistrer(m as never);
    const donnees = { texte: texteScriptDe(fiche), serieCode: "formation", structure: fiche.structure, douleur: fiche.douleur, gesteMinute: fiche.gesteMinute, finId: null, reseaux: ["verticaux"] };
    const balise = (variable: string, nom: string) => variable.match(new RegExp(`<${nom}>\\n([\\s\\S]*?)\\n</${nom}>`))?.[1] ?? "";
    const ficheDe = (variable: string) => {
      const f: FicheTableau = copie(fiche);
      Object.assign(f, JSON.parse(balise(variable, "fiche_fixe")), { serie: JSON.parse(balise(variable, "serie")) });
      // Style des nouvelles fiches (« reference/2 », 14/10) : la fiche rendue avec son gabarit de page clair.
      auStyleDemande(f);
      return JSON.stringify(f);
    };
    const r = await decouperConfirme(donnees, AUJOURDHUI_EXEMPLES);
    if (r.statut !== "en-cours") throw new Error(JSON.stringify(r));
    // Premier passage : l'appel part (on garde ce qui a été demandé) et le processus s'arrête avant sa fin.
    let demandee: { role: Parameters<OutilsDecoupage["appeler"]>[0]; entree: EntreeRole } | null = null;
    void creation.travaillerTachesTableau({ appeler: (role, entree) => ((demandee = { role, entree }), new Promise(() => undefined)), aujourdhui: AUJOURDHUI_EXEMPLES });
    await vi.waitFor(() => expect(demandee).not.toBeNull());
    // … mais sa réponse (payée) a eu le temps d'être gardée dans la tâche, juste avant l'arrêt.
    const t = (await brouillon(r.videoId)).tache!;
    await taches.appelerRejoue(r.videoId, t.id, async (_role, entree) => ({ ok: true, simule: false, donnees: ficheDe(entree.variable) }), [])(demandee!.role, demandee!.entree);
    expect((await brouillon(r.videoId)).tache).toMatchObject({ statut: "en-cours", enVol: undefined, journal: [expect.objectContaining({ passe: demandee!.role.id })] });
    taches.tachesEnCours().clear();
    // La boucle reprend d'elle-même (aucun appel en vol) : la réponse gardée est rejouée, aucun nouvel appel.
    let appels = 0;
    const appeler: OutilsDecoupage["appeler"] = async (_role, entree) => (appels++, { ok: true, simule: false, donnees: ficheDe(entree.variable) });
    await creation.travaillerTachesTableau({ appeler, aujourdhui: AUJOURDHUI_EXEMPLES });
    expect(appels).toBe(0);
    const b = await brouillon(r.videoId);
    expect(b.tache).toMatchObject({ statut: "terminee" });
    expect(b.versions).toHaveLength(1);
  });
});

describe("erreur : trace, message, journal du serveur, « Reprendre »", () => {
  it("une exception pendant l'écriture : rangée dans la tâche et la trace, dite au serveur sans clé ; réessayer ne repaie pas les accroches", async () => {
    const erreurs = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client, passes } = clientSimule([ANGLE, new Error(`panne imprévue ${CLE_ESSAI_CLAUDE}`)]);
    const r = await creation.ecrireScriptTableau(DEMANDE, { accord: await prix() }, { client });
    if (r.statut !== "en-cours") throw new Error(JSON.stringify(r));
    await creation.travaillerTachesTableau({ client });
    expect(passes).toEqual(["angle", "ecriture"]);

    const t = (await brouillon(r.videoId)).tache!;
    expect(t).toMatchObject({ statut: "erreur", enVol: undefined });
    expect(t.message).toMatch(/Génération interrompue : panne imprévue \[clé masquée\]/);
    expect(t.message).toMatch(/Les appels déjà faits sont gardés/);
    const trace = await depots().tracesScriptsTableau.obtenir(r.traceId);
    expect(trace).toMatchObject({ issue: "erreur", etape: "ecriture", erreur: expect.stringMatching(/panne imprévue/) });
    expect(trace!.appels.map((a) => a.passe)).toEqual(["angle"]);
    const journal = erreurs.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(journal).toContain(`vidéo ${r.videoId}`);
    expect(journal).toContain("étape « ecriture »");
    expect(journal).not.toContain(CLE_ESSAI_CLAUDE);
    expect(JSON.stringify(trace)).not.toContain(CLE_ESSAI_CLAUDE);

    // À l'écran : le message en français et « Reprendre », jamais l'écran d'erreur générique.
    const html = renderToStaticMarkup(createElement(NouvelleVideoTableau, { ecran: await creation.ecranCreationTableau(r.videoId) }));
    expect(html).toMatch(/Reprendre\s*<\/button>/);
    expect(html).toContain("Génération interrompue");
    expect(html).not.toContain("Un souci est survenu");

    // « Reprendre » : seule la suite part (l'angle déjà payé est rejoué).
    expect(await creation.reprendreTacheTableau(r.videoId, await prix())).toMatchObject({ statut: "en-cours" });
    const suite = clientSimule([ecritureModele(), relecture(ecritureModele())]);
    await creation.travaillerTachesTableau({ client: suite.client });
    expect(suite.passes).toEqual(["ecriture", "relecture"]);
    expect((await brouillon(r.videoId)).tache).toMatchObject({ statut: "terminee" });
    expect(await depots().tracesScriptsTableau.obtenir(r.traceId)).toMatchObject({ issue: "livre", erreur: undefined });
  });

  it("le suivi ne lève jamais : un brouillon inconnu rend une phrase, pas une exception", async () => {
    expect(await suiviTacheTableauAction("v-inconnue")).toEqual({ ok: true, donnees: null });
    expect(await reprendreTacheTableauAction("v-inconnue")).toMatchObject({ ok: false, message: "Ce brouillon n'existe plus." });
  });
});

describe("plafond de l'écriture", () => {
  it.each(["courte", "complete"] as const)("méthode %s : couvre angle + écriture + relance + relecture, réservations au pire comprises (socle de Will compris)", async (m) => {
    const plafondUsd = (await creation.pireCasEcritureUsd(m)) * (1 + MARGE_CREDITS);
    // Chaque passe reçoit le socle de Will (charte, style, preuves, modèles de ton) : le plafond doit le couvrir.
    const socle = await socleWillTableau();
    expect(socle.gagnants).toMatch(/<modele code="W01"/);
    const pire = (r: RequeteClaude, passe: "angle" | "ecriture" | "relance" | "relecture") => {
      const { role, entree } = roleDeRequete(r, passe, socle);
      return pireCasRole(role, entree);
    };
    const defauts = [{ code: "accroche-salutation" as const, message: "Pas de salutation dans l'accroche.", eliminatoire: true }];
    const passes = [pire(requeteAngle(DEMANDE, m), "angle"), pire(requeteEcriture(DEMANDE, ANGLE, undefined, {}, m), "ecriture"), pire(requeteEcriture(DEMANDE, ANGLE, { defauts, precedente: ecritureModele() }, {}, m), "relance"), pire(requeteRelecture(DEMANDE, ANGLE, ecritureModele(), m), "relecture")];
    // Avant chaque appel : ce qui est déjà dépensé (au pire) + la réservation de l'appel (pire × marge) ≤ plafond.
    for (let i = 0; i < passes.length; i++) {
      const engage = passes.slice(0, i).reduce((s, x) => s + x, 0) + passes[i] * (1 + MARGE_CREDITS);
      expect(engage).toBeLessThanOrEqual(plafondUsd);
    }
  });

  it("par le vrai chemin plafonné : les quatre appels passent ; une nouvelle écriture de la même vidéo a sa propre enveloppe", async () => {
    const ecriture = (e: EcritureScript) => ({ texte: JSON.stringify(e), entree: 9_000, sortie: 9_000 });
    const appels = await brancherClaude([
      { texte: JSON.stringify(ANGLE), entree: 3_000, sortie: 4_000 },
      ecriture(fautive()),
      ecriture(ecritureModele()),
      { texte: JSON.stringify(relecture(ecritureModele())), entree: 9_000, sortie: 12_000 },
      // Seconde écriture (autre accroche) : écriture, relance, relecture.
      ecriture(fautive()),
      ecriture(ecritureModele()),
      { texte: JSON.stringify(relecture(ecritureModele())), entree: 9_000, sortie: 12_000 },
    ]);
    const r = await creation.ecrireScriptTableau(DEMANDE, { accord: await prix() });
    if (r.statut !== "en-cours") throw new Error(JSON.stringify(r));
    await creation.travaillerTachesTableau();
    expect(appels).toHaveLength(4);
    expect((await brouillon(r.videoId)).tache).toMatchObject({ statut: "terminee" });
    const etapes = (await depots().depenses.lister((x) => x.videoId === r.videoId)).flatMap((x) => x.lignes.map((l) => l.etape));
    expect(etapes).toEqual(["Tableau · script · accroches", "Tableau · script · écriture", "Tableau · script · relance de l'écriture", "Tableau · script · relecture"]);

    // Avant : le plafond comptait TOUT ce que la vidéo avait déjà dépensé, une seconde écriture était refusée.
    await new Promise((ok) => setTimeout(ok, 5));
    const r2 = await creation.ecrireScriptTableau(DEMANDE, { videoId: r.videoId, accord: await prix(), accroche: 1 });
    if (r2.statut !== "en-cours") throw new Error(JSON.stringify(r2));
    await creation.travaillerTachesTableau();
    expect(appels).toHaveLength(7);
    expect((await brouillon(r.videoId)).tache).toMatchObject({ statut: "terminee" });
  });

  it("dépassé : refus expliqué en clair (aucune exception, aucun appel), trace close, « Reprendre » proposé", async () => {
    const appels = await brancherClaude([]);
    await ecrireParametre("tableau.plafondScriptUsd", 0);
    const r = await creation.ecrireScriptTableau(DEMANDE, { accord: await prix() });
    if (r.statut !== "en-cours") throw new Error(JSON.stringify(r));
    await creation.travaillerTachesTableau();
    expect(appels).toHaveLength(0);
    const t = (await brouillon(r.videoId)).tache!;
    expect(t).toMatchObject({ statut: "erreur", message: expect.stringMatching(/^Plafond de cette vidéo atteint .* rien n'a été payé\.$/) });
    expect(await depots().tracesScriptsTableau.obtenir(r.traceId)).toMatchObject({ issue: "refuse", motifs: [expect.stringMatching(/Plafond de cette vidéo atteint/)] });
  });
});

describe("méthode courte (réglage `tableau.methode`, défaut depuis le lot A5)", () => {
  it("le prix au bouton suit le réglage ; la tâche garde la méthode confirmée ; effort moyen ; plafond couvrant les quatre appels", async () => {
    expect(await creation.methodeEcritureTableau()).toBe("courte");
    const courte = await prix();
    await ecrireParametre("tableau.methode", "complete");
    const complete = await prix();
    await ecrireParametre("tableau.methode", "courte");
    expect(courte).toBeLessThan(complete * 0.75);
    // Plafond : les quatre appels de la méthode courte, au pire, réservations comprises.
    const plafondUsd = (await creation.pireCasEcritureUsd("courte")) * (1 + MARGE_CREDITS);
    const socle = await socleWillTableau();
    const pire = (r: RequeteClaude, passe: "angle" | "ecriture" | "relance" | "relecture") => {
      const { role, entree } = roleDeRequete(r, passe, socle);
      return pireCasRole(role, entree);
    };
    const defauts = [{ code: "accroche-salutation" as const, message: "Pas de salutation dans l'accroche.", eliminatoire: true }];
    const passes = [pire(requeteAngle(DEMANDE, "courte"), "angle"), pire(requeteEcriture(DEMANDE, ANGLE, undefined, {}, "courte"), "ecriture"), pire(requeteEcriture(DEMANDE, ANGLE, { defauts, precedente: ecritureModele() }, {}, "courte"), "relance"), pire(requeteRelecture(DEMANDE, ANGLE, ecritureModele(), "courte"), "relecture")];
    for (let i = 0; i < passes.length; i++) expect(passes.slice(0, i).reduce((s, x) => s + x, 0) + passes[i] * (1 + MARGE_CREDITS)).toBeLessThanOrEqual(plafondUsd);

    const efforts: string[] = [];
    const sim = clientSimule([ANGLE, ecritureModele(), relecture(ecritureModele())]);
    const client = { ...sim.client, appeler: (r: RequeteClaude, passe: string) => (efforts.push(`${passe}:${r.effort}:${r.maxTokens}`), sim.client.appeler(r, passe)) };
    const r = await creation.ecrireScriptTableau(DEMANDE, { accord: courte }, { client });
    if (r.statut !== "en-cours") throw new Error(JSON.stringify(r));
    // Depuis le lot A5 la tâche note TOUJOURS sa méthode, même quand c'est le défaut.
    expect((await brouillon(r.videoId)).tache).toMatchObject({ methode: "courte" });
    // Le réglage repasse sur « complete » après la confirmation : la tâche garde la méthode dont le prix a été confirmé.
    await ecrireParametre("tableau.methode", "complete");
    await creation.travaillerTachesTableau({ client });
    expect(efforts).toEqual(["angle:medium:8000", "ecriture:medium:20000", "relecture:medium:8000"]);
    expect((await brouillon(r.videoId)).tache).toMatchObject({ statut: "terminee" });
   }, 30_000);

  it("une tâche d'AVANT le lot A5 (sans champ methode) reste lue « complete » à la reprise ; une nouvelle l'écrit toujours", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await ecrireParametre("tableau.methode", "complete");
    const complete = await prix();
    await ecrireParametre("tableau.methode", "courte");
    const courte = await prix();
    expect(courte).toBeLessThan(complete);
    const { client } = clientSimule([new Error("panne")]);
    const r = await creation.ecrireScriptTableau(DEMANDE, { accord: courte }, { client });
    if (r.statut !== "en-cours") throw new Error(JSON.stringify(r));
    await creation.travaillerTachesTableau({ client });
    const v = (await depots().videos.obtenir(r.videoId))!;
    const b = creation.lireBrouillonTableau(v)!;
    expect(b.tache).toMatchObject({ statut: "erreur", methode: "courte" });
    const { methode: _m, ...ancienne } = b.tache!;
    void _m;
    await depots().videos.modifier(v.id, { entrees: { ...v.entrees, tableauCreation: { ...b, tache: ancienne } } });
    expect(await creation.reprendreTacheTableau(r.videoId)).toMatchObject({ statut: "accord-requis", centimes: complete });
  });

  it("« Reprendre » une écriture : prix affiché, plafond et accord de la méthode de la TÂCHE, pas du réglage actuel", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await ecrireParametre("tableau.methode", "complete");
    const complete = await prix();
    await ecrireParametre("tableau.methode", "courte");
    const courte = await prix();
    for (const [lancee, apres, attendu, autre] of [["courte", "complete", courte, complete], ["complete", "courte", complete, courte]] as const) {
      await ecrireParametre("tableau.methode", lancee);
      const { client } = clientSimule([new Error("panne")]);
      const r = await creation.ecrireScriptTableau(DEMANDE, { accord: attendu }, { client });
      if (r.statut !== "en-cours") throw new Error(JSON.stringify(r));
      await creation.travaillerTachesTableau({ client });
      expect((await brouillon(r.videoId)).tache).toMatchObject({ statut: "erreur" });
      // Le réglage change avant « Reprendre » : le prix reste celui de la méthode enregistrée sur la tâche.
      await ecrireParametre("tableau.methode", apres);
      expect(await creation.reprendreTacheTableau(r.videoId)).toMatchObject({ statut: "accord-requis", centimes: attendu });
      if (autre < attendu) expect(await creation.reprendreTacheTableau(r.videoId, autre)).toMatchObject({ statut: "accord-requis", centimes: attendu });
      expect(await creation.reprendreTacheTableau(r.videoId, attendu)).toMatchObject({ statut: "en-cours" });
      expect((await brouillon(r.videoId)).tache).toMatchObject({ pireUsd: await creation.pireCasEcritureUsd(lancee) });
      taches.tachesEnCours().clear();
    }
  }, 30_000);
});

describe("brouillon payé sans résultat gardé (comme v-ab6eb972eb39 en production)", () => {
  async function brouillonAncien(): Promise<string> {
    // Ce que l'ancienne action laissait : le brouillon (choix tirés de la demande), trois dépenses réelles, rien d'autre.
    const { client } = clientSimule([]);
    const r = await creation.ecrireScriptTableau({ ...DEMANDE, serie: "automatisations", reseau: "courts", fin: { type: "diagnostic" } }, { accord: await prix() }, { client });
    if (r.statut !== "en-cours") throw new Error(JSON.stringify(r));
    const v = (await depots().videos.obtenir(r.videoId))!;
    const { tache: _t, ...ancien } = creation.lireBrouillonTableau(v)!;
    void _t;
    await depots().videos.modifier(v.id, { entrees: { ...v.entrees, tableauCreation: ancien } });
    const date = new Date().toISOString();
    for (const [etape, c] of [["accroches", 9], ["écriture", 19], ["relance de l'écriture", 14]] as const) {
      const ligne = { etape: `Tableau · script · ${etape}`, fournisseur: "anthropic", unite: "appel", quantite: 1, prixUnitaire: { centimes: c, devise: "EUR" as const }, total: { centimes: c, devise: "EUR" as const }, nature: "reel" as const };
      await depots().depenses.enregistrer({ id: `dep-${etape}`, videoId: v.id, lignes: [ligne], total: ligne.total, date, creeLe: date, modifieLe: date } as never);
    }
    return v.id;
  }

  it("l'écran dit « Écriture interrompue » (3 appels, 0,42 €), reprend la demande connue ; la liste des brouillons aussi", async () => {
    const videoId = await brouillonAncien();
    const ecran = await creation.ecranCreationTableau(videoId);
    expect(ecran.brouillon).toMatchObject({ tache: null, generation: null, ecritureInterrompue: { appels: 3, centimes: 42 } });
    expect(ecran.brouillon!.demandeConnue).toEqual({ serie: "automatisations", sujet: DEMANDE.sujet, reseau: "courts", fin: { type: "diagnostic" } });
    const html = renderToStaticMarkup(createElement(NouvelleVideoTableau, { ecran }));
    expect(html).toContain("Écriture interrompue");
    expect(html).toMatch(/3 appels à Claude \(0,42\s€\)/);
    expect(html).toContain("Reprendre l&#x27;écriture");
    expect(html).toContain("environ 3 minutes");
    expect(ecran.recents).toEqual([expect.objectContaining({ videoId, etat: "Écriture interrompue" })]);
    const liste = renderToStaticMarkup(createElement(BrouillonsRecentsTableau, { recents: ecran.recents, courant: videoId }));
    expect(liste).toContain(`/tableau/nouvelle?brouillon=${videoId}`);
    expect(liste).toContain("Écriture interrompue");
  });

  it("« Reprendre l'écriture » relance sans erreur, sur le même brouillon", async () => {
    const videoId = await brouillonAncien();
    const { client, passes } = clientSimule([ANGLE, ecritureModele(), relecture(ecritureModele())]);
    // La demande, complétée à l'écran (ici celle du script modèle).
    const r = await creation.ecrireScriptTableau(DEMANDE, { videoId, accord: await prix() }, { client });
    expect(r).toMatchObject({ statut: "en-cours", videoId });
    await creation.travaillerTachesTableau({ client });
    expect(passes).toEqual(["angle", "ecriture", "relecture"]);
    const b = await brouillon(videoId);
    expect(b.tache).toMatchObject({ statut: "terminee" });
    expect(b.generation?.issue.ok).toBe(true);
    expect((await creation.ecranCreationTableau(videoId)).brouillon!.ecritureInterrompue).toBeNull();
  });
});

describe("les autres actions du parcours restent courtes", () => {
  it("corriger et fabriquer sont refusées en clair pendant une tâche (aucune attente)", async () => {
    const { client } = clientSimule([]);
    const r = await creation.ecrireScriptTableau(DEMANDE, { accord: await prix() }, { client });
    if (r.statut !== "en-cours") throw new Error(JSON.stringify(r));
    expect(await creation.corrigerFicheTableau(r.videoId, [])).toMatchObject({ statut: "refusee", phrase: expect.stringMatching(/déjà en cours/) });
    expect(await creation.fabriquerVideoTableau(r.videoId, 100)).toMatchObject({ statut: "refusee", phrase: expect.stringMatching(/déjà en cours/) });
    expect(await creation.ecrireScriptTableau(DEMANDE, { videoId: r.videoId, accord: await prix() }, { client })).toMatchObject({ statut: "refusee", phrase: expect.stringMatching(/déjà en cours/) });
  });

  it("à l'écran pendant le travail : l'avancement en clair, « vous pouvez fermer », boutons en attente", async () => {
    const { client } = clientSimule([]);
    const r = await creation.ecrireScriptTableau(DEMANDE, { accord: await prix() }, { client });
    if (r.statut !== "en-cours") throw new Error(JSON.stringify(r));
    await taches.modifierTache(r.videoId, null, (t) => t && { ...t, statut: "en-cours", etape: "ecriture" });
    const ecran = await creation.ecranCreationTableau(r.videoId);
    const html = renderToStaticMarkup(createElement(NouvelleVideoTableau, { ecran }));
    expect(html).toContain("J&#x27;écris le script…");
    expect(html).toContain("Vous pouvez fermer cette page");
    expect(ecran.recents[0]).toMatchObject({ videoId: r.videoId, etat: "Écriture en cours" });
  });
});

describe("la boucle de fond fait le travail", () => {
  it("un tour lance les tâches du tableau HORS du tour (tâche annexe)", async () => {
    const fiche = ficheErreurCorrigee;
    const donnees = { texte: texteScriptDe(fiche), serieCode: "formation", structure: fiche.structure, douleur: fiche.douleur, gesteMinute: fiche.gesteMinute, finId: null, reseaux: ["verticaux"] };
    const r = await decouperConfirme(donnees, AUJOURDHUI_EXEMPLES);
    if (r.statut !== "en-cours") throw new Error(JSON.stringify(r));
    await boucle.contenuDuTour({ synchroBuffer: async () => undefined });
    await boucle.annexesEnVol().get(taches.NOM_ANNEXE_TABLEAU);
    // Claude n'est pas relié ici : le découpage s'arrête proprement (refus clair), il n'est plus « en attente ».
    expect((await brouillon(r.videoId)).tache).toMatchObject({ statut: "refusee", message: expect.stringMatching(/Claude n'est pas relié/) });
  });
});
