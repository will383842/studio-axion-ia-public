/**
 * PARCOURS DE CONVERSATION (lot 3a) : commentaire GUIDE → réponse publique → message privé M1 → adresse e-mail → demande de guide.
 * INERTE : éteint tant que `PARCOURS_CONVERSATION_ENABLED` n'est pas allumé (absent = éteint, échec fermé) ; ni `boucle.ts` ni
 * `instrumentation.ts` ne l'importent (lot 4). Éteint : aucun appel au port ni au site, aucune écriture d'état.
 *
 * Règles de sûreté :
 *  - L'état par personne (`parcours.conversations`) ne contient JAMAIS pseudo, texte, adresse ni identifiant brut : des empreintes.
 *  - L'adresse e-mail n'existe qu'en mémoire, le temps d'un appel ; à chaque nouvel essai le message est relu.
 *  - Lectures/écritures d'état sous `sousVerrou` ; appels réseau (port, site) HORS verrou ; rien n'est supprimé.
 *  - M1 : `m1_en_vol` est écrit AVANT l'envoi ; après un plantage il vaut `m1_a_verifier` : jamais de second envoi.
 *  - Journal : identifiant d'événement, état, code. Jamais adresse, texte, empreinte, corps d'appel ni clé.
 */
import "server-only";
import type { EvenementFournisseur } from "@/domaine/types";
import { extraireAdresse } from "@/domaine/guide-reseau/adresse-email";
import { RE_CLE_IDEMPOTENCE } from "@/domaine/guide-reseau/cle-idempotence";
import { conduiteApresReponse, corpsDemandeGuide, DISJONCTEUR_PAUSE_MS, DISJONCTEUR_SEUIL, runValide, type RunLu } from "@/domaine/guide-reseau/crochet-zernio";
import { cleIdempotenceOpaque, empreintePersonne, lireClesEmpreinte, type CleEmpreinte } from "@/domaine/guide-reseau/empreinte-personne";
import { doitExpirer, transition, type Conversation, type Sortie } from "@/domaine/guide-reseau/machine-conversation";
import { estMotOpposition } from "@/domaine/guide-reseau/opposition";
import { rendreTexteMp, TEXTES_MP } from "@/domaine/guide-reseau/textes-mp";
import type { PortInboxZernio, ResultatEcritureInbox } from "@/fournisseurs/zernio-inbox";
import { signerAppel } from "@/fournisseurs/site/signature";
import { lireGardes, ouvrirDisjoncteurMotsExterne, PARAM_REGISTRE_MOTS } from "./mots-service";
import { enregistrerOpposition, personneOpposee } from "./oppositions-mots";
import { creerNotification } from "./notifications";
import { CHEMIN_DEMANDES_GUIDE, transportDuSite } from "./parcours-mot";
import { depots, ecrireParametre, journaliser, lireParametre, sousVerrou } from "./_commun";
import { envoiZernioAutorise } from "./zernio";

export const VARIABLE_INTERRUPTEUR_CONVERSATION = "PARCOURS_CONVERSATION_ENABLED";
export const PARAM_CONVERSATIONS = "parcours.conversations";
export const PARAM_CONVERSATIONS_ALIAS = "parcours.conversations.alias";
export const ESPACE_CONVERSATION = "zernio-conversation" as const;
const FOURNISSEUR = "zernio";
const TYPE_COMMENTAIRE = "zernio.commentaire";
const TYPE_MESSAGE = "zernio.message";
const ESSAIS_NONCE = 3;
const ATTENTE_REGISTRE_MS = 60_000;
const INTERVALLE_ALERTE_MS = 3600_000;
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
  alertes: Record<string, number>;
  pannes: number;
  ouvertJusqua: number;
}
const CLE_PROCESSUS = Symbol.for("studio-axion-ia.parcours-conversation");
function processus(): EtatProcessus {
  const g = globalThis as typeof globalThis & { [CLE_PROCESSUS]?: EtatProcessus };
  return (g[CLE_PROCESSUS] ??= { enCours: false, enVol: new Set(), alertes: {}, pannes: 0, ouvertJusqua: 0 });
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
    await creerNotification({ type: "echec", titre: "Parcours des messages privés", message, lien: "/mots" });
  } catch {
    /* l'alerte ne doit jamais faire échouer le traitement */
  }
}

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

/** Retrouve la personne par l'empreinte de `sender.id`, sinon par un alias (empreinte de `sender.id` ou de `conversationId`). */
async function retrouver(empreintes: string[]): Promise<{ cle: string; etat: Conversation } | null> {
  return sousVerrou(async () => {
    const { conv, alias } = await lireTout();
    for (const e of empreintes) if (conv[e]) return { cle: e, etat: conv[e] };
    for (const e of empreintes) if (alias[e] && conv[alias[e]]) return { cle: alias[e], etat: conv[alias[e]] };
    return null;
  });
}
async function noterAlias(cle: string, empreintes: string[]): Promise<void> {
  await sousVerrou(async () => {
    const { conv, alias } = await lireTout();
    const e = conv[cle];
    if (!e) return;
    const nouveaux = empreintes.filter((x) => x !== cle && !(x in alias && alias[x] === cle));
    if (nouveaux.length === 0) return;
    await ecrireParametre(PARAM_CONVERSATIONS, { ...conv, [cle]: { ...e, alias: [...new Set([...e.alias, ...nouveaux])] } });
    await ecrireParametre(PARAM_CONVERSATIONS_ALIAS, { ...alias, ...Object.fromEntries(nouveaux.map((x) => [x, cle])) });
  });
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

async function traiterCommentaire(ev: EvenementFournisseur, d: DepsConversation, env: Env, cles: CleEmpreinte, now: number): Promise<"traite" | "bloque"> {
  const c = ev.charge;
  const idCompte = String(c.idCompte ?? "");
  const reseau = String(c.reseau ?? "");
  const idAuteur = texteDe(c.idAuteur);
  const age = now - Date.parse(ev.recuLe);
  const filtre = transition(null, { t: "commentaire", idCommentaire: String(c.idCommentaire ?? ""), proprio: c.proprio === true, idAuteur, idCompte, motSeul: texteDe(c.motSeul), estReponse: c.estReponse === true, ageMs: Number.isFinite(age) ? age : 0, maintenantMs: now });
  if (filtre.action === "ecarter") {
    await clore(ev, filtre.raison === "perime" ? "perime" : "ecarte", filtre.raison ?? null);
    return "traite";
  }
  const cle = empreintePersonne(cles, ESPACE_CONVERSATION, idAuteur!);
  if (filtre.action === "opposer") {
    await enregistrerOpposition(idAuteur!, ESPACE_CONVERSATION, { env });
    await ecrireEtat(cle, (e) => (e ? { ...e, etat: "oppose", prochainEssaiLe: null } : etatNeuf("oppose", c, d, cleIdempotenceOpaque(cles, "guide", ev.idEvenement), now)));
    await clore(ev, "oppose", "opposition");
    return "traite";
  }
  const bloque = await garde(d, env, idCompte, reseau);
  if (bloque) {
    await alerter(`garde:${bloque}`, MESSAGES_GARDE[bloque] ?? "Une garde de sécurité bloque les envois.", now);
    return "bloque";
  }
  if (await personneOpposee(idAuteur, ESPACE_CONVERSATION, { env })) {
    await clore(ev, "silence", "opposee");
    return "traite";
  }
  const existant = await lireEtat(cle);
  const decision = transition(existant, { t: "commentaire", idCommentaire: String(c.idCommentaire ?? ""), proprio: false, idAuteur, idCompte, motSeul: MOT, estReponse: false, ageMs: Number.isFinite(age) ? age : 0, maintenantMs: now });
  if (decision.action === "ecarter" || decision.action === "silence") {
    await clore(ev, decision.action === "silence" ? "silence" : "ecarte", decision.raison ?? null);
    return "traite";
  }
  if (decision.action === "demarrer") {
    // Clé d'idempotence calculée UNE fois ici, stockée : jamais recalculée (la rotation du secret la changerait).
    await ecrireEtat(cle, () => etatNeuf("nouveau", c, d, cleIdempotenceOpaque(cles, "guide", String(c.idCommentaire)), now));
  }
  return etapesCommentaire(ev, d, env, cle, now);
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

async function etapesCommentaire(ev: EvenementFournisseur, d: DepsConversation, env: Env, cle: string, now: number): Promise<"traite" | "bloque"> {
  let e = await lireEtat(cle);
  if (!e) return "traite";
  const { idCompte } = e;
  const idPost = e.idPostPlateforme;
  if (!idPost) {
    await patcher(cle, { etat: "m1_refuse", dernierCode: "post_inconnu" });
    await clore(ev, "m1_refuse", "post_inconnu");
    return "traite";
  }
  if (e.etat === "nouveau") {
    const texte = rendreTexteMp("mp-pub-igfb-v1", {});
    if (texte === null) {
      await patcher(cle, { etat: "pub_ok", dernierCode: "texte_incomplet" });
    } else {
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
    return "bloque";
  }
  const texteM1 = rendreTexteMp("mp-m1-v2", { mot: MOT, titre: d.titreGuide });
  if (texteM1 === null) {
    await patcher(cle, { etat: "m1_refuse", dernierCode: "texte_incomplet" });
    await clore(ev, "m1_refuse", "texte_incomplet");
    return "traite";
  }
  // ÉCRIRE D'ABORD m1_en_vol (sous verrou), PUIS un seul envoi hors verrou : un plantage ne produit jamais un 2e envoi.
  await patcher(cle, { etat: "m1_en_vol", prochainEssaiLe: null });
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

async function traiterMessage(ev: EvenementFournisseur, d: DepsConversation, env: Env, cles: CleEmpreinte, now: number): Promise<"traite" | "bloque"> {
  const c = ev.charge;
  const idCompte = String(c.idCompte ?? "");
  const idMessage = String(c.idMessage ?? "");
  const idExpediteur = texteDe(c.idExpediteur);
  const idConversation = texteDe(c.idConversation);
  const premier = transition(null, { t: "message", idExpediteur, idCompte, idMessage });
  if (premier.action === "ecarter") {
    await clore(ev, "ecarte", premier.raison ?? null);
    return "traite";
  }
  const empS = empreintePersonne(cles, ESPACE_CONVERSATION, idExpediteur!);
  const empC = idConversation ? empreintePersonne(cles, ESPACE_CONVERSATION, idConversation) : null;
  const trouve = await retrouver(empC ? [empS, empC] : [empS]);
  if (!trouve) {
    const n = Number(c.orphelins ?? 0);
    const s = transition(null, { t: "orphelin", essais: n });
    if (s.action === "orphelin_reessai") await reporter(ev, now, s.apresMs ?? 30_000, "orphelin", { orphelins: n + 1 });
    else await clore(ev, "ignore", "orphelin");
    return s.action === "orphelin_reessai" ? "traite" : "traite";
  }
  const { cle } = trouve;
  const etat = trouve.etat;
  const s0 = transition(etat, { t: "message", idExpediteur, idCompte, idMessage });
  if (s0.action === "silence") {
    await clore(ev, "silence", s0.raison ?? null);
    return "traite";
  }
  if (await personneOpposee(idExpediteur, ESPACE_CONVERSATION, { env })) {
    await clore(ev, "silence", "opposee");
    return "traite";
  }
  await noterAlias(cle, empC ? [empS, empC] : [empS]);
  const bloque = await garde(d, env, etat.idCompte, etat.reseau);
  if (bloque) {
    await alerter(`garde:${bloque}`, MESSAGES_GARDE[bloque] ?? "Une garde de sécurité bloque les envois.", now);
    return "bloque";
  }
  if (!idConversation) {
    await clore(ev, "ignore", "conversation_inconnue");
    return "traite";
  }
  if (s0.action === "reprendre_recu") return envoyerRecu(ev, d, cle, etat, idConversation, idMessage, now);
  // Lecture du message (entrants seulement). Rien n'est conservé : le texte reste en mémoire le temps de ce traitement.
  const lu = await d.port.lireMessage({ idCompte: etat.idCompte, idConversation, idMessage }).catch(() => ({ texte: null, postback: null }));
  if (lu.texte === null) {
    const n = Number(c.essaisTexte ?? 0);
    const s = transition(etat, { t: "texte_absent", essais: n });
    if (s.action === "texte_reessai") await reporter(ev, now, s.apresMs ?? 30_000, "texte_absent", { essaisTexte: n + 1 });
    else await clore(ev, "ignore", "texte_absent");
    return "traite";
  }
  const estOpposition = estMotOpposition(lu.texte);
  const adresse = estOpposition ? null : extraireAdresse(lu.texte);
  const s = transition(etat, { t: "texte", estOpposition, adresse });
  if (s.action === "opposer") {
    await enregistrerOpposition(idExpediteur!, ESPACE_CONVERSATION, { env });
    await patcher(cle, { etat: "oppose", prochainEssaiLe: null });
    await noterAlias(cle, empC ? [empS, empC] : [empS]);
    await clore(ev, "oppose", "opposition");
    return "traite";
  }
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
    const res = await appeler(() => d.port.envoyerMessage({ idCompte: etat.idCompte, idConversation, texte, cle: idMessage }));
    const sm = transition(etat, { t: "m1", res, maintenantMs: now });
    await reagir(sm, now);
    // M2 compté dès qu'il est parti ou d'issue inconnue (jamais deux fois) ; un refus net ne compte pas.
    if (res.statut === "envoye" || res.statut === "a_verifier") await patcher(cle, { m2Envoye: true, etat: etat.etat === "attente_email" ? "m2_envoye" : etat.etat });
    await clore(ev, res.statut, res.code ?? null);
    return "traite";
  }
  return demanderGuide(ev, d, env, cle, etat, idConversation, idMessage, adresse!, c, now);
}

async function demanderGuide(ev: EvenementFournisseur, d: DepsConversation, env: Env, cle: string, etat: Conversation, idConversation: string, idMessage: string, adresse: string, c: Record<string, unknown>, now: number): Promise<"traite" | "bloque"> {
  const site = transportDuSite(env);
  const p = processus();
  if (!site || now < p.ouvertJusqua) return "bloque"; // site non relié ou disjoncteur du site ouvert : l'événement reste à faire
  // occurredAt FIGÉ au premier essai (stocké dans l'état), puis réutilisé tel quel : mêmes octets à chaque essai.
  const occurredAt = etat.occurredAt ?? (typeof c.occurredAt === "string" ? c.occurredAt : new Date(now).toISOString());
  if (etat.occurredAt === null) await patcher(cle, { occurredAt });
  const run: RunLu = { email: adresse, mot: MOT, reseau: etat.reseau, guide: etat.guide, versionTexteM1: etat.versionTexteM1, occurredAt };
  const cleEnvoi = RE_CLE_IDEMPOTENCE.test(etat.cleIdempotenceGuide) ? etat.cleIdempotenceGuide : "";
  if (!runValide(run) || !cleEnvoi) {
    await patcher(cle, { etat: "site_refuse", dernierCode: "run_invalide" });
    await alerter("site_refuse", "Le site a refusé une demande de guide (données invalides). La personne ne recevra pas le guide.", now);
    await clore(ev, "site_refuse", "run_invalide");
    return "traite";
  }
  const corps = corpsDemandeGuide(run, cleEnvoi);
  let statut = 0;
  let corpsReponse: unknown = null;
  for (let n = 0; n < ESSAIS_NONCE; n++) {
    const entetes = signerAppel({ secret: site.secret, methode: "POST", chemin: CHEMIN_DEMANDES_GUIDE, corps, horodatageSec: Math.floor(Date.now() / 1000) });
    try {
      const r = await site.transport({ methode: "POST", chemin: CHEMIN_DEMANDES_GUIDE, corps, entetes });
      statut = r.statut;
      corpsReponse = r.corps;
    } catch {
      statut = 0;
      corpsReponse = null;
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
  await patcher(cle, { ...(s.patch ?? {}), ...(s.action === "guide_ok" ? { idMessageGuide: idMessage } : {}) });
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
  return envoyerRecu(ev, d, cle, maj ?? etat, idConversation, idMessage, now);
}

async function envoyerRecu(ev: EvenementFournisseur, d: DepsConversation, cle: string, etat: Conversation, idConversation: string, idMessage: string, now: number): Promise<"traite" | "bloque"> {
  const texte = rendreTexteMp("mp-recu-v2", { titre: d.titreGuide });
  let code: string | null = "texte_incomplet";
  if (texte !== null) {
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

/** Tâche d'expiration : `attente_email` → `expire` 7 jours après le premier message. Aucun message n'est envoyé. */
export async function expirerConversations(o: { env?: Env; maintenantMs?: number } = {}): Promise<number> {
  if (!parcoursConversationActif(o.env ?? process.env)) return 0;
  const now = o.maintenantMs ?? Date.now();
  return sousVerrou(async () => {
    const conv = await lireParametre<Conversations>(PARAM_CONVERSATIONS, {});
    const cles = Object.keys(conv).filter((k) => doitExpirer(conv[k], now));
    if (cles.length === 0) return 0;
    await ecrireParametre(PARAM_CONVERSATIONS, { ...conv, ...Object.fromEntries(cles.map((k) => [k, { ...conv[k], etat: "expire" }])) });
    return cles.length;
  });
}

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
    for (const ev of dus) {
      let issue: "traite" | "bloque";
      try {
        issue = ev.type === TYPE_COMMENTAIRE ? await traiterCommentaire(ev, d, env, k.courante, now) : await traiterMessage(ev, d, env, k.courante, now);
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
