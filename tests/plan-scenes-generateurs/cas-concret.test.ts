/**
 * Lot R2 — Cas concret : plan de scènes de bout en bout, avec les doubles de la chaîne (LLM, voix, alignement et rendu
 * simulés ; aucun appel réel, ni FFmpeg ni Chrome). Éteint par défaut : aucun changement visible.
 */
import { describe, expect, it } from "vitest";
import { trouverCas } from "@/formats/cas-concret/catalogue";
import { ficheParGabarit } from "@/moteurs/montage-cas-concret/ecriture";
import { fabriquerCasConcret } from "@/moteurs/montage-cas-concret/fabriquer";
import type { FicheEcrans } from "@/moteurs/montage-cas-concret/fiche";
import { schemaPlanStrict, type PlanValide } from "@/briques/plan-scenes/schema";
import type { RequeteClaude, ReponseClaude } from "@/fournisseurs/claude/client";
import { doubles, type Doubles } from "../cas-concret/fabriquer/doubles";

const FIXE = { videoId: "video-cc", versionId: "v1", habillage: "charte-duo/1", origine: "porte-a" as const };
const ficheDe = (casId: string): FicheEcrans => ficheParGabarit(trouverCas(casId)!, FIXE);
function avecFiche(d: Doubles, fiche: unknown): Doubles {
  d.options.entrees = { ...d.options.entrees, ficheCle: "studio/dev/fiches/video-cc.json" };
  d.options.lireFiche = async () => structuredClone(fiche);
  return d;
}
const proprietes = (d: Doubles) => d.ecransSoumis().map((s) => (s.parametres as { proprietes: { id: string; planScenes?: PlanValide } }).proprietes);

/** LLM simulé : renvoie un plan vide de scènes valides (le validateur répare tout : repli sur le stock). */
function llmSimule() {
  const requetes: RequeteClaude[] = [];
  const appeler = async (r: RequeteClaude): Promise<ReponseClaude> => (requetes.push(r), { texte: JSON.stringify({ version: "plan-scenes-1", scenes: [] }), stopReason: "end_turn" } as ReponseClaude);
  return { requetes, appeler };
}

describe("Cas concret · plan de scènes", () => {
  it("éteint par défaut : aucun écran ne porte de plan, rien n'est gardé au journal", async () => {
    const d = avecFiche(doubles(), ficheDe("recrutement-apporteurs"));
    await fabriquerCasConcret(d.options);
    expect(d.ecransSoumis().length).toBeGreaterThan(0);
    for (const p of proprietes(d)) expect(p.planScenes).toBeUndefined();
    expect(d.partage.journal.valeur?.planScenes).toBeUndefined();
  });

  it("allumé (pièces du stock) : des écrans portent une tranche valide, gardée au journal", async () => {
    const d = avecFiche(doubles(), ficheDe("recrutement-apporteurs"));
    d.options.planScenes = {};
    await fabriquerCasConcret(d.options);
    const avecPlan = proprietes(d).filter((p) => p.planScenes);
    expect(avecPlan.length).toBeGreaterThan(0);
    for (const p of avecPlan) {
      expect(schemaPlanStrict.safeParse(p.planScenes).success).toBe(true);
      expect(p.planScenes!.scenes.every((s) => s.niveau === 1)).toBe(true);
      expect(p.planScenes!.scenes[0]!.debutMs).toBeGreaterThanOrEqual(0);
    }
    expect(Object.keys(d.partage.journal.valeur?.planScenes ?? {})).toContain("corps");
  });

  it("allumé avec le LLM simulé : un appel par groupe, jamais rappelé à la reprise, aucun écran rendu de nouveau", async () => {
    const llm = llmSimule();
    const fiche = ficheDe("recrutement-apporteurs");
    const d = avecFiche(doubles(), fiche);
    d.options.planScenes = { appeler: llm.appeler };
    const cr = await fabriquerCasConcret(d.options);
    const groupes = Object.keys(d.partage.journal.valeur!.planScenes!);
    expect(llm.requetes).toHaveLength(groupes.length);
    expect(llm.requetes.every((r) => r.modele === "claude-opus-5-5")).toBe(true);
    // Reprise : même journal, mêmes fichiers.
    const d2 = avecFiche(doubles({ partage: d.partage }), fiche);
    d2.options.planScenes = { appeler: llm.appeler };
    const cr2 = await fabriquerCasConcret(d2.options);
    expect(llm.requetes).toHaveLength(groupes.length);
    expect(d2.ecransSoumis()).toHaveLength(0);
    expect(cr2.ecrans.repris).toHaveLength(cr.ecrans.rendus.length);
  });

  it("un seul écran changé (plan allumé) → un seul écran rendu à nouveau", async () => {
    const fiche = ficheDe("recrutement-apporteurs");
    const d = avecFiche(doubles(), fiche);
    d.options.planScenes = {};
    await fabriquerCasConcret(d.options);
    const i = fiche.ecrans.findIndex((e) => e.type === "etape" && e.puces.length === 0);
    expect(i).toBeGreaterThan(-1);
    const changee = structuredClone(fiche);
    (changee.ecrans[i] as { puces: string[] }).puces = ["Sans papier"];
    const d2 = avecFiche(doubles({ partage: d.partage }), changee);
    d2.options.planScenes = {};
    const cr2 = await fabriquerCasConcret(d2.options);
    expect(d2.ecransSoumis()).toHaveLength(1);
    expect(cr2.ecrans.rendus).toEqual([fiche.ecrans[i]!.id]);
  });

  it("allumer l'option change l'empreinte de rendu des seuls écrans qui reçoivent des scènes", async () => {
    const fiche = ficheDe("recrutement-apporteurs");
    const eteint = avecFiche(doubles(), fiche);
    await fabriquerCasConcret(eteint.options);
    const allume = avecFiche(doubles({ partage: eteint.partage }), fiche);
    allume.options.planScenes = {};
    await fabriquerCasConcret(allume.options);
    const porteurs = proprietes(allume).filter((p) => p.planScenes).length;
    expect(porteurs).toBeGreaterThan(0);
    expect(allume.ecransSoumis()).toHaveLength(porteurs);
  });
});
