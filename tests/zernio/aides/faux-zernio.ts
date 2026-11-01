/**
 * Aides de test Zernio : faux fetch qui ENREGISTRE chaque appel, horloge fictive, posts d'exemple.
 * Données 100 % fictives (« exemple-… ») : aucun identifiant réel, aucune vraie clé.
 */
import { creerClientZernio, type ClientZernio, type FetchZernio, type JournalZernio, type OptionsClientZernio, type PostZernio } from "@/fournisseurs/publication/zernio-client";

/** Clé FICTIVE : sert à vérifier qu'elle n'apparaît dans aucune erreur ni aucun journal. */
export const CLE_FICTIVE = "exemple-cle-fictive-ne-pas-utiliser-0001";

/** Jetons concaténés : les mots interdits ne s'écrivent jamais en clair dans le dépôt. */
export const J = (...p: string[]): string => p.join("");
export const MOT_INTERDIT = J("cert", "ifié");
export const NOM_LABEL = J("Quali", "opi");

export interface AppelEnregistre {
  url: string;
  methode: string;
  entetes: Record<string, string>;
  corps?: string;
  /** Corps JSON décodé quand c'en est un. */
  json?: unknown;
}

export type ReponsePreparee =
  | { statut: number; corps?: unknown; entetes?: Record<string, string> }
  | { erreur: "delai" | "reseau"; message?: string };

export interface FauxFetch {
  fetch: FetchZernio;
  appels: AppelEnregistre[];
}

/**
 * Faux fetch : rend les réponses préparées dans l'ordre (ou via une fonction), enregistre chaque appel.
 * Sans réponse préparée restante : 500 explicite (le test le verra).
 */
export function creerFauxFetch(reponses: ReponsePreparee[] | ((appel: AppelEnregistre) => ReponsePreparee) = []): FauxFetch {
  const appels: AppelEnregistre[] = [];
  const file = Array.isArray(reponses) ? [...reponses] : null;
  const fetch: FetchZernio = async (url, init) => {
    const corps = typeof init.body === "string" ? init.body : init.body ? "(binaire)" : undefined;
    let json: unknown;
    if (typeof init.body === "string") {
      try {
        json = JSON.parse(init.body);
      } catch {
        json = undefined;
      }
    }
    const appel: AppelEnregistre = { url, methode: init.method, entetes: { ...init.headers }, corps, json };
    appels.push(appel);
    const r = file ? (file.shift() ?? { statut: 500, corps: { error: "aucune réponse préparée" } }) : (reponses as (a: AppelEnregistre) => ReponsePreparee)(appel);
    if ("erreur" in r) {
      const e = new Error(r.message ?? (r.erreur === "delai" ? "The operation was aborted due to timeout" : "fetch failed"));
      e.name = r.erreur === "delai" ? "TimeoutError" : "TypeError";
      throw e;
    }
    return new Response(r.corps === undefined ? null : JSON.stringify(r.corps), {
      status: r.statut,
      headers: { "content-type": "application/json", ...(r.entetes ?? {}) },
    });
  };
  return { fetch, appels };
}

/** Fetch qui fait échouer le test s'il est appelé (preuve qu'un refus a eu lieu AVANT le réseau). */
export function fetchInterdit(): FauxFetch {
  const faux = creerFauxFetch(() => {
    throw new Error("appel réseau interdit dans ce test");
  });
  return faux;
}

/** Horloge fictive : `attendre` avance le temps sans dormir. */
export function horlogeFictive(debutIso = "2026-11-01T08:00:00Z") {
  let t = Date.parse(debutIso);
  const attentes: number[] = [];
  return {
    maintenant: () => t,
    avancer: (ms: number) => {
      t += ms;
    },
    attendre: async (ms: number) => {
      attentes.push(ms);
      t += ms;
    },
    attentes,
  };
}

/** Journal qui garde tout ce qu'il reçoit (pour vérifier que la clé n'y est jamais). */
export function journalEnregistreur(): JournalZernio & { lignes: string[] } {
  const lignes: string[] = [];
  const garder = (niveau: string) => (message: string, donnees?: Record<string, unknown>) => {
    lignes.push(`${niveau} ${message} ${donnees ? JSON.stringify(donnees) : ""}`);
  };
  return { lignes, info: garder("info"), alerte: garder("alerte") };
}

/** Client branché sur un faux fetch et une horloge fictive. */
export function creerFauxClientZernio(
  reponses: ReponsePreparee[] | ((appel: AppelEnregistre) => ReponsePreparee) = [],
  options: Partial<OptionsClientZernio> = {},
): { client: ClientZernio; faux: FauxFetch; horloge: ReturnType<typeof horlogeFictive>; journal: ReturnType<typeof journalEnregistreur> } {
  const faux = creerFauxFetch(reponses);
  const horloge = horlogeFictive();
  const journal = journalEnregistreur();
  const client = creerClientZernio({
    cle: CLE_FICTIVE,
    fetch: faux.fetch,
    maintenant: horloge.maintenant,
    attendre: horloge.attendre,
    journal,
    nombreComptes: 2,
    ...options,
  });
  return { client, faux, horloge, journal };
}

/** Post d'exemple (brouillon du Studio). */
export function postExemple(partiel: Partial<PostZernio> = {}): PostZernio {
  return {
    _id: "exemple-post-1",
    content: "Texte d'exemple",
    status: "draft",
    platforms: [{ platform: "instagram", accountId: "exemple-compte-1", status: "pending" }],
    metadata: { origine: "studio", studioCle: "studio-exemple" },
    ...partiel,
  };
}
