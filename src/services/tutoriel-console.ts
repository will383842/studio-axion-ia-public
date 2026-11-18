/**
 * PANNEAU DU TUTORIEL D'OUTIL DANS LA CONSOLE (T-EXT-36) : lit les interrupteurs, les vidéos en cours et ce qu'elles ont
 * consommé (EN QUANTITÉS, jamais un montant) ; écrit un interrupteur ou le texte de la mention IA, avec journal.
 *
 *  - Tout est éteint par défaut : seul le booléen exact `true` allume. Ce fichier n'écrit que la valeur reçue d'un clic
 *    (aucun `true` écrit en dur). Aucune clé n'est ajoutée à `reglages.ts`.
 *  - Le plafond Claude par vidéo est affiché seulement (« réglé » / « par défaut »), jamais modifiable ici.
 *  - Aucun appel payant : lecture des dépôts, écriture d'un réglage.
 *  - Clés dont la fiche créatrice n'est pas encore sur master (33, 41, 42, 26a, 15) : recopiées UNE fois ici, notées dans
 *    la PR ; le test compare chaque clé importée au texte de son fichier source.
 */
import "server-only";
import {
  cleInterrupteurMentionIA,
  cleTexteMentionIA,
  LONGUEUR_MAX_MENTION_IA,
  mentionIAAAfficher,
  TEXTE_MENTION_IA_PAR_DEFAUT,
} from "@/briques/mentions-legales/etiquetage-ia";
import type { DepenseEnregistree, Id, StatutVideo, Video } from "@/domaine/types";
import { PARAM_CLAUDE_TUTORIEL, PARAM_PLAFOND_TUTORIEL } from "./tutoriel-claude";
import { ecrireParametre as ecrireParDefaut, journaliser as journaliserParDefaut, lireParametre as lireParDefaut, maintenant } from "./_commun";

/** Format du tutoriel (valeur de `ID_FORMAT_TUTORIEL_OUTIL`, comparée au fichier source par le test). */
export const FORMAT_TUTORIEL = "tutoriel-outil";
export const CLE_MENTION_TUTORIEL = cleInterrupteurMentionIA("tutoriel-outil");
export const CLE_TEXTE_MENTION_TUTORIEL = cleTexteMentionIA("tutoriel-outil");

// Clés recopiées (fiche créatrice pas encore fusionnée) : une seule fois, ici.
export const CLE_FORMULAIRE = "tutoriel.formulaire";
export const CLE_ENTREE_ZIP = "tutoriel.entreeZip";
export const CLE_ENTREE_PHRASE = "tutoriel.entreePhrase";
export const CLE_DEVIS_AVANT_DEPENSE = "tutoriel.devisAvantDepense";
export const CLE_FINITIONS = "tutoriel.finitions";
export const CLE_FIN_COMMUNE = "tutoriel.finCommune";
export const CLE_SCENES_GARDEES = "tutoriel.scenesGardees";

export interface ReglageTutoriel {
  cle: string;
  libelle: string;
  /** Phrase simple affichée quand l'interrupteur est éteint. */
  phraseEteint: string;
}

/** Liste FERMÉE des interrupteurs du panneau (ordre d'affichage). Le plafond n'y est pas. */
export const REGLAGES_TUTORIEL: readonly ReglageTutoriel[] = [
  { cle: CLE_FORMULAIRE, libelle: "Formulaire du tutoriel", phraseEteint: "Éteint : le formulaire n'est pas proposé." },
  { cle: CLE_ENTREE_ZIP, libelle: "Envoi d'un dossier", phraseEteint: "Éteint : aucun dossier ne peut être envoyé." },
  { cle: CLE_ENTREE_PHRASE, libelle: "Entrée par une phrase (plus tard)", phraseEteint: "Éteint : pas d'entrée par une phrase." },
  { cle: PARAM_CLAUDE_TUTORIEL, libelle: "Écriture et relecture par Claude", phraseEteint: "Éteint : Claude n'écrit ni ne relit rien." },
  { cle: CLE_DEVIS_AVANT_DEPENSE, libelle: "Devis avant toute dépense", phraseEteint: "Éteint : aucun devis n'est présenté avant de lancer." },
  { cle: CLE_FINITIONS, libelle: "Son et vignette finis", phraseEteint: "Éteint : ni son fini ni vignette finie." },
  { cle: CLE_FIN_COMMUNE, libelle: "Fin choisie (« Aucune » ou « Prendre rendez-vous »)", phraseEteint: "Éteint : aucune fin n'est ajoutée." },
  { cle: CLE_SCENES_GARDEES, libelle: "Scènes gardées", phraseEteint: "Éteint : aucune scène n'est gardée." },
  { cle: CLE_MENTION_TUTORIEL, libelle: "Mention IA du tutoriel", phraseEteint: "Éteint : aucune mention n'est affichée." },
];

export type LireReglage = <T>(id: string, defaut: T) => Promise<T>;
export type EcrireReglage = (id: string, valeur: unknown) => Promise<void>;
export type JournaliserReglage = (type: string, message: string) => Promise<void>;

export interface PortsConsole {
  lire?: LireReglage;
  ecrire?: EcrireReglage;
  journaliser?: JournaliserReglage;
}

const lireDe = (p?: PortsConsole): LireReglage => p?.lire ?? lireParDefaut;

export interface LigneReglage extends ReglageTutoriel {
  allume: boolean;
}

/** État de chaque interrupteur : seul `true` exact est « allumé ». */
export async function lireReglagesTutoriel(ports?: PortsConsole): Promise<LigneReglage[]> {
  const lire = lireDe(ports);
  return Promise.all(REGLAGES_TUTORIEL.map(async (r) => ({ ...r, allume: (await lire<unknown>(r.cle, false)) === true })));
}

/** Texte de la mention : celui enregistré s'il est valable, sinon le texte par défaut (comme `mentionIAAAfficher`). */
export async function lireTexteMention(ports?: PortsConsole): Promise<string> {
  const t = await lireDe(ports)<unknown>(CLE_TEXTE_MENTION_TUTORIEL, TEXTE_MENTION_IA_PAR_DEFAUT);
  const propre = typeof t === "string" ? t.trim() : "";
  return propre !== "" && propre.length <= LONGUEUR_MAX_MENTION_IA ? propre : TEXTE_MENTION_IA_PAR_DEFAUT;
}

/** Ce que la mention afficherait aujourd'hui (`null` = rien). */
export function mentionAffichee(ports?: PortsConsole): Promise<string | null> {
  return mentionIAAAfficher("tutoriel-outil", lireDe(ports) as (id: string, defaut: unknown) => Promise<unknown>);
}

export type ResultatConsole = { ok: true } | { ok: false; raison: string };

/** Bascule UN interrupteur de la liste fermée, avec une ligne de journal. Rien d'autre n'est accepté. */
export async function basculerReglage(cle: unknown, valeur: unknown, ports?: PortsConsole): Promise<ResultatConsole> {
  const reglage = REGLAGES_TUTORIEL.find((r) => r.cle === cle);
  if (!reglage) return { ok: false, raison: "Ce réglage n'est pas modifiable ici." };
  if (typeof valeur !== "boolean") return { ok: false, raison: "Choisissez Allumer ou Éteindre." };
  await (ports?.ecrire ?? ecrireParDefaut)(reglage.cle, valeur);
  await (ports?.journaliser ?? journaliserParDefaut)("reglage", `Tutoriel d'outil : ${reglage.libelle} ${valeur ? "allumé" : "éteint"}`);
  return { ok: true };
}

const MOTS_REFUSES = /garanti|certifi[ée]|qualiopi|int[ée]grateur/i;

/** Enregistre le texte de la mention : 120 caractères au plus ; vide = texte par défaut ; mots interdits refusés. */
export async function enregistrerTexteMention(texte: unknown, ports?: PortsConsole): Promise<ResultatConsole> {
  if (typeof texte !== "string") return { ok: false, raison: "Le texte n'est pas valable." };
  const propre = texte.trim();
  if (propre.length > LONGUEUR_MAX_MENTION_IA) return { ok: false, raison: `Le texte doit faire ${LONGUEUR_MAX_MENTION_IA} caractères au plus.` };
  if (MOTS_REFUSES.test(propre)) return { ok: false, raison: "Ce texte contient un mot qui n'est pas permis." };
  await (ports?.ecrire ?? ecrireParDefaut)(CLE_TEXTE_MENTION_TUTORIEL, propre === "" ? TEXTE_MENTION_IA_PAR_DEFAUT : propre);
  await (ports?.journaliser ?? journaliserParDefaut)("reglage", "Tutoriel d'outil : texte de la mention enregistré");
  return { ok: true };
}

/* --- Vidéos en cours ---------------------------------------------------------------------------------------------- */

const SEPT_JOURS_MS = 7 * 24 * 3600 * 1000;
const STATUTS_TERMINES: readonly StatutVideo[] = ["prete", "echec", "annulee"];

const PHRASE_ETAT: Record<StatutVideo, string> = {
  brouillon: "En préparation.",
  maquette: "Maquette à regarder.",
  en_file: "En attente de fabrication.",
  en_fabrication: "En cours de fabrication.",
  prete: "Prête.",
  echec: "Bloquée : regardez la cloche.",
  annulee: "Annulée.",
  archivee: "Rangée.",
};

export interface VideoEnCours {
  id: Id;
  titre: string;
  etat: string;
  suivi: string;
}

export interface PortsVideos {
  videos: () => Promise<Video[]>;
  /** Phrase d'état venue de la vue de suivi (T-EXT-34) quand elle existe ; sinon le statut en une phrase. */
  etat?: (video: Video) => Promise<string | null>;
  maintenantMs?: number;
}

/** Vidéos du format du tutoriel, non terminées ou terminées depuis moins de 7 jours (les rangées n'y sont pas). */
export async function videosEnCours(ports: PortsVideos): Promise<VideoEnCours[]> {
  const now = ports.maintenantMs ?? Date.parse(maintenant());
  const toutes = (await ports.videos()).filter((v) => v.formatId === FORMAT_TUTORIEL && v.statut !== "archivee");
  const gardees = toutes.filter((v) => !STATUTS_TERMINES.includes(v.statut) || now - Date.parse(v.modifieLe) < SEPT_JOURS_MS);
  gardees.sort((a, b) => b.modifieLe.localeCompare(a.modifieLe));
  return Promise.all(
    gardees.map(async (v) => ({
      id: v.id,
      titre: v.titre,
      etat: (await ports.etat?.(v)) ?? PHRASE_ETAT[v.statut],
      suivi: `/tutoriel-outil/suivi/${v.id}`,
    })),
  );
}

/* --- Consommation, en quantités ------------------------------------------------------------------------------------ */

export interface QuantitesConso {
  nbDepenses: number;
  appelsClaude: number;
  caracteresVoix: number;
  rendus: number;
  /** Rien n'a été payé (essai). */
  essai: boolean;
}

const quantitesVides = (): QuantitesConso => ({ nbDepenses: 0, appelsClaude: 0, caracteresVoix: 0, rendus: 0, essai: true });

/** Quantités d'un lot de dépenses : appels, caractères lus, rendus (secondes ou minutes de rendu). Aucun montant. */
export function quantitesDesDepenses(depenses: readonly DepenseEnregistree[], payee: (l: { fournisseur: string }) => boolean): QuantitesConso {
  const q = quantitesVides();
  q.nbDepenses = depenses.length;
  for (const d of depenses) {
    for (const l of d.lignes ?? []) {
      if (payee(l)) q.essai = false;
      if (l.unite === "appel") q.appelsClaude += l.quantite;
      else if (l.unite === "caractere") q.caracteresVoix += l.quantite;
      else if (l.unite === "seconde" || l.unite === "minute") q.rendus += 1;
    }
  }
  return q;
}

export interface ConsoVideo extends QuantitesConso {
  videoId: Id;
  titre: string;
  /** Devis en quantités (`texteDevis` de T-EXT-42) quand il existe. */
  devis: string | null;
}

export interface Consommation {
  parVideo: ConsoVideo[];
  moisEnCours: QuantitesConso;
  plafond: "réglé" | "par défaut";
}

export interface PortsConsommation {
  depensesDe: (videoId: Id) => Promise<DepenseEnregistree[]>;
  /** Nombre de dépenses de la vidéo (`coutsDeLaVideo(...).nbDepenses`). */
  nbDepenses: (videoId: Id) => Promise<number>;
  payee: (l: { fournisseur: string }) => boolean;
  moisDe: (date: string) => string;
  moisCourant: string;
  devis?: (videoId: Id) => Promise<string | null>;
  lire?: LireReglage;
}

export async function lireConsommation(videos: readonly VideoEnCours[], ports: PortsConsommation): Promise<Consommation> {
  const duMois: DepenseEnregistree[] = [];
  const parVideo: ConsoVideo[] = [];
  for (const v of videos) {
    const deps = await ports.depensesDe(v.id);
    duMois.push(...deps.filter((d) => ports.moisDe(d.date) === ports.moisCourant));
    parVideo.push({ videoId: v.id, titre: v.titre, ...quantitesDesDepenses(deps, ports.payee), nbDepenses: await ports.nbDepenses(v.id), devis: (await ports.devis?.(v.id)) ?? null });
  }
  const regle = await (ports.lire ?? lireParDefaut)<unknown>(PARAM_PLAFOND_TUTORIEL, null);
  return { parVideo, moisEnCours: quantitesDesDepenses(duMois, ports.payee), plafond: typeof regle === "number" && regle > 0 ? "réglé" : "par défaut" };
}
