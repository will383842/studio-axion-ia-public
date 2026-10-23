/**
 * CLIENT du conteneur `studio-aligneur` (lot « calage », D3) — contrat `FournisseurAlignement` (fournisseurs/types.ts).
 * HTTP vers `STUDIO_ALIGNEUR_URL` (réseau `interne` du compose, jamais exposé), même protocole que `studio-rendu` :
 *   POST /alignements (202, idempotent) · GET /alignements/{id} (404 = inconnu) · clé partagée `x-studio-rendu-cle`.
 *
 * Règle d'or : le calage ne BLOQUE JAMAIS une vidéo. Ce client ne lève donc rien : une panne devient un état
 * `echec` typé, que le moteur traite (3 essais, puis l'horodatage de la voix est gardé).
 * - 404 sur une demande connue (conteneur redémarré) : la MÊME demande est soumise à nouveau, sous le MÊME identifiant ;
 *   une demande inconnue de ce processus (studio redémarré) → `fichier-inaccessible`, le moteur en refait une.
 * - Conteneur muet : toléré `TOLERANCE_SILENCE_MS`, puis `indisponible`. Une demande qui dépasse `DELAI_MAX_MS` → `indisponible`.
 * - Résultat mal formé : `refuse` (non réessayable : la voix est gardée tout de suite).
 */
import type { MotHorodate } from "@/domaine/types";
import type { DemandeAlignement, EtatAlignement, FournisseurAlignement, ResultatAlignement } from "../types";

export const DELAI_REQUETE_MS = 15_000;
/** Silence du conteneur toléré pendant un suivi (redémarrage, réseau) avant d'abandonner l'essai. */
export const TOLERANCE_SILENCE_MS = 120_000;
/** Durée maximale d'une demande (file comprise) : ~2 min de son se calent en moins d'une minute sur 2 cœurs. */
export const DELAI_MAX_MS = 20 * 60_000;
/** Nouvelles soumissions après un 404 (conteneur redémarré), pour une même demande. */
export const RESOUMISSIONS_MAX = 3;

interface Suivi {
  demande: DemandeAlignement;
  soumisLe: number;
  /** Premier échec de contact non résolu (ms). */
  muetDepuis?: number;
  resoumissions: number;
  /** Échec de la soumission elle-même : rendu au premier suivi. */
  echecSoumission?: EtatAlignement & { statut: "echec" };
}

const echec = (code: "indisponible" | "refuse" | "fichier-inaccessible", message: string, reessayable = true): EtatAlignement => ({ statut: "echec", erreur: { code, reessayable, message } });

/** Résultat renvoyé par le conteneur, vérifié champ par champ ; `null` s'il est mal formé. */
export function lireResultat(brut: unknown): ResultatAlignement | null {
  const r = brut as Partial<ResultatAlignement> | null;
  if (!r || !Array.isArray(r.mots)) return null;
  const mots: MotHorodate[] = [];
  for (const m of r.mots as unknown[]) {
    const x = m as { mot?: unknown; debutSec?: unknown; finSec?: unknown; aligne?: unknown };
    if (typeof x?.mot !== "string" || typeof x.debutSec !== "number" || typeof x.finSec !== "number" || !Number.isFinite(x.debutSec) || !Number.isFinite(x.finSec)) return null;
    mots.push({ mot: x.mot, debutSec: x.debutSec, finSec: x.finSec, ...(x.aligne === false ? ({ aligne: false } as object) : {}) });
  }
  const nombre = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
  return {
    mots,
    motsNonAlignes: nombre(r.motsNonAlignes) ?? 0,
    modele: typeof r.modele === "string" ? r.modele : "studio-aligneur",
    dureeCalculSec: nombre(r.dureeCalculSec) ?? 0,
    ...(nombre(r.ecartMoyenMs) !== undefined ? { ecartMoyenMs: nombre(r.ecartMoyenMs) } : {}),
    ...(nombre(r.ecartMaxMs) !== undefined ? { ecartMaxMs: nombre(r.ecartMaxMs) } : {}),
  };
}

export function creerAligneurHttp(adresse: string, options: { fetch?: typeof fetch; cle?: string; horloge?: () => number } = {}): FournisseurAlignement {
  const base = adresse.replace(/\/+$/, "");
  const appeler = options.fetch ?? fetch;
  const horloge = options.horloge ?? Date.now;
  const entetes: Record<string, string> = { "content-type": "application/json" };
  if (options.cle) entetes["x-studio-rendu-cle"] = options.cle;
  const suivis = new Map<string, Suivi>();

  async function requete(chemin: string, init: RequestInit = {}): Promise<Response | null> {
    try {
      return await appeler(`${base}${chemin}`, { ...init, headers: entetes, signal: AbortSignal.timeout(DELAI_REQUETE_MS) });
    } catch {
      return null;
    }
  }

  /** POST ; renvoie un état d'échec, ou `null` si la demande est acceptée. */
  async function poster(demande: DemandeAlignement): Promise<(EtatAlignement & { statut: "echec" }) | null> {
    const r = await requete("/alignements", { method: "POST", body: JSON.stringify(demande) });
    if (!r || r.status >= 500 || r.status === 429) return echec("indisponible", "Le calage des sous-titres ne répond pas.") as EtatAlignement & { statut: "echec" };
    if (!r.ok) return echec("refuse", `Demande de calage refusée (${r.status}).`, false) as EtatAlignement & { statut: "echec" };
    return null;
  }

  return {
    id: "studio-aligneur",
    type: "alignement",
    mode: "reel",
    nom: "Calage des sous-titres",
    reelPrevu: "WhisperX (studio-aligneur)",
    capacites: { asynchrone: true, accordExige: false, langues: ["fr"] },

    async soumettre(demande) {
      const echecSoumission = (await poster(demande)) ?? undefined;
      suivis.set(demande.idAlignement, { demande, soumisLe: horloge(), resoumissions: 0, ...(echecSoumission ? { echecSoumission } : {}) });
    },

    async suivre(idAlignement): Promise<EtatAlignement> {
      const s = suivis.get(idAlignement);
      if (s?.echecSoumission) {
        suivis.delete(idAlignement);
        return s.echecSoumission;
      }
      if (s && horloge() - s.soumisLe > DELAI_MAX_MS) {
        suivis.delete(idAlignement);
        return echec("indisponible", "Le calage des sous-titres a dépassé son délai.");
      }
      const r = await requete(`/alignements/${encodeURIComponent(idAlignement)}`);
      if (!r || r.status >= 500) {
        // Conteneur muet : on patiente un peu (redémarrage), puis l'essai est abandonné.
        if (s) {
          s.muetDepuis ??= horloge();
          if (horloge() - s.muetDepuis < TOLERANCE_SILENCE_MS) return { statut: "en_cours", progression: 0 };
          suivis.delete(idAlignement);
        }
        return echec("indisponible", "Le calage des sous-titres ne répond pas.");
      }
      if (s) delete s.muetDepuis;
      if (r.status === 404) {
        if (!s) return echec("fichier-inaccessible", "Demande de calage inconnue : à soumettre à nouveau.");
        if (s.resoumissions >= RESOUMISSIONS_MAX) {
          suivis.delete(idAlignement);
          return echec("indisponible", "Le calage des sous-titres oublie la demande.");
        }
        s.resoumissions++;
        const e = await poster(s.demande);
        return e ?? { statut: "en_file", rang: 0 };
      }
      if (!r.ok) return echec("refuse", `Suivi du calage refusé (${r.status}).`, false);
      let corps: unknown;
      try {
        corps = await r.json();
      } catch {
        return echec("refuse", "Réponse du calage illisible.", false);
      }
      const e = corps as { statut?: string; rang?: unknown; progression?: unknown; resultat?: unknown; erreur?: { code?: string; reessayable?: unknown; message?: unknown } };
      if (e.statut === "en_file") return { statut: "en_file", rang: typeof e.rang === "number" ? e.rang : 0 };
      if (e.statut === "en_cours") return { statut: "en_cours", progression: typeof e.progression === "number" ? e.progression : 0 };
      if (e.statut === "termine") {
        suivis.delete(idAlignement);
        const resultat = lireResultat(e.resultat);
        return resultat ? { statut: "termine", resultat } : echec("refuse", "Résultat du calage mal formé.", false);
      }
      if (e.statut === "echec") {
        suivis.delete(idAlignement);
        const codes = ["fichier-inaccessible", "indisponible", "refuse", "quota", "inconnu"] as const;
        const code = codes.find((c) => c === e.erreur?.code) ?? "inconnu";
        return { statut: "echec", erreur: { code, reessayable: e.erreur?.reessayable !== false, message: typeof e.erreur?.message === "string" ? e.erreur.message : "Calage impossible." } };
      }
      return echec("refuse", "État du calage inconnu.", false);
    },
  };
}
