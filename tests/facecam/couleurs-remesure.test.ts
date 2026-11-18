/**
 * S-04c : des couleurs « anormales » sont remesurées (habillage refait, rendu local, 0 €) UNE fois avant le refus
 * définitif. Chemin réel : `avancerChaine` du Studio avec les doubles (studio-rendu simulé dont la mesure des
 * couleurs de la composition finale est choisie rendu par rendu) ; aucun réseau, aucun fournisseur payant.
 */
import { describe, expect, it } from "vitest";
import { entreesFacecamVides } from "@/domaine/facecam";
import type { CommandeFabrication, MotHorodate } from "@/domaine/types";
import type { DemandeRendu } from "@/fournisseurs/types";
import { creerFacecamSimule } from "@/fournisseurs/facecam";
import { creerServiceRenduSimule } from "@/fournisseurs/simulation/rendu";
import type { OutilsMontage } from "@/briques/composition/montage";
import { avancerChaine, etatChaineInitial, type DependancesChaine, type EtatChaine } from "@/moteurs/montage-facecam/chaine";
import { MESSAGE_COULEURS } from "@/moteurs/montage-facecam/garde-couleurs";
import { RECETTE_COMPOSITION_FACECAM } from "@/moteurs/montage-facecam/habillage";
import { cartesDesPassages } from "@/moteurs/montage-facecam/raccords";
import { appliquerOperations, reglagesMonteurVides, type OperationFacecam, type PassageMonteur } from "@/moteurs/montage-facecam/monteur";

const TEXTE = "Bonjour, je suis Will. Aujourd'hui je vous parle de la formation. Beaucoup de dirigeants pensent que l'intelligence artificielle est réservée aux grands groupes. C'est faux.";
const MOTS: MotHorodate[] = Array.from({ length: 100 }, (_, i) => ({ mot: `mot${i}`, debutSec: 1 + i * 0.5, finSec: 1.4 + i * 0.5 }));
let n = 0;

function appliquer(ops: OperationFacecam[]) {
  return appliquerOperations({ facecam: entreesFacecamVides(), reglages: reglagesMonteurVides() }, ops, { mots: MOTS.map((m, i) => ({ index: i, mot: m.mot, debutPriseSec: m.debutSec, finPriseSec: m.finSec, monteeSec: m.debutSec, retire: false })), dureePriseSec: 60, origine: "demande", consigneId: "k1", nouvelId: (p) => `${p}-${++n}` });
}

const CARTE: OperationFacecam = { type: "ajouterCarte", debutMot: 2, finMot: 10, modele: "liste", textes: ["Trois raisons", "Gagner du temps", "Former l'équipe", "Financement OPCO"], html: null, disposition: "plein-ecran", description: "Les trois raisons", animationGardeeId: null };
const ZOOM: OperationFacecam = { type: "zoom", debutMot: 14, finMot: 16, style: "punch-in", cible: "visage" };

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

/** Studio-rendu simulé ; `mesuresCompo` : mesures rendues par la composition finale (comme le vrai studio-rendu). */
function outilsRendu(mesuresParRendu: (Record<string, number> | undefined)[]): OutilsMontage & { soumises: DemandeRendu[] } {
  let t = 0;
  const rendu = creerServiceRenduSimule(() => (t += 6_000));
  const soumises: DemandeRendu[] = [];
  const idsCompo: string[] = [];
  return {
    soumises,
    rendu: () => ({
      soumettre: async (d) => (soumises.push(d), rendu.soumettre(d)),
      etat: async (id) => {
        const e = await rendu.etat(id);
        if (!(e.statut === "termine" && id.endsWith("-compo"))) return e;
        if (!idsCompo.includes(id)) idsCompo.push(id);
        const m = mesuresParRendu[Math.min(idsCompo.indexOf(id), mesuresParRendu.length - 1)];
        return m ? { ...e, mesures: m } : e;
      },
    }),
    recette: RECETTE_COMPOSITION_FACECAM,
    signer: async (lectures, depots) => ({ lectures: Object.fromEntries(Object.entries(lectures).map(([k, c]) => [k, `https://r2.exemple/lire/${c}`])), depots: Object.fromEntries(depots.map((d) => [d.cle, `https://r2.exemple/deposer/${d.cle}`])) }),
    cle: (c, nom) => `facecam/${c.videoId}/${nom}`,
  };
}

async function fabriquer(mesuresParRendu: (Record<string, number> | undefined)[]) {
  const r = appliquer([CARTE, ZOOM]);
  const entrees = { facecam: r.etat.facecam, facecamMonteur: r.etat.reglages };
  const outils = outilsRendu(mesuresParRendu);
  const deps: DependancesChaine = { facecam: creerFacecamSimule(), monteur: async () => ({ cartes: cartesDesPassages(r.etat.facecam.passages as PassageMonteur[]), passages: r.etat.facecam.passages, entrees }), habillage: outils };
  let etat: EtatChaine = etatChaineInitial();
  const c = commande();
  for (let i = 0; i < 80 && !etat.fini && !etat.echec; i++) etat = await avancerChaine(etat, c, { travailId: "t-c", versionId: "ver-c" }, deps);
  const compos = outils.soumises.filter((d) => (d.parametres as { mode?: string }).mode === "complet");
  return { etat, compos, autres: outils.soumises.length - compos.length };
}


const BONNE = { couleursPaires: 4, couleursEcartUV: 1.2, couleursAberrantes: 0 };
const ANORMALE = { couleursPaires: 4, couleursEcartUV: 84.9, couleursAberrantes: 1 };

describe("S-04c : couleurs anormales remesurées une fois", () => {
  it("a) 1re mesure anormale puis bonne : habillage refait UNE fois, vidéo finie, aucune prise ni son refaits", async () => {
    const base = await fabriquer([BONNE]);
    const { etat, compos, autres } = await fabriquer([ANORMALE, BONNE]);
    expect(etat.echec).toBeUndefined();
    expect(etat.fini).toBe(true);
    expect(compos).toHaveLength(2);
    expect(new Set(compos.map((d) => d.idRendu)).size).toBe(2);
    expect(etat.habillage?.remesureCouleurs).toBe(true);
    expect(etat.habillage?.sortie?.mesures).toEqual(BONNE);
    // Aucune prise ni son refaits : mêmes travaux (passe, son, …) que la version sans anomalie ; mêmes rendus de cartes.
    expect(etat.travaux).toEqual(base.etat.travaux);
    expect(autres).toBe(base.autres);
    expect(base.compos).toHaveLength(1);
  });

  it("b) 1re puis 2e mesure anormales : refus au 2e constat, message mot pour mot, jamais un 3e rendu", async () => {
    const { etat, compos } = await fabriquer([ANORMALE, ANORMALE]);
    expect(etat.fini).toBeFalsy();
    expect(etat.echec).toEqual({ brique: "export", message: MESSAGE_COULEURS, reessayable: false });
    expect(compos).toHaveLength(2);
  });

  it("c) mesure absente : comportement d'avant (livrée, un seul rendu, aucun champ neuf)", async () => {
    const { etat, compos } = await fabriquer([undefined]);
    expect(etat.fini).toBe(true);
    expect(etat.echec).toBeUndefined();
    expect(compos).toHaveLength(1);
    expect(etat.habillage).not.toHaveProperty("remesureCouleurs");
  });

  it("d) mesure bonne du premier coup : un seul rendu, aucun champ remesureCouleurs", async () => {
    const { etat, compos } = await fabriquer([BONNE]);
    expect(etat.fini).toBe(true);
    expect(compos).toHaveLength(1);
    expect(etat.habillage).not.toHaveProperty("remesureCouleurs");
    expect(etat.habillage?.sortie?.mesures).toEqual(BONNE);
  });
});
