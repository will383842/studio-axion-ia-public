/**
 * ANALYSEUR RÉEL D'UN ANGLE FABRIQUÉ (`AnalyseurAngle`, mission H — JOURNAL-F4 « Ce qui reste » n° 3).
 *
 * Il mesure chaque angle contre la prise d'origine avec des services QUI EXISTENT DÉJÀ (aucune nouvelle opération) :
 *  - la DURÉE exacte du fichier : ffprobe, opération `analyse-media` de `studio-rendu` ;
 *  - la PRÉSENCE DU VISAGE et l'OUVERTURE DE LA BOUCHE : route `/visages` de `studio-aligneur` (MediaPipe, une image
 *    sur deux) ; la présence est comptée sur environ une image par seconde (une seconde compte si un visage y est vu) ;
 *  - la SYNCHRO BOUCHE / SON : corrélation entre l'ouverture de la bouche et la parole active de la prise (mots
 *    horodatés de l'aligneur), décalage cherché à ± 400 ms, affiné entre deux pas (interpolation parabolique).
 * Les trois mesures sont injectées (`DependancesAnalyseur`) : les calculs sont PURS et testés ; le branchement sur les
 * services est dans `services/analyseur-angles.ts`. Rien n'est appelé tant que `reel` reste faux (simulation par défaut).
 */
import type { MesureAngle } from "@/briques/multicamera/coherence";
import type { AnalyseurAngle, MesureDemandee } from "./index";

export interface EchantillonBouche {
  t: number;
  /** Ouverture de la bouche (0 fermée, 1 grande ouverte). */
  bouche: number;
  /** 1 : visage trouvé sur cette image ; 0 : comblé. */
  confiance: number;
}

export interface DependancesAnalyseur {
  /** Durée exacte du fichier (s), lue par ffprobe. */
  duree: (videoCle: string) => Promise<number>;
  /** Échantillons du visage de la vidéo (route `/visages`). */
  visages: (videoCle: string) => Promise<EchantillonBouche[]>;
  /** Mots de la référence (son de la prise d'origine), horodatés. */
  motsReference: (audioCle: string) => Promise<{ debutSec: number; finSec: number }[]>;
}

/** Part des secondes (≈ 1 image par seconde) où un visage est vu (0-100). */
export function presenceVisageParSeconde(echantillons: readonly EchantillonBouche[], dureeSec: number): number {
  // Une seconde commencée de moins d'une demi-seconde (fin du fichier) ne compte pas.
  const secondes = Math.max(1, Math.round(dureeSec));
  const vues = new Set<number>();
  for (const e of echantillons) if (e.confiance > 0 && e.t >= 0 && e.t < secondes) vues.add(Math.floor(e.t));
  return +((100 * vues.size) / secondes).toFixed(1);
}

const PAS_SEC = 0.04;

/** Signal échantillonné à 25 i/s : ouverture de la bouche (interpolée) et parole active (1 dans un mot). */
function signaux(echantillons: readonly EchantillonBouche[], mots: readonly { debutSec: number; finSec: number }[], dureeSec: number): { bouche: number[]; parole: number[] } {
  const n = Math.max(2, Math.round(dureeSec / PAS_SEC));
  const tri = [...echantillons].filter((e) => Number.isFinite(e.t)).sort((a, b) => a.t - b.t);
  const bouche: number[] = [];
  const parole: number[] = [];
  let k = 0;
  for (let i = 0; i < n; i++) {
    const t = i * PAS_SEC;
    while (k + 1 < tri.length && tri[k + 1].t <= t) k++;
    const a = tri[k];
    const b = tri[Math.min(tri.length - 1, k + 1)];
    const v = !a ? 0 : b && b.t > a.t && t > a.t ? a.bouche + ((b.bouche - a.bouche) * (t - a.t)) / (b.t - a.t) : a.bouche;
    bouche.push(v);
    parole.push(mots.some((m) => t >= m.debutSec && t < m.finSec) ? 1 : 0);
  }
  return { bouche, parole };
}

function correlation(x: number[], y: number[], decalage: number): number {
  // Corrélation de x(t) avec y(t - decalage) : un décalage positif = la bouche est EN RETARD sur le son.
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  let mx = 0;
  let my = 0;
  let n = 0;
  for (let i = 0; i < x.length; i++) {
    const j = i - decalage;
    if (j < 0 || j >= y.length) continue;
    mx += x[i];
    my += y[j];
    n++;
  }
  if (n < 10) return -1;
  mx /= n;
  my /= n;
  for (let i = 0; i < x.length; i++) {
    const j = i - decalage;
    if (j < 0 || j >= y.length) continue;
    sxy += (x[i] - mx) * (y[j] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[j] - my) ** 2;
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : -1;
}

/**
 * Décalage (ms) entre la bouche et le son : celui qui maximise la corrélation entre l'ouverture de la bouche et la
 * parole active, cherché à ± `maxMs`, affiné par interpolation parabolique. Positif : la bouche est en retard.
 * Aucun signal exploitable : `Infinity` (l'angle est alors écarté par le contrôle de cohérence).
 */
export function decalageBoucheSon(echantillons: readonly EchantillonBouche[], mots: readonly { debutSec: number; finSec: number }[], dureeSec: number, maxMs = 400): number {
  if (echantillons.length < 10 || !mots.length) return Infinity;
  const { bouche, parole } = signaux(echantillons, mots, dureeSec);
  const max = Math.round(maxMs / 1000 / PAS_SEC);
  let meilleur = 0;
  let valeur = -Infinity;
  const valeurs = new Map<number, number>();
  for (let d = -max; d <= max; d++) {
    const c = correlation(bouche, parole, d);
    valeurs.set(d, c);
    if (c > valeur + 1e-12 || (Math.abs(c - valeur) <= 1e-12 && Math.abs(d) < Math.abs(meilleur))) {
      valeur = c;
      meilleur = d;
    }
  }
  if (!(valeur > 0.05)) return Infinity;
  const g = valeurs.get(meilleur - 1);
  const h = valeurs.get(meilleur + 1);
  let fin = meilleur;
  if (g !== undefined && h !== undefined) {
    const den = g - 2 * valeur + h;
    if (den < 0) fin = meilleur + Math.max(-0.5, Math.min(0.5, (0.5 * (g - h)) / den));
  }
  return Math.round(fin * PAS_SEC * 1000);
}

/** Analyseur réel : durée (ffprobe), visage (~1 image/s) et synchro bouche/son. */
export function analyseurAngleReel(deps: DependancesAnalyseur): AnalyseurAngle {
  return {
    async mesurer(d: MesureDemandee): Promise<MesureAngle> {
      const [dureeSec, echantillons, mots] = await Promise.all([deps.duree(d.videoCle), deps.visages(d.videoCle), deps.motsReference(d.audioCle)]);
      return {
        dureeSec,
        decalageAudioMs: decalageBoucheSon(echantillons, mots, Math.min(dureeSec, d.dureeReferenceSec)),
        visagePresentPct: presenceVisageParSeconde(echantillons, dureeSec),
      };
    },
  };
}
