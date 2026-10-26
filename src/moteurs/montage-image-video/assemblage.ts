/**
 * IMAGE → VIDÉO · Assemblage de la voix et plan du mixage (lot L12, plan 50 § 1 [7]-[9], § 3, Q11 bis, Q17, Q19).
 *
 * Pour CHAQUE version (corps + un segment de fin, ou le corps seul sur LinkedIn) :
 *  1. les sons BRUTS sont lus en WAV — obligatoire (Q17) : sans WAV, refus clair, AUCUN repli MP3 (le cas concret,
 *     lui, saute les coupes et le contrôle en silence). 15/10 (v-dd3049053f88) : le brut gardé est la copie HeyGen, un
 *     MP3 ; il est CONVERTI en WAV mono (FFmpeg du studio, même décodeur que `studio-rendu`) et rangé à côté
 *     (`cleWavDuBrut`) pour ne jamais être reconverti ; le MP3 payé n'est jamais modifié ni relu chez HeyGen ;
 *  2. la recette de la voix v4 (lue seulement : resserrage des blancs, raccord corps + fin, atempo ×1,05 pour Image → vidéo, −14 LUFS) fait
 *     le plan ; chaque coupe tombée en plein son est rapprochée du silence mesuré le plus proche, en avant OU en arrière,
 *     à ±0,25 s au plus (`placerCoupesIV`), puis TOUTES les coupes sont vérifiées : une seule hors d'un silence mesuré =
 *     refus, avec, pour chaque coupe fautive, son niveau, le seuil et la distance au silence le plus proche ;
 *  3. la piste VOIX SEULE produite est gardée, avec l'empreinte de ses octets (Q18-Q19 la liront, le mixage la porte) ;
 *  4. contrôle BLOQUANT : la dernière phrase est dite en entier (pas de coupure nette, son jusqu'au dernier mot) et un
 *     silence mesuré d'au moins 300 ms la suit.
 *
 * Version courte (§ 3, cas 3) : les chapitres non essentiels sont retirés de la MÊME voix brute, sans aucune lecture
 * nouvelle ; chaque borne de chapitre doit tomber dans un silence mesuré d'au moins 300 ms, sinon pas de version courte.
 *
 * Mixage : voix seule + bruitages validés, −14 LUFS, et JAMAIS de musique (`musique: null`, pas de champ pour en mettre).
 */
import { createHash } from "node:crypto";
import type { BruitagePlace } from "@/briques/intensite/types";
import type { MotHorodate } from "@/domaine/types";
import { motsDits, type FicheImage } from "@/domaine/image-video/fiche";
import type { ReseauIV } from "@/domaine/image-video/plafonds";
import { DECLENCHEUR_IV } from "./bruitages";
import {
  RECETTE_VOIX_CAS_CONCRET,
  REGLES_FIN_DE_VOIX,
  controlerFinDeVoix,
  lireWav,
  niveauxDb,
  parametresRaccord,
  planRaccordVoix,
  silencesMesures,
  type PlanRaccordVoix,
  type Silence,
  type Son,
} from "./emprunts";
import { COUPE_EN_PLEIN_SON_IV, SUITE_REFUS_WAV_IV } from "./phrases-assemblage";
import { chapitresDetachables, ficheSansChapitres } from "./recettes";
import { ErreurVoixIV, sonsBrutsIV, type EtatVoixIV, type SonBrutIV, type VersionVoixIV } from "./voix";

/**
 * Recette de la voix d'Image → vidéo : celle du cas concret (lue seulement), SAUF le tempo appliqué après la lecture HeyGen,
 * ×1,05 au lieu de ×1,08 (décision de Will, 24/10/2026 : voix très légèrement moins rapide). La vitesse HeyGen (1,1) et
 * tous les autres réglages restent ceux de la recette partagée, qui n'est pas modifiée.
 */
export const RECETTE_VOIX_IV = Object.freeze({ ...RECETTE_VOIX_CAS_CONCRET, filtres: Object.freeze({ ...RECETTE_VOIX_CAS_CONCRET.filtres, atempo: 1.05 }) });
/** Tempo de la voix (recette d'Image → vidéo) : ×1,05. */
export const TEMPO_IV = RECETTE_VOIX_IV.filtres.atempo;
/** Niveau visé du mixage (Q24). */
export const LOUDNESS_IV_LUFS = -14;
export const CRETE_IV_DBTP = -1;
/** Silence mesuré exigé après le dernier mot de la piste voix seule (Q19), et autour d'une borne de chapitre (Q11 bis). */
export const SILENCE_FIN_MIN_SEC = 0.3;
export const SILENCE_BORNE_MIN_SEC = 0.3;
/** Lecture unique : blanc mesuré exigé de chaque côté d'une phrase sautée (HeyGen en met 0,32 à 0,72 s après un point). */
const SILENCE_PHRASE_SAUTEE_MIN_SEC = 0.1;

const VERSION_ASSEMBLAGE = "assemblage-iv/3"; // /3 (25/10/2026) : phrase sautée dont le silence dépasse l'horodatage ; /2 (24/10/2026) : tempo ×1,05 au lieu de ×1,08
/** Tolérance de calcul sur les instants (secondes). */
const EPS_INSTANT = 1e-6;
const arrondi = (x: number) => +x.toFixed(4);
const sec = (s: number) => `${s.toFixed(2).replace(".", ",")} s`;

/* ------------------------------------------------------------------ */
/* Outils injectés                                                       */
/* ------------------------------------------------------------------ */

/** Un morceau d'un son brut gardé dans la piste (temps du son brut). */
export interface MorceauVoixIV {
  entree: string;
  deSec: number;
  aSec: number;
}

/**
 * Demande de la piste voix seule (opération `nettoyage-audio`, mode `recette`, de `studio-rendu`) : les sons bruts du
 * corps et de la fin (absente : corps seul), raccordés puis traités ensemble par la recette v4.
 */
export interface DemandeVoixSeuleIV {
  /** Empreinte de la demande : même plan, mêmes sons = même travail repris. */
  id: string;
  morceaux: MorceauVoixIV[];
  tempo: number;
  recette: { corps: string; fin?: string; parametres: Record<string, unknown>; dureeSec: number };
}

export interface OutilsAssemblageIV {
  /** Octets d'un son rangé (brut tel que gardé — MP3 HeyGen —, son WAV converti, ou piste produite) ; `null` : rien à lire. */
  lireSon: (cle: string) => Promise<Uint8Array | null>;
  /** Convertit un son brut qui n'est pas un WAV (MP3 HeyGen) en WAV PCM mono, à sa fréquence, sans décalage. */
  convertirEnWav: (octets: Uint8Array) => Promise<Uint8Array>;
  /** Range le WAV converti (clé `cleWavDuBrut`) : une reprise le relit au lieu de reconvertir. */
  rangerSon: (cle: string, octets: Uint8Array) => Promise<void>;
  /** Produit la piste voix seule (WAV) et rend sa clé. */
  traiterVoix: (demande: DemandeVoixSeuleIV) => Promise<{ cle: string; dureeSec: number }>;
}

/* ------------------------------------------------------------------ */
/* WAV obligatoire                                                       */
/* ------------------------------------------------------------------ */

export { SUITE_REFUS_WAV_IV };

/** Lit un WAV ou refuse (Q17) avec une phrase claire : jamais de repli MP3. */
export function exigerWav(octets: Uint8Array | null, nom: string): Son {
  const suite = SUITE_REFUS_WAV_IV;
  if (!octets) throw new ErreurVoixIV("Q17", `Le son ${nom} n'est pas disponible en WAV. ${suite}`);
  try {
    return lireWav(octets);
  } catch (e) {
    console.warn(`[image-video] WAV illisible (${nom}) :`, e);
    throw new ErreurVoixIV("Q17", `Le son ${nom} n'est pas un WAV lisible. ${suite}`);
  }
}

/** Les octets sont-ils un WAV (en-tête RIFF/WAVE) ? */
export function estWav(octets: Uint8Array): boolean {
  const tag = (i: number) => String.fromCharCode(octets[i], octets[i + 1], octets[i + 2], octets[i + 3]);
  return octets.length >= 12 && tag(0) === "RIFF" && tag(8) === "WAVE";
}

/** Clé du WAV converti d'un son brut : stable (même brut = même WAV, jamais reconverti). */
export const cleWavDuBrut = (cle: string) => `${cle}.wav`;

/**
 * Octets WAV d'un son brut : tels quels si c'est déjà un WAV ; sinon le WAV déjà converti et rangé, sinon conversion
 * (MP3 → WAV mono) puis rangement. Le brut payé n'est jamais modifié. Conversion impossible : refus Q17 (réessayable).
 */
export async function brutEnWav(cle: string, nom: string, o: OutilsAssemblageIV): Promise<Uint8Array | null> {
  const octets = await o.lireSon(cle);
  if (!octets || estWav(octets)) return octets;
  const cleWav = cleWavDuBrut(cle);
  const deja = await o.lireSon(cleWav).catch(() => null);
  if (deja && estWav(deja)) return deja;
  let wav: Uint8Array;
  try {
    wav = await o.convertirEnWav(octets);
  } catch (e) {
    console.warn(`[image-video] conversion en WAV impossible (${nom}) :`, e);
    throw new ErreurVoixIV("Q17", `Le son ${nom} n'a pas pu être converti en WAV. ${SUITE_REFUS_WAV_IV}`);
  }
  try {
    await o.rangerSon(cleWav, wav);
  } catch (e) {
    // Rien de perdu : la prochaine reprise reconvertira (gratuit).
    console.warn(`[image-video] WAV converti non rangé (${nom}) :`, e);
  }
  return wav;
}

/** Empreinte des octets d'une piste. */
export function empreinteSon(octets: Uint8Array): string {
  return `voix-seule-${createHash("sha256").update(octets).digest("hex").slice(0, 32)}`;
}

/* ------------------------------------------------------------------ */
/* Coupes dans les silences mesurés                                      */
/* ------------------------------------------------------------------ */

/**
 * 15/10 (prod v-dd3049053f88) : la voix HeyGen n'a pas de vrai silence entre les phrases, mais un BRUIT DE FOND de −38 à
 * −46 dB (pause « écrit. » → « Oui, » : −39 à −43 dB de 2,46 à 2,74 s ; percentiles du fichier, fenêtres de 20 ms : p5
 * −49,8, p10 −46,4, p20 −41,8, p50 −24,5). Au seuil fixe −45 dB, presque aucun blanc n'était trouvé et les 26 coupes du
 * corps tombaient « en plein son ». Pour l'ASSEMBLAGE seulement (le cas concret et `controlerFinDeVoix` gardent −45 dB),
 * le seuil suit le bruit de fond du fichier :
 *   seuil = max(−45 dB, min(plancher + 8 dB, médiane de la parole − 10 dB, −35 dB))
 *  - plancher = p10 (fenêtres hors zéro numérique) : dans une voix parlée, les pauses font bien plus de 10 % du temps ; p10
 *    est donc le niveau du bruit de fond, pas de la parole (prod : −46,4 dB, au cœur des pauses mesurées de −41 à −48 dB ;
 *    voix bruitées de `coupes-voix-bruitees.test.ts`, 200 voix : p10 à 2,2 dB sous le niveau moyen du bruit, de 1,2 à
 *    3,0). La FIN (fichier court, presque tout en parole) reprend le plancher du corps de la même voix s'il est plus bas ;
 *  - + 8 dB, soit le bruit moyen + 5 à 7 dB : le bruit d'une pause fluctue d'une fenêtre à l'autre (prod : −39 à −43 dB
 *    pour un p10 à −46 ; voix bruitées : 1 % des fenêtres de bruit à plus de 4,8 dB au-dessus du niveau moyen, jusqu'à
 *    7 dB). Mesuré sur 750 voix corps seul et 250 corps + fin : + 6 dB refuse 4,7 % et 8,8 % des voix, + 8 dB 1,7 % et
 *    4,0 %, + 10 dB 1,3 % et 3,2 % (sans gain net, plus près de la parole) ;
 *  - ≤ médiane de la parole − 10 dB (fenêtres à 12 dB au moins au-dessus du plancher) et ≤ −35 dB : bornes de sûreté,
 *    toujours bien sous la parole (−10 à −28 dB ; une syllabe faible ne descend pas sous −34 dB). 16/10 (relecture
 *    #283) : la borne p50 − 12 dB de #281 prenait la médiane de TOUT le fichier, pauses comprises : dès un bruit de −42 dB,
 *    elle mettait le seuil à 2,5 dB du bruit, les pauses étaient hachées et 27 à 32 % des voix refusées. 16/10
 *    (3e passage) : le plafond −35 dB est GARDÉ. Avec un bruit de −38 à −35 dB, il colle le seuil au bruit et la voix
 *    est souvent refusée (32 % des voix corps seul du générateur de la relecture) ; mais le relever fait perdre des mots :
 *    à −30 dB, 17 % de refus et 9 versions acceptées amputées sur 150 ; un plafond relatif (médiane de la parole − 12 dB
 *    dès que la parole est à 16 dB du plancher) : 29 % de refus et 3 amputées ; à 20 dB : aucun effet. Le refus protège
 *    le son (« Refaire cette partie », sans lecture payante) ; le bruit mesuré de HeyGen est de −38 à −46 dB ;
 *  - ≥ −45 dB : un fichier propre (zéro numérique) garde exactement la règle d'avant.
 * Fenêtres de 20 ms (au lieu de 10) : un bruit rose/brun mesuré sur 10 ms dépasse ponctuellement le seuil et morcelle une
 * vraie pause ; 20 ms suit la mesure faite sur la prod. Durée mini inchangée (50 ms, soit 3 fenêtres). La règle, elle,
 * ne change pas : la voix n'est jamais coupée ailleurs que dans un silence ; seule la définition du silence s'adapte.
 */
export const REGLES_SILENCES_IV = Object.freeze({
  fenetreSec: 0.02,
  seuilMinDb: REGLES_FIN_DE_VOIX.blancDb,
  percentilePlancher: 0.1,
  margeDb: 8,
  ecartParoleDb: 10,
  plafondDb: -35,
  /** Fenêtres plus basses : zéro numérique (début ou fin rembourrés), hors du calcul du bruit de fond. */
  zeroNumeriqueDb: -90,
  /** Fenêtres de PAROLE pour la médiane du garde-fou : au moins ce niveau au-dessus du plancher. */
  paroleSurPlancherDb: 12,
  /** Niveau de la parole (germe de parole même non voisée) : la médiane de la parole moins cet écart… */
  niveauParoleSousMedianeDb: 9,
  /** … et jamais moins que ce niveau au-dessus du seuil de silence. */
  niveauParoleSurSeuilDb: 14,
  /**
   * PAROLE (relecture #283, 3e passage), une seule définition pour le placement, le filet (`paroleRetireeIV`) et le
   * premier/dernier son (`masqueParoleIV`). Avant : niveau de la parole (seuil + 14 dB) ou « voisé » (seuil + 6 dB et
   * moins de 2 000 passages par zéro) ; un mot entre le seuil et le seuil + 6 dB, ou une voyelle dont le souffle HF
   * poussait les passages par zéro au-delà de 2 000, était retiré sans refus. Désormais :
   *  - germe : fenêtres à `paroleSurSeuilDb` au moins au-dessus du seuil et VOISÉES (`periodiciteMin`), ou au niveau de
   *    la parole ; trous d'au plus `trouMaxSec` comblés (tout au-dessus du seuil) ; `paroleMinSec` au moins ;
   *  - attaque et fondu : au-dessus du seuil, à `accoleeMaxSec` au plus d'un germe ;
   *  - de proche en proche, tout son AIGU (`partHautesMin` de son énergie au-dessus du bruit dans la bande haute :
   *    fricative « s » ou « ch », explosion) accolé à la parole (moins de `accoleeMaxSec` d'écart), d'au plus
   *    `fricativeMaxSec` ; même SOUS le seuil, si sa bande haute dépasse son bruit de `fricativeSurPlancherHfDb` plus
   *    `dispersionHfFacteur` fois les variations de cette bande dans les silences (un bruit de fond qui fluctue, comme
   *    la pause de la prod de −39 à −43 dB pour un p10 à −46,4, n'est pas une fricative). Ces fenêtres sont retirées des
   *    silences mesurés : aucune coupe ne s'y pose ;
   *  - le reste au-dessus du seuil (respiration : souffle vers 1,5 kHz, non périodique, pas aigu) peut être retiré.
   * Mesures (générateur de la 3e relecture, `voix-relecture-3.ts`, 120 voix, fenêtres au seuil + 3 dB au moins) :
   * périodicité des voyelles, médiane 0,93 à 0,97 selon le bruit (p5 0,58 à 0,79) ; des respirations, médiane 0,21 à
   * 0,23 (p99 0,37 à 0,44) sous souffle HF, rose et brun, 0,50 (p99 0,85) sous un ronflement, lui-même périodique (une
   * respiration y est alors gardée : au pire un refus, jamais un mot perdu). Part de la bande haute (au-dessus de 2 kHz)
   * dans une fricative faible : 0,64 à 0,85 ; dispersion de cette bande dans les silences : 0,3 à 0,55 dB (bruits
   * stationnaires), 7 dB sur le profil de la prod.
   */
  paroleSurSeuilDb: 3,
  paroleMinSec: 0.04,
  trouMaxSec: 0.1,
  accoleeMaxSec: 0.04,
  /**
   * Voisement : autocorrélation normalisée maximale (f0 de 70 à 400 Hz, après son premier passage sous zéro : un bruit
   * grave, brun ou rose, très corrélé à faible décalage, n'est pas périodique) du son passé bas à `passeBasHz` (le souffle
   * HF ne compte plus), sur 40 ms centrées sur la fenêtre.
   */
  passeBasHz: 1000,
  periodiciteMin: 0.6,
  /** Bande haute (fricatives, explosions) : au-dessus de cette fréquence. */
  passeHautHz: 2000,
  fricativeSurPlancherHfDb: 3,
  partHautesMin: 0.5,
  fricativeMaxSec: 0.3,
  dispersionHfFacteur: 1,
});

/** Règles de fin de voix de l'image → vidéo : tolère un petit bruit de bouche isolé (≤ 50 ms) au milieu d'une pause (v-dcc902c3f3dd). */
export const REGLES_FIN_DE_VOIX_IV = Object.freeze({ ...REGLES_FIN_DE_VOIX, transitoireMaxSec: 0.05 });

const percentile = (tries: readonly number[], p: number) => tries[Math.min(tries.length - 1, Math.max(0, Math.floor(p * (tries.length - 1))))];

/** Biquad RBJ du 2e ordre (Q = 0,707), passe-bas ou passe-haut, sur une copie. */
function filtre(x: Float32Array, frequence: number, genre: "pb" | "ph", f: number): Float32Array {
  const w = (2 * Math.PI * Math.min(f, frequence * 0.45)) / frequence;
  const c = Math.cos(w);
  const al = Math.sin(w) / (2 * Math.SQRT1_2);
  const [b0, b1, b2] = genre === "pb" ? [(1 - c) / 2, 1 - c, (1 - c) / 2] : [(1 + c) / 2, -(1 + c), (1 + c) / 2];
  const [a0, a1, a2] = [1 + al, -2 * c, 1 - al];
  const y = new Float32Array(x.length);
  let [x1, x2, y1, y2] = [0, 0, 0, 0];
  for (let i = 0; i < x.length; i++) {
    const v = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    [x2, x1, y2, y1] = [x1, x[i], y1, v];
    y[i] = v;
  }
  return y;
}

/**
 * Périodicité (0 à 1) de chaque fenêtre : autocorrélation normalisée maximale pour une f0 de 70 à 400 Hz, sur le son
 * passé bas (`passeBasHz`, 4e ordre) et ramené à 4 kHz environ. Calculée seulement là où `calculer(w)` (sinon 0).
 */
export function periodicitesIV(son: Son, r = REGLES_SILENCES_IV, nb = niveauxDb(son, r.fenetreSec).length, calculer: (w: number) => boolean = () => true): number[] {
  const d = Math.max(1, Math.floor(son.frequence / 4000));
  const pb = filtre(filtre(son.echantillons, son.frequence, "pb", r.passeBasHz), son.frequence, "pb", r.passeBasHz);
  const x = new Float32Array(Math.floor(pb.length / d));
  for (let i = 0; i < x.length; i++) x[i] = pb[i * d];
  const fe = son.frequence / d;
  const n = Math.max(1, Math.round((r.fenetreSec * son.frequence) / d));
  const [l0, l1] = [Math.floor(fe / 400), Math.ceil(fe / 70)];
  const res = new Array<number>(nb).fill(0);
  for (let w = 0; w < nb; w++) {
    if (!calculer(w)) continue;
    // Analyse sur deux fenêtres centrées sur celle-ci (40 ms) : une seule (80 échantillons à 4 kHz) laisse un souffle
    // dépasser 0,5 par hasard.
    const i0 = Math.max(0, Math.round((w * r.fenetreSec * son.frequence) / d) - Math.floor(n / 2));
    // Le pic n'est cherché qu'après le premier passage de l'autocorrélation sous zéro : un bruit grave (brun, rose), très
    // corrélé à faible décalage sans être périodique, n'en a pas.
    let best = 0;
    let negatif = false;
    for (let l = 1; l <= l1; l++) {
      let [xy, xx, yy] = [0, 0, 0];
      for (let i = i0; i < i0 + 2 * n && i + l < x.length; i++) {
        xy += x[i] * x[i + l];
        xx += x[i] * x[i];
        yy += x[i + l] * x[i + l];
      }
      const c = xx > 0 && yy > 0 ? xy / Math.sqrt(xx * yy) : 0;
      if (c < 0) negatif = true;
      else if (negatif && l >= l0) best = Math.max(best, c);
    }
    res[w] = best;
  }
  return res;
}

/** Fenêtres consécutives où `garde` est vrai : `[première, après la dernière]`. */
function suites(nb: number, garde: (w: number) => boolean): [number, number][] {
  const res: [number, number][] = [];
  for (let w = 0; w < nb; w++) {
    if (!garde(w)) continue;
    const a = w;
    while (w < nb && garde(w)) w++;
    res.push([a, w]);
  }
  return res;
}

/** Mesures par fenêtre d'un son, pour le masque de parole. */
export interface FenetresIV {
  niveaux: readonly number[];
  /** Périodicité (0 à 1) : `periodicitesIV`. */
  periodicite: readonly number[];
  /** Niveau de la bande haute (au-dessus de `passeHautHz`). */
  hautesDb: readonly number[];
  seuilDb: number;
  /** Niveau de la parole (`niveauParoleDb`) : une suite qui l'atteint est de la parole, voisée ou non. */
  niveauParoleDb?: number;
  /** Bruit de fond du son entier et de sa bande haute (p10) ; `null` : inconnu. */
  plancherDb: number | null;
  plancherHautesDb: number | null;
}

/**
 * Masque de PAROLE par fenêtre (voir `REGLES_SILENCES_IV.paroleSurSeuilDb`). PUR. Un son « aigu » (fricative,
 * explosion) a au moins `partHautesMin` de son énergie au-dessus du bruit dans la bande haute ; une respiration (souffle
 * vers 1,5 kHz) non.
 */
export function masqueParoleIV(x: FenetresIV, r = REGLES_SILENCES_IV): boolean[] {
  const { niveaux, periodicite, hautesDb, seuilDb, niveauParoleDb = Infinity, plancherDb, plancherHautesDb } = x;
  const f = r.fenetreSec;
  const nb = niveaux.length;
  const parole = new Array<boolean>(nb).fill(false);
  const forte = (w: number) => niveaux[w] >= seuilDb + r.paroleSurSeuilDb;
  // Germes : fenêtres fortes VOISÉES (ou au niveau de la parole) ; un trou d'au plus `trouMaxSec` entre deux d'entre
  // elles, tout au-dessus du seuil (une syllabe moins périodique, une explosion), en fait partie. Une suite de moins de
  // `paroleMinSec` n'est pas un germe (une fenêtre de bruit périodique par hasard).
  const voisee = (w: number) => forte(w) && (periodicite[w] >= r.periodiciteMin || niveaux[w] >= niveauParoleDb);
  const trou = Math.round(r.trouMaxSec / f);
  const germes: [number, number][] = [];
  for (const [a, b] of suites(nb, voisee)) {
    const p = germes.at(-1);
    if (p && a - p[1] <= trou && niveaux.slice(p[1], a).every((d) => d >= seuilDb)) p[1] = b;
    else germes.push([a, b]);
  }
  for (const [a, b] of germes) if ((b - a) * f >= r.paroleMinSec - EPS_INSTANT) parole.fill(true, a, b);
  // Attaque et fondu d'un mot (au-dessus du seuil, sous le seuil + 3 dB) : parole, sur `accoleeMaxSec` au plus.
  const bord = Math.round(r.accoleeMaxSec / f);
  for (const [a, b] of suites(nb, (w) => parole[w])) {
    for (let w = a - 1; w >= Math.max(0, a - bord) && niveaux[w] >= seuilDb; w--) parole[w] = true;
    for (let w = b; w < Math.min(nb, b + bord) && niveaux[w] >= seuilDb; w++) parole[w] = true;
  }
  const exces = (db: number, plancher: number | null) => Math.max(0, 10 ** (db / 10) - (plancher === null ? 0 : 10 ** (plancher / 10)));
  const aigu = (a: number, b: number) => {
    let [h, t] = [0, 0];
    for (let w = a; w < b; w++) [h, t] = [h + exces(hautesDb[w], plancherHautesDb), t + exces(niveaux[w], plancherDb)];
    return t > 0 && h >= r.partHautesMin * t;
  };
  // Puis, de proche en proche, tout son AIGU accolé à la parole (fort, ou fricative faible : bande haute au-dessus de son
  // bruit) ; l'écart entre les deux (moins de `accoleeMaxSec`) est de la parole aussi.
  // Sous le seuil, la bande haute doit dépasser son bruit de plus que ses propres variations dans les silences (un bruit
  // de fond qui fluctue n'est pas une fricative) : `fricativeSurPlancherHfDb` plus `dispersionHfFacteur` fois l'écart
  // entre la médiane et le p10 de la bande haute des fenêtres sous le seuil.
  const calmes = hautesDb.filter((_, w) => niveaux[w] < seuilDb).sort((a, b) => a - b);
  const dispersion = calmes.length ? percentile(calmes, 0.5) - percentile(calmes, 0.1) : 0;
  const seuilHautes = plancherHautesDb === null ? Infinity : plancherHautesDb + r.fricativeSurPlancherHfDb + r.dispersionHfFacteur * dispersion;
  const hautes = (w: number) => hautesDb[w] >= seuilHautes && aigu(w, w + 1);
  // Plus longue que `fricativeMaxSec` : un bruit, pas une fricative.
  const restantes = suites(nb, (w) => !parole[w] && (forte(w) || hautes(w))).filter(([a, b]) => (b - a) * f <= r.fricativeMaxSec + EPS_INSTANT && aigu(a, b));
  const ecart = Math.round(r.accoleeMaxSec / f) - 1;
  for (let change = true; change; ) {
    change = false;
    for (let k = 0; k < restantes.length; k++) {
      const [a, b] = restantes[k];
      const lo = Math.max(0, a - ecart - 1);
      const hi = Math.min(nb, b + ecart + 1);
      if (parole.slice(a, b).every(Boolean) || !parole.slice(lo, hi).some(Boolean)) continue;
      // Étendue à l'écart qui la sépare de la parole.
      const de = parole.slice(lo, a).some(Boolean) ? lo + parole.slice(lo, a).lastIndexOf(true) + 1 : a;
      const jusque = parole.slice(b, hi).some(Boolean) ? b + parole.slice(b, hi).indexOf(true) : b;
      parole.fill(true, de, jusque);
      restantes.splice(k--, 1);
      change = true;
    }
  }
  return parole;
}

/** Silences mesurés privés des fenêtres de parole ; un reste plus court que `blancMinSec` n'est plus un silence. */
function silencesSansParole(silences: readonly Silence[], parole: readonly boolean[], f: number): Silence[] {
  const res: Silence[] = [];
  for (const x of silences) {
    const w0 = Math.round(x.debutSec / f);
    const w1 = Math.ceil(x.finSec / f - EPS_INSTANT);
    for (const [a, b] of suites(w1 - w0, (k) => !parole[w0 + k])) {
      const de = a === 0 ? x.debutSec : +((w0 + a) * f).toFixed(4);
      const fin = w0 + b >= w1 ? x.finSec : +((w0 + b) * f).toFixed(4);
      if (fin - de >= REGLES_FIN_DE_VOIX.blancMinSec - EPS_INSTANT) res.push({ debutSec: de, finSec: fin });
    }
  }
  return res;
}

/** Plancher de bruit (dB) d'un son : p10 des fenêtres hors zéro numérique ; `null` : rien à mesurer. PUR. */
export function plancherBruitIV(niveaux: readonly number[], r = REGLES_SILENCES_IV): number | null {
  const tries = niveaux.filter((d) => d > r.zeroNumeriqueDb).sort((a, b) => a - b);
  return tries.length ? percentile(tries, r.percentilePlancher) : null;
}

/** Médiane (dB) des fenêtres de parole : à `paroleSurPlancherDb` au moins au-dessus du plancher. */
function medianeParole(niveaux: readonly number[], plancher: number, r = REGLES_SILENCES_IV): number | null {
  const p = niveaux.filter((d) => d >= plancher + r.paroleSurPlancherDb).sort((a, b) => a - b);
  return p.length ? percentile(p, 0.5) : null;
}

/**
 * Seuil de silence (dB) adapté au bruit de fond, d'après les niveaux des fenêtres du fichier. PUR. `plancherConnuDb` :
 * plancher déjà mesuré sur un son plus long de la même voix (le corps, pour la fin) ; le plus bas des deux est gardé.
 */
export function seuilSilenceIV(niveaux: readonly number[], r = REGLES_SILENCES_IV, plancherConnuDb?: number): number {
  return mesureSeuilIV(niveaux, r, plancherConnuDb).seuilDb;
}

function mesureSeuilIV(niveaux: readonly number[], r: typeof REGLES_SILENCES_IV, plancherConnuDb?: number): { seuilDb: number; plancherDb: number | null; paroleDb: number } {
  const propre = plancherBruitIV(niveaux, r);
  const plancher = propre === null ? (plancherConnuDb ?? null) : plancherConnuDb === undefined ? propre : Math.min(propre, plancherConnuDb);
  if (plancher === null) return { seuilDb: r.seuilMinDb, plancherDb: null, paroleDb: r.seuilMinDb + r.niveauParoleSurSeuilDb };
  const mediane = medianeParole(niveaux, plancher, r);
  const seuilDb = +Math.max(r.seuilMinDb, Math.min(plancher + r.margeDb, mediane === null ? Infinity : mediane - r.ecartParoleDb, r.plafondDb)).toFixed(2);
  const paroleDb = +Math.max(seuilDb + r.niveauParoleSurSeuilDb, mediane === null ? -Infinity : mediane - r.niveauParoleSousMedianeDb).toFixed(2);
  return { seuilDb, plancherDb: plancher, paroleDb };
}

/**
 * Silences mesurés d'un son brut pour l'assemblage : seuil adapté au bruit de fond (`seuilSilenceIV`), plancher et niveau
 * de la parole (`niveauParoleDb` : au-dessus, un son retiré serait un mot perdu).
 */
export function silencesIV(son: Son, r = REGLES_SILENCES_IV, plancherConnuDb?: number): MesureSonIV {
  const niveaux = niveauxDb(son, r.fenetreSec);
  const { seuilDb, plancherDb, paroleDb } = mesureSeuilIV(niveaux, r, plancherConnuDb);
  const fortes = (w: number) => niveaux[w] >= seuilDb + r.paroleSurSeuilDb;
  const periodicite = periodicitesIV(son, r, niveaux.length, fortes);
  const hautesDb = niveauxDb({ ...son, echantillons: filtre(son.echantillons, son.frequence, "ph", r.passeHautHz) }, r.fenetreSec);
  const paroles = masqueParoleIV({ niveaux, periodicite, hautesDb, seuilDb, niveauParoleDb: paroleDb, plancherDb, plancherHautesDb: plancherBruitIV(hautesDb, r) }, r);
  const bruts = silencesMesures(son, { ...REGLES_FIN_DE_VOIX, fenetreSec: r.fenetreSec, blancDb: seuilDb });
  return {
    paroles,
    silences: silencesSansParole(bruts, paroles, r.fenetreSec),
    silencesBruts: bruts,
    seuilDb,
    niveaux,
    fenetreSec: r.fenetreSec,
    ...(plancherDb === null ? {} : { plancherDb }),
    niveauParoleDb: paroleDb,
  };
}

const dansUnSilence = (t: number, s: readonly Silence[]) => s.some((x) => t >= x.debutSec - EPS_INSTANT && t <= x.finSec + EPS_INSTANT);

/** Une coupe hors d'un silence mesuré ; le début et la fin du fichier ne sont pas des coupes. */
export interface CoupeEnPleinSon {
  source: "corps" | "fin";
  instantSec: number;
}

/** Coupes du plan (début et fin de chaque morceau gardé) qui ne tombent dans aucun silence mesuré de leur son. */
export function coupesEnPleinSon(plan: Pick<PlanRaccordVoix, "morceaux">, silences: { corps: readonly Silence[]; fin?: readonly Silence[] }, durees: { corps: number; fin?: number }): CoupeEnPleinSon[] {
  const res: CoupeEnPleinSon[] = [];
  for (const m of plan.morceaux) {
    if (m.silence) continue;
    const source = m.source === 1 ? "fin" : "corps";
    const s = (source === "fin" ? silences.fin : silences.corps) ?? [];
    const duree = (source === "fin" ? durees.fin : durees.corps) ?? Infinity;
    if (m.debutSec > 0.001 && !dansUnSilence(m.debutSec, s)) res.push({ source, instantSec: m.debutSec });
    if (m.finSec < duree - 0.001 && !dansUnSilence(m.finSec, s)) res.push({ source, instantSec: m.finSec });
  }
  return res;
}

/**
 * 16/10 (prod v-dd3049053f88, après #281 : « la coupe à 3,04 s … (8 coupes dans ce cas) ») : les coupes du plan sont
 * posées sur les HORODATAGES des mots (fin du mot + 0,05 à 0,10 s, début du mot suivant − 0,05 à 0,10 s), pas sur le son.
 * Le recalage emprunté au cas concret (`recalerCoupesSurSilences`) ne cherche qu'en AVANT pour une fin de morceau et en
 * ARRIÈRE pour un début, et bute sur la coupe voisine : quand l'horodatage HeyGen est en retard sur le son (le silence
 * est AVANT la fin du morceau), ou quand les deux coupes d'une pause courte se bloquent l'une l'autre, aucune ne bouge.
 * Ici, les deux coupes de chaque pause (fin d'un morceau, début du suivant) sont placées ENSEMBLE dans le silence mesuré
 * qui les déplace le moins, en avant ou en arrière, chacune de `toleranceSec` au plus (le premier début et la dernière
 * fin d'un son : seuls). Bornes de sûreté, les horodatages étant faux de 0,05 à 0,2 s : une fin ne recule jamais à plus
 * de 0,2 s avant la fin horodatée du dernier mot de son morceau (ni avant son début), un début n'avance jamais à plus de
 * 0,2 s après le début horodaté du premier ; une occlusive au milieu d'un mot long n'attire donc pas une coupe. Les
 * pauses franches (`pauseFrancheSec`) passent avant les silences plus courts. Sans silence à portée, la coupe reste en
 * place : elle sera refusée, avec son diagnostic (`diagnosticCoupe`).
 *
 * 16/10 (relecture #283) : un déplacement ne RETIRE JAMAIS de son. Avec un horodatage en retard, le silence le plus
 * proche d'un début pouvait être APRÈS le vrai mot (le mot entier disparaissait, accepté) ; une fin pouvait reculer dans
 * le creux d'une occlusive de fin de mot (« acte » : la dernière syllabe disparaissait) ; deux pauses voisines pouvaient
 * vider un morceau. Désormais, une coupe ne s'éloigne de son morceau (fin plus tard, début plus tôt) que jusqu'à la coupe
 * voisine ; elle n'entre dans son morceau que si TOUT ce qu'elle retire (et que le morceau voisin ne reprend pas) est
 * dans un même silence mesuré (`sansSon`) ; aucun morceau ne garde moins de `dureeMinMorceauSec` (collé au précédent, il
 * lui est fusionné). Sinon, la coupe reste en place et sera refusée. Une fin tombée dans le creux d'une occlusive finale
 * avance jusqu'au silence suivant. La garantie ne dépend plus de l'erreur des horodatages.
 *
 * 16/10 (relecture #283, 2e passage) : trop de refus, et un premier mot court perdu sans refus (défaut du plan brut).
 *  - Les deux coupes d'une pause peuvent tomber chacune dans SON silence (pause hachée par une respiration ou un pic de
 *    bruit), à condition que rien de ce qu'elles retirent entre elles ne soit de la PAROLE (`paroleDans`, voir
 *    `REGLES_SILENCES_IV.paroleSurSeuilDb`) ; une respiration se retire, un mot jamais.
 *  - Une fin peut avancer (un début reculer) jusqu'à la portée de la coupe voisine : elle ne fait qu'ajouter du son (une
 *    respiration collée au dernier mot, au besoin toute la pause). Une pause de 80 ms au plus sans aucun silence à portée
 *    est gardée entière (ses deux morceaux fusionnés) au lieu d'être refusée.
 *  - Un pic de bruit d'une fenêtre (sous le seuil + 6 dB) n'empêche plus une coupe d'entrer dans le silence voisin.
 *  - Le premier début recule jusqu'au silence qui précède le premier son du fichier, la dernière fin avance jusqu'à celui
 *    qui suit la dernière parole : un mot horodaté trop tard ou trop tôt n'est plus laissé hors des morceaux.
 *  - Une coupe à moins de `margeSec` du son qu'elle garde (fin juste après un fondu) s'en écarte, dans son silence.
 *  - Filet final (`paroleRetireeIV`) : un écart retiré qui contient `paroleRetireeMaxSec` de parole ou plus est refusé.
 *
 * 19/10 (décision de Will ; prod v-ca92da958325) : une pause de 0,2 s au plus qui n'a AUCUN silence, brut ou retenu, à
 * `toleranceSec` autour de ses coupes n'est plus refusée « coupe en plein son » : ses deux morceaux sont fusionnés (le son
 * reste comme HeyGen l'a dit ; au pire un léger souffle entre deux mots). Réservé à Image → vidéo (`couperVoixIV` pose
 * `garderPausesSansSilence`) ; sans cette option, `placerCoupesIV` est inchangé. Une pause plus longue reste refusée ; un
 * silence situé derrière un mot n'est jamais cherché. La règle « jamais coupée ailleurs que dans un silence » est intacte.
 *
 * 17/10 (relecture #283, 4e passage) : une voyelle isolée de 45 à 59 ms n'a que deux fenêtres de parole (40 ms) ; le
 * placement la laissait dans l'écart retiré et le filet ne refusait pas (« > 40 ms ») : mot perdu sans refus. Le filet
 * et l'examen d'une pause refusent désormais dès `paroleRetireeMaxSec` (40 ms ou plus), et une seule fenêtre de parole
 * suffit au premier et au dernier son (`premierSon`, `derniereParole`).
 * Limite connue (non traitée) : un son de mot non voisé et SOUS le seuil de silence (« h », queue d'un murmure final,
 * aspiration d'une occlusive, « f » faible sous un souffle HF) est mesuré comme du silence : une coupe peut s'y poser ou
 * le retirer (30 à 80 ms au plus, relevé de la 4e relecture).
 */
export const REGLES_COUPES_IV = Object.freeze({
  toleranceSec: 0.25,
  /** Une coupe déplacée garde au plus ce blanc de chaque côté, dans le silence trouvé. */
  margeSec: REGLES_FIN_DE_VOIX.queueSec,
  /** Erreur maximale admise d'un horodatage de mot (s) : borne de sûreté des coupes déplacées. */
  decalageMotsMaxSec: 0.2,
  /**
   * Silence d'au moins cette durée : une vraie pause, préférée à un silence plus court (une occlusive au milieu d'un mot
   * mesure 40 à 60 ms ; une pause où le plan coupe en fait 100 ms au moins, 80 ms une fois mesurée en fenêtres de 20 ms).
   */
  pauseFrancheSec: 0.08,
  /**
   * Pause du plan d'au plus cette durée (s), sans aucun silence à portée : ses deux morceaux sont fusionnés (la pause est
   * gardée entière) au lieu d'un refus. 80 ms : moins que le blanc visé entre deux mots (100 ms), le rythme ne change pas.
   */
  pauseFusionMaxSec: 0.08,
  /**
   * Pause du plan sans aucun silence mesuré entre ses deux coupes, de PAROLE pour moitié au moins, et sans point de coupe
   * sûr à portée (relecture #283, 3e passage : horodatage en avance, le mot continue) : jusqu'à cette durée (l'erreur
   * maximale d'un horodatage, `decalageMotsMaxSec`), et s'il y a un silence à `toleranceSec` (la vraie fin du mot), ses
   * deux morceaux sont fusionnés. Rien n'y est à resserrer : c'est le mot. Sinon (une pause remplie d'un souffle, d'un son
   * continu), refus. 18/10 (prod v-dcc902c3f3dd, fin TikTok « fermeture ? » → « Faites ») : la preuve d'un silence à
   * `toleranceSec` se lit dans les silences BRUTS (avant masque) ; le « F » de « Faites » effaçait le seul creux
   * (2,54-2,66 s, −45 à −38 dB) ; une fusion ne retire rien.
   */
  pauseSansSilenceMaxSec: 0.2,
  /**
   * 19/10 (décision de Will ; prod v-ca92da958325 : deux virgules sans pause dite, que les horodatages HeyGen séparent de
   * 0,11 à 0,3 s) : pause du plan d'au plus cette durée (s) SANS AUCUN silence, brut ou retenu, à `toleranceSec` autour
   * de ses coupes, et seulement si l'appelant le demande (`garderPausesSansSilence`) : ses deux morceaux sont fusionnés,
   * le son reste exactement comme HeyGen l'a dit (rien n'est coupé ni retiré ; au pire un léger souffle entre deux mots).
   * Plus longue, ou avec un silence à portée qui n'a pas servi : refus comme avant. Le silence de l'autre côté d'un mot
   * n'est jamais cherché.
   */
  pauseGardeeSansSilenceMaxSec: 0.2,
  /** Aucun morceau gardé plus court (s) : jamais d'`atrim` vide. */
  dureeMinMorceauSec: 0.05,
  /**
   * Parole retirée REFUSÉE (s) dans un écart retiré (entre deux morceaux, avant le premier, après le dernier) : fenêtres
   * de parole (`paroleDans`). Dès cette durée (incluse), un mot serait perdu : refus ; moins (une fenêtre, 20 ms : le bord
   * d'un fondu) est admis. 40 ms, deux fenêtres : une voyelle isolée de 45 à 59 ms n'en montre que deux (relecture #283,
   * 4e passage) ; un mot faible (−28 dB, 0,11 s) n'en montrait que trois.
   */
  paroleRetireeMaxSec: 0.04,
  /** Une coupe déplacée peut retirer au plus ce son hors silence (une fenêtre), et seulement au niveau du bruit de fond. */
  retraitHorsSilenceMaxSec: 0.02,
  /** Explosion d'une occlusive finale : son d'au plus cette durée (s) entre le creux et le silence suivant (respiration à part). */
  explosionMaxSec: 0.06,
  /** Son net (premier début, pics de bruit) : à ce niveau au moins au-dessus du seuil de silence (respiration comprise). */
  sonSurSeuilDb: 6,
});

/** Fenêtres d'au moins ce niveau dans `[lo, hi]`, en secondes (chevauchement compté). */
function sonAuDessus(m: MesureSonIV, lo: number, hi: number, niveauDb: number): number {
  const f = m.fenetreSec ?? REGLES_SILENCES_IV.fenetreSec;
  let total = 0;
  for (let w = Math.max(0, Math.floor(lo / f + EPS_INSTANT)); w < m.niveaux.length && w * f < hi - EPS_INSTANT; w++) {
    if (m.niveaux[w] >= niveauDb) total += Math.max(0, Math.min(hi, (w + 1) * f) - Math.max(lo, w * f));
  }
  return total;
}

/** Parole (s) dans `[lo, hi]` : fenêtres du masque de parole (`masqueParoleIV`) ; sans masque, au niveau de la parole ou voisées. */
export function paroleDans(m: MesureSonIV, lo: number, hi: number): number {
  if (m.niveauParoleDb === undefined && !m.paroles) return 0;
  const f = m.fenetreSec ?? REGLES_SILENCES_IV.fenetreSec;
  let total = 0;
  for (let w = Math.max(0, Math.floor(lo / f + EPS_INSTANT)); w < m.niveaux.length && w * f < hi - EPS_INSTANT; w++) {
    if (estParole(m, w)) total += Math.max(0, Math.min(hi, (w + 1) * f) - Math.max(lo, w * f));
  }
  return total;
}

/** Suites d'au moins `minFenetres` fenêtres retenues par `garde` dans `[lo, hi]` : `[début, fin]` en secondes. */
function suitesDeSon(m: MesureSonIV, lo: number, hi: number, garde: (w: number) => boolean, minFenetres = 2): [number, number][] {
  const f = m.fenetreSec ?? REGLES_SILENCES_IV.fenetreSec;
  const res: [number, number][] = [];
  let debut = -1;
  const w0 = Math.max(0, Math.floor(lo / f + EPS_INSTANT));
  const w1 = Math.min(m.niveaux.length, Math.ceil(hi / f - EPS_INSTANT));
  for (let w = w0; w <= w1; w++) {
    if (w < w1 && garde(w)) {
      if (debut < 0) debut = w;
    } else if (debut >= 0) {
      if (w - debut >= minFenetres) res.push([debut * f, w * f]);
      debut = -1;
    }
  }
  return res;
}

const estParole = (m: MesureSonIV, w: number) => (m.paroles ? !!m.paroles[w] : m.niveauParoleDb !== undefined && (m.niveaux[w] >= m.niveauParoleDb || !!m.voisees?.[w]));
/**
 * Début de la première parole de `[lo, hi]` (masque de parole, une fenêtre suffit : une voyelle de 45 ms n'en montre
 * parfois qu'une ; sans masque : premier son net de deux fenêtres, respiration comprise), ou `null`.
 */
const premierSon = (m: MesureSonIV, lo: number, hi: number, niveauDb: number) => (m.paroles ? suitesDeSon(m, lo, hi, (w) => !!m.paroles![w], 1) : suitesDeSon(m, lo, hi, (w) => m.niveaux[w] >= niveauDb))[0]?.[0] ?? null;
/** Fin de la dernière parole de `[lo, hi]` (une fenêtre de parole suffit), ou `null`. */
const derniereParole = (m: MesureSonIV, lo: number, hi: number) => suitesDeSon(m, lo, hi, (w) => estParole(m, w), 1).at(-1)?.[1] ?? null;

/**
 * Le son qui suit `t` est-il la fin d'un mot (explosion d'une occlusive finale) ? Court (au plus `explosionMaxSec` avant
 * la première fenêtre sous le seuil), attaque franche qui retombe aussitôt (de 3 dB au moins d'une fenêtre à la
 * suivante), ou parole dès ses deux premières fenêtres. Une respiration, elle, monte doucement.
 */
function explosionApres(m: MesureSonIV, t: number, r = REGLES_COUPES_IV): boolean {
  const f = m.fenetreSec ?? REGLES_SILENCES_IV.fenetreSec;
  const w0 = Math.max(0, Math.round(t / f));
  let w = w0;
  while (w < m.niveaux.length && m.niveaux[w] >= m.seuilDb) w++;
  if (w === w0) return false;
  const retombe = w > w0 + 1 && m.niveaux[w0] >= m.niveaux[w0 + 1] + 3;
  return (w - w0) * f <= r.explosionMaxSec + EPS_INSTANT || retombe || paroleDans(m, w0 * f, (w0 + 2) * f) > EPS_INSTANT;
}

/** Durée de `[lo, hi]` hors des silences mesurés. */
function horsSilence(lo: number, hi: number, s: readonly Silence[]): number {
  let dedans = 0;
  for (const x of s) dedans += Math.max(0, Math.min(hi, x.finSec) - Math.max(lo, x.debutSec));
  return Math.max(0, hi - lo - dedans);
}

/** Points où une coupe à `t` peut aller : elle-même si elle est dans un silence, et le point le plus proche de chaque silence de `[lo, hi]`. */
function pointsDeCoupe(t: number, ok: boolean, lo: number, hi: number, s: readonly Silence[], r = REGLES_COUPES_IV): { p: number; franche: boolean }[] {
  const res = ok ? [{ p: t, franche: true }] : [];
  for (const x of s) {
    const m = Math.min(r.margeSec, (x.finSec - x.debutSec) / 2);
    const a = Math.max(x.debutSec + m, lo);
    const b = Math.min(x.finSec - m, hi);
    if (a > b + EPS_INSTANT) continue;
    const p = Math.min(Math.max(t, a), b);
    if (!res.some((q) => Math.abs(q.p - p) <= EPS_INSTANT)) res.push({ p, franche: x.finSec - x.debutSec >= r.pauseFrancheSec - EPS_INSTANT });
  }
  return res;
}

/** `k` passe-t-il avant `l` (ordre lexicographique) ? */
const avant = (k: readonly number[], l: readonly number[]) => {
  for (let i = 0; i < k.length; i++) if (Math.abs(k[i] - l[i]) > EPS_INSTANT) return k[i] < l[i];
  return false;
};

interface MotsBruts {
  corps: readonly MotHorodate[];
  fin?: readonly MotHorodate[];
}

/** Instant (son resserré, avant atempo) d'un instant d'un son brut, d'après les morceaux du plan. */
function instantResserre(morceaux: PlanRaccordVoix["morceaux"], source: 0 | 1, t: number): number {
  let ecoule = 0;
  let apres = 0;
  for (const m of morceaux) {
    if (!m.silence && m.source === source) {
      if (t <= m.debutSec) return ecoule;
      if (t <= m.finSec) return ecoule + (t - m.debutSec);
      apres = ecoule + (m.finSec - m.debutSec);
    }
    ecoule += m.finSec - m.debutSec;
  }
  return apres;
}

const longueurAvantFin = (morceaux: PlanRaccordVoix["morceaux"]) => {
  const k = morceaux.findIndex((m) => !m.silence && m.source === 1);
  return morceaux.slice(0, k < 0 ? morceaux.length : k).reduce((a, m) => a + (m.finSec - m.debutSec), 0);
};

/** Pauses franches d'abord, puis tous les silences (voir `REGLES_COUPES_IV.pauseFrancheSec`). */
const parPauses = (s: readonly Silence[], r = REGLES_COUPES_IV) => [s.filter((x) => x.finSec - x.debutSec >= r.pauseFrancheSec - EPS_INSTANT), s];

/**
 * `[lo, hi]` ne contient aucun son : vide, ou dans UN silence mesuré. Sans tolérance : chaque fenêtre de 20 ms d'un
 * silence est sous le seuil, alors qu'une tolérance d'une fenêtre laissait une fin reculer de 20 ms de son dans le creux
 * d'une occlusive finale.
 */
const sansSon = (lo: number, hi: number, s: readonly Silence[]) => hi <= lo + EPS_INSTANT || s.some((x) => lo >= x.debutSec - EPS_INSTANT && hi <= x.finSec + EPS_INSTANT);

/** Point de `[lo, hi]` dans un silence (marge comprise) le plus proche de `t`, ou `null`. */
function pointDansUnSilence(t: number, lo: number, hi: number, s: readonly Silence[], marge: number): number | null {
  for (const groupe of parPauses(s)) {
    const p = pointDansUnGroupe(t, lo, hi, groupe, marge);
    if (p !== null) return p;
  }
  return null;
}

function pointDansUnGroupe(t: number, lo: number, hi: number, s: readonly Silence[], marge: number): number | null {
  let meilleur: number | null = null;
  for (const x of s) {
    const m = Math.min(marge, (x.finSec - x.debutSec) / 2);
    const a = Math.max(x.debutSec + m, lo);
    const b = Math.min(x.finSec - m, hi);
    if (a > b + EPS_INSTANT) continue;
    const p = Math.min(Math.max(t, a), b);
    if (meilleur === null || Math.abs(p - t) < Math.abs(meilleur - t) - EPS_INSTANT) meilleur = p;
  }
  return meilleur;
}

/**
 * Le son de `[de, pb]` est-il la TRAÎNE décroissante d'un mot qui finit en `de` (et non l'attaque d'un mot suivant, plateau
 * ou montée) ? `pb` doit tomber dans le PREMIER silence mesuré après `de` ; les niveaux de toutes les fenêtres de `de` à
 * ce silence (un creux plus bref qu'un silence mesuré compte : il ne s'arrête pas là) ne remontent jamais de plus de 1 dB,
 * et la fin des fenêtres au-dessus du seuil est au moins 3 dB plus bas que le début. Sans mesure : non. PUR.
 */
function trainePuisSilence(m: MesureSonIV | undefined, s: readonly Silence[], de: number, pb: number): boolean {
  if (!m) return false;
  const z = s.find((x) => x.finSec > de + EPS_INSTANT);
  if (!z || pb < z.debutSec - EPS_INSTANT || pb > z.finSec + EPS_INSTANT) return false;
  const f = m.fenetreSec ?? REGLES_SILENCES_IV.fenetreSec;
  const niv: number[] = [];
  for (let w = Math.max(0, Math.floor(de / f + EPS_INSTANT)); w < m.niveaux.length && w * f < z.debutSec - EPS_INSTANT; w++) niv.push(m.niveaux[w]);
  if (!niv.every((x, i) => i === 0 || x <= niv[i - 1] + 1)) return false;
  const sons = niv.filter((x) => x > m.seuilDb);
  return sons.length === 0 || (sons.length < 2 ? sons[0] <= m.seuilDb + 12 : sons[sons.length - 1] <= sons[0] - 3);
}

/**
 * Rapproche chaque coupe en plein son du silence mesuré le plus proche (voir `REGLES_COUPES_IV`). PUR. Les mots, la
 * durée, le fondu de sortie et le raccord suivent. Rien à déplacer : le plan est rendu tel quel.
 */
export function placerCoupesIV(
  plan: PlanRaccordVoix,
  motsBruts: MotsBruts,
  silences: { corps: readonly Silence[]; fin?: readonly Silence[] },
  durees: { corps: number; fin?: number },
  r = REGLES_COUPES_IV,
  o: { mesures?: { corps?: MesureSonIV; fin?: MesureSonIV }; retraitsVoulus?: readonly [number, number][]; garderPausesSansSilence?: boolean } = {},
): { plan: PlanRaccordVoix; coupesDeplacees: number } {
  const { mesures, retraitsVoulus = [], garderPausesSansSilence = false } = o;
  const morceaux = plan.morceaux.map((m) => ({ ...m }));
  let deplacees = 0;
  const bouger = (m: (typeof morceaux)[number], cote: "debutSec" | "finSec", p: number) => {
    if (Math.abs(p - m[cote]) <= EPS_INSTANT) return;
    m[cote] = arrondi(p);
    deplacees++;
  };
  for (const source of [0, 1] as const) {
    const s = (source === 1 ? silences.fin : silences.corps) ?? [];
    const mots = (source === 1 ? motsBruts.fin : motsBruts.corps) ?? [];
    const duree = (source === 1 ? durees.fin : durees.corps) ?? Infinity;
    const liste = morceaux.filter((m) => !m.silence && m.source === source);
    if (!liste.length) continue;
    const mesure = source === 1 ? mesures?.fin : mesures?.corps;
    const parole = (lo: number, hi: number) => (mesure ? paroleDans(mesure, lo, hi) : 0);
    // Retirable sans perte : dans un silence mesuré, ou hors silence d'une fenêtre au plus, au niveau du bruit de fond
    // (un pic de bruit de quelques dB au-dessus du seuil, jamais un bout de mot ni de respiration).
    const retirable = (lo: number, hi: number) =>
      sansSon(lo, hi, s) || (mesure !== undefined && horsSilence(lo, hi, s) <= r.retraitHorsSilenceMaxSec + EPS_INSTANT && sonAuDessus(mesure, lo, hi, mesure.seuilDb + r.sonSurSeuilDb) <= EPS_INSTANT);
    const motsDe = (m: (typeof liste)[number]) => mots.filter((w) => w.debutSec >= m.debutSec - EPS_INSTANT && w.debutSec <= m.finSec + EPS_INSTANT);
    const plancherFin = (m: (typeof liste)[number]) => {
      const w = motsDe(m).at(-1);
      return Math.max(m.debutSec, w ? Math.max(w.debutSec, w.finSec - r.decalageMotsMaxSec) : m.debutSec);
    };
    const plafondDebut = (m: (typeof liste)[number]) => {
      const w = motsDe(m)[0];
      return Math.min(m.finSec, w ? Math.min(w.finSec, w.debutSec + r.decalageMotsMaxSec) : m.finSec);
    };

    // Premier début et dernière fin de la source : seuls.
    const premier = liste[0];
    const dernier = liste[liste.length - 1];
    // Un début n'avance (une fin ne recule) que si le son retiré est un silence ; sinon, seulement de l'autre côté.
    if (premier.debutSec > 0.001 && !dansUnSilence(premier.debutSec, s)) {
      const t = premier.debutSec;
      const lo = Math.max(t - r.toleranceSec, 0);
      const hi = Math.min(t + r.toleranceSec, plafondDebut(premier), premier.finSec - r.dureeMinMorceauSec);
      let p = pointDansUnSilence(t, lo, hi, s, r.margeSec);
      if (p !== null && !retirable(t, p)) p = pointDansUnSilence(t, lo, t, s, r.margeSec);
      if (p !== null) bouger(premier, "debutSec", p);
    }
    if (dernier.finSec < duree - 0.001 && !dansUnSilence(dernier.finSec, s)) {
      const t = dernier.finSec;
      const lo = Math.max(t - r.toleranceSec, plancherFin(dernier), dernier.debutSec + r.dureeMinMorceauSec);
      const hi = Math.min(t + r.toleranceSec, duree);
      let p = pointDansUnSilence(t, lo, hi, s, r.margeSec);
      if (p !== null && !retirable(p, t)) p = pointDansUnSilence(t, t, hi, s, r.margeSec);
      if (p !== null) bouger(dernier, "finSec", p);
    }

    // Premier début et dernière fin : jamais de parole laissée avant (après) eux. Un horodatage en retard de plus que la
    // durée du premier mot met le début du plan dans le silence APRÈS ce mot : il était perdu sans refus. Le début recule
    // alors jusqu'au silence qui précède le premier son du fichier (on n'ajoute que ce mot et du blanc) ; la fin avance
    // de même jusqu'au silence qui suit la dernière parole.
    if (mesure) {
      const sonNet = mesure.seuilDb + r.sonSurSeuilDb;
      const s1 = premierSon(mesure, 0, premier.debutSec, sonNet);
      if (s1 !== null) {
        const x = [...s].reverse().find((z) => z.finSec <= s1 + EPS_INSTANT);
        bouger(premier, "debutSec", x ? Math.min(premier.debutSec, x.finSec - Math.min(r.margeSec, (x.finSec - x.debutSec) / 2)) : 0);
      }
      const e1 = derniereParole(mesure, dernier.finSec, duree);
      if (e1 !== null) {
        const y = s.find((z) => z.debutSec >= e1 - EPS_INSTANT);
        bouger(dernier, "finSec", y ? Math.max(dernier.finSec, y.debutSec + Math.min(r.margeSec, (y.finSec - y.debutSec) / 2)) : Number.isFinite(duree) ? duree : dernier.finSec);
      }
    }

    // Chaque pause entre deux morceaux voisins : la fin du premier et le début du second. Chacune va dans un silence à
    // `toleranceSec` au plus (le même pour les deux, ou chacune le sien : une pause hachée par une respiration ou un pic
    // de bruit), sans jamais retirer de son (ci-dessous). Ordre de préférence : rien au niveau de la parole entre les deux
    // coupes (une respiration peut être retirée, un mot jamais), puis des pauses franches, puis le moindre déplacement.
    for (let i = 0; i + 1 < liste.length; i++) {
      const a = liste[i];
      const b = liste[i + 1];
      const okA = dansUnSilence(a.finSec, s);
      const okB = dansUnSilence(b.debutSec, s);
      // Écart retiré EXPRÈS (chapitre d'une version courte) : sa parole n'est pas à garder, ses coupes ne vont pas au-delà
      // de `toleranceSec`.
      const voulu = source === 0 && retraitsVoulus.some(([x, y]) => x < b.debutSec && y > a.finSec);
      const paroleEntre = (lo: number, hi: number) => (voulu ? 0 : parole(lo, hi));
      if (okA && okB && paroleEntre(a.finSec, b.debutSec) < r.paroleRetireeMaxSec - EPS_INSTANT) continue;
      // Une fin peut aussi avancer jusqu'à la portée du début suivant (un début reculer jusqu'à celle de la fin) : elle ne
      // fait qu'ajouter du son (une respiration collée au dernier mot, la pause entière au besoin), jamais en retirer.
      const [loA, hiB] = [Math.max(a.finSec - r.toleranceSec, plancherFin(a)), Math.min(b.debutSec + r.toleranceSec, plafondDebut(b))];
      const pointsA = pointsDeCoupe(a.finSec, okA, loA, voulu ? Math.min(a.finSec + r.toleranceSec, hiB) : Math.max(a.finSec + r.toleranceSec, hiB), s, r);
      const pointsB = pointsDeCoupe(b.debutSec, okB, voulu ? Math.max(b.debutSec - r.toleranceSec, loA) : Math.min(b.debutSec - r.toleranceSec, loA), hiB, s, r);
      const colle = i > 0 && Math.abs(a.debutSec - liste[i - 1].finSec) <= EPS_INSTANT;
      let choix: [number, number] | null = null;
      let cle: number[] = [];
      for (const qa of pointsA) {
        for (const qb of pointsB) {
          const [pa, pb] = [qa.p, qb.p];
          if (pb < pa - EPS_INSTANT) continue;
          // Aucun morceau trop court (un morceau collé au précédent peut raccourcir : il lui sera fusionné).
          if (pa < a.debutSec + (colle ? 0 : r.dureeMinMorceauSec) - EPS_INSTANT || pb > b.finSec - r.dureeMinMorceauSec + EPS_INSTANT) continue;
          // Jamais de son retiré : ce que la fin rend (et que le début suivant ne reprend pas), ce que le début rend (et que
          // la fin précédente ne reprend pas) sont retirables (`retirable`).
          // Écart retiré EXPRÈS (`voulu`) : le son retiré juste avant le mot gardé peut être la traîne du dernier mot sauté
          // (ses horodatages sont en avance). Accepté seulement si le début du morceau reste dans la phrase retirée ou sa
          // traîne : pas au-delà du début horodaté du premier mot gardé, et aucun silence ne se termine entre la fin de la
          // phrase sautée et le point (sinon c'est l'attaque, ou une pause, du mot gardé). Côté fin : jamais, le son qui
          // précède la phrase sautée est la queue d'un mot gardé.
          const retraitsProches = voulu ? retraitsVoulus.filter(([x, y]) => x < b.debutSec && y > a.finSec) : [];
          const finRetrait = retraitsProches.length ? Math.max(...retraitsProches.map(([, y]) => y)) : undefined;
          const premierGarde = motsDe(b)[0];
          const finOk = retirable(pa, Math.min(a.finSec, pb));
          const debutOk = retirable(Math.max(b.debutSec, pa), pb) || (finRetrait !== undefined && b.debutSec >= finRetrait - EPS_INSTANT && (premierGarde === undefined || pb <= premierGarde.debutSec + EPS_INSTANT) && !s.some((z) => z.finSec > Math.min(b.debutSec, finRetrait) + EPS_INSTANT && z.finSec < pb - EPS_INSTANT) && trainePuisSilence(mesure, s, finRetrait, pb));
          if (!finOk || !debutOk) continue;
          const k = [paroleEntre(pa, pb) >= r.paroleRetireeMaxSec - EPS_INSTANT ? 1 : 0, (qa.franche ? 0 : 1) + (qb.franche ? 0 : 1), Math.abs(pa - a.finSec) + Math.abs(pb - b.debutSec)];
          if (choix && !avant(k, cle)) continue;
          choix = [pa, pb];
          cle = k;
        }
      }
      if (choix) {
        bouger(a, "finSec", choix[0]);
        bouger(b, "debutSec", choix[1]);
      } else if (!voulu && !(okA && okB) && (b.debutSec - a.finSec <= r.pauseFusionMaxSec + EPS_INSTANT || (b.debutSec - a.finSec <= r.pauseSansSilenceMaxSec + EPS_INSTANT && !s.some((z) => z.finSec > a.finSec && z.debutSec < b.debutSec) && (mesure?.silencesBruts ?? s).some((z) => z.finSec > a.finSec - r.toleranceSec && z.debutSec < b.debutSec + r.toleranceSec) && parole(a.finSec, b.debutSec) >= (b.debutSec - a.finSec) / 2) || (garderPausesSansSilence && b.debutSec - a.finSec <= r.pauseGardeeSansSilenceMaxSec + EPS_INSTANT && ![...s, ...(mesure?.silencesBruts ?? [])].some((z) => z.finSec > a.finSec - r.toleranceSec && z.debutSec < b.debutSec + r.toleranceSec)))) {
        // Pause minuscule sans aucun silence à portée (deux mots enchaînés que les horodatages séparent à peine, une pause
        // toute en respiration), ou « pause » horodatée sans AUCUN silence masqué dans la pause (un silence BRUT à toleranceSec prouve la fin du mot) et surtout faite de parole (le mot continue :
        // horodatage en avance) :
        // la couper retirerait du son. Les deux morceaux n'en font qu'un (rien n'est retiré).
        bouger(a, "finSec", b.finSec);
        morceaux.splice(morceaux.indexOf(b), 1);
        liste.splice(i + 1, 1);
        i--;
      }
    }
    // Fin dans un silence suivi de SON avant la coupe suivante (horodatage en avance : la fin tombe dans le creux d'une
    // occlusive finale, « ac|te ») : elle avance jusqu'au silence suivant, à `toleranceSec` au plus. On n'y ajoute que
    // du son ; un début n'est pas reculé ainsi (le son avant lui est le plus souvent une respiration, retirée exprès).
    // Plusieurs creux de suite (occlusive interne puis finale) : la règle est reprise tant qu'elle avance la fin.
    liste.forEach((a, i) => {
      const depart = a.finSec;
      for (let essai = 0; essai < 4; essai++) {
        const b = liste[i + 1];
        const borne = b ? b.debutSec : duree;
        if (b && source === 0 && retraitsVoulus.some(([u, v]) => u < b.debutSec && v > a.finSec)) return;
        const x = s.find((z) => a.finSec >= z.debutSec - EPS_INSTANT && a.finSec <= z.finSec + EPS_INSTANT);
        if (!x || x.finSec >= borne - EPS_INSTANT || sansSon(a.finSec, borne, s)) return;
        const y = s.find((z) => z.debutSec > x.finSec + EPS_INSTANT);
        if (!y) return;
        const p = y.debutSec + Math.min(r.margeSec, (y.finSec - y.debutSec) / 2);
        // Explosion courte juste après le creux (suivie d'une respiration, sans silence entre les deux) : la fin peut
        // aller jusqu'à la portée du début suivant, comme pour une pause (elle n'ajoute que du son).
        const portee = mesure && explosionApres(mesure, x.finSec, r) ? Math.max(r.toleranceSec, (b ? b.debutSec + r.toleranceSec : duree) - depart) : r.toleranceSec;
        if (p - depart > portee + EPS_INSTANT || p > duree) return;
        // Le début suivant, s'il est avant `p`, passe à `p` : ce qu'il quitte est repris par la fin (rien de retiré).
        if (b && p > b.debutSec + EPS_INSTANT) {
          if (p > b.finSec - r.dureeMinMorceauSec + EPS_INSTANT) return;
          bouger(b, "debutSec", p);
        }
        bouger(a, "finSec", p);
      }
    });
    // Coupe dans un silence mais à moins de `margeSec` du son qu'elle garde (une fin juste après le fondu d'un mot, un
    // début juste avant une attaque) : écartée de ce son, dans le même silence. On n'y ajoute que du blanc ; la coupe
    // voisine dans ce silence suit (ce qu'elle quitte est repris).
    liste.forEach((m, i) => {
      const avantM = liste[i - 1];
      const apres = liste[i + 1];
      const xf = s.find((z) => m.finSec >= z.debutSec - EPS_INSTANT && m.finSec <= z.finSec + EPS_INSTANT);
      if (xf && m.finSec < duree - 0.001) {
        const vise = Math.min(xf.debutSec + Math.min(r.margeSec, (xf.finSec - xf.debutSec) / 2), apres ? apres.finSec - r.dureeMinMorceauSec : duree);
        if (vise > m.finSec + EPS_INSTANT) {
          if (apres && vise > apres.debutSec) bouger(apres, "debutSec", vise);
          bouger(m, "finSec", vise);
        }
      }
      const xd = s.find((z) => m.debutSec >= z.debutSec - EPS_INSTANT && m.debutSec <= z.finSec + EPS_INSTANT);
      if (xd && m.debutSec > 0.001) {
        const vise = Math.max(xd.finSec - Math.min(r.margeSec, (xd.finSec - xd.debutSec) / 2), avantM ? avantM.debutSec + r.dureeMinMorceauSec : 0);
        if (vise < m.debutSec - EPS_INSTANT) {
          if (avantM && vise < avantM.finSec) bouger(avantM, "finSec", vise);
          bouger(m, "debutSec", vise);
        }
      }
    });
    // Morceau devenu trop court, collé au précédent (deux pauses voisines dans le même silence) : fusionné à lui.
    for (let i = 1; i < liste.length; i++) {
      const m = liste[i];
      if (m.finSec - m.debutSec >= r.dureeMinMorceauSec - EPS_INSTANT || Math.abs(m.debutSec - liste[i - 1].finSec) > EPS_INSTANT) continue;
      liste[i - 1].finSec = m.finSec;
      morceaux.splice(morceaux.indexOf(m), 1);
      liste.splice(i--, 1);
    }
  }
  if (!deplacees) return { plan, coupesDeplacees: 0 };

  const k = RECETTE_VOIX_IV.filtres.atempo;
  const bruts = [...motsBruts.corps, ...(motsBruts.fin ?? [])];
  const decale = (source: 0 | 1, t: number | undefined) => (t === undefined ? 0 : (instantResserre(morceaux, source, t) - instantResserre(plan.morceaux, source, t)) / k);
  const mots = plan.mots.map((mot, n) => {
    const source = n < plan.motsCorps ? 0 : 1;
    const d1 = decale(source, bruts[n]?.debutSec);
    const d2 = decale(source, bruts[n]?.finSec);
    return d1 || d2 ? { ...mot, debutSec: arrondi(mot.debutSec + d1), finSec: arrondi(mot.finSec + d2) } : mot;
  });
  const longueur = (x: PlanRaccordVoix["morceaux"]) => x.reduce((a, m) => a + (m.finSec - m.debutSec), 0);
  const total = longueur(morceaux) - longueur(plan.morceaux);
  return {
    plan: {
      ...plan,
      morceaux,
      mots,
      dureeResserreeSec: arrondi(plan.dureeResserreeSec + total),
      dureeSec: arrondi(plan.dureeSec + total / k),
      debutFonduSortieSec: arrondi(plan.debutFonduSortieSec + total / k),
      ...(plan.raccordSec !== undefined ? { raccordSec: arrondi(plan.raccordSec + (longueurAvantFin(morceaux) - longueurAvantFin(plan.morceaux)) / k) } : {}),
    },
    coupesDeplacees: deplacees,
  };
}

/** Un écart retiré par le plan (entre deux morceaux, avant le premier, après le dernier) qui contient de la parole. */
export interface ParoleRetireeIV {
  source: "corps" | "fin";
  deSec: number;
  aSec: number;
  paroleSec: number;
}

/**
 * Contrôle final (relecture #283, 2e passage) : chaque écart RETIRÉ du son brut contient moins de `paroleRetireeMaxSec`
 * de parole (4e passage : 40 ms tout juste, une voyelle de 45 à 59 ms entière, est refusé). Filet indépendant du placement : un mot perdu par le plan brut (horodatage en retard de plus que
 * la durée du mot) est refusé, jamais livré. `retraitsVoulus` (corps) : chapitres retirés exprès, non contrôlés. PUR.
 */
export function paroleRetireeIV(
  plan: Pick<PlanRaccordVoix, "morceaux">,
  mesures: { corps: MesureSonIV; fin?: MesureSonIV },
  durees: { corps: number; fin?: number },
  retraitsVoulus: readonly [number, number][] = [],
  r = REGLES_COUPES_IV,
): ParoleRetireeIV[] {
  const res: ParoleRetireeIV[] = [];
  for (const source of [0, 1] as const) {
    const mesure = source === 1 ? mesures.fin : mesures.corps;
    const duree = source === 1 ? durees.fin : durees.corps;
    const liste = plan.morceaux.filter((m) => !m.silence && m.source === source);
    if (!mesure || duree === undefined || !liste.length) continue;
    const ecarts: [number, number][] = [[0, liste[0].debutSec], ...liste.slice(1).map((m, i): [number, number] => [liste[i].finSec, m.debutSec]), [liste[liste.length - 1].finSec, duree]];
    for (const [de, a] of ecarts) {
      if (a <= de + EPS_INSTANT || (source === 0 && retraitsVoulus.some(([x, y]) => x < a && y > de))) continue;
      const p = paroleDans(mesure, de, a);
      if (p >= r.paroleRetireeMaxSec - EPS_INSTANT) res.push({ source: source === 1 ? "fin" : "corps", deSec: arrondi(de), aSec: arrondi(a), paroleSec: arrondi(p) });
    }
  }
  return res;
}

/**
 * Refus « parole retirée » : même cœur de phrase que le refus d'une coupe en plein son (`COUPE_EN_PLEIN_SON_IV`), donc
 * « Refaire cette partie » reste proposé (reprise de l'assemblage, sans lecture payante), suivi du détail des écarts.
 */
export function refusParoleRetireeIV(nom: string, liste: readonly ParoleRetireeIV[]): ErreurVoixIV {
  const h = liste[0];
  const details = liste.slice(0, DIAGNOSTICS_MAX).map((x) => `${x.source} ${sec(x.deSec)} → ${sec(x.aSec)} : ${sec(x.paroleSec)} de parole`);
  console.warn(`[image-video] parole retirée ${nom} :`, details);
  return new ErreurVoixIV(
    "coupe",
    `Voix ${nom} · la coupe à ${sec(h.aSec)} du son ${h.source === "fin" ? "de la fin" : "du corps"} ${COUPE_EN_PLEIN_SON_IV} : le son retiré avant elle contient de la parole, un mot serait perdu${liste.length > 1 ? ` (${liste.length} écarts dans ce cas)` : ""}. Détail (écart retiré : parole mesurée) : ${details.join(" ; ")}.`,
  );
}

/**
 * Deux morceaux d'une même source collés l'un à l'autre (les deux coupes d'une pause au même instant : rien n'y est
 * retiré) n'en font qu'un : la piste est la même, sans fondu à la jonction, et une jonction tombée dans le creux d'une
 * occlusive ne coupe plus le mot en deux morceaux (relecture #283, remarque 3). Les instants des mots ne changent pas.
 */
function sansJonctions(plan: PlanRaccordVoix): PlanRaccordVoix {
  const morceaux: PlanRaccordVoix["morceaux"] = [];
  for (const m of plan.morceaux) {
    const p = morceaux.at(-1);
    if (p && !p.silence && !m.silence && p.source === m.source && Math.abs(m.debutSec - p.finSec) <= EPS_INSTANT) morceaux[morceaux.length - 1] = { ...p, finSec: m.finSec };
    else morceaux.push(m);
  }
  return morceaux.length === plan.morceaux.length ? plan : { ...plan, morceaux };
}

/**
 * Plan des coupes d'une version, du plan brut au verdict (PUR) : coupes placées (`placerCoupesIV`), coupes hors silence
 * (`coupesEnPleinSon`), parole retirée (`paroleRetireeIV`). Une version n'est acceptée que si les deux listes sont vides.
 */
export function couperVoixIV(
  corps: { mots: readonly MotHorodate[]; dureeSec: number },
  fin: { mots: readonly MotHorodate[]; dureeSec: number } | undefined,
  mesures: { corps: MesureSonIV; fin?: MesureSonIV },
  retraitsVoulus: readonly [number, number][] = [],
): { plan: PlanRaccordVoix; coupesDeplacees: number; hors: CoupeEnPleinSon[]; paroleRetiree: ParoleRetireeIV[] } {
  const silences = { corps: mesures.corps.silences, ...(fin && mesures.fin ? { fin: mesures.fin.silences } : {}) };
  const durees = { corps: corps.dureeSec, ...(fin ? { fin: fin.dureeSec } : {}) };
  const brut = planRaccordVoix(corps, fin, RECETTE_VOIX_IV);
  const place = placerCoupesIV(brut, { corps: corps.mots, ...(fin ? { fin: fin.mots } : {}) }, silences, durees, REGLES_COUPES_IV, { mesures, retraitsVoulus, garderPausesSansSilence: true });
  const { coupesDeplacees } = place;
  const plan = sansJonctions(place.plan);
  const hors = coupesEnPleinSon(plan, silences, durees);
  return { plan, coupesDeplacees, hors, paroleRetiree: hors.length ? [] : paroleRetireeIV(plan, mesures, durees, retraitsVoulus) };
}

/** Mesures d'un son brut pour l'assemblage : silences, seuil et niveaux des fenêtres (pour le diagnostic). */
export interface MesureSonIV {
  silences: Silence[];
  /** Silences mesurés AVANT le masque de parole (preuve d'une fin de mot voisine pour une fusion ; jamais pour poser une coupe). */
  silencesBruts?: Silence[];
  seuilDb: number;
  niveaux: number[];
  /** Durée d'une fenêtre de `niveaux` (s) ; absente : `REGLES_SILENCES_IV.fenetreSec`. */
  fenetreSec?: number;
  /** Plancher de bruit retenu (dB). */
  plancherDb?: number;
  /** Niveau de la parole (dB) : retirer `REGLES_COUPES_IV.paroleRetireeMaxSec` ou plus au-dessus = mot perdu. */
  niveauParoleDb?: number;
  /** Fenêtres de parole voisée, parole aussi, même sous `niveauParoleDb` (mesures sans masque `paroles`). */
  voisees?: boolean[];
  /** Masque de PAROLE par fenêtre (`masqueParoleIV`) : prévaut sur `niveauParoleDb` et `voisees`. */
  paroles?: boolean[];
}

const db = (x: number) => `${x.toFixed(1).replace(".", ",").replace("-", "−")} dB`;

/**
 * Diagnostic d'une coupe fautive : niveau mesuré (fenêtre de 20 ms qui la contient), seuil du fichier, distance au
 * silence mesuré le plus proche et ses bornes. Lisible par Will sur la vraie vidéo.
 */
export function diagnosticCoupe(c: CoupeEnPleinSon, mesure: MesureSonIV, r = REGLES_SILENCES_IV): string {
  const w = Math.min(mesure.niveaux.length - 1, Math.max(0, Math.floor(c.instantSec / r.fenetreSec + EPS_INSTANT)));
  const niveau = mesure.niveaux[w];
  const proche = [...mesure.silences].sort((a, b) => ecart(c.instantSec, a) - ecart(c.instantSec, b))[0];
  const ou = proche ? `silence le plus proche à ${sec(ecart(c.instantSec, proche))} (${sec(proche.debutSec)} → ${sec(proche.finSec)})` : "aucun silence mesuré dans ce son";
  return `${c.source} ${sec(c.instantSec)} : ${niveau === undefined ? "niveau inconnu" : db(niveau)}, seuil ${db(mesure.seuilDb)}, ${ou}`;
}

const ecart = (t: number, s: Silence) => (t < s.debutSec ? s.debutSec - t : t > s.finSec ? t - s.finSec : 0);
/** Coupes fautives détaillées dans le message (les suivantes sont comptées). */
const DIAGNOSTICS_MAX = 8;

/* ------------------------------------------------------------------ */
/* Piste voix seule d'une version                                        */
/* ------------------------------------------------------------------ */

export interface PisteVoixSeuleIV {
  /** Identifiant de la version (fin du plan), suffixé « -courte » pour une version courte. */
  version: string;
  reseaux: ReseauIV[];
  courte: boolean;
  cle: string;
  dureeSec: number;
  /** Empreinte des octets de la piste : reportée dans le mixage, relue par les contrôles d'écoute. */
  empreinte: string;
  /** Mots sur l'horloge de la piste (resserrés, raccordés, ÷ tempo). */
  mots: MotHorodate[];
  /** Nombre de mots du corps (les suivants sont ceux de la fin). */
  motsCorps: number;
  /** Instant du raccord corps → fin (absent : corps seul). */
  raccordSec?: number;
  /** Fin sonore mesurée de la voix sur la piste. */
  finVoixSec: number;
  coupesDeplacees: number;
  tempo: number;
  /** Écart de forme noté sans arrêter la vidéo (fin de voix serrée, dernière phrase peut-être coupée). */
  remarque?: string;
}

interface EntreePiste {
  version: string;
  reseaux: ReseauIV[];
  courte: boolean;
  corps: SonBrutIV;
  fin?: SonBrutIV;
  /** Parties du corps retirées EXPRÈS (chapitres d'une version courte) : hors du contrôle de la parole retirée. */
  retraitsVoulus?: [number, number][];
  /**
   * Lecture unique (20/10) : le « corps » est la lecture d'un trait taillée pour cette version (corps, puis sa fin, sans
   * fin séparée). `motsCorps` : mots du script, les premiers ; `coupeSec` : coupe en bout de fichier, à poser dans un silence.
   */
  motsCorps?: number;
  coupeSec?: number;
  coupeEntreSec?: [number, number];
}

/** Sons bruts lus en WAV et leurs mesures, une seule lecture par clé. */
type CacheSons = Map<string, MesureSonIV>;

/** `plancherConnuDb` : plancher du corps de la même voix, pour une fin (fichier court, presque tout en parole). */
async function mesureDe(cle: string, nom: string, o: OutilsAssemblageIV, cache: CacheSons, plancherConnuDb?: number): Promise<MesureSonIV> {
  const k = plancherConnuDb === undefined ? cle : `${cle}|${plancherConnuDb}`;
  const deja = cache.get(k);
  if (deja) return deja;
  const m = silencesIV(exigerWav(await brutEnWav(cle, nom, o), nom), REGLES_SILENCES_IV, plancherConnuDb);
  cache.set(k, m);
  return m;
}

const silencesDe = async (cle: string, nom: string, o: OutilsAssemblageIV, cache: CacheSons) => (await mesureDe(cle, nom, o, cache)).silences;

/**
 * Contrôle de la piste produite : dernière phrase dite en entier, puis 300 ms de silence mesuré. Un écart est une
 * REMARQUE (la vidéo continue, Q19 est relu à l'écoute) ; seule une piste sans aucun mot (voix absente) arrête.
 */
function controlerPiste(son: Son, mots: readonly MotHorodate[], nom: string): { finSonoreSec: number; remarque?: string } {
  const dernier = mots.at(-1);
  if (!dernier) throw new ErreurVoixIV("Q19", `La piste voix seule ${nom} n'a aucun mot : la fin ne peut pas être contrôlée.`);
  const verdict = controlerFinDeVoix(son, dernier.finSec, REGLES_FIN_DE_VOIX_IV);
  if (!verdict.ok) return { finSonoreSec: dernier.finSec, remarque: `Piste voix seule ${nom} · ${verdict.raison}` };
  const duree = son.echantillons.length / son.frequence;
  const final = silencesMesures(son).at(-1);
  const silenceApres = final && final.finSec >= duree - REGLES_FIN_DE_VOIX.fenetreSec - EPS_INSTANT ? final.finSec - Math.max(final.debutSec, dernier.finSec) : 0;
  if (silenceApres < SILENCE_FIN_MIN_SEC - EPS_INSTANT) {
    return { finSonoreSec: verdict.finSonoreSec, remarque: `Piste voix seule ${nom} · après le dernier mot (« ${dernier.mot} »), le silence mesuré dure ${sec(Math.max(0, silenceApres))} (300 ms au moins) : la dernière phrase risque d'être coupée.` };
  }
  return { finSonoreSec: verdict.finSonoreSec };
}

/**
 * Lecture unique : une phrase sautée exige un silence mesuré (0,1 s au moins) juste avant et juste après elle, sinon
 * refus. Les horodatages de HeyGen peuvent être en avance ou en retard de `decalageMotsMaxSec` : la recherche du silence
 * s'élargit de cette erreur ; seul compte un silence qui touche l'écart horodaté (jamais un creux à l'intérieur d'un mot
 * gardé). `mots` ne contient que les mots gardés. PUR.
 */
export function phrasesSauteesSansSilenceIV(mots: readonly MotHorodate[], silences: readonly Silence[], retraitsVoulus: readonly [number, number][]): CoupeEnPleinSon[] {
  const hors: CoupeEnPleinSon[] = [];
  const marge = REGLES_COUPES_IV.decalageMotsMaxSec;
  for (const [de, a] of retraitsVoulus) {
    const avant = [...mots].reverse().find((m) => m.finSec <= de + EPS_INSTANT);
    const apres = mots.find((m) => m.debutSec >= a - EPS_INSTANT);
    const blanc = (lo: number, hi: number, garde: (x: Silence) => boolean) => Math.max(0, ...silences.filter((x) => garde(x) && x.debutSec <= hi + EPS_INSTANT && x.finSec >= lo - EPS_INSTANT).map((x) => Math.min(x.finSec, hi) - Math.max(x.debutSec, lo)));
    // Les mots sautés ne sont pas dans `mots` (seuls les mots gardés y sont) : côté « avant » la fenêtre reste dans la phrase
    // retirée (jusqu'à `a`), côté « après » dans le mot gardé suivant au plus de l'erreur d'horodatage. Seul un silence qui
    // touche l'écart horodaté compte (pas un creux à l'intérieur du mot gardé ni de la phrase sautée).
    for (const [lo, hi, ou, garde] of [
      [avant?.finSec ?? de, Math.min(a, de + marge), "avant", (x: Silence) => x.debutSec <= de + EPS_INSTANT],
      [Math.max(de, a - marge), Math.max(a, Math.min((apres?.debutSec ?? a) + marge, apres?.finSec ?? a)), "après", (x: Silence) => x.finSec >= a - EPS_INSTANT && x.debutSec <= (apres?.debutSec ?? a) + EPS_INSTANT],
    ] as const) {
      if (blanc(lo, hi, garde) < SILENCE_PHRASE_SAUTEE_MIN_SEC - EPS_INSTANT) {
        hors.push({ source: "corps", instantSec: ou === "avant" ? de : a });
        break;
      }
    }
  }
  return hors;
}

async function assemblerPiste(e: EntreePiste, o: OutilsAssemblageIV, cache: CacheSons): Promise<PisteVoixSeuleIV> {
  const nom = `(${e.reseaux.join(", ") || e.version}${e.courte ? ", version courte" : ""})`;
  const corps = await mesureDe(e.corps.fichierCle, `brut du corps ${nom}`, o, cache);
  const mesures = { corps, ...(e.fin ? { fin: await mesureDe(e.fin.fichierCle, `brut de la fin ${nom}`, o, cache, corps.plancherDb) } : {}) };
  // Lecture unique : la coupe en bout de fichier se pose dans un silence mesuré entre le dernier mot gardé et le premier
  // mot retiré (marge comprise), sinon refus : jamais un mot abîmé.
  let corpsCoupe = e.corps;
  const horsLecture: CoupeEnPleinSon[] = [];
  if (e.coupeSec !== undefined) {
    const [lo, hi] = e.coupeEntreSec ?? [e.coupeSec, e.coupeSec];
    const p = pointDansUnSilence(e.coupeSec, lo, hi, mesures.corps.silences, REGLES_COUPES_IV.margeSec);
    if (p === null) horsLecture.push({ source: "corps", instantSec: e.coupeSec });
    else corpsCoupe = { ...e.corps, dureeSec: arrondi(Math.max(p, lo)) };
  }
  // Lecture unique : une phrase sautée exige un silence mesuré (0,1 s au moins) juste avant et juste après elle, sinon
  // refus : les protections de parole retirée ne regardent pas un écart voulu.
  if (e.motsCorps !== undefined) horsLecture.push(...phrasesSauteesSansSilenceIV(e.corps.mots, mesures.corps.silences, e.retraitsVoulus ?? []));
  const coupe = couperVoixIV(corpsCoupe, e.fin, mesures, e.retraitsVoulus);
  const { plan, coupesDeplacees, paroleRetiree } = coupe;
  const hors = [...horsLecture, ...coupe.hors];
  if (hors.length) {
    const h = hors[0];
    const details = hors.slice(0, DIAGNOSTICS_MAX).map((c) => diagnosticCoupe(c, c.source === "fin" ? mesures.fin! : mesures.corps));
    const reste = hors.length > DIAGNOSTICS_MAX ? ` ; et ${hors.length - DIAGNOSTICS_MAX} autres` : "";
    console.warn(`[image-video] coupes en plein son ${nom} :`, details);
    throw new ErreurVoixIV(
      "coupe",
      `Voix ${nom} · la coupe à ${sec(h.instantSec)} du son ${h.source === "fin" ? "de la fin" : "du corps"} ${COUPE_EN_PLEIN_SON_IV}${hors.length > 1 ? ` (${hors.length} coupes dans ce cas)` : ""} : la voix n'est jamais coupée ailleurs que dans un silence. Détail (coupe : niveau, seuil, silence le plus proche ; recherche à ±${sec(REGLES_COUPES_IV.toleranceSec)}) : ${details.join(" ; ")}${reste}.`,
    );
  }
  if (paroleRetiree.length) throw refusParoleRetireeIV(nom, paroleRetiree);
  const morceaux = plan.morceaux.filter((m) => !m.silence).map((m) => ({ entree: m.source === 1 ? e.fin!.fichierCle : e.corps.fichierCle, deSec: m.debutSec, aSec: m.finSec }));
  const id = `iv-voix-${createHash("sha256").update(JSON.stringify([VERSION_ASSEMBLAGE, e.corps.fichierCle, e.fin?.fichierCle ?? null, plan.morceaux, plan.dureeSec])).digest("hex").slice(0, 24)}`;
  const fait = await o.traiterVoix({
    id,
    morceaux,
    tempo: TEMPO_IV,
    recette: { corps: e.corps.fichierCle, ...(e.fin ? { fin: e.fin.fichierCle } : {}), parametres: parametresRaccord(plan, RECETTE_VOIX_IV), dureeSec: plan.dureeSec },
  });
  const octets = await o.lireSon(fait.cle);
  const son = exigerWav(octets, `de la piste voix seule ${nom}`);
  const { finSonoreSec: finVoixSec, remarque } = controlerPiste(son, plan.mots, nom);
  return {
    version: e.courte ? `${e.version}-courte` : e.version,
    reseaux: [...e.reseaux],
    courte: e.courte,
    cle: fait.cle,
    dureeSec: arrondi(son.echantillons.length / son.frequence),
    empreinte: empreinteSon(octets!),
    mots: plan.mots,
    // Lecture unique : les premiers mots sont ceux du script, les suivants ceux de la fin (aucun blanc de raccord).
    motsCorps: e.motsCorps ?? plan.motsCorps,
    ...(plan.raccordSec !== undefined ? { raccordSec: plan.raccordSec } : e.motsCorps !== undefined && plan.mots.length > e.motsCorps ? { raccordSec: plan.mots[e.motsCorps].debutSec } : {}),
    finVoixSec,
    coupesDeplacees,
    tempo: TEMPO_IV,
    ...(remarque ? { remarque } : {}),
  };
}

/**
 * Piste voix seule de CHAQUE version (une par fin du plan, LinkedIn = corps seul), toutes taillées dans les mêmes sons
 * bruts : aucune lecture de voix ici. Le premier refus arrête tout (phrase pour Will dans l'erreur).
 */
export async function assemblerVersionsIV(etat: EtatVoixIV, o: OutilsAssemblageIV): Promise<PisteVoixSeuleIV[]> {
  const sons = sonsBrutsIV(etat);
  const cache: CacheSons = new Map();
  const res: PisteVoixSeuleIV[] = [];
  for (const v of etat.segments.versions) res.push(await assemblerPiste(entreeDe(v, sons), o, cache));
  return res;
}

function entreeDe(v: VersionVoixIV, sons: ReturnType<typeof sonsBrutsIV>): EntreePiste {
  if (sons.lecture) {
    // Lecture unique : un seul son pour la version, taillé par heures de mots (aucune fin séparée).
    const l = sons.lecture[v.id];
    if (!l) throw new ErreurVoixIV("entree", `Le son de la version ${v.id} manque.`);
    return { version: v.id, reseaux: v.reseaux, courte: false, corps: l.son, motsCorps: l.motsCorps, ...(l.retraitsVoulus.length ? { retraitsVoulus: l.retraitsVoulus } : {}), ...(l.coupeSec !== undefined ? { coupeSec: l.coupeSec, ...(l.coupeEntreSec ? { coupeEntreSec: l.coupeEntreSec } : {}) } : {}) };
  }
  const fin = v.segment ? sons.fins[v.segment] : undefined;
  if (v.segment && !fin) throw new ErreurVoixIV("entree", `Le son de la fin ${v.segment} manque.`);
  return { version: v.id, reseaux: v.reseaux, courte: false, corps: sons.corps, ...(fin ? { fin } : {}) };
}

/* ------------------------------------------------------------------ */
/* Version courte                                                        */
/* ------------------------------------------------------------------ */

const FIN_DE_PHRASE = /[.!?…]["»”)\s]*$/u;

/** Plus long silence mesuré qui touche l'écart entre deux mots (0 : aucun). */
function silenceDeLaBorne(avant: MotHorodate, apres: MotHorodate, s: readonly Silence[]): number {
  return Math.max(0, ...s.filter((x) => x.debutSec <= apres.debutSec + EPS_INSTANT && x.finSec >= avant.finSec - EPS_INSTANT).map((x) => x.finSec - x.debutSec));
}

export interface VersionCourteIV {
  piste: PisteVoixSeuleIV;
  /** Fiche de la version courte (chapitres retirés, repères renumérotés « 1/2 », « 2/2 »). */
  fiche: FicheImage;
  /** Titres des chapitres retirés (la carte de livraison les dit). */
  retires: string[];
  /** Rangs, dans les mots du corps, des mots gardés. */
  motsGardes: number[];
}

/**
 * Version courte d'une version : les `retirer` derniers chapitres non essentiels ôtés de la MÊME voix brute (aucune
 * lecture nouvelle). Refus (Q11 bis) si aucun chapitre n'est détachable, si un chapitre retiré ne commence ou ne finit
 * pas sur une phrase complète, ou si une borne ne tombe pas dans un silence mesuré d'au moins 300 ms.
 */
export async function assemblerVersionCourteIV(
  e: { etat: EtatVoixIV; fiche: FicheImage; version: string; retirer: number },
  o: OutilsAssemblageIV,
): Promise<VersionCourteIV> {
  const v = e.etat.segments.versions.find((x) => x.id === e.version);
  if (!v) throw new ErreurVoixIV("entree", `La version ${e.version} n'existe pas.`);
  const nom = v.reseaux.join(", ");
  let courte: FicheImage;
  try {
    courte = ficheSansChapitres(e.fiche, e.retirer);
  } catch (err) {
    console.warn(`[image-video] version courte impossible (${nom}) :`, err);
    throw new ErreurVoixIV("Q11bis", `Pas de version courte pour ${nom} : pas assez de chapitres à retirer.`);
  }
  const sons = sonsBrutsIV(e.etat);
  const entree = entreeDe(v, sons);
  // Lecture unique : le son de la version porte le corps PUIS sa fin ; seuls les premiers mots sont ceux du script.
  const lu = entree.motsCorps !== undefined;
  const mots = lu ? entree.corps.mots.slice(0, entree.motsCorps) : entree.corps.mots;
  const motsFin = lu ? entree.corps.mots.slice(entree.motsCorps) : [];

  // Rang du premier mot de chaque écran dans les mots lus du corps.
  const comptes = e.fiche.ecrans.map((x) => motsDits(x.texteDit).length);
  const total = comptes.reduce((a, b) => a + b, 0);
  if (total !== mots.length) throw new ErreurVoixIV("entree", `Les mots de la voix du corps (${mots.length}) ne correspondent pas au script (${total}) : la version courte ne peut pas être taillée.`);
  const gardes = new Set(courte.ecrans.map((x) => x.id));
  const motsGardes: number[] = [];
  let rang = 0;
  e.fiche.ecrans.forEach((x, i) => {
    for (let k = 0; k < comptes[i]; k++, rang++) if (gardes.has(x.id)) motsGardes.push(rang);
  });

  const silences = await silencesDe(entree.corps.fichierCle, `brut du corps (${nom}, version courte)`, o, new Map());
  const retires = chapitresDetachables(e.fiche).slice(0, e.retirer);
  const retraitsVoulus: [number, number][] = [];
  // Bornes de chaque bloc d'écrans retirés.
  for (let i = 0; i < e.fiche.ecrans.length; i++) {
    if (gardes.has(e.fiche.ecrans[i].id) || (i > 0 && !gardes.has(e.fiche.ecrans[i - 1].id))) continue;
    let j = i;
    while (j < e.fiche.ecrans.length && !gardes.has(e.fiche.ecrans[j].id)) j++;
    const chapitre = retires.find((c) => c.ecrans.includes(e.fiche.ecrans[i].id))?.titre ?? e.fiche.ecrans[i].id;
    if (i === 0 || j === e.fiche.ecrans.length) throw new ErreurVoixIV("Q11bis", `Pas de version courte pour ${nom} : le chapitre « ${chapitre} » ouvre ou ferme la vidéo.`);
    if (!FIN_DE_PHRASE.test(e.fiche.ecrans[i - 1].texteDit) || !FIN_DE_PHRASE.test(e.fiche.ecrans[j - 1].texteDit)) {
      throw new ErreurVoixIV("Q11bis", `Pas de version courte pour ${nom} : le chapitre « ${chapitre} » ne commence ou ne finit pas sur une phrase complète.`);
    }
    const premier = comptes.slice(0, i).reduce((a, b) => a + b, 0);
    const apresDernier = comptes.slice(0, j).reduce((a, b) => a + b, 0);
    if (apresDernier > premier) retraitsVoulus.push([mots[premier].debutSec, mots[apresDernier - 1].finSec]);
    for (const [avant, apres, ou] of [
      [mots[premier - 1], mots[premier], "avant"],
      [mots[apresDernier - 1], mots[apresDernier], "après"],
    ] as const) {
      const s = silenceDeLaBorne(avant, apres, silences);
      if (s < SILENCE_BORNE_MIN_SEC - EPS_INSTANT) {
        throw new ErreurVoixIV("Q11bis", `Pas de version courte pour ${nom} : la coupe ${ou} le chapitre « ${chapitre} » (vers ${sec(avant.finSec)}) ne tombe pas dans un silence mesuré d'au moins 300 ms (${s ? `le plus long fait ${sec(s)}` : "aucun silence mesuré"}).`);
      }
    }
  }

  const corps: SonBrutIV = { ...entree.corps, mots: [...motsGardes.map((k) => mots[k]), ...motsFin] };
  const piste = await assemblerPiste(
    { ...entree, courte: true, corps, retraitsVoulus: [...retraitsVoulus, ...(entree.retraitsVoulus ?? [])], ...(lu ? { motsCorps: motsGardes.length } : {}) },
    o,
    new Map(),
  );
  return { piste, fiche: courte, retires: retires.map((c) => c.titre), motsGardes };
}

/* ------------------------------------------------------------------ */
/* Mixage                                                                */
/* ------------------------------------------------------------------ */

/** Demande de mixage d'une version : la piste voix seule (par son empreinte) et les bruitages. Jamais de musique. */
export interface DemandeMixageIV {
  id: string;
  version: string;
  voix: { cle: string; empreinte: string; dureeSec: number };
  bruitages: BruitagePlace[];
  dureeSec: number;
  loudnessLufs: typeof LOUDNESS_IV_LUFS;
  creteDbtp: typeof CRETE_IV_DBTP;
  musique: null;
}

const DECLENCHEURS_CONNUS: ReadonlySet<string> = new Set(Object.values(DECLENCHEUR_IV));

/**
 * Plan du mixage (PUR) : voix seule + bruitages, −14 LUFS. Un son qui n'est pas un bruitage connu (une musique, par
 * exemple) est refusé ; la vidéo doit contenir toute la voix.
 */
export function planMixageIV(piste: PisteVoixSeuleIV, bruitages: readonly BruitagePlace[], dureeVideoSec: number): DemandeMixageIV {
  const intrus = bruitages.find((b) => !DECLENCHEURS_CONNUS.has(b.declencheur));
  if (intrus) throw new ErreurVoixIV("musique", `Le son « ${intrus.elementId} » n'est pas un bruitage validé : ce format n'a jamais de musique.`);
  if (dureeVideoSec + EPS_INSTANT < piste.finVoixSec) throw new ErreurVoixIV("entree", `La vidéo (${sec(dureeVideoSec)}) est plus courte que la voix (${sec(piste.finVoixSec)}) : la dernière phrase serait coupée.`);
  const tries = [...bruitages].sort((a, b) => a.debutSec - b.debutSec || a.elementId.localeCompare(b.elementId));
  const id = `iv-mix-${createHash("sha256").update(JSON.stringify([piste.version, piste.empreinte, tries, dureeVideoSec])).digest("hex").slice(0, 24)}`;
  return {
    id,
    version: piste.version,
    voix: { cle: piste.cle, empreinte: piste.empreinte, dureeSec: piste.dureeSec },
    bruitages: tries,
    dureeSec: dureeVideoSec,
    loudnessLufs: LOUDNESS_IV_LUFS,
    creteDbtp: CRETE_IV_DBTP,
    musique: null,
  };
}
