/**
 * PARCOURS DE CONVERSATION (lot 3a) : commentaire GUIDE → réponse publique → message privé M1 → adresse e-mail → demande de guide.
 * Éteint tant que `PARCOURS_CONVERSATION_ENABLED` n'est pas allumé (absent = éteint, échec fermé). Chargé par `branchements-zernio.ts`
 * (import dynamique, après le contrôle de l'interrupteur). Éteint : aucun appel au port ni au site, aucune écriture d'état.
 *
 * Règles de sûreté :
 *  - L'état par personne (`parcours.conversations`) ne contient JAMAIS pseudo, texte, adresse ni identifiant de personne ou de conversation
 *    brut : des empreintes. Seuls restent bruts `idCommentaire` (reprise du même commentaire, réduit après clôture si PARCOURS_REDUCTION_IDS
 *    est allumé), `idCompte` et `idPostPlateforme` (identifiants de NOTRE compte et de NOTRE publication).
 *  - L'adresse e-mail n'existe qu'en mémoire, le temps d'un appel ; à chaque nouvel essai le message est relu.
 *  - Lectures/écritures d'état sous `sousVerrou` ; appels réseau (port, site) HORS verrou ; rien n'est supprimé.
 *  - M1 : `m1_en_vol` est écrit AVANT l'envoi ; après un plantage il vaut `m1_a_verifier` : jamais de second envoi.
 *  - Journal : identifiant d'événement, état, code. Jamais adresse, texte, empreinte, corps d'appel ni clé.
 */
import "server-only";
import { createHash } from "node:crypto";
import type { EvenementFournisseur } from "@/domaine/types";
import { extraireAdresse } from "@/domaine/guide-reseau/adresse-email";
import { RE_CLE_IDEMPOTENCE } from "@/domaine/guide-reseau/cle-idempotence";
import { cibleDuMot, reseauSite } from "@/domaine/guide-reseau/cibles-contrat";
import { dossierDe, racineDe } from "@/domaine/guide-reseau/cles-parcours";
import { conduiteApresReponse, corpsDemandeGuide, DISJONCTEUR_PAUSE_MS, DISJONCTEUR_SEUIL, GUIDES_RESEAU_CONNUS, runValide, type RunLu } from "@/domaine/guide-reseau/crochet-zernio";
import { construireOrigineV3, corpsDemandeGuideV3, compteAutoriseOrigineV3, origineV3Active, prefixesComptesConfigures } from "@/domaine/guide-reseau/origine-v3";
import { cleIdempotenceOpaque, empreintePersonne, lireClesEmpreinte, type CleEmpreinte, type EtatCles } from "@/domaine/guide-reseau/empreinte-personne";
import { debutHeure, decider, LOT_MAX_PAR_PASSAGE_CONVERSATION, msJusquaHeureSuivante, plafondHeureCompte } from "@/domaine/guide-reseau/plafonds-conversation";
import { DELAI_PERIME_MS, DELAI_REDUCTION_MS, FENETRE_ENVOI_MS, reductible, activiteRetenue, choisirParcoursPourMessage, dansFenetreEnvoi, doitExpirer, issueMerci, type EtatMerci, transition, GROUPE_M1_LIEN, type CodeRepliLien, type Conversation, type Sortie } from "@/domaine/guide-reseau/machine-conversation";
import { classerOpposition, type ClasseOpposition } from "@/domaine/guide-reseau/opposition";
import { choisirParcoursPourOk, deciderReponseInstagram, estOkInstagram, limitePersonneIg, parcoursAServir, REPONSES_IG_MAX_PAR_MESSAGE, suiviDepuisPort, type EtatSuivi, type LimitePersonneIg } from "@/domaine/guide-reseau/suivi-instagram";
import { empreinteGuideParcours } from "@/domaine/guide-reseau/empreinte-guide";
import { construireLienGuide, creerJetonLien, lireSecretLien, refConversationLien } from "@/domaine/guide-reseau/lien-guide";
import { rendreTexteMp, TEXTES_MP, type GroupeMp, type IdTexteMp, type ValeursTexteMp } from "@/domaine/guide-reseau/textes-mp";
import { choisirFormulation, EQUIVALENTS_FIGES } from "@/domaine/guide-reseau/formulations";
import { siteAccepteVersionM1 } from "@/domaine/guide-reseau/versions-acceptees-site";
import { formeLienPageGuide, texteDuDictionnaire } from "@/fournisseurs/publication/zernio-inbox-corps";
import type { MessageLu, PortInboxZernio, ResultatEcritureInbox } from "@/fournisseurs/zernio-inbox";
import { signerAppel } from "@/fournisseurs/site/signature";
import { formulationsValidees, lireGardes, PARAM_VALIDATION_MERCI, ouvrirDisjoncteurMotsExterne, PARAM_REGISTRE_MOTS, PARAM_VALIDATION_GUIDE_PARCOURS } from "./mots-service";
import { empreintesOpposees, enregistrerOpposition, enregistrerOppositionPersonne, ErreurOppositionIllisible, personneOpposeePartout } from "./oppositions-mots";
import type { JetonNonOpposee } from "@/domaine/guide-reseau/jeton-non-opposee";
import { mettreEnFileOpposition } from "./oppositions-transmission";
import { creerNotification } from "./notifications";
import { lireCiblesSite } from "./cibles-site";
import { chercherRacine, formesDe, lireDossier, marquerDossierOppose, mettreEnFileDossier, opposerDossier, passerDossierOppose, racineDeLaPersonne, reserverParcours, textesValidesPourLeMot, validationPourEnvoi } from "./parcours-dossier";
import { motsMultiplesActifs } from "./parcours-mots-multiples";
import { appliquerReglageParcours, type EtatReglagesParcours, type ReglageParcours, type ResultatReglage } from "./parcours-reglages";
import { instagramSuivreActif } from "./parcours-instagram";
import { CHEMIN_DEMANDES_GUIDE, transportDuSite } from "./parcours-mot";
import { depots, ecrireParametre, journaliser, lireParametre, sousVerrou } from "./_commun";
import { envoiZernioAutorise } from "./zernio";

export const VARIABLE_INTERRUPTEUR_CONVERSATION = "PARCOURS_CONVERSATION_ENABLED";
export const PARAM_CONVERSATIONS = "parcours.conversations";
export const PARAM_CONVERSATIONS_ALIAS = "parcours.conversations.alias";
export const PARAM_COMPTEURS_CONVERSATION = "parcours.conversations.compteurs";
export const PARAM_PLAFONDS_CONVERSATION = "parcours.conversations.plafonds";
export const ESPACE_CONVERSATION = "zernio-conversation" as const;
const FOURNISSEUR = "zernio";
const TYPE_COMMENTAIRE = "zernio.commentaire";
const TYPE_MESSAGE = "zernio.message";
const ESSAIS_NONCE = 3;
const ATTENTE_REGISTRE_MS = 60_000;
/** Une garde qui bloque : l'événement attend ce délai (pas de relecture de Zernio à chaque tour de 5 s). */
const ATTENTE_GARDE_MS = 60_000;
/** Orphelin sur un compte hors des listes de lecture : on ne clôt jamais, on revient plus tard. */
const ATTENTE_COMPTE_HORS_LISTE_MS = 6 * 3600_000;
const INTERVALLE_ALERTE_MS = 3600_000;
const ATTENTE_SITE_ABSENT_MS = 10 * 60_000;
const MOT = "GUIDE";

type Env = Record<string, string | undefined>;
type Registre = Record<string, { etat?: string }>;

/** Éteint par défaut : absent ou autre chose que 1/true/oui. */
export function parcoursConversationActif(env: Env = process.env): boolean {
  return /^(1|true|oui)$/i.test(env[VARIABLE_INTERRUPTEUR_CONVERSATION]?.trim() ?? "");
}

export interface DepsConversation {
  port: PortInboxZernio;
  comptesPermis: readonly string[];
  /** Comptes dont on LIT encore les messages (pour y repérer un « stop ») ; défaut = comptesPermis. Les écritures restent sous comptesPermis. */
  comptesLecture?: readonly string[];
  /** Titre du guide inséré dans M1 / accusé (liste fermée côté port). Absent : le texte à trous ne part pas. */
  titreGuide?: string;
  guide?: string;
  env?: Env;
  maintenantMs?: number;
}
export interface RapportConversation {
  actif: boolean;
  traites: number;
  enAttente: number;
  /** Raison de garde ayant bloqué les envois pendant ce passage (jamais un identifiant). */
  gardeBloquante?: string;
}

/* --- État processus (globalThis : survit aux rechargements de module, repart à zéro au redémarrage) -------------- */
interface EtatProcessus {
  enCours: boolean;
  enVol: Set<string>;
  /** Merci (par `ref`) dont l'envoi est en cours dans CE processus. */
  merciEnVol: Set<string>;
  mercisEnCours: boolean;
  /** Merci (par `ref`) reporté parce que le site est illisible : instant avant lequel on n'y touche pas. */
  mercisReportes: Record<string, number>;
  alertes: Record<string, number>;
  pannes: number;
  ouvertJusqua: number;
}
const CLE_PROCESSUS = Symbol.for("studio-axion-ia.parcours-conversation");
function processus(): EtatProcessus {
  const g = globalThis as typeof globalThis & { [CLE_PROCESSUS]?: EtatProcessus };
  return (g[CLE_PROCESSUS] ??= { enCours: false, enVol: new Set(), merciEnVol: new Set(), mercisEnCours: false, mercisReportes: {}, alertes: {}, pannes: 0, ouvertJusqua: 0 });
}
/** Tests : simule un redémarrage du processus (plus rien « en vol », gardes en mémoire remises à zéro). */
export function reinitialiserParcoursConversation(): void {
  const g = globalThis as typeof globalThis & { [CLE_PROCESSUS]?: EtatProcessus };
  delete g[CLE_PROCESSUS];
}

/** Alerte en français : au plus UNE par heure et par sujet. Jamais d'identifiant, d'adresse ni de texte. */
async function alerter(sujet: string, message: string, now: number): Promise<void> {
  const p = processus();
  if (now - (p.alertes[sujet] ?? -Infinity) < INTERVALLE_ALERTE_MS) return;
  p.alertes[sujet] = now;
  try {
    await journaliser("parcours_conversation", `ALERTE : ${message}`);
    await creerNotification({ type: "echec", titre: "Parcours des messages privés", message, lien: "/mots" }, { cloche: true }); // cloche seulement : jamais de push au téléphone
  } catch {
    /* l'alerte ne doit jamais faire échouer le traitement */
  }
}

/** Alerte FIXE d'un doute sur une demande d'arrêt : ni texte, ni identifiant. Sujet propre à l'événement : un 2e doute n'est pas masqué par le délai d'une heure. */
const MESSAGE_DOUTE_OPPOSITION = "Un message privé contient peut-être une demande d'arrêt. Rien n'a été envoyé ; la conversation est en pause. À vérifier dans l'Inbox Zernio.";
const signalerDoute = (ev: EvenementFournisseur, now: number): Promise<void> => alerter(`doute:${ev.idEvenement}`, MESSAGE_DOUTE_OPPOSITION, now);

/* --- Gardes avant toute action sortante ----------------------------------------------------------------------- */
async function motActif(mot: string, compte: string): Promise<boolean> {
  const reg = await lireParametre<Registre>(PARAM_REGISTRE_MOTS, {});
  return reg[`${mot}|${compte}`]?.etat === "actif";
}
/** Mode « plusieurs mots » : mots (MAJUSCULES) dont la ligne `MOT|idCompte` du registre est active. */
async function motsActifsDuCompte(compte: string): Promise<string[]> {
  const reg = await lireParametre<Registre>(PARAM_REGISTRE_MOTS, {});
  const fin = `|${compte}`;
  return Object.keys(reg).filter((k) => k.endsWith(fin) && k.length > fin.length && reg[k]?.etat === "actif").map((k) => k.slice(0, -fin.length).toUpperCase());
}
/** `null` = tout est permis. Sinon le code de la garde qui bloque (rien ne part). Une panne de lecture bloque aussi (échec fermé). */
async function garde(d: DepsConversation, env: Env, idCompte: string, reseau: string, parcours?: Pick<Conversation, "mot" | "guide" | "titreCible">, maintenantMs?: number): Promise<string | null> {
  try {
    if (!(await envoiZernioAutorise())) return "tout_arrete";
    if ((await lireGardes()).disjoncteur.ouvert) return "disjoncteur_ferme";
    // Enregistrement du mode « plusieurs mots » (champ `mot` présent) : la ligne du SON mot ; une cible autre que `guide-ia` n'a pas encore de validation : fermé.
    if (!(await motActif(parcours?.mot ?? MOT, idCompte))) return "mot_inactif";
    if (parcours?.mot !== undefined && parcours.mot.toUpperCase() !== MOT) {
      // Mot autre que GUIDE : seulement si le réglage « plusieurs mots » est allumé (durable), puis validation PAR MOT et cible du jour (jamais sous `sousVerrou`).
      if (!(await motsMultiplesActifs())) return "plusieurs_mots_eteint";
      const refus = await validationPourEnvoi(parcours.mot, reseauSite(reseau), parcours.guide, parcours.titreCible ?? "", env, maintenantMs);
      if (refus !== null) return refus;
    } else if (parcours?.mot !== undefined && !textesValidesPourLeMot(parcours.mot, parcours.guide)) return "validation_absente";
    // La validation de l'opérateur est liée aux textes réellement envoyés : revérifiée ici, à chaque garde (échec fermé).
    const e = empreinteGuideParcours(d.titreGuide ?? "");
    const v = await lireParametre<{ empreinte?: string } | null>(PARAM_VALIDATION_GUIDE_PARCOURS, null);
    if (!e.ok || !v || v.empreinte !== e.empreinte) return "validation_perimee";
  } catch {
    return "lecture_impossible";
  }
  if (!d.comptesPermis.includes(idCompte)) return "compte_hors_liste";
  if (reseau !== "instagram" && reseau !== "facebook") return "reseau";
  if (!lireClesEmpreinte(env).ok) return "cles_absentes";
  return null;
}
const MESSAGES_GARDE: Record<string, string> = {
  tout_arrete: "« Tout arrêter » est actif : aucun message privé ne part.",
  disjoncteur_ferme: "Le disjoncteur des mots est ouvert : aucun message privé ne part.",
  mot_inactif: "Le mot GUIDE n'est pas actif pour ce compte : aucun message privé ne part.",
  compte_hors_liste: "Le compte n'est pas dans la liste autorisée : aucun message privé ne part.",
  reseau: "Réseau non pris en charge : aucun message privé ne part.",
  cles_absentes: "Le secret d'empreinte des personnes est absent ou invalide : aucun message privé ne part.",
  lecture_impossible: "Les réglages des mots sont illisibles : aucun message privé ne part.",
  validation_absente: "Ce mot n'a pas de textes validés : aucun message ne part pour ce mot.",
  plusieurs_mots_eteint: "Le réglage « plusieurs mots » est éteint : aucun message ne part pour un mot autre que GUIDE.",
  instagram_pas_encore: "Instagram n'est pas encore pris en charge pour ce mot : aucun message ne part pour ce mot.",
  cibles_illisibles: "Les cibles du site sont illisibles : aucun message ne part pour ce mot, nouvel essai plus tard.",
  validation_perimee: "Les textes du mot GUIDE ont changé depuis leur validation (ou ne sont pas validés) : aucun message ne part. Revalidez-les dans Mots.",
};

/** Gardes DURABLES propres à un mot : l'événement est CLOS (jamais reporté : une adresse ne doit pas partir des jours après un rallumage). L'état et les données restent. */
const GARDES_MOT_CLOSES: readonly string[] = ["plusieurs_mots_eteint", "instagram_pas_encore"];
const messageRefusMot = (code: string, mot: string): string => (code === "validation_absente" ? `Le mot ${mot} n'a pas de textes validés : aucun message ne part pour ce mot.` : (MESSAGES_GARDE[code] ?? "Une garde de sécurité bloque les envois."));
/** Garde « plusieurs mots éteint » / « Instagram pas encore » : alerte puis clôture « ecarte / garde_… ». Vrai si l'événement est clos. */
async function cloreSiGardeMotDurable(ev: EvenementFournisseur, bloque: string | null, now: number): Promise<boolean> {
  if (bloque === null || !GARDES_MOT_CLOSES.includes(bloque)) return false;
  await alerter(`garde:${bloque}`, MESSAGES_GARDE[bloque] ?? "Une garde de sécurité bloque les envois.", now);
  await clore(ev, "ecarte", `garde_${bloque}`);
  return true;
}

/* --- État par personne (sous verrou) -------------------------------------------------------------------------- */
type Conversations = Record<string, Conversation>;
type Alias = Record<string, string>;
const lireTout = async (): Promise<{ conv: Conversations; alias: Alias }> => ({ conv: await lireParametre<Conversations>(PARAM_CONVERSATIONS, {}), alias: await lireParametre<Alias>(PARAM_CONVERSATIONS_ALIAS, {}) });

const lireEtat = (cle: string): Promise<Conversation | null> => sousVerrou(async () => (await lireTout()).conv[cle] ?? null);
async function ecrireEtat(cle: string, f: (e: Conversation | undefined) => Conversation | undefined): Promise<Conversation | null> {
  return sousVerrou(async () => {
    const conv = await lireParametre<Conversations>(PARAM_CONVERSATIONS, {});
    const suivant = f(conv[cle]);
    if (!suivant) return conv[cle] ?? null;
    await ecrireParametre(PARAM_CONVERSATIONS, { ...conv, [cle]: suivant });
    return suivant;
  });
}
/** Fusionne sous verrou. Un état `oppose` n'est JAMAIS rétrogradé : un « stop » écrit entre la vérification et l'envoi survit (seul un patch `oppose` change l'état d'une personne opposée). */
const patcher = (cle: string, patch: Partial<Conversation>) =>
  ecrireEtat(cle, (e) => {
    if (!e) return undefined;
    // Un patch qui voudrait quitter « oppose » est écrit SANS son champ `etat`.
    const garde = e.etat === "oppose" && patch.etat !== undefined && patch.etat !== "oppose";
    const suite: Partial<Conversation> = { ...patch };
    if (garde) delete suite.etat;
    return { ...e, ...suite };
  });

type ClesOk = Extract<EtatCles, { ok: true }>;
/** Formes d'un identifiant brut sous TOUTES les clés connues, la courante en premier. Jamais la forme héritée (les conversations n'en ont jamais eu). */
const formesConversation = (cles: ClesOk, idBrut: string): string[] => [cles.courante, ...cles.anciennes].map((c) => empreintePersonne(c, ESPACE_CONVERSATION, idBrut));

/**
 * MG-STOP01 / S2 : vérification UNIQUE « stop partout », JUSTE AVANT chaque envoi (réponse publique, M1, M2, appel au site, accusé…).
 * Une seule fonction du registre (`personneOpposeePartout`) : registre ET états de conversation, dans tous les espaces d'empreinte
 * (instagram, facebook…), avec la clé, les alias et les identifiants bruts de l'événement. Rend le jeton « non opposée » à passer au
 * port d'envoi, ou `null` : la personne est opposée quelque part, RIEN ne part, la conversation passe à « oppose » (données gardées,
 * rien supprimé) (le « stop » est mis en file par l'appelant ou par la réconciliation). Vérification IMPOSSIBLE (lecture, clés, registre) : l'erreur est
 * PROPAGÉE (fermé) ; le passage reporte l'événement (`registre_illisible`) et on réessaiera. Jamais « non opposée » par défaut.
 * Un simple doute (M2 seulement) bloque l'envoi sans passer la conversation à « oppose ».
 */
async function verifierPartout(env: Env, cle: string, charge: Record<string, unknown> | null, now: number, opts: { m2?: boolean; doute?: boolean } = {}): Promise<JetonNonOpposee | null> {
  const e = await lireEtat(cle);
  if (e?.etat === "oppose") return null;
  // Clé de dossier (`racine|…`, mode « plusieurs mots ») : la racine est aussi vérifiée, et un « stop » vaut pour TOUT le dossier. Clé sans `|` : inchangé.
  const racine = racineDe(cle);
  const enDossier = racine !== cle;
  // Relecture historique (clé + alias) d'abord : même résultat que la vérification unique, sur un sous-ensemble ; garde les contrôles existants.
  if (await empreintesOpposees([cle, ...(e?.alias ?? []), ...(enDossier ? [racine] : [])], { env })) {
    if (enDossier) await passerDossierOppose(racine);
    else if (e) await patcher(cle, { etat: "oppose", prochainEssaiLe: null });
    return null;
  }
  const c = charge ?? {};
  const bruts = [c.idAuteur, c.idExpediteur, c.idConversation].filter((x): x is string => typeof x === "string" && x.length > 0);
  const v = await personneOpposeePartout({ idsBruts: bruts, empreintes: [cle, ...(e?.alias ?? []), ...(enDossier ? [racine] : [])] }, { env, douteBloque: opts.m2 === true || opts.doute === true });
  if (!v.opposee) return v.jeton;
  if (v.source !== "doute") {
    if (enDossier) await passerDossierOppose(racine);
    else if (e) await patcher(cle, { etat: "oppose", prochainEssaiLe: null });
  }
  return null;
}

/**
 * Fenêtre de 24 h de Meta : date (et identifiant opaque) du dernier message écrit par la personne, posés sous verrou, seulement si
 * la nouvelle date est STRICTEMENT plus récente (rejeu et désordre sans effet). Appelée en tête de traitement d'un message entrant.
 */
async function noterActivite(cle: string, ev: EvenementFournisseur, now: number): Promise<void> {
  const c = ev.charge;
  await ecrireEtat(cle, (e) => {
    if (!e) return undefined;
    const nouvelle = activiteRetenue(e.derniereActiviteLe, typeof c.occurredAt === "string" ? c.occurredAt : null, ev.recuLe, now);
    if (nouvelle === null || nouvelle === (e.derniereActiviteLe ?? null)) return undefined;
    return { ...e, derniereActiviteLe: nouvelle, idMessageDernier: texteDe(c.idMessage) };
  });
}
/** Vrai = hors fenêtre : le message de conversation ne part pas. L'état est relu (échec fermé si la date manque). */
async function horsFenetre(cle: string, now: number): Promise<boolean> {
  const e = await lireEtat(cle);
  return !e || !dansFenetreEnvoi(e, now);
}

/**
 * Retrouve la personne par les formes de `sender.id`, sinon par un alias (formes de `sender.id` ou de `conversationId`), sous toutes les clés connues.
 * Ordre inchangé, forme par forme : alias du FIL, clé de l'expéditeur, alias de l'expéditeur, clé du fil.
 * Retrouvée par une forme ANCIENNE : migration douce, la forme courante devient un alias (la clé reste l'ancienne, rien n'est supprimé).
 */
async function retrouver(cles: ClesOk, idS: string, idC?: string | null): Promise<{ cle: string; etat: Conversation } | null> {
  const fS = formesConversation(cles, idS);
  const fC = idC ? formesConversation(cles, idC) : [];
  const trouve = await sousVerrou(async () => {
    const { conv, alias } = await lireTout();
    const par = (formes: string[], viaAlias: boolean, courante: string): { cle: string; etat: Conversation; ancienne: boolean; courante: string } | null => {
      for (const f of formes) {
        const cle = viaAlias ? alias[f] : f;
        if (cle && conv[cle]) return { cle, etat: conv[cle], ancienne: f !== courante, courante };
      }
      return null;
    };
    return par(fC, true, fC[0]) ?? par(fS, false, fS[0]) ?? par(fS, true, fS[0]) ?? par(fC, false, fC[0]);
  });
  if (!trouve) return null;
  if (trouve.ancienne) await noterAlias(trouve.cle, [trouve.courante]);
  const etat = trouve.ancienne ? ((await lireEtat(trouve.cle)) ?? trouve.etat) : trouve.etat;
  return { cle: trouve.cle, etat };
}
export async function noterAlias(cle: string, empreintes: string[]): Promise<void> {
  const refuses = await sousVerrou(async () => {
    const { conv, alias } = await lireTout();
    const e = conv[cle];
    if (!e) return 0;
    // Clé de dossier (`racine|…`) : la table d'alias pointe vers la RACINE. Clé sans `|` : la racine est la clé elle-même (inchangé).
    const cible = racineDe(cle);
    // Jamais de réattribution silencieuse : une empreinte déjà rattachée à une autre personne (alias ou clé de conversation) est refusée.
    const etrangere = (x: string): boolean => (x in alias && racineDe(alias[x]) !== cible) || (x !== cle && x in conv && racineDe(x) !== cible);
    const nouveaux = empreintes.filter((x) => x !== cle && x !== cible && !(x in alias && racineDe(alias[x]) === cible) && !etrangere(x));
    const nbRefuses = empreintes.filter((x) => x !== cle && x !== cible && etrangere(x)).length;
    if (nouveaux.length === 0) return nbRefuses;
    await ecrireParametre(PARAM_CONVERSATIONS, { ...conv, [cle]: { ...e, alias: [...new Set([...e.alias, ...nouveaux])] } });
    await ecrireParametre(PARAM_CONVERSATIONS_ALIAS, { ...alias, ...Object.fromEntries(nouveaux.map((x) => [x, cible])) });
    return nbRefuses;
  });
  // Journal hors verrou : un code, jamais d'identifiant ni d'empreinte.
  if (refuses > 0) await journaliser("parcours_conversation", "Alias refusé (alias_deja_rattache) : déjà rattaché à une autre personne.");
}

/**
 * Plafond d'envoi : RÉSERVATION sous verrou AVANT chaque écriture vers Zernio (on compte les tentatives, pas les succès).
 * Le compteur (par compte, limité à l'heure en cours) ne contient que l'identifiant de compte et deux nombres. Échec fermé :
 * compteur ou réglage illisible = « illisible », rien ne part.
 */
async function reserverEnvoi(idCompte: string, now: number): Promise<"ok" | "plafond" | "illisible"> {
  try {
    return await sousVerrou(async () => {
      const plafond = plafondHeureCompte(await lireParametre<unknown>(PARAM_PLAFONDS_CONVERSATION, undefined));
      const tous = await lireParametre<unknown>(PARAM_COMPTEURS_CONVERSATION, {});
      if (typeof tous !== "object" || tous === null || Array.isArray(tous)) return "illisible" as const;
      const d = decider((tous as Record<string, unknown>)[idCompte], now, plafond);
      if (d.genre !== "ok") return d.genre;
      await ecrireParametre(PARAM_COMPTEURS_CONVERSATION, { ...(tous as Record<string, unknown>), [idCompte]: d.compteur });
      return "ok" as const;
    });
  } catch {
    return "illisible";
  }
}
/** Rend une place réservée par `reserverEnvoi` quand finalement aucun envoi n'est parti (même heure seulement). Une panne est sans gravité : la place reste prise. */
async function rendrePlaceEnvoi(idCompte: string, now: number): Promise<void> {
  try {
    await sousVerrou(async () => {
      const tous = await lireParametre<unknown>(PARAM_COMPTEURS_CONVERSATION, {});
      if (typeof tous !== "object" || tous === null || Array.isArray(tous)) return;
      const c = (tous as Record<string, unknown>)[idCompte] as { heure?: unknown; envois?: unknown } | undefined;
      if (!c || c.heure !== debutHeure(now) || typeof c.envois !== "number" || c.envois < 1) return;
      await ecrireParametre(PARAM_COMPTEURS_CONVERSATION, { ...(tous as Record<string, unknown>), [idCompte]: { ...c, envois: c.envois - 1 } });
    });
  } catch {
    /* la place reste prise : plus prudent */
  }
}
/** Vrai = l'envoi peut partir. Sinon l'événement est reporté (aucun essai consommé, aucun changement d'état de la conversation). */
async function reserverOuReporter(ev: EvenementFournisseur, idCompte: string, now: number): Promise<boolean> {
  const r = await reserverEnvoi(idCompte, now);
  if (r === "ok") return true;
  if (r === "plafond") {
    await alerter("plafond_heure", "Le plafond d'envois par heure est atteint pour un compte : les messages en attente repartent à l'heure suivante, rien n'est perdu.", now);
    await reporter(ev, now, msJusquaHeureSuivante(now), "plafond_heure");
  } else {
    await alerter("compteur_illisible", "Le compteur d'envois est illisible : aucun message ne part, nouvel essai dans une minute.", now);
    await reporter(ev, now, ATTENTE_REGISTRE_MS, "compteur_illisible");
  }
  return false;
}

/* --- Événements ------------------------------------------------------------------------------------------------ */
const texteDe = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
async function clore(ev: EvenementFournisseur, etat: string, code: string | null): Promise<void> {
  await depots().evenementsFournisseurs.modifier(ev.id, { traite: true, charge: { ...ev.charge, etat, dernierCode: code, prochainEssaiLe: null } });
  await journaliser("parcours_conversation", `Événement Zernio ${ev.idEvenement} : ${etat} (${code ?? "-"}).`);
}
async function reporter(ev: EvenementFournisseur, now: number, apresMs: number, code: string, extra: Record<string, unknown> = {}): Promise<void> {
  const memeCause = ev.charge.dernierCode === code; // même cause qu'au report précédent : le report se fait, mais le journal ne répète pas la ligne
  await depots().evenementsFournisseurs.modifier(ev.id, { traite: false, charge: { ...ev.charge, ...extra, etat: "a_reessayer", dernierCode: code, prochainEssaiLe: now + apresMs } });
  if (!memeCause) await journaliser("parcours_conversation", `Événement Zernio ${ev.idEvenement} : a_reessayer (${code}).`);
}

/** Meta n'autorise la réponse privée à un commentaire que 7 jours : au-delà, jamais de premier message privé (même âge que le recuLe de l'événement). */
export const DELAI_MAX_PREMIER_MP_MS = 7 * 24 * 3600_000;
const tropTardPourPremierMp = (ev: EvenementFournisseur, now: number): boolean => {
  const age = now - Date.parse(ev.recuLe);
  return Number.isFinite(age) && age > DELAI_MAX_PREMIER_MP_MS;
};

/**
 * Commentaire bloqué par une garde durable depuis plus de 24 h, sans conversation (nouveau / pub_ok) sur ce même commentaire : il se périme
 * au lieu d'être reporté à vie. Lecture SEULE (jamais `retrouver`, qui peut écrire un alias). Une conversation qui attend sa réponse publique garde son report,
 * sauf après 7 jours : la conversation passe alors à `expire` (un état est écrit, rien n'est effacé) et l'événement est clos « perime » ; aucun message ne part.
 */
async function perimeSousGarde(ev: EvenementFournisseur, now: number): Promise<boolean> {
  const age = now - Date.parse(ev.recuLe);
  if (!Number.isFinite(age) || age <= DELAI_PERIME_MS) return false;
  const idCommentaire = String(ev.charge.idCommentaire ?? "");
  const { conv } = await lireTout();
  const enCours = Object.entries(conv).filter(([, e]) => e.idCommentaire === idCommentaire && (e.etat === "nouveau" || e.etat === "pub_ok"));
  if (enCours.length > 0) {
    if (!tropTardPourPremierMp(ev, now)) return false;
    // Écriture sous verrou, état revérifié : une conversation passée entre-temps à un autre état n'est jamais écrasée.
    for (const [cle] of enCours) await ecrireEtat(cle, (e) => (e && (e.etat === "nouveau" || e.etat === "pub_ok") ? { ...e, etat: "expire", prochainEssaiLe: null } : e));
  }
  await clore(ev, "perime", "perime");
  return true;
}

/** Réaction commune à un résultat d'écriture : INBOX_REQUIRED / quota / 401 ouvrent le disjoncteur des mots, avec alerte. */
async function reagir(s: Sortie, now: number): Promise<void> {
  if (!s.blocage) return;
  try {
    await ouvrirDisjoncteurMotsExterne(`parcours de conversation : ${s.code ?? "refus"}`);
  } catch {
    /* l'alerte ci-dessous prévient quand même */
  }
  await alerter("blocage", "Zernio refuse les envois (module Inbox absent, quota de messages épuisé ou accès refusé) : le disjoncteur des mots est ouvert. Rien ne repart tant que vous ne l'avez pas refermé.", now);
}

async function appeler<T extends ResultatEcritureInbox>(f: () => Promise<T>): Promise<ResultatEcritureInbox> {
  try {
    return await f();
  } catch {
    return { statut: "a_verifier", code: "exception", etat: "a_verifier" }; // issue inconnue : jamais de nouvel envoi automatique
  }
}

async function traiterCommentaire(ev: EvenementFournisseur, d: DepsConversation, env: Env, cles: ClesOk, now: number): Promise<"traite" | "bloque"> {
  const c = ev.charge;
  const idCompte = String(c.idCompte ?? "");
  const reseau = String(c.reseau ?? "");
  const idAuteur = texteDe(c.idAuteur);
  const age = now - Date.parse(ev.recuLe);
  // Péremption de 24 h : jamais ici (sans conversation connue, `transition(null, …)` la ferait valoir même pour un événement REPORTÉ
  // dont la réponse publique est déjà publiée). Elle est jugée plus bas, seulement quand aucune conversation n'existe.
  const filtre = transition(null, { t: "commentaire", idCommentaire: String(c.idCommentaire ?? ""), proprio: c.proprio === true, idAuteur, idCompte, motSeul: texteDe(c.motSeul), estReponse: c.estReponse === true, ageMs: 0, maintenantMs: now });
  if (filtre.action === "ecarter") {
    await clore(ev, filtre.raison === "perime" ? "perime" : "ecarte", filtre.raison ?? null);
    return "traite";
  }
  const cle = empreintePersonne(cles.courante, ESPACE_CONVERSATION, idAuteur!); // clé des NOUVELLES écritures : toujours la courante
  if (filtre.action === "opposer") {
    await enregistrerOppositionPersonne([idAuteur!], [], ESPACE_CONVERSATION, { env }); // le « stop » est noté en premier
    // Puis les formes sans identifiant brut (clé de conversation, alias) : leur propre ligne, jamais rattachées à une autre personne.
    const connu = await retrouver(cles, idAuteur!);
    const cleEtat = connu?.cle ?? cle;
    await enregistrerOppositionPersonne([idAuteur!], [cleEtat, ...(connu?.etat.alias ?? [])], ESPACE_CONVERSATION, { env });
    await ecrireEtat(cleEtat, (e) => (e ? { ...e, etat: "oppose", prochainEssaiLe: null } : etatNeuf("oppose", c, d, cleIdempotenceOpaque(cles.courante, "guide", ev.idEvenement), now)));
    // Adresse déjà transmise au site : le « stop » est mis en file (sinon rien à transmettre, la personne est seulement écartée ici).
    const apres = await lireEtat(cleEtat);
    if (apres) await mettreEnFileOpposition(cleEtat, apres, cles.courante, now);
    await clore(ev, "oppose", "opposition");
    return "traite";
  }
  const bloque = await garde(d, env, idCompte, reseau);
  if (bloque) {
    await alerter(`garde:${bloque}`, MESSAGES_GARDE[bloque] ?? "Une garde de sécurité bloque les envois.", now);
    if (await perimeSousGarde(ev, now)) return "traite";
    await reporter(ev, now, ATTENTE_GARDE_MS, `garde_${bloque}`);
    return "bloque";
  }
  if (!(await verifierPartout(env, cle, ev.charge, now))) {
    await clore(ev, "silence", "opposee");
    return "traite";
  }
  // Une personne déjà connue sous un alias ne démarre pas un second parcours.
  const connue = await retrouver(cles, idAuteur!);
  // Retour arrière après un allumage du mode « plusieurs mots » : la personne n'a plus d'enregistrement ancien mais un dossier `racine|…` existe.
  // Réglage éteint : jamais un nouveau parcours pour elle, silence (rien ne part).
  // Personne retrouvée (ancien enregistrement sans `|`) : le dossier composite de sa clé ou de ses alias compte aussi. Sans clé `|` nulle part : inchangé.
  if (await aUnDossierComposite(cles, idAuteur!, connue ? [connue.cle, ...(connue.etat.alias ?? [])] : [])) {
    await clore(ev, "silence", "silence");
    return "traite";
  }
  const existant = connue?.etat ?? null;
  const cleEtat = connue?.cle ?? cle;
  const decision = transition(existant, { t: "commentaire", idCommentaire: String(c.idCommentaire ?? ""), proprio: false, idAuteur, idCompte, motSeul: MOT, estReponse: false, ageMs: Number.isFinite(age) ? age : 0, maintenantMs: now });
  if (decision.action === "ecarter" || decision.action === "silence") {
    await clore(ev, decision.action === "silence" ? "silence" : decision.raison === "perime" ? "perime" : "ecarte", decision.raison ?? null);
    return "traite";
  }
  // Nouveau parcours seulement : un commentaire de plus de 24 h ne démarre rien (une conversation déjà ouverte n'est jamais périmée ici).
  if (decision.action === "demarrer" && Number.isFinite(age) && age > DELAI_PERIME_MS) {
    await clore(ev, "perime", "perime");
    return "traite";
  }
  if (decision.action === "demarrer") {
    // Clé d'idempotence calculée UNE fois ici, stockée : jamais recalculée (la rotation du secret la changerait).
    await ecrireEtat(cleEtat, (e) => ({ ...etatNeuf("nouveau", c, d, cleIdempotenceOpaque(cles.courante, "guide", String(c.idCommentaire)), now), alias: e?.alias ?? [] })); // les alias déjà connus sont conservés
  }
  return etapesCommentaire(ev, d, env, cleEtat, now, cles, false);
}

/** Vrai si un dossier `racine|…` existe pour une des formes de la personne (ou pour la cible d'un de ses alias). Lecture seule. */
async function aUnDossierComposite(cles: ClesOk, idBrut: string, clesConnues: readonly string[] = []): Promise<boolean> {
  const { conv, alias } = await lireTout();
  const racines = [...formesConversation(cles, idBrut), ...clesConnues].flatMap((f) => [f, ...(typeof alias[f] === "string" ? [racineDe(alias[f])] : [])]);
  return racines.some((r) => Object.keys(conv).some((k) => k.startsWith(`${r}|`)));
}

/* --- Commentaire, mode « plusieurs mots » (réglage allumé) --------------------------------------------------------- */
const ATTENTE_CATALOGUE_MS = 60_000;
type CibleDuMot = { genre: "ok"; code: string; titre: string } | { genre: "inconnue" } | { genre: "illisible" };

/** Cible d'un mot. GUIDE sans catalogue (ou sans liaison pour GUIDE) : `guide-ia` + titre du serveur. Autre mot, catalogue illisible : « illisible » (reporté). */
async function cibleDuCommentaire(mot: string, reseau: string, d: DepsConversation, env: Env, now: number): Promise<CibleDuMot> {
  const site = await lireCiblesSite({ env, maintenantMs: now });
  const titreServeur = d.titreGuide ?? "";
  if (site === null) return mot === MOT ? { genre: "ok", code: "guide-ia", titre: titreServeur } : { genre: "illisible" };
  const r = cibleDuMot(mot, reseauSite(reseau) ?? "tous", site.liaisons, site.catalogue);
  if (mot === MOT && r.source === null) return { genre: "ok", code: "guide-ia", titre: titreServeur };
  const el = r.element;
  if (!el || !el.actif || el.test || el.type === "adresse") return { genre: "inconnue" };
  // Le texte validé de `guide-ia` est rendu avec le titre du serveur (celui de la validation), jamais un titre du catalogue.
  return { genre: "ok", code: el.code, titre: el.code === "guide-ia" ? titreServeur : el.titre };
}

async function traiterCommentaireDossier(ev: EvenementFournisseur, d: DepsConversation, env: Env, cles: ClesOk, now: number, igSuivre = false): Promise<"traite" | "bloque" | "leger"> {
  const c = ev.charge;
  const idCompte = String(c.idCompte ?? "");
  const reseau = String(c.reseau ?? "");
  const idAuteur = texteDe(c.idAuteur);
  const age = now - Date.parse(ev.recuLe);
  // 1. Filtre comme aujourd'hui, avec les mots actifs du compte.
  const filtre = transition(null, { t: "commentaire", idCommentaire: String(c.idCommentaire ?? ""), proprio: c.proprio === true, idAuteur, idCompte, motSeul: texteDe(c.motSeul), estReponse: c.estReponse === true, ageMs: 0, maintenantMs: now }, await motsActifsDuCompte(idCompte));
  if (filtre.action === "ecarter") {
    await clore(ev, filtre.raison === "perime" ? "perime" : "ecarte", filtre.raison ?? null);
    return "traite";
  }
  const auteur = idAuteur!;
  const trouvee = await racineDeLaPersonne(cles, auteur);
  // 2. Opposition écrite : tout le dossier.
  if (filtre.action === "opposer") {
    await opposerDossier({ racine: trouvee.racine, idsBruts: [auteur], cles: cles.courante, env, maintenantMs: now, neuf: () => etatNeuf("oppose", c, d, cleIdempotenceOpaque(cles.courante, "guide", ev.idEvenement), now) });
    await clore(ev, "oppose", "opposition");
    return "traite";
  }
  // 3. Cible du mot.
  const mot = String(c.motSeul).trim().toUpperCase();
  const cible = await cibleDuCommentaire(mot, reseau, d, env, now);
  if (cible.genre === "illisible") {
    await reporter(ev, now, ATTENTE_CATALOGUE_MS, "catalogue_illisible");
    return "bloque";
  }
  if (cible.genre === "inconnue") {
    await alerter("cible_inconnue", "Un mot est lié à une cible introuvable, désactivée ou de type adresse : le commentaire est écarté, rien n'est envoyé. Vérifiez les liaisons dans Mots.", now);
    await clore(ev, "ecarte", "cible_inconnue");
    return "traite";
  }
  // 3 bis. Textes validés pour ce mot et cette cible ? Sinon l'événement est CLOS (jamais remis en attente : il bloquerait les GUIDE du lot).
  const refusEnvoi = await validationPourEnvoi(mot, reseauSite(reseau), cible.code, cible.titre, env, now);
  if (refusEnvoi === "cibles_illisibles") {
    await reporter(ev, now, ATTENTE_CATALOGUE_MS, "catalogue_illisible");
    return "bloque";
  }
  if (refusEnvoi !== null) {
    await alerter(`${refusEnvoi}:${mot}`, messageRefusMot(refusEnvoi, mot), now);
    await clore(ev, "ecarte", refusEnvoi);
    return "leger";
  }
  // 4. Garde par mot (ligne `mot|compte` active ; textes validés pour `guide-ia`, fermé pour toute autre cible).
  const bloque = await garde(d, env, idCompte, reseau, { mot, guide: cible.code, titreCible: cible.titre }, now);
  if (bloque) {
    await alerter(`garde:${bloque}`, MESSAGES_GARDE[bloque] ?? "Une garde de sécurité bloque les envois.", now);
    if (await perimeSousGarde(ev, now)) return "traite";
    await reporter(ev, now, ATTENTE_GARDE_MS, `garde_${bloque}`);
    return "bloque";
  }
  // 5. Opposition sur le DOSSIER entier (registre + états). Au moindre doute : SILENCE TOTAL (ni réponse publique, ni message privé). Hors verrou.
  const verdict = await verifierRacine(env, cles, trouvee.racine, c, now);
  if (!("jeton" in verdict)) {
    await clore(ev, "silence", verdict.source === "doute" ? "doute_opposition" : "opposee");
    return "traite";
  }
  // 6. Décision et réservation, dans UN SEUL verrou.
  const idCommentaire = String(c.idCommentaire ?? "");
  const r = await reserverParcours({
    cles, idAuteur: auteur, idCommentaire, ageMs: Number.isFinite(age) ? age : 0, maintenantMs: now, code: cible.code,
    creer: ({ cleGuide, nature, groupeM1 }) => ({ ...etatNeuf("nouveau", c, d, cleGuide, now), guide: cible.code, mot, nature, groupeM1, ...(cible.titre ? { titreCible: cible.titre } : {}) }),
  });
  const dec = r.decision;
  if (dec.action === "silence") {
    await clore(ev, "silence", dec.raison === "oppose" ? "opposee" : dec.raison);
    return "traite";
  }
  if (dec.action === "perime") {
    await clore(ev, "perime", "perime");
    return "traite";
  }
  if (dec.action === "public_seul") {
    // Un doute apparu entre la vérification et la décision : silence total (pas de réponse publique seule).
    if (dec.raison === "doute_opposition") {
      await clore(ev, "silence", "doute_opposition");
      return "traite";
    }
    return repondrePubliqueSeule(ev, d, env, cles, trouvee.racine, idCommentaire, dec.raison, now);
  }
  return etapesCommentaire(ev, d, env, r.cle!, now, cles, true, igSuivre && reseau === "instagram");
}

/**
 * Vérification « stop partout » sur le DOSSIER entier d'une racine (registre + états de conversation, toutes les clés et alias), le doute comptant
 * comme opposition. Opposition certaine : tout le dossier passe à `oppose` et chaque enregistrement est mis en file. Jamais sous verrou.
 */
async function verifierRacine(env: Env, cles: ClesOk, racine: string, charge: Record<string, unknown>, now: number): Promise<{ jeton: JetonNonOpposee } | { source: "doute" | "opposee" }> {
  const bruts = [charge.idAuteur, charge.idExpediteur, charge.idConversation].filter((x): x is string => typeof x === "string" && x.length > 0);
  const dossier = await lireDossier(racine);
  const v = await personneOpposeePartout({ idsBruts: bruts, empreintes: [racine, ...dossier.alias] }, { env, douteBloque: true });
  if (!v.opposee) return { jeton: v.jeton };
  if (v.source === "doute") return { source: "doute" };
  await marquerDossierOppose({ racine, cles: cles.courante, maintenantMs: now });
  return { source: "opposee" };
}

/** Réponse publique SEULE (cible déjà servie, en cours, plafond par personne) : aucun enregistrement, aucun message privé. Plafond par heure respecté. */
async function repondrePubliqueSeule(ev: EvenementFournisseur, d: DepsConversation, env: Env, cles: ClesOk, racine: string, idCommentaire: string, raison: string, now: number): Promise<"traite" | "bloque"> {
  const c = ev.charge;
  const idCompte = String(c.idCompte ?? "");
  const idPost = texteDe(c.idPostPlateforme);
  if (!idPost) {
    await clore(ev, "silence", "post_inconnu");
    return "traite";
  }
  // Rejeu du même commentaire (autre identifiant d'événement) déjà répondu en public seul : rien de plus.
  const deja = await depots().evenementsFournisseurs.lister((x) => x.id !== ev.id && x.type === TYPE_COMMENTAIRE && x.charge.idCommentaire === idCommentaire && x.charge.etat === "public_seul");
  if (deja.length > 0) {
    await clore(ev, "silence", "deja_traite");
    return "traite";
  }
  const texte = rendreTexteMp("mp-pub-igfb-v1", {});
  if (texte === null) {
    await clore(ev, "ignore", "texte_incomplet");
    return "traite";
  }
  const verdict = await verifierRacine(env, cles, racine, c, now);
  if (!("jeton" in verdict)) {
    await clore(ev, "silence", verdict.source === "doute" ? "doute_opposition" : "opposee");
    return "traite";
  }
  if (!(await reserverOuReporter(ev, idCompte, now))) return "bloque";
  const res = await appeler(() => d.port.repondreCommentaire({ idCompte, idPost, idCommentaire, texte, cle: idCommentaire, nonOpposee: verdict.jeton }));
  const essais = Number(c.essaisPub ?? 0);
  const s = transition({ essaisPub: essais } as Conversation, { t: "public", res });
  await reagir(s, now);
  if (s.action === "bloquer") {
    await clore(ev, "bloque", s.code ?? null);
    return "traite";
  }
  if (s.action === "reessayer") {
    await reporter(ev, now, s.apresMs ?? 30_000, s.code ?? "a_reessayer", { essaisPub: essais + 1 });
    return "traite";
  }
  await clore(ev, "public_seul", raison);
  return "traite";
}

function etatNeuf(etat: Conversation["etat"], c: Record<string, unknown>, d: DepsConversation, cleGuide: string, now: number): Conversation {
  return {
    etat,
    reseau: c.reseau === "facebook" ? "facebook" : "instagram",
    idCompte: String(c.idCompte ?? ""),
    idCommentaire: String(c.idCommentaire ?? ""),
    idPostPlateforme: texteDe(c.idPostPlateforme),
    versionTexteM1: TEXTES_MP["mp-m1-v2"].version,
    guide: d.guide ?? "guide-ia",
    cleIdempotenceGuide: cleGuide,
    creeLe: new Date(now).toISOString(),
    m1Le: null,
    occurredAt: null,
    m2Envoye: false,
    essaisSite: 0,
    essaisPub: 0,
    essaisM1: 0,
    prochainEssaiLe: null,
    dernierCode: null,
    alias: [],
  };
}

/* --- M1 avec lien signé (Z3a-Studio-2) ------------------------------------------------------------------------- */
/** Interrupteur du lien dans M1 : éteint par défaut ; seules les valeurs 1, true, oui l'allument. */
export function parcoursLienGuideActif(env: Env = process.env): boolean {
  return /^(1|true|oui)$/i.test(env.PARCOURS_LIEN_GUIDE?.trim() ?? "");
}
const RAISONS_REPLI_LIEN: Record<Exclude<CodeRepliLien, "lien_eteint">, string> = {
  secret_lien_absent: "secret du lien absent ou invalide",
  texte_lien_non_valide: "texte avec lien non validé dans Mots",
  compte_lien_inconnu: "compte absent de la table des noms courts",
  jeton_invalide: "jeton refusé",
  lien_trop_long: "lien trop long",
  forme_refusee: "lien de forme non permise",
  version_inconnue_du_site: "le site ne connaît pas encore cette formulation",
};
const LONGUEUR_MAX_M1_LIEN = 1000;
const RE_NOM_COURT_COMPTE = /^[a-z0-9_]{2,40}$/;
const RE_OPAQUE_LIEN = /^[A-Za-z0-9_-]{1,64}$/;
/** `LIEN_GUIDE_COMPTES` = « idCompteZernio=nom_court,idCompte2=nom2 » : le nom court du compte, ou null. */
function nomCourtCompte(env: Env, idCompte: string): string | null {
  for (const paire of (env.LIEN_GUIDE_COMPTES ?? "").split(",")) {
    const i = paire.indexOf("=");
    if (i < 1 || paire.slice(0, i).trim() !== idCompte) continue;
    const nom = paire.slice(i + 1).trim();
    return RE_NOM_COURT_COMPTE.test(nom) ? nom : null;
  }
  return null;
}
/**
 * Série 5 : texte d'un message d'un groupe de formulations. Une formulation VALIDÉE sur /mots est tirée (puis figée dans l'état : une conversation
 * garde toujours la même) ; tant qu'aucune n'est validée, l'ancien texte part, inchangé. Jamais une formulation non validée.
 */
async function formuler(o: { groupe: GroupeMp; e: Pick<Conversation, "cleIdempotenceGuide" | "formulations">; ancien: IdTexteMp; valeurs: ValeursTexteMp }): Promise<{ texte: string | null; version: string; formulation?: string }> {
  const choix = choisirFormulation({
    groupe: o.groupe,
    cleConversation: o.e.cleIdempotenceGuide,
    figee: o.e.formulations?.[o.groupe],
    validees: await formulationsValidees(),
    rendre: (v) => rendreTexteMp(v, o.valeurs),
    conforme: (t) => texteDuDictionnaire(t, false),
  });
  if (choix === null) return { texte: rendreTexteMp(o.ancien, o.valeurs), version: TEXTES_MP[o.ancien].version };
  if (choix.figeeAbandonnee) await journaliser("parcours_conversation", "formulation_figee_non_validee");
  return { texte: choix.texte, version: choix.version, formulation: choix.version };
}

type PrepM1 = { texte: string | null; version: string; refLienConv?: string; empreinteLien?: string; codeRepli?: CodeRepliLien; formulationLien?: string; formulationAdresse?: string; formulationIg?: string };
/**
 * Choisit le texte de M1. Le jeton et le lien ne vivent que dans cette fonction (variables locales) : ni état, ni journal, ni alerte.
 * Le premier contrôle qui échoue donne le code de repli et M1 v2 part, exactement comme avant.
 */
async function preparerM1(e: Conversation, d: DepsConversation, env: Env, cles: ClesOk, now: number): Promise<PrepM1> {
  // Enregistrement ancien : mot absent = GUIDE, titre de la cible absent = titre du serveur (comportement inchangé).
  const mot = e.mot ?? MOT;
  const titre = e.titreCible ?? d.titreGuide;
  // Le journal et l'alerte du repli ne sont PAS émis ici : l'appelant les émet une fois l'envoi réservé (ni opposition, ni plafond).
  // `formulationLien` : la formulation avec lien déjà choisie reste notée à part (jamais écrasée par le repli) pour le prochain essai.
  const choisie: { version?: string } = {};
  // Le repli demande l'adresse e-mail : une formulation validée du groupe « m1-adresse » si elle existe, sinon mp-m1-v2 (inchangé).
  const repli = async (code: CodeRepliLien) => {
    const f = await formuler({ groupe: "m1-adresse", e, ancien: "mp-m1-v2", valeurs: { mot, titre } });
    return { texte: f.texte, version: f.version, codeRepli: code, ...(choisie.version ? { formulationLien: choisie.version } : {}), ...(f.formulation ? { formulationAdresse: f.formulation } : {}) };
  };
  if (!parcoursLienGuideActif(env)) return repli("lien_eteint");
  const secret = lireSecretLien(env);
  if (secret === null) return repli("secret_lien_absent");
  // Formulation choisie AVANT le jeton : `version_m1` du jeton est la version choisie (le site l'enregistre comme preuve du texte montré).
  // Essai de rendu avec un lien d'essai : seule la présence des valeurs compte ici ; le lien réel est contrôlé plus bas.
  const choix = choisirFormulation({
    groupe: GROUPE_M1_LIEN,
    cleConversation: e.cleIdempotenceGuide,
    figee: e.formulations?.[GROUPE_M1_LIEN] ?? e.versionTexteM1,
    validees: await formulationsValidees(),
    rendre: (v) => rendreTexteMp(v, { mot, titre, lien: "https://exemple.test/essai" }),
  });
  if (choix === null) {
    const figeeRetiree = e.formulations?.[GROUPE_M1_LIEN] ?? e.versionTexteM1;
    if (figeeRetiree && figeeRetiree in EQUIVALENTS_FIGES) await journaliser("parcours_conversation", "formulation_figee_retiree_refusee");
    return repli("texte_lien_non_valide");
  }
  if (choix.figeeAbandonnee) await journaliser("parcours_conversation", "formulation_figee_non_validee");
  // Le site doit connaître la version AVANT l'envoi (sinon la preuve du texte montré est perdue en silence).
  // Conversation figée sur un ancien identifiant au texte identique : le jeton garde cet identifiant, que le site connaît.
  const figeeAvant = e.formulations?.[GROUPE_M1_LIEN] ?? e.versionTexteM1;
  const versionJeton = figeeAvant && EQUIVALENTS_FIGES[figeeAvant] === choix.version ? figeeAvant : choix.version;
  // Identité gardée pour le prochain essai : calculée APRÈS versionJeton (une conversation figée sur mp-m1-v3 reste mp-m1-v3, jamais mp-m1-v4-1).
  choisie.version = versionJeton;
  if (!siteAccepteVersionM1(versionJeton)) return repli("version_inconnue_du_site");
  const compte = nomCourtCompte(env, e.idCompte);
  if (compte === null) return repli("compte_lien_inconnu");
  const conv = e.refLienConv || refConversationLien(cles.courante.secret.toString("utf8"), e.cleIdempotenceGuide);
  let jeton: string;
  try {
    jeton = creerJetonLien({ conv, mot, reseau: e.reseau, guide: e.guide, compte, ...(e.idPostPlateforme && RE_OPAQUE_LIEN.test(e.idPostPlateforme) ? { post_ref: e.idPostPlateforme } : {}), version_m1: versionJeton }, secret, now);
  } catch {
    return repli("jeton_invalide"); // jamais e.message
  }
  const lien = construireLienGuide(jeton);
  if (lien === null) return repli("lien_trop_long");
  const texte = rendreTexteMp(choix.version, { mot, titre, lien });
  // Borne de M1 avec lien : 1 000 unités de texte (texte.length), pas les 2 000 du dictionnaire ; au-delà, M1 v2.
  if (texte === null || texte.length > LONGUEUR_MAX_M1_LIEN || !texteDuDictionnaire(texte, false) || !formeLienPageGuide(lien)) return repli("forme_refusee");
  // Empreinte du jeton réellement envoyé : c'est la `ref` que le site renverra à la validation de la page (jamais le jeton lui-même).
  return { texte, version: versionJeton, formulationLien: versionJeton, ...(e.refLienConv ? {} : { refLienConv: conv }), empreinteLien: createHash("sha256").update(jeton, "utf8").digest("hex") };
}

/**
 * Renvoi (mode « plusieurs mots ») : message du groupe `deja-envoye` ou `lien-rappel` AVEC un lien NEUF (la référence de lien vient de la clé
 * d'idempotence de ce nouveau parcours). Aucune formulation validée, lien éteint, secret absent, compte inconnu, version inconnue du site ou
 * lien refusé : `texte: null` (état `m1_refuse`, code `renvoi_impossible`). JAMAIS de repli vers le texte qui demande l'adresse.
 */
async function preparerRenvoi(e: Conversation, d: DepsConversation, env: Env, cles: ClesOk, now: number): Promise<PrepM1> {
  const impossible = { texte: null, version: e.versionTexteM1 };
  const groupe = e.groupeM1 === "deja-envoye" || e.groupeM1 === "lien-rappel" ? e.groupeM1 : null;
  if (groupe === null || !parcoursLienGuideActif(env)) return impossible;
  const secret = lireSecretLien(env);
  if (secret === null) return impossible;
  const mot = e.mot ?? MOT;
  const titre = e.titreCible ?? d.titreGuide;
  const choix = choisirFormulation({
    groupe,
    cleConversation: e.cleIdempotenceGuide,
    figee: e.formulations?.[groupe],
    validees: await formulationsValidees(),
    rendre: (v) => rendreTexteMp(v, { mot, titre, lien: "https://exemple.test/essai" }),
  });
  if (choix === null || !siteAccepteVersionM1(choix.version)) return impossible;
  const compte = nomCourtCompte(env, e.idCompte);
  if (compte === null) return impossible;
  const conv = e.refLienConv || refConversationLien(cles.courante.secret.toString("utf8"), e.cleIdempotenceGuide);
  let jeton: string;
  try {
    jeton = creerJetonLien({ conv, mot, reseau: e.reseau, guide: e.guide, compte, ...(e.idPostPlateforme && RE_OPAQUE_LIEN.test(e.idPostPlateforme) ? { post_ref: e.idPostPlateforme } : {}), version_m1: choix.version }, secret, now);
  } catch {
    return impossible; // jamais e.message
  }
  const lien = construireLienGuide(jeton);
  if (lien === null) return impossible;
  const texte = rendreTexteMp(choix.version, { mot, titre, lien });
  if (texte === null || texte.length > LONGUEUR_MAX_M1_LIEN || !texteDuDictionnaire(texte, false) || !formeLienPageGuide(lien)) return impossible;
  return { texte, version: choix.version, formulationLien: choix.version, ...(e.refLienConv ? {} : { refLienConv: conv }), empreinteLien: createHash("sha256").update(jeton, "utf8").digest("hex") };
}

/**
 * Instagram « suivre le compte puis OK » : texte de la réponse privée UNIQUE. Formulation VALIDÉE (`formulationsValidees`, empreinte exacte) du groupe
 * `ig-suivre`, figée par conversation ; titre de la cible, texte seul. Aucune formulation validée : `texte: null`, JAMAIS de repli vers un autre texte.
 */
async function preparerIgSuivre(e: Conversation, d: DepsConversation): Promise<PrepM1> {
  const mot = e.mot ?? MOT;
  const titre = e.titreCible ?? d.titreGuide;
  const choix = choisirFormulation({
    groupe: "ig-suivre",
    cleConversation: e.cleIdempotenceGuide,
    figee: e.formulations?.["ig-suivre"],
    validees: await formulationsValidees(),
    rendre: (v) => rendreTexteMp(v, { mot, titre }),
    conforme: (t) => texteDuDictionnaire(t, false),
  });
  if (choix === null) return { texte: null, version: e.versionTexteM1 };
  if (choix.figeeAbandonnee) await journaliser("parcours_conversation", "formulation_figee_non_validee");
  return { texte: choix.texte, version: choix.version, formulationIg: choix.version };
}
const MESSAGE_IG_SUIVRE_ABSENT = "Instagram : aucune formulation « suivre le compte » validée dans Mots : aucun message ne part.";
const MESSAGE_IG_LIEN_INDISPONIBLE = "Instagram : le lien ne peut pas partir (texte non validé ou version inconnue du site)";
const MESSAGE_IG_PAS_ENCORE_ABSENT = "Instagram : aucune formulation « pas encore » validée dans Mots : ce message ne part pas.";
const GARDES_DURABLES_PARCOURS: readonly string[] = ["mot_inactif", "validation_absente", "plusieurs_mots_eteint", "instagram_pas_encore"];
const MESSAGE_IG_OK_NON_RECONNU = "Instagram : réponse non reconnue après la demande de suivre le compte : rien n'est parti.";
const MESSAGE_IG_PLAFOND_PERSONNE = "Instagram : une personne a déjà reçu 3 messages en 24 h : le suivant attend ou est écarté, rien n'est parti.";
const MESSAGE_IG_A_VERIFIER = "Un message privé Instagram a une issue inconnue : il ne sera pas renvoyé. À vérifier dans l'Inbox Zernio.";
/** Plafond par personne (3 messages Instagram en 24 h), lu sur TOUT le dossier de la personne. */
const plafondIg = async (cle: string, now: number): Promise<LimitePersonneIg> => limitePersonneIg((await lireDossier(racineDe(cle))).entrees.map((x) => x.etat), now);
/** Plafond atteint : le message est-il encore servable à la reprise (la fenêtre de 23 h de Meta reste ouverte) ? Date illisible : non (jamais de report sans fin). */
const encoreServable = (lim: LimitePersonneIg, activiteLe: string | null | undefined): boolean => {
  const a = Date.parse(activiteLe ?? "");
  return lim.repriseMs !== null && Number.isFinite(a) && lim.repriseMs < a + FENETRE_ENVOI_MS;
};
/** L'envoi n'a pas eu lieu (refus net, débit) : la date d'essai réservée avant l'envoi ne compte plus dans le plafond. */
const retirerEssaiEnvoi = (cle: string) =>
  ecrireEtat(cle, (e) => {
    if (!e || e.essaiEnvoiLe === undefined) return undefined;
    const reste = { ...e };
    delete reste.essaiEnvoiLe;
    return reste;
  });
/** Un message entrant de la même personne n'est pas encore traité (« stop » en panne de lecture, introuvable, texte absent…), QUELLE QUE SOIT SA DATE : il peut être une opposition
 *  (webhooks dans le désordre, horloge décalée). Au moindre doute, y compris une date illisible : oui. Seul l'événement lui-même est écarté. */
const ATTENTE_STOP_ANTERIEUR_MS = 60_000;
const ATTENTE_ALERTE_OK_MS = 10 * 60_000;
async function messageNonTraiteDeLaPersonne(ev: EvenementFournisseur, idCompte: string, idConversation: string, idExpediteur: string, idMessage: string): Promise<boolean> {
  const autres = await depots().evenementsFournisseurs.lister((x) => x.fournisseur === FOURNISSEUR && x.type === TYPE_MESSAGE && !x.traite && x.id !== ev.id);
  return autres.some((x) => {
    const c = x.charge;
    if (c.idMessage === idMessage) return false; // le même message (rejeu) : traité par `idMessageOk`
    if (typeof c.idCompte === "string" && c.idCompte !== idCompte) return false;
    const conv = typeof c.idConversation === "string" && c.idConversation ? c.idConversation : null;
    const exp = typeof c.idExpediteur === "string" && c.idExpediteur ? c.idExpediteur : null;
    return !((conv !== null || exp !== null) && conv !== idConversation && exp !== idExpediteur);
  });
}
/** Message clos « ignore » SANS avoir été lu alors qu'un parcours Instagram attend le OK (réglage allumé) : doute sur le dossier, plus rien ne part à la personne. Aucune donnée supprimée. */
async function douterSiInstagramEnAttente(cle: string | null, igSuivre: boolean, now: number): Promise<void> {
  if (!cle || !igSuivre) return;
  const { entrees } = await lireDossier(racineDe(cle));
  const concernes = entrees.filter((x) => x.etat.etat === "ig_attente_ok" || x.etat.etat === "ig_pas_encore" || x.etat.etat === "ig_a_verifier");
  if (concernes.length === 0) return;
  for (const x of concernes) await patcher(x.cle, { douteOpposition: true });
  await alerter("ig_message_non_lu", "Instagram : un message n'a pas pu être lu, la personne est mise en attente par prudence.", now);
}

/** Aucune formulation « suivre le compte » validée : rien ne part (ni public ni privé), commentaire clos, parcours refusé (même sortie que M1 sans texte). */
async function cloreIgSuivreAbsent(ev: EvenementFournisseur, cle: string, now: number): Promise<"traite"> {
  await alerter("ig_suivre_absente", MESSAGE_IG_SUIVRE_ABSENT, now);
  await patcher(cle, { etat: "m1_refuse", refuseLe: new Date(now).toISOString(), dernierCode: "validation_ig_absente" });
  await clore(ev, "ecarte", "validation_ig_absente");
  return "traite";
}

async function etapesCommentaire(ev: EvenementFournisseur, d: DepsConversation, env: Env, cle: string, now: number, cles: ClesOk, multi = false, ig = false): Promise<"traite" | "bloque"> {
  let e = await lireEtat(cle);
  const optsDoute = multi ? { doute: true } : {}; // mode allumé : le doute bloque aussi juste avant chaque envoi ; éteint : appels inchangés
  if (!e) return "traite";
  const { idCompte } = e;
  const idPost = e.idPostPlateforme;
  if (!idPost) {
    await patcher(cle, { etat: "m1_refuse", refuseLe: new Date(now).toISOString(), dernierCode: "post_inconnu" });
    await clore(ev, "m1_refuse", "post_inconnu");
    return "traite";
  }
  // Instagram « suivre le compte puis OK » : sans formulation validée, RIEN ne part (pas même la réponse publique). Un renvoi garde son chemin.
  const igPremier = ig && e.nature !== "renvoi";
  if (igPremier && e.etat === "nouveau" && (await preparerIgSuivre(e, d)).texte === null) return cloreIgSuivreAbsent(ev, cle, now);
  // Plafond PAR PERSONNE (3 messages Instagram en 24 h, tous parcours) : avant toute réservation d'envoi, réponse publique comprise.
  if (ig && (e.etat === "nouveau" || e.etat === "pub_ok")) { // renvois compris
    const lim = await plafondIg(cle, now);
    if (lim.atteint) {
      const recu = Date.parse(ev.recuLe);
      const reprise = lim.repriseMs;
      if (reprise !== null && Number.isFinite(recu) && reprise < recu + DELAI_PERIME_MS) {
        await alerter("ig_plafond_personne", MESSAGE_IG_PLAFOND_PERSONNE, now);
        await reporter(ev, now, Math.max(1000, reprise - now), "plafond_personne");
        return "traite";
      }
      await alerter("ig_plafond_personne", MESSAGE_IG_PLAFOND_PERSONNE, now);
      await patcher(cle, { etat: "m1_refuse", refuseLe: new Date(now).toISOString(), dernierCode: "plafond_personne" });
      await clore(ev, "ecarte", "plafond_personne");
      return "traite";
    }
  }
  // Commentaire de plus de 7 jours : ni réponse publique (elle annoncerait un message privé qui ne viendra pas) ni message privé. La conversation passe à `expire` (rien n'est effacé).
  if ((e.etat === "nouveau" || e.etat === "pub_ok") && tropTardPourPremierMp(ev, now)) {
    await patcher(cle, { etat: "expire", prochainEssaiLe: null });
    await clore(ev, "perime", "perime");
    return "traite";
  }
  if (e.etat === "nouveau") {
    const texte = rendreTexteMp("mp-pub-igfb-v1", {});
    if (texte === null) {
      await patcher(cle, { etat: "pub_ok", dernierCode: "texte_incomplet" });
    } else {
      const nonOpposee = await verifierPartout(env, cle, ev.charge, now, optsDoute);
      if (!nonOpposee) {
        await clore(ev, "silence", "opposee");
        return "traite";
      }
      if (!(await reserverOuReporter(ev, idCompte, now))) return "bloque";
      const res = await appeler(() => d.port.repondreCommentaire({ idCompte, idPost, idCommentaire: e!.idCommentaire, texte, cle: e!.idCommentaire, nonOpposee }));
      const s = transition(e, { t: "public", res });
      await reagir(s, now);
      if (s.action === "bloquer") {
        await clore(ev, "bloque", s.code ?? null);
        return "traite";
      }
      await patcher(cle, s.patch ?? {});
      if (s.action === "reessayer") {
        await reporter(ev, now, s.apresMs ?? 30_000, s.code ?? "a_reessayer");
        return "traite";
      }
    }
    e = await lireEtat(cle);
    if (!e) return "traite";
  }
  if (e.etat !== "pub_ok") {
    await clore(ev, "silence", "etat");
    return "traite";
  }
  const bloque = await garde(d, env, idCompte, e.reseau, e, now);
  if (bloque === "validation_absente") {
    await alerter(`validation_absente:${e.mot ?? MOT}`, `Le mot ${e.mot ?? MOT} n'a pas de textes validés : aucun message ne part pour ce mot.`, now);
    await clore(ev, "ecarte", "validation_absente");
    return "traite";
  }
  if (await cloreSiGardeMotDurable(ev, bloque, now)) return "traite";
  if (bloque) {
    await alerter(`garde:${bloque}`, MESSAGES_GARDE[bloque] ?? "Une garde de sécurité bloque les envois.", now);
    await reporter(ev, now, ATTENTE_GARDE_MS, `garde_${bloque}`);
    return "bloque";
  }
  // Renvoi (mode « plusieurs mots ») : jamais le texte qui demande l'adresse. Aucun texte validé, lien éteint ou version inconnue du site : refusé.
  const m1 = e.nature === "renvoi" ? await preparerRenvoi(e, d, env, cles, now) : igPremier ? await preparerIgSuivre(e, d) : await preparerM1(e, d, env, cles, now);
  const texteM1 = m1.texte;
  if (texteM1 === null && igPremier) return cloreIgSuivreAbsent(ev, cle, now);
  if (texteM1 === null) {
    const codeRefus = e.nature === "renvoi" ? "renvoi_impossible" : "texte_incomplet";
    await patcher(cle, { etat: "m1_refuse", refuseLe: new Date(now).toISOString(), dernierCode: codeRefus });
    await clore(ev, "m1_refuse", codeRefus);
    return "traite";
  }
  const nonOpposeeM1 = await verifierPartout(env, cle, ev.charge, now, optsDoute);
  if (!nonOpposeeM1) {
    await clore(ev, "silence", "opposee");
    return "traite";
  }
  if (!(await reserverOuReporter(ev, idCompte, now))) return "bloque"; // réservation avant tout changement d'état
  if (m1.codeRepli && m1.codeRepli !== "lien_eteint") {
    await journaliser("parcours_conversation", `Lien du 1er message non utilisé : ${m1.codeRepli}.`);
    await alerter(`lien:${m1.codeRepli}`, `Le premier message part sans lien (${RAISONS_REPLI_LIEN[m1.codeRepli]}).`, now);
  }
  // ÉCRIRE D'ABORD m1_en_vol (sous verrou), PUIS un seul envoi hors verrou : un plantage ne produit jamais un 2e envoi.
  await patcher(cle, { etat: "m1_en_vol", prochainEssaiLe: null, ...(ig ? { essaiEnvoiLe: new Date(now).toISOString() } : {}), versionTexteM1: m1.version, ...(m1.formulationLien || m1.formulationAdresse || m1.formulationIg ? { formulations: { ...e.formulations, ...(m1.formulationIg ? { "ig-suivre": m1.formulationIg } : {}), ...(m1.formulationLien ? { [e.nature === "renvoi" && e.groupeM1 ? e.groupeM1 : GROUPE_M1_LIEN]: m1.formulationLien } : {}), ...(m1.formulationAdresse ? { "m1-adresse": m1.formulationAdresse } : {}) } } : {}), ...(m1.refLienConv ? { refLienConv: m1.refLienConv } : {}), ...(m1.empreinteLien ? { empreintesLien: [...(e.empreintesLien ?? []), m1.empreinteLien].slice(-5) } : {}) });
  processus().enVol.add(cle);
  let res: ResultatEcritureInbox;
  try {
    res = await appeler(() => d.port.repondreEnPrive({ idCompte, idPost, idCommentaire: e!.idCommentaire, texte: texteM1, nonOpposee: nonOpposeeM1 }));
  } finally {
    processus().enVol.delete(cle);
  }
  const s = transition(e, { t: "m1", res, maintenantMs: now });
  await reagir(s, now);
  // Instagram : le succès attend le OK de la personne (le lien ne part qu'après) ; les autres issues sont celles de M1.
  const patchM1: Partial<Conversation> | undefined = igPremier && s.patch?.etat === "attente_email" ? { ...s.patch, etat: "ig_attente_ok" } : s.patch;
  await patcher(cle, patchM1 ?? {});
  if (ig && res.statut !== "envoye" && res.statut !== "a_verifier") await retirerEssaiEnvoi(cle); // rien n'est parti : la date d'essai réservée ne compte pas
  // B3 (a) : si Zernio rend l'identifiant de conversation ou de destinataire, l'alias est posé tout de suite (empreintes, jamais brut).
  const idsRendus = [res.idConversation, res.idDestinataire].filter((x): x is string => typeof x === "string" && x.length > 0).map((x) => empreintePersonne(cles.courante, ESPACE_CONVERSATION, x));
  if (idsRendus.length > 0) await noterAlias(cle, idsRendus);
  if (s.action === "reessayer") {
    await reporter(ev, now, s.apresMs ?? 60_000, s.code ?? "a_reessayer");
    return "traite";
  }
  if (s.patch?.etat === "m1_a_verifier") await alerter("m1_a_verifier", "Un message privé a une issue inconnue : il ne sera pas renvoyé. À vérifier dans l'Inbox Zernio.", now);
  await clore(ev, String(patchM1?.etat ?? "termine"), s.code ?? null);
  return "traite";
}

/* --- Messages --------------------------------------------------------------------------------------------------- */
const pannesSite = (code: string): boolean => code === "injoignable" || code === "401" || code === "429" || /^5\d\d$/.test(code);

/**
 * Lecture du texte d'un message entrant. Rend le texte, ou `null` quand l'événement a déjà été traité ici :
 *  - PANNE de lecture (erreur, accès, réseau) : réessai à délai croissant, JAMAIS ignoré ni conclu « non opposé » (comme un registre
 *    illisible), alerte au plus une par heure ;
 *  - message INTROUVABLE dans la liste : réessais à 5 min, 30 min, 2 h, 6 h ; ignoré seulement si la dernière lecture échoue aussi ;
 *  - message SANS texte (bouton, sortant) : 3 réessais puis ignoré ;
 *  - liste Zernio INCOMPLÈTE (limite de pages, curseur refusé) : si `plafonner`, 6 essais espacés puis clos « ignore » avec une alerte distincte.
 *    Jamais plafonné quand seule une opposition compte (orphelin, état terminal) : un « stop » n'est jamais perdu.
 * `veille` : le message a été écrit pendant la reprise humaine : l'appelant le lit mais n'y répond jamais.
 */
const ESSAIS_LISTE_INCOMPLETE = 6;
async function lireTexte(ev: EvenementFournisseur, d: DepsConversation, idCompte: string, idConversation: string, idMessage: string, now: number, plafonner: boolean, cleDossier: string | null = null, igSuivre = false): Promise<{ texte: string; veille: boolean } | null> {
  const c = ev.charge;
  const occurredAt = typeof c.occurredAt === "string" ? c.occurredAt : undefined;
  const idExpediteur = typeof c.idExpediteur === "string" && c.idExpediteur ? c.idExpediteur : undefined;
  const idPlateforme = typeof c.idPlateforme === "string" && c.idPlateforme ? c.idPlateforme : undefined;
  let lu: MessageLu;
  try {
    lu = await d.port.lireMessage({ idCompte, idConversation, idMessage, ...(idPlateforme ? { idPlateforme } : {}), ...(occurredAt ? { occurredAt } : {}), ...(idExpediteur ? { idExpediteur } : {}) });
  } catch {
    lu = { texte: null, postback: null, panne: true };
  }
  if (lu.panne === true) {
    const n = Number(c.pannesLecture ?? 0);
    if (plafonner && lu.codePanne === "liste-incomplete" && n + 1 >= ESSAIS_LISTE_INCOMPLETE) {
      await alerter("liste_incomplete", "La lecture d'un message privé est abandonnée : liste Zernio trop longue ou incomplète (6 essais). L'événement est clos sans réponse ; à vérifier dans l'Inbox Zernio.", now);
      await douterSiInstagramEnAttente(cleDossier, igSuivre, now);
      await clore(ev, "ignore", "liste_incomplete");
      return null;
    }
    const s = transition(null, { t: "texte_panne", essais: n });
    await reporter(ev, now, s.apresMs ?? 30_000, "lecture_panne", { pannesLecture: n + 1 });
    const horsListe = !(d.comptesLecture ?? d.comptesPermis).includes(idCompte) && !d.comptesPermis.includes(idCompte);
    await alerter(horsListe ? "lecture_compte_hors_liste" : "lecture_panne", horsListe
      ? "La lecture d'un message privé échoue : compte hors liste (absent des comptes autorisés). L'événement est réessayé plus tard, rien n'est ignoré. Vérifier les comptes autorisés."
      : "La lecture d'un message privé échoue (panne Zernio ou réseau) : l'événement est réessayé plus tard, rien n'est ignoré. Vérifier l'accès à l'Inbox Zernio.", now);
    return null;
  }
  if (lu.introuvable === true) {
    // Message absent de la liste (pagination, indexation) : délais longs ; à la dernière lecture sans succès seulement, on clôt.
    const n = Number(c.essaisIntrouvable ?? 0);
    const s = transition(null, { t: "texte_introuvable", essais: n });
    if (s.action === "introuvable_reessai") await reporter(ev, now, s.apresMs ?? 5 * 60_000, "message_introuvable", { essaisIntrouvable: n + 1 });
    else {
      await douterSiInstagramEnAttente(cleDossier, igSuivre, now);
      await clore(ev, "ignore", "introuvable");
    }
    return null;
  }
  if (lu.texte === null) {
    const n = Number(c.essaisTexte ?? 0);
    const s = transition(null, { t: "texte_absent", essais: n });
    if (s.action === "texte_reessai") await reporter(ev, now, s.apresMs ?? 30_000, "texte_absent", { essaisTexte: n + 1 });
    else {
      await douterSiInstagramEnAttente(cleDossier, igSuivre, now);
      await clore(ev, "ignore", "texte_absent");
    }
    return null;
  }
  return { texte: lu.texte, veille: lu.veille === true };
}

/** Opposition écrite en privé : TOUS les identifiants connus de la personne (expéditeur, auteur du commentaire d'origine, alias) sont opposés. */
async function opposerEnPrive(ev: EvenementFournisseur, env: Env, cle: string, idExpediteur: string, idConversation: string | null, emps: string[], cleHmac: CleEmpreinte, now: number): Promise<void> {
  const bruts = [idExpediteur, ...(idConversation ? [idConversation] : [])];
  await enregistrerOppositionPersonne(bruts, [cle], ESPACE_CONVERSATION, { env }); // le « stop » est noté avant tout le reste
  await noterAlias(cle, emps);
  const etat = await lireEtat(cle);
  await enregistrerOppositionPersonne(bruts, [cle, ...(etat?.alias ?? [])], ESPACE_CONVERSATION, { env });
  // Mise en file AVANT de passer à « oppose » : si elle échoue, l'état reste inchangé et le réessai refait tout (rien n'est perdu).
  // Idempotente (une entrée par personne) ; sans effet si l'adresse n'a jamais été transmise au site.
  if (etat) await mettreEnFileOpposition(cle, etat, cleHmac, now);
  await patcher(cle, { etat: "oppose", prochainEssaiLe: null });
  await clore(ev, "oppose", "opposition");
}

/**
 * Mode « plusieurs mots » : « stop » écrit en privé. Registre sur la racine + ses alias + identifiants BRUTS, TOUS les enregistrements du dossier
 * à `oppose`, mise en file pour CHAQUE enregistrement. Les empreintes de l'expéditeur et du fil deviennent des alias (vers la racine).
 */
async function opposerEnPriveDossier(ev: EvenementFournisseur, env: Env, cle: string, idExpediteur: string, idConversation: string | null, emps: string[], cleHmac: CleEmpreinte, now: number): Promise<void> {
  const bruts = [idExpediteur, ...(idConversation ? [idConversation] : [])];
  await noterAlias(cle, emps);
  await opposerDossier({ racine: racineDe(cle), idsBruts: bruts, cles: cleHmac, env, maintenantMs: now });
  await clore(ev, "oppose", "opposition");
}

/** Met en file le « stop » d'un enregistrement ; clé de dossier (`racine|…`) : de CHAQUE enregistrement du dossier. Clé sans `|` : inchangé. */
async function mettreEnFileCle(cle: string, etat: Conversation, cleHmac: CleEmpreinte, now: number): Promise<void> {
  if (racineDe(cle) === cle) return mettreEnFileOpposition(cle, etat, cleHmac, now);
  const { entrees } = await lireDossier(racineDe(cle));
  await mettreEnFileDossier(entrees.some((x) => x.cle === cle) ? entrees : [...entrees, { cle, etat }], cleHmac, now);
}

/** Mode « plusieurs mots » : dossier de la personne, puis le parcours à qui rattacher le message (`choisirParcoursPourMessage`). `null` = aucun parcours de ce compte (orphelin). */
async function retrouverDossier(cles: ClesOk, idS: string, idC: string | null, idMessage: string, idCompte: string, igSuivre = false, contientAdresse = false): Promise<{ cle: string; etat: Conversation; tous: string[] } | null> {
  const trouve = await sousVerrou(async () => {
    const { conv, alias } = await lireTout();
    const t = chercherRacine(formesDe(cles, idS), idC ? formesDe(cles, idC) : [], conv, alias);
    if (!t) return null;
    const ch = choisirParcoursPourMessage(dossierDe(t.racine, conv), idMessage, idCompte, igSuivre, contientAdresse);
    return ch.principal ? { t, principal: ch.principal, tous: ch.tous.map((x) => x.cle) } : null;
  });
  if (!trouve) return null;
  const { principal } = trouve;
  if (trouve.t.ancienne) await noterAlias(principal.cle, [trouve.t.courante]);
  const etat = trouve.t.ancienne ? ((await lireEtat(principal.cle)) ?? principal.etat) : principal.etat;
  return { cle: principal.cle, etat, tous: trouve.tous };
}

async function traiterMessage(ev: EvenementFournisseur, d: DepsConversation, env: Env, cles: ClesOk, now: number, multi = false, igSuivre = false): Promise<"traite" | "bloque"> {
  const c = ev.charge;
  const idCompte = String(c.idCompte ?? "");
  const idMessage = String(c.idMessage ?? "");
  const idExpediteur = texteDe(c.idExpediteur);
  const idConversation = texteDe(c.idConversation);
  const sortant = c.sortant === true;
  const premier = transition(null, { t: "message", idExpediteur, idCompte, idMessage, sortant });
  if (premier.action === "ecarter") {
    await clore(ev, "ecarte", premier.raison ?? null);
    return "traite";
  }
  const empS = empreintePersonne(cles.courante, ESPACE_CONVERSATION, idExpediteur!);
  const empC = idConversation ? empreintePersonne(cles.courante, ESPACE_CONVERSATION, idConversation) : null;
  const emps = empC ? [empS, empC] : [empS];
  const trouve: { cle: string; etat: Conversation; tous?: string[] } | null = multi ? await retrouverDossier(cles, idExpediteur!, idConversation, idMessage, idCompte, igSuivre) : await retrouver(cles, idExpediteur!, idConversation);
  if (!trouve) {
    // Orphelin : 2 réessais ; ensuite le texte est lu QUAND MÊME, pour ne pas perdre un « stop » (aucune réponse n'est jamais envoyée).
    const n = Number(c.orphelins ?? 0);
    const s = transition(null, { t: "orphelin", essais: n });
    if (s.action === "orphelin_reessai") {
      await reporter(ev, now, s.apresMs ?? 30_000, "orphelin", { orphelins: n + 1 });
      return "traite";
    }
    if (!idConversation) {
      await clore(ev, "ignore", "orphelin");
      return "traite";
    }
    if (!(d.comptesLecture ?? d.comptesPermis).includes(idCompte)) {
      // Compte hors des deux listes : jamais clos (un « stop » n'est jamais perdu), on revient plus tard ; alerte au plus une par heure.
      await reporter(ev, now, ATTENTE_COMPTE_HORS_LISTE_MS, "compte_hors_liste");
      await alerter("compte_hors_liste", "Un message privé arrive sur un compte absent des listes autorisées : il est gardé en attente (il peut contenir un « stop »). Vérifier les comptes autorisés.", now);
      return "traite";
    }
    const lu = await lireTexte(ev, d, idCompte, idConversation, idMessage, now, false);
    if (!lu) return "traite";
    const classeOrphelin = classerOpposition(lu.texte);
    if (classeOrphelin === "opposition") {
      await enregistrerOpposition(idExpediteur!, ESPACE_CONVERSATION, { env });
      await enregistrerOpposition(idConversation, ESPACE_CONVERSATION, { env });
      await clore(ev, "oppose", "opposition_orpheline");
    } else if (classeOrphelin === "doute") {
      await signalerDoute(ev, now);
      await clore(ev, "ignore", "doute_opposition");
    } else await clore(ev, "ignore", "orphelin");
    return "traite";
  }
  let { cle } = trouve;
  // Avant tout envoi, même pour une personne opposée (sans effet d'envoi). Mode « plusieurs mots » : sur TOUS les parcours du même compte (la fenêtre de 24 h est celle de la personne).
  for (const k of trouve.tous ?? [cle]) await noterActivite(k, ev, now);
  let etat = trouve.etat;
  const s0 = transition(etat, { t: "message", idExpediteur, idCompte, idMessage, sortant });
  if (s0.action === "silence") {
    // Déjà « oppose » (un réessai après un échec de mise en file) : la mise en file, idempotente, est refaite avant de clore.
    if (etat.etat === "oppose") await mettreEnFileCle(cle, etat, cles.courante, now);
    await clore(ev, "silence", s0.raison ?? null);
    return "traite";
  }
  if (!(await verifierPartout(env, cle, ev.charge, now))) {
    // Personne opposée (registre, autre réseau ou état) : la vérification passe l'état à « oppose » ; le « stop » est mis en file ici.
    await mettreEnFileCle(cle, etat, cles.courante, now);
    await clore(ev, "silence", "opposee");
    return "traite";
  }
  const opposerEnPrive_ = multi ? opposerEnPriveDossier : opposerEnPrive;
  if (s0.action === "reprendre_recu") {
    // Envoi sortant : soumis aux gardes.
    const bloque = await garde(d, env, etat.idCompte, etat.reseau, etat, now);
    if (await cloreSiGardeMotDurable(ev, bloque, now)) return "traite";
    if (bloque) {
      await alerter(`garde:${bloque}`, MESSAGES_GARDE[bloque] ?? "Une garde de sécurité bloque les envois.", now);
      await reporter(ev, now, ATTENTE_GARDE_MS, `garde_${bloque}`);
      return "bloque";
    }
    if (!idConversation) {
      await clore(ev, "ignore", "conversation_inconnue");
      return "traite";
    }
    return envoyerRecu(ev, d, env, cle, etat, idConversation, idMessage, now, igSuivre);
  }
  // LECTURE AVANT LES GARDES, dans tous les états : un « stop » est toujours lu et enregistré (lire n'envoie rien).
  if (!idConversation) {
    await douterSiInstagramEnAttente(cle, igSuivre, now);
    await clore(ev, "ignore", "conversation_inconnue");
    return "traite";
  }
  const lu = await lireTexte(ev, d, etat.idCompte, idConversation, idMessage, now, s0.action !== "lire_opposition", cle, igSuivre);
  if (!lu) return "traite";
  // Réglage allumé : un message qui CONTIENT une adresse e-mail va au parcours `attente_email` s'il en existe un, jamais au parcours Instagram en attente d'un OK.
  if (multi && igSuivre && enAttenteOk(etat) && extraireAdresse(lu.texte) !== null) {
    const autre = await retrouverDossier(cles, idExpediteur!, idConversation, idMessage, idCompte, true, true);
    if (autre && autre.cle !== cle) {
      cle = autre.cle;
      etat = autre.etat;
    }
  }
  // Classé UNE fois : opposition claire, doute, ou rien.
  const classe = classerOpposition(lu.texte);
  if (s0.action === "lire_opposition") {
    // État où le message est ignoré (terminé, expiré, refusé…) : on y repère SEULEMENT une opposition ; un doute alerte, l'état reste inchangé.
    if (classe === "opposition") await opposerEnPrive_(ev, env, cle, idExpediteur!, idConversation, emps, cles.courante, now);
    else if (classe === "doute") {
      await signalerDoute(ev, now);
      await clore(ev, "silence", "doute_opposition");
    } else await clore(ev, "silence", s0.raison ?? "etat");
    return "traite";
  }
  if (classe === "opposition") {
    await opposerEnPrive_(ev, env, cle, idExpediteur!, idConversation, emps, cles.courante, now);
    return "traite";
  }
  // Doute : AVANT la veille et les gardes. Rien ne part (M2 n'est plus jamais envoyé), la conversation est en pause, l'opérateur est alerté (cloche seulement).
  if (classe === "doute") {
    await patcher(cle, { douteOpposition: true });
    await signalerDoute(ev, now);
    await clore(ev, "silence", "doute_opposition");
    return "traite";
  }
  // Veille : un humain a repris la conversation. Le « stop » a été lu ci-dessus ; ici plus rien ne part (ni M2, ni appel au site, ni accusé).
  if (lu.veille) {
    await clore(ev, "silence", "veille");
    return "traite";
  }
  // Seules les actions sortantes (M2, appel au site, accusé) restent soumises aux gardes ; l'événement attend, rien n'est perdu.
  // Parcours Instagram en attente d'un OK (réglage allumé) : la garde de CHAQUE parcours décide dans `repondreOkInstagram` (rien d'autre ne part ici).
  const bloque = igSuivre && enAttenteOk(etat) ? null : await garde(d, env, etat.idCompte, etat.reseau, etat, now);
  if (await cloreSiGardeMotDurable(ev, bloque, now)) return "traite";
  if (bloque) {
    await alerter(`garde:${bloque}`, MESSAGES_GARDE[bloque] ?? "Une garde de sécurité bloque les envois.", now);
    await reporter(ev, now, ATTENTE_GARDE_MS, `garde_${bloque}`);
    return "bloque";
  }
  // Lecture réussie = message entrant confirmé : seulement maintenant, les alias sont notés.
  const adresse = extraireAdresse(lu.texte);
  // `classe` ne peut plus valoir « opposition » ni « doute » ici (traités plus haut) : `estOpposition` et `doute` sont donc toujours faux et la
  // branche « opposer » plus bas est inatteignable aujourd'hui. Elle est GARDÉE volontairement (filet de sécurité d'un « stop ») : ne pas la retirer.
  const classeMachine: ClasseOpposition = classe as ClasseOpposition;
  const s = transition(etat, { t: "texte", estOpposition: classeMachine === "opposition", doute: classeMachine === "doute", adresse, okIg: estOkInstagram(lu.texte) });
  if (s.action === "opposer") {
    await opposerEnPrive_(ev, env, cle, idExpediteur!, idConversation, emps, cles.courante, now);
    return "traite";
  }
  await noterAlias(cle, emps);
  if (s.action === "silence") {
    await clore(ev, "silence", "silence");
    return "traite";
  }
  if (s.action === "ig_non_reconnu") {
    // Liste fermée de OK : tout autre message (hors « stop », traité plus haut) ne déclenche RIEN. Réglage éteint : silence, comme avant.
    if (!igSuivre) {
      await clore(ev, "silence", "ig_eteint");
      return "traite";
    }
    await alerter("ig_ok_non_reconnu", MESSAGE_IG_OK_NON_RECONNU, now);
    await clore(ev, "ecarte", "ok_non_reconnu");
    return "traite";
  }
  if (s.action === "ig_ok") return repondreOkInstagram(ev, d, env, cles, cle, etat.idCompte, idConversation, idMessage, idExpediteur!, igSuivre, now);
  if (s.action === "m2") {
    const m2 = await formuler({ groupe: "adresse-non-reconnue", e: etat, ancien: "mp-m2-v1", valeurs: {} });
    const texte = m2.texte;
    if (texte === null) {
      await clore(ev, "ignore", "texte_incomplet");
      return "traite";
    }
    const nonOpposeeM2 = await verifierPartout(env, cle, ev.charge, now, { m2: true });
    if (!nonOpposeeM2) {
      await clore(ev, "silence", "opposee");
      return "traite";
    }
    if (await horsFenetre(cle, now)) {
      // Fenêtre de 24 h de Meta : M2 ne part pas, m2Envoye reste faux (un message ultérieur rouvre la fenêtre).
      await patcher(cle, { dernierCode: "hors_fenetre" });
      await clore(ev, "hors_fenetre", "hors_fenetre");
      return "traite";
    }
    // Instagram (réglage allumé) : plafond de 3 messages par personne et par 24 h, M2 compris. Atteint : rien ne part ; reporté si encore servable, sinon écarté.
    if (igSuivre && etat.reseau === "instagram") {
      const lim = await plafondIg(cle, now);
      if (lim.atteint) {
        await alerter("ig_plafond_personne", MESSAGE_IG_PLAFOND_PERSONNE, now);
        if (lim.repriseMs !== null && encoreServable(lim, (await lireEtat(cle))?.derniereActiviteLe)) await reporter(ev, now, Math.max(1000, lim.repriseMs - now), "plafond_personne");
        else await clore(ev, "ecarte", "plafond_personne");
        return "traite";
      }
    }
    if (!(await reserverOuReporter(ev, etat.idCompte, now))) return "bloque";
    // m2Le écrit AVANT l'envoi (comme accuseLe) : une issue inconnue compte dans le plafond ; retiré plus bas si rien n'est parti.
    const m2Avant = etat.m2Le;
    if (igSuivre && etat.reseau === "instagram") await patcher(cle, { m2Le: new Date(now).toISOString() });
    // Formulation figée AVANT l'envoi : un nouvel essai garde exactement le même texte.
    if (m2.formulation) await patcher(cle, { formulations: { ...((await lireEtat(cle)) ?? etat).formulations, "adresse-non-reconnue": m2.formulation } });
    const res = await appeler(() => d.port.envoyerMessage({ idCompte: etat.idCompte, idConversation, texte, cle: idMessage, nonOpposee: nonOpposeeM2 }));
    const sm = transition(etat, { t: "m1", res, maintenantMs: now });
    await reagir(sm, now);
    // M2 compté dès qu'il est parti ou d'issue inconnue (jamais deux fois) ; un refus net ne compte pas.
    if (res.statut === "envoye" || res.statut === "a_verifier") await patcher(cle, { m2Envoye: true, m2Le: new Date(now).toISOString(), etat: etat.etat === "attente_email" ? "m2_envoye" : etat.etat });
    else if (igSuivre && etat.reseau === "instagram") await ecrireEtat(cle, (e) => { if (!e) return undefined; const r = { ...e }; if (m2Avant === undefined) delete r.m2Le; else r.m2Le = m2Avant; return r; });
    await clore(ev, res.statut, res.code ?? null);
    return "traite";
  }
  return demanderGuide(ev, d, env, cle, etat, idConversation, idMessage, adresse!, c, now, multi, igSuivre);
}

/* --- Instagram « suivre le compte puis OK » : réponse au OK de la personne ------------------------------------------ */
const PAS_ENCORE = "ig-pas-encore" as const;
const LIEN_RAPPEL = "lien-rappel" as const;
/** Délai d'un nouvel essai quand le port demande d'attendre (comme `secondes` de la machine : plafonné à 1 h, 60 s par défaut). */
const attenteDebit = (s: number | undefined): number => (typeof s === "number" && Number.isFinite(s) && s > 0 ? Math.min(Math.ceil(s) * 1000, 3600_000) : 60_000);
const enAttenteOk = (e: Pick<Conversation, "etat">): boolean => e.etat === "ig_attente_ok" || e.etat === "ig_pas_encore";

/**
 * Un message de la personne alors qu'au moins un parcours attend son OK (réglage allumé). Ordre : (a) « stop partout » du dossier, doute compris ›
 * (b) parcours à servir (au plus 3, les plus anciens) › (c) UNE lecture du suivi par événement, jamais gardée › (d) décision pure par parcours ›
 * (e) texte (lien neuf ou « pas encore ») › (g) état « en vol » écrit AVANT, plafond, jeton « stop partout » juste avant, un seul envoi ›
 * (h) issue. Un rejeu du même message (`idMessageOk`) n'envoie jamais rien. Aucun identifiant de personne n'est écrit ni journalisé.
 */
async function repondreOkInstagram(ev: EvenementFournisseur, d: DepsConversation, env: Env, cles: ClesOk, cle: string, idCompte: string, idConversation: string, idMessage: string, idExpediteur: string, igSuivre: boolean, now: number): Promise<"traite" | "bloque"> {
  if (!igSuivre) {
    await clore(ev, "silence", "ig_eteint"); // retour arrière : un parcours d'attente resté en base ne reçoit rien
    return "traite";
  }
  // (a) opposition ou doute, sur tout le dossier.
  if (!(await verifierPartout(env, cle, ev.charge, now, { doute: true }))) {
    const apres = await lireEtat(cle);
    if (apres?.etat === "oppose") await mettreEnFileCle(cle, apres, cles.courante, now);
    await clore(ev, "silence", "opposee");
    return "traite";
  }
  const { entrees } = await lireDossier(racineDe(cle));
  const doute = entrees.some((x) => x.etat.douteOpposition === true);
  if (doute) {
    await clore(ev, "silence", "doute_opposition");
    return "traite";
  }
  // (b) parcours à servir. Le rejeu est écarté AVANT le tri : les parcours déjà servis par CE message (quel que soit leur état) comptent dans le
  // maximum par message, sinon un rejeu après un débit servirait 4 parcours pour un seul OK.
  const enAttente = choisirParcoursPourOk(entrees.map((x) => ({ cle: x.cle, etat: x.etat.etat as string, creeLe: x.etat.creeLe, idCompte: x.etat.idCompte })), idCompte, Number.POSITIVE_INFINITY);
  if (enAttente.length === 0) {
    await clore(ev, "silence", "etat");
    return "traite";
  }
  const aServir = parcoursAServir(entrees, enAttente, idMessage, REPONSES_IG_MAX_PAR_MESSAGE);
  if (aServir.length === 0) {
    await clore(ev, "silence", "deja_traite");
    return "traite";
  }
  /** OK reçu et traité SANS envoi : compté une fois (jamais pour un rejeu) et le message est consommé pour ce parcours. */
  const consommer = (cleP: string) =>
    ecrireEtat(cleP, (e) => (e && enAttenteOk(e) && e.idMessageOk !== idMessage ? { ...e, idMessageOk: idMessage, okRecus: (e.okRecus ?? 0) + 1 } : undefined));
  // Fenêtre de 24 h de Meta contrôlée AVANT toute lecture du suivi : aucun parcours servable, aucune lecture.
  const fenetreOuverte = aServir.some((x) => {
    const a = Date.parse(entrees.find((y) => y.cle === x.cle)?.etat.derniereActiviteLe ?? "");
    return Number.isFinite(a) && now < a + FENETRE_ENVOI_MS;
  });
  if (!fenetreOuverte) {
    for (const x of aServir) await consommer(x.cle);
    await clore(ev, "silence", "hors_fenetre");
    return "traite";
  }
  // Plafond PAR PERSONNE calculé UNE fois AVANT la lecture du suivi : atteint, rien ne part et rien n'est lu (reporté si encore servable, sinon écarté).
  const limiteAvant = await plafondIg(cle, now);
  if (limiteAvant.atteint) {
    await alerter("ig_plafond_personne", MESSAGE_IG_PLAFOND_PERSONNE, now);
    let attente: number | null = null;
    for (const x of aServir) {
      if (limiteAvant.repriseMs !== null && encoreServable(limiteAvant, entrees.find((y) => y.cle === x.cle)?.etat.derniereActiviteLe)) {
        const ms = Math.max(1000, limiteAvant.repriseMs - now);
        attente = attente === null ? ms : Math.min(attente, ms);
      } else await consommer(x.cle);
    }
    if (attente !== null) await reporter(ev, now, attente, "plafond_personne");
    else await clore(ev, "ecarte", "plafond_personne");
    return "traite";
  }
  // V1 : un message plus ancien de la même personne, pas encore traité (« Stop » en panne de lecture, introuvable, texte absent…), peut être une opposition :
  // avant toute lecture du suivi et toute réservation d'envoi (lien comme « pas encore »), le OK attend. Les étapes qui précèdent n'envoient rien. Rien n'est consommé, rien ne part ; le « Stop » lu ensuite gagne.
  if (await messageNonTraiteDeLaPersonne(ev, idCompte, idConversation, idExpediteur, idMessage)) {
    const recuLe = Date.parse(ev.recuLe);
    if (!Number.isFinite(recuLe) || now - recuLe > ATTENTE_ALERTE_OK_MS) await alerter("ig_message_en_attente", "Instagram : un OK attend depuis plus de 10 minutes qu'un autre message de la personne soit lu ; rien ne part tant que ce message n'est pas traité.", now);
    await reporter(ev, now, ATTENTE_STOP_ANTERIEUR_MS, "stop_anterieur_non_lu");
    return "traite";
  }
  // (c) UNE lecture du suivi pour tout l'événement ; l'identifiant brut ne vit que dans cet appel. Méthode absente, exception ou forme inconnue : panne définitive.
  let suivi: EtatSuivi;
  try {
    suivi = suiviDepuisPort(await d.port.lireSuiviInstagram?.({ idCompte, idUtilisateur: idExpediteur }));
  } catch {
    suivi = "panne_definitive";
  }
  let envoyes = 0;
  let sansEnvoi: { etat: string; code: string } | null = null;
  let reessaiSuiviMs: number | null = null;
  let reessaiPlafondMs: number | null = null;
  let gardeBloquee: string | null = null;
  for (const choisi of aServir) {
    const avant = await lireEtat(choisi.cle);
    if (!avant || !enAttenteOk(avant) || avant.idMessageOk === idMessage) continue;
    // (d) décision pure : fenêtre de 24 h de Meta (avec marge) comptée depuis le dernier message de la personne.
    const activite = Date.parse(avant.derniereActiviteLe ?? "");
    const dec = deciderReponseInstagram({
      etat: avant.etat as "ig_attente_ok" | "ig_pas_encore",
      suivi,
      essaisSuivi: avant.essaisSuivi ?? 0,
      pasEncoreDejaEnvoye: avant.etat === "ig_pas_encore" || typeof avant.pasEncoreLe === "string",
      douteOpposition: doute,
      maintenantMs: now,
      finFenetreMs: Number.isFinite(activite) ? activite + FENETRE_ENVOI_MS : null,
    });
    if (dec.action === "silence") {
      await consommer(choisi.cle);
      sansEnvoi ??= { etat: "silence", code: dec.raison === "doute" ? "doute_opposition" : "hors_fenetre" };
      continue;
    }
    if (dec.action === "reessayer_suivi") {
      await patcher(choisi.cle, { essaisSuivi: (avant.essaisSuivi ?? 0) + 1 });
      reessaiSuiviMs = reessaiSuiviMs === null ? dec.apresMs : Math.min(reessaiSuiviMs, dec.apresMs);
      continue;
    }
    // Garde de CE parcours (mot actif, textes validés, comptes, clés) revérifiée avant toute écriture « en vol » : bloqué, on passe au suivant sans rien envoyer.
    const bloque = await garde(d, env, avant.idCompte, avant.reseau, avant, now);
    if (bloque) {
      await alerter(`garde:${bloque}`, MESSAGES_GARDE[bloque] ?? "Une garde de sécurité bloque les envois.", now);
      if (GARDES_DURABLES_PARCOURS.includes(bloque)) {
        // Mot inactif ou textes non validés pour CE mot : définitif pour ce OK (comme pour un commentaire), jamais un report d'une minute pendant 24 h.
        await consommer(choisi.cle);
        sansEnvoi ??= { etat: "ecarte", code: `garde_${bloque}` };
      } else gardeBloquee ??= bloque;
      continue;
    }
    // Plafond PAR PERSONNE (3 messages Instagram en 24 h, tous parcours), relu à chaque parcours : avant toute réservation d'envoi.
    const limite = await plafondIg(choisi.cle, now);
    if (limite.atteint) {
      await alerter("ig_plafond_personne", MESSAGE_IG_PLAFOND_PERSONNE, now);
      if (limite.repriseMs !== null && Number.isFinite(activite) && limite.repriseMs < activite + FENETRE_ENVOI_MS) {
        const attente = Math.max(1000, limite.repriseMs - now);
        reessaiPlafondMs = reessaiPlafondMs === null ? attente : Math.min(reessaiPlafondMs, attente);
      } else {
        await consommer(choisi.cle);
        sansEnvoi ??= { etat: "ecarte", code: "plafond_personne" };
      }
      continue;
    }
    // (e) texte. Lien : mécanisme du renvoi (formulation validée, version connue du site, lien signé NEUF). « Pas encore » : formulation validée du groupe.
    const groupe = dec.action === "lien" ? LIEN_RAPPEL : PAS_ENCORE;
    let prep: PrepM1;
    if (dec.action === "lien") prep = await preparerRenvoi({ ...avant, groupeM1: LIEN_RAPPEL }, d, env, cles, now);
    else {
      const choix = choisirFormulation({
        groupe: PAS_ENCORE,
        cleConversation: avant.cleIdempotenceGuide,
        figee: avant.formulations?.[PAS_ENCORE],
        validees: await formulationsValidees(),
        rendre: (v) => rendreTexteMp(v, { mot: avant.mot ?? MOT, titre: avant.titreCible ?? d.titreGuide }),
        conforme: (t) => texteDuDictionnaire(t, false),
      });
      prep = choix === null ? { texte: null, version: avant.versionTexteM1 } : { texte: choix.texte, version: choix.version, formulationIg: choix.version };
    }
    const texte = prep.texte;
    if (texte === null) {
      await consommer(choisi.cle);
      await alerter(dec.action === "lien" ? "ig_lien_indisponible" : "ig_pas_encore_absente", dec.action === "lien" ? MESSAGE_IG_LIEN_INDISPONIBLE : MESSAGE_IG_PAS_ENCORE_ABSENT, now);
      sansEnvoi ??= { etat: "ignore", code: dec.action === "lien" ? "lien_indisponible" : "pas_encore_indisponible" };
      continue;
    }
    // (g) « en vol » ÉCRIT AVANT (sous verrou) avec l'identifiant du message : un plantage ne produit jamais un 2e envoi, un rejeu n'en produit pas non plus.
    const enVol = await ecrireEtat(choisi.cle, (e) => (e && enAttenteOk(e) ? { ...e, etat: "ig_envoi_en_vol", idMessageOk: idMessage, okRecus: (e.okRecus ?? 0) + 1, prochainEssaiLe: null, essaiEnvoiLe: new Date(now).toISOString() } : undefined));
    if (enVol?.etat !== "ig_envoi_en_vol" || enVol.idMessageOk !== idMessage) continue;
    /** Remet l'état précédent (jamais d'état « oppose » rétrogradé) ; `garderOk` : le message reste consommé (refus net : pas de nouvel essai sur un rejeu). */
    const restaurer = (garderOk: boolean, extra: Partial<Conversation> = {}) =>
      ecrireEtat(choisi.cle, (e) => {
        if (!e || e.etat !== "ig_envoi_en_vol") return undefined;
        // Rien n'est parti : la date d'essai réservée avant l'envoi est remise comme avant (elle ne compte pas dans le plafond par personne).
        const { idMessageOk, okRecus, essaiEnvoiLe, ...reste } = e;
        void essaiEnvoiLe;
        const ok = garderOk ? { idMessageOk, okRecus } : { ...(avant.idMessageOk !== undefined ? { idMessageOk: avant.idMessageOk } : {}), ...(avant.okRecus !== undefined ? { okRecus: avant.okRecus } : {}) };
        return { ...reste, ...ok, ...(avant.essaiEnvoiLe !== undefined ? { essaiEnvoiLe: avant.essaiEnvoiLe } : {}), etat: avant.etat, ...extra };
      });
    if (!(await reserverOuReporter(ev, idCompte, now))) {
      await restaurer(false); // l'événement est déjà reporté (plafond du compte ou compteur illisible)
      return "bloque";
    }
    // Un message de la personne a pu arriver pendant la lecture du suivi : revérifié juste avant l'envoi ; reporté, rien ne part, réservation relâchée.
    if (await messageNonTraiteDeLaPersonne(ev, idCompte, idConversation, idExpediteur, idMessage)) {
      await rendrePlaceEnvoi(idCompte, now);
      await restaurer(false);
      await reporter(ev, now, ATTENTE_STOP_ANTERIEUR_MS, "stop_anterieur_non_lu");
      return "traite";
    }
    const nonOpposee = await verifierPartout(env, choisi.cle, ev.charge, now, { doute: true }); // jeton JUSTE avant l'envoi
    if (!nonOpposee) {
      await rendrePlaceEnvoi(idCompte, now);
      await restaurer(false);
      const apres = await lireEtat(choisi.cle);
      if (apres?.etat === "oppose") await mettreEnFileCle(choisi.cle, apres, cles.courante, now);
      await clore(ev, "silence", "opposee");
      return "traite";
    }
    processus().enVol.add(choisi.cle);
    let res: ResultatEcritureInbox;
    try {
      res = await appeler(() => d.port.envoyerMessage({ idCompte, idConversation, texte, cle: `${idMessage}|ig|${groupe}|${choisi.cle}`, nonOpposee }));
    } finally {
      processus().enVol.delete(choisi.cle);
    }
    const s = transition(avant, { t: "m1", res, maintenantMs: now });
    await reagir(s, now);
    // (h) issue.
    if (res.statut === "envoye") {
      envoyes++;
      const quand = new Date(now).toISOString();
      if (dec.action === "lien") {
        await ecrireEtat(choisi.cle, (e) => (e && e.etat === "ig_envoi_en_vol"
          ? { ...e, etat: "attente_email", lienIgLe: quand, suiviIg: dec.issue, versionTexteM1: prep.version, dernierCode: null,
              ...(prep.formulationLien ? { formulations: { ...e.formulations, [LIEN_RAPPEL]: prep.formulationLien } } : {}),
              ...(prep.refLienConv ? { refLienConv: prep.refLienConv } : {}),
              ...(prep.empreinteLien ? { empreintesLien: [...(e.empreintesLien ?? []), prep.empreinteLien].slice(-5) } : {}) }
          : undefined));
      } else {
        await ecrireEtat(choisi.cle, (e) => (e && e.etat === "ig_envoi_en_vol"
          ? { ...e, etat: "ig_pas_encore", pasEncoreLe: quand, dernierCode: null, ...(prep.formulationIg ? { formulations: { ...e.formulations, [PAS_ENCORE]: prep.formulationIg } } : {}) }
          : undefined));
      }
      continue;
    }
    if (res.statut === "a_verifier") {
      // Issue inconnue : jamais un nouvel essai automatique.
      await ecrireEtat(choisi.cle, (e) => (e && e.etat === "ig_envoi_en_vol" ? { ...e, etat: "ig_a_verifier", dernierCode: res.code ?? "a_verifier" } : undefined));
      await alerter("ig_a_verifier", MESSAGE_IG_A_VERIFIER, now);
      sansEnvoi ??= { etat: "a_verifier", code: res.code ?? "a_verifier" };
      continue;
    }
    if (res.statut === "a_reessayer") {
      // Débit : état précédent restauré, rien n'est consommé ; le même événement revient plus tard (la décision dira « silence » hors fenêtre).
      await restaurer(false, { dernierCode: res.code ?? "debit" });
      await reporter(ev, now, attenteDebit(res.reessayerApresSec), res.code ?? "debit");
      return "traite";
    }
    // Refus net ou échec définitif : état précédent restauré, code gardé. Un code de blocage ouvre le disjoncteur (`reagir`) et arrête tout.
    await restaurer(true, { dernierCode: res.code ?? res.statut });
    if (s.blocage) {
      await clore(ev, "bloque", s.code ?? null);
      return "traite";
    }
    sansEnvoi ??= { etat: res.statut, code: res.code ?? res.statut };
  }
  if (reessaiSuiviMs !== null || reessaiPlafondMs !== null || gardeBloquee !== null) {
    // Rien n'est perdu : l'événement revient (suivi en panne, plafond personne, garde). Le plus court délai l'emporte.
    const attentes: Array<[number, string]> = [];
    if (reessaiSuiviMs !== null) attentes.push([reessaiSuiviMs, "suivi_panne"]);
    if (reessaiPlafondMs !== null) attentes.push([reessaiPlafondMs, "plafond_personne"]);
    if (gardeBloquee !== null) attentes.push([ATTENTE_GARDE_MS, `garde_${gardeBloquee}`]);
    const [ms, code] = attentes.sort((a, b) => a[0] - b[0])[0];
    await reporter(ev, now, ms, code);
    // Même si un autre parcours est parti : le parcours en attente ne doit pas être perdu (les parcours déjà servis sont ignorés au rejeu).
    return envoyes === 0 && gardeBloquee !== null && reessaiSuiviMs === null && reessaiPlafondMs === null ? "bloque" : "traite";
  }
  if (envoyes > 0) await clore(ev, "envoye", null);
  else await clore(ev, sansEnvoi?.etat ?? "silence", sansEnvoi?.code ?? "deja_traite");
  return "traite";
}

/** Codes des cibles `guide` actives et non d'essai du catalogue, plus `guide-ia`. Catalogue illisible : la liste par défaut. */
async function guidesDuCatalogue(env: Env, now: number): Promise<readonly string[]> {
  try {
    const site = await lireCiblesSite({ env, maintenantMs: now });
    if (site === null) return GUIDES_RESEAU_CONNUS;
    return [...new Set(["guide-ia", ...site.catalogue.filter((x) => x.type === "guide" && x.actif && !x.test).map((x) => x.code)])];
  } catch {
    return GUIDES_RESEAU_CONNUS;
  }
}

async function demanderGuide(ev: EvenementFournisseur, d: DepsConversation, env: Env, cle: string, etat: Conversation, idConversation: string, idMessage: string, adresse: string, c: Record<string, unknown>, now: number, multi = false, igSuivre = false): Promise<"traite" | "bloque"> {
  const site = transportDuSite(env);
  const p = processus();
  if (!site || now < p.ouvertJusqua) {
    // Site non relié ou disjoncteur du site ouvert : l'événement est reporté (pas de relecture de Zernio à chaque passage) ; alerte 1/heure.
    await reporter(ev, now, site ? Math.max(60_000, p.ouvertJusqua - now) : ATTENTE_SITE_ABSENT_MS, site ? "site_disjoncteur" : "site_non_relie");
    if (!site) await alerter("site_non_relie", "Le site des guides n'est pas relié (adresse ou secret absent) : les demandes de guide attendent. Vérifier la configuration du site.", now);
    return "bloque";
  }
  if (!(await verifierPartout(env, cle, ev.charge, now))) {
    await clore(ev, "silence", "opposee");
    return "traite";
  }
  // occurredAt FIGÉ au premier essai (stocké dans l'état), puis réutilisé tel quel : mêmes octets à chaque essai.
  // idMessageAdresse (identifiant opaque, jamais l'adresse) est écrit avec lui : il permet de relire l'adresse pour un « stop ».
  const occurredAt = etat.occurredAt ?? (typeof c.occurredAt === "string" ? c.occurredAt : new Date(now).toISOString());
  const run: RunLu = { email: adresse, mot: etat.mot ?? MOT, reseau: etat.reseau, guide: etat.guide, versionTexteM1: etat.versionTexteM1, occurredAt };
  const cleEnvoi = RE_CLE_IDEMPOTENCE.test(etat.cleIdempotenceGuide) ? etat.cleIdempotenceGuide : "";
  // Mode allumé : guides connus = cibles `guide` actives et non d'essai du catalogue (+ `guide-ia`) ; catalogue illisible : liste par défaut. Éteint : appel inchangé.
  const guidesConnus = multi ? await guidesDuCatalogue(env, now) : undefined;
  if (!(guidesConnus ? runValide(run, undefined, guidesConnus) : runValide(run)) || !cleEnvoi) {
    await patcher(cle, { etat: "site_refuse", dernierCode: "run_invalide" });
    await alerter("site_refuse", "Le site a refusé une demande de guide (données invalides). La personne ne recevra pas le guide.", now);
    await clore(ev, "site_refuse", "run_invalide");
    return "traite";
  }
  const corpsV1 = corpsDemandeGuide(run, cleEnvoi);
  // Lot Z1 : corps v3 seulement si l'interrupteur est allumé, qu'au moins un préfixe de compte est configuré ET que le compte de la conversation est listé
  // (ORIGINE_V3_COMPTES) ; sinon v1 inchangé. La version choisie est FIGÉE dans l'état au premier essai (le site répond 409 si le corps change pour une même clé).
  // Origine = référence de publication (identifiant opaque) + canal « commentaire » ; mot, réseau, date et version M1 sont déjà dans le corps.
  // Un refus de construction est journalisé par son code seul (jamais la valeur, jamais une adresse) et on retombe sur le corps v1.
  let version: 1 | 3 = etat.versionCorpsGuide ?? 1;
  let corps = corpsV1;
  if (etat.versionCorpsGuide === undefined || etat.versionCorpsGuide === null) {
    version = 1;
    // Migration douce : un état ancien (sans versionCorpsGuide) dont un essai est déjà parti (occurredAt écrit dès le premier essai) a envoyé un corps v1
    // (les interrupteurs v3 étaient éteints avant) : on FIGE la version à 1 sans la recalculer, sinon même clé + corps différent = 409 cle_reutilisee définitif.
    if (etat.occurredAt === null && origineV3Active(env) && prefixesComptesConfigures(env).length > 0 && compteAutoriseOrigineV3(etat.idCompte, env)) {
      const o3 = construireOrigineV3({ postRef: etat.idPostPlateforme ?? undefined, canal: "commentaire" }, { reseau: etat.reseau, prefixesComptes: prefixesComptesConfigures(env) });
      if (o3.ok) version = 3;
      else await journaliser("parcours_conversation", `Origine v3 non envoyée : ${o3.code}.`);
    }
  }
  if (version === 3) {
    const o3 = construireOrigineV3({ postRef: etat.idPostPlateforme ?? undefined, canal: "commentaire" }, { reseau: etat.reseau, prefixesComptes: prefixesComptesConfigures(env) });
    if (o3.ok) corps = corpsDemandeGuideV3(run, cleEnvoi, o3.origine);
    else version = 1; // version figée en v3 mais origine non reconstructible (configuration retirée) : repli v1, figé ci-dessous
  }
  if (etat.occurredAt === null || !etat.idMessageAdresse || etat.versionCorpsGuide !== version) {
    await patcher(cle, { occurredAt, idMessageAdresse: etat.idMessageAdresse ?? idMessage, versionCorpsGuide: version });
  }
  let enV3 = version === 3;
  let statut = 0;
  let corpsReponse: unknown = null;
  // Réessai après un report au plafond : le refus 422 est déjà connu, on ne rappelle pas le site.
  if (etat.adresseRefuseeEnAttente === true) statut = 422;
  for (let n = 0; n < ESSAIS_NONCE && etat.adresseRefuseeEnAttente !== true; n++) {
    const entetes = signerAppel({ secret: site.secret, methode: "POST", chemin: CHEMIN_DEMANDES_GUIDE, corps, horodatageSec: Math.floor(Date.now() / 1000) });
    try {
      const r = await site.transport({ methode: "POST", chemin: CHEMIN_DEMANDES_GUIDE, corps, entetes });
      statut = r.statut;
      corpsReponse = r.corps;
    } catch {
      statut = 0;
      corpsReponse = null;
    }
    // Le site refuse l'origine v3 (422) : la demande n'est pas perdue, reprise immédiate en corps v1 (même clé).
    if (enV3 && statut === 422) {
      corps = corpsV1;
      enV3 = false;
      await patcher(cle, { versionCorpsGuide: 1 });
      n--; // le repli v1 ne consomme pas d'essai : il est toujours tenté
      continue;
    }
    const cd = conduiteApresReponse(statut, corpsReponse, etat.essaisSite + 1);
    if (!(cd.genre === "reessayer" && cd.nouveauNonce)) break;
  }
  const conduite = conduiteApresReponse(statut, corpsReponse, etat.essaisSite + 1);
  const s = transition(etat, { t: "site", conduite, enCoursAvant: Number(c.enCours ?? 0) });
  const code = conduite.genre === "termine" ? "200" : conduite.code;
  if (conduite.genre === "termine") p.pannes = 0;
  else if (pannesSite(code) && ++p.pannes >= DISJONCTEUR_SEUIL) {
    p.ouvertJusqua = now + DISJONCTEUR_PAUSE_MS;
    p.pannes = 0;
    await alerter("site_disjoncteur", `Le site des guides ne répond pas : ${DISJONCTEUR_SEUIL} pannes de suite, pause de ${DISJONCTEUR_PAUSE_MS / 60_000} minutes.`, now);
  }
  // Z2 : le site refuse l'ADRESSE (422) : UN seul message demande de la vérifier (jamais deux, rien si opposée, plafond respecté).
  // AVANT de passer l'état à « site_refuse » : si le plafond reporte l'événement, l'état est intact et le réessai reprend ici.
  if (s.action === "site_refuse" && s.code === "422" && (await prevenirAdresseRefusee(ev, d, env, cle, etat, idConversation, idMessage, now, igSuivre)) === "bloque") {
    // Le refus est connu : on le note pour que le réessai ne rappelle PAS le site (une seule demande au site par refus).
    await patcher(cle, { adresseRefuseeEnAttente: true });
    return "bloque";
  }
  // Une personne passée à « oppose » pendant ce traitement (vérification « stop partout ») le reste : l'état du site ne l'écrase jamais.
  const patchSite: Partial<Conversation> = { ...(s.patch ?? {}) };
  if (patchSite.etat !== undefined && (await lireEtat(cle))?.etat === "oppose") delete patchSite.etat;
  await patcher(cle, { ...patchSite, ...(etat.adresseRefuseeEnAttente ? { adresseRefuseeEnAttente: false } : {}), ...(s.action === "guide_ok" ? { idMessageGuide: idMessage, idMessageAdresse: idMessage } : {}) });
  if (s.action === "site_reessai") {
    await reporter(ev, now, s.apresMs ?? 60_000, s.code ?? "reessai", code === "409_en_cours" ? { enCours: Number(c.enCours ?? 0) + 1 } : {});
    return "traite";
  }
  if (s.action === "site_refuse") {
    // Refus définitif : sans merci (aucun accusé à la personne).
    await alerter("site_refuse", `Le site a refusé définitivement une demande de guide (code ${s.code ?? "?"}). La personne ne recevra pas le guide. Vérifier la configuration du site.`, now);
    await clore(ev, "site_refuse", s.code ?? null);
    return "traite";
  }
  const maj = await lireEtat(cle);
  return envoyerRecu(ev, d, env, cle, maj ?? etat, idConversation, idMessage, now, igSuivre);
}

/** Z2 : message unique « vérifiez votre adresse ». « bloque » = plafond atteint (l'événement est reporté, rien n'est consommé). */
async function prevenirAdresseRefusee(ev: EvenementFournisseur, d: DepsConversation, env: Env, cle: string, etat: Conversation, idConversation: string, idMessage: string, now: number, igSuivre = false): Promise<"fait" | "bloque"> {
  if ((await lireEtat(cle))?.adresseRefuseeEnvoyee === true) return "fait";
  const nonOpposeeAdresse = await verifierPartout(env, cle, ev.charge, now);
  if (!nonOpposeeAdresse) return "fait";
  if (await horsFenetre(cle, now)) {
    // Fenêtre de 24 h de Meta : le message ne partira plus jamais (l'état passe ensuite à site_refuse).
    await patcher(cle, { adresseRefuseeEnvoyee: true, dernierCode: "hors_fenetre" });
    return "fait";
  }
  // Garde de validation (échec fermé) : seule une formulation validée dans /mots (empreinte exacte) peut partir.
  const etatCourant = (await lireEtat(cle)) ?? etat;
  const choix = choisirFormulation({
    groupe: "adresse-refusee",
    cleConversation: etat.cleIdempotenceGuide,
    figee: etatCourant.formulations?.["adresse-refusee"],
    validees: await formulationsValidees(),
    rendre: (v) => rendreTexteMp(v, {}),
    conforme: (t) => texteDuDictionnaire(t, false),
  });
  if (choix === null) {
    await alerter("adresse_refusee_non_validee", "Aucune formulation « adresse refusée » n'est validée dans Mots : le message n'est pas parti.", now);
    return "fait";
  }
  if (choix.figeeAbandonnee) await journaliser("parcours_conversation", "formulation_figee_non_validee");
  // Instagram (réglage allumé) : plafond de 3 messages par personne et par 24 h. Atteint : rien ne part ; reporté (« bloque ») si encore servable, sinon abandonné.
  const ig = igSuivre && etat.reseau === "instagram";
  if (ig) {
    const lim = await plafondIg(cle, now);
    if (lim.atteint) {
      await alerter("ig_plafond_personne", MESSAGE_IG_PLAFOND_PERSONNE, now);
      if (lim.repriseMs !== null && encoreServable(lim, etatCourant.derniereActiviteLe)) {
        await reporter(ev, now, Math.max(1000, lim.repriseMs - now), "plafond_personne");
        return "bloque";
      }
      await patcher(cle, { adresseRefuseeEnvoyee: true, dernierCode: "plafond_personne" });
      return "fait";
    }
  }
  if (!(await reserverOuReporter(ev, etat.idCompte, now))) return "bloque";
  // Formulation figée et message marqués AVANT l'envoi : même si l'issue est inconnue ou si l'écriture de l'état échoue plus loin, le message ne repart pas.
  await patcher(cle, { adresseRefuseeEnvoyee: true, ...(ig ? { adresseRefuseeLe: new Date(now).toISOString() } : {}), formulations: { ...etatCourant.formulations, "adresse-refusee": choix.version } });
  const res = await appeler(() => d.port.envoyerMessage({ idCompte: etat.idCompte, idConversation, texte: choix.texte, cle: idMessage, nonOpposee: nonOpposeeAdresse }));
  await reagir(transition(etat, { t: "m1", res, maintenantMs: now }), now);
  return "fait";
}

async function envoyerRecu(ev: EvenementFournisseur, d: DepsConversation, env: Env, cle: string, etat: Conversation, idConversation: string, idMessage: string, now: number, igSuivre = false): Promise<"traite" | "bloque"> {
  const recu = await formuler({ groupe: "recu", e: (await lireEtat(cle)) ?? etat, ancien: "mp-recu-v2", valeurs: { titre: etat.titreCible ?? d.titreGuide } });
  const texte = recu.texte;
  let code: string | null = "texte_incomplet";
  if (texte !== null) {
    const nonOpposeeRecu = await verifierPartout(env, cle, ev.charge, now);
    if (!nonOpposeeRecu) {
      await clore(ev, "silence", "opposee");
      return "traite";
    }
    if (await horsFenetre(cle, now)) {
      // Le guide part par e-mail (demande déjà faite au site) : seul le reçu dans la conversation est abandonné.
      await patcher(cle, { etat: "termine", dernierCode: "hors_fenetre" });
      await clore(ev, "termine", "hors_fenetre");
      return "traite";
    }
    // Instagram (réglage allumé) : plafond de 3 messages par personne et par 24 h. Atteint : l'accusé ne part pas (reporté si encore servable, sinon le parcours se termine sans lui).
    const ig = igSuivre && etat.reseau === "instagram";
    if (ig) {
      const lim = await plafondIg(cle, now);
      if (lim.atteint) {
        await alerter("ig_plafond_personne", MESSAGE_IG_PLAFOND_PERSONNE, now);
        if (lim.repriseMs !== null && encoreServable(lim, ((await lireEtat(cle)) ?? etat).derniereActiviteLe)) {
          await reporter(ev, now, Math.max(1000, lim.repriseMs - now), "plafond_personne");
          return "traite";
        }
        await patcher(cle, { etat: "termine", dernierCode: "plafond_personne" });
        await clore(ev, "termine", "plafond_personne");
        return "traite";
      }
    }
    if (!(await reserverOuReporter(ev, etat.idCompte, now))) return "bloque";
    // Formulation figée AVANT l'envoi : un nouvel essai garde exactement le même texte. La date d'essai (plafond par personne) est écrite avant l'envoi.
    if (recu.formulation || ig) await patcher(cle, { ...(recu.formulation ? { formulations: { ...((await lireEtat(cle)) ?? etat).formulations, recu: recu.formulation } } : {}), ...(ig ? { accuseLe: new Date(now).toISOString() } : {}) });
    const res = await appeler(() => d.port.envoyerMessage({ idCompte: etat.idCompte, idConversation, texte, cle: idMessage, nonOpposee: nonOpposeeRecu }));
    await reagir(transition(etat, { t: "m1", res, maintenantMs: now }), now);
    code = res.statut === "envoye" ? null : (res.code ?? res.statut);
  }
  await patcher(cle, { etat: "termine", dernierCode: code });
  await clore(ev, "termine", code);
  return "traite";
}

/* --- Passage ---------------------------------------------------------------------------------------------------- */
/** Au redémarrage, tout `m1_en_vol` qui n'est pas en cours dans CE processus est traité comme `m1_a_verifier` : jamais de 2e envoi. */
async function reprendreEnVol(now: number): Promise<void> {
  const vol = processus().enVol;
  const touches = await sousVerrou(async () => {
    const conv = await lireParametre<Conversations>(PARAM_CONVERSATIONS, {});
    const cles = Object.keys(conv).filter((k) => conv[k].etat === "m1_en_vol" && !vol.has(k));
    // Instagram : un envoi « lien » ou « pas encore » en vol au redémarrage n'est JAMAIS renvoyé.
    const clesIg = Object.keys(conv).filter((k) => conv[k].etat === "ig_envoi_en_vol" && !vol.has(k));
    if (cles.length === 0 && clesIg.length === 0) return 0;
    await ecrireParametre(PARAM_CONVERSATIONS, {
      ...conv,
      ...Object.fromEntries(cles.map((k) => [k, { ...conv[k], etat: "m1_a_verifier", dernierCode: "redemarrage" }])),
      ...Object.fromEntries(clesIg.map((k) => [k, { ...conv[k], etat: "ig_a_verifier", dernierCode: "redemarrage" }])),
    });
    return cles.length + clesIg.length;
  });
  if (touches > 0) await alerter("m1_a_verifier", "Un message privé était en cours d'envoi lors d'un arrêt : il ne sera pas renvoyé. À vérifier dans l'Inbox Zernio.", now);
}

/** Tâche d'expiration : `nouveau`, `pub_ok`, `guide_demande`, `attente_email`, `m2_envoye`, `m1_a_verifier` et `m1_en_vol` (hors vol) → `expire` après 7 jours. Aucun message n'est envoyé, aucune clé n'est retirée. */
export async function expirerConversations(o: { env?: Env; maintenantMs?: number; enVol?: ReadonlySet<string> } = {}): Promise<number> {
  if (!parcoursConversationActif(o.env ?? process.env)) return 0;
  const now = o.maintenantMs ?? Date.now();
  const expirees = await expirerSousVerrou(now, o.enVol ?? processus().enVol);
  // Même cadence : la réduction des identifiants bruts (éteinte par défaut) suit l'expiration. Une panne ici n'empêche jamais l'expiration.
  await reduireIdentifiants({ env: o.env, maintenantMs: now }).catch(() => undefined);
  return expirees;
}

function expirerSousVerrou(now: number, enVol: ReadonlySet<string>): Promise<number> {
  return sousVerrou(async () => {
    const conv = await lireParametre<Conversations>(PARAM_CONVERSATIONS, {});
    const cles = Object.keys(conv).filter((k) => doitExpirer(conv[k], now, enVol.has(k)));
    if (cles.length === 0) return 0;
    await ecrireParametre(PARAM_CONVERSATIONS, { ...conv, ...Object.fromEntries(cles.map((k) => [k, { ...conv[k], etat: "expire" }])) });
    return cles.length;
  });
}

/* --- Réduction des identifiants bruts après clôture (STU-MIN) ------------------------------------------------------ */
export const VARIABLE_REDUCTION_IDS = "PARCOURS_REDUCTION_IDS";
const LOT_REDUCTION = 50;
/** Éteint par défaut ; n'agit que si le parcours de conversation est allumé aussi. */
export function reductionIdsActive(env: Env = process.env): boolean {
  return parcoursConversationActif(env) && /^(1|true|oui)$/i.test(env[VARIABLE_REDUCTION_IDS]?.trim() ?? "");
}

/**
 * Remplace par `null` les identifiants bruts (auteur, expéditeur, conversation, plateforme) des événements clos depuis plus de
 * `DELAI_REDUCTION_MS`. La LIGNE reste, ainsi que `idEvenement`, `idCompte`, `idCommentaire` / `idMessage` (déduplication des rejeux).
 * Jamais réduits : le message qui portait l'adresse (relu pour transmettre un « stop », sans limite de durée), le dernier message d'une
 * conversation à fenêtre ouverte, un événement dont une opposition à transmettre dépend. Au plus 50 événements par passage, une seule
 * écriture par événement. Une personne opposée n'est JAMAIS touchée : aucun de ses événements (le « stop » comme le commentaire d'origine)
 * ni sa conversation, que l'opposition vienne de l'état `oppose`, de la file des oppositions ou du registre. Registre illisible : rien n'est réduit.
 */
export async function reduireIdentifiants(o: { env?: Env; maintenantMs?: number } = {}): Promise<number> {
  const env = o.env ?? process.env;
  if (!reductionIdsActive(env)) return 0;
  const now = o.maintenantMs ?? Date.now();
  const cles = lireClesEmpreinte(env);
  if (!cles.ok) return 0; // échec fermé : sans les clés on ne sait pas reconnaître une personne opposée
  const conv = await lireParametre<Conversations>(PARAM_CONVERSATIONS, {});
  const file = await lireParametre<Record<string, { etat?: string }>>("parcours.oppositions.file", {});
  const proteges = new Set<string>();
  const clesOpposees = new Set<string>(); // clés (et alias) des conversations d'une personne opposée ou en file d'opposition
  for (const [cle, c] of Object.entries(conv)) {
    for (const id of [c.idMessageAdresse, c.idMessageGuide]) if (id) proteges.add(id);
    if (c.idMessageDernier && (dansFenetreEnvoi(c, now) || file[cle]?.etat === "a_transmettre")) proteges.add(c.idMessageDernier);
    if (c.etat === "oppose" || file[cle] || c.douteOpposition === true) {
      for (const k of [cle, ...(c.alias ?? [])]) {
        clesOpposees.add(k);
        clesOpposees.add(racineDe(k)); // mode « plusieurs mots » : la racine du dossier (sans effet pour une clé sans `|`)
      }
      for (const id of [c.idMessageDernier, c.idMessageAdresse, c.idMessageGuide]) if (id) proteges.add(id);
    }
  }
  const estOpposee = async (ch: Record<string, unknown>): Promise<boolean> => {
    const ids = [ch.idAuteur, ch.idExpediteur, ch.idConversation].filter((x): x is string => typeof x === "string" && x.length > 0);
    for (const id of ids) {
      if (formesConversation(cles, id).some((f) => clesOpposees.has(f))) return true;
    }
    // Tous espaces d'empreinte (registre ET états de conversation), identifiants bruts + empreintes ; doute = opposée ; erreur = PROPAGÉE (fermé : on ne réduit pas).
    if (ids.length === 0) return false;
    const v = await personneOpposeePartout({ idsBruts: ids, empreintes: ids.flatMap((id) => formesConversation(cles, id)) }, { env, douteBloque: true });
    return v.opposee;
  };
  const iso = new Date(now).toISOString();
  const evenements = await depots().evenementsFournisseurs.lister((e) => e.fournisseur === FOURNISSEUR && (e.type === TYPE_COMMENTAIRE || e.type === TYPE_MESSAGE) && reductible(e, { idsMessagesProteges: proteges }, now));
  evenements.sort((a, b) => String(a.recuLe).localeCompare(String(b.recuLe)));
  let n = 0;
  let traites = 0;
  let doutes = 0; // les doutes du site sont bornés aussi : sinon un passage interrogerait le site pour TOUS les anciens événements
  for (const ev of evenements) {
    if (traites >= LOT_REDUCTION) break;
    try {
      if (await estOpposee(ev.charge)) continue; // la preuve de l'opposition reste intacte
    } catch (e) {
      // Doute du site pour CETTE personne (preuve manquante) : elle reste intacte, mais les suivantes ne sont pas abandonnées.
      if (e instanceof ErreurOppositionIllisible && e.code === "site_a_verifier") {
        if (++doutes >= LOT_REDUCTION) break;
        continue;
      }
      break; // registre illisible : on ne réduit plus rien dans ce passage
    }
    traites++;
    await depots().evenementsFournisseurs.modifier(ev.id, { charge: { ...ev.charge, idAuteur: null, idExpediteur: null, idConversation: null, idPlateforme: null, idsReduitsLe: iso } });
    n++;
  }
  // Conversation close depuis plus de 30 jours (sauf `oppose`) : l'identifiant brut du commentaire n'a plus d'usage (la reprise n'existe qu'en nouveau / pub_ok).
  const aReduire = await sousVerrou(async () => {
    const tout = await lireParametre<Conversations>(PARAM_CONVERSATIONS, {});
    // Date de clôture inconnue : on retient la PLUS RÉCENTE des dates de l'état (conservateur). Aucune date lisible : jamais réduit.
    const dateRecente = (c: Conversation): number | null => {
      const dates = [c.creeLe, c.m1Le, c.m2Le, c.refuseLe, c.derniereActiviteLe, c.occurredAt].map((x) => (typeof x === "string" ? Date.parse(x) : NaN)).filter((d) => Number.isFinite(d));
      return dates.length > 0 ? Math.max(...dates) : null;
    };
    // Conversation close depuis plus de 30 jours (sauf `oppose`) : l'identifiant brut du commentaire n'a plus d'usage (la reprise n'existe qu'en nouveau / pub_ok).
    const cles = Object.keys(tout).filter((k) => {
      const c = tout[k];
      if (!FINIS_REDUCTIBLES.includes(c.etat) || c.idCommentaire === "reduit") return false;
      if (c.alias?.some((a) => clesOpposees.has(a)) || clesOpposees.has(k)) return false;
      const t = dateRecente(c);
      return t !== null && now - t >= DELAI_REDUCTION_MS;
    });
    // Parcours `oppose` : sa preuve (état, identifiant du commentaire) reste intacte, mais `idMessageOk` (identifiant brut du dernier OK Instagram) part aussi au bout de 30 jours.
    const clesOppose = Object.keys(tout).filter((k) => {
      const t = tout[k].etat === "oppose" && tout[k].idMessageOk !== undefined ? dateRecente(tout[k]) : null;
      return t !== null && now - t >= DELAI_REDUCTION_MS;
    });
    // `idMessageOk` part avec les autres identifiants bruts, au bout des mêmes 30 jours.
    if (cles.length > 0 || clesOppose.length > 0) {
      await ecrireParametre(PARAM_CONVERSATIONS, {
        ...tout,
        ...Object.fromEntries(cles.map((k) => { const reste = { ...tout[k] }; delete reste.idMessageOk; return [k, { ...reste, idCommentaire: "reduit" }]; })),
        ...Object.fromEntries(clesOppose.map((k) => { const reste = { ...tout[k] }; delete reste.idMessageOk; return [k, reste]; })),
      });
    }
    return cles.length + clesOppose.length;
  });
  n += aReduire;
  if (n > 0) await journaliser("parcours_conversation", `${n} identifiants réduits.`);
  return n;
}
const FINIS_REDUCTIBLES: readonly string[] = ["termine", "site_refuse", "expire", "m1_refuse", "m1_consommee", "ig_a_verifier"];

export async function traiterConversations(d: DepsConversation): Promise<RapportConversation> {
  const env = d.env ?? process.env;
  const rapport: RapportConversation = { actif: parcoursConversationActif(env), traites: 0, enAttente: 0 };
  const p = processus();
  if (!rapport.actif || p.enCours) return rapport;
  p.enCours = true;
  try {
    const now = d.maintenantMs ?? Date.now();
    const k = lireClesEmpreinte(env);
    if (!k.ok) {
      rapport.gardeBloquante = "cles_absentes";
      await alerter("garde:cles_absentes", MESSAGES_GARDE.cles_absentes, now);
      return rapport;
    }
    // Lu UNE fois par passage, puis passé en argument. Éteint (défaut, échec fermé) : le chemin historique.
    const multi = await motsMultiplesActifs();
    // Lu UNE fois par passage, seulement si « plusieurs mots » est allumé (éteint : aucune lecture de plus). Éteint, absent ou illisible : faux.
    const igSuivre = multi ? await instagramSuivreActif() : false;
    await reprendreEnVol(now);
    await expirerConversations({ env, maintenantMs: now });
    const dus = await depots().evenementsFournisseurs.lister((e) => e.fournisseur === FOURNISSEUR && (e.type === TYPE_COMMENTAIRE || e.type === TYPE_MESSAGE) && !e.traite && (typeof e.charge.prochainEssaiLe !== "number" || e.charge.prochainEssaiLe <= now));
    dus.sort((a, b) => String(a.recuLe).localeCompare(String(b.recuLe)));
    // Les événements clos sans aucun envoi (mot sans textes validés) ne comptent pas dans le lot : ils ne prennent pas la place des GUIDE. Borne dure : 10 lots.
    let restant = LOT_MAX_PAR_PASSAGE_CONVERSATION;
    // Éteint : exactement le lot historique (aucune boucle à plusieurs lots). Allumé seulement : jusqu'à 10 lots.
    for (const ev of dus.slice(0, multi ? LOT_MAX_PAR_PASSAGE_CONVERSATION * 10 : LOT_MAX_PAR_PASSAGE_CONVERSATION)) { // les autres restent dus pour le passage suivant
      if (restant <= 0) break;
      let issue: "traite" | "bloque" | "leger";
      try {
        issue = ev.type === TYPE_COMMENTAIRE ? await (multi ? traiterCommentaireDossier(ev, d, env, k, now, igSuivre) : traiterCommentaire(ev, d, env, k, now)) : await traiterMessage(ev, d, env, k, now, multi, igSuivre);
      } catch {
        // Registre illisible ou panne de base : nouvel essai plus tard, JAMAIS « non opposée » ni envoi.
        await reporter(ev, now, ATTENTE_REGISTRE_MS, "registre_illisible").catch(() => undefined);
        rapport.enAttente++;
        restant--; // une exception compte dans le lot : panne de base = au plus un lot par passage
        continue;
      }
      if (!multi || issue !== "leger") restant--;
      if (issue === "bloque") {
        rapport.enAttente++;
        rapport.gardeBloquante = "garde";
      } else rapport.traites++;
    }
  } finally {
    p.enCours = false;
  }
  return rapport;
}

/* --- Merci après la validation de la page (Z4) ------------------------------------------------------------------- */
export const VARIABLE_INTERRUPTEUR_MERCI = "PARCOURS_MERCI_ENABLED";
export const PARAM_MERCI_JOURNAL = "parcours.merci.journal";
export const CHEMIN_CONFIRMATIONS = "/api/interne/confirmations-page-guide";
export const CHEMIN_CONFIRMATIONS_ISSUE = "/api/interne/confirmations-page-guide/issue";
const LOT_CONFIRMATIONS = 10;
/** Délais entre deux essais d'accusé (puis 6 h, sans fin). */
const ATTENTES_ACCUSE_MS = [60_000, 5 * 60_000, 15 * 60_000, 3600_000, 6 * 3600_000] as const;
const RE_REF_CONFIRMATION = /^[A-Za-z0-9_-]{8,80}$/;

/** Éteint par défaut ; n'agit que si le parcours de conversation est allumé aussi. */
export function parcoursMerciActif(env: Env = process.env): boolean {
  return parcoursConversationActif(env) && /^(1|true|oui)$/i.test(env[VARIABLE_INTERRUPTEUR_MERCI]?.trim() ?? "");
}

/** Une ligne par `ref`, JAMAIS retirée. Ni adresse, ni prénom, ni texte, ni identifiant Zernio. `cle` = clé d'empreinte de la conversation. */
export interface EntreeMerci {
  cle: string | null;
  etat: EtatMerci;
  issue: string;
  accuse: boolean;
  le: string;
  essaisAccuse: number;
  prochainAccuseLe: number | null;
}
type JournalMerci = Record<string, EntreeMerci>;
export interface RapportMerci {
  actif: boolean;
  lues: number;
  envoyes: number;
  accuses: number;
}

const lireJournalMerci = (): Promise<JournalMerci> => lireParametre<JournalMerci>(PARAM_MERCI_JOURNAL, {});
async function ecrireEntreeMerci(ref: string, f: (e: EntreeMerci | undefined) => EntreeMerci | undefined): Promise<EntreeMerci | undefined> {
  return sousVerrou(async () => {
    const j = await lireJournalMerci();
    const suivant = f(j[ref]);
    if (suivant) await ecrireParametre(PARAM_MERCI_JOURNAL, { ...j, [ref]: suivant });
    return suivant ?? j[ref];
  });
}
/** Issue vue par le site (liste fermée : envoye | hors_fenetre | echec). « echec » n'est jamais utilisé : le site re-proposerait la ref. */
const issueDuSite = (e: Pick<EntreeMerci, "etat">): "envoye" | "hors_fenetre" => (e.etat === "envoye" || e.etat === "a_verifier" ? "envoye" : "hors_fenetre");

/** Texte du merci validé par l'opérateur ET rendu non nul. `null` = ne part pas. */
async function texteMerciPret(d: DepsConversation, titre: string | undefined = d.titreGuide): Promise<string | null> {
  try {
    const b = TEXTES_MP["mp-merci-v1"];
    const attendue = createHash("sha256").update(`${b.version}\n${b.texte}`).digest("hex");
    if ((await lireParametre<{ empreinte?: unknown } | null>(PARAM_VALIDATION_MERCI, null))?.empreinte !== attendue) return null;
    return rendreTexteMp("mp-merci-v1", { titre });
  } catch {
    return null; // échec fermé
  }
}

/** Appel signé au site. Le corps n'est jamais journalisé. `null` = site non relié ou injoignable. */
async function appelerSite(env: Env, chemin: string, corpsObjet: unknown): Promise<{ statut: number; corps: unknown } | null> {
  const site = transportDuSite(env);
  if (!site) return null;
  const corps = JSON.stringify(corpsObjet);
  const entetes = signerAppel({ secret: site.secret, methode: "POST", chemin, corps, horodatageSec: Math.floor(Date.now() / 1000) });
  try {
    const r = await site.transport({ methode: "POST", chemin, corps, entetes });
    return { statut: r.statut, corps: r.corps };
  } catch {
    return null;
  }
}

/** Accuse une issue au site. Vrai = le site a pris l'accusé (200) ou le connaissait déjà (409). Sinon l'échéance du prochain essai est écrite. */
async function accuserMerci(env: Env, ref: string, now: number): Promise<boolean> {
  const e = (await lireJournalMerci())[ref];
  if (!e || e.accuse || e.etat === "en_vol") return e?.accuse === true;
  const r = await appelerSite(env, CHEMIN_CONFIRMATIONS_ISSUE, { schemaVersion: 1, issues: [{ ref, issue: issueDuSite(e) }] });
  if (r && (r.statut === 200 || r.statut === 409)) {
    await ecrireEntreeMerci(ref, (x) => (x ? { ...x, accuse: true, prochainAccuseLe: null } : x));
    return true;
  }
  await ecrireEntreeMerci(ref, (x) => (x ? { ...x, essaisAccuse: x.essaisAccuse + 1, prochainAccuseLe: now + ATTENTES_ACCUSE_MS[Math.min(x.essaisAccuse, ATTENTES_ACCUSE_MS.length - 1)] } : x));
  return false;
}

/** Au redémarrage, tout merci « en vol » non porté par CE processus devient « à vérifier » : jamais de second envoi. */
async function reprendreMercisEnVol(now: number): Promise<void> {
  const vol = processus().merciEnVol;
  const touches = await sousVerrou(async () => {
    const j = await lireJournalMerci();
    const refs = Object.keys(j).filter((r) => j[r].etat === "en_vol" && !vol.has(r));
    if (refs.length === 0) return 0;
    await ecrireParametre(PARAM_MERCI_JOURNAL, { ...j, ...Object.fromEntries(refs.map((r) => [r, { ...j[r], etat: "a_verifier" as const, issue: "a_verifier", accuse: false, prochainAccuseLe: null }])) });
    const conv = await lireParametre<Conversations>(PARAM_CONVERSATIONS, {});
    const cles = refs.map((r) => j[r].cle).filter((c): c is string => !!c && conv[c]?.merciEtat === "en_vol");
    if (cles.length > 0) await ecrireParametre(PARAM_CONVERSATIONS, { ...conv, ...Object.fromEntries(cles.map((c) => [c, { ...conv[c], merciEtat: "a_verifier" as const }])) });
    return refs.length;
  });
  if (touches > 0) await alerter("merci_a_verifier", "Un merci a une issue inconnue : il ne sera pas renvoyé.", now);
}

/**
 * Merci après la validation de la page « Recevoir le guide ». Le Studio réserve la liste des confirmations au site, envoie UN merci
 * dans la conversation quand c'est permis, puis accuse l'issue. Jamais deux merci pour une même `ref` ni pour une même conversation ;
 * l'opposition est relue juste avant le réseau ; hors fenêtre de 24 h, rien n'est envoyé. Les accusés en retard partent même
 * interrupteur du merci éteint (ce n'est pas un message à une personne).
 */
export async function traiterMercis(d: DepsConversation): Promise<RapportMerci> {
  const env = d.env ?? process.env;
  const rapport: RapportMerci = { actif: parcoursMerciActif(env), lues: 0, envoyes: 0, accuses: 0 };
  const p = processus();
  if (!parcoursConversationActif(env) || p.mercisEnCours) return rapport;
  p.mercisEnCours = true;
  try {
    const now = d.maintenantMs ?? Date.now();
    await reprendreMercisEnVol(now);
    // 2. Accusés en retard (échéance passée), même interrupteur éteint.
    const dus = Object.entries(await lireJournalMerci()).filter(([, e]) => !e.accuse && e.etat !== "en_vol" && (e.prochainAccuseLe === null || e.prochainAccuseLe <= now)).map(([r]) => r);
    for (const r of dus) if (await accuserMerci(env, r, now)) rapport.accuses++;
    // 3. Interrupteur du merci éteint : fin du passage.
    if (!rapport.actif) return rapport;
    const k = lireClesEmpreinte(env);
    if (!k.ok) return rapport;
    const multi = await motsMultiplesActifs(); // lu une fois par passage
    const igSuivre = multi ? await instagramSuivreActif() : false; // plafond Instagram par personne : seulement réglage allumé
    // 4. Lecture-réservation.
    const lecture = await appelerSite(env, CHEMIN_CONFIRMATIONS, { schemaVersion: 1, limite: LOT_CONFIRMATIONS });
    const liste = lecture && lecture.statut === 200 && typeof lecture.corps === "object" && lecture.corps !== null ? (lecture.corps as { confirmations?: unknown }).confirmations : undefined;
    if (!Array.isArray(liste)) {
      await alerter("merci_site", "Le site ne répond pas pour les merci après la page : rien n'est envoyé, nouvel essai au prochain passage.", now);
      return rapport;
    }
    for (const el of liste.slice(0, LOT_CONFIRMATIONS)) {
      rapport.lues++;
      const r = typeof el === "object" && el !== null ? (el as { ref?: unknown }).ref : undefined;
      if (typeof r !== "string" || !RE_REF_CONFIRMATION.test(r)) {
        await journaliser("parcours_conversation", "Merci : confirmation_illisible (ignorée, sans accusé).");
        continue;
      }
      let issue: "envoye" | "fait" | "garde";
      try {
        issue = await traiterConfirmation(r, d, env, k, now, multi, igSuivre);
      } catch {
        // Vérification impossible (registre illisible…) : ce merci n'est PAS envoyé (fermé), les autres continuent ; le site le re-proposera.
        await journaliser("parcours_conversation", "Merci : verification_impossible (non envoyé, sans accusé).");
        continue;
      }
      if (issue === "garde") return rapport; // la garde a bloqué : ni envoi ni accusé, le site re-proposera
      if (issue === "envoye") rapport.envoyes++;
    }
  } finally {
    p.mercisEnCours = false;
  }
  return rapport;
}

/** Gardes qui valent pour tout le Studio : elles arrêtent la boucle des mercis. Les autres (compte, mot, réseau) sont propres à une conversation. */
const GARDES_GLOBALES = new Set(["tout_arrete", "disjoncteur_ferme", "validation_perimee", "lecture_impossible", "cles_absentes"]);
/** Une confirmation, dans l'ordre. `garde` : un blocage a mis fin au passage (rien n'est écrit pour cette ref). */
async function traiterConfirmation(ref: string, d: DepsConversation, env: Env, k: ClesOk, now: number, multi = false, igSuivre = false): Promise<"envoye" | "fait" | "garde"> {
  // b. Déjà au registre : aucun envoi, accusé seulement s'il manque. JAMAIS DEUX FOIS LA MÊME REF.
  if ((await lireJournalMerci())[ref]) {
    await accuserMerci(env, ref, now);
    return "fait";
  }
  // Merci reporté (site illisible) : on n'y touche pas avant l'échéance ; les autres merci continuent.
  const report = processus().mercisReportes[ref];
  if (report !== undefined) {
    if (now < report) return "fait";
    delete processus().mercisReportes[ref];
  }
  // c. Retrouver la conversation par l'empreinte du jeton envoyé dans M1 v3.
  const conv = await sousVerrou(async () => {
    const tout = await lireParametre<Conversations>(PARAM_CONVERSATIONS, {});
    const cle = Object.keys(tout).find((c) => tout[c].empreintesLien?.includes(ref));
    return cle ? { cle, etat: tout[cle] } : null;
  });
  const terminer = async (etat: EtatMerci, issue: string, cle: string | null) => {
    await ecrireEntreeMerci(ref, (x) => x ?? { cle, etat, issue, accuse: false, le: new Date(now).toISOString(), essaisAccuse: 0, prochainAccuseLe: null });
    await accuserMerci(env, ref, now);
  };
  if (!conv) return (await terminer("non_envoye", "conversation_inconnue", null), "fait");
  const { cle } = conv;
  // d. Opposition relue (état, registre, clé et alias).
  if (!(await verifierPartout(env, cle, await chargeDuDernierMessage(conv.etat), now))) {
    await mettreEnFileCle(cle, conv.etat, k.courante, now);
    return (await terminer("non_envoye", "oppose", cle), "fait");
  }
  // d bis. Réglage éteint (retour arrière) : un parcours de dossier `racine|…` ne reçoit AUCUN merci (silence strict) ; l'accusé dû au site suit la règle des merci non envoyés.
  if (!multi && racineDe(cle) !== cle) return (await terminer("non_envoye", "dossier_eteint", cle), "fait");
  // e. Garde (« Tout arrêter », disjoncteur, mot actif, validation du guide…) : si elle bloque, ni envoi ni accusé.
  const bloque = await garde(d, env, conv.etat.idCompte, conv.etat.reseau, conv.etat, now);
  if (bloque) {
    await alerter(`garde:${bloque}`, MESSAGES_GARDE[bloque] ?? "Une garde de sécurité bloque les envois.", now);
    // Site illisible : le merci est REPORTÉ (report propre à cette ref, rien d'écrit, pas d'accusé), sans arrêter la file des autres merci.
    if (bloque === "cibles_illisibles") {
      processus().mercisReportes[ref] = now + ATTENTE_CATALOGUE_MS;
      return "fait";
    }
    // Garde GLOBALE : fin du passage, ni envoi ni accusé (le site re-proposera). Garde propre à CETTE conversation :
    // on la clôt sans envoi (accusé), sinon la même ref resterait en tête et bloquerait tous les autres mercis.
    if (GARDES_GLOBALES.has(bloque)) return "garde";
    return (await terminer("non_envoye", `garde_${bloque}`, cle), "fait");
  }
  // f. Texte validé, fenêtre, identifiant de conversation retrouvé via le dernier message de la personne.
  const texte = await texteMerciPret(d, conv.etat.titreCible ?? d.titreGuide);
  const idConversation = await idConversationDuDernierMessage(conv.etat);
  const issue = issueMerci({ refAuRegistre: false, conversation: conv.etat, oppose: false, texteValide: texte !== null, idConversationRetrouve: idConversation !== null, maintenantMs: now });
  if (issue === "texte_non_valide") await alerter("merci_non_valide", "Le texte du merci n'est pas validé dans Mots : le merci n'est pas parti.", now);
  // g. Tout sauf « à envoyer » : entrée « non_envoyé », accusé.
  if (issue !== "a_envoyer" || texte === null || idConversation === null) {
    const motif = issue === "a_envoyer" ? "hors_fenetre" : issue;
    await terminer("non_envoye", motif, cle);
    if (motif === "hors_fenetre") await marquerFenetreFermee(cle, now); // marque la conversation + alerte cloche (jamais de push)
    if (issue === "deja_remercie") return "fait";
    return "fait";
  }
  // g bis. Instagram (réglage allumé) : plafond de 3 messages par personne et par 24 h, merci compris. Atteint : rien ne part ; encore servable à la reprise : ni envoi ni
  // accusé (le site re-proposera) ; sinon « non envoyé » avec accusé (jamais un merci hors plafond).
  const ig = igSuivre && conv.etat.reseau === "instagram";
  if (ig) {
    const lim = await plafondIg(cle, now);
    if (lim.atteint) {
      await alerter("ig_plafond_personne", MESSAGE_IG_PLAFOND_PERSONNE, now);
      if (encoreServable(lim, conv.etat.derniereActiviteLe)) return "fait";
      return (await terminer("non_envoye", "plafond_personne", cle), "fait");
    }
  }
  // h. Plafond d'envois : ni envoi ni accusé si atteint (on reviendra).
  const reserve = await reserverEnvoi(conv.etat.idCompte, now);
  if (reserve !== "ok") {
    await alerter(reserve === "plafond" ? "plafond_heure" : "compteur_illisible", reserve === "plafond" ? "Le plafond d'envois par heure est atteint pour un compte : les messages en attente repartent à l'heure suivante, rien n'est perdu." : "Le compteur d'envois est illisible : aucun message ne part, nouvel essai dans une minute.", now);
    return "fait";
  }
  // i. SOUS VERROU : revérifier le registre et l'état, puis écrire « en vol » dans le registre ET dans la conversation.
  const pris = await sousVerrou(async () => {
    const j = await lireJournalMerci();
    const tout = await lireParametre<Conversations>(PARAM_CONVERSATIONS, {});
    if (j[ref] || tout[cle]?.merciEtat) return false;
    await ecrireParametre(PARAM_MERCI_JOURNAL, { ...j, [ref]: { cle, etat: "en_vol" as const, issue: "en_vol", accuse: false, le: new Date(now).toISOString(), essaisAccuse: 0, prochainAccuseLe: null } });
    await ecrireParametre(PARAM_CONVERSATIONS, { ...tout, [cle]: { ...tout[cle], merciEtat: "en_vol" as const, ...(ig ? { merciEssaiLe: new Date(now).toISOString() } : {}) } });
    return true;
  });
  if (!pris) {
    await rendrePlaceEnvoi(conv.etat.idCompte, now);
    await terminer("non_envoye", "deja_remercie", cle);
    return "fait";
  }
  p_enVol(ref, true);
  try {
    // j. RELIRE L'OPPOSITION une dernière fois, juste avant le réseau.
    const nonOpposeeMerci = await verifierPartout(env, cle, await chargeDuDernierMessage(conv.etat), now);
    if (!nonOpposeeMerci) {
      await rendrePlaceEnvoi(conv.etat.idCompte, now);
      await mettreEnFileCle(cle, conv.etat, k.courante, now);
      await finirMerci(ref, cle, "non_envoye", "oppose", null);
      await accuserMerci(env, ref, now);
      return "fait";
    }
    // k. Envoi : clé d'idempotence par CONVERSATION (un rejeu chez Zernio ne double pas).
    const res = await appeler(() => d.port.envoyerMessage({ idCompte: conv.etat.idCompte, idConversation, texte, cle: `merci:${conv.etat.refLienConv ?? cle}`, nonOpposee: nonOpposeeMerci }));
    await reagir(transition(conv.etat, { t: "m1", res, maintenantMs: now }), now);
    // l. Issue : envoyé | à vérifier (jamais renvoyé) | tout le reste = non envoyé avec le code (D4 : aucun nouvel essai).
    if (res.statut === "envoye") await finirMerci(ref, cle, "envoye", "envoye", new Date(now).toISOString());
    else if (res.statut === "a_verifier") {
      await finirMerci(ref, cle, "a_verifier", "a_verifier", null);
      await alerter("merci_a_verifier", "Un merci a une issue inconnue : il ne sera pas renvoyé.", now);
    } else await finirMerci(ref, cle, "non_envoye", String(res.code ?? res.statut), null);
  } finally {
    p_enVol(ref, false);
  }
  // m. Accusé immédiat ; un échec est rattrapé au passage suivant. Jamais de second envoi pour rattraper un accusé.
  await accuserMerci(env, ref, now);
  return (await lireJournalMerci())[ref]?.etat === "envoye" ? "envoye" : "fait";
}
const p_enVol = (ref: string, vol: boolean): void => void (vol ? processus().merciEnVol.add(ref) : processus().merciEnVol.delete(ref));

/** Écrit l'issue dans le registre ET dans la conversation (même section). */
async function finirMerci(ref: string, cle: string, etat: EtatMerci, issue: string, merciLe: string | null): Promise<void> {
  await sousVerrou(async () => {
    const j = await lireJournalMerci();
    if (j[ref]) await ecrireParametre(PARAM_MERCI_JOURNAL, { ...j, [ref]: { ...j[ref], etat, issue } });
    const tout = await lireParametre<Conversations>(PARAM_CONVERSATIONS, {});
    if (tout[cle]) await ecrireParametre(PARAM_CONVERSATIONS, { ...tout, [cle]: { ...tout[cle], merciEtat: etat, ...(merciLe ? { merciLe } : {}) } });
  });
}

export const MOTIF_MERCI_FENETRE_FERMEE = "merci non envoyé : fenêtre fermée";
/** Dernier message de la personne trop ancien (≥ 23 h) : rien n'est envoyé ; on le note sur la conversation et on lève l'alerte cloche existante. */
async function marquerFenetreFermee(cle: string, now: number): Promise<void> {
  await sousVerrou(async () => {
    const tout = await lireParametre<Conversations>(PARAM_CONVERSATIONS, {});
    if (tout[cle]) await ecrireParametre(PARAM_CONVERSATIONS, { ...tout, [cle]: { ...tout[cle], merciMotif: MOTIF_MERCI_FENETRE_FERMEE } });
  });
  await alerter("merci_fenetre_fermee", `${MOTIF_MERCI_FENETRE_FERMEE.charAt(0).toUpperCase()}${MOTIF_MERCI_FENETRE_FERMEE.slice(1)}. Le dernier message de la personne date de plus de 23 h.`, now);
}

/** Identifiant brut de conversation Zernio, relu EN MÉMOIRE dans l'événement du dernier message de la personne (jamais gardé dans l'état). */
/** Charge de l'événement du dernier message de la personne (identifiants bruts pour la vérification « stop partout »), sinon null. */
async function chargeDuDernierMessage(e: Conversation): Promise<Record<string, unknown> | null> {
  if (!e.idMessageDernier) return null;
  const ev = (await depots().evenementsFournisseurs.lister((x) => x.type === TYPE_MESSAGE && x.charge.idMessage === e.idMessageDernier))[0];
  return ev ? ev.charge : null;
}
async function idConversationDuDernierMessage(e: Conversation): Promise<string | null> {
  const c = await chargeDuDernierMessage(e);
  return typeof c?.idConversation === "string" && c.idConversation ? c.idConversation : null;
}

/** Interrupteurs de /mots (« plusieurs mots », « Instagram ») : ce fichier est le seul de production qui cite les deux modules de réglage. */
const ACCES_REGLAGES = {
  lire: async (): Promise<EtatReglagesParcours> => ({ motsMultiples: await motsMultiplesActifs(), instagramSuivre: await instagramSuivreActif() }),
  // Import différé : l'écriture n'est évaluée qu'au moment de basculer un interrupteur.
  ecrireMotsMultiples: async (allume: boolean): Promise<void> => (await import("./parcours-mots-multiples")).ecrireMotsMultiples(allume),
  ecrireInstagramSuivre: async (allume: boolean): Promise<void> => (await import("./parcours-instagram")).ecrireInstagramSuivre(allume),
};
export const lireReglagesParcours = (): Promise<EtatReglagesParcours> => ACCES_REGLAGES.lire();
export const reglerParcours = (reglage: ReglageParcours, allume: boolean): Promise<ResultatReglage> => appliquerReglageParcours(ACCES_REGLAGES, reglage, allume);
