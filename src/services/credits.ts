/**
 * CRÉDITS DES FOURNISSEURS (lot « crédits », 02/10, D2 ; `docs/LOT-INTENSITE-CREDITS-EXECUTION.md` §5, consigne
 * `CREDITS-ET-CLES.md`). Brique commune : aucun écran ni budget à part, une seule chaîne
 * `estimer → verifierBudgetEtCredits → reserverCredits → coût réel (libererReservation)`, déjà appelée par
 * `services/fabrication.ts` aux 4 endroits payants (lancement, maquette, retouche, format ajouté).
 *
 * - Pré-vol BLOQUANT : pour chaque fournisseur payant de l'estimation, solde − réservations actives ≥ estimation × 1,2.
 *   Un seul insuffisant : rien ne part (aucun appel payant chez personne), `CREDIT_INSUFFISANT` avec un message clair.
 * - Soldes : HeyGen et ElevenLabs LUS chez eux (gratuit) ; fal.ai et Claude SUIVIS par le studio (dernière recharge
 *   déclarée moins le coût réel de chaque appel ; aucune clé ADMIN sur le serveur).
 * - Réservations pendant la fabrication ; libérées à la fin (« consommée » : le coût réel la remplace), à l'échec
 *   définitif ou à « Arrêter ».
 * - Alertes 50 / 25 / 10 % et « plus qu'une vidéo », rapprochement quotidien, expiration fal.ai, clé refusée.
 * - Les clés ne sortent jamais du serveur : seuls leurs 4 derniers caractères s'affichent (« …a1B2 »).
 */
import "server-only";
import {
  alerteAEnvoyer,
  besoinsParFournisseur,
  coutMoyenUnite,
  DELAI_RAPPEL_EPUISE_MS,
  depenseDuFournisseur,
  eurVersUsd,
  expirationParDefaut,
  expirationsProches,
  finDeCle,
  formaterDollars,
  idFournisseur,
  manques as calculerManques,
  MARGE,
  centimesBloquants,
  lignesBloquantes,
  masquerCles,
  messageAlerteCredit,
  messageEpuise,
  pourcentage,
  rapprochement,
  soldeDeReference,
  soldeSuivi,
  tonJauge,
  totalReserve,
  videosRestantes,
  type BesoinFournisseur,
  type Manque,
  type TonJauge,
} from "@/domaine/credits";
import type { Id, LigneCout, ModeSolde, ReleveSolde, Video } from "@/domaine/types";
import { clePresente, clesConnues, ErreurLecture, FOURNISSEURS_PAYANTS, lecteursCredits } from "@/fournisseurs/credits";
import { cleClaudeAffichee } from "@/fournisseurs/credits/suivis";
import { CENTIMES_USD_PAR_CARACTERE_HEYGEN } from "@/fournisseurs/heygen/voix";
import { sousVerrouCreditsPartage } from "@/donnees/memoire";
import type { LecteurCredit, TestConnexion } from "@/fournisseurs/types";
import { nouvelId } from "@/lib/ids";
import { formaterMontant, TAUX_USD_EUR_PAR_DEFAUT } from "@/lib/montants";
import { accordCouvre, accordPropre, type AccordPrix } from "@/domaine/accord";
import { accordAutomatique, budgetIndicatif } from "./mode-budget";
import { partDoubleReel, phraseAvatarParle } from "@/domaine/double-reel";
import type { Estimation } from "@/moteurs";
import { depots, ecrireParametre, ErreurStudio, fournisseurSimule, horodatage, journaliser, lireParametre, maintenant, sousVerrou } from "./_commun";
import { exigerSession } from "./auth";
import { ajusterEngagement, engagerBudget, libererEngagement, moisParis, reactiverEngagement, resumeBudget } from "./couts";
import { creerNotification } from "./notifications";
import { choisirSourceClaude, lireReglageSourcesClaude, remettreEnService } from "./source-claude";
import { controlerBudgetDuMois, type OrigineLancement } from "./budget-mensuel";
import { formateurNombre } from "@/lib/intl";

/** Marge de sécurité ajoutée à l'estimation de chaque fournisseur (consigne §3). */
export const MARGE_CREDITS = MARGE;
/** Âge maximal d'un solde lu avant un pré-vol (au-delà : relu chez le fournisseur, gratuit). */
export const FRAICHEUR_PREVOL_MS = 5 * 60_000;
/** Âge maximal d'un solde lu pour l'écran Crédits. */
export const FRAICHEUR_ECRAN_MS = 10 * 60_000;
/** Une vidéo en attente de crédit retente seule toutes les heures (un refus « crédit insuffisant » n'est jamais payé). */
export const RELANCE_ATTENTE_CREDIT_MS = 60 * 60_000;

/* ------------------------------------------------------------------ */
/* Lecteurs (injectables pour les tests)                               */
/* ------------------------------------------------------------------ */

const cleInjection = Symbol.for("studio-axion-ia.lecteurs-credits");
type AvecInjection = typeof globalThis & { [cleInjection]?: { lecteurs: LecteurCredit[]; clesPresentes: string[] } | null };

/** Tests seulement : remplace les lecteurs réels (et dit lesquels ont une clé). `null` : retour aux vrais. */
export function injecterLecteursPourEssai(lecteurs: LecteurCredit[] | null, clesPresentes: string[] = []): void {
  (globalThis as AvecInjection)[cleInjection] = lecteurs ? { lecteurs, clesPresentes } : null;
}

/**
 * Essais locaux et captures (jamais en production) : `CREDITS_ESSAI="heygen=10"` remplace la LECTURE du solde des
 * services « réels » nommés par un solde fixe (centimes de dollar), comme si leur clé était présente. Aucun appel.
 */
function lecteursEssaiDepuisEnv(): { lecteurs: LecteurCredit[]; clesPresentes: string[] } | null {
  const v = process.env.CREDITS_ESSAI?.trim();
  if (!v || process.env.NODE_ENV === "production") return null;
  const soldes = new Map(v.split(",").map((x) => x.split("=").map((y) => y.trim()) as [string, string]).filter(([f, c]) => f && Number.isFinite(Number(c))).map(([f, c]) => [idFournisseur(f), Math.round(Number(c))]));
  const reels = lecteursCredits();
  return {
    lecteurs: reels.map((l) => {
      const solde = soldes.get(l.fournisseur);
      if (solde === undefined || l.mode !== "reel") return l;
      return {
        ...l,
        lireSolde: async () => ({ fournisseur: l.fournisseur, centimes: solde, caracteresRestants: l.fournisseur === "elevenlabs" ? solde : undefined, devise: "USD" as const, luLe: new Date().toISOString() }),
        testerConnexion: async () => ({ ok: true, finCle: "…essai", message: "Solde d'essai (local)", testeLe: new Date().toISOString() }),
      };
    }),
    clesPresentes: [...soldes.keys(), ...reels.filter((l) => clePresente(l)).map((l) => l.fournisseur)],
  };
}

function injection(): { lecteurs: LecteurCredit[]; clesPresentes: string[] } | null {
  return (globalThis as AvecInjection)[cleInjection] ?? lecteursEssaiDepuisEnv();
}

function lecteurs(): LecteurCredit[] {
  return injection()?.lecteurs ?? lecteursCredits();
}

function lecteur(fournisseur: string): LecteurCredit | undefined {
  const id = idFournisseur(fournisseur);
  return lecteurs().find((l) => l.fournisseur === id);
}

function aUneCle(l: LecteurCredit): boolean {
  const i = injection();
  return i ? i.clesPresentes.includes(l.fournisseur) : clePresente(l);
}

const NOMS: Record<string, string> = { heygen: "HeyGen", elevenlabs: "ElevenLabs", fal: "fal.ai", anthropic: "Claude" };
export function nomFournisseur(f: string): string {
  const id = idFournisseur(f);
  return lecteur(id)?.nom ?? NOMS[id] ?? f;
}

async function taux(): Promise<number> {
  return lireParametre<number>("taux.usdEur", TAUX_USD_EUR_PAR_DEFAUT);
}

/** Masque toute clé connue dans un texte (journal, message d'erreur). */
export function textePropre(texte: string): string {
  return masquerCles(texte, clesConnues());
}

function uniteDe(f: string): "usd" | "caracteres" {
  return idFournisseur(f) === "elevenlabs" ? "caracteres" : "usd";
}

function texteMontant(unite: "usd" | "caracteres", c: number | null | undefined): string | null {
  if (c === null || c === undefined) return null;
  return unite === "caracteres" ? `${Math.max(0, Math.round(c)).toLocaleString("fr-FR")} caractères` : formaterDollars(c);
}

/* ------------------------------------------------------------------ */
/* Soldes                                                              */
/* ------------------------------------------------------------------ */

export interface SoldeFournisseur {
  fournisseur: string;
  mode: ModeSolde;
  /** Solde actuel (centimes de dollar ; ElevenLabs : caractères). null : inconnu (aucune clé, aucune recharge déclarée). */
  solde: number | null;
  /** Lecture réelle (heure) ou départ du suivi (dernière recharge déclarée). */
  luLe?: string;
  reserve: number;
  disponible: number | null;
  cleRefusee: boolean;
  unite: "usd" | "caracteres";
}

async function dernierReleve(fournisseur: string): Promise<ReleveSolde | null> {
  const r = await depots().relevesSoldes.lister((x) => x.fournisseur === fournisseur && x.mode === "reel");
  return r.sort((a, b) => b.luLe.localeCompare(a.luLe))[0] ?? null;
}

/**
 * Filtre des dépenses RÉELLES d'un fournisseur (depuis `depuis`), à passer à `depenses.lister(...)`. Le dépôt copie
 * (structuredClone) tout ce que `lister` rend : sans filtre, chaque appel copiait TOUTE la collection (mesuré : voir PR
 * « mémoire »), et la boucle de fond le faisait pour chaque fournisseur, chaque minute, puis à chaque appel Claude.
 * Les calculs (`depenseDuFournisseur`, `soldeSuivi`, `coutMoyenUnite`) ne comptent que ces lignes : résultat identique.
 */
export function depenseChez(fournisseur: string, depuis?: string): (d: { lignes: { nature: string; fournisseur: string }[]; date: string }) => boolean {
  const id = idFournisseur(fournisseur);
  return (d) => (!depuis || d.date >= depuis) && d.lignes.some((l) => l.nature === "reel" && idFournisseur(l.fournisseur) === id);
}

/** Solde attendu maintenant d'après un relevé : relevé moins ce que le studio a dépensé chez ce fournisseur depuis. */
async function attenduDepuis(releve: Pick<ReleveSolde, "centimes" | "luLe" | "fournisseur">): Promise<number> {
  if (uniteDe(releve.fournisseur) === "caracteres") return releve.centimes;
  return Math.round(releve.centimes - depenseDuFournisseur(await depots().depenses.lister(depenseChez(releve.fournisseur, releve.luLe)), releve.fournisseur, await taux(), releve.luLe));
}

async function marquerCleRefusee(f: string, refusee: boolean): Promise<void> {
  const avant = await lireParametre<boolean>(`credits.cleRefusee.${f}`, false);
  if (avant === refusee) return;
  await ecrireParametre(`credits.cleRefusee.${f}`, refusee);
  if (refusee) {
    await creerNotification({ type: "credit", titre: `Clé ${nomFournisseur(f)} refusée`, message: "Les vidéos qui en dépendent sont bloquées. Remplacez la clé, puis testez-la.", lien: "/reglages#connexions" }, { email: true });
    await journaliser("credits", `Clé ${nomFournisseur(f)} refusée : fabrications bloquées`);
  } else {
    await journaliser("credits", `Clé ${nomFournisseur(f)} acceptée`);
  }
}

/**
 * Lit le solde réel chez le fournisseur (gratuit) et le range (relevé, avec le solde attendu par le studio).
 * Une hausse de plus de 10 % sur l'attendu = recharge : les vidéos en attente de crédit repartent.
 */
async function lireEtRanger(l: LecteurCredit): Promise<ReleveSolde> {
  const precedent = await dernierReleve(l.fournisseur);
  const lu = await l.lireSolde!();
  const valeur = uniteDe(l.fournisseur) === "caracteres" ? (lu.caracteresRestants ?? 0) : lu.centimes;
  const attendu = precedent ? await attenduDepuis(precedent) : undefined;
  const releve: ReleveSolde = { id: nouvelId("rel"), fournisseur: l.fournisseur, mode: "reel", centimes: valeur, devise: lu.devise, attenduCentimes: attendu, luLe: lu.luLe, ...horodatage() };
  await depots().relevesSoldes.enregistrer(releve);
  await marquerCleRefusee(l.fournisseur, false);
  if (attendu !== undefined && rapprochement(valeur, attendu).recharge) await apresRecharge(l.fournisseur, "lue");
  return releve;
}

/**
 * Solde d'un fournisseur. `fraicheurMs` : relit chez le fournisseur si le dernier relevé est plus ancien (réel seulement).
 * Une clé refusée est signalée (`cleRefusee`) ; une panne réseau garde le dernier relevé.
 */
export async function soldeFournisseur(fournisseur: string, fraicheurMs: number | null = null): Promise<SoldeFournisseur> {
  const id = idFournisseur(fournisseur);
  const l = lecteur(id);
  const reserve = totalReserve(await depots().reservations.lister((r) => r.statut === "active"), id);
  const unite = uniteDe(id);
  const cleRefuseeEnBase = await lireParametre<boolean>(`credits.cleRefusee.${id}`, false);
  // Claude : Anthropic ne donne aucun solde au studio (pas d'API de solde). Un solde « suivi » deviné bloquait des vidéos alors qu'il
  // restait du crédit (18/10). Aucun solde n'est donc affiché ni opposé : le studio appelle Claude, et c'est le refus d'Anthropic
  // (« crédit épuisé ») qui met la vidéo en attente et prévient Will (`signalerAttenteCredit`).
  if (id === "anthropic") return { fournisseur: id, mode: "suivi", solde: null, reserve, disponible: null, cleRefusee: cleRefuseeEnBase, unite };
  if (!l) return { fournisseur: id, mode: "suivi", solde: null, reserve, disponible: null, cleRefusee: false, unite };
  if (l.mode === "suivi") {
    const s = soldeSuivi(await depots().recharges.lister(), await depots().depenses.lister(depenseChez(id)), id, await taux());
    return { fournisseur: id, mode: "suivi", solde: s?.centimes ?? null, luLe: s?.depuis, reserve, disponible: s ? s.centimes - reserve : null, cleRefusee: cleRefuseeEnBase, unite };
  }
  let releve = await dernierReleve(id);
  let cleRefusee = cleRefuseeEnBase;
  const ancien = !releve || Date.now() - new Date(releve.luLe).getTime() > (fraicheurMs ?? Infinity);
  if (fraicheurMs !== null && ancien && aUneCle(l) && l.lireSolde) {
    try {
      releve = await lireEtRanger(l);
      cleRefusee = false;
    } catch (e) {
      if (e instanceof ErreurLecture && e.code === "refuse") {
        cleRefusee = true;
        await marquerCleRefusee(id, true);
      }
      // Panne réseau : le dernier relevé reste la référence.
    }
  }
  if (!releve) return { fournisseur: id, mode: "reel", solde: null, reserve, disponible: null, cleRefusee, unite };
  const solde = await attenduDepuis(releve);
  return { fournisseur: id, mode: "reel", solde, luLe: releve.luLe, reserve, disponible: solde - reserve, cleRefusee, unite };
}

/* ------------------------------------------------------------------ */
/* Pré-vol                                                             */
/* ------------------------------------------------------------------ */

/**
 * Rattache chaque ligne estimée à son fournisseur PAYANT, en centimes de dollar. Une ligne « simulation » ne coûte
 * rien ; un fournisseur dont la clé est absente n'est pas appelé (rien à réserver) ; fal.ai ne compte que si les
 * illustrations sont reliées. La voix HeyGen est recalculée au tarif HeyGen (caractères × tarif en dollars).
 */
export async function besoinsDeLEstimation(lignes: LigneCout[], marge: number = MARGE): Promise<BesoinFournisseur[]> {
  const t = await taux();
  const rattachees: { fournisseur: string; centimesUsd: number; etape: string }[] = [];
  let illustrationsSimulees: boolean | null = null;
  for (const l of lignes) {
    const id = idFournisseur(l.fournisseur);
    if (!(FOURNISSEURS_PAYANTS as readonly string[]).includes(id)) continue;
    const lec = lecteur(id);
    if (!lec || !aUneCle(lec)) continue;
    if (id === "fal") {
      illustrationsSimulees ??= await fournisseurSimule("illustration");
      if (illustrationsSimulees) continue;
    }
    let montant = eurVersUsd(l.total.centimes, t);
    if (id === "heygen" && l.unite === "caractere") montant = l.quantite * CENTIMES_USD_PAR_CARACTERE_HEYGEN;
    // ElevenLabs se compte en caractères (son solde est en caractères).
    if (id === "elevenlabs" && l.unite === "caractere") montant = l.quantite;
    rattachees.push({ fournisseur: id, centimesUsd: montant, etape: l.etape });
  }
  return besoinsParFournisseur(rattachees, marge);
}

/** Manques de crédit pour ces lignes (vide : tout est couvert). Lit les soldes réels s'ils datent de plus de 5 min. */
export async function manquesPour(lignes: LigneCout[]): Promise<{ manques: Manque[]; besoins: BesoinFournisseur[]; refusees: string[] }> {
  const besoins = await besoinsDeLEstimation(lignes);
  const disponibles: Record<string, number | null> = {};
  const refusees: string[] = [];
  const indicatif = await budgetIndicatif();
  for (const b of besoins) {
    const s = await soldeFournisseur(b.fournisseur, FRAICHEUR_PREVOL_MS);
    // Mode indicatif : un solde seulement SUIVI (fal.ai : recharges déclarées moins dépenses) est un repère deviné, jamais opposé.
    // Les soldes LUS chez HeyGen / ElevenLabs restent opposés. (L'affichage et les alertes de solde ne changent pas.)
    disponibles[b.fournisseur] = indicatif && s.mode === "suivi" ? null : s.disponible;
    if (s.cleRefusee) refusees.push(b.fournisseur);
  }
  return { manques: calculerManques(besoins, disponibles), besoins, refusees };
}

/** « Crédit HeyGen insuffisant : il reste 2,10 $, cette vidéo demande ≈ 3,80 $. » */
export function messageManque(m: Manque, quoi = "Cette vidéo"): string {
  const u = uniteDe(m.fournisseur);
  return `Crédit ${nomFournisseur(m.fournisseur)} insuffisant : il reste ${texteMontant(u, Math.max(0, m.disponible))}, ${quoi.charAt(0).toLowerCase()}${quoi.slice(1)} demande ≈ ${texteMontant(u, m.demande)}.`;
}

/**
 * Garde-fou commun (AV2.2-9 + crédits) : refuse si le budget du mois serait dépassé, exige `confirme` au-delà du seuil,
 * puis refuse si UN SEUL fournisseur n'a pas assez de crédit, AVANT tout appel payant (aucune vidéo à moitié payée).
 * Codes d'erreur : `BUDGET_DEPASSE`, `CONFIRMATION_REQUISE`, `CLE_REFUSEE`, `CREDIT_INSUFFISANT`.
 */
export async function verifierBudgetEtCredits(
  estimation: Pick<Estimation, "lignes" | "total">,
  accord: AccordPrix,
  quoi: string,
  options: { doubleDejaConfirme?: boolean; origine?: OrigineLancement; travailId?: Id; automatique?: boolean; videoId?: Id } = {},
): Promise<void> {
  // Lot R2 : une ligne `facultative` (textes des réseaux) ne bloque jamais ; elle reste engagée (verifierEtReserver).
  // L1-09 : au centime supérieur (pire cas, aucune fraction dans la somme du mois).
  const bloquant = Math.ceil(centimesBloquants(estimation));
  // Règle « le prix ne bloque jamais » : en mode indicatif (commande de l'utilisateur), le prix du jour vaut accord, y compris
  // pour le double réel. Mode bloquant et Usine : l'accord reçu, inchangé. Le journal et la cloche ne parlent que si l'ancienne
  // règle (seuil de confirmation, double réel) aurait refusé : un appel sous le seuil, ou à 0 €, ne fait aucun bruit.
  const seuilPrix = (await resumeBudget()).seuilConfirmation.centimes;
  const accordRecu = accordPropre(accord);
  const ancienneRegleRefusait =
    (bloquant > seuilPrix && !accordCouvre(accordRecu, bloquant, seuilPrix)) ||
    (partDoubleReel(estimation.lignes) !== null && !accordCouvre(accordRecu, typeof accordRecu === "number" ? bloquant : 0, seuilPrix) && !options.doubleDejaConfirme);
  const confirme = await accordAutomatique(accordRecu, bloquant, { origine: options.origine, videoId: options.videoId, signaler: ancienneRegleRefusait });
  // L1-09 : plafond du mois (réglé dans le studio), puis budget de l'Usine pour une commande de l'Usine ; illisible → refus.
  await controlerBudgetDuMois(bloquant, { origine: options.origine, travailId: options.travailId });
  const budget = await resumeBudget();
  // Relecture paquet 4 (D2) : la confirmation porte le MONTANT (centimes d'euro), à l'écran et au retour. Un montant
  // confirmé plus bas que le prix du jour est refusé : Will revoit le nouveau prix.
  // Mode indicatif (commande de l'utilisateur) : `confirme` vaut déjà le prix du jour (accordAutomatique), la confirmation au-dessus
  // du seuil ne refuse donc plus, que le lancement soit automatique ou fait à la main. `seuilIndicatif` ne fait que dispenser
  // un lancement AUTOMATIQUE d'une commande qui garderait un accord insuffisant. Mode bloquant et Usine : confirmation exigée.
  const seuilIndicatif = options.automatique === true && options.origine !== "usine" && (await budgetIndicatif());
  if (!seuilIndicatif && bloquant > budget.seuilConfirmation.centimes && !accordCouvre(confirme, bloquant, budget.seuilConfirmation.centimes)) {
    const prix = formaterMontant({ centimes: bloquant, devise: "EUR" });
    const message = typeof confirme === "number" ? `Le prix a changé : ${prix} au plus. Confirmez ce prix pour continuer.` : `${quoi} coûte au plus ${prix}, plus que d'habitude. Confirmez ce prix pour continuer.`;
    throw new ErreurStudio("CONFIRMATION_REQUISE", message, bloquant);
  }
  // Lot R7 — GARDE-FOU : le double RÉEL ne part jamais sans que Will ait confirmé son prix, quel que soit le seuil.
  const double = partDoubleReel(estimation.lignes);
  // `doubleDejaConfirme` : « Réessayer » d'un travail dont Will a confirmé le prix du double au lancement (CORRECTEUR 1 — B5).
  if (double && !accordCouvre(confirme, typeof confirme === "number" ? bloquant : 0, budget.seuilConfirmation.centimes) && !options.doubleDejaConfirme) {
    throw new ErreurStudio("CONFIRMATION_REQUISE", phraseAvatarParle(double), bloquant);
  }
  await controlerCredits(lignesBloquantes(estimation.lignes), quoi);

}

/** Solde disponible (solde − réservations actives) de chaque fournisseur des lignes, comparé à l'estimation + 20 %. */
async function controlerCredits(lignes: LigneCout[], quoi: string): Promise<void> {
  const { manques, refusees } = await manquesPour(lignes);
  if (refusees.length) {
    throw new ErreurStudio("CLE_REFUSEE", `${nomFournisseur(refusees[0])} refuse la clé du studio : remplacez-la, puis « Tester la connexion » dans Réglages > Connexions.`);
  }
  if (manques.length) throw new ErreurStudio("CREDIT_INSUFFISANT", messageManque(manques[0], quoi));
}

/* ------------------------------------------------------------------ */
/* Réservations                                                        */
/* ------------------------------------------------------------------ */

/** Réserve l'estimation (+ 20 %) de chaque fournisseur pendant la fabrication. Appelé juste après le lancement. Idempotent. */
export async function reserverCredits(demande: { videoId?: Id; travailId: Id; lignes: LigneCout[] }): Promise<void> {
  const d = depots();
  // Lot R2 : une ligne `facultative` n'est pas réservée ici (son propre chemin réserve, appel par appel).
  const besoins = await besoinsDeLEstimation(lignesBloquantes(demande.lignes));
  for (const b of besoins) {
    const deja = await d.reservations.trouver((r) => r.travailId === demande.travailId && r.fournisseur === b.fournisseur);
    if (deja) continue;
    await d.reservations.enregistrer({ id: nouvelId("res"), fournisseur: b.fournisseur, videoId: demande.videoId, travailId: demande.travailId, centimes: b.avecMarge, devise: "USD", statut: "active", ...horodatage() });
  }
}

/* Verrou des crédits (E2E-1 n° 6) : contrôle + réservation d'un seul tenant, deux lancements ne passent pas ensemble. */
const cleVerrouCredits = Symbol.for("studio-axion-ia.verrou-credits");
type AvecVerrouCredits = typeof globalThis & { [cleVerrouCredits]?: Promise<unknown> };

/**
 * Exécute `f` seul, à part du verrou de la boucle (la lecture des soldes peut appeler le réseau). L3-01 : file d'attente
 * dans ce processus, PUIS verrou consultatif Postgres partagé par tous les processus du studio (`sousVerrouCreditsPartage`,
 * qui relit l'argent dans la base avant `f`) : deux processus ne réservent jamais sur le même disponible.
 */
async function sousVerrouCredits<T>(f: () => Promise<T>): Promise<T> {
  const g = globalThis as AvecVerrouCredits;
  const avant = g[cleVerrouCredits] ?? Promise.resolve();
  const suite = avant.catch(() => undefined).then(() => sousVerrouCreditsPartage(f));
  g[cleVerrouCredits] = suite.catch(() => undefined);
  return suite;
}

/**
 * E2E-1 n° 6 (03/10) : la chaîne UNIQUE de toute dépense — contrôle du budget et des crédits PUIS réservation, d'un
 * seul tenant (verrou des crédits) : deux lancements simultanés ne peuvent pas passer sur le même disponible. Si
 * l'appelant échoue ensuite, il libère la réservation (`libererReservation(travailId, "liberee")`).
 */
export async function verifierEtReserver(
  estimation: Pick<Estimation, "lignes" | "total">,
  confirme: AccordPrix,
  quoi: string,
  demande: { videoId?: Id; travailId: Id },
  options: { origine?: OrigineLancement; automatique?: boolean } = {},
): Promise<void> {
  await sousVerrouCredits(async () => {
    // L1-09 : `origine: "usine"` exige le budget du mois reçu de l'Usine ; sans origine, la commande de Will (inchangée).
    await verifierBudgetEtCredits(estimation, confirme, quoi, { origine: options.origine, travailId: demande.travailId, automatique: options.automatique, videoId: demande.videoId });
    await reserverCredits({ ...demande, lignes: estimation.lignes });
    // E2E-2 argent n° 5 : l'estimation est ENGAGÉE sur le budget du mois jusqu'à la fin (restant = budget − dépensé − engagé).
    await engagerBudget(demande.travailId, estimation.total, demande.videoId);
  });
}

/* ------------------------------------------------------------------ */
/* Lot d'images (plan § c.3)                                             */
/* ------------------------------------------------------------------ */

const travailDuLot = (lotId: string) => `lot:${lotId}`;
const cleTransfert = (lotId: string, videoId: string) => `credits.lot.${lotId}.transfere.${videoId}`;

/** Ce qu'un lancement a pris au lot : par fournisseur (avec marge) et sur le budget du mois ; `rendu` : remis au lot. */
interface TransfertLot {
  parts: Record<string, number>;
  engagement: number;
  rendu: boolean;
}

/**
 * Au dépôt d'un lot : contrôle du budget et des crédits de CHAQUE fournisseur pour tout le lot, puis réservation du
 * crédit et engagement du prix sur le budget du mois (clé `lot:<id>`), d'un seul tenant. Un refus ne crée rien.
 * Idempotent. `reprise` : le lot reprend après une pause, la réservation est recalculée sur ce qui reste.
 */
export async function reserverLot(lotId: string, lignes: LigneCout[], total: { centimes: number; devise: "EUR" }, accord: AccordPrix, options: { reprise?: boolean; origine?: OrigineLancement } = {}): Promise<void> {
  await sousVerrouCredits(async () => {
    const travailId = travailDuLot(lotId);
    const d = depots();
    if (!options.reprise && (await d.reservations.trouver((r) => r.travailId === travailId))) return;
    // L3-01 : l'origine du lot (absente : Will dans le studio) ; « usine » exige le budget du mois de l'Usine.
    await verifierBudgetEtCredits({ lignes, total }, accord, "Ce lot", { origine: options.origine });
    if (options.reprise) {
      for (const b of await besoinsDeLEstimation(lignesBloquantes(lignes))) {
        const existante = await d.reservations.trouver((r) => r.travailId === travailId && r.fournisseur === b.fournisseur);
        if (existante) await d.reservations.modifier(existante.id, { centimes: b.avecMarge, statut: "active", libereeLe: undefined });
      }
      await reactiverEngagement(travailId);
      await ajusterEngagement(travailId, total.centimes - (await engagementLot(travailId)));
    }
    await reserverCredits({ travailId, lignes });
    if (!options.reprise) await engagerBudget(travailId, total);
  });
}

async function engagementLot(travailId: string): Promise<number> {
  return lireParametre<{ centimes: number } | null>(`budget.engage.${travailId}`, null).then((e) => e?.centimes ?? 0);
}

/**
 * Juste AVANT le lancement d'une vidéo du lot : sa part (besoin avec marge de chaque fournisseur, prix sur le budget)
 * sort de la réservation et de l'engagement du lot ; le lancement normal pose ensuite la réservation propre du travail.
 * Idempotent par vidéo ; plancher 0.
 */
export async function transfererDuLot(lotId: string, videoId: string, lignesVideo: LigneCout[], totalVideo: { centimes: number }): Promise<void> {
  await sousVerrouCredits(async () => {
    const travailId = travailDuLot(lotId);
    const cle = cleTransfert(lotId, videoId);
    const note = await lireParametre<TransfertLot | null>(cle, null);
    if (note && !note.rendu) return;
    const d = depots();
    const parts: Record<string, number> = {};
    for (const b of await besoinsDeLEstimation(lignesBloquantes(lignesVideo))) {
      const r = await d.reservations.trouver((x) => x.travailId === travailId && x.fournisseur === b.fournisseur && x.statut === "active");
      if (!r) continue;
      const pris = Math.min(r.centimes, b.avecMarge);
      await d.reservations.modifier(r.id, { centimes: r.centimes - pris });
      parts[b.fournisseur] = pris;
    }
    const engagement = Math.min(await engagementLot(travailId), Math.max(0, Math.round(totalVideo.centimes)));
    await ajusterEngagement(travailId, -engagement);
    await ecrireParametre(cle, { parts, engagement, rendu: false } satisfies TransfertLot);
  });
}

/** Le lancement a échoué AVANT d'avoir créé le travail : la part transférée revient au lot (idempotent). */
export async function rendreAuLot(lotId: string, videoId: string): Promise<void> {
  await sousVerrouCredits(async () => {
    const travailId = travailDuLot(lotId);
    const cle = cleTransfert(lotId, videoId);
    const note = await lireParametre<TransfertLot | null>(cle, null);
    if (!note || note.rendu) return;
    const d = depots();
    for (const [fournisseur, part] of Object.entries(note.parts)) {
      const r = await d.reservations.trouver((x) => x.travailId === travailId && x.fournisseur === fournisseur && x.statut === "active");
      if (r) await d.reservations.modifier(r.id, { centimes: r.centimes + part });
    }
    await ajusterEngagement(travailId, note.engagement);
    await ecrireParametre(cle, { ...note, rendu: true } satisfies TransfertLot);
  });
}

/** Fin du lot (terminé ou arrêté) : réservation et engagement du lot libérés ; ce qui est lancé garde les siens. */
export async function libererLot(lotId: string): Promise<void> {
  await sousVerrouCredits(() => libererReservation(travailDuLot(lotId), "liberee"));
}

/**
 * L3-0 (prérequis argent) : le SEUL chemin d'une dépense COMMANDÉE par l'Usine (porte v2, § 3 quater). Même chaîne que
 * `verifierEtReserver` (verrou des crédits, contrôle, réservation, engagement), mais l'origine est FIXÉE à « usine » :
 * sans budget du mois reçu de l'Usine → `BUDGET_USINE_ABSENT`, budget atteint → `BUDGET_MENSUEL_ATTEINT`, avant toute
 * réservation. L'appelant ne peut pas choisir l'origine ; la dépense manuelle de Will (`verifierEtReserver`) ne change pas.
 */
export function reserverPourUsine(estimation: Pick<Estimation, "lignes" | "total">, confirme: AccordPrix, quoi: string, demande: { videoId?: Id; travailId: Id }): Promise<void> {
  return verifierEtReserver(estimation, confirme, quoi, demande, { origine: "usine" });
}

/**
 * L3-0 : aiguillage d'un code qui reçoit l'origine du lancement (écriture, textes de vidéo, décors…) : « usine » passe
 * par `reserverPourUsine`, tout le reste par `verifierEtReserver` (défaut manuel de Will, inchangé). Seul endroit hors
 * de ce fichier où l'origine devient un choix de chemin ; le test structurel `l3-0-garde-origine` (tests/l3-0-garde-origine.test.ts) y veille.
 * L3-01 : ce test tient aussi la liste FERMÉE de tous les sites de dépense du dépôt (§ 3 : garde, pré-vol, crochet ou hors
 * porte, chacun avec sa raison) ; un site nouveau, ou une garde qui reçoit une origine écrite en dur, le fait rougir.
 */
export function verifierEtReserverSelonOrigine(origine: OrigineLancement | undefined, estimation: Pick<Estimation, "lignes" | "total">, confirme: AccordPrix, quoi: string, demande: { videoId?: Id; travailId: Id }, options: { automatique?: boolean } = {}): Promise<void> {
  return origine === "usine" ? reserverPourUsine(estimation, confirme, quoi, demande) : verifierEtReserver(estimation, confirme, quoi, demande, { automatique: options.automatique });
}

/**
 * L3-01 : une dépense « d'un coup » (un appel payant attendu sur place : écoute d'une voix, look de décor, voix d'une
 * maquette). Contrôle, réservation et engagement sous le verrou des crédits, selon l'origine (`verifierEtReserverSelonOrigine`),
 * PUIS `payer`. La réservation et l'engagement sont toujours rendus à la fin : « consommee » si `payer` a abouti (l'appelant
 * a enregistré la dépense réelle DANS `payer`), « liberee » sinon. Un refus ne lance jamais `payer`.
 */
export async function depenserSelonOrigine<T>(origine: OrigineLancement | undefined, estimation: Pick<Estimation, "lignes" | "total">, confirme: AccordPrix, quoi: string, demande: { videoId?: Id; travailId: Id }, payer: () => Promise<T>): Promise<T> {
  await verifierEtReserverSelonOrigine(origine, estimation, confirme, quoi, demande);
  let paye = false;
  try {
    const r = await payer();
    paye = true;
    return r;
  } finally {
    await libererReservation(demande.travailId, paye ? "consommee" : "liberee");
  }
}

/**
 * L3-01 : « Réessayer » un travail en échec. D'un seul tenant sous le verrou des crédits : contrôle du budget du mois
 * (avec l'origine de la commande) et des crédits sur le coût RESTANT, puis `ensuite`, qui reçoit `reactiver`
 * (réactivation des réservations et de l'engagement du travail) et l'appelle juste avant que le travail reparte (son
 * engagement compte dès lors). Refus : rien n'est réactivé, `ensuite` ne part pas.
 * Ordre des verrous (audit L3-01, interblocage) : TOUJOURS crédits PUIS boucle, comme `apresRecharge` (pré-vol → recharge
 * lue → verrou de la boucle). L'appelant ne tient donc jamais `sousVerrou` en appelant cette fonction : s'il en a besoin,
 * il le prend DANS `ensuite`.
 */
export async function reactiverSelonOrigine<T>(
  origine: OrigineLancement | undefined,
  travailId: Id,
  estimation: Pick<Estimation, "lignes" | "total">,
  confirme: AccordPrix | undefined,
  quoi: string,
  options: { doubleDejaConfirme?: boolean },
  ensuite: (reactiver: () => Promise<void>) => Promise<T>,
): Promise<T> {
  return sousVerrouCredits(async () => {
    await verifierBudgetEtCredits(estimation, confirme ?? false, quoi, { doubleDejaConfirme: options.doubleDejaConfirme, origine, travailId });
    return ensuite(() => reactiverReservations(travailId));
  });
}

/**
 * E2E-1 n° 7 (03/10) : pendant la fabrication, la réservation d'un fournisseur au solde LU (HeyGen…) diminue de ce
 * qui lui est déjà payé (le solde réel a déjà baissé : la voix ne compte pas deux fois dans le « disponible »).
 * Idempotent : la part déjà déduite est gardée (`credits.deduit.<réservation>`). Un solde SUIVI (fal.ai, Claude)
 * ne baisse qu'avec la dépense enregistrée : sa réservation reste entière jusque-là. Aucun appel réseau.
 */
export async function deduireDejaPaye(travailId: Id, lignesPayees: LigneCout[]): Promise<void> {
  if (!lignesPayees.length) return;
  const d = depots();
  const actives = await d.reservations.lister((r) => r.travailId === travailId && r.statut === "active");
  if (!actives.length) return;
  const payes = await besoinsDeLEstimation(lignesPayees, 0);
  for (const r of actives) {
    if (lecteur(r.fournisseur)?.mode !== "reel") continue;
    const paye = payes.find((b) => b.fournisseur === idFournisseur(r.fournisseur))?.estimation ?? 0;
    const cle = `credits.deduit.${r.id}`;
    const deja = await lireParametre<number>(cle, 0);
    const aDeduire = Math.round(paye - deja);
    if (aDeduire <= 0) continue;
    await d.reservations.modifier(r.id, { centimes: Math.max(0, r.centimes - aDeduire) });
    await ecrireParametre(cle, deja + aDeduire);
  }
}

/** Le solde de ce fournisseur est-il LU chez lui (HeyGen, ElevenLabs) plutôt que suivi par le studio ? */
export function soldeLuChezLeFournisseur(fournisseur: string): boolean {
  return lecteur(fournisseur)?.mode === "reel";
}

/**
 * Libère la réservation d'un travail (fin : « consommee », le coût réel la remplace ; échec définitif ou « Arrêter » :
 * « liberee »). Jamais effacée : son statut change.
 */
export async function libererReservation(travailId: Id, issue: "consommee" | "liberee"): Promise<void> {
  const d = depots();
  for (const r of await d.reservations.lister((x) => x.travailId === travailId && x.statut === "active")) {
    await d.reservations.modifier(r.id, { statut: issue, libereeLe: maintenant() });
  }
  await libererEngagement(travailId, issue);
}

/** « Réessayer » après un échec : les réservations libérées du travail redeviennent actives. */
export async function reactiverReservations(travailId: Id): Promise<void> {
  const d = depots();
  for (const r of await d.reservations.lister((x) => x.travailId === travailId && x.statut === "liberee")) {
    await d.reservations.modifier(r.id, { statut: "active", libereeLe: undefined });
  }
  await reactiverEngagement(travailId);
}

/* ------------------------------------------------------------------ */
/* Recharges et reprise                                                */
/* ------------------------------------------------------------------ */

/**
 * Après une recharge (déclarée par Will ou lue chez le fournisseur) : les alertes repartent de zéro et les vidéos
 * « en attente de crédit » de ce fournisseur sont relancées tout de suite, dans l'ordre d'arrivée.
 */
async function apresRecharge(fournisseur: string, comment: "declaree" | "lue"): Promise<void> {
  const d = depots();
  await ecrireParametre(`credits.alertes.${fournisseur}`, []);
  await ecrireParametre(`credits.epuise.${fournisseur}`, null);
  // Sous le verrou de la boucle de fond (le travail n'est jamais réécrit pendant un tour).
  const enAttente = await sousVerrou(async () => {
    const liste = (await d.travaux.lister((t) => (t.statut === "en_cours" || t.statut === "en_file") && t.reprise?.motif === "credit" && idFournisseur(t.reprise.fournisseurCredit ?? "") === fournisseur)).sort((a, b) => a.creeLe.localeCompare(b.creeLe));
    const iso = maintenant();
    for (const t of liste) await d.travaux.modifier(t.id, { reprise: { ...t.reprise!, prochainEssai: iso } });
    return liste;
  });
  if (enAttente.length) await journaliser("credits", `Recharge ${nomFournisseur(fournisseur)} ${comment === "lue" ? "constatée" : "déclarée"} : ${enAttente.length} vidéo${enAttente.length > 1 ? "s" : ""} reprise${enAttente.length > 1 ? "s" : ""}`);
}

/**
 * « J'ai rechargé » : montant en centimes de dollar. Recale le solde suivi ; un solde réel est relu.
 * Claude : les trois « abonnements » sont des clés Console facturées au jeton ; le solde suivi est UNIQUE pour Claude
 * (pas un solde par compte). Décision de fond laissée à Will ; le renouvellement d'un compte lève l'attente sans recharge.
 */
export async function declarerRecharge(fournisseur: string, centimesUsd: number, note?: string): Promise<void> {
  await exigerSession();
  const id = idFournisseur(fournisseur);
  const l = lecteur(id);
  if (!l) throw new ErreurStudio("INTROUVABLE", "Ce service n'a pas de crédit à suivre.");
  if (!Number.isFinite(centimesUsd) || centimesUsd <= 0 || centimesUsd > 1_000_000) throw new ErreurStudio("MONTANT_INVALIDE", "Indiquez un montant entre 0,01 et 10 000.");
  const date = maintenant();
  if (l.mode === "suivi") {
    // Solde suivi : le reste de l'ancienne recharge s'ajoute (le suivi repart du total).
    const avant = soldeSuivi(await depots().recharges.lister(), await depots().depenses.lister(depenseChez(id)), id, await taux());
    const total = Math.round(centimesUsd + Math.max(0, avant?.centimes ?? 0));
    await depots().recharges.enregistrer({ id: nouvelId("rch"), fournisseur: id, centimes: total, devise: "USD", date, expireLe: expirationParDefaut(id, date), note: note?.slice(0, 120) || (avant && avant.centimes > 0 ? `dont ${formaterDollars(avant.centimes)} restants` : undefined), ...horodatage() });
  } else {
    await depots().recharges.enregistrer({ id: nouvelId("rch"), fournisseur: id, centimes: Math.round(centimesUsd), devise: "USD", date, note: note?.slice(0, 120), ...horodatage() });
    if (aUneCle(l) && l.lireSolde) {
      try {
        await lireEtRanger(l);
      } catch {
        /* relu au prochain passage */
      }
    }
  }
  await journaliser("credits", `Recharge ${l.nom} : ${formaterDollars(centimesUsd)}`);
  // Recharge Claude déclarée : les comptes marqués épuisés sont retentés (un refus de Claude les marquera de nouveau, sans frais).
  if (id === "anthropic") await remettreEnService();
  await apresRecharge(id, "declaree");
}

/* ------------------------------------------------------------------ */
/* « Crédit insuffisant » à l'Aperçu : feuille et brouillon en attente  */
/* ------------------------------------------------------------------ */

export interface DetailCredit {
  manques: { fournisseur: string; nom: string; disponible: string; demande: string; urlRecharge: string }[];
  /** La version économique (sans illustrations fabriquées) passe-t-elle ? */
  economiqueSuffit: boolean;
  message: string;
}

/** Ce qui manque pour lancer cette vidéo (feuille « Crédit HeyGen insuffisant »). */
export async function detailCreditVideo(videoId: Id): Promise<DetailCredit> {
  await exigerSession();
  const { construireCommande } = await import("./fabrication");
  const { moteurDeCommande } = await import("@/moteurs");
  const commande = await construireCommande(videoId);
  const estimation = await moteurDeCommande(commande).estimer(commande);
  const { manques } = await manquesPour(estimation.lignes);
  const sansIllustrations = estimation.lignes.filter((l) => !/illustr/i.test(l.etape));
  const economiqueSuffit = manques.length > 0 && sansIllustrations.length < estimation.lignes.length && (await manquesPour(sansIllustrations)).manques.length === 0;
  return {
    manques: manques.map((m) => {
      const u = uniteDe(m.fournisseur);
      return { fournisseur: m.fournisseur, nom: nomFournisseur(m.fournisseur), disponible: texteMontant(u, Math.max(0, m.disponible)) ?? "", demande: texteMontant(u, m.demande) ?? "", urlRecharge: lecteur(m.fournisseur)?.urlRecharge ?? "" };
    }),
    economiqueSuffit,
    message: manques[0] ? messageManque(manques[0]) : "",
  };
}

/** Le voyant rouge exige-t-il un second oui pour cette vidéo ? Lu sur la version d'origine et le texte réels (jamais sur la foi de l'écran) ; en cas de doute : non. */
async function secondOuiExige(videoId: Id): Promise<boolean> {
  try {
    const { varianteOrigineDeLaVideo, versionLaPlusRecente, texteRetoucheDeLaVideo } = await import("./scripts");
    const { demandeConfirmationVoyant } = await import("@/domaine/voyant-rouge");
    const origine = await varianteOrigineDeLaVideo(videoId);
    const v = origine ? await versionLaPlusRecente(origine) : null;
    return !!v && !!demandeConfirmationVoyant([v], { texteRetouche: await texteRetoucheDeLaVideo(videoId, v) });
  } catch {
    return false;
  }
}

/** « Garder en brouillon » (+ « lancer dès que possible ») : la vidéo partira après la recharge. */
export async function garderEnAttente(videoId: Id, options: { lancerDesQuePossible: boolean; fournisseur: string; confirme?: AccordPrix; scriptRelu?: string; malgreVoyant?: boolean }): Promise<void> {
  await exigerSession();
  const d = depots();
  const video = await d.videos.obtenir(videoId);
  if (!video) throw new ErreurStudio("INTROUVABLE", "Cette vidéo n'existe plus.");
  if (options.lancerDesQuePossible) {
    // Correcteur R8 n° 1 : le moteur annoncé au moment de l'accord est gardé (un accord en essai ne vaut pas pour le réel).
    const { moteurAuLancement } = await import("./reglages");
    const moteurId = options.confirme ? await moteurAuLancement(video.formatId) : undefined;
    // Le navigateur ne fait pas foi : le second oui n'est gardé que s'il est vraiment exigé pour cette vidéo (même test que le lancement).
    const malgreVoyant = options.malgreVoyant === true && (await secondOuiExige(videoId));
    await d.videos.modifier(videoId, { lancementEnAttente: { depuis: video.lancementEnAttente?.depuis ?? maintenant(), fournisseur: idFournisseur(options.fournisseur), confirme: accordPropre(options.confirme), ...(moteurId ? { moteurId } : {}), ...(options.scriptRelu ? { scriptRelu: String(options.scriptRelu) } : {}),
      // Voyant rouge : le oui a VRAIMENT été donné avant ce refus pour crédit ; la relance n'écrit la trace que dans ce cas (champ additif, d'où le cast).
      ...(malgreVoyant ? { malgreVoyant: true } : {}) } as NonNullable<typeof video.lancementEnAttente> });
    await journaliser("credits", `« ${video.titre} » partira dès que le crédit ${nomFournisseur(options.fournisseur)} le permettra`, { type: "video", id: videoId });
  } else if (video.lancementEnAttente) {
    await d.videos.modifier(videoId, { lancementEnAttente: undefined });
    await journaliser("credits", `« ${video.titre} » reste en brouillon`, { type: "video", id: videoId });
  }
}

/**
 * Lance, dans l'ordre d'arrivée, les brouillons « lancer dès que possible » que le crédit permet maintenant. S'arrête
 * au premier qui manque encore de crédit (les suivants attendent leur tour). Appelé depuis l'Accueil (la fabrication
 * exige la session de Will) ; la boucle de fond prévient dès que le crédit est revenu.
 */
export async function lancerVideosEnAttente(): Promise<{ lancees: string[] }> {
  await exigerSession();
  const d = depots();
  const { lancerFabrication, relectureExigee } = await import("./fabrication");
  const attente = (await d.videos.lister((v) => !!v.lancementEnAttente && v.statut === "brouillon")).sort((a, b) => a.lancementEnAttente!.depuis.localeCompare(b.lancementEnAttente!.depuis));
  const lancees: string[] = [];
  for (const v of attente) {
    try {
      // Correcteur R8 n° 1 : l'accord donné plus tôt porte sur un moteur ; monté pour de vrai par un autre, il ne vaut pas.
      // Brique 6 : le repère « script relu » donné au premier lancement est repris (le texte ne doit pas avoir changé). Exigé
      // aussi selon la vidéo d'aujourd'hui (passée en voix de synthèse depuis la mise en attente : refus SCRIPT_NON_RELU),
      // sauf pour une version par réseau (« Fabriquer les N », `fabrication-reseaux`), qui ne passe pas par l'assistant.
      const { scriptRelu } = v.lancementEnAttente!;
      const exigerScriptRelu = !!scriptRelu || (!v.varianteId && (await relectureExigee(v.id)));
      await lancerFabrication(v.id, { confirme: v.lancementEnAttente!.confirme, confirmationDifferee: { moteurId: v.lancementEnAttente!.moteurId }, ...(scriptRelu ? { scriptRelu } : {}), exigerScriptRelu });
    } catch (e) {
      if (e instanceof ErreurStudio && (e.code === "CREDIT_INSUFFISANT" || e.code === "CLE_REFUSEE" || e.code === "BUDGET_DEPASSE")) break;
      if (e instanceof ErreurStudio) {
        // Autre empêchement (accord, voix, confirmation) : la vidéo redevient un brouillon normal, Will est prévenu.
        await d.videos.modifier(v.id, { lancementEnAttente: undefined });
        await creerNotification({ type: "credit", titre: `« ${v.titre} » n'a pas pu partir`, message: e.message, lien: `/nouvelle/${v.formatId}?brouillon=${v.id}`, estDemo: v.estDemo });
        continue;
      }
      throw e;
    }
    // Voyant rouge : le oui donné avant le « crédit insuffisant » est gardé au départ réel (sans effet si la version n'est pas rouge).
    // La fabrication est partie : une erreur d'écriture de la trace est journalisée et ne doit pas stopper la relance des autres vidéos.
    try {
      const { varianteOrigineDeLaVideo, garderOuiVoyantDeVersion, texteRetoucheDeLaVideo, versionLaPlusRecente } = await import("./scripts");
      const o = await varianteOrigineDeLaVideo(v.id);
      // Sans le oui gardé à la mise en attente, la version la plus récente du même code n'a rien à se voir attribuer.
      if (o && (v.lancementEnAttente as { malgreVoyant?: boolean } | undefined)?.malgreVoyant === true) {
        const vo = await versionLaPlusRecente(o);
        await garderOuiVoyantDeVersion(o, { texteRetouche: vo ? await texteRetoucheDeLaVideo(v.id, vo) : false });
      }
    } catch (erreur) {
      console.error("[studio] trace du oui voyant non écrite", erreur);
    }
    await d.videos.modifier(v.id, { lancementEnAttente: undefined });
    await ecrireParametre(`credits.lancementPret.${v.id}`, false);
    await journaliser("credits", `Lancée après la recharge : « ${v.titre} »`, { type: "video", id: v.id });
    lancees.push(v.titre);
  }
  return { lancees };
}

/* ------------------------------------------------------------------ */
/* Écrans : Réglages > Crédits, carte de l'Accueil, Connexions          */
/* ------------------------------------------------------------------ */

export interface CarteCredit {
  fournisseur: string;
  nom: string;
  mode: ModeSolde;
  clePresente: boolean;
  cleRefusee: boolean;
  /** Solde disponible nul ou négatif (bandeau de l'Accueil). */
  epuise: boolean;
  unite: "usd" | "caracteres";
  /** Textes prêts à afficher (« 29,83 $ », « 12 400 caractères »). null : inconnu. */
  soldeTexte: string | null;
  disponibleTexte: string | null;
  reserveTexte: string | null;
  luLe?: string;
  consommeMoisTexte: string;
  /** Plafond du mois : le budget global existant (euros), gardé tel quel. */
  plafondMoisTexte: string;
  videosRestantes: number | null;
  pourcentage: number | null;
  ton: TonJauge;
  urlRecharge: string;
  /** Crédits qui expirent bientôt (fal.ai). */
  expirations: { montantTexte: string; expireLe: string }[];
  /** Vidéos en attente de ce crédit (fabrication arrêtée en route ou brouillon « dès que possible »). */
  enAttente: number;
  /** Claude seulement : nombre de comptes d'abonnement retenus, tous épuisés (absent sinon). */
  comptesEpuises?: number;
  /** Claude seulement : le studio écrit avec les comptes d'abonnement (rien à « recharger »). */
  abonnements?: boolean;
  /** Claude en mode « abonnements » sans aucun compte utilisable (tous désactivés, clé payante seule, doublons). */
  aucunCompte?: boolean;
}

/** Les cartes de Réglages > Crédits (une par fournisseur payant). Relit un solde réel de plus de 10 min (gratuit). */
export async function vueCredits(options: { relire?: boolean } = {}): Promise<CarteCredit[]> {
  const d = depots();
  const t = await taux();
  const depenses = await d.depenses.lister();
  const recharges = await d.recharges.lister();
  const budget = await resumeBudget();
  const mois = moisParis();
  const travauxCredit = await d.travaux.lister((x) => (x.statut === "en_cours" || x.statut === "en_file") && x.reprise?.motif === "credit");
  const brouillons = await d.videos.lister((v) => !!v.lancementEnAttente);
  const cartes: CarteCredit[] = [];
  const choixClaude = (await lireReglageSourcesClaude()).mode === "abonnements" ? await choisirSourceClaude() : null;
  for (const l of lecteurs()) {
    const presente = aUneCle(l);
    const s = await soldeFournisseur(l.fournisseur, options.relire === false || !presente ? null : FRAICHEUR_ECRAN_MS);
    const unite = s.unite;
    const reference = s.mode === "suivi" ? (soldeSuivi(recharges, depenses, l.fournisseur, t)?.recharge ?? null) : soldeDeReference(await d.relevesSoldes.lister((r) => r.fournisseur === l.fournisseur && r.mode === "reel"));
    const cout = unite === "usd" ? coutMoyenUnite(depenses, l.fournisseur, t) : null;
    const disponible = s.disponible;
    const consomme = depenseDuFournisseur(depenses.filter((x) => moisParis(x.date) === mois), l.fournisseur, t);
    cartes.push({
      fournisseur: l.fournisseur,
      nom: l.nom,
      mode: l.mode,
      clePresente: presente,
      cleRefusee: s.cleRefusee,
      epuise: disponible !== null && disponible <= 0,
      unite,
      soldeTexte: texteMontant(unite, s.solde),
      disponibleTexte: texteMontant(unite, disponible),
      reserveTexte: s.reserve > 0 ? texteMontant(unite, s.reserve) : null,
      luLe: s.luLe,
      consommeMoisTexte: formaterDollars(consomme),
      plafondMoisTexte: formateurNombre("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(budget.budget.centimes / 100),
      videosRestantes: disponible === null ? null : videosRestantes(disponible, cout),
      pourcentage: disponible === null ? null : pourcentage(disponible, reference),
      ton: s.cleRefusee ? "rouge" : disponible === null ? "neutre" : tonJauge(disponible, reference, cout),
      urlRecharge: l.urlRecharge,
      expirations: expirationsProches(
        recharges.filter((r) => idFournisseur(r.fournisseur) === l.fournisseur),
        Date.now(),
      ).map((r) => ({ montantTexte: formaterDollars(r.centimes), expireLe: r.expireLe! })),
      enAttente:
        travauxCredit.filter((x) => idFournisseur(x.reprise?.fournisseurCredit ?? "") === l.fournisseur).length +
        brouillons.filter((v) => idFournisseur(v.lancementEnAttente!.fournisseur) === l.fournisseur).length,
      ...(l.fournisseur === "anthropic" && choixClaude?.etat === "tous-epuises" ? { comptesEpuises: choixClaude.comptes } : {}),
      // Mode « abonnements » : jamais de « recharge » de l'API payante, même sans compte utilisable (alors `aucunCompte`).
      ...(l.fournisseur === "anthropic" && choixClaude ? { abonnements: true } : {}),
      ...(l.fournisseur === "anthropic" && choixClaude?.etat === "aucun" ? { aucunCompte: true } : {}),
    });
  }
  return cartes;
}

/**
 * Carte de l'Accueil : seulement les fournisseurs réellement utilisés (clé présente ou solde suivi), et le nombre de
 * brouillons « dès que possible » que le crédit permet maintenant (ils partent à l'ouverture de l'Accueil).
 */
export async function resumeCreditsAccueil(): Promise<{ cartes: CarteCredit[]; brouillonsPrets: number }> {
  const cartes = (await vueCredits({ relire: true })).filter((c) => c.clePresente || c.soldeTexte !== null);
  let brouillonsPrets = 0;
  for (const v of await depots().videos.lister((x) => !!x.lancementEnAttente && x.statut === "brouillon")) {
    if (await lireParametre<boolean>(`credits.lancementPret.${v.id}`, false)) brouillonsPrets++;
  }
  return { cartes, brouillonsPrets };
}

export interface CleService {
  fournisseur: string;
  nom: string;
  variable: string;
  clePresente: boolean;
  /** « …a1B2 » : 4 derniers caractères, jamais plus. */
  finCle?: string;
  dernierTest?: TestConnexion;
  derniereUtilisation?: string;
}

/** Réglages > Connexions : une ligne par clé de service payant. Aucune clé complète ne sort d'ici. */
export async function vueCles(): Promise<CleService[]> {
  const depenses = await depots().depenses.lister();
  const sortie: CleService[] = [];
  for (const l of lecteurs()) {
    const presente = aUneCle(l);
    const derniereUtilisation = depenses
      .filter((x) => x.lignes.some((li) => li.nature === "reel" && idFournisseur(li.fournisseur) === l.fournisseur))
      .map((x) => x.date)
      .sort()
      .at(-1);
    sortie.push({
      fournisseur: l.fournisseur,
      nom: l.nom,
      variable: l.variableCle,
      clePresente: presente,
      finCle: presente ? finDeCle(l.fournisseur === "anthropic" ? (cleClaudeAffichee() ?? process.env[l.variableCle]) : process.env[l.variableCle]) : undefined,
      dernierTest: (await lireParametre<TestConnexion | null>(`credits.test.${l.fournisseur}`, null)) ?? undefined,
      derniereUtilisation,
    });
  }
  return sortie;
}

/** « Tester la connexion » : lecture gratuite chez le fournisseur ; statut, 4 derniers caractères, heure. */
export async function testerConnexionCredit(fournisseur: string): Promise<TestConnexion> {
  await exigerSession();
  const l = lecteur(fournisseur);
  if (!l) throw new ErreurStudio("INTROUVABLE", "Ce service n'existe pas.");
  const r = await l.testerConnexion();
  const resultat: TestConnexion = { ...r, message: textePropre(r.message) };
  await ecrireParametre(`credits.test.${l.fournisseur}`, resultat);
  if (aUneCle(l)) await marquerCleRefusee(l.fournisseur, !r.ok && /refus/i.test(r.message));
  // Un test réussi d'un solde réel le range aussi (lecture gratuite).
  if (r.ok && l.mode === "reel" && l.lireSolde) {
    try {
      await lireEtRanger(l);
    } catch {
      /* rien */
    }
  }
  await journaliser("credits", `Connexion ${l.nom} testée : ${r.ok ? "clé acceptée" : "échec"}`);
  return resultat;
}

/* ------------------------------------------------------------------ */
/* Pendant la fabrication : « en attente de crédit »                   */
/* ------------------------------------------------------------------ */

/** Le fournisseur d'une erreur « crédit insuffisant » (HeyGen, fal.ai, Claude), sinon celui du travail. */
export function fournisseurDeLErreur(e: unknown, parDefaut: string): string {
  const x = e as { name?: string; fournisseur?: string; message?: string; erreur?: { message?: string } } | null;
  if (x?.fournisseur) return idFournisseur(x.fournisseur);
  if (x?.name === "ErreurHeygen") return "heygen";
  const message = `${x?.erreur?.message ?? ""} ${x?.message ?? ""}`;
  if (/heygen/i.test(message)) return "heygen";
  if (/fal\.ai|\bfal\b/i.test(message)) return "fal";
  if (/credit balance|anthropic|claude/i.test(message)) return "anthropic";
  if (/elevenlabs/i.test(message)) return "elevenlabs";
  return idFournisseur(parDefaut);
}

/** L'erreur dit-elle « crédit insuffisant » (code `quota` non réessayable, ou message Anthropic) ? */
export function estCreditInsuffisant(e: unknown): boolean {
  const x = e as { code?: string; reessayable?: boolean; message?: string; erreur?: { code?: string; reessayable?: boolean } } | null;
  const code = x?.code ?? x?.erreur?.code;
  const reessayable = x?.reessayable ?? x?.erreur?.reessayable;
  if (code === "quota" && reessayable !== true) return true;
  return /credit balance is too low/i.test(x?.message ?? "");
}

/**
 * Notification « épuisé » (cloche + e-mail), UNE seule par fournisseur : pas de nouvelle avant une recharge (constatée
 * ou déclarée, `apresRecharge`) ou 24 h. Aucun appel réseau : utilisable sous le verrou.
 */
export async function signalerAttenteCredit(video: Pick<Video, "id" | "titre"> | null, fournisseur: string, estDemo?: boolean): Promise<void> {
  const id = idFournisseur(fournisseur);
  const nom = nomFournisseur(id);
  // Claude en mode « abonnements » : l'alerte ne part (cloche + e-mail) que si TOUS les comptes retenus sont épuisés, avec
  // une phrase sans « recharger » (un forfait se renouvelle). Un refus isolé (billing_error dans le flux, compte suivant
  // encore prêt) n'alerte pas. Mode « api » (choix de Will) : l'alerte « Rechargez » d'avant.
  let comptes: number | undefined;
  if (id === "anthropic" && (await lireReglageSourcesClaude()).mode === "abonnements") {
    const { envClaude } = await import("./generation-claude");
    const choix = await choisirSourceClaude([], envClaude());
    if (choix.etat !== "tous-epuises") {
      await journaliser("credits", `En attente de crédit ${nom}${video ? ` : « ${video.titre} »` : ""}`, video ? { type: "video", id: video.id } : undefined);
      return;
    }
    comptes = choix.comptes;
  }
  const dernier = await lireParametre<string | null>(`credits.epuise.${id}`, null);
  if (!dernier || Date.now() - new Date(dernier).getTime() >= DELAI_RAPPEL_EPUISE_MS) {
    // Réservé AVANT (des appels simultanés ne doublent pas l'alerte), rendu si la notification n'a pas pu partir.
    await ecrireParametre(`credits.epuise.${id}`, maintenant());
    try {
      const s = await soldeFournisseur(id, null);
      const cout = s.unite === "usd" ? coutMoyenUnite(await depots().depenses.lister(depenseChez(id)), id, await taux()) : null;
      const m = messageEpuise({ nom, fournisseur: id, disponibleTexte: texteMontant(s.unite, s.disponible === null ? null : Math.max(0, s.disponible)), restantes: s.disponible === null ? null : videosRestantes(s.disponible, cout), comptes });
      await creerNotification({ type: "credit", titre: m.titre, message: m.message, lien: "/reglages#credits", estDemo }, { email: true });
    } catch (e) {
      await ecrireParametre(`credits.epuise.${id}`, dernier);
      throw e;
    }
    // « Épuisé » couvre aussi « plus qu'une », « ≈ 10 » et 50 / 25 / 10 % : pas d'alerte « ≈ 0 » au passage suivant.
    const deja = await lireParametre<string[]>(`credits.alertes.${id}`, []);
    await ecrireParametre(`credits.alertes.${id}`, [...new Set([...deja, "une-video", "10-videos", "50", "25", "10"])]);
  }
  await journaliser("credits", `En attente de crédit ${nom}${video ? ` : « ${video.titre} »` : ""}`, video ? { type: "video", id: video.id } : undefined);
}

/* ------------------------------------------------------------------ */
/* Surveillance (boucle de fond, HORS verrou)                          */
/* ------------------------------------------------------------------ */

const cleSurveillance = Symbol.for("studio-axion-ia.surveillance-credits");
type AvecSurveillance = typeof globalThis & { [cleSurveillance]?: number };
export const INTERVALLE_SURVEILLANCE_MS = 60_000;
export const INTERVALLE_RAPPROCHEMENT_MS = 24 * 60 * 60_000;

/**
 * Un passage de surveillance (au plus une fois par minute) : rapprochement quotidien des soldes réels, alertes
 * 50 / 25 / 10 % et « plus qu'une vidéo », rappel d'expiration fal.ai, brouillons prêts à partir.
 * `force` : tests. Ne lance jamais une fabrication (elle exige la session de Will) : elle prévient.
 */
export async function surveillerCredits(options: { force?: boolean; instant?: number } = {}): Promise<void> {
  const g = globalThis as AvecSurveillance;
  const instant = options.instant ?? Date.now();
  if (!options.force && g[cleSurveillance] && instant - g[cleSurveillance]! < INTERVALLE_SURVEILLANCE_MS) return;
  g[cleSurveillance] = instant;
  const d = depots();
  const t = await taux();
  for (const l of lecteurs()) {
    const presente = aUneCle(l);
    // 1. Rapprochement quotidien (soldes réels).
    if (l.mode === "reel" && presente && l.lireSolde) {
      const dernier = await lireParametre<string | null>(`credits.rapprochement.${l.fournisseur}`, null);
      if (!dernier || instant - new Date(dernier).getTime() >= INTERVALLE_RAPPROCHEMENT_MS) {
        await ecrireParametre(`credits.rapprochement.${l.fournisseur}`, new Date(instant).toISOString());
        try {
          const r = await lireEtRanger(l);
          if (r.attenduCentimes !== undefined && rapprochement(r.centimes, r.attenduCentimes).inexplique) {
            const u = uniteDe(l.fournisseur);
            await creerNotification({ type: "credit", titre: `Dépense inexpliquée chez ${l.nom}`, message: `Solde lu ${texteMontant(u, r.centimes)}, attendu ${texteMontant(u, r.attenduCentimes)}. Vérifiez le compte ${l.nom}.`, lien: "/reglages#credits" }, { email: true });
            await journaliser("credits", `Rapprochement ${l.nom} : écart de plus de 10 %`);
          }
        } catch (e) {
          if (e instanceof ErreurLecture && e.code === "refuse") await marquerCleRefusee(l.fournisseur, true);
        }
      }
    }
    // 2. Alertes de seuil (soldes en dollars).
    const s = await soldeFournisseur(l.fournisseur, null);
    if (s.disponible !== null && s.unite === "usd") {
      const depenses = await d.depenses.lister(depenseChez(l.fournisseur));
      const reference = s.mode === "suivi" ? (soldeSuivi(await d.recharges.lister(), depenses, l.fournisseur, t)?.recharge ?? null) : soldeDeReference(await d.relevesSoldes.lister((r) => r.fournisseur === l.fournisseur && r.mode === "reel"));
      const cout = coutMoyenUnite(depenses, l.fournisseur, t);
      const deja = await lireParametre<string[]>(`credits.alertes.${l.fournisseur}`, []);
      const pct = pourcentage(s.disponible, reference);
      const a = alerteAEnvoyer(pct, s.disponible, cout, deja);
      if (a) {
        // Les seuils plus hauts sont considérés comme passés (pas trois alertes d'un coup).
        // Une alerte « ≈ N unités » couvre aussi les pourcentages déjà franchis (un seul e-mail par franchissement).
        const franchis = ["50", "25", "10"].filter((x) => pct !== null && pct < Number(x));
        const passes = a.cle === "une-video" ? [...new Set([...deja, "une-video", "10-videos", ...franchis])] : a.cle === "10-videos" ? [...new Set([...deja, "10-videos", ...franchis])] : [...new Set([...deja, ...["50", "25", "10"].filter((x) => Number(x) >= Number(a.cle))])];
        await ecrireParametre(`credits.alertes.${l.fournisseur}`, passes);
        // 50 % : un repère au journal ; 25 % : cloche ; 10 % et « plus qu'une vidéo » : cloche et e-mail.
        if (a.cle === "50") await journaliser("credits", `${l.nom} : moitié du crédit utilisée`);
        else {
          const m = messageAlerteCredit({ nom: l.nom, fournisseur: l.fournisseur, cle: a.cle, disponibleTexte: texteMontant("usd", s.disponible) ?? "", restantes: videosRestantes(s.disponible, cout) });
          await creerNotification({ type: "credit", titre: m.titre, message: m.message, lien: "/reglages#credits" }, { email: a.email });
        }
      }
    }
    // 3. Expiration (fal.ai) : un rappel par recharge, 30 jours avant.
    for (const r of expirationsProches(await d.recharges.lister((x) => idFournisseur(x.fournisseur) === l.fournisseur), instant)) {
      if (await lireParametre<boolean>(`credits.expiration.${r.id}`, false)) continue;
      await ecrireParametre(`credits.expiration.${r.id}`, true);
      await creerNotification({ type: "credit", titre: `Crédits ${l.nom} bientôt expirés`, message: `${formaterDollars(r.centimes)} expirent le ${new Date(r.expireLe!).toLocaleDateString("fr-FR")}.`, lien: "/reglages#credits" }, { email: true });
    }
  }
  // 4. Brouillons « lancer dès que possible » que le crédit permet maintenant : Will est prévenu (une fois).
  const brouillons = await d.videos.lister((x) => !!x.lancementEnAttente && x.statut === "brouillon");
  if (!brouillons.length) return;
  const { construireCommande } = await import("./fabrication");
  const { moteurDeCommande } = await import("@/moteurs");
  for (const v of brouillons) {
    if (await lireParametre<boolean>(`credits.lancementPret.${v.id}`, false)) continue;
    try {
      const c = await construireCommande(v.id);
      const e = await moteurDeCommande(c).estimer(c);
      if ((await manquesPour(e.lignes)).manques.length) continue;
      // E2E-1 n° 2 : une version en attente faute de BUDGET ne part pas tant que le budget ne le permet pas.
      if (e.total.centimes > (await resumeBudget()).restant.centimes) continue;
    } catch {
      continue;
    }
    await ecrireParametre(`credits.lancementPret.${v.id}`, true);
    await creerNotification({ type: "credit", titre: "Crédit disponible", message: `« ${v.titre} » part dès que vous ouvrez le studio.`, lien: "/", estDemo: v.estDemo });
  }
}
