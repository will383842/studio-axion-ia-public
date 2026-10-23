/**
 * GARDE-FOU DES COULEURS (10/10, constat « zoom demandé = image cassée ») : la composition finale face caméra compare
 * l'export à la PRISE ÉTALONNÉE (passe image) ; des couleurs aberrantes arrêtent la version (jamais livrée, la version
 * d'avant reste celle de la vidéo, message clair à Will). Chaîne complète avec les doubles : aucun réseau. La mesure
 * elle-même (FFmpeg réel) est éprouvée par `facecam-couleurs-carte-pleine.test.ts` et le contrôle avant mise en ligne.
 */
import { describe, expect, it } from "vitest";
import { entreesFacecamVides } from "@/domaine/facecam";
import type { CommandeFabrication, MotHorodate } from "@/domaine/types";
import type { DemandeRendu } from "@/fournisseurs/types";
import { creerFacecamSimule } from "@/fournisseurs/facecam";
import { creerServiceRenduSimule } from "@/fournisseurs/simulation/rendu";
import type { OutilsMontage } from "@/briques/composition/montage";
import type { ControleCouleurs } from "@/briques/composition/scene";
import { avancerChaine, etatChaineInitial, type DependancesChaine, type EtatChaine } from "@/moteurs/montage-facecam/chaine";
import { etapesSelonChaine } from "@/moteurs/montage-facecam/etapes-chaine";
import { couleursBloquent, MESSAGE_COULEURS, pairesCouleurs, PAIRES_COULEURS_MAX } from "@/moteurs/montage-facecam/garde-couleurs";
import { RECETTE_COMPOSITION_FACECAM } from "@/moteurs/montage-facecam/habillage";
import { cartesDesPassages } from "@/moteurs/montage-facecam/raccords";
import { appliquerOperations, reglagesMonteurVides, type OperationFacecam, type PassageMonteur } from "@/moteurs/montage-facecam/monteur";
import { verdictCouleurs } from "../studio-rendu/src/composition/couleurs";

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
function outilsRendu(mesuresCompo: Record<string, number>): OutilsMontage & { soumises: DemandeRendu[] } {
  let t = 0;
  const rendu = creerServiceRenduSimule(() => (t += 6_000));
  const soumises: DemandeRendu[] = [];
  return {
    soumises,
    rendu: () => ({
      soumettre: async (d) => (soumises.push(d), rendu.soumettre(d)),
      etat: async (id) => {
        const e = await rendu.etat(id);
        return e.statut === "termine" && id.endsWith("-compo") ? { ...e, mesures: mesuresCompo } : e;
      },
    }),
    recette: RECETTE_COMPOSITION_FACECAM,
    signer: async (lectures, depots) => ({ lectures: Object.fromEntries(Object.entries(lectures).map(([k, c]) => [k, `https://r2.exemple/lire/${c}`])), depots: Object.fromEntries(depots.map((d) => [d.cle, `https://r2.exemple/deposer/${d.cle}`])) }),
    cle: (c, nom) => `facecam/${c.videoId}/${nom}`,
  };
}

async function fabriquer(mesuresCompo: Record<string, number>) {
  const r = appliquer([CARTE, ZOOM]);
  const entrees = { facecam: r.etat.facecam, facecamMonteur: r.etat.reglages };
  const outils = outilsRendu(mesuresCompo);
  const deps: DependancesChaine = { facecam: creerFacecamSimule(), monteur: async () => ({ cartes: cartesDesPassages(r.etat.facecam.passages as PassageMonteur[]), passages: r.etat.facecam.passages, entrees }), habillage: outils };
  let etat: EtatChaine = etatChaineInitial();
  const c = commande();
  for (let i = 0; i < 80 && !etat.fini && !etat.echec; i++) etat = await avancerChaine(etat, c, { travailId: "t-c", versionId: "ver-c" }, deps);
  const compo = outils.soumises.find((d) => (d.parametres as { mode?: string }).mode === "complet");
  return { etat, compo };
}

describe("Garde-fou des couleurs de la composition face caméra (10/10)", () => {
  it("instants comparés : sur les plans filmés, loin des raccords et des cartes, temps et cadre de la prise étalonnée", () => {
    const plans = [
      { debutSec: 0, finSec: 4, priseDebutSec: 1, cadre: { x: 1400, y: 0, largeur: 1216, hauteur: 2160 } },
      { debutSec: 4, finSec: 6, priseDebutSec: 7, cadre: { x: 1540, y: 200, largeur: 934, hauteur: 1662 } },
      { debutSec: 6, finSec: 12, priseDebutSec: 10, cadre: { x: 1400, y: 0, largeur: 1216, hauteur: 2160 } },
    ];
    const couverts = [{ debutSec: 7, finSec: 9 }];
    const paires = pairesCouleurs(plans, 1300, couverts, 12);
    expect(paires.length).toBeGreaterThanOrEqual(4);
    expect(paires.length).toBeLessThanOrEqual(PAIRES_COULEURS_MAX);
    for (const p of paires) {
      expect(p.exportSec > 6.7 && p.exportSec < 9.3).toBe(false);
      const plan = plans.find((x) => p.exportSec >= x.debutSec && p.exportSec < x.finSec)!;
      expect(p.exportSec - plan.debutSec).toBeGreaterThanOrEqual(0.3);
      expect(plan.finSec - p.exportSec).toBeGreaterThan(0.3);
      expect(p.referenceSec).toBeCloseTo(plan.priseDebutSec + p.exportSec - plan.debutSec, 3);
      expect(p.cadre).toEqual({ ...plan.cadre, x: plan.cadre.x - 1300 });
    }
    expect(pairesCouleurs(plans, 0, [{ debutSec: 0, finSec: 12 }], 12)).toEqual([]);
  });

  it("verdict : un écart de chrominance normal passe ; la panne du 10/10 (fond jaune, peau magenta) est aberrante", () => {
    const peau = { y: 171, u: 110, v: 152 };
    expect(verdictCouleurs([{ export: { y: 168, u: 111, v: 151 }, reference: peau }])).toMatchObject({ couleursAberrantes: 0, couleursPaires: 1 });
    // Mesures relevées sur la reproduction (FFmpeg 8.1.1) : mur U 45 / V 164 au lieu de 124 / 130.
    const v = verdictCouleurs([{ export: { y: 162, u: 45, v: 164 }, reference: { y: 172, u: 124, v: 130 } }, { export: { y: 194, u: 149, v: 154 }, reference: peau }]);
    expect(v.couleursAberrantes).toBe(1);
    expect(v.couleursEcartUV).toBeGreaterThan(10);
    expect(couleursBloquent(v)).toBe(true);
    expect(couleursBloquent({ couleursErreur: 1 })).toBe(false);
    expect(couleursBloquent(undefined)).toBe(false);
  });

  it("la composition finale reçoit la prise étalonnée et des instants hors de la carte plein écran ; couleurs justes : livrée", async () => {
    const { etat, compo } = await fabriquer({ couleursPaires: 4, couleursEcartUV: 1.2, couleursAberrantes: 0 });
    expect(etat.fini).toBe(true);
    expect(etat.echec).toBeUndefined();
    const passeCle = (etat.travaux.passe?.resultat as { fichierCle: string }).fichierCle;
    expect(compo!.entrees["reference-couleurs"]).toBe(`https://r2.exemple/lire/${passeCle}`);
    const controle = (compo!.parametres as { controleCouleurs?: ControleCouleurs }).controleCouleurs!;
    expect(controle.entree).toBe("reference-couleurs");
    expect(controle.paires.length).toBeGreaterThan(0);
    const cartes = etat.habillage!.base.supplements?.cartesPleinEcran ?? [];
    expect(cartes.length).toBe(1);
    for (const p of controle.paires) expect(cartes.some((c) => p.exportSec > c.debutSec - 0.3 && p.exportSec < c.finSec + 0.3)).toBe(false);
  });

  it("couleurs aberrantes : la version n'est pas livrée, l'étape « La vidéo finale » échoue avec un message clair", async () => {
    const { etat } = await fabriquer({ couleursPaires: 4, couleursEcartUV: 84.9, couleursAberrantes: 1 });
    expect(etat.fini).toBeFalsy();
    expect(etat.echec).toEqual({ brique: "export", message: MESSAGE_COULEURS, reessayable: false });
    const etapes = etapesSelonChaine([{ cle: "export", nom: "La vidéo finale", statut: "en_attente", progression: 0 } as never], etat);
    expect(etapes[0]).toMatchObject({ statut: "echec", erreur: { messagePourWill: MESSAGE_COULEURS, reessayable: false } });
    expect(MESSAGE_COULEURS).toMatch(/version précédente reste en ligne/);
  });
});
