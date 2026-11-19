/**
 * BR-FA-PLAN-FILTRE-b : le plan de scènes ne pose plus jamais une pièce pendant une plaquette v4 (branché, réglage éteint).
 * Chemin réel : vraie `avancerChaineV4` au pas « rendu », `rendre` factice qui CAPTE son entrée. Aucun appel, aucune dépense.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { avancerChaineV4, VERSION_CHAINE_V4, type EtatChaineV4, type OutilsChaineV4 } from "@/moteurs/montage-facecam-animee/chaine-v4";
import { intervallesV4 } from "@/briques/plan-scenes-generateurs/filtre-v4";
import type { PlanValide, SceneValide } from "@/briques/plan-scenes/schema";
import type { PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";

const PLAN_V4 = JSON.parse(readFileSync(join(__dirname, "..", "..", "docs/facecam-animee-v4/repetition-generale/plan-realisateur.json"), "utf8")) as PlanFacecamAnimee;
const demande = { videoId: "v-1", versionId: "ver-1", priseCle: "prises/brute.mp4", titre: "T" };
const scene = (id: string, debutMs: number, finMs: number) => ({ id, debutMs, finMs, empreinte: `emp-${id}` }) as unknown as SceneValide;
const planDe = (scenes: SceneValide[]) => ({ version: "x", facecam: true, dureeMs: 60_000, scenes }) as unknown as PlanValide;

function etatAuRendu(planScenes?: PlanValide): EtatChaineV4 {
  return {
    version: VERSION_CHAINE_V4,
    etape: "rendu",
    demande,
    coupes: { mots: [], gardes: [{ a: 0, f: 10 }], dureeSec: 10 },
    realisation: { version: "complete", essais: 1, avertissements: 0, plan: PLAN_V4 },
    videos: { fichiers: [], retirees: [], manques: [] },
    ...(planScenes ? { planScenes: { entree: "e", remarques: [], plan: planScenes } } : {}),
  } as unknown as EtatChaineV4;
}

async function rendre(etat: EtatChaineV4, extra: Partial<OutilsChaineV4> = {}) {
  const entrees: Record<string, unknown>[] = [];
  const outils = {
    transcrire: async () => { throw new Error("jamais appelé au pas « rendu »"); },
    plafondClaudeAtteint: async () => false,
    rendre: async (d: Record<string, unknown>) => {
      entrees.push(d);
      return { cle: "rendus/a.mp4", vignetteCle: "rendus/a.jpg", dureeSec: 9, taille: 1 };
    },
    ...extra,
  } as unknown as OutilsChaineV4;
  const apres = await avancerChaineV4(etat, outils);
  expect(entrees).toHaveLength(1);
  return { apres, entree: entrees[0] };
}

describe("BR-FA-PLAN-FILTRE-b", () => {
  const iv = intervallesV4(PLAN_V4);
  it("fixture : le plan v4 a des plaquettes", () => expect(iv.length).toBeGreaterThan(0));

  it("(a) la scène qui chevauche une plaquette n'est plus dans le plan rendu ; le mémo gardé reste brut", async () => {
    const sous = scene("sous", iv[0].debutMs + 100, iv[0].debutMs + 600);
    const loin = scene("loin", 500_000, 501_000);
    const brut = planDe([sous, loin]);
    const etat = etatAuRendu(brut);
    const { apres, entree } = await rendre(etat);
    const rendu = (entree.plan as { planScenes: PlanValide }).planScenes;
    expect(rendu.scenes.map((s) => s.id)).toEqual(["loin"]);
    for (const s of rendu.scenes) for (const e of iv) expect(s.debutMs < e.finMs + 200 && e.debutMs - 200 < s.finMs).toBe(false);
    expect(apres.planScenes?.plan).toBe(brut);
    expect(brut.scenes).toHaveLength(2);
  });

  it("(b) sans planScenes : plan passé à rendre identique à celui du réalisateur", async () => {
    const { entree } = await rendre(etatAuRendu());
    expect(entree.plan).toBe(PLAN_V4);
    expect(Object.keys(entree.plan as object)).not.toContain("planScenes");
  });

  it("rien à retirer : même plan de scènes", async () => {
    const brut = planDe([scene("loin", 500_000, 501_000)]);
    const { entree } = await rendre(etatAuRendu(brut));
    expect((entree.plan as { planScenes: PlanValide }).planScenes).toBe(brut);
  });
});
