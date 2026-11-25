/**
 * Branchement du film d'un dossier (service) : le port `filmDossier` n'existe que pour une vidéo partie d'un dossier ; capture automatique
 * éteinte, le zip n'est jamais lu ; allumée, le scénario vient du scenario.json du zip (lecture contrôlée de `portsEquipe`).
 */
import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { OutilsTutoriel } from "@/moteurs/montage-tutoriel-outil";
import { commandeTutoriel } from "./doubles";

const reglages = new Map<string, unknown>();
vi.mock("@/services/_commun", async (importOriginal) => ({ ...(await importOriginal<object>()), lireParametre: async (id: string, defaut: unknown) => (reglages.has(id) ? reglages.get(id) : defaut) }));
const lectures = vi.hoisted(() => ({ dossier: 0, fichiers: [] as { chemin: string; contenu: string }[] }));
vi.mock("@/services/tutoriel-equipe", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  portsEquipe: () => ({
    lireDossier: async () => {
      lectures.dossier++;
      return { fichiers: lectures.fichiers };
    },
  }),
}));
vi.mock("@/services/tableau-outils", () => ({
  TARIF_VOIX_CENTIMES_PAR_CARACTERE: 0,
  branchementsReels: async () => ({ voix: {}, montage: { rendu: () => ({}), signer: async () => ({ lectures: {}, depots: {} }) }, env: "test" }),
  branchementsReelsSansVoix: async () => ({ montage: { rendu: () => ({}), signer: async () => ({ lectures: {}, depots: {} }) }, env: "test" }),
}));

const SCENARIO = readFileSync("outils/maquettes-tableaux-de-bord/05-stocks/scenario.json", "utf8");
const commande = (depot: unknown) => commandeTutoriel({ distribution: [], entrees: { tutorielOutil: { scriptColle: true, modeVoix: "sans-voix", ...(depot ? { depot } : {}) } } } as never);
const DOSSIER = { mode: "dossier", fichierId: "f-1", attestationImages: true };

beforeAll(async () => {
  await import("@/services/tutoriel-branchements");
});
beforeEach(() => {
  reglages.clear();
  lectures.dossier = 0;
  lectures.fichiers = [{ chemin: "scenario.json", contenu: SCENARIO }];
});

async function outils(c: ReturnType<typeof commande>): Promise<OutilsTutoriel> {
  const { servicesTutoriel } = await import("@/moteurs/montage-tutoriel-outil");
  return (await servicesTutoriel().outils!(c, "t1")) as OutilsTutoriel;
}

describe("branchement du film d'un dossier", () => {
  it("capture automatique éteinte (absente, false, \"true\") : port présent, captureAuto false, le zip n'est jamais lu", async () => {
    for (const v of [undefined, false, "true", 1]) {
      reglages.clear();
      if (v !== undefined) reglages.set("tutoriel.captureAuto", v);
      const o = await outils(commande(DOSSIER));
      expect(o.filmDossier?.captureAuto).toBe(false);
    }
    expect(lectures.dossier).toBe(0);
  });

  it("capture automatique allumée : le scénario vient du scenario.json du zip, lu à la demande seulement", async () => {
    reglages.set("tutoriel.captureAuto", true);
    const o = await outils(commande(DOSSIER));
    expect(o.filmDossier?.captureAuto).toBe(true);
    expect(lectures.dossier).toBe(0);
    expect(((await o.filmDossier!.lireScenario()) as { maquette: string }).maquette).toBe("05-stocks");
    expect(lectures.dossier).toBe(1);
    lectures.fichiers = [{ chemin: "index.html", contenu: "<p/>" }];
    expect(await o.filmDossier!.lireScenario()).toBeNull();
  });

  it("vidéo qui ne part pas d'un dossier : aucun port filmDossier, même capture allumée", async () => {
    reglages.set("tutoriel.captureAuto", true);
    expect((await outils(commande({ mode: "phrase", phrase: "Un tutoriel" }))).filmDossier).toBeUndefined();
    expect((await outils(commande(undefined))).filmDossier).toBeUndefined();
    expect(lectures.dossier).toBe(0);
  });
});
