/**
 * MOTEUR « VIDÉO LONGUE » (fiche VL-04) — moteur MINCE copié de `src/moteurs/gabarit/`, générateur DÉDIÉ, ÉTEINT (décision du 18/11).
 * Estimation à 0 € ; tant que rien n'est relié (`dependances` rend `null`), la fabrication reste en PAUSE claire : en file,
 * sans échec, sans dépense, jamais une vidéo d'essai. Aucun appel à Claude, aucun fournisseur payant, aucun import de `studio-rendu`.
 * Le script validé est lu tel quel (`entrees.ts`). Plan 16:9 et rendu par chapitre : VL-05. Branchements réels : VL-07.
 */
import type { CommandeFabrication } from "@/domaine/types";
import { ZERO } from "@/lib/montants";
import type { SortieProduite } from "../types";
import { creerMoteurGabarit, type DefinitionGabarit } from "../gabarit";
import { lireEntreesVideoLongue, type EntreesVideoLongue } from "./entrees";
import { avancerVideoLongue, ETAPES_FABRICATION, ETAPES_RETOUCHE, type DependancesVideoLongue, type EtatVideoLongue, type RepriseVideoLongue } from "./chaine";

export { COMPOSITION_VIDEO_LONGUE } from "./chaine";
export type { DependancesVideoLongue, EtatVideoLongue } from "./chaine";

export const ID_MOTEUR_VIDEO_LONGUE = "montage-video-longue";
export const PHRASE_PAUSE_VIDEO_LONGUE = "La fabrication de la vidéo longue n'est pas reliée : votre script est gardé, rien n'a échoué et rien n'est payé.";

/** 1920×1080, 20 min au plus (au-delà de 12 min : une remarque, jamais un refus). */
export const DUREE_MAX_SEC = 1200;

export function definitionVideoLongue(dependances: (commande: CommandeFabrication, travailId?: string) => DependancesVideoLongue | null): DefinitionGabarit<EntreesVideoLongue, EtatVideoLongue, DependancesVideoLongue, RepriseVideoLongue> {
  return {
    id: ID_MOTEUR_VIDEO_LONGUE,
    nom: "Montage vidéo longue",
    etapesFabrication: ETAPES_FABRICATION,
    etapesRetouche: ETAPES_RETOUCHE,
    ratios: ["16:9"],
    dureeMaxSec: DUREE_MAX_SEC,
    phrasePause: PHRASE_PAUSE_VIDEO_LONGUE,
    lireEntrees: lireEntreesVideoLongue,
    dependances: (commande, travailId) => dependances(commande, travailId),
    etatInitial: () => ({ faites: [], remarques: [], sorties: {} }),
    avancer: avancerVideoLongue,
    resultat(commande, etat) {
      const duree = etat.voix?.dureeSec ?? 0;
      const sansVoix = lireEntreesVideoLongue(commande).sansVoix;
      const sorties: SortieProduite[] = commande.ratios
        .filter((r) => etat.sorties[r])
        .map((ratio) => ({
          ratio,
          fichierCle: etat.sorties[ratio]!,
          vignetteCle: "",
          resolution: "1920x1080",
          dureeSec: duree,
          taille: 0,
          rapportQualite: { note: 80, verifie: { image: true, son: !sansVoix, sousTitres: sansVoix, mentionIA: false, droits: false }, alertes: [], niveauSonoreLufs: sansVoix ? -70 : -14 },
        }));
      const alertes = etat.remarques.map((r) => ({ code: "export" as const, gravite: "info" as const, message: r.message }));
      const reprise: RepriseVideoLongue | undefined = etat.voix && etat.chapitres ? { voix: etat.voix, chapitres: etat.chapitres } : undefined;
      return {
        sorties,
        noteQualite: { globale: 80, alertes },
        lignesReelles: [{ etape: "Montage vidéo longue", fournisseur: "studio", unite: "forfait", quantite: 1, prixUnitaire: ZERO, total: ZERO, nature: "reel" }],
        projetMontage: { version: "video-longue-1", ...(reprise ? { reprise } : {}) },
      };
    },
    reprise: {
      lire: (projet) => {
        const r = projet?.reprise as Partial<RepriseVideoLongue> | undefined;
        return r?.voix && Array.isArray(r.chapitres) ? { voix: r.voix, chapitres: r.chapitres } : undefined;
      },
      // Retouche : la voix déjà lue est gardée (rien n'est relu ni repayé) ; seul le montage est refait.
      etatPourRetouche: (reprise) => ({ faites: [], voix: reprise.voix, chapitres: reprise.chapitres, remarques: [], sorties: {} }),
    },
    proprietesRendu: () => ({}),
  };
}

export const creerMoteurVideoLongue = (dependances: (commande: CommandeFabrication, travailId?: string) => DependancesVideoLongue | null) => creerMoteurGabarit(definitionVideoLongue(dependances));

/** Moteur inscrit : AUCUNE dépendance reliée (VL-07 les reliera derrière un réglage éteint) = pause sans dépense. */
export const moteurMontageVideoLongue = creerMoteurVideoLongue(() => null);
