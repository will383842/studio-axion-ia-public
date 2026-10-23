/**
 * BRIQUE MONTEUR — où s'applique une consigne (mission H, extrait du lot D). PUR.
 *
 * Une consigne s'ancre sur un MOT de la transcription : un temps cité (« à 0:32 », lu sur le temps de la vidéo
 * livrée), sinon un mot cité (« quand je dis Certifexemple »), sinon le premier mot gardé après l'instant où la consigne a
 * été dite dans la prise, sinon le début. Commun à tous les formats : le face caméra (prise coupée, temps monté) et
 * l'avocat (prises assemblées) donnent leurs mots sous la même forme.
 */

/** Mot de la transcription vu par le monteur : index, instant dans la prise, temps dans la vidéo (null si coupé). */
export interface MotMonteur {
  index: number;
  mot: string;
  debutPriseSec: number;
  finPriseSec: number;
  /** Null : le mot est dans un passage retiré. */
  monteeSec: number | null;
}

const sansAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** Mots normalisés pour la comparaison (« Certifexemple, » → « certifexemple »). */
const norme = (s: string) => sansAccents(s).replace(/[^a-z0-9%]+/g, "");

/** « à 0:32 », « à 1 min 05 », « à 32 s » → secondes (temps monté) ; null sinon. */
export function instantDans(texte: string): number | null {
  const t = sansAccents(texte);
  const mmss = t.match(/\b(\d{1,2}):(\d{2})\b/);
  if (mmss) return Number(mmss[1]) * 60 + Number(mmss[2]);
  const minSec = t.match(/\b(\d{1,2})\s*min(?:ute)?s?\s*(\d{1,2})?\b/);
  if (minSec) return Number(minSec[1]) * 60 + Number(minSec[2] ?? 0);
  const sec = t.match(/\ba\s+(\d{1,3})\s*(?:s|sec|secondes?)\b/);
  if (sec) return Number(sec[1]);
  return null;
}

/** Mot cité (« quand je dis Certifexemple », « sur le mot “gratuit” ») ; null sinon. */
export function motCite(texte: string): string | null {
  const guillemets = texte.match(/[«“"]\s*([^»”"]+?)\s*[»”"]/);
  if (guillemets) return guillemets[1];
  const dis = texte.match(/quand je (?:dis|parle de|prononce)\s+(?:le mot\s+|l'|la\s+|le\s+|les\s+)?([\p{L}\p{N}%'-]+)/iu);
  return dis ? dis[1] : null;
}

/** Nombre de mots couverts par défaut par un effet (≈ 4 s de parole). */
const MOTS_PAR_DEFAUT = 11;

/**
 * Mot où s'applique une consigne : un temps cité (« à 0:32 »), sinon un mot cité (« quand je dis Certifexemple »), sinon
 * le premier mot gardé après l'instant où la consigne a été dite, sinon le début de la vidéo.
 */
export function ancreConsigne(texte: string, mots: MotMonteur[], dansPriseSec?: number): { debutMot: number; finMot: number } {
  const gardes = mots.filter((m) => m.monteeSec !== null);
  const fin = (i: number) => {
    const pos = gardes.findIndex((m) => m.index === i);
    return gardes[Math.min(gardes.length - 1, Math.max(0, pos) + MOTS_PAR_DEFAUT - 1)]?.index ?? i;
  };
  if (!gardes.length) return { debutMot: 0, finMot: Math.max(0, mots.length - 1) };
  const t = instantDans(texte);
  if (t !== null) {
    const m = gardes.find((x) => (x.monteeSec ?? 0) >= t - 0.25) ?? gardes[gardes.length - 1];
    return { debutMot: m.index, finMot: fin(m.index) };
  }
  const cite = motCite(texte);
  if (cite) {
    const premier = norme(cite.split(/\s+/)[0] ?? "");
    const m = premier ? gardes.find((x) => norme(x.mot) === premier) : undefined;
    if (m) return { debutMot: m.index, finMot: fin(m.index) };
  }
  if (dansPriseSec !== undefined) {
    const m = gardes.find((x) => x.debutPriseSec >= dansPriseSec);
    if (m) return { debutMot: m.index, finMot: fin(m.index) };
  }
  return { debutMot: gardes[0].index, finMot: fin(gardes[0].index) };
}

/** Mots d'une vidéo sans coupe (avocat : temps de la prise = temps de la vidéo livrée). */
export function motsSansCoupe(mots: readonly { mot: string; debutSec: number; finSec: number }[]): MotMonteur[] {
  return mots.map((m, index) => ({ index, mot: m.mot, debutPriseSec: m.debutSec, finPriseSec: m.finSec, monteeSec: m.debutSec }));
}
