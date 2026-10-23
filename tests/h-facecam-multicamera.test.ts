/**
 * Mission H — la multicaméra commune sur le face caméra : même brique que l'avocat, face = la piste montée de Will,
 * angles 2 et 3 fabriqués sur le même son ; absente ou coupée : composition inchangée. Double du studio-aligneur et
 * rendu simulés, aucun réseau, aucune dépense.
 */
import { describe, expect, it } from "vitest";
import type { CommandeFabrication } from "@/domaine/types";
import type { DemandeRendu } from "@/fournisseurs/types";
import { creerFacecamSimule } from "@/fournisseurs/facecam";
import { creerServiceRenduSimule } from "@/fournisseurs/simulation/rendu";
import type { OutilsMontage } from "@/briques/composition/montage";
import type { ParametresDemandeComposition } from "@/briques/composition/scene";
import { pisteMulticameraFacecam } from "@/briques/multicamera";
import { avancerChaine, etatChaineInitial, type DependancesChaine, type EtatChaine } from "@/moteurs/montage-facecam/chaine";
import { RECETTE_COMPOSITION_FACECAM } from "@/moteurs/montage-facecam/habillage";

const TEXTE = "Bonjour, je suis Will. Aujourd'hui je vous parle de la formation. Beaucoup de dirigeants pensent que l'intelligence artificielle est réservée aux grands groupes. C'est faux. Avec un financement OPCO, la formation peut être prise en charge.";

function commande(): CommandeFabrication {
  return {
    videoId: "v-fc",
    formatId: "facecam",
    moteurId: "montage-facecam",
    ratios: ["9:16"],
    dureeCibleSec: 60,
    script: { blocs: [], texteComplet: TEXTE },
    distribution: [{ role: "Face caméra", source: "rush" }],
    prises: [{ id: "p1", partie: "version", cle: "studio/prod/rush/v-fc/prise-1.mov", mime: "video/quicktime", dureeSec: 60, segmentIds: [] }],
    briques: { etalonnage: true, "sous-titres": true, "mention-ia": false },
    styles: { lut: null },
    entrees: {},
    reglages: {},
    plans: [],
    prononciations: [],
    sousTitres: { base: "simple", intensite: "equilibre" },
  } as unknown as CommandeFabrication;
}

function outilsRendu(): OutilsMontage & { soumises: DemandeRendu[] } {
  let t = 0;
  const rendu = creerServiceRenduSimule(() => (t += 6_000));
  const soumises: DemandeRendu[] = [];
  return {
    soumises,
    rendu: () => ({ soumettre: async (d) => (soumises.push(d), rendu.soumettre(d)), etat: (id) => rendu.etat(id) }),
    recette: RECETTE_COMPOSITION_FACECAM,
    signer: async (lectures, depots) => ({ lectures: Object.fromEntries(Object.entries(lectures).map(([n, c]) => [n, `https://r2.exemple/lire/${c}`])), depots: Object.fromEntries(depots.map((d) => [d.cle, `https://r2.exemple/deposer/${d.cle}`])) }),
    cle: (c, nom) => `facecam/${c.videoId}/${nom}`,
  };
}

async function jusquAuBout(deps: DependancesChaine): Promise<EtatChaine> {
  let etat = etatChaineInitial();
  for (let i = 0; i < 60 && !etat.fini && !etat.echec; i++) etat = await avancerChaine(etat, commande(), { travailId: "t-1", versionId: "ver-1" }, deps);
  return etat;
}

const compositionFinale = (s: DemandeRendu[]) => s.find((d) => (d.parametres as { mode?: string }).mode === "complet")!;

describe("Mission H · multicaméra du face caméra", () => {
  it("sans la passe (option coupée) : composition sans caméra, comme avant", async () => {
    const outils = outilsRendu();
    const etat = await jusquAuBout({ facecam: creerFacecamSimule(), habillage: outils });
    expect(etat.fini).toBe(true);
    expect(etat.multicamera).toBeUndefined();
    const p = compositionFinale(outils.soumises).parametres as unknown as ParametresDemandeComposition & { mode: "complet" };
    expect(p.image.cameras).toBeUndefined();
  });

  it("passe allumée : face = la piste montée de Will, l'angle de côté lu par la composition sur les mêmes mots", async () => {
    const outils = outilsRendu();
    const appels: { pisteCle: string; mots: number; consignes: string[] }[] = [];
    const etat = await jusquAuBout({
      facecam: creerFacecamSimule(),
      habillage: outils,
      multicamera: async ({ pisteCle, dureeSec, mots, consignes }) => {
        appels.push({ pisteCle, mots: mots.length, consignes });
        return pisteMulticameraFacecam({ actif: true, mots, sources: { face: pisteCle, cote: "angles/cote.mp4", "contre-plongee": "angles/bas.mp4" }, dureeSec });
      },
    });
    expect(etat.fini).toBe(true);
    expect(appels).toHaveLength(1);
    expect(appels[0].pisteCle).toMatch(/cadrage|montage/);
    expect(etat.multicamera?.piste?.sources.face).toBe(appels[0].pisteCle);
    const compo = compositionFinale(outils.soumises);
    const p = compo.parametres as unknown as ParametresDemandeComposition & { mode: "complet" };
    expect(Object.values(compo.entrees)).toContain("https://r2.exemple/lire/angles/cote.mp4");
    expect(p.image.cameras?.cote).toMatchObject({ type: "video" });
    expect(p.image.plans.some((x) => x.camera === "cote" || x.camera === "contre-plongee")).toBe(true);
    // La première image reste de face (accroche sur la vraie vidéo de Will).
    expect(p.image.plans[0].camera).toBeUndefined();
  });

  it("passe en panne : une seule caméra, la vidéo sort", async () => {
    const outils = outilsRendu();
    const etat = await jusquAuBout({ facecam: creerFacecamSimule(), habillage: outils, multicamera: async () => Promise.reject(new Error("panne")) });
    expect(etat.fini).toBe(true);
    expect(etat.multicamera).toEqual({ statut: "fait" });
  });
});
