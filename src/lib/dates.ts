/** Dates en français. PUR. */
import { formateurDate, formateurRelatif } from "@/lib/intl";

const FUSEAU = "Europe/Paris";

/** Une journée en millisecondes (règle unique : ne pas la redéfinir ailleurs). */
export const JOUR_MS = 86_400_000;

export function maintenantIso(): string {
  return new Date().toISOString();
}

export function ajouterJours(date: Date | string, jours: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + jours);
  return d;
}

/** « 3 oct. » */
export function dateCourte(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return formateurDate("fr-FR", { day: "numeric", month: "short", timeZone: FUSEAU }).format(d);
}

/** « vendredi 3 octobre » */
export function dateLongue(iso: string): string {
  return formateurDate("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: FUSEAU }).format(new Date(iso));
}

/** « 14:30 » */
export function heure(iso: string): string {
  return formateurDate("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: FUSEAU }).format(new Date(iso));
}

/** « il y a 5 min », « dans 2 h », « hier ». */
export function ilYA(iso: string, maintenant: Date = new Date()): string {
  const diffSec = Math.round((new Date(iso).getTime() - maintenant.getTime()) / 1000);
  const rtf = formateurRelatif("fr-FR", { numeric: "auto" });
  const abs = Math.abs(diffSec);
  if (abs < 60) return "à l'instant";
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), "day");
  return rtf.format(Math.round(diffSec / (86400 * 30)), "month");
}

/** « 0:45 », « 12:03 » */
export function chrono(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Clé AAAA-MM du mois (budget), À L'HEURE DE PARIS comme `cleJour` (E2E-2 argent n° 16) : le serveur tourne en UTC,
 * une dépense du 1er à 1 h (Paris) tombait dans le mois précédent.
 */
export function cleMois(date: Date | string = new Date()): string {
  return cleJour(date).slice(0, 7);
}

/** Clé AAAA-MM-JJ du jour (calendrier). */
export function cleJour(date: Date | string): string {
  const d = new Date(date);
  return formateurDate("fr-CA", { timeZone: FUSEAU }).format(d);
}
