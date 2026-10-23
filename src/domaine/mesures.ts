/**
 * MESURE MINIMALE (plan v5 B.5.5, B.8 §2, lot G7a). PUR : importable côté client.
 *
 * - Relevés à J+3 et J+7, saisis à la main en un écran (30 s par vidéo, au téléphone) : abandon à 3 s, durée moyenne
 *   regardée, partages ÷ portée. Ajout seul, datés, avec leurs définitions. AUCUNE PRÉDICTION : on range ce qui a été
 *   mesuré, rien d'autre.
 * - Lien suivi : un seul constructeur (`construireLienSuivi`, ADR 0002 de l'Usine), vidéo × réseau × activité.
 * - « Programmer les N » : les versions d'un sujet qui ont leur vidéo, un format à la fois, une par réseau, dans l'ordre
 *   J à J+4 de `planifierPublications`.
 */
import { planifierPublications, type CreneauPropose } from "./classement-generateur";
import type { EtatReseau } from "./derivations-generateur";
import type { Publication, ReseauDeclinaison, StatsPublication } from "./types";
import { JOUR_MS } from "@/lib/dates";
import { formateurDate } from "@/lib/intl";

/* ------------------------------------------------------------------ */
/* Échéances J+3 et J+7                                                */
/* ------------------------------------------------------------------ */

export const JOURS_MESURE = [3, 7] as const;
export type JourMesure = (typeof JOURS_MESURE)[number];

/** Définitions écrites avec chaque relevé (B.8 §2) : un chiffre sans définition ne se compare à rien. */
export const DEFINITIONS_MESURES: Readonly<Record<"tauxAbandon3s" | "dureeMoyenneVueSec" | "partages" | "portee" | "partagesParPortee", string>> = {
  tauxAbandon3s: "Part des spectateurs partis avant 3 secondes (%), lue dans les statistiques du réseau.",
  dureeMoyenneVueSec: "Durée moyenne regardée par vue (secondes).",
  partages: "Nombre de partages de la publication.",
  portee: "Personnes atteintes (comptes uniques), lue dans les statistiques du réseau.",
  partagesParPortee: "Partages ÷ personnes atteintes × 100 (%), calculé.",
};

type PublicationMesurable = Pick<Publication, "via" | "statut" | "date" | "varianteId" | "releves">;

/**
 * Relevé attendu pour une publication à l'instant donné : 7 dès J+7 s'il manque (le J+3 oublié n'est plus demandé),
 * sinon 3 entre J+3 et J+7, sinon rien. Seules les publications d'une version du générateur, réellement parties (jamais
 * un essai), sont mesurées.
 */
export function echeanceMesure(p: PublicationMesurable, maintenant: Date | string = new Date(), options: { essai?: boolean } = {}): JourMesure | null {
  if (!p.varianteId) return null;
  // Une publication d'ESSAI (envoi simulé) n'attend une mesure qu'en mode essai, marqué ESSAI (vérification E2E n° 1, n° 29) ;
  // ses chiffres ne rejoignent jamais les vrais (« Ce qui marche » les ignore).
  if (p.via === "simulation") {
    if (!options.essai) return null;
  } else if (p.statut !== "publiee" && p.statut !== "programmee") return null;
  const age = (new Date(maintenant).getTime() - new Date(p.date).getTime()) / JOUR_MS;
  const fait = (j: number) => (p.releves ?? []).some((r) => r.jour === j);
  if (age >= 7) return fait(7) ? null : 7;
  if (age >= 3 && !fait(3)) return 3;
  return null;
}

/* ------------------------------------------------------------------ */
/* Saisie                                                              */
/* ------------------------------------------------------------------ */

export interface SaisieMesures {
  /** Partis avant 3 s (%). */
  abandon3s: number;
  /** Durée moyenne regardée (s). */
  dureeMoyenneSec: number;
  partages: number;
  /** Personnes atteintes. */
  portee: number;
}

/** « 12,5 », « 12.5 », « 1 240 », « 35 % » → nombre ; vide ou illisible → NaN. */
export function lireNombreFr(texte: string): number {
  const t = texte.replace(/[\s  %]/g, "").replace(",", ".");
  if (!t || !/^\d*\.?\d+$/.test(t)) return Number.NaN;
  return Number(t);
}

/** Partages ÷ portée, en %, deux décimales. */
export function partagesParPortee(partages: number, portee: number): number {
  return portee > 0 ? Math.round((partages / portee) * 10_000) / 100 : 0;
}

export type ResultatSaisie = { ok: true; valeurs: Pick<StatsPublication, "tauxAbandon3s" | "dureeMoyenneVueSec" | "partages" | "partagesParPortee" | "portee"> } | { ok: false; champ: keyof SaisieMesures; message: string };

/** Contrôle de la saisie : bornes simples, messages courts. */
export function controlerSaisie(s: SaisieMesures): ResultatSaisie {
  const fini = (n: number) => typeof n === "number" && Number.isFinite(n);
  if (!fini(s.abandon3s) || s.abandon3s < 0 || s.abandon3s > 100) return { ok: false, champ: "abandon3s", message: "Un pourcentage entre 0 et 100." };
  if (!fini(s.dureeMoyenneSec) || s.dureeMoyenneSec < 0 || s.dureeMoyenneSec > 3600) return { ok: false, champ: "dureeMoyenneSec", message: "Une durée en secondes." };
  if (!fini(s.partages) || s.partages < 0 || !Number.isInteger(s.partages)) return { ok: false, champ: "partages", message: "Un nombre entier." };
  if (!fini(s.portee) || s.portee <= 0 || !Number.isInteger(s.portee)) return { ok: false, champ: "portee", message: "Un nombre entier, au moins 1." };
  return {
    ok: true,
    valeurs: { tauxAbandon3s: s.abandon3s, dureeMoyenneVueSec: s.dureeMoyenneSec, partages: s.partages, portee: s.portee, partagesParPortee: partagesParPortee(s.partages, s.portee) },
  };
}

/* ------------------------------------------------------------------ */
/* Lien suivi (B.5.5)                                                  */
/* ------------------------------------------------------------------ */

export const PAGE_SUIVIE_PAR_DEFAUT = "https://axion-ia.com/fr/diagnostic";

/* ------------------------------------------------------------------ */
/* Lien suivi unique (ADR 0002) : le SEUL constructeur du studio        */
/* ------------------------------------------------------------------ */

export const NATURES_LIEN = ["message", "profil", "video"] as const;
export type NatureLien = (typeof NATURES_LIEN)[number];
export const ACTIVITES_LIEN = ["clients", "apporteurs", "formateurs"] as const;
export type ActiviteLien = (typeof ACTIVITES_LIEN)[number];
export const PAGES_LIEN = ["/fr/appel", "/fr/guide-ia", "/fr/diagnostic"] as const;
const RESEAUX_LIEN = ["linkedin", "instagram", "facebook", "tiktok", "youtube", "youtube-shorts"] as const;
const RESEAUX_MESSAGE = ["facebook", "instagram", "linkedin"] as const;
const LONGUEUR_MAX_LIEN = 60;
const CODE_VERSION = /^[0-9]{4,6}-[A-Z]{2,3}-[A-Z]{2,3}(-[A-Z0-9]{1,8})*$/;
const CODE_MOT = /^mot-[a-z0-9][a-z0-9-]*$/;

export type RefusLienSuivi =
  | "reseau_inconnu"
  | "nature_reservee"
  | "nature_inconnue"
  | "activite_inconnue"
  | "page_interdite"
  | "code_version_attendu"
  | "code_mot_attendu"
  | "caractere_interdit"
  | "trop_long"
  | "message_impossible_sur_ce_reseau";

/** Un lien refusé n'est jamais corrigé ni rendu en partie : l'erreur porte le motif de l'ADR 0002 (§ 5, T2). */
export class ErreurLienSuivi extends Error {
  constructor(readonly refus: RefusLienSuivi, message: string) {
    super(message);
    this.name = "ErreurLienSuivi";
  }
}

export interface EntreeLienSuivi {
  /** `video` (lien d'une vidéo), `message` (réponse à un mot), `profil` (bio, chaîne). `post` est réservé. */
  typeLien: string;
  reseau: string;
  /** `video` : code de version (`0042-TB-IG`, jamais modifié) ; `message` et `profil` : code du mot (`mot-guide`). */
  code: string;
  activite: string;
  /** Chemin d'une page permise (`/fr/appel`, `/fr/guide-ia`, `/fr/diagnostic`), sans requête ni ancre. */
  page: string;
}

/**
 * `https://axion-ia.com<page>?utm_source=<réseau>&utm_medium=<nature>&utm_campaign=<code>&utm_content=<activité>[&depuis=<nature>-<réseau>]`
 * (ADR 0002 § 3.1). Ordre fixe, rien d'encodé, `depuis` seulement sur `/fr/appel`. Réseau, nature et activité sont ramenés
 * en minuscules ; le code n'est jamais touché. Tout écart est un refus (`ErreurLienSuivi`).
 */
export function construireLienSuivi(entree: EntreeLienSuivi): string {
  const nature = entree.typeLien.toLowerCase();
  if (nature === "post") throw new ErreurLienSuivi("nature_reservee", "Un lien de publication sans vidéo est réservé : aucun code n'existe encore pour ces contenus.");
  if (!(NATURES_LIEN as readonly string[]).includes(nature)) throw new ErreurLienSuivi("nature_inconnue", `Nature de lien inconnue : « ${entree.typeLien} ».`);
  const reseau = entree.reseau.toLowerCase();
  if (!(RESEAUX_LIEN as readonly string[]).includes(reseau)) throw new ErreurLienSuivi("reseau_inconnu", `Réseau inconnu : « ${entree.reseau} ».`);
  if (nature === "message" && !(RESEAUX_MESSAGE as readonly string[]).includes(reseau)) {
    throw new ErreurLienSuivi("message_impossible_sur_ce_reseau", `Aucun outil n'envoie de message privé sur ${reseau}.`);
  }
  const activite = entree.activite.toLowerCase();
  if (!(ACTIVITES_LIEN as readonly string[]).includes(activite)) throw new ErreurLienSuivi("activite_inconnue", `Activité inconnue : « ${entree.activite} ».`);
  if (!(PAGES_LIEN as readonly string[]).includes(entree.page)) throw new ErreurLienSuivi("page_interdite", `Page non permise : « ${entree.page} ».`);
  if (!/^[A-Za-z0-9-]+$/.test(entree.code)) throw new ErreurLienSuivi("caractere_interdit", "Le code ne contient que des lettres, des chiffres et des tirets.");
  if (entree.code.length > LONGUEUR_MAX_LIEN) throw new ErreurLienSuivi("trop_long", `Le code dépasse ${LONGUEUR_MAX_LIEN} signes.`);
  if (nature === "video" && !CODE_VERSION.test(entree.code)) throw new ErreurLienSuivi("code_version_attendu", "Un lien de vidéo porte le code de version (« 0042-TB-IG »).");
  if (nature !== "video" && !CODE_MOT.test(entree.code)) throw new ErreurLienSuivi("code_mot_attendu", "Un message ou un profil porte le code du mot (« mot-guide »).");
  const parametres = [`utm_source=${reseau}`, `utm_medium=${nature}`, `utm_campaign=${entree.code}`, `utm_content=${activite}`];
  if (entree.page === "/fr/appel") parametres.push(`depuis=${nature}-${reseau}`);
  return `https://axion-ia.com${entree.page}?${parametres.join("&")}`;
}

/** Chemin de la page réglée par Will (`publication.pageSuivie`) si c'est une page permise du site ; sinon la page par défaut. */
export function pageDuLien(reglage: string | undefined): (typeof PAGES_LIEN)[number] {
  const defaut = new URL(PAGE_SUIVIE_PAR_DEFAUT).pathname as (typeof PAGES_LIEN)[number];
  try {
    const u = new URL(reglage ?? PAGE_SUIVIE_PAR_DEFAUT);
    const chemin = u.pathname.replace(/\/+$/, "");
    if (u.protocol === "https:" && u.hostname === "axion-ia.com" && (PAGES_LIEN as readonly string[]).includes(chemin)) return chemin as (typeof PAGES_LIEN)[number];
  } catch {
    /* réglage illisible : page par défaut */
  }
  return defaut;
}

/** Activité d'un public visé (« public.apporteurs », « apporteurs », « formateurs »…) ; tout le reste vaut « clients ». */
export function activiteDuPublic(publicVise: string | undefined): ActiviteLien {
  const p = (publicVise ?? "").toLowerCase();
  if (p.includes("apporteur")) return "apporteurs";
  if (p.includes("formateur")) return "formateurs";
  return "clients";
}

/**
 * Lien suivi d'une version de vidéo pour l'écran de publication : celui de l'ADR 0002, ou `undefined` si le code ou le
 * réseau de la version est refusé (l'écran n'affiche alors aucun lien plutôt qu'un lien faux).
 */
export function lienDeVersion(page: string | undefined, version: { reseau: string; code: string }, publicVise?: string): string | undefined {
  try {
    return construireLienSuivi({ typeLien: "video", reseau: version.reseau, code: version.code, activite: activiteDuPublic(publicVise), page: pageDuLien(page) });
  } catch (err) {
    if (err instanceof ErreurLienSuivi) return undefined;
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/* « Programmer les N » (B.5.5)                                        */
/* ------------------------------------------------------------------ */

export interface VersionProgrammable {
  id: string;
  code: string;
  reseau: ReseauDeclinaison;
  formatId: string;
  /** État calculé de la case (seules les versions « en-video » partent). */
  etatCase: EtatReseau;
  videoId?: string;
  /** Rang de la ligne dans la grille (format × corps) : la première ligne passe d'abord. */
  rangLigne: number;
}

/**
 * Versions à programmer au prochain toucher : un format à la fois (celui demandé, sinon le premier qui a une vidéo prête),
 * une version par réseau (la première ligne de la grille), jamais une version déjà envoyée (même en essai).
 */
export function versionsAProgrammer(versions: readonly VersionProgrammable[], options: { formatId?: string; dejaEnvoyees?: ReadonlySet<string> } = {}): VersionProgrammable[] {
  const pretes = versions
    .filter((v) => v.etatCase === "en-video" && !!v.videoId && !options.dejaEnvoyees?.has(v.id))
    .sort((a, b) => a.rangLigne - b.rangLigne);
  const formatId = options.formatId ?? pretes[0]?.formatId;
  const retenues: VersionProgrammable[] = [];
  for (const v of pretes) if (v.formatId === formatId && !retenues.some((r) => r.reseau === v.reseau)) retenues.push(v);
  return retenues;
}

/** Heure proposée quand Will n'en a pas réglé pour ce réseau (celle de « Demain 9 h » de la feuille Buffer). */
export const HEURE_PAR_DEFAUT = "09:00";

/** « 2026-10-06 » + « 09:00 » à l'heure de Paris → instant ISO (gère l'heure d'été). */
export function instantParis(jour: string, heure: string): string {
  const [a, m, j] = jour.split("-").map(Number);
  const [h, mi] = heure.split(":").map(Number);
  const suppose = Date.UTC(a, m - 1, j, h, mi);
  const parties = Object.fromEntries(
    formateurDate("en-GB", { timeZone: "Europe/Paris", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(new Date(suppose))
      .map((p) => [p.type, p.value]),
  );
  const vuAParis = Date.UTC(Number(parties.year), Number(parties.month) - 1, Number(parties.day), Number(parties.hour), Number(parties.minute));
  return new Date(suppose - (vuAParis - suppose)).toISOString();
}

export interface CreneauVersion extends CreneauPropose {
  varianteId: string;
  code: string;
  videoId: string;
  /** Instant d'envoi (ISO). */
  date: string;
  /** true : aucune heure réglée pour ce réseau, 9 h par défaut. */
  heureParDefaut: boolean;
}

/** Créneaux J à J+4 des versions retenues (ordre et heures réglés par Will). */
export function planProgrammation(
  jourJ: string,
  retenues: readonly VersionProgrammable[],
  ordre?: readonly string[],
  heures: Partial<Record<ReseauDeclinaison, string>> = {},
): CreneauVersion[] {
  const creneaux = planifierPublications(
    jourJ,
    retenues.map((v) => v.reseau),
    ordre,
    heures,
  );
  return creneaux.map((c) => {
    const v = retenues.find((x) => x.reseau === c.reseau)!;
    return { ...c, varianteId: v.id, code: v.code, videoId: v.videoId!, date: instantParis(c.jour, c.heure ?? HEURE_PAR_DEFAUT), heureParDefaut: !c.heure };
  });
}
