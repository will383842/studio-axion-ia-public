/**
 * GV-FIN-01 — de bout en bout : le vrai service `memoireCartesFacecam` branché sur la chaîne.
 * Lecture en panne : rien n'est figé. Lecture réussie mais sans aucune vidéo : la mémoire vide est figée.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
let lectureEnPanne = false;
vi.mock("@/services/_commun", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  depots: () => ({
    versions: {
      lister: async () => {
        if (lectureEnPanne) throw new Error("base illisible");
        return [];
      },
    },
  }),
}));

import type { CommandeFabrication } from "@/domaine/types";
import { creerFacecamSimule } from "@/fournisseurs/facecam";
import { creerServiceRenduSimule } from "@/fournisseurs/simulation/rendu";
import type { OutilsMontage } from "@/briques/composition/montage";
import { avancerChaine, etatChaineInitial, livraisonChaine, type EtatChaine } from "@/moteurs/montage-facecam/chaine";
import { RECETTE_COMPOSITION_FACECAM } from "@/moteurs/montage-facecam/habillage";
import { memoireCartesFacecam } from "@/services/facecam-branchements";

const TEXTE = "Bonjour, je suis Will. Aujourd'hui je vous parle de la formation. C'est faux. Avec un financement OPCO, la formation peut être prise en charge.";

function outilsRendu(): OutilsMontage {
  let t = 0;
  const rendu = creerServiceRenduSimule(() => (t += 6_000));
  return {
    rendu: () => ({ soumettre: async (d) => rendu.soumettre(d), etat: (id) => rendu.etat(id) }),
    recette: RECETTE_COMPOSITION_FACECAM,
    signer: async (lectures, depots) => ({ lectures: Object.fromEntries(Object.entries(lectures).map(([k, c]) => [k, `https://r2.exemple/lire/${c}`])), depots: Object.fromEntries(depots.map((d) => [d.cle, `https://r2.exemple/deposer/${d.cle}`])) }),
    cle: (c, nom) => `facecam/${c.videoId}/${nom}`,
  };
}

const commande = {
  videoId: "v-fc", formatId: "facecam", moteurId: "montage-facecam", ratios: ["9:16"], dureeCibleSec: 60,
  script: { blocs: [], texteComplet: TEXTE },
  distribution: [{ role: "Face caméra", source: "rush" }],
  prises: [{ id: "p1", partie: "version", cle: "studio/prod/rush/v-fc/prise-1.mov", mime: "video/quicktime", dureeSec: 60, segmentIds: [] }],
  briques: { etalonnage: true, "sous-titres": true, "mention-ia": false },
  styles: { lut: null }, entrees: {}, reglages: {}, plans: [], prononciations: [],
} as unknown as CommandeFabrication;

async function jusquAuBout(): Promise<EtatChaine> {
  const deps = { facecam: creerFacecamSimule(), habillage: outilsRendu(), memoireCartes: () => memoireCartesFacecam(commande.videoId) };
  let etat = etatChaineInitial();
  for (let i = 0; i < 80 && !etat.fini && !etat.echec; i++) etat = await avancerChaine(etat, commande, { travailId: "t-m", versionId: "ver-m" }, deps);
  return etat;
}

describe("GV-FIN-01 : mémoire des animations et lecture en panne", () => {
  beforeEach(() => { lectureEnPanne = false; vi.spyOn(console, "warn").mockImplementation(() => {}); });
  it("lecture en panne : rien n'est figé", async () => {
    lectureEnPanne = true;
    const etat = await jusquAuBout();
    expect(etat.fini).toBe(true);
    expect(etat.memoireCartes).toBeUndefined();
    expect("memoireCartes" in livraisonChaine(etat).facecam).toBe(false);
  });
  it("lecture réussie et vide : la mémoire vide est figée", async () => {
    const etat = await jusquAuBout();
    expect(etat.fini).toBe(true);
    expect(etat.memoireCartes).toEqual({ dejaServis: [] });
    expect(livraisonChaine(etat).facecam.memoireCartes).toEqual({ dejaServis: [] });
  });
});
