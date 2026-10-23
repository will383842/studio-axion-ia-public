/**
 * Lot G4 · le service et la boucle d'écriture (plan v5 B.3.4, B.3.6 ; critères de la ligne G4), SANS clé :
 * - en simulation (Claude non choisi) : étape 0 gratuite, numéro au premier appel payant, rangement, notification ;
 * - avec un « Claude » branché sur un faux `fetch` (réponses enregistrées par rôle) : coût réel dans
 *   `DepenseEnregistree` à chaque appel, plafond tenu, redémarrage sans double paiement ;
 * - la boucle ne gèle rien (une minuterie voisine continue pendant une écriture) ;
 * - limite proposée : validation exigée avant « Valider les N » ; fabrication intérimaire : double toucher sans double vidéo.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { CLE_ESSAI_CLAUDE, reponseFlux, fluxReussi } from "./helpers/g0";
import { SUJETS_BANC } from "./generateur/banc/registre-banc-g4";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
// Garde-fous budget : crochet d'essai du pire cas de la chaîne (module de test, plus dans le code de production).
vi.mock("@/generateur/pire-cas", async (orig) => (await import("./helpers/pire-cas-essai")).pireCasInjectable(await orig()));
import { injecterPireCasChainePourEssai } from "./helpers/pire-cas-essai";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const bg = await import("@/services/boucle-generation");
const { ecrireParametre } = await import("@/services/_commun");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
const { ROLES_ECRITURE } = await import("@/generateur/roles");
import type { DefinitionRole } from "@/generateur/roles/types";

const MDP = "essai-g4-service";
const fetchInterdit = (async () => {
  throw new Error("réseau interdit");
}) as typeof fetch;

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  // Garde-fous budget (15/10) : ce parcours ne porte pas sur le pire cas de la chaîne (testé dans garde-fous-budget).
  injecterPireCasChainePourEssai(0);
  reinitialiserDepots();
  reinitialiserRequete();
  bg.suspendreBoucleGeneration(true);
  await auth.seConnecter(MDP, false);
  // Lot A5 : réglage absent = chaîne courte ; ce test éprouve la GRANDE chaîne, il la demande donc expressément.
  (await import("@/services/generation-claude")).forcerChainePourEssai("grande");
  for (const m of SUJETS_BANC.flatMap((s) => s.matieres)) await depots().matieres.enregistrer(m);
  for (const p of SUJETS_BANC.flatMap((s) => s.preuves)) await depots().preuves.enregistrer(p);
});

afterEach(() => {
  bg.arreterBoucleGeneration();
  credits.injecterLecteursPourEssai(null);
  injecterPireCasChainePourEssai(null);
  gc.injecterClaudePourEssai(null);
});

const BRIEF = { idee: SUJETS_BANC[0].idee, reseaux: SUJETS_BANC[0].reseaux, formatId: "avocat", pilier: SUJETS_BANC[0].pilier.id, mode: "avatar" as const };

/** Faux Claude : reconnaît le rôle par sa consigne et répond par la sortie de sa simulation (jetons réalistes). */
function claudeEnregistre(compteur: Record<string, number>, couper?: (role: string) => boolean) {
  const roles = Object.values(ROLES_ECRITURE) as DefinitionRole[];
  const f = (async (_url: string | URL | Request, init?: RequestInit) => {
    const corps = JSON.parse(String(init?.body ?? "{}")) as { system: { text: string }[]; messages: { content: string }[] };
    const consigne = corps.system.at(-1)!.text;
    const role = roles.find((r) => consigne.startsWith(r.consigne.trim()))!;
    compteur[role.id] = (compteur[role.id] ?? 0) + 1;
    if (couper?.(role.id)) throw new Error("coupure réseau");
    const bloc = (b: string) => corps.system.find((x) => x.text.startsWith(`<${b}>`))?.text.replace(new RegExp(`^<${b}>\\n|\\n</${b}>$`, "g"), "");
    const sortie = role.simuler({ contexte: { contexteAxion: bloc("contexte_axion"), styleWill: bloc("style_will"), preuves: bloc("preuves"), gagnants: bloc("gagnants") }, variable: corps.messages[0].content });
    return reponseFlux(fluxReussi({ texte: JSON.stringify(sortie), modele: role.modele, entree: 2500, cacheEcrit: 1000, sortie: role.modele.includes("sonnet") ? 1200 : 2000 }));
  }) as typeof fetch;
  return f;
}

async function brancherClaude(compteur: Record<string, number>, couper?: (role: string) => boolean) {
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, fetchInterdit)], ["anthropic"]);
  await ecrireParametre("fournisseur.script", "claude");
  await credits.declarerRecharge("anthropic", 500);
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: claudeEnregistre(compteur, couper), attenteMs: () => 0 });
}

describe("G4 · lancement et étape 0", () => {
  it("hors du domaine d'Axion-IA : arrêt à 0 €, sans numéro ni écriture", async () => {
    const r = await bg.lancerGeneration({ ...BRIEF, idee: "Comment contester un PV", pilier: undefined });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.manque).toBe("HORS_DOMAINE");
    const m = await depots().scriptsMaitres.obtenir(r.scriptMaitreId);
    expect(m?.numero).toBeUndefined();
    expect(await depots().generations.compter()).toBe(0);
  });

  it("lancement : numéro pris, choix réservé, écriture « en-cours » confiée à la boucle ; prix affiché en euros", async () => {
    const r = await bg.lancerGeneration(BRIEF);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.numero).toBeGreaterThanOrEqual(1);
    expect(r.prixAffiche.centimes).toBeGreaterThan(0);
    const m = await depots().scriptsMaitres.obtenir(r.scriptMaitreId);
    expect(m?.etat).toBe("en-ecriture");
    expect(m?.choix?.structure).toBeTruthy();
    expect((await depots().generations.obtenir(r.generationId))?.statut).toBe("en-cours");
  });

  it("simulation (sans clé) : la boucle écrit, range une version par réseau et prévient Will ; 0 € dépensé", async () => {
    const r = await bg.lancerGeneration(BRIEF);
    if (!r.ok) throw new Error("lancement");
    expect(await bg.tourBoucleGeneration()).toBe(r.generationId);
    const variantes = await depots().variantes.lister((v) => v.scriptMaitreId === r.scriptMaitreId);
    expect(variantes.map((v) => v.reseau).sort()).toEqual([...BRIEF.reseaux].sort());
    expect(variantes.every((v) => v.code.startsWith(String(r.numero).padStart(4, "0")))).toBe(true);
    expect((await depots().generations.obtenir(r.generationId))?.statut).toBe("terminee");
    const notes = await depots().notifications.lister((n) => n.titre.startsWith("Vos 3 versions"));
    expect(notes).toHaveLength(1);
    expect((await depots().depenses.lister()).filter((d) => d.lignes.some((l) => l.fournisseur === "anthropic"))).toEqual([]);
    const m = await depots().scriptsMaitres.obtenir(r.scriptMaitreId);
    expect(m?.angle?.probleme).toBeTruthy();
    expect(m?.angle?.cout).toBeTruthy();
  });
});

describe("G4 · Claude branché (faux fetch, réponses enregistrées)", () => {
  it("chaque appel a son coût réel dans DepenseEnregistree, rattaché au sujet ; total sous le plafond de 1,50 $", async () => {
    const compte: Record<string, number> = {};
    await brancherClaude(compte);
    const r = await bg.lancerGeneration(BRIEF);
    if (!r.ok) throw new Error("lancement");
    await bg.tourBoucleGeneration();
    const g = await depots().generations.obtenir(r.generationId);
    expect(g?.statut).toBe("terminee");
    const deps = (await depots().depenses.lister()).filter((d) => d.scriptMaitreId === r.scriptMaitreId && d.lignes.some((l) => l.fournisseur === "anthropic"));
    expect(deps.length).toBe(g!.etapes.length);
    expect(gc.depenseGenerationUsd(g!)).toBeLessThanOrEqual(1.5);
    expect(compte.stratege).toBe(1);
    expect(compte.prose).toBeGreaterThanOrEqual(1);
  });

  it("redémarrage après une coupure pendant la prose : on repart de la dernière étape terminée, rien n'est repayé", async () => {
    const compte: Record<string, number> = {};
    let coupe = true;
    await brancherClaude(compte, (role) => role === "prose" && coupe);
    const r = await bg.lancerGeneration(BRIEF);
    if (!r.ok) throw new Error("lancement");
    await bg.tourBoucleGeneration();
    // Garde-fous budget (15/10) : arrêtée dès la coupure ; seul « Reprendre l'écriture » (accord sur le supplément) relance.
    expect((await depots().generations.obtenir(r.generationId))?.statut).toBe("echec");
    const avant = { ...compte };
    coupe = false;
    await bg.tourBoucleGeneration();
    expect(compte.prose).toBe(avant.prose);
    expect(await bg.reprendreEcritureArretee(r.scriptMaitreId, (await bg.ecritureArretee(r.scriptMaitreId))?.supplement?.centimes)).toBe(true);
    await bg.tourBoucleGeneration();
    expect((await depots().generations.obtenir(r.generationId))?.statut).toBe("terminee");
    expect(compte.stratege).toBe(avant.stratege);
    expect(compte.fond).toBe(avant.fond);
    expect(compte.accroches).toBe(avant.accroches);
    expect(compte.plan).toBe(avant.plan);
  });

  it("la boucle ne gèle rien : une minuterie voisine (boucle HeyGen, file de fabrication) avance pendant l'écriture", async () => {
    const compte: Record<string, number> = {};
    await brancherClaude(compte);
    const lent = claudeEnregistre(compte);
    gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: (async (u: string, i: RequestInit) => (await new Promise((ok) => setTimeout(ok, 15)), lent(u, i))) as typeof fetch, attenteMs: () => 0 });
    const r = await bg.lancerGeneration(BRIEF);
    if (!r.ok) throw new Error("lancement");
    let ticks = 0;
    const t = setInterval(() => ticks++, 5);
    await bg.tourBoucleGeneration();
    clearInterval(t);
    expect(ticks).toBeGreaterThan(5);
  });
});

describe("G4 · limite, retouches, fabrication intérimaire", () => {
  async function sujetEcrit(brief = BRIEF) {
    const r = await bg.lancerGeneration(brief);
    if (!r.ok) throw new Error("lancement");
    await bg.tourBoucleGeneration();
    return r;
  }

  it("limite proposée par la machine : « Valider les N » refusé tant que Will ne l'a pas validée, puis accepté", async () => {
    // Aucune limite dans le stock : la machine ne peut que la PROPOSER (K19).
    for (const m of await depots().matieres.lister((x) => x.type === "limite")) await depots().matieres.modifier(m.id, { archiveLe: new Date().toISOString() });
    const r = await sujetEcrit({ ...BRIEF, idee: SUJETS_BANC[1].idee, reseaux: SUJETS_BANC[1].reseaux, pilier: SUJETS_BANC[1].pilier.id });
    const m = await depots().scriptsMaitres.obtenir(r.scriptMaitreId);
    expect(m?.exception?.source).toBe("proposition-machine");
    const ids = (await depots().variantes.lister((v) => v.scriptMaitreId === r.scriptMaitreId)).map((v) => v.id);
    await expect(bg.validerVariantes(ids)).rejects.toThrow(/limite proposée/);
    await bg.validerException(r.scriptMaitreId, "c-est-juste");
    const apres = await depots().scriptsMaitres.obtenir(r.scriptMaitreId);
    expect(apres?.exception?.valideeParWill).toBe(true);
    expect(apres?.exception?.matiereId).toBeTruthy();
    expect(await bg.validerVariantes(ids)).toBeGreaterThan(0);
  });

  it("l'emplacement « [LIMITE À VALIDER] » est remplacé par le code à la validation (nouvelle version du texte)", async () => {
    const r = await sujetEcrit();
    const s = (await depots().scripts.lister((x) => x.scriptMaitreId === r.scriptMaitreId))[0];
    await depots().scripts.modifier(s.id, { blocs: [...s.blocs, { id: "b-lim", blocRecette: s.blocs.at(-1)!.blocRecette, segments: [{ id: "s-lim", texte: "[LIMITE À VALIDER]" }] }] });
    await bg.validerException(r.scriptMaitreId, { texte: "Si vos tableaux changent de forme chaque mois, gardez le tableur." });
    const derniers = (await depots().scripts.lister((x) => x.scriptMaitreId === r.scriptMaitreId)).sort((a, b) => b.version - a.version);
    const texte = derniers[0].blocs.flatMap((b) => b.segments.map((x) => x.texte)).join(" ");
    expect(texte).toContain("gardez le tableur");
    expect(texte).not.toContain("[LIMITE À VALIDER]");
  });

  it("« Fabriquer » : deux touchers avec la même opération → une seule vidéo, rattachée à la version (réseau, version)", async () => {
    const r = await sujetEcrit();
    const v = (await depots().variantes.lister((x) => x.scriptMaitreId === r.scriptMaitreId))[0];
    await depots().variantes.modifier(v.id, { etat: "validee" });
    const avant = await depots().videos.compter();
    const [a, b] = await Promise.all([bg.fabriquerVariante(v.id, { operationId: "op-1", lancer: false }), bg.fabriquerVariante(v.id, { operationId: "op-1", lancer: false })]);
    expect(a.videoId).toBe(b.videoId);
    expect(await depots().videos.compter()).toBe(avant + 1);
    const video = await depots().videos.obtenir(a.videoId);
    expect(video?.varianteId).toBe(v.id);
    expect(video?.reseau).toBe(v.reseau);
  });

  it("« Plus court » : une nouvelle version du même code, l'ancienne gardée (simulation, 0 €)", async () => {
    const r = await sujetEcrit();
    let v = (await depots().variantes.lister((x) => x.scriptMaitreId === r.scriptMaitreId))[0];
    // Vérification E2E n° 1, n° 20 : sur une version au voyant « Corps court » (C12), « Plus court » est refusé.
    await depots().variantes.modifier(v.id, { controles: { ...v.controles, violations: [{ controle: "C12", message: "Corps court (8,7 s)", bloquant: false }] } });
    await expect(bg.regenererVariante(v.id, "plus-court")).rejects.toThrow(/déjà courte/);
    // Sans ce voyant : une nouvelle version du même code.
    await depots().variantes.modifier(v.id, { controles: { ...v.controles, violations: v.controles.violations.filter((x) => x.controle !== "C12") } });
    v = (await depots().variantes.obtenir(v.id))!;
    const nv = await bg.regenererVariante(v.id, "plus-court");
    expect(nv.code).toBe(v.code);
    expect(nv.version).toBe(v.version + 1);
    expect(await depots().variantes.obtenir(v.id)).toBeTruthy();
  });

  it("« + Je lis » : un corps distinct sur le même fond (les étapes 1 à 4 ne sont pas refaites)", async () => {
    const compte: Record<string, number> = {};
    await brancherClaude(compte);
    const r = await sujetEcrit();
    const avant = { ...compte };
    const r2 = await bg.ajouterDeclinaison(r.scriptMaitreId, { mode: "teleprompteur" });
    expect(r2.ok).toBe(true);
    await bg.tourBoucleGeneration();
    expect(compte.stratege).toBe(avant.stratege);
    expect(compte.accroches).toBe(avant.accroches);
    expect(compte.prose).toBeGreaterThan(avant.prose);
    const v = (await depots().variantes.lister((x) => x.scriptMaitreId === r.scriptMaitreId)).filter((x) => /-L(-T)?$/.test(x.code));
    expect(v.length).toBeGreaterThan(0);
    expect(v[0].prompteur).toBeTruthy();
  });
});
