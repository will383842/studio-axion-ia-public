/**
 * TRANSMISSION DES « STOP » AU SITE (lot 5d). La route du site exige l'adresse e-mail (corps strict) ; le Studio n'en garde AUCUNE :
 * pour chaque « stop » d'une personne dont l'adresse a déjà été transmise au site, une entrée de file (sans adresse) est créée ;
 * à chaque essai le message qui portait l'adresse est RELU chez Zernio, l'adresse reste EN MÉMOIRE le temps de l'appel.
 *
 * Règles de sûreté :
 *  - la file (`parcours.oppositions.file`) ne contient ni adresse, ni texte, ni identifiant brut : une clé d'idempotence opaque, des codes ;
 *  - un « stop » n'est JAMAIS perdu : 0/401/404/409/429/503/5xx et pannes de lecture sont réessayés sans fin (1, 5, 15, 60 min puis 6 h) ;
 *  - personne dont l'adresse n'a jamais été transmise (`occurredAt` null) : rien à transmettre, la personne est seulement écartée au Studio ;
 *  - les « stop » déjà en file continuent d'être transmis même si PARCOURS_CONVERSATION_ENABLED est éteint ensuite ; éteint ET file vide :
 *    aucun appel au port ni au site, aucune écriture ;
 *  - journal et alertes : des codes seulement, jamais d'adresse, de corps d'appel, d'empreinte ni de clé ; aucun `catch` n'en journalise.
 */
import "server-only";
import { extraireAdresse } from "@/domaine/guide-reseau/adresse-email";
import { cleIdempotenceOpaque, lireClesEmpreinte, type CleEmpreinte } from "@/domaine/guide-reseau/empreinte-personne";
import { ATTENTES_INTROUVABLE_MS, ATTENTES_PANNE_LECTURE_MS, voiesOpposition, type Conversation } from "@/domaine/guide-reseau/machine-conversation";
import type { PortInboxZernio } from "@/fournisseurs/zernio-inbox";
import { signerAppel } from "@/fournisseurs/site/signature";
import { depots, ecrireParametre, journaliser, lireParametre, sousVerrou } from "./_commun";
import { CHEMIN_OPPOSITIONS_SITE } from "./mots-service";
import { creerNotification } from "./notifications";
import { empreintesOpposees, marquerTransmiseParEmpreinte } from "./oppositions-mots";
import { transportDuSite } from "./parcours-mot";

export const PARAM_OPPOSITIONS_FILE = "parcours.oppositions.file";
/**
 * File des « stop » de personnes qui ont reçu le lien de la page (Z3b) : leur adresse est peut-être chez le site, pas au Studio.
 * Une entrée par personne, JAMAIS retirée ; ni adresse, ni identifiant brut (`refLienConv` est un HMAC opaque).
 */
export const PARAM_OPPOSITIONS_PAGE = "parcours.oppositions.page";
/** Interrupteur de la transmission par référence de conversation (éteint par défaut : les entrées restent « attente_route »). */
export const VARIABLE_OPPOSITIONS_PAR_REF = "OPPOSITIONS_PAR_REF_ENABLED";
/** Route PROPOSÉE du site (à confirmer par le site) : opposition par référence de conversation. */
export const CHEMIN_OPPOSITIONS_PAGE = "/api/interne/oppositions-page-guide";
const oppositionsParRefActives = (env: Record<string, string | undefined>): boolean => /^(1|true|oui)$/i.test(env[VARIABLE_OPPOSITIONS_PAR_REF]?.trim() ?? "");
/**
 * Mêmes valeurs que `parcours-conversation.ts` (figées par un test) : pas d'import, ce service est importé PAR lui (aucun cycle) et
 * un test de garde interdit à tout autre fichier de src d'importer le parcours.
 */
export const PARAM_CONVERSATIONS = "parcours.conversations";
export const VARIABLE_INTERRUPTEUR_CONVERSATION = "PARCOURS_CONVERSATION_ENABLED";
const parcoursConversationActif = (env: Record<string, string | undefined>): boolean => /^(1|true|oui)$/i.test(env[VARIABLE_INTERRUPTEUR_CONVERSATION]?.trim() ?? "");
export const PLAFOND_PASSAGE = 10;
export const LECTURES_MAX = 4;
/** Réessais après une réponse du site qui n'est pas un succès : 1, 5, 15, 60 min, puis 6 h SANS FIN. */
export const ATTENTES_SITE_MS = [60_000, 5 * 60_000, 15 * 60_000, 3600_000, 6 * 3600_000] as const;
export const ATTENTE_RATTRAPAGE_MS = 10 * 60_000;
export const ALERTE_ATTENTE_MS = 6 * 3600_000;
/** Réservation d'une entrée pendant son traitement (deux passages simultanés ne l'envoient jamais deux fois). */
const BAIL_MS = 5 * 60_000;
const INTERVALLE_ALERTE_MS = 3600_000;

type Env = Record<string, string | undefined>;
export type EtatOpposition = "a_transmettre" | "transmise" | "refusee" | "adresse_illisible";
/** AUCUNE adresse. `lectures` : lectures vaines (introuvable, sans adresse) ; au 4e, l'adresse est déclarée illisible. */
export interface EntreeOpposition {
  cleIdempotence: string;
  reseau: "instagram" | "facebook";
  creeLe: string;
  essais: number;
  prochainEssaiLe: number | null;
  etat: EtatOpposition;
  dernierCode: string | null;
  depuis: string;
  lectures: number;
}
type File = Record<string, EntreeOpposition>;
export type EtatOppositionPage = "attente_route" | "a_transmettre" | "transmise" | "refusee";
/** AUCUNE adresse, aucun identifiant brut. */
export interface EntreeOppositionPage {
  cleIdempotence: string;
  refLienConv: string;
  reseau: "instagram" | "facebook";
  creeLe: string;
  etat: EtatOppositionPage;
  essais: number;
  prochainEssaiLe: number | null;
  dernierCode: string | null;
}
type FilePage = Record<string, EntreeOppositionPage>;

/* --- État processus (alertes, rattrapage) ----------------------------------------------------------------------- */
interface EtatProcessus {
  alertes: Record<string, number>;
  dernierRattrapage: number;
}
const CLE_PROCESSUS = Symbol.for("studio-axion-ia.oppositions-transmission");
const processus = (): EtatProcessus => {
  const g = globalThis as typeof globalThis & { [CLE_PROCESSUS]?: EtatProcessus };
  return (g[CLE_PROCESSUS] ??= { alertes: {}, dernierRattrapage: -Infinity });
};
/** Tests : simule un redémarrage du processus. */
export function reinitialiserOppositionsTransmission(): void {
  delete (globalThis as typeof globalThis & { [CLE_PROCESSUS]?: EtatProcessus })[CLE_PROCESSUS];
}

/** Alerte en français, au plus UNE par heure et par sujet. Jamais d'identifiant, d'adresse ni de corps. */
async function alerter(sujet: string, message: string, now: number): Promise<void> {
  const p = processus();
  if (now - (p.alertes[sujet] ?? -Infinity) < INTERVALLE_ALERTE_MS) return;
  p.alertes[sujet] = now;
  try {
    await journaliser("parcours_conversation", `ALERTE : ${message}`);
    await creerNotification({ type: "echec", titre: "Oppositions (STOP) à transmettre au site", message, lien: "/mots" }, { cloche: true });
  } catch {
    /* l'alerte ne doit jamais faire échouer le traitement */
  }
}

const lireFile = (): Promise<File> => lireParametre<File>(PARAM_OPPOSITIONS_FILE, {});
const iso = (ms: number): string => new Date(ms).toISOString();

/** Met à jour UNE entrée sous verrou (relue : jamais d'écrasement d'une autre entrée). */
async function fixer(cle: string, patch: Partial<EntreeOpposition>): Promise<void> {
  await sousVerrou(async () => {
    const f = await lireFile();
    if (f[cle]) await ecrireParametre(PARAM_OPPOSITIONS_FILE, { ...f, [cle]: { ...f[cle], ...patch } });
  });
}

/**
 * Met le « stop » d'une personne en file de transmission. IDEMPOTENTE (une entrée par personne ; la clé d'idempotence est calculée
 * UNE fois puis stockée) et sans effet si l'adresse n'a jamais été transmise au site (`occurredAt` null).
 */
export async function mettreEnFileOpposition(cle: string, conv: Pick<Conversation, "occurredAt" | "reseau" | "refLienConv">, cles: CleEmpreinte, maintenantMs?: number): Promise<void> {
  const voies = voiesOpposition(conv);
  if (voies.page) await mettreEnFileOppositionPage(cle, conv, cles, maintenantMs ?? Date.now());
  if (!voies.adresse) return;
  const cleIdempotence = cleIdempotenceOpaque(cles, "opposition", cle);
  const now = maintenantMs ?? Date.now();
  await sousVerrou(async () => {
    const f = await lireFile();
    if (f[cle]) return;
    const entree: EntreeOpposition = { cleIdempotence, reseau: conv.reseau, creeLe: iso(now), essais: 0, prochainEssaiLe: null, etat: "a_transmettre", dernierCode: null, depuis: iso(now), lectures: 0 };
    await ecrireParametre(PARAM_OPPOSITIONS_FILE, { ...f, [cle]: entree });
  });
}

const lireFilePage = (): Promise<FilePage> => lireParametre<FilePage>(PARAM_OPPOSITIONS_PAGE, {});

/** Voie « page » : une entrée par personne (clé de conversation), sous verrou, idempotente ; la clé d'idempotence est calculée UNE fois puis stockée. */
async function mettreEnFileOppositionPage(cle: string, conv: Pick<Conversation, "reseau" | "refLienConv">, cles: CleEmpreinte, now: number): Promise<void> {
  await sousVerrou(async () => {
    const f = await lireFilePage();
    if (f[cle]) return;
    const entree: EntreeOppositionPage = { cleIdempotence: cleIdempotenceOpaque(cles, "opposition", `page:${cle}`), refLienConv: conv.refLienConv as string, reseau: conv.reseau, creeLe: iso(now), etat: "attente_route", essais: 0, prochainEssaiLe: null, dernierCode: null };
    await ecrireParametre(PARAM_OPPOSITIONS_PAGE, { ...f, [cle]: entree });
  });
}

/**
 * Réconciliation (au plus toutes les 10 minutes) : toute conversation dont l'adresse a été transmise et dont la personne est opposée
 * (état « oppose » ou registre, clé et alias) mais absente de la file y est ajoutée. Registre illisible : l'erreur est levée.
 */
export async function rattraperOppositions(o: { env?: Env; maintenantMs?: number } = {}): Promise<number> {
  const env = o.env ?? process.env;
  const now = o.maintenantMs ?? Date.now();
  const p = processus();
  if (!parcoursConversationActif(env) || now - p.dernierRattrapage < ATTENTE_RATTRAPAGE_MS) return 0;
  const k = lireClesEmpreinte(env);
  if (!k.ok) return 0;
  const conversations = await lireParametre<Record<string, Conversation>>(PARAM_CONVERSATIONS, {});
  const f = await lireFile();
  const fp = await lireFilePage();
  let ajoutees = 0;
  for (const [cle, c] of Object.entries(conversations)) {
    const voies = voiesOpposition(c);
    if (!((voies.adresse && !f[cle]) || (voies.page && !fp[cle]))) continue;
    const auRegistre = await empreintesOpposees([cle, ...(c.alias ?? [])], { env });
    if (!auRegistre && c.etat !== "oppose") continue;
    await mettreEnFileOpposition(cle, c, k.courante, now);
    ajoutees++;
  }
  p.dernierRattrapage = now;
  return ajoutees;
}

export interface RapportTransmission {
  actif: boolean;
  traitees: number;
  transmises: number;
}

/** Un passage : au plus 10 entrées. Éteint ET file vide : rien n'est appelé ni écrit. */
export async function transmettreOppositions(o: { port: PortInboxZernio; env?: Env; maintenantMs?: number }): Promise<RapportTransmission> {
  const env = o.env ?? process.env;
  const now = o.maintenantMs ?? Date.now();
  const rapport: RapportTransmission = { actif: parcoursConversationActif(env), traitees: 0, transmises: 0 };
  if (rapport.actif) {
    try {
      await rattraperOppositions({ env, maintenantMs: now });
    } catch {
      await journaliser("parcours_conversation", "Rattrapage des oppositions impossible (registre illisible) : nouvel essai plus tard.").catch(() => undefined);
    }
  }
  await transmettrePage(o.port, env, now);
  const attentes = Object.values(await lireFile()).filter((e) => e.etat === "a_transmettre" && now - Date.parse(e.creeLe) > ALERTE_ATTENTE_MS);
  if (attentes.length > 0) await alerter("attente_6h", "Une opposition (« stop ») attend depuis plus de 6 h d'être transmise au site. Elle reste gardée et sera réessayée ; vérifier le site et l'Inbox Zernio.", now);
  // Réservation sous verrou : une entrée en cours de traitement n'est pas reprise par un passage simultané.
  const dues = await sousVerrou(async () => {
    const f = await lireFile();
    const cles = Object.keys(f)
      .filter((c) => f[c].etat === "a_transmettre" && (f[c].prochainEssaiLe === null || f[c].prochainEssaiLe <= now))
      .sort((a, b) => f[a].creeLe.localeCompare(f[b].creeLe))
      .slice(0, PLAFOND_PASSAGE);
    if (cles.length > 0) await ecrireParametre(PARAM_OPPOSITIONS_FILE, { ...f, ...Object.fromEntries(cles.map((c) => [c, { ...f[c], prochainEssaiLe: now + BAIL_MS }])) });
    return cles;
  });
  for (const cle of dues) {
    rapport.traitees++;
    try {
      if (await traiterEntree(cle, o.port, env, now)) rapport.transmises++;
    } catch {
      // Jamais de détail (il pourrait contenir un corps) : un code, et nouvel essai.
      await fixer(cle, { prochainEssaiLe: now + ATTENTES_SITE_MS[0], dernierCode: "erreur_interne" }).catch(() => undefined);
    }
  }
  return rapport;
}

const delaiSite = (essais: number): number => ATTENTES_SITE_MS[Math.min(Math.max(essais, 0), ATTENTES_SITE_MS.length - 1)];

async function traiterEntree(cle: string, port: PortInboxZernio, env: Env, now: number): Promise<boolean> {
  const e = (await lireFile())[cle];
  if (!e || e.etat !== "a_transmettre") return false;
  const retarder = (delaiMs: number, code: string, extra: Partial<EntreeOpposition> = {}): Promise<void> => fixer(cle, { essais: e.essais + 1, prochainEssaiLe: now + delaiMs, dernierCode: code, ...extra });

  const site = transportDuSite(env);
  if (!site) {
    await retarder(delaiSite(e.essais), "site_non_relie");
    await alerter("site_non_relie", "Le site n'est pas relié (adresse ou secret du site absent) : les oppositions (« stop ») attendent. Vérifier la configuration du site.", now);
    return false;
  }

  // 1. Relire le message qui portait l'adresse : EN MÉMOIRE seulement.
  const conv = (await lireParametre<Record<string, Conversation>>(PARAM_CONVERSATIONS, {}))[cle];
  // Conversations d'avant le lot : seul `idMessageGuide` est connu (le message du guide portait l'adresse).
  const idMessage = conv?.idMessageAdresse ?? conv?.idMessageGuide ?? null;
  const evenement = idMessage ? (await depots().evenementsFournisseurs.lister((x) => x.type === "zernio.message" && x.charge.idMessage === idMessage))[0] : undefined;
  const idConversation = typeof evenement?.charge.idConversation === "string" && evenement.charge.idConversation ? evenement.charge.idConversation : null;
  let adresse: string | null = null;
  let introuvable = true;
  if (conv && idMessage && idConversation) {
    const idCompte = typeof evenement?.charge.idCompte === "string" && evenement.charge.idCompte ? evenement.charge.idCompte : conv.idCompte;
    let lu;
    // `veille` ne compte pas ici : on relit l'adresse pour TRANSMETTRE un « stop » (aucune réponse n'est envoyée), et une liste incomplète est réessayée sans fin.
    try {
      lu = await port.lireMessage({
        idCompte, idConversation, idMessage,
        ...(typeof evenement?.charge.idPlateforme === "string" && evenement.charge.idPlateforme ? { idPlateforme: evenement.charge.idPlateforme } : {}),
        ...(typeof evenement?.charge.occurredAt === "string" ? { occurredAt: evenement.charge.occurredAt } : {}),
        ...(typeof evenement?.charge.idExpediteur === "string" && evenement.charge.idExpediteur ? { idExpediteur: evenement.charge.idExpediteur } : {}),
      });
    } catch {
      lu = { texte: null, postback: null, panne: true as const };
    }
    if (lu.panne === true) {
      await retarder(ATTENTES_PANNE_LECTURE_MS[Math.min(e.essais, ATTENTES_PANNE_LECTURE_MS.length - 1)], "lecture_panne");
      await alerter("lecture_panne", "La relecture d'un message privé échoue (panne Zernio ou réseau) : une opposition (« stop ») attend, elle est réessayée plus tard, rien n'est perdu.", now);
      return false;
    }
    introuvable = lu.introuvable === true;
    adresse = extraireAdresse(lu.texte);
  }
  if (adresse === null) {
    const lectures = e.lectures + 1;
    if (lectures >= LECTURES_MAX) {
      await fixer(cle, { etat: "adresse_illisible", lectures, prochainEssaiLe: null, dernierCode: "adresse_illisible", depuis: iso(now) });
      await alerter(`illisible:${cle}`, "Une opposition (« stop ») n'a pas pu être transmise : l'adresse est introuvable chez Zernio : opposition à reporter à la main dans le CRM (la personne est déjà écartée au Studio).", now);
      await journaliser("parcours_conversation", "Opposition : adresse_illisible (4 lectures).");
    } else {
      await fixer(cle, { lectures, prochainEssaiLe: now + ATTENTES_INTROUVABLE_MS[lectures - 1], dernierCode: introuvable ? "message_introuvable" : "adresse_absente" });
    }
    return false;
  }

  // 2. Corps strict (mêmes octets à chaque essai : clé, date et adresse figées), signé, hors verrou.
  const corps = JSON.stringify({ schemaVersion: 1, cleIdempotence: e.cleIdempotence, email: adresse, motif: "stop", reseau: e.reseau, occurredAt: e.creeLe });
  const entetes = signerAppel({ secret: site.secret, methode: "POST", chemin: CHEMIN_OPPOSITIONS_SITE, corps, horodatageSec: Math.floor(Date.now() / 1000) });
  let statut = 0;
  try {
    statut = (await site.transport({ methode: "POST", chemin: CHEMIN_OPPOSITIONS_SITE, corps, entetes })).statut;
  } catch {
    statut = 0;
  }
  const code = String(statut);
  if (statut >= 200 && statut < 300) {
    const conversation = conv as Conversation;
    await fixer(cle, { etat: "transmise", prochainEssaiLe: null, dernierCode: code, depuis: iso(now) });
    for (const forme of new Set([cle, ...(conversation.alias ?? [])])) await marquerTransmiseParEmpreinte(forme, { env }).catch(() => undefined);
    await journaliser("parcours_conversation", `Opposition : transmise (${code}).`);
    return true;
  }
  if (statut === 422) {
    await fixer(cle, { etat: "refusee", prochainEssaiLe: null, dernierCode: code, depuis: iso(now) });
    await alerter(`refusee:${cle}`, "Le site a refusé une opposition (« stop ») : corps invalide (code 422). L'entrée est gardée ; à reporter à la main dans le CRM.", now);
    await journaliser("parcours_conversation", `Opposition : refusee (${code}).`);
    return false;
  }
  await retarder(delaiSite(e.essais), code);
  if (statut === 401) await alerter("opp_401", "Le site refuse la signature des oppositions (« stop ») : vérifier le secret du site (SITE_GUIDES_RESEAU_SECRET). Elles sont gardées et réessayées.", now);
  else if (statut === 503) await alerter("opp_503", "Le site n'accepte pas les oppositions (« stop ») : OPPOSITIONS_RESEAU_ENABLED éteint côté site. Elles sont gardées et réessayées.", now);
  await journaliser("parcours_conversation", `Opposition : a_transmettre (${code}).`);
  return false;
}

/**
 * Voie « page » (Z3b). Interrupteur éteint : les entrées restent « attente_route » et la cloche prévient (au plus une alerte par heure, un NOMBRE seulement).
 * Allumé : elles partent au site par référence de conversation, mêmes octets à chaque essai ; 200/409 → transmise, 422 → refusee + alerte,
 * tout le reste (0, 401, 404, 429, 5xx) → réessai SANS FIN. Aucune entrée n'est jamais retirée. Transmises même si le parcours est éteint.
 */
async function transmettrePage(_port: PortInboxZernio, env: Env, now: number): Promise<void> {
  if (!oppositionsParRefActives(env)) {
    const n = Object.values(await lireFilePage()).filter((e) => e.etat === "attente_route" || e.etat === "a_transmettre").length;
    if (n > 0) await alerter("page_attente_route", `Des personnes qui avaient reçu le lien de la page ont écrit « stop » (${n} en attente). Le site ne peut pas encore le recevoir : elles sont gardées, rien n'est perdu.`, now);
    return;
  }
  const dues = await sousVerrou(async () => {
    const f = await lireFilePage();
    const cles = Object.keys(f)
      .filter((c) => (f[c].etat === "attente_route" || f[c].etat === "a_transmettre") && (f[c].prochainEssaiLe === null || f[c].prochainEssaiLe <= now))
      .sort((a, b) => f[a].creeLe.localeCompare(f[b].creeLe))
      .slice(0, PLAFOND_PASSAGE);
    if (cles.length > 0) await ecrireParametre(PARAM_OPPOSITIONS_PAGE, { ...f, ...Object.fromEntries(cles.map((c) => [c, { ...f[c], etat: "a_transmettre" as const, prochainEssaiLe: now + BAIL_MS }])) });
    return cles;
  });
  for (const cle of dues) {
    try {
      await traiterEntreePage(cle, env, now);
    } catch {
      await fixerPage(cle, { prochainEssaiLe: now + ATTENTES_SITE_MS[0], dernierCode: "erreur_interne" }).catch(() => undefined);
    }
  }
}

async function fixerPage(cle: string, patch: Partial<EntreeOppositionPage>): Promise<void> {
  await sousVerrou(async () => {
    const f = await lireFilePage();
    if (f[cle]) await ecrireParametre(PARAM_OPPOSITIONS_PAGE, { ...f, [cle]: { ...f[cle], ...patch } });
  });
}

async function traiterEntreePage(cle: string, env: Env, now: number): Promise<void> {
  const e = (await lireFilePage())[cle];
  if (!e || e.etat !== "a_transmettre") return;
  const retarder = (code: string): Promise<void> => fixerPage(cle, { essais: e.essais + 1, prochainEssaiLe: now + delaiSite(e.essais), dernierCode: code });
  const site = transportDuSite(env);
  if (!site) {
    await retarder("site_non_relie");
    await alerter("site_non_relie", "Le site n'est pas relié (adresse ou secret du site absent) : les oppositions (« stop ») attendent. Vérifier la configuration du site.", now);
    return;
  }
  const corps = JSON.stringify({ schemaVersion: 1, cleIdempotence: e.cleIdempotence, conv: e.refLienConv, reseau: e.reseau, occurredAt: e.creeLe });
  const entetes = signerAppel({ secret: site.secret, methode: "POST", chemin: CHEMIN_OPPOSITIONS_PAGE, corps, horodatageSec: Math.floor(Date.now() / 1000) });
  let statut = 0;
  try {
    statut = (await site.transport({ methode: "POST", chemin: CHEMIN_OPPOSITIONS_PAGE, corps, entetes })).statut;
  } catch {
    statut = 0;
  }
  const code = String(statut);
  if ((statut >= 200 && statut < 300) || statut === 409) {
    await fixerPage(cle, { etat: "transmise", prochainEssaiLe: null, dernierCode: code });
    await journaliser("parcours_conversation", `Opposition (page) : transmise (${code}).`);
  } else if (statut === 422) {
    await fixerPage(cle, { etat: "refusee", prochainEssaiLe: null, dernierCode: code });
    await alerter("page_refusee", "Le site a refusé une opposition (« stop ») par référence de conversation : corps invalide (code 422). L'entrée est gardée ; à traiter à la main.", now);
    await journaliser("parcours_conversation", `Opposition (page) : refusee (${code}).`);
  } else {
    await retarder(code);
    await journaliser("parcours_conversation", `Opposition (page) : a_transmettre (${code}).`);
  }
}
