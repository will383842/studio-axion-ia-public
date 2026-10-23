/**
 * SERVICE « DÉCOR IA » (lot L10) — réglage et POINT D'INSERTION dans le montage face caméra.
 *
 * Réglage `facecam.decorIa` (Réglages, bloc « Décor IA ») : DÉSACTIVÉ par défaut. Il garde la description du décor et
 * la clé R2 de l'image de référence (jamais l'image elle-même : la table `documents` est chargée en mémoire).
 *
 * `passeDecorFacecam` est l'étape facultative que le moteur `montage-facecam` appelle APRÈS la passe image (lot B) et
 * AVANT la réalisation. Option coupée → `null` (étape ignorée, aucun appel). Sinon :
 *  - budget du mois restant lu ici (`resumeBudget`) et passé à la brique (plafond) ;
 *  - fournisseur Higgsfield : la SIMULATION par défaut ; le réel seulement si `reel` (réglage caché, faux par défaut),
 *    la clé et l'adresse sont là (voir `fournisseurs/higgsfield/index.ts`) ;
 *  - dépense réelle enregistrée tout de suite (`DepenseEnregistree`, rattachée à la vidéo et au travail) : elle entre
 *    dans le total du mois même si la suite du montage échoue. Si le moteur reprend ces lignes dans `lignesReelles`,
 *    `lignesRestantes` (même travail) les ignore : jamais comptées deux fois.
 * Aucun montant n'est rendu à l'écran (format sansPrix) : seul `message` est destiné à Will.
 */
import "server-only";
import { appliquerDecor, type DependancesDecor, type EntreeDecor, type ResultatDecor } from "@/briques/decor";
import { nettoyerDescription } from "@/briques/decor/consigne";
import type { Id } from "@/domaine/types";
import { fournisseurHiggsfield, MODELES_HIGGSFIELD, type FournisseurHiggsfield, type MediaAEnvoyer, type ModeleHiggsfield } from "@/fournisseurs/higgsfield";
import { garderHiggsfield, type GardeOptionPayante } from "@/briques/options-payantes/garde";
import { IPS_STUDIO } from "@/briques/decor/raccord";
import { additionner } from "@/lib/montants";
import { nouvelId } from "@/lib/ids";
import { depots, ecrireParametre, horodatage, journaliser, lireParametre, maintenant } from "./_commun";
import { exigerSession } from "./auth";
import { resumeBudget } from "./couts";

export const PARAM_DECOR_IA = "facecam.decorIa";

export interface ReglageDecorIa {
  actif: boolean;
  /** Décor voulu, en mots simples. */
  description: string;
  /** Image de référence du décor (clé R2). */
  imageReferenceCle?: string;
  modele: ModeleHiggsfield;
  /**
   * Appels RÉELS à Higgsfield (dépense). Faux par défaut et absent de l'écran : tant qu'il est faux, même option active,
   * tout passe par le double de simulation. À ouvrir seulement après vérification de l'API (API.md) et accord de Will.
   */
  reel: boolean;
}

export const REGLAGE_DECOR_IA_PAR_DEFAUT: ReglageDecorIa = { actif: false, description: "", modele: "kling_video_edit", reel: false };

/** Lecture tolérante : un champ absent ou mal formé prend sa valeur par défaut ; l'option reste coupée au moindre doute. */
export function lireReglageBrut(brut: unknown): ReglageDecorIa {
  const o = (brut && typeof brut === "object" ? brut : {}) as Partial<Record<keyof ReglageDecorIa, unknown>>;
  return {
    actif: o.actif === true,
    description: typeof o.description === "string" ? (nettoyerDescription(o.description) ?? "") : "",
    ...(typeof o.imageReferenceCle === "string" && o.imageReferenceCle.length > 0 && o.imageReferenceCle.length <= 400 ? { imageReferenceCle: o.imageReferenceCle } : {}),
    modele: MODELES_HIGGSFIELD.includes(o.modele as ModeleHiggsfield) ? (o.modele as ModeleHiggsfield) : REGLAGE_DECOR_IA_PAR_DEFAUT.modele,
    reel: o.reel === true,
  };
}

export async function lireReglageDecorIa(): Promise<ReglageDecorIa> {
  return lireReglageBrut(await lireParametre<unknown>(PARAM_DECOR_IA, null));
}

export async function definirReglageDecorIa(changement: Partial<ReglageDecorIa>): Promise<ReglageDecorIa> {
  await exigerSession();
  const suivant = lireReglageBrut({ ...(await lireReglageDecorIa()), ...changement });
  await ecrireParametre(PARAM_DECOR_IA, suivant);
  await journaliser("reglages", suivant.actif ? "Décor IA activé" : "Décor IA désactivé");
  return suivant;
}

export interface DemandePasseDecor {
  videoId: Id;
  travailId: Id;
  dureeUtileSec: number;
  mots?: EntreeDecor["mots"];
  /** Lecture de l'image de référence depuis R2 (clé du réglage). */
  lireImageReference(cle: string): Promise<MediaAEnvoyer | null>;
  extrairePassage: DependancesDecor["extrairePassage"];
  deposerPassage: DependancesDecor["deposerPassage"];
  mesurer: DependancesDecor["mesurer"];
  /** Injection pour les essais ; défaut : `fournisseurHiggsfield()` (simulation sauf choix explicite). */
  higgsfield?: FournisseurHiggsfield;
  attendre?: DependancesDecor["attendre"];
}

/** Étape facultative « Décor IA ». `null` : option coupée, rien n'est fait. */
export async function passeDecorFacecam(demande: DemandePasseDecor): Promise<ResultatDecor | null> {
  const reglage = await lireReglageDecorIa();
  // Lot J : l'option peut aussi être demandée pour CETTE version seulement (« Confirmer » dans le fil du monteur).
  const { optionDemandeePourTravail, preparerOptionPayante } = await import("./options-payantes");
  if (!reglage.actif && !(await optionDemandeePourTravail("decor-ia", demande.travailId))) return null;
  // Lot J : en réel, rien ne part sans « Confirmer » (carte sur « Votre vidéo ») ; la garde est revérifiée par le
  // fournisseur au moment du lancement. Sans accord : aucun envoi, la version gratuite (vrai décor) sort.
  let garde: GardeOptionPayante | undefined;
  if (reglage.reel) {
    const accord = await preparerOptionPayante("decor-ia", { travailId: demande.travailId, dureeSec: demande.dureeUtileSec, modele: reglage.modele });
    if (accord.statut !== "autorisee") {
      await journaliser("fabrication", accord.message);
      return sansDecor(reglage.modele, accord.message);
    }
    garde = accord.garde;
  }
  const imageReference = reglage.imageReferenceCle ? ((await demande.lireImageReference(reglage.imageReferenceCle).catch(() => null)) ?? undefined) : undefined;
  const budget = await resumeBudget();
  const resultat = await appliquerDecor(
    {
      idVideo: demande.videoId,
      dureeUtileSec: demande.dureeUtileSec,
      mots: demande.mots,
      decor: { description: reglage.description },
      imageReference,
      modele: reglage.modele,
      restantDuMoisCentimes: budget.restant.centimes,
    },
    {
      higgsfield: demande.higgsfield ? garderHiggsfield(demande.higgsfield, garde) : fournisseurHiggsfield({ reel: reglage.reel, garde }),
      extrairePassage: demande.extrairePassage,
      deposerPassage: demande.deposerPassage,
      mesurer: demande.mesurer,
      attendre: demande.attendre,
    },
  );
  if (resultat.lignes.length) {
    const video = await depots().videos.obtenir(demande.videoId);
    await depots().depenses.enregistrer({
      id: nouvelId("dep"),
      videoId: demande.videoId,
      travailId: demande.travailId,
      lignes: resultat.lignes,
      total: additionner(...resultat.lignes.map((l) => l.total)),
      date: maintenant(),
      ...horodatage(),
      estDemo: video?.estDemo,
    });
  }
  // Journal : la phrase pour Will ; le statut et la raison techniques vont en console.
  if (resultat.raison) console.warn(`[decor-ia] ${demande.videoId} : ${resultat.statut} (${resultat.raison})`);
  await journaliser("fabrication", resultat.message);
  return resultat;
}

/** Lot J : résultat « non lancé » (aucun envoi, aucune dépense) quand l'option payante n'est pas confirmée. */
function sansDecor(modele: ModeleHiggsfield, message: string): ResultatDecor {
  return { statut: "non-lance", message, plan: { decorApplique: false, morceaux: [], audio: "origine", ips: IPS_STUDIO }, passages: [], modele, creditsEstimes: 0, creditsDebites: 0, lignes: [] };
}
