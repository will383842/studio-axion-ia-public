/**
 * AUTONOMIE DE L'USINE SOUS PLAFOND MENSUEL (AUT-A ; plan USINE-AUTONOMIE-SOUS-PLAFOND, § 2 et 3).
 * Décision du fondateur (14/11) : l'Usine dépense sans confirmation sous UN plafond mensuel que le fondateur règle lui-même.
 *  - Réglage `usine.autonomie` = { actif, plafondCents, le, version } : ÉTEINT par défaut ; absent, 0 ou illisible = mode
 *    confirmation actuel (échec fermé, jamais « sans limite »). Aucun défaut chiffré dans le code.
 *  - Décision du 15/11 : le plafond se règle DANS l'Usine. Il arrive par la porte (appel 5, `reglerBudgetUsine`) et n'est écrit que
 *    par `recevoirAutonomieUsine`, dans la clé `usine.autonomie.porte`. Dès que cette clé existe (même illisible), elle est la seule
 *    source lue (bascule à sens unique) ; l'ancienne clé `usine.autonomie` n'est alors plus lue, mais jamais effacée ni réécrite.
 *    `reglerAutonomieUsine` (session du fondateur) reste en place, inchangé, jusqu'à son retrait (S6).
 *  - Registre des accords (`usine.autonomie.index.<mois>`, `usine.autonomie.accord.<cle>`) écrit UNIQUEMENT sous le verrou
 *    des crédits (`inscrireAccordUsine` refuse `VERROU_REQUIS` sinon). Le statut n'est pas écrit : il se lit dans
 *    l'engagement existant `budget.engage.<cle>` : aucune clôture n'écrit le registre.
 *  - En cas de doute, on compte le plus haut. Mois = mois de Paris.
 * Ce lot ne branche RIEN dans la garde des crédits : aucun comportement réel ne change tant que le lot C n'appelle pas ce module.
 * Données en mémoire ou en base du studio, aucun appel réseau.
 */
import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { centimes, formaterMontant } from "@/lib/montants";
import { depots, ecrireParametre, ErreurStudio, journaliser, lireParametre, maintenant } from "./_commun";
import { exigerSession } from "./auth";
import { depenseComptee, jourParis, montantPaye, moisParis } from "./couts";
import { budgetIndicatifPour, origineDeLaVideo } from "./mode-budget";
import { creerNotification } from "./notifications";

/* --- Réglage ----------------------------------------------------------- */

const CLE_REGLAGE = "usine.autonomie";
/** Dernier plafond reçu de l'Usine par la porte. Écrit par `recevoirAutonomieUsine` seulement. Sa présence fait basculer la lecture. */
const CLE_PORTE = "usine.autonomie.porte";
/** Même borne que `definirBudgetAction` : 100 000 € en centimes. */
const PLAFOND_MAX_CENTIMES = 10_000_000;
/** Même délai que `ORPHELIN_MS` (couts.ts) : un lancement sans engagement ne compte plus après 15 min, sauf ce qui est payé. */
const LANCEMENT_EN_VOL_MS = 15 * 60_000;

export type AutonomieUsine =
  | { etat: "active"; plafondCents: number }
  | { etat: "confirmation"; raison: "eteint" | "absent" | "zero" | "illisible" };

interface ReglageAutonomie {
  actif: boolean;
  plafondCents: number;
  le: string;
  version: 1;
}

const plafondValide = (p: unknown): p is number => typeof p === "number" && Number.isSafeInteger(p) && p >= 0 && p <= PLAFOND_MAX_CENTIMES;

/** Interprète une valeur brute de réglage. Toute forme imprévue (texte, flottant, négatif, `actif` non booléen) = mode confirmation. */
function interpreter(brut: unknown): AutonomieUsine {
  if (brut === null || brut === undefined) return { etat: "confirmation", raison: "absent" };
  if (typeof brut !== "object" || Array.isArray(brut)) return { etat: "confirmation", raison: "illisible" };
  const r = brut as Record<string, unknown>;
  if (typeof r.actif !== "boolean" || !plafondValide(r.plafondCents)) return { etat: "confirmation", raison: "illisible" };
  if (!r.actif) return { etat: "confirmation", raison: "eteint" };
  if (r.plafondCents === 0) return { etat: "confirmation", raison: "zero" };
  return { etat: "active", plafondCents: r.plafondCents };
}

/**
 * Lecture du réglage. Si `usine.autonomie.porte` existe (même illisible), c'est la SEULE source : illisible = mode confirmation,
 * jamais un retour à l'ancienne clé. Sinon, l'ancienne clé `usine.autonomie`, lue exactement comme avant.
 */
export async function lireAutonomieUsine(): Promise<AutonomieUsine> {
  let recu: unknown;
  try {
    recu = await lireParametre<unknown>(CLE_PORTE, null);
  } catch {
    return { etat: "confirmation", raison: "illisible" };
  }
  if (recu !== null && recu !== undefined) return interpreter(recu);
  let brut: unknown;
  try {
    brut = await lireParametre<unknown>(CLE_REGLAGE, null);
  } catch {
    return { etat: "confirmation", raison: "illisible" };
  }
  return interpreter(brut);
}

/** Qui règle l'autonomie : l'Usine (clé porte présente), le Studio (ancienne clé seule) ou personne (aucune clé). */
export interface ReglageEnVigueur {
  pilote: "usine" | "studio" | "aucun";
  actif: boolean;
  plafondCents: number;
}

/** Valeur lisible d'une clé : `actif` comme `interpreter` (allumé SEULEMENT si plafond > 0), plafond rendu aussi quand c'est éteint. */
function valeurLisible(brut: unknown): { actif: boolean; plafondCents: number } {
  const plafond = brut !== null && typeof brut === "object" && !Array.isArray(brut) ? (brut as Record<string, unknown>).plafondCents : undefined;
  return { actif: interpreter(brut).etat === "active", plafondCents: plafondValide(plafond) ? plafond : 0 };
}

/**
 * LECTURE SEULE (porte de lecture et écran). Même source que `lireAutonomieUsine` : la clé porte, si elle existe, est seule lue ;
 * sinon l'ancienne clé ; sinon `aucun`. Une lecture qui lève : éteint, plafond 0 (échec fermé).
 */
export async function lireReglageEnVigueur(): Promise<ReglageEnVigueur> {
  let recu: unknown;
  try {
    recu = await lireParametre<unknown>(CLE_PORTE, null);
  } catch {
    return { pilote: "usine", actif: false, plafondCents: 0 };
  }
  if (recu !== null && recu !== undefined) return { pilote: "usine", ...valeurLisible(recu) };
  let brut: unknown;
  try {
    brut = await lireParametre<unknown>(CLE_REGLAGE, null);
  } catch {
    return { pilote: "aucun", actif: false, plafondCents: 0 };
  }
  if (brut === null || brut === undefined) return { pilote: "aucun", actif: false, plafondCents: 0 };
  return { pilote: "studio", ...valeurLisible(brut) };
}

/**
 * PUR. Contrôle la paire reçue par la porte (`automatique`, `plafond_automatique_cents`) : les deux ensemble ou aucun ; booléen ;
 * centimes entiers 0..10 000 000 ; allumer avec 0 refusé. ÉTEINDRE n'est jamais refusé pour un montant valide (0 permis).
 * Rend `null` si la paire est absente, le champ fautif sinon. Aucun lien avec le plafond global du Studio.
 */
export function controlerPaireAutonomie(automatique: unknown, plafondCents: unknown): { champ: string; message: string } | null | { actif: boolean; plafondCents: number } {
  if (automatique === undefined && plafondCents === undefined) return null;
  if (automatique === undefined) return { champ: "automatique", message: "Les champs automatique et plafond_automatique_cents vont toujours ensemble." };
  if (plafondCents === undefined) return { champ: "plafond_automatique_cents", message: "Les champs automatique et plafond_automatique_cents vont toujours ensemble." };
  if (typeof automatique !== "boolean") return { champ: "automatique", message: "L'interrupteur doit être vrai ou faux." };
  if (!plafondValide(plafondCents)) return { champ: "plafond_automatique_cents", message: "Le plafond doit être un nombre entier de centimes, entre 0 et 10 000 000." };
  if (automatique && plafondCents <= 0) return { champ: "plafond_automatique_cents", message: "Pour allumer, le plafond doit être supérieur à 0." };
  return { actif: automatique, plafondCents };
}

/**
 * SEUL point d'écriture de `usine.autonomie.porte`, appelé SEULEMENT par `reglerBudgetUsine`, derrière `garderPorte` : aucune
 * session ici. Revalide la paire (rien n'est écrit si elle est refusée). Rejeu identique : rien n'est écrit, ni journalisé, ni sonné
 * (`deja: true`). Sinon : cloche de type `budget` SANS montant et SANS `{ cloche: true }` (elle part sur le téléphone : c'est la
 * parade au secret de porte volé), ligne de journal (montant permis), puis écriture. La trace précède l'écriture : un changement sans
 * trace est pire qu'une trace sans changement (un rejeu après panne écrit alors le changement et sonne de nouveau).
 * Ne touche JAMAIS `usine.autonomie`, le registre, les engagements, les dépenses ni le journal existant. `version` est celle du
 * FORMAT de la clé, pas un ordre d'envoi.
 */
export async function recevoirAutonomieUsine(demande: { actif: boolean; plafondCents: number }): Promise<{ deja: boolean }> {
  const controle = controlerPaireAutonomie(demande.actif, demande.plafondCents);
  if (controle === null || "champ" in controle) throw new ErreurStudio("CHAMP_INVALIDE", controle === null ? "Le plafond reçu est incomplet." : controle.message);
  const { actif, plafondCents } = controle;
  const actuel = await lireParametre<unknown>(CLE_PORTE, null);
  const a = actuel as Partial<ReglageAutonomie> | null;
  if (a && typeof a === "object" && a.actif === actif && a.plafondCents === plafondCents) return { deja: true };
  const avant = await lireAutonomieUsine();
  const message = !actif
    ? "L'Usine ne dépense plus seule : la confirmation reste demandée. Le plafond se règle dans l'Usine."
    : avant.etat === "active"
      ? "Le plafond du mois a changé. Le plafond se règle dans l'Usine."
      : "L'Usine peut maintenant dépenser seule sous son plafond du mois. Le plafond se règle dans l'Usine.";
  await creerNotification({ type: "budget", titre: "L'Usine a changé son plafond du mois", message, lien: "/" });
  await journaliser("budget", actif ? `Usine en automatique : plafond reçu de l'Usine, allumée, plafond ${formaterMontant(centimes(plafondCents))} par mois` : "Usine en automatique : plafond reçu de l'Usine, éteinte (retour au mode confirmation)");
  const valeur: ReglageAutonomie = { actif, plafondCents, le: maintenant(), version: 1 };
  await ecrireParametre(CLE_PORTE, valeur);
  return { deja: false };
}

/**
 * SEUL point d'écriture du réglage. Le fondateur connecté uniquement. Allumer exige un plafond > 0 (sinon `CHAMP_INVALIDE`,
 * rien n'est écrit). Un rejeu identique n'écrit rien. Journalisé à chaque changement.
 */
export async function reglerAutonomieUsine(demande: { actif: boolean; plafondCents: number }): Promise<void> {
  await exigerSession();
  const { actif, plafondCents } = demande;
  if (typeof actif !== "boolean") throw new ErreurStudio("CHAMP_INVALIDE", "L'interrupteur doit être allumé ou éteint.");
  if (!plafondValide(plafondCents)) throw new ErreurStudio("CHAMP_INVALIDE", "Le plafond du mois doit être un montant entier de centimes, entre 0 et 100 000 €.");
  if (actif && plafondCents <= 0) throw new ErreurStudio("CHAMP_INVALIDE", "Pour allumer l'Usine en automatique, indiquez un plafond du mois supérieur à 0 €.");
  const actuel = await lireParametre<unknown>(CLE_REGLAGE, null);
  const a = actuel as Partial<ReglageAutonomie> | null;
  if (a && typeof a === "object" && a.actif === actif && a.plafondCents === plafondCents) return;
  const valeur: ReglageAutonomie = { actif, plafondCents, le: maintenant(), version: 1 };
  await ecrireParametre(CLE_REGLAGE, valeur);
  await journaliser("budget", actif ? `Usine en automatique : allumée, plafond ${formaterMontant(centimes(plafondCents))} par mois` : "Usine en automatique : éteinte (retour au mode confirmation)");
}

/**
 * Bouton d'urgence « Éteindre » du Studio : le fondateur connecté éteint l'autonomie quand c'est l'Usine qui la règle (clé porte).
 * ÉTEINDRE SEULEMENT : cette fonction n'écrit jamais l'état allumé. Sans clé porte, rien n'est écrit (`eteinte: false`). Déjà éteinte :
 * rien n'est écrit, ni journalisé, ni sonné. Le plafond est gardé. Cloche sans montant, puis ligne de journal, puis écriture
 * (la trace précède l'écriture). Ne touche jamais à `usine.autonomie`, au registre ni aux dépenses.
 */
export async function eteindreDepuisStudio(): Promise<{ eteinte: boolean; deja: boolean }> {
  await exigerSession();
  const actuel = await lireParametre<unknown>(CLE_PORTE, null);
  if (actuel === null || actuel === undefined) return { eteinte: false, deja: false };
  const { plafondCents } = valeurLisible(actuel);
  const a = actuel as Partial<ReglageAutonomie> | null;
  if (a && typeof a === "object" && a.actif === false && a.plafondCents === plafondCents) return { eteinte: true, deja: true };
  await creerNotification({ type: "budget", titre: "L'Usine ne dépense plus seule", message: "Vous avez éteint l'autonomie de l'Usine depuis le Studio. La confirmation reste demandée.", lien: "/" });
  await journaliser("budget", "Usine en automatique : éteinte depuis le Studio (bouton Éteindre), retour au mode confirmation");
  const valeur: ReglageAutonomie = { actif: false, plafondCents, le: maintenant(), version: 1 };
  await ecrireParametre(CLE_PORTE, valeur);
  return { eteinte: true, deja: false };
}

/* --- Origine ----------------------------------------------------------- */

/**
 * `undefined` → « studio » (contrat historique : sans origine, la commande du fondateur) ; « studio » → « studio » ;
 * TOUTE autre valeur (« usine », null, « », « Usine », objet, nombre) → « usine » (échec fermé).
 */
export function normaliserOrigine(v: unknown): "studio" | "usine" {
  if (v === undefined || v === "studio") return "studio";
  return "usine";
}

/* --- Verrou des crédits (marqueur) ------------------------------------- */

const marqueurVerrou = new AsyncLocalStorage<true>();
/**
 * Marqueur « on est sous le verrou des crédits ». ATTENTION : ce marqueur seul ne protège RIEN (deux appels simultanés
 * sous le seul marqueur passent tous les deux et l'index du mois perd une clé). Il n'est valable que posé par
 * `sousVerrouCredits` (credits.ts : file du processus + verrou consultatif Postgres), seul appelant autorisé (test de
 * structure). Lot C : AsyncLocalStorage est HÉRITÉ par toute tâche détachée lancée dans la section ; aucune tâche lancée
 * sans attente (« fire and forget ») dans `sousVerrouCredits` ne doit inscrire un accord, elle verrait le marqueur après la fin du verrou.
 */
export function dansVerrouCredits<T>(f: () => Promise<T>): Promise<T> {
  return marqueurVerrou.run(true, f);
}
export function estDansVerrouCredits(): boolean {
  return marqueurVerrou.getStore() === true;
}

/* --- Registre ---------------------------------------------------------- */

interface AccordUsine {
  cle: string;
  mois: string;
  centimes: number;
  quoi: string;
  videoId?: string;
  le: string;
  n: number;
}
interface EngagementLu {
  centimes: number;
  le: string;
  statut: "active" | "liberee" | "consommee";
}
const cleIndex = (mois: string) => `usine.autonomie.index.${mois}`;
const cleAccord = (cle: string) => `usine.autonomie.accord.${cle}`;
const cleEngagement = (cle: string) => `budget.engage.${cle}`;

async function lireAccord(cle: string): Promise<AccordUsine | null> {
  const a = await lireParametre<AccordUsine | null>(cleAccord(cle), null);
  return a && typeof a === "object" && Number.isFinite(a.centimes) && typeof a.mois === "string" ? a : null;
}
async function lireEngagement(cle: string): Promise<EngagementLu | null> {
  const e = await lireParametre<EngagementLu | null>(cleEngagement(cle), null);
  return e && typeof e === "object" && Number.isFinite(e.centimes) && (e.statut === "active" || e.statut === "liberee" || e.statut === "consommee") ? e : null;
}
/** Dépenses comptées rattachées à la clé (travail, ou appel Claude : `appelId`, AUT-E) : somme réellement payée (simulé retiré) et nombre de dépenses. */
async function payeDeLaCle(cle: string): Promise<{ paye: number; nb: number }> {
  const deps = await depots().depenses.lister((d) => (d.travailId === cle || d.appelId === cle) && depenseComptee(d));
  return { paye: deps.reduce((s, d) => s + montantPaye(d).centimes, 0), nb: deps.length };
}

/** Ce qu'une clé occupe du plafond (tableau § 2.3 du plan). En cas de doute, le plus haut. */
export async function usageDeLaCle(cle: string): Promise<number> {
  const accord = await lireAccord(cle);
  if (!accord) return 0;
  const e = await lireEngagement(cle);
  // AUT-G : une clé de dépense `travailId#appel` n'a pas d'engagement propre : elle vit tant que l'engagement de son travail est actif.
  if (!e && cle.includes("#") && !cle.startsWith("lot:")) {
    const parent = await lireEngagement(cle.slice(0, cle.indexOf("#")));
    if (parent && parent.statut === "active") return Math.max(accord.centimes, (await payeDeLaCle(cle)).paye);
  }
  const lot = cle.startsWith("lot:");
  if (lot && e && e.statut !== "active") return 0;
  if (lot && e) return Math.max(0, e.centimes);
  const { paye, nb } = await payeDeLaCle(cle);
  if (!e) {
    // Engagement jamais écrit : lancement en vol (moins de 15 min) = montant accordé ; sinon ce qui est payé.
    const enVol = Date.now() - new Date(accord.le).getTime() < LANCEMENT_EN_VOL_MS;
    return enVol ? Math.max(accord.centimes, paye) : paye;
  }
  if (e.statut === "active") return Math.max(accord.centimes, paye);
  if (e.statut === "consommee") return nb > 0 ? paye : accord.centimes;
  return paye; // libérée
}

/** Total « utilisé Usine » du mois (mois de Paris AAAA-MM) : somme des usages des clés accordées CE mois. */
export async function usageDuMoisUsine(mois: string): Promise<number> {
  const index = await lireParametre<string[]>(cleIndex(mois), []);
  let total = 0;
  for (const cle of new Set(Array.isArray(index) ? index : [])) {
    const accord = await lireAccord(cle);
    if (!accord || accord.mois !== mois) continue; // ré-accordée un autre mois : ne compte que là-bas
    total += await usageDeLaCle(cle);
  }
  return total;
}

/* --- Jugement et réservation atomique ---------------------------------- */

export interface JugementUsine {
  ok: boolean;
  /** Besoin effectif de la clé (une reprise recompte le payé + le reste) : ce qui est inscrit au registre. */
  effectif: number;
  utilise: number;
  apres: number;
  plafond: number;
  mois: string;
}

/**
 * LECTURE SEULE. `apres` = utilisé du mois HORS cette clé + besoin effectif. Une reprise recompte ce qui est déjà payé + le
 * reste. Égalité au plafond ACCEPTÉE. Autonomie non active ou besoin illisible : refus (échec fermé).
 */
export async function jugerSousPlafondUsine(demande: { cle?: string; besoin: number; ajouter?: boolean }): Promise<JugementUsine> {
  const mois = moisParis(maintenant());
  const reglage = await lireAutonomieUsine();
  const plafond = reglage.etat === "active" ? reglage.plafondCents : 0;
  const utilise = await usageDuMoisUsine(mois);
  const { cle, besoin, ajouter } = demande;
  if (reglage.etat !== "active" || typeof besoin !== "number" || !Number.isFinite(besoin) || besoin < 0) return { ok: false, effectif: 0, utilise, apres: utilise, plafond, mois };
  const pire = Math.ceil(besoin);
  let utiliseHors = utilise;
  let effectif = pire;
  if (cle) {
    const accord = await lireAccord(cle);
    if (accord) {
      if (accord.mois === mois) utiliseHors = utilise - (await usageDeLaCle(cle));
      const e = await lireEngagement(cle);
      const { paye } = await payeDeLaCle(cle);
      // AUT-G : `ajouter` = une dépense de plus sur une clé déjà accordée : elle s'ajoute à ce que la clé occupe déjà.
      effectif = ajouter ? (await usageDeLaCle(cle)) + pire : Math.max(pire, e && e.statut === "active" ? e.centimes : 0) + paye;
    }
  }
  const apres = utiliseHors + effectif;
  return { ok: apres <= plafond, effectif, utilise, apres, plafond, mois };
}

/**
 * Inscrit l'accord de l'Usine. REFUSE `VERROU_REQUIS` hors `dansVerrouCredits`. Rejuge puis écrit dans la même section
 * critique (c'est la réservation atomique) ; refus : `USINE_PLAFOND_ATTEINT`, rien n'est écrit.
 */
export async function inscrireAccordUsine(demande: { cle: string; besoin: number; quoi: string; videoId?: string; ajouter?: boolean }): Promise<JugementUsine> {
  if (!estDansVerrouCredits()) throw new ErreurStudio("VERROU_REQUIS", "L'accord de l'Usine ne s'inscrit que sous le verrou des crédits.");
  const { cle, besoin, quoi, videoId, ajouter } = demande;
  const entite = videoId ? { type: "video", id: videoId } : { type: "travail", id: cle };
  const j = await jugerSousPlafondUsine({ cle, besoin, ...(ajouter ? { ajouter: true } : {}) });
  const reglage = await lireAutonomieUsine();
  if (reglage.etat !== "active") throw new ErreurStudio("AUTONOMIE_ETEINTE", "L'Usine n'est pas en automatique : la confirmation reste demandée.");
  if (!j.ok) {
    await journaliser("budget", `Refus de l'Usine (plafond du mois) : ${quoi} — utilisé ${euros(j.utilise)} sur ${euros(j.plafond)} ce mois, demandé ${euros(Math.ceil(besoin))}.`, entite);
    await alerterPlafondUsine({ refus: true, apres: j.apres, plafond: j.plafond, mois: j.mois });
    throw new ErreurStudio("USINE_PLAFOND_ATTEINT", "Plafond du mois de l'Usine atteint : cette commande le dépasserait, rien n'est parti. Le plafond se règle dans l'Usine.");
  }
  const precedent = await lireAccord(cle);
  const accord: AccordUsine = { cle, mois: j.mois, centimes: j.effectif, quoi, ...(videoId ? { videoId } : {}), le: maintenant(), n: (precedent?.n ?? 0) + 1 };
  await ecrireParametre(cleAccord(cle), accord);
  const index = await lireParametre<string[]>(cleIndex(j.mois), []);
  if (!index.includes(cle)) await ecrireParametre(cleIndex(j.mois), [...index, cle]);
  await journaliser("budget", `Accord automatique de l'Usine (sous plafond) : ${quoi} — ${euros(Math.ceil(besoin))} ; utilisé ${euros(j.apres)} sur ${euros(j.plafond)} ce mois, reste ${euros(j.plafond - j.apres)}.`, entite);
  await alerterPlafondUsine({ refus: false, apres: j.apres, plafond: j.plafond, mois: j.mois });
  return j;
}

const euros = (c: number) => formaterMontant(centimes(c));

/* --- Alertes (cloche) -------------------------------------------------- */

/**
 * Cloche à 80 % du plafond (une fois par mois ; marque posée APRÈS l'envoi réussi) et au plafond (au premier refus du jour).
 * AUCUN montant dans le texte (règle de fer : aucun prix affiché). Une panne d'alerte ne change jamais la décision.
 */
export async function alerterPlafondUsine(o: { refus: boolean; apres: number; plafond: number; mois: string }): Promise<void> {
  try {
    if (o.refus) {
      const cle = `budget.refus.${jourParis()}.usine-plafond`;
      if (await lireParametre<boolean>(cle, false)) return;
      await creerNotification({ type: "budget", titre: "Usine arrêtée : plafond du mois atteint", message: "Rien n'est parti. Le plafond se règle dans l'Usine.", lien: "/" });
      await ecrireParametre(cle, true);
      return;
    }
    if (o.plafond <= 0 || o.apres * 100 < o.plafond * 80) return;
    const cle = `usine.autonomie.alerte80.${o.mois}`;
    if (await lireParametre<boolean>(cle, false)) return;
    await creerNotification({ type: "budget", titre: "Usine : 80 % du plafond du mois utilisé", message: "Elle s'arrêtera net au plafond. Le plafond se règle dans l'Usine.", lien: "/" });
    await ecrireParametre(cle, true);
  } catch {
    /* la décision ne dépend jamais de l'alerte */
  }
}

/* --- Accord sans clic et vue ------------------------------------------- */

/** Accord sans clic : budget indicatif (Studio) OU origine Usine avec l'autonomie allumée. Utilisée par le lot D. */
export async function accordSansClicPour(origine: unknown, videoId?: string): Promise<boolean> {
  // Origine non transmise + vidéo connue : on lit l'origine figée sur la vidéo (illisible = Usine), JAMAIS « studio » par défaut.
  const brute = origine === undefined && videoId ? await origineDeLaVideo(videoId) : origine;
  const o = normaliserOrigine(brute);
  const indicatif = await budgetIndicatifPour(o);
  if (indicatif) return true;
  return o === "usine" && (await lireAutonomieUsine()).etat === "active";
}

export interface VueAutonomie {
  etat: "active" | "confirmation";
  actif: boolean;
  plafondCents: number;
  utiliseCents: number;
  pourcentage: number;
  mois: string;
  /** Qui règle l'autonomie (voir `lireReglageEnVigueur`). */
  pilote: ReglageEnVigueur["pilote"];
}

/** Pour l'écran Réglages : état, plafond, utilisé, pourcentage, mois de Paris. */
export async function vueAutonomieUsine(): Promise<VueAutonomie> {
  const mois = moisParis(maintenant());
  const r = await lireAutonomieUsine();
  const utiliseCents = await usageDuMoisUsine(mois);
  const { pilote } = await lireReglageEnVigueur();
  if (r.etat !== "active") return { etat: "confirmation", actif: false, plafondCents: 0, utiliseCents, pourcentage: 0, mois, pilote };
  return { etat: "active", actif: true, plafondCents: r.plafondCents, utiliseCents, pourcentage: Math.round((utiliseCents * 100) / r.plafondCents), mois, pilote };
}
