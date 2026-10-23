/**
 * Règles de la veille (PURES, une règle = un test) :
 * - décision après une lecture (nouveauté ? fichier surveillé changé ? carte grise ?) ;
 * - état d'une carte ;
 * - e-mail SEULEMENT si intérêt fort ou alerte rouge ;
 * - résumé hebdomadaire le lundi matin (heure de Paris), une fois par semaine.
 * Rien n'est jamais mis à jour automatiquement : ces règles ne font que prévenir.
 */
import type { EtatVeille, VeilleNouveaute, VeilleOutil } from "@/domaine/types";
import type { Lecture } from "./types";
import { comparerVersions } from "./versions";
import { formateurDate } from "@/lib/intl";

/** Empreinte rangée dans `VeilleOutil.empreinte` : contenu lu + fichiers surveillés. */
export interface EmpreintesOutil {
  contenu?: string;
  fichiers?: Record<string, string>;
}

export function lireEmpreintes(e: string | undefined): EmpreintesOutil {
  if (!e) return {};
  try {
    const v = JSON.parse(e) as EmpreintesOutil;
    return typeof v === "object" && v ? v : {};
  } catch {
    return { contenu: e };
  }
}

export interface NouveauteDetectee {
  versionVue: string;
  date: string;
  lien?: string;
  notes: string;
  /** Fichiers surveillés dont le texte a changé (ex. `LICENSE.md`) : alerte rouge d'office. */
  fichiersChanges: string[];
}

export interface Decision {
  patch: Partial<VeilleOutil>;
  nouveaute?: NouveauteDetectee;
}

/** Deux dates « AAAA-MM(-JJ) » : la plus récente l'emporte (une date qui recule n'est pas une nouveauté). */
function comparerDates(a: string, b: string | undefined): number | null {
  if (!b || !/^\d{4}-\d{2}/.test(a) || !/^\d{4}-\d{2}/.test(b)) return null;
  return a === b ? 0 : a > b ? 1 : -1;
}

function jour(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/**
 * Après une lecture. Première lecture = point de départ (aucune alerte), sauf si la version vue est déjà
 * plus récente que celle qu'on utilise. Source muette = carte grise, la dernière version connue reste affichée.
 */
export function deciderApresLecture(outil: VeilleOutil, lecture: Lecture, maintenant: string): Decision {
  if (!lecture.ok) return { patch: { etat: "injoignable", verifieLe: maintenant } };
  const avant = lireEmpreintes(outil.empreinte);
  const apres: EmpreintesOutil = { contenu: lecture.empreinte, ...(lecture.fichiers ? { fichiers: lecture.fichiers } : {}) };
  const patch: Partial<VeilleOutil> = { verifieLe: maintenant, empreinte: JSON.stringify(apres) };
  if (lecture.version) {
    patch.derniereVersion = lecture.version;
    // Date de sortie seulement si la source la donne (une étiquette FFmpeg n'en a pas : jamais « sortie aujourd'hui »).
    if (lecture.date) patch.derniereVersionLe = lecture.date;
  }

  const fichiersChanges = Object.entries(lecture.fichiers ?? {})
    .filter(([f, e]) => avant.fichiers?.[f] !== undefined && avant.fichiers[f] !== e)
    .map(([f]) => f);

  let versionVue: string | null = null;
  const premiere = outil.verifieLe === undefined || (outil.derniereVersion === undefined && avant.contenu === undefined);
  if (lecture.version) {
    const c = comparerVersions(lecture.version, outil.derniereVersion) ?? comparerDates(lecture.version, outil.derniereVersion);
    const change = outil.derniereVersion !== undefined && lecture.version !== outil.derniereVersion && (c === null || c > 0);
    const depasseUtilisee = (comparerVersions(lecture.version, outil.versionUtilisee) ?? 0) > 0;
    if (change || (premiere && depasseUtilisee)) versionVue = lecture.version;
  } else if (!premiere && avant.contenu && lecture.empreinte && avant.contenu !== lecture.empreinte) {
    versionVue = `Page modifiée le ${jour(maintenant)}`;
  }
  if (fichiersChanges.length && !versionVue) versionVue = `${fichiersChanges.join(", ")} modifié le ${jour(maintenant)}`;
  if (!versionVue) return { patch };

  const notes = [fichiersChanges.length ? `${fichiersChanges.join(", ")} a changé : la licence change.` : "", lecture.notes].filter(Boolean).join("\n");
  return { patch, nouveaute: { versionVue, date: lecture.date ?? maintenant, lien: lecture.lien, notes, fichiersChanges } };
}

/** Nouveauté encore à traiter (ni ignorée, ni appliquée). */
export function estOuverte(n: Pick<VeilleNouveaute, "statut">): boolean {
  return n.statut === "nouvelle" || n.statut === "essayer";
}

/**
 * État d'une carte : gris si la dernière lecture a échoué (jamais « à jour » par défaut) ; rouge si une nouveauté
 * ouverte est rouge ; orange si une nouveauté est ouverte ou si la dernière version dépasse celle qu'on utilise ;
 * sinon à jour.
 */
export function etatOutil(outil: Pick<VeilleOutil, "etat" | "versionUtilisee" | "derniereVersion" | "verifieLe">, nouveautes: Pick<VeilleNouveaute, "statut" | "rouge">[], derniereLectureReussie: boolean): EtatVeille {
  if (!derniereLectureReussie || !outil.verifieLe) return "injoignable";
  const ouvertes = nouveautes.filter(estOuverte);
  if (ouvertes.some((n) => n.rouge)) return "attention";
  if (ouvertes.length) return "nouveaute";
  if ((comparerVersions(outil.derniereVersion, outil.versionUtilisee) ?? 0) > 0) return "nouveaute";
  return "a-jour";
}

/** E-mail seulement pour un intérêt fort ou une alerte rouge (la cloche reçoit tout). */
export function doitEnvoyerEmail(n: Pick<VeilleNouveaute, "rouge" | "resume">): boolean {
  return n.rouge || n.resume.interet === "fort";
}

/** Jour de la semaine (1 = lundi) et heure à Paris. */
function parisJourHeure(d: Date): { jourSemaine: number; heure: number } {
  const parts = formateurDate("en-GB", { timeZone: "Europe/Paris", weekday: "short", hour: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const jours = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return { jourSemaine: jours.indexOf(parts.find((p) => p.type === "weekday")!.value) + 1, heure: Number(parts.find((p) => p.type === "hour")!.value) };
}

/** Semaine ISO (« 2026-W40 ») d'une date, à Paris. */
export function semaineIso(d: Date): string {
  const paris = new Date(formateurDate("en-CA", { timeZone: "Europe/Paris" }).format(d) + "T12:00:00Z");
  const j = (paris.getUTCDay() + 6) % 7;
  paris.setUTCDate(paris.getUTCDate() - j + 3);
  const premierJeudi = new Date(Date.UTC(paris.getUTCFullYear(), 0, 4));
  const n = 1 + Math.round(((paris.getTime() - premierJeudi.getTime()) / 86_400_000 - 3 + ((premierJeudi.getUTCDay() + 6) % 7)) / 7);
  return `${paris.getUTCFullYear()}-W${String(n).padStart(2, "0")}`;
}

/** Heure du résumé du lundi (Paris). */
export const HEURE_RESUME_LUNDI = 8;

/** Le résumé de la semaine part le lundi à partir de 8 h (Paris), une seule fois par semaine. */
export function doitEnvoyerResumeHebdo(maintenant: Date, derniereSemaineEnvoyee: string | null): boolean {
  const { jourSemaine, heure } = parisJourHeure(maintenant);
  if (jourSemaine !== 1 || heure < HEURE_RESUME_LUNDI) return false;
  return derniereSemaineEnvoyee !== semaineIso(maintenant);
}

/** Texte du résumé du lundi (titre + une ligne par point). */
export function texteResumeHebdo(outils: Pick<VeilleOutil, "nom" | "etat">[], nouveautesSemaine: Pick<VeilleNouveaute, "rouge" | "statut" | "resume">[]): { titre: string; message: string } {
  const rouges = nouveautesSemaine.filter((n) => n.rouge).length;
  const fortes = nouveautesSemaine.filter((n) => !n.rouge && n.resume.interet === "fort").length;
  const ouvertes = nouveautesSemaine.filter(estOuverte).length;
  const gris = outils.filter((o) => o.etat === "injoignable").map((o) => o.nom);
  const n = nouveautesSemaine.length;
  const lignes = [
    n ? `${n} nouveauté${n > 1 ? "s" : ""} cette semaine, ${ouvertes} à regarder.` : "Aucune nouveauté cette semaine.",
    rouges ? `${rouges} alerte${rouges > 1 ? "s" : ""} rouge${rouges > 1 ? "s" : ""} (licence, prix ou fonction retirée).` : "",
    fortes ? `${fortes} à fort intérêt pour vos vidéos.` : "",
    gris.length ? `Impossible de vérifier : ${gris.join(", ")}.` : "",
  ].filter(Boolean);
  return { titre: rouges ? "Veille de la semaine : une alerte à lire" : "Veille de la semaine", message: lignes.join(" ") };
}

/** Une lecture par jour : vrai si la dernière date d'au moins 24 h (ou n'a jamais eu lieu). */
export function lectureDue(derniere: string | null, maintenant: Date, intervalleMs = 24 * 3_600_000): boolean {
  if (!derniere) return true;
  return maintenant.getTime() - new Date(derniere).getTime() >= intervalleMs - 60_000;
}
