/** S1.9 — rôle Claude « passeport » : derrière un réglage éteint, jamais à l'affichage, prix dit avant, double de test. */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";
import { CLE_ESSAI_CLAUDE, fluxReussi, reponseFlux } from "../helpers/g0";
import { preparerBase, preparerMotDePasse, MDP_SITE } from "./helpers";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { depots } = await import("@/donnees/memoire");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const pub = await import("@/services/publications");
const site = await import("@/services/site-videos");
const { ecrireParametre, ErreurStudio } = await import("@/services/_commun");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
const { rolePasseportWeb, evaluerPasseportWeb, entreePasseportWeb } = await import("@/generateur/roles/passeport-web");

const fetchInterdit = (async () => {
  throw new Error("réseau interdit");
}) as typeof fetch;

const VALIDE = {
  titreWeb: "Automatiser ses devis en dix minutes",
  resume: "Un devis prend trop de temps : voici la méthode en trois gestes pour le faire en dix minutes, sans outil compliqué, avec un modèle que vous réutilisez à chaque fois.",
  aRetenir: ["Un modèle suffit.", "Dix minutes par devis.", "Aucun outil à payer."],
  questions: [
    { question: "Faut-il un logiciel ?", reponse: "Non, un modèle suffit." },
    { question: "Combien de temps ?", reponse: "Dix minutes par devis." },
  ],
  rubrique: "Automatisation",
  motsCles: ["devis", "automatisation"],
};

let appels: Record<string, unknown>[] = [];
/** Claude répond ces sorties dans l'ordre (la dernière se répète) ; chaque requête est gardée. */
function brancherClaude(sorties: unknown[]) {
  const f = (async (_u: string | URL | Request, init?: RequestInit) => {
    appels.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
    const sortie = sorties[Math.min(appels.length - 1, sorties.length - 1)];
    return reponseFlux(fluxReussi({ texte: JSON.stringify(sortie), modele: "claude-sonnet-5-5" }));
  }) as typeof fetch;
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: f, attenteMs: () => 0 });
}

let videoId = "";
beforeAll(async () => {
  await preparerMotDePasse(MDP_SITE);
});
beforeEach(async () => {
  await preparerBase();
  appels = [];
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, fetchInterdit)], ["anthropic"]);
  await ecrireParametre("fournisseur.texte-reseaux", "claude");
  await credits.declarerRecharge("anthropic", 500);
  videoId = (await depots().videos.lister((x) => x.statut === "prete" && !!x.scriptId))[0].id;
  await pub.obtenirKit(videoId);
});
afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  gc.injecterClaudePourEssai(null);
});

describe("S1.9 rôle « passeport » (pur)", () => {
  it("la simulation du rôle passe toutes ses évaluations et la requête porte le texte validé", async () => {
    const p = (await site.passeportDeLaVideo(videoId))!;
    const entree = entreePasseportWeb({ titre: p.titreWeb, texteValide: p.transcription });
    expect(entree.variable).toContain(p.transcription.slice(0, 30));
    const sortie = rolePasseportWeb.simuler(entree) as typeof VALIDE;
    expect(evaluerPasseportWeb(sortie)).toEqual([]);
    expect(sortie.aRetenir).toHaveLength(3);
  });

  it("les évaluations refusent un titre trop long, 2 « À retenir », une seule question", () => {
    expect(evaluerPasseportWeb({ ...VALIDE, titreWeb: "x".repeat(61) }).length).toBeGreaterThan(0);
    expect(evaluerPasseportWeb({ ...VALIDE, aRetenir: ["un", "deux"] }).length).toBeGreaterThan(0);
    expect(evaluerPasseportWeb({ ...VALIDE, questions: [VALIDE.questions[0]] }).length).toBeGreaterThan(0);
    expect(evaluerPasseportWeb(VALIDE)).toEqual([]);
  });
});

describe("S1.9 geste « Réécrire avec Claude »", () => {
  it("réglage éteint → aucun appel, même sur le geste", async () => {
    brancherClaude([VALIDE]);
    await expect(site.reecrirePasseport(videoId)).rejects.toBeInstanceOf(ErreurStudio);
    expect(appels).toHaveLength(0);
    expect(await site.prixReecriturePasseport(videoId)).toBeNull();
  });

  it("réglage allumé : le passeport est rempli, origines « claude », version +1, un seul appel", async () => {
    await ecrireParametre("site.passeportParClaude", true);
    brancherClaude([VALIDE]);
    const avant = (await site.passeportDeLaVideo(videoId))!;
    const p = await site.reecrirePasseport(videoId);
    expect(appels).toHaveLength(1);
    expect(p.titreWeb).toBe(VALIDE.titreWeb);
    expect(p.resume).toBe(VALIDE.resume);
    expect(p.aRetenir).toEqual(VALIDE.aRetenir);
    expect(p.questions).toEqual(VALIDE.questions);
    expect(p.rubrique).toBe("Automatisation");
    expect(p.motsCles).toEqual(VALIDE.motsCles);
    for (const c of ["titreWeb", "resume", "aRetenir", "questions", "rubrique", "motsCles"] as const) expect(p.origines[c]).toBe("claude");
    expect(p.version).toBe(avant.version + 1);
    // Coût réel enregistré sur la vidéo.
    expect((await depots().depenses.lister((d) => d.videoId === videoId)).some((d) => d.lignes.some((l) => l.fournisseur === "anthropic"))).toBe(true);
  });

  it("réponse invalide → une reprise ciblée, puis le passeport est écrit", async () => {
    await ecrireParametre("site.passeportParClaude", true);
    brancherClaude([{ ...VALIDE, aRetenir: ["un seul"] }, VALIDE]);
    const p = await site.reecrirePasseport(videoId);
    expect(appels).toHaveLength(2);
    expect(JSON.stringify(appels[1])).toContain("corrections_demandees");
    expect(p.aRetenir).toHaveLength(3);
  });

  it("deux réponses invalides → échec propre, passeport inchangé", async () => {
    await ecrireParametre("site.passeportParClaude", true);
    brancherClaude([{ ...VALIDE, aRetenir: [] }]);
    const avant = (await site.passeportDeLaVideo(videoId))!;
    await expect(site.reecrirePasseport(videoId)).rejects.toBeInstanceOf(ErreurStudio);
    expect(appels).toHaveLength(2);
    expect(await site.passeportDeLaVideo(videoId)).toEqual(avant);
  });

  it("la retouche de Will gagne : son titre n'est pas écrasé", async () => {
    await ecrireParametre("site.passeportParClaude", true);
    brancherClaude([VALIDE]);
    await site.modifierPasseport(videoId, { titreWeb: "Mon titre à moi" });
    const p = await site.reecrirePasseport(videoId);
    expect(p.titreWeb).toBe("Mon titre à moi");
    expect(p.origines.titreWeb).toBe("will");
    expect(p.origines.resume).toBe("claude");
  });

  it("jamais à l'affichage : le kit, même Claude allumé, ne fait aucun appel", async () => {
    await ecrireParametre("site.passeportParClaude", true);
    brancherClaude([VALIDE]);
    await pub.obtenirKit(videoId);
    await pub.obtenirKit(videoId);
    await site.passeportDeLaVideo(videoId);
    expect(appels).toHaveLength(0);
  });

  it("le prix est dit avant le geste et ne coûte aucun appel", async () => {
    await ecrireParametre("site.passeportParClaude", true);
    brancherClaude([VALIDE]);
    const prix = await site.prixReecriturePasseport(videoId);
    expect(prix).not.toBeNull();
    expect(prix!.centimes).toBeGreaterThan(0);
    expect(appels).toHaveLength(0);
  });
});
