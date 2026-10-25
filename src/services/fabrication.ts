/**
 * FABRICATION (AV2.2-1, AV2.2-9, AV2.3-10 ; moteur avocat B.0 §3, §6-9, §18-19).
 * construireCommande(videoId) est le SEUL endroit qui transforme les données en
 * CommandeFabrication versionnée (contrat v2). Un moteur ne lit que la commande.
 * Le moteur est FIGÉ au lancement (`commande.moteurId`) : tout travail lancé lit `moteurDeCommande`.
 */
import "server-only";
import type {
  CommandeFabrication,
  DistributionResolue,
  ElementBibliotheque,
  Id,
  LigneCout,
  MediaCommande,
  Montant,
  Plan,
  Ratio,
  Script,
  SegmentSousTitres,
  StyleResolu,
  StylesResolus,
  ValeurAccessoire,
  ValeurElement,
  Video,
  VersionVideo,
  VisageResolu,
  VoixBrutePayee,
} from "@/domaine/types";
import { centimesBloquants } from "@/domaine/credits";
import { motsSousTitres, plansDepuisScript, texteScript } from "@/domaine/derivations";
import { baseRetenue, fabriquerSousTitres } from "@/briques/sous-titres";
import { resoudreVisagesParAngle, visagePourFormat } from "@/domaine/distribution";
import { prononciationsActives } from "@/domaine/prononciations";
import { empreinteDesBlocs, relectureAExiger } from "@/domaine/relecture-assistant";
import { accordDuFormat, briquesEffectives, dureeVideo, migrerReglages, musiqueRetenue, debitLecture, nomCourtFormat, obtenirFormat, scriptAJour, trouverFormat, validerReglages } from "@/formats";
import { repartitionDepuisReglages } from "@/formats/communs";
import type { DefinitionFormat } from "@/formats/types";
import { resoudreFournisseur } from "@/fournisseurs";
import { commandeEnEssai, DOUBLE_PAS_CHOISI, idMoteurDeCommande, moteurDeCommande, moteurMontageReel } from "@/moteurs";
import { renduSimule } from "@/fournisseurs/rendu/client";
import type { OrigineLancement } from "./budget-mensuel";
import { decisionMontageReel, moteurAuLancement } from "./reglages";
import type { Estimation, MoteurVideo, OperationMontage, ParentRetouche } from "@/moteurs";
import { lireRenduDouble } from "./rendu-double";
import { cleEtapeDeLigne } from "@/moteurs/couts-etapes";
import { MESSAGE_VOIX_ESSAI as consigneVoixPersonnage } from "@/domaine/voix-essai";
import { doubleDejaRenduDepuis, partDoubleReel } from "@/domaine/double-reel";
import { empreinteAudioMaitre } from "@/briques/empreinte-audio";
import { nouvelId } from "@/lib/ids";
import { LUT_AUCUNE } from "@/donnees/luts-axion";
import { additionner, centimes, formaterMontant, TAUX_USD_EUR_PAR_DEFAUT } from "@/lib/montants";
import { depots, ressourceActive, ErreurStudio, fournisseur, fournisseurSimule, horodatage, journaliser, lireParametre, maintenant } from "./_commun";
import { prochainNumeroSuivi } from "@/donnees/memoire";
import { NUMERO_DEMO_MIN } from "./generateur";
import { exigerSession } from "./auth";
import { preparerReglagesMoteur } from "./cas-concret-reglages";
import { avecSerieALEcran } from "./series";
import { complementsGenerateur, type TexteRelu } from "./fabrication-reseaux";
import { ligneSimulee, resumeBudget } from "./couts";
import { depenserSelonOrigine, libererReservation, verifierEtReserverSelonOrigine } from "./credits";
import { accordAutomatique, budgetIndicatif, budgetIndicatifPour } from "./mode-budget";
import { reglageIntensite } from "@/briques/intensite/reglage";
import { bruitagesDeLaCommande } from "./bruitages";
import { appliquerProduitsDuMoteur } from "./travaux";
import { appliquerCascade, changerModeEconomique, fixerRangDeLaVideo, marquerUtilisations, modeEconomique, optionsDuFormat, origineDuPlan } from "./illustrations";
import { resumeCoutIllustrations, type DecisionIllustration, type OrigineCascade } from "@/domaine/illustrations";
import { urlsFichiers } from "./fichiers";
import { sousTitresCourants } from "./videos";
import type { VuePlan } from "./vues";
import { accordCouvre, accordPropre, type AccordPrix } from "@/domaine/accord";
import { plafondClaudeDuMoisAtteint } from "./plafond-claude";
// Facecam lot E : raccords de la chaîne vidéo (agent monteur, Décor IA, relecture), posés au chargement.
import "./facecam-branchements";
// Mission H : raccords facultatifs de l'avocat (motion commune, monteur, multicaméra), coupés par défaut.
import { entreesAvocatDuLancement } from "./avocat-branchements";
import { ENTREE_RESSEMBLANCE_VOIX, lignesVoixMaquetteRestantes } from "@/briques/voix-maitre/reference";
import { reglageRessemblanceVoix } from "./voix-ressemblance";
import { entreesDuLook } from "@/moteurs/montage-facecam/look";

/** Clé des plans de l'Aperçu avant toute fabrication. */
export function versionBrouillon(videoId: Id): string {
  return `${videoId}-brouillon`;
}

/** Style résolu avec sa VALEUR complète et son fichier (le moteur ne lit que la commande, B.0 §8). */
function styleResolu<V extends ValeurElement>(e: ElementBibliotheque | null | undefined, id: string): StyleResolu<V> {
  return { id, nom: e?.nom ?? id, valeur: e?.valeur as V | undefined, fichierId: e?.fichierId };
}

async function stylesResolus(video: Video, format: DefinitionFormat): Promise<StylesResolus> {
  const d = depots();
  const def = format.stylesParDefaut;
  // Ancien champ `fondId` (vidéos d'avant la fusion fond → décor) : lu tant que la migration ne l'a pas renommé.
  const ancienFond = (video.styles as { fondId?: string }).fondId;
  // Priorité : choix de la vidéo > défaut du format (le plan et le visage priment au montage).
  const ids = {
    lut: video.styles.lutId ?? def.lut,
    sousTitres: video.styles.sousTitresId ?? def.sousTitres,
    habillage: video.styles.habillageId ?? def.habillage,
    styleMontage: video.styles.styleMontageId ?? def.styleMontage,
    profilSon: video.styles.profilSonId ?? def.profilSon,
    decor: video.styles.decorId ?? ancienFond ?? def.decor,
  };
  const obtenir = async (id?: string) => (id ? await d.elements.obtenir(id) : null);
  const resoudre = async <V extends ValeurElement>(id?: string) => (id ? styleResolu<V>(await obtenir(id), id) : undefined);
  // UNE règle de musique, la même que l'écran Style ; jamais de musique si le format l'interdit (avocat).
  const elementsMusique = await d.elements.lister((e) => e.type === "musique");
  const musique = musiqueRetenue(format, video.styles.musiqueId, elementsMusique);
  const lut = ids.lut && ids.lut !== LUT_AUCUNE ? await obtenir(ids.lut) : null;
  return {
    lut: ids.lut
      ? {
          ...(ids.lut === LUT_AUCUNE ? { id: LUT_AUCUNE, nom: "Sans LUT" } : styleResolu<Extract<ValeurElement, { type: "lut" }>>(lut, ids.lut)),
          intensite: video.styles.intensiteLut ?? def.intensiteLut ?? 70,
          cible: video.styles.cibleLut ?? ["personnage", "illustrations", "rushs", "decor", "accessoire"],
          // Priorité plan > vidéo > visage > format (lot M4) : le moteur sait si la LUT vient de la vidéo.
          origine: video.styles.lutId ? ("video" as const) : ("format" as const),
        }
      : undefined,
    sousTitres: await resoudre(ids.sousTitres),
    habillage: await resoudre(ids.habillage),
    styleMontage: await resoudre(ids.styleMontage),
    profilSon: await resoudre(ids.profilSon),
    musique: musique ? await resoudre(musique) : format.musique === "interdite" ? null : undefined,
    decor: await resoudre(ids.decor),
  };
}

/** Plans de l'Aperçu : dérivés du script la première fois, puis conservés (choix verrouillés). */
export async function plansApercu(videoId: Id): Promise<Plan[]> {
  const d = depots();
  const video = await d.videos.obtenir(videoId);
  if (!video) throw new ErreurStudio("INTROUVABLE", "Cette vidéo n'existe plus.");
  const cle = versionBrouillon(videoId);
  const existants = (await d.plans.lister((p) => p.versionId === cle)).sort((a, b) => a.ordre - b.ordre);
  if (existants.length) return existants;
  const brut = video.scriptId ? await d.scripts.obtenir(video.scriptId) : null;
  if (!brut) return [];
  const script = scriptAJour(brut);
  const format = obtenirFormat(video.formatId);
  const encadre = format.accrocheVisuelle?.encadreOuverture;
  const plans = plansDepuisScript({
    videoId,
    versionId: cle,
    blocs: script.blocs,
    // Durée depuis le script pour un format « depuis-script » (B.0 §18).
    dureeSec: dureeVideo(format, texteScript(script.blocs), video.dureeCibleSec, await debitDeLaVoix(format, video.distribution[0]?.voixId)),
    modeIllustrations: format.illustrations.mode,
    personnageId: video.distribution[0]?.personnageId,
    maintenant: maintenant(),
    encadreOuverture: encadre ? { centrePct: encadre.centrePct } : undefined,
    coupesSeulement: !!encadre,
  });
  reporterChoixVerrouilles(plans, await d.plans.lister((p) => p.versionId.startsWith(`${cle}-archive-`) && !p.versionId.endsWith("-remplace")));
  // Mode « auto » (lot M5) : la cascade trouve SEULE l'illustration de chaque plan — Mes images, réutilisation
  // (0 €, anti-répétition), banques gratuites, sinon « à fabriquer » au moteur. Un choix verrouillé n'est jamais remplacé.
  if (format.illustrations.mode === "auto") {
    // Correcteur réel 2 : vidéo d'essai (moteur simulé) : aucune banque interrogée (rien n'est cherché pour un essai).
    const options = optionsDuFormat(format, await modeEconomique(videoId));
    await appliquerCascade(videoId, plans, (await moteurAuLancement(format.id)) === "simulation" ? { ...options, banques: false } : options);
  }
  for (const p of plans) await d.plans.enregistrer(p);
  return plans;
}

/**
 * Après une modification du texte : les images choisies et VERROUILLÉES par Will sur les anciens plans
 * (archivés) sont reportées sur les nouveaux plans du MÊME SEGMENT (identité des plans, B.2),
 * sinon de même texte, sinon de même ordre.
 */
function reporterChoixVerrouilles(nouveaux: Plan[], archives: Plan[]): void {
  if (!archives.length) return;
  const derniere = archives.map((p) => p.versionId).sort().at(-1);
  const anciens = archives.filter((p) => p.versionId === derniere && p.illustration?.verrouille);
  const pris = new Set<string>();
  for (const p of nouveaux) {
    const libre = (a: Plan) => !pris.has(a.id);
    const ancien =
      anciens.find((a) => libre(a) && !!a.segmentId && a.segmentId === p.segmentId) ??
      anciens.find((a) => libre(a) && a.texte.trim() === p.texte.trim()) ??
      anciens.find((a) => libre(a) && a.ordre === p.ordre);
    if (!ancien?.illustration) continue;
    pris.add(ancien.id);
    p.illustration = { ...ancien.illustration };
    p.sourceImage = ancien.sourceImage;
    p.vignetteFichierId = ancien.vignetteFichierId;
  }
}

/**
 * Distribution résolue (B.0 §3) : accord obligatoire et bloquant pour une personne réelle (PLAN B.4-6) ;
 * visages par angle (même tenue, même posture) ; fournisseur de la voix lu sur la VOIX, jamais sur le réglage global.
 */
async function resoudreDistributionCommande(video: Video, format: DefinitionFormat, reglages: Record<string, unknown>): Promise<DistributionResolue[]> {
  const d = depots();
  const distribution: DistributionResolue[] = [];
  const repartition = repartitionDepuisReglages(reglages);
  for (const x of video.distribution) {
    const p = x.personnageId ? await d.personnages.obtenir(x.personnageId) : null;
    if (p?.nature === "reel" && !(p.accord?.case && p.accord.documentFichierId && p.accord.date)) {
      throw new ErreurStudio("ACCORD_MANQUANT", `Il manque l'accord de ${p.nom}.`);
    }
    const voix = x.voixId ? await d.voix.obtenir(x.voixId) : null;
    if (voix) {
      // Règle de compatibilité : une voix qui ne sait pas produire un son seul est refusée (B.0 §9).
      const fv = resoudreFournisseur("voix", voix.fournisseur);
      if (!fv.capacites.audioSeul) {
        throw new ErreurStudio("VOIX_INCOMPATIBLE", `La voix « ${voix.nom} » ne peut pas servir à cette vidéo. Choisissez une autre voix dans Personnages.`);
      }
    }
    const rvo = x.voixId ? await ressourceActive(x.voixId) : null;
    const visagesPerso = x.personnageId ? await d.visages.lister((v) => v.personnageId === x.personnageId) : [];
    const principal = x.visageId ? visagesPerso.find((v) => v.id === x.visageId) : visagePourFormat(visagesPerso, p, format.id);
    let visagesResolus: DistributionResolue["visagesResolus"];
    let modeAngles: DistributionResolue["modeAngles"];
    let visagesParAngle = x.visagesParAngle;
    if (x.source === "double" && principal) {
      const r = resoudreVisagesParAngle({ visages: visagesPerso, principal, posture: video.posture, partSecond: format.recetteMontage ? repartition.second : 0, imposes: x.visagesParAngle });
      visagesParAngle = r.visagesParAngle;
      modeAngles = r.modeAngles;
      visagesResolus = {};
      for (const [angle, id] of Object.entries(r.visagesParAngle) as [keyof typeof r.visagesParAngle, string][]) {
        const v = visagesPerso.find((y) => y.id === id);
        if (!v) continue;
        const ressource = await ressourceActive(v.id);
        // Lot R7 : fournisseur et statut figés dans la commande (un moteur réel refuse le double d'essai).
        const res: VisageResolu = { visageId: v.id, idExterne: ressource?.idExterne, lutIdVisage: v.lutId, levresNote: v.qualite?.levres, origine: v.origine, tenueId: v.tenueId, posture: v.posture, fournisseur: ressource?.fournisseur ?? v.fournisseur, statut: v.statut };
        visagesResolus[angle] = res;
      }
    }
    const rv = principal ? await ressourceActive(principal.id) : null;
    distribution.push({
      ...x,
      visageId: x.visageId ?? principal?.id,
      visagesParAngle,
      repartitionAngles: x.repartitionAngles ?? (format.recetteMontage ? repartition : undefined),
      nomPersonnage: p?.nom,
      idVisageFournisseur: rv?.idExterne,
      idVoixFournisseur: rvo?.idExterne,
      reglagesVoix: voix?.reglages,
      visagesResolus,
      modeAngles,
      fournisseurVoix: voix?.fournisseur,
      typeClone: voix?.typeClone ?? (voix ? "inconnu" : undefined),
    });
  }
  return distribution;
}

/** Accessoires allumés pour la vidéo : choisis, sinon (réglage « micro ») le micro par défaut du format. */
async function accessoiresResolus(video: Video, format: DefinitionFormat, reglages: Record<string, unknown>): Promise<StyleResolu<ValeurAccessoire>[]> {
  const d = depots();
  let ids = video.styles.accessoireIds;
  if (!ids) {
    if (!reglages.micro) return [];
    const parDefaut = (await d.elements.lister((e) => e.type === "accessoire" && !e.archiveLe)).sort((a, b) => Number(b.formatsParDefaut.includes(format.id)) - Number(a.formatsParDefaut.includes(format.id)))[0];
    ids = parDefaut ? [parDefaut.id] : [];
  }
  const sortie: StyleResolu<ValeurAccessoire>[] = [];
  for (const id of ids) sortie.push(styleResolu<ValeurAccessoire>(await d.elements.obtenir(id), id));
  return sortie;
}

/**
 * Fichiers dont le montage a besoin (lot M4) : le moteur ne lit pas les dépôts, le service lui donne la clé de
 * stockage de chaque fichier utile — LUT (vidéo, format, plans, visages), décor, accessoires, illustrations et objets
 * incrustés des plans, ton de pièce, image détourée de chaque visage (`visage:<id>`).
 */
async function mediasDeLaCommande(c: Pick<CommandeFabrication, "styles" | "accessoires" | "plans" | "distribution" | "bruitagesDisponibles">): Promise<Record<Id, MediaCommande>> {
  const d = depots();
  const medias: Record<Id, MediaCommande> = {};
  const fichierEnMedia = async (cle: Id, fichierId: Id | undefined, extra: Partial<MediaCommande> = {}) => {
    if (!fichierId || medias[cle]) return;
    const f = await d.fichiers.obtenir(fichierId);
    if (f && f.statut === "pret") medias[cle] = { cle: f.cleStockage, mime: f.mime, dureeSec: f.dureeSec, ...extra };
  };
  const element = async (id: Id | undefined) => {
    if (!id || medias[id] || id === LUT_AUCUNE) return;
    const e = await d.elements.obtenir(id);
    if (!e) return;
    const v = e.valeur as { imageFichierId?: Id; tailleCube?: number };
    // « Mes images » : le moteur lit TOUJOURS la copie floutée quand elle existe (l'original n'est jamais monté).
    const fichier = e.confidentialite?.fichierFlouteId ?? e.fichierId ?? v.imageFichierId;
    await fichierEnMedia(id, fichier, e.valeur.type === "lut" ? { tailleCube: v.tailleCube } : {});
  };
  await element(c.styles.lut?.id);
  for (const p of c.plans) {
    await element(p.lutId);
    await element(p.illustration?.elementId);
    await element(p.incrustation?.elementId);
  }
  for (const dist of c.distribution) {
    for (const v of Object.values(dist.visagesResolus ?? {})) {
      if (!v) continue;
      await element(v.lutIdVisage);
      const visage = await d.visages.obtenir(v.visageId);
      await fichierEnMedia(`visage:${v.visageId}`, visage?.detoureFichierId);
    }
  }
  await element(c.styles.decor?.id);
  for (const a of c.accessoires ?? []) await element(a.id);
  await element(c.styles.profilSon?.valeur?.tonPieceId);
  // Lot « bruitages » (02/10) : les sons validés que le moteur peut poser.
  for (const b of c.bruitagesDisponibles ?? []) await element(b.elementId);
  return medias;
}

/**
 * Réglage CACHÉ (aucun écran) qui permet le lancement RÉEL du face caméra : `facecam.aligneur.reel`, coupé par défaut
 * (journal du lot B, « Activer le réel »). Allumé ET `STUDIO_ALIGNEUR_URL` posée : la chaîne vidéo réelle monte la
 * vidéo ; sinon le moteur garde son squelette et refuse le lancement (`refusAuLancement`).
 */
export const PARAM_FACECAM_REEL = "facecam.aligneur.reel";

async function entreesFacecamDuLancement(): Promise<Record<string, unknown>> {
  // Mise en ligne : allumé par défaut (le réel n'est pris que si STUDIO_ALIGNEUR_URL est posée) ; `false` en base le coupe.
  const reel = (await lireParametre<boolean>(PARAM_FACECAM_REEL, true)) === true;
  const { lireReglageDecorIa } = await import("./decor-ia");
  const decor = (await lireReglageDecorIa()).actif === true;
  // Mission H : multicaméra du face caméra (réglage caché `facecam.multicamera`, coupé par défaut).
  const { lireReglageMulticameraFormat } = await import("./multicamera");
  const multicamera = (await lireReglageMulticameraFormat("facecam")).actif === true;
  return { ...(reel ? { facecamAligneurReel: true } : {}), ...(decor ? { facecamDecorIa: true } : {}), ...(multicamera ? { facecamMulticamera: true } : {}) };
}

/** Construit la commande de fabrication versionnée (AV2.2-1, contrat v2). */
export async function construireCommande(videoId: Id, options: { simulerEchecEtape?: string; origine?: OrigineLancement } = {}): Promise<CommandeFabrication> {
  const video = await depots().videos.obtenir(videoId);
  if (!video) throw new ErreurStudio("INTROUVABLE", "Cette vidéo n'existe plus.");
  return commandeDeLaVideo(video, options);
}

/**
 * E2E-2 parcours n° 4 : la commande d'une vidéo PAS ENCORE CRÉÉE (version du générateur), pour afficher son prix avant
 * « Fabriquer les N ». Même chemin que le lancement (styles, distribution, briques, compléments du générateur), mais en
 * lecture seule : aucun plan d'Aperçu n'est écrit (la vidéo d'une version reçoit de toute façon ses plans du moteur).
 */
export async function construireCommandeEstimation(video: Video, script: Script, relu?: TexteRelu): Promise<CommandeFabrication> {
  return commandeDeLaVideo(video, { script, sansPlans: true, relu });
}

async function commandeDeLaVideo(video: Video, options: { simulerEchecEtape?: string; origine?: OrigineLancement; script?: Script; sansPlans?: boolean; relu?: TexteRelu }): Promise<CommandeFabrication> {
  const d = depots();
  const videoId = video.id;
  const format = obtenirFormat(video.formatId);
  const brut = options.script ?? (video.scriptId ? await d.scripts.obtenir(video.scriptId) : null);
  if (!brut) throw new ErreurStudio("SCRIPT_MANQUANT", "Il manque le texte de la vidéo.");
  // Un script d'une ancienne recette est migré à la lecture (aucun texte perdu, B.9 bis).
  const script = scriptAJour(brut);
  const reglages = validerReglages(format, migrerReglages(format, video.reglages, video.versionFormat));
  if (!reglages.ok) throw new ErreurStudio("REGLAGES_INVALIDES", "Un réglage n'est pas valable.");

  const distribution = await resoudreDistributionCommande(video, format, reglages.reglages);
  if (distribution.length < format.personnages.min) throw new ErreurStudio("DISTRIBUTION_INCOMPLETE", "Choisissez qui parle.");

  const briques = briquesEffectives(format, video.briquesCoupees, video.briquesAllumees);
  const plans = (options.sansPlans ? [] : await plansApercu(videoId)).map((p) => ({
    ...p,
    // Brique coupée : le moteur la saute (AV2.7).
    illustration: briques.illustrations ? p.illustration : undefined,
    sourceImage: briques.illustrations || p.sourceImage !== "illustration" ? p.sourceImage : ("double" as const),
    texteEcran: briques["texte-ecran"] ? p.texteEcran : undefined,
  }));
  const styles = await stylesResolus(video, format);
  if (!briques.etalonnage) styles.lut = null;
  if (!briques["sous-titres"]) styles.sousTitres = null;
  if (!briques.habillage) styles.habillage = null;
  // « Musique et bruitages » coupée : plus de musique, mais la voix reste mixée selon le profil de son.
  if (!briques.son) styles.musique = null;
  const budget = await lireParametre<Montant>("budget.mensuel", centimes(15000));
  // Lot R6 : calage choisi dans Réglages > Connexions, et calage de la voix de synthèse (coupé par défaut).
  const fournisseurAlignement = await lireParametre<string | null>("fournisseur.alignement", null);
  const calerVoixSynthese = (await lireParametre<boolean>("alignement.voixSynthese", false)) === true;
  const prononciations = prononciationsActives(await d.prononciations.lister(), { voixId: distribution[0]?.voixId, personnageId: distribution[0]?.personnageId });
  const texteComplet = texteScript(script.blocs);
  const accessoires = await accessoiresResolus(video, format, reglages.reglages);
  // Lot « bruitages » (02/10) : sons écoutés et validés par Will, seulement si la vidéo les veut (« discrets »).
  const bruitagesDisponibles = await bruitagesDeLaCommande(reglageIntensite(video.styles, format.profilRendu).bruitages, video.formatId);
  const medias = await mediasDeLaCommande({ styles, accessoires, plans, distribution, bruitagesDisponibles });
  // Générateur G6 (accord de Will du 03/10) : vidéo d'une version par réseau — texte assemblé de la version, texte
  // dit (prononciations appliquées une fois, liste vide), réseaux cochés, zones, encadré, mère. Sinon : rien.
  // VERIF-1 a1 : ses plans indicatifs sont les illustrations du texte assemblé, cascade appliquée (celles de l'Aperçu
  // sont reprises) ; les fichiers des illustrations trouvées rejoignent les médias de la commande.
  const generateur = video.varianteId ? await complementsGenerateur(video, { distribution, prononciations: await d.prononciations.lister(), medias, briques, plansApercu: plans, estimation: !!options.sansPlans, ...(options.relu ? { relu: options.relu } : {}), essai: (await moteurAuLancement(format.id)) === "simulation" }) : {};
  if (generateur.plans?.length) {
    generateur.medias = { ...(generateur.medias ?? medias), ...(await mediasDeLaCommande({ styles: {}, plans: generateur.plans, distribution: [] })) };
  }
  // Équipe 7 : vidéo en série → le titre de la série sur la ligne « Thème : » de l'encadré d'ouverture.
  return avecSerieALEcran(video, {
    versionContrat: 2,
    // Choisi au lancement (réglage `moteur.<format>` > variable d'environnement > format ; lot R8 : interrupteur
    // « montage réel », double prêt et tout relié) puis FIGÉ.
    moteurId: await moteurAuLancement(format.id),
    videoId,
    formatId: format.id,
    versionFormat: format.version,
    profilRenduVersion: format.profilRendu?.version ?? video.profilRenduVersion,
    // Durée calculée depuis le script dans toute la chaîne (B.0 §18).
    // TEST-UI-REEL U2 : au débit de la voix qui lira (voix HeyGen : débit réel mesuré), donc au vrai prix.
    dureeCibleSec: dureeVideo(format, texteComplet, video.dureeCibleSec, await debitDeLaVoix(format, distribution[0]?.voixId)),
    // Formats par réseau T5 : les formats de la vidéo, tels quels, RIEN n'est ajouté au lancement (un format décoché ne
    // revient jamais ; le prix, l'essai et les fichiers suivent `video.ratios`). Les formats voulus par les réseaux sont
    // posés à la CRÉATION seulement (`creerBrouillon`, « Fabriquer les N », « Fabriquer cette version »).
    ratios: video.ratios,
    script: { id: script.id, blocs: script.blocs, texteComplet },
    distribution,
    styles,
    briques,
    // Lot M5 : mode « économique » (banques seulement, rien n'est fabriqué) lu par le moteur.
    entrees: {
      ...video.entrees,
      ...((await modeEconomique(videoId)) ? { illustrationsEconomique: true } : {}),
      // Le fournisseur d'illustrations choisi dans Réglages (le moteur ne lit pas les réglages).
      ...((await lireParametre<string | null>("fournisseur.illustration", null)) ? { fournisseurIllustration: await lireParametre<string | null>("fournisseur.illustration", null) } : {}),
      // Lot R6 : le calage choisi dans Réglages > Connexions, et s'il faut aussi caler la voix de synthèse (coupé par
      // défaut : mesure D3, la voix HeyGen est plus juste sans). Figés au lancement, comme le reste.
      ...(fournisseurAlignement ? { fournisseurAlignement } : {}),
      ...(calerVoixSynthese ? { calerVoixSynthese: true } : {}),
      // Facecam lot E : réglages figés au lancement (le moteur ne lit pas les réglages), face caméra seulement.
      ...(format.id === "facecam" ? await entreesFacecamDuLancement() : {}),
      // V6 P0 n° 4 : le look gardé (crans, teinte, référence de la peau et du mur) s'applique à chaque nouvelle vidéo.
      ...(format.id === "facecam" ? entreesDuLook(video.entrees, await (await import("./monteur-facecam")).lookGarde()) : {}),
      // Mission H : réglages cachés de l'avocat figés au lancement (tous coupés par défaut : rien n'est ajouté).
      ...(format.id === "avocat" ? await entreesAvocatDuLancement(video) : {}),
      // 14/10 : contrôle de ressemblance à la voix de référence (réglage `voix.ressemblance`, actif par défaut) figé au
      // lancement : le prix (lectures au plus) et la chaîne lisent le même. Avocat (décision de Will du 14/10) : maquette
      // ET montage final.
      ...(format.id === "tableau-anime" || format.id === "cas-concret" || format.id === "avocat" ? { [ENTREE_RESSEMBLANCE_VOIX]: await reglageRessemblanceVoix() } : {}),
    },
    reglages: reglages.reglages,
    plans: plans.map((p) => ({
      id: p.id,
      ordre: p.ordre,
      debutSec: p.debutSec,
      finSec: p.finSec,
      texte: p.texte,
      sourceImage: p.sourceImage,
      illustration: p.illustration,
      texteEcran: p.texteEcran,
      angle: p.angle,
      cadrage: p.cadrage,
      motsEnValeur: p.motsEnValeur,
      segmentId: p.segmentId,
      lutId: p.lutId,
      incrustation: p.incrustation,
      motAncre: p.motAncre,
      // Lot « bruitages » (02/10) : « retirer le son » / « ajouter un son » choisi sur ce plan.
      ...(p.bruitage ? { bruitage: p.bruitage } : {}),
    })),
    prononciations,
    // Lot R7e : « Votre avatar parle dans le studio » (éteint par défaut), figé dans la commande.
    renduDouble: await lireRenduDouble(),
    // La mention suit la brique et le réglage, sans forçage (décision de Will du 01/10).
    mentionIA: { ...video.mentionIA, incrustee: briques["mention-ia"] },
    budgetMax: budget,
    adresse: video.adresse ?? script.adresse,
    posture: video.posture,
    accessoires,
    profilRealisme: format.profilRendu?.realisme,
    profilRendu: format.profilRendu,
    recetteMontage: format.recetteMontage,
    tauxUsdEur: await lireParametre<number>("taux.usdEur", TAUX_USD_EUR_PAR_DEFAUT),
    simulerEchecEtape: options.simulerEchecEtape,
    // Plan facecam v4 (lot D, ajout pur) : plafond Claude du mois lu à la construction, pour le face caméra seulement
    // (version simple sans aucun appel Claude). Les autres formats ne reçoivent pas ce champ.
    ...(format.id === "facecam" ? { plafondClaudeAtteint: await plafondClaudeDuMoisAtteint(options.origine) } : {}),
    construiteLe: maintenant(),
    // Lot M2 : base et intensité des sous-titres (choix de la vidéo > profil du format > style de base). Depuis le lot
    // « intensité » (02/10), l'intensité des sous-titres EST le réglage global de la vidéo (mêmes valeurs qu'avant
    // tant que rien de nouveau n'est choisi).
    sousTitres: {
      base: baseRetenue(video.styles.sousTitresBase ?? format.profilRendu?.sousTitresBase, styles.sousTitres?.valeur),
      intensite: reglageIntensite(video.styles, format.profilRendu).niveau,
    },
    // Lot « intensité · bruitages » (02/10) : réglage global et bruitages, figés au lancement.
    intensite: reglageIntensite(video.styles, format.profilRendu),
    ...(bruitagesDisponibles.length ? { bruitagesDisponibles } : {}),
    medias,
    ...generateur,
  });
}

/**
 * Sous-titres du LANCEMENT (lot M2) : nouveau groupement sur les plans de la version (horodatage réparti par plan,
 * remplacé par l'horodatage réel quand le moteur le renvoie), calé sur les coupes, mélange des styles.
 * Les groupes verrouillés de la version précédente sont reportés.
 */
export function sousTitresDuLancement(plans: Plan[], commande: Pick<CommandeFabrication, "styles" | "sousTitres" | "formatId">, entree: { titre: string; anciens?: SegmentSousTitres[] }): SegmentSousTitres[] {
  const tries = [...plans].sort((a, b) => a.ordre - b.ordre);
  const mots = tries.flatMap((p) => {
    const liste = motsSousTitres(p.texte);
    const pas = (p.finSec - p.debutSec) / Math.max(liste.length, 1);
    return liste.map((mot, k) => ({ mot, debutSec: +(p.debutSec + k * pas).toFixed(3), finSec: +(p.debutSec + (k + 1) * pas).toFixed(3) }));
  });
  const reseaux = obtenirFormat(commande.formatId).reseauxConseilles;
  return fabriquerSousTitres({
    texte: mots.map((m) => m.mot).join(" "),
    dureeSec: tries.at(-1)?.finSec ?? 0,
    mots,
    emphase: tries.flatMap((p) => p.motsEnValeur),
    style: commande.styles.sousTitres?.valeur,
    base: commande.sousTitres?.base,
    intensite: commande.sousTitres?.intensite,
    coupesSec: tries.slice(1).map((p) => p.debutSec),
    reseaux,
    motsTitre: entree.titre.split(/\s+/),
    anciens: entree.anciens,
  });
}

/** TEST-UI-REEL U2 (CORRECTEUR FINAL A) : débit de lecture de la voix choisie (voir `debitLecture`). */
export async function debitDeLaVoix(format: Pick<DefinitionFormat, "recetteScript">, voixId: Id | undefined): Promise<number> {
  return debitLecture(format, voixId ? await depots().voix.obtenir(voixId) : null);
}

/** Lot M5 : l'origine de l'illustration de chaque plan et ce qu'elle coûte (« réutilisé 0 € » / « à fabriquer »). */
export interface IllustrationsApercu {
  parPlan: Record<Id, { origine: OrigineCascade; ia: boolean; licence?: string }>;
  resume: ReturnType<typeof resumeCoutIllustrations>;
  economique: boolean;
}

export interface ApercuFabrication {
  plans: VuePlan[];
  /** Lot M5 (ajout pur) : cascade des illustrations. */
  illustrations?: IllustrationsApercu;
  estimation: Estimation;
  budget: { restant: Montant; depasse: boolean; /** Mode indicatif (`budget.mode`) : `depasse` reste faux, le dépassement est un repère ambre (`depasseIndicatif`). */ indicatif: boolean; depasseIndicatif: boolean; /** Vérif A2 : ce que le serveur compare au seuil et au budget restant (lignes facultatives retirées). */ bloquant: Montant; confirmationRequise: boolean; seuil: Montant; /** Lot R7 : part du double réel (confirmation toujours exigée). */ double: Montant | null; /** Lot R8 : vidéo montée pour de vrai par l'interrupteur (prix confirmé à chaque lancement). */ montageReel: boolean };
  /** Étapes qui seront exécutées (affichage « Voix → Double → … »). */
  etapes: { cle: string; nom: string; icone: string }[];
  /** Lot R2 : part des textes des réseaux écrits par Claude à la fin (comptée dans le total) ; absente sinon. */
  textesReseaux?: Montant;
  /** CORRECTEUR FINAL A (VERIF-E2E-1 n° 2) : la phrase du refus que « Fabriquer » recevrait, dite dès l'Aperçu. */
  refus?: string;
  /**
   * TEST-UI-REEL U6 (CORRECTEUR UI2) : vidéo d'essai où RIEN n'est payé (moteur d'essai, ni montage réel ni double
   * réel, aucune ligne réelle payante). Le bouton dit « Essai gratuit » ; l'estimation reste le prix « en vrai ».
   */
  essaiGratuit: boolean;
}

/** Données de l'étape Aperçu : plans visuels, coût en gros chiffre, durée estimée (AV2.4-6). */
export async function apercuFabrication(videoId: Id): Promise<ApercuFabrication> {
  // Correcteur réel 2 : le prix affiché est celui du lancement (voix et avatar déjà payés : non comptés).
  const commande = await avecReutilisations(await construireCommande(videoId));
  const moteur = moteurDeCommande(commande);
  const { textesReseaux, ...estimation } = await avecTextesDesReseaux(videoId, await moteur.estimer(commande), commande);
  const d = depots();
  const plans = (await d.plans.lister((p) => p.versionId === versionBrouillon(videoId))).sort((a, b) => a.ordre - b.ordre);
  const elements = await d.elements.lister((e) => plans.some((p) => p.illustration?.elementId === e.id));
  const urls = await urlsFichiers([...plans.map((p) => p.vignetteFichierId), ...elements.map((e) => e.vignetteFichierId)]);
  const b = await resumeBudget();
  // Lot R2 : les textes des réseaux (ligne facultative) ne bloquent jamais le lancement.
  const bloquant = centimesBloquants(estimation);
  const restantApres = b.restant.centimes - bloquant;
  const indicatif = await budgetIndicatif();
  const economique = await modeEconomique(videoId);
  const montageReel = await montageReelDeLaCommande(commande);
  const refus = await refusSimulationEnProduction(commande, estimation.lignes);
  const decisions: DecisionIllustration[] = [];
  const parPlan: IllustrationsApercu["parPlan"] = {};
  for (const p of plans) {
    const el = elements.find((e) => e.id === p.illustration?.elementId);
    const origine = origineDuPlan(p, el);
    if (!origine) continue;
    decisions.push({ planId: p.id, origine, elementId: el?.id });
    parPlan[p.id] = { origine, ia: !!el?.fabrique || el?.origine === "fabriquee", licence: el?.licence.source };
  }
  return {
    illustrations: { parPlan, resume: resumeCoutIllustrations(decisions, commande.tauxUsdEur ?? TAUX_USD_EUR_PAR_DEFAUT, economique), economique },
    plans: plans.map((p) => {
      const el = elements.find((e) => e.id === p.illustration?.elementId);
      return { ...p, vignette: p.vignetteFichierId ? (urls[p.vignetteFichierId] ?? null) : null, illustrationVignette: el?.vignetteFichierId ? (urls[el.vignetteFichierId] ?? null) : null, illustrationNom: el?.nom };
    }),
    estimation,
    // Lot R7 : le double réel exige toujours la confirmation de son prix (même règle que `verifierBudgetEtCredits`).
    // Lot R8 : une vidéo montée pour de vrai par l'interrupteur montre et fait confirmer son prix à chaque lancement.
    budget: { restant: b.restant, depasse: restantApres < 0 && !indicatif, indicatif, depasseIndicatif: restantApres < 0 && indicatif, bloquant: { centimes: bloquant, devise: "EUR" }, confirmationRequise: bloquant > b.seuilConfirmation.centimes || !!partDoubleReel(estimation.lignes) || montageReel, seuil: b.seuilConfirmation, double: partDoubleReel(estimation.lignes), montageReel },
    etapes: moteur.etapes(commande).map((e) => ({ cle: e.cle, nom: e.nom, icone: e.icone })),
    essaiGratuit: commandeEnEssai(commande) && !montageReel && !partDoubleReel(estimation.lignes) && estimation.lignes.every((l) => ligneSimulee(l) || l.total.centimes <= 0),
    ...(textesReseaux ? { textesReseaux } : {}),
    ...(refus ? { refus } : {}),
  };
}

/** Lot R8 : la commande est-elle montée pour de vrai PAR L'INTERRUPTEUR « montage réel » (et non par le format) ? */
async function montageReelDeLaCommande(commande: CommandeFabrication): Promise<boolean> {
  const d = await decisionMontageReel(commande.formatId);
  return d.effectif && commande.moteurId === d.moteurId;
}

/** Lot R2 : la ligne « Textes des réseaux » (Claude, à la fin de la fabrication) rejoint l'estimation annoncée. */
async function avecTextesDesReseaux(videoId: Id, estimation: Estimation, commande: Pick<CommandeFabrication, "moteurId" | "formatId">): Promise<Estimation & { textesReseaux?: Montant }> {
  const { avecTextesDesReseaux: ajouter } = await import("./publications");
  // CORRECTEUR FINAL A : pas de textes Claude (payés) pour une vidéo d'essai.
  return ajouter(videoId, estimation, { essai: commandeEnEssai(commande) });
}

/**
 * Piste `audio-maitre` déjà fabriquée pour cette vidéo (par une maquette ou une fabrication) et dont l'empreinte est
 * celle de la commande : même texte, même voix, mêmes prononciations. Elle est transmise au moteur, qui la réutilise
 * sans la repayer (B.0 §19, lot M1). Sinon : rien, la voix sera refaite.
 */
async function audioMaitreReutilisable(commande: CommandeFabrication): Promise<CommandeFabrication["audioMaitre"]> {
  const d = depots();
  const empreinte = empreinteAudioMaitre(commande);
  const versions = new Set((await d.versions.lister((v) => v.videoId === commande.videoId)).map((v) => v.id));
  const pistes = (await d.pistes.lister((p) => p.type === "audio-maitre" && p.empreinte === empreinte && versions.has(p.versionId) && !!p.fichierId)).sort((a, b) => b.creeLe.localeCompare(a.creeLe));
  for (const p of pistes) {
    const f = await d.fichiers.obtenir(p.fichierId!);
    if (!f || f.statut !== "pret") continue;
    // Correcteur R6 : la cause d'approximation suit l'audio maître (sinon la vidéo réutilisée perdait son alerte).
    return { fichierCle: f.cleStockage, empreinte, mots: p.mots ?? [], dureeSec: f.dureeSec ?? p.mots?.at(-1)?.finSec ?? 0, ...(p.sousTitresApproximatifs ? { sousTitresApproximatifs: p.sousTitresApproximatifs } : {}) };
  }
  return undefined;
}

/**
 * Correcteur réel 2 (04/10) : rendus du double déjà PAYÉS par une fabrication terminée de cette vidéo, sur le même
 * audio maître (même empreinte, même fichier). Le moteur les reprend sans rien renvoyer au fournisseur si les looks et
 * le fond n'ont pas changé : « refaire le montage » (même texte, même voix) ne repaie pas l'avatar.
 */
async function doubleDejaRendu(commande: CommandeFabrication): Promise<CommandeFabrication["doubleDejaRendu"]> {
  if (!commande.audioMaitre) return undefined;
  return doubleDejaRenduDepuis(await depots().travaux.lister((t) => t.cibleId === commande.videoId && t.statut === "termine"), commande.audioMaitre);
}

/** Ce qui est déjà payé et se réutilise : la voix (audio maître), puis les rendus du double faits sur elle. */
async function avecReutilisations(commande: CommandeFabrication): Promise<CommandeFabrication> {
  commande.audioMaitre = await audioMaitreReutilisable(commande);
  const double = await doubleDejaRendu(commande);
  if (double) commande.doubleDejaRendu = double;
  return commande;
}

/**
 * Numéro de la prochaine version DE LA VIDÉO (affiché « V{n} ») : le plus haut numéro + 1, pas le nombre de versions
 * (une version retirée ne fait pas reprendre un numéro). Les maquettes ne comptent pas (ce ne sont pas des versions).
 */
export async function prochainNumero(videoId: Id): Promise<number> {
  const siennes = await depots().versions.lister((v) => v.videoId === videoId && v.statut !== "maquette");
  return siennes.reduce((m, v) => Math.max(m, v.numero), 0) + 1;
}

/**
 * Plages des numéros du lien suivi (`utm_campaign`), un compteur chacune dans la base : réel 1 à 8999, démonstration
 * 9000 à 9998. 9999 reste réservé à `NUMERO_VERSION_LANCEUR` (scripts/image-video/fabriquer.ts), plafond de
 * `codeVersionIV` (moteurs/montage-cas-concret/fins.ts).
 */
export const PLAGES_NUMERO_SUIVI = {
  reel: { cle: "numero-suivi-reel", min: 1, max: NUMERO_DEMO_MIN - 1 },
  demo: { cle: "numero-suivi-demo", min: NUMERO_DEMO_MIN, max: 9998 },
} as const;

/**
 * Réserve le numéro du lien suivi d'une version, UNIQUE dans tout le studio : un compteur de la base (une requête
 * atomique, jamais redescendant, au-dessus des versions déjà écrites), donc sûr entre plusieurs conteneurs. Plage
 * épuisée : refus clair, rien n'est créé. Un numéro réservé puis non utilisé est perdu (un trou, jamais un doublon).
 */
export async function reserverNumeroSuivi(estDemo: boolean): Promise<number> {
  const plage = estDemo ? PLAGES_NUMERO_SUIVI.demo : PLAGES_NUMERO_SUIVI.reel;
  const n = await prochainNumeroSuivi(plage.cle, plage.min, plage.max);
  if (!Number.isInteger(n) || n < plage.min || n > plage.max) {
    throw new ErreurStudio("NUMEROS_SUIVI_EPUISES", "Plus aucun numéro de lien suivi libre (réel : 1 à 8999 / démonstration : 9000 à 9998). Rien n'a été créé.");
  }
  return n;
}

/** Réserve un numéro de lien suivi puis le confie à `enregistrer` (qui écrit la version). */
export async function attribuerNumeroSuivi(estDemo: boolean, enregistrer: (numeroSuivi: number) => Promise<void>): Promise<number> {
  const n = await reserverNumeroSuivi(estDemo);
  await enregistrer(n);
  return n;
}

/* ------------------------------------------------------------------ */
/* Un seul geste payant à la fois par vidéo (E2E-2 argent n° 3 et n° 4) */
/* ------------------------------------------------------------------ */

const cleVerrousVideo = Symbol.for("studio-axion-ia.verrous-video");
type AvecVerrousVideo = typeof globalThis & { [cleVerrousVideo]?: Map<Id, Promise<unknown>> };

/**
 * Exécute `f` seul pour CETTE vidéo (file d'attente par vidéo) : lancement, maquette, retouche et format ajouté de la
 * même vidéo passent l'un après l'autre. Le contrôle « déjà en cours » et l'enregistrement du travail se font donc d'un
 * seul tenant : deux onglets, deux Accueils ou un double envoi ne créent jamais deux travaux ni deux réservations, et
 * « Fabriquer » pendant une maquette attend sa fin puis reprend sa voix (jamais payée deux fois). Les autres vidéos ne
 * sont pas bloquées.
 */
export async function sousVerrouVideo<T>(videoId: Id, f: () => Promise<T>): Promise<T> {
  const g = globalThis as AvecVerrousVideo;
  const verrous = (g[cleVerrousVideo] ??= new Map());
  const avant = verrous.get(videoId) ?? Promise.resolve();
  const suite = avant.catch(() => undefined).then(f);
  const garde: Promise<unknown> = suite.catch(() => undefined);
  verrous.set(videoId, garde);
  void garde.then(() => {
    if (verrous.get(videoId) === garde) verrous.delete(videoId);
  });
  return suite;
}

/** Un geste payant (lancement, maquette…) est-il en cours pour cette vidéo dans ce processus ? */
export function gesteEnCours(videoId: Id): boolean {
  return (globalThis as AvecVerrousVideo)[cleVerrousVideo]?.has(videoId) ?? false;
}

/**
 * CORRECTEUR 1 — B11 : en PRODUCTION, une fabrication qui paie quelque chose (une ligne d'un vrai fournisseur) ne part
 * jamais si un maillon nécessaire est encore en simulation : sinon la voix ou les images seraient payées pour sortir
 * une vidéo de démonstration (ou une voix, un double d'essai dans une vraie vidéo). Renvoie la phrase du refus, ou null.
 * Hors production : rien ne change (essais). Aucun appel réseau.
 */
export async function refusSimulationEnProduction(commande: Pick<CommandeFabrication, "moteurId" | "formatId">, lignes: LigneCout[], env: Record<string, string | undefined> = process.env): Promise<string | null> {
  if (env.NODE_ENV !== "production") return null;
  if (!lignes.some((l) => !ligneSimulee(l))) return null;
  const manquants: string[] = [];
  const moteur = idMoteurDeCommande(commande);
  // CORRECTEUR FINAL A (VERIF-E2E-1 n° 2) : le format sait être monté pour de vrai, mais les interrupteurs ne l'ont pas
  // permis. Les outils sont reliés : le geste à faire est d'allumer les interrupteurs (jamais « Reliez ces outils »).
  if (moteur === "simulation" && moteurMontageReel(commande.formatId)) {
    const voix = (await fournisseurSimule("voix")) ? "" : lignes.some((l) => cleEtapeDeLigne(l.etape) === "voix" && ligneSimulee(l)) ? ` ${consigneVoixPersonnage}` : "";
    return `Cette vidéo ne peut pas partir : elle serait montée en essai, avec une vidéo de démonstration. Rien n'a été payé. ${await gesteMontageReel(commande.formatId)}${voix}`;
  }
  if (moteur === "simulation" || (moteur === "montage-avocat" && renduSimule(env))) manquants.push("le montage de la vidéo");
  if (await fournisseurSimule("stockage")) manquants.push("le stockage des fichiers");
  const simulee = (cle: string, payante = false) => lignes.some((l) => cleEtapeDeLigne(l.etape) === cle && ligneSimulee(l) && (!payante || l.total.centimes > 0));
  // Intégration paquet 4 (garde voix d'essai du correcteur 4) : une ligne de voix simulée alors que la voix est reliée
  // dans Réglages > Connexions vient de la voix du PERSONNAGE (voix d'essai) : c'est dans Personnages qu'on la relie.
  // Les deux gardes donnent alors le même geste à Will, jamais deux consignes contraires.
  let voixDuPersonnage = false;
  if (simulee("voix")) {
    if (await fournisseurSimule("voix")) manquants.push("la voix");
    else voixDuPersonnage = true;
  }
  if (simulee("visage")) manquants.push("le double");
  if (simulee("illustrations", true)) manquants.push("les illustrations");
  if (!manquants.length) return voixDuPersonnage ? `Cette vidéo ne peut pas partir : la voix choisie est une voix d'essai. Rien n'a été payé. ${consigneVoixPersonnage}` : null;
  const liste = manquants.length === 1 ? manquants[0] : `${manquants.slice(0, -1).join(", ")} et ${manquants.at(-1)}`;
  return `Cette vidéo ne peut pas partir : ${liste} ${manquants.length > 1 ? "sont encore en essai" : "est encore en essai"}. Rien n'a été payé. Reliez ${manquants.length > 1 ? "ces outils" : "cet outil"} dans Réglages > Connexions.${voixDuPersonnage ? ` ${consigneVoixPersonnage}` : ""}`;
}

/**
 * CORRECTEUR FINAL A : le geste qui fait monter une vidéo de ce format pour de vrai, en mots simples (outils à relier,
 * double à choisir, ou interrupteurs à allumer), et le chemin d'attente « Ma vidéo HeyGen ».
 */
export async function gesteMontageReel(formatId: string): Promise<string> {
  const d = await decisionMontageReel(formatId);
  if (d.manque) return `Reliez d'abord ${d.manque} dans Réglages › Connexions. En attendant : « Ma vidéo HeyGen » sur la version.`;
  const format = trouverFormat(formatId);
  const nom = format ? nomCourtFormat(format) : formatId;
  const interrupteurs = `« Votre avatar parle dans le studio » puis « Montage réel des vidéos ${nom} » (Réglages › Connexions)`;
  const enAttendant = "En attendant : « Ma vidéo HeyGen » sur la version.";
  if (d.doublePasPret === DOUBLE_PAS_CHOISI) return `Choisissez d'abord votre double dans Personnages (« Votre double HeyGen »), puis allumez ${interrupteurs}. ${enAttendant}`;
  return `Allumez ${interrupteurs}. ${enAttendant}`;
}

/** Options d'un lancement. */
export interface OptionsLancement {
  confirme?: AccordPrix;
  simulerEchecEtape?: string;
  /**
   * Correcteur R8 n° 1 : confirmation donnée PLUS TÔT (vidéo « lancer dès que possible », version qui attendait sa
   * mère) et le moteur alors annoncé à Will. Une vidéo montée pour de vrai ne part que si c'est CE moteur-là qui a été
   * confirmé ; sinon (confirmée en essai, ou ancienne attente qui n'en dit rien) : `CONFIRMATION_REQUISE`.
   */
  confirmationDifferee?: { moteurId?: string };
  /** L3-01 : d'où vient le lancement (absente : Will). Figée dans la commande ; « usine » exige le budget de l'Usine. */
  origine?: OrigineLancement;
  /**
   * Relire le script (brique 6) : empreinte du texte relu (`empreinteDesBlocs`). Exigée seulement quand
   * `exigerScriptRelu` (lancements de l'assistant « Votre vidéo », et vidéo en attente de crédit qui en avait une) ;
   * les autres lancements (formats, lots par réseau, reprise image → vidéo) n'en ont pas et restent inchangés.
   */
  scriptRelu?: string;
  exigerScriptRelu?: boolean;
}

/**
 * Lance la fabrication. Refuse si le budget du mois serait dépassé ; au-delà du seuil,
 * exige la confirmation de l'écran (`confirme`, feuille de confirmation, AV2.2-9).
 */
export async function lancerFabrication(videoId: Id, options: OptionsLancement = {}): Promise<{ travailId: Id; versionId: Id }> {
  await exigerSession();
  return lancerFabricationConfirmee(videoId, options);
}

/**
 * Relire le script (brique 6) : un lancement depuis l'assistant exige le repère « script relu » quand le format passe
 * par l'écran « Votre vidéo » ET qu'une voix de synthèse dit le texte (`relectureAExiger`). Seule une vidéo réellement
 * filmée n'exige rien (face caméra). Ce lancement ne joint jamais de prises (`prises` : parcours tournage seul,
 * `fabrication-reseaux`) : un avocat en « rush » y est dit par la voix de synthèse (`estPrisesFilmees` faux), relecture
 * exigée. Le parcours classique (Aperçu) des autres formats n'a pas encore sa relecture.
 */
export async function relectureExigee(videoId: Id): Promise<boolean> {
  const video = await depots().videos.obtenir(videoId);
  const format = video ? trouverFormat(video.formatId) : undefined;
  return !!video && !!format && relectureAExiger(format, video.distribution, false);
}

/**
 * Générateur G6 : même lancement, SANS session, pour la suite d'un geste déjà confirmé par Will (« Fabriquer les N » :
 * les versions par réseau partent dès que leur mère est prête, depuis la boucle de fond). Le budget et les crédits
 * sont vérifiés de la même façon (`verifierBudgetEtCredits`), avant tout appel payant.
 */
export async function lancerFabricationConfirmee(videoId: Id, options: OptionsLancement = {}): Promise<{ travailId: Id; versionId: Id }> {
  // E2E-2 argent n° 3 : « déjà en cours ? » puis enregistrement du travail, d'un seul tenant pour cette vidéo.
  return sousVerrouVideo(videoId, () => lancerSousVerrou(videoId, options));
}

async function lancerSousVerrou(videoId: Id, options: OptionsLancement): Promise<{ travailId: Id; versionId: Id }> {
  const d = depots();
  const video = await d.videos.obtenir(videoId);
  if (!video) throw new ErreurStudio("INTROUVABLE", "Cette vidéo n'existe plus.");
  const deja = await d.travaux.trouver((t) => t.cibleId === videoId && (t.statut === "en_cours" || t.statut === "en_file"));
  if (deja) return { travailId: deja.id, versionId: deja.versionId ?? "" };
  // Brique 6 : le texte fabriqué est celui que Will a relu (une lettre changée depuis : refus, avant toute dépense).
  if (options.exigerScriptRelu) {
    const brut = video.scriptId ? await d.scripts.obtenir(video.scriptId) : null;
    const script = brut ? scriptAJour(brut) : null;
    if (!options.scriptRelu || !script || empreinteDesBlocs(script.blocs) !== options.scriptRelu) throw new ErreurStudio("SCRIPT_NON_RELU", "Le script a changé depuis votre relecture : relisez-le avant de lancer la vidéo.");
  }

  // Défense en profondeur : un cas concret déjà traité par une AUTRE vidéo ne part jamais (refus avant toute réservation).
  if (video.formatId === "cas-concret" && !video.estDemo && !video.sourceVideoId && !video.typeDerive) {
    const { PHRASE_CAS_TRAITE } = await import("@/domaine/cas-traites");
    const phrase = await (await import("./cas-concret-traites")).refusCasDejaTraite(video.entrees, videoId, PHRASE_CAS_TRAITE);
    if (phrase) throw new ErreurStudio("CAS_TRAITE", phrase);
    // Défense en profondeur : un cas retiré par Will ne part pas non plus (refus avant toute réservation).
    const { PHRASE_CAS_RETIRE } = await import("@/domaine/cas-retires");
    const retire = await (await import("./cas-concret-retires")).refusCasRetire(video.entrees, PHRASE_CAS_RETIRE);
    if (retire) throw new ErreurStudio("CAS_RETIRE", retire);
  }
  const commande = await construireCommande(videoId, { simulerEchecEtape: options.simulerEchecEtape, ...(options.origine ? { origine: options.origine } : {}) });
  // La voix déjà fabriquée par la maquette (même texte, même voix) est transmise : elle ne sera pas repayée ; le double
  // déjà rendu sur cette voix non plus (correcteur réel 2).
  await avecReutilisations(commande);
  const moteur = moteurDeCommande(commande);
  // Lot R7d : un montage réel ne part jamais avec le double d'essai (refus clair, avant toute réservation).
  const refus = moteur.refusAuLancement?.(commande);
  if (refus) throw new ErreurStudio(refus.code, refus.message);
  // Lot R2 : les textes des réseaux (Claude, à la fin) sont comptés dans le total engagé, sans jamais bloquer le lancement.
  const { textesReseaux: _textes, ...estimation } = await avecTextesDesReseaux(videoId, await moteur.estimer(commande), commande);
  void _textes;
  // CORRECTEUR 1 — B11 : jamais de dépense réelle pour une sortie de démonstration en production (avant toute réservation).
  const refusEssai = await refusSimulationEnProduction(commande, estimation.lignes);
  if (refusEssai) throw new ErreurStudio("SIMULATION_EN_PRODUCTION", refusEssai);
  // Lot R8 — GARDE-FOU : une vidéo montée pour de vrai par l'interrupteur ne part jamais sans que Will ait vu et
  // confirmé SON prix (feuille « Montage réel » de l'Aperçu), quel que soit le seuil.
  if (await montageReelDeLaCommande(commande)) {
    // Paquet 4 (D2) : l'accord porte le montant vu ; un prix du jour plus haut redemande l'accord.
    // Seconde relecture (R2) : au-delà du seuil, seul le MONTANT vu couvre ce prix (`true` ne suffit plus).
    // Règle « le prix ne bloque jamais » : en mode indicatif (commande de l'utilisateur), le prix du jour vaut accord.
    const accordMontage = await accordAutomatique(accordPropre(options.confirme), estimation.total.centimes, { origine: options.origine });
    if (!accordCouvre(accordMontage, estimation.total.centimes, (await resumeBudget()).seuilConfirmation.centimes)) throw new ErreurStudio("CONFIRMATION_REQUISE", `Cette vidéo sera montée pour de vrai : ${formaterMontant(estimation.total)}. Confirmez pour continuer.`, estimation.total.centimes);
    // Correcteur R8 n° 1 : un accord donné plus tôt pour un autre moteur (l'essai) ne vaut pas pour le montage réel.
    if (options.confirmationDifferee && options.confirmationDifferee.moteurId !== commande.moteurId && !(await budgetIndicatifPour(options.origine))) {
      throw new ErreurStudio("CONFIRMATION_REQUISE", `Cette vidéo sera maintenant montée pour de vrai : ${formaterMontant(estimation.total)}. Ouvrez-la pour voir ce prix et confirmer.`, estimation.total.centimes);
    }
  }
  const travailId = nouvelId("trav");
  // E2E-1 n° 6 : contrôle et réservation d'un seul tenant (deux lancements simultanés ne passent pas ensemble).
  // Plan facecam v4 (lot A) : format sans prix, accord donné d'office (le prix est nul, rien n'est montré).
  // L3-01 : l'origine est FIGÉE dans la commande (retouches, formats et relances la relisent) ; « usine » → `reserverPourUsine`.
  if (options.origine) commande.origine = options.origine;
  await verifierEtReserverSelonOrigine(commande.origine, estimation, accordDuFormat(commande.formatId, options.confirme), "Cette vidéo", { videoId, travailId });
  try {
    return await creerFabrication(video, commande, moteur, estimation, travailId);
  } catch (e) {
    await libererReservation(travailId, "liberee");
    throw e;
  }
}

/** L0a : format dont le moteur rend lui-même les sous-titres du texte dit (aucun sous-titre « de lancement »). */
const FORMAT_SOUS_TITRES_DU_MOTEUR = "cas-concret";

/** Suite du lancement, une fois le crédit réservé : version, sous-titres, travail. */
async function creerFabrication(video: Video, commande: CommandeFabrication, moteur: MoteurVideo, estimation: Estimation, travailId: Id): Promise<{ travailId: Id; versionId: Id }> {
  const d = depots();
  const videoId = video.id;
  // Numéro du lien suivi réservé AVANT toute écriture : plage épuisée → refus, aucun plan orphelin.
  const numeroSuivi = await reserverNumeroSuivi(!!video.estDemo);
  const versions = await d.versions.lister((v) => v.videoId === videoId && v.statut !== "maquette");
  const numero = await prochainNumero(videoId);
  const versionId = nouvelId("ver");
  // Les plans de l'Aperçu deviennent ceux de la version (copie : les choix verrouillés suivent).
  for (const p of commande.plans) {
    const original = await d.plans.obtenir(p.id);
    if (original) await d.plans.enregistrer({ ...original, id: `${versionId}-plan-${original.ordre}`, versionId });
  }
  commande.plans = commande.plans.map((p) => ({ ...p, id: `${versionId}-plan-${p.ordre}` }));
  const version: VersionVideo = {
    id: versionId,
    videoId,
    numero,
    parentVersionId: versions.sort((a, b) => a.numero - b.numero)[versions.length - 1]?.id,
    commande,
    statut: "en_fabrication",
    travailId,
    choisie: false,
    ...horodatage(),
  };
  await d.versions.enregistrer({ ...version, numeroSuivi });
  const plansVersion = await d.plans.lister((p) => p.versionId === versionId);
  // Sous-titres du lancement (lot M2) ; les choix verrouillés par Will sur la version précédente sont gardés.
  // L0a (15/10) : pas pour le « Cas concret MD » : son moteur rend les sous-titres du texte réellement dit, calés sur la
  // voix ; ceux tirés du brouillon (minutage réparti à la louche) montraient un faux texte pendant toute la fabrication.
  if (commande.formatId !== FORMAT_SOUS_TITRES_DU_MOTEUR) {
    const precedente = version.parentVersionId ? await sousTitresCourants(version.parentVersionId) : null;
    const segments = sousTitresDuLancement(plansVersion, commande, { titre: video.titre, anciens: precedente?.segments });
    await d.sousTitres.enregistrer({ id: nouvelId("st"), videoId, versionId, langue: video.langue, version: 1, segments, styleId: commande.styles.sousTitres?.id, ...horodatage() });
  }
  const travail = await moteur.lancer(commande, { travailId, versionId, titre: video.titre });
  await d.travaux.enregistrer({ ...travail, estDemo: video.estDemo });
  // Lot « crédits » (02/10) : l'estimation est réservée (avant, sous le verrou des crédits) pendant la fabrication,
  // libérée à la fin par services/travaux.ts.
  // Lot M5 : rang de la vidéo (anti-répétition à 10 vidéos) et illustrations marquées utilisées.
  const rang = await fixerRangDeLaVideo(videoId);
  await marquerUtilisations(videoId, commande.plans.map((p) => p.illustration?.elementId), rang);
  await d.videos.modifier(videoId, { statut: "en_file", coutEstime: estimation.total, etapeAssistant: "fabrication", versionFormat: commande.versionFormat, dureeCibleSec: commande.dureeCibleSec });
  if (video.scriptId) await d.scripts.modifier(video.scriptId, { statutEditorial: "valide" });
  await journaliser("fabrication", `Fabrication lancée : « ${video.titre} »`, { type: "video", id: videoId });
  return { travailId, versionId };
}

/**
 * Maquette rapide avant la fabrication coûteuse (AV2.3-10, B.0 §19, B.1) : le budget est vérifié AVANT de payer la voix,
 * puis une version au statut « maquette » (jamais choisie, jamais numérotée) reçoit ce que le moteur a produit : plans
 * exacts, sous-titres horodatés, piste `audio-maitre` (réutilisée ensuite par la fabrication, pas repayée).
 * La maquette avocat ne produit AUCUN fichier vidéo : elle est composée dans le navigateur (`MaquetteNavigateur`).
 */
export async function maquetteRapide(videoId: Id, options: { confirme?: AccordPrix; origine?: OrigineLancement } = {}): Promise<{ url: string; vignette: string; dureeSec: number; ratio: Ratio; versionId: Id; audioUrl: string }> {
  await exigerSession();
  // E2E-2 argent n° 4 : une seule maquette à la fois par vidéo, et jamais en même temps qu'un lancement (la seconde
  // attend la fin de la première, puis reprend sa voix : rien n'est lu ni payé deux fois).
  return sousVerrouVideo(videoId, () => maquetteSousVerrou(videoId, accordPropre(options.confirme), options.origine));
}

async function maquetteSousVerrou(videoId: Id, confirme: AccordPrix, origine?: OrigineLancement): Promise<{ url: string; vignette: string; dureeSec: number; ratio: Ratio; versionId: Id; audioUrl: string }> {
  const d = depots();
  // Une fabrication déjà lancée lira (et paiera) la voix elle-même : une maquette maintenant la paierait deux fois.
  const fabrique = await d.travaux.trouver((t) => t.cibleId === videoId && (t.statut === "en_cours" || t.statut === "en_file"));
  if (fabrique) throw new ErreurStudio("EN_FABRICATION", "Cette vidéo est déjà en fabrication : l'aperçu rapide n'est plus utile, la vidéo arrive.");
  const commande = await construireCommande(videoId, origine ? { origine } : {});
  if (origine) commande.origine = origine;
  commande.audioMaitre = await audioMaitreReutilisable(commande);
  const moteur = moteurDeCommande(commande);
  // Son brut déjà lu et payé par une maquette tombée en panne ensuite (même texte, même voix) : repris, pas relu.
  const avant = await d.videos.obtenir(videoId);
  const voixBrute = !commande.audioMaitre && avant?.voixMaquettePayee?.empreinte === empreinteAudioMaitre(commande) ? avant.voixMaquettePayee : undefined;
  // Ce que la maquette va payer (la voix, sauf si elle est déjà faite ou déjà lue) : vérifié AVANT tout appel payant.
  // 14/10 (voix de référence, avocat) : son repris avec un contrôle de ressemblance pas fini : les relectures encore
  // permises (prix confirmé = 2 lectures par défaut, 3 au plus à 2 relances) sont vérifiées ici aussi, jamais les lectures déjà payées.
  const voixEstimee = async () => (await moteur.estimer(commande)).lignes.filter((l) => cleEtapeDeLigne(l.etape) === "voix");
  const estimee = commande.audioMaitre ? [] : voixBrute ? (voixBrute.controleVoix ? lignesVoixMaquetteRestantes(await voixEstimee(), voixBrute, commande) : []) : await voixEstimee();
  // CORRECTEUR 1 — B6 : au-delà du seuil, la confirmation vient de l'écran (jamais écrite en dur).
  // L3-01 : contrôle, réservation ET engagement sous le verrou des crédits (avec l'origine), le temps de payer la voix et
  // d'enregistrer la dépense ; rendus ensuite (une maquette n'a pas de travail).
  const { m, versionId } = await depenserSelonOrigine(origine, { lignes: estimee, total: additionner(...estimee.map((l) => l.total)) }, confirme, "Cette maquette", { videoId, travailId: nouvelId("maq") }, () =>
    payerMaquette(videoId, commande, moteur, avant, voixBrute),
  );
  const audio = m.pistes?.find((p) => p.type === "audio-maitre");
  // La maquette simulée est tirée au premier format d'image demandé : le lecteur l'affiche à ce ratio, sans recadrage.
  return {
    url: m.fichierCle ?? "",
    vignette: m.vignetteCle ?? "",
    dureeSec: m.dureeSec,
    ratio: commande.ratios[0] ?? "9:16",
    versionId,
    audioUrl: audio ? await (await fournisseur("stockage")).urlLecture(audio.fichierCle) : "",
  };
}

/** La maquette payée : voix lue (ou reprise), version « maquette » et dépense réelle enregistrées (même en panne). */
async function payerMaquette(videoId: Id, commande: CommandeFabrication, moteur: MoteurVideo, avant: Video | null, voixBrute: VoixBrutePayee | undefined) {
  const d = depots();
  let m: Awaited<ReturnType<typeof moteur.maquette>>;
  try {
    m = await moteur.maquette(commande, voixBrute ? { voixBrute } : undefined);
  } catch (e) {
    // E2E-1 n° 3 : une maquette en panne APRÈS la lecture de la voix l'a payée : la dépense est enregistrée.
    const payees = (e as { lignesPayees?: LigneCout[] } | null)?.lignesPayees;
    if (payees?.length) {
      const v = await d.videos.obtenir(videoId);
      const total = additionner(...payees.map((l) => l.total));
      await d.depenses.enregistrer({ id: nouvelId("dep"), videoId, lignes: payees, total, date: maintenant(), ...horodatage(), estDemo: v?.estDemo });
      // E2E-2 argent n° 17 b : la voix payée par une maquette fait partie du coût de la vidéo.
      if (v) await d.videos.modifier(videoId, { coutReel: additionner(v.coutReel, total) });
    }
    // Le son brut payé est gardé sur la vidéo : la maquette suivante le reprend au lieu de relire (et repayer) la voix.
    const brute = (e as { voixBrute?: VoixBrutePayee } | null)?.voixBrute;
    if (brute) await d.videos.modifier(videoId, { voixMaquettePayee: { ...brute, le: maintenant() } });
    throw e;
  }
  // Maquette réussie : l'audio maître est rangé comme piste (réutilisée ensuite), le son brut gardé ne sert plus.
  if (avant?.voixMaquettePayee) await d.videos.modifier(videoId, { voixMaquettePayee: undefined });
  const lignes = m.lignesReelles ?? [];
  const total = additionner(...lignes.map((l) => l.total));
  const video = await d.videos.obtenir(videoId);
  const versionId = nouvelId("ver");
  await d.versions.enregistrer({ id: versionId, videoId, numero: 0, commande, statut: "maquette", choisie: false, coutReel: total, ...horodatage(), estDemo: video?.estDemo });
  await appliquerProduitsDuMoteur(videoId, versionId, m, video?.langue ?? "fr-FR", video?.estDemo);
  if (lignes.length) {
    await d.depenses.enregistrer({ id: nouvelId("dep"), videoId, lignes, total, date: maintenant(), ...horodatage(), estDemo: video?.estDemo });
    // E2E-2 argent n° 17 b : la voix payée par la maquette (reprise ensuite sans être repayée) compte dans le coût de la vidéo.
    if (video && total.centimes > 0) await d.videos.modifier(videoId, { coutReel: additionner(video.coutReel, total) });
  }
  return { m, versionId, video };
}

/* Garde-fou du budget (AV2.2-9) : devenu `verifierBudgetEtCredits` (services/credits.ts, lot « crédits » du 02/10),
   le même contrôle du budget du mois puis celui des crédits de chaque fournisseur, aux 4 mêmes endroits. */

/**
 * Identifiants des plans choisis dans la commande de la version. Identité d'un plan (B.2) : même segment ET
 * recouvrement dans le temps ; à défaut (commande v1, plans sans segment), même ordre.
 */
async function plansDeLaCommande(versionId: Id, commande: CommandeFabrication, planIds: Id[]): Promise<Id[]> {
  const choisis = await depots().plans.lister((p) => p.versionId === versionId && planIds.includes(p.id));
  const seRecouvrent = (a: { debutSec: number; finSec: number }, b: { debutSec: number; finSec: number }) => a.debutSec < b.finSec && b.debutSec < a.finSec;
  return commande.plans
    .filter(
      (p) =>
        planIds.includes(p.id) ||
        choisis.some((c) => (c.segmentId && p.segmentId ? c.segmentId === p.segmentId && seRecouvrent(c, p) : c.ordre === p.ordre)),
    )
    .map((p) => p.id);
}

/** Coût estimé d'une retouche : seuls les plans choisis sont repayés (AV2.2-5). Même calcul que la facture. */
export async function estimerRetoucheVideo(videoId: Id, planIds: Id[], operations?: OperationMontage[]): Promise<{ total: Montant; dureeSec: number }> {
  const d = depots();
  const video = await d.videos.obtenir(videoId);
  const courante = video?.versionChoisieId ? await d.versions.obtenir(video.versionChoisieId) : null;
  if (!video || !courante) throw new ErreurStudio("INTROUVABLE", "Aucune version à retoucher.");
  if (!planIds.length) return { total: centimes(0), dureeSec: 0 };
  const ids = await plansDeLaCommande(courante.id, courante.commande, planIds);
  await preparerReglagesMoteur(courante.commande);
  const estimation = await moteurDeCommande(courante.commande).estimerRetouche(courante.commande, ids, operations?.length ? { operations, parent: await parentDeLaVersion(courante) } : undefined);
  const dureeSec = courante.commande.plans.filter((p) => ids.includes(p.id)).reduce((t, p) => t + (p.finSec - p.debutSec), 0);
  return { total: estimation.total, dureeSec: Math.round(dureeSec) };
}

/** Coût estimé d'un format d'image ajouté (affiché sur le bouton avant de lancer). */
export async function estimerReexport(videoId: Id, ratio: Ratio): Promise<Montant> {
  const d = depots();
  const video = await d.videos.obtenir(videoId);
  const courante = video?.versionChoisieId ? await d.versions.obtenir(video.versionChoisieId) : null;
  if (!video || !courante) return centimes(0);
  return (await moteurDeCommande(courante.commande).estimerReexport(courante.commande, ratio)).total;
}

/** Ce qui est déjà payé dans une version : ses pistes (clé de stockage) et son projet de montage (lot M4). */
export async function parentDeLaVersion(version: VersionVideo): Promise<ParentRetouche> {
  const d = depots();
  const pistes = await d.pistes.lister((p) => p.versionId === version.id);
  const fichiers = await Promise.all(pistes.map((p) => (p.fichierId ? d.fichiers.obtenir(p.fichierId) : null)));
  return {
    versionId: version.id,
    projetMontage: version.projetMontage,
    pistes: pistes.flatMap((p, i) => (fichiers[i] ? [{ type: p.type, planId: p.planId, fichierCle: fichiers[i]!.cleStockage, ratio: p.ratio }] : [])),
  };
}

/** CORRECTEUR 1 — B1 : phrase montrée à Will quand la retouche d'un passage n'existe pas encore pour cette vidéo. */
export const RETOUCHE_PAS_DISPONIBLE = "La retouche d'un passage n'est pas encore disponible pour cette vidéo. Votre vidéo reste telle quelle.";

/** Retouche ciblée d'un ou plusieurs plans : nouvelle version, seuls ces plans sont repayés. Le moteur de la version fait foi. */
/**
 * `options.entrees` (plan facecam v4, lot D, FACULTATIF) : entrées de la nouvelle version (consignes du monteur
 * appliquées) ; absentes, la nouvelle version garde celles de la version courante, comme aujourd'hui.
 * `options.operations` (tableau animé, FACULTATIF) : opérations de retouche par boutons, transmises au moteur.
 */
export async function lancerRetouche(videoId: Id, planIds: Id[], consigne: string, options: { confirme?: AccordPrix; entrees?: Record<string, unknown>; operations?: OperationMontage[] } = {}): Promise<{ retoucheId: Id; travailId: Id }> {
  await exigerSession();
  return sousVerrouVideo(videoId, () => retoucheSousVerrou(videoId, planIds, consigne, options));
}

async function retoucheSousVerrou(videoId: Id, planIds: Id[], consigne: string, options: { confirme?: AccordPrix; entrees?: Record<string, unknown>; operations?: OperationMontage[] }): Promise<{ retoucheId: Id; travailId: Id }> {
  const d = depots();
  const video = await d.videos.obtenir(videoId);
  const courante = video?.versionChoisieId ? await d.versions.obtenir(video.versionChoisieId) : null;
  if (!video || !courante) throw new ErreurStudio("INTROUVABLE", "Aucune version à retoucher.");
  // E2E-2 argent n° 3 : la même retouche déjà en cours (double envoi, deux onglets) n'est ni relancée ni repayée.
  const memes = (a: Id[], b: Id[]) => a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");
  for (const r of await d.retouches.lister((x) => x.videoId === videoId && x.statut === "en_cours" && x.consigne === consigne && memes(x.planIds, planIds))) {
    const t = r.travailId ? await d.travaux.obtenir(r.travailId) : null;
    if (t && (t.statut === "en_cours" || t.statut === "en_file")) return { retoucheId: r.id, travailId: t.id };
  }
  // Réglage `casConcret.retouches` : relu avant d'interroger le moteur (son refus est synchrone).
  await preparerReglagesMoteur(courante.commande);
  const moteur = moteurDeCommande(courante.commande);
  // CORRECTEUR 1 — B1 : un moteur qui ne sait pas retoucher un passage pour de vrai ne rend jamais une vidéo
  // d'essai à la place de la vraie : refus clair, AVANT toute réservation (rien n'est payé, la vidéo ne change pas).
  if (!moteur.capacites.retoucheParPlan && !video.estDemo) throw new ErreurStudio("RETOUCHE_INDISPONIBLE", RETOUCHE_PAS_DISPONIBLE);
  // Facecam lot G : la retouche réelle n'existe que si la chaîne réelle est branchée pour cette commande.
  const refusRetouche = video.estDemo ? null : moteur.refusRetouche?.(options.entrees ? { ...courante.commande, entrees: options.entrees } : courante.commande);
  if (refusRetouche) throw new ErreurStudio("RETOUCHE_INDISPONIBLE", RETOUCHE_PAS_DISPONIBLE);
  const idsCommande = await plansDeLaCommande(courante.id, courante.commande, planIds);
  const versionId = nouvelId("ver");
  const travailId = nouvelId("trav");
  // E2E-1 n° 6 : une retouche RÉSERVE son crédit comme un lancement (contrôle et réservation d'un seul tenant).
  // Piste (a) : les opérations et le parent sont connus ICI, la réservation est le coût exact de l'aperçu.
  const commandeRetouche = options.entrees ? { ...courante.commande, entrees: options.entrees } : courante.commande;
  const estimationRetouche = await moteur.estimerRetouche(commandeRetouche, idsCommande, options.operations?.length ? { operations: options.operations, parent: await parentDeLaVersion(courante) } : undefined);
  // CORRECTEUR 1 — B11 : même règle qu'au lancement.
  const refusEssai = await refusSimulationEnProduction(courante.commande, estimationRetouche.lignes);
  if (refusEssai) throw new ErreurStudio("SIMULATION_EN_PRODUCTION", refusEssai);
  await verifierEtReserverSelonOrigine(courante.commande.origine, estimationRetouche, accordDuFormat(courante.commande.formatId, options.confirme), "Cette retouche", { videoId, travailId });
  try {
    return await creerRetouche(video, options.entrees ? { ...courante, commande: { ...courante.commande, entrees: options.entrees } } : courante, moteur, idsCommande, planIds, consigne, versionId, travailId, options.operations);
  } catch (e) {
    await libererReservation(travailId, "liberee");
    throw e;
  }
}

async function creerRetouche(video: Video, courante: VersionVideo, moteur: MoteurVideo, idsCommande: Id[], planIds: Id[], consigne: string, versionId: Id, travailId: Id, operations?: OperationMontage[]): Promise<{ retoucheId: Id; travailId: Id }> {
  const d = depots();
  const videoId = video.id;
  const n = await prochainNumero(videoId);
  // Numéro du lien suivi réservé AVANT toute écriture : plage épuisée → refus, aucun plan orphelin.
  const numeroSuivi = await reserverNumeroSuivi(!!video.estDemo);
  for (const p of await d.plans.lister((x) => x.versionId === courante.id)) {
    await d.plans.enregistrer({ ...p, id: `${versionId}-plan-${p.ordre}`, versionId });
  }
  // La retouche recopie la version COURANTE des sous-titres seulement (la plus haute), en version 1 de la nouvelle
  // version vidéo ; les versions anciennes restent sur la version d'origine (rien n'est effacé).
  const stCourants = await sousTitresCourants(courante.id);
  if (stCourants) await d.sousTitres.enregistrer({ ...stCourants, id: nouvelId("st"), versionId, version: 1, ...horodatage() });
  // Le lien suivi est celui de CETTE version : `...courante` recopierait le numéro du parent, on l'écrase.
  await d.versions.enregistrer({ ...courante, id: versionId, numero: n, numeroSuivi, parentVersionId: courante.id, statut: "en_fabrication", travailId, choisie: false, noteRetouche: consigne, ...horodatage() });
  const parent = await parentDeLaVersion(courante);
  const travail = await moteur.retoucher({ commande: courante.commande, contexte: { travailId, versionId, titre: `Retouche — ${video.titre}` }, planIds: idsCommande, consigne, parent, ...(operations?.length ? { operations } : {}) });
  await d.travaux.enregistrer({ ...travail, estDemo: video.estDemo });
  const retoucheId = nouvelId("ret");
  await d.retouches.enregistrer({ id: retoucheId, videoId, versionId: courante.id, planIds, consigne, statut: "en_cours", travailId, ...horodatage() });
  await d.videos.modifier(videoId, { statut: "en_fabrication" });
  await journaliser("retouche", `Retouche demandée : « ${consigne} »`, { type: "video", id: videoId });
  return { retoucheId, travailId };
}

/**
 * Ajoute un format d'image à une vidéo prête (réexport). Seul l'export de ce format est payé ;
 * la vidéo garde son étape de publication, sa note et sa version (voir travaux.appliquerResultat).
 */
export async function reexporter(videoId: Id, ratio: Ratio, options: { confirme?: AccordPrix } = {}): Promise<{ travailId: Id }> {
  await exigerSession();
  return sousVerrouVideo(videoId, () => reexportSousVerrou(videoId, ratio, options));
}

async function reexportSousVerrou(videoId: Id, ratio: Ratio, options: { confirme?: AccordPrix }): Promise<{ travailId: Id }> {
  const d = depots();
  const video = await d.videos.obtenir(videoId);
  const courante = video?.versionChoisieId ? await d.versions.obtenir(video.versionChoisieId) : null;
  if (!video || !courante) throw new ErreurStudio("INTROUVABLE", "Aucune version à exporter.");
  const deja = await d.travaux.trouver((t) => t.cibleId === videoId && t.type === "reexport" && t.parametres?.ratio === ratio && (t.statut === "en_cours" || t.statut === "en_file"));
  if (deja) return { travailId: deja.id };
  const moteur = moteurDeCommande(courante.commande);
  const travailId = nouvelId("trav");
  // E2E-1 n° 6 : un format ajouté RÉSERVE son crédit comme un lancement (contrôle et réservation d'un seul tenant).
  const estimationFormat = await moteur.estimerReexport(courante.commande, ratio);
  // CORRECTEUR 1 — B11 : même règle qu'au lancement.
  const refusEssai = await refusSimulationEnProduction(courante.commande, estimationFormat.lignes);
  if (refusEssai) throw new ErreurStudio("SIMULATION_EN_PRODUCTION", refusEssai);
  await verifierEtReserverSelonOrigine(courante.commande.origine, estimationFormat, accordDuFormat(courante.commande.formatId, options.confirme), "Ce format", { videoId, travailId });
  try {
    return await creerReexport(video, courante, moteur, ratio, travailId);
  } catch (e) {
    await libererReservation(travailId, "liberee");
    throw e;
  }
}

async function creerReexport(video: Video, courante: VersionVideo, moteur: MoteurVideo, ratio: Ratio, travailId: Id): Promise<{ travailId: Id }> {
  const d = depots();
  const videoId = video.id;
  const commande = { ...courante.commande, ratios: [ratio] };
  // Ce qui est déjà fabriqué (lot M4) : le format ajouté est recomposé depuis ces pistes, sans rien repayer.
  const parent = await parentDeLaVersion(courante);
  const segments = (await sousTitresCourants(courante.id))?.segments;
  const travail = await moteur.reexporter({ commande, contexte: { travailId, versionId: courante.id, titre: `Nouveau format — ${video.titre}` }, cible: { ratio }, parent, segments });
  await d.travaux.enregistrer({ ...travail, parametres: { ...travail.parametres, ratio }, estDemo: video.estDemo });
  if (!video.ratios.includes(ratio)) await d.videos.modifier(videoId, { ratios: [...video.ratios, ratio] });
  await journaliser("fabrication", `Format ${ratio} demandé : « ${video.titre} »`, { type: "video", id: videoId });
  return { travailId };
}

/**
 * Lot M5 : mode « économique » de la vidéo (banques seulement). Les plans de l'Aperçu « à fabriquer » reviennent
 * au double ; en le coupant, ils redeviennent « à fabriquer » (si le format le permet). Rien d'autre ne bouge.
 */
export async function changerModeEconomiqueApercu(videoId: Id, actif: boolean): Promise<void> {
  await exigerSession();
  const d = depots();
  const video = await d.videos.obtenir(videoId);
  if (!video) throw new ErreurStudio("INTROUVABLE", "Cette vidéo n'existe plus.");
  await changerModeEconomique(videoId, actif);
  const format = obtenirFormat(video.formatId);
  const fabriquer = format.illustrations.sourcesAutorisees.includes("generee-ia") && !actif;
  for (const p of await d.plans.lister((x) => x.versionId === versionBrouillon(videoId))) {
    if (p.sourceImage !== "illustration" || !p.illustration || p.illustration.verrouille || p.illustration.elementId) continue;
    const source = fabriquer ? "generee-ia" : "aucune";
    if (p.illustration.source !== source) await d.plans.modifier(p.id, { illustration: { ...p.illustration, source } });
  }
}
