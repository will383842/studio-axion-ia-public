/** RÉGLAGES (B.8 #17) : exemples, mention IA, réseaux, notifications, connexions, journal. */
import "server-only";
import type { Evenement, IdReseau, MentionIA, Visage } from "@/domaine/types";
import { MENTION_IA_PAR_DEFAUT } from "@/domaine/derivations";
import { resoudreVisagesParAngle, visagePourFormat } from "@/domaine/distribution";
import { choixFournisseur, etatConnexion, optionsConnexion, resoudreFournisseur, TYPES_FOURNISSEURS } from "@/fournisseurs";
import type { EtatConnexion, OptionConnexion, TypeFournisseur } from "@/fournisseurs";
import { listerFormatsActifs, nomCourtFormat, reglagesParDefaut, trouverFormat } from "@/formats";
import { repartitionDepuisReglages } from "@/formats/communs";
import { renduSimule } from "@/fournisseurs/rendu/client";
import { traduireLigneJournal } from "@/fournisseurs/journal-lisible";
import { choisirMoteurAuLancement, deciderJeLis, deciderMontageReel, moteurMontageReel, moteurPrisesFilmees, type DecisionJeLis, type DecisionMontageReel } from "@/moteurs";
import { prixVideoReelle, type PrixVideoReelle } from "@/moteurs/montage-avocat/prix-reel";
import { formaterMontant, TAUX_USD_EUR_PAR_DEFAUT } from "@/lib/montants";
import { depots, ecrireParametre, ErreurStudio, fournisseur, journaliser, lireParametre, ressourceActive } from "./_commun";
import { exigerSession } from "./auth";
import { renduDoubleAllume } from "./rendu-double";
import { lecturesVoixMaxDuReglage } from "./voix-ressemblance";
import { EMAIL_PAS_PRET, TELEPHONE_PAS_PRET } from "@/domaine/notifications-textes";
import { PREFERENCES_PAR_DEFAUT, vueNotifications, type VueNotificationsServeur } from "./notifications";
import { lireFamilles } from "./hashtags";
import type { FamillesHashtags } from "@/reseaux/hashtags";
import { trouverMoi } from "./moi";

export interface PreferencesNotifications {
  videoPrete: boolean;
  echec: boolean;
  budget: boolean;
  canal: "console" | "telephone" | "email";
}

export interface Reglages {
  afficherExemples: boolean;
  mentionIA: MentionIA;
  reseauxParDefaut: IdReseau[];
  notifications: PreferencesNotifications;
  /** Lot R3 : ce que le serveur sait faire (carte, téléphone, e-mail, appareils). Aucune valeur secrète. */
  notificationsServeur: VueNotificationsServeur;
  /** Équipe 7 : « Vos hashtags » par réseau (TikTok prérempli). */
  hashtags: FamillesHashtags;
}

export async function lireReglages(): Promise<Reglages> {
  return {
    afficherExemples: await lireParametre("afficherExemples", true),
    mentionIA: await lireParametre("mentionIA.parDefaut", MENTION_IA_PAR_DEFAUT),
    reseauxParDefaut: await lireParametre<IdReseau[]>("reseaux.parDefaut", ["linkedin", "instagram", "tiktok", "youtube-shorts"]),
    notifications: await lireParametre<PreferencesNotifications>("notifications", PREFERENCES_PAR_DEFAUT),
    notificationsServeur: await vueNotifications(),
    hashtags: await lireFamilles(),
  };
}

/** Interrupteur « Afficher les exemples » : masque sans supprimer (AV2.4-7). */
export async function definirAfficherExemples(valeur: boolean): Promise<void> {
  await exigerSession();
  await ecrireParametre("afficherExemples", valeur);
}

/** Réglage global de la mention IA (tous les formats). Chaque changement est un choix de Will, consigné au journal. */
export async function definirMentionIA(mention: MentionIA): Promise<void> {
  await exigerSession();
  const avant = await lireParametre<MentionIA>("mentionIA.parDefaut", MENTION_IA_PAR_DEFAUT);
  await ecrireParametre("mentionIA.parDefaut", mention);
  if (avant.incrustee !== mention.incrustee || avant.dansLegende !== mention.dansLegende) {
    await journaliser(
      "mention-ia",
      `Mention IA par défaut : ${mention.incrustee ? "incrustée" : "non incrustée"}, ${mention.dansLegende ? "dans le texte de publication" : "hors du texte de publication"}`,
    );
  }
}

export async function definirReseauxParDefaut(reseaux: IdReseau[]): Promise<void> {
  await exigerSession();
  await ecrireParametre("reseaux.parDefaut", reseaux);
}

export async function definirNotifications(p: PreferencesNotifications): Promise<void> {
  await exigerSession();
  if (!["console", "telephone", "email"].includes(p.canal)) throw new ErreurStudio("CANAL_INCONNU", "Ce choix n'est pas valable.");
  // Lot R3 : passer à « Téléphone » ou « E-mail » seulement s'il peut vraiment partir (carte reliée, réglage serveur
  // posé). Un canal déjà choisi reste modifiable (interrupteurs) même si le serveur a changé depuis.
  const avant = await lireParametre<PreferencesNotifications>("notifications", PREFERENCES_PAR_DEFAUT);
  const serveur = p.canal === avant.canal ? null : await vueNotifications();
  if (serveur && p.canal === "telephone" && !serveur.telephonePret) throw new ErreurStudio("CANAL_INDISPONIBLE", TELEPHONE_PAS_PRET);
  if (serveur && p.canal === "email" && !serveur.emailPret) throw new ErreurStudio("CANAL_INDISPONIBLE", EMAIL_PAS_PRET);
  await ecrireParametre("notifications", { videoPrete: !!p.videoPrete, echec: !!p.echec, budget: !!p.budget, canal: p.canal });
}

export interface Connexion {
  type: TypeFournisseur;
  nom: string;
  etat: EtatConnexion;
  source: "base" | "environnement" | "defaut";
  /** Lot R0 : les vrais choix (simulation, services prévus ou inscrits), sous leur identifiant exact. */
  options: OptionConnexion[];
  /**
   * Montage seulement (constat C2) : formats dont la fabrication sera VRAIMENT montée. Il faut le serveur de rendu
   * (STUDIO_RENDU_URL : le moteur avocat rend dessus dès qu'elle existe, `renduSimule`) ET un moteur réel choisi pour
   * le format (`moteur.<format>`, puis MOTEUR_<FORMAT>). Ne dépend PAS du choix de la carte Montage.
   */
  montageReelPour?: string[];
  /**
   * Montage seulement (lot R6) : vidéos « je lis » montées pour de vrai, format par format (interrupteur
   * `moteur.<format>.jeLis`). `possible: false` + `manque` : le montage ou le stockage n'est pas relié.
   */
  jeLis?: FormatJeLis[];
  /** Montage seulement (lot R6) : le calage des sous-titres est relié (sinon, sous-titres approximatifs des prises). */
  calageRelie?: boolean;
  /** Montage seulement (lot R8) : « Montage réel des vidéos avocat », format par format, avec son prix. */
  montageReel?: FormatMontageReel[];
}

/** Lot R8 : l'interrupteur « montage réel » d'un format, vu de la carte Montage. Jamais de valeur de réglage. */
export interface FormatMontageReel {
  formatId: string;
  nom: string;
  /** L'interrupteur est allumé (choix de Will). */
  allume: boolean;
  /** Tout est relié ET le double est prêt : l'interrupteur peut être allumé. */
  possible: boolean;
  /** Ce qui empêche de l'allumer, en une phrase simple (connexions qui manquent, ou double pas prêt). */
  raison?: string;
  /** Prix estimé d'une vidéo de 45 s montée pour de vrai, montré AVANT d'allumer. */
  prix: PrixVideoReelle;
}

/** Lot R6 : l'interrupteur « je lis » d'un format, vu de la carte Montage. Jamais de valeur de réglage. */
export interface FormatJeLis {
  formatId: string;
  nom: string;
  /** L'interrupteur est allumé (choix de Will). */
  allume: boolean;
  /** Montage et stockage reliés : l'interrupteur peut agir. */
  possible: boolean;
  /** Ce qui manque, en mots simples (« le montage », « le stockage des fichiers »). */
  manque?: string;
}

/** Réglages > Connexions : « Simulation » / « Relié » / « À relier » (et ce qui manque), avec les vrais choix. */
export async function listerConnexions(): Promise<Connexion[]> {
  const res: Connexion[] = [];
  for (const type of TYPES_FOURNISSEURS) {
    const enBase = await lireParametre<string | null>(`fournisseur.${type}`, null);
    const f = resoudreFournisseur(type, enBase);
    const etat = etatConnexion(type, enBase);
    const connexion: Connexion = {
      type,
      nom: f.nom,
      etat,
      source: choixFournisseur(type, enBase).source,
      options: optionsConnexion(type, enBase),
    };
    if (type === "montage") {
      connexion.montageReelPour = renduSimule() ? [] : await formatsMontesPourDeVrai();
      connexion.jeLis = await formatsJeLis();
      connexion.montageReel = await formatsMontageReel();
    }
    res.push(connexion);
  }
  // Lot R6 : la carte Montage dit si le calage des sous-titres est relié (état déjà calculé ci-dessus).
  const montage = res.find((c) => c.type === "montage");
  if (montage) montage.calageRelie = res.find((c) => c.type === "alignement")?.etat === "relie";
  return res;
}

/**
 * Formats actifs montés pour de vrai, par la même décision que le lancement (`decisionJeLis`) : le moteur du format,
 * ou les vidéos « je lis » montées grâce à l'interrupteur (« · je lis »).
 */
async function formatsMontesPourDeVrai(): Promise<string[]> {
  const noms: string[] = [];
  for (const format of listerFormatsActifs()) {
    // Lot R8 : la vidéo entière (double, voix, réseaux) montée pour de vrai grâce à l'interrupteur.
    if ((await decisionMontageReel(format.id)).effectif) {
      noms.push(nomCourtFormat(format));
      continue;
    }
    const d = await decisionJeLis(format.id);
    // Face caméra : le moteur refuse le lancement sans chaîne réelle (serveur d'alignement) ; la carte dit pareil.
    if (d.moteurId === "montage-facecam" && !(await chaineFacecamReelle())) continue;
    if (d.moteurId !== "simulation") noms.push(d.effectif ? `${nomCourtFormat(format)} · je lis` : nomCourtFormat(format));
  }
  return noms;
}

/** Même condition que le lancement face caméra (`dependancesChaineParDefaut`) : réglage allumé ET `STUDIO_ALIGNEUR_URL`. */
async function chaineFacecamReelle(): Promise<boolean> {
  const { PARAM_FACECAM_REEL } = await import("./fabrication");
  if ((await lireParametre<boolean>(PARAM_FACECAM_REEL, true)) !== true) return false;
  const { fournisseurFacecam } = await import("@/fournisseurs/facecam");
  return fournisseurFacecam({ reel: true }).mode === "reel";
}

/* ------------------------------------------------------------------ */
/* Lot R6 : vidéos « je lis » montées pour de vrai (avant le double)    */
/* ------------------------------------------------------------------ */

/**
 * Décision « je lis » d'un format, la MÊME pour le lancement (`fabrication-reseaux.ts`) et pour la carte Montage :
 * `deciderJeLis` (moteurs) sur l'interrupteur `moteur.<format>.jeLis`, le moteur du format et les connexions.
 */
export async function decisionJeLis(formatId: string): Promise<DecisionJeLis & { allume: boolean }> {
  const allume = (await lireParametre<boolean>(`moteur.${formatId}.jeLis`, false)) === true;
  const decision = deciderJeLis(formatId, await lireParametre<string | null>(`moteur.${formatId}`, null), {
    allume,
    // Le moteur monte les prises sur studio-rendu (STUDIO_RENDU_URL) : un autre montage relié ne suffit pas.
    montageRelie: etatConnexion("montage", await lireParametre<string | null>("fournisseur.montage", null)) === "relie" && !renduSimule(),
    stockageRelie: etatConnexion("stockage", await lireParametre<string | null>("fournisseur.stockage", null)) === "relie",
  });
  return { ...decision, allume };
}

/** Formats actifs dont le moteur sait monter des prises filmées : état de leur interrupteur « je lis ». */
async function formatsJeLis(): Promise<FormatJeLis[]> {
  const sortie: FormatJeLis[] = [];
  for (const format of listerFormatsActifs()) {
    if (!moteurPrisesFilmees(format.id)) continue;
    const d = await decisionJeLis(format.id);
    sortie.push({ formatId: format.id, nom: nomCourtFormat(format), allume: d.allume, possible: !d.manque, ...(d.manque ? { manque: d.manque } : {}) });
  }
  return sortie;
}

/** Réglages > Connexions > Montage : allumer ou couper le vrai montage des vidéos « je lis » d'un format (0 €). */
export async function definirJeLisReel(formatId: string, allume: boolean): Promise<void> {
  await exigerSession();
  const format = trouverFormat(formatId);
  if (!format || !moteurPrisesFilmees(formatId)) throw new ErreurStudio("FORMAT_INCONNU", "Ce type de vidéo ne se monte pas encore à partir de vos prises.");
  await ecrireParametre(`moteur.${formatId}.jeLis`, allume === true);
  await journaliser("connexion", `Vidéos « je lis » (${nomCourtFormat(format)}) : ${allume ? "montage réel" : "coupé"}`);
}

/* ------------------------------------------------------------------ */
/* Lot R8 : montage réel des vidéos avocat (double, voix, réseaux)      */
/* ------------------------------------------------------------------ */

/**
 * Un double RÉEL est-il prêt pour un personnage ? Visage d'un fournisseur réel branché, « prêt », relié chez son
 * fournisseur (ressource active avec identifiant). Lecture seule, aucun appel.
 */
async function doubleReelChoisi(): Promise<boolean> {
  return (await doublesReelsPrets()).length > 0;
}

/** Doubles RÉELS prêts (fournisseur réel branché, ressource active chez lui). */
async function doublesReelsPrets(): Promise<Visage[]> {
  const sortie: Visage[] = [];
  for (const v of await depots().visages.lister((x) => x.statut === "pret" && !!x.fournisseur && x.fournisseur !== "simulation")) {
    if (resoudreFournisseur("visage", v.fournisseur).mode !== "reel") continue;
    const r = await ressourceActive(v.id);
    if (r && r.fournisseur === v.fournisseur && r.idExterne) sortie.push(v);
  }
  return sortie;
}

/**
 * Correcteur R8 n° 2 : part du second angle à compter dans le prix de 45 s. Quand un personnage a deux avatars réels
 * prêts (angle principal ET second angle de la recette), la vidéo part en deux angles : la répartition par défaut du
 * format (« principal » : 15 %) est comptée, comme le fera l'estimation de la vidéo. Sinon : 0 (un seul angle).
 */
async function partSecondAnglePrix(formatId: string): Promise<number> {
  const format = trouverFormat(formatId);
  const angles = format?.recetteMontage?.angles;
  if (!format || !angles?.second) return 0;
  const part = repartitionDepuisReglages(reglagesParDefaut(format)).second;
  if (part <= 0) return 0;
  const prets = await doublesReelsPrets();
  // Correcteur 4 : l'avatar DU FORMAT de Will (celui que prendra une nouvelle vidéo), puis son second angle par la même
  // règle que la vidéo (même tenue, même posture) : le prix suit l'avatar réellement utilisé.
  const d = depots();
  const moi = await trouverMoi();
  if (moi) {
    const visages = await d.visages.lister((v) => v.personnageId === moi.id);
    const principal = visagePourFormat(visages, moi, formatId);
    if (!principal) return 0;
    const r = resoudreVisagesParAngle({ visages, principal, partSecond: part });
    const reel = (id?: string) => !!id && prets.some((v) => v.id === id);
    return r.modeAngles === "deux-angles" && Object.values(r.visagesParAngle).every(reel) ? part : 0;
  }
  const deux = prets.some((p) => p.angle === angles.principal && prets.some((s) => s.personnageId === p.personnageId && s.angle === angles.second));
  return deux ? part : 0;
}

const relie = async (type: TypeFournisseur) => etatConnexion(type, await lireParametre<string | null>(`fournisseur.${type}`, null)) === "relie";

/**
 * Décision « montage réel » d'un format, la MÊME pour le lancement (`moteurAuLancement`) et pour la carte Montage :
 * `deciderMontageReel` (moteurs) sur l'interrupteur `moteur.<format>.montageReel`, les connexions et le double.
 */
export async function decisionMontageReel(formatId: string): Promise<DecisionMontageReel & { allume: boolean }> {
  const allume = (await lireParametre<boolean>(`moteur.${formatId}.montageReel`, false)) === true;
  const decision = deciderMontageReel(formatId, await lireParametre<string | null>(`moteur.${formatId}`, null), {
    allume,
    doubleRelie: await relie("visage"),
    voixRelie: await relie("voix"),
    textesRelies: await relie("texte-reseaux"),
    // Le moteur monte sur studio-rendu (STUDIO_RENDU_URL) : un autre montage relié ne suffit pas.
    montageRelie: (await relie("montage")) && !renduSimule(),
    stockageRelie: await relie("stockage"),
    doubleChoisi: await doubleReelChoisi(),
    // Lot R7e : « Votre avatar parle dans le studio » (Réglages › Connexions › Double), éteint par défaut.
    renduAvatarAllume: await renduDoubleAllume(),
  });
  return { ...decision, allume };
}

/**
 * Moteur à FIGER au lancement d'une vidéo (fabrication, versions par réseau) : le moteur réel quand l'interrupteur
 * « montage réel » agit, sinon celui du format (`choisirMoteurAuLancement`, inchangé).
 */
export async function moteurAuLancement(formatId: string): Promise<string> {
  if (!moteurMontageReel(formatId)) return choisirMoteurAuLancement(formatId, await lireParametre<string | null>(`moteur.${formatId}`, null));
  return (await decisionMontageReel(formatId)).moteurId;
}

/** Prix d'une vidéo de 45 s montée pour de vrai, aux réseaux par défaut et au taux du studio (second angle compris). */
export async function prixMontageReel(formatId: string): Promise<PrixVideoReelle> {
  const reseaux = await lireParametre<IdReseau[]>("reseaux.parDefaut", ["linkedin", "instagram", "tiktok", "youtube-shorts"]);
  // INTÉGRATION FINALE : les illustrations fabriquées (fal.ai) comptent quand la fabrication est branchée.
  const illus = (await fournisseur("illustration")) as { fabrication?: unknown };
  // 14/10 (voix de référence) : la voix de l'avocat peut être lue 2 fois par défaut, 3 au plus à 2 relances (contrôle de ressemblance) : le prix
  // montré est ce maximum, comme le prix confirmé au lancement. Les autres formats : inchangés.
  const lectures = formatId === "avocat" ? await lecturesVoixMaxDuReglage() : 1;
  return prixVideoReelle({ reseaux, tauxUsdEur: await lireParametre<number>("taux.usdEur", TAUX_USD_EUR_PAR_DEFAUT), partSecondAngle: await partSecondAnglePrix(formatId), illustrationsFabriquees: !!illus.fabrication, ...(lectures > 1 ? { lecturesVoixMax: lectures } : {}) });
}

/** Ce qui empêche d'allumer, en une phrase (connexions d'abord, puis le double). */
function raisonMontageReel(d: Pick<DecisionMontageReel, "manque" | "doublePasPret">): string | undefined {
  if (d.manque) return `Il faut d'abord relier ${d.manque}.`;
  return d.doublePasPret ?? undefined;
}

/** Formats dont le moteur sait monter une vidéo avec le double : état de leur interrupteur « montage réel ». */
async function formatsMontageReel(): Promise<FormatMontageReel[]> {
  const sortie: FormatMontageReel[] = [];
  for (const format of listerFormatsActifs()) {
    if (!moteurMontageReel(format.id)) continue;
    const prix = await prixMontageReel(format.id);
    const d = await decisionMontageReel(format.id);
    const raison = raisonMontageReel(d);
    sortie.push({ formatId: format.id, nom: nomCourtFormat(format), allume: d.allume, possible: !raison, ...(raison ? { raison } : {}), prix });
  }
  return sortie;
}

/**
 * Réglages > Connexions > Montage : allumer (prix vu) ou repasser en essai. GARDE ROUGE côté serveur : allumer est
 * refusé tant qu'une connexion manque ou que le double n'est pas prêt. Couper est toujours permis, en un geste, sans
 * rien effacer : les vidéos déjà lancées gardent leur moteur (figé dans leur commande), les suivantes partent en essai.
 */
export async function definirMontageReel(formatId: string, allume: boolean): Promise<void> {
  await exigerSession();
  const format = trouverFormat(formatId);
  if (!format || !moteurMontageReel(formatId)) throw new ErreurStudio("FORMAT_INCONNU", "Ce type de vidéo ne se monte pas encore pour de vrai.");
  if (allume === true) {
    const raison = raisonMontageReel(await decisionMontageReel(formatId));
    if (raison) throw new ErreurStudio("MONTAGE_REEL_INDISPONIBLE", raison);
  }
  await ecrireParametre(`moteur.${formatId}.montageReel`, allume === true);
  const prix = allume === true ? ` (environ ${formaterMontant((await prixMontageReel(formatId)).total)} la vidéo de 45 s)` : "";
  await journaliser("connexion", `Vidéos ${nomCourtFormat(format)} : ${allume === true ? `montage réel${prix}` : "retour en essai"}`);
}

export async function listerJournal(limite = 50): Promise<Evenement[]> {
  // Les anciennes lignes (« Service « son » : studio-rendu choisi ») restent en base : traduites ici, à l'affichage.
  return (await depots().evenements.lister())
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limite)
    .map((e) => ({ ...e, message: traduireLigneJournal(e.message) }));
}

/**
 * Vrai quand les données vivent en mémoire (développement, tests) : même règle que `depots()`.
 * En ligne (DATABASE_URL), tout est gardé en base et survit au redémarrage.
 */
export function donneesEnMemoire(): boolean {
  return !process.env.DATABASE_URL || !!process.env.VITEST;
}

/** Réglages > À propos. */
export function aPropos() {
  const enMemoire = donneesEnMemoire();
  return {
    application: "Axion-IA Studio",
    version: "0.1.0",
    environnement: process.env.NODE_ENV,
    enMemoire,
    donnees: enMemoire ? "Version d'essai (non gardées)" : "Gardées en ligne",
  };
}

export async function noterMePrevenir(formatId: string): Promise<void> {
  await exigerSession();
  const liste = await lireParametre<string[]>("formats.prevenir", []);
  if (!liste.includes(formatId)) await ecrireParametre("formats.prevenir", [...liste, formatId]);
  await journaliser("format", `Me prévenir quand « ${trouverFormat(formatId)?.nom ?? "ce type de vidéo"} » sera prêt`);
}

export async function formatsAPrevenir(): Promise<string[]> {
  return lireParametre<string[]>("formats.prevenir", []);
}
