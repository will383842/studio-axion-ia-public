/**
 * Garde « aucun appel réel » : chargée par `setupFiles` (vitest.config.mts), elle remplace `fetch` par une fonction
 * qui échoue avec un message clair. Un test qui veut un fetch le double lui-même (`vi.stubGlobal("fetch", …)`), ce qui
 * écrase cette garde ; `vi.unstubAllGlobals()` la remet.
 */
export const MESSAGE_RESEAU_INTERDIT = "Appel réseau réel interdit dans les tests : doublez fetch avec vi.stubGlobal(\"fetch\", …)";

const fetchOrigine = globalThis.fetch;
const BOUCLE_LOCALE = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?(\/|$)/i;

export function fetchInterdit(entree: unknown, init?: RequestInit): Promise<Response> {
  const url = typeof entree === "string" ? entree : entree instanceof URL ? entree.href : ((entree as { url?: string } | null)?.url ?? String(entree));
  // Serveurs de test lancés par le test lui-même sur ce poste : pas un appel réel.
  if (BOUCLE_LOCALE.test(url)) return fetchOrigine(entree as RequestInfo, init);
  return Promise.reject(new Error(`${MESSAGE_RESEAU_INTERDIT} (appel vers ${url})`));
}

export function installerGardeReseau(): void {
  globalThis.fetch = fetchInterdit as typeof fetch;
}

installerGardeReseau();
