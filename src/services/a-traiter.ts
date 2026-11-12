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
import { ESPACE_CONTACT_ZERNIO, ESPACES_TOUS, enregistrerOpposition, personneOpposeePartout } from "./oppositions-mots";
import { empreintePersonne, lireClesEmpreinte } from "@/domaine/guide-reseau/empreinte-personne";
import { decisionPourMot } from "@/domaine/guide-reseau/decision-mot";
import { estMotOpposition } from "@/domaine/guide-reseau/opposition";
import type { Canal } from "@/domaine/guide-reseau/origine-v3";
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
  const opposee = e.opposee === true;
  const kit = !opposee && e.reponse && controlerTexteSortant("reponse_publique", e.reponse).length === 0 ? e.reponse : null;
  return {
    ok: true,
    carte: { idEvenement: e.idEvenement, reseau: e.reseau, post: e.post, lienPost: lien, mot, motif: e.motif, extrait: fabriquerExtrait(e.commentaire), creeLe: e.creeLe ?? horodatage, statut: "a_traiter", kit, ...(opposee ? { opposee: true } : {}) },
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

/** Empreintes opaques (jamais l'identifiant) ; null si pas d'identifiant ou clés absentes. */
function empreintesDeContact(id: string | null | undefined): string[] | null {
  if (!id) return null;
  const c = lireClesEmpreinte(process.env);
  return c.ok ? ESPACES_TOUS.map((e) => empreintePersonne(c.courante, e, id)) : null;
}

/** Point d'entrée du futur crochet (comment.received signé). Idempotent par identifiant d'événement. */
export async function enregistrerATraiter(entree: EntreeATraiter, o: { env?: Env; depot?: DepotATraiter } = {}): Promise<ResultatEnregistrement> {
  if (!aTraiterActif(o.env ?? process.env)) return { issue: "simule", raison: "interrupteur_eteint" };
  const depot = o.depot ?? depotCourant;
  return verrou(async () => {
    const r = construireCarte(entree, maintenant());
    if (!r.ok) return { issue: "refuse" as const, raison: r.code };
    const empreintes = empreintesDeContact(entree.idContact);
    if (empreintes) r.carte.empreintes = empreintes;
    else if (entree.idContact) r.carte.kit = null; // empreintes impossibles à calculer : aucune réponse proposée
    const existantes = await depot.lire();
    if (existantes.some((c) => c.idEvenement === r.carte.idEvenement)) return { issue: "execute" as const, raison: "deja_present" as const };
    await depot.ecrire([...existantes, r.carte]);
    return { issue: "execute" as const, raison: "ajoute" as const };
  });
}

/* ---- Aiguillage d'un commentaire à mot (inerte tant que le drapeau est éteint) ---- */
export interface CommentaireAMot {
  idEvenement: string;
  post: string;
  /** Réseau du parcours guide (`linkedin_page` devient « linkedin » dans la file). */
  reseau: "instagram" | "facebook" | "linkedin_page" | "tiktok";
  canal: Canal;
  mot: string | null;
  commentaire: string;
  /** Identifiant opaque du contact (jamais affiché, jamais conservé ici) : sert seulement à savoir si la personne s'est déjà opposée. */
  idContact?: string | null;
}
/** Lecteur de la liste des mots connus (majuscules). Aucun lecteur réel n'est branché dans ce lot : sans lecteur, tout mot est inconnu. */
export type LecteurMots = () => Promise<readonly string[] | null>;
export type ResultatAiguillage =
  | { issue: "simule"; raison: "interrupteur_eteint" }
  | { issue: "refuse"; raison: RefusEntree }
  | { issue: "reessai"; raison: "registre_illisible" }
  | { issue: "execute"; action: "a_traiter"; raison: "ajoute" | "deja_present" }
  | { issue: "execute"; action: "reponse_publique" | "message_prive"; raison: "mot_connu"; motRetenu: string }
  | { issue: "execute"; action: "silence"; raison: "personne_opposee" | "opposition" };

/**
 * Personne opposée, ou « stop » / « arrêtez » : silence (aucune réponse, aucune carte). Mot inconnu : il reçoit GUIDE si GUIDE est
 * configuré. Sans GUIDE, mot absent ou liste illisible : la carte va dans « À traiter », JAMAIS d'envoi. Mot connu : retourne seulement la
 * décision (LinkedIn et TikTok : réponse publique seule) ; ce service n'envoie rien et n'écrit rien dans ce cas.
 * Registre des oppositions illisible : JAMAIS une mise à l'écart. Un « stop » est quand même enregistré (une erreur de cet
 * enregistrement remonte, pour nouvel essai) ; tout autre mot renvoie `reessai` : rien d'envoyé, rien d'écrit, l'appelant ne doit
 * pas marquer l'événement comme traité et le rejoue plus tard.
 */
export async function orienterCommentaire(c: CommentaireAMot, o: { env?: Env; depot?: DepotATraiter; lireMots?: LecteurMots } = {}): Promise<ResultatAiguillage> {
  if (!aTraiterActif(o.env ?? process.env)) return { issue: "simule", raison: "interrupteur_eteint" };
  let mots: readonly string[] | null = null;
  try {
    mots = o.lireMots ? await o.lireMots() : null;
  } catch {
    mots = null; // liste illisible : le mot est traité comme inconnu
  }
  let opposee = false;
  try {
    // « Stop partout » : sans identifiant il n'y a personne à vérifier (comportement inchangé) ; avec, une opposition sur n'importe quel réseau suffit.
    if (c.idContact) opposee = (await personneOpposeePartout({ idsBruts: [c.idContact] }, { douteBloque: true })).opposee;
  } catch {
    // Registre illisible : jamais « opposée ». Un « stop » est enregistré malgré tout ; le reste attend un nouvel essai.
    if (!estMotOpposition(c.mot)) return { issue: "reessai", raison: "registre_illisible" };
    if (c.idContact) await enregistrerOpposition(c.idContact, ESPACE_CONTACT_ZERNIO); // mise à l'écart, rien n'est supprimé ; si cela échoue aussi, l'erreur remonte
    return { issue: "execute", action: "silence", raison: "opposition" };
  }
  const d = decisionPourMot({ mot: c.mot, reseau: c.reseau, canal: c.canal, mots, opposee });
  if (d.action === "silence" && d.motif === "opposition" && c.idContact) await enregistrerOpposition(c.idContact, ESPACE_CONTACT_ZERNIO); // mise à l'écart, rien n'est supprimé
  if (d.action === "silence") return { issue: "execute", action: "silence", raison: d.motif };
  // Sans identifiant, impossible de savoir si la personne s'est opposée : JAMAIS d'envoi, la carte va à la main (sans réponse proposée).
  if (d.action !== "a_traiter" && c.idContact) return { issue: "execute", action: d.action, raison: "mot_connu", motRetenu: d.motRetenu };
  const r = await enregistrerATraiter(
    { idEvenement: c.idEvenement, reseau: c.reseau === "linkedin_page" ? "linkedin" : c.reseau, post: c.post, mot: c.mot, motif: d.action === "a_traiter" ? d.motif : "mot_manuel", commentaire: c.commentaire, idContact: c.idContact },
    { env: o.env, depot: o.depot },
  );
  if (r.issue === "refuse") return { issue: "refuse", raison: r.raison };
  if (r.issue === "simule") return r;
  return { issue: "execute", action: "a_traiter", raison: r.raison };
}

async function carteOpposee(c: CarteATraiter): Promise<boolean> {
  if (c.opposee) return true;
  if (!c.empreintes?.length) return false;
  try {
    return (await personneOpposeePartout({ empreintes: c.empreintes }, { douteBloque: true })).opposee;
  } catch {
    return true; // vérification impossible : fermé
  }
}

export async function lireVueATraiter(o: { env?: Env; depot?: DepotATraiter } = {}): Promise<VueATraiter> {
  if (!aTraiterActif(o.env ?? process.env)) return { etat: "desactive", cartes: [], compteur: null };
  try {
    // Carte d'une personne opposée : jamais de réponse proposée, quoi qu'il y ait en dépôt.
    // Revérification à chaque lecture : opposée OU vérification impossible => carte « opposée » (aucun envoi proposé).
    const cartes = await Promise.all(cartesAFaire(await (o.depot ?? depotCourant).lire()).map(async (c) => ((await carteOpposee(c)) ? { ...c, opposee: true, kit: null } : c)));
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

async function changerStatut(id: string, statut: StatutATraiter, o: { env?: Env; depot?: DepotATraiter }, plus: Partial<CarteATraiter> = {}): Promise<ResultatChangement> {
  if (!aTraiterActif(o.env ?? process.env)) return { issue: "simule", raison: "interrupteur_eteint" };
  const depot = o.depot ?? depotCourant;
  return verrou(async () => {
    const cartes = await depot.lire();
    if (!cartes.some((c) => c.idEvenement === id)) return { issue: "refuse", raison: "carte_inconnue" };
    await depot.ecrire(cartes.map((c) => (c.idEvenement === id ? { ...c, statut, ...plus } : c)));
    return { issue: "execute", raison: statut };
  });
}
export const marquerCarteFaite = (id: string, o: { env?: Env; depot?: DepotATraiter } = {}) => changerStatut(id, "fait", o);
/** La personne de cette carte a demandé l'arrêt : la carte n'offre plus aucun envoi. Rien n'est supprimé. */
export const marquerCarteOpposee = (id: string, o: { env?: Env; depot?: DepotATraiter } = {}) => changerStatut(id, "a_traiter", o, { opposee: true, kit: null });
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

