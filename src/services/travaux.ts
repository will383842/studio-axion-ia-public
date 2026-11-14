/**
 * TRAVAUX (AV2.2-4 ; pilotage de la fabrication, lot M1b B.9 ter).
 * Les travaux avancent par la BOUCLE DE FOND (`services/boucle.ts`, toutes les 5 s, sans visiteur), en trois temps :
 *   1. `lireTravauxAAvancer` — SOUS le verrou : file d'attente (concurrence, urgent), reprise programmée ;
 *   2. `moteur.avancer` — HORS verrou, avec délai maximal (appels réseau des fournisseurs) ;
 *   3. `ecrireAvancement` / `ecrirePanne` — SOUS le verrou, seulement si le travail n'a pas changé entre-temps
 *      (« Arrêter » ou « Réessayer » pendant le tour : l'état nouveau n'est jamais réécrit).
 * `listerTravaux` et `obtenirTravail` n'avancent plus rien : ils affichent.
 */
import "server-only";
import type { CommandeFabrication, LigneCout, Montant, Notification, Plan, Ratio, Sortie, SuiteFabrication, Travail, VersionVideo, Video } from "@/domaine/types";
import { TRAVAUX_SUR_VIDEO_FINIE } from "@/domaine/cas-traites";
import { familleDe } from "@/domaine/journal-echecs";
import { apresPanne, calculerFile, CONCURRENCE_PAR_DEFAUT, delaiSansAvancementMs, depenseDesEtapes, empreinteAvancement, finEstimee, formaterHeure, minutesRestantes, peutAvancer } from "@/domaine/suivi";
import { bailTenu } from "@/donnees/memoire";
import { trouverFormat } from "@/formats";
import { phraseLisible } from "@/lib/erreur-lisible";
import { phraseDEchec } from "@/domaine/phrase-echec";
import { nouvelId } from "@/lib/ids";
import { additionner } from "@/lib/montants";
import { commandeEnEssai, moteurDeCommande } from "@/moteurs";
import type { MoteurVideo, ResultatFabrication } from "@/moteurs";
import { cleEtapeDeLigne, lignesDesEtapesPayees, lignesRestantes } from "@/moteurs/couts-etapes";
import { boucleActive } from "./_boucle-etat";
import { depots, ecrireParametre, filtreExemples, horodatage, journaliser, lireParametre, maintenant, ErreurStudio, sousVerrou } from "./_commun";
import { exigerSession } from "./auth";
import { preparerReglagesMoteur } from "./cas-concret-reglages";
import { envoyerAlerteBudget, ligneSimulee } from "./couts";
import { deduireDejaPaye, estCreditInsuffisant, fournisseurDeLErreur, libererReservation, nomFournisseur, reactiverReservations, reactiverSelonOrigine, RELANCE_ATTENTE_CREDIT_MS, signalerAttenteCredit, soldeLuChezLeFournisseur } from "./credits";
import { urlFichier } from "./fichiers";
import { rangDeLaVideo } from "./illustrations";
import { creerNotification } from "./notifications";
import { consignerEchec } from "./journal-echecs";
import { synchroniserApresFabrication } from "./generateur";
import type { VueTravail } from "./vues";
import type { AccordPrix } from "@/domaine/accord";
import { entreesAvecLivraison } from "@/moteurs/montage-facecam/raccords";
import { fichierDejaFait } from "@/reseaux/sorties";
import { abonnementsClaudeActifs, lireReglageSourcesClaude } from "./source-claude";

/**
 * Fichier produit par une fabrication (vidéo, vignette, piste, illustration). Audit 4.11 : la taille est la VRAIE
 * (mesurée sur le fichier exporté, `Sortie.taille`) quand elle est connue, sinon 0 (inconnue) : jamais un chiffre
 * inventé. Un fichier de fabrication déjà connu reçoit sa taille mesurée (rien n'est effacé).
 */
async function fichierProduit(cle: string, mime: string, dureeSec?: number, taille?: number): Promise<string> {
  const connue = taille !== undefined && Number.isFinite(taille) && taille > 0 ? Math.round(taille) : 0;
  const existant = await depots().fichiers.trouver((f) => f.cleStockage === cle);
  if (existant) {
    if (connue && existant.origine === "fabrication" && existant.taille !== connue) await depots().fichiers.modifier(existant.id, { taille: connue });
    return existant.id;
  }
  const f = await depots().fichiers.enregistrer({
    id: nouvelId("f"),
    cleStockage: cle,
    nom: cle.split("/").pop() ?? cle,
    mime,
    taille: connue,
    dureeSec,
    origine: "fabrication",
    statut: "pret",
    ...horodatage(),
  });
  return f.id;
}

async function notifier(n: Omit<Notification, "id" | "creeLe" | "modifieLe" | "lue">) {
  await creerNotification(n);
}

/** Après une dépense : alerte « budget à 80 % » une fois par mois (L3-01 : la marque du mois n'est posée qu'après l'envoi). */
async function surveillerBudget() {
  await envoyerAlerteBudget(notifier);
}

/**
 * E2E-1 n° 3 et n° 8 (03/10) : ce qui est déjà payé pour ce travail, ligne par ligne, au nom du VRAI fournisseur.
 * Le moteur le dit s'il sait (`lignesPayees` : la voix lue compte même si son étape n'est pas finie) ; sinon, les
 * étapes terminées, rattachées au fournisseur de la ligne estimée de la même étape. Pur (aucun appel réseau).
 */
export async function lignesPayeesDuTravail(moteur: MoteurVideo, travail: Travail, commande: CommandeFabrication | null | undefined): Promise<LigneCout[]> {
  if (commande && moteur.lignesPayees) return moteur.lignesPayees(travail, commande);
  const reference = commande ? (await moteur.estimer(commande).catch(() => null))?.lignes ?? [] : [];
  return lignesDesEtapesPayees(travail.etapes, reference, travail.fournisseurUtilise);
}

/**
 * Enregistre la dépense de ce qui est payé et PAS ENCORE enregistré pour ce travail (échec puis « Réessayer » puis fin :
 * rien n'est compté deux fois). Ajoute le montant au coût de la vidéo et de la version. Renvoie le montant ajouté.
 */
async function enregistrerDepensePayee(travail: Travail, lignes: LigneCout[], options: { versionAussi?: boolean } = {}): Promise<Montant> {
  const d = depots();
  const deja = (await d.depenses.lister((x) => x.travailId === travail.id)).flatMap((x) => x.lignes);
  const restantes = lignesRestantes(lignes.filter((l) => l.total.centimes > 0), deja);
  const total = additionner(...restantes.map((l) => l.total));
  if (!restantes.length) return total;
  const video = await d.videos.obtenir(travail.cibleId);
  await d.depenses.enregistrer({ id: nouvelId("dep"), videoId: travail.cibleId, travailId: travail.id, lignes: restantes, total, date: maintenant(), ...horodatage(), estDemo: travail.estDemo ?? video?.estDemo });
  if (video) await d.videos.modifier(video.id, { coutReel: additionner(video.coutReel, total) });
  if (options.versionAussi !== false && travail.versionId) {
    const version = await d.versions.obtenir(travail.versionId);
    if (version) await d.versions.modifier(version.id, { coutReel: additionner(version.coutReel, total) });
  }
  if (!(travail.estDemo ?? video?.estDemo)) await surveillerBudget();
  return total;
}

/** Ce qui se fait APRÈS l'écriture, hors verrou (appels réseau possibles : miniatures, textes du kit). */
export type { SuiteFabrication } from "@/domaine/types";

/**
 * INTÉGRATION FINALE (VERIF-E2E-1, « finition perdue au redémarrage ») : les suites d'une fabrication terminée sont
 * notées EN BASE, et levées une fois faites. Un redémarrage les retrouve au premier tour du nouveau processus
 * (`rattraperFinitions`). Chaque suite est sans effet si elle est déjà faite : rien n'est refait ni repayé.
 * RELECTURE FINALE : la note est portée par le travail (`finitionAFaire`), écrite dans la MÊME écriture que « terminé »
 * (avant : un paramètre écrit à part, perdu si le studio s'arrêtait entre les deux) ; chaque suite faite est retirée,
 * seules les ratées sont rejouées. Les notes d'avant (paramètres `fabrication.finitionAFaire.*`) sont encore reprises.
 */
const PREFIXE_FINITION = "fabrication.finitionAFaire.";
const cleFinition = (travailId: string) => `${PREFIXE_FINITION}${travailId}`;

/** Suites d'une fabrication terminée (vidéo prête) : finition, et pour une vidéo de version, la suite du générateur. */
function suitesDeFinition(travail: Travail, video: Pick<Video, "id" | "titre" | "ratios"> & { varianteId?: string }): SuiteFabrication[] {
  if (travail.type === "reexport") return [];
  return [{ type: "finition", videoId: video.id, titre: video.titre, ratio: video.ratios[0], textes: travail.type === "fabrication", travailId: travail.id }, ...(video.varianteId && travail.type === "fabrication" ? [{ type: "generateur" as const, videoId: video.id, travailId: travail.id }] : [])];
}

/** Applique le résultat d'une fabrication terminée : sorties, note, coûts, statut, notification. Renvoie les suites hors verrou. */
/**
 * Vérif V1 : version de la vidéo plus récente (numéro plus haut) que `versionId`, déjà prête et choisie ; null sinon.
 * Une retouche plus ancienne qui finit après elle ne doit pas la remplacer.
 */
export function versionPlusRecentePrete(versions: Pick<VersionVideo, "id" | "numero" | "statut" | "choisie">[], versionId: string): Pick<VersionVideo, "id" | "numero" | "statut" | "choisie"> | null {
  const cible = versions.find((v) => v.id === versionId);
  if (!cible) return null;
  return versions.find((v) => v.id !== versionId && v.choisie && v.statut === "prete" && v.numero > cible.numero) ?? null;
}

/** GV2-38 : note sur le travail qu'une écriture de la fin de fabrication est faite (sans effet si le travail ne porte pas de note). */
async function noterFaitDeFin(travailId: string, fait: "depense" | "produits", ajout?: Montant): Promise<void> {
  const t = await depots().travaux.obtenir(travailId);
  if (t?.finAAppliquer && !t.finAAppliquer.faits.includes(fait)) await depots().travaux.enregistrer({ ...t, finAAppliquer: { ...t.finAAppliquer, faits: [...t.finAAppliquer.faits, fait], ...(ajout ? { ajout } : {}) } });
}

/** GV2-38 : ce que la dépense de fin ajoute au coût de la vidéo, noté AVANT la dépense (un arrêt juste après ne le perd pas). */
async function noterAjoutDeFin(travailId: string, ajout: Montant): Promise<void> {
  const t = await depots().travaux.obtenir(travailId);
  if (t?.finAAppliquer && !t.finAAppliquer.ajout) await depots().travaux.enregistrer({ ...t, finAAppliquer: { ...t.finAAppliquer, ajout } });
}

async function retirerNoteDeFin(travailId: string): Promise<void> {
  const t = await depots().travaux.obtenir(travailId);
  if (t?.finAAppliquer) await depots().travaux.enregistrer({ ...t, finAAppliquer: undefined });
}

async function appliquerResultat(travail: Travail, resultat: ResultatFabrication, options?: { rejeu?: boolean }): Promise<SuiteFabrication[]> {
  const d = depots();
  const rejeu = options?.rejeu === true;
  const faits = rejeu ? ((await d.travaux.obtenir(travail.id))?.finAAppliquer?.faits ?? travail.finAAppliquer?.faits ?? []) : [];
  const video = await d.videos.obtenir(travail.cibleId);
  if (!video || !travail.versionId) return [];
  // CORRECTEUR 1 — B1 : une retouche qui rend une vidéo de DÉMONSTRATION sur une vraie vidéo n'est jamais livrée.
  if (travail.type === "retouche" && !video.estDemo && resultat.sorties.some((s) => estFichierDemo(s.fichierCle))) {
    await refuserRetoucheDeDemonstration(travail, video.id, video.titre);
    return [];
  }
  const sorties: Sortie[] = [];
  const existantes = await d.sorties.lister((s) => s.versionId === travail.versionId);
  for (const s of resultat.sorties) {
    // Formats par réseau T4 : un fichier est reconnu par son format, sa fin ET ses réseaux (les deux verticaux du tableau
    // animé, celui des Reels et celui de TikTok et Shorts, restent deux fichiers, même à fin propre des deux côtés). Fin
    // inconnue : déjà fait si un fichier du même format a aussi une fin inconnue, quels que soient ses réseaux (pas de
    // 9:16 en double après « Réessayer » d'une version d'avant T4). Comparé aux fichiers déjà enregistrés ET à ceux du lot.
    if (fichierDejaFait([...existantes, ...sorties], s)) continue;
    const fichierId = await fichierProduit(s.fichierCle, "video/mp4", s.dureeSec, s.taille);
    const vignetteFichierId = await fichierProduit(s.vignetteCle, "image/jpeg");
    sorties.push({
      id: nouvelId("sortie"),
      videoId: video.id,
      versionId: travail.versionId,
      ratio: s.ratio,
      ...(s.reseaux?.length ? { reseaux: [...s.reseaux] } : {}),
      ...(s.appelAuMot !== undefined ? { appelAuMot: s.appelAuMot } : {}),
      resolution: s.resolution,
      fichierId,
      vignetteFichierId,
      dureeSec: s.dureeSec,
      taille: s.taille,
      rapportQualite: s.rapportQualite,
      ...horodatage(),
    });
  }
  for (const s of sorties) await d.sorties.enregistrer(s);
  const coutReel: Montant = additionner(...resultat.lignesReelles.map((l) => l.total));
  // E2E-1 n° 3 : ce qui a déjà été enregistré pour ce travail (à un échec avant « Réessayer ») n'est pas recompté.
  const depensesDuTravail = await d.depenses.lister((x) => x.travailId === travail.id);
  const deja = depensesDuTravail.flatMap((x) => x.lignes);
  const restantes = lignesRestantes(resultat.lignesReelles, deja);
  const ajoutDepense: Montant = additionner(...restantes.map((l) => l.total));
  let ajout: Montant = ajoutDepense;
  // GV2-38 : au rejeu, tant que la vidéo n'est pas « prête » (son coût est écrit avec ce statut), on ajoute ce que la
  // dépense de fin avait ajouté, noté AVANT la dépense (un arrêt entre la dépense et la note ne le perd pas). Format ajouté :
  // jamais de double.
  if (rejeu && travail.type !== "reexport" && video.statut !== "prete") ajout = (await d.travaux.obtenir(travail.id))?.finAAppliquer?.ajout ?? ajout;
  // GV2-38 : au rejeu, une dépense VIDE déjà écrite compte comme une dépense (jamais une seconde).
  const aucuneDepense = rejeu ? !depensesDuTravail.length : !deja.length;
  if (!(rejeu && faits.includes("depense"))) {
    await noterAjoutDeFin(travail.id, ajout);
    if (restantes.length || aucuneDepense) await d.depenses.enregistrer({ id: nouvelId("dep"), videoId: video.id, travailId: travail.id, lignes: restantes, total: ajoutDepense, date: maintenant(), ...horodatage(), estDemo: video.estDemo });
    // Lot « crédits » : le coût réel remplace la réservation.
    await libererReservation(travail.id, "consommee");
    await noterFaitDeFin(travail.id, "depense", ajout);
  }
  if (!video.estDemo) await surveillerBudget();

  // Format ajouté : seules la nouvelle sortie et sa dépense comptent. L'étape de publication,
  // la note, la version choisie et la date de fin de la vidéo ne bougent pas.
  if (travail.type === "reexport") {
    const version = await d.versions.obtenir(travail.versionId);
    if (version) await d.versions.modifier(version.id, { coutReel: additionner(version.coutReel, ajout) });
    await d.videos.modifier(video.id, { coutReel: additionner(video.coutReel, ajout) });
    // Lot M4 : le format ajouté garde sa piste « sans texte » (recalque gratuit de ce format plus tard).
    if (resultat.pistes?.length && !(rejeu && faits.includes("produits"))) await appliquerProduitsDuMoteur(video.id, travail.versionId, { pistes: resultat.pistes }, video.langue, video.estDemo);
    await noterFaitDeFin(travail.id, "produits");
    const ratios = resultat.sorties.map((s) => s.ratio).join(", ");
    await notifier({ type: "video-prete", titre: `Le format ${ratios} est prêt`, message: `« ${video.titre} »`, lien: `/videos/${video.id}`, estDemo: video.estDemo });
    await journaliser("fabrication", `Format ${ratios} ajouté : « ${video.titre} »`, { type: "video", id: video.id });
    await retirerNoteDeFin(travail.id);
    return [];
  }

  if (!(rejeu && faits.includes("produits"))) await appliquerProduitsDuMoteur(video.id, travail.versionId, resultat, video.langue, video.estDemo);
  await noterFaitDeFin(travail.id, "produits");
  // Facecam lot E : clés R2, coupes et consignes dites recopiées dans `entrees.facecam` (Rétablir, fil, retouches).
  const projetFacecam = resultat.projetMontage as { moteur?: string; facecam?: Parameters<typeof entreesAvecLivraison>[1]; entrees?: { facecam: Record<string, unknown>; facecamMonteur?: Record<string, unknown> } } | undefined;
  if (projetFacecam?.moteur === "montage-facecam" && projetFacecam.entrees) {
    // Facecam lot G : les entrées de la version FINIE (monteur, correction de la relecture, livraison) vont sur la
    // version (la retouche suivante en repart) et sur la vidéo.
    const actuelle = await d.videos.obtenir(video.id);
    await d.videos.modifier(video.id, { entrees: { ...((actuelle?.entrees as Record<string, unknown> | undefined) ?? {}), ...projetFacecam.entrees } });
    const version = await d.versions.obtenir(travail.versionId);
    if (version) await d.versions.modifier(version.id, { commande: { ...version.commande, entrees: { ...(version.commande.entrees ?? {}), ...projetFacecam.entrees } } });
  } else if (projetFacecam?.moteur === "montage-facecam" && projetFacecam.facecam) {
    const actuelle = await d.videos.obtenir(video.id);
    await d.videos.modifier(video.id, { entrees: entreesAvecLivraison(actuelle?.entrees as Record<string, unknown> | undefined, projetFacecam.facecam) });
  }
  // V6 P0 n° 4 : la version gardée « pour les prochaines vidéos » donne la référence du look (peau, mur mesurés).
  if (projetFacecam?.moteur === "montage-facecam") {
    const { memoriserMesureLook } = await import("./monteur-facecam");
    await memoriserMesureLook(travail.versionId, resultat.projetMontage as Record<string, unknown>).catch(() => false);
  }
  // Lot « intensité » (02/10) : le rapport de l'orchestrateur suit la version (courbe de l'Aperçu, alerte qualité).
  await d.versions.modifier(travail.versionId, { statut: "prete", coutReel, projetMontage: resultat.projetMontage, ...(resultat.rapportIntensite ? { rapportIntensite: resultat.rapportIntensite } : {}) });
  // Une version sortie d'une retouche devient la version choisie. Vérif V1 : sauf si une version PLUS RÉCENTE de la
  // vidéo est déjà prête et choisie (deux messages au monteur à la suite, la seconde retouche a fini la première) :
  // la plus ancienne ne la remplace pas, rien de ce que Will a demandé ensuite n'est perdu.
  const versions = await d.versions.lister((v) => v.videoId === video.id);
  const plusRecente = travail.type === "retouche" ? versionPlusRecentePrete(versions, travail.versionId) : null;
  if (!plusRecente) for (const v of versions) await d.versions.modifier(v.id, { choisie: v.id === travail.versionId });
  // Une retouche d'une vidéo déjà publiée la laisse « Publiée » ; sinon elle repasse « À relire ».
  const garderEtape = (travail.type === "retouche" || travail.type === "recalque-sous-titres") && video.etapeEditoriale === "publiee";
  await d.videos.modifier(video.id, {
    statut: "prete",
    etapeEditoriale: garderEtape ? video.etapeEditoriale : "a_relire",
    noteQualite: resultat.noteQualite,
    coutReel: additionner(video.coutReel, ajout),
    versionChoisieId: plusRecente?.id ?? travail.versionId,
    terminee: maintenant(),
  });
  // Générateur (G1a, branche `generateur/prepare-moteur`) : vidéo d'une version par réseau, l'état de la version fait foi.
  if (video.varianteId) await synchroniserApresFabrication(video.id);
  if (travail.type === "retouche") {
    const ret = await d.retouches.trouver((r) => r.travailId === travail.id);
    if (ret) await d.retouches.modifier(ret.id, { statut: "faite", versionProduiteId: travail.versionId });
  }
  // E2E-2 parcours n° 7 : ce qui a changé est à revérifier avant de publier.
  if (travail.type === "retouche" || travail.type === "recalque-sous-titres") {
    const { decocherApresRetouche } = await import("./publications");
    await decocherApresRetouche(video.id, travail.type === "retouche" ? "retouche" : "sous-titres");
  }
  const recalque = travail.type === "recalque-sous-titres";
  // CORRECTEUR FINAL A (VERIF-E2E-1 n° 3) : une vidéo sortie du moteur d'essai est annoncée comme un essai.
  const essai = !video.estDemo && commandeEnEssai((await d.versions.obtenir(travail.versionId))?.commande);
  // Cas concret allé au bout : le cas est inscrit durablement (il n'est plus disponible, même vidéo supprimée). Un essai
  // simulé ne retire pas le cas. Une erreur ici ne fait JAMAIS échouer la fin de fabrication (la vidéo reste prête).
  if (video.formatId === "cas-concret" && !essai) {
    try {
      await (await import("./cas-concret-traites")).noterCasTraite(video);
    } catch (e) {
      await journaliser("fabrication", `Cas concret : inscription du cas traité impossible pour « ${video.titre} » (${e instanceof Error ? e.name : "erreur"})`, { type: "video", id: video.id }).catch(() => undefined);
    }
  }
  const titreNotif = recalque ? "Sous-titres corrigés dans la vidéo" : essai ? "Essai · vidéo de démonstration prête" : "Votre vidéo est prête";
  const messageNotif = essai ? `« ${video.titre} » : c'est un essai, rien n'a été payé. Ce n'est pas encore votre vraie vidéo.` : `« ${video.titre} »`;
  await notifier({ type: "video-prete", titre: titreNotif, message: messageNotif, lien: `/videos/${video.id}`, estDemo: video.estDemo });
  await journaliser("fabrication", recalque ? `Sous-titres corrigés appliqués : « ${video.titre} »` : `Vidéo prête : « ${video.titre} »`, { type: "video", id: video.id });
  // Miniatures et textes du kit : générés HORS verrou (fournisseurs réels = appels réseau).
  // Générateur G6 : après une vidéo de version, hors verrou (versions par réseau à lancer, contrôles sur le temps réel).
  // Relecture finale : les suites sont déjà notées sur le travail, dans l'écriture de « terminé » (`ecrireAvancement`).
  // GV2-38 : tout est enregistré, la note de fin à appliquer est retirée.
  await retirerNoteDeFin(travail.id);
  return travail.finitionAFaire ?? suitesDeFinition(travail, video);
}

/** Fichier de démonstration du studio (`/demo/…`) : jamais la vraie vidéo de Will. */
export function estFichierDemo(cle: string | undefined): boolean {
  return !!cle && /^\/?demo\//.test(cle);
}

/**
 * CORRECTEUR 1 — B1 : la retouche (lancée avant la correction) a rendu une vidéo de démonstration. Rien n'est rangé :
 * la version choisie reste celle d'avant, la vidéo reste prête, la nouvelle version et la retouche passent « échec »,
 * la réservation est libérée. Will lit une phrase simple. Rien n'est effacé.
 */
async function refuserRetoucheDeDemonstration(travail: Travail, videoId: string, titre: string): Promise<void> {
  const d = depots();
  const { RETOUCHE_PAS_DISPONIBLE } = await import("./fabrication");
  const erreur = { code: "RETOUCHE_INDISPONIBLE", reessayable: false, messagePourWill: RETOUCHE_PAS_DISPONIBLE };
  await d.travaux.enregistrer({ ...travail, statut: "echec", erreur, termineLe: undefined, finitionAFaire: undefined, finAAppliquer: undefined });
  if (travail.versionId && (await d.versions.obtenir(travail.versionId))) await d.versions.modifier(travail.versionId, { statut: "echec", choisie: false });
  const ret = await d.retouches.trouver((r) => r.travailId === travail.id);
  if (ret) await d.retouches.modifier(ret.id, { statut: "echec" });
  await d.videos.modifier(videoId, { statut: "prete" });
  await libererReservation(travail.id, "liberee");
  await notifier({ type: "echec", titre: "Retouche pas encore disponible", message: RETOUCHE_PAS_DISPONIBLE, lien: `/videos/${videoId}`, estDemo: travail.estDemo });
  await journaliser("retouche", `Retouche non appliquée (pas encore disponible) : « ${titre} »`, { type: "video", id: videoId });
}

const cleFinitionsEnCours = Symbol.for("studio-axion-ia.finitions-en-cours");
/**
 * Vidéos dont les finitions s'exécutent EN CE MOMENT dans ce processus (nombre de passages en cours) : la suppression
 * définitive attend la fin du passage, jamais la note enregistrée (une finition ratée à chaque fois ne bloque rien).
 */
export function finitionsEnCours(): Map<string, number> {
  const g = globalThis as typeof globalThis & { [cleFinitionsEnCours]?: Map<string, number> };
  return (g[cleFinitionsEnCours] ??= new Map());
}

/** Exécute les suites d'une fabrication (hors verrou). Chacune est sans effet si elle a déjà été faite. */
export async function executerSuites(suites: SuiteFabrication[]): Promise<void> {
  const enEchec = new Set<string>();
  const ratees = new Set<SuiteFabrication>();
  const enCours = finitionsEnCours();
  for (const s of suites) {
    // Posé AVANT de relire la vidéo : une suppression qui la lit encore présente voit le passage en cours.
    enCours.set(s.videoId, (enCours.get(s.videoId) ?? 0) + 1);
    try {
      // Vidéo supprimée définitivement entre-temps : rien à finir, rien n'est écrit (aucun document recréé).
      if (!(await depots().videos.obtenir(s.videoId))) continue;
      if (s.type === "generateur") {
        const { apresFabricationGenerateur } = await import("./fabrication-reseaux");
        await apresFabricationGenerateur(s.videoId);
        continue;
      }
      // Lot R4 : miniatures tirées de la vraie vidéo ; jamais une image de démonstration sur une vraie vidéo.
      const { creerMiniaturesSiAbsentes } = await import("./miniatures");
      await creerMiniaturesSiAbsentes(s.videoId, s.titre, s.ratio);
      await creerKitSiAbsent(s.videoId, !!s.textes);
    } catch (e) {
      if (s.travailId) enEchec.add(s.travailId);
      ratees.add(s);
      console.error("[studio] finition d'une vidéo en échec", e);
    } finally {
      const reste = (enCours.get(s.videoId) ?? 1) - 1;
      if (reste > 0) enCours.set(s.videoId, reste);
      else enCours.delete(s.videoId);
    }
  }
  // Faites : retirées de la note (seules les ratées restent, reprises au prochain démarrage ; jamais toutes rejouées).
  for (const id of new Set(suites.flatMap((s) => (s.travailId ? [s.travailId] : [])))) {
    const restantes = suites.filter((s) => s.travailId === id && ratees.has(s));
    const t = await depots().travaux.obtenir(id);
    if (t?.finitionAFaire) await depots().travaux.enregistrer({ ...t, finitionAFaire: restantes.length ? restantes : undefined });
    const notee = await depots().parametres.obtenir(cleFinition(id));
    if (!enEchec.has(id)) {
      if (notee) await ecrireParametre(cleFinition(id), null);
    } else if (notee?.valeur) await ecrireParametre(cleFinition(id), { le: maintenant(), suites: restantes });
  }
}

/** Premier tour d'un processus : les finitions notées en base et jamais faites (redémarrage) sont reprises. */
export async function rattraperFinitions(): Promise<void> {
  for (const t of await depots().travaux.lister((x) => !!x.finitionAFaire?.length)) await executerSuites(t.finitionAFaire!);
  const notees = await depots().parametres.lister((p) => p.id.startsWith(PREFIXE_FINITION) && !!(p.valeur as { suites?: unknown } | null)?.suites);
  for (const p of notees) await executerSuites((p.valeur as { suites: SuiteFabrication[] }).suites);
}

/**
 * GV2-38 — SOUS le verrou : une fin de fabrication interrompue (travail « terminé » portant `finAAppliquer`) est rejouée
 * UNE SEULE fois. `rejouee` est écrit AVANT le rejeu : un arrêt pendant le rejeu ne rejoue jamais une troisième fois.
 * Au second passage, `appliquerResultat` n'est PAS rappelé : une vidéo encore « en fabrication » passe en échec
 * (« Réessayer » est possible) ; ni dépense ni réservation ne sont touchées (ce qui est payé est déjà écrit, ou le sera
 * par « Réessayer »). Une erreur sur un travail ne bloque pas les autres. Renvoie les suites à exécuter hors verrou.
 */
export async function rejouerFinsInterrompues(): Promise<SuiteFabrication[]> {
  const d = depots();
  const suites: SuiteFabrication[] = [];
  for (const lu of await d.travaux.lister((x) => x.statut === "termine" && !!x.finAAppliquer)) {
    try {
      const note = lu.finAAppliquer!;
      if (!note.rejouee) {
        const travail: Travail = { ...lu, finAAppliquer: { ...note, rejouee: true } };
        await d.travaux.enregistrer(travail);
        try {
          suites.push(...(await appliquerResultat(travail, note.resultat, { rejeu: true })));
          await journaliser("fabrication", `Fin de fabrication rejouée : « ${lu.titre} »`, { type: "video", id: lu.cibleId });
        } catch (e) {
          console.error("[studio] rejeu de la fin de fabrication en échec", lu.id, e instanceof Error ? e.name : "");
        }
        continue;
      }
      const video = await d.videos.obtenir(lu.cibleId);
      if (video && video.statut === "en_fabrication") {
        await d.videos.modifier(video.id, { statut: "echec" });
        if (lu.versionId && (await d.versions.obtenir(lu.versionId))) await d.versions.modifier(lu.versionId, { statut: "echec" });
        await notifier({ type: "echec", titre: "La fin de la fabrication n'a pas pu être enregistrée", message: "Vous pouvez réessayer.", lien: `/videos/${video.id}`, estDemo: video.estDemo });
        await journaliser("echec", `Fin de fabrication non enregistrée : « ${lu.titre} »`, { type: "video", id: video.id });
      }
      await retirerNoteDeFin(lu.id);
    } catch (e) {
      console.error("[studio] reprise d'une fin de fabrication en échec", lu.id, e instanceof Error ? e.name : "");
    }
  }
  return suites;
}

/**
 * Ce que le moteur renvoie en plus des sorties (B.0 §19) : les plans REDÉCOUPÉS remplacent ceux de la version
 * (les anciens sont gardés sous une clé d'archive, jamais effacés), une NOUVELLE version de sous-titres est créée,
 * les pistes et les éléments créés (illustrations payées, avec licence) sont enregistrés.
 */
export async function appliquerProduitsDuMoteur(videoId: string, versionId: string, resultat: Pick<ResultatFabrication, "plans" | "sousTitres" | "pistes" | "elementsCrees">, langue: string, estDemo?: boolean) {
  const d = depots();
  const elementsParOrdre = new Map<number, string>();
  // Lot M5 : une illustration fabriquée pour cette vidéo compte déjà une utilisation (anti-répétition à 10 vidéos).
  const rang = resultat.elementsCrees?.length ? await rangDeLaVideo(videoId) : 0;
  for (const e of resultat.elementsCrees ?? []) {
    const { fichierCle, vignetteCle, planOrdre, ...reste } = e;
    const fichierId = await fichierProduit(fichierCle, fichierCle.endsWith(".mp4") ? "video/mp4" : "image/jpeg");
    const vignetteFichierId = vignetteCle ? await fichierProduit(vignetteCle, "image/jpeg") : undefined;
    const id = nouvelId("el");
    await d.elements.enregistrer({ origine: "fabriquee", ...reste, id, fichierId, vignetteFichierId, marqueId: "marque-axion", fabrique: true, utilisations: 1, derniereVideoId: videoId, dernierRangVideo: rang, ...horodatage(), estDemo });
    await journaliser("bibliotheque", `Illustration fabriquée rangée dans la Bibliothèque : ${reste.nom}`, { type: "element", id });
    if (planOrdre !== undefined) elementsParOrdre.set(planOrdre, id);
  }
  if (resultat.plans?.length) {
    const anciens = await d.plans.lister((p) => p.versionId === versionId);
    const archive = `${versionId}-avant-redecoupage-${Date.now()}`;
    // Copie d'archive sous un NOUVEL identifiant (les nouveaux plans reprennent les identifiants de la version),
    // puis l'ancienne ligne quitte la version : aucun plan n'est jamais écrasé ni supprimé.
    for (const p of anciens) {
      await d.plans.enregistrer({ ...p, id: `${archive}-plan-${p.ordre}`, versionId: archive });
      await d.plans.modifier(p.id, { versionId: `${archive}-remplace` });
    }
    for (const p of resultat.plans) {
      const elementCree = elementsParOrdre.get(p.ordre);
      const plan: Plan = {
        ...p,
        illustration: elementCree && p.illustration ? { ...p.illustration, elementId: elementCree } : p.illustration,
        id: `${versionId}-plan-${p.ordre}`,
        videoId,
        versionId,
        ...horodatage(),
        estDemo,
      };
      await d.plans.enregistrer(plan);
    }
  }
  if (resultat.sousTitres?.length) {
    const existants = await d.sousTitres.lister((s) => s.versionId === versionId);
    const version = Math.max(0, ...existants.map((s) => s.version)) + 1;
    const styleId = existants.sort((a, b) => b.version - a.version)[0]?.styleId;
    await d.sousTitres.enregistrer({ id: nouvelId("st"), videoId, versionId, langue, version, segments: resultat.sousTitres, styleId, ...horodatage(), estDemo });
  }
  for (const piste of resultat.pistes ?? []) {
    const { fichierCle, ...reste } = piste;
    const fichierId = await fichierProduit(fichierCle, piste.type === "audio-maitre" || piste.type === "voix" ? "audio/mpeg" : "video/mp4");
    await d.pistes.enregistrer({ ...reste, id: nouvelId("piste"), versionId, fichierId, ...horodatage(), estDemo });
  }
}

/**
 * Kit de la vidéo prête (hors verrou). Lot R2 : après la PREMIÈRE fabrication seulement (`textes`), et sur « Réécrire »,
 * Claude peut écrire les textes — une fois par vidéo, les réseaux par défaut, des textes d'essai intacts, par le chemin
 * de dépense de la vidéo. Après une retouche ou un recalque : rien n'est écrit, rien n'est payé.
 */
async function creerKitSiAbsent(videoId: string, textes: boolean) {
  const { genererKit } = await import("./publications");
  await genererKit(videoId, { autoriserDepense: textes });
  // Vidéos sur le site (lot S4) : envoi automatique d'une NOUVELLE vidéo, éteint par défaut ; ne lève jamais.
  if (textes) await (await import("./site-videos")).publicationAuto(videoId);
}

/* ------------------------------------------------------------------ */
/* Avancement (boucle de fond)                                         */
/* ------------------------------------------------------------------ */

/** Photo d'un travail prise sous le verrou : ce que le tour fera avancer hors verrou. */
export interface InstantaneTravail {
  travail: Travail;
  commande: CommandeFabrication;
  moteur: MoteurVideo;
}

/** Choix du moteur (injectable par les tests). Par défaut : le moteur FIGÉ dans la commande (B.0 §7). */
export type ChoixMoteur = (commande: CommandeFabrication) => MoteurVideo;

/** Concurrence réglable (`fabrication.concurrence`, défaut 2 vidéos en parallèle chez les fournisseurs). */
async function concurrence(): Promise<number> {
  return lireParametre<number>("fabrication.concurrence", CONCURRENCE_PAR_DEFAUT);
}

/**
 * Temps 1 — SOUS le verrou : les travaux à faire avancer maintenant (file, reprise programmée). Aucun réseau.
 * Mise en ligne (Will, 18/10) : un travail qui SORT DE LA FILE passe `en_cours` en base ICI, avant l'appel au moteur (la
 * première dépense part dans ce même tour). `mettre-a-jour.sh` n'attend que les travaux `en_cours` : avant, le premier
 * appel payant de chaque générateur partait alors que la base disait encore `en_file`.
 */
export async function lireTravauxAAvancer(instant: number = Date.now(), choisir: ChoixMoteur = moteurDeCommande): Promise<InstantaneTravail[]> {
  const d = depots();
  const actifs = await d.travaux.lister((t) => t.statut === "en_file" || t.statut === "en_cours");
  const { aAvancer } = calculerFile(actifs, await concurrence(), instant);
  // Mise en ligne en cours (bail posé par deploiement/commun.sh, lu dans la base) : aucun travail ne sort de la file.
  const pause = aAvancer.some((t) => t.statut === "en_file") && (await bailTenu(CLE_PAUSE_MISE_EN_LIGNE));
  const res: InstantaneTravail[] = [];
  for (const lu of aAvancer) {
    if (!peutAvancer(lu, instant)) continue;
    if (pause && lu.statut === "en_file") continue;
    const version = lu.versionId ? await d.versions.obtenir(lu.versionId) : null;
    if (!version) continue;
    // Moteur choisi AVANT de sortir de la file : un choix impossible ne laisse jamais un travail `en_cours` immobile.
    const moteur = choisir(version.commande);
    const t = lu.statut === "en_file" ? await sortirDeLaFile(lu, instant) : lu;
    const ratio = t.type === "reexport" ? (t.parametres?.ratio as Ratio | undefined) : undefined;
    const commande = ratio ? { ...version.commande, ratios: [ratio] } : version.commande;
    res.push({ travail: t, commande, moteur });
  }
  return res;
}

/**
 * Pause pendant une mise en ligne (relecture 18/10, 7a) : `mettre-a-jour.sh` pose ce bail dans la base entre sa dernière
 * lecture « 0 vidéo en cours » et le redémarrage (copie de la base comprise) ; il le lève après `up -d`, et il expire seul
 * (30 min). Même clé que CLE_PAUSE_FABRICATIONS dans deploiement/commun.sh.
 */
export const CLE_PAUSE_MISE_EN_LIGNE = "mise-en-ligne";

/** SOUS le verrou : le travail prend sa place (`en_cours`) ; la vidéo passe « en fabrication » (sauf un format ajouté). */
async function sortirDeLaFile(t: Travail, instant: number): Promise<Travail> {
  const d = depots();
  const iso = new Date(instant).toISOString();
  const pris = await d.travaux.enregistrer({ ...t, statut: "en_cours", debuteLe: t.debuteLe ?? iso, modifieLe: iso });
  if (t.type !== "reexport" && (await d.videos.obtenir(t.cibleId))) await d.videos.modifier(t.cibleId, { statut: "en_fabrication" });
  return pris;
}

/** Le travail est-il resté tel qu'on l'a lu (ni arrêté, ni relancé, ni écrit par un autre tour) ? */
function inchange(actuel: Travail | null, lu: Travail): actuel is Travail {
  return !!actuel && actuel.statut === lu.statut && actuel.tentatives === lu.tentatives && actuel.modifieLe === lu.modifieLe;
}

/**
 * CORRECTEUR 1 — B2 : seuls l'horodatage, la reprise programmée ou « passer devant » ont bougé pendant le tour (une
 * recharge déclarée avance la reprise, `apresRecharge`) : ni arrêté, ni relancé, ni avancé ailleurs. Le résultat du
 * tour (une voix PAYÉE…) reste valable : il est écrit au lieu d'être jeté (sinon la voix serait relue, donc repayée).
 */
function seulementReprogramme(actuel: Travail | null, lu: Travail): actuel is Travail {
  if (!actuel || actuel.statut !== lu.statut || actuel.tentatives !== lu.tentatives) return false;
  if (actuel.statut !== "en_cours" && actuel.statut !== "en_file") return false;
  const sans = (t: Travail) => JSON.stringify({ ...t, modifieLe: undefined, reprise: undefined, urgent: undefined });
  return sans(actuel) === sans(lu);
}

/** GV-EC-01b : le travail s'est arrêté pour attendre la validation de Williams (liste fermée de `sujets-traites.ts`). */
function enAttenteDeValidation(t: Pick<Travail, "erreur">): boolean {
  return !!t.erreur && familleDe(t.erreur.code) === "attente-validation";
}

/**
 * GV-EC-01e : la reprise d'une attente de validation est REFUSÉE (cas retiré ou déjà traité) : la réservation gardée ne
 * servira plus, elle est rendue au moment du refus (une fois ; idempotent). Une seule écriture : rien à séparer. Si le
 * refus tombe un jour (cas rétabli), la reprise réactive la réservation (`reactiverReservations`). Sans effet pour un
 * vrai échec (sa réservation est déjà rendue).
 */
export async function libererSiAttenteRefusee(travailId: string): Promise<void> {
  const t = await depots().travaux.obtenir(travailId);
  if (t && t.statut === "echec" && enAttenteDeValidation(t)) await libererReservation(travailId, "liberee");
}

/**
 * Temps 3 — SOUS le verrou : écrit ce que le moteur a renvoyé, SEULEMENT si le travail n'a pas changé depuis la lecture
 * (un « Arrêter » pendant le tour n'est jamais écrasé). Renvoie les suites à exécuter hors verrou.
 */
export async function ecrireAvancement(lu: InstantaneTravail, sortie: { travail: Travail; resultat?: ResultatFabrication }): Promise<{ ecrit: boolean; suites: SuiteFabrication[] }> {
  const d = depots();
  const t = lu.travail;
  const actuel = await d.travaux.obtenir(t.id);
  const valable = inchange(actuel, t) || seulementReprogramme(actuel, t);
  if (!valable || !actuel) {
    // CORRECTEUR 1 — B2 : arrêté ou relancé pendant le tour : rien n'est réécrit, mais ce que ce tour a PAYÉ (la voix
    // lue…) est enregistré en dépense (jamais deux fois : `lignesRestantes`).
    const present = actuel as Travail | null;
    if (present) await enregistrerDepensePayee(present, await lignesPayeesDuTravail(lu.moteur, sortie.travail, lu.commande), { versionAussi: present.type !== "reexport" });
    return { ecrit: false, suites: [] };
  }
  // Mise en ligne (Will, 18/10) : un travail sorti de la file ne redevient jamais `en_file` (certains moteurs le
  // renvoient tant qu'aucune étape n'a commencé, alors que l'appel payant est déjà parti).
  const statut = sortie.travail.statut === "en_file" && actuel.statut === "en_cours" ? "en_cours" : sortie.travail.statut;
  let travail: Travail = { ...sortie.travail, statut, reprise: undefined, estDemo: t.estDemo, urgent: actuel.urgent };
  // Relecture finale : les suites d'une fabrication terminée sont notées DANS cette écriture (jamais perdues par un arrêt).
  if (sortie.resultat && travail.statut === "termine" && travail.versionId) {
    const video = await d.videos.obtenir(travail.cibleId);
    const suites = video ? suitesDeFinition(travail, video) : [];
    if (suites.length) travail.finitionAFaire = suites;
    // GV2-38 : le résultat du moteur est gardé dans la MÊME écriture que « terminé » (jamais « terminé » sans la note).
    travail.finAAppliquer = { resultat: sortie.resultat, rejouee: false, faits: [] };
  }
  travail = gardeSansAvancement(travail, actuel, lu.moteur.id);
  await d.travaux.enregistrer(travail);
  // Un format ajouté ne touche ni le statut de la vidéo ni sa version : elle reste prête (et publiée).
  const reexport = t.type === "reexport";
  if (travail.statut === "echec" && t.statut !== "echec") {
    // GV-EC-01b : une attente de validation n'est pas un échec : la réservation est GARDÉE (elle sert à la reprise).
    const attente = enAttenteDeValidation(travail);
    if (!attente) await libererReservation(t.id, "liberee");
    // E2E-1 n° 3 : les étapes déjà payées (la voix lue…) sont enregistrées, comme à « Arrêter ».
    await enregistrerDepensePayee(travail, await lignesPayeesDuTravail(lu.moteur, travail, lu.commande), { versionAussi: !reexport });
    if (!reexport) {
      await d.videos.modifier(travail.cibleId, { statut: "echec" });
      if (t.versionId && (await d.versions.obtenir(t.versionId))) await d.versions.modifier(t.versionId, { statut: "echec" });
    }
    if (attente) {
      // Phrases fixes, sans montant : la vidéo dit seulement qu'elle est à relire.
      const carte = /CARTE/.test(travail.erreur?.code ?? "");
      await notifier({ type: "info", titre: carte ? "Une carte attend votre validation" : "Un script attend votre relecture", message: "Ouvrez la vidéo pour la valider : la fabrication reprendra ensuite.", lien: `/videos/${travail.cibleId}`, estDemo: t.estDemo });
      await journaliser("attente", `En attente de validation : ${travail.etapes.find((e) => e.statut === "echec")?.nom ?? "?"}`, { type: "video", id: travail.cibleId });
    } else {
      await notifier({ type: "echec", titre: "Une étape n'a pas abouti", message: travail.erreur?.messagePourWill, lien: `/videos/${travail.cibleId}`, estDemo: t.estDemo });
      await journaliser("echec", `Étape en échec : ${travail.etapes.find((e) => e.statut === "echec")?.nom ?? "?"}`, { type: "video", id: travail.cibleId });
    }
    // La ligne durable est écrite dans les deux cas ; pour une attente elle porte la famille `attente-validation`.
    await consignerEchec(travail, lu.commande);
  } else if (travail.statut === "en_cours" && t.statut === "en_file" && !reexport) {
    await d.videos.modifier(travail.cibleId, { statut: "en_fabrication" });
  }
  // E2E-1 n° 7 : pendant la fabrication, la réservation diminue de ce qui est déjà payé (la voix lue a déjà baissé le
  // solde réel : elle ne compte pas deux fois dans le « disponible »).
  if (travail.statut === "en_cours" || travail.statut === "en_file") {
    const payees = await lignesPayeesDuTravail(lu.moteur, travail, lu.commande);
    await deduireDejaPaye(t.id, payees);
    // E2E-2 argent n° 13 : ce qui est payé chez un fournisseur au solde LU (la voix HeyGen) est enregistré DÈS le
    // paiement, daté de ce moment : un relevé pris pendant la fabrication ne la compte plus deux fois (ni « recharge »
    // fantôme). La fin de la fabrication ne la recompte pas (`lignesRestantes`).
    const lues = payees.filter((l) => !ligneSimulee(l) && soldeLuChezLeFournisseur(l.fournisseur));
    if (lues.length) await enregistrerDepensePayee(travail, lues, { versionAussi: !reexport });
  }
  const suites = sortie.resultat ? await appliquerResultat(travail, sortie.resultat) : [];
  return { ecrit: true, suites };
}

/**
 * E2E-1 n° 1 (03/10) — SOUS le verrou : résultat d'un avancement revenu APRÈS son délai (lecture de voix longue). Le
 * travail n'a pas été relancé entre-temps (la boucle l'attendait) : son résultat est écrit, la voix payée est gardée.
 * Arrêté ou relancé pendant ce temps : rien n'est réécrit, mais ce qui a été payé est enregistré en dépense.
 */
export async function ecrireAvancementTardif(lu: InstantaneTravail, sortie: { travail: Travail; resultat?: ResultatFabrication }, options?: { abandonne?: boolean }): Promise<{ ecrit: boolean; suites: SuiteFabrication[] }> {
  const actuel = await depots().travaux.obtenir(lu.travail.id);
  if (!actuel) return { ecrit: false, suites: [] };
  if (options?.abandonne || actuel.tentatives !== lu.travail.tentatives || (actuel.statut !== "en_cours" && actuel.statut !== "en_file")) {
    await enregistrerDepensePayee(actuel, await lignesPayeesDuTravail(lu.moteur, sortie.travail, lu.commande), { versionAussi: actuel.type !== "reexport" });
    return { ecrit: false, suites: [] };
  }
  return ecrireAvancement({ ...lu, travail: actuel }, sortie);
}

/**
 * GV2-01 : refus revenu APRÈS le délai. L'erreur passagère a déjà été comptée au dépassement : rien à faire. Un refus
 * définitif échoue le travail tout de suite, avec la phrase du refus (au lieu de tourner 24 h puis « Délai dépassé »).
 * Rien non plus si le travail a changé entre-temps (arrêté, relancé) ou si l'appel a été abandonné (`abandonne`).
 */
export async function ecrirePanneTardive(lu: InstantaneTravail, erreur: unknown, options?: { abandonne?: boolean }): Promise<{ ecrit: boolean }> {
  if (options?.abandonne) return { ecrit: false };
  const actuel = await depots().travaux.obtenir(lu.travail.id);
  if (!actuel || actuel.tentatives !== lu.travail.tentatives || actuel.statut !== lu.travail.statut) return { ecrit: false };
  if (!lirePanne(erreur).definitive) return { ecrit: false };
  return ecrirePanne({ ...lu, travail: actuel }, erreur);
}

/** GV2-22 : `RangeError`, ou `TypeError` qui n'est pas une coupure réseau (sous Node, `fetch` coupé lève `TypeError("fetch failed")`). */
function estErreurDeProgrammation(e: unknown): boolean {
  if (e instanceof RangeError) return true;
  if (!(e instanceof TypeError)) return false;
  if (/fetch|réseau|reseau|network|socket|ECONN|ETIMEDOUT/i.test(e.message)) return false;
  const cause = (e as { cause?: unknown }).cause;
  return !(cause instanceof Error || (typeof cause === "object" && cause !== null && "code" in cause));
}

/** Erreur jetée par un moteur ou un fournisseur : `reessayable: false` = refus définitif (pas de reprise). */
function lirePanne(e: unknown): { message: string; definitive: boolean; pourWill?: string } {
  const x = e as { message?: string; messagePourWill?: string; reessayable?: boolean; erreur?: { reessayable?: boolean; message?: string } } | null;
  const reessayable = x?.reessayable ?? x?.erreur?.reessayable;
  const message = x?.erreur?.message ?? x?.message ?? String(e);
  // Vérification E2E n° 1 (parcours E) : la raison d'un refus définitif est gardée pour Will quand elle est déjà une
  // phrase simple (ErreurLisible, ErreurFournisseur.message, messagePourWill du moteur) ; sinon phrase fixe.
  const candidate = x?.messagePourWill ?? message;
  return { message, definitive: reessayable === false || (reessayable === undefined && estErreurDeProgrammation(e)), pourWill: phraseLisible(candidate) ? candidate.trim() : undefined };
}

/**
 * Temps 3 bis — SOUS le verrou : une panne du fournisseur (5xx, délai dépassé). 3 nouvelles tentatives espacées,
 * puis « en attente du fournisseur » (relance toutes les 10 min), puis échec et notification après 24 h.
 * Aucune étape terminée n'est refaite.
 */
export async function ecrirePanne(lu: InstantaneTravail, erreur: unknown, instant: number = Date.now()): Promise<{ ecrit: boolean }> {
  const d = depots();
  const t = lu.travail;
  const actuel = await d.travaux.obtenir(t.id);
  if (!inchange(actuel, t)) return { ecrit: false };
  const { message, definitive, pourWill } = lirePanne(erreur);
  const iso = new Date(instant).toISOString();
  // Lot « crédits » : un fournisseur répond « crédit insuffisant » → « en attente de crédit ». Rien n'est perdu (les
  // étapes faites sont gardées) ni repayé (l'appel refusé n'a rien coûté) ; reprise dès la recharge (déclarée ou lue),
  // sinon un nouvel essai gratuit toutes les heures. Jamais d'échec au bout de 24 h : Will peut « Arrêter ».
  if (estCreditInsuffisant(erreur)) {
    const fournisseurCredit = fournisseurDeLErreur(erreur, t.fournisseurUtilise);
    const entre = t.reprise?.motif !== "credit";
    await d.travaux.enregistrer({
      ...actuel,
      reprise: {
        echecs: (t.reprise?.echecs ?? 0) + 1,
        premiereLe: t.reprise?.premiereLe ?? iso,
        attenteDepuis: t.reprise?.attenteDepuis ?? iso,
        prochainEssai: new Date(instant + RELANCE_ATTENTE_CREDIT_MS).toISOString(),
        derniereErreur: message.slice(0, 200),
        motif: "credit",
        fournisseurCredit,
      },
      modifieLe: iso,
    });
    if (entre) await signalerAttenteCredit(await d.videos.obtenir(t.cibleId), fournisseurCredit, t.estDemo);
    return { ecrit: true };
  }
  const suite = definitive ? { reprise: t.reprise, abandon: true } : apresPanne(t.reprise, instant, message);
  if (suite.abandon) {
    const enCours = t.etapes.find((e) => e.statut === "en_cours") ?? t.etapes.find((e) => e.statut === "en_attente");
    const erreurTravail = {
      code: definitive ? "FOURNISSEUR_REFUS" : "FOURNISSEUR_INDISPONIBLE",
      reessayable: true,
      messagePourWill: (definitive && pourWill) || phraseDEchec({ outil: nomFournisseur(fournisseurDeLErreur(erreur, t.fournisseurUtilise)), message, definitive }),
      detailTechnique: message,
    };
    const travail: Travail = {
      ...t,
      statut: "echec",
      erreur: erreurTravail,
      reprise: undefined,
      etapes: t.etapes.map((e) => (e.cle === enCours?.cle ? { ...e, statut: "echec" as const, erreur: erreurTravail } : e)),
      modifieLe: iso,
    };
    await d.travaux.enregistrer(travail);
    await libererReservation(t.id, "liberee");
    // E2E-1 n° 3 : ce qui est déjà payé (la voix lue…) est enregistré, comme à « Arrêter ».
    await enregistrerDepensePayee(travail, await lignesPayeesDuTravail(lu.moteur, travail, lu.commande), { versionAussi: t.type !== "reexport" });
    if (t.type !== "reexport") {
      await d.videos.modifier(t.cibleId, { statut: "echec" });
      if (t.versionId && (await d.versions.obtenir(t.versionId))) await d.versions.modifier(t.versionId, { statut: "echec" });
    }
    await notifier({ type: "echec", titre: "Une étape n'a pas abouti", message: erreurTravail.messagePourWill, lien: `/videos/${t.cibleId}`, estDemo: t.estDemo });
    // Le message du fournisseur (souvent technique) va en console serveur ; le Journal garde la phrase pour Will.
    console.warn(`[travaux] ${t.id} abandonné : ${message.slice(0, 300)}`);
    await journaliser("echec", erreurTravail.messagePourWill, { type: "video", id: t.cibleId });
    await consignerEchec(travail, lu.commande);
    return { ecrit: true };
  }
  const entreEnAttente = !!suite.reprise?.attenteDepuis && !t.reprise?.attenteDepuis;
  await d.travaux.enregistrer({ ...actuel, reprise: suite.reprise, modifieLe: iso });
  if (entreEnAttente) {
    await journaliser("fabrication", "Fabrication ralentie chez un outil : reprise automatique", { type: "video", id: t.cibleId });
    // GV2-22 : le fondateur est prévenu dès l'entrée en attente (une seule fois par entrée), pas 24 h plus tard.
    const outil = t.fournisseurUtilise ? ` (${nomFournisseur(fournisseurDeLErreur(erreur, t.fournisseurUtilise))})` : "";
    await notifier({ type: "info", titre: "Une vidéo attend un outil", message: `Votre vidéo « ${t.titre} » attend un outil${outil} : elle reprendra seule.`, lien: `/videos/${t.cibleId}`, estDemo: t.estDemo });
  }
  return { ecrit: true };
}

/**
 * Fait avancer tous les travaux actifs UNE fois. C'est exactement un tour de la boucle de fond
 * (`services/boucle.ts`) ; gardé pour les tests et les appels ponctuels.
 */
export async function avancerTravaux(): Promise<void> {
  const { tourDeBoucle } = await import("./boucle");
  await tourDeBoucle();
}

/* ------------------------------------------------------------------ */
/* Affichage                                                           */
/* ------------------------------------------------------------------ */

async function versVue(t: Travail, place?: { rang: number; debutEstime: number }): Promise<VueTravail> {
  const instant = Date.now();
  const video = await depots().videos.obtenir(t.cibleId);
  const sortie = video ? await depots().sorties.trouver((s) => s.videoId === video.id) : null;
  const actif = t.statut === "en_cours" || t.statut === "en_file";
  const fin = actif ? finEstimee(t, instant) : instant;
  const vignetteParDefaut = video ? trouverFormat(video.formatId)?.exemples[0]?.vignette ?? null : null;
  // Mode abonnements et comptes utilisables : calculés une fois (seulement pour une attente de crédit).
  const modeAbonnements = t.reprise?.motif === "credit" ? (await lireReglageSourcesClaude()).mode === "abonnements" : false;
  const abonnementsClaude = t.reprise?.motif === "credit" ? await abonnementsClaudeActifs() : undefined;
  return {
    ...t,
    lien: video ? `/videos/${video.id}` : "/",
    resteSec: actif ? Math.max(0, Math.round((fin - instant) / 1000)) : 0,
    resteMin: actif ? minutesRestantes(t, instant) : 0,
    heureFin: actif ? formaterHeure(fin) : undefined,
    depense: depenseDesEtapes(t.etapes),
    rang: place?.rang,
    debutVers: place ? formaterHeure(place.debutEstime) : undefined,
    enAttenteFournisseur: !!t.reprise?.attenteDepuis && t.reprise.motif !== "credit",
    abonnementsClaude: abonnementsClaude,
    aucunCompteClaude: abonnementsClaude === undefined ? undefined : modeAbonnements && !abonnementsClaude,
    attenteCredit: t.reprise?.motif === "credit" ? nomFournisseur(t.reprise.fournisseurCredit ?? "") : undefined,
    boucleActive: boucleActive(),
    videoTitre: video?.titre,
    vignette: (await urlFichier(video?.miniatureChoisieId ? (await depots().miniatures.obtenir(video.miniatureChoisieId))?.fichierId : null)) ?? (sortie ? await urlFichier(sortie.vignetteFichierId) : vignetteParDefaut),
  };
}

/** Places dans la file des travaux qui attendent leur tour. */
async function placesDansLaFile(): Promise<Map<string, { rang: number; debutEstime: number }>> {
  const actifs = await depots().travaux.lister((t) => t.statut === "en_file" || t.statut === "en_cours");
  return calculerFile(actifs, await concurrence(), Date.now()).enAttente;
}

/**
 * Travail SANS ses gros paramètres (`parametres.tableau` : le tableau animé, jusqu'à plusieurs Mo par travail). L'écran
 * des travaux (appelé toutes les quelques secondes) n'en lit rien ; les copier à chaque appel remplissait le tas.
 * Rien n'est modifié ni supprimé dans le dépôt : seule la COPIE rendue est allégée.
 */
export function allegerTravail(t: Travail): Travail {
  // GV2-38 : la note de fin à appliquer (résultat du moteur) ne part jamais vers l'écran.
  const sans: Travail = t.finAAppliquer ? { ...t, finAAppliquer: undefined } : t;
  const p = sans.parametres as Record<string, unknown> | undefined;
  if (!p || !("tableau" in p)) return sans;
  const { tableau: _gros, ...reste } = p;
  void _gros;
  return { ...sans, parametres: reste } as Travail;
}

/** Le filtre de listerTravaux, en y ajoutant (ou non) la cible : actifs + en échec + terminés (récents, ou tous). */
async function lireTravauxAffiches(options: { inclureTermines?: boolean }, cibleId?: string): Promise<VueTravail[]> {
  const limite = Date.now() - 2 * 60 * 1000;
  // « Afficher les exemples » désactivé : les travaux des vidéos d'exemple sont masqués aussi.
  const exemples = await filtreExemples<Travail>();
  const travaux = await depots().travaux.lister(
    (t) =>
      (cibleId === undefined || t.cibleId === cibleId) &&
      exemples(t) &&
      (t.statut === "en_cours" ||
        t.statut === "en_file" ||
        t.statut === "echec" ||
        (t.statut === "termine" && (options.inclureTermines || new Date(t.termineLe ?? 0).getTime() > limite))),
    allegerTravail,
  );
  travaux.sort((a, b) => b.creeLe.localeCompare(a.creeLe));
  const places = await placesDansLaFile();
  // Accueil seulement : pas d'échec périmé (vidéo archivée, prête, absente, ou travail plus récent). Rien n'est effacé.
  const affiches = cibleId === undefined ? await sansEchecsPerimes(travaux) : travaux;
  return Promise.all(affiches.map((t) => versVue(t, places.get(t.id))));
}

async function sansEchecsPerimes(travaux: Travail[]): Promise<Travail[]> {
  const echecs = travaux.filter((t) => t.statut === "echec");
  if (!echecs.length) return travaux;
  const d = depots();
  // Lecture limitée aux vidéos des échecs affichés (pas toutes les vidéos ni tous les travaux).
  const cibles = new Set(echecs.map((t) => t.cibleId).filter((id): id is string => typeof id === "string"));
  const videos = new Map<string, Video | null | undefined>(await Promise.all([...cibles].map(async (id) => [id, await d.videos.obtenir(id)] as const)));
  // Le travail le plus récent de chaque vidéo, tous statuts confondus (un ancien terminé compte aussi), SAUF les ré-exports de
  // format : ils n'effacent pas un échec de fabrication ou de retouche.
  const dernier = new Map<string, string>();
  for (const x of await d.travaux.lister((t) => cibles.has(t.cibleId) && t.type !== "reexport", (t) => ({ id: t.id, cibleId: t.cibleId, creeLe: t.creeLe }) as Travail)) {
    if ((dernier.get(x.cibleId) ?? "") < x.creeLe) dernier.set(x.cibleId, x.creeLe);
  }
  return travaux.filter((t) => travailAfficheALAccueil(t, videos.get(t.cibleId), (dernier.get(t.cibleId) ?? "") > t.creeLe));
}

/** Travaux à afficher : actifs + en échec + terminés depuis moins de 2 minutes. N'avance rien (la boucle de fond s'en charge). */
export async function listerTravaux(options: { inclureTermines?: boolean } = {}): Promise<VueTravail[]> {
  return lireTravauxAffiches(options);
}

/**
 * Les travaux d'UNE vidéo (même filtre que `listerTravaux({ inclureTermines: true })`, restreint à `cibleId`) : la fiche
 * d'une vidéo n'a pas besoin de recopier ceux de tout le studio (lot P, 08/11).
 */
export async function travauxDeLaCible(cibleId: string): Promise<VueTravail[]> {
  return lireTravauxAffiches({ inclureTermines: true }, cibleId);
}

export async function obtenirTravail(id: string): Promise<VueTravail | null> {
  const t = await depots().travaux.obtenir(id);
  if (!t) return null;
  return versVue(t, (await placesDansLaFile()).get(t.id));
}

/**
 * TEST-UI-REEL U7 (CORRECTEUR UI2) : la DERNIÈRE fabrication d'une vidéo, quel que soit son état et son âge. L'écran
 * « Je fabrique votre vidéo » la suit même sans identifiant de travail (page rouverte après la fin, travail terminé
 * depuis plus de 2 minutes, identifiant d'un ancien travail) : il ne reste plus sur des blocs gris.
 */
export async function derniereFabricationDeLaVideo(videoId: string): Promise<VueTravail | null> {
  const liste = await depots().travaux.lister((t) => t.cibleId === videoId && t.type === "fabrication");
  const t = liste.sort((a, b) => b.creeLe.localeCompare(a.creeLe))[0];
  if (!t) return null;
  return versVue(t, (await placesDansLaFile()).get(t.id));
}

/**
 * CORRECTEUR 1 — B5 : ce qu'une relance peut encore coûter, une fois retiré ce qui est déjà payé pour ce travail
 * (estimation du moteur selon le type de travail, moins les dépenses déjà enregistrées). Aucun appel réseau.
 */
async function estimationRestante(t: Travail): Promise<{ lignes: LigneCout[]; total: Montant }> {
  const d = depots();
  const version = t.versionId ? await d.versions.obtenir(t.versionId) : null;
  if (!version) return { lignes: [], total: additionner() };
  const moteur = moteurDeCommande(version.commande);
  const ratio = t.parametres?.ratio as Ratio | undefined;
  const planIds = t.parametres?.planIds as string[] | undefined;
  const estimation =
    t.type === "fabrication"
      ? await moteur.estimer(version.commande)
      : t.type === "reexport" && ratio
        ? await moteur.estimerReexport(version.commande, ratio)
        : t.type === "retouche" && planIds
          ? await moteur.estimerRetouche(version.commande, planIds, { travail: t })
          : null;
  if (!estimation) return { lignes: [], total: additionner() };
  const deja = (await d.depenses.lister((x) => x.travailId === t.id)).flatMap((x) => x.lignes);
  // Une ligne à 0 € (la voix HeyGen se compte en caractères) n'apparaît jamais en dépense : elle reste due tant que
  // son étape n'est pas terminée.
  const finies = new Set(t.etapes.filter((e) => e.statut === "terminee").map((e) => e.cle));
  const gratuites = estimation.lignes.filter((l) => l.total.centimes === 0 && !finies.has(cleEtapeDeLigne(l.etape)));
  const lignes = [...gratuites, ...lignesRestantes(estimation.lignes, deja)];
  return { lignes, total: additionner(...lignes.map((l) => l.total)) };
}

/**
 * « Réessayer » : ne relance que les étapes en échec (AV2.2-4). Sous le même verrou que la boucle.
 * CORRECTEUR 1 — B5 : AVANT de réactiver, le budget du mois et les crédits sont revérifiés sur le coût RESTANT
 * (`BUDGET_DEPASSE`, `CONFIRMATION_REQUISE` au-delà du seuil, `CREDIT_INSUFFISANT`) : un travail en échec le mois
 * dernier ne repart pas si le plafond est atteint ou le crédit épuisé.
 * L3-01 (audit, interblocage) : verrou des crédits PUIS verrou de la boucle, jamais l'inverse (le pré-vol peut lire une
 * recharge, et `apresRecharge` prend alors le verrou de la boucle sous celui des crédits).
 */
export async function reessayerTravail(id: string, options: { confirme?: AccordPrix } = {}): Promise<VueTravail> {
  await exigerSession();
  const avant = await depots().travaux.obtenir(id);
  if (!avant) throw new ErreurStudio("INTROUVABLE", "Ce travail n'existe plus.");
  if (avant.statut !== "echec") throw new ErreurStudio("PAS_EN_ECHEC", "Ce travail n'est pas en échec.");
  // Coût restant et origine lus hors verrous ; contrôlés plus bas, sous le verrou des crédits.
  const restant = await estimationRestante(avant);
  const versionAvant = avant.versionId ? await depots().versions.obtenir(avant.versionId) : null;
  // Cas concret déjà traité par une AUTRE vidéo : la panne de celle-ci ne se relance pas (jamais deux vidéos identiques).
  const videoAvant = versionAvant?.commande.formatId === "cas-concret" ? await depots().videos.obtenir(avant.cibleId) : null;
  if (videoAvant && versionAvant && !videoAvant.estDemo && !videoAvant.sourceVideoId && !videoAvant.typeDerive && !TRAVAUX_SUR_VIDEO_FINIE.includes(avant.type)) {
    const { refusCasDejaTraite } = await import("./cas-concret-traites");
    const phrase = await refusCasDejaTraite(versionAvant.commande.entrees, avant.cibleId);
    if (phrase) {
      await libererSiAttenteRefusee(id);
      throw new ErreurStudio("CAS_TRAITE", phrase);
    }
    // Cas retiré par Will : la panne ou la pause de cette vidéo ne se relance pas (rien n'est dépensé).
    const retire = await (await import("./cas-concret-retires")).refusCasRetire(versionAvant.commande.entrees);
    if (retire) {
      await libererSiAttenteRefusee(id);
      throw new ErreurStudio("CAS_RETIRE", retire);
    }
  }
  // L3-01 : contrôle du budget du mois (origine de la commande) et des crédits sur le coût RESTANT, réactivation de la
  // réservation et de l'engagement, puis le travail repart, d'un seul tenant sous le verrou des crédits. Le prix du
  // double a été confirmé au lancement : seul le seuil habituel redemande une confirmation.
  const lancer = (reactiver: () => Promise<void>, exigerReservationActive = false) =>
    sousVerrou(async () => {
      const d = depots();
      const t = await d.travaux.obtenir(id);
      if (!t) throw new ErreurStudio("INTROUVABLE", "Ce travail n'existe plus.");
      if (t.statut !== "echec") throw new ErreurStudio("PAS_EN_ECHEC", "Ce travail n'est pas en échec.");
      // GV-EC-01f : une attente de validation ne repart pas si elle a été remplacée (un autre travail plus récent, en file
      // ou en cours, sur la même vidéo) ou si sa vidéo est à la corbeille : rien n'est réactivé.
      if (enAttenteDeValidation(t)) {
        const autres = await d.travaux.lister((x) => x.cibleId === t.cibleId && x.id !== t.id);
        // GV-EC-01g : seule une FABRICATION plus récente remplace pour de bon (réservation rendue avant le refus, idempotent) ;
        // un autre travail en file ou en cours (tout type) est un refus TEMPORAIRE (réservation gardée) ; un réexport ou une
        // retouche terminé ou en échec ne bloque pas.
        if (autres.some((x) => x.type === "fabrication" && x.creeLe > t.creeLe)) {
          await libererReservation(t.id, "liberee");
          throw new ErreurStudio("PAS_EN_ECHEC", "Ce travail a été remplacé. Rouvrez la page.");
        }
        if (autres.some((x) => x.statut === "en_cours" || x.statut === "en_file")) throw new ErreurStudio("PAS_EN_ECHEC", "Un autre travail de cette vidéo est en cours. Réessayez quand il sera fini.");
        const v = await d.videos.obtenir(t.cibleId);
        if (v?.corbeilleLe) throw new ErreurStudio("PAS_EN_ECHEC", "Cette vidéo est dans la corbeille. Restaurez-la d'abord.");
      }
      // Relancé entre-temps ailleurs (autre onglet) puis de nouveau en échec : le contrôle fait plus haut ne vaut plus.
      if (avant.tentatives !== t.tentatives || avant.versionId !== t.versionId) throw new ErreurStudio("PAS_EN_ECHEC", "Ce travail a changé. Rouvrez la page puis réessayez.");
      const version = t.versionId ? await d.versions.obtenir(t.versionId) : null;
      // Réglage `casConcret.retouches` : relu avant d'interroger le moteur (son refus est synchrone).
      if (version) await preparerReglagesMoteur(version.commande);
      const moteur = moteurDeCommande(version?.commande ?? { formatId: "" });
      // CORRECTEUR 1 — B1 : une retouche que ce moteur ne sait pas faire pour de vrai n'est jamais relancée.
      if (t.type === "retouche" && (!moteur.capacites.retoucheParPlan || (version && moteur.refusRetouche?.(version.commande))) && !t.estDemo) {
        const { RETOUCHE_PAS_DISPONIBLE } = await import("./fabrication");
        throw new ErreurStudio("RETOUCHE_INDISPONIBLE", RETOUCHE_PAS_DISPONIBLE);
      }
      // GV-EC-01i : voie (b) — la réservation active lue avant le verrou est relue ici ; si elle a été rendue entre-temps
      // (corbeille puis restauration), rien n'est réactivé sans contrôle de budget.
      if (exigerReservationActive && (await d.reservations.compter((x) => x.travailId === id && x.statut === "active")) === 0) throw new ErreurStudio("PAS_EN_ECHEC", "Ce travail a changé. Rouvrez la page puis réessayez.");
      await consignerEchec(t, version?.commande ?? { formatId: "" });
      const r: Travail = { ...(await moteur.reessayer(t)), reprise: undefined };
      await reactiver();
      await d.travaux.enregistrer(r);
      if (t.type !== "reexport") {
        await d.videos.modifier(t.cibleId, { statut: "en_fabrication" });
        if (version) await d.versions.modifier(version.id, { statut: "en_fabrication" });
      }
      await journaliser("fabrication", "Étape relancée", { type: "video", id: t.cibleId });
      return r;
    });
  // GV-EC-01b : la reprise d'une ATTENTE DE VALIDATION ne repasse par aucun contrôle de budget ni de quota (commande de
  // Williams comme commande de l'usine) : la réservation a été gardée, il n'y a rien à revérifier. Un vrai échec garde
  // son contrôle d'avant.
  // GV-EC-01h : seule une réservation restée ACTIVE sans interruption est reprise sans contrôle. Si toutes ont été rendues
  // entre-temps (vidéo à la corbeille puis restaurée), c'est un nouvel engagement : il passe par le contrôle selon l'origine
  // (Studio : jamais refusé pour un montant ; usine : refusé en cas de dépassement). Un refus laisse l'attente intacte.
  const reservationActive = enAttenteDeValidation(avant) && (await depots().reservations.compter((r) => r.travailId === id && r.statut === "active")) > 0;
  const relance = reservationActive
    ? await lancer(() => reactiverReservations(id), true)
    : await reactiverSelonOrigine(versionAvant?.commande.origine, id, restant, options.confirme, "Cette relance", { doubleDejaConfirme: true }, lancer);
  return versVue(relance);
}

/** « Passer devant » : le travail prend la première place de la file (B.9 ter, priorité « urgent »). */
export async function rendreUrgent(id: string): Promise<void> {
  await exigerSession();
  await sousVerrou(async () => {
    const d = depots();
    const t = await d.travaux.obtenir(id);
    if (!t || (t.statut !== "en_file" && t.statut !== "en_cours") || t.urgent) return;
    await d.travaux.enregistrer({ ...t, urgent: true });
    await journaliser("fabrication", "Passée devant dans la file", { type: "video", id: t.cibleId });
  });
}

/** Délai maximal de l'annulation chez un fournisseur. */
const DELAI_ANNULATION_MS = 30_000;

/** Annulation locale (moteur sans `annuler`, ou fournisseur injoignable) : les étapes terminées restent payées. */
function annulationLocale(t: Travail, instant: number): Travail {
  const iso = new Date(instant).toISOString();
  return {
    ...t,
    statut: "annule",
    erreur: undefined,
    reprise: undefined,
    modifieLe: iso,
    termineLe: iso,
    etapes: t.etapes.map((e) => (e.statut === "terminee" ? e : { ...e, statut: "ignoree" as const, planifie: undefined, erreur: undefined })),
  };
}

/**
 * « Arrêter » (B.9 ter) : le moteur annule chez le fournisseur si possible (HORS verrou, délai max 30 s), puis,
 * SOUS le verrou, le travail passe « annulé », la vidéo « annulée » (« Reprendre » la remettra en brouillon),
 * et une dépense est enregistrée pour les SEULES étapes terminées (y compris celles finies entre-temps).
 */
export async function annulerTravail(id: string, choisir: ChoixMoteur = moteurDeCommande): Promise<{ depense: Montant } | null> {
  await exigerSession();
  const lu = await sousVerrou(async () => {
    const d = depots();
    const t = await d.travaux.obtenir(id);
    if (!t || t.statut === "termine" || t.statut === "annule") return null;
    const version = t.versionId ? await d.versions.obtenir(t.versionId) : null;
    return { t, commande: version?.commande ?? null, moteur: choisir(version?.commande ?? ({ formatId: "" } as CommandeFabrication)) };
  });
  if (!lu) return null;
  let annule: Travail;
  try {
    annule = lu.moteur.annuler ? await avecDelai(lu.moteur.annuler(lu.t), DELAI_ANNULATION_MS) : annulationLocale(lu.t, Date.now());
  } catch {
    annule = annulationLocale(lu.t, Date.now());
  }
  return sousVerrou(async () => {
    const d = depots();
    const actuel = await d.travaux.obtenir(id);
    if (!actuel || actuel.statut === "termine" || actuel.statut === "annule") return null;
    // Une étape terminée par la boucle pendant l'annulation reste terminée et payée.
    const etapes = annule.etapes.map((e) => {
      const a = actuel.etapes.find((x) => x.cle === e.cle);
      return a?.statut === "terminee" ? a : e;
    });
    const arrete: Travail = { ...annule, statut: "annule", etapes, reprise: undefined, estDemo: actuel.estDemo };
    await d.travaux.enregistrer(arrete);
    await libererReservation(actuel.id, "liberee");
    // E2E-1 n° 8 : chaque ligne porte le fournisseur RÉEL de l'étape (HeyGen pour la voix…), plus « montage-avocat ».
    // La voix déjà lue compte même si son étape n'est pas finie (elle est payée) ; jamais deux fois.
    const lignes = await lignesPayeesDuTravail(lu.moteur, { ...arrete, parametres: actuel.parametres ?? arrete.parametres }, lu.commande);
    await enregistrerDepensePayee({ ...arrete, versionId: actuel.versionId, cibleId: actuel.cibleId, id: actuel.id }, lignes);
    // Ce que ce travail a coûté en tout (E2E-2 argent n° 13 : la voix lue a pu être enregistrée dès son paiement).
    const total = additionner(...(await d.depenses.lister((x) => x.travailId === actuel.id)).map((x) => x.total));
    const video = await d.videos.obtenir(actuel.cibleId);
    const version = actuel.versionId ? await d.versions.obtenir(actuel.versionId) : null;
    // Annuler un format ajouté laisse la vidéo telle qu'elle était.
    if (actuel.type !== "reexport") {
      if (video) await d.videos.modifier(video.id, { statut: "annulee" });
      if (version) await d.versions.modifier(version.id, { statut: "annulee" });
    }
    await journaliser("fabrication", total.centimes > 0 ? "Fabrication arrêtée (étapes faites payées)" : "Fabrication arrêtée", { type: "video", id: actuel.cibleId });
    return { depense: total };
  });
}

/** Rejette si `promesse` dépasse `ms` (erreur réessayable). */
export function avecDelai<T>(promesse: Promise<T>, ms: number): Promise<T> {
  let minuterie: ReturnType<typeof setTimeout> | undefined;
  const delai = new Promise<never>((_, rejeter) => {
    minuterie = setTimeout(() => rejeter(Object.assign(new Error(`Délai de ${Math.round(ms / 1000)} s dépassé`), { reessayable: true, delaiDepasse: true })), ms);
  });
  return Promise.race([promesse, delai]).finally(() => clearTimeout(minuterie));
}

/**
 * Accueil seulement : faut-il montrer ce travail ? Un travail actif (en cours, en file) ou terminé se montre toujours.
 * Un travail EN ÉCHEC se masque (sans rien effacer) quand sa vidéo est absente ou archivée (ou prête, pour une fabrication seulement), ou qu'un travail plus
 * récent existe pour la même vidéo. `video` : `undefined` = introuvable. PUR.
 */
export function travailAfficheALAccueil(t: Pick<Travail, "statut" | "type">, video: Pick<Video, "statut"> | null | undefined, plusRecent: boolean): boolean {
  if (t.statut !== "echec") return true;
  if (!video || video.statut === "archivee") return false;
  // Vidéo prête : seul un échec de FABRICATION est périmé (la vidéo existe). Une retouche ou un recalque en échec reste visible.
  if (video.statut === "prete" && t.type === "fabrication") return false;
  return !plusRecent;
}

/* ------------------------------------------------------------------ */
/* GV2-01 : chien de garde commun (appel qui ne revient jamais, plus d'avancement)  */
/* ------------------------------------------------------------------ */

/** Écart maximal entre deux observations de l'état d'un travail pour que « sans nouvelle » continue de compter. */
const ECART_MAX_ENTRE_VUES_MS = 15 * 60_000;

/** Âge maximal d'un appel resté « en vol » après son délai. Au-dessus des plus longues étapes légitimes (10 min). */
export const AGE_MAX_EN_VOL_MS = 30 * 60_000;

const cleEnVolDepuis = Symbol.for("studio-axion-ia.avancements-en-vol-depuis");
const cleAbandonnes = Symbol.for("studio-axion-ia.avancements-abandonnes");
const cleVoixSignalees = Symbol.for("studio-axion-ia.avancements-voix-signalees");
type GlobalGarde = typeof globalThis & { [cleEnVolDepuis]?: Map<string, { depuis: number; lu: InstantaneTravail }>; [cleAbandonnes]?: Set<InstantaneTravail>; [cleVoixSignalees]?: Set<string> };

/** Heure d'entrée des appels en vol après un délai dépassé (en mémoire, à côté de `avancementsEnVol()`). */
export function avancementsEnVolDepuis(): Map<string, { depuis: number; lu: InstantaneTravail }> {
  const g = globalThis as GlobalGarde;
  g[cleEnVolDepuis] ??= new Map();
  return g[cleEnVolDepuis];
}
/** Appels abandonnés (identifiés par leur lecture, pas par le seul travail : une nouvelle tentative ne les confond pas). */
function appelsAbandonnes(): Set<InstantaneTravail> {
  const g = globalThis as GlobalGarde;
  g[cleAbandonnes] ??= new Set();
  return g[cleAbandonnes];
}
function voixSignalees(): Set<string> {
  const g = globalThis as GlobalGarde;
  g[cleVoixSignalees] ??= new Set();
  return g[cleVoixSignalees];
}

/**
 * Après un délai dépassé : l'appel continue seul. Suit son retour (résultat écrit, refus définitif écrit, erreur
 * journalisée jamais avalée) et tient à jour la marque « en vol » et son heure d'entrée.
 */
export function suivreRetourTardif(lu: InstantaneTravail, appel: Promise<{ travail: Travail; resultat?: ResultatFabrication }>, enVol: Map<string, Promise<void>>, retirerMarque: () => Promise<void>): void {
  const id = lu.travail.id;
  const retour: Promise<void> = appel
    .then(
      async (tardive) => {
        const r = await sousVerrou(() => ecrireAvancementTardif(lu, tardive, { abandonne: appelsAbandonnes().has(lu) }));
        await retirerMarque();
        if (r.suites.length) await executerSuites(r.suites);
      },
      async (refus: unknown) => {
        await sousVerrou(() => ecrirePanneTardive(lu, refus, { abandonne: appelsAbandonnes().has(lu) }));
        await retirerMarque();
      },
    )
    .catch((e: unknown) => journaliser("echec", `Retour tardif d'une étape non écrit : ${e instanceof Error ? e.name : "erreur"}`, { type: "video", id: lu.travail.cibleId }).catch(() => undefined))
    .finally(() => {
      appelsAbandonnes().delete(lu);
      if (avancementsEnVolDepuis().get(id)?.lu === lu) {
        avancementsEnVolDepuis().delete(id);
        voixSignalees().delete(id);
      }
      if (enVol.get(id) === retour) enVol.delete(id);
    });
  enVol.set(id, retour);
  avancementsEnVolDepuis().set(id, { depuis: Date.now(), lu });
}

/**
 * En tête d'un tour : un appel en vol depuis plus de `AGE_MAX_EN_VOL_MS` est abandonné (panne réessayable comptée, le
 * travail repart), SAUF si une lecture de voix (payée) est en vol pour lui : alors rien n'est relancé (jamais de voix
 * payée deux fois), une seule ligne au journal. `voixEnVol` : décidé par la boucle (qui connaît la marque de voix).
 */
export async function abandonnerAppelsFiges(enVol: Map<string, Promise<void>>, voixEnVol: (lu: InstantaneTravail) => Promise<boolean>, instant: number = Date.now()): Promise<void> {
  for (const [id, entree] of [...avancementsEnVolDepuis()]) {
    if (instant - entree.depuis < AGE_MAX_EN_VOL_MS) continue;
    if (await voixEnVol(entree.lu)) {
      if (!voixSignalees().has(id)) {
        voixSignalees().add(id);
        await journaliser("fabrication", "Une lecture de voix ne répond plus depuis 30 min : elle n'est pas relancée (voix déjà payée)", { type: "video", id: entree.lu.travail.cibleId });
      }
      continue;
    }
    try {
      await sousVerrou(async () => {
        const actuel = await depots().travaux.obtenir(id);
        if (actuel) await ecrirePanne({ ...entree.lu, travail: actuel }, { message: "L'étape ne répond plus depuis 30 min.", reessayable: true }, instant);
      });
    } catch (e) {
      console.error("[studio] abandon d'un appel figé en échec", e instanceof Error ? e.name : "");
      continue;
    }
    appelsAbandonnes().add(entree.lu);
    enVol.delete(id);
    avancementsEnVolDepuis().delete(id);
    voixSignalees().delete(id);
  }
}

/** Un travail du tour a levé une erreur : elle est journalisée, les autres travaux du tour continuent. */
export async function signalerTravailEnErreur(lu: InstantaneTravail, e: unknown): Promise<void> {
  console.error("[studio] travail en erreur dans le tour", lu.travail.id, e instanceof Error ? e.name : "");
  await journaliser("echec", `Un travail a levé une erreur pendant le tour (il sera relu au tour suivant) : ${e instanceof Error ? e.name : "erreur"}`, { type: "video", id: lu.travail.cibleId }).catch(() => undefined);
}

/**
 * Garde « plus d'avancement » : un travail `en_cours` dont l'empreinte d'état n'a pas changé depuis plus que le délai de
 * son moteur échoue (`PANNE_SANS_NOUVELLE`, réessayable) ; la branche d'échec existante de `ecrireAvancement` fait le
 * reste. Sinon, pose ou garde l'empreinte. Un travail en attente de crédit, ou sans délai (tableau), n'est pas gardé.
 */
function gardeSansAvancement(travail: Travail, actuel: Travail, moteurId: string, instant: number = Date.now()): Travail {
  const delai = delaiSansAvancementMs(moteurId);
  if (travail.statut !== "en_cours" || delai === null || actuel.reprise?.motif === "credit" || travail.reprise?.motif === "credit") return travail.garde ? { ...travail, garde: undefined } : travail;
  const empreinte = empreinteAvancement(travail);
  const iso = new Date(instant).toISOString();
  // Un long trou entre deux observations (arrêt, mise en ligne, pause) ne compte pas comme « plus d'avancement ».
  const vuMs = actuel.garde?.vu ? new Date(actuel.garde.vu).getTime() : instant;
  const depuisMs = actuel.garde && actuel.garde.empreinte === empreinte && instant - vuMs <= ECART_MAX_ENTRE_VUES_MS ? new Date(actuel.garde.depuis).getTime() : NaN;
  if (!Number.isFinite(depuisMs)) return { ...travail, garde: { empreinte, depuis: iso, vu: iso } };
  if (instant - depuisMs <= delai) return { ...travail, garde: { empreinte, depuis: actuel.garde!.depuis, vu: iso } };
  const minutes = Math.round((instant - depuisMs) / 60_000);
  const enCours = travail.etapes.find((e) => e.statut === "en_cours") ?? travail.etapes.find((e) => e.statut === "en_attente");
  const messagePourWill = `La fabrication n'a plus avancé depuis ${minutes} min. Vous pouvez réessayer.`;
  const erreur = { code: "PANNE_SANS_NOUVELLE", message: messagePourWill, messagePourWill, reessayable: true };
  return { ...travail, statut: "echec", erreur, garde: undefined, etapes: travail.etapes.map((e) => (e.cle === enCours?.cle ? { ...e, statut: "echec" as const, erreur } : e)) };
}
