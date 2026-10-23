/**
 * VÉRIFICATEUR A1 — générateur de scripts du format AVOCAT, de l'idée à la version validée prête à fabriquer.
 *
 * Claude est DOUBLÉ (le vrai fournisseur, servi par un faux `fetch` qui répond la sortie simulée de chaque rôle) ;
 * tout autre `fetch` fait échouer le test. Aucun appel réel, aucune vraie clé.
 *
 *  1. Constat prod du 09/10 : un TEXTE COMPLET collé (« Une phrase à vous » ou l'idée) était refusé « Pas assez de
 *     matière pour une vidéo » : le texte entier devenait UNE matière d'un seul type (« limite »), et la carte disait
 *     « il manque le pourquoi » à un texte qui le contenait. Désormais il est découpé MOT POUR MOT en matières typées ;
 *     s'il manque encore quelque chose, la carte le dit ET indique le chemin « Coller » (texte gardé tel quel).
 *  2. Règles de Will, de bout en bout : rien d'inventé (chiffre sans preuve refusé), vouvoiement, français, très peu de
 *     texte à l'écran, durée par réseau, plafond du sujet (≤ 1,50 $ ≈ 1,35 €) tenu y compris en reprise, rien ne part
 *     sans accord (« Valider les N », « Fabriquer » au-delà du seuil).
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { CLE_ESSAI_CLAUDE, fluxReussi, reponseFlux } from "./helpers/g0";
import { SUJETS_BANC } from "./generateur/banc/registre-banc-g4";
import type { DefinitionRole } from "@/generateur/roles/types";

Object.assign(process.env, { ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE, FOURNISSEUR_SCRIPT: "claude" });

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
const { proposerTypeMatiere } = await import("@/domaine/derivations-generateur");
const { decouperTexteWill, estTexteColle } = await import("@/domaine/matieres");
const { PLAFOND_SUJET_USD, PLAFOND_SUPPLEMENT_USD } = await import("@/services/generateur");
const { centimes } = await import("@/lib/montants");
const { ecritureReseau } = await import("@/reseaux/ecriture");

const MDP = "essai-a1-generateur-avocat";
const SUJET = SUJETS_BANC[0];

/** Le texte collé du constat (reconstitué) : situation, pourquoi, solution, limite. Aucun chiffre. */
const TEXTE_COLLE = `Chaque vendredi soir, dans beaucoup de PME, quelqu'un relance les devis à la main. Il ouvre le tableur, cherche les devis sans réponse, copie l'adresse, écrit le même courriel.

Parce que personne n'a le temps en semaine, les relances partent tard, et les clients ont déjà signé ailleurs. Un assistant peut repérer les devis sans réponse au bout d'une semaine, préparer la relance avec le nom du client, et vous la soumettre. Vous validez d'un toucher.

Attention : ça ne marche pas si vos devis ne sont pas dans un seul outil. Commencez par les rassembler.`;

/* ------------------------------------------------------------------ */
/* Double de Claude                                                     */
/* ------------------------------------------------------------------ */

const claude = { appels: {} as Record<string, number>, remplacer: {} as Record<string, (sortie: unknown) => unknown> };
function fauxClaude(): typeof fetch {
  const roles = Object.values(ROLES_ECRITURE) as DefinitionRole[];
  return (async (url: string | URL | Request, init?: RequestInit) => {
    if (!String(url).includes("anthropic")) throw new Error(`Adresse inattendue : ${String(url)}`);
    const corps = JSON.parse(String(init?.body ?? "{}")) as { system: { text: string }[]; messages: { content: string }[] };
    const consigne = corps.system.at(-1)!.text;
    const role = roles.find((r) => consigne.startsWith(r.consigne.trim()));
    if (!role) throw new Error("Rôle Claude inattendu");
    claude.appels[role.id] = (claude.appels[role.id] ?? 0) + 1;
    const bloc = (b: string) => corps.system.find((x) => x.text.startsWith(`<${b}>`))?.text.replace(new RegExp(`^<${b}>\\n|\\n</${b}>$`, "g"), "");
    let sortie = role.simuler({ contexte: { contexteAxion: bloc("contexte_axion"), styleWill: bloc("style_will"), preuves: bloc("preuves"), gagnants: bloc("gagnants") }, variable: corps.messages[0].content });
    if (claude.remplacer[role.id]) sortie = claude.remplacer[role.id](sortie) as typeof sortie;
    return reponseFlux(fluxReussi({ texte: JSON.stringify(sortie), modele: role.modele, entree: 2500, cacheEcrit: 1000, sortie: 1500 }));
  }) as typeof fetch;
}

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  // Garde-fous budget (15/10) : ce parcours ne porte pas sur le pire cas de la chaîne (testé dans garde-fous-budget).
  injecterPireCasChainePourEssai(0);
  reinitialiserDepots();
  reinitialiserRequete();
  bg.suspendreBoucleGeneration(true);
  claude.appels = {};
  claude.remplacer = {};
  vi.stubGlobal("fetch", () => {
    throw new Error("fetch interdit (aucun appel réel)");
  });
  await auth.seConnecter(MDP, false);
  // Lot A5 : réglage absent = chaîne courte ; ce test éprouve la GRANDE chaîne, il la demande donc expressément.
  await ecrireParametre("generateur.chaine", "complete");
  await ecrireParametre("budget.seuilConfirmation", centimes(1_000_000));
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, (async () => { throw new Error("réseau interdit"); }) as typeof fetch)], ["anthropic"]);
  await credits.declarerRecharge("anthropic", 500);
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: fauxClaude(), attenteMs: () => 0 });
});

afterEach(() => {
  bg.arreterBoucleGeneration();
  credits.injecterLecteursPourEssai(null);
  injecterPireCasChainePourEssai(null);
  gc.injecterClaudePourEssai(null);
  vi.unstubAllGlobals();
});

async function banc() {
  for (const m of SUJET.matieres) await depots().matieres.enregistrer(m);
  for (const p of SUJET.preuves) await depots().preuves.enregistrer(p);
}

const IDEE_COLLE = "Relancer les devis sans y passer le vendredi soir";

/* ------------------------------------------------------------------ */
/* 1. Texte complet collé (constat prod du 09/10)                       */
/* ------------------------------------------------------------------ */

describe("A1 · texte complet collé", () => {
  it("le texte est découpé MOT POUR MOT en morceaux typés (rien de réécrit, rien d'ajouté) ; une phrase courte reste entière", () => {
    expect(estTexteColle(TEXTE_COLLE)).toBe(true);
    const morceaux = decouperTexteWill(TEXTE_COLLE);
    expect(morceaux.length).toBeGreaterThanOrEqual(3);
    const sansBlancs = (t: string) => t.replace(/\s+/g, "");
    expect(sansBlancs(morceaux.join(""))).toBe(sansBlancs(TEXTE_COLLE));
    const types = morceaux.map(proposerTypeMatiere);
    expect(types).toContain("observation");
    expect(types).toContain("limite");
    // Le « pourquoi » (« Parce que… ») n'est plus noyé dans une matière « limite ».
    expect(types[morceaux.findIndex((m) => m.startsWith("Parce que"))]).not.toBe("limite");
    // « Une phrase à vous » (1-2 phrases) : inchangée.
    expect(decouperTexteWill("Je relance toujours le lundi. C'est le jour où l'on répond.")).toEqual(["Je relance toujours le lundi. C'est le jour où l'on répond."]);
  });

  it("collé dans « Une phrase à vous » (« Je lis ») : l'écriture part, sans « Pas assez de matière » ; chaque matière vient du texte", async () => {
    const r = await bg.lancerGeneration({ idee: IDEE_COLLE, phraseWill: TEXTE_COLLE, reseaux: ["tiktok", "linkedin"], formatId: "avocat", mode: "teleprompteur" });
    expect(r.ok, JSON.stringify(r)).toBe(true);
    const mats = await depots().matieres.lister();
    expect(mats.length).toBeGreaterThanOrEqual(3);
    for (const m of mats) expect(TEXTE_COLLE.replace(/\s+/g, " ")).toContain(m.texte);
  });

  it("collé dans « Mon double » : l'écriture part aussi (le constat sur les PME sert d'appui)", async () => {
    const r = await bg.lancerGeneration({ idee: IDEE_COLLE, phraseWill: TEXTE_COLLE, reseaux: ["tiktok"], formatId: "avocat", mode: "avatar" });
    expect(r.ok, JSON.stringify(r)).toBe(true);
  });

  it("collé dans le champ de l'IDÉE (sans « Une phrase à vous ») : le texte compte comme matière de Will", async () => {
    const r = await bg.lancerGeneration({ idee: TEXTE_COLLE, reseaux: ["tiktok"], formatId: "avocat", mode: "teleprompteur" });
    expect(r.ok, JSON.stringify(r)).toBe(true);
    expect((await depots().matieres.lister()).length).toBeGreaterThanOrEqual(3);
  });

  it("un cas client dans le texte collé n'est jamais cité sans accord : il attend « J'ai son accord » sur la fiche", async () => {
    const texte = `${TEXTE_COLLE}\n\nUn client nous a dit : on perdait deux jours par mois à relancer les devis à la main.`;
    const r = await bg.lancerGeneration({ idee: IDEE_COLLE, phraseWill: texte, reseaux: ["tiktok"], formatId: "avocat", mode: "teleprompteur" });
    const sansAccord = await bg.matieresSansAccord(r.scriptMaitreId);
    expect(sansAccord.map((x) => x.type)).toEqual(["cas-client"]);
    expect(sansAccord[0].texte).toContain("deux jours par mois");
  });

  it("texte collé encore insuffisant : la carte dit ce qui manque ET le chemin « Coller » pour le garder mot pour mot ; 0 €, sans numéro", async () => {
    const court = "Les relances de devis prennent du temps. On les fait le vendredi. Personne n'aime ça.";
    const r = await bg.lancerGeneration({ idee: IDEE_COLLE, phraseWill: court, reseaux: ["tiktok"], formatId: "avocat", mode: "avatar" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.ceQuIlFaudrait).toMatch(/Il manque|Il faudrait/);
    expect(r.ceQuIlFaudrait).toMatch(/mot pour mot.*« Coller »/);
    const m = (await depots().scriptsMaitres.obtenir(r.scriptMaitreId))!;
    expect(m.numero).toBeUndefined();
    expect(m.manque?.ceQuIlFaudrait).toBe(r.ceQuIlFaudrait);
    expect(Object.keys(claude.appels)).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* 2. De l'idée à la version validée, règles de Will                    */
/* ------------------------------------------------------------------ */

async function ecrire(reseaux = SUJET.reseaux) {
  await banc();
  const r = await bg.lancerGeneration({ idee: SUJET.idee, reseaux, formatId: "avocat", pilier: SUJET.pilier.id, mode: "avatar" });
  if (!r.ok) throw new Error(`lancement refusé : ${r.ceQuIlFaudrait}`);
  await bg.tourBoucleGeneration();
  return r;
}

describe("A1 · de l'idée à la version validée (Claude doublé)", () => {
  it("une version par réseau, vouvoiement, français, peu de texte à l'écran, durée dans la zone du réseau, plafond tenu", async () => {
    const r = await ecrire();
    const g = (await depots().generations.obtenir(r.generationId))!;
    expect(g.statut, JSON.stringify(g.etapes.at(-1))).toBe("terminee");
    expect(g.essai).toBe(false);
    const depense = gc.depenseGenerationUsd(g);
    expect(depense).toBeGreaterThan(0);
    expect(depense).toBeLessThanOrEqual(PLAFOND_SUJET_USD);
    expect(PLAFOND_SUJET_USD * 0.92).toBeLessThanOrEqual(1.4); // ≈ 1,35 € au taux par défaut

    const variantes = await depots().variantes.lister((v) => v.scriptMaitreId === r.scriptMaitreId && !v.archiveLe);
    expect(new Set(variantes.map((v) => v.reseau))).toEqual(new Set(SUJET.reseaux));
    for (const v of variantes) {
      const script = (await depots().scripts.obtenir(v.scriptId))!;
      expect(script.adresse).toBe("vous");
      const blocs = [...v.ouverture, ...script.blocs, ...v.fin];
      const dit = blocs.flatMap((b) => b.segments.map((s) => s.texte)).join(" ");
      // Vouvoiement : aucun tutoiement dans le texte dit.
      expect(dit, v.code).not.toMatch(/\b(tu|te|toi|ton|ta|tes)\b/i);
      // Français (mots-outils), pas d'anglais de remplissage.
      expect(dit).toMatch(/\b(le|la|les|vous|de|des)\b/);
      // Très peu de texte à l'écran : l'encadré (5 mots au plus) et quelques incrustations courtes, rien d'autre.
      expect(v.encadre.texte.split(/\s+/).filter(Boolean).length, v.encadre.texte).toBeLessThanOrEqual(5);
      const incrustations = blocs.flatMap((b) => b.segments.map((s) => s.incrustation?.texte).filter((x): x is string => !!x));
      for (const t of incrustations) expect(t.split(/\s+/).length, t).toBeLessThanOrEqual(4);
      expect(blocs.flatMap((b) => b.segments).filter((s) => s.titreEcran).length).toBe(0);
      // Durée dans la zone du réseau (au plus la borne haute).
      const zone = ecritureReseau(v.reseau).zoneDureeSec.valeur;
      expect(v.dureeEstimeeSec, v.code).toBeGreaterThan(0);
      expect(v.dureeEstimeeSec, `${v.code} : ${v.dureeEstimeeSec} s pour ${zone.join("-")} s`).toBeLessThanOrEqual(zone[1]);
    }
  });

  it("rien d'inventé : une accroche avec un chiffre sans preuve est refusée par le contrôle (jamais retenue)", async () => {
    claude.remplacer.accroches = (s) => {
      const o = s as { accroches: { dit: string }[] };
      return { ...o, accroches: o.accroches.map((a, i) => (i === 0 ? { ...a, dit: "87 % des PME perdent 12 000 euros par an sur leurs devis." } : a)) };
    };
    const r = await ecrire();
    expect(claude.appels.accroches).toBeGreaterThanOrEqual(1);
    const variantes = await depots().variantes.lister((v) => v.scriptMaitreId === r.scriptMaitreId && !v.archiveLe);
    expect(variantes.length).toBeGreaterThan(0);
    for (const v of variantes) {
      const dit = [...v.ouverture, ...v.fin].flatMap((b) => b.segments.map((s) => s.texte)).join(" ");
      expect(dit).not.toMatch(/87 %|12 000/);
    }
  });

  it("rien ne part sans accord : « Valider les N » est le geste de Will ; « Fabriquer » au-delà du seuil exige le prix confirmé", async () => {
    const r = await ecrire(["tiktok"]);
    const vs = await depots().variantes.lister((v) => v.scriptMaitreId === r.scriptMaitreId && !v.archiveLe);
    expect(vs.every((v) => v.etat !== "validee")).toBe(true);
    // Fabriquer une version non validée : refusé.
    await expect(bg.fabriquerVariante(vs[0].id, { operationId: "op-a1-0", lancer: true })).rejects.toThrow(/Validez/);
    const m = (await depots().scriptsMaitres.obtenir(r.scriptMaitreId))!;
    if (m.exception?.source === "proposition-machine" && !m.exception.valideeParWill) {
      await expect(bg.validerVariantes(vs.map((v) => v.id))).rejects.toThrow(/limite/);
      await bg.validerException(m.id, "c-est-juste");
    }
    const ids = (await depots().variantes.lister((v) => v.scriptMaitreId === r.scriptMaitreId && !v.archiveLe)).map((v) => v.id);
    expect(await bg.validerVariantes(ids)).toBeGreaterThan(0);
    const v = (await depots().variantes.lister((x) => x.scriptMaitreId === r.scriptMaitreId && !x.archiveLe && x.etat === "validee"))[0];
    await ecrireParametre("budget.seuilConfirmation", centimes(1));
    const videosAvant = (await depots().videos.lister()).length;
    await expect(bg.fabriquerVariante(v.id, { operationId: "op-a1-1", lancer: true })).rejects.toThrow();
    expect((await depots().videos.lister()).length).toBe(videosAvant);
  });

  it("reprise après un arrêt : les étapes terminées ne sont pas repayées et le total reste sous le plafond du sujet", async () => {
    await banc();
    const r = await bg.lancerGeneration({ idee: SUJET.idee, reseaux: SUJET.reseaux, formatId: "avocat", pilier: SUJET.pilier.id, mode: "avatar" });
    if (!r.ok) throw new Error("refusé");
    // La limite Claude du mois est atteinte au milieu : l'écriture attend (rien ne part).
    await ecrireParametre("claude.plafondMensuelUsd", 0.2);
    await bg.tourBoucleGeneration();
    const g1 = (await depots().generations.obtenir(r.generationId))!;
    expect(g1.statut).toBe("en-attente-credit");
    const payeAvant = gc.depenseGenerationUsd(g1);
    const appelsAvant = { ...claude.appels };
    await ecrireParametre("claude.plafondMensuelUsd", 100);
    await gc.reprendreGenerationsEnAttenteCredit({ gesteDeWill: true });
    await bg.tourBoucleGeneration();
    const g2 = (await depots().generations.obtenir(r.generationId))!;
    expect(g2.statut).toBe("terminee");
    const total = gc.depenseGenerationUsd(g2);
    expect(total).toBeGreaterThanOrEqual(payeAvant);
    expect(total).toBeLessThanOrEqual(g2.plafondUsd);
    expect(g2.plafondUsd).toBe(PLAFOND_SUJET_USD);
    // Les rôles déjà payés avant l'arrêt ne repartent pas une seconde fois.
    for (const [role, k] of Object.entries(appelsAvant)) if (role === "stratege" || role === "fond") expect(claude.appels[role], role).toBe(k);
  });

  it("retouches : « Améliorer » (Claude, plafond de la retouche, version d'avant gardée) ; phrase par phrase à la main (gratuit) ; à revalider", async () => {
    const r = await ecrire(["tiktok"]);
    const v0 = (await depots().variantes.lister((v) => v.scriptMaitreId === r.scriptMaitreId && !v.archiveLe))[0];
    const avant = { ...claude.appels };
    const v1 = await bg.regenererVariante(v0.id, "ameliorer");
    expect(claude.appels.declinaison).toBeGreaterThan(avant.declinaison ?? 0);
    expect(v1.id).not.toBe(v0.id);
    expect(v1.code).toBe(v0.code);
    expect(v1.etat).not.toBe("validee");
    // Rien n'est effacé : la version d'avant existe toujours.
    expect(await depots().variantes.obtenir(v0.id)).toBeTruthy();
    const retouche = (await depots().generations.lister((g) => g.scriptMaitreId === r.scriptMaitreId && g.portee === "retouche"))[0];
    expect(retouche.statut).toBe("terminee");
    expect(gc.depenseGenerationUsd(retouche)).toBeLessThanOrEqual(retouche.plafondUsd);
    expect(retouche.plafondUsd).toBeLessThanOrEqual(PLAFOND_SUPPLEMENT_USD);
    // Une phrase corrigée à la main : aucun appel à Claude, nouvelle version à relire.
    const appels = JSON.stringify(claude.appels);
    const script = (await depots().scripts.obtenir(v1.scriptId))!;
    const blocs = structuredClone([...v1.ouverture, ...script.blocs, ...v1.fin]);
    const seg = blocs.flatMap((b) => b.segments).find((x) => x.texte.length > 20)!;
    seg.texte = `${seg.texte.replace(/[.!?…]+$/, "")}, sans exception.`;
    const v2 = await bg.enregistrerRetouche(v1.id, blocs);
    expect(JSON.stringify(claude.appels)).toBe(appels);
    expect(v2.etat).not.toBe("validee");
    const s2 = (await depots().scripts.obtenir(v2.scriptId))!;
    expect(JSON.stringify([...v2.ouverture, ...s2.blocs, ...v2.fin])).toContain("sans exception.");
  });
});
