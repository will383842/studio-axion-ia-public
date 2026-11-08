import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";
import { PLAN_DEMO } from "@/briques/plan-scenes/demo";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import { schemaPlanStrict, type PlanValide } from "@/briques/plan-scenes/schema";
import { ErreurClaude, type ReponseClaude, type RequeteClaude } from "@/fournisseurs/claude/client";
import type { OperationRetouche } from "@/briques/operations";
import { appliquerOperations, comprendreDemande, construireRequeteRetouche, demandeExpliciteScript, impactRetouche, lireOperations, MODELE_RETOUCHE_CHAT, phraseImpact } from "@/services/retouche-chat";
import { apercevoirRetouche, appliquerRetouche, revenirAVersion, type PortsRetoucheChat } from "@/services/retouche-chat/service";

const reponse = (texte: string): ReponseClaude => ({ texte, modeleDemande: MODELE_RETOUCHE_CHAT, modele: MODELE_RETOUCHE_CHAT, replis: [], stopReason: "end_turn", jetons: { entree: 1, cacheLu: 0, cacheEcrit: 0, sortie: 1 } });
const llm = (operations: unknown, vus: RequeteClaude[] = []) => async (q: RequeteClaude) => {
  vus.push(q);
  return reponse(JSON.stringify({ operations }));
};
const plan0 = (): PlanValide => validerPlan(PLAN_DEMO, { mots: PLAN_DEMO.mots, format: PLAN_DEMO.format, facecam: false }).plan;

beforeEach(() => {
  vi.stubGlobal("fetch", () => {
    throw new Error("fetch interdit dans les tests");
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("comprendre (LLM simulé, sortie JSON validée par Zod)", () => {
  it("Opus 5.5 par défaut, JSON demandé, plan courant dans la demande", () => {
    expect(MODELE_RETOUCHE_CHAT).toBe("claude-opus-5-5");
    const q = construireRequeteRetouche("ajoute du dynamisme", plan0());
    expect(q.json).toBe(true);
    expect(q.modele).toBe(MODELE_RETOUCHE_CHAT);
    expect(q.messages[0]!.contenu).toContain("s2");
    expect(q.messages[0]!.contenu).toContain("ajoute du dynamisme");
  });

  it("opérations lues ; une opération inconnue ou du code libre est écartée avec une remarque (jamais exécuté)", async () => {
    const r = await comprendreDemande(
      { phrase: "change Axion CRM en Axion Pro à l'écran", plan: plan0() },
      llm([
        { type: "changer-mot", sceneId: "s2", ancien: "Axion CRM", nouveau: "Axion Pro" },
        { type: "code-libre", code: "process.exit(1)" },
        { type: "changer-brique", sceneId: "s1", piece: "legende", code: "alert(1)" },
      ]),
    );
    expect(r.source).toBe("llm");
    expect(r.operations).toEqual([{ type: "changer-mot", sceneId: "s2", ancien: "Axion CRM", nouveau: "Axion Pro" }]);
    expect(r.remarques.length).toBe(2);
  });

  it("modifier le script : écarté sans demande explicite, gardé si Williams le demande", async () => {
    const op = [{ type: "modifier-script", ancien: "38", nouveau: "40" }];
    expect((await comprendreDemande({ phrase: "mets 40 à la place de 38", plan: plan0() }, llm(op))).operations).toEqual([]);
    expect(demandeExpliciteScript("modifie le script : 40 au lieu de 38")).toBe(true);
    expect((await comprendreDemande({ phrase: "modifie le script : 40 au lieu de 38", plan: plan0() }, llm(op))).operations).toEqual(op);
  });

  it("LLM en panne ou illisible : jamais d'exception, lecture simple et remarque", async () => {
    const panne = await comprendreDemande({ phrase: "ajoute du dynamisme", plan: plan0() }, async () => {
      throw new ErreurClaude("surcharge", "surcharge");
    });
    expect(panne.source).toBe("simple");
    expect(panne.operations).toEqual([{ type: "ajouter-dynamisme", intensite: "leger" }]);
    const illisible = await comprendreDemande({ phrase: "bonjour", plan: plan0() }, async () => reponse("pas du json"));
    expect(illisible.operations).toEqual([]);
    expect(illisible.remarques.length).toBeGreaterThan(0);
  });

  it("lireOperations : liste fermée, champs stricts", () => {
    expect(lireOperations([{ type: "ajouter-dynamisme", intensite: "fort", sceneIds: ["s1"] }]).operations).toHaveLength(1);
    expect(lireOperations([{ type: "ajouter-dynamisme", intensite: "fort", script: "x" }]).operations).toHaveLength(0);
    expect(lireOperations("rien").operations).toHaveLength(0);
  });
});

describe("appliquer (revalidé par validerPlan, remarques au lieu de refus)", () => {
  it("changer un mot à l'écran : seule la scène visée change, le texte lu ne bouge pas", () => {
    const avant = plan0();
    const r = appliquerOperations(avant, [{ type: "changer-mot", sceneId: "s2", ancien: "fiche", nouveau: "carte" }]);
    expect(r.plan.scenes[1]!.texte).toBe("L'assistant remplit la carte");
    expect(r.plan.mots).toEqual(avant.mots);
    expect(schemaPlanStrict.safeParse(r.plan).success).toBe(true);
    const i = impactRetouche(avant, r.plan, r.operations);
    expect(i.scenes).toEqual(["s2"]);
    expect(i.voixTouchee).toBe(false);
  });

  it("ajouter du dynamisme : zooms sur les scènes existantes, toujours rendable", () => {
    const avant = plan0();
    const r = appliquerOperations(avant, [{ type: "ajouter-dynamisme", intensite: "leger", sceneIds: ["s1", "s3"] }]);
    for (const id of ["s1", "s3"]) {
      const s = r.plan.scenes.find((x) => x.id === id)!;
      expect(s.niveau).toBe(2);
      expect(s.calques!.some((c) => c.piece === "zoom-camera")).toBe(true);
    }
    expect(schemaPlanStrict.safeParse(r.plan).success).toBe(true);
    expect(impactRetouche(avant, r.plan, r.operations).scenes).toEqual(["s1", "s3"]);
  });

  it("zoom plus doux : facteur réduit sur le calque zoom existant", () => {
    const r = appliquerOperations(plan0(), [{ type: "ajuster-zoom", sceneId: "s2", facteur: 1.1 }]);
    const zoom = r.plan.scenes[1]!.calques!.find((c) => c.piece === "zoom-camera")!;
    expect((zoom.parametres as { facteur: number }).facteur).toBe(1.1);
  });

  it("ajouter, retirer, remplacer une pièce ; changer la transition", () => {
    const p = plan0();
    const a = appliquerOperations(p, [{ type: "ajouter-piece", sceneId: "s1", piece: "curseur" }]);
    expect(a.plan.scenes[0]!.calques!.map((c) => c.piece)).toEqual(["carte-kpi", "curseur"]);
    const b = appliquerOperations(p, [{ type: "retirer-piece", sceneId: "s2", piece: "curseur" }]);
    expect(b.plan.scenes[1]!.calques!.some((c) => c.piece === "curseur")).toBe(false);
    const c = appliquerOperations(p, [{ type: "remplacer-piece", sceneId: "s3", ancienne: "tableau-de-bord", nouvelle: "graphique" }]);
    expect(c.plan.scenes[2]!.piece).toBe("graphique");
    expect(schemaPlanStrict.safeParse(c.plan).success).toBe(true);
    const t = appliquerOperations(p, [{ type: "changer-transition", entree: "glisse-gauche" }]);
    expect(t.plan.scenes.every((s) => s.transition.entree === "glisse-gauche")).toBe(true);
  });

  it("scène inconnue ou mot introuvable : remarque, rien de cassé", () => {
    const avant = plan0();
    const r = appliquerOperations(avant, [
      { type: "changer-mot", sceneId: "s9", ancien: "a", nouveau: "b" },
      { type: "changer-mot", sceneId: "s1", ancien: "introuvable", nouveau: "b" },
    ]);
    expect(r.remarques.length).toBe(2);
    expect(impactRetouche(avant, r.plan, r.operations).scenes).toEqual([]);
  });

  it("une scène rendue invalide est repliée d'un niveau (calques illisibles → niveau 1), avec remarque", () => {
    const r = appliquerOperations(plan0(), [{ type: "ajouter-piece", sceneId: "s1", piece: "graphique", parametres: { type: "camembert" } }]);
    expect(schemaPlanStrict.safeParse(r.plan).success).toBe(true);
    expect(r.remarques.some((m) => m.code === "PARAMETRES_REPARES")).toBe(true);
  });

  it("modifier le script : la voix est touchée", () => {
    const avant = plan0();
    const ops: OperationRetouche[] = [{ type: "modifier-script", ancien: "38", nouveau: "40" }];
    const r = appliquerOperations(avant, ops);
    expect(r.plan.mots.some((m) => m.texte === "40")).toBe(true);
    expect(impactRetouche(avant, r.plan, r.operations).voixTouchee).toBe(true);
  });
});

describe("impact en mots simples", () => {
  it("phrases", () => {
    expect(phraseImpact({ scenes: ["a", "b"], total: 7, voixTouchee: false })).toBe("2 scènes sur 7 seront refaites, la voix ne change pas.");
    expect(phraseImpact({ scenes: ["a"], total: 3, voixTouchee: true })).toBe("1 scène sur 3 sera refaite, la voix sera refaite.");
    expect(phraseImpact({ scenes: [], total: 3, voixTouchee: false })).toBe("Aucune scène ne change, la voix ne change pas.");
  });
});

describe("rendu partiel et versions (bout en bout, doubles)", () => {
  function ports(appeler: PortsRetoucheChat["appeler"]) {
    const versions = new Map<string, { plan: PlanValide; parent?: string }>([["v1", { plan: plan0() }]]);
    const s = { choisie: "v1", rendus: [] as { scenes: string[]; voix: boolean }[], n: 1 };
    const p: PortsRetoucheChat = {
      appeler,
      lireVersionChoisie: async () => ({ versionId: s.choisie, plan: versions.get(s.choisie)!.plan }),
      rendreScenes: async (e) => {
        s.rendus.push({ scenes: e.scenes, voix: e.voix });
        return { fichierCle: `rendu-${s.rendus.length}.mp4`, dureeSec: e.plan.dureeMs / 1000 };
      },
      enregistrerVersion: async (e) => {
        const id = `v${++s.n}`;
        versions.set(id, { plan: e.plan, parent: e.parentVersionId });
        return { versionId: id };
      },
      choisirVersion: async (_v, id) => {
        s.choisie = id;
      },
    };
    return { p, s, versions };
  }

  it("aperçu → appliquer : seules les scènes touchées sont rendues, nouvelle version choisie ; retour arrière", async () => {
    const vus: RequeteClaude[] = [];
    const { p, s, versions } = ports(llm([{ type: "ajouter-dynamisme", intensite: "leger", sceneIds: ["s1", "s3"] }], vus));
    const apercu = await apercevoirRetouche("vid", "ajoute du dynamisme", p);
    expect(apercu.impact.phrase).toBe("2 scènes sur 3 seront refaites, la voix ne change pas.");
    expect(s.rendus).toEqual([]);
    const r = await appliquerRetouche("vid", { demande: "ajoute du dynamisme", operations: apercu.operations }, p);
    expect(vus).toHaveLength(1);
    expect(r.statut).toBe("rendue");
    expect(s.rendus).toEqual([{ scenes: ["s1", "s3"], voix: false }]);
    expect(s.choisie).toBe(r.statut === "rendue" ? r.versionId : "");
    expect(versions.get(s.choisie)!.parent).toBe("v1");
    await revenirAVersion("vid", "v1", p);
    expect(s.choisie).toBe("v1");
  });

  it("aucune scène touchée : aucune version, aucun rendu, une phrase", async () => {
    const { p, s } = ports(llm([]));
    const r = await appliquerRetouche("vid", { demande: "rien", operations: [] }, p);
    expect(r.statut).toBe("inchangee");
    expect(s.rendus).toEqual([]);
  });

  it("opérations venues du navigateur relues : du code libre n'atteint jamais le rendu", async () => {
    const { p, s } = ports(llm([]));
    const r = await appliquerRetouche("vid", { demande: "x", operations: [{ type: "code-libre", code: "x" }] as never }, p);
    expect(r.statut).toBe("inchangee");
    expect(s.rendus).toEqual([]);
  });

  it("rendu non branché : le plan retouché est gardé prêt, sans version ni refus", async () => {
    const { p } = ports(llm([]));
    const r = await appliquerRetouche("vid", { demande: "x", operations: [{ type: "changer-mot", sceneId: "s2", ancien: "fiche", nouveau: "carte" }] }, { ...p, rendreScenes: undefined });
    expect(r.statut).toBe("plan-pret");
  });
});
