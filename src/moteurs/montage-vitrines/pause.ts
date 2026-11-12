/**
 * VITRINES (lot G) : moteurs des générateurs « Tutoriel d'outil » et « Démo facecam », pas encore branchés.
 * `fabriquerPasEncoreBranche` est la fonction « pas encore branchée » : elle met le travail en PAUSE claire (en file, sans
 * erreur, aucune étape en échec, aucun coût), pour qu'un lot suivant branche le vrai rendu à la place. PUR : aucun service.
 */
import type { CommandeFabrication, Ratio, Travail } from "@/domaine/types";
import { ZERO } from "@/lib/montants";
import type { ContexteLancement, DefinitionEtapeMoteur, Estimation, MoteurVideo } from "../types";

export const CODE_PAS_ENCORE_BRANCHE = "PAS_ENCORE_BRANCHE";

export interface DefinitionVitrine {
  id: string;
  nom: string;
  /** Phrase de la pause, vouvoiement, sans jargon. */
  phrasePause: string;
  etapes: DefinitionEtapeMoteur[];
}

export function fabriquerPasEncoreBranche(vitrine: DefinitionVitrine, commande: CommandeFabrication, contexte: ContexteLancement): Travail {
  const iso = new Date(contexte.maintenant ?? Date.now()).toISOString();
  const type = contexte.type ?? "fabrication";
  return {
    id: contexte.travailId,
    type,
    cibleId: commande.videoId,
    versionId: contexte.versionId,
    titre: contexte.titre,
    etapes: vitrine.etapes.map((d) => ({ cle: d.cle, nom: d.nom, icone: d.icone, dependDe: d.dependDe, statut: "en_attente" as const, progression: 0, sortieFichierIds: [] })),
    statut: "en_file",
    progression: 0,
    tentatives: 1,
    cleIdempotence: `${commande.videoId}:${contexte.versionId}:${type}`,
    fournisseurUtilise: vitrine.id,
    creeLe: iso,
    modifieLe: iso,
    parametres: { pause: { code: CODE_PAS_ENCORE_BRANCHE, message: vitrine.phrasePause } },
  };
}

const RATIOS: Ratio[] = ["9:16"];

export function creerMoteurVitrine(vitrine: DefinitionVitrine): MoteurVideo {
  const estimation = (): Estimation => ({ dureeFabricationSec: 1, lignes: [{ etape: vitrine.nom, fournisseur: "studio", unite: "forfait", quantite: 1, prixUnitaire: ZERO, total: ZERO, nature: "estime" }], total: ZERO });
  const enPause = (commande: CommandeFabrication, contexte: ContexteLancement) => Promise.resolve(fabriquerPasEncoreBranche(vitrine, commande, contexte));
  return {
    id: vitrine.id,
    nom: vitrine.nom,
    capacites: { dureeMaxSec: 120, ratios: RATIOS, langues: ["fr"], retoucheParPlan: false, asynchrone: true, accordExige: false, maquette: false },
    estimer: async () => estimation(),
    estimerRetouche: async () => estimation(),
    estimerReexport: async () => estimation(),
    etapes: () => vitrine.etapes,
    lancer: enPause,
    // Rien n'est refusé : la demande est reçue puis mise en pause (jamais un échec).
    refusAuLancement: () => null,
    avancer: async (travail) => ({ travail }),
    reessayer: async (travail) => travail,
    retoucher: ({ commande, contexte }) => enPause(commande, contexte),
    reexporter: ({ commande, contexte }) => enPause(commande, contexte),
    maquette: async () => ({ dureeSec: 0 }),
    annuler: async (travail, maintenant = Date.now()) => ({ ...travail, statut: "annule", modifieLe: new Date(maintenant).toISOString() }),
  };
}
