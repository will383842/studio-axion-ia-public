/**
 * BRANCHEMENT DU PARCOURS DE CONVERSATION (lot 4c). Seul fichier qui relie `boucle.ts` / `instrumentation.ts` au parcours
 * (lot 3a), à la transmission des « stop » (lot 5d) et au port d'écriture de l'Inbox Zernio.
 *
 * Règles de sûreté :
 *  - `brancherParcoursZernio` : idempotente, SANS réseau, sans importer le port au chargement ; vérifie la configuration par
 *    PRÉSENCE (jamais la valeur d'un secret) et écrit un état lisible par l'écran /mots (booléens et codes). Elle n'allume AUCUN
 *    interrupteur : `PARCOURS_CONVERSATION_ENABLED` reste ce que l'opérateur a posé sur le serveur.
 *  - `passageParcoursZernio` : interrupteur éteint ET file d'oppositions sans entrée à transmettre = retour immédiat, aucun import
 *    du port, aucun client, aucune écriture. Le port (`zernio-inbox`) n'est atteint QUE d'ici, par `import()` dynamique, après
 *    ce contrôle. Un « stop » en file continue d'être transmis même interrupteur éteint ; il n'est jamais perdu.
 *  - Liste d'envoi vide ou titre du guide absent : une alerte, aucune conversation traitée (aucun envoi) ; le port est quand même
 *    construit avec une liste d'envoi VIDE (écriture impossible) pour transmettre et rattraper les « stop » déjà en file.
 *  - Alertes : au plus une par heure et par sujet ; des codes et des phrases, jamais d'identifiant, d'adresse ni de secret.
 */
import "server-only";
import { comptesParcours } from "@/domaine/guide-reseau/empreinte-guide";
import { creerNotification } from "./notifications";
import { journaliser, lireParametre } from "./_commun";

export const VARIABLE_INTERRUPTEUR = "PARCOURS_CONVERSATION_ENABLED";
export const VARIABLE_COMPTES = "PARCOURS_CONVERSATION_COMPTES";
export const VARIABLE_TITRE_GUIDE = "PARCOURS_CONVERSATION_TITRE_GUIDE";
const PARAM_FILE_OPPOSITIONS = "parcours.oppositions.file";
const PARAM_COMPTES_ZERNIO = "zernio.comptes";
const INTERVALLE_PASSAGE_MS = 15_000;
const INTERVALLE_ALERTE_MS = 3600_000;

type Env = Record<string, string | undefined>;

/** Ce que l'écran /mots peut lire : des booléens et des codes, jamais une valeur. */
export interface EtatBranchement {
  branche: boolean;
  cleZernio: boolean;
  secretSite: boolean;
  cleEmpreinte: boolean;
  comptesEnvoi: boolean;
  titreGuide: boolean;
  /** Codes de ce qui manque (vide = configuration complète). */
  codes: string[];
}
interface Interne extends EtatBranchement {
  dernierPassage: number;
  alertes: Record<string, number>;
}
const CLE = Symbol.for("studio-axion-ia.branchements-zernio");
function interne(): Interne {
  const g = globalThis as typeof globalThis & { [CLE]?: Interne };
  return (g[CLE] ??= { branche: false, cleZernio: false, secretSite: false, cleEmpreinte: false, comptesEnvoi: false, titreGuide: false, codes: [], dernierPassage: -Infinity, alertes: {} });
}
const vue = (i: Interne): EtatBranchement => ({ branche: i.branche, cleZernio: i.cleZernio, secretSite: i.secretSite, cleEmpreinte: i.cleEmpreinte, comptesEnvoi: i.comptesEnvoi, titreGuide: i.titreGuide, codes: [...i.codes] });

const present = (env: Env, nom: string): boolean => (env[nom]?.trim() ?? "") !== "";
/** Même règle que le parcours : éteint par défaut, allumé seulement par 1 / true / oui. */
const allume = (env: Env): boolean => /^(1|true|oui)$/i.test(env[VARIABLE_INTERRUPTEUR]?.trim() ?? "");
const listeComptes = (env: Env): string[] => comptesParcours(env);

/** État courant du branchement (copie), ou null si jamais branché ni passé dans ce processus. */
export function etatBranchementZernio(): EtatBranchement | null {
  const g = globalThis as typeof globalThis & { [CLE]?: Interne };
  return g[CLE] ? vue(g[CLE]) : null;
}

/** Au démarrage : vérifie la configuration (présence seulement), SANS réseau. Idempotente : un second appel ne change rien. */
export function brancherParcoursZernio(env: Env = process.env): EtatBranchement {
  const i = interne();
  if (i.branche) return vue(i);
  i.cleZernio = present(env, "ZERNIO_API_KEY");
  i.secretSite = present(env, "SITE_GUIDES_RESEAU_SECRET");
  i.cleEmpreinte = present(env, "STUDIO_EMPREINTE_SECRET");
  i.comptesEnvoi = listeComptes(env).length > 0;
  i.titreGuide = present(env, VARIABLE_TITRE_GUIDE);
  i.codes = [!i.cleZernio && "cle_zernio_absente", !i.secretSite && "secret_site_absent", !i.cleEmpreinte && "cle_empreinte_absente", !i.comptesEnvoi && "comptes_envoi_absents", !i.titreGuide && "titre_guide_absent"].filter((c): c is string => typeof c === "string");
  i.branche = true;
  return vue(i);
}

/** Alerte en français : au plus UNE par heure et par sujet. Ne fait jamais échouer le passage. */
async function alerter(sujet: string, message: string, now: number): Promise<void> {
  const i = interne();
  if (now - (i.alertes[sujet] ?? -Infinity) < INTERVALLE_ALERTE_MS) return;
  i.alertes[sujet] = now;
  try {
    await journaliser("parcours_conversation", `ALERTE : ${message}`);
    await creerNotification({ type: "echec", titre: "Parcours des messages privés", message, lien: "/mots" });
  } catch {
    /* l'alerte ne doit jamais faire échouer le passage */
  }
}

/** Une étape qui échoue ne bloque pas les suivantes (un « stop » n'attend pas une panne ailleurs) : un code seulement. */
async function etape(nom: string, f: () => Promise<unknown>): Promise<void> {
  try {
    await f();
  } catch {
    console.error(`[studio] parcours de conversation : étape « ${nom} » en échec`);
  }
}

/**
 * « Tout arrêter » : balayage qui met les lignes en pause quand l'arrêt est posé. Il passe AVANT toute conversation : un arrêt
 * posé ne doit jamais attendre (ni suivre) un traitement de conversation.
 */
async function toutArreter(env: Env): Promise<void> {
  const mots = await import("./mots-service");
  await etape("tout arrêter", () => mots.appliquerToutArreter({ env }));
}

/**
 * Ancien chemin des « stop » du crochet. NOTE : avec MOTS_ENABLED=1 et le parcours ÉTEINT (et aucune opposition en file), le
 * passage s'arrête dès le contrôle de l'interrupteur : ni cet ancien chemin ni « Tout arrêter » ne tournent ici. Rien n'est
 * perdu (les événements restent traite:false) ; à arbitrer par le responsable (voir docs/zernio/parcours-viral/).
 */
async function ancienChemin(env: Env): Promise<void> {
  const mots = await import("./mots-service");
  await etape("oppositions (ancien chemin)", () => mots.traiterOppositions({ env }));
}

async function arretEtAncienChemin(env: Env): Promise<void> {
  await toutArreter(env);
  await ancienChemin(env);
}

async function oppositionsEnAttente(): Promise<boolean> {
  const file = await lireParametre<Record<string, { etat?: string }>>(PARAM_FILE_OPPOSITIONS, {});
  return Object.values(file).some((e) => e?.etat === "a_transmettre");
}

/** Un passage de la boucle (au plus un toutes les 15 s). */
export async function passageParcoursZernio(o: { env?: Env; maintenantMs?: number } = {}): Promise<void> {
  const env = o.env ?? process.env;
  const now = o.maintenantMs ?? Date.now();
  const actif = allume(env);
  // (1) Éteint ET aucun « stop » à transmettre : rien n'est lu au-delà de la file, rien n'est importé, rien n'est écrit.
  if (!actif && !(await oppositionsEnAttente())) return;
  // (2) Au plus un passage toutes les 15 s.
  const i = interne();
  if (now - i.dernierPassage < INTERVALLE_PASSAGE_MS) return;
  i.dernierPassage = now;
  // (3) Branchement absent : une alerte par heure, rien d'autre.
  if (!i.branche) {
    await alerter("branchement_absent", "Le parcours des messages privés n'est pas branché au démarrage du Studio : rien n'est traité. Redémarrer le Studio ; si l'alerte revient, prévenir le développeur.", now);
    await arretEtAncienChemin(env);
    return;
  }
  // (4) Comptes de lecture = comptes Instagram et Facebook reliés ; comptes d'envoi = liste du serveur ∩ comptes de lecture.
  const enregistres = await lireParametre<{ comptes?: { id: string; reseau: string }[] } | null>(PARAM_COMPTES_ZERNIO, null);
  const comptesLecture = (enregistres?.comptes ?? []).filter((c) => c.reseau === "instagram" || c.reseau === "facebook").map((c) => c.id);
  const comptesPermis = listeComptes(env).filter((c, n, tous) => comptesLecture.includes(c) && tous.indexOf(c) === n);
  const titre = (env[VARIABLE_TITRE_GUIDE] ?? "").trim();
  // Un compte retiré de la liste : ses lignes GUIDE actives passent en pause automatique (hors de tout verrou, avant l'envoi).
  await etape("guides hors liste", async () => (await import("./mots-service")).pauserGuidesHorsListe(env));
  // (5) Liste d'envoi vide ou titre absent : alerte, AUCUNE conversation traitée (aucun envoi, pas de m1_refuse) ;
  //     mais les « stop » déjà en file sont quand même transmis et rattrapés : un « stop » n'est jamais perdu.
  const sansEnvoi = comptesPermis.length === 0 || !titre;
  if (comptesPermis.length === 0) {
    await alerter("comptes_envoi", "Aucun compte d'envoi utilisable pour les messages privés (liste du serveur vide, ou aucun compte Instagram ou Facebook relié ne correspond) : aucune conversation n'est traitée.", now);
  } else if (!titre) {
    await alerter("titre_guide", "Le titre du guide pour les messages privés n'est pas posé sur le serveur : aucune conversation n'est traitée.", now);
  }
  if (comptesLecture.length === 0 && (await oppositionsEnAttente())) {
    await alerter("opposition_en_attente", "Opposition en attente : aucun compte Instagram ou Facebook relié, les « stop » en file ne peuvent pas être relus. Elles sont gardées, rien n'est perdu ; relier le compte ou prévenir le développeur.", now);
  }
  // (6) Le port : importé ICI seulement, après le contrôle de l'interrupteur. Même liste de lecture pour le service et le port.
  //     Sans liste d'envoi, comptesPermis est vide : le client refuse toute écriture (liste fermée absente) ; seule la lecture reste.
  const { creerPortInboxZernio } = await import("@/fournisseurs/zernio-inbox");
  const { DOMAINES_PERMIS_PAR_DEFAUT } = await import("@/fournisseurs/publication/zernio-inbox-corps");
  const { clientZernio } = await import("./zernio");
  let port;
  try {
    port = creerPortInboxZernio({ client: clientZernio(), comptesPermis: sansEnvoi ? [] : comptesPermis, comptesLecture, domainesPermis: DOMAINES_PERMIS_PAR_DEFAUT, titresGuidesPermis: titre ? [titre] : [] });
  } catch {
    await alerter("client_zernio", "Zernio n'est pas relié (clé absente ou refusée) : les messages privés ne sont pas traités.", now);
    await arretEtAncienChemin(env);
    return;
  }
  // (7) Dans l'ordre : « Tout arrêter », conversations (seulement allumé ET envoi possible), transmission des « stop », rattrapage.
  const { traiterConversations } = await import("./parcours-conversation");
  const { transmettreOppositions, rattraperOppositions } = await import("./oppositions-transmission");
  await toutArreter(env);
  if (actif && !sansEnvoi) await etape("conversations", () => traiterConversations({ port, comptesPermis, comptesLecture, titreGuide: titre, env, maintenantMs: now }));
  await etape("transmission des oppositions", () => transmettreOppositions({ port, env, maintenantMs: now }));
  await etape("rattrapage des oppositions", () => rattraperOppositions({ env, maintenantMs: now }));
  // (8) Ancien chemin des « stop ».
  await ancienChemin(env);
}
