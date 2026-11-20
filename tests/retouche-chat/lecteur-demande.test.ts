/**
 * T-EXT-53b : lecteur de demande COMMUN. Faux `appeler` qui compte : aucun appel réel, 0 €.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PLAN_DEMO } from "@/briques/plan-scenes/demo";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import type { AppelClaude } from "@/briques/plan-scenes/generateur";
import { ErreurClaude, type RequeteClaude, type ReponseClaude } from "@/fournisseurs/claude/client";
import { construireRequeteRetouche } from "@/services/retouche-chat/comprendre";
import { MAX_JETONS_LECTEUR, PHRASE_LECTEUR_EPUISE, PHRASE_LECTEUR_NON_COMPRIS, PHRASE_LECTEUR_VIDE, creerLecteur, lireDemande, type PortsLecteur, type SupplementLecteur } from "@/services/retouche-chat/lecteur-demande";

const plan: PlanValide = validerPlan(PLAN_DEMO, { mots: PLAN_DEMO.mots, format: PLAN_DEMO.format, facecam: PLAN_DEMO.facecam, dureeMs: PLAN_DEMO.dureeMs }).plan;

type OpPropre = { type: "ajuster-demo"; etape: number };
const supplement: SupplementLecteur<OpPropre> = {
  bloc: "BLOC-PROPRE : opérations de la démo",
  regles: (p) => (/\betape 3\b/i.test(p) ? [{ type: "ajuster-demo", etape: 3 }] : []),
  relire: (brut) => {
    const liste = Array.isArray(brut) ? brut : [];
    const ok = liste.filter((o): o is OpPropre => !!o && typeof o === "object" && (o as { type?: unknown }).type === "ajuster-demo" && !("code" in o));
    return { operations: ok, remarques: ok.length < liste.length ? ["Une opération propre a été écartée."] : [] };
  },
};

function double(reponse: string | Error | (() => never)) {
  const appels: RequeteClaude[] = [];
  const appeler: AppelClaude = async (requete) => {
    appels.push(requete);
    if (typeof reponse === "function") reponse();
    if (reponse instanceof Error) throw reponse;
    return { texte: reponse as string, modeleDemande: requete.modele, modele: requete.modele, replis: [], stopReason: "end_turn", jetons: { entree: 0, cacheLu: 0, cacheEcrit: 0, sortie: 0 } } as ReponseClaude;
  };
  return { appeler, appels };
}
const ports = (appeler: AppelClaude, o: Partial<PortsLecteur> = {}): PortsLecteur => ({ appeler, claudeAllume: async () => true, ...o });
const INCOMPRIS = "fais quelque chose de joli pour moi";

describe("T-EXT-53b : règles d'abord, 0 appel", () => {
  it("phrase vide → rien", async () => {
    const d = double("{}");
    const r = await lireDemande({ phrase: "   ", plan }, ports(d.appeler));
    expect(r).toMatchObject({ source: "rien", appels: 0, remarques: [PHRASE_LECTEUR_VIDE] });
    expect(d.appels).toHaveLength(0);
  });
  it("lireParRegles comprend → règles", async () => {
    const d = double("{}");
    const r = await lireDemande({ phrase: "zoom sur la scène 2", plan }, ports(d.appeler));
    expect(r.source).toBe("regles");
    expect(r.operations).toEqual([{ type: "ajuster-zoom", sceneId: "s2", facteur: 1.5 }]);
    expect(d.appels).toHaveLength(0);
  });
  it("lectureSimple (« plus de dynamisme ») → règles", async () => {
    const d = double("{}");
    const r = await lireDemande({ phrase: "plus de dynamisme", plan }, ports(d.appeler));
    expect(r).toMatchObject({ source: "regles", appels: 0 });
    expect(r.operations[0]?.type).toBe("ajouter-dynamisme");
    expect(d.appels).toHaveLength(0);
  });
  it("règles du supplément seules → règles, 0 appel", async () => {
    const d = double("{}");
    const r = await lireDemande({ phrase: "etape 3 plus serrée", plan, supplement }, ports(d.appeler));
    expect(r).toMatchObject({ source: "regles", appels: 0, operations: [], supplementaires: [{ type: "ajuster-demo", etape: 3 }] });
    expect(d.appels).toHaveLength(0);
  });
});

describe("T-EXT-53b : Claude éteint ou épuisé", () => {
  it.each([["faux", async () => false], ["en échec", async () => { throw new Error("lecture"); }]])("réglage %s → rien, 0 appel", async (_n, claudeAllume) => {
    const d = double("{}");
    const r = await lireDemande({ phrase: INCOMPRIS, plan }, ports(d.appeler, { claudeAllume }));
    expect(r).toMatchObject({ source: "rien", appels: 0, remarques: [PHRASE_LECTEUR_NON_COMPRIS] });
    expect(d.appels).toHaveLength(0);
  });
  it.each([["0", async () => 0], ["en échec", async () => { throw new Error("lecture"); }]])("lectures restantes %s → rien, 0 appel", async (_n, lecturesRestantes) => {
    const d = double("{}");
    const r = await lireDemande({ phrase: INCOMPRIS, plan }, ports(d.appeler, { lecturesRestantes }));
    expect(r).toMatchObject({ source: "rien", appels: 0, remarques: [PHRASE_LECTEUR_EPUISE] });
    expect(d.appels).toHaveLength(0);
  });
});

describe("T-EXT-53b : exactement un appel", () => {
  it("allumé + 1 restante : UN appel, requête = celle du chat (même système, même modèle), maxTokens du lecteur, bloc à la fin", async () => {
    const d = double(JSON.stringify({ operations: [{ type: "ajouter-dynamisme", intensite: "leger" }], supplementaires: [{ type: "ajuster-demo", etape: 2 }] }));
    const r = await lireDemande({ phrase: INCOMPRIS, plan, supplement }, ports(d.appeler, { lecturesRestantes: async () => 1 }));
    expect(d.appels).toHaveLength(1);
    const base = construireRequeteRetouche(INCOMPRIS, plan);
    const q = d.appels[0]!;
    expect(q.systeme).toEqual(base.systeme);
    expect(q.modele).toBe(base.modele);
    expect(q.maxTokens).toBe(MAX_JETONS_LECTEUR);
    expect(MAX_JETONS_LECTEUR).toBeLessThan(base.maxTokens);
    const user = q.messages[q.messages.length - 1]!.contenu;
    expect(user.startsWith(base.messages[0]!.contenu)).toBe(true);
    expect(user.endsWith(`${supplement.bloc}\nLes opérations propres à cette vidéo vont dans la clé "supplementaires".`)).toBe(true);
    expect(r).toMatchObject({ source: "claude", appels: 1, supplementaires: [{ type: "ajuster-demo", etape: 2 }] });
    expect(r.operations).toEqual([{ type: "ajouter-dynamisme", intensite: "leger" }]);
  });
  it("sans supplément : requête sans bloc", async () => {
    const d = double(JSON.stringify({ operations: [] }));
    await lireDemande({ phrase: INCOMPRIS, plan }, ports(d.appeler));
    expect(d.appels[0]!.messages[0]!.contenu).toBe(construireRequeteRetouche(INCOMPRIS, plan).messages[0]!.contenu);
  });
  it("opération hors liste ou champ « code » : écartés avec remarque ; supplément relu strictement", async () => {
    const d = double(JSON.stringify({ operations: [{ type: "executer", code: "x" }, { type: "ajouter-dynamisme", intensite: "fort", code: "x" }], supplementaires: [{ type: "ajuster-demo", etape: 1 }, { type: "ajuster-demo", etape: 2, code: "x" }] }));
    const r = await lireDemande({ phrase: INCOMPRIS, plan, supplement }, ports(d.appeler));
    expect(r.operations).toEqual([]);
    expect(r.supplementaires).toEqual([{ type: "ajuster-demo", etape: 1 }]);
    expect(r.remarques.length).toBeGreaterThan(0);
  });
  it("modifier-script sans demande explicite → écarté ; avec demande explicite → gardé", async () => {
    const rep = JSON.stringify({ operations: [{ type: "modifier-script", ancien: "assistant", nouveau: "robot" }] });
    const sans = await lireDemande({ phrase: INCOMPRIS, plan }, ports(double(rep).appeler));
    expect(sans.operations).toEqual([]);
    expect(sans.remarques.join(" ")).toContain("Le texte lu reste le vôtre");
    const avec = await lireDemande({ phrase: "modifie le script, mets robot à la place d'assistant", plan }, ports(double(rep).appeler));
    expect(avec.operations).toHaveLength(1);
  });
  it("réponse reçue mais illisible → rien, appels: 1 (l'appel a eu lieu et été payé)", async () => {
    const d = double("pas du JSON");
    const r = await lireDemande({ phrase: INCOMPRIS, plan, supplement }, ports(d.appeler));
    expect(r).toMatchObject({ source: "rien", appels: 1, remarques: [PHRASE_LECTEUR_NON_COMPRIS] });
    expect(d.appels).toHaveLength(1);
  });
  it("relecture qui lève après une réponse reçue → rien, appels: 1", async () => {
    const d = double(JSON.stringify({ operations: [], supplementaires: [{ type: "ajuster-demo", etape: 1 }] }));
    const r = await lireDemande({ phrase: INCOMPRIS, plan, supplement: { ...supplement, relire: () => { throw new Error("boum"); } } }, ports((q) => d.appeler(q)));
    expect(d.appels).toHaveLength(1);
    expect(r).toMatchObject({ source: "rien", appels: 1 });
  });
  // Un port qui LÈVE (plafond refusé, panne) n'a rendu aucune réponse : rien n'est facturé par ce lecteur, donc appels: 0 (documenté dans lecteur-demande.ts).
  it.each([
    ["ErreurClaude", new ErreurClaude("requete", "La limite de cette vidéo est atteinte : rien n'a été payé.")],
    ["exception quelconque", new Error("boum 12 €")],
  ])("%s → rien, au plus 1 appel, aucune exception", async (_n, rep) => {
    const d = double(rep as string | Error);
    const r = await lireDemande({ phrase: INCOMPRIS, plan, supplement }, ports(d.appeler));
    expect(r).toMatchObject({ source: "rien", appels: 0, remarques: [PHRASE_LECTEUR_NON_COMPRIS] });
    expect(d.appels.length).toBeLessThanOrEqual(1);
  });
  it("aucune phrase du lecteur ne contient « $ », « € » ni nombre décimal", () => {
    for (const p of [PHRASE_LECTEUR_VIDE, PHRASE_LECTEUR_NON_COMPRIS, PHRASE_LECTEUR_EPUISE]) expect(p).not.toMatch(/[$€]|\d+[.,]\d+/);
  });
  it("creerLecteur : forme du port du service", async () => {
    const d = double("{}");
    const r = await creerLecteur(supplement, ports(d.appeler))("zoom sur la scène 2", plan);
    expect(r).toMatchObject({ source: "regles", supplementaires: [] });
    expect(Object.keys(r).sort()).toEqual(["operations", "remarques", "source", "supplementaires"]);
  });
});

describe("T-EXT-53b : pièce commune", () => {
  it("aucun import du tutoriel ni d'un moteur ; pas de server-only", () => {
    const t = readFileSync("src/services/retouche-chat/lecteur-demande.ts", "utf8");
    const imports = t.split("\n").filter((l) => /^import /.test(l)).join("\n");
    expect(imports).not.toMatch(/montage-tutoriel-outil|tutoriel-claude|moteurs\/|server-only/);
  });
});
