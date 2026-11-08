/**
 * MOTS (PV-3) · pose / pause / réactivation d'un mot, compte par compte, plafonds, disjoncteur, « Tout arrêter », STOP.
 * INERTE par défaut : `MOTS_ENABLED` absent = SIMULATION (la requête est construite et rendue, jamais exécutée, aucun état
 * modifié). Un appel réel exige, ensemble : interrupteur allumé · validation de l'opérateur · textes validés · « Tout arrêter »
 * non activé · disjoncteur fermé · exécuteur relié. Rien n'est supprimé chez Zernio ni dans le Studio : on pose, on met en
 * pause, on réactive. Aucune adresse e-mail n'est conservée (elle ne transite qu'en mémoire pour l'appel signé du STOP).
 */
import "server-only";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { cleIdempotence, RE_CLE_IDEMPOTENCE } from "@/domaine/guide-reseau/cle-idempotence";
import { signerAppel } from "@/fournisseurs/site/signature";
import type { TransportSite } from "@/fournisseurs/site/types";
import { depots, ecrireParametre, journaliser, lireParametre, maintenant, sousVerrou } from "./_commun";
import { construireGrapheMot, construireGrapheStop, estMotOpposition, type DefinitionWorkflow } from "./mots-graphe";
import { empreinteTextes, ETAT_VALIDE, lireTextesMarkdown, RE_MOT, textesDepuisSaisie, textesValides, type SaisieMot, type TextesMot } from "./mots-textes";
import { creerNotification } from "./notifications";
import { ESPACE_CONTACT_ZERNIO, enregistrerOppositionSousVerrou, marquerTransmise, PARAM_OPPOSITIONS_MOTS } from "./oppositions-mots";
import { ErreurEmpreinteIndisponible } from "@/domaine/guide-reseau/empreinte-personne";
import { comptesParcours, empreinteGuideParcours, titreGuideParcours } from "@/domaine/guide-reseau/empreinte-guide";
import { parcoursMotActif } from "./parcours-mot";
import { envoiZernioAutorise } from "./zernio";

export const VARIABLE_INTERRUPTEUR_MOTS = "MOTS_ENABLED";
export const PARAM_REGISTRE_MOTS = "mots.registre";
export const PARAM_GARDES_MOTS = "mots.gardes";
export const PARAM_VALIDATIONS_MOTS = "mots.validations";
/** Validation du GUIDE du parcours : clé SÉPARÉE de `mots.validations` (qui reste réservée aux autres mots). */
export const PARAM_VALIDATION_GUIDE_PARCOURS = "mots.validation.guide-parcours";
export { PARAM_OPPOSITIONS_MOTS };
export const DOSSIER_MOTS = "mots";
/** Plafond INTERNE absolu : jamais plus de 600 messages par heure et par compte, quel que soit le réglage. */
export const PLAFOND_HEURE_COMPTE_MAX = 600;
export const PLAFOND_JOUR_MOT_DEFAUT = 100;
export const ERREURS_CONSECUTIVES_MAX = 5;
export const CHEMIN_OPPOSITIONS_SITE = "/api/interne/oppositions-reseau"; // À CONFIRMER avec le site (route absente du contrat 04) : corps strict, adresse OBLIGATOIRE ; le Studio la relit chez Zernio, en mémoire seulement

/** Interrupteur du module : éteint par défaut (seules les valeurs exactes « 1 » ou « true » l'allument). */
export function motsActif(env: Record<string, string | undefined> = process.env): boolean {
  const v = env[VARIABLE_INTERRUPTEUR_MOTS];
  return v === "1" || v === "true";
}

type Env = Record<string, string | undefined>;

/* ------------------------------------------------------------------ */
/* Exécuteur Zernio (injecté ; aucun réel branché tant que l'essai n'a pas eu lieu)  */
/* ------------------------------------------------------------------ */

export interface RequeteMots {
  methode: "POST" | "PUT";
  /** ⚠ Chemins À CONFIRMER chez Zernio (aucune doc de workflows confirmée) : isolés ici, une seule source. */
  chemin: string;
  corps?: unknown;
}
export type ExecuteurMots = (r: RequeteMots) => Promise<{ statut: number; corps?: unknown }>;
let executeurInjecte: ExecuteurMots | null = null;
export function injecterExecuteurMots(e: ExecuteurMots | null): void {
  executeurInjecte = e;
}
export const requetePose = (w: DefinitionWorkflow, compte: string): RequeteMots => ({ methode: "POST", chemin: "/v1/workflows", corps: { compte, definition: w } });
export const requeteEtat = (idWorkflow: string, etat: "pause" | "actif"): RequeteMots => ({ methode: "PUT", chemin: `/v1/workflows/${encodeURIComponent(idWorkflow)}`, corps: { etat } });

/* ------------------------------------------------------------------ */
/* Registre et gardes (en base, paramètres : aucune migration)         */
/* ------------------------------------------------------------------ */

export type EtatMot = "non_pose" | "pause" | "actif" | "pause_auto";
export interface LigneMot {
  mot: string;
  compte: string;
  etat: EtatMot;
  idWorkflow: string | null;
  raison: string | null;
  modifieLe: string;
}
type Registre = Record<string, LigneMot>;
const cle = (mot: string, compte: string) => `${mot}|${compte}`;

export interface Gardes {
  disjoncteur: { ouvert: boolean; raison: string | null; ouvertLe: string | null };
  erreursConsecutives: number;
  plafonds: { heureCompte: number; jourMot: number };
  heures: Record<string, number>; // "compte|AAAA-MM-JJTHH" → messages
  jours: Record<string, number>; // "MOT|AAAA-MM-JJ" → messages
}
const GARDES_DEFAUT = (): Gardes => ({ disjoncteur: { ouvert: false, raison: null, ouvertLe: null }, erreursConsecutives: 0, plafonds: { heureCompte: PLAFOND_HEURE_COMPTE_MAX, jourMot: PLAFOND_JOUR_MOT_DEFAUT }, heures: {}, jours: {} });

/**
 * Bascule INTERNE aux tests (preuve « mutation » du test de course) : rétablit l'ancien comportement fautif (commit 797760d).
 * Inopérante hors tests : elle exige VITEST dans l'environnement et refuse de s'activer sinon ; les valeurs par défaut sont
 * le comportement sûr. Aucun chemin de production ne l'appelle.
 */
const ancienComportementTest = { sansGardeEcriture: false, noterHorsVerrou: false };
export function basculerAncienComportementPourTest(o: { sansGardeEcriture?: boolean; noterHorsVerrou?: boolean }): void {
  if (!process.env.VITEST) throw new Error("réservé aux tests");
  ancienComportementTest.sansGardeEcriture = o.sansGardeEcriture ?? false;
  ancienComportementTest.noterHorsVerrou = o.noterHorsVerrou ?? false;
}

const lireRegistre = async (): Promise<Registre> => lireParametre<Registre>(PARAM_REGISTRE_MOTS, {});
export async function lireGardes(): Promise<Gardes> {
  const g = await lireParametre<Partial<Gardes>>(PARAM_GARDES_MOTS, {});
  const d = GARDES_DEFAUT();
  return { ...d, ...g, disjoncteur: { ...d.disjoncteur, ...g.disjoncteur }, plafonds: { ...d.plafonds, ...g.plafonds } };
}
/**
 * Écriture des gardes (appelée sous verrou). Défense en profondeur : `ouvert` ne repasse JAMAIS de vrai à faux ici, même si
 * l'appelant a lu des gardes anciennes ; seul `refermerDisjoncteur` (`fermer: true`) peut le refermer.
 */
async function ecrireGardes(g: Gardes, fermer = false): Promise<void> {
  if (!fermer && !ancienComportementTest.sansGardeEcriture) {
    const actuel = await lireGardes();
    if (actuel.disjoncteur.ouvert && !g.disjoncteur.ouvert) g = { ...g, disjoncteur: actuel.disjoncteur };
  }
  await ecrireParametre(PARAM_GARDES_MOTS, g);
}

/** Plafonds réglables par l'opérateur, jamais au-dessus de 600 par heure et par compte. */
export async function reglerPlafonds(p: { heureCompte?: number; jourMot?: number }): Promise<Gardes["plafonds"]> {
  return sousVerrou(async () => {
    const g = await lireGardes();
    const borne = (v: number, max: number) => Math.max(0, Math.min(max, Math.floor(Number.isFinite(v) ? v : 0)));
    if (p.heureCompte !== undefined) g.plafonds.heureCompte = borne(p.heureCompte, PLAFOND_HEURE_COMPTE_MAX);
    if (p.jourMot !== undefined) g.plafonds.jourMot = borne(p.jourMot, 1_000_000);
    await ecrireGardes(g);
    return g.plafonds;
  });
}

/* ------------------------------------------------------------------ */
/* Disjoncteur                                                          */
/* ------------------------------------------------------------------ */

async function ouvrirDisjoncteur(raison: string): Promise<void> {
  const g = await lireGardes();
  if (g.disjoncteur.ouvert) return;
  g.disjoncteur = { ouvert: true, raison, ouvertLe: maintenant() };
  await ecrireGardes(g);
  await journaliser("mots", `ALERTE : disjoncteur des mots OUVERT (${raison}). Il ne se referme que par un geste de l'opérateur.`);
  await creerNotification({ type: "echec", titre: "Mots : disjoncteur ouvert", message: "Les mots sont à l'arrêt. Rien ne repart tant que vous ne l'avez pas refermé.", lien: "/mots" });
}

/** SEUL moyen de refermer le disjoncteur : un geste de l'opérateur (l'appelant exige la session). */
export async function refermerDisjoncteur(o: { confirmeParOperateur: boolean }): Promise<{ ok: boolean }> {
  if (!o.confirmeParOperateur) return { ok: false };
  return sousVerrou(async () => {
    const g = await lireGardes();
    g.disjoncteur = { ouvert: false, raison: null, ouvertLe: null };
    g.erreursConsecutives = 0;
    await ecrireGardes(g, true);
    await journaliser("mots", "Disjoncteur des mots refermé par l'opérateur.");
    return { ok: true };
  });
}

/* ------------------------------------------------------------------ */
/* Exécution gardée                                                     */
/* ------------------------------------------------------------------ */

export type Issue = "simule" | "execute" | "refuse";
export interface Resultat {
  issue: Issue;
  /** Code stable (pour l'écran et les tests) : jamais de détail technique. */
  raison: string;
  requete?: RequeteMots;
  idWorkflow?: string;
}
const refus = (raison: string, requete?: RequeteMots): Resultat => ({ issue: "refuse", raison, requete });

/** Appelle l'exécuteur ; compte les erreurs consécutives ; ouvre le disjoncteur au seuil. Seul point d'appel vers Zernio. */
async function executer(requete: RequeteMots): Promise<{ ok: boolean; corps?: unknown }> {
  if (!executeurInjecte) return { ok: false };
  let ok = false;
  let corps: unknown;
  try {
    const r = await executeurInjecte(requete);
    ok = r.statut >= 200 && r.statut < 300;
    corps = r.corps;
  } catch {
    ok = false;
  }
  const g = await lireGardes();
  g.erreursConsecutives = ok ? 0 : g.erreursConsecutives + 1;
  await ecrireGardes(g);
  if (!ok && g.erreursConsecutives >= ERREURS_CONSECUTIVES_MAX) await ouvrirDisjoncteur(`${ERREURS_CONSECUTIVES_MAX} erreurs consécutives`);
  return { ok, corps };
}

const idWorkflowDe = (corps: unknown): string | null => {
  const id = corps && typeof corps === "object" ? (corps as Record<string, unknown>).id : null;
  return typeof id === "string" && /^[A-Za-z0-9._:-]{1,100}$/.test(id) ? id : null;
};

async function enregistrerLigne(l: LigneMot): Promise<void> {
  const reg = await lireRegistre();
  reg[cle(l.mot, l.compte)] = l;
  await ecrireParametre(PARAM_REGISTRE_MOTS, reg);
}

interface Demande {
  env?: Env;
  /** Geste explicite de l'opérateur (l'appelant a exigé la session). */
  confirmeParOperateur: boolean;
}

/** Empreintes ENREGISTRÉES par le geste de validation (mot → empreinte des textes relus). Seule source de vérité de la pose. */
const lireValidations = async (): Promise<Record<string, string>> => lireParametre<Record<string, string>>(PARAM_VALIDATIONS_MOTS, {});

/** Geste de validation (l'appelant exige la session) : enregistre en base l'empreinte des textes tels que saisis. Sans effet réseau. */
export async function validerMot(d: { saisie: SaisieMot; confirmeParOperateur: boolean }): Promise<{ ok: boolean; raison: string; empreinte?: string }> {
  if (!d.confirmeParOperateur) return { ok: false, raison: "validation_operateur_absente" };
  const t = textesDepuisSaisie(d.saisie);
  if (!RE_MOT.test(t.mot)) return { ok: false, raison: "mot_invalide" };
  const g = construireGrapheMot({ ...t, etat: ETAT_VALIDE, empreinteValidee: empreinteTextes(t) });
  if (!g.ok) return { ok: false, raison: g.code };
  const empreinte = empreinteTextes(t);
  await sousVerrou(async () => {
    const v = await lireValidations();
    v[t.mot] = empreinte;
    await ecrireParametre(PARAM_VALIDATIONS_MOTS, v);
    await journaliser("mots", `Textes du mot ${t.mot} validés par l'opérateur.`);
  });
  return { ok: true, raison: "valide", empreinte };
}

/** Validation du GUIDE du parcours : l'empreinte des 4 textes réellement envoyés (voir empreinte-guide), enregistrée par le geste de l'opérateur. */
export interface ValidationGuideParcours {
  empreinte: string;
  valideLe: string;
}
export const lireValidationGuideParcours = (): Promise<ValidationGuideParcours | null> => lireParametre<ValidationGuideParcours | null>(PARAM_VALIDATION_GUIDE_PARCOURS, null);

/** Geste de validation du GUIDE (l'appelant exige la session). Idempotent : revalider les mêmes textes ne change rien. Sans effet réseau. */
export async function validerGuideParcours(d: { titre: string; confirmeParOperateur: boolean }): Promise<{ ok: boolean; raison: string; empreinte?: string }> {
  if (!d.confirmeParOperateur) return { ok: false, raison: "validation_operateur_absente" };
  const e = empreinteGuideParcours(d.titre);
  if (!e.ok) return { ok: false, raison: e.raison };
  await sousVerrou(async () => {
    if ((await lireValidationGuideParcours())?.empreinte === e.empreinte) return;
    await ecrireParametre(PARAM_VALIDATION_GUIDE_PARCOURS, { empreinte: e.empreinte, valideLe: maintenant() });
    await journaliser("mots", "Textes du mot GUIDE validés par l'opérateur.");
  });
  return { ok: true, raison: "valide", empreinte: e.empreinte };
}

/** POSE d'un mot sur un compte à partir d'une SAISIE : validé = l'empreinte ENREGISTRÉE correspond au texte actuel. */
export async function poserMot(d: Demande & { compte: string; saisie: SaisieMot }): Promise<Resultat> {
  const t = textesDepuisSaisie(d.saisie);
  const enregistree = (await lireValidations())[t.mot] ?? null;
  return poserTextes(d, enregistree ? { ...t, etat: ETAT_VALIDE, empreinteValidee: enregistree } : t);
}

/** POSE depuis `mots/<MOT>.md` (fichier du dépôt, maîtrisé côté serveur) : son état et son empreinte doivent être cohérents. */
export async function poserMotDepuisFichier(d: Demande & { compte: string; textes: TextesMot }): Promise<Resultat> {
  return poserTextes(d, textesValides(d.textes) ? d.textes : { ...d.textes, etat: "brouillon", empreinteValidee: null });
}

async function poserTextes(d: Demande & { compte: string }, textes: TextesMot): Promise<Resultat> {
  const env = d.env ?? process.env;
  const g = construireGrapheMot(textes);
  if (!g.ok) return refus(g.code);
  const requete = requetePose(g.workflow, d.compte);
  if (!d.confirmeParOperateur) return refus("validation_operateur_absente", requete);
  if (!(await envoiZernioAutorise())) return refus("tout_arrete", requete);
  if (!motsActif(env)) return { issue: "simule", raison: "interrupteur_eteint", requete };
  return sousVerrou(async () => {
    if ((await lireGardes()).disjoncteur.ouvert) return refus("disjoncteur_ouvert", requete);
    const r = await executer(requete);
    if (!r.ok) return refus("zernio_refuse", requete);
    const id = idWorkflowDe(r.corps);
    if (!id) return refus("reponse_inattendue", requete);
    await enregistrerLigne({ mot: textes.mot, compte: d.compte, etat: "pause", idWorkflow: id, raison: null, modifieLe: maintenant() });
    await journaliser("mots", `Mot ${textes.mot} posé (en pause) sur un compte.`);
    return { issue: "execute", raison: "pose", requete, idWorkflow: id };
  });
}

/**
 * ACTIVATION LOCALE (aucun appel réseau) : le registre local est la seule source de vérité de la machine de conversation.
 * Retourne le code du refus, ou null si tout est permis. Échec fermé : une panne de lecture refuse. À appeler sous verrou.
 */
async function refusActivationLocale(mot: string, compte: string, env: Env): Promise<string | null> {
  if (!comptesParcours(env).includes(compte)) return "compte_hors_liste";
  try {
    if (!motsActif(env)) return "interrupteur_eteint";
    if (mot === "GUIDE") {
      // Le GUIDE est validé par son empreinte, recalculée ici avec le titre du serveur (comme le parcours).
      const v = await lireValidationGuideParcours();
      if (!v) return "mot_non_valide";
      const e = empreinteGuideParcours(titreGuideParcours(env));
      if (!e.ok) return e.raison;
      if (e.empreinte !== v.empreinte) return "validation_perimee";
    } else if (!(await lireValidations())[mot]) return "mot_non_valide";
    if (!(await envoiZernioAutorise())) return "tout_arrete";
    if ((await lireGardes()).disjoncteur.ouvert) return "disjoncteur_ouvert";
  } catch {
    return "lecture_impossible";
  }
  return null;
}

/** Active le mot GUIDE sur un compte, EN LOCAL : ligne `{ etat: "actif", idWorkflow: null, raison: "local" }`, rien vers Zernio. */
export async function activerMotLocal(d: Demande & { mot: "GUIDE"; compte: string }): Promise<Resultat> {
  if (d.mot !== "GUIDE") return refus("mot_non_pris_en_charge");
  if (!d.confirmeParOperateur) return refus("validation_operateur_absente");
  const env = d.env ?? process.env;
  return sousVerrou(async () => {
    const existante = (await lireRegistre())[cle(d.mot, d.compte)];
    if (existante && !!existante.idWorkflow) return refus("deja_pose_chez_zernio");
    const motif = await refusActivationLocale(d.mot, d.compte, env);
    if (motif) return refus(motif);
    await enregistrerLigne({ mot: d.mot, compte: d.compte, etat: "actif", idWorkflow: null, raison: "local", modifieLe: maintenant() });
    await journaliser("mots", `Mot ${d.mot} activé en local sur un compte.`);
    return { issue: "execute", raison: "activation_locale" };
  });
}

/** Met en pause une ligne locale (jamais d'appel réseau). Toujours permis avec le geste de l'opérateur : la pause réduit le risque. */
export const mettreEnPauseLocal = (d: Demande & { mot: string; compte: string }) =>
  sousVerrou(async () => {
    // Une ligne posée chez Zernio (idWorkflow renseigné) se met en pause par `mettreEnPause` (appel Zernio), jamais en local.
    const ligne = (await lireRegistre())[cle(d.mot, d.compte)];
    if (ligne?.idWorkflow) return refus("ligne_zernio");
    return changerEtat(d, "pause");
  });

async function changerEtat(d: Demande & { mot: string; compte: string }, vers: "pause" | "actif", automatique = false): Promise<Resultat> {
  const env = d.env ?? process.env;
  const ligne = (await lireRegistre())[cle(d.mot, d.compte)];
  if (!ligne) return refus("mot_non_pose");
  if (!d.confirmeParOperateur && !automatique) return refus("validation_operateur_absente");
  // Ligne locale (idWorkflow nul) : changement d'état dans le registre, sans exécuteur ni compteur d'erreurs ni disjoncteur.
  if (!ligne.idWorkflow) {
    if (vers === "actif") {
      const motif = await refusActivationLocale(ligne.mot, ligne.compte, env);
      if (motif) return refus(motif);
    }
    await enregistrerLigne({ ...ligne, etat: vers === "actif" ? "actif" : automatique ? "pause_auto" : "pause", raison: vers === "actif" ? "local" : automatique ? "automatique" : "local", modifieLe: maintenant() });
    return { issue: "execute", raison: vers };
  }
  const requete = requeteEtat(ligne.idWorkflow, vers);
  // « Tout arrêter » et disjoncteur ouvert interdisent de (ré)activer ; la PAUSE reste toujours permise (elle réduit le risque).
  if (vers === "actif") {
    if (!(await envoiZernioAutorise())) return refus("tout_arrete", requete);
    if ((await lireGardes()).disjoncteur.ouvert) return refus("disjoncteur_ouvert", requete);
  }
  if (!motsActif(env)) return { issue: "simule", raison: "interrupteur_eteint", requete };
  const r = await executer(requete);
  if (!r.ok) return refus("zernio_refuse", requete);
  await enregistrerLigne({ ...ligne, etat: vers === "actif" ? "actif" : automatique ? "pause_auto" : "pause", raison: automatique ? "automatique" : null, modifieLe: maintenant() });
  return { issue: "execute", raison: vers, requete, idWorkflow: ligne.idWorkflow };
}

export const mettreEnPause = (d: Demande & { mot: string; compte: string }) => sousVerrou(() => changerEtat(d, "pause"));
export const reactiverMot = (d: Demande & { mot: string; compte: string }) => sousVerrou(() => changerEtat(d, "actif"));

/* ------------------------------------------------------------------ */
/* Plafonds : compteurs, pause automatique, disjoncteur                */
/* ------------------------------------------------------------------ */

async function pauseAuto(filtre: (l: LigneMot) => boolean, env: Env, raison: string): Promise<number> {
  let n = 0;
  for (const l of Object.values(await lireRegistre())) {
    if (l.etat !== "actif" || !filtre(l)) continue;
    const r = await changerEtat({ mot: l.mot, compte: l.compte, confirmeParOperateur: false, env }, "pause", true);
    if (r.issue === "execute") n++;
  }
  await journaliser("mots", `Pause automatique (${raison}) : ${n} mot(s).`);
  return n;
}

export interface RapportEnvois {
  actif: boolean;
  compte: number;
  motJour: number;
  pausesAutomatiques: number;
  disjoncteurOuvert: boolean;
}

/**
 * Enregistre `nombre` messages observés (runs relus) pour un mot sur un compte. Plafond horaire par compte (≤ 600) atteint →
 * disjoncteur OUVERT + pause de tous les mots du compte. Plafond journalier du mot atteint → pause automatique du mot.
 * Interrupteur éteint : rien n'est compté, rien n'est appelé.
 */
export async function noterEnvois(d: { mot: string; compte: string; nombre?: number; env?: Env; maintenantMs?: number }): Promise<RapportEnvois> {
  const env = d.env ?? process.env;
  const vide: RapportEnvois = { actif: false, compte: 0, motJour: 0, pausesAutomatiques: 0, disjoncteurOuvert: false };
  if (!motsActif(env)) return vide;
  const nombre = Math.max(1, Math.floor(d.nombre ?? 1));
  const iso = new Date(d.maintenantMs ?? Date.now()).toISOString();
  const kHeure = `${d.compte}|${iso.slice(0, 13)}`;
  const kJour = `${d.mot}|${iso.slice(0, 10)}`;
  const g = await sousVerrou(async () => {
    const x = await lireGardes();
    // On ne garde que l'heure et le jour en cours : le registre ne grossit pas.
    x.heures = Object.fromEntries(Object.entries(x.heures).filter(([k]) => k.endsWith(iso.slice(0, 13))));
    x.jours = Object.fromEntries(Object.entries(x.jours).filter(([k]) => k.endsWith(iso.slice(0, 10))));
    x.heures[kHeure] = (x.heures[kHeure] ?? 0) + nombre;
    x.jours[kJour] = (x.jours[kJour] ?? 0) + nombre;
    await ecrireGardes(x);
    return x;
  });
  const bloc = async () => {
    const rapport: RapportEnvois = { actif: true, compte: g.heures[kHeure], motJour: g.jours[kJour], pausesAutomatiques: 0, disjoncteurOuvert: false };
    const plafondHeure = Math.min(g.plafonds.heureCompte, PLAFOND_HEURE_COMPTE_MAX);
    if (rapport.compte >= plafondHeure) {
      await ouvrirDisjoncteur(`plafond horaire atteint (${plafondHeure} par heure et par compte)`);
      rapport.disjoncteurOuvert = true;
      rapport.pausesAutomatiques += await pauseAuto((l) => l.compte === d.compte, env, "plafond horaire");
    } else if (rapport.motJour >= g.plafonds.jourMot) {
      rapport.pausesAutomatiques += await pauseAuto((l) => l.mot === d.mot, env, `plafond du jour pour ${d.mot}`);
    }
    return rapport;
  };
  return ancienComportementTest.noterHorsVerrou ? bloc() : sousVerrou(bloc);
}

/* ------------------------------------------------------------------ */
/* « Tout arrêter » étendu aux mots                                     */
/* ------------------------------------------------------------------ */

/**
 * L'interrupteur global existant (`zernio.envoi_autorise`) coupe aussi les mots : (1) poser et réactiver sont refusés dès qu'il
 * est coupé (voir plus haut, relu à chaque appel) ; (2) ce balayage met en pause les mots déjà actifs chez Zernio. À appeler
 * par le geste « Tout arrêter » et par la boucle de fond. Sans effet tant que `MOTS_ENABLED` est éteint.
 */
export async function appliquerToutArreter(o: { env?: Env } = {}): Promise<{ arret: boolean; pauses: number }> {
  if (await envoiZernioAutorise()) return { arret: false, pauses: 0 };
  return { arret: true, pauses: await sousVerrou(() => pauseAuto(() => true, o.env ?? process.env, "Tout arrêter")) };
}

/* ------------------------------------------------------------------ */
/* STOP par compte                                                      */
/* ------------------------------------------------------------------ */

/** Définition du workflow STOP d'un compte (aucun texte sortant), posée comme un mot (même chemin gardé). */
export async function poserStopCompte(d: Demande & { compte: string }): Promise<Resultat> {
  const env = d.env ?? process.env;
  const requete = requetePose(construireGrapheStop(), d.compte);
  if (!d.confirmeParOperateur) return refus("validation_operateur_absente", requete);
  if (!(await envoiZernioAutorise())) return refus("tout_arrete", requete);
  if (!motsActif(env)) return { issue: "simule", raison: "interrupteur_eteint", requete };
  return sousVerrou(async () => {
    if ((await lireGardes()).disjoncteur.ouvert) return refus("disjoncteur_ouvert", requete);
    const r = await executer(requete);
    const id = r.ok ? idWorkflowDe(r.corps) : null;
    if (!id) return refus("zernio_refuse", requete);
    await enregistrerLigne({ mot: "STOP", compte: d.compte, etat: "actif", idWorkflow: id, raison: null, modifieLe: maintenant() });
    return { issue: "execute", raison: "pose_stop", requete, idWorkflow: id };
  });
}

export interface RepereOpposition {
  email: string;
  reseau: string;
  occurredAt?: string;
}
export type LecteurOpposition = (idRun: string, repere: { idContact: string | null }) => Promise<RepereOpposition | null>;
let lecteurOpp: LecteurOpposition | null = null;
let transportOpp: TransportSite | null = null;
export const injecterLecteurOpposition = (l: LecteurOpposition | null): void => void (lecteurOpp = l);
export const injecterTransportOpposition = (t: TransportSite | null): void => void (transportOpp = t);

/**
 * Prend en compte les événements « STOP / ARRÊT » déposés dans l'outbox par le crochet (le mot déclencheur est connu, jamais
 * l'adresse). Pour chacun : (1) personne MISE À L'ÉCART chez le Studio (empreinte de l'identifiant opaque du contact, jamais
 * supprimée) ; (2) alerte à l'opérateur ; (3) l'événement quitte la file « guide » (état `opposition`) pour ne pas être envoyé
 * comme demande de guide ; (4) transmission SIGNÉE au site si lecteur, transport et secret sont reliés (sinon « à transmettre »).
 * `demande_effacement` n'est jamais utilisé : une demande d'effacement reste une alerte, jamais une suppression.
 */
export async function traiterOppositions(o: { env?: Env } = {}): Promise<{ actif: boolean; prises: number; transmises: number }> {
  const env = o.env ?? process.env;
  // Les « stop » sont pris en compte dès que le parcours est allumé (la file d'envoi en dépend) ; aucun interrupteur n'est allumé par ce code.
  if (!motsActif(env) && !parcoursMotActif(env)) return { actif: false, prises: 0, transmises: 0 };
  const evenements = await sousVerrou(async () => {
    return depots().evenementsFournisseurs.lister((e) => e.fournisseur === "zernio" && !e.traite && estMotOpposition(typeof e.charge.motDeclencheur === "string" ? e.charge.motDeclencheur : null));
  });
  let prises = 0;
  let transmises = 0;
  // Aucun repli sur SITE_VIDEOS_SECRET : la route des oppositions du site le refuse.
  const secretBrut = env.SITE_GUIDES_RESEAU_SECRET?.trim();
  const secret = secretBrut && secretBrut.length >= 32 ? secretBrut : undefined;
  for (const ev of evenements) {
    const idContact = typeof ev.charge.idContact === "string" ? ev.charge.idContact : null;
    const idRun = String(ev.charge.idRun);
    // Relecture SOUS verrou : deux passages simultanés ne traitent (ni n'alertent) jamais deux fois le même événement.
    // Sans identifiant de contact, l'événement lui-même est enregistré (espace « evenement ») : personne n'est oublié.
    const espace = idContact ? ESPACE_CONTACT_ZERNIO : "evenement";
    const idPersonne = idContact ?? ev.idEvenement;
    let reserve: boolean;
    try {
      reserve = await sousVerrou(async () => {
        const courant = (await depots().evenementsFournisseurs.lister((e) => e.id === ev.id))[0];
        if (!courant || courant.traite) return false;
        // Échec fermé : sans secret valide, rien n'est écrit et l'événement reste NON traité (repris au prochain passage).
        await enregistrerOppositionSousVerrou(idPersonne, espace, { env });
        await depots().evenementsFournisseurs.modifier(ev.id, { traite: true, charge: { ...ev.charge, etat: "opposition", prochainEssaiLe: null } });
        return true;
      });
    } catch (e) {
      if (!(e instanceof ErreurEmpreinteIndisponible)) throw e;
      await journaliser("mots", `Opposition (STOP) en attente pour l'événement ${ev.idEvenement} : empreinte indisponible.`);
      continue;
    }
    if (!reserve) continue;
    await creerNotification({ type: "info", titre: "Opposition reçue (STOP)", message: "Une personne a écrit STOP. Elle est mise à l'écart ; rien n'est supprimé.", lien: "/mots" });
    prises++;
    if (lecteurOpp && transportOpp && secret) {
      try {
        const lu = await lecteurOpp(idRun, { idContact });
        if (lu) {
          const corps = JSON.stringify({ schemaVersion: 1, cleIdempotence: typeof ev.charge.cleIdempotenceOpposition === "string" && RE_CLE_IDEMPOTENCE.test(ev.charge.cleIdempotenceOpposition) ? ev.charge.cleIdempotenceOpposition : cleIdempotence(idRun), email: lu.email, motif: "stop", reseau: lu.reseau, occurredAt: lu.occurredAt });
          const entetes = signerAppel({ secret, methode: "POST", chemin: CHEMIN_OPPOSITIONS_SITE, corps, horodatageSec: Math.floor(Date.now() / 1000) });
          const r = await transportOpp({ methode: "POST", chemin: CHEMIN_OPPOSITIONS_SITE, corps, entetes });
          if (r.statut >= 200 && r.statut < 300) {
            transmises++;
            await marquerTransmise(idPersonne, espace, { env });
          }
        }
      } catch {
        /* reste « à transmettre » : l'alerte est déjà partie, rien n'est perdu */
      }
    }
    await journaliser("mots", `Opposition (STOP) prise en compte pour l'événement ${ev.idEvenement}.`);
  }
  return { actif: true, prises, transmises };
}

/* ------------------------------------------------------------------ */
/* Lecture pour l'écran                                                 */
/* ------------------------------------------------------------------ */

export interface VueMots {
  interrupteurAllume: boolean;
  toutArrete: boolean;
  disjoncteur: Gardes["disjoncteur"];
  plafonds: Gardes["plafonds"];
  lignes: LigneMot[];
  oppositions: number;
  /** Les textes du mot GUIDE sont-ils validés ? Un booléen, jamais un texte. */
  guideValide: boolean;
  /** Une validation existe mais elle ne correspond plus aux textes envoyés (titre ou dictionnaire changé) : à revalider. */
  guidePerime: boolean;
}
export async function lireVueMots(env: Env = process.env): Promise<VueMots> {
  const g = await lireGardes();
  const enregistree = await lireValidationGuideParcours();
  const actuelle = empreinteGuideParcours(titreGuideParcours(env));
  const guideValide = !!enregistree && actuelle.ok && actuelle.empreinte === enregistree.empreinte;
  return {
    interrupteurAllume: motsActif(env),
    toutArrete: !(await envoiZernioAutorise()),
    disjoncteur: g.disjoncteur,
    plafonds: g.plafonds,
    lignes: Object.values(await lireRegistre()).sort((a, b) => cle(a.mot, a.compte).localeCompare(cle(b.mot, b.compte))),
    oppositions: (await lireParametre<unknown[]>(PARAM_OPPOSITIONS_MOTS, [])).length,
    guideValide,
    guidePerime: !!enregistree && !guideValide,
  };
}

/* ------------------------------------------------------------------ */
/* Fichiers `mots/<MOT>.md`                                             */
/* ------------------------------------------------------------------ */

/** Lit `mots/<MOT>.md` (nom contrôlé : aucune traversée de dossier). Absent = null. */
export async function chargerTextesFichier(mot: string, dossier = DOSSIER_MOTS): Promise<ReturnType<typeof lireTextesMarkdown> | null> {
  const m = mot.trim().toUpperCase();
  if (!RE_MOT.test(m)) return { ok: false, raison: "mot_invalide" };
  try {
    return lireTextesMarkdown(m, await readFile(join(dossier, `${m}.md`), "utf8"));
  } catch {
    return null;
  }
}
export async function listerMotsFichiers(dossier = DOSSIER_MOTS): Promise<string[]> {
  try {
    return (await readdir(dossier)).filter((f) => /^[A-Z0-9]{2,20}\.md$/.test(f)).map((f) => f.slice(0, -3)).sort();
  } catch {
    return [];
  }
}

/** Ouvre le disjoncteur des mots depuis un autre service (parcours de conversation) : même effet, même alerte, sous le verrou. */
export const ouvrirDisjoncteurMotsExterne = (raison: string): Promise<void> => sousVerrou(() => ouvrirDisjoncteur(raison));

/**
 * Met en pause automatique les lignes GUIDE LOCALES (idWorkflow nul) dont le compte a quitté PARCOURS_CONVERSATION_COMPTES, puis
 * alerte. Ne rien réactiver ici : un compte réajouté reste en pause jusqu'à « Réactiver ». NE JAMAIS l'appeler depuis une
 * section déjà sous verrou (`sousVerrou` n'est pas réentrant).
 */
export async function pauserGuidesHorsListe(env: Env = process.env): Promise<number> {
  const liste = comptesParcours(env);
  const horsListe = (l: LigneMot) => l.mot === "GUIDE" && !l.idWorkflow && !liste.includes(l.compte);
  // Rien à faire = aucune écriture ni journal (la fonction passe à chaque tour de boucle).
  const n = await sousVerrou(async () => (Object.values(await lireRegistre()).some((l) => l.etat === "actif" && horsListe(l)) ? pauseAuto(horsListe, env, "compte retiré de la liste") : 0));
  if (n > 0) await creerNotification({ type: "echec", titre: "Mot GUIDE", message: `Le mot GUIDE a été mis en pause automatique sur ${n} compte(s) retiré(s) de la liste des comptes autorisés.`, lien: "/mots" }, { cloche: true });
  return n;
}
