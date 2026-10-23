/**
 * STATISTIQUES BUFFER PAR PUBLICATION (plan v5 B.5.5, B.8 §2, lot G7b). LECTURE SEULE.
 *
 * - On lit une publication Buffer par son identifiant (`Publication.idExterne`, écrit à l'envoi en G7a) et ses
 *   statistiques (vues, portée, réactions, commentaires, partages). Aucune mutation n'est jamais envoyée.
 * - Clé `BUFFER_API_KEY` (serveur seulement). Sans clé : lecteur d'essai, qui ne lit RIEN (aucun chiffre inventé).
 * - Forme RECALÉE le 03/10/2026 (lot R1) sur le schéma relevé par introspection (`docs/buffer/schema-2026-10.json`) :
 *   `post(input: { id })` → `metrics: [PostMetric!] { type: PostMetricType, value: Float }`, `metricsUpdatedAt`. Une
 *   réponse RÉELLE enregistrée (anonymisée) est dans `tests/fixtures/r1-buffer-lectures.json` (« stats ») ; le test
 *   `r1-buffer-schema` vérifie cette requête contre le schéma. L'autre forme (objet `{clé: valeur}`) reste acceptée.
 */
import type { StatsPublication } from "@/domaine/types";
import { cleDans, ErreurMesure, lireJsonPost, type Env, type Fetch } from "./commun";

export const VARIABLE_CLE_BUFFER = "BUFFER_API_KEY";
export const URL_BUFFER = "https://api.buffer.com";

/** Requête de lecture (GraphQL `query`, jamais `mutation`). */
export const REQUETE_POST_BUFFER = `query StatistiquesPublication($id: PostId!) {
  post(input: { id: $id }) {
    id
    status
    sentAt
    metricsUpdatedAt
    metrics { type value }
  }
}`;

export interface StatistiquesBuffer {
  idExterne: string;
  /** Statut Buffer (« sent », « scheduled »…). */
  statut?: string;
  envoyeeLe?: string;
  /** Fraîcheur des statistiques (Buffer les rafraîchit environ une fois par jour). */
  misesAJourLe?: string;
  valeurs: Partial<StatsPublication> & { portee?: number };
}

/** Noms usuels des statistiques, du plus précis au plus large. */
const NOMS: Record<"vues" | "portee" | "likes" | "commentaires" | "partages" | "dureeMoyenneVueSec", string[]> = {
  vues: ["videoviews", "views", "plays", "videoplays", "impressions"],
  // `viewers` (LinkedIn, spectateurs uniques) relevé le 03/10/2026.
  portee: ["reach", "uniqueviewers", "viewers", "accountsreached"],
  likes: ["likes", "reactions"],
  commentaires: ["comments", "replies"],
  partages: ["shares", "reposts", "retweets"],
  // `averageTimeWatched` : relevé dans `PostMetricType` le 03/10/2026, « in seconds ».
  dureeMoyenneVueSec: ["averagetimewatched", "averagewatchtime", "averagewatchtimeseconds", "avgwatchtime"],
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

function nombre(x: unknown): number | undefined {
  const n = typeof x === "string" ? Number.parseFloat(x) : x;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** Statistiques d'une publication Buffer → valeurs du studio (PUR). Une statistique absente reste absente. */
export function statsDepuisPostBuffer(post: unknown): StatistiquesBuffer {
  if (!post || typeof post !== "object") throw new ErreurMesure("illisible", "Buffer n'a pas renvoyé cette publication.");
  const p = post as Record<string, unknown>;
  const brut = p.metrics ?? p.statistics ?? p.analytics;
  const table = new Map<string, number>();
  if (Array.isArray(brut)) {
    for (const m of brut) {
      if (!m || typeof m !== "object") continue;
      const o = m as Record<string, unknown>;
      const nom = typeof o.type === "string" ? o.type : typeof o.name === "string" ? o.name : typeof o.key === "string" ? o.key : undefined;
      const v = nombre(o.value ?? o.total);
      if (nom && v !== undefined) table.set(norm(nom), v);
    }
  } else if (brut && typeof brut === "object") {
    for (const [k, v] of Object.entries(brut as Record<string, unknown>)) {
      const n = nombre(v);
      if (n !== undefined) table.set(norm(k), n);
    }
  }
  const lire = (cle: keyof typeof NOMS) => {
    for (const n of NOMS[cle]) if (table.has(n)) return table.get(n);
    return undefined;
  };
  const valeurs: StatistiquesBuffer["valeurs"] = {};
  for (const cle of Object.keys(NOMS) as (keyof typeof NOMS)[]) {
    const v = lire(cle);
    if (v !== undefined) (valeurs as Record<string, number>)[cle] = cle === "dureeMoyenneVueSec" ? v : Math.round(v);
  }
  if (valeurs.partages !== undefined && valeurs.portee) valeurs.partagesParPortee = Math.round((valeurs.partages / valeurs.portee) * 10_000) / 100;
  return {
    idExterne: String(p.id ?? ""),
    statut: typeof p.status === "string" ? p.status : undefined,
    envoyeeLe: typeof p.sentAt === "string" ? p.sentAt : undefined,
    misesAJourLe: typeof p.metricsUpdatedAt === "string" ? p.metricsUpdatedAt : undefined,
    valeurs,
  };
}

/** Réponse GraphQL complète → statistiques (erreurs GraphQL comprises). */
export function statsDepuisReponseBuffer(reponse: unknown): StatistiquesBuffer {
  const r = reponse as { data?: { post?: unknown }; errors?: { message?: string }[] } | null;
  if (r?.errors?.length) throw new ErreurMesure("illisible", "Buffer n'a pas pu lire cette publication.");
  return statsDepuisPostBuffer(r?.data?.post);
}

export interface LecteurStatsBuffer {
  mode: "reel" | "simulation";
  /** null : rien à lire (lecteur d'essai). */
  lire(idExterne: string): Promise<StatistiquesBuffer | null>;
}

/** Lecteur d'essai : ne lit rien, n'invente rien. */
export const lecteurBufferEssai: LecteurStatsBuffer = { mode: "simulation", lire: async () => null };

/** Lecteur réel si `BUFFER_API_KEY` existe, sinon lecteur d'essai. */
export function creerLecteurBuffer(env: Env = process.env, appeler: Fetch = fetch): LecteurStatsBuffer {
  const cle = cleDans(env, VARIABLE_CLE_BUFFER);
  if (!cle) return lecteurBufferEssai;
  return {
    mode: "reel",
    async lire(idExterne) {
      if (!/^[A-Za-z0-9_-]{6,64}$/.test(idExterne)) throw new ErreurMesure("illisible", "Identifiant Buffer illisible.");
      const rep = await lireJsonPost(appeler, URL_BUFFER, cle, { query: REQUETE_POST_BUFFER, variables: { id: idExterne } }, "Buffer");
      return statsDepuisReponseBuffer(rep);
    },
  };
}
