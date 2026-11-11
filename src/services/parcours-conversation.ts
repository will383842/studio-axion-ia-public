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
import { conduiteApresReponse, corpsDemandeGuide, DISJONCTEUR_PAUSE_MS, DISJONCTEUR_SEUIL, runValide, type RunLu } from "@/domaine/guide-reseau/crochet-zernio";
import { construireOrigineV3, corpsDemandeGuideV3, compteAutoriseOrigineV3, origineV3Active, prefixesComptesConfigures } from "@/domaine/guide-reseau/origine-v3";
import { cleIdempotenceOpaque, empreintePersonne, lireClesEmpreinte, type CleEmpreinte, type EtatCles } from "@/domaine/guide-reseau/empreinte-personne";
import { debutHeure, decider, LOT_MAX_PAR_PASSAGE_CONVERSATION, msJusquaHeureSuivante, plafondHeureCompte } from "@/domaine/guide-reseau/plafonds-conversation";
import { DELAI_PERIME_MS, DELAI_REDUCTION_MS, reductible, activiteRetenue, dansFenetreEnvoi, doitExpirer, issueMerci, type EtatMerci, transition, VERSION_M1_LIEN, type CodeRepliLien, type Conversation, type Sortie } from "@/domaine/guide-reseau/machine-conversation";
import { classerOpposition, type ClasseOpposition } from "@/domaine/guide-reseau/opposition";
import { empreinteGuideParcours } from "@/domaine/guide-reseau/empreinte-guide";
import { construireLienGuide, creerJetonLien, lireSecretLien, refConversationLien } from "@/domaine/guide-reseau/lien-guide";
import { rendreTexteMp, TEXTES_MP } from "@/domaine/guide-reseau/textes-mp";
import { formeLienPageGuide, texteDuDictionnaire } from "@/fournisseurs/publication/zernio-inbox-corps";
import type { MessageLu, PortInboxZernio, ResultatEcritureInbox } from "@/fournisseurs/zernio-inbox";
import { signerAppel } from "@/fournisseurs/site/signature";
import { empreinteAdresseRefusee, lireGardes, PARAM_VALIDATION_MERCI, ouvrirDisjoncteurMotsExterne, PARAM_REGISTRE_MOTS, PARAM_VALIDATION_ADRESSE_REFUSEE, PARAM_VALIDATION_GUIDE_PARCOURS, PARAM_VALIDATION_M1_LIEN } from "./mots-service";
import { empreintesOpposees, enregistrerOpposition, enregistrerOppositionPersonne, personneOpposee } from "./oppositions-mots";
import { mettreEnFileOpposition } from "./oppositions-transmission";
import { creerNotification } from "./notifications";
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
  alertes: Record<string, number>;
  pannes: number;
  ouvertJusqua: number;
}
const CLE_PROCESSUS = Symbol.for("studio-axion-ia.parcours-conversation");
function processus(): EtatProcessus {
  const g = globalThis as typeof globalThis & { [CLE_PROCESSUS]?: EtatProcessus };
  return (g[CLE_PROCESSUS] ??= { enCours: false, enVol: new Set(), merciEnVol: new Set(), mercisEnCours: false, alertes: {}, pannes: 0, ouvertJusqua: 0 });
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
async function motGuideActif(compte: string): Promise<boolean> {
  const reg = await lireParametre<Registre>(PARAM_REGISTRE_MOTS, {});
  return reg[`${MOT}|${compte}`]?.etat === "actif";
}
/** `null` = tout est permis. Sinon le code de la garde qui bloque (rien ne part). Une panne de lecture bloque aussi (échec fermé). */
async function garde(d: DepsConversation, env: Env, idCompte: string, reseau: string): Promise<string | null> {
  try {
    if (!(await envoiZernioAutorise())) return "tout_arrete";
    if ((await lireGardes()).disjoncteur.ouvert) return "disjoncteur_ferme";
    if (!(await motGuideActif(idCompte))) return "mot_inactif";
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
  validation_perimee: "Les textes du mot GUIDE ont changé depuis leur validation (ou ne sont pas validés) : aucun message ne part. Revalidez-les dans Mots.",
};

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
const patcher = (cle: string, patch: Partial<Conversation>) => ecrireEtat(cle, (e) => (e ? { ...e, ...patch } : undefined));

type ClesOk = Extract<EtatCles, { ok: true }>;
/** Formes d'un identifiant brut sous TOUTES les clés connues, la courante en premier. Jamais la forme héritée (les conversations n'en ont jamais eu). */
const formesConversation = (cles: ClesOk, idBrut: string): string[] => [cles.courante, ...cles.anciennes].map((c) => empreintePersonne(c, ESPACE_CONVERSATION, idBrut));

/**
 * R5 : vérification JUSTE AVANT chaque envoi (réponse publique, M1, M2, appel au site, accusé). L'état est relu et le registre
 * interrogé avec la clé et tous les alias : une opposition arrivée entre-temps arrête l'envoi. Registre illisible : l'erreur est
 * levée (le passage reporte l'événement d'une minute, `registre_illisible`) ; jamais « non opposée » par défaut.
 */
async function opposeeAvantEnvoi(cle: string, env: Env, opts: { m2?: boolean } = {}): Promise<boolean> {
  const e = await lireEtat(cle);
  if (e?.etat === "oppose") return true;
  // Un doute posé entre la lecture et l'envoi bloque M2 (pas la demande de guide : une adresse explicite reste servie).
  if (opts.m2 && e?.douteOpposition === true) return true;
  return empreintesOpposees([cle, ...(e?.alias ?? [])], { env });
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
    // Jamais de réattribution silencieuse : une empreinte déjà rattachée à une autre personne (alias ou clé de conversation) est refusée.
    const etrangere = (x: string): boolean => (x in alias && alias[x] !== cle) || (x !== cle && x in conv);
    const nouveaux = empreintes.filter((x) => x !== cle && !(x in alias && alias[x] === cle) && !etrangere(x));
    const nbRefuses = empreintes.filter((x) => x !== cle && etrangere(x)).length;
    if (nouveaux.length === 0) return nbRefuses;
    await ecrireParametre(PARAM_CONVERSATIONS, { ...conv, [cle]: { ...e, alias: [...new Set([...e.alias, ...nouveaux])] } });
    await ecrireParametre(PARAM_CONVERSATIONS_ALIAS, { ...alias, ...Object.fromEntries(nouveaux.map((x) => [x, cle])) });
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
  await depots().evenementsFournisseurs.modifier(ev.id, { traite: false, charge: { ...ev.charge, ...extra, etat: "a_reessayer", dernierCode: code, prochainEssaiLe: now + apresMs } });
  await journaliser("parcours_conversation", `Événement Zernio ${ev.idEvenement} : a_reessayer (${code}).`);
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
    await reporter(ev, now, ATTENTE_GARDE_MS, `garde_${bloque}`);
    return "bloque";
  }
  if (await personneOpposee(idAuteur, ESPACE_CONVERSATION, { env })) {
    await clore(ev, "silence", "opposee");
    return "traite";
  }
  // Une personne déjà connue sous un alias ne démarre pas un second parcours.
  const connue = await retrouver(cles, idAuteur!);
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
  return etapesCommentaire(ev, d, env, cleEtat, now, cles);
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
async function texteLienValide(): Promise<boolean> {
  try {
    const b = TEXTES_MP[VERSION_M1_LIEN];
    const attendue = createHash("sha256").update(`${b.version}\n${b.texte}`).digest("hex");
    return (await lireParametre<{ empreinte?: unknown } | null>(PARAM_VALIDATION_M1_LIEN, null))?.empreinte === attendue;
  } catch {
    return false; // échec fermé vers M1 v2, jamais vers « pas de M1 »
  }
}
/**
 * Choisit le texte de M1. Le jeton et le lien ne vivent que dans cette fonction (variables locales) : ni état, ni journal, ni alerte.
 * Le premier contrôle qui échoue donne le code de repli et M1 v2 part, exactement comme avant.
 */
async function preparerM1(e: Conversation, d: DepsConversation, env: Env, cles: ClesOk, now: number): Promise<{ texte: string | null; version: string; refLienConv?: string; empreinteLien?: string; codeRepli?: CodeRepliLien }> {
  // Le journal et l'alerte du repli ne sont PAS émis ici : l'appelant les émet une fois l'envoi réservé (ni opposition, ni plafond).
  const repli = async (code: CodeRepliLien) => ({ texte: rendreTexteMp("mp-m1-v2", { mot: MOT, titre: d.titreGuide }), version: TEXTES_MP["mp-m1-v2"].version, codeRepli: code });
  if (!parcoursLienGuideActif(env)) return repli("lien_eteint");
  const secret = lireSecretLien(env);
  if (secret === null) return repli("secret_lien_absent");
  if (!(await texteLienValide())) return repli("texte_lien_non_valide");
  const compte = nomCourtCompte(env, e.idCompte);
  if (compte === null) return repli("compte_lien_inconnu");
  const conv = e.refLienConv || refConversationLien(cles.courante.secret.toString("utf8"), e.cleIdempotenceGuide);
  let jeton: string;
  try {
    jeton = creerJetonLien({ conv, mot: MOT, reseau: e.reseau, guide: e.guide, compte, ...(e.idPostPlateforme && RE_OPAQUE_LIEN.test(e.idPostPlateforme) ? { post_ref: e.idPostPlateforme } : {}), version_m1: VERSION_M1_LIEN }, secret, now);
  } catch {
    return repli("jeton_invalide"); // jamais e.message
  }
  const lien = construireLienGuide(jeton);
  if (lien === null) return repli("lien_trop_long");
  const texte = rendreTexteMp(VERSION_M1_LIEN, { mot: MOT, titre: d.titreGuide, lien });
  // Borne de M1 v3 : 1 000 unités de texte (texte.length), pas les 2 000 du dictionnaire ; au-delà, M1 v2.
  if (texte === null || texte.length > LONGUEUR_MAX_M1_LIEN || !texteDuDictionnaire(texte, false) || !formeLienPageGuide(lien)) return repli("forme_refusee");
  // Empreinte du jeton réellement envoyé : c'est la `ref` que le site renverra à la validation de la page (jamais le jeton lui-même).
  return { texte, version: VERSION_M1_LIEN, ...(e.refLienConv ? {} : { refLienConv: conv }), empreinteLien: createHash("sha256").update(jeton, "utf8").digest("hex") };
}

async function etapesCommentaire(ev: EvenementFournisseur, d: DepsConversation, env: Env, cle: string, now: number, cles: ClesOk): Promise<"traite" | "bloque"> {
  let e = await lireEtat(cle);
  if (!e) return "traite";
  const { idCompte } = e;
  const idPost = e.idPostPlateforme;
  if (!idPost) {
    await patcher(cle, { etat: "m1_refuse", refuseLe: new Date(now).toISOString(), dernierCode: "post_inconnu" });
    await clore(ev, "m1_refuse", "post_inconnu");
    return "traite";
  }
  if (e.etat === "nouveau") {
    const texte = rendreTexteMp("mp-pub-igfb-v1", {});
    if (texte === null) {
      await patcher(cle, { etat: "pub_ok", dernierCode: "texte_incomplet" });
    } else {
      if (await opposeeAvantEnvoi(cle, env)) {
        await clore(ev, "silence", "opposee");
        return "traite";
      }
      if (!(await reserverOuReporter(ev, idCompte, now))) return "bloque";
      const res = await appeler(() => d.port.repondreCommentaire({ idCompte, idPost, idCommentaire: e!.idCommentaire, texte, cle: e!.idCommentaire }));
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
  const bloque = await garde(d, env, idCompte, e.reseau);
  if (bloque) {
    await alerter(`garde:${bloque}`, MESSAGES_GARDE[bloque] ?? "Une garde de sécurité bloque les envois.", now);
    await reporter(ev, now, ATTENTE_GARDE_MS, `garde_${bloque}`);
    return "bloque";
  }
  const m1 = await preparerM1(e, d, env, cles, now);
  const texteM1 = m1.texte;
  if (texteM1 === null) {
    await patcher(cle, { etat: "m1_refuse", refuseLe: new Date(now).toISOString(), dernierCode: "texte_incomplet" });
    await clore(ev, "m1_refuse", "texte_incomplet");
    return "traite";
  }
  if (await opposeeAvantEnvoi(cle, env)) {
    await clore(ev, "silence", "opposee");
    return "traite";
  }
  if (!(await reserverOuReporter(ev, idCompte, now))) return "bloque"; // réservation avant tout changement d'état
  if (m1.codeRepli && m1.codeRepli !== "lien_eteint") {
    await journaliser("parcours_conversation", `Lien du 1er message non utilisé : ${m1.codeRepli}.`);
    await alerter(`lien:${m1.codeRepli}`, `Le premier message part sans lien (${RAISONS_REPLI_LIEN[m1.codeRepli]}).`, now);
  }
  // ÉCRIRE D'ABORD m1_en_vol (sous verrou), PUIS un seul envoi hors verrou : un plantage ne produit jamais un 2e envoi.
  await patcher(cle, { etat: "m1_en_vol", prochainEssaiLe: null, versionTexteM1: m1.version, ...(m1.refLienConv ? { refLienConv: m1.refLienConv } : {}), ...(m1.empreinteLien ? { empreintesLien: [...(e.empreintesLien ?? []), m1.empreinteLien].slice(-5) } : {}) });
  processus().enVol.add(cle);
  let res: ResultatEcritureInbox;
  try {
    res = await appeler(() => d.port.repondreEnPrive({ idCompte, idPost, idCommentaire: e!.idCommentaire, texte: texteM1 }));
  } finally {
    processus().enVol.delete(cle);
  }
  const s = transition(e, { t: "m1", res, maintenantMs: now });
  await reagir(s, now);
  await patcher(cle, s.patch ?? {});
  // B3 (a) : si Zernio rend l'identifiant de conversation ou de destinataire, l'alias est posé tout de suite (empreintes, jamais brut).
  const idsRendus = [res.idConversation, res.idDestinataire].filter((x): x is string => typeof x === "string" && x.length > 0).map((x) => empreintePersonne(cles.courante, ESPACE_CONVERSATION, x));
  if (idsRendus.length > 0) await noterAlias(cle, idsRendus);
  if (s.action === "reessayer") {
    await reporter(ev, now, s.apresMs ?? 60_000, s.code ?? "a_reessayer");
    return "traite";
  }
  if (s.patch?.etat === "m1_a_verifier") await alerter("m1_a_verifier", "Un message privé a une issue inconnue : il ne sera pas renvoyé. À vérifier dans l'Inbox Zernio.", now);
  await clore(ev, String(s.patch?.etat ?? "termine"), s.code ?? null);
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
async function lireTexte(ev: EvenementFournisseur, d: DepsConversation, idCompte: string, idConversation: string, idMessage: string, now: number, plafonner: boolean): Promise<{ texte: string; veille: boolean } | null> {
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
    else await clore(ev, "ignore", "introuvable");
    return null;
  }
  if (lu.texte === null) {
    const n = Number(c.essaisTexte ?? 0);
    const s = transition(null, { t: "texte_absent", essais: n });
    if (s.action === "texte_reessai") await reporter(ev, now, s.apresMs ?? 30_000, "texte_absent", { essaisTexte: n + 1 });
    else await clore(ev, "ignore", "texte_absent");
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

async function traiterMessage(ev: EvenementFournisseur, d: DepsConversation, env: Env, cles: ClesOk, now: number): Promise<"traite" | "bloque"> {
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
  const trouve = await retrouver(cles, idExpediteur!, idConversation);
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
  const { cle } = trouve;
  await noterActivite(cle, ev, now); // avant tout envoi, même pour une personne opposée (sans effet d'envoi)
  const etat = trouve.etat;
  const s0 = transition(etat, { t: "message", idExpediteur, idCompte, idMessage, sortant });
  if (s0.action === "silence") {
    // Déjà « oppose » (un réessai après un échec de mise en file) : la mise en file, idempotente, est refaite avant de clore.
    if (etat.etat === "oppose") await mettreEnFileOpposition(cle, etat, cles.courante, now);
    await clore(ev, "silence", s0.raison ?? null);
    return "traite";
  }
  if (await personneOpposee(idExpediteur, ESPACE_CONVERSATION, { env })) {
    // Personne déjà opposée (registre) : même garantie, puis l'état passe à « oppose » si besoin.
    await mettreEnFileOpposition(cle, etat, cles.courante, now);
    if (etat.etat !== "oppose") await patcher(cle, { etat: "oppose", prochainEssaiLe: null });
    await clore(ev, "silence", "opposee");
    return "traite";
  }
  if (s0.action === "reprendre_recu") {
    // Envoi sortant : soumis aux gardes.
    const bloque = await garde(d, env, etat.idCompte, etat.reseau);
    if (bloque) {
      await alerter(`garde:${bloque}`, MESSAGES_GARDE[bloque] ?? "Une garde de sécurité bloque les envois.", now);
      await reporter(ev, now, ATTENTE_GARDE_MS, `garde_${bloque}`);
      return "bloque";
    }
    if (!idConversation) {
      await clore(ev, "ignore", "conversation_inconnue");
      return "traite";
    }
    return envoyerRecu(ev, d, env, cle, etat, idConversation, idMessage, now);
  }
  // LECTURE AVANT LES GARDES, dans tous les états : un « stop » est toujours lu et enregistré (lire n'envoie rien).
  if (!idConversation) {
    await clore(ev, "ignore", "conversation_inconnue");
    return "traite";
  }
  const lu = await lireTexte(ev, d, etat.idCompte, idConversation, idMessage, now, s0.action !== "lire_opposition");
  if (!lu) return "traite";
  // Classé UNE fois : opposition claire, doute, ou rien.
  const classe = classerOpposition(lu.texte);
  if (s0.action === "lire_opposition") {
    // État où le message est ignoré (terminé, expiré, refusé…) : on y repère SEULEMENT une opposition ; un doute alerte, l'état reste inchangé.
    if (classe === "opposition") await opposerEnPrive(ev, env, cle, idExpediteur!, idConversation, emps, cles.courante, now);
    else if (classe === "doute") {
      await signalerDoute(ev, now);
      await clore(ev, "silence", "doute_opposition");
    } else await clore(ev, "silence", s0.raison ?? "etat");
    return "traite";
  }
  if (classe === "opposition") {
    await opposerEnPrive(ev, env, cle, idExpediteur!, idConversation, emps, cles.courante, now);
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
  const bloque = await garde(d, env, etat.idCompte, etat.reseau);
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
  const s = transition(etat, { t: "texte", estOpposition: classeMachine === "opposition", doute: classeMachine === "doute", adresse });
  if (s.action === "opposer") {
    await opposerEnPrive(ev, env, cle, idExpediteur!, idConversation, emps, cles.courante, now);
    return "traite";
  }
  await noterAlias(cle, emps);
  if (s.action === "silence") {
    await clore(ev, "silence", "silence");
    return "traite";
  }
  if (s.action === "m2") {
    const texte = rendreTexteMp("mp-m2-v1", {});
    if (texte === null) {
      await clore(ev, "ignore", "texte_incomplet");
      return "traite";
    }
    if (await opposeeAvantEnvoi(cle, env, { m2: true })) {
      await clore(ev, "silence", "opposee");
      return "traite";
    }
    if (await horsFenetre(cle, now)) {
      // Fenêtre de 24 h de Meta : M2 ne part pas, m2Envoye reste faux (un message ultérieur rouvre la fenêtre).
      await patcher(cle, { dernierCode: "hors_fenetre" });
      await clore(ev, "hors_fenetre", "hors_fenetre");
      return "traite";
    }
    if (!(await reserverOuReporter(ev, etat.idCompte, now))) return "bloque";
    const res = await appeler(() => d.port.envoyerMessage({ idCompte: etat.idCompte, idConversation, texte, cle: idMessage }));
    const sm = transition(etat, { t: "m1", res, maintenantMs: now });
    await reagir(sm, now);
    // M2 compté dès qu'il est parti ou d'issue inconnue (jamais deux fois) ; un refus net ne compte pas.
    if (res.statut === "envoye" || res.statut === "a_verifier") await patcher(cle, { m2Envoye: true, m2Le: new Date(now).toISOString(), etat: etat.etat === "attente_email" ? "m2_envoye" : etat.etat });
    await clore(ev, res.statut, res.code ?? null);
    return "traite";
  }
  return demanderGuide(ev, d, env, cle, etat, idConversation, idMessage, adresse!, c, now);
}

async function demanderGuide(ev: EvenementFournisseur, d: DepsConversation, env: Env, cle: string, etat: Conversation, idConversation: string, idMessage: string, adresse: string, c: Record<string, unknown>, now: number): Promise<"traite" | "bloque"> {
  const site = transportDuSite(env);
  const p = processus();
  if (!site || now < p.ouvertJusqua) {
    // Site non relié ou disjoncteur du site ouvert : l'événement est reporté (pas de relecture de Zernio à chaque passage) ; alerte 1/heure.
    await reporter(ev, now, site ? Math.max(60_000, p.ouvertJusqua - now) : ATTENTE_SITE_ABSENT_MS, site ? "site_disjoncteur" : "site_non_relie");
    if (!site) await alerter("site_non_relie", "Le site des guides n'est pas relié (adresse ou secret absent) : les demandes de guide attendent. Vérifier la configuration du site.", now);
    return "bloque";
  }
  if (await opposeeAvantEnvoi(cle, env)) {
    await clore(ev, "silence", "opposee");
    return "traite";
  }
  // occurredAt FIGÉ au premier essai (stocké dans l'état), puis réutilisé tel quel : mêmes octets à chaque essai.
  // idMessageAdresse (identifiant opaque, jamais l'adresse) est écrit avec lui : il permet de relire l'adresse pour un « stop ».
  const occurredAt = etat.occurredAt ?? (typeof c.occurredAt === "string" ? c.occurredAt : new Date(now).toISOString());
  const run: RunLu = { email: adresse, mot: MOT, reseau: etat.reseau, guide: etat.guide, versionTexteM1: etat.versionTexteM1, occurredAt };
  const cleEnvoi = RE_CLE_IDEMPOTENCE.test(etat.cleIdempotenceGuide) ? etat.cleIdempotenceGuide : "";
  if (!runValide(run) || !cleEnvoi) {
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
  if (s.action === "site_refuse" && s.code === "422" && (await prevenirAdresseRefusee(ev, d, env, cle, etat, idConversation, idMessage, now)) === "bloque") {
    // Le refus est connu : on le note pour que le réessai ne rappelle PAS le site (une seule demande au site par refus).
    await patcher(cle, { adresseRefuseeEnAttente: true });
    return "bloque";
  }
  await patcher(cle, { ...(s.patch ?? {}), ...(etat.adresseRefuseeEnAttente ? { adresseRefuseeEnAttente: false } : {}), ...(s.action === "guide_ok" ? { idMessageGuide: idMessage, idMessageAdresse: idMessage } : {}) });
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
  return envoyerRecu(ev, d, env, cle, maj ?? etat, idConversation, idMessage, now);
}

/** Z2 : message unique « vérifiez votre adresse ». « bloque » = plafond atteint (l'événement est reporté, rien n'est consommé). */
async function prevenirAdresseRefusee(ev: EvenementFournisseur, d: DepsConversation, env: Env, cle: string, etat: Conversation, idConversation: string, idMessage: string, now: number): Promise<"fait" | "bloque"> {
  if ((await lireEtat(cle))?.adresseRefuseeEnvoyee === true) return "fait";
  if (await opposeeAvantEnvoi(cle, env)) return "fait";
  if (await horsFenetre(cle, now)) {
    // Fenêtre de 24 h de Meta : le message ne partira plus jamais (l'état passe ensuite à site_refuse).
    await patcher(cle, { adresseRefuseeEnvoyee: true, dernierCode: "hors_fenetre" });
    return "fait";
  }
  // Garde de validation (échec fermé) : le texte ne part que si /mots en a validé l'empreinte exacte.
  const brouillon = TEXTES_MP["mp-adresse-refusee-v2"];
  const attendue = empreinteAdresseRefusee();
  let validee = false;
  try {
    validee = (await lireParametre<{ empreinte?: unknown } | null>(PARAM_VALIDATION_ADRESSE_REFUSEE, null))?.empreinte === attendue;
  } catch {
    validee = false;
  }
  if (!validee) {
    await alerter("adresse_refusee_non_validee", "Le message « adresse refusée » n'est pas validé dans Mots : il n'est pas parti.", now);
    return "fait";
  }
  if (!(await reserverOuReporter(ev, etat.idCompte, now))) return "bloque";
  // Marqué AVANT l'envoi : même si l'issue est inconnue ou si l'écriture de l'état échoue plus loin, le message ne repart pas.
  await patcher(cle, { adresseRefuseeEnvoyee: true });
  const res = await appeler(() => d.port.envoyerMessage({ idCompte: etat.idCompte, idConversation, texte: brouillon.texte, cle: idMessage }));
  await reagir(transition(etat, { t: "m1", res, maintenantMs: now }), now);
  return "fait";
}

async function envoyerRecu(ev: EvenementFournisseur, d: DepsConversation, env: Env, cle: string, etat: Conversation, idConversation: string, idMessage: string, now: number): Promise<"traite" | "bloque"> {
  const texte = rendreTexteMp("mp-recu-v2", { titre: d.titreGuide });
  let code: string | null = "texte_incomplet";
  if (texte !== null) {
    if (await opposeeAvantEnvoi(cle, env)) {
      await clore(ev, "silence", "opposee");
      return "traite";
    }
    if (await horsFenetre(cle, now)) {
      // Le guide part par e-mail (demande déjà faite au site) : seul le reçu dans la conversation est abandonné.
      await patcher(cle, { etat: "termine", dernierCode: "hors_fenetre" });
      await clore(ev, "termine", "hors_fenetre");
      return "traite";
    }
    if (!(await reserverOuReporter(ev, etat.idCompte, now))) return "bloque";
    const res = await appeler(() => d.port.envoyerMessage({ idCompte: etat.idCompte, idConversation, texte, cle: idMessage }));
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
    if (cles.length === 0) return 0;
    await ecrireParametre(PARAM_CONVERSATIONS, { ...conv, ...Object.fromEntries(cles.map((k) => [k, { ...conv[k], etat: "m1_a_verifier", dernierCode: "redemarrage" }])) });
    return cles.length;
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
      for (const k of [cle, ...(c.alias ?? [])]) clesOpposees.add(k);
      for (const id of [c.idMessageDernier, c.idMessageAdresse, c.idMessageGuide]) if (id) proteges.add(id);
    }
  }
  const estOpposee = async (ch: Record<string, unknown>): Promise<boolean> => {
    const ids = [ch.idAuteur, ch.idExpediteur, ch.idConversation].filter((x): x is string => typeof x === "string" && x.length > 0);
    for (const id of ids) {
      if (formesConversation(cles, id).some((f) => clesOpposees.has(f))) return true;
      if (await personneOpposee(id, ESPACE_CONVERSATION, { env })) return true;
    }
    return false;
  };
  const iso = new Date(now).toISOString();
  const evenements = await depots().evenementsFournisseurs.lister((e) => e.fournisseur === FOURNISSEUR && (e.type === TYPE_COMMENTAIRE || e.type === TYPE_MESSAGE) && reductible(e, { idsMessagesProteges: proteges }, now));
  evenements.sort((a, b) => String(a.recuLe).localeCompare(String(b.recuLe)));
  let n = 0;
  let traites = 0;
  for (const ev of evenements) {
    if (traites >= LOT_REDUCTION) break;
    try {
      if (await estOpposee(ev.charge)) continue; // la preuve de l'opposition reste intacte
    } catch {
      break; // registre illisible : on ne réduit plus rien dans ce passage
    }
    traites++;
    await depots().evenementsFournisseurs.modifier(ev.id, { charge: { ...ev.charge, idAuteur: null, idExpediteur: null, idConversation: null, idPlateforme: null, idsReduitsLe: iso } });
    n++;
  }
  // Conversation close depuis plus de 30 jours (sauf `oppose`) : l'identifiant brut du commentaire n'a plus d'usage (la reprise n'existe qu'en nouveau / pub_ok).
  const aReduire = await sousVerrou(async () => {
    const tout = await lireParametre<Conversations>(PARAM_CONVERSATIONS, {});
    const cles = Object.keys(tout).filter((k) => {
      const c = tout[k];
      if (!FINIS_REDUCTIBLES.includes(c.etat) || c.idCommentaire === "reduit") return false;
      // Date de clôture inconnue : on retient la PLUS RÉCENTE des dates de l'état (conservateur). Aucune date lisible : jamais réduit.
      const dates = [c.creeLe, c.m1Le, c.m2Le, c.refuseLe, c.derniereActiviteLe, c.occurredAt].map((x) => (typeof x === "string" ? Date.parse(x) : NaN)).filter((d) => Number.isFinite(d));
      if (c.alias?.some((a) => clesOpposees.has(a)) || clesOpposees.has(k)) return false;
      return dates.length > 0 && now - Math.max(...dates) >= DELAI_REDUCTION_MS;
    });
    if (cles.length > 0) await ecrireParametre(PARAM_CONVERSATIONS, { ...tout, ...Object.fromEntries(cles.map((k) => [k, { ...tout[k], idCommentaire: "reduit" }])) });
    return cles.length;
  });
  n += aReduire;
  if (n > 0) await journaliser("parcours_conversation", `${n} identifiants réduits.`);
  return n;
}
const FINIS_REDUCTIBLES: readonly string[] = ["termine", "site_refuse", "expire", "m1_refuse", "m1_consommee"];

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
    await reprendreEnVol(now);
    await expirerConversations({ env, maintenantMs: now });
    const dus = await depots().evenementsFournisseurs.lister((e) => e.fournisseur === FOURNISSEUR && (e.type === TYPE_COMMENTAIRE || e.type === TYPE_MESSAGE) && !e.traite && (typeof e.charge.prochainEssaiLe !== "number" || e.charge.prochainEssaiLe <= now));
    dus.sort((a, b) => String(a.recuLe).localeCompare(String(b.recuLe)));
    for (const ev of dus.slice(0, LOT_MAX_PAR_PASSAGE_CONVERSATION)) { // les autres restent dus pour le passage suivant
      let issue: "traite" | "bloque";
      try {
        issue = ev.type === TYPE_COMMENTAIRE ? await traiterCommentaire(ev, d, env, k, now) : await traiterMessage(ev, d, env, k, now);
      } catch {
        // Registre illisible ou panne de base : nouvel essai plus tard, JAMAIS « non opposée » ni envoi.
        await reporter(ev, now, ATTENTE_REGISTRE_MS, "registre_illisible").catch(() => undefined);
        rapport.enAttente++;
        continue;
      }
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
async function texteMerciPret(d: DepsConversation): Promise<string | null> {
  try {
    const b = TEXTES_MP["mp-merci-v1"];
    const attendue = createHash("sha256").update(`${b.version}\n${b.texte}`).digest("hex");
    if ((await lireParametre<{ empreinte?: unknown } | null>(PARAM_VALIDATION_MERCI, null))?.empreinte !== attendue) return null;
    return rendreTexteMp("mp-merci-v1", { titre: d.titreGuide });
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
      const issue = await traiterConfirmation(r, d, env, k, now);
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
async function traiterConfirmation(ref: string, d: DepsConversation, env: Env, k: ClesOk, now: number): Promise<"envoye" | "fait" | "garde"> {
  // b. Déjà au registre : aucun envoi, accusé seulement s'il manque. JAMAIS DEUX FOIS LA MÊME REF.
  if ((await lireJournalMerci())[ref]) {
    await accuserMerci(env, ref, now);
    return "fait";
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
  if (await opposeeAvantEnvoi(cle, env)) {
    await mettreEnFileOpposition(cle, conv.etat, k.courante, now);
    return (await terminer("non_envoye", "oppose", cle), "fait");
  }
  // e. Garde (« Tout arrêter », disjoncteur, mot actif, validation du guide…) : si elle bloque, ni envoi ni accusé.
  const bloque = await garde(d, env, conv.etat.idCompte, conv.etat.reseau);
  if (bloque) {
    await alerter(`garde:${bloque}`, MESSAGES_GARDE[bloque] ?? "Une garde de sécurité bloque les envois.", now);
    // Garde GLOBALE : fin du passage, ni envoi ni accusé (le site re-proposera). Garde propre à CETTE conversation :
    // on la clôt sans envoi (accusé), sinon la même ref resterait en tête et bloquerait tous les autres mercis.
    if (GARDES_GLOBALES.has(bloque)) return "garde";
    return (await terminer("non_envoye", `garde_${bloque}`, cle), "fait");
  }
  // f. Texte validé, fenêtre, identifiant de conversation retrouvé via le dernier message de la personne.
  const texte = await texteMerciPret(d);
  const idConversation = await idConversationDuDernierMessage(conv.etat);
  const issue = issueMerci({ refAuRegistre: false, conversation: conv.etat, oppose: false, texteValide: texte !== null, idConversationRetrouve: idConversation !== null, maintenantMs: now });
  if (issue === "texte_non_valide") await alerter("merci_non_valide", "Le texte du merci n'est pas validé dans Mots : le merci n'est pas parti.", now);
  // g. Tout sauf « à envoyer » : entrée « non_envoyé », accusé.
  if (issue !== "a_envoyer" || texte === null || idConversation === null) {
    await terminer("non_envoye", issue === "a_envoyer" ? "hors_fenetre" : issue, cle);
    if (issue === "deja_remercie") return "fait";
    return "fait";
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
    await ecrireParametre(PARAM_CONVERSATIONS, { ...tout, [cle]: { ...tout[cle], merciEtat: "en_vol" as const } });
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
    if (await opposeeAvantEnvoi(cle, env)) {
      await rendrePlaceEnvoi(conv.etat.idCompte, now);
      await mettreEnFileOpposition(cle, conv.etat, k.courante, now);
      await finirMerci(ref, cle, "non_envoye", "oppose", null);
      await accuserMerci(env, ref, now);
      return "fait";
    }
    // k. Envoi : clé d'idempotence par CONVERSATION (un rejeu chez Zernio ne double pas).
    const res = await appeler(() => d.port.envoyerMessage({ idCompte: conv.etat.idCompte, idConversation, texte, cle: `merci:${conv.etat.refLienConv ?? cle}` }));
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

/** Identifiant brut de conversation Zernio, relu EN MÉMOIRE dans l'événement du dernier message de la personne (jamais gardé dans l'état). */
async function idConversationDuDernierMessage(e: Conversation): Promise<string | null> {
  if (!e.idMessageDernier) return null;
  const ev = (await depots().evenementsFournisseurs.lister((x) => x.type === TYPE_MESSAGE && x.charge.idMessage === e.idMessageDernier))[0];
  return typeof ev?.charge.idConversation === "string" && ev.charge.idConversation ? ev.charge.idConversation : null;
}
