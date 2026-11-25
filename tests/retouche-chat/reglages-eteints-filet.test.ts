/**
 * N-26-c2-v20j (G14-13) — filet : tant que les réglages `retoucheChat.*` ne valent pas exactement `true`, la route du chat
 * répond comme aujourd'hui pour TOUS les générateurs (403), sans construire de port, sans rien écrire, sans importer la
 * branche de la démo. Dépôts doublés par un témoin qui compte tout appel ; aucun réseau, 0 €.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CLES_REGLAGE_RETOUCHE, GENERATEURS_RETOUCHE } from "@/services/retouche-chat/generateurs";

const etat = vi.hoisted(() => ({
  valeur: undefined as unknown,
  lecturePanne: false,
  sansGenerateur: undefined as unknown,
  ports: [] as string[],
  appelsDepots: [] as string[],
  importes: [] as string[],
}));
vi.mock("server-only", () => ({}));
vi.mock("@/services/auth", () => ({ sessionApi: async () => ({ id: "s" }) }));
vi.mock("@/services/_commun", async (importer) => {
  const reel = await importer<typeof import("@/services/_commun")>();
  const collection = (nom: string) => new Proxy({}, { get: (_c, methode) => async () => void etat.appelsDepots.push(`${nom}.${String(methode)}`) });
  return {
    ...reel,
    lireParametre: async (id: string, defaut: unknown) => {
      if (etat.lecturePanne) throw new Error("lecture impossible");
      if (id === "retoucheChat.sansGenerateur") return etat.sansGenerateur ?? defaut;
      return etat.valeur ?? defaut;
    },
    depots: () => new Proxy({}, { get: (_d, nom) => collection(String(nom)) }),
  };
});
vi.mock("@/services/retouche-chat/generateurs-studio", async (importer) => {
  const reel = await importer<typeof import("@/services/retouche-chat/generateurs-studio")>();
  return { retoucheChatActifServeur: reel.retoucheChatActifServeur, portsGenerateurStudio: (g: string) => (etat.ports.push(g), {}) };
});
vi.mock("@/services/retouche-chat/studio", () => ({ portsStudio: () => (etat.ports.push("sans-generateur"), {}) }));
// Les 3 modules de la branche démo : chaque appel est compté (la fabrique d'un double n'est évaluée qu'une fois par fichier).
vi.mock("@/services/retouche-chat/appliquer-demo", () => ({ appliquerRetoucheDemo: () => (etat.importes.push("appliquer-demo"), {}) }));
vi.mock("@/services/retouche-chat/lancer-demo", () => ({ lancerRetoucheDemo: () => (etat.importes.push("lancer-demo"), {}) }));
vi.mock("@/services/retouche-chat/deps-demo-studio", () => ({ depsLancerDemoStudio: () => (etat.importes.push("deps-demo-studio"), {}) }));

vi.setConfig({ testTimeout: 60_000 });

const ACTIONS = [
  { action: "apercu", demande: "zoom" },
  { action: "appliquer", demande: "zoom", operations: [] },
  { action: "revenir", versionId: "v1" },
  { action: "historique" },
  { action: "retablir" },
] as const;
const VALEURS: [string, () => void][] = [
  ["absent", () => (etat.valeur = undefined)],
  ["false", () => (etat.valeur = false)],
  ['"true"', () => (etat.valeur = "true")],
  ["1", () => (etat.valeur = 1)],
  ["null", () => (etat.valeur = null)],
  ["{ actif: true }", () => (etat.valeur = { actif: true })],
  ["lecture qui lève", () => (etat.lecturePanne = true)],
];

async function poster(corps: unknown) {
  const { POST } = await import("@/app/api/retouche-chat/route");
  return POST(new Request("http://x/api/retouche-chat", { method: "POST", body: JSON.stringify(corps) }) as never);
}

beforeEach(() => {
  etat.valeur = undefined;
  etat.lecturePanne = false;
  etat.sansGenerateur = undefined;
  etat.ports = [];
  etat.appelsDepots = [];
  etat.importes = [];
});

describe("N-26-c2 · filet G14-13 : réglages éteints = comportement d'aujourd'hui", () => {
  it("la clé de chaque générateur est lue sur la liste réelle (6 générateurs, aucune liste recopiée)", () => {
    expect(GENERATEURS_RETOUCHE).toHaveLength(6);
    for (const g of GENERATEURS_RETOUCHE) expect(CLES_REGLAGE_RETOUCHE[g]).toMatch(/^retoucheChat\./);
  });

  for (const g of GENERATEURS_RETOUCHE) {
    for (const [nom, regler] of VALEURS) {
      it(`${g} · réglage ${nom} : les 5 actions répondent 403, aucun port, aucune lecture ni écriture de dépôt, aucun appel de la branche démo`, async () => {
        regler();
        if (g === "demo-facecam" && (nom === "absent" || nom === "null")) { // ALLUMER-RETOUCHE-DEMO-v21r : démo allumée par défaut (null en base = absent pour lireParametre), la garde laisse passer
          for (const a of ACTIONS) expect(await poster({ ...a, generateur: g, videoId: "vid" }).then((r) => r.status, () => 500), `${g} ${a.action}`).not.toBe(403); // les ports doublés ({}) font lever le gestionnaire : la garde est passée
          return;
        }
        for (const a of ACTIONS) {
          const r = await poster({ ...a, generateur: g, videoId: "vid" });
          expect(r.status, `${g} ${a.action}`).toBe(403);
        }
        expect(etat.ports).toEqual([]);
        expect(etat.appelsDepots).toEqual([]);
        expect(etat.importes).toEqual([]);
      });
    }
  }

  it("sans générateur, `retoucheChat.sansGenerateur` éteint (absent, false, 1, « true ») : 403 comme avant (C7-02), rien construit", async () => {
    for (const v of [undefined, false, 1, "true"]) {
      etat.sansGenerateur = v;
      for (const a of ACTIONS) expect((await poster({ ...a, videoId: "vid" })).status, `${String(v)} ${a.action}`).toBe(403);
    }
    expect(etat.ports).toEqual([]);
    expect(etat.appelsDepots).toEqual([]);
  });

  it("générateur inconnu : 400, avant toute lecture", async () => {
    expect((await poster({ action: "apercu", generateur: "tableau-anime", videoId: "vid", demande: "zoom" })).status).toBe(400);
    expect(etat.ports).toEqual([]);
    expect(etat.appelsDepots).toEqual([]);
  });

  it("témoin : réglage exactement `true` : la porte s'ouvre (plus de 403 ; 409 ici car le dépôt doublé ne rend aucune vidéo) — le filet n'est pas aveugle", async () => {
    etat.valeur = true;
    const r = await poster({ action: "appliquer", generateur: "demo-facecam", videoId: "vid", demande: "zoom", operations: [] });
    expect(r.status).toBe(409);
    expect(etat.appelsDepots).toContain("videos.obtenir");
  });
});
