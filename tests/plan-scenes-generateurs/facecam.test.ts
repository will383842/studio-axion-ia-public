/**
 * Lot R2 — Facecam : plan de scènes de bout en bout (chaîne vidéo simulée, rendu simulé, LLM simulé ; aucun appel réel).
 * Éteint par défaut : la demande de composition est celle d'avant.
 */
import { describe, expect, it } from "vitest";
import type { CommandeFabrication } from "@/domaine/types";
import type { DemandeRendu, ServiceRendu } from "@/fournisseurs/types";
import { creerFacecamSimule } from "@/fournisseurs/facecam";
import { creerServiceRenduSimule } from "@/fournisseurs/simulation/rendu";
import type { OutilsMontage } from "@/briques/composition/montage";
import type { ParametresDemandeComposition } from "@/briques/composition/scene";
import { schemaPlanStrict } from "@/briques/plan-scenes/schema";
import type { RequeteClaude, ReponseClaude } from "@/fournisseurs/claude/client";
import { avancerChaine, etatChaineInitial, type DependancesChaine, type EtatChaine } from "@/moteurs/montage-facecam/chaine";
import { RECETTE_COMPOSITION_FACECAM } from "@/moteurs/montage-facecam/habillage";

const TEXTE = "Bonjour, je suis Will. Aujourd'hui je vous parle de la formation. Beaucoup de dirigeants pensent que l'intelligence artificielle est réservée aux grands groupes. C'est faux. Avec un financement OPCO, la formation peut être prise en charge.";

/** GV2-43 : le plan du stock ne pose une scène que sur un fait du script ; ce texte en porte deux (« 5 heures », « 30 % »). */
const TEXTE_AVEC_FAITS = `${TEXTE} En moyenne, une PME gagne 5 heures par semaine. Et elle réduit ses relances de 30 %.`;

function commande(entrees: Record<string, unknown> = {}, texte = TEXTE): CommandeFabrication {
  return {
    videoId: "v-fc",
    formatId: "facecam",
    moteurId: "montage-facecam",
    ratios: ["9:16"],
    dureeCibleSec: 60,
    script: { blocs: [], texteComplet: texte },
    distribution: [{ role: "Face caméra", source: "rush" }],
    prises: [{ id: "p1", partie: "version", cle: "studio/prod/rush/v-fc/prise-1.mov", mime: "video/quicktime", dureeSec: 60, segmentIds: [] }],
    briques: { etalonnage: true, "sous-titres": true, "mention-ia": false },
    styles: { lut: null },
    entrees,
    reglages: {},
    plans: [],
    prononciations: [],
    sousTitres: { base: "simple", intensite: "equilibre" },
  } as unknown as CommandeFabrication;
}

/** Outils de studio-rendu simulés : horloge qui avance de 6 s à chaque lecture d'état (un rendu long dure 10 s). */
function outilsRendu(service?: ServiceRendu): OutilsMontage & { soumises: DemandeRendu[] } {
  let t = 0;
  const simule = creerServiceRenduSimule(() => (t += 6_000));
  const rendu = service ?? simule;
  const soumises: DemandeRendu[] = [];
  return {
    soumises,
    rendu: () => ({ soumettre: async (d) => (soumises.push(d), rendu.soumettre(d)), etat: (id) => rendu.etat(id) }),
    recette: RECETTE_COMPOSITION_FACECAM,
    signer: async (lectures, depots) => ({ lectures: Object.fromEntries(Object.entries(lectures).map(([n, c]) => [n, `https://r2.exemple/lire/${c}`])), depots: Object.fromEntries(depots.map((d) => [d.cle, `https://r2.exemple/deposer/${d.cle}`])) }),
    cle: (c, nom) => `facecam/${c.videoId}/${nom}`,
  };
}

async function jusquAuBout(deps: DependancesChaine, c = commande()): Promise<EtatChaine> {
  let etat = etatChaineInitial();
  for (let i = 0; i < 60 && !etat.fini && !etat.echec; i++) etat = await avancerChaine(etat, c, { travailId: "t-1", versionId: "ver-1" }, deps);
  return etat;
}


const llmSimule = () => {
  const requetes: RequeteClaude[] = [];
  return { requetes, appeler: async (r: RequeteClaude): Promise<ReponseClaude> => (requetes.push(r), { texte: JSON.stringify({ version: "plan-scenes-1", scenes: [] }), stopReason: "end_turn" } as ReponseClaude) };
};
const composition = (o: { soumises: DemandeRendu[] }) => o.soumises.find((d) => (d.parametres as { mode?: string }).mode === "complet")!.parametres as unknown as ParametresDemandeComposition & { image: { planScenes?: unknown } };

describe("Facecam · plan de scènes", () => {
  it("éteint par défaut : la composition ne porte aucun plan, rien n'est gardé", async () => {
    const outils = outilsRendu();
    const etat = await jusquAuBout({ facecam: creerFacecamSimule(), habillage: outils });
    expect(etat.fini).toBe(true);
    expect(composition(outils).image.planScenes).toBeUndefined();
    expect(etat.planScenes).toBeUndefined();
    expect(etat.habillage!.base.supplements?.planScenes).toBeUndefined();
  });

  it("allumé (stock seulement) : plan valide, face caméra (rien devant le visage), posé dans la composition 9:16", async () => {
    const outils = outilsRendu();
    const etat = await jusquAuBout({ facecam: creerFacecamSimule(), habillage: outils, planScenes: async () => ({}) }, commande({}, TEXTE_AVEC_FAITS));
    expect(etat.fini).toBe(true);
    const plan = composition(outils).image.planScenes;
    expect(plan).toBeDefined();
    const lu = schemaPlanStrict.safeParse(plan);
    expect(lu.success).toBe(true);
    if (lu.success) {
      expect(lu.data.facecam).toBe(true);
      expect(lu.data.format).toEqual({ largeur: 1080, hauteur: 1920, fps: 25 });
      expect(lu.data.scenes.length).toBeGreaterThan(0);
      expect(lu.data.scenes.every((s) => ["bas", "haut"].includes(s.position) && s.niveau === 1)).toBe(true);
    }
    expect(etat.planScenes?.plan).toEqual(plan);
  });

  it("allumé (stock seulement), script sans aucun fait : aucun plan posé, la vidéo sort comme avant", async () => {
    const outils = outilsRendu();
    const etat = await jusquAuBout({ facecam: creerFacecamSimule(), habillage: outils, planScenes: async () => ({}) });
    expect(etat.fini).toBe(true);
    expect(composition(outils).image.planScenes).toBeUndefined();
  });

  it("allumé avec le LLM simulé : UN appel, gardé dans l'état", async () => {
    const llm = llmSimule();
    const outils = outilsRendu();
    const etat = await jusquAuBout({ facecam: creerFacecamSimule(), habillage: outils, planScenes: async () => ({ appeler: llm.appeler }) });
    expect(etat.fini).toBe(true);
    expect(llm.requetes).toHaveLength(1);
    expect(llm.requetes[0]!.modele).toBe("claude-opus-5-5");
    expect(etat.planScenes?.entree).toMatch(/^[0-9a-f]{16}$/);
  });

  it("LLM en panne : repli sur le stock, la vidéo sort quand même", async () => {
    const outils = outilsRendu();
    const etat = await jusquAuBout({ facecam: creerFacecamSimule(), habillage: outils, planScenes: async () => ({ appeler: async () => { throw new Error("panne simulée"); } }) });
    expect(etat.fini).toBe(true);
    expect(etat.habillage!.sortie?.fichierCle).toBeTruthy();
    expect(etat.planScenes?.remarques.some((r) => r.code === "LLM_INDISPONIBLE")).toBe(true);
  });
});
