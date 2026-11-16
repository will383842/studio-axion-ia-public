/** S3-03 : gardes pures du chat de retouche (module non câblé, aucun appel externe). */

export type VerdictLimite = { ok: true } | { ok: false; phrase: string; reessayerDansSec: number };

export interface OptionsLimiteur {
  maxParFenetre: number;
  fenetreMs: number;
  /** Horloge injectée (jamais l'heure système en dur). */
  maintenant: () => number;
}

/** Au plus `maxParFenetre` demandes par `fenetreMs` et par clé ; les vieilles entrées sont purgées. */
export function creerLimiteur(options: OptionsLimiteur) {
  const { maxParFenetre, fenetreMs, maintenant } = options;
  const parCle = new Map<string, number[]>();

  const purger = (now: number) => {
    for (const [cle, dates] of parCle) {
      const vives = dates.filter((d) => now - d < fenetreMs);
      if (vives.length === 0) parCle.delete(cle);
      else if (vives.length !== dates.length) parCle.set(cle, vives);
    }
  };

  return {
    verifier(cle: string): VerdictLimite {
      const now = maintenant();
      purger(now);
      const dates = parCle.get(cle) ?? [];
      if (dates.length >= maxParFenetre) {
        const reessayerDansSec = Math.max(1, Math.ceil((dates[0] + fenetreMs - now) / 1000));
        return {
          ok: false,
          phrase: `Vous avez envoyé beaucoup de demandes d'affilée : réessayez dans ${reessayerDansSec} seconde${reessayerDansSec > 1 ? "s" : ""}.`,
          reessayerDansSec,
        };
      }
      dates.push(now);
      parCle.set(cle, dates);
      return { ok: true };
    },
    /** Nombre de clés encore suivies (pour les tests). */
    taille: () => parCle.size,
  };
}

export const PHRASE_RETOUCHE_EN_COURS = "Une retouche est déjà en cours sur cette vidéo : attendez qu'elle finisse.";

export type ResultatVerrou<T> = { ok: true; valeur: T } | { ok: false; phrase: string };

/** Une seule application à la fois par vidéo ; la 2e entrée est refusée sans appeler `fn`. */
export function creerVerrouApplication() {
  const enCours = new Set<string>();
  return {
    async sousVerrou<T>(videoId: string, fn: () => Promise<T>): Promise<ResultatVerrou<T>> {
      if (enCours.has(videoId)) return { ok: false, phrase: PHRASE_RETOUCHE_EN_COURS };
      enCours.add(videoId);
      try {
        return { ok: true, valeur: await fn() };
      } finally {
        enCours.delete(videoId);
      }
    },
  };
}
