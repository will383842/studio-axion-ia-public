/**
 * PARCOURS « MOT → E-MAIL → GUIDE » côté Studio (PV-2). INERTE par défaut : tant que `PARCOURS_MOT_ENABLED` n'est pas
 * allumé, le crochet répond de façon neutre, n'écrit rien, et le travail de fond n'appelle ni Zernio ni le site.
 *
 *  1. Le crochet (`/api/crochets/zernio`) vérifie la signature, la fenêtre anti-rejeu et le doublon, puis DÉPOSE dans
 *     l'outbox (collection `evenementsFournisseurs`, fournisseur « zernio », ajout seul) l'identifiant du run : rien d'autre.
 *  2. Le travail de fond RELIT le run chez Zernio (la charge du crochet n'est jamais crue) et l'envoie au site, signé (v1).
 *  3. Le Studio ne conserve JAMAIS l'adresse e-mail : elle transite en mémoire le temps d'un appel. Le corps de l'appel est
 *     donc reconstruit à l'identique (ordre des clés fixe, même run relu) à chaque essai ; la clé d'idempotence (tirée de
 *     l'identifiant du run) est fixe. Si les octets divergeaient, le site répondrait 409 `cle_reutilisee` : définitif.
 *  Rien n'est supprimé : un événement traité reste en place avec son état.
 */
import "server-only";
import type { EvenementFournisseur } from "@/domaine/types";
import { estMotOpposition } from "@/domaine/guide-reseau/opposition";
import { cleIdempotence, RE_CLE_IDEMPOTENCE } from "@/domaine/guide-reseau/cle-idempotence";
import { construireOrigineV3, corpsDemandeGuideV3, origineV3Active, prefixesComptesConfigures } from "@/domaine/guide-reseau/origine-v3";
import {
  ATTENTES_INTROUVABLE_MS,
  conduiteApresReponse,
  corpsDemandeGuide,
  DEBIT_MAX_PAR_HEURE,
  DISJONCTEUR_PAUSE_MS,
  DISJONCTEUR_SEUIL,
  EN_COURS_MAX,
  ESSAIS_MAX,
  LOT_MAX_PAR_PASSAGE,
  dansFenetreRejeu,
  lireEnveloppe,
  lireEvenementCommentaire,
  lireEvenementMessage,
  lireEvenementRun,
  TYPE_EVENEMENT_COMMENTAIRE,
  TYPE_EVENEMENT_MESSAGE,
  runValide,
  TAILLE_MAX_CROCHET,
  verifierSignatureZernio,
  type Conduite,
  type RunLu,
} from "@/domaine/guide-reseau/crochet-zernio";
import { creerTransportHttp } from "@/fournisseurs/site/http";
import { signerAppel } from "@/fournisseurs/site/signature";
import type { TransportSite } from "@/fournisseurs/site/types";
import { nouvelId } from "@/lib/ids";
import { ESPACE_CONTACT_ZERNIO, personneOpposee } from "./oppositions-mots";
import { cleIdempotenceOpaque, lireClesEmpreinte } from "@/domaine/guide-reseau/empreinte-personne";
import { depots, horodatage, journaliser, maintenant, sousVerrou } from "./_commun";

/**
 * ⛔ `PARCOURS_MOT_ENABLED` reste ÉTEINT (valeur par défaut : absent) tant que l'ESSAI RÉEL du webhook Zernio n'a pas eu lieu
 * (docs/zernio/parcours-viral/05-ESSAI-REEL-WEBHOOK.md) : le format du crochet suit la doc publique, mais la relecture d'un run
 * n'a pas de point d'accès documenté (aucun lecteur réel branché).
 */
export const VARIABLE_INTERRUPTEUR_PARCOURS = "PARCOURS_MOT_ENABLED";
/** Secret du webhook ENTRANT de Zernio : lu dans l'ENVIRONNEMENT seulement (jamais en base, jamais dans le dépôt). */
export const VARIABLE_SECRET_CROCHET_ZERNIO = "ZERNIO_WEBHOOK_SECRET";
/** Secret de l'appel SORTANT vers la route des guides du site : variable propre (= `GUIDES_RESEAU_HMAC_SECRET` côté site). */
export const VARIABLE_SECRET_SITE_GUIDES = "SITE_GUIDES_RESEAU_SECRET";
/** Longueur minimale du secret des appels vers le site (la route du site refuse tout repli sur le secret des vidéos). */
export const SECRET_SITE_LONGUEUR_MIN = 32;
export const CHEMIN_DEMANDES_GUIDE = "/api/interne/demandes-guide-reseau";
const FOURNISSEUR = "zernio";
/** Seul type d'événement traité par le travail de fond (les autres attendent leur propre aiguillage). */
const TYPE_RUN_TERMINE = "workflow.run.completed";
const ESSAIS_NONCE = 3;
/** Attente avant de relire le registre des oppositions après une panne de lecture. */
const ATTENTE_REGISTRE_ILLISIBLE_MS = 60_000;

/** Interrupteur du parcours : éteint par défaut (absent ou autre chose que 1/true/oui). */
export function parcoursMotActif(env: Record<string, string | undefined> = process.env): boolean {
  return /^(1|true|oui)$/i.test(env[VARIABLE_INTERRUPTEUR_PARCOURS]?.trim() ?? "");
}

/** Interrupteur des événements commentaire / message (module MOTS) : éteint par défaut. Même règle que `motsActif` (copie : pas d'import circulaire). */
export function evenementsMotsActifs(env: Record<string, string | undefined> = process.env): boolean {
  const v = env.MOTS_ENABLED;
  return v === "1" || v === "true";
}

/** Relit un run chez Zernio. Aucune implémentation réelle n'est branchée tant que le point d'accès n'est pas confirmé. */
export interface RepereRun {
  /** `contact.id` et `trigger.text` du webhook `workflow.run.completed` (aucune adresse e-mail). */
  idContact: string | null;
  motDeclencheur: string | null;
}
export type LecteurRuns = (idRun: string, repere: RepereRun) => Promise<RunLu | null>;
let lecteurInjecte: LecteurRuns | null = null;
let transportInjecte: TransportSite | null = null;
export function injecterLecteurRuns(l: LecteurRuns | null): void {
  lecteurInjecte = l;
}
/** Transport signé vers le site (partagé avec le parcours de conversation). `null` = non relié. */
export { transportDuSite };
export function injecterTransportSite(t: TransportSite | null): void {
  transportInjecte = t;
}

/** Réponse NEUTRE : identique pour « éteint », « pas de secret » et « déjà reçu » (rien n'est révélé). */
const NEUTRE = { statut: 200, corps: { recu: true } } as const;

export interface EntreeCrochetZernio {
  /** Octets BRUTS du corps (un `string` reste accepté pour les tests). La signature se calcule sur ces octets. */
  corps: Buffer | string;
  signature: string | null;
  /** `X-Zernio-Event-Id` (ou alias hérité `X-Late-Event-Id`) : NON signé, donc seulement un contrôle : s'il est présent il doit être égal à l'`id` du corps (signé), sinon 401. */
  idEvenement?: string | null;
}

export async function recevoirCrochetZernio(entree: EntreeCrochetZernio, o: { env?: Record<string, string | undefined>; maintenantMs?: number } = {}): Promise<{ statut: number; corps: Record<string, unknown> }> {
  const env = o.env ?? process.env;
  const secret = env[VARIABLE_SECRET_CROCHET_ZERNIO]?.trim();
  if ((!parcoursMotActif(env) && !evenementsMotsActifs(env)) || !secret) return { ...NEUTRE, corps: { ...NEUTRE.corps } };
  if ((typeof entree.corps === "string" ? Buffer.byteLength(entree.corps, "utf8") : entree.corps.byteLength) > TAILLE_MAX_CROCHET) return { statut: 413, corps: { erreur: "trop_volumineux" } };
  // 1. Signature sur les octets bruts, AVANT tout JSON.parse.
  if (verifierSignatureZernio({ secret, corps: entree.corps, signature: entree.signature }) !== "ok") return { statut: 401, corps: { erreur: "signature_refusee" } };
  // 2. Enveloppe `{ id, event, timestamp }`, puis fenêtre anti-rejeu sur le `timestamp` du corps.
  const enveloppe = lireEnveloppe(entree.corps);
  if (!enveloppe) return { statut: 422, corps: { erreur: "charge_inconnue" } };
  // L'en-tête d'id n'est pas signé : il ne décide jamais de la déduplication. S'il est présent, il doit être ÉGAL à l'id du corps (signé).
  const entete = entree.idEvenement?.trim();
  if (entete && entete !== enveloppe.id) return { statut: 401, corps: { erreur: "signature_refusee" } };
  if (!dansFenetreRejeu(enveloppe.timestampSec, o.maintenantMs ?? Date.now())) return { statut: 401, corps: { erreur: "signature_refusee" } };
  // Échantillon de test (`test: true`) : accusé 200, sans effet ni dépôt.
  if (enveloppe.racine.test === true) return { ...NEUTRE, corps: { ...NEUTRE.corps } };
  // 3. Type : `workflow.run.completed` (interrupteur du parcours), `comment.received` / `message.received` (interrupteur MOTS) ; le reste : 200 sans effet.
  const idEvenement = enveloppe.id;
  let entite: { fournisseur: string; idEvenement: string; type: string; charge: Record<string, unknown> } | null = null;
  let cleSecondaire: ((e: EvenementFournisseur) => boolean) | null = null;
  if (enveloppe.event === "workflow.run.completed" && parcoursMotActif(env)) {
    const evt = lireEvenementRun(enveloppe);
    if (!evt) return { statut: 422, corps: { erreur: "charge_inconnue" } };
    // Seul l'identifiant (opaque) du run est gardé ; `motDeclencheur` n'est un mot que s'il est mot seul ou opposition (jamais de texte libre).
    // Clés d'idempotence opaques : calculées ICI, UNE fois, avec le secret courant, puis STOCKÉES (jamais recalculées : la rotation
    // du secret les changerait). Sans secret valide : rien n'est stocké et l'envoi retombe sur la clé d'origine (stable, sans secret).
    const k = lireClesEmpreinte(env);
    const cles = k.ok ? { cleIdempotenceGuide: cleIdempotenceOpaque(k.courante, "guide", evt.idRun), cleIdempotenceOpposition: cleIdempotenceOpaque(k.courante, "opposition", evt.idRun) } : {};
    entite = { fournisseur: FOURNISSEUR, idEvenement, type: evt.type, charge: { idRun: evt.idRun, idContact: evt.idContact, motDeclencheur: evt.motDeclencheur, ...cles, etat: "a_faire", essais: 0, prochainEssaiLe: null, dernierCode: null } };
  } else if (enveloppe.event === TYPE_EVENEMENT_COMMENTAIRE && evenementsMotsActifs(env)) {
    const c = lireEvenementCommentaire(enveloppe);
    // Rien à déposer : pas de mot seul, une réponse (sauf un mot d'opposition, liste fermée, jamais le texte brut), ou notre propre réponse publique. Aucun traitement métier ici.
    if (!c || c.proprio || c.motSeul === null || (c.estReponse && !estMotOpposition(c.motSeul)) || c.idAuteur === null || c.idAuteur === c.idCompte) return { ...NEUTRE, corps: { ...NEUTRE.corps } };
    entite = { fournisseur: FOURNISSEUR, idEvenement, type: "zernio.commentaire", charge: { ...c, etat: "a_faire" } };
    cleSecondaire = (e) => e.type === "zernio.commentaire" && e.charge.idCompte === c.idCompte && e.charge.idCommentaire === c.idCommentaire;
  } else if (enveloppe.event === TYPE_EVENEMENT_MESSAGE && evenementsMotsActifs(env)) {
    const m = lireEvenementMessage(enveloppe);
    // Message SANS bouton : déposé aussi (identifiants seulement, jamais le texte) ; l'écho de notre compte est écarté.
    if (!m || m.idExpediteur === null || m.idExpediteur === m.idCompte) return { ...NEUTRE, corps: { ...NEUTRE.corps } };
    entite = { fournisseur: FOURNISSEUR, idEvenement, type: "zernio.message", charge: { ...m, etat: "a_faire" } };
    cleSecondaire = (e) => e.type === "zernio.message" && e.charge.idCompte === m.idCompte && e.charge.idMessage === m.idMessage;
  }
  if (!entite) return { ...NEUTRE, corps: { ...NEUTRE.corps } };
  const depot = entite;
  return sousVerrou(async () => {
    const d = depots();
    // Déduplication PERPÉTUELLE sur l'id signé (jamais purgée) : c'est elle, et non la fenêtre de 72 h, qui arrête le rejeu.
    if (await d.evenementsFournisseurs.trouver((e) => e.fournisseur === FOURNISSEUR && e.idEvenement === idEvenement)) return { ...NEUTRE, corps: { ...NEUTRE.corps } };
    if (cleSecondaire && (await d.evenementsFournisseurs.trouver((e) => e.fournisseur === FOURNISSEUR && cleSecondaire(e)))) return { ...NEUTRE, corps: { ...NEUTRE.corps } };
    await d.evenementsFournisseurs.enregistrer({ id: nouvelId("evf"), recuLe: maintenant(), traite: false, ...depot, ...horodatage() } as EvenementFournisseur);
    return { ...NEUTRE, corps: { ...NEUTRE.corps } };
  });
}

function transportDuSite(env: Record<string, string | undefined>): { transport: TransportSite; secret: string } | null {
  // Aucun repli : le secret vient SEULEMENT de SITE_GUIDES_RESEAU_SECRET, d'au moins 32 caractères (même transport injecté).
  const secret = env[VARIABLE_SECRET_SITE_GUIDES]?.trim();
  if (!secret || secret.length < SECRET_SITE_LONGUEUR_MIN) return null;
  if (transportInjecte) return { transport: transportInjecte, secret };
  const url = env.SITE_VIDEOS_URL?.trim();
  if (!url || !/^https?:\/\//i.test(url)) return null;
  return { transport: creerTransportHttp({ url, fetch: (...a) => fetch(...a) }), secret };
}

let enCours = false;

/** Disjoncteur simple et plafond de débit : état en mémoire (un redémarrage repart fermé ; l'état des événements est en base). */
let pannesConsecutives = 0;
let disjoncteurOuvertJusqua = 0;
let appelsRecents: number[] = [];
export function reinitialiserGardesParcours(): void {
  pannesConsecutives = 0;
  disjoncteurOuvertJusqua = 0;
  appelsRecents = [];
}
const estPanne = (code: string): boolean => code === "injoignable" || code === "401" || code === "429" || /^5\d\d$/.test(code);

export interface RapportOutbox {
  actif: boolean;
  traites: number;
  envoyes: number;
  definitifs: number;
  aReessayer: number;
  /** Personnes déjà opposées : ni lecture, ni appel au site (événement conservé, mis de côté). */
  ecartes: number;
  /** Vrai si le disjoncteur était ouvert ou s'est ouvert pendant ce passage. */
  disjoncteurOuvert?: boolean;
  /** Vrai si le plafond de lot ou de débit a laissé des événements pour le passage suivant. */
  plafonne?: boolean;
}

/** Un passage sur l'outbox. Éteint, ou site/lecteur non reliés : aucun appel sortant. */
export async function traiterOutboxZernio(o: { env?: Record<string, string | undefined>; maintenantMs?: number } = {}): Promise<RapportOutbox> {
  const env = o.env ?? process.env;
  const rapport: RapportOutbox = { actif: parcoursMotActif(env), traites: 0, envoyes: 0, definitifs: 0, aReessayer: 0, ecartes: 0 };
  if (!rapport.actif || enCours) return rapport;
  const site = transportDuSite(env);
  const lire = lecteurInjecte;
  if (!site || !lire) return rapport;
  enCours = true;
  try {
    const now = o.maintenantMs ?? Date.now();
    if (now < disjoncteurOuvertJusqua) return { ...rapport, disjoncteurOuvert: true };
    appelsRecents = appelsRecents.filter((t) => t > now - 3_600_000);
    // Seul `workflow.run.completed` est traité ici : commentaires et messages restent « a_faire », intacts, hors lot, débit et disjoncteur.
    // Un « stop » / « arrêtez » écrit par la personne n'est JAMAIS une demande de guide : il reste pour la prise en compte de l'opposition.
    const dus = await depots().evenementsFournisseurs.lister((e) => e.fournisseur === FOURNISSEUR && e.type === TYPE_RUN_TERMINE && !e.traite && !estMotOpposition(typeof e.charge.motDeclencheur === "string" ? e.charge.motDeclencheur : null) && !estMotOpposition(typeof e.charge.motSeul === "string" ? e.charge.motSeul : null) && (typeof e.charge.prochainEssaiLe !== "number" || e.charge.prochainEssaiLe <= now));
    // Plafond de LOT : les plus anciens d'abord, le reste attend le passage suivant (rien n'est perdu).
    dus.sort((a, b) => String(a.recuLe).localeCompare(String(b.recuLe)));
    if (dus.length > LOT_MAX_PAR_PASSAGE) rapport.plafonne = true;
    for (const ev of dus.slice(0, LOT_MAX_PAR_PASSAGE)) {
      // Plafond de DÉBIT : au plus DEBIT_MAX_PAR_HEURE événements travaillés par heure glissante.
      if (appelsRecents.length >= DEBIT_MAX_PAR_HEURE) {
        rapport.plafonne = true;
        break;
      }
      appelsRecents.push(now);
      rapport.traites++;
      const { issue, code } = await tenter(ev, lire, site, now, origineV3Active(env) ? { prefixesComptes: prefixesComptesConfigures(env) } : null);
      if (issue === "ecarte") {
        rapport.ecartes++;
        continue; // ne compte ni comme succès ni comme panne
      }
      if (issue === "envoye") rapport.envoyes++;
      else if (issue === "definitif") rapport.definitifs++;
      else rapport.aReessayer++;
      if (issue === "envoye") pannesConsecutives = 0;
      else if (estPanne(code)) pannesConsecutives++;
      if (pannesConsecutives >= DISJONCTEUR_SEUIL) {
        disjoncteurOuvertJusqua = now + DISJONCTEUR_PAUSE_MS;
        pannesConsecutives = 0;
        rapport.disjoncteurOuvert = true;
        await journaliser("parcours_mot", `ALERTE : disjoncteur du parcours mot → guide ouvert ${DISJONCTEUR_PAUSE_MS / 60_000} min après ${DISJONCTEUR_SEUIL} pannes consécutives.`);
        break;
      }
    }
  } finally {
    enCours = false;
  }
  return rapport;
}

async function tenter(ev: EvenementFournisseur, lire: LecteurRuns, site: { transport: TransportSite; secret: string }, now: number, v3: { prefixesComptes: readonly string[] } | null = null): Promise<{ issue: "envoye" | "definitif" | "reessai" | "ecarte"; code: string }> {
  // Personne déjà opposée : aucune lecture du run, aucun appel au site, donc aucun guide. L'événement est conservé (rien n'est supprimé).
  let opposee: boolean;
  try {
    opposee = await personneOpposee(typeof ev.charge.idContact === "string" ? ev.charge.idContact : null, ESPACE_CONTACT_ZERNIO);
  } catch {
    // Registre illisible (panne de base) : nouvel essai plus tard, JAMAIS une mise à l'écart. Événement non traité, échelle des pannes non consommée.
    await depots().evenementsFournisseurs.modifier(ev.id, { traite: false, charge: { ...ev.charge, etat: "a_reessayer", dernierCode: "registre_illisible", prochainEssaiLe: now + ATTENTE_REGISTRE_ILLISIBLE_MS } });
    await journaliser("parcours_mot", `Événement Zernio ${ev.idEvenement} : registre des oppositions illisible, nouvel essai plus tard.`);
    return { issue: "reessai", code: "registre_illisible" };
  }
  if (opposee) {
    await depots().evenementsFournisseurs.modifier(ev.id, { traite: true, charge: { ...ev.charge, etat: "ecarte", dernierCode: "opposee", prochainEssaiLe: null } });
    await journaliser("parcours_mot", `Événement Zernio ${ev.idEvenement} : ecarte (personne opposée), aucun envoi.`);
    return { issue: "ecarte", code: "opposee" };
  }
  const idRun = String(ev.charge.idRun);
  const essaisAvant = Number(ev.charge.essais ?? 0);
  const essais = essaisAvant + 1;
  const introuvablesAvant = Number(ev.charge.introuvables ?? 0);
  const enCoursAvant = Number(ev.charge.enCours ?? 0);
  let statut = 0;
  let corpsReponse: unknown = null;
  let code: string | null = null;
  let envoyeEnV3 = false;
  let refusJournalise = false;
  try {
    const run = await lire(idRun, { idContact: typeof ev.charge.idContact === "string" ? ev.charge.idContact : null, motDeclencheur: typeof ev.charge.motDeclencheur === "string" ? ev.charge.motDeclencheur : null });
    if (!run) code = "run_introuvable"; // réessai court borné plus bas
    else if (!runValide(run)) code = "run_invalide";
    else {
      // Octets FIGÉS pour tous les essais de ce passage ; clé fixe.
      // v3 seulement si le drapeau est allumé ET l'origine valide ; sinon corps v1 inchangé (le code de refus est journalisé, jamais la valeur).
      // Reprise : un 422 du site sur un corps v3 renvoie l'événement en reprise, sans origine (corps v1), jamais en abandon.
      const o3 = v3 && run.origine && ev.charge.sansOrigineV3 !== true ? construireOrigineV3(run.origine, { reseau: run.reseau, prefixesComptes: v3.prefixesComptes }) : null;
      // Refus d'origine : journalisé une seule fois par événement (drapeau dans la charge), pas à chaque nouvel essai.
      if (o3 && !o3.ok && ev.charge.refusOrigineJournalise !== true) {
        await journaliser("parcours_mot", `Origine v3 non envoyée pour l'événement ${ev.idEvenement} : ${o3.code}.`);
        refusJournalise = true;
      }
      // Clé STOCKÉE à l'enregistrement (stable après rotation) ; événements antérieurs : clé d'origine, déterministe.
      const cleEnvoi = typeof ev.charge.cleIdempotenceGuide === "string" && RE_CLE_IDEMPOTENCE.test(ev.charge.cleIdempotenceGuide) ? ev.charge.cleIdempotenceGuide : cleIdempotence(idRun);
      const corps = o3?.ok ? corpsDemandeGuideV3(run, cleEnvoi, o3.origine) : corpsDemandeGuide(run, cleEnvoi);
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
        envoyeEnV3 = !!o3?.ok;
        const c = conduiteApresReponse(statut, corpsReponse, essais);
        if (!(c.genre === "reessayer" && c.nouveauNonce)) break;
      }
    }
  } catch {
    statut = 0; // lecture du run en échec : traitée comme une panne passagère
  }
  const charge: Record<string, unknown> = { ...ev.charge, essais };
  if (refusJournalise) charge.refusOrigineJournalise = true;
  let reprise422 = false;
  let issue: "envoye" | "definitif" | "reessai";
  let traite = true;
  let c: Conduite;
  if (code === "run_introuvable") {
    // Le webhook peut précéder la lisibilité du run chez Zernio : quelques relectures rapprochées, puis définitif.
    c = introuvablesAvant < ATTENTES_INTROUVABLE_MS.length ? { genre: "reessayer", apresMs: ATTENTES_INTROUVABLE_MS[introuvablesAvant], code } : { genre: "definitif", code };
    charge.introuvables = introuvablesAvant + 1;
    charge.essais = essaisAvant; // ne consomme pas l'échelle des pannes
  } else if (!code && envoyeEnV3 && statut === 422) {
    // Le site refuse l'origine v3 : on ne perd PAS la demande. Reprise immédiate en corps v1 (sans origine), code de refus seul conservé.
    c = { genre: "reessayer", apresMs: 0, code: "422_origine_v3" };
    charge.sansOrigineV3 = true;
    reprise422 = true;
    charge.essais = essaisAvant; // ne consomme pas l'échelle des pannes
  } else {
    c = code ? { genre: "definitif", code } : conduiteApresReponse(statut, corpsReponse, essais);
  }
  const enAttenteSite = c.genre === "reessayer" && c.code === "409_en_cours";
  if (enAttenteSite) charge.essais = essaisAvant; // un 409 `en_cours` ne compte PAS dans ESSAIS_MAX
  if (c.genre === "termine") {
    Object.assign(charge, { etat: "envoye", dernierCode: "200", prochainEssaiLe: null });
    issue = "envoye";
  } else if (c.genre === "definitif") {
    Object.assign(charge, { etat: "definitif", dernierCode: c.code, prochainEssaiLe: null });
    issue = "definitif";
  } else if (enAttenteSite && enCoursAvant + 1 > EN_COURS_MAX) {
    Object.assign(charge, { etat: "abandonne", dernierCode: c.code, enCours: enCoursAvant + 1, prochainEssaiLe: null });
    issue = "definitif";
  } else if (code !== "run_introuvable" && !reprise422 && !enAttenteSite && essais >= ESSAIS_MAX) {
    Object.assign(charge, { etat: "abandonne", dernierCode: c.code, prochainEssaiLe: null });
    issue = "definitif";
  } else {
    if (enAttenteSite) charge.enCours = enCoursAvant + 1;
    traite = false;
    Object.assign(charge, { etat: "a_reessayer", dernierCode: c.code, prochainEssaiLe: now + c.apresMs });
    issue = "reessai";
  }
  await depots().evenementsFournisseurs.modifier(ev.id, { charge, traite });
  // Journal : identifiant d'événement, état et code seulement (jamais l'adresse, le corps, la clé ni le secret).
  await journaliser("parcours_mot", `Événement Zernio ${ev.idEvenement} : ${String(charge.etat)} (${String(charge.dernierCode)}), essai ${String(charge.essais)}.`);
  // 401 du site : secret absent, tourné ou horloge décalée. Définitif pour CET événement, mais l'opérateur doit le savoir.
  if (c.genre === "definitif" && c.code === "401") {
    await journaliser("parcours_mot", `ALERTE : le site refuse la signature (401) pour l'événement ${ev.idEvenement}. Vérifier ${VARIABLE_SECRET_SITE_GUIDES} (= GUIDES_RESEAU_HMAC_SECRET côté site) et l'horloge. Aucun secret n'est journalisé.`);
  }
  return { issue, code: c.genre === "termine" ? "200" : c.code };
}
