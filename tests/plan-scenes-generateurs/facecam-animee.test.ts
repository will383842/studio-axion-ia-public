/**
 * Lot R2 — Facecam animée : plan de scènes de bout en bout sur la chaîne v4 (outils doubles : LLM, transcription et rendu
 * simulés ; aucun appel réel). Éteint par défaut : le plan envoyé au rendu est celui d'avant.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { schemaPlanFacecamAnimee, type PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import { schemaPlanStrict } from "@/briques/plan-scenes/schema";
import type { RequeteClaude, ReponseClaude } from "@/fournisseurs/claude/client";
import { avancerChaineV4, etatInitialV4, type EtatChaineV4, type OutilsChaineV4 } from "@/moteurs/montage-facecam-animee/chaine-v4";
import type { MotTranscrit } from "@/moteurs/montage-facecam-animee/realisateur";

const REPETITION = join(__dirname, "..", "..", "docs/facecam-animee-v4/repetition-generale");
const TRANS = JSON.parse(readFileSync(join(REPETITION, "transcription.json"), "utf8")) as { dureeMonteeSec: number; gardes: { debutSec: number; finSec: number }[]; motsMontesTexteValide: MotTranscrit[] };
const PLAN = JSON.parse(readFileSync(join(REPETITION, "plan-realisateur.json"), "utf8")) as PlanFacecamAnimee;

const base = (): EtatChaineV4 => ({
  ...etatInitialV4({ videoId: "v-1", versionId: "ver-1", priseCle: "k.mov" }),
  etape: "rendu",
  coupes: { gardes: TRANS.gardes, dureeSec: TRANS.dureeMonteeSec, mots: TRANS.motsMontesTexteValide },
  realisation: { version: "complete", essais: 1, avertissements: 0, plan: PLAN },
});

function outils(extra: Partial<OutilsChaineV4> = {}) {
  const rendre = vi.fn(async (d: Parameters<OutilsChaineV4["rendre"]>[0]) => ({ cle: "c.mp4", vignetteCle: "c.jpg", dureeSec: d.plan.duree, taille: 1 }));
  return { o: { transcrire: vi.fn(), plafondClaudeAtteint: async () => false, rendre, ...extra } as unknown as OutilsChaineV4, rendre };
}
const llmSimule = () => {
  const requetes: RequeteClaude[] = [];
  return { requetes, appeler: async (r: RequeteClaude): Promise<ReponseClaude> => (requetes.push(r), { texte: JSON.stringify({ version: "plan-scenes-1", scenes: [] }), stopReason: "end_turn" } as ReponseClaude) };
};

describe("Facecam animée · plan de scènes", () => {
  it("éteint par défaut : un seul pas, le rendu reçoit exactement le plan du réalisateur", async () => {
    const { o, rendre } = outils();
    const apres = await avancerChaineV4(base(), o);
    expect(apres.etape).toBe("prete");
    expect(rendre).toHaveBeenCalledTimes(1);
    expect(rendre.mock.calls[0]![0].plan).toEqual(PLAN);
    expect(apres.planScenes).toBeUndefined();
  });

  it("allumé : un pas compose et garde le plan, le pas suivant le rend avec le plan de scènes (face caméra, valide)", async () => {
    const llm = llmSimule();
    const { o, rendre } = outils({ planScenes: { appeler: llm.appeler } });
    const compose = await avancerChaineV4(base(), o);
    expect(compose.etape).toBe("rendu");
    expect(rendre).not.toHaveBeenCalled();
    expect(llm.requetes).toHaveLength(1);
    expect(compose.planScenes?.entree).toMatch(/^[0-9a-f]{16}$/);
    const fini = await avancerChaineV4(compose, o);
    expect(fini.etape).toBe("prete");
    expect(llm.requetes).toHaveLength(1);
    const envoye = rendre.mock.calls[0]![0].plan;
    expect(schemaPlanFacecamAnimee.safeParse(envoye).success).toBe(true);
    const lu = schemaPlanStrict.safeParse(envoye.planScenes);
    expect(lu.success).toBe(true);
    if (lu.success) {
      expect(lu.data.facecam).toBe(true);
      expect(lu.data.scenes.every((s) => s.niveau !== 3 && ["bas", "haut"].includes(s.position))).toBe(true);
    }
    // Le reste du plan n'a pas bougé.
    const { planScenes: _p, ...reste } = envoye;
    void _p;
    expect(reste).toEqual(PLAN);
  });

  it("une reprise après un rendu en cours ne rappelle pas l'IA (plan gardé dans l'état)", async () => {
    const llm = llmSimule();
    const { o } = outils({ planScenes: { appeler: llm.appeler } });
    const compose = await avancerChaineV4(base(), o);
    const encore = await avancerChaineV4(JSON.parse(JSON.stringify(compose)) as EtatChaineV4, o);
    expect(encore.etape).toBe("prete");
    expect(llm.requetes).toHaveLength(1);
  });

  it("panne de l'IA : plan de pièces du stock, la vidéo sort quand même", async () => {
    const { o, rendre } = outils({ planScenes: { appeler: async () => { throw new Error("panne simulée"); } } });
    const compose = await avancerChaineV4(base(), o);
    const fini = await avancerChaineV4(compose, o);
    expect(fini.etape).toBe("prete");
    expect(compose.planScenes?.remarques.some((r) => r.code === "LLM_INDISPONIBLE")).toBe(true);
    expect(rendre).toHaveBeenCalledTimes(1);
  });
});
