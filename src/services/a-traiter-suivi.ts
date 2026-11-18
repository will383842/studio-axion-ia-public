/**
 * À TRAITER · SUIVI (ATR-02a). Priorité à 4 niveaux, spam masqué, délai de réponse, rappels de cloche en journée, compteurs.
 * Fonctions pures (sauf `deposerRappelsCloche`, dont toutes les dépendances sont injectables). AUCUN appelant n'est branché :
 * rien ne déclenche `deposerRappelsCloche` aujourd'hui. Aucune réponse n'est envoyée, rien n'est supprimé.
 * Données : jamais d'identifiant de personne ; seulement l'extrait déjà échappé, lu pour classer, jamais recopié dans un message.
 *
 * Valeurs du fondateur (12/11) : 4 heures sans réponse, rappels de 8 h à 20 h seulement, cloche seule (ni push ni e-mail).
 * PROPOSITIONS du pilotage (à valider) : les créneaux 9 h / 13 h / 19 h et les listes de mots ci-dessous.
 */
import { detecterAEcrireSoiMeme } from "./a-traiter-kit";
import { formateurDate } from "@/lib/intl";
import type { CarteATraiter } from "./a-traiter-types";

export type Priorite = 1 | 2 | 3 | 4;

/** PROPOSITION du pilotage : mots d'une demande commerciale ou de rendez-vous (sans accent, en minuscules). */
export const MOTS_COMMERCIAUX = ["devis", "tarif", "rendez-vous", "rdv", "appel", "demo", "offre"] as const;
/** PROPOSITION du pilotage : mots qui signalent un message indésirable (sans accent, en minuscules). */
export const MOTS_SPAM = ["crypto", "casino", "gagnez", "followers"] as const;
/** PROPOSITION du pilotage : heures de Paris des trois créneaux de rappel (le créneau dure toute l'heure). */
export const CRENEAUX_RAPPEL: readonly number[] = [9, 13, 19];
/** Valeurs du fondateur. */
export const DELAI_RAPPEL_HEURES = 4;
export const HEURE_DEBUT_RAPPELS = 8;
export const HEURE_FIN_RAPPELS = 20;
export const REGLAGE_RAPPELS_ACTIFS = "a_traiter.rappels_actifs";

const sansAccent = (t: string): string =>
  t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const motPresent = (texte: string, mots: readonly string[]): boolean =>
  mots.some((m) => new RegExp(`(^|[^a-z0-9])${m}s?($|[^a-z0-9])`).test(texte));

const RE_MOTS_PRIX = /\b(?:prix|tarifs?|combien|co[uû]te[a-z]*|co[uû]ts?|payants?|gratuit[es]*|abonnements?|euros?|tarification)\b|[€$]/gi;

/** 1 réclamation ou colère ; 2 demande commerciale ou de rendez-vous ; 3 mot du guide ; 4 le reste. */
export function prioriteCarte(c: Pick<CarteATraiter, "extrait" | "mot">): Priorite {
  let raison = detecterAEcrireSoiMeme(c.extrait);
  // « prix » est testé avant réclamation et colère dans le kit : on retire les mots de prix pour ne pas masquer une plainte.
  if (raison === "prix") raison = detecterAEcrireSoiMeme(c.extrait.replace(RE_MOTS_PRIX, " "));
  if (raison === "reclamation" || raison === "colere") return 1;
  if (motPresent(sansAccent(c.extrait), MOTS_COMMERCIAUX)) return 2;
  if (c.mot) return 3;
  return 4;
}

/** Vrai si l'extrait contient au moins 2 liens ou un mot de `MOTS_SPAM`. */
export function estSpam(c: Pick<CarteATraiter, "extrait">): boolean {
  const t = sansAccent(c.extrait);
  const liens = t.match(/https?:\/\/|www\./g)?.length ?? 0;
  return liens >= 2 || motPresent(t, MOTS_SPAM);
}

/** Cartes à traiter hors spam, triées par priorité puis par date la plus ancienne (tri stable). */
export function trierParPriorite(cartes: readonly CarteATraiter[]): CarteATraiter[] {
  return cartes
    .filter((c) => c.statut === "a_traiter" && !estSpam(c))
    .map((c, i) => ({ c, i, p: prioriteCarte(c) }))
    .sort((a, b) => a.p - b.p || a.c.creeLe.localeCompare(b.c.creeLe) || a.i - b.i)
    .map((x) => x.c);
}

/** Cartes masquées (spam) : elles restent dans le dépôt, rien n'est supprimé. */
export const cartesMasquees = (cartes: readonly CarteATraiter[]): CarteATraiter[] => cartes.filter(estSpam);

/** Minutes entre la création et le « fait », ou null (pas de « fait », ou dates illisibles). */
export function delaiReponseMinutes(c: Pick<CarteATraiter, "creeLe" | "faitLe">): number | null {
  if (!c.faitLe) return null;
  const d = Date.parse(c.faitLe) - Date.parse(c.creeLe);
  return Number.isFinite(d) ? Math.round(d / 60_000) : null;
}

export interface ReglageRappels {
  /** Heures sans réponse avant qu'une carte soit due (défaut 4). */
  delaiHeures?: number;
  /** Heures de Paris des créneaux (défaut `CRENEAUX_RAPPEL`). */
  creneaux?: readonly number[];
}

/** Jour, heure et minute à Paris pour un instant donné. */
function parisDe(d: Date): { jour: string; minutes: number; heure: number } {
  const p = Object.fromEntries(
    formateurDate("en-GB", { timeZone: "Europe/Paris", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  const heure = Number(p.hour);
  return { jour: `${p.year}-${p.month}-${p.day}`, heure, minutes: heure * 60 + Number(p.minute) };
}

const estEnRetard = (c: CarteATraiter, maintenant: Date, delaiHeures: number): boolean => {
  if (c.statut !== "a_traiter" || c.opposee === true || estSpam(c)) return false;
  const age = maintenant.getTime() - Date.parse(c.creeLe);
  return Number.isFinite(age) && age >= delaiHeures * 3_600_000;
};

/** Créneau de Paris en cours (ex. 9), ou null : jamais avant 8 h ni après 20 h 00, et seulement dans un créneau. */
function creneauEnCours(maintenant: Date, creneaux: readonly number[]): number | null {
  const { heure, minutes } = parisDe(maintenant);
  if (minutes < HEURE_DEBUT_RAPPELS * 60 || minutes > HEURE_FIN_RAPPELS * 60) return null;
  return creneaux.includes(heure) ? heure : null;
}

/** Cartes dues pour un rappel : « a_traiter », non spam, non opposée, sans réponse depuis `delaiHeures`, et dans un créneau. */
export function rappelsDus(cartes: readonly CarteATraiter[], maintenant: Date, reglage: ReglageRappels = {}): CarteATraiter[] {
  if (creneauEnCours(maintenant, reglage.creneaux ?? CRENEAUX_RAPPEL) === null) return [];
  const delai = reglage.delaiHeures ?? DELAI_RAPPEL_HEURES;
  return cartes.filter((c) => estEnRetard(c, maintenant, delai));
}

export interface Compte {
  arrives: number;
  repondus: number;
  enRetard: number;
}
export interface Compteurs {
  parReseau: Record<string, Compte>;
  /** réseau → repère du post → compte. */
  parPost: Record<string, Record<string, Compte>>;
}

/** Arrivés, répondus (« fait ») et en retard, par réseau et par post. Les cartes spam (masquées) ne comptent pas. */
export function compteurs(cartes: readonly CarteATraiter[], maintenant: Date = new Date(), reglage: ReglageRappels = {}): Compteurs {
  const delai = reglage.delaiHeures ?? DELAI_RAPPEL_HEURES;
  const out: Compteurs = { parReseau: {}, parPost: {} };
  const vide = (): Compte => ({ arrives: 0, repondus: 0, enRetard: 0 });
  for (const c of cartes) {
    if (estSpam(c)) continue;
    const r = (out.parReseau[c.reseau] ??= vide());
    const p = ((out.parPost[c.reseau] ??= {})[c.post] ??= vide());
    for (const x of [r, p]) {
      x.arrives += 1;
      if (c.statut === "fait") x.repondus += 1;
      if (estEnRetard(c, maintenant, delai)) x.enRetard += 1;
    }
  }
  return out;
}

export interface DependancesRappels {
  env?: Record<string, string | undefined>;
  maintenant?: () => Date;
  lireCartes?: () => Promise<CarteATraiter[]>;
  /** Valeur brute du réglage `a_traiter.rappels_actifs` : seul `true` l'allume. */
  lireReglage?: () => Promise<unknown>;
  creer?: (
    n: { type: "info"; titre: string; message: string; lien: string },
    options: { cloche: true },
  ) => Promise<unknown>;
  dejaDepose?: (cle: string) => Promise<boolean>;
  marquerDepose?: (cle: string) => Promise<void>;
  reglage?: ReglageRappels;
}
export type ResultatRappels = { depose: boolean; raison: string };

/** Mémoire de processus des créneaux déjà notifiés (perdue au redémarrage : à remplacer par un dépôt quand un appelant existera). */
const dejaFaits = new Set<string>();

/**
 * Dépose UNE cloche par créneau et par jour. Ne fait RIEN si `A_TRAITER_ENABLED` est éteint OU si le réglage
 * `a_traiter.rappels_actifs` (défaut faux) n'est pas exactement `true`. Cloche seule : ni push ni e-mail. Aucun appelant.
 */
export async function deposerRappelsCloche(deps: DependancesRappels = {}): Promise<ResultatRappels> {
  const { aTraiterActif } = await import("./a-traiter");
  if (!aTraiterActif(deps.env ?? process.env)) return { depose: false, raison: "interrupteur_eteint" };
  const lireReglage =
    deps.lireReglage ??
    (async () => (await import("./_commun")).lireParametre<unknown>(REGLAGE_RAPPELS_ACTIFS, false));
  if ((await lireReglage()) !== true) return { depose: false, raison: "rappels_eteints" };

  const maintenant = (deps.maintenant ?? (() => new Date()))();
  const creneau = creneauEnCours(maintenant, deps.reglage?.creneaux ?? CRENEAUX_RAPPEL);
  if (creneau === null) return { depose: false, raison: "hors_creneau" };

  const lireCartes = deps.lireCartes ?? (async () => (await import("./a-traiter-depot")).creerDepotParametre().lire());
  const dues = rappelsDus(await lireCartes(), maintenant, deps.reglage);
  if (dues.length === 0) return { depose: false, raison: "rien_a_rappeler" };

  const cle = `${parisDe(maintenant).jour}|${creneau}`;
  const deja = deps.dejaDepose ?? (async (k: string) => dejaFaits.has(k));
  const marquer = deps.marquerDepose ?? (async (k: string) => void dejaFaits.add(k));
  if (await deja(cle)) return { depose: false, raison: "deja_depose" };

  const creer = deps.creer ?? (async (n, o) => (await import("./notifications")).creerNotification(n, o));
  const delai = deps.reglage?.delaiHeures ?? DELAI_RAPPEL_HEURES;
  const n = dues.length;
  await creer(
    {
      type: "info",
      titre: "À traiter : des commentaires attendent votre réponse",
      message:
        n === 1
          ? `Un commentaire attend votre réponse depuis plus de ${delai} heures. Ouvrez la liste À traiter pour le voir.`
          : `${n} commentaires attendent votre réponse depuis plus de ${delai} heures. Ouvrez la liste À traiter pour les voir.`,
      lien: "/a-traiter",
    },
    { cloche: true },
  );
  await marquer(cle);
  return { depose: true, raison: "cloche_deposee" };
}
