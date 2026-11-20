/**
 * PANNEAU DU TUTORIEL D'OUTIL DANS LA CONSOLE (T-EXT-36) : lit les interrupteurs, les vidéos en cours et ce qu'elles ont
 * consommé (EN QUANTITÉS, jamais un montant) ; écrit un interrupteur ou le texte de la mention IA, avec journal.
 *
 *  - Tout est éteint par défaut : seul le booléen exact `true` allume. Ce fichier n'écrit que la valeur reçue d'un clic
 *    (aucun `true` écrit en dur). Aucune clé n'est ajoutée à `reglages.ts`.
 *  - Le plafond Claude par vidéo est affiché seulement (« réglé » / « par défaut »), jamais modifiable ici.
 *  - Aucun appel payant : lecture des dépôts, écriture d'un réglage.
 *  - `PARAM_SCENES_TUTORIEL` (T-EXT-15), `lienSuivi` (T-EXT-34) et les clés des fiches 33 et 41 (`PARAM_FORMULAIRE`,
 *    `PARAM_ENTREE_ZIP`) sont importés. La clé de fin commune (26a) est écrite ici parce que 26a ne l'exporte pas :
 *    le test de la console la compare au texte de `tutoriel-branchements.ts`. Plus aucune attente.
 */
import "server-only";
import {
  cleInterrupteurMentionIA,
  cleTexteMentionIA,
  LONGUEUR_MAX_MENTION_IA,
  mentionIAAAfficher,
  TEXTE_MENTION_IA_PAR_DEFAUT,
} from "@/briques/mentions-legales/etiquetage-ia";
import type { DepenseEnregistree, Id, StatutTravail, StatutVideo, Video } from "@/domaine/types";
import { texteDevis, type DevisTutoriel } from "@/moteurs/montage-tutoriel-outil/devis-tutoriel";
import { PARAM_ENTREE_PHRASE } from "@/moteurs/montage-tutoriel-outil/maquette-creee";
import { PARAM_SCENES_TUTORIEL } from "./scenes-tutoriel";
import { PARAM_CLAUDE_TUTORIEL, PARAM_PLAFOND_TUTORIEL } from "./tutoriel-claude";
import { PARAM_FORMULAIRE } from "./tutoriel-depot";
import { lienSuivi } from "./tutoriel-suivi";
import { PARAM_ENTREE_ZIP } from "./zip-tutoriel";
import { ecrireParametre as ecrireParDefaut, journaliser as journaliserParDefaut, lireParametre as lireParDefaut, maintenant } from "./_commun";

/** Format du tutoriel (valeur de `ID_FORMAT_TUTORIEL_OUTIL`, comparée au fichier source par le test). */
export const FORMAT_TUTORIEL = "tutoriel-outil";
export const CLE_MENTION_TUTORIEL = cleInterrupteurMentionIA("tutoriel-outil");
export const CLE_TEXTE_MENTION_TUTORIEL = cleTexteMentionIA("tutoriel-outil");

// Importées des modules créateurs (T-EXT-41 et T-EXT-33 fusionnées). CLE_FIN_COMMUNE reste écrite ici (26a, fusionnée, ne l'exporte pas) : le test de la console lit le texte de tutoriel-branchements.ts et rougit si la clé diffère.
export const CLE_FORMULAIRE = PARAM_FORMULAIRE;
export const CLE_ENTREE_ZIP = PARAM_ENTREE_ZIP;
export const CLE_ENTREE_PHRASE = PARAM_ENTREE_PHRASE; // importée : la maquette est fusionnée
export const CLE_DEVIS_AVANT_DEPENSE = "tutoriel.devisAvantDepense";
export const CLE_FINITIONS = "tutoriel.finitions";
export const CLE_FIN_COMMUNE = "tutoriel.finCommune";
export const CLE_SCENES_GARDEES = PARAM_SCENES_TUTORIEL; // importée : T-EXT-15 est fusionnée

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

/** NFKC puis retrait des caractères invisibles (`\p{Cf}`) : « intégrateur » décomposé ou « garan\u200Bti » n'y échappent pas. */
const normaliserMention = (t: string): string => t.normalize("NFKC").replace(/\p{Cf}/gu, "").trim();

/** Enregistre le texte de la mention : 120 caractères au plus ; vide = texte par défaut ; mots interdits refusés. */
export async function enregistrerTexteMention(texte: unknown, ports?: PortsConsole): Promise<ResultatConsole> {
  if (typeof texte !== "string") return { ok: false, raison: "Le texte n'est pas valable." };
  const propre = normaliserMention(texte);
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

/** Phrase d'état d'une fabrication (statut du travail lu par la vue de suivi de T-EXT-34), en mots simples. */
export function phraseDuTravail(statut: StatutTravail): string {
  switch (statut) {
    case "en_file":
      return "En attente de fabrication.";
    case "en_cours":
      return "En cours de fabrication.";
    case "termine":
      return "Prête.";
    case "echec":
      return "Bloquée : regardez la cloche.";
    case "annule":
      return "Annulée.";
  }
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
      suivi: lienSuivi(v.id),
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

/** Fournisseur des appels Claude, et fournisseurs de rendu (les lignes « seconde » d'un avatar ne sont pas des rendus). */
const FOURNISSEUR_CLAUDE = "anthropic";
const FOURNISSEURS_RENDU: readonly string[] = ["remotion-lambda", "simulation"];
/** Même règle que `idFournisseur` (domaine/credits) : le Studio écrit aussi « claude » pour Anthropic (recopiée, pas importée). */
const idFournisseurLigne = (f: string | undefined): string => {
  const x = (f ?? "").trim().toLowerCase();
  return x === "claude" ? FOURNISSEUR_CLAUDE : x;
};
const memeFournisseur = (l: { fournisseur?: string }, f: string) => idFournisseurLigne(l.fournisseur) === f;

/** Quantités d'un lot de dépenses : appels, caractères lus, rendus (secondes ou minutes de rendu). Aucun montant. */
export function quantitesDesDepenses(depenses: readonly DepenseEnregistree[], payee: (l: { fournisseur: string }) => boolean): QuantitesConso {
  const q = quantitesVides();
  q.nbDepenses = depenses.length;
  for (const d of depenses) {
    // Comme `montantPaye` : une dépense sans détail compte en entier, donc payée.
    if (!d.lignes?.length) q.essai = false;
    for (const l of d.lignes ?? []) {
      if (payee(l)) q.essai = false;
      if (l.unite === "appel" && memeFournisseur(l, FOURNISSEUR_CLAUDE)) q.appelsClaude += l.quantite;
      else if (l.unite === "caractere") q.caracteresVoix += l.quantite;
      else if ((l.unite === "seconde" || l.unite === "minute") && FOURNISSEURS_RENDU.some((f) => memeFournisseur(l, f))) q.rendus += 1;
    }
  }
  return q;
}

/** Le devis d'une vidéo en une ligne : les phrases de `texteDevis` (T-EXT-42), des quantités, jamais un montant. `null` : pas de devis. */
export function phraseDevis(devis: DevisTutoriel | null | undefined): string | null {
  return devis ? texteDevis(devis).join(" · ") : null;
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
  return { parVideo, moisEnCours: quantitesDesDepenses(duMois, ports.payee), plafond: typeof regle === "number" && Number.isFinite(regle) && regle >= 0 ? "réglé" : "par défaut" };
}
