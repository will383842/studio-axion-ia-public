/**
 * PLAGES DU CALENDRIER (D6-02) : semaine et mois « à l'heure de Paris ». PUR, sans réseau.
 * Un jour est une clé « AAAA-MM-JJ » (jour de Paris). Les bornes ISO couvrent de minuit Paris à la dernière
 * milliseconde du dernier jour, y compris autour des changements d'heure (journée de 23 h ou de 25 h).
 */
import { ajouterJoursParis, instantParis } from "@/lib/horloge-paris";

export interface PlageSemaine {
  /** Les 7 jours, lundi d'abord. */
  jours: string[];
  debutIso: string;
  finIso: string;
}

export interface PlageMois {
  /** « AAAA-MM » du mois affiché. */
  mois: string;
  /** Toujours 6 × 7 = 42 jours, à partir du lundi qui précède (ou est) le 1er. */
  jours: string[];
  semaines: string[][];
  debutIso: string;
  finIso: string;
}

/** 0 = lundi … 6 = dimanche, pour un jour « AAAA-MM-JJ » (calcul calendaire, insensible au fuseau). */
function rangSemaine(jour: string): number {
  const [a, m, j] = jour.split("-").map(Number);
  return (new Date(Date.UTC(a, m - 1, j)).getUTCDay() + 6) % 7;
}

/** Lundi de la semaine du jour donné. */
export function lundiDeLaSemaine(jour: string): string {
  return ajouterJoursParis(jour, -rangSemaine(jour));
}

/** Dernière milliseconde du jour de Paris : le minuit suivant (Paris) moins 1 ms. */
function finDeJour(jour: string): string {
  return new Date(new Date(instantParis(ajouterJoursParis(jour, 1), "00:00")).getTime() - 1).toISOString();
}

export function plageSemaine(jour: string): PlageSemaine {
  const lundi = lundiDeLaSemaine(jour);
  const jours = Array.from({ length: 7 }, (_, i) => ajouterJoursParis(lundi, i));
  return { jours, debutIso: instantParis(jours[0], "00:00"), finIso: finDeJour(jours[6]) };
}

export function plageMois(jour: string): PlageMois {
  const mois = jour.slice(0, 7);
  const premier = lundiDeLaSemaine(`${mois}-01`);
  const jours = Array.from({ length: 42 }, (_, i) => ajouterJoursParis(premier, i));
  const semaines = Array.from({ length: 6 }, (_, i) => jours.slice(i * 7, i * 7 + 7));
  return { mois, jours, semaines, debutIso: instantParis(jours[0], "00:00"), finIso: finDeJour(jours[41]) };
}

/** Adresse de la vue Jour d'un jour (un clic sur un jour du mois ouvre ce jour, pas sa semaine). `suite` : filtres déjà écrits (« &reseaux=… »). */
export function adresseVueJour(jour: string, suite = ""): string {
  return `/calendrier?vue=jour&date=${jour}${suite}`;
}
