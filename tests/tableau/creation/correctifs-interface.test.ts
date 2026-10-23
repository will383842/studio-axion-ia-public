/**
 * CORRECTIFS DE L'INTERFACE DU TABLEAU ANIMÉ (constats du 12/10 en production) :
 *  - « Garder la meilleure version » d'une trace existante (comme `tst-7b134036628e` du brouillon `v-ab6eb972eb39` :
 *    trois versions, dont deux valides hors durée ; la relue sans étapes), SANS aucun appel payant ;
 *  - un découpage refusé reste affiché durablement (message, motifs, « Réessayer ») ;
 *  - la fin « Réservez votre appel de diagnostic » s'affiche « Un appel de diagnostic » ; les fins « À valider » sont
 *    masquées derrière « Voir les fins non validées » ;
 *  - le journal du découpage garde la réponse brute tronquée à 20 000 caractères.
 * Dépôts en mémoire, aucun appel réseau, rien de payé.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";
import { preparerMotDePasse } from "../../helpers/g1a";
import { CRITERES_GRILLE, type DemandeScriptTableau, type TraceScriptTableau } from "@/domaine/scripts-tableau";
import { DEMANDE_MODELE, ecritureModele } from "../../tableau-scripts/modele-valide";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ replace() {}, push() {}, refresh() {} }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const aiguillage = vi.hoisted(() => ({ ouvert: true }));
vi.mock("@/components/formats/tableau-anime/aiguillage", async (original) => {
  const vrai = await original<typeof import("../../../src/components/formats/tableau-anime/aiguillage")>();
  return { ...vrai, ecranTableauVisible: (f: { id: string; statut: string } | null | undefined) => (aiguillage.ouvert ? vrai.ecranTableauVisible(f as never) : false) };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const creation = await import("@/services/tableau-creation");
const { BRUT_MAX_JOURNAL, reponsePourJournal, nouvelleTache, vueTache } = await import("@/services/tableau-taches");
const { NouvelleVideoTableau } = await import("@/components/formats/tableau-anime/NouvelleVideoTableau");
const { SuiviTacheTableau } = await import("@/components/formats/tableau-anime/SuiviTacheTableau");

const MDP = "tableau-correctifs-interface";

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  aiguillage.ouvert = true;
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

/** Demande sur le modèle de la trace réelle du 12/10 (série Automatisations, réseau courts) ; la fin est celle du script modèle. */
const DEMANDE: DemandeScriptTableau = { ...DEMANDE_MODELE, serie: "automatisations", reseau: "courts" };

/**
 * Une trace comme `tst-7b134036628e` : écriture et relance valides (≈ 46 s, refusées hier pour la durée), puis la
 * relecture. `relueSansEtapes` : la relecture a rendu un AUTRE texte, sans étapes (le cas réel) ; sinon elle n'a rien
 * changé à la relance (même texte, que sa grille note).
 */
async function brouillonAvecTrace(relueSansEtapes = false): Promise<{ videoId: string; traceId: string }> {
  const ecriture = ecritureModele();
  const relance = ecritureModele();
  relance.script.aRetenir[0].dit = "Une fiche à jour évite d'appeler au secours.";
  const relue = structuredClone(relance);
  if (relueSansEtapes) relue.script.etapes = [];
  const traceId = "tst-7b134036628e";
  const date = new Date().toISOString();
  const trace: TraceScriptTableau = {
    id: traceId,
    creeLe: date,
    modifieLe: date,
    date,
    issue: "refuse",
    demande: DEMANDE,
    accroches: [],
    retenue: 0,
    raison: "",
    versions: [
      { passe: "ecriture", ecriture, defauts: [{ code: "duree-reseau", message: "Le script dure environ 46 s : 30 à 45 s.", eliminatoire: true }] },
      { passe: "relance", ecriture: relance, defauts: [{ code: "duree-reseau", message: "Le script dure environ 46 s : 30 à 45 s.", eliminatoire: true }] },
      { passe: "relecture", ecriture: relue, defauts: [{ code: "nombre-etapes", message: "0 étape : la méthode en compte 3 à 5.", eliminatoire: true }] },
    ],
    grille: CRITERES_GRILLE.map((c) => ({ critere: c.id, respecte: true, remarque: "" })),
    note: 10,
    motifs: ["La version relue échoue aux contrôles :", "0 étape : la méthode en compte 3 à 5."],
    appels: [],
    coutUsd: 0.8,
    simule: false,
  };
  await depots().tracesScriptsTableau.enregistrer(trace);
  const modele = (await depots().videos.obtenir("v-04"))!;
  const videoId = "v-ab6eb972eb39";
  const tache = { ...nouvelleTache("ecriture", "relecture", { demande: DEMANDE, traceId }), statut: "refusee" as const };
  await depots().videos.enregistrer({
    ...modele,
    id: videoId,
    estDemo: false,
    formatId: "tableau-anime",
    statut: "brouillon",
    entrees: { tableauCreation: { donnees: { texte: "", serieCode: "automatisations", structure: "demonstration", douleur: "Relances de devis", gesteMinute: "Relances de devis", finId: "fin-if-mot-envoi", reseaux: ["verticaux"] }, versions: [], tache, generation: { traceId, demande: DEMANDE, le: date, issue: { ok: false, motifs: trace.motifs } } } },
  });
  return { videoId, traceId };
}

describe("reprendre la meilleure version d'une trace, sans nouvel appel", () => {
  it("l'écran la propose ; la reprise livre la dernière version valide, avec la note de la relecture qui l'a jugée", async () => {
    const { videoId, traceId } = await brouillonAvecTrace();
    const ecran = await creation.ecranCreationTableau(videoId);
    expect(ecran.brouillon?.repriseTrace).toBe(true);
    const html = renderToStaticMarkup(createElement(NouvelleVideoTableau, { ecran }));
    expect(html).toContain("Garder la meilleure version (sans nouvel appel)");

    const depenses = await depots().depenses.compter();
    const r = await creation.reprendreMeilleureVersionTableau(videoId);
    expect(r).toEqual({ statut: "reprise", livre: true });
    // Aucun appel payant : ni dépense, ni réservation ; la trace n'est pas modifiée.
    expect(await depots().depenses.compter()).toBe(depenses);
    expect(await depots().reservations.compter()).toBe(0);
    expect((await depots().tracesScriptsTableau.obtenir(traceId))?.issue).toBe("refuse");

    const apres = await creation.ecranCreationTableau(videoId);
    const g = apres.brouillon!.generation!;
    expect(g.reprise).toBe(true);
    expect(g.issue.ok).toBe(true);
    if (!g.issue.ok) return;
    expect(g.issue.resultat.note).toBe(10);
    expect(g.issue.resultat.script.etapes.length).toBeGreaterThanOrEqual(3);
    expect(g.issue.resultat.script.aRetenir[0].dit).toContain("évite d'appeler au secours");
    expect(g.proposition?.texte).toContain("évite d'appeler au secours");
    expect(apres.brouillon?.tache?.statut).toBe("terminee");
    expect(apres.brouillon?.repriseTrace).toBe(false);
  });

  it("BOGUE du 15/10 : relue sans étapes, la relance est gardée mais n'emprunte PAS la note de la relecture", async () => {
    const { videoId } = await brouillonAvecTrace(true);
    expect(await creation.reprendreMeilleureVersionTableau(videoId)).toEqual({ statut: "reprise", livre: false });
    const g = (await creation.ecranCreationTableau(videoId)).brouillon!.generation!;
    expect(g.issue.ok).toBe(false);
    if (g.issue.ok) return;
    expect(g.issue.motifs.join(" ")).toMatch(/la version gardée n'a pas été notée/);
    expect(g.issue.meilleure).toMatchObject({ passe: "relance", valide: true });
  });
});

describe("découpage refusé : affichage durable", () => {
  it("le message, les motifs et « Reprendre » restent à l'écran", () => {
    const t = { ...nouvelleTache("decoupage", "decoupage"), statut: "refusee" as const, message: "Découpage refusé par les règles. « Reprendre » refait un découpage.", motifs: ["Scène s01 : le mot 5 du texte dit est « floues »."] };
    const html = renderToStaticMarkup(createElement(SuiviTacheTableau, { videoId: "v-x", initiale: vueTache(t, true), coutEcritureCentimes: 100, coutDecoupageCentimes: 80 }));
    expect(html).toContain("Découpage refusé par les règles");
    expect(html).toContain("floues");
    expect(html).toMatch(/Reprendre\s*<\/button>/);
  });
});

describe("libellés des fins", () => {
  it("« Réservez votre appel de diagnostic » s'affiche « Un appel de diagnostic »", () => {
    expect(creation.libelleFin("Réservez votre appel de diagnostic")).toBe("Un appel de diagnostic");
    expect(creation.finsProposees().find((f) => f.id === "fin-if-diagnostic")).toMatchObject({ libelle: "Un appel de diagnostic", validee: false });
    expect(creation.libelleFin("Écrivez {MOT} en commentaire")).toBe("Écrivez … en commentaire");
  });

  it("les fins « À valider » sont masquées derrière « Voir les fins non validées »", async () => {
    const ecran = await creation.ecranCreationTableau();
    const brouillon = { ...ecran, brouillon: { videoId: "v-y", donnees: { texte: "Un texte", serieCode: "formation", structure: "demonstration" as const, douleur: "x", gesteMinute: "y", finId: null, reseaux: [] }, generation: null, fiche: null, problemes: [], ficheACorriger: false, coutVoixCentimes: 0, voix: "neuve" as const, versions: 0, tache: null, ecritureInterrompue: null, demandeConnue: null, repriseTrace: false, dejaVu: null, raisonFabriquer: null, raisonFabriquerCase: false } };
    const html = renderToStaticMarkup(createElement(NouvelleVideoTableau, { ecran: brouillon }));
    expect(html).toContain("Voir les fins non validées");
    expect(html).not.toContain("Un appel de diagnostic");
    expect(html).not.toContain("Réservez votre appel de diagnostic");
    expect(html).not.toContain("À valider");
  });
});

describe("journal du découpage", () => {
  it("la réponse brute est gardée, tronquée à 20 000 caractères", () => {
    const longue = "x".repeat(BRUT_MAX_JOURNAL + 500);
    const r = reponsePourJournal({ ok: true, simule: false, donnees: longue, stopReason: "max_tokens", coutUsd: 0.2 });
    expect(r.ok && typeof r.donnees === "string" && r.donnees.length).toBe(BRUT_MAX_JOURNAL);
    expect(r).toMatchObject({ stopReason: "max_tokens", coutUsd: 0.2 });
  });
});
