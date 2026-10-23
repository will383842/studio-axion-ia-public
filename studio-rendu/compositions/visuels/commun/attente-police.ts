/** Attente des polices : fonctions pures (aucun import de remotion ni de fichier de police). */

/** Délai maximal d'attente d'une police (le processus qui la sert peut être saturé au démarrage). */
export const DELAI_POLICE_MS = 20_000;

/** Délai Remotion (`delayRender`) : 30 s, donc toujours PLUS LONG que l'attente de 20 s ci-dessus (c'est notre message qui sort, pas celui de Remotion). */
export const DELAI_DELAYRENDER_MS = 30_000;

/** Attente des titres ajustés (qui attendent eux-mêmes la police 20 s) : plus longue que `DELAI_POLICE_MS`, plus courte que `DELAI_DELAYRENDER_MS`. */
export const DELAI_TITRES_MS = 25_000;

/** Course entre `p` et un délai : rejette avec `message()` si `p` ne se résout pas à temps ; le minuteur est toujours effacé. */
export function avecDelai<T>(p: Promise<T>, delaiMs: number, message: () => string): Promise<T> {
  let minuterie: ReturnType<typeof setTimeout> | undefined;
  const delai = new Promise<never>((_, rejeter) => {
    minuterie = setTimeout(() => rejeter(new Error(message())), delaiMs);
  });
  return Promise.race([p, delai]).finally(() => clearTimeout(minuterie));
}

/** État des polices du document, pour le message d'échec : famille BRUTE (JSON : on voit les guillemets que certains Chromium ajoutent) et statut. */
export function etatPolices(): string {
  if (typeof document === "undefined") return "document absent";
  const polices = [...document.fonts].map((f) => ({ family: f.family, status: f.status }));
  return polices.length ? JSON.stringify(polices) : "aucune police dans document.fonts";
}
