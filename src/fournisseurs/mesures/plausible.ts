/**
 * VISITES ET RENDEZ-VOUS PAR LIEN SUIVI (plan v5 B.5.5, lot G7b). LECTURE SEULE des statistiques du site (Plausible,
 * `POST /api/v2/query` : le corps est une question, rien n'est écrit).
 *
 * - Visites : visiteurs uniques avec `utm_medium=video`, ventilés par `utm_campaign` (= code de la version).
 * - Rendez-vous : parmi eux, ceux qui ont déclenché l'objectif « Outbound Link: Click » vers calendly.com (le site
 *   n'a pas d'objectif « rendez-vous » propre au 03/10/2026 : relevé en lecture réelle, objectifs présents « Outbound
 *   Link: Click » et « File Download »). Réglable (`butRendezVous`, `motifRendezVous`).
 * - Clé `PLAUSIBLE_KEY` (serveur seulement), jamais affichée. Sans clé : lecteur d'essai, qui ne lit RIEN.
 */
import type { LigneLien } from "@/domaine/mesures-rangs";
import { cleDans, ErreurMesure, lireJsonPost, type Env, type Fetch } from "./commun";

export const VARIABLE_CLE_PLAUSIBLE = "PLAUSIBLE_KEY";
export const URL_PLAUSIBLE_PAR_DEFAUT = "https://plausible.axion-ia.com";
export const SITE_PLAUSIBLE_PAR_DEFAUT = "axion-ia.com";
export const BUT_RENDEZ_VOUS_PAR_DEFAUT = "Outbound Link: Click";
export const MOTIF_RENDEZ_VOUS_PAR_DEFAUT = "calendly.com";

export interface OptionsLecturePlausible {
  /** « 30d », « 90d »… ou [début, fin] en AAAA-MM-JJ. */
  periode?: string | [string, string];
  butRendezVous?: string;
  motifRendezVous?: string;
}

/** Corps des deux questions posées (PUR, testé). */
export function questionsPlausible(site: string, o: OptionsLecturePlausible = {}) {
  const date_range = o.periode ?? "90d";
  const video = ["is", "visit:utm_medium", ["video"]];
  return {
    visites: { site_id: site, metrics: ["visitors"], date_range, dimensions: ["visit:utm_campaign", "visit:utm_source"], filters: [video] },
    rendezVous: {
      site_id: site,
      metrics: ["visitors"],
      date_range,
      dimensions: ["visit:utm_campaign", "visit:utm_source"],
      filters: [video, ["is", "event:goal", [o.butRendezVous ?? BUT_RENDEZ_VOUS_PAR_DEFAUT]], ["contains", "event:props:url", [o.motifRendezVous ?? MOTIF_RENDEZ_VOUS_PAR_DEFAUT]]],
    },
  };
}

type ReponsePlausible = { results?: { metrics?: unknown[]; dimensions?: unknown[] }[] };

function lignes(rep: unknown): { campagne: string; source?: string; n: number }[] {
  const r = rep as ReponsePlausible | null;
  if (!r || !Array.isArray(r.results)) throw new ErreurMesure("illisible", "Les statistiques du site sont illisibles.");
  return r.results.map((x) => ({
    campagne: String(x.dimensions?.[0] ?? ""),
    source: x.dimensions?.[1] === undefined ? undefined : String(x.dimensions[1]),
    n: Number(x.metrics?.[0] ?? 0) || 0,
  }));
}

/** Deux réponses Plausible → lignes par code de version et réseau (PUR, testé sur réponses enregistrées). */
export function lignesDepuisReponses(visites: unknown, rendezVous: unknown): LigneLien[] {
  const m = new Map<string, LigneLien>();
  for (const l of lignes(visites)) m.set(`${l.campagne}|${l.source ?? ""}`, { campagne: l.campagne, source: l.source, visites: l.n, rendezVous: 0 });
  for (const l of lignes(rendezVous)) {
    const k = `${l.campagne}|${l.source ?? ""}`;
    const x = m.get(k) ?? { campagne: l.campagne, source: l.source, visites: 0, rendezVous: 0 };
    m.set(k, { ...x, rendezVous: l.n });
  }
  return [...m.values()].filter((l) => l.campagne && l.campagne !== "(not set)");
}

export interface LecteurVisites {
  mode: "reel" | "simulation";
  /** null : rien à lire (lecteur d'essai). */
  lire(o?: OptionsLecturePlausible): Promise<LigneLien[] | null>;
}

export const lecteurVisitesEssai: LecteurVisites = { mode: "simulation", lire: async () => null };

export function creerLecteurPlausible(env: Env = process.env, appeler: Fetch = fetch): LecteurVisites {
  const cle = cleDans(env, VARIABLE_CLE_PLAUSIBLE);
  if (!cle) return lecteurVisitesEssai;
  const base = (cleDans(env, "PLAUSIBLE_URL") ?? URL_PLAUSIBLE_PAR_DEFAUT).replace(/\/+$/, "");
  const site = cleDans(env, "PLAUSIBLE_SITE") ?? SITE_PLAUSIBLE_PAR_DEFAUT;
  return {
    mode: "reel",
    async lire(o = {}) {
      const q = questionsPlausible(site, o);
      const [v, r] = await Promise.all([
        lireJsonPost(appeler, `${base}/api/v2/query`, cle, q.visites, "Les statistiques du site"),
        lireJsonPost(appeler, `${base}/api/v2/query`, cle, q.rendezVous, "Les statistiques du site"),
      ]);
      return lignesDepuisReponses(v, r);
    },
  };
}
