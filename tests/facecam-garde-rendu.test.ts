/**
 * GV2-23 : le rendu final et les cartes de la face caméra ont un délai de garde (`fournisseurs/rendu/garde.ts`).
 * Carte figée → une nouvelle demande sous un autre identifiant, puis carte retirée ; composition figée → relance,
 * puis vidéo livrée sans habillage avec la mention existante. Horloge simulée.
 */
import { describe, expect, it } from "vitest";
import type { CommandeFabrication } from "@/domaine/types";
import { creerFacecamSimule } from "@/fournisseurs/facecam";
import { creerServiceRenduSimule } from "@/fournisseurs/simulation/rendu";
import type { DemandeRendu, EtatRendu, ServiceRendu } from "@/fournisseurs/types";
import type { OutilsMontage } from "@/briques/composition/montage";
import { avancerChaine, etatChaineInitial, type DependancesChaine, type EtatChaine } from "@/moteurs/montage-facecam/chaine";
import { outilsHabillage } from "@/moteurs/montage-facecam/dependances";
import { RECETTE_COMPOSITION_FACECAM } from "@/moteurs/montage-facecam/habillage";
import type { CarteMonteur } from "@/moteurs/montage-facecam/raccords";

const MIN = 60_000;
const commande = {
  videoId: "v-fc",
  formatId: "facecam",
  moteurId: "montage-facecam",
  ratios: ["9:16"],
  dureeCibleSec: 60,
  script: { blocs: [], texteComplet: "Bonjour, je suis le présentateur. Aujourd'hui je vous parle de la formation. C'est faux. Avec un financement OPCO, la formation peut être prise en charge." },
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
const CARTE: CarteMonteur = { id: "pas-1", debutSec: 4, finSec: 9, disposition: "moitie-haute", modele: "liste", textes: ["Trois raisons", "Gagner du temps", "Former l'équipe", "Financement OPCO"], description: "Les trois raisons" };

/** Rendu dont les identifiants choisis restent « en cours » à 40 % pour toujours ; les autres vont au bout (simulation). */
function monter(figes: (id: string) => boolean) {
  let horloge = 0;
  const simule = creerServiceRenduSimule(() => horloge);
  const soumises: DemandeRendu[] = [];
  const service: ServiceRendu = {
    soumettre: async (d) => (soumises.push(d), simule.soumettre(d)),
    etat: async (id): Promise<EtatRendu> => (figes(id) ? { statut: "en_cours", progression: 40 } : simule.etat(id)),
  };
  const outils: OutilsMontage = {
    rendu: () => service,
    recette: RECETTE_COMPOSITION_FACECAM,
    signer: async (lectures, depots) => ({ lectures: Object.fromEntries(Object.entries(lectures).map(([n, c]) => [n, `https://r2.exemple/lire/${c}`])), depots: Object.fromEntries(depots.map((d) => [d.cle, `https://r2.exemple/deposer/${d.cle}`])) }),
    cle: (c, nom) => `facecam/${c.videoId}/${nom}`,
    garde: { delaiMs: 20 * MIN, maintenant: () => horloge },
  };
  const deps: DependancesChaine = { facecam: creerFacecamSimule(), monteur: async () => ({ cartes: [CARTE] }), habillage: outils, maintenant: () => horloge };
  const jusquAuBout = async (tours = 80): Promise<EtatChaine> => {
    let etat = etatChaineInitial();
    for (let i = 0; i < tours && !etat.fini && !etat.echec; i++) {
      etat = await avancerChaine(etat, commande, { travailId: "t-1", versionId: "ver-1" }, deps);
      horloge += 5 * MIN;
    }
    return etat;
  };
  return { jusquAuBout, soumises };
}

describe("GV2-23 · outilsHabillage porte le délai de garde", () => {
  it("garde.delaiMs : 15 min par défaut, réglable par STUDIO_RENDU_SANS_NOUVELLE_MIN", () => {
    const env = { STUDIO_RENDU_URL: "http://studio-rendu.invalid", STUDIO_RENDU_CLE: "cle-de-test" };
    expect(outilsHabillage(env)?.garde).toEqual({ delaiMs: 15 * MIN });
    expect(outilsHabillage({ ...env, STUDIO_RENDU_SANS_NOUVELLE_MIN: "30" })?.garde).toEqual({ delaiMs: 30 * MIN });
  });
});

describe("GV2-23 · cartes figées", () => {
  it("carte figée 20 min : nouvelle demande sous un autre identifiant ; figée encore : carte retirée, vidéo livrée", async () => {
    const { jusquAuBout, soumises } = monter((id) => id.includes("/cartes/") || id.includes("cartes"));
    const etat = await jusquAuBout();
    const cartes = soumises.filter((d) => d.operation === "composition" && !(d.parametres as { mode?: string }).mode);
    expect(cartes.length).toBe(2);
    expect(cartes[1].idRendu).not.toBe(cartes[0].idRendu);
    expect(etat.habillage!.cartes[0].statut).toBe("echec");
    expect(etat.habillage!.base.supplements?.ecransPartages ?? []).toEqual([]);
    expect(etat.sauts.map((s) => s.brique)).toContain("Une carte");
    expect(etat.fini).toBe(true);
    expect(etat.habillage!.sortie?.fichierCle).toBeTruthy();
  });

  it("carte qui avance (autre progression à chaque tour) : une seule demande, carte faite", async () => {
    const { jusquAuBout, soumises } = monter(() => false);
    const etat = await jusquAuBout();
    expect(soumises.filter((d) => !(d.parametres as { mode?: string }).mode)).toHaveLength(1);
    expect(etat.habillage!.cartes[0].statut).toBe("faite");
  });
});

describe("GV2-23 · composition figée", () => {
  it("composition figée : relancée une fois, puis la vidéo est livrée sans habillage avec la mention existante", async () => {
    const { jusquAuBout, soumises } = monter((id) => !id.includes("cartes"));
    const etat = await jusquAuBout();
    const compos = soumises.filter((d) => (d.parametres as { mode?: string }).mode === "complet");
    expect(compos.length).toBeGreaterThanOrEqual(2);
    expect(new Set(compos.map((d) => d.idRendu)).size).toBe(compos.length);
    expect(etat.habillage?.abandonne ?? etat.habillage?.composition?.["9:16"]?.phase).toBeTruthy();
    expect(etat.sauts.map((s) => s.message).join(" ")).toMatch(/livrée sans sous-titres ni cartes|sans/);
    expect(etat.fini).toBe(true);
  });
});
