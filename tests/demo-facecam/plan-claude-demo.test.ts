/**
 * G3-10-v20e : Claude (Sonnet) compose le plan de scènes de la démo face caméra, 0,85 € au plus par vidéo, ÉTEINT par défaut.
 * Aucun appel réel : faux `executer`, faux `engage`, faux `taux`, faux `lire`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommandeFabrication, MotHorodate } from "@/domaine/types";
import type { DemandeFacecam, FournisseurFacecam } from "@/fournisseurs/facecam";
import { creerServiceRenduSimule } from "@/fournisseurs/simulation/rendu";
import { creerMoteurMontageDemoFacecam } from "@/moteurs/montage-demo-facecam";
import type { DependancesDemo, EtatDemo } from "@/moteurs/montage-demo-facecam/chaine";
import { ErreurClaude, type RequeteClaude } from "@/fournisseurs/claude/client";
import { construireRequetePlan, genererPlan } from "@/briques/plan-scenes/generateur";
import type { MotMinute } from "@/briques/plan-scenes/schema";
import { eurVersUsd } from "@/domaine/credits";
import { pireCasRequete } from "@/generateur/roles/types";
import {
  appelClaudePlanDemo,
  ETAPE_PLAN_DEMO,
  MODELE_CLAUDE_VIDEO,
  PARAM_PLAFOND_PLAN_DEMO,
  PARAM_PLAN_CLAUDE_DEMO,
  PLAFOND_TOTAL_CLAUDE_VIDEO_EUR,
  PLAFONDS_CLAUDE_VIDEO_EUR,
  planClaudeDemoActif,
  PREFIXES_ETAPE_CLAUDE_VIDEO,
  roleDepuisRequetePlanDemo,
  entreeDepuisRequetePlanDemo,
} from "@/services/demo-facecam-claude";
import { dependancesDemoParDefaut } from "@/moteurs/montage-demo-facecam/dependances";

/** Doubles du raccord de production : le réglage est lu « absent » (défaut), l'exécuteur payant est un espion. */
const espion = vi.hoisted(() => ({ executer: vi.fn(), reglage: undefined as unknown }));
vi.mock("server-only", () => ({}));
vi.mock("@/services/_commun", () => ({ lireParametre: async (_id: string, defaut: unknown) => (espion.reglage === undefined ? defaut : espion.reglage) }));
vi.mock("@/services/depense-claude-video", () => ({ executerRolePourVideo: espion.executer, engagePlafondPropreCentimes: async () => 0 }));
vi.mock("@/services/generation-claude", () => ({ taux: async () => 1 }));

const racine = process.cwd();
const lireSource = (...p: string[]) => readFileSync(join(racine, ...p), "utf8");

const REQ: RequeteClaude = { modele: "claude-opus-5-5", maxTokens: 16_000, effort: "high", systeme: [{ texte: "consigne", cache: "1h" }], messages: [{ role: "user", contenu: "demande" }], json: true };
const OK = { ok: true as const, simule: false, texte: "{}", modele: "claude-sonnet-5-5", coutUsd: 0.01, jetons: { entree: 1, cacheLu: 0, cacheEcrit: 0, sortie: 1 }, stopReason: "end_turn" };

type Appel = { videoId: string; role: { modele: string; maxTokens: number }; options: { etape: string; origine?: string; plafondPropre: { id: string; defautUsd: number; prefixeEtape: string; parametre: string } } };
function fauxExecuter(reponse: unknown = OK) {
  const appels: Appel[] = [];
  const executer = (async (videoId: string, role: Appel["role"], _entree: unknown, options: Appel["options"]) => {
    appels.push({ videoId, role, options });
    if (reponse instanceof Error) throw reponse;
    return reponse;
  }) as never;
  return { executer, appels };
}
/** Faux `engage` : centimes de $ engagés par id de plafond. */
const fauxEngage = (v: Partial<Record<"dmpln" | "tbnar" | "tblec", number>> = {}) => (async (_videoId: string, p: { id: "dmpln" | "tbnar" | "tblec" }) => v[p.id] ?? 0) as never;
const fauxTaux = (t: number) => async () => t;

describe("a) interrupteur demoFacecam.planClaude", () => {
  it.each([
    [undefined, true],
    [null, true],
    [true, true],
    [false, false],
    ["false", false],
    ["true", false],
    [0, false],
    [1, false],
    [{}, false],
    [[], false],
    ["", false],
  ])("valeur %s → %s", async (v, attendu) => {
    expect(await planClaudeDemoActif((async () => v) as never)).toBe(attendu);
  });
  it("réglage absent → allumé : `lire` reçoit (PARAM_PLAN_CLAUDE_DEMO, true) et rend le défaut reçu", async () => {
    const lire = vi.fn(async (_id: string, d: unknown) => d);
    expect(await planClaudeDemoActif(lire as never)).toBe(true);
    expect(lire).toHaveBeenCalledTimes(1);
    expect(lire).toHaveBeenCalledWith(PARAM_PLAN_CLAUDE_DEMO, true);
    expect(PARAM_PLAN_CLAUDE_DEMO).toBe("demoFacecam.planClaude");
  });
  it("lecture en échec = éteint", async () => {
    expect(await planClaudeDemoActif((async () => { throw new Error("base en panne"); }) as never)).toBe(false);
  });
});

describe("b) table d'argent commune (littérale)", () => {
  it("valeurs figées", () => {
    expect(PLAFONDS_CLAUDE_VIDEO_EUR).toEqual({ dmpln: 0.85, tbnar: 0.15, tblec: 0.25 });
    expect(Object.isFrozen(PLAFONDS_CLAUDE_VIDEO_EUR)).toBe(true);
    expect(PLAFOND_TOTAL_CLAUDE_VIDEO_EUR).toBe(1.25);
    expect(PREFIXES_ETAPE_CLAUDE_VIDEO).toEqual({ dmpln: "Démo · plan de scènes", tbnar: "Tableau de bord · narration", tblec: "Tableau de bord · lecture capture" });
    expect(Object.isFrozen(PREFIXES_ETAPE_CLAUDE_VIDEO)).toBe(true);
    expect(PLAFONDS_CLAUDE_VIDEO_EUR.dmpln + PLAFONDS_CLAUDE_VIDEO_EUR.tbnar + PLAFONDS_CLAUDE_VIDEO_EUR.tblec).toBeCloseTo(PLAFOND_TOTAL_CLAUDE_VIDEO_EUR, 10);
  });
});

describe("c) appelClaudePlanDemo : appel gardé", () => {
  it("allumé : 1 appel, rôle Sonnet (même si la requête dit Opus), maxTokens 16 000, étape et plafond propre, origine transmise", async () => {
    const { executer, appels } = fauxExecuter();
    const r = await appelClaudePlanDemo("v1", "usine", { executer, engage: fauxEngage(), taux: fauxTaux(0.9) })(REQ);
    expect(appels).toHaveLength(1);
    expect(appels[0].videoId).toBe("v1");
    expect(appels[0].role.modele).toBe("claude-sonnet-5-5");
    expect(MODELE_CLAUDE_VIDEO).toBe("claude-sonnet-5-5");
    expect(appels[0].role.maxTokens).toBe(16_000);
    expect(appels[0].options.etape.startsWith("Démo · plan de scènes")).toBe(true);
    expect(appels[0].options.etape).toBe(ETAPE_PLAN_DEMO);
    expect(appels[0].options.origine).toBe("usine");
    expect(appels[0].options.plafondPropre).toMatchObject({ id: "dmpln", parametre: PARAM_PLAFOND_PLAN_DEMO, defautUsd: 0.85, prefixeEtape: "Démo · plan de scènes" });
    expect(PARAM_PLAFOND_PLAN_DEMO).toBe("demoFacecam.plafondPlanUsd");
    expect(r.texte).toBe("{}");
    expect(r.modele).toBe("claude-sonnet-5-5");
    expect(r.modeleDemande).toBe("claude-opus-5-5");
  });

  it("rôle et entrée : la consigne et le message passent, le 2e essai est aplati", () => {
    const role = roleDepuisRequetePlanDemo(REQ);
    expect(role.consigne).toBe("consigne");
    expect(role.modele).toBe("claude-sonnet-5-5");
    const e = entreeDepuisRequetePlanDemo({ ...REQ, messages: [...REQ.messages, { role: "assistant", contenu: "pas du json" }, { role: "user", contenu: "reprise" }] });
    expect(e.variable).toContain("<reponse_precedente>pas du json</reponse_precedente>");
    expect(e.variable).toContain("<consigne_reprise>reprise</consigne_reprise>");
  });

  it("plafond dur : la vidéo a déjà 80 centimes engagés, une requête dont la demande dépasse → 0 appel, ErreurClaude sans montant", async () => {
    const { executer, appels } = fauxExecuter();
    const appel = appelClaudePlanDemo("v1", "studio", { executer, engage: fauxEngage({ dmpln: 80 }), taux: fauxTaux(0.9) });
    await expect(appel(REQ)).rejects.toBeInstanceOf(ErreurClaude);
    await expect(appel(REQ)).rejects.not.toThrow(/\d+[,.]\d+\s*(€|\$)/);
    expect(appels).toHaveLength(0);
  });

  it("plafond total : les AUTRES usages ont 120 centimes engagés → 0 appel", async () => {
    const { executer, appels } = fauxExecuter();
    await expect(appelClaudePlanDemo("v1", "studio", { executer, engage: fauxEngage({ tbnar: 60, tblec: 60 }), taux: fauxTaux(0.9) })(REQ)).rejects.toBeInstanceOf(ErreurClaude);
    expect(appels).toHaveLength(0);
  });

  it("mode indicatif simulé (faux executer qui accepte tout) et réglage de plafond à 5 $ : le refus a lieu avant, quand même", async () => {
    const { executer, appels } = fauxExecuter(OK);
    const lire = (async (id: string, defaut: unknown) => (id === PARAM_PLAFOND_PLAN_DEMO ? 5 : defaut)) as never;
    await expect(appelClaudePlanDemo("v1", "studio", { executer, engage: fauxEngage({ dmpln: 84 }), taux: fauxTaux(1.1), lire })(REQ)).rejects.toBeInstanceOf(ErreurClaude);
    expect(appels).toHaveLength(0);
  });

  it.each([0.9, 1.1])("taux %s : la limite suit le taux (centimes de $ = ⌊€ × 100 / taux⌋), refus juste au-delà", async (t) => {
    const demande = Math.ceil(pireCasRequete(roleDepuisRequetePlanDemo(REQ), entreeDepuisRequetePlanDemo(REQ)) * 100 * 1.2);
    const limite = Math.floor(eurVersUsd(85, t));
    const ok = fauxExecuter();
    await appelClaudePlanDemo("v1", "studio", { executer: ok.executer, engage: fauxEngage({ dmpln: limite - demande }), taux: fauxTaux(t) })(REQ);
    expect(ok.appels).toHaveLength(1);
    const non = fauxExecuter();
    await expect(appelClaudePlanDemo("v1", "studio", { executer: non.executer, engage: fauxEngage({ dmpln: limite - demande + 1 }), taux: fauxTaux(t) })(REQ)).rejects.toBeInstanceOf(ErreurClaude);
    expect(non.appels).toHaveLength(0);
  });

  it.each([
    ["ok: false", { ok: false, arret: "budget-usine", message: "x" }],
    ["simule", { ...OK, simule: true, texte: undefined }],
    ["texte vide", { ...OK, texte: "  " }],
    ["exception", new Error("réseau")],
  ])("%s → ErreurClaude (le plan simple prend le relais), jamais une autre exception", async (_n, reponse) => {
    const { executer, appels } = fauxExecuter(reponse);
    const appel = appelClaudePlanDemo("v1", "studio", { executer, engage: fauxEngage(), taux: fauxTaux(0.9) });
    await expect(appel(REQ)).rejects.toBeInstanceOf(ErreurClaude);
    expect(appels).toHaveLength(1);
  });
});

describe("c) avec genererPlan : 2 essais au plus", () => {
  const mots: MotMinute[] = "Bonjour je vous montre un devis".split(" ").map((texte, i) => ({ texte, debutMs: i * 400, finMs: i * 400 + 330 }));
  const e = { script: mots.map((m) => m.texte).join(" "), mots, format: { largeur: 1080, hauteur: 1350, fps: 25 as const }, facecam: false };
  it("réponses illisibles : 2 appels exactement, plan de repli, jamais d'exception ni de 3e appel", async () => {
    const { executer, appels } = fauxExecuter({ ...OK, texte: "pas du json" });
    const r = await genererPlan(e, appelClaudePlanDemo("v1", "studio", { executer, engage: fauxEngage(), taux: fauxTaux(0.9) }));
    expect(appels).toHaveLength(2);
    expect(r.source).toBe("repli");
  });
  it("plafond dur atteint : 0 appel, plan de repli", async () => {
    const { executer, appels } = fauxExecuter();
    const r = await genererPlan(e, appelClaudePlanDemo("v1", "studio", { executer, engage: fauxEngage({ dmpln: 85 }), taux: fauxTaux(0.9) }));
    expect(appels).toHaveLength(0);
    expect(r.source).toBe("repli");
  });
});

describe("plafond dur : valeurs invalides (engagé, taux) → refus sans appel, repli gratuit", () => {
  const mots: MotMinute[] = "Bonjour je vous montre un devis".split(" ").map((texte, i) => ({ texte, debutMs: i * 400, finMs: i * 400 + 330 }));
  const e = { script: mots.map((m) => m.texte).join(" "), mots, format: { largeur: 1080, hauteur: 1350, fps: 25 as const }, facecam: false };
  const cas: [string, Partial<Record<"dmpln" | "tbnar" | "tblec", number>>, number][] = [
    ["engagé de la fiche NaN", { dmpln: Number.NaN }, 0.9],
    ["engagé de la fiche négatif", { dmpln: -1000 }, 0.9],
    ["engagé d'un autre usage (tbnar) NaN", { tbnar: Number.NaN }, 0.9],
    ["engagé d'un autre usage (tblec) négatif", { tblec: -1000 }, 0.9],
    ["taux 0", {}, 0],
    ["taux NaN", {}, Number.NaN],
    ["taux négatif", {}, -1],
  ];
  it.each(cas)("%s : 0 appel du faux executer, ErreurClaude", async (_nom, engage, taux) => {
    const { executer, appels } = fauxExecuter();
    await expect(appelClaudePlanDemo("v1", "studio", { executer, engage: fauxEngage(engage), taux: fauxTaux(taux) })(REQ)).rejects.toBeInstanceOf(ErreurClaude);
    expect(appels).toHaveLength(0);
  });
  it.each(cas)("%s : genererPlan rend le plan de repli gratuit, 0 appel", async (_nom, engage, taux) => {
    const { executer, appels } = fauxExecuter();
    const r = await genererPlan(e, appelClaudePlanDemo("v1", "studio", { executer, engage: fauxEngage(engage), taux: fauxTaux(taux) }));
    expect(appels).toHaveLength(0);
    expect(r.source).toBe("repli");
  });
});

describe("pire cas de la plus grande démo (150 s, 2,8 mots/s) × 1,2 ≤ 0,85 €", () => {
  it.each([0.9, 1.1])("taux %s", (t) => {
    const n = 420;
    const mots: MotMinute[] = Array.from({ length: n }, (_, i) => ({ texte: "exemple", debutMs: Math.round((i * 150_000) / n), finMs: Math.round(((i + 1) * 150_000) / n) }));
    const entree = { script: mots.map((m) => m.texte).join(" "), mots, format: { largeur: 1080, hauteur: 1350, fps: 25 as const }, facecam: false };
    const reponseMax = "x".repeat(16_000 * 3);
    const r1 = construireRequetePlan(entree);
    const r2 = construireRequetePlan(entree, [{ reponse: reponseMax, motif: "ce n'est pas du JSON lisible" }]);
    const pire = (r: RequeteClaude) => pireCasRequete(roleDepuisRequetePlanDemo(r), entreeDepuisRequetePlanDemo(r));
    const totalCentimes = (pire(r1) + pire(r2)) * 100 * 1.2;
    expect(totalCentimes).toBeLessThanOrEqual(Math.floor(eurVersUsd(PLAFONDS_CLAUDE_VIDEO_EUR.dmpln * 100, t)));
  });
});

describe("c) raccord de la chaîne : éteint = identique à aujourd'hui", () => {
  it("dependancesDemoParDefaut ne change rien sans raccord ; avec raccord, `planClaudeActif` est recopié seulement si `appelerPlan` existe", async () => {
    const { brancherServicesDemoFacecam } = await import("@/moteurs/montage-demo-facecam/dependances");
    const c = { videoId: "v1", origine: "studio", entrees: {} } as never;
    expect(dependancesDemoParDefaut(c, {})).toBeNull();
    brancherServicesDemoFacecam({ planClaudeActif: async () => true });
    expect(dependancesDemoParDefaut(c, {})).toBeNull();
    brancherServicesDemoFacecam({ planClaudeActif: undefined });
  });
});

describe("c) R2 : dependancesDemoParDefaut recopie `planClaudeActif` (réel demandé, env réelle)", () => {
  const env = { STUDIO_ALIGNEUR_URL: "https://aligneur.exemple", STUDIO_RENDU_URL: "https://rendu.exemple", STUDIO_RENDU_CLE: "cle-test" };
  const c = { videoId: "v1", origine: "studio", entrees: { facecamAligneurReel: true } } as unknown as CommandeFabrication;
  const plan = (() => undefined) as never;
  const actif = async () => true;
  beforeEach(async () => {
    const { brancherServicesDemoFacecam } = await import("@/moteurs/montage-demo-facecam/dependances");
    brancherServicesDemoFacecam({ appelerPlan: undefined, planClaudeActif: undefined });
  });

  it("appelerPlan + planClaudeActif branchés → les deux sont dans les dépendances, planClaudeActif est LE MÊME", async () => {
    const { brancherServicesDemoFacecam } = await import("@/moteurs/montage-demo-facecam/dependances");
    const appelerPlan = async () => ({}) as never;
    brancherServicesDemoFacecam({ appelerPlan: () => appelerPlan, planClaudeActif: actif });
    const d = dependancesDemoParDefaut(c, env, "t1");
    expect(d).not.toBeNull();
    expect(d?.appelerPlan).toBe(appelerPlan);
    expect(d?.planClaudeActif).toBe(actif);
  });
  it("planClaudeActif sans appelerPlan → ni l'un ni l'autre dans les dépendances", async () => {
    const { brancherServicesDemoFacecam } = await import("@/moteurs/montage-demo-facecam/dependances");
    brancherServicesDemoFacecam({ planClaudeActif: actif });
    const d = dependancesDemoParDefaut(c, env, "t1");
    expect(d).not.toBeNull();
    expect(d).not.toHaveProperty("appelerPlan");
    expect(d).not.toHaveProperty("planClaudeActif");
  });
  it("appelerPlan sans planClaudeActif → pas de champ planClaudeActif (comportement d'avant)", async () => {
    const { brancherServicesDemoFacecam } = await import("@/moteurs/montage-demo-facecam/dependances");
    brancherServicesDemoFacecam({ appelerPlan: () => plan });
    const d = dependancesDemoParDefaut(c, env, "t1");
    expect(d?.appelerPlan).toBe(plan);
    expect(d).not.toHaveProperty("planClaudeActif");
  });
});

describe("c) R2 : branchement de production (demo-facecam-branchements)", () => {
  beforeEach(() => { espion.executer.mockReset(); espion.reglage = undefined; });

  it("l'import branche `planClaudeActif` et `appelerPlan` ; réglage absent → planClaudeActif rend true ; false ou la chaîne true → éteint", async () => {
    await import("@/services/demo-facecam-branchements");
    const { servicesDemoFacecam } = await import("@/moteurs/montage-demo-facecam/dependances");
    const s = servicesDemoFacecam();
    expect(typeof s.appelerPlan).toBe("function");
    expect(typeof s.planClaudeActif).toBe("function");
    expect(await s.planClaudeActif?.()).toBe(true);
    espion.reglage = "true";
    expect(await s.planClaudeActif?.()).toBe(false);
    espion.reglage = false;
    expect(await s.planClaudeActif?.()).toBe(false);
    espion.reglage = true;
    expect(await s.planClaudeActif?.()).toBe(true);
  });
});

describe("c) chaîne de démo : planClaudeActif", () => {
  const PHRASE = "Bonjour je vous montre comment on crée un devis dans Axion en trois clics puis je choisis le client et voilà le devis est prêt.";
  const mots: MotHorodate[] = PHRASE.split(/\s+/).map((mot, i) => ({ mot, debutSec: +(i * 0.4).toFixed(3), finSec: +(i * 0.4 + 0.33).toFixed(3) }));
  let horloge = Date.UTC(2026, 10, 8, 10);
  const commande = { videoId: "v1", formatId: "demo-facecam", ratios: ["9:16"], briques: { "sous-titres": true }, distribution: [], dureeCibleSec: 60, script: { blocs: [], texteComplet: "" }, entrees: { demoFacecam: { facecam: { cle: "rush/face.mp4" } } } } as unknown as CommandeFabrication;
  const ctx = { travailId: "t1", versionId: "ver1", titre: "Démo devis", maintenant: horloge };

  async function lancerChaine(extra: Partial<DependancesDemo>) {
    const demandes = new Map<string, DemandeFacecam>();
    const facecam = {
      id: "simulation",
      mode: "simulation",
      async soumettre(_r: unknown, d: DemandeFacecam) {
        demandes.set(d.idTravail, d);
        return { statut: "en_file" };
      },
      async suivre(_r: unknown, id: string) {
        return { statut: "termine", resultat: { transcriptionCle: `tr/${id}`, dureeSec: 6, mots } };
      },
    } as unknown as FournisseurFacecam;
    const rendu = creerServiceRenduSimule(() => horloge);
    const d: DependancesDemo = { facecam, rendu, urlLecture: async (c) => `https://r2.exemple/lire/${c}`, urlDepot: async (c) => `https://r2.exemple/deposer/${c}`, ...extra };
    const moteur = creerMoteurMontageDemoFacecam({ chaine: () => d });
    let t = await moteur.lancer(commande, ctx);
    for (let i = 0; i < 200; i++) {
      horloge += 1000;
      const r = await moteur.avancer(t, commande, horloge);
      t = r.travail;
      if (r.resultat || t.statut === "echec") break;
    }
    return t.parametres?.demo as EtatDemo;
  }
  const llm = () => {
    const f = (async (requete: RequeteClaude) => {
      f.appels++;
      return { texte: "pas du json", modeleDemande: requete.modele, modele: requete.modele, replis: [], stopReason: "end_turn", jetons: { entree: 0, sortie: 0 } } as never;
    }) as unknown as ((r: RequeteClaude) => Promise<never>) & { appels: number };
    f.appels = 0;
    return f;
  };

  it("planClaudeActif → false : sortie identique à « sans raccord » (plan, source, remarques), 0 appel", async () => {
    const sans = await lancerChaine({});
    const f = llm();
    const eteint = await lancerChaine({ appelerPlan: f, planClaudeActif: async () => false });
    expect(f.appels).toBe(0);
    expect(eteint.sourcePlan).toBe(sans.sourcePlan);
    expect(eteint.plan).toEqual(sans.plan);
    expect(eteint.remarques).toEqual(sans.remarques);
    expect(sans.remarques.some((r) => r.code === "PLAN_SIMPLE")).toBe(true);
  });
  it("planClaudeActif qui échoue → plan simple, 0 appel", async () => {
    const f = llm();
    const e = await lancerChaine({ appelerPlan: f, planClaudeActif: async () => { throw new Error("réglage illisible"); } });
    expect(f.appels).toBe(0);
    expect(e.remarques.some((r) => r.code === "PLAN_SIMPLE")).toBe(true);
  });
  it("planClaudeActif → true : l'IA est appelée (2 essais au plus)", async () => {
    const f = llm();
    const e = await lancerChaine({ appelerPlan: f, planClaudeActif: async () => true });
    expect(f.appels).toBe(2);
    expect(e.remarques.some((r) => r.code === "PLAN_SIMPLE")).toBe(false);
  });
  it("R2 de bout en bout : branchement de production + dependancesDemoParDefaut, réglage `false` → plan simple, 0 appel du faux exécuteur ; réglage absent ou `true` → appelé", async () => {
    await import("@/services/demo-facecam-branchements");
    const { dependancesDemoParDefaut: parDefaut } = await import("@/moteurs/montage-demo-facecam/dependances");
    const env = { STUDIO_ALIGNEUR_URL: "https://aligneur.exemple", STUDIO_RENDU_URL: "https://rendu.exemple", STUDIO_RENDU_CLE: "cle-test" };
    const cmd = { videoId: "v1", origine: "studio", entrees: { facecamAligneurReel: true } } as unknown as CommandeFabrication;
    const prod = parDefaut(cmd, env, "t1");
    expect(prod?.appelerPlan).toBeDefined();
    espion.executer.mockReset();
    espion.executer.mockResolvedValue({ ok: false });
    espion.reglage = false;
    const sans = await lancerChaine({});
    const eteint = await lancerChaine({ appelerPlan: prod?.appelerPlan, planClaudeActif: prod?.planClaudeActif });
    expect(espion.executer).toHaveBeenCalledTimes(0);
    expect(eteint.sourcePlan).toBe(sans.sourcePlan);
    expect(eteint.remarques.some((r) => r.code === "PLAN_SIMPLE")).toBe(true);
    espion.reglage = undefined;
    await lancerChaine({ appelerPlan: prod?.appelerPlan, planClaudeActif: prod?.planClaudeActif });
    expect(espion.executer.mock.calls.length).toBeGreaterThan(0);
    espion.executer.mockClear();
    espion.reglage = true;
    await lancerChaine({ appelerPlan: prod?.appelerPlan, planClaudeActif: prod?.planClaudeActif });
    expect(espion.executer.mock.calls.length).toBeGreaterThan(0);
  });
  it("sans planClaudeActif (tests existants qui injectent appelerPlan) : comportement d'aujourd'hui", async () => {
    const f = llm();
    await lancerChaine({ appelerPlan: f });
    expect(f.appels).toBe(2);
  });
});

describe("d) gardes statiques", () => {
  const src = lireSource("src", "services", "demo-facecam-claude.ts");
  it("modèle Sonnet seul : ni haiku, ni fable, ni opus", () => {
    expect(src).not.toMatch(/haiku|fable|opus/i);
    expect(src).toContain('MODELE_CLAUDE_VIDEO = "claude-sonnet-5-5"');
  });
  it("jamais fetch, jamais appelerClaude ; client.ts seulement pour ErreurClaude et des types", () => {
    expect(src).not.toMatch(/\bfetch\(/);
    expect(src).not.toMatch(/appelerClaude|envoyerMessage/);
    const imports = [...src.matchAll(/^import (type )?(.*) from "@\/fournisseurs\/claude\/client";$/gm)];
    for (const m of imports) expect(m[1] ? "type" : m[2].replace(/type \w+,?\s*/g, "").trim()).toMatch(/^(type|\{\s*ErreurClaude\s*,?\s*\})$/);
    expect(src).toContain("server-only");
  });
  it("table d'argent littérale, identique à la fiche", () => {
    expect(src).toContain("export const PLAFONDS_CLAUDE_VIDEO_EUR = Object.freeze({ dmpln: 0.85, tbnar: 0.15, tblec: 0.25 } as const);");
    expect(src).toContain("export const PLAFOND_TOTAL_CLAUDE_VIDEO_EUR = 1.25;");
    expect(src).toContain('export const PREFIXES_ETAPE_CLAUDE_VIDEO = Object.freeze({ dmpln: "Démo · plan de scènes", tbnar: "Tableau de bord · narration", tblec: "Tableau de bord · lecture capture" } as const);');
  });
  it("boucle.ts charge le branchement exactement une fois", () => {
    expect(lireSource("src", "services", "boucle.ts").split("./demo-facecam-branchements").length - 1).toBe(1);
  });
  it("le branchement ne fait que brancher le plan et l'interrupteur", () => {
    const b = lireSource("src", "services", "demo-facecam-branchements.ts");
    expect(b).toContain("brancherServicesDemoFacecam");
    expect(b).toContain("appelClaudePlanDemo");
    expect(b).toContain("planClaudeDemoActif");
    expect(b).not.toMatch(/haiku|fable|opus/i);
  });
});
