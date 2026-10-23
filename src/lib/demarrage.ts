/**
 * Démarrage du serveur (vérification de bout en bout n° 2, données n° 7 et n° 8). PUR, sans Next ni base.
 *
 * - n° 7 : en PRODUCTION sans `DATABASE_URL`, le studio démarrait sur la démonstration en mémoire, se disait « en bonne
 *   santé », et tout ce qui était saisi disparaissait au redémarrage. Il REFUSE désormais de démarrer, avec un message
 *   clair. Ne sont pas concernés : la construction (`next build`, `NEXT_PHASE=phase-production-build`), les tests
 *   (`VITEST`), le développement (`NODE_ENV` ≠ production), et un essai local volontaire (`STUDIO_SANS_BASE=1`).
 * - n° 8 : une base injoignable au démarrage faisait échouer `register()` ; Next garde cet échec à vie (« Failed to
 *   prepare server ») et TOUTES les réponses passaient en 500, même une fois la base revenue. Le démarrage réessaie
 *   donc plusieurs fois, puis arrête le processus (Docker le relance : `restart: unless-stopped`).
 */

type Env = Partial<Record<"NODE_ENV" | "DATABASE_URL" | "VITEST" | "NEXT_PHASE" | "STUDIO_SANS_BASE", string>>;

/**
 * Relecture sécurité R45 n° 3 : en PRODUCTION, un serveur de rendu relié (`STUDIO_RENDU_URL`) sans sa clé partagée
 * (`STUDIO_RENDU_CLE`) est refusé : sans clé, studio-rendu ne démarre pas, et le studio enverrait des demandes sans
 * preuve. Message de refus, ou `null`. PUR.
 */
export function refusRenduSansCle(env: Partial<Record<"NODE_ENV" | "STUDIO_RENDU_URL" | "STUDIO_RENDU_CLE" | "NEXT_PHASE", string>>): string | null {
  if (env.NODE_ENV !== "production" || env.NEXT_PHASE === "phase-production-build") return null;
  if (!env.STUDIO_RENDU_URL?.trim() || env.STUDIO_RENDU_CLE?.trim()) return null;
  return "STUDIO_RENDU_CLE manque : le studio refuse de parler au serveur de rendu sans sa clé partagée. Renseignez-la dans le .env (la même que celle de studio-rendu), puis relancez.";
}

/** Message de refus si le serveur ne doit pas démarrer sans base ; `null` sinon. */
export function refusDemarrageSansBase(env: Env): string | null {
  if (env.DATABASE_URL) return null;
  if (env.NODE_ENV !== "production") return null;
  if (env.VITEST || env.NEXT_PHASE === "phase-production-build" || env.STUDIO_SANS_BASE === "1") return null;
  return "DATABASE_URL manque : le studio refuse de démarrer en production sans sa base (sinon tout ce qui est saisi serait perdu au redémarrage). Vérifiez la variable dans docker-compose.yml, puis relancez. Essai local volontaire sans base : STUDIO_SANS_BASE=1.";
}

/**
 * Réessaie `action` jusqu'à `essais` fois, `delaiMs` entre deux essais. Renvoie le résultat du premier succès ;
 * relève la DERNIÈRE erreur si tous échouent. `attendre` est injectable pour les tests.
 */
export async function avecReessais<T>(
  action: () => Promise<T>,
  options: { essais: number; delaiMs: number; surEchec?: (essai: number, erreur: unknown) => void; attendre?: (ms: number) => Promise<void> },
): Promise<T> {
  const attendre = options.attendre ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let derniere: unknown;
  for (let essai = 1; essai <= options.essais; essai++) {
    try {
      return await action();
    } catch (erreur) {
      derniere = erreur;
      options.surEchec?.(essai, erreur);
      if (essai < options.essais) await attendre(options.delaiMs);
    }
  }
  throw derniere;
}

/** Promesse rejetée après `ms` (sonde de santé : une base qui ne répond pas ne doit pas bloquer la sonde). */
export function delaiDepasse<T>(promesse: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resoudre, rejeter) => {
    const minuteur = setTimeout(() => rejeter(new Error(`Pas de réponse en ${ms} ms`)), ms);
    promesse.then(
      (v) => {
        clearTimeout(minuteur);
        resoudre(v);
      },
      (e) => {
        clearTimeout(minuteur);
        rejeter(e);
      },
    );
  });
}
