/**
 * CLAUDE DANS LE GÉNÉRATEUR, AVEC LA BRIQUE CRÉDITS (lot G0, plan v5 B.3.2, B.3.4, B.3.8 ; addendum du 02/10 :
 * budget Claude de Will = 30 $ par mois).
 *
 * `executerRoleFacture` est le SEUL chemin qui dépense chez Claude. Dans l'ordre, avant tout appel :
 *  1. simulation si Claude n'est pas choisi (réglage « fournisseur.script », sinon `FOURNISSEUR_SCRIPT=claude`) ou si
 *     la clé manque : aucun appel, 0 $ ;
 *  2. plafond du SUJET (1,50 $ ; + 0,70 $ par format ou corps supplémentaire) : dépensé + RÉSERVÉ par les appels
 *     partis en parallèle + estimation RÉALISTE (médiane mesurée au banc G4, `generateur/roles/estimation.ts`) > plafond
 *     → arrêt « plafond-atteint ». Le pire cas n'y sert plus : il arrêtait un « + Je lis » avant la fin (correction du
 *     03/10) ; il reste la règle des points 3 à 5. Vérification E2E-1 n° 6 (03/10) : le contrôle ET la réservation de
 *     l'estimation se font SOUS LE VERROU des étapes (`reserverDansPlafondSujet`) : les déclinaisons et les juges lancés
 *     ensemble (`Promise.all`) ne lisent plus tous la même dépense. Seul écart restant : coût réel d'un appel au-dessus
 *     de sa médiane (quelques centimes) ;
 *  3. plafond MENSUEL Claude (100 $ par défaut, décision de Will du 03/10, réglage `claude.plafondMensuelUsd`) : consommé du mois + réservé +
 *     pire cas × 1,2 > plafond → « en-attente-credit », rien ne part ;
 *  4. pré-vol de la brique Crédits (`verifierEtReserver` : budget du studio, engagé avec la réservation, solde Claude SUIVI − réservations ≥
 *     pire cas × 1,2) → sinon « en-attente-credit », rien ne part ;
 *  5. réservation faite avec l'étape 4 (un `appelId` par appel), étape « lancée » écrite AVANT l'appel ;
 *  6. appel ; coût réel (modèle renvoyé, repli compris) dans `DepenseEnregistree` (fournisseur `anthropic`,
 *     `scriptMaitreId`), réservation « consommée ».
 * Erreurs : facturation (402, « credit balance », limite du compte) → « en-attente-credit » SANS nouvel essai ;
 * modèle introuvable → « bloquee-modele », aucune reprise ; 429 / 529 / 5xx → 3 essais, attente croissante.
 * Reprise (GARDE-FOUS BUDGET, 15/10) : plus AUCUNE reprise automatique. Quand l'empêchement a disparu (recharge,
 * limite relevée, réservation rendue), l'écriture devient « prête à reprendre » (Will est prévenu une fois) ; seul son
 * geste « Reprendre (≈ X €) » la relance (`relancerEcrituresEnAttente`, `gesteDeWill: true`). Une recharge déclarée ou
 * une limite relevée ne relancent plus rien d'elles-mêmes.
 * Avant le PREMIER appel de chaque tour, le pire cas prudent de toute la chaîne restante (dépense déjà faite comprise) est
 * réservé sur le plafond de l'écriture (`reserverPireCasChaine`, plafond d'un sujet lu des réglages) : au-dessus, rien ne
 * part. Une écriture déjà en route sans réserve garde le contrôle appel par appel (`ecritureSansReserve`).
 * Redémarrage pendant un appel (E2E-1 n° 7) : l'API Messages ne permet pas de relire une réponse déjà produite ; l'appel
 * interrompu sera donc REJOUÉ (et peut-être payé deux fois). Limite plafonnée : l'étape « lancée » sans réponse garde
 * son PIRE CAS dans la dépense du sujet (jamais plus d'un sujet entier, même en cas de redémarrages répétés), sa
 * réservation reste comptée dans le mois où elle est partie, puis est soldée (`solderAppelsInterrompus`).
 * La clé ne sort jamais : tout message est masqué (`masquerSecrets`).
 */
import "server-only";
import type { z } from "zod";
import { depenseDuFournisseur, totalReserve } from "@/domaine/credits";
import { messageComptesEpuises } from "@/domaine/credits";
import { cleDeLaSource, libelleSource, numeroAbonnement, prochaineSourceAbonnement, SOURCES_ABONNEMENT, variableDeLaSource, type EnvClaude, type SourceAbonnement, type SourceClaude } from "@/domaine/source-claude";
import type { DepenseEnregistree, GenerationScript, Id, LigneCout, ScriptMaitre } from "@/domaine/types";
import { choixFournisseur } from "@/fournisseurs";
import { ErreurClaude, type ReponseClaude } from "@/fournisseurs/claude/client";
import { creerFournisseurScriptClaude, type FournisseurScriptClaude, type ResultatRole } from "@/fournisseurs/claude/inscription";
import { masquerSecretsClaude } from "@/fournisseurs/claude/secret";
import { centimesUsd, coutUsd } from "@/fournisseurs/claude/tarifs";
import type { ChaineEcriture } from "@/generateur/pire-cas";
import { estimationRealisteRole } from "@/generateur/roles/estimation";
import { pireCasRole, type DefinitionRole, type EntreeRole, type MarqueurArret } from "@/generateur/roles/types";
import { cleMois } from "@/lib/dates";
import { nouvelId } from "@/lib/ids";
import { centimesAuSuperieur, centimesDuPlafond, formaterMontant, TAUX_USD_EUR_PAR_DEFAUT, usdVersEur } from "@/lib/montants";
import { depots, ecrireParametre, ErreurStudio, horodatage, journaliser, lireParametre, maintenant } from "./_commun";
import { etatBoucle } from "./_boucle-etat";
import { exigerSession } from "./auth";
import { choisirSourceClaude, etatsEpuisement, lireReglageSourcesClaude, marquerEpuisee } from "./source-claude";
import { resumeBudget } from "./couts";
import { creerNotification } from "./notifications";
import { signalerDepassementIndicatif } from "./budget-mensuel";
import { budgetIndicatifPour, FACTEUR_SECURITE_BUDGET } from "./mode-budget";
import { declarerRecharge, libererReservation, manquesPour, MARGE_CREDITS, signalerAttenteCredit, verifierEtReserverSelonOrigine } from "./credits";
import type { OrigineLancement } from "./budget-mensuel";

/** Budget Claude de Will : 100 $ par mois (décision du 03/10 ; 30 $ dans l'addendum du 02/10), réglable. */
export const PLAFOND_MENSUEL_CLAUDE_USD = 100;
export const PARAM_PLAFOND_MENSUEL = "claude.plafondMensuelUsd";
export const PARAM_MODELE_BLOQUE = "generateur.modeleBloque";
export const MESSAGE_MODELE_CHANGE = "Le modèle d'écriture a changé : mise à jour nécessaire.";
/** 429 / 529 / 5xx : 3 essais en tout (B.3.4 n° 6). */
export const ESSAIS_SURCHARGE = 3;
/** Claude refuse la clé du studio (lot R2 : exporté, le même message pour l'écriture et les textes de publication). */
export const MESSAGE_CLE_REFUSEE = "Claude refuse la clé du studio : remplacez-la, puis « Tester la connexion » dans Réglages > Connexions.";

/** Montant en dollars à la française (« 1,50 ») ; lot R2 : exporté. */
export function formaterUsd(usd: number): string {
  return usd.toFixed(2).replace(".", ",");
}

/** Refus net d'une demande par Claude (erreur 400) : il se reproduirait à l'identique, l'écriture s'arrête. */
export const CODE_REFUS_NET = "CLAUDE_REFUS";

const paramAttente = (generationId: Id) => `generateur.attenteCredit.${generationId}`;

/** « seuil » (paquet 4) : une étape coûte plus que le seuil de confirmation du budget ; elle attend que Will le relève. */
type MotifAttente = "facturation" | "plafond-mensuel" | "credit" | "budget" | "seuil";

interface Attente {
  depuis: string;
  motif: MotifAttente;
  estimationUsd: number;
  lignes: LigneCout[];
  message: string;
  /** Limite du mois et budget du studio au moment du blocage : les relever compte comme un geste de Will (E2E-1 n° 8). */
  plafondUsd?: number;
  budgetCentimes?: number;
  /** Mois (AAAA-MM) où Will a été prévenu que la reprise attend son geste : une seule fois par mois. */
  prevenuMois?: string;
  /** Garde-fous budget (15/10) : l'empêchement a disparu, l'écriture attend le geste de Will (« Reprendre »). */
  prete?: string;
}

/** Phrase de l'attente d'une écriture (fiche sujet), seulement quand elle attend que Will relève son seuil (paquet 4). */
export async function phraseAttenteSeuil(generationId: Id): Promise<string | null> {
  const a = await lireParametre<Attente | null>(paramAttente(generationId), null);
  if (a?.motif !== "seuil") return null;
  // Mode indicatif : le seuil ne se relève plus, c'est le geste « Reprendre » (qui montre le prix) qui le confirme.
  return (await indicatifDeLEcriture(generationId)) ? `${a.message} Confirmez le prix avec « Reprendre ».` : `${a.message} Relevez-le dans Réglages, puis touchez « Reprendre ».`;
}

/**
 * Phrase de l'attente d'une écriture (fiche sujet) : d'abord le message ENREGISTRÉ au moment de l'attente (six causes : comptes
 * épuisés, sans compte, limite du mois, budget, crédit, seuil). « Comptes épuisés » n'est que le dernier recours (motif de
 * facturation sans message, en mode abonnements).
 */
export async function phraseAttenteCredit(generationId: Id, abonnements: boolean): Promise<string | null> {
  const a = await lireParametre<Attente | null>(paramAttente(generationId), null);
  if (!a) return null;
  if (a.message) return `${a.message} Puis touchez « Reprendre ».`;
  return a.motif === "facturation" && abonnements ? "Comptes Claude épuisés : jusqu'au renouvellement, puis touchez « Reprendre »." : null;
}

/** Garde-fous budget (15/10) : l'écriture en attente est-elle prête à reprendre (au geste de Will) ? */
export async function ecriturePreteAReprendre(generationId: Id): Promise<boolean> {
  return !!(await lireParametre<Attente | null>(paramAttente(generationId), null))?.prete;
}

/* ------------------------------------------------------------------ */
/* Choix de l'exécutant (injectable pour les tests et l'essai)         */
/* ------------------------------------------------------------------ */

const cleInjection = Symbol.for("studio-axion-ia.claude-essai");
interface Injection {
  /** Clé du compte 1 (comme avant le multi-comptes). */
  cle?: string;
  /** Clés d'essai par source : si présent, SEULES ces clés (et `cle` pour le compte 1) existent pour le studio. */
  cles?: Partial<Record<SourceClaude, string>>;
  fetch: typeof fetch;
  /** Attente avant le n-ième nouvel essai (ms). Défaut : 2 s, 4 s. */
  attenteMs?: (essai: number) => number;
}
type AvecInjection = typeof globalThis & { [cleInjection]?: Injection | null };

/** Tests et essais seulement : Claude répond par ce `fetch` (aucun appel réseau). `null` : retour au vrai. */
export function injecterClaudePourEssai(i: Injection | null): void {
  (globalThis as AvecInjection)[cleInjection] = i;
}

function injection(): Injection | null {
  return (globalThis as AvecInjection)[cleInjection] ?? null;
}

/** Lots groupés (comité éditorial) : le `fetch` d'essai injecté, sinon `undefined` (le vrai). */
export function fetchClaudeEssai(): typeof fetch | undefined {
  return injection()?.fetch;
}

/** Les clés visibles par le studio : celles de l'essai injecté (et elles seules), sinon l'environnement du serveur. */
export function envClaude(): EnvClaude {
  const i = injection();
  if (!i) return process.env;
  const env: EnvClaude = {};
  const cles: Partial<Record<SourceClaude, string>> = { ...(i.cle ? { "abonnement-1": i.cle } : {}), ...i.cles };
  for (const s of [...SOURCES_ABONNEMENT.map((x) => x.id), "api" as SourceClaude]) {
    if (cles[s]) env[variableDeLaSource(s)] = cles[s];
  }
  return env;
}

/**
 * Clé d'UN compte Claude, que Claude soit choisi ou non (`null` : absente), SANS repli vers un autre compte. Pour SUIVRE
 * un lot déjà envoyé (lecture gratuite) ; jamais pour un nouvel envoi.
 */
export function cleClaudeDuStudio(source: SourceClaude = "abonnement-1"): string | null {
  return cleDeLaSource(source, envClaude());
}

/** Claude choisi et un compte prêt à répondre. `source` : le compte qui répond (mis à jour si la rotation change de compte). */
export interface ClaudeActif {
  fournisseur: FournisseurScriptClaude;
  cle: string;
  source: SourceClaude;
  toutesEpuisees?: false;
}
/** Claude choisi, des comptes posés, mais tous épuisés : rien ne part (jamais une simulation silencieuse). */
export interface ClaudeToutesEpuisees {
  toutesEpuisees: true;
  comptes: number;
  /** Claude choisi mais AUCUN compte utilisable (pas épuisé) : mode « api » sans clé payante, ou comptes tous désactivés. */
  sansCompte?: "api" | "comptes";
}

/**
 * Claude réel s'il est CHOISI et qu'un compte est prêt ; `null` (simulation, « À relier ») SEULEMENT si aucune clé n'est
 * utilisable ; `{ toutesEpuisees: true }` si les comptes posés sont tous épuisés. Lot R2 : exporté, et le choix se lit
 * pour le type demandé (« script » pour l'écriture, « texte-reseaux » pour les textes de publication).
 */
export async function claudeActif(type: "script" | "texte-reseaux" = "script"): Promise<ClaudeActif | ClaudeToutesEpuisees | null> {
  const { demande } = choixFournisseur(type, await lireParametre<string | null>(`fournisseur.${type}`, null));
  if (demande !== "claude") return null;
  const choix = await choisirSourceClaude([], envClaude());
  if (choix.etat === "aucun") {
    // Claude CHOISI mais sans compte utilisable : jamais une simulation silencieuse (l'appelant attend, avec une phrase claire).
    const env = envClaude();
    const reglage = await lireReglageSourcesClaude();
    if (reglage.mode === "api") return { toutesEpuisees: true, comptes: 0, sansCompte: "api" };
    if (SOURCES_ABONNEMENT.some((s) => cleDeLaSource(s.id, env))) return { toutesEpuisees: true, comptes: 0, sansCompte: "comptes" };
    return null;
  }
  if (choix.etat === "tous-epuises") return { toutesEpuisees: true, comptes: choix.comptes };
  return { fournisseur: creerFournisseurScriptClaude(choix.cle, injection()?.fetch), cle: choix.cle, source: choix.source };
}

/** Phrase d'attente quand Claude est choisi mais qu'aucun compte n'est utilisable (ni épuisé, ni prêt). */
export function messageSansCompte(cause: "api" | "comptes"): string {
  return cause === "api" ? "La clé de l'API payante n'est pas posée : ajoutez-la dans Réglages, ou repassez aux comptes d'abonnement." : "Aucun compte Claude n'est actif : réactivez un compte dans Réglages.";
}

/** Claude peut-il écrire MAINTENANT ? (choisi, avec un compte prêt) */
export function peutEcrire(actif: ClaudeActif | ClaudeToutesEpuisees | null): actif is ClaudeActif {
  return !!actif && !actif.toutesEpuisees;
}

/**
 * Appelle un rôle. C'est le SEUL endroit où l'on change de compte : un refus de FACTURATION rendu avant tout flux (HTTP,
 * `horsFlux`) sur un compte d'abonnement le marque épuisé et REJOUE le même appel (même appel, même réservation, même
 * étape) sur le compte suivant ; au plus 3 essais, jamais deux fois le même compte. Toute autre erreur (429/529, délai,
 * réseau, réponse illisible, billing_error DANS le flux) est relancée telle quelle, sans changer de compte. Jamais de
 * passage vers l'API payante, qui ne s'active que par le choix manuel de Will. `actif` est mis à jour : après l'appel il
 * dit quel compte a réellement répondu.
 */
export async function appelerAvecRotation<S extends z.ZodType>(actif: ClaudeActif, role: DefinitionRole<S>, entree: EntreeRole, lien?: { type: "sujet" | "video"; id: Id }): Promise<ResultatRole<z.infer<S>>> {
  const essayees: SourceAbonnement[] = [];
  for (;;) {
    try {
      return await actif.fournisseur.executerRole(role, entree);
    } catch (e) {
      // 429 / 5xx : un plafond de débit ou une panne, jamais un compte épuisé (même si le message parle de « usage limits »).
      if (!(e instanceof ErreurClaude) || e.code !== "facturation" || !e.horsFlux || actif.source === "api" || e.statut === 429 || (e.statut ?? 0) >= 500) throw e;
      const refusee = actif.source;
      essayees.push(refusee);
      let suivant: { source: SourceAbonnement; cle: string } | null;
      try {
        await marquerEpuisee(refusee);
        if (essayees.length >= SOURCES_ABONNEMENT.length) throw e;
        const env = envClaude();
        suivant = prochaineSourceAbonnement(await lireReglageSourcesClaude(), env, await etatsEpuisement(), essayees);
        console.info(`[studio] Claude : ${libelleSource(refusee)} refuse (facturation) : ${masquerSecretsClaude(e.message, [actif.cle], env)}`);
        if (!suivant) throw e;
        await journaliser(lien?.type === "video" ? "publication" : "generateur", `${libelleSource(refusee)} épuisé : passage au compte ${numeroAbonnement(suivant.source)}.`, lien);
      } catch {
        // Panne de la base ou du journal pendant la bascule : c'est le refus d'origine qui remonte (réservation rendue par l'appelant).
        throw e;
      }
      actif.fournisseur = creerFournisseurScriptClaude(suivant.cle, injection()?.fetch);
      actif.cle = suivant.cle;
      actif.source = suivant.source;
    }
  }
}

export function attendre(ms: number): Promise<void> {
  return ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve();
}

/** Attente avant le n-ième nouvel essai sur surcharge (2 s, 4 s ; injectable par les essais). Lot R2 : exportée. */
export function attenteSurcharge(essai: number): number {
  return (injection()?.attenteMs ?? ((n: number) => 2000 * 2 ** (n - 1)))(essai);
}

/* ------------------------------------------------------------------ */
/* Calculs                                                             */
/* ------------------------------------------------------------------ */

/** Taux dollar → euro du réglage (lot R2 : exporté). */
export async function taux(): Promise<number> {
  return lireParametre<number>("taux.usdEur", TAUX_USD_EUR_PAR_DEFAUT);
}

export async function plafondMensuelClaudeUsd(): Promise<number> {
  const v = await lireParametre<number>(PARAM_PLAFOND_MENSUEL, PLAFOND_MENSUEL_CLAUDE_USD);
  return Number.isFinite(v) && v >= 0 ? v : PLAFOND_MENSUEL_CLAUDE_USD;
}

/** Dépensé chez Claude ce mois-ci + réservé en cours, en centimes de dollar. */
export async function engageClaudeDuMoisCentimes(): Promise<{ depense: number; reserve: number }> {
  const d = depots();
  const mois = cleMois();
  // Le filtre part DANS `lister` : le dépôt ne copie (structuredClone) que les dépenses du mois, pas toute la collection.
  const depense = depenseDuFournisseur(await d.depenses.lister((x) => cleMois(x.date) === mois), "anthropic", await taux());
  const reserve = totalReserve(await d.reservations.lister((r) => r.statut === "active"), "anthropic");
  // L3-01 : la dépense compte au centime de dollar SUPÉRIEUR (jamais un demi-centime perdu sous la limite du mois).
  return { depense: centimesAuSuperieur(depense), reserve };
}

/**
 * Dépensé par une génération (dollars, PUR) : coût réel des étapes terminées, et le PIRE CAS des étapes lancées restées
 * sans réponse (B.3.4 n° 4 : sans réponse, l'estimation reste comptée).
 */
export function depenseGenerationUsd(g: Pick<GenerationScript, "etapes">): number {
  let total = 0;
  for (const e of g.etapes) {
    if (e.jetons) total += coutUsd(e.jetons, e.modeleEffectif ?? e.modeleDemande);
    else if (e.appelId && !e.termineLe) total += e.estimationPireCasUsd;
  }
  return total;
}

/**
 * L3-01 (audit) : la dépense d'une écriture en centimes de dollar ENTIERS, pour les contrôles de plafond : chaque étape
 * (coût réel ou pire cas d'un appel en vol) est comptée au centime supérieur, puis les entiers sont additionnés.
 */
export function depenseGenerationCentimesUsd(g: Pick<GenerationScript, "etapes">): number {
  let total = 0;
  for (const e of g.etapes) {
    if (e.jetons) total += centimesAuSuperieur(coutUsd(e.jetons, e.modeleEffectif ?? e.modeleDemande) * 100);
    else if (e.appelId && !e.termineLe) total += centimesAuSuperieur(e.estimationPireCasUsd * 100);
  }
  return total;
}

/** Ligne de coût Claude en euros (lot R2 : exportée). */
export function ligne(etape: string, usd: number, t: number, nature: LigneCout["nature"]): LigneCout {
  const montant = usdVersEur(centimesUsd(usd), t);
  return { etape, fournisseur: "anthropic", unite: "appel", quantite: 1, prixUnitaire: montant, total: montant, nature };
}

/* ------------------------------------------------------------------ */
/* Exécution d'un rôle                                                 */
/* ------------------------------------------------------------------ */

export type ResultatExecution<T = unknown> =
  | {
      ok: true;
      simule: boolean;
      texte: string;
      donnees?: T;
      invalide?: string;
      marqueur?: MarqueurArret;
      coutUsd: number;
      modele: string;
      stopReason: string | null;
      depenseId?: Id;
    }
  | { ok: false; arret: "en-attente-credit" | "plafond-atteint" | "bloquee-modele" | "verrou-perdu" | "budget-usine"; message: string };

async function generationExecutable(generationId: Id): Promise<GenerationScript> {
  const g = await depots().generations.obtenir(generationId);
  if (!g) throw new ErreurStudio("INTROUVABLE", "Cette écriture n'existe plus.");
  if (g.statut !== "en-cours" && g.statut !== "en-pause") throw new ErreurStudio("GENERATION_ARRETEE", "Cette écriture est arrêtée : rien ne part.");
  return g;
}

async function mettreEnAttente(g: GenerationScript, a: Omit<Attente, "depuis">): Promise<ResultatExecution<never>> {
  await depots().generations.modifier(g.id, { statut: "en-attente-credit" });
  const releve = { plafondUsd: await plafondMensuelClaudeUsd(), budgetCentimes: (await resumeBudget()).budget.centimes };
  await ecrireParametre(paramAttente(g.id), { ...a, ...releve, depuis: maintenant() } satisfies Attente);
  await journaliser("generateur", `Écriture en attente de crédit Claude : ${a.message}`, { type: "sujet", id: g.scriptMaitreId });
  // Garde-fous budget (15/10) : rien ne repart seul ; « Reprendre » apparaît quand c'est possible.
  const indicatifAttente = a.motif === "seuil" && (await indicatifDeLEcriture(g.id));
  const suite = a.motif === "seuil" ? (indicatifAttente ? "Confirmez le prix avec « Reprendre »." : "Relevez le seuil de confirmation dans Réglages, puis touchez « Reprendre ».") : "Rien ne repart seul : touchez « Reprendre » quand ce sera possible.";
  return { ok: false, arret: "en-attente-credit", message: `${a.message} ${suite}` };
}

/**
 * G4 : les appels d'une même génération partent EN PARALLÈLE (déclinaisons, juges) ; chaque écriture du journal des
 * étapes relit la génération sous ce verrou local (sinon deux appels simultanés s'effaçaient l'un l'autre).
 */
let fileEtapes: Promise<unknown> = Promise.resolve();
function sousVerrouEtapes<T>(f: () => Promise<T>): Promise<T> {
  const suite = fileEtapes.then(f, f);
  fileEtapes = suite.catch(() => undefined);
  return suite;
}

/**
 * E2E-2 argent n° 10 (B1) : la limite Claude DU MOIS, le pré-vol des crédits et la réservation se font d'un seul
 * tenant. Sans ce verrou, quatre appels lancés ensemble (déclinaisons, juges) lisaient tous l'engagé du mois avant
 * qu'aucun n'ait réservé, et partaient tous au-delà de la limite. Verrou distinct de celui des étapes (pris DEDANS).
 */
let fileMois: Promise<unknown> = Promise.resolve();
/** Lot R2 : exporté (les textes de publication passent sous le MÊME verrou que l'écriture des sujets). */
export function sousVerrouMois<T>(f: () => Promise<T>): Promise<T> {
  const suite = fileMois.then(f, f);
  fileMois = suite.catch(() => undefined);
  return suite;
}

/**
 * `rendreReserve` : l'étape « lancée » prend le relais de la réservation du plafond du sujet DANS LE MÊME passage sous
 * verrou (son pire cas est désormais compté par `depenseGenerationUsd`) : ni trou, ni double compte.
 */
async function ajouterEtape(generationId: Id, etape: GenerationScript["etapes"][number], patch: Partial<GenerationScript> = {}, rendreReserve = false): Promise<void> {
  await sousVerrouEtapes(async () => {
    const d = depots();
    const g = await d.generations.obtenir(generationId);
    if (g) await d.generations.modifier(generationId, { ...patch, etapes: [...g.etapes, etape] });
    if (rendreReserve && etape.appelId) rendreReserveSujet(generationId, etape.appelId);
  });
}

/* ------------------------------------------------------------------ */
/* Plafond du sujet réservé, appels en vol (E2E-1 n° 6 et 7)           */
/* ------------------------------------------------------------------ */

const cleEnVol = Symbol.for("studio-axion-ia.generateur-en-vol");
interface EnVol {
  /** Estimations réservées sur le plafond du sujet, par génération puis par appel, en attendant l'étape « lancée ». */
  sujet: Map<Id, Map<string, number>>;
  /** Appels partis DEPUIS CE PROCESSUS et pas encore revenus. */
  appels: Set<string>;
  /** Appels interrompus déjà signalés au journal (une fois par processus). */
  signales: Set<string>;
}
type AvecEnVol = typeof globalThis & { [cleEnVol]?: EnVol };

function enVol(): EnVol {
  const g = globalThis as AvecEnVol;
  return (g[cleEnVol] ??= { sujet: new Map(), appels: new Set(), signales: new Set() });
}

/** Réservations en vol du sujet, en centimes de dollar entiers (chacune au centime supérieur). */
function reserveSujetCentimesUsd(generationId: Id): number {
  let total = 0;
  for (const v of enVol().sujet.get(generationId)?.values() ?? []) total += centimesAuSuperieur(v * 100);
  return total;
}

function rendreReserveSujet(generationId: Id, appelId: string): void {
  const m = enVol().sujet.get(generationId);
  m?.delete(appelId);
  if (m && !m.size) enVol().sujet.delete(generationId);
}

/** Phrase de l'arrêt de sécurité d'une écriture : son pire cas dépasserait 5 fois le prix annoncé (le plafond du sujet). */
export function phraseArretSecuriteEcriture(plafondUsd: number): string {
  return `Arrêt de sécurité : cette écriture dépasserait ${FACTEUR_SECURITE_BUDGET} fois le prix annoncé (${formaterUsd(plafondUsd)} $), rien de plus n'est payé.`;
}

/**
 * Limite de l'arrêt de sécurité d'un sujet, en dollars : 5 × le plafond d'ORIGINE, plus la part relevée après des pannes
 * (`releverPlafondApresPannes`), qui s'ajoute à 1 × seulement.
 */
export function limiteSecuriteUsd(g: Pick<GenerationScript, "plafondUsd" | "etapes" | "appelsReleves">, releveEnPlusUsd = 0): number {
  const releve = releveDejaUsd(g) + releveEnPlusUsd;
  return Math.max(0, g.plafondUsd - releve) * FACTEUR_SECURITE_BUDGET + releve;
}

/** Part du plafond relevée après des pannes (appels déjà relevés) : elle s'ajoute au plafond d'origine, sans facteur. */
export function releveDejaUsd(g: Pick<GenerationScript, "etapes" | "appelsReleves">): number {
  const releves = new Set(g.appelsReleves ?? []);
  return g.etapes.filter((e) => !!e.appelId && releves.has(e.appelId)).reduce((t, e) => t + e.estimationPireCasUsd, 0);
}

/** Le « prix annoncé » d'un sujet : son plafond d'origine, sans la part relevée après des pannes. */
export function plafondAnnonceUsd(g: Pick<GenerationScript, "plafondUsd" | "etapes" | "appelsReleves">, releveEnPlusUsd = 0): number {
  return Math.max(0, g.plafondUsd - releveDejaUsd(g) - releveEnPlusUsd);
}

/**
 * Contrôle du plafond du sujet ET réservation de l'estimation, d'un seul tenant sous le verrou des étapes : deux appels
 * partis ensemble (`Promise.all`) voient chacun la réservation de l'autre. La réservation est rendue quand l'étape
 * « lancée » est écrite (`ajouterEtape(…, true)`) ou quand l'appel ne part pas.
 * `indicatif` (mode budget indicatif, commande de Will) : le plafond ne refuse plus, il prévient ; jamais de refus (le prix ne bloque jamais).
 */
export async function reserverDansPlafondSujet(generationId: Id, appelId: string, usd: number, indicatif = false): Promise<{ ok: true } | { ok: false; plafondUsd: number }> {
  let depassement: string | null = null;
  const r = await sousVerrouEtapes(async () => {
    const g = await depots().generations.obtenir(generationId);
    if (!g) return { ok: false as const, plafondUsd: 0 };
    // L3-01 (audit) : en centimes de dollar entiers, dépenses au centime supérieur, plafond inchangé (au centime inférieur).
    const pireCas = depenseGenerationCentimesUsd(g) + reserveSujetCentimesUsd(generationId) + centimesAuSuperieur(usd * 100);
    const plafond = centimesDuPlafond(g.plafondUsd);
    if (pireCas > plafond) {
      // Mode indicatif (commande de Will) : le plafond du sujet est un repère, jamais un arrêt (règle « le prix ne bloque jamais »).
      if (!indicatif) return { ok: false as const, plafondUsd: g.plafondUsd };
      depassement = `Le plafond du sujet (${formaterUsd(g.plafondUsd)} $) est dépassé ; l'écriture continue.`;
    }
    const m = enVol().sujet.get(generationId) ?? new Map<string, number>();
    m.set(appelId, usd);
    enVol().sujet.set(generationId, m);
    return { ok: true as const };
  });
  // L'alerte part APRÈS le verrou des étapes (jamais d'attente réseau sous verrou) ; une panne d'alerte ne change rien.
  if (depassement) await signalerDepassementIndicatif("plafond-sujet", "Plafond du sujet dépassé (l'écriture continue)", depassement);
  return r;
}

/**
 * Appels « lancés » par un processus précédent et restés sans réponse (redémarrage pendant l'appel, E2E-1 n° 7).
 * L'API Messages ne permet pas de relire une réponse déjà produite : l'étape sera REJOUÉE par la chaîne. Ici :
 *  - l'étape reste « lancée » : son PIRE CAS reste compté dans la dépense du sujet (`depenseGenerationUsd`), ce qui
 *    plafonne la perte, même si les redémarrages se répètent ;
 *  - sa réservation reste comptée dans le mois où l'appel est parti (il a pu être facturé), puis elle est soldée
 *    (« consommée ») dès le mois suivant : elle ne bloque plus la limite des mois d'après ;
 *  - une ligne au journal, une fois par processus.
 * Renvoie le nombre de réservations soldées.
 */
export async function solderAppelsInterrompus(): Promise<number> {
  const d = depots();
  const { appels, signales } = enVol();
  const mois = cleMois();
  let soldees = 0;
  const interrompue = (e: GenerationScript["etapes"][number]) => !!e.appelId && !e.termineLe && !appels.has(e.appelId);
  for (const g of await d.generations.lister((x) => x.etapes.some(interrompue))) {
    for (const e of g.etapes.filter(interrompue)) {
      const appelId = e.appelId!;
      if (!signales.has(appelId)) {
        signales.add(appelId);
        await journaliser("generateur", `Un appel à Claude est resté sans réponse (coupure ou redémarrage) : il sera rejoué ; ${formaterUsd(e.estimationPireCasUsd)} $ restent comptés dans le plafond du sujet.`, { type: "sujet", id: g.scriptMaitreId });
      }
      const anciennes = await d.reservations.lister((r) => r.travailId === appelId && r.statut === "active" && cleMois(r.creeLe) !== mois);
      if (anciennes.length) {
        await libererReservation(appelId, "consommee");
        soldees += anciennes.length;
      }
    }
  }
  return soldees;
}

/**
 * CORRECTEUR FINAL A (VERIF-E2E-1 n° 7) : à la reprise demandée par Will après un arrêt sur panne, les appels restés
 * SANS réponse (pire cas compté pour toujours, car peut-être facturés) ne mangent plus la place des étapes à refaire :
 * le plafond du sujet est relevé d'autant. La reprise dispose donc de la même marge qu'au lancement (le prix « au plus »
 * annoncé), et va au bout au lieu de s'arrêter « plafond atteint » après avoir repayé les étapes. Rien n'est effacé :
 * les appels sans réponse restent comptés dans le mois. Renvoie le relèvement (dollars).
 */
function appelsARelever(g: GenerationScript): GenerationScript["etapes"] {
  const { appels } = enVol();
  const deja = new Set(g.appelsReleves ?? []);
  return g.etapes.filter((e) => !!e.appelId && !e.termineLe && !appels.has(e.appelId) && !deja.has(e.appelId));
}

/** Relecture finale G1 : relèvement que « Reprendre l'écriture » ferait (dollars), sans rien écrire (pour le prix). */
export async function releveApresPannesUsd(generationId: Id): Promise<number> {
  const g = await depots().generations.obtenir(generationId);
  return g ? appelsARelever(g).reduce((t, e) => t + e.estimationPireCasUsd, 0) : 0;
}

/**
 * Relecture finale G1 : `maxUsd` est le relèvement que Will a vu et accepté. Plus haut au moment d'écrire (un appel de
 * plus resté sans réponse) : rien n'est relevé, `-1` est renvoyé (le nouveau prix sera montré).
 */
export async function releverPlafondApresPannes(generationId: Id, maxUsd: number): Promise<number> {
  return sousVerrouEtapes(async () => {
    const d = depots();
    const g = await d.generations.obtenir(generationId);
    if (!g) return 0;
    const deja = new Set(g.appelsReleves ?? []);
    const sansReponse = appelsARelever(g);
    const releve = sansReponse.reduce((t, e) => t + e.estimationPireCasUsd, 0);
    if (releve <= 0) return 0;
    if (releve > maxUsd + 1e-9) return -1;
    await d.generations.modifier(generationId, { plafondUsd: g.plafondUsd + releve, appelsReleves: [...deja, ...sansReponse.map((e) => e.appelId!)] });
    return releve;
  });
}

async function majEtape(generationId: Id, appelId: string, patch: Partial<GenerationScript["etapes"][number]>): Promise<void> {
  await sousVerrouEtapes(async () => {
    const d = depots();
    const g = await d.generations.obtenir(generationId);
    if (!g) return;
    await d.generations.modifier(generationId, { etapes: g.etapes.map((e) => (e.appelId === appelId ? { ...e, ...patch } : e)) });
  });
}

/**
 * Écriture lancée en essai (paquet 4, D3). Les écritures d'avant ce champ : en essai si au moins une étape a déjà été
 * simulée et aucune n'est partie chez Claude.
 */
export function ecritureEnEssai(g: Pick<GenerationScript, "essai" | "etapes">): boolean {
  return g.essai ?? (g.etapes.length > 0 && g.etapes.every((e) => e.modeleDemande === "simulation"));
}

/**
 * Seconde relecture (R3) : une écriture d'avant le champ `essai` (lancée avant le déploiement), encore sans aucune étape,
 * ne dit pas si elle a été lancée en essai. Si Claude n'est pas branché au moment de la reprise, elle est marquée essai
 * (migration non destructive : seul `essai` est posé) ; elle ne partira donc jamais en réel sans prix ni accord, même si
 * Claude est relié ensuite. Les écritures d'après portent toujours `essai` (vrai ou faux) : elles ne sont pas touchées.
 * Renvoie les ids marqués.
 */
export async function marquerEcrituresAnciennesEnEssai(): Promise<Id[]> {
  const d = depots();
  const anciennes = await d.generations.lister((g) => g.essai === undefined && g.etapes.length === 0 && !g.simulee && (g.statut === "en-cours" || g.statut === "en-pause" || g.statut === "en-attente-credit"));
  if (!anciennes.length || (await claudeBranche())) return [];
  for (const g of anciennes) await d.generations.modifier(g.id, { essai: true });
  return anciennes.map((g) => g.id);
}

/**
 * Seconde relecture (R1) : une écriture de la boucle ne paie un rôle que dans l'instance qui tient le verrou de la boucle.
 * Verrou perdu en plein tour (`perdu()` met `verrouTenu` à faux) : le rôle suivant ne part pas, l'écriture reste
 * « en-cours » et l'instance qui tient le verrou la reprend. `verrouTenu` absent : aucun verrou dans ce processus (outils,
 * essais). Une retouche, demandée par Will sur l'instance qui sert sa page, ne passe pas par la boucle.
 */
function verrouPerdu(g: Pick<GenerationScript, "portee">): boolean {
  return g.portee !== "retouche" && etatBoucle().verrouTenu === false;
}
const ARRET_VERROU_PERDU = { ok: false, arret: "verrou-perdu", message: "Le verrou de la boucle d'écriture est passé à une autre instance : elle reprend l'écriture." } as const;

/**
 * Exécute UN rôle pour une génération, avec pré-vol, plafonds, réservation et coût réel (voir l'en-tête).
 * Renvoie `ok: false` (rien n'est parti, rien n'est payé) sur un arrêt de crédit, de plafond ou de modèle.
 */
export async function executerRoleFacture<S extends z.ZodType>(generationId: Id, role: DefinitionRole<S>, entree: EntreeRole, options: { origine?: OrigineLancement } = {}): Promise<ResultatExecution<z.infer<S>>> {
  const d = depots();
  const g = await generationExecutable(generationId);
  if (verrouPerdu(g)) return ARRET_VERROU_PERDU;
  // Relecture paquet 4 (exactitude D3) : une écriture lancée en essai reste en essai jusqu'au bout (Claude relié en
  // cours de route ne la fait jamais payer : elle n'a eu ni prix ni accord).
  const actif = ecritureEnEssai(g) ? null : await claudeActif();
  // Seconde relecture (R3) : écriture d'avant le champ `essai`, sans étape, Claude pas branché : elle est d'essai.
  if (!actif && g.essai === undefined && g.etapes.length === 0) await d.generations.modifier(g.id, { essai: true });

  // 1. Simulation : aucun appel, 0 $.
  if (!actif) {
    // Démonstration de l'écran d'attente (captures) : lenteur d'essai, 0 par défaut, jamais en production.
    const lenteur = Number(process.env.STUDIO_SIMULATION_LENTEUR_MS ?? 0);
    if (lenteur > 0 && process.env.NODE_ENV !== "production") await attendre(lenteur);
    const sortie = role.simuler(entree);
    const texte = typeof sortie === "string" ? sortie : JSON.stringify(sortie);
    const le = maintenant();
    await ajouterEtape(g.id, { role: role.id, versionConsigne: role.version, modeleDemande: "simulation", effort: role.effort, lanceLe: le, termineLe: le, estimationPireCasUsd: 0, resultat: "ok" });
    return { ok: true, simule: true, texte, donnees: typeof sortie === "string" ? undefined : sortie, coutUsd: 0, modele: "simulation", stopReason: "end_turn" };
  }

  const estimation = pireCasRole(role, entree);
  const t = await taux();
  const lignes = [ligne(`Écriture · ${role.id}`, estimation, t, "estime")];

  // Tous les comptes Claude posés sont épuisés : AUCUN appel, AUCUNE réservation ; l'écriture attend (jamais l'API payante).
  if (!peutEcrire(actif)) {
    if (actif.sansCompte) return mettreEnAttente(g, { motif: "facturation", estimationUsd: estimation, lignes, message: messageSansCompte(actif.sansCompte) });
    await signalerAttenteCredit(null, "anthropic", g.estDemo);
    return mettreEnAttente(g, { motif: "facturation", estimationUsd: estimation, lignes, message: messageComptesEpuises(actif.comptes) });
  }

  // 2. Plafond du sujet : estimation RÉALISTE (le pire cas reste la règle du plafond mensuel et du pré-vol), contrôlée ET
  // réservée sous le verrou des étapes (E2E-1 n° 6 : les appels parallèles se voient les uns les autres).
  const appelId = nouvelId("appel");
  // Mode indicatif : jamais pour une commande de l'Usine (elle reste bloquante).
  const indicatif = await budgetIndicatifPour(options.origine);
  const place = await reserverDansPlafondSujet(g.id, appelId, estimationRealisteRole(role, entree), indicatif);
  if (!place.ok) {
    await d.generations.modifier(g.id, { statut: "plafond-atteint" });
    // Plus d'arrêt de sécurité à 5 × : seul le mode bloquant refuse (les anciennes réserves `securite` restent lues par `phraseReserveRefusee`).
    await journaliser("generateur", `Plafond du sujet atteint (${g.plafondUsd.toFixed(2)} $) : l'écriture s'arrête là`, { type: "sujet", id: g.scriptMaitreId });
    return { ok: false, arret: "plafond-atteint", message: "Plafond du sujet atteint : on garde ce qui est écrit." };
  }

  let etapeEcrite = false;
  let alerteMois: string | null = null;
  try {
    // Étapes 3 à 5 d'un seul tenant (E2E-2 argent n° 10) : chaque appel voit la réservation des précédents.
    const arret = await sousVerrouMois(async (): Promise<ResultatExecution<never> | null> => {
      // 3. Plafond mensuel Claude (100 $ par défaut).
      const plafond = await plafondMensuelClaudeUsd();
      const engage = await engageClaudeDuMoisCentimes();
      if (engage.depense + engage.reserve + Math.ceil(estimation * 100 * (1 + MARGE_CREDITS)) > centimesDuPlafond(plafond)) {
        // Mode indicatif : la limite du mois est un repère (alerte, une cloche par jour), pas de plafond mensuel dur.
        if (!indicatif) return mettreEnAttente(g, { motif: "plafond-mensuel", estimationUsd: estimation, lignes, message: `Limite Claude du mois atteinte (${formaterUsd(plafond)} $).` });
        // L'alerte part après le verrou du mois (pas d'écriture de notification sous verrou).
        alerteMois = `Rien n'est arrêté : l'écriture continue (repère du mois ${formaterUsd(plafond)} $). Seul un crédit Claude épuisé la met en attente.`;
      }

      // 4. Pré-vol de la brique Crédits.
      try {
        // CORRECTEUR 1 — B6 : aucune confirmation en dur. Une écriture est bornée par le plafond Claude du mois : au-delà
        // du seuil de confirmation, elle serait refusée (personne ne l'a confirmée).
        // L3-0 : contrôle, réservation ET engagement sur le budget du mois d'un seul tenant (verrou des crédits) : une
        // fabrication simultanée voit cette écriture en vol. « usine » passe par `reserverPourUsine`.
        await verifierEtReserverSelonOrigine(options.origine, { lignes, total: lignes[0].total }, false, "Cette écriture", { videoId: g.scriptMaitreId /* sujet : la brique range ici l'objet payé */, travailId: appelId }, { automatique: await repriseDeWill(g.id) });
      } catch (e) {
        // L3-0 : écriture commandée par l'Usine sans budget reçu (ou budget atteint) : refus net, rien n'est payé et la
        // génération n'attend pas (une reprise automatique perdrait l'origine). L'Usine recommande après avoir réglé son budget.
        if (e instanceof ErreurStudio && (e.code === "BUDGET_USINE_ABSENT" || e.code === "BUDGET_MENSUEL_ATTEINT")) return { ok: false, arret: "budget-usine", message: e.message };
        if (e instanceof ErreurStudio && (e.code === "CREDIT_INSUFFISANT" || e.code === "BUDGET_DEPASSE")) {
          return mettreEnAttente(g, { motif: e.code === "BUDGET_DEPASSE" ? "budget" : "credit", estimationUsd: estimation, lignes, message: e.message });
        }
        // Relecture paquet 4 (exactitude petit défaut 3) : seuil de confirmation plus bas que le pire cas d'une étape.
        // Rien n'est payé : l'écriture ATTEND (phrase claire), elle ne finit plus en « panne ».
        if (e instanceof ErreurStudio && e.code === "CONFIRMATION_REQUISE") {
          return mettreEnAttente(g, { motif: "seuil", estimationUsd: estimation, lignes, message: "Une étape de cette écriture coûte plus que votre seuil de confirmation." });
        }
        throw e;
      }

      // R1 : verrou relu juste avant d'appeler (il a pu tomber pendant les contrôles) : la réservation est rendue.
      if (verrouPerdu(g)) {
        await libererReservation(appelId, "liberee");
        return ARRET_VERROU_PERDU;
      }
      // 5. Réservation déjà faite (étape 4), étape « lancée » écrite avant l'appel (elle prend le relais de la réservation du sujet).
      enVol().appels.add(appelId);
      const reservation = await d.reservations.trouver((r) => r.travailId === appelId && r.statut === "active");
      await ajouterEtape(g.id, { role: role.id, versionConsigne: role.version, modeleDemande: role.modele, effort: role.effort, appelId, lanceLe: maintenant(), estimationPireCasUsd: estimation }, { reservationId: reservation?.id }, true);
      etapeEcrite = true;
      return null;
    });
    if (alerteMois) await signalerDepassementIndicatif("claude-mois", "Repère Claude du mois dépassé", alerteMois);
    if (arret) return arret;
  } finally {
    if (!etapeEcrite) {
      // Un arrêt après la réservation (verrou perdu, panne) rend aussi la réservation et l'engagement ; sans effet sinon.
      await libererReservation(appelId, "liberee");
      rendreReserveSujet(g.id, appelId);
      enVol().appels.delete(appelId);
    }
  }

  // 6. Appel (3 essais sur surcharge seulement).
  let essai = 0;
  try {
    for (;;) {
      essai++;
      try {
        const r = await appelerAvecRotation(actif, role, entree, { type: "sujet", id: g.scriptMaitreId });
        const rep = r.reponse;
        const cout = coutReelUsd(rep);
        const lignesReelles = [ligne(`Écriture · ${role.id}`, cout, t, "reel")];
        const depenseEnr: DepenseEnregistree = { id: nouvelId("dep"), scriptMaitreId: g.scriptMaitreId, lignes: lignesReelles, total: lignesReelles[0].total, date: maintenant(), estDemo: g.estDemo, sourceClaude: actif.source, ...horodatage() };
        await d.depenses.enregistrer(depenseEnr);
        await libererReservation(appelId, "consommee");
        const resultat: GenerationScript["etapes"][number]["resultat"] =
          r.marqueur === "ANCRAGE_MANQUANT" ? "ancrage-manquant" : r.marqueur === "PREUVE_MANQUANTE" ? "preuve-manquante" : rep.stopReason === "refusal" ? "refus" : rep.stopReason === "max_tokens" ? "coupe" : r.invalide ? "rejete" : "ok";
        await majEtape(g.id, appelId, { termineLe: maintenant(), modeleEffectif: rep.modele, jetons: rep.jetons, resultat });
        if (rep.replis.length) {
          console.info(`[studio] générateur : « ${role.id} » servi par ${rep.modele} (repli après ${rep.replis.join(", ")})`);
          await journaliser("generateur", "Une étape a été écrite par le modèle de secours de Claude", { type: "sujet", id: g.scriptMaitreId });
        }
        return { ok: true, simule: false, texte: rep.texte, donnees: r.donnees, invalide: r.invalide, marqueur: r.marqueur, coutUsd: cout, modele: rep.modele, stopReason: rep.stopReason, depenseId: depenseEnr.id };
      } catch (e) {
        const err = e instanceof ErreurClaude ? e : null;
        if (err?.code === "surcharge" && essai < ESSAIS_SURCHARGE) {
          await attendre(Math.max(attenteSurcharge(essai), (err.attenteSec ?? 0) * 1000));
          continue;
        }
        return await traiterEchec(g, appelId, lignes, estimation, err, e, actif.cle, actif.source);
      }
    }
  } finally {
    enVol().appels.delete(appelId);
  }
}

/** Coût réel d'une réponse (dollars) ; repli serveur : jamais compté sous le tarif du modèle demandé. Lot R2 : exporté. */
export function coutReelUsd(rep: Pick<ReponseClaude, "jetons" | "modele" | "modeleDemande" | "replis">): number {
  const cout = coutUsd(rep.jetons, rep.modele);
  return rep.replis.length || rep.modele !== rep.modeleDemande ? Math.max(cout, coutUsd(rep.jetons, rep.modeleDemande)) : cout;
}

/** Phrase du Journal après un échec d'appel, selon sa cause (jamais le message brut de l'API). */
const PHRASES_INTERRUPTION: Partial<Record<string, string>> = {
  surcharge: "Écriture interrompue : Claude est surchargé. Elle attend « Reprendre ».",
  "cle-refusee": "Écriture interrompue : Claude refuse la clé du studio.",
  requete: "Écriture interrompue : Claude refuse cette demande telle qu'elle est faite.",
  illisible: "Écriture interrompue : la réponse de Claude était illisible. Elle attend « Reprendre ».",
};

async function traiterEchec(g: GenerationScript, appelId: string, lignes: LigneCout[], estimation: number, err: ErreurClaude | null, brute: unknown, cle: string, source: SourceClaude): Promise<ResultatExecution<never>> {
  const d = depots();
  const message = masquerSecretsClaude(err?.message ?? (brute instanceof Error ? brute.message : "Erreur inconnue."), [cle], envClaude());
  // Refus net de l'API : rien n'a été produit, la réservation est rendue au solde.
  // CORRECTEUR 1 : coupure APRÈS l'envoi (réseau, délai) : la réponse a pu être produite et facturée. Même règle que les
  // textes de publication (`depense-claude-video.ts`) : la réservation reste comptée (plafond du mois, solde suivi),
  // l'estimation reste aussi dans le plafond du sujet (étape sans `termineLe`). Rien n'est effacé.
  const refusNet = err?.code === "facturation" || err?.code === "modele-introuvable" || err?.code === "cle-refusee" || err?.code === "surcharge" || err?.code === "requete" || err?.code === "illisible";
  if (refusNet) await libererReservation(appelId, "liberee");
  if (err?.code === "facturation") {
    await majEtape(g.id, appelId, { termineLe: maintenant(), resultat: "rejete" });
    await signalerAttenteCredit(null, "anthropic", g.estDemo);
    return mettreEnAttente(g, { motif: "facturation", estimationUsd: estimation, lignes, message: "Claude refuse l'appel : crédit épuisé ou limite du compte atteinte." });
  }
  if (err?.code === "modele-introuvable") {
    await majEtape(g.id, appelId, { termineLe: maintenant(), resultat: "rejete" });
    await d.generations.modifier(g.id, { statut: "bloquee-modele" });
    await d.scriptsMaitres.modifier(g.scriptMaitreId, { etat: "bloquee-modele" }).catch(() => undefined);
    await ecrireParametre(PARAM_MODELE_BLOQUE, { message: MESSAGE_MODELE_CHANGE, detail: message, le: maintenant() });
    console.warn(`[studio] générateur : modèle introuvable — ${message}`);
    await journaliser("generateur", MESSAGE_MODELE_CHANGE, { type: "sujet", id: g.scriptMaitreId });
    return { ok: false, arret: "bloquee-modele", message: MESSAGE_MODELE_CHANGE };
  }
  if (err?.code === "surcharge" || err?.code === "requete" || err?.code === "cle-refusee" || err?.code === "illisible") {
    // Refus net de l'API : rien n'a été produit, rien n'est compté.
    await majEtape(g.id, appelId, { termineLe: maintenant(), resultat: "rejete" });
  }
  // Le message de l'API (déjà masqué) ne va qu'au journal du serveur ; le Journal du studio dit l'essentiel.
  console.warn(`[studio] générateur : écriture interrompue (${libelleSource(source)}) : ${err?.code ?? "erreur"} — ${message}`);
  await journaliser("generateur", PHRASES_INTERRUPTION[err?.code ?? ""] ?? "Écriture interrompue : Claude n'a pas répondu. Elle attend « Reprendre ».", { type: "sujet", id: g.scriptMaitreId });
  if (err?.code === "cle-refusee") throw new ErreurStudio("CLE_REFUSEE", MESSAGE_CLE_REFUSEE);
  // E2E-2 argent n° 2 : un refus NET de la demande (erreur 400 : texte trop long, demande mal formée) se reproduira à
  // l'identique : la boucle d'écriture l'arrête au lieu de la rejouer toutes les 4 s.
  if (err?.code === "requete") throw new ErreurStudio(CODE_REFUS_NET, "Claude refuse cette demande telle qu'elle est faite : la réessayer donnerait le même refus.");
  throw new ErreurStudio("CLAUDE_INDISPONIBLE", "Claude ne répond pas pour l'instant : l'écriture attend « Reprendre ».");
}

/* ------------------------------------------------------------------ */
/* Reprise automatique                                                 */
/* ------------------------------------------------------------------ */

/**
 * GARDE-FOUS BUDGET (15/10) : plus AUCUNE reprise automatique d'une écriture payante. Pour chaque écriture en attente de
 * crédit, l'empêchement a-t-il disparu (recharge Claude déclarée APRÈS un refus de facturation, limite du mois relevée,
 * réservation rendue, solde suivi et budget redevenus suffisants, seuil relevé) ?
 *  - sans geste de Will (boucle d'écriture, recharge déclarée, limite enregistrée) : l'écriture devient « prête à
 *    reprendre », Will est prévenu une fois ; rien ne part ;
 *  - au geste de Will (`gesteDeWill`, bouton « Reprendre (≈ X €) ») : elle repart (« en-cours ») depuis la dernière
 *    étape « ok ». Aucun appel ici : la chaîne repart à son prochain tour (G4).
 * Une écriture dont l'empêchement revient perd « prête ». Solde aussi les appels restés sans réponse
 * (`solderAppelsInterrompus`). Renvoie les écritures RELANCÉES (toujours vide sans geste de Will).
 */
export async function reprendreGenerationsEnAttenteCredit(options: { gesteDeWill?: boolean; scriptMaitreId?: Id } = {}): Promise<Id[]> {
  await solderAppelsInterrompus();
  const d = depots();
  const reprises: Id[] = [];
  // Une retouche se fait pendant le geste de Will : elle ne « reprend » jamais seule (E2E-2 argent n° 1).
  const attente = (await d.generations.lister((g) => g.statut === "en-attente-credit" && g.portee !== "retouche" && (!options.scriptMaitreId || g.scriptMaitreId === options.scriptMaitreId))).sort((a, b) => a.creeLe.localeCompare(b.creeLe));
  if (!attente.length) return reprises;
  const ctx = await contexteEmpechement();
  for (const g of attente) {
    const a = await lireParametre<Attente | null>(paramAttente(g.id), null);
    if (!a) continue;
    const demande = Math.ceil(a.estimationUsd * 100 * (1 + MARGE_CREDITS));
    const leve = await empechementLeve(a, ctx, await indicatifDeLEcriture(g.id));
    if (!leve) {
      if (a.prete) await ecrireParametre(paramAttente(g.id), { ...a, prete: undefined } satisfies Attente);
      continue;
    }
    if (!options.gesteDeWill) {
      if (!a.prete) await marquerPrete(g, a);
      continue;
    }
    await d.generations.modifier(g.id, { statut: "en-cours" });
    await ecrireParametre(paramAttente(g.id), null);
    await marquerRepriseDeWill(g.id);
    await journaliser("generateur", "Écriture reprise par Will : elle repart là où elle s'était arrêtée.", { type: "sujet", id: g.scriptMaitreId });
    reprises.push(g.id);
    // Les suivantes passent après celle-ci (deux reprises ne comptent pas deux fois le même solde).
    ctx.engage = { ...ctx.engage, reserve: ctx.engage.reserve + demande };
  }
  return reprises;
}

interface ContexteEmpechement {
  /** Mode « abonnements » avec un compte redevenu prêt (renouvellement) : lève un empêchement de facturation sans recharge. */
  comptePret: boolean;
  recharges: { date: string }[];
  plafondCentimes: number;
  budget: Awaited<ReturnType<typeof resumeBudget>>;
  engage: Awaited<ReturnType<typeof engageClaudeDuMoisCentimes>>;
}

async function contexteEmpechement(): Promise<ContexteEmpechement> {
  const comptePret = (await lireReglageSourcesClaude()).mode === "abonnements" && (await choisirSourceClaude([], envClaude())).etat === "pret";
  return { comptePret, recharges: await depots().recharges.lister((r) => r.fournisseur === "anthropic"), plafondCentimes: Math.round((await plafondMensuelClaudeUsd()) * 100), budget: await resumeBudget(), engage: await engageClaudeDuMoisCentimes() };
}

/** L'empêchement d'une écriture en attente a-t-il disparu (recharge, limite du mois, budget, seuil, crédit) ? Sans effet. */
async function empechementLeve(a: Attente, ctx: ContexteEmpechement, indicatif = false): Promise<boolean> {
  const demande = Math.ceil(a.estimationUsd * 100 * (1 + MARGE_CREDITS));
  // Mode indicatif (commande de Will) : la limite du mois, le budget restant et le seuil de confirmation sont des repères ;
  // seul compte le crédit réel (recharge ou compte prêt après un refus de facturation, solde lu chez le fournisseur).
  return (
    (a.motif !== "facturation" || ctx.comptePret || ctx.recharges.some((r) => r.date > a.depuis)) &&
    // Seuil de confirmation : seulement quand Will l'a relevé au-dessus du prix de l'étape.
    (indicatif || !(a.motif === "seuil" && (a.lignes[0]?.total.centimes ?? 0) > ctx.budget.seuilConfirmation.centimes)) &&
    (indicatif || ctx.engage.depense + ctx.engage.reserve + demande <= ctx.plafondCentimes) &&
    (indicatif || !(a.lignes[0] && a.lignes[0].total.centimes > ctx.budget.restant.centimes)) &&
    !(await manquesPour(a.lignes)).manques.length
  );
}

/** Mode indicatif pour CETTE écriture : l'origine figée à son lancement (jamais l'Usine) et le réglage `budget.mode`. */
async function indicatifDeLEcriture(generationId: Id): Promise<boolean> {
  const o = await lireParametre<{ origine?: OrigineLancement } | null>(`generateur.chaine-options.${generationId}`, null);
  return budgetIndicatifPour(o?.origine);
}

const paramRepriseDeWill = (generationId: Id) => `generateur.repriseDeWill.${generationId}`;
/** Will a touché « Reprendre » (et confirmé le prix) : les tours suivants de cette écriture n'exigent plus le seuil de confirmation (indicatif). */
export async function marquerRepriseDeWill(generationId: Id): Promise<void> {
  await ecrireParametre(paramRepriseDeWill(generationId), true);
}
/** Le drapeau ne vaut que pour UN tour : effacé à la fin du tour (`deroulerGeneration`). */
export async function effacerRepriseDeWill(generationId: Id): Promise<void> {
  if (await repriseDeWill(generationId)) await ecrireParametre(paramRepriseDeWill(generationId), null);
}
async function repriseDeWill(generationId: Id): Promise<boolean> {
  return lireParametre<boolean>(paramRepriseDeWill(generationId), false);
}

/**
 * Correctif après relecture (15/10) : l'écriture en attente de crédit peut-elle repartir MAINTENANT (empêchement levé) ?
 * Lu par l'écran et par le geste « Reprendre » AVANT de montrer ou de faire confirmer un prix (jamais un prix puis un refus).
 */
export async function ecritureDebloquee(generationId: Id): Promise<boolean> {
  const a = await lireParametre<Attente | null>(paramAttente(generationId), null);
  return !!a && (await empechementLeve(a, await contexteEmpechement(), await indicatifDeLEcriture(generationId)));
}

/** L'écriture POURRAIT reprendre : elle attend le geste de Will. Une notification, pas plus. */
async function marquerPrete(g: GenerationScript, a: Attente): Promise<void> {
  await ecrireParametre(paramAttente(g.id), { ...a, prete: maintenant() } satisfies Attente);
  const m = await depots().scriptsMaitres.obtenir(g.scriptMaitreId);
  const titre = m?.angle?.titre ?? m?.brief.idee ?? "un sujet";
  await creerNotification({
    type: "credit",
    titre: "Une écriture peut reprendre",
    message: `« ${titre} » : touchez « Reprendre » (au plus ${formaterUsd(Math.max(0, g.plafondUsd - depenseGenerationUsd(g)))} $, le prix exact est sur le bouton). Elle ne repart pas seule.`,
    lien: `/ecrire/sujets/${g.scriptMaitreId}`,
    estDemo: g.estDemo,
  });
  await journaliser("generateur", "Écriture prête à reprendre : elle attend le geste de Will.", { type: "sujet", id: g.scriptMaitreId });
}

/** Geste de Will (« Reprendre ») : relance les écritures en attente de crédit dont l'empêchement a disparu (de ce sujet). */
export async function relancerEcrituresEnAttente(scriptMaitreId?: Id): Promise<Id[]> {
  await exigerSession();
  return reprendreGenerationsEnAttenteCredit({ gesteDeWill: true, scriptMaitreId });
}

/** « J'ai rechargé Claude » : la recharge est déclarée ; les écritures en attente deviennent « prêtes », rien ne repart. */
export async function declarerRechargeClaude(centimesUsd: number, note?: string): Promise<Id[]> {
  await declarerRecharge("anthropic", centimesUsd, note);
  return reprendreGenerationsEnAttenteCredit();
}

/* ------------------------------------------------------------------ */
/* Pire cas de la chaîne, réservé avant le premier appel               */
/* ------------------------------------------------------------------ */

const paramReserveChaine = (generationId: Id) => `generateur.reserveChaine.${generationId}`;

/**
 * Correctif après relecture (15/10) : plafonds d'UN SUJET lus d'un réglage en base (plus en dur), selon la chaîne qui
 * écrit. La chaîne courte (3 appels) sera la chaîne de production (PR suivante) ; la grande ne servira plus qu'au mode
 * « je choisis mes accroches ». Défauts : 1,50 $ chacun (la décision de les changer revient à Will).
 */
export const PARAM_PLAFOND_SUJET = "generateur.plafondSujetUsd";
export const PARAM_PLAFOND_GRANDE_CHAINE = "generateur.plafondGrandeChaineUsd";
export const PLAFOND_PAR_DEFAUT_USD = 1.5;

/** Réglage en base de la chaîne de production : « courte » (`chaine-courte.ts`, 3 appels), « equipe » (`chaine-equipe.ts`, livrée éteinte) ou « complete » (`chaine.ts`). */
export const PARAM_CHAINE = "generateur.chaine";

/**
 * Chaîne qui écrira une NOUVELLE écriture. Décision de Will, 15/10 : la production passe sur la chaîne COURTE ; 23/10 :
 * « on garde l'Économique », les chaînes « équipe » (Premium) et grande sont VERROUILLÉES. Quel que soit le réglage
 * `generateur.chaine` (« courte », « equipe », « complete », absent ou inconnu) et le mode « je choisis » : la COURTE
 * (≈ 0,28 $ par script). Le code des chaînes équipe et grande reste en place (réversible) : une écriture DÉJÀ lancée finit
 * sur la chaîne figée dans ses options (`OptionsGeneration.chaine`) ; le pire cas, la réserve et le plafond la suivent.
 */
export async function chaineDeLEcriture(_modeChoix?: ScriptMaitre["brief"]["modeChoix"]): Promise<ChaineEcriture> {
  void _modeChoix;
  // Garde de production : le crochet d'essai est ignoré hors essais (comme `credits.ts`).
  return (process.env.NODE_ENV !== "production" ? chaineForceePourEssai : null) ?? "courte";
}

let chaineForceePourEssai: ChaineEcriture | null = null;
/**
 * ESSAIS SEULEMENT : fait écrire les nouvelles écritures par la chaîne « equipe » ou la grande (leur code reste, mais plus
 * aucun réglage ne les choisit). Sert aux tests qui éprouvent leurs garde-fous (réserve, plafond, reprise).
 * `null` : retour normal (la courte).
 */
export function forcerChainePourEssai(chaine: ChaineEcriture | null): void {
  chaineForceePourEssai = chaine;
}

export const reglagePlafond = (chaine: ChaineEcriture) => (chaine === "grande" ? PARAM_PLAFOND_GRANDE_CHAINE : PARAM_PLAFOND_SUJET);

/** Plafond d'un sujet écrit par cette chaîne (dollars), lu du réglage ; une valeur illisible vaut le défaut. */
export async function plafondChaineUsd(chaine: ChaineEcriture): Promise<number> {
  const v = await lireParametre<number>(reglagePlafond(chaine), PLAFOND_PAR_DEFAUT_USD);
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : PLAFOND_PAR_DEFAUT_USD;
}

/** Pire cas de toute la chaîne restante, réservé avant son premier appel (dollars, dépense déjà faite comprise). */
export interface ReserveChaine {
  /** Dépensé avant + pire cas de toutes les étapes restantes. */
  pireCasUsd: number;
  depenseUsd: number;
  plafondUsd: number;
  accepte: boolean;
  /** Étape d'où la chaîne repart au moment du calcul. */
  etape?: number;
  chaine?: ChaineEcriture;
  /** Réglage à relever pour qu'elle passe : celui de la chaîne (sujet) ou du supplément (relecture A09). */
  reglage?: string;
  /** ANCIENNE réserve (avant le 25/10) : arrêt de sécurité (indicatif), toujours lue pour les écritures déjà arrêtées ; plus écrite. Le pire cas dépasse 5 × le plafond ; l'écran ne propose pas de relever le réglage. */
  securite?: boolean;
  le: string;
}

export async function lireReserveChaine(generationId: Id): Promise<ReserveChaine | null> {
  return lireParametre<ReserveChaine | null>(paramReserveChaine(generationId), null);
}

/**
 * Correctif après relecture (15/10) : écriture DÉJÀ EN ROUTE au moment de la mise en ligne (une étape payée, aucune
 * réserve) : elle n'est JAMAIS arrêtée au milieu par la réserve ; elle continue avec le contrôle appel par appel du
 * plafond du sujet, comme avant.
 */
export async function ecritureSansReserve(g: Pick<GenerationScript, "id" | "etapes">): Promise<boolean> {
  return g.etapes.some((e) => e.modeleDemande !== "simulation") && !(await lireReserveChaine(g.id));
}

/** Phrase d'un pire cas au-dessus du plafond, avec le chiffre et le réglage à changer. */
export async function phrasePireCasTropHaut(r: Pick<ReserveChaine, "pireCasUsd" | "plafondUsd" | "reglage">, suite = "rien n'est parti"): Promise<string> {
  const eur = usdVersEur(centimesUsd(r.pireCasUsd), await taux());
  const reglage = r.reglage ? ` Pour l'écrire, relevez le réglage « ${r.reglage} » à ${formaterUsd(Math.ceil(r.pireCasUsd * 100) / 100)} $ au moins.` : "";
  return `Cette écriture peut coûter jusqu'à ${formaterUsd(r.pireCasUsd)} $ (${formaterMontant(eur)}), plus que le plafond de ${formaterUsd(r.plafondUsd)} $ par sujet : ${suite}.${reglage}`;
}

/** Phrase d'une écriture refusée avant tout appel : son pire cas dépasse le plafond du sujet. */
export async function phraseReserveRefusee(generationId: Id): Promise<string | null> {
  const r = await lireReserveChaine(generationId);
  if (!r || r.accepte) return null;
  if (!r.securite) return phrasePireCasTropHaut(r);
  const g = await depots().generations.obtenir(generationId);
  return phraseArretSecuriteEcriture(g ? plafondAnnonceUsd(g) : r.plafondUsd);
}

/**
 * GARDE-FOUS BUDGET (15/10, corrigé après relecture) : avant le premier appel de CHAQUE tour d'une écriture (lancement,
 * reprise après une réponse coupée ou une panne, retour à l'étape 3, manque complété), le pire cas complet est
 * RECALCULÉ : dépensé (étapes rejouées comprises) + toutes les étapes restantes au pire prudent (`pireCasChaine`). Au-dessus
 * du plafond de l'écriture : rien ne part, statut « plafond-atteint », message avec le chiffre et le réglage. Une écriture
 * d'essai, ou déjà en route sans réserve (`ecritureSansReserve`), n'est pas concernée (contrôle appel par appel).
 */
export async function reserverPireCasChaine(generationId: Id, o: { pireCasRestantUsd: number; etape?: number; chaine?: ChaineEcriture; reglage?: string; indicatif?: boolean }): Promise<{ ok: true } | { ok: false; message: string }> {
  const d = depots();
  const g = await d.generations.obtenir(generationId);
  if (!g) return { ok: false, message: "Cette écriture n'existe plus." };
  const depenseUsd = depenseGenerationUsd(g);
  const pireCasUsd = depenseUsd + o.pireCasRestantUsd;
  // L3-01 (audit) : contrôle en centimes de dollar entiers (plus de tolérance 1e-9), dépenses au centime supérieur.
  const accepte = depenseGenerationCentimesUsd(g) + centimesAuSuperieur(o.pireCasRestantUsd * 100) <= centimesDuPlafond(g.plafondUsd);
  // Mode indicatif (commande de Will) : un pire cas au-dessus du plafond PRÉVIENT, l'écriture part ; aucun arrêt de sécurité (le prix ne bloque jamais).
  const passeEnIndicatif = !!o.indicatif && !accepte;
  // Le réglage à relever : celui donné (un supplément a le sien, relecture A09), sinon celui de la chaîne d'un sujet.
  const reglage = o.reglage ?? (g.portee === "sujet" && o.chaine ? reglagePlafond(o.chaine) : undefined);
  await ecrireParametre(paramReserveChaine(g.id), { pireCasUsd, depenseUsd, plafondUsd: g.plafondUsd, accepte: accepte || passeEnIndicatif, etape: o.etape ?? 0, chaine: o.chaine, reglage, le: maintenant() } satisfies ReserveChaine);
  if (passeEnIndicatif) {
    await journaliser("generateur", `Pire cas de l'écriture ${formaterUsd(pireCasUsd)} $ au-dessus du plafond du sujet (${formaterUsd(g.plafondUsd)} $) : l'écriture continue (budget indicatif).`, { type: "sujet", id: g.scriptMaitreId });
    await signalerDepassementIndicatif("plafond-sujet", "Plafond du sujet dépassé (l'écriture continue)", `Cette écriture peut coûter jusqu'à ${formaterUsd(pireCasUsd)} $, plus que le repère de ${formaterUsd(g.plafondUsd)} $ par sujet ; rien n'est arrêté.`);
    return { ok: true };
  }
  if (accepte) {
    await journaliser("generateur", `Pire cas de l'écriture réservé : ${formaterUsd(pireCasUsd)} $ (plafond ${formaterUsd(g.plafondUsd)} $).`, { type: "sujet", id: g.scriptMaitreId });
    return { ok: true };
  }
  const message = (await phraseReserveRefusee(g.id))!;
  await d.generations.modifier(g.id, { statut: "plafond-atteint" });
  await journaliser("generateur", message, { type: "sujet", id: g.scriptMaitreId });
  const m = await d.scriptsMaitres.obtenir(g.scriptMaitreId);
  await creerNotification({ type: "credit", titre: g.etapes.length ? "Écriture en attente de votre accord" : "Écriture non lancée", message: `« ${m?.angle?.titre ?? m?.brief.idee ?? "Sujet"} » : ${message}`, lien: `/ecrire/sujets/${g.scriptMaitreId}`, estDemo: g.estDemo });
  return { ok: false, message };
}

/** Réglages : limite mensuelle Claude (dollars). L'enregistrer rend « prêtes » les écritures qu'elle bloquait ; rien ne repart seul. */
export async function definirPlafondMensuelClaude(usd: number): Promise<Id[]> {
  await exigerSession();
  if (!Number.isFinite(usd) || usd < 0 || usd > 10_000) throw new ErreurStudio("MONTANT_INVALIDE", "Indiquez une limite entre 0 et 10 000 $.");
  await ecrireParametre(PARAM_PLAFOND_MENSUEL, Math.round(usd * 100) / 100);
  await journaliser("generateur", `Limite Claude du mois : ${formaterUsd(usd)} $`);
  return reprendreGenerationsEnAttenteCredit();
}

/** Réglages > Qualité : état de Claude pour l'écran (aucune clé, seulement des montants et un message). */
export async function etatClaude(): Promise<{ plafondUsd: number; depenseMoisUsd: number; reserveUsd: number; modeleBloque: string | null; enAttente: number }> {
  const engage = await engageClaudeDuMoisCentimes();
  const bloque = await lireParametre<{ message: string } | null>(PARAM_MODELE_BLOQUE, null);
  return {
    plafondUsd: await plafondMensuelClaudeUsd(),
    depenseMoisUsd: engage.depense / 100,
    reserveUsd: engage.reserve / 100,
    modeleBloque: bloque?.message ?? null,
    enAttente: (await depots().generations.lister((g) => g.statut === "en-attente-credit")).length,
  };
}

/** Lot G4 : Claude est-il branché (choisi ET clé présente) ? Sinon l'écriture est un essai, rien n'est payé. */
export async function claudeBranche(): Promise<boolean> {
  return !!(await claudeActif());
}
