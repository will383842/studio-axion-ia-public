/**
 * Étape « videos » : quand les contrôles H1/H2 PASSENT après retrait (simulés ici : aucun plan réel de la répétition ne survit au retrait d'une
 * plaquette à vidéo), le plan sans la plaquette est rendu, le retrait est noté et aucun media vide n'arrive au rendu.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import { avancerChaineV4, etatInitialV4, type EtatChaineV4, type OutilsChaineV4 } from "@/moteurs/montage-facecam-animee/chaine-v4";
import { plaquettesSansVideo } from "@/moteurs/montage-facecam-animee/videos-v4";

vi.mock("@/moteurs/montage-facecam-animee/realisateur/regles-v4", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/moteurs/montage-facecam-animee/realisateur/regles-v4")>()), controlerDiversiteV4: () => ({ erreurs: [], avertissements: [], mesures: null }) }));

const R = join(__dirname, "..", "..", "docs/facecam-animee-v4/repetition-generale");
const PLAN = JSON.parse(readFileSync(join(R, "plan-realisateur.json"), "utf8")) as PlanFacecamAnimee;
const TRANS = JSON.parse(readFileSync(join(R, "transcription.json"), "utf8")) as { dureeMonteeSec: number; gardes: { debutSec: number; finSec: number }[]; motsMontesTexteValide: never[] };
const A_VIDEO = new Set(["AvantApres", "MosaiqueVideos", "duel-video"]);

describe("étape « videos » · retrait accepté", () => {
  it("contrôles passés : plaquettes sans vidéo retirées, retrait noté, rendu sans media vide", async () => {
    const elementsV4 = (PLAN.elementsV4 ?? []).map((e) => {
      if (!A_VIDEO.has(e.id)) return e;
      const c = { ...e };
      delete c.medias;
      return c;
    });
    const etat: EtatChaineV4 = { ...etatInitialV4({ videoId: "v-1", versionId: "ver-1", priseCle: "k" }), etape: "videos", coupes: { gardes: TRANS.gardes, dureeSec: TRANS.dureeMonteeSec, mots: TRANS.motsMontesTexteValide }, realisation: { version: "complete", essais: 1, avertissements: 0, plan: { ...PLAN, elementsV4 } } };
    const rendre = vi.fn(async (d: Parameters<OutilsChaineV4["rendre"]>[0]) => ({ cle: "c", vignetteCle: "j", dureeSec: d.plan.duree, taille: 1 }));
    const o = { rendre } as unknown as OutilsChaineV4;
    const apres = await avancerChaineV4(etat, o);
    expect(apres.etape).toBe("rendu");
    expect(apres.videos?.retirees.length).toBeGreaterThan(0);
    expect(apres.videos?.controle).toEqual({ rendable: true, erreurs: [] });
    await avancerChaineV4(apres, o);
    expect(plaquettesSansVideo(rendre.mock.calls[0][0].plan)).toEqual([]);
    expect(rendre.mock.calls[0][0].plan.elementsV4!.every((e) => !A_VIDEO.has(e.id))).toBe(true);
  });
});
