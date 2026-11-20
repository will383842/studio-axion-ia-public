/**
 * T-EXT-53c — route du chat de retouche : branche du tutoriel (étapes lues dans le film de la version, N-22) ; avocat et
 * image-video gardent leur chemin d'aujourd'hui. Dépôts en mémoire, ports doublés : 0 €, aucun appel réel.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PLAN_DEMO } from "@/briques/plan-scenes/demo";
import { validerPlan } from "@/briques/plan-scenes/validateur";

const etat = vi.hoisted(() => ({ appels: [] as string[], plan: null as unknown }));
vi.mock("server-only", () => ({}));
vi.mock("@/services/auth", () => ({ sessionApi: async () => ({ id: "s" }) }));
vi.mock("@/services/retouche-chat/generateurs-studio", () => ({
  retoucheChatActifServeur: async () => true,
  portsGenerateurStudio: (g: string) => {
    etat.appels.push(g);
    return {
      appeler: async () => {
        throw new Error("aucun appel réel");
      },
      lireVersionChoisie: async () => (etat.plan ? { versionId: "ver-1", plan: etat.plan } : null),
      enregistrerVersion: async () => ({ versionId: "x" }),
      choisirVersion: async () => undefined,
    };
  },
}));
vi.mock("@/services/_commun", async (original) => ({ ...(await original<object>()), lireParametre: async (_id: string, defaut: unknown) => defaut, depots: (await import("@/donnees/memoire")).depots }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { POST } = await import("@/app/api/retouche-chat/route");

const t0 = "2026-11-15T10:00:00.000Z";
const requete = (corps: unknown) => new Request("http://x/api/retouche-chat", { method: "POST", body: JSON.stringify(corps) }) as never;
const plan = validerPlan(PLAN_DEMO, { mots: PLAN_DEMO.mots, format: PLAN_DEMO.format, facecam: PLAN_DEMO.facecam, dureeMs: PLAN_DEMO.dureeMs }).plan;
const IDS = ["accueil", "stocks", "ventes"];
const nav = {
  version: "navigation-filmee.v1",
  videoCle: "studio/test/film.mp4",
  maquette: "tableau",
  largeur: 1080,
  hauteur: 1350,
  debutFilmMs: 400,
  dureeVoixMs: 60000,
  cibles: IDS.map((etapeId, i) => ({ etapeId, zonePct: { x: 10, y: 10 + i * 20, largeur: 30, hauteur: 12 }, instantMs: 3000 + i * 5000, finMs: 5000 + i * 5000 })),
};

async function poser(videoId: string, etape: string) {
  await depots().videos.enregistrer({ id: videoId, titre: videoId, etapeEditoriale: etape, versionChoisieId: videoId + "1", creeLe: t0, modifieLe: t0 } as never);
  await depots().versions.enregistrer({ id: videoId + "1", videoId, numero: 1, choisie: true, commande: { entrees: { tutorielOutil: { scriptColle: true, navigationFilmee: nav } } }, creeLe: t0, modifieLe: t0 } as never);
}

beforeEach(async () => {
  reinitialiserDepots();
  etat.appels = [];
  etat.plan = plan;
  await poser("v-a-relire", "a_relire");
  await poser("v-publiee", "publiee");
});

describe("53c · route, branche du tutoriel", () => {
  it("avocat et image-video : réponse d'aujourd'hui (celle de apercevoirRetouche, sans statut ni changements)", async () => {
    etat.plan = null;
    for (const generateur of ["avocat", "image-video"]) {
      const r = await POST(requete({ action: "apercu", videoId: "v-a-relire", demande: "zoom", generateur }));
      expect(r.status).toBe(200);
      const corps = (await r.json()) as Record<string, unknown>;
      expect(Object.keys(corps).sort()).toEqual(["demande", "impact", "operations", "remarques"]);
      expect(etat.appels.at(-1)).toBe(generateur);
    }
  });

  it("tutoriel : l'aperçu passe par la branche du film (statut présent)", async () => {
    etat.plan = null;
    const corps = (await (await POST(requete({ action: "apercu", videoId: "v-a-relire", demande: "zoom", generateur: "tutoriel-outil" }))).json()) as { statut?: string };
    expect(corps.statut).toBe("inchangee");
  });

  it("tutoriel, appliquer : les étapes sont les cibles du film de la version choisie", async () => {
    const ok = await POST(requete({ action: "appliquer", videoId: "v-a-relire", demande: "zoom", operations: [], generateur: "tutoriel-outil", reglagesFilm: { parEtape: { [IDS[2]]: { zoom: "plus" } } } }));
    const corps = (await ok.json()) as { statut: string; changements?: { etape: number }[] };
    expect(corps.statut).toBe("plan-pret");
    expect(corps.changements).toEqual([{ etape: 3, avant: "zoom normal", apres: "plus serré" }]);
    // Un identifiant de scène du plan n'est pas une étape du film : réglages refusés, rien n'est changé.
    const refus = await POST(requete({ action: "appliquer", videoId: "v-a-relire", demande: "zoom", operations: [], generateur: "tutoriel-outil", reglagesFilm: { parEtape: { [plan.scenes[0]!.id]: { zoom: "plus" } } } }));
    const c2 = (await refus.json()) as { statut: string; remarques: string[] };
    expect(c2.statut).toBe("inchangee");
    expect(c2.remarques.join(" ")).toContain("Réglages du film illisibles");
  });

  it("N-22 : vidéo publiée → 409 sur appliquer du tutoriel, aucun port construit", async () => {
    const r = await POST(requete({ action: "appliquer", videoId: "v-publiee", demande: "zoom", operations: [], generateur: "tutoriel-outil", reglagesFilm: { parEtape: {} } }));
    expect(r.status).toBe(409);
    expect(etat.appels).toEqual([]);
  });
});
