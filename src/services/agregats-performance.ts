/**
 * L8-16 · Agrégats de performance : CALCUL PUR. INERTE.
 *
 * Reçoit des mesures déjà lues (aucune lecture ici), les regroupe par (type, réseau, tranche horaire) et rend, par case,
 * l'effectif et les moyennes. Toute case d'effectif inférieur au seuil de masquage est ABSENTE du résultat et seulement comptée.
 *
 * Aucun import, aucune base, aucun réseau, aucun envoi, aucun appelant (voir tests/agregats-performance.test.ts).
 * Décision du 18/11 : aucun canal vers l'usine (« aucun second canal » reste en vigueur) ; un transport éventuel
 * (L8-16b) exigerait une décision écrite du fondateur.
 *
 * Interrupteur : `AGREGATS_PERFORMANCE_ENABLED`, vrai seulement pour « 1 » ou « true » exactement. Éteint par défaut ;
 * éteint, rien n'est lu ni calculé.
 *
 * Valeurs (proposition du pilotage, à valider par le fondateur) : seuil de masquage 3 ; tranches horaires matin, midi,
 * apres-midi, soir, nuit.
 */

/** Proposition du pilotage, à valider par le fondateur. */
export const SEUIL_MASQUAGE = 3;

/** Proposition du pilotage, à valider par le fondateur. */
export const TRANCHES_HORAIRES = ["matin", "midi", "apres-midi", "soir", "nuit"] as const;

export const VARIABLE_INTERRUPTEUR_AGREGATS_PERFORMANCE = "AGREGATS_PERFORMANCE_ENABLED";

export type MesurePerformance = {
  type: string;
  reseau: string;
  trancheHoraire: string;
  vues: number;
  partages: number;
  commentaires: number;
};

export type CaseAgregat = {
  type: string;
  reseau: string;
  tranche: string;
  effectif: number;
  moyennes: { vues: number; partages: number; commentaires: number };
};

export type ResultatAgregats = { etat: "eteint" } | { etat: "calcule"; cases: CaseAgregat[]; masquees: number };

type Env = Readonly<Record<string, string | undefined>>;

export function agregatsPerformanceActifs(env?: Env): boolean {
  const v = env?.[VARIABLE_INTERRUPTEUR_AGREGATS_PERFORMANCE];
  return v === "1" || v === "true";
}

function valide(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

export function calculerAgregatsPerformance(
  mesures: readonly MesurePerformance[],
  options: { env?: Env; seuil?: number } = {},
): ResultatAgregats {
  if (!agregatsPerformanceActifs(options.env)) return { etat: "eteint" };
  // Le seuil peut monter, jamais descendre sous le plancher.
  const seuil = Number.isFinite(options.seuil) ? Math.max(SEUIL_MASQUAGE, options.seuil as number) : SEUIL_MASQUAGE;

  const groupes = new Map<string, { type: string; reseau: string; tranche: string; n: number; v: number; p: number; c: number }>();
  for (const m of mesures) {
    if (!valide(m.vues) || !valide(m.partages) || !valide(m.commentaires)) continue;
    const cle = JSON.stringify([m.type, m.reseau, m.trancheHoraire]);
    const g = groupes.get(cle) ?? { type: m.type, reseau: m.reseau, tranche: m.trancheHoraire, n: 0, v: 0, p: 0, c: 0 };
    g.n += 1;
    g.v += m.vues;
    g.p += m.partages;
    g.c += m.commentaires;
    groupes.set(cle, g);
  }

  const cases: CaseAgregat[] = [];
  let masquees = 0;
  for (const g of groupes.values()) {
    if (g.n < seuil) {
      masquees += 1;
      continue;
    }
    cases.push({
      type: g.type,
      reseau: g.reseau,
      tranche: g.tranche,
      effectif: g.n,
      moyennes: { vues: g.v / g.n, partages: g.p / g.n, commentaires: g.c / g.n },
    });
  }
  cases.sort((a, b) => `${a.type}|${a.reseau}|${a.tranche}`.localeCompare(`${b.type}|${b.reseau}|${b.tranche}`));
  return { etat: "calcule", cases, masquees };
}
