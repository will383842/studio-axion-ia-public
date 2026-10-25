/**
 * DÉPENSE CLAUDE RATTACHÉE À UNE VIDÉO (plan « outils réels » du 03/10, lot R2 ; constat C9).
 *
 * `executerRolePourVideo` est le SEUL chemin par lequel un texte de publication dépense chez Claude. Il réutilise les
 * briques de `generation-claude.ts` (choix et clé, limite du mois, verrou, coût réel, essais sur surcharge) et de la
 * brique Crédits (pré-vol, réservation) ; il n'en recopie aucune. Dans l'ordre, avant tout appel :
 *  1. simulation si Claude n'est pas choisi pour les textes (réglage « fournisseur.texte-reseaux », sinon
 *     `FOURNISSEUR_TEXTE_RESEAUX=claude`) ou si la clé manque : aucun appel, 0 $ ;
 *  2. SOUS LE VERROU DU MOIS (le même que l'écriture des sujets), d'un seul tenant :
 *     a. plafond PAR VIDÉO (0,30 $ par défaut, réglage `claude.plafondKitUsd`) : dépensé chez Claude pour cette vidéo
 *        + réservé + pire cas × 1,2 > plafond → arrêt « plafond-video », rien ne part ;
 *     b. limite Claude DU MOIS (`claude.plafondMensuelUsd`) : même règle que l'écriture → « en-attente-credit » ;
 *     c. pré-vol de la brique Crédits (budget du studio, solde Claude suivi) → « en-attente-credit » ;
 *     d. réservation et engagement sur le budget du mois (`verifierEtReserver`, rattachés à la vidéo, un `appelId` par appel) ;
 *  3. appel (hors verrou) ; coût réel dans `DepenseEnregistree` (fournisseur `anthropic`, `videoId`), réservation
 *     « consommée ».
 * Rien ne repart seul : un texte arrêté garde son texte d'essai ; Will le réécrit d'un geste (« Réécrire »).
 * Coupure après l'envoi (réseau, délai, redémarrage) : la réponse a pu être facturée ; la réservation RESTE comptée dans
 * le mois et dans le plafond de la vidéo (la perte est plafonnée), puis elle est soldée le mois suivant.
 * La clé ne sort jamais : tout message est masqué (`masquerSecrets`).
 */
import "server-only";
import type { z } from "zod";
import { depenseDuFournisseur, eurVersUsd, totalReserve } from "@/domaine/credits";
import type { DepenseEnregistree, Id } from "@/domaine/types";
import { ErreurClaude, type ReponseClaude } from "@/fournisseurs/claude/client";
import { masquerSecretsClaude } from "@/fournisseurs/claude/secret";
import { pireCasRole, type DefinitionRole, type EntreeRole, type MarqueurArret } from "@/generateur/roles/types";
import { cleMois } from "@/lib/dates";
import { nouvelId } from "@/lib/ids";
import { centimes, centimesDuPlafond, formaterMontant } from "@/lib/montants";
import { depots, ecrireParametre, ErreurStudio, horodatage, journaliser, lireParametre, maintenant } from "./_commun";
import { libererReservation, MARGE_CREDITS, signalerAttenteCredit, verifierEtReserverSelonOrigine } from "./credits";
import { jugerPlafond, signalerDepassementIndicatif, type OrigineLancement } from "./budget-mensuel";
import { formatSansPrix } from "@/formats";
import { budgetIndicatifPour, origineDeLaVideo, sujetDeCloche } from "./mode-budget";
import { appelerAvecRotation, attendre, messageSansCompte, attenteSurcharge, claudeActif, coutReelUsd, envClaude, peutEcrire, engageClaudeDuMoisCentimes, ESSAIS_SURCHARGE, ligne, MESSAGE_CLE_REFUSEE, MESSAGE_MODELE_CHANGE, PARAM_MODELE_BLOQUE, plafondMensuelClaudeUsd, sousVerrouMois, taux } from "./generation-claude";

/** Plafond Claude PAR VIDÉO pour ses textes de publication (≈ 0,05 $ attendus pour 4 réseaux). */
export const PLAFOND_KIT_USD = 0.3;
export const PARAM_PLAFOND_KIT = "claude.plafondKitUsd";
/** Préfixe des appels : retrouve les réservations des textes de publication (appels interrompus). */
export const PREFIXE_APPEL_TEXTE = "txtpub";

/**
 * Face caméra (lot G) : le monteur, sa relecture et ses cartes sur mesure ont leur PROPRE plafond par version
 * (1,50 $ par défaut, réglage `facecam.plafondVersionUsd`), à part du plafond des textes de publication : l'un ne
 * mange jamais l'autre. Jamais affiché (format sans prix) : seul le plafond du MOIS reste visible (Réglages).
 * Ses dépenses se reconnaissent à leur étape (« Monteur · … ») et ses réservations à leur préfixe.
 */
export const PLAFOND_FACECAM_VERSION_USD = 1.5;
export const PARAM_PLAFOND_FACECAM = "facecam.plafondVersionUsd";
export const PREFIXE_ETAPE_MONTEUR = "Monteur ·";
const PREFIXE_APPEL_FACECAM = `${PREFIXE_APPEL_TEXTE}-fcm`;

export async function plafondFacecamVersionUsd(): Promise<number> {
  const v = await lireParametre<number>(PARAM_PLAFOND_FACECAM, PLAFOND_FACECAM_VERSION_USD);
  return Number.isFinite(v) && v >= 0 ? v : PLAFOND_FACECAM_VERSION_USD;
}

const estDepenseMonteur = (x: Pick<DepenseEnregistree, "lignes">) => x.lignes.some((l) => l.etape.startsWith(PREFIXE_ETAPE_MONTEUR));
const estAppelFacecam = (travailId?: string) => !!travailId?.startsWith(`${PREFIXE_APPEL_FACECAM}-`);

/**
 * Tableau animé (11/10) : le découpage en scènes et le générateur de scripts ont chacun leur PROPRE plafond par vidéo
 * (réglages `tableau.plafondDecoupageUsd` et `tableau.plafondScriptUsd`), à part du plafond des textes de publication :
 * aucun ne mange l'autre, et aucun autre plafond n'est relevé. Défaut du découpage : 0,60 $ (une relance possible) ;
 * défaut de l'écriture : fourni par l'appelant (le pire cas d'une génération). Leurs dépenses se reconnaissent à leur
 * étape (préfixe), leurs réservations à leur préfixe d'appel.
 */
export interface PlafondPropre {
  /** Identifiant court (entre dans le préfixe des réservations). */
  id: "tbdec" | "tbscr" | "favid";
  /** Réglage du plafond, en dollars. */
  parametre: string;
  /** Valeur par défaut du réglage, en dollars. */
  defautUsd: number;
  /** Préfixe des étapes de ses dépenses (l'étape de l'appel doit commencer par lui). */
  prefixeEtape: string;
  /**
   * Début de l'enveloppe (date ISO) : seules les dépenses et réservations de ce plafond faites DEPUIS comptent. Une
   * nouvelle écriture ou un nouveau découpage, confirmés à l'écran, ouvrent une enveloppe neuve ; une reprise garde la
   * sienne. Absent : tout ce qui a été dépensé pour la vidéo compte (comportement d'origine).
   */
  depuis?: string;
}

/**
 * Face caméra animée v4 (18/10) : contrôle visuel des vidéos d'illustration (Sonnet), 0,60 $ au plus par vidéo finale (décision de Will).
 * Plafond propre, à part de celui des textes de publication (0,30 $) ; l'enveloppe commence au début de la version (`depuis`).
 */
export const PLAFOND_VIDEOS_FA_USD = 0.6;
export const PARAM_PLAFOND_VIDEOS_FA = "facecamAnimee.plafondVideosUsd";
export const PREFIXE_ETAPE_VIDEOS_FA = "Vidéos d'illustration FA ·";
export function plafondVideosFa(depuis?: string): PlafondPropre {
  return { id: "favid", parametre: PARAM_PLAFOND_VIDEOS_FA, defautUsd: PLAFOND_VIDEOS_FA_USD, prefixeEtape: PREFIXE_ETAPE_VIDEOS_FA, ...(depuis ? { depuis } : {}) };
}

export const PLAFOND_DECOUPAGE_TABLEAU_USD = 0.6;
export const PARAM_PLAFOND_DECOUPAGE_TABLEAU = "tableau.plafondDecoupageUsd";
export const PARAM_PLAFOND_SCRIPT_TABLEAU = "tableau.plafondScriptUsd";

/** Préfixes d'étape des plafonds propres connus (leurs dépenses ne comptent pas dans le plafond des textes). */
const PREFIXES_PLAFONDS_PROPRES = ["Tableau · découpage", "Tableau · script", PREFIXE_ETAPE_VIDEOS_FA] as const;
const PREFIXES_APPELS_PROPRES = ["tbdec", "tbscr", "favid"].map((id) => `${PREFIXE_APPEL_TEXTE}-${id}-`);
const estDepensePropre = (x: Pick<DepenseEnregistree, "lignes">) => x.lignes.some((l) => PREFIXES_PLAFONDS_PROPRES.some((p) => l.etape.startsWith(p)));
const estAppelPropre = (travailId?: string) => !!travailId && PREFIXES_APPELS_PROPRES.some((p) => travailId.startsWith(p));

/** Plafond du découpage du tableau, par vidéo (réglage, sinon 0,60 $). */
export const PLAFOND_DECOUPAGE_TABLEAU: PlafondPropre = Object.freeze({ id: "tbdec", parametre: PARAM_PLAFOND_DECOUPAGE_TABLEAU, defautUsd: PLAFOND_DECOUPAGE_TABLEAU_USD, prefixeEtape: "Tableau · découpage" });

/** Plafond de l'écriture du script du tableau, par vidéo ; `defautUsd` : le pire cas d'une génération. */
export function plafondScriptTableau(defautUsd: number): PlafondPropre {
  return { id: "tbscr", parametre: PARAM_PLAFOND_SCRIPT_TABLEAU, defautUsd, prefixeEtape: "Tableau · script" };
}

/** Valeur du plafond propre (réglage lu, sinon le défaut), en dollars. */
export async function valeurPlafondPropre(p: PlafondPropre): Promise<number> {
  const v = await lireParametre<number>(p.parametre, p.defautUsd);
  return Number.isFinite(v) && v >= 0 ? v : p.defautUsd;
}

/** Engagé chez Claude par un plafond propre pour cette vidéo (dépenses de son étape + ses réservations), centimes de $. */
export async function engagePlafondPropreCentimes(videoId: Id, p: PlafondPropre): Promise<number> {
  const d = depots();
  const t = await taux();
  const depuis = p.depuis ?? "";
  const depenses = await d.depenses.lister((x) => x.videoId === videoId && x.date >= depuis && x.lignes.some((l) => l.etape.startsWith(p.prefixeEtape)));
  const prefixe = `${PREFIXE_APPEL_TEXTE}-${p.id}-`;
  const reserve = totalReserve(await d.reservations.lister((r) => r.videoId === videoId && r.statut === "active" && !!r.travailId?.startsWith(prefixe) && r.creeLe >= depuis), "anthropic");
  return Math.ceil(depenseDuFournisseur(depenses, "anthropic", t) - 1e-9) + reserve;
}

/** Ce qui reste du plafond des vidéos d'illustration pour cette version (réglage moins l'engagé depuis `depuis`), en dollars, jamais négatif. */
export async function plafondRestantVideosFa(videoId: Id, depuis?: string): Promise<number> {
  const p = plafondVideosFa(depuis);
  return Math.max(0, (await valeurPlafondPropre(p)) - (await engagePlafondPropreCentimes(videoId, p)) / 100);
}

export type ResultatVideo<T = unknown> =
  | {
      ok: true;
      simule: boolean;
      donnees?: T;
      invalide?: string;
      ecartees?: string[];
      marqueur?: MarqueurArret;
      coutUsd: number;
      modele: string;
      depenseId?: Id;
      jetons?: ReponseClaude["jetons"];
      /**
       * Tableau animé (plafond propre) seulement : le texte BRUT rendu par Claude et sa raison d'arrêt. Un rôle sans
       * schéma (le découpage) n'a pas de `donnees` (`lireSortie` ne lit que le JSON d'un schéma) : son texte est ici.
       */
      texte?: string;
      stopReason?: string | null;
    }
  | { ok: false; arret: "plafond-video" | "en-attente-credit" | "bloquee-modele" | "indisponible" | "budget-usine"; message: string };

export async function plafondKitUsd(): Promise<number> {
  const v = await lireParametre<number>(PARAM_PLAFOND_KIT, PLAFOND_KIT_USD);
  return Number.isFinite(v) && v >= 0 ? v : PLAFOND_KIT_USD;
}

/**
 * Claude est-il CHOISI pour les textes de publication, avec sa clé ? (Aucune dépense ici.) Choisi même si tous ses comptes
 * sont épuisés : un texte d'essai ne remplace jamais un vrai texte, et le prix d'un nouvel appel est toujours annoncé.
 * L'épuisement n'est regardé qu'au départ effectif de l'appel (`executerRolePourVideo`, `peutEcrire`).
 */
export async function claudeTextesActif(): Promise<boolean> {
  return !!(await claudeActif("texte-reseaux"));
}

/* Appels partis DEPUIS CE PROCESSUS et pas encore revenus (les autres sont des appels interrompus). */
const cleEnVol = Symbol.for("studio-axion-ia.textes-publication-en-vol");
type AvecEnVol = typeof globalThis & { [cleEnVol]?: Set<string> };
function enVol(): Set<string> {
  const g = globalThis as AvecEnVol;
  return (g[cleEnVol] ??= new Set());
}

/** Étape d'une dépense estimée laissée par un appel interrompu (soldé le mois suivant). */
export const ETAPE_APPEL_INTERROMPU = "Texte de publication · appel interrompu (estimation)";

/**
 * Dépensé chez Claude pour cette vidéo + réservé en cours, en centimes de dollar. Compte aussi l'estimation des appels
 * interrompus déjà soldés (dépense « estimée ») : le plafond de la vidéo en tient compte d'un mois à l'autre.
 */
export async function engageClaudeVideoCentimes(videoId: Id): Promise<number> {
  const d = depots();
  const t = await taux();
  // Lot G : le monteur face caméra a son propre plafond ; ses dépenses ne comptent pas dans celui des textes. De même
  // pour le découpage et l'écriture du tableau animé (plafonds propres).
  const depenses = await d.depenses.lister((x) => x.videoId === videoId && !estDepenseMonteur(x) && !estDepensePropre(x));
  const reelle = depenseDuFournisseur(depenses, "anthropic", t);
  const estimee = depenses.flatMap((x) => x.lignes).filter((l) => l.nature === "estime" && l.etape === ETAPE_APPEL_INTERROMPU).reduce((s, l) => s + eurVersUsd(l.total.centimes, t), 0);
  const reserve = totalReserve(await d.reservations.lister((r) => r.videoId === videoId && r.statut === "active" && !estAppelFacecam(r.travailId) && !estAppelPropre(r.travailId)), "anthropic");
  return Math.ceil(reelle + estimee - 1e-9) + reserve;
}

/**
 * Lot G : engagé chez Claude par le monteur face caméra pour la version en cours (dépenses « Monteur · … » depuis
 * `depuis`, plus ses appels en vol), en centimes de dollar.
 */
export async function engageFacecamVersionCentimes(videoId: Id, depuis: string): Promise<number> {
  const d = depots();
  const t = await taux();
  const depenses = await d.depenses.lister((x) => x.videoId === videoId && estDepenseMonteur(x) && x.date >= depuis);
  const reserve = totalReserve(await d.reservations.lister((r) => r.videoId === videoId && r.statut === "active" && estAppelFacecam(r.travailId)), "anthropic");
  return Math.ceil(depenseDuFournisseur(depenses, "anthropic", t) - 1e-9) + reserve;
}

/**
 * Réservations d'appels interrompus (redémarrage pendant l'appel) : comptées dans le mois où l'appel est parti (il a pu
 * être facturé), soldées (« consommée ») dès le mois suivant pour ne plus bloquer la limite des mois d'après. Au solde,
 * une dépense ESTIMÉE (datée du mois de l'appel) garde ce montant dans le plafond de la vidéo.
 */
async function solderAppelsInterrompus(): Promise<void> {
  const d = depots();
  const mois = cleMois();
  const enCours = enVol();
  const anciennes = await d.reservations.lister((r) => r.statut === "active" && !!r.travailId?.startsWith(`${PREFIXE_APPEL_TEXTE}-`) && !enCours.has(r.travailId) && cleMois(r.creeLe) !== mois);
  if (!anciennes.length) return;
  const t = await taux();
  for (const r of anciennes) {
    if (r.videoId) {
      const lignes = [ligne(ETAPE_APPEL_INTERROMPU, r.centimes / 100, t, "estime")];
      const video = await d.videos.obtenir(r.videoId);
      await d.depenses.enregistrer({ id: nouvelId("dep"), videoId: r.videoId, lignes, total: lignes[0].total, date: r.creeLe, estDemo: video?.estDemo, ...horodatage() });
    }
    await libererReservation(r.travailId!, "consommee");
  }
}

/**
 * Exécute UN rôle pour une vidéo, avec plafond par vidéo, limite du mois, pré-vol, réservation et coût réel (voir
 * l'en-tête). `ok: false` : rien n'est parti, rien n'est payé (sauf coupure après l'envoi, comptée et plafonnée).
 */
/**
 * ORIGINE DE LA DÉPENSE. Chemin automatique (fabrication, relecture lancée par la fabrication) : `options.origine` est celle de
 * la commande ; absente, elle est lue sur la dernière version de la vidéo (une vidéo de l'Usine reste bloquante).
 * Action que Will fait LUI-MÊME en session (message tapé au monteur, « Régénérer le texte », clic site-videos ou tableau) :
 * `options.parWill: true` saute cette lecture de secours, l'origine est « studio » (budget indicatif), même sur une vidéo venue
 * de l'Usine. Seules les commandes réellement passées par l'Usine restent bloquantes.
 */
/**
 * `options.facecam` (lot G, facultatif) : appel du monteur face caméra, compté sur le plafond de la VERSION (dépenses
 * depuis `depuis`) au lieu du plafond des textes ; plafond atteint → arrêt « plafond-video » sans montant (le monteur
 * sort alors la version simple). L'étape doit commencer par « Monteur · ».
 */
/**
 * `options.plafondPropre` (tableau animé, facultatif) : appel compté sur SON plafond par vidéo (découpage, écriture du
 * script) au lieu du plafond des textes ; l'étape doit commencer par son préfixe.
 */
export async function executerRolePourVideo<S extends z.ZodType>(videoId: Id, role: DefinitionRole<S>, entree: EntreeRole, options: { etape: string; facecam?: { depuis: string }; plafondPropre?: PlafondPropre; origine?: OrigineLancement; parWill?: boolean }): Promise<ResultatVideo<z.infer<S>>> {
  const d = depots();
  const video = await d.videos.obtenir(videoId);
  if (!video) throw new ErreurStudio("INTROUVABLE", "Cette vidéo n'existe plus.");
  const actif = await claudeActif("texte-reseaux");

  // 1. Simulation : aucun appel, 0 $.
  if (!actif) {
    const sortie = role.simuler(entree);
    return { ok: true, simule: true, donnees: typeof sortie === "string" ? undefined : sortie, coutUsd: 0, modele: "simulation" };
  }

  // Tous les comptes Claude posés sont épuisés : AUCUN appel, AUCUNE réservation (jamais l'API payante).
  if (!peutEcrire(actif)) {
    await journaliser("publication", `${options.etape} : ${actif.sansCompte ? "aucun compte Claude utilisable" : "tous les comptes Claude sont épuisés"}, rien n'est parti`, { type: "video", id: videoId });
    return { ok: false, arret: "en-attente-credit", message: `${actif.sansCompte ? messageSansCompte(actif.sansCompte) : "Les comptes Claude sont épuisés pour cette période."} Le texte actuel est gardé.` };
  }

  const pire = pireCasRole(role, entree);
  const t = await taux();
  /** Libellé lisible de l'étape (« Texte de publication · LinkedIn ») : Journal et lignes de coût. */
  const libelle = options.etape;
  const lignes = [ligne(options.etape, pire, t, "estime")];
  const propre = options.plafondPropre;
  if (propre && !options.etape.startsWith(propre.prefixeEtape)) throw new ErreurStudio("ETAPE_INVALIDE", "Étape de dépense mal nommée.");
  const appelId = nouvelId(options.facecam ? PREFIXE_APPEL_FACECAM : propre ? `${PREFIXE_APPEL_TEXTE}-${propre.id}` : PREFIXE_APPEL_TEXTE);
  const demande = Math.ceil(pire * 100 * (1 + MARGE_CREDITS));

  // 2. Plafond de la vidéo, limite du mois, pré-vol et réservation, d'un seul tenant sous le verrou du mois.
  // L'origine passée l'emporte ; sinon celle de la dernière version de la vidéo : une vidéo de l'Usine reste bloquante.
  const origineEffective = options.origine ?? (options.parWill ? "studio" : await origineDeLaVideo(videoId));
  const sansPrix = formatSansPrix(video.formatId);
  const indicatif = await budgetIndicatifPour(origineEffective);
  const sujet = await sujetDeCloche(videoId);
  let reserve = false;
  try {
    const arret = await sousVerrouMois(async (): Promise<ResultatVideo<never> | null> => {
      await solderAppelsInterrompus();
      if (options.facecam) {
        // Lot G : plafond du monteur pour cette version, jamais montré (format sans prix).
        const plafond = await plafondFacecamVersionUsd();
        const sur = await jugerPlafond((await engageFacecamVersionCentimes(videoId, options.facecam.depuis)) + demande, plafond, indicatif, `${libelle} (monteur, cette version)`, sujet, { sansPrix: true });
        if (sur === "bloque") {
          await journaliser("retouche", `${libelle} : plafond du monteur pour cette version atteint, version simple`, { type: "video", id: videoId });
          return { ok: false, arret: "plafond-video", message: "Version simple pour cette modification." };
        }
      }
      if (propre) {
        // Tableau animé : plafond propre de cette vidéo (découpage ou écriture), dit en euros comme le prix du bouton.
        const plafond = await valeurPlafondPropre(propre);
        const sur = await jugerPlafond((await engagePlafondPropreCentimes(videoId, propre)) + demande, plafond, indicatif, `${libelle} (cette vidéo)`, sujet, sansPrix ? { sansPrix: true } : { tauxUsdEur: t });
        if (sur === "bloque") {
          const enEuros = formaterMontant(centimes(centimesDuPlafond(plafond * t)));
          await journaliser("video", `${libelle} : plafond de cette vidéo atteint (${enEuros}), rien n'est parti`, { type: "video", id: videoId });
          return { ok: false, arret: "plafond-video", message: `Plafond de cette vidéo atteint (${enEuros}) : rien n'a été payé.` };
        }
      }
      const plafondVideo = await plafondKitUsd();
      if (!options.facecam && !propre) {
        const sur = await jugerPlafond((await engageClaudeVideoCentimes(videoId)) + demande, plafondVideo, indicatif, `${libelle} (textes de la vidéo)`, sujet, { tauxUsdEur: t });
        if (sur === "bloque") {
          // Une seule monnaie à l'écran : le plafond (réglé en dollars) est dit en euros, comme le prix du bouton.
          const enEuros = formaterMontant(centimes(centimesDuPlafond(plafondVideo * t)));
          await journaliser("publication", `${libelle} : plafond de la vidéo atteint (${enEuros}), le texte n'est pas écrit`, { type: "video", id: videoId });
          return { ok: false, arret: "plafond-video", message: `Plafond des textes de cette vidéo atteint (${enEuros}) : le texte actuel est gardé.` };
        }
      }
      const plafondMois = await plafondMensuelClaudeUsd();
      const engage = await engageClaudeDuMoisCentimes();
      if (engage.depense + engage.reserve + demande > centimesDuPlafond(plafondMois)) {
        if (indicatif) {
          // Pas de plafond mensuel en mode indicatif : repère seulement. Le refus d'Anthropic (crédit épuisé) reste le vrai arrêt.
          await signalerDepassementIndicatif("claude-mois", "Repère Claude du mois dépassé", "Rien n'est arrêté : les textes continuent. Seul un crédit Claude épuisé les met en attente.");
        } else {
          await journaliser("publication", "Textes de publication : limite Claude du mois atteinte", { type: "video", id: videoId });
          return { ok: false, arret: "en-attente-credit", message: "Limite Claude du mois atteinte : le texte actuel est gardé." };
        }
      }
      try {
        // CORRECTEUR 1 — B6 : aucune confirmation en dur. Un texte est borné par les plafonds Claude (vidéo, mois) : il ne
        // dépasse jamais le seuil de confirmation ; s'il le dépassait, il serait refusé (personne ne l'a confirmé).
        // L3-0 : contrôle, réservation ET engagement sur le budget du mois d'un seul tenant (verrou des crédits) ; « usine » passe par `reserverPourUsine`.
        await verifierEtReserverSelonOrigine(origineEffective, { lignes, total: lignes[0].total }, false, "Ce texte", { videoId, travailId: appelId });
      } catch (e) {
        // L3-0 : dépense commandée par l'Usine sans budget reçu (ou budget atteint) : refus net, rien n'est payé.
        if (e instanceof ErreurStudio && (e.code === "BUDGET_USINE_ABSENT" || e.code === "BUDGET_MENSUEL_ATTEINT")) {
          await journaliser("publication", `${libelle} : budget de l'Usine absent ou atteint, rien n'est parti`, { type: "video", id: videoId });
          return { ok: false, arret: "budget-usine", message: e.message };
        }
        if (e instanceof ErreurStudio && (e.code === "CREDIT_INSUFFISANT" || e.code === "BUDGET_DEPASSE")) {
          // Phrase fixe par cause (garde écran : jamais le message brut d'une erreur sous les yeux de Will).
          const phrase = e.code === "CREDIT_INSUFFISANT" ? "Crédit Claude insuffisant." : "Budget du mois atteint.";
          await journaliser("publication", `Textes de publication : ${phrase}`, { type: "video", id: videoId });
          return { ok: false, arret: "en-attente-credit", message: `${phrase} Le texte actuel est gardé.` };
        }
        throw e;
      }
      enVol().add(appelId);
      reserve = true;
      return null;
    });
    if (arret) return arret;
  } finally {
    if (!reserve) enVol().delete(appelId);
  }

  // 3. Appel, hors verrou (3 essais sur surcharge seulement).
  let essai = 0;
  try {
    for (;;) {
      essai++;
      try {
        const r = await appelerAvecRotation(actif, role, entree, { type: "video", id: videoId });
        const cout = coutReelUsd(r.reponse);
        const lignesReelles = [ligne(options.etape, cout, t, "reel")];
        const depense: DepenseEnregistree = { id: nouvelId("dep"), videoId, lignes: lignesReelles, total: lignesReelles[0].total, date: maintenant(), estDemo: video.estDemo, sourceClaude: actif.source, ...horodatage() };
        await d.depenses.enregistrer(depense);
        await libererReservation(appelId, "consommee");
        if (r.reponse.replis.length) {
          // Détail technique (modèles) au journal du serveur seulement ; le studio dit l'essentiel.
          console.info(`[studio] textes de publication : « ${options.etape} » servi par ${r.reponse.modele} (repli après ${r.reponse.replis.join(", ")})`);
          await journaliser("publication", `${libelle} : écrit par le modèle de secours de Claude`, { type: "video", id: videoId });
        }
        return {
          ok: true,
          simule: false,
          donnees: r.donnees,
          invalide: r.invalide,
          ...(r.ecartees?.length ? { ecartees: r.ecartees } : {}),
          marqueur: r.marqueur,
          coutUsd: cout,
          modele: r.reponse.modele,
          depenseId: depense.id,
          jetons: r.reponse.jetons,
          ...(propre ? { texte: r.reponse.texte, stopReason: r.reponse.stopReason } : {}),
        };
      } catch (e) {
        const err = e instanceof ErreurClaude ? e : null;
        if (err?.code === "surcharge" && essai < ESSAIS_SURCHARGE) {
          await attendre(Math.max(attenteSurcharge(essai), (err.attenteSec ?? 0) * 1000));
          continue;
        }
        return await traiterEchec(videoId, appelId, options.etape, err, e, actif.cle, video.estDemo);
      }
    }
  } finally {
    enVol().delete(appelId);
  }
}

async function traiterEchec(videoId: Id, appelId: string, libelle: string, err: ErreurClaude | null, brute: unknown, cle: string, estDemo?: boolean): Promise<ResultatVideo<never>> {
  const message = masquerSecretsClaude(err?.message ?? (brute instanceof Error ? brute.message : "Erreur inconnue."), [cle], envClaude());
  const lien = { type: "video" as const, id: videoId };
  // Refus net de l'API : rien n'a été produit, la réservation est rendue au solde.
  const refusNet = err?.code === "facturation" || err?.code === "modele-introuvable" || err?.code === "cle-refusee" || err?.code === "surcharge" || err?.code === "requete" || err?.code === "illisible";
  if (refusNet) await libererReservation(appelId, "liberee");
  // Le message de l'API (déjà masqué) ne va qu'au journal du serveur ; le studio dit l'essentiel en mots simples.
  console.warn(`[studio] textes de publication : « ${libelle} » : ${err?.code ?? "erreur"} — ${message}`);
  if (err?.code === "facturation") {
    await signalerAttenteCredit(null, "anthropic", estDemo);
    await journaliser("publication", `Textes de publication : Claude refuse l'appel (crédit épuisé ou limite du compte)`, lien);
    return { ok: false, arret: "en-attente-credit", message: "Claude refuse l'appel : crédit épuisé ou limite du compte atteinte. Le texte actuel est gardé." };
  }
  if (err?.code === "modele-introuvable") {
    await ecrireParametre(PARAM_MODELE_BLOQUE, { message: MESSAGE_MODELE_CHANGE, detail: message, le: maintenant() });
    await journaliser("publication", MESSAGE_MODELE_CHANGE, lien);
    return { ok: false, arret: "bloquee-modele", message: MESSAGE_MODELE_CHANGE };
  }
  if (err?.code === "cle-refusee") {
    await journaliser("publication", "Textes de publication : Claude refuse la clé du studio", lien);
    throw new ErreurStudio("CLE_REFUSEE", MESSAGE_CLE_REFUSEE);
  }
  // Coupure après l'envoi : la réponse a pu être produite et facturée ; la réservation reste comptée (plafonnée).
  await journaliser("publication", `${libelle} : le texte n'a pas pu être écrit${refusNet ? "" : " ; son estimation reste comptée pour cette vidéo"}`, lien);
  return { ok: false, arret: "indisponible", message: "Claude n'a pas pu écrire ce texte : le texte actuel est gardé. Réessayez dans un instant." };
}
