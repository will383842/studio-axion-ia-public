/**
 * S-05-a-v20k : lecteur commun par générateur (réglage éteint, règles d'abord, au plus UN appel). Doubles seulement, 0 €.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { PLAN_DEMO } from "@/briques/plan-scenes/demo";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import { lireParRegles } from "@/services/retouche-chat/lecture-regles";
import { creerAppelEssai } from "@/services/retouche-chat/essai-a-blanc";
import { ADAPTATEURS_RETOUCHE, filtrerOperationsGenerateur } from "@/services/retouche-chat/generateurs";
import { PHRASE_LECTEUR_EPUISE, PHRASE_LECTEUR_NON_COMPRIS, MAX_JETONS_LECTEUR } from "@/services/retouche-chat/lecteur-demande";
import { CLES_REGLAGE_LECTEUR, avecLecteurCommun, lecteurClaudeActif, portsLecteurGenerateur } from "@/services/retouche-chat/lecteur-generateurs";
import { apercevoirRetouche, appliquerRetouche, type PortsRetoucheChat } from "@/services/retouche-chat/service";

const plan: PlanValide = validerPlan(structuredClone(PLAN_DEMO), { mots: PLAN_DEMO.mots, format: PLAN_DEMO.format, facecam: false }).plan;
const COMPRISE = "remplace assistant par robot à l'écran";
const NON_COMPRISE = "bonjour";
const REPONSE = JSON.stringify({
  operations: [
    { type: "ajouter-dynamisme", intensite: "leger" },
    { type: "modifier-script", ancien: "assistant", nouveau: "robot" },
  ],
});
const FA = "facecam-animee";

function monter(g: string, valeur: unknown, extra: { lecturesRestantes?: () => Promise<number>; lire?: (id: string, defaut: unknown) => Promise<unknown> } = {}) {
  const essai = creerAppelEssai([REPONSE, REPONSE]);
  const lire = extra.lire ?? (async () => valeur);
  const lecturesRestantes = extra.lecturesRestantes ?? (async () => 3);
  const base: PortsRetoucheChat = {
    appeler: essai.appeler,
    lireVersionChoisie: async () => ({ versionId: "v1", plan }),
    enregistrerVersion: async () => ({ versionId: "v2" }),
    choisirVersion: async () => {},
    rendreScenes: async () => ({ fichierCle: "k", dureeSec: 1 }),
    filtrerOperations: (o, d) => filtrerOperationsGenerateur("facecam-animee", o, d),
  };
  const ports = avecLecteurCommun(g, base, portsLecteurGenerateur(g, { appeler: essai.appeler, lire, lecturesRestantes }));
  return { ports, base, essai };
}

describe("S-05-a : lecteurClaudeActif", () => {
  it("allume seulement avec `true` exact pour un générateur à clé", async () => {
    expect(await lecteurClaudeActif(FA, async () => true)).toBe(true);
    expect(await lecteurClaudeActif("demo-facecam", async () => true)).toBe(true);
    for (const v of [false, "true", 1, null, undefined, {}, []]) expect(await lecteurClaudeActif(FA, async () => v)).toBe(false);
    expect(await lecteurClaudeActif(FA, async () => { throw new Error("base en panne"); })).toBe(false);
  });
  it("générateurs sans clé : toujours faux, le réglage n'est même pas lu", async () => {
    const lire = vi.fn(async () => true);
    for (const g of ["avocat", "image-video", "tutoriel-outil", "video-longue", "inconnu"]) expect(await lecteurClaudeActif(g, lire)).toBe(false);
    expect(lire).not.toHaveBeenCalled();
    expect(Object.keys(CLES_REGLAGE_LECTEUR).sort()).toEqual(["demo-facecam", "facecam-animee"]);
  });
});

describe("S-05-a : par le chemin réel (apercevoirRetouche + lireDemande)", () => {
  it("a) éteint : demande non comprise → phrase, 0 appel ; demande comprise → opérations des règles, 0 appel", async () => {
    for (const v of [undefined, false, "true", 1, null]) {
      const { ports, essai } = monter(FA, v);
      const a = await apercevoirRetouche("vid", NON_COMPRISE, ports);
      expect(a.remarques).toContain(PHRASE_LECTEUR_NON_COMPRIS);
      expect(essai.appels).toHaveLength(0);
      const b = await apercevoirRetouche("vid", COMPRISE, ports);
      expect(b.operations.map((o) => o.type)).toEqual(lireParRegles(COMPRISE, plan).map((o) => o.type));
      expect(essai.appels).toHaveLength(0);
    }
    const { ports, essai } = monter(FA, undefined, { lire: async () => { throw new Error("panne"); } });
    expect((await apercevoirRetouche("vid", NON_COMPRISE, ports)).remarques).toContain(PHRASE_LECTEUR_NON_COMPRIS);
    expect(essai.appels).toHaveLength(0);
  });

  it("b) générateur sans clé : même objet de ports, aperçu identique à celui d'aujourd'hui", async () => {
    for (const g of ["avocat", "image-video", "tutoriel-outil", "video-longue", "inconnu"]) {
      const { ports, base } = monter(g, true);
      expect(ports).toBe(base);
      expect(ports.lecteur).toBeUndefined();
    }
  });

  it("c) allumé, demande comprise par les règles : 0 appel", async () => {
    const { ports, essai } = monter(FA, true);
    const a = await apercevoirRetouche("vid", COMPRISE, ports);
    expect(a.operations.length).toBeGreaterThan(0);
    expect(essai.appels).toHaveLength(0);
  });

  it("d) allumé, demande non comprise : exactement 1 appel, 1 500 jetons, consigne du générateur, filtre appliqué", async () => {
    const { ports, essai } = monter(FA, true);
    const a = await apercevoirRetouche("vid", NON_COMPRISE, ports);
    expect(essai.appels).toHaveLength(1);
    expect(essai.appels[0].maxTokens).toBe(1500);
    expect(MAX_JETONS_LECTEUR).toBe(1500);
    expect(essai.appels[0].systeme.map((b) => b.texte)).toContain(ADAPTATEURS_RETOUCHE[FA].consigne);
    expect(a.operations.map((o) => o.type)).toEqual(["ajouter-dynamisme"]); // modifier-script écarté : prise filmée
  });

  it("e) allumé, plus de lecture permise : phrase d'épuisement, 0 appel", async () => {
    const { ports, essai } = monter(FA, true, { lecturesRestantes: async () => 0 });
    const a = await apercevoirRetouche("vid", NON_COMPRISE, ports);
    expect(a.remarques).toContain(PHRASE_LECTEUR_EPUISE);
    expect(essai.appels).toHaveLength(0);
  });

  it("f) appliquerRetouche : 0 appel, le lecteur n'est pas lu", async () => {
    const lire = vi.fn(async () => true);
    const lecturesRestantes = vi.fn(async () => 3);
    const { ports, essai } = monter(FA, true, { lire, lecturesRestantes });
    const r = await appliquerRetouche("vid", { demande: "d", operations: JSON.parse(REPONSE).operations.slice(0, 1) }, ports);
    expect(r.statut).toBe("rendue");
    expect(essai.appels).toHaveLength(0);
    expect(lire).not.toHaveBeenCalled();
    expect(lecturesRestantes).not.toHaveBeenCalled();
  });
});

describe("S-05-a : gardes de texte", () => {
  it("g) aucun fichier de src/** n'importe le module ; il ne lit pas la base", () => {
    const racine = new URL("../../src/", import.meta.url).pathname;
    const source = readFileSync(`${racine}services/retouche-chat/lecteur-generateurs.ts`, "utf8");
    expect(source).not.toContain("lireParametre(");
    const walk = (dir: string): string[] => {
      return readdirSync(dir).flatMap((f) => {
        const p = `${dir}${f}`;
        return statSync(p).isDirectory() ? walk(`${p}/`) : /\.(ts|tsx)$/.test(f) ? [p] : [];
      });
    };
    const fautifs = walk(racine).filter((f) => !f.endsWith("retouche-chat/lecteur-generateurs.ts") && readFileSync(f, "utf8").includes("lecteur-generateurs"));
    expect(fautifs).toEqual([]);
  });
});
