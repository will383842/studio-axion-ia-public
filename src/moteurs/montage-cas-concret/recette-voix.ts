/**
 * RECETTE DE LA VOIX DU CAS CONCRET (tâche X4) : les MÊMES valeurs que la recette validée par Will pour le tableau animé
 * (`src/moteurs/montage-tableau/recette-voix.ts`, 11/10), recopiées ici car un moteur n'en importe jamais un autre ; un
 * test compare les deux recettes pour qu'un écart futur se voie. Le calcul pur (morceaux gardés, mots recalés, raccord
 * corps + fin) est recopié à l'identique ; le son est traité par `studio-rendu` (opération `nettoyage-audio`, mode
 * `recette`) : morceaux resserrés du corps, 0,20 s de blanc, morceaux de la fin, puis UN SEUL traitement final
 * (`atempo`, passe-haut, compresseur, `loudnorm`, fondu de sortie, silence final) sur l'ensemble.
 *
 * Le contrôle des prises du format (`voix.ts` : blancs de plus de 450 ms hors ponctuation, son hors texte) est fait
 * AVANT, sur le son brut, et reste tel quel.
 */
import type { MotHorodate } from "@/domaine/types";

export const RECETTE_VOIX_CAS_CONCRET = Object.freeze({
  id: "voix-cas-concret/recette-1",
  /** La voix HeyGen déjà en service, moteur `starfish`, vitesse 1,1, fr-FR. */
  synthese: Object.freeze({ fournisseur: "heygen", moteur: "starfish", vitesse: 1.1, locale: "fr-FR" }),
  resserrage: Object.freeze({
    /** Garde autour de chaque mot (s). */
    gardeSec: 0.035,
    /** Blanc gardé entre deux mots (s). */
    blancMotsSec: 0.1,
    /** Après une virgule ou deux-points (s). */
    blancVirguleSec: 0.13,
    /** Après une fin de phrase (s). */
    blancPhraseSec: 0.2,
    /** Fondu à chaque coupe (ms). */
    fonduMs: 6,
    /** Queue gardée après le dernier mot (s). */
    queueSec: 0.45,
  }),
  filtres: Object.freeze({
    atempo: 1.08,
    passeHaut: "highpass=f=70",
    compresseur: "acompressor=threshold=-20dB:ratio=3:attack=5:release=80:makeup=3",
    volume: "loudnorm=I=-14:TP=-1.5:LRA=7",
  }),
  fin: Object.freeze({ fonduSortieSec: 0.22, silenceSec: 0.8 }),
});

export type RecetteVoixCasConcret = typeof RECETTE_VOIX_CAS_CONCRET;

export interface MorceauGarde {
  debutSec: number;
  finSec: number;
}

export interface PlanRecetteVoix {
  /** Morceaux du son brut gardés, dans l'ordre (temps du son brut). */
  morceaux: MorceauGarde[];
  /** Mots recalés sur le son final (après resserrage puis `atempo`). */
  mots: MotHorodate[];
  /** Durée du son resserré, avant `atempo` (s). */
  dureeResserreeSec: number;
  /** Durée du son final : resserré ÷ atempo, puis le silence de fin (s). */
  dureeSec: number;
  /** Instant (son final) où commence le fondu de sortie. */
  debutFonduSortieSec: number;
}

type Ponctuation = "phrase" | "virgule" | "aucune";

function ponctuationDe(mot: string): Ponctuation {
  if (/[.?!…]["»\s ]*$/.test(mot)) return "phrase";
  if (/[,;:]["»\s ]*$/.test(mot)) return "virgule";
  return "aucune";
}

const arrondi = (x: number) => +x.toFixed(4);

/** Blanc visé après un mot, selon sa ponctuation. */
export function blancApres(mot: string, recette: RecetteVoixCasConcret = RECETTE_VOIX_CAS_CONCRET): number {
  const r = recette.resserrage;
  const p = ponctuationDe(mot);
  return p === "phrase" ? r.blancPhraseSec : p === "virgule" ? r.blancVirguleSec : r.blancMotsSec;
}

/**
 * Morceaux gardés et nouveaux horodatages (PUR). Lève une erreur claire si les mots sont absents ou en désordre :
 * l'appelant se replie alors sur la voix brute (et le dit).
 */
export function planRecetteVoix(mots: readonly MotHorodate[], dureeBruteSec: number, recette: RecetteVoixCasConcret = RECETTE_VOIX_CAS_CONCRET): PlanRecetteVoix {
  if (!mots.length) throw new Error("Aucun horodatage de mot : la recette ne peut pas resserrer les blancs.");
  for (let i = 0; i < mots.length; i++) {
    const m = mots[i];
    if (!Number.isFinite(m.debutSec) || !Number.isFinite(m.finSec) || m.finSec < m.debutSec) throw new Error(`Horodatage du mot n° ${i + 1} illisible.`);
    if (i && m.debutSec < mots[i - 1].debutSec) throw new Error(`Horodatages des mots en désordre (mot n° ${i + 1}).`);
  }
  const r = recette.resserrage;
  const fin = Math.max(dureeBruteSec, mots.at(-1)!.finSec);

  // Morceaux : de la garde avant le premier mot à la queue après le dernier ; chaque blanc trop long est coupé au milieu.
  const morceaux: MorceauGarde[] = [];
  let debut = Math.max(0, mots[0].debutSec - r.gardeSec);
  // Fin de la parole : un mot qui en chevauche un autre ne fait pas reculer la fin.
  let finMot = -Infinity;
  for (let i = 0; i < mots.length - 1; i++) {
    finMot = Math.max(finMot, mots[i].finSec);
    const suivant = mots[i + 1].debutSec;
    const vise = blancApres(mots[i].mot, recette);
    if (suivant - finMot <= vise + 1e-6) continue;
    const apres = Math.max(r.gardeSec, vise / 2);
    const avant = Math.max(r.gardeSec, vise - apres);
    if (suivant - finMot <= apres + avant + 1e-6) continue;
    morceaux.push({ debutSec: debut, finSec: finMot + apres });
    debut = suivant - avant;
  }
  const finParole = Math.max(finMot, mots.at(-1)!.finSec);
  morceaux.push({ debutSec: debut, finSec: Math.min(fin, finParole + r.queueSec) });

  // Instant du son brut → instant du son resserré (avant atempo).
  const versResserre = (t: number): number => {
    let ecoule = 0;
    for (const m of morceaux) {
      if (t <= m.debutSec) return ecoule;
      if (t <= m.finSec) return ecoule + (t - m.debutSec);
      ecoule += m.finSec - m.debutSec;
    }
    return ecoule;
  };
  const dureeResserreeSec = morceaux.reduce((s, m) => s + (m.finSec - m.debutSec), 0);
  const k = recette.filtres.atempo;
  const motsFinaux = mots.map((m) => ({ ...m, debutSec: arrondi(versResserre(m.debutSec) / k), finSec: arrondi(versResserre(m.finSec) / k) }));
  const dureeParole = dureeResserreeSec / k;
  return {
    morceaux: morceaux.map((m) => ({ debutSec: arrondi(m.debutSec), finSec: arrondi(m.finSec) })),
    mots: motsFinaux,
    dureeResserreeSec: arrondi(dureeResserreeSec),
    dureeSec: arrondi(dureeParole + recette.fin.silenceSec),
    debutFonduSortieSec: arrondi(Math.max(0, dureeParole - recette.fin.fonduSortieSec)),
  };
}

/** Paramètres de l'opération `nettoyage-audio` (mode `recette`) de `studio-rendu`. */
export function parametresRecette(plan: PlanRecetteVoix, recette: RecetteVoixCasConcret = RECETTE_VOIX_CAS_CONCRET): Record<string, unknown> {
  const f = recette.filtres;
  return {
    mode: "recette",
    morceaux: plan.morceaux,
    fonduMs: recette.resserrage.fonduMs,
    filtres: [`atempo=${f.atempo}`, f.passeHaut, f.compresseur, f.volume].join(","),
    fonduSortieSec: recette.fin.fonduSortieSec,
    debutFonduSortieSec: plan.debutFonduSortieSec,
    silenceFinSec: recette.fin.silenceSec,
  };
}

/** Réglages de la recette, tels qu'ils sont tracés et entrent dans l'empreinte de la voix. */
export function reglagesRecette(recette: RecetteVoixCasConcret = RECETTE_VOIX_CAS_CONCRET): Record<string, unknown> {
  return { id: recette.id, synthese: recette.synthese, resserrage: recette.resserrage, filtres: recette.filtres, fin: recette.fin };
}

/* ------------------------------------------------------------------ */
/* Raccord : corps lu une fois + phrase de fin lue à part (12/10/2026)    */
/* ------------------------------------------------------------------ */

/**
 * Blanc au raccord du corps et de la phrase de fin (s) : celui d'une fin de phrase de la recette (0,20 s). La moitié
 * reste après le dernier mot du corps (sa queue naturelle), l'autre avant le premier mot de la fin ; un manque de son
 * d'un côté est comblé par du silence.
 */
export const BLANC_RACCORD_SEC = RECETTE_VOIX_CAS_CONCRET.resserrage.blancPhraseSec;

/** Un morceau gardé d'une des voix (`source` : 0 le corps, 1 la phrase de fin), ou un silence (`silence: true`). */
export interface MorceauRaccord extends MorceauGarde {
  source: 0 | 1;
  silence?: true;
}

export interface PlanRaccordVoix extends Omit<PlanRecetteVoix, "morceaux"> {
  morceaux: MorceauRaccord[];
  /** Nombre de mots du corps (les suivants sont ceux de la fin). */
  motsCorps: number;
  /** Instant (son final) du raccord : fin du blanc, début de la phrase de fin ; absent : le corps seul. */
  raccordSec?: number;
}

/**
 * Plan du raccord (PUR) : les morceaux resserrés du corps, puis 0,20 s de blanc, puis ceux de la phrase de fin, et le
 * traitement final COMMUN (filtres, niveau sonore, fondu de sortie, silence final) sur le tout. Les mots du corps puis
 * ceux de la fin sont recalés sur le son final ; aucun mot n'est perdu. Sans phrase de fin : le plan de la recette du
 * corps seul, à l'identique (`planRecetteVoix`).
 */
export function planRaccordVoix(corps: { mots: readonly MotHorodate[]; dureeSec: number }, fin?: { mots: readonly MotHorodate[]; dureeSec: number }, recette: RecetteVoixCasConcret = RECETTE_VOIX_CAS_CONCRET): PlanRaccordVoix {
  const pc = planRecetteVoix(corps.mots, corps.dureeSec, recette);
  if (!fin) return { ...pc, morceaux: pc.morceaux.map((m) => ({ ...m, source: 0 as const })), motsCorps: pc.mots.length };
  const pf = planRecetteVoix(fin.mots, fin.dureeSec, recette);
  const k = recette.filtres.atempo;
  const demi = BLANC_RACCORD_SEC / 2;
  // Corps : jusqu'à 0,10 s après son dernier mot (sa queue naturelle, sans la queue longue de la fin de vidéo).
  const finParoleCorps = Math.max(...corps.mots.map((m) => m.finSec));
  const morceauxCorps: MorceauRaccord[] = pc.morceaux.map((m) => ({ ...m, source: 0 as const }));
  const dernier = morceauxCorps[morceauxCorps.length - 1];
  dernier.finSec = arrondi(Math.min(Math.max(corps.dureeSec, finParoleCorps), finParoleCorps + demi));
  const manqueCorps = Math.max(0, finParoleCorps + demi - dernier.finSec);
  // Fin : à partir de 0,10 s avant son premier mot (ou du début du son, le manque en silence).
  const premierMot = fin.mots[0].debutSec;
  const morceauxFin: MorceauRaccord[] = pf.morceaux.map((m) => ({ ...m, source: 1 as const }));
  const decalageFin = morceauxFin[0].debutSec - Math.max(0, premierMot - demi);
  morceauxFin[0].debutSec = arrondi(Math.max(0, premierMot - demi));
  const manqueFin = Math.max(0, demi - (premierMot - morceauxFin[0].debutSec));
  const silence = arrondi(manqueCorps + manqueFin);
  const morceaux: MorceauRaccord[] = [...morceauxCorps, ...(silence > 0 ? [{ source: 0 as const, silence: true as const, debutSec: 0, finSec: silence }] : []), ...morceauxFin];
  const dureeCorps = morceauxCorps.reduce((s, m) => s + (m.finSec - m.debutSec), 0);
  // Mots de la fin : leur instant dans la fin resserrée (avant atempo), décalé du corps, du silence et de l'avance prise.
  const departFin = dureeCorps + silence + decalageFin;
  const motsFin = pf.mots.map((m) => ({ ...m, debutSec: arrondi((m.debutSec * k + departFin) / k), finSec: arrondi((m.finSec * k + departFin) / k) }));
  const dureeResserreeSec = morceaux.reduce((s, m) => s + (m.finSec - m.debutSec), 0);
  const dureeParole = dureeResserreeSec / k;
  return {
    morceaux: morceaux.map((m) => ({ ...m, debutSec: arrondi(m.debutSec), finSec: arrondi(m.finSec) })),
    mots: [...pc.mots, ...motsFin],
    motsCorps: pc.mots.length,
    raccordSec: arrondi((dureeCorps + silence) / k),
    dureeResserreeSec: arrondi(dureeResserreeSec),
    dureeSec: arrondi(dureeParole + recette.fin.silenceSec),
    debutFonduSortieSec: arrondi(Math.max(0, dureeParole - recette.fin.fonduSortieSec)),
  };
}

/** Paramètres de l'opération `nettoyage-audio` (mode `recette`) pour un raccord : morceaux de deux sources et silences. */
export function parametresRaccord(plan: PlanRaccordVoix, recette: RecetteVoixCasConcret = RECETTE_VOIX_CAS_CONCRET): Record<string, unknown> {
  const base = parametresRecette({ ...plan, morceaux: plan.morceaux }, recette);
  if (plan.raccordSec === undefined) return { ...base, morceaux: plan.morceaux.map(({ debutSec, finSec }) => ({ debutSec, finSec })) };
  return { ...base, morceaux: plan.morceaux.map(({ debutSec, finSec, source, silence }) => ({ debutSec, finSec, source, ...(silence ? { silence: true } : {}) })) };
}
