/**
 * MOTEUR « VIDÉO LONGUE » (fiche VL-04) — moteur MINCE copié de `src/moteurs/gabarit/`, générateur DÉDIÉ, ÉTEINT (décision du 18/11).
 * Estimation à 0 € ; tant que rien n'est relié (`dependances` rend `null`), la fabrication reste en PAUSE claire : en file,
 * sans échec, sans dépense, jamais une vidéo d'essai. Aucun appel à Claude, aucun fournisseur payant, aucun import de `studio-rendu`.
 * Le script validé est lu tel quel (`entrees.ts`). Plan 16:9 et rendu par plage : VL-05. Branchements réels : VL-07
 * (montage réel relié pour le mode SANS voix seulement, derrière le réglage éteint). L'étape « montage » avance PAS À PAS
 * (FIN-8) : chaque `avancer` soumet une plage ou relit un état, puis revient ; l'étape n'est faite qu'une fois le collage fini.
 * QUALITÉ (QUALL-5) : la Qualité affichée sur une vidéo ratée venait d'un 80 en dur qui ne regardait ni le plan ni l'image.
 * Elle est désormais recalculée, purement, depuis l'état : story-board reconstruit puis `controlerStoryboard` (note et alertes).
 */
import type { CommandeFabrication } from "@/domaine/types";
import { ZERO } from "@/lib/montants";
import type { SortieProduite } from "../types";
import { creerMoteurGabarit, type DefinitionGabarit } from "../gabarit";
import { lireEntreesVideoLongue, type EntreesVideoLongue } from "./entrees";
import { controlerStoryboard } from "./controle";
import { alertesQualiteDepuisControle } from "./controle-alertes";
import { minuterSansVoix } from "./minutage";
import { poserScene, poserSousTitreDe } from "./mise-en-page";
import { storyboardVideoLongue } from "./storyboard";
import { cibleSon, rapportSon } from "../montage-tutoriel-outil/finitions";
import type { AlerteQualite } from "@/domaine/types";
import { avancerVideoLongue, estimerMotsSansVoix, ETAPES_FABRICATION, ETAPES_RETOUCHE, type DependancesVideoLongue, type EtatVideoLongue, type RepriseVideoLongue } from "./chaine";

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
      // Qualité : recalculée depuis le minutage du script, SANS voix seulement (cartons et plan existent). Avec voix : 80 et aucune alerte du contrôle.
      const question = lireEntreesVideoLongue(commande).question ?? null;
      const minutage = sansVoix ? minuterSansVoix(lireEntreesVideoLongue(commande)) : undefined;
      const storyboard = minutage?.chapitres.length ? storyboardVideoLongue({ question }, { mots: minutage.mots, chapitres: minutage.chapitres, dureeSec: minutage.dureeSec }) : undefined;
      const controle = storyboard ? controlerStoryboard(storyboard, { scene: poserScene, sousTitre: poserSousTitreDe(storyboard) }) : undefined;
      const note = controle?.note ?? 80;
      const alertesControle = controle ? alertesQualiteDepuisControle(controle) : [];
      // Aucune mesure de son n'est transportée jusqu'ici : avec voix, le niveau reste « non mesuré » (la cible n'est pas une mesure).
      const son = rapportSon(null, cibleSon(commande), !sansVoix);
      const messageSon = sansVoix ? "Son : vidéo sans voix, aucun niveau mesuré" : son.alerte;
      const alerteSon: AlerteQualite[] = messageSon ? [{ code: "niveau-sonore", gravite: "info", message: messageSon }] : [];
      const sorties: SortieProduite[] = commande.ratios
        .filter((r) => etat.sorties[r])
        .map((ratio) => ({
          ratio,
          fichierCle: etat.sorties[ratio]!,
          vignetteCle: "",
          resolution: "1920x1080",
          dureeSec: duree,
          // Mesure réelle du collage (studio-rendu) quand elle a été renvoyée ; 0 = inconnue, jamais une taille inventée.
          taille: etat.tailles?.[ratio] ?? 0,
          // `niveauSonoreLufs` est obligatoire (type du domaine) : -70 sans voix, la cible avec voix ; `son` n'est vrai que si mesuré.
          rapportQualite: { note, verifie: { image: true, son: son.sonVerifie, sousTitres: sansVoix, mentionIA: false, droits: false }, alertes: [...alerteSon, ...alertesControle], niveauSonoreLufs: sansVoix ? -70 : son.niveauSonoreLufs },
        }));
      const alertes = [...alerteSon, ...etat.remarques.map((r) => ({ code: "export" as const, gravite: "info" as const, message: r.message })), ...alertesControle];
      const reprise: RepriseVideoLongue | undefined = etat.voix && etat.chapitres ? { voix: etat.voix, chapitres: etat.chapitres } : undefined;
      return {
        sorties,
        noteQualite: { globale: note, alertes },
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
      // Sans voix, « voix » et « chapitres » ne sont que des estimations de l'ancien texte : on les recalcule (coût 0).
      etatPourRetouche: (reprise, commande) => {
        const entrees = lireEntreesVideoLongue(commande);
        if (entrees.sansVoix) {
          const lue = estimerMotsSansVoix(entrees);
          return { faites: [], voix: { mots: lue.mots, dureeSec: lue.dureeSec, morceaux: 0 }, remarques: [], sorties: {} };
        }
        return { faites: [], voix: reprise.voix, chapitres: reprise.chapitres, remarques: [], sorties: {} };
      },
    },
    proprietesRendu: () => ({}),
  };
}

export const creerMoteurVideoLongue = (dependances: (commande: CommandeFabrication, travailId?: string) => DependancesVideoLongue | null) => creerMoteurGabarit(definitionVideoLongue(dependances));

/** Moteur inscrit : AUCUNE dépendance reliée tant que le réglage n'est pas vu allumé (VL-07, éteint par défaut) = pause sans dépense. */
export const moteurMontageVideoLongue = creerMoteurVideoLongue(() => null);
