/**
 * S2-07 : l'appel Claude du chat de retouche par le VRAI chemin de dépense (`executerRolePourVideo`), dépôts mémoire,
 * client Claude simulé (faux `fetch`, aucun réseau). Modèle : tests/facecam-animee/videos-v4-depense.test.ts.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { exemplesCommeVraies } from "../helpers/videos-reelles";
import { preparerMotDePasse } from "../helpers/g1a";
import { CLE_ESSAI_CLAUDE, fluxReussi, reponseFlux } from "../helpers/g0";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("server-only", () => ({}));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const { ecrireParametre } = await import("@/services/_commun");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
const { PLAN_DEMO } = await import("@/briques/plan-scenes/demo");
const { validerPlan } = await import("@/briques/plan-scenes/validateur");
const { construireRequeteRetouche } = await import("@/services/retouche-chat/comprendre");
const { pireCasRequete } = await import("@/generateur/roles/types");
const m = await import("@/services/retouche-chat/appel-claude-chat");

const MDP = "essai-appel-claude-chat";
const fetchInterdit = (async () => {
  throw new Error("réseau interdit");
}) as typeof fetch;

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  reinitialiserDepots();
  await exemplesCommeVraies(depots());
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, fetchInterdit)], ["anthropic"]);
});
afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  gc.injecterClaudePourEssai(null);
});

function brancherClaude() {
  void credits.declarerRecharge("anthropic", 500);
  const appels: string[] = [];
  const f = (async (_u: string | URL | Request, init?: RequestInit) => {
    appels.push(String(init?.body));
    return reponseFlux(fluxReussi({ texte: '{"operations":[]}', modele: "claude-opus-5-5" }));
  }) as typeof fetch;
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: f, attenteMs: () => 0 });
  return appels;
}

const plan = validerPlan(PLAN_DEMO, { mots: PLAN_DEMO.mots, format: PLAN_DEMO.format, facecam: PLAN_DEMO.facecam, dureeMs: PLAN_DEMO.dureeMs }).plan;
const requete = () => construireRequeteRetouche("fais quelque chose de joli pour moi", plan);
/** Plan de 12 scènes (pire cas réaliste du lecteur), écrit ici : les 3 scènes de démonstration répétées sous des identifiants s1 à s12. */
const plan12 = { ...plan, scenes: Array.from({ length: 12 }, (_, i) => ({ ...plan.scenes[i % plan.scenes.length], id: `s${i + 1}` })) } as typeof plan;
const SANS_MONTANT = /\d|€|\$/;

describe("S2-07 · appel Claude du chat de retouche", () => {
  it("a) Claude non choisi pour les textes (simulation) → l'appel lève, 0 dépense, 0 réservation", async () => {
    await ecrireParametre("fournisseur.texte-reseaux", "simulation");
    const appels = brancherClaude();
    const appel = await m.appelClaudeChat("v-04", { origine: async () => undefined });
    await expect(appel(requete())).rejects.toThrow();
    expect(appels).toHaveLength(0);
    expect(await depots().depenses.lister((d) => d.videoId === "v-04" && d.lignes.some((l) => l.etape.startsWith("Retouche chat")))).toHaveLength(0);
    expect(await depots().reservations.lister((r) => !!r.travailId?.startsWith(m.PREFIXE_APPEL_CHAT))).toHaveLength(0);
  });

  it("b) Claude choisi : 1 requête → 1 dépense anthropic à l'étape du chat, réservation au bon préfixe consommée, texte du double", async () => {
    await ecrireParametre("fournisseur.texte-reseaux", "claude");
    const appels = brancherClaude();
    const appel = await m.appelClaudeChat("v-04", { origine: async () => undefined });
    const r = await appel(requete());
    expect(r.texte).toBe('{"operations":[]}');
    expect(appels).toHaveLength(1);
    expect(appels[0]).toContain("fais quelque chose de joli pour moi");
    const corps = JSON.parse(appels[0]);
    expect(corps.model).toBe(requete().modele);
    expect(corps.output_config.effort).toBe(requete().effort);
    expect(corps.max_tokens).toBe(requete().maxTokens);
    expect(JSON.stringify(corps.system)).toContain(JSON.stringify(requete().systeme[0].texte.slice(0, 200)).slice(1, -1));
    const depenses = await depots().depenses.lister((d) => d.videoId === "v-04" && d.lignes.some((l) => l.etape.startsWith(m.ETAPE_LECTURE_CHAT)));
    expect(depenses).toHaveLength(1);
    expect(depenses[0].lignes.some((l) => l.fournisseur === "anthropic")).toBe(true);
    const reservations = await depots().reservations.lister((x) => x.videoId === "v-04" && !!x.travailId?.startsWith(m.PREFIXE_APPEL_CHAT));
    expect(reservations.length).toBeGreaterThan(0);
    expect(reservations.every((x) => x.statut === "consommee")).toBe(true);
  });

  it("c) plafond 0,01 $ et origine « usine » → refus plafond, le double n'est jamais appelé, phrase sans montant", async () => {
    await ecrireParametre("fournisseur.texte-reseaux", "claude");
    await ecrireParametre(m.PARAM_PLAFOND_LECTURE_CHAT, 0.01);
    const appels = brancherClaude();
    const appel = await m.appelClaudeChat("v-04", { origine: async () => "usine" });
    const err = await appel(requete()).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain("limite de cette vidéo");
    expect((err as Error).message).not.toMatch(SANS_MONTANT);
    expect(appels).toHaveLength(0);
  });

  it("d) vidéo ou version introuvable, origine qui lève → un appel qui lève, executer jamais appelé", async () => {
    const executer = vi.fn();
    for (const [id, deps] of [
      ["inconnue", {}],
      ["v-04", { origine: async () => { throw new Error("x"); } }],
      ["v-04", { origine: async () => null }],
    ] as const) {
      const appel = await m.appelClaudeChat(id, { ...deps, executer: executer as never });
      await expect(appel(requete())).rejects.toThrow();
    }
    expect(executer).not.toHaveBeenCalled();
  });

  it("d quater) version choisie introuvable par le vrai chemin des dépôts (sans `origine` injectée) → l'appel lève, executer jamais appelé", async () => {
    const v = (await depots().videos.obtenir("v-04"))!;
    await depots().videos.enregistrer({ ...v, versionChoisieId: "absente" } as never);
    const executer = vi.fn();
    const appel = await m.appelClaudeChat("v-04", { executer: executer as never });
    await expect(appel(requete())).rejects.toThrow();
    expect(executer).not.toHaveBeenCalled();
  });

  it("d bis) arrêts de la garde : phrases sans montant, un seul appel de executer, étape et plafond exacts", async () => {
    for (const arret of ["plafond-video", "en-attente-credit", "budget-usine", "bloquee-modele", "indisponible"]) {
      const executer = vi.fn(async () => ({ ok: false as const, arret, message: "12 € dépassés" }));
      const appel = await m.appelClaudeChat("v-04", { origine: async () => "usine", executer: executer as never });
      const err = (await appel(requete()).catch((e: Error) => e)) as Error;
      expect(err.message).not.toMatch(SANS_MONTANT);
      expect(executer).toHaveBeenCalledTimes(1);
      const o = (executer.mock.calls[0] as unknown as [string, unknown, unknown, { etape: string; origine?: string; plafondPropre: { id: string; parametre: string; defautUsd: number; prefixeEtape: string } }])[3];
      expect(o.etape).toBe("Retouche chat · lecture");
      expect(o.origine).toBe("usine");
      expect(o.plafondPropre).toEqual({ id: "rtcht", parametre: "retoucheChat.plafondLectureUsd", defautUsd: 0.27, prefixeEtape: "Retouche chat ·" });
    }
  });

  it("d ter) texte vide ou blanc rendu par executerRolePourVideo (hors simulation) → l'appel lève, un seul appel de executer", async () => {
    for (const texte of ["", "   "]) {
      const executer = vi.fn(async () => ({ ok: true as const, simule: false, texte }));
      const appel = await m.appelClaudeChat("v-04", { origine: async () => undefined, executer: executer as never });
      await expect(appel(requete())).rejects.toThrow();
      expect(executer).toHaveBeenCalledTimes(1);
    }
  });

  it("e) pire cas = pireCasRequete (égalité exacte) et ≤ 0,09 $ pour la requête du lecteur (1 500 jetons) sur un plan de 12 scènes", () => {
    const r = { ...construireRequeteRetouche("fais quelque chose de joli pour moi", plan12), maxTokens: 1500 };
    expect(r.messages[0].contenu.split("\n").filter((l) => /^s\d+ · niveau/.test(l))).toHaveLength(12);
    const pire = m.pireCasLectureUsd(r);
    expect(pire).toBe(pireCasRequete(m.roleLectureChat(r), m.entreeLectureChat(r)));
    expect(pire).toBeGreaterThan(0);
    expect(pire).toBeLessThanOrEqual(0.09);
  });

  it("f) gardes de texte : aucun importeur, un seul chemin de dépense", () => {
    const src = readFileSync("src/services/retouche-chat/appel-claude-chat.ts", "utf8");
    expect(src).not.toMatch(/executerRolePourVideo\(|envoyerMessage\(|executerRole\(/);
    expect(src).not.toMatch(/tutoriel-claude/);
    const fichiers = (d: string): string[] =>
      readdirSync(d).flatMap((n) => {
        if (n === "node_modules") return [];
        const p = join(d, n);
        return statSync(p).isDirectory() ? fichiers(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
      });
    for (const f of fichiers("src")) {
      if (f.endsWith("appel-claude-chat.ts")) continue;
      expect(readFileSync(f, "utf8"), f).not.toMatch(/appel-claude-chat/);
    }
  });
});
