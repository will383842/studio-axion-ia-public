/**
 * CAL-07 · Moteur des manques du calendrier. Fonction PURE : mêmes entrées, même sortie, aucun appel réseau.
 *
 * Un manque est une ALERTE, jamais un blocage : `bloquant` vaut toujours false et rien n'est refusé à l'ajout manuel.
 * Définitions de départ (celles de la maquette validée ; modifiables par les options) :
 *  - créneau vide : un jour attendu, sur un réseau dont le quota par jour est supérieur à 0, sans aucune publication.
 *    Jours attendus au départ : LinkedIn et Facebook du lundi au vendredi, Instagram tous les jours, TikTok aucun.
 *    Le quota des réglages de cadence est un plafond conseillé : il ne sert ici qu'à savoir s'il faut un créneau (0 = aucun).
 *  - texte manquant : publication à venir sans texte ;
 *  - commentaire manquant : publication à venir sans premier commentaire, sauf sur TikTok (pas de premier commentaire) ;
 *  - visuel non validé : « urgent » à moins de 24 h de la publication, simple alerte au-delà.
 * Seuls les 7 jours à venir sont regardés (aujourd'hui compris), jamais le passé. Jours et heures : Europe/Paris.
 */
import { REGLAGES_CADENCE_DEFAUT, nomReseauCadence, type ReglagesCadence, type TypeContenuCadence } from "@/domaine/cadence/reglages";
import type { IdReseau } from "@/domaine/types";

export type CodeManque = "creneau-vide" | "texte-manquant" | "commentaire-manquant" | "visuel-non-valide";

export interface EntreeManque {
  id: string;
  reseau: IdReseau;
  /** Instant de publication, ISO 8601 (avec « Z » ou décalage ; sans décalage = heure de Paris). */
  instant: string;
  type: TypeContenuCadence;
  /** « idee » et « archive » ne remplissent pas un créneau ; « publie » est déjà partie. */
  statut: string;
  texte?: string;
  premierCommentaire?: string;
  /** false = visuel non validé ; absent = état inconnu (aucun manque). */
  visuelValide?: boolean;
}

export interface Manque {
  code: CodeManque;
  reseau: IdReseau;
  /** Jour de Paris, AAAA-MM-JJ. */
  jour: string;
  entreeId?: string;
  message: string;
  /** « urgent » seulement pour un visuel non validé à moins de 24 h. */
  gravite: "alerte" | "urgent";
  bloquant: false;
}

export interface OptionsManques {
  /** Instant de référence (ISO). Illisible : aucune alerte. */
  maintenant: string;
  reglages?: ReglagesCadence;
  /** Jours attendus par réseau, 1 = lundi … 7 = dimanche. Remplace les jours de départ du réseau nommé. */
  joursAttendus?: Partial<Record<IdReseau, readonly number[]>>;
  /** Nombre de jours regardés, aujourd'hui compris (7 par défaut, borné entre 0 et 62). */
  jours?: number;
}

const SEMAINE = [1, 2, 3, 4, 5, 6, 7] as const;
export const JOURS_ATTENDUS_DEPART: Readonly<Partial<Record<IdReseau, readonly number[]>>> = {
  linkedin: [1, 2, 3, 4, 5],
  facebook: [1, 2, 3, 4, 5],
  instagram: SEMAINE,
  tiktok: [],
};
const ORDRE_RESEAUX: readonly IdReseau[] = ["linkedin", "instagram", "facebook", "tiktok", "youtube", "youtube-shorts"];
const IGNOREES = new Set(["idee", "archive"]);
const HEURES_URGENCE = 24;
const AVEC_DECALAGE = /(Z|[+-]\d{2}:?\d{2})$/i;
const ISO_LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

const FORMAT_PARIS = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const FORMAT_JOUR = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });

/** Instant en millisecondes ; un ISO sans décalage est lu comme heure de Paris. null si illisible. */
function enMs(iso: unknown): number | null {
  if (typeof iso !== "string") return null;
  if (AVEC_DECALAGE.test(iso)) {
    const t = new Date(iso).getTime();
    return Number.isNaN(t) ? null : t;
  }
  const m = ISO_LOCAL.exec(iso);
  if (!m) return null;
  const [a, mo, j, h, mi] = m.slice(1).map(Number);
  // Lecture locale → instant : on cherche le décalage de Paris à ce moment (deux essais suffisent, y compris au changement d'heure).
  let t = Date.UTC(a, mo - 1, j, h, mi);
  for (let i = 0; i < 2; i++) t = Date.UTC(a, mo - 1, j, h, mi) - (parisEnUtc(t) - t);
  return Number.isNaN(t) ? null : t;
}
/** Date « murale » de Paris (affichée comme si c'était de l'UTC) pour un instant. */
function parisEnUtc(t: number): number {
  const p = Object.fromEntries(FORMAT_PARIS.formatToParts(t).map((x) => [x.type, x.value]));
  return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
}
const jourParis = (t: number): string => new Date(parisEnUtc(t)).toISOString().slice(0, 10);
const jourSemaine = (jour: string): number => ((new Date(`${jour}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
const ajouterJours = (jour: string, n: number): string => new Date(new Date(`${jour}T12:00:00Z`).getTime() + n * 864e5).toISOString().slice(0, 10);
const libelleJour = (jour: string): string => FORMAT_JOUR.format(new Date(`${jour}T12:00:00Z`));
const vide = (v: unknown): boolean => typeof v !== "string" || v.trim() === "";
const quota = (r: ReglagesCadence, reseau: IdReseau): number => {
  const q = r.reseaux?.[reseau]?.quotaParJour;
  return typeof q === "number" && Number.isFinite(q) && q > 0 ? Math.floor(q) : 0;
};

/** Les manques des prochains jours, triés par jour, réseau puis code. Jamais bloquants. */
export function calculerManques(entrees: readonly EntreeManque[], options: OptionsManques): Manque[] {
  const now = enMs(options?.maintenant);
  if (now === null) return [];
  const reglages = options.reglages ?? REGLAGES_CADENCE_DEFAUT;
  const n = typeof options.jours === "number" && Number.isFinite(options.jours) ? Math.min(62, Math.max(0, Math.floor(options.jours))) : 7;
  const aujourdhui = jourParis(now);
  const fenetre = Array.from({ length: n }, (_, i) => ajouterJours(aujourdhui, i));
  const lues: { e: EntreeManque; t: number; jour: string }[] = [];
  const vues = new Set<string>();
  for (const e of Array.isArray(entrees) ? entrees : []) {
    if (!e || typeof e !== "object") continue;
    const t = enMs(e.instant);
    if (t === null || IGNOREES.has(e.statut)) continue;
    const cle = `${e.id}|${e.reseau}|${t}`;
    if (vues.has(cle)) continue; // rejeu : la même entrée ne compte qu'une fois
    vues.add(cle);
    lues.push({ e, t, jour: jourParis(t) });
  }
  const out: Manque[] = [];
  const nom = (r: IdReseau) => nomReseauCadence(r) ?? r;
  for (const reseau of ORDRE_RESEAUX) {
    const attendus = options.joursAttendus?.[reseau] ?? JOURS_ATTENDUS_DEPART[reseau] ?? [];
    for (const jour of fenetre) {
      if (quota(reglages, reseau) > 0 && attendus.includes(jourSemaine(jour)) && !lues.some((x) => x.e.reseau === reseau && x.jour === jour)) {
        out.push({ code: "creneau-vide", reseau, jour, gravite: "alerte", bloquant: false, message: `${nom(reseau)}, ${libelleJour(jour)} : créneau vide.` });
      }
    }
  }
  for (const { e, t, jour } of lues) {
    if (!fenetre.includes(jour) || e.statut === "publie" || t < now) continue;
    const base = { reseau: e.reseau, jour, entreeId: e.id, bloquant: false as const };
    const lieu = `${nom(e.reseau)}, ${libelleJour(jour)}`;
    if (vide(e.texte)) out.push({ ...base, code: "texte-manquant", gravite: "alerte", message: `${lieu} : il manque le texte.` });
    if (e.reseau !== "tiktok" && vide(e.premierCommentaire)) out.push({ ...base, code: "commentaire-manquant", gravite: "alerte", message: `${lieu} : il manque le premier commentaire.` });
    if (e.visuelValide === false) {
      const urgent = t - now < HEURES_URGENCE * 3600e3;
      out.push({ ...base, code: "visuel-non-valide", gravite: urgent ? "urgent" : "alerte", message: `${lieu} : le visuel n'est pas validé${urgent ? ", publication dans moins de 24 h" : ""}.` });
    }
  }
  const rang = (r: IdReseau) => ORDRE_RESEAUX.indexOf(r);
  return out.sort((a, b) => a.jour.localeCompare(b.jour) || rang(a.reseau) - rang(b.reseau) || a.code.localeCompare(b.code) || (a.entreeId ?? "").localeCompare(b.entreeId ?? ""));
}
