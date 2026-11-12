// Boucle visibilité : lecture hebdomadaire, sans IA et sans appel réel.
// Les données de Search Console et de Plausible sont FOURNIES par l'appelant (déjà lues ailleurs).
// Résultat : de simples suggestions de sujets. Rien n'est jamais écrit dans le calendrier.

export type LigneRequete = { requete: string; clics: number; impressions: number; position: number };
export type LignePage = { page: string; visiteurs: number };

export type EntreeBoucleVisibilite = {
  /** null ou absent = source non disponible. */
  searchConsole?: LigneRequete[] | null;
  plausible?: LignePage[] | null;
  /** Sujets déjà au calendrier (lecture seule). */
  calendrier: readonly string[];
};

export type SuggestionVisibilite = {
  sujet: string;
  source: "search-console" | "plausible";
  raison: string;
  statut: "suggestion";
};

export type ResultatBoucleVisibilite = {
  searchConsole: "disponible" | "non disponible";
  plausible: "disponible" | "non disponible";
  suggestions: SuggestionVisibilite[];
  /** Toujours faux : la boucle ne fait que proposer. */
  ecritureCalendrier: false;
};

const MAX_SUGGESTIONS = 10;
const IMPRESSIONS_MIN = 100;
const TAUX_CLIC_MAX = 0.05;
const VISITEURS_MIN = 100;

const norme = (s: string) => s.trim().toLowerCase();
const fini = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

export function lireBoucleVisibilite(entree: EntreeBoucleVisibilite): ResultatBoucleVisibilite {
  const deja = new Set(entree.calendrier.map(norme));
  const vus = new Set<string>();
  const candidates: { s: SuggestionVisibilite; poids: number }[] = [];

  const ajouter = (sujet: string, source: SuggestionVisibilite["source"], raison: string, poids: number) => {
    const cle = norme(sujet);
    if (!cle || deja.has(cle) || vus.has(cle)) return;
    vus.add(cle);
    candidates.push({ s: { sujet: sujet.trim(), source, raison, statut: "suggestion" }, poids });
  };

  const sc = Array.isArray(entree.searchConsole) ? entree.searchConsole : null;
  const pl = Array.isArray(entree.plausible) ? entree.plausible : null;

  for (const l of sc ?? []) {
    if (!l || typeof l.requete !== "string" || !fini(l.clics) || !fini(l.impressions)) continue;
    if (l.impressions < IMPRESSIONS_MIN || l.clics / l.impressions > TAUX_CLIC_MAX) continue;
    ajouter(l.requete, "search-console", `${l.impressions} affichages pour ${l.clics} clic(s) : sujet à creuser`, l.impressions - l.clics);
  }
  for (const l of pl ?? []) {
    if (!l || typeof l.page !== "string" || !fini(l.visiteurs) || l.visiteurs < VISITEURS_MIN) continue;
    ajouter(l.page, "plausible", `${l.visiteurs} visiteurs : page à prolonger`, l.visiteurs);
  }

  candidates.sort((a, b) => b.poids - a.poids || a.s.sujet.localeCompare(b.s.sujet));
  return {
    searchConsole: sc ? "disponible" : "non disponible",
    plausible: pl ? "disponible" : "non disponible",
    suggestions: candidates.slice(0, MAX_SUGGESTIONS).map((c) => c.s),
    ecritureCalendrier: false,
  };
}
