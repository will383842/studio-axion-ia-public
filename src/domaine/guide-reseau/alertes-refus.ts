/**
 * Alertes « refus d'envoi réglable » : PUR, sans réseau ni base. Dit quelles raisons de refus du message privé méritent UNE alerte
 * interne (cloche du Studio seulement) parce que le fondateur peut les corriger par un réglage. Aucune décision d'envoi dessus.
 * Un message ne contient JAMAIS le nom d'une page, un identifiant de compte ni une racine de personne : réseau + rang seulement.
 */
import type { CodeMotifRefus, RaisonRefus } from "./raison-refus";

export const MOTIFS_REGLABLES = [
  "messagerie-desactivee-sur-la-page",
  "messagerie-instagram-desactivee",
  "droits-manquants",
  "inbox-zernio-requise",
  "quota-messages-zernio",
] as const;
export type MotifReglable = (typeof MOTIFS_REGLABLES)[number];

/** Sources du motif qui reposent sur des éléments fermés. `phrase` n'en fait pas partie (exception unique ci-dessous). */
export const SOURCES_DECISION = ["nombres", "code-zernio", "statut"] as const;

export interface RefusVu {
  racine: string;
  idCompte: string;
  reseau: "facebook" | "instagram";
  raison: RaisonRefus & { le: string };
}
export interface AlerteRefus {
  sujet: string;
  message: string;
}

const JOUR_MS = 24 * 3600_000;
export const DELAI_REFUS_RECENT_MS = 7 * JOUR_MS;
export const DELAI_REPETITION_ALERTE_MS = 7 * JOUR_MS;
export const PLAFOND_ALERTES_PAR_APPEL = 3;
/** Bornes d'une date de refus : pas plus de 60 secondes dans le futur (horloges légèrement décalées tolérées). */
const TOLERANCE_FUTUR_MS = 60_000;
/** Personnes distinctes exigées sur le MÊME compte pour un motif propre à un compte. */
const PERSONNES_MINI_PAR_COMPTE = 2;
const MOTIF_PAGE: MotifReglable = "messagerie-desactivee-sur-la-page";
/** Réglages de l'abonnement Zernio : un seul sujet pour tous les comptes. */
const MOTIFS_GLOBAUX: readonly CodeMotifRefus[] = ["inbox-zernio-requise", "quota-messages-zernio"];

const estReglable = (m: string): m is MotifReglable => (MOTIFS_REGLABLES as readonly string[]).includes(m);
const sujetDe = (r: RefusVu): string => (MOTIFS_GLOBAUX.includes(r.raison.motif) ? `refus:${r.raison.motif}` : `refus:${r.raison.motif}:${r.idCompte}`);
const dateMs = (r: RefusVu): number => Date.parse(r.raison.le);

const MESSAGES: Readonly<Record<MotifReglable, (compte: string) => string>> = {
  "messagerie-desactivee-sur-la-page": (c) => `${c} : d'après le message du réseau, la messagerie de la page semble désactivée. Activez la messagerie dans les réglages de la page.`,
  "messagerie-instagram-desactivee": (c) => `${c} : le compte Instagram refuse l'accès aux messages privés. Dans l'application Instagram, autorisez l'accès aux messages pour les outils connectés.`,
  "droits-manquants": (c) => `${c} : Zernio n'a pas le droit d'envoyer des messages pour cette page. Reconnectez le compte dans Zernio en acceptant toutes les autorisations demandées.`,
  "inbox-zernio-requise": () => "Le module Inbox de Zernio n'est pas activé : activez-le dans votre abonnement Zernio.",
  "quota-messages-zernio": () => "Le quota de messages de Zernio est épuisé : augmentez-le dans votre abonnement Zernio ou attendez sa remise à zéro.",
};

/**
 * « Facebook » ou « Instagram », suivi de « n°k » quand plusieurs comptes du même réseau existent. Même calcul que l'alerte des jetons :
 * `comptes` est la liste des comptes Zernio, rang = position dans les identifiants triés du réseau. Compte absent de la liste : pas de numéro.
 */
function libelleCompte(r: RefusVu, comptes: readonly { idCompte: string; reseau: string }[]): string {
  const nom = r.reseau === "instagram" ? "Instagram" : "Facebook";
  const ids = comptes.filter((c) => c.reseau === r.reseau).map((c) => c.idCompte).sort();
  const rang = ids.indexOf(r.idCompte);
  return ids.length > 1 && rang >= 0 ? `${nom} n°${rang + 1}` : nom;
}

/** Motifs propres à un compte : retenus seulement si au moins 2 personnes distinctes (racines) sont refusées sur le même compte. */
const MOTIFS_PAR_COMPTE: readonly CodeMotifRefus[] = ["droits-manquants", "messagerie-instagram-desactivee"];
function refusParCompte(refus: readonly RefusVu[]): RefusVu[] {
  const personnes = new Map<string, Set<string>>();
  const cle = (r: RefusVu) => `${r.raison.motif}:${r.idCompte}`;
  for (const r of refus) if (MOTIFS_PAR_COMPTE.includes(r.raison.motif)) personnes.set(cle(r), (personnes.get(cle(r)) ?? new Set()).add(r.racine));
  return refus.filter((r) => !MOTIFS_PAR_COMPTE.includes(r.raison.motif) || (personnes.get(cle(r))?.size ?? 0) >= PERSONNES_MINI_PAR_COMPTE);
}

/** Refus de la messagerie de la page connus par leur phrase : retenus seulement si statut 4xx et au moins 2 personnes distinctes sur le même compte en 24 h. */
function refusPageParPhrase(refus: readonly RefusVu[], maintenantMs: number): RefusVu[] {
  const candidats = refus.filter((r) => r.raison.motif === MOTIF_PAGE && r.raison.source === "phrase" && r.raison.statut !== null && r.raison.statut >= 400 && r.raison.statut <= 499 && maintenantMs - dateMs(r) <= JOUR_MS && dateMs(r) <= maintenantMs + TOLERANCE_FUTUR_MS);
  const personnes = new Map<string, Set<string>>();
  for (const r of candidats) personnes.set(r.idCompte, (personnes.get(r.idCompte) ?? new Set()).add(r.racine));
  return candidats.filter((r) => (personnes.get(r.idCompte)?.size ?? 0) >= 2);
}

export function alertesRefus(e: {
  refus: readonly RefusVu[];
  dejaAlertees: Readonly<Record<string, string>>;
  comptesTries: readonly { idCompte: string; reseau: string }[]; // comptes Zernio (même liste que l'alerte des jetons), dans n'importe quel ordre
  maintenantMs: number;
}): AlerteRefus[] {
  const recents = e.refus.filter((r) => estReglable(r.raison.motif) && Number.isFinite(dateMs(r)) && e.maintenantMs - dateMs(r) <= DELAI_REFUS_RECENT_MS && dateMs(r) <= e.maintenantMs + TOLERANCE_FUTUR_MS);
  const retenus = [
    ...refusParCompte(recents.filter((r) => (SOURCES_DECISION as readonly string[]).includes(r.raison.source))),
    ...refusPageParPhrase(recents, e.maintenantMs),
  ];
  // Un sujet : son refus retenu le plus récent (sert à vérifier qu'un refus est arrivé après la dernière alerte) et un refus pour le libellé.
  const parSujet = new Map<string, RefusVu>();
  for (const r of retenus) {
    const s = sujetDe(r);
    const avant = parSujet.get(s);
    if (!avant || dateMs(r) > dateMs(avant)) parSujet.set(s, r);
  }
  const sortie: AlerteRefus[] = [];
  for (const sujet of [...parSujet.keys()].sort()) {
    const r = parSujet.get(sujet)!;
    const note = e.dejaAlertees[sujet];
    if (note !== undefined) {
      const derniere = Date.parse(note);
      // Date illisible : on considère le sujet déjà alerté (mieux vaut se taire que répéter).
      if (!Number.isFinite(derniere)) continue;
      if (e.maintenantMs - derniere < DELAI_REPETITION_ALERTE_MS || dateMs(r) <= derniere) continue;
    }
    sortie.push({ sujet, message: MESSAGES[r.raison.motif as MotifReglable](libelleCompte(r, e.comptesTries)) });
    if (sortie.length >= PLAFOND_ALERTES_PAR_APPEL) break;
  }
  return sortie;
}
