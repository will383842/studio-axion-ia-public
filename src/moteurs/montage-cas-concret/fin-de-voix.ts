/**
 * LA VOIX N'EST JAMAIS COUPÉE AVANT LA FIN DU TEXTE (tâche V4-1, mission C). Fonctions PURES, sur des échantillons.
 *
 * Constat (v4, 14/10) : la voix s'arrête net dans « machine » (−20 dB, puis silence numérique 20 ms plus tard), 80 ms avant
 * l'heure de fin du mot donnée par HeyGen ; et l'heure de fin d'un mot donnée par le fournisseur tombe souvent 0,1 à
 * 0,25 s trop tôt. D'où :
 *  - `recalerCoupesSurSilences` : toute coupe du plan de la voix qui tombe EN PLEIN SON est déplacée dans le blanc MESURÉ
 *    le plus proche (`silencesMesures`, même règle que `silencedetect`), avec une courte fin naturelle ; les mots qui
 *    suivent sont décalés d'autant. La recette (`recette-voix.ts`) n'est pas modifiée : le plan est corrigé après elle.
 *  - `controlerFinDeVoix` : contrôle BLOQUANT du son final. Refusé si le son chute brutalement en plein mot (au moins
 *    −30 dB puis −60 dB ou moins en 20 ms, et le silence tient) ou s'il s'arrête avant l'heure de fin du dernier mot.
 */
import type { MotHorodate } from "@/domaine/types";
import { RECETTE_VOIX_CAS_CONCRET, type PlanRaccordVoix, type RecetteVoixCasConcret } from "./recette-voix";

export interface Son {
  echantillons: Float32Array;
  frequence: number;
}

export interface Silence {
  debutSec: number;
  finSec: number;
}

/** Réglages de la fin de voix : fenêtre de mesure, seuils, tenue du silence, rallonge et queue d'une coupe. */
export const REGLES_FIN_DE_VOIX = Object.freeze({
  fenetreSec: 0.01,
  /** Blanc mesuré : sous ce niveau pendant `blancMinSec` (comme `silencedetect=noise=-45dB:d=0.05`). */
  blancDb: -45,
  blancMinSec: 0.05,
  /** Chute brutale : de `fortDb` ou plus à `silenceDb` ou moins en `chuteMaxSec`, et le silence tient `tenueSec`. */
  fortDb: -30,
  silenceDb: -60,
  chuteMaxSec: 0.02,
  tenueSec: 0.1,
  /**
   * Le son doit durer au moins jusqu'à la fin du dernier mot, moins cette tolérance (s). 0,20 s : l'heure de fin d'un
   * mot (voix, puis aligneur) est fausse de 0,1 à 0,25 s. Essai réel du 14/10 (fin LinkedIn de v-e99a49ee86cb) : une
   * extinction douce de « commentaire » finie 0,12 s avant l'heure annoncée était refusée. La coupure NETTE en plein mot
   * (le défaut de la v4) reste refusée par la chute brutale, quelle que soit l'heure.
   */
  toleranceFinMotSec: 0.2,
  /** Une coupe en plein son est déplacée de `rallongeMaxSec` au plus ; elle garde `queueSec` dans le blanc trouvé. */
  rallongeMaxSec: 0.35,
  queueSec: 0.04,
  /**
   * Une coupe DÉJÀ dans un blanc mais à moins de ce temps (s) de son début est rallongée jusqu'à ce temps (dans le blanc,
   * sans chevaucher le morceau voisin). Prod v-0250d2cedaa6 : coupe à 13,30 s pour un blanc débutant à 13,29 s ; la traîne
   * du mot (−47 dB brut) devient −30 dB après compresseur + loudnorm, puis le fondu tombe sur le bruit de fond : fausse
   * « voix coupée net à 9,86 s » (jonction de deux morceaux du corps). 0 = désactivé (image→vidéo ne change pas).
   */
  queueMinDansBlancSec: 0 as number,
  /**
   * Petit son isolé (bruit de bouche, clic) : une chute brutale juste après un son d'au plus ce temps (s), lui-même
   * précédé d'au moins `tenueSec` sous `blancDb`, n'est PAS une coupe en plein mot. Prod v-dcc902c3f3dd, 37,59 s : 40 ms
   * isolés entre ≥ 190 ms et ≥ 100 ms de silence. 0 = désactivé (le cas concret ne change pas).
   */
  transitoireMaxSec: 0 as number,
});

/* ------------------------------------------------------------------ */
/* Lecture et mesure                                                    */
/* ------------------------------------------------------------------ */

/** Lit un WAV PCM (16 bits entiers ou 32 bits flottants), ramené en mono. Lève une erreur claire sinon. */
export function lireWav(b: Uint8Array): Son {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const tag = (i: number) => String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]);
  if (b.length < 12 || tag(0) !== "RIFF" || tag(8) !== "WAVE") throw new Error("Le son n'est pas un fichier WAV.");
  let format = 0;
  let canaux = 0;
  let frequence = 0;
  let bits = 0;
  for (let i = 12; i + 8 <= b.length; ) {
    const id = tag(i);
    const taille = v.getUint32(i + 4, true);
    if (id === "fmt ") {
      format = v.getUint16(i + 8, true);
      canaux = v.getUint16(i + 10, true);
      frequence = v.getUint32(i + 12, true);
      bits = v.getUint16(i + 22, true);
    } else if (id === "data") {
      const fin = Math.min(b.length, i + 8 + taille);
      const octets = bits / 8;
      if (!canaux || !frequence || !((format === 1 && bits === 16) || (format === 3 && bits === 32))) throw new Error("WAV non pris en charge (PCM 16 bits ou flottant 32 bits attendu).");
      const n = Math.floor((fin - i - 8) / (octets * canaux));
      const echantillons = new Float32Array(n);
      for (let k = 0; k < n; k++) {
        let s = 0;
        for (let c = 0; c < canaux; c++) {
          const o = i + 8 + (k * canaux + c) * octets;
          s += format === 1 ? v.getInt16(o, true) / 32768 : v.getFloat32(o, true);
        }
        echantillons[k] = s / canaux;
      }
      return { echantillons, frequence };
    }
    i += 8 + taille + (taille % 2);
  }
  throw new Error("WAV sans données.");
}

/** Niveau (dB) de chaque fenêtre de `fenetreSec` (moyenne des carrés). */
export function niveauxDb(son: Son, fenetreSec: number = REGLES_FIN_DE_VOIX.fenetreSec): number[] {
  const n = Math.max(1, Math.round(fenetreSec * son.frequence));
  const res: number[] = [];
  for (let i = 0; i + n <= son.echantillons.length; i += n) {
    let e = 0;
    for (let j = i; j < i + n; j++) e += son.echantillons[j] * son.echantillons[j];
    res.push(10 * Math.log10(e / n + 1e-20));
  }
  return res;
}

/** Blancs mesurés d'un son : sous `blancDb` pendant `blancMinSec` au moins (règle de `silencedetect`). */
export function silencesMesures(son: Son, regles: { fenetreSec: number; blancDb: number; blancMinSec: number } = REGLES_FIN_DE_VOIX): Silence[] {
  const f = regles.fenetreSec;
  const niv = niveauxDb(son, f);
  const res: Silence[] = [];
  let debut = -1;
  const fermer = (i: number) => {
    if (debut >= 0 && (i - debut) * f >= regles.blancMinSec - 1e-9) res.push({ debutSec: +(debut * f).toFixed(4), finSec: +Math.min(i * f, son.echantillons.length / son.frequence).toFixed(4) });
    debut = -1;
  };
  niv.forEach((d, i) => {
    if (d < regles.blancDb) {
      if (debut < 0) debut = i;
    } else fermer(i);
  });
  fermer(niv.length);
  return res;
}

/** Blancs lus dans la sortie de `ffmpeg … -af silencedetect` ; un blanc ouvert jusqu'au bout finit à `dureeSec`. */
export function lireSilencedetect(sortie: string, dureeSec: number): Silence[] {
  const res: Silence[] = [];
  let debut: number | null = null;
  for (const m of sortie.matchAll(/silence_(start|end):\s*(-?[0-9.]+)/g)) {
    const t = Math.max(0, Number(m[2]));
    if (m[1] === "start") debut = t;
    else if (debut !== null) {
      res.push({ debutSec: debut, finSec: t });
      debut = null;
    }
  }
  if (debut !== null) res.push({ debutSec: debut, finSec: dureeSec });
  return res;
}

/* ------------------------------------------------------------------ */
/* Contrôle bloquant du son final                                       */
/* ------------------------------------------------------------------ */

export type VerdictFinDeVoix =
  | { ok: true; finSonoreSec: number }
  | { ok: false; raison: string; finSonoreSec: number; coupeNetteSec?: number };

const sec = (s: number) => `${s.toFixed(2).replace(".", ",")} s`;

/**
 * Contrôle bloquant : la voix finale est-elle dite jusqu'au bout ? `dernierMotFinSec` : heure de fin du dernier mot, sur
 * l'horloge du son contrôlé.
 */
export function controlerFinDeVoix(son: Son, dernierMotFinSec: number, regles = REGLES_FIN_DE_VOIX): VerdictFinDeVoix {
  const f = regles.fenetreSec;
  const niv = niveauxDb(son, f);
  let derniere = -1;
  niv.forEach((d, i) => {
    if (d > regles.silenceDb) derniere = i;
  });
  const finSonoreSec = +((derniere + 1) * f).toFixed(3);
  // Chute brutale : une fenêtre forte, puis le silence en 20 ms au plus, qui tient (ou va jusqu'au bout du son).
  const pas = Math.max(1, Math.round(regles.chuteMaxSec / f));
  const tenue = Math.max(1, Math.round(regles.tenueSec / f));
  let coupe: { i: number; db: number } | null = null;
  const tMax = Math.round((regles.transitoireMaxSec ?? 0) / f);
  const transitoire = (j: number) => {
    if (!tMax) return false;
    let a = j;
    while (a > 0 && niv[a - 1] > regles.blancDb) a--;
    if (j - a > tMax) return false;
    let b = a;
    while (b > 0 && niv[b - 1] <= regles.blancDb) b--;
    return a - b >= tenue;
  };
  for (let i = 0; i < niv.length - 1 && !coupe; i++) {
    if (niv[i] < regles.fortDb) continue;
    for (let j = i + 1; j <= i + pas && j < niv.length; j++) {
      if (niv[j] > regles.silenceDb) continue;
      const suite = niv.slice(j, j + tenue);
      if (suite.every((d) => d <= regles.silenceDb) && !transitoire(j)) coupe = { i: j, db: niv[i] };
      break;
    }
  }
  const raisons: string[] = [];
  const coupeNetteSec = coupe ? +(coupe.i * f).toFixed(3) : undefined;
  if (coupe) {
    const aLaFin = coupe.i > derniere;
    raisons.push(`la voix est coupée net à ${sec(coupe.i * f)}, en plein mot (${Math.round(coupe.db)} dB puis silence)${aLaFin ? "" : ", avant la suite du texte"}`);
  }
  if (finSonoreSec < dernierMotFinSec - regles.toleranceFinMotSec) raisons.push(`le son s'arrête à ${sec(finSonoreSec)}, avant la fin du dernier mot (${sec(dernierMotFinSec)})`);
  if (!raisons.length) return { ok: true, finSonoreSec };
  const phrase = `${raisons.join(" ; ")} : la dernière phrase n'est pas dite jusqu'au bout.`;
  return { ok: false, raison: phrase.charAt(0).toUpperCase() + phrase.slice(1), finSonoreSec, ...(coupeNetteSec !== undefined ? { coupeNetteSec } : {}) };
}

/* ------------------------------------------------------------------ */
/* Coupes dans un blanc mesuré                                          */
/* ------------------------------------------------------------------ */

const arrondi = (x: number) => +x.toFixed(4);
const dansUnBlanc = (t: number, s: readonly Silence[]) => s.some((x) => t >= x.debutSec - 1e-6 && t <= x.finSec + 1e-6);

/** Réglages du recalage du cas concret : le contrôle (`REGLES_FIN_DE_VOIX`) est le même, seule la queue minimale est active. */
export const REGLES_RECALAGE_CAS_CONCRET = Object.freeze({ ...REGLES_FIN_DE_VOIX, queueMinDansBlancSec: 0.04 });

/**
 * Déplace dans le blanc mesuré le plus proche chaque coupe du plan qui tombe en plein son (fin d'un morceau en avant,
 * début en arrière, de `rallongeMaxSec` au plus, sans chevaucher le morceau voisin de la même source). Les mots, la durée,
 * le fondu de sortie et le raccord suivent. `motsBruts` : les mots du corps et de la fin, sur l'horloge de leur son brut.
 * Une fin déjà dans un blanc, à moins de `queueMinDansBlancSec` de son début, y est rallongée (sans chevaucher le suivant).
 * Rien à déplacer : le plan est rendu tel quel.
 */
export function recalerCoupesSurSilences(
  plan: PlanRaccordVoix,
  motsBruts: { corps: readonly MotHorodate[]; fin?: readonly MotHorodate[] },
  silences: Partial<Record<0 | 1, readonly Silence[]>>,
  recette: RecetteVoixCasConcret = RECETTE_VOIX_CAS_CONCRET,
  regles = REGLES_FIN_DE_VOIX,
): { plan: PlanRaccordVoix; coupesDeplacees: number } {
  const k = recette.filtres.atempo;
  const morceaux = plan.morceaux.map((m) => ({ ...m }));
  let deplacees = 0;
  morceaux.forEach((m, i) => {
    const s = silences[m.source];
    if (m.silence || !s?.length) return;
    const voisins = morceaux.filter((x, j) => j !== i && !x.silence && x.source === m.source);
    const suivant = voisins.filter((x) => x.debutSec >= m.finSec).sort((a, b) => a.debutSec - b.debutSec)[0];
    const precedent = voisins.filter((x) => x.finSec <= m.debutSec).sort((a, b) => b.finSec - a.finSec)[0];
    if (!dansUnBlanc(m.finSec, s)) {
      const blanc = s.find((x) => x.debutSec > m.finSec && x.debutSec - m.finSec <= regles.rallongeMaxSec);
      if (blanc) {
        const vise = Math.min(blanc.debutSec + regles.queueSec, blanc.finSec);
        m.finSec = arrondi(suivant ? Math.min(vise, suivant.debutSec) : vise);
        deplacees++;
      }
    } else {
      const q = regles.queueMinDansBlancSec ?? 0;
      const dans = q > 0 ? s.find((x) => m.finSec >= x.debutSec - 1e-6 && m.finSec <= x.finSec + 1e-6) : undefined;
      if (dans && m.finSec - dans.debutSec < q - 1e-6) {
        const vise = Math.min(dans.debutSec + q, dans.finSec);
        const nouveau = arrondi(suivant ? Math.min(vise, suivant.debutSec) : vise);
        if (nouveau > m.finSec + 1e-6) {
          m.finSec = nouveau;
          deplacees++;
        }
      }
    }
    if (!dansUnBlanc(m.debutSec, s)) {
      const blanc = [...s].reverse().find((x) => x.finSec < m.debutSec && m.debutSec - x.finSec <= regles.rallongeMaxSec);
      if (blanc) {
        const vise = Math.max(blanc.finSec - regles.queueSec, blanc.debutSec);
        m.debutSec = arrondi(precedent ? Math.max(vise, precedent.finSec) : vise);
        deplacees++;
      }
    }
  });
  if (!deplacees) return { plan, coupesDeplacees: 0 };

  // Décalage de chaque morceau dans le son final (avant atempo) : allongements des morceaux d'avant, plus l'avance prise
  // par son propre début.
  const dLongueur = morceaux.map((m, i) => m.finSec - m.debutSec - (plan.morceaux[i].finSec - plan.morceaux[i].debutSec));
  const dDebut = morceaux.map((m, i) => plan.morceaux[i].debutSec - m.debutSec);
  const decalage = (i: number) => dLongueur.slice(0, i).reduce((a, b) => a + b, 0) + dDebut[i];
  const bruts = [...motsBruts.corps, ...(motsBruts.fin ?? [])];
  const mots = plan.mots.map((mot, n) => {
    const source = n < plan.motsCorps ? 0 : 1;
    const t = bruts[n]?.debutSec ?? 0;
    const candidats = plan.morceaux.map((m, i) => ({ m, i })).filter(({ m }) => !m.silence && m.source === source);
    const ici = candidats.find(({ m }) => t >= m.debutSec - 1e-6 && t <= m.finSec + 1e-6) ?? candidats.find(({ m }) => m.debutSec >= t) ?? candidats.at(-1);
    const d = ici ? decalage(ici.i) : 0;
    return d ? { ...mot, debutSec: arrondi(mot.debutSec + d / k), finSec: arrondi(mot.finSec + d / k) } : mot;
  });
  const total = dLongueur.reduce((a, b) => a + b, 0);
  const premierFin = plan.morceaux.findIndex((m) => m.source === 1);
  const avantRaccord = premierFin < 0 ? total : dLongueur.slice(0, premierFin).reduce((a, b) => a + b, 0);
  return {
    plan: {
      ...plan,
      morceaux,
      mots,
      dureeResserreeSec: arrondi(plan.dureeResserreeSec + total),
      dureeSec: arrondi(plan.dureeSec + total / k),
      debutFonduSortieSec: arrondi(plan.debutFonduSortieSec + total / k),
      ...(plan.raccordSec !== undefined ? { raccordSec: arrondi(plan.raccordSec + avantRaccord / k) } : {}),
    },
    coupesDeplacees: deplacees,
  };
}
