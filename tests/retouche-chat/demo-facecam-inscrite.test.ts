/**
 * N-26-a-v21p — la démo face caméra est inscrite au registre du chat de retouche ; réglage `retoucheChat.demoFacecam` ALLUMÉ par défaut (ALLUMER-RETOUCHE-DEMO).
 * Doubles seulement : aucun appel réel, aucune écriture.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PLAN_DEMO } from "@/briques/plan-scenes/demo";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import type { PlanValide } from "@/briques/plan-scenes/schema";

const etat = vi.hoisted(() => ({
  ports: [] as string[],
  reglages: {} as Record<string, unknown>,
  lectureLeve: false,
  adapterPlan: 0,
  plans: [] as Record<string, unknown>[],
  version: null as Record<string, unknown> | null,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/services/auth", () => ({ sessionApi: async () => ({ id: "s" }) }));
vi.mock("@/briques/plan-scenes-generateurs/adaptateur", () => ({ adapterPlan: async () => { etat.adapterPlan++; return { plan: null }; } }));
vi.mock("@/services/_commun", () => ({
  lireParametre: async (id: string, defaut: unknown) => {
    if (etat.lectureLeve) throw new Error("panne");
    return id in etat.reglages ? etat.reglages[id] : defaut;
  },
  depots: () => ({
    videos: { obtenir: async () => ({ id: "vid", versionChoisieId: "v1" }) },
    versions: { obtenir: async () => etat.version },
    plans: { lister: async () => etat.plans },
    travaux: { lister: async () => [] },
  }),
}));
vi.mock("@/services/retouche-chat/studio", async () => {
  const vide = { appeler: async () => ({ texte: '{"operations":[]}' }), lireVersionChoisie: async () => null, enregistrerVersion: async () => ({ versionId: "x" }), choisirVersion: async () => undefined };
  return { portsStudio: () => vide, planDuProjet: () => null };
});

import {
  ADAPTATEURS_RETOUCHE,
  CLES_REGLAGE_RETOUCHE,
  CLE_REGLAGE_DEMO_FACECAM,
  GENERATEURS_RETOUCHE,
  estGenerateurRetouche,
  filtrerOperationsGenerateur,
  portsGenerateur,
  retoucheChatActif,
} from "@/services/retouche-chat/generateurs";
import { appliquerRetouche, PHRASE_RENDU_NON_BRANCHE, type PortsRetoucheChat } from "@/services/retouche-chat/service";
import { portsGenerateurStudio, retoucheChatActifServeur } from "@/services/retouche-chat/generateurs-studio";
import { POST } from "@/app/api/retouche-chat/route";

const plan: PlanValide = validerPlan(PLAN_DEMO, { mots: PLAN_DEMO.mots, format: PLAN_DEMO.format, facecam: PLAN_DEMO.facecam, dureeMs: PLAN_DEMO.dureeMs }).plan;
const requete = (corps: unknown) => new Request("http://x/api/retouche-chat", { method: "POST", body: JSON.stringify(corps) }) as never;

beforeEach(() => {
  etat.reglages = {};
  etat.lectureLeve = false;
  etat.adapterPlan = 0;
  etat.plans = [];
  etat.version = { id: "v1", videoId: "vid", numero: 1, commande: { entrees: {} }, projetMontage: {} };
});

describe("N-26-a-v21p (a) inscription au registre", () => {
  it("(a) la démo est un générateur du chat, en dernier, avec sa clé", () => {
    expect(estGenerateurRetouche("demo-facecam")).toBe(true);
    expect([...GENERATEURS_RETOUCHE].at(-1)).toBe("demo-facecam");
    expect(CLES_REGLAGE_RETOUCHE["demo-facecam"]).toBe("retoucheChat.demoFacecam");
    expect(CLE_REGLAGE_DEMO_FACECAM).toBe("retoucheChat.demoFacecam");
    expect(ADAPTATEURS_RETOUCHE["demo-facecam"].id).toBe("demo-facecam");
    expect(ADAPTATEURS_RETOUCHE["demo-facecam"].nom).toBe("Démo face caméra");
    expect(ADAPTATEURS_RETOUCHE["demo-facecam"].consigne).toContain("La prise et la voix ne changent jamais, même sur demande.");
    expect(ADAPTATEURS_RETOUCHE["demo-facecam"].consigne).toMatch(/Rien devant le visage/);
    expect(estGenerateurRetouche("tableau-anime")).toBe(false);
  });
});

describe("N-26-a-v21p (b) réglage : seul `true` allume", () => {
  it("(b) absent → allumé ; false, \"true\", 1, {}, null, lecture qui lève → éteint ; true → allumé", async () => {
    const lire = (v: unknown) => async (_i: string, d: unknown) => (v === undefined ? d : v);
    expect(await retoucheChatActif("demo-facecam", lire(undefined))).toBe(true);
    for (const v of [false, "true", 1, {}, null]) expect(await retoucheChatActif("demo-facecam", lire(v)), String(v)).toBe(false);
    expect(await retoucheChatActif("demo-facecam", async () => { throw new Error("panne"); })).toBe(false);
    expect(await retoucheChatActif("demo-facecam", lire(true))).toBe(true);
  });
  it("(b) la clé lue est bien celle de la démo (pas celle d'un autre) ; version serveur : ALLUMÉE par défaut, 2e appel identique", async () => {
    etat.reglages = { "retoucheChat.avocat": true };
    expect(await retoucheChatActifServeur("demo-facecam")).toBe(true);
    expect(await retoucheChatActifServeur("demo-facecam")).toBe(true);
    etat.reglages = { "retoucheChat.demoFacecam": false };
    expect(await retoucheChatActifServeur("demo-facecam")).toBe(false);
    etat.reglages = { "retoucheChat.demoFacecam": true };
    expect(await retoucheChatActifServeur("demo-facecam")).toBe(true);
    expect(await retoucheChatActifServeur("avocat")).toBe(false);
  });
});

describe("N-26-a-v21p (c) route : éteinte (`false` écrit) → 403 (et non plus 400)", () => {
  it("(c) démo éteinte par `false` écrit : 403 ; générateur inconnu : toujours 400", async () => {
    etat.reglages = { "retoucheChat.demoFacecam": false };
    for (const action of ["apercu"] as const) {
      const r = await POST(requete({ action, videoId: "v", demande: "zoom", generateur: "demo-facecam" }));
      expect(r.status).toBe(403);
    }
    expect((await POST(requete({ action: "apercu", videoId: "v", demande: "zoom", generateur: "tableau-anime" }))).status).toBe(400);
  });
  it("(c) réglage lisible en échec ou autre que true : 403 aussi", async () => {
    etat.reglages = { "retoucheChat.demoFacecam": "true" };
    expect((await POST(requete({ action: "apercu", videoId: "v", demande: "zoom", generateur: "demo-facecam" }))).status).toBe(403);
    etat.lectureLeve = true;
    expect((await POST(requete({ action: "apercu", videoId: "v", demande: "zoom", generateur: "demo-facecam" }))).status).toBe(403);
  });
});

describe("N-26-a-v21p (d) allumée : plan prêt, aucune version, rien lancé", () => {
  function base() {
    const appels = { enregistrer: 0, choisir: 0 };
    const p: PortsRetoucheChat = {
      appeler: async () => { throw new Error("pas d'appel réel"); },
      lireVersionChoisie: async () => ({ versionId: "v1", plan }),
      enregistrerVersion: async () => { appels.enregistrer++; return { versionId: "v2" }; },
      choisirVersion: async () => { appels.choisir++; },
    };
    return { appels, ports: portsGenerateur("demo-facecam", p, {}) };
  }
  it("(d) appliquer : plan-pret + PHRASE_RENDU_NON_BRANCHE, 0 version enregistrée ni choisie", async () => {
    const { appels, ports } = base();
    const r = await appliquerRetouche("vid", { demande: "zoom plus doux", operations: [{ type: "ajuster-zoom", sceneId: plan.scenes[1]!.id, facteur: 1.1 }] }, ports);
    expect(r.statut).toBe("plan-pret");
    expect(r.statut === "plan-pret" && r.remarques).toContain(PHRASE_RENDU_NON_BRANCHE);
    expect(appels).toEqual({ enregistrer: 0, choisir: 0 });
    const encore = await appliquerRetouche("vid", { demande: "zoom plus doux", operations: [{ type: "ajuster-zoom", sceneId: plan.scenes[1]!.id, facteur: 1.1 }] }, ports);
    expect(encore.statut).toBe("plan-pret");
    expect(appels).toEqual({ enregistrer: 0, choisir: 0 });
  });
  it("(d) liste d'opérations vide : inchangée, rien d'écrit", async () => {
    const { appels, ports } = base();
    expect((await appliquerRetouche("vid", { demande: "x", operations: [] }, ports)).statut).toBe("inchangee");
    expect(appels).toEqual({ enregistrer: 0, choisir: 0 });
  });
  it("(d) le lancement de la démo n'est pas importé par l'inscription (c'est N-26-c2)", () => {
    for (const f of ["generateurs.ts", "generateurs-studio.ts"]) expect(readFileSync(`src/services/retouche-chat/${f}`, "utf8")).not.toMatch(/lancer-demo|appliquer-demo|lancerRetouche/);
  });
});

describe("N-26-a-v21p (e) la voix de la démo est une prise filmée", () => {
  const modifier = { type: "modifier-script", ancien: "a", nouveau: "b" } as never;
  const zoom = { type: "ajuster-zoom", sceneId: "s1", facteur: 1.1 } as never;
  it("(e) modifier-script écarté même sur demande explicite ; le zoom passe", () => {
    const r = filtrerOperationsGenerateur("demo-facecam", [modifier, zoom], "modifie le script : a devient b");
    expect(r.operations.map((o) => o.type)).toEqual(["ajuster-zoom"]);
    expect(r.remarques.join(" ")).toMatch(/prise filmée/i);
    expect(filtrerOperationsGenerateur("demo-facecam", [modifier, zoom], "zoom").operations).toHaveLength(1);
  });
  it("(e) opérations vides : vide", () => {
    expect(filtrerOperationsGenerateur("demo-facecam", [], "x")).toEqual({ operations: [], remarques: [] });
  });
});

describe("N-26-a-v21p (f) pas de plan de repli pour la démo", () => {
  it("(f) sans plan de projet : aucun plan, adapterPlan jamais appelé, même avec des phrases calées", async () => {
    etat.plans = [{ versionId: "v1", ordre: 1, texte: "bonjour", debutSec: 0, finSec: 2 }];
    const r = await portsGenerateurStudio("demo-facecam").lireVersionChoisie("vid");
    expect(r).toBeNull();
    expect(etat.adapterPlan).toBe(0);
  });
  it("(f) contraste : un autre générateur (image-video) garde son plan de repli (adapterPlan appelé)", async () => {
    etat.plans = [{ versionId: "v1", ordre: 1, texte: "bonjour", debutSec: 0, finSec: 2 }];
    await portsGenerateurStudio("image-video").lireVersionChoisie("vid");
    expect(etat.adapterPlan).toBe(1);
  });
});

describe("N-26-a-v21p (g) les 5 autres générateurs sont inchangés", () => {
  const FIGE: Record<string, [string, string, string]> = {
    avocat: ["retoucheChat.avocat", "Avocat", "5e210c38ee796765"],
    "image-video": ["retoucheChat.imageVideo", "Image → vidéo", "dc7367a8f7448d01"],
    "facecam-animee": ["retoucheChat.facecamAnimee", "Facecam animée", "7872f571a9f889a0"],
    "tutoriel-outil": ["retoucheChat.tutorielOutil", "Tutoriel", "e931bb0ddb04d75c"],
    "video-longue": ["retoucheChat.videoLongue", "Vidéo longue", "d21bd823da1add26"],
  };
  it("(g) clés, noms, opérations et consignes figés (empreinte) ; l'ordre des cinq est conservé", () => {
    expect([...GENERATEURS_RETOUCHE].slice(0, 5)).toEqual(Object.keys(FIGE));
    for (const [g, [cle, nom, h]] of Object.entries(FIGE)) {
      const a = ADAPTATEURS_RETOUCHE[g as keyof typeof ADAPTATEURS_RETOUCHE];
      expect(CLES_REGLAGE_RETOUCHE[g as keyof typeof CLES_REGLAGE_RETOUCHE], g).toBe(cle);
      expect(a.nom, g).toBe(nom);
      expect(createHash("sha256").update(a.consigne + JSON.stringify(a.operations)).digest("hex").slice(0, 16), g).toBe(h);
    }
    expect(GENERATEURS_RETOUCHE).toHaveLength(6);
  });
});
