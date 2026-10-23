/**
 * RENDU DES CARTES MOTION — commun à tous les formats (brique `motion`, mission H). Fait avancer, tour après tour de
 * la boucle de fond, le rendu des cartes rendues par `cartesPourFormat` : une demande `composition` SANS mode par carte
 * (opération EXISTANTE de `studio-rendu`, aucun contrat nouveau), suivie, 1 nouvel essai au plus ; une carte ratée est
 * écartée (« 1 élément non fait ») et la vidéo sort sans elle. Jamais bloquant.
 *
 * Le service de rendu et la signature des dépôts sont INJECTÉS (comme `briques/composition/montage.ts`). Ce fichier
 * n'est pas lu par Remotion (il n'est pas exporté par `index.ts`) : il peut utiliser les alias « @/ ».
 */
import { suivreRendu } from "@/fournisseurs/rendu/client";
import { lireRenduGarde, type GardeRendu, type VeilleRendu } from "@/fournisseurs/rendu/garde";
import { cleDeDepot } from "@/fournisseurs/r2/stockage";
import type { DemandeRendu, ServiceRendu } from "@/fournisseurs/types";
import type { CarteFormat } from "./pourFormat";

export interface CarteEnRendu {
  id: string;
  ratio: string;
  debutSec: number;
  finSec: number;
  modele: string;
  /** Clé de stockage du MP4 de la carte. */
  cle: string;
  statut: "a-soumettre" | "soumise" | "faite" | "echec";
  essais: number;
  demande: DemandeRendu;
  /** Empreinte de la scène (option `parEmpreinte`) : la clé est alors `cleSceneParEmpreinte(…)`. */
  empreinte?: string;
  /** Délai de garde (`OutilsRenduCartes.garde`) : dernier état lu et depuis quand. */
  veille?: VeilleRendu;
}

export interface EtatCartesMotion {
  version: 1;
  cartes: CarteEnRendu[];
  /** Option `bloquant` : une carte ratée fait échouer l'ensemble (absente = la carte est écartée). */
  bloquant?: true;
}

export interface OutilsRenduCartes {
  rendu: () => ServiceRendu;
  /** Adresse de dépôt signée d'une clé (MP4). */
  depot: (cle: string) => Promise<string>;
  /** Le fichier existe-t-il déjà sous cette clé ? Lu seulement pour une carte à empreinte (sinon : rendue). */
  existe?: (cle: string) => Promise<boolean>;
  /**
   * Délai de garde à la lecture (incident du 12/10, `fournisseurs/rendu/garde.ts`) : un rendu en cours figé ou inconnu
   * du serveur devient un échec réessayable (nouvel essai sous un autre identifiant, puis échec). Absent : inchangé.
   */
  garde?: GardeRendu;
}

/**
 * Options du rendu scène par scène (tableau animé, ORG-09). Absentes = comportement des cartes d'aujourd'hui, au
 * caractère près.
 */
export interface OptionsRenduCartes {
  /** Une carte (scène) ratée fait échouer l'ensemble avec une erreur qui la nomme, au lieu d'être écartée. */
  bloquant?: boolean;
  /**
   * Clé par empreinte : une carte dont `empreinte(c)` est donnée sort sous `studio/<env>/scenes/<videoId>/<empreinte>.mp4`
   * et n'est pas rendue de nouveau si ce fichier existe déjà (`OutilsRenduCartes.existe`).
   */
  parEmpreinte?: { env: string; videoId: string; empreinte: (c: CarteFormat) => string | undefined };
}

/** Clé d'une scène rendue : convention de `cleDeDepot` (`studio/{env}/{type}/{entiteId}/{fichierId}.{ext}`). */
export function cleSceneParEmpreinte(env: string, videoId: string, empreinte: string): string {
  return cleDeDepot(env, { fichierId: empreinte, nom: "scene.mp4", mime: "video/mp4", typeEntite: "scenes", entiteId: videoId });
}

/** Erreur levée par l'option `bloquant` : nomme la scène ratée. */
export class ErreurSceneRatee extends Error {
  constructor(
    readonly scene: string,
    raison: string,
  ) {
    super(`Rendu de la scène « ${scene} » raté : ${raison}. La vidéo n'est pas fabriquée sans elle.`);
    this.name = "ErreurSceneRatee";
  }
}

/** Demande de rendu d'une carte : opération `composition` EXISTANTE, sans mode, file longue (Remotion). */
export function demandeRenduCarteMotion(cle: string, parametres: CarteFormat["parametres"], urlDepot: string, essai = 0): DemandeRendu {
  return {
    idRendu: `${cle.replace(/[^A-Za-z0-9_-]/g, "-").slice(-120)}${essai ? `-e${essai}` : ""}`,
    operation: "composition",
    file: "longue",
    entrees: {},
    sortie: { urlDepot, cle },
    parametres: parametres as unknown as Record<string, unknown>,
  };
}

/** État de départ : chaque carte à soumettre (clé = `cle(carte)`). */
export function etatInitialCartesMotion(cartes: readonly CarteFormat[], cle: (c: CarteFormat) => string, options?: OptionsRenduCartes): EtatCartesMotion {
  if (options?.bloquant || options?.parEmpreinte) return etatInitialParScenes(cartes, cle, options);
  return {
    version: 1,
    cartes: cartes.map((c) => ({ id: c.id, ratio: c.ratio, debutSec: c.debutSec, finSec: c.finSec, modele: c.modele, cle: cle(c), statut: "a-soumettre" as const, essais: 0, demande: demandeRenduCarteMotion(cle(c), c.parametres, "") })),
  };
}

/** État de départ avec options : clé par empreinte quand elle est donnée, sinon `cle(carte)`. */
function etatInitialParScenes(cartes: readonly CarteFormat[], cle: (c: CarteFormat) => string, options: OptionsRenduCartes): EtatCartesMotion {
  const pe = options.parEmpreinte;
  return {
    version: 1,
    cartes: cartes.map((c) => {
      const empreinte = pe?.empreinte(c);
      const k = pe && empreinte ? cleSceneParEmpreinte(pe.env, pe.videoId, empreinte) : cle(c);
      return { id: c.id, ratio: c.ratio, debutSec: c.debutSec, finSec: c.finSec, modele: c.modele, cle: k, statut: "a-soumettre" as const, essais: 0, demande: demandeRenduCarteMotion(k, c.parametres, ""), ...(empreinte ? { empreinte } : {}) };
    }),
    ...(options.bloquant ? { bloquant: true as const } : {}),
  };
}

/** Un tour : soumet, suit, réessaie une fois, écarte. Ne lève jamais pour une carte (une carte ratée est écartée). */
// Sauf option `bloquant` : la carte ratée lève `ErreurSceneRatee` (qui la nomme).
export async function avancerCartesMotion(etat: EtatCartesMotion, outils: OutilsRenduCartes): Promise<EtatCartesMotion> {
  const cartes: CarteEnRendu[] = [];
  for (const c0 of etat.cartes) {
    const c = { ...c0 };
    let raison = "panne du service de rendu ou du stockage";
    try {
      // Scène inchangée : son fichier existe déjà sous la clé de son empreinte, rien à rendre.
      if (c.statut === "a-soumettre" && c.empreinte && outils.existe && (await outils.existe(c.cle))) c.statut = "faite";
      if (c.statut === "a-soumettre") {
        c.demande = { ...c.demande, sortie: { ...c.demande.sortie, urlDepot: await outils.depot(c.cle) } };
        await outils.rendu().soumettre(c.demande);
        c.statut = "soumise";
      } else if (c.statut === "soumise") {
        let s;
        if (outils.garde) {
          const lu = await lireRenduGarde(outils.rendu(), c.demande, c.veille, outils.garde);
          s = lu.etat;
          if (lu.veille) c.veille = lu.veille;
        } else s = await suivreRendu(outils.rendu(), c.demande);
        if (s.statut === "echec") raison = s.erreur.message;
        if (s.statut === "termine") c.statut = "faite";
        else if (s.statut === "echec") {
          if (s.erreur.reessayable && c.essais < 1) {
            c.essais += 1;
            c.demande = { ...demandeRenduCarteMotion(c.cle, c.demande.parametres as unknown as CarteFormat["parametres"], await outils.depot(c.cle), c.essais) };
            delete c.veille;
            await outils.rendu().soumettre(c.demande);
          } else c.statut = "echec";
        }
      }
    } catch {
      // Panne du service ou du stockage : une nouvelle tentative au tour suivant, puis la carte est écartée.
      if (c.essais >= 1) c.statut = "echec";
      else c.essais += 1;
    }
    if (etat.bloquant && c.statut === "echec") throw new ErreurSceneRatee(c.id, raison);
    cartes.push(c);
  }
  return { ...etat, cartes };
}

/** Toutes les cartes sont faites ou écartées. */
export function cartesMotionFinies(etat: EtatCartesMotion | undefined): boolean {
  return !etat || etat.cartes.every((c) => c.statut === "faite" || c.statut === "echec");
}

/** Cartes plein écran faites pour un ratio, au format de `EntreeComposition.cartesPleinEcran`. */
export function cartesPleinEcranDuRatio(etat: EtatCartesMotion | undefined, ratio: string): { debutSec: number; finSec: number; carteCle: string }[] {
  return (etat?.cartes ?? []).filter((c) => c.ratio === ratio && c.statut === "faite").map((c) => ({ debutSec: c.debutSec, finSec: c.finSec, carteCle: c.cle }));
}

/** Nombre de cartes écartées (« N éléments non faits »). */
export function cartesMotionEcartees(etat: EtatCartesMotion | undefined): number {
  return new Set((etat?.cartes ?? []).filter((c) => c.statut === "echec").map((c) => c.id.replace(/-(9x16|4x5|1x1)-/, "-"))).size;
}
