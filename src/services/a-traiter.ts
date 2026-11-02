/**
 * À TRAITER À LA MAIN (PV4) · file des commentaires que le Studio ne peut pas traiter seul. INERTE : tant que
 * `A_TRAITER_ENABLED` n'est pas exactement « 1 » ou « true », rien n'est enregistré ni modifié (issue « simule »).
 * Aucun appel réseau, aucun appel à Zernio. Le crochet Zernio appellera plus tard `enregistrerATraiter` (non branché ici).
 *
 * Stockage : AUCUNE migration. Les cartes passent par l'interface `DepotATraiter`, dont la valeur par défaut est une
 * MÉMOIRE DE PROCESSUS (perdue au redémarrage). Un vrai dépôt de données est à brancher plus tard via `injecterDepotATraiter`.
 *
 * Données : jamais de pseudo, de nom, d'adresse e-mail ni de message privé. Seulement réseau, repère du post, mot détecté,
 * extrait court du commentaire public (≤ 140 caractères, échappé), date, statut, kit de réponse validé par le contrôle de sortie.
 */
import "server-only";
import { creerVerrou, maintenant } from "./_commun";
import { controlerTexteSortant } from "./mots-controle";
import { lienGuideValide } from "./mots-kit";
import { poserStopCompte } from "./mots-service";
import { RE_MOT } from "./mots-textes";
import {
  EXTRAIT_MAX,
  MOTIFS,
  RESEAUX_A_TRAITER,
  VARIABLE_INTERRUPTEUR_A_TRAITER,
  extraitLisible,
  type CarteATraiter,
  type EntreeATraiter,
  type EtatVue,
  type Motif,
  type ReseauATraiter,
  type ResultatChangement,
  type StatutATraiter,
  type VueATraiter,
} from "./a-traiter-types";

// Ré-exports : les types et constantes vivent dans a-traiter-types.ts (sans accès base, utilisable côté navigateur).
export { EXTRAIT_MAX, MOTIFS, RESEAUX_A_TRAITER, VARIABLE_INTERRUPTEUR_A_TRAITER, extraitLisible };
export type { CarteATraiter, EntreeATraiter, EtatVue, Motif, ReseauATraiter, ResultatChangement, StatutATraiter, VueATraiter };


type Env = Record<string, string | undefined>;

/** Interrupteur : éteint par défaut (seules les valeurs exactes « 1 » ou « true » l'allument). */
export function aTraiterActif(env: Env = process.env): boolean {
  const v = env[VARIABLE_INTERRUPTEUR_A_TRAITER];
  return v === "1" || v === "true";
}

/* ---- Dépôt injectable ---- */
export interface DepotATraiter {
  lire(): Promise<CarteATraiter[]>;
  ecrire(cartes: CarteATraiter[]): Promise<void>;
}
export function creerDepotMemoire(): DepotATraiter {
  let cartes: CarteATraiter[] = [];
  return {
    lire: async () => cartes.map((c) => ({ ...c })),
    ecrire: async (n) => void (cartes = n.map((c) => ({ ...c }))),
  };
}
let depotCourant: DepotATraiter = creerDepotMemoire();
export const injecterDepotATraiter = (d: DepotATraiter | null): void => void (depotCourant = d ?? creerDepotMemoire());
const verrou = creerVerrou();

/* ---- Fonctions pures ---- */
const ECHAPPEMENTS: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const CARACTERES_DE_CONTROLE = /[\u0000-\u001F\u007F​-‏⁠-⁤﻿]+/g;
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
const PSEUDO = /@[\p{L}\p{N}_.]+/gu;

/** Extrait public : sans adresse ni pseudo, espaces réduits, échappé, au plus 140 caractères (entités jamais coupées). */
export function fabriquerExtrait(commentaire: string): string {
  const net = String(commentaire ?? "")
    .replace(CARACTERES_DE_CONTROLE, " ")
    .replace(EMAIL, "…")
    .replace(PSEUDO, "…")
    .replace(/\s+/g, " ")
    .trim();
  let sortie = "";
  for (const c of net) {
    const e = ECHAPPEMENTS[c] ?? c;
    if (sortie.length + e.length > EXTRAIT_MAX) break;
    sortie += e;
  }
  return sortie;
}

export const estReseauATraiter = (v: unknown): v is ReseauATraiter => typeof v === "string" && (RESEAUX_A_TRAITER as readonly string[]).includes(v);
const estMotif = (v: unknown): v is Motif => typeof v === "string" && (MOTIFS as readonly string[]).includes(v);
const RE_ID = /^[A-Za-z0-9._:|-]{1,100}$/;

export type RefusEntree = "id_invalide" | "reseau_inconnu" | "motif_inconnu" | "post_invalide" | "mot_invalide" | "lien_invalide";

/** Construit une carte à partir d'un événement. Le kit refusé par le contrôle de sortie est laissé vide (la carte reste). */
export function construireCarte(e: EntreeATraiter, horodatage: string): { ok: true; carte: CarteATraiter } | { ok: false; code: RefusEntree } {
  if (!RE_ID.test(e.idEvenement ?? "")) return { ok: false, code: "id_invalide" };
  if (!estReseauATraiter(e.reseau)) return { ok: false, code: "reseau_inconnu" };
  if (!estMotif(e.motif)) return { ok: false, code: "motif_inconnu" };
  if (!RE_ID.test(e.post ?? "")) return { ok: false, code: "post_invalide" };
  const mot = e.mot == null || e.mot === "" ? null : String(e.mot).trim().toUpperCase();
  if (mot !== null && !RE_MOT.test(mot)) return { ok: false, code: "mot_invalide" };
  const lien = e.lienPost ?? null;
  if (lien !== null && !lienGuideValide(lien)) return { ok: false, code: "lien_invalide" };
  const kit = e.reponse && controlerTexteSortant("reponse_publique", e.reponse).length === 0 ? e.reponse : null;
  return {
    ok: true,
    carte: { idEvenement: e.idEvenement, reseau: e.reseau, post: e.post, lienPost: lien, mot, motif: e.motif, extrait: fabriquerExtrait(e.commentaire), creeLe: e.creeLe ?? horodatage, statut: "a_traiter", kit },
  };
}

const POIDS: Record<Motif, number> = { echec_envoi: 0, mot_dans_phrase: 1, mot_inconnu: 2, mot_manuel: 3 };
/** Cartes à traiter, les plus prioritaires d'abord, puis les plus anciennes. */
export const cartesAFaire = (cartes: readonly CarteATraiter[]): CarteATraiter[] =>
  cartes.filter((c) => c.statut === "a_traiter").sort((a, b) => POIDS[a.motif] - POIDS[b.motif] || a.creeLe.localeCompare(b.creeLe));

/* ---- Service ---- */
export type ResultatEnregistrement =
  | { issue: "execute"; raison: "ajoute" | "deja_present" }
  | { issue: "simule"; raison: "interrupteur_eteint" }
  | { issue: "refuse"; raison: RefusEntree };

/** Point d'entrée du futur crochet (comment.received signé). Idempotent par identifiant d'événement. */
export async function enregistrerATraiter(entree: EntreeATraiter, o: { env?: Env; depot?: DepotATraiter } = {}): Promise<ResultatEnregistrement> {
  if (!aTraiterActif(o.env ?? process.env)) return { issue: "simule", raison: "interrupteur_eteint" };
  const depot = o.depot ?? depotCourant;
  return verrou(async () => {
    const r = construireCarte(entree, maintenant());
    if (!r.ok) return { issue: "refuse" as const, raison: r.code };
    const existantes = await depot.lire();
    if (existantes.some((c) => c.idEvenement === r.carte.idEvenement)) return { issue: "execute" as const, raison: "deja_present" as const };
    await depot.ecrire([...existantes, r.carte]);
    return { issue: "execute" as const, raison: "ajoute" as const };
  });
}

export async function lireVueATraiter(o: { env?: Env; depot?: DepotATraiter } = {}): Promise<VueATraiter> {
  if (!aTraiterActif(o.env ?? process.env)) return { etat: "desactive", cartes: [], compteur: null };
  try {
    const cartes = cartesAFaire(await (o.depot ?? depotCourant).lire());
    return { etat: cartes.length ? "normal" : "vide", cartes, compteur: cartes.length };
  } catch {
    return { etat: "illisible", cartes: [], compteur: null };
  }
}
/** Compteur ambre du menu : nombre à traiter, ou null (rien à afficher) quand éteint, vide ou illisible. */
export const compteurMenu = async (o: { env?: Env; depot?: DepotATraiter } = {}): Promise<number | null> => {
  const n = (await lireVueATraiter(o)).compteur;
  return n && n > 0 ? n : null;
};

async function changerStatut(id: string, statut: StatutATraiter, o: { env?: Env; depot?: DepotATraiter }): Promise<ResultatChangement> {
  if (!aTraiterActif(o.env ?? process.env)) return { issue: "simule", raison: "interrupteur_eteint" };
  const depot = o.depot ?? depotCourant;
  return verrou(async () => {
    const cartes = await depot.lire();
    if (!cartes.some((c) => c.idEvenement === id)) return { issue: "refuse", raison: "carte_inconnue" };
    await depot.ecrire(cartes.map((c) => (c.idEvenement === id ? { ...c, statut } : c)));
    return { issue: "execute", raison: statut };
  });
}
export const marquerCarteFaite = (id: string, o: { env?: Env; depot?: DepotATraiter } = {}) => changerStatut(id, "fait", o);
export const ignorerCarte = (id: string, o: { env?: Env; depot?: DepotATraiter } = {}) => changerStatut(id, "ignore", o);

/**
 * STOP : déclenche la mise à l'écart de PV-3 (`poserStopCompte`) TOUJOURS en simulation (environnement vide imposé :
 * le service existant ne peut rien exécuter). La carte est ensuite marquée faite si la simulation n'est pas refusée.
 */
export async function arreterDepuisCarte(id: string, compte: string, o: { env?: Env; depot?: DepotATraiter } = {}): Promise<ResultatChangement> {
  if (!aTraiterActif(o.env ?? process.env)) return { issue: "simule", raison: "interrupteur_eteint" };
  const r = await poserStopCompte({ compte, confirmeParOperateur: true, env: {} });
  if (r.issue === "refuse") return { issue: "refuse", raison: r.raison };
  const m = await changerStatut(id, "fait", o);
  return m.issue === "execute" ? { issue: "simule", raison: "stop_simule" } : m;
}

