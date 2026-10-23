/**
 * Opération `mixage` (lot R5, 03/10 ; file longue) : le son d'une voix prêt à publier (préparation du podcast), par la
 * MÊME chaîne que le montage (`son/chaine.ts` : passe-haut, compression seulement si utile, de-esser, présence, gain
 * mesuré vers la cible, limiteur, ton de pièce sous la voix), puis, s'il y en a une, une musique qui S'EFFACE sous la
 * voix, et enfin le niveau final remesuré : −14 LUFS (± 0,5), crête vraie ≤ −1,5 dBTP.
 * Entrées : `voix` (obligatoire), `musique` (facultative), `ton-piece` (facultatif), `bruitage-N` (facultatifs).
 * Paramètres : `lufs` (−14), `creteVraieMaxDbtp` (−1,5), `baisseSousVoixDb` (12 : la musique baisse d'autant quand
 * la voix parle), `musiqueDb` (−24 : niveau de la musique seule, sous la voix), `dureeSec` (sinon celle de la voix),
 * `bruitages` [{ entree, debutSec, gainDb, passeHautHz }].
 * Sortie : WAV stéréo 48 kHz 24 bits (voix centrée). Mesures : lufs, creteVraieDbtp, lra, dureeSec.
 */
import { open } from "node:fs/promises";
import { join } from "node:path";
import { FREQUENCE } from "../audio/pcm.js";
import { ErreurRendu, type Operation } from "../contrat.js";
import { deposer, dureeMedia, executerAvecErreurs, FFMPEG, FORMATS_AUDIO, formatFichier, lectureLocale, telecharger } from "../outils.js";
import { mesurerFichier, PAN_VOIX_STEREO, preparerSon } from "../son/chaine.js";

/**
 * Durée la plus longue acceptée : 10 MINUTES (relecture sécurité R45 n° 7). Plafond STRICT de mémoire, volontaire :
 * la chaîne de la voix (`preparerSon`, partagée avec le montage et la démonstration M4) garde la voix pleine durée en
 * mémoire (≈ 5 pistes mono flottantes : ≈ 0,6 Go à 10 min, dans un conteneur de 3 Go qui fait aussi les montages).
 * La musique, elle, est mélangée PAR BLOCS (`melangerParBlocs`, quelques Mo). Le mixage n'est branché sur aucun écran
 * (`son.ts`) : avant d'accepter un podcast plus long, la chaîne de la voix devra passer en flux elle aussi.
 */
export const DUREE_MAX_SEC = 10 * 60;
/** Plafonds de téléchargement (relecture sécurité R45 n° 7) : jamais une entrée sans borne. */
export const OCTETS_MAX_VOIX = 400 * 1024 * 1024;
export const OCTETS_MAX_MUSIQUE = 400 * 1024 * 1024;
export const OCTETS_MAX_TON = 50 * 1024 * 1024;
export const OCTETS_MAX_BRUITAGE = 20 * 1024 * 1024;
export const BRUITAGES_MAX = 20;
/** Écarts tolérés sur le fichier rendu (jamais un son livré hors cible). */
export const TOLERANCE_LUFS = 0.5;

export interface ReglagesMixage {
  lufs: number;
  creteVraieMaxDbtp: number;
  baisseSousVoixDb: number;
  musiqueDb: number;
}

/** Réglages bornés (valeurs absurdes ramenées dans des limites sûres). PUR. */
export function reglagesMixage(p: Record<string, unknown>): ReglagesMixage {
  const nombre = (v: unknown, defaut: number, min: number, max: number) => {
    const n = Number(v ?? defaut);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : defaut;
  };
  return {
    lufs: nombre(p.lufs, -14, -30, -9),
    creteVraieMaxDbtp: nombre(p.creteVraieMaxDbtp, -1.5, -6, -1),
    baisseSousVoixDb: nombre(p.baisseSousVoixDb, 12, 0, 30),
    musiqueDb: nombre(p.musiqueDb, -24, -40, -10),
  };
}

/** Fenêtre d'analyse de la voix, maintien après le dernier mot, montée et descente du gain de la musique. */
export const EFFACEMENT = { fenetreSec: 0.01, seuilDb: -38, maintienSec: 0.25, descenteSec: 0.04, remonteeSec: 0.45 } as const;

/**
 * Gain (linéaire, un par échantillon) qui EFFACE la musique sous la voix : la voix parle (niveau d'une fenêtre de 10 ms
 * au-dessus de −38 dBFS, maintenu 250 ms pour ne pas « pomper » entre deux mots) → la musique descend de
 * `baisseDb` en 40 ms ; elle remonte en 450 ms quand la voix se tait. Calcul PAR BLOCS (l'état passe d'un bloc au
 * suivant) : chaque bloc, sauf le dernier, doit compter un nombre entier de fenêtres (`pas`). PUR, testé.
 */
export class EffaceurMusique {
  readonly pas: number;
  private readonly maintien: number;
  private readonly parFenetreDescente: number;
  private readonly parFenetreRemontee: number;
  private attenuationDb = 0;
  private restant = 0;

  constructor(
    private readonly baisseDb: number,
    frequence = FREQUENCE,
  ) {
    this.pas = Math.max(1, Math.round(EFFACEMENT.fenetreSec * frequence));
    this.maintien = Math.round(EFFACEMENT.maintienSec / EFFACEMENT.fenetreSec);
    this.parFenetreDescente = baisseDb / Math.max(1, EFFACEMENT.descenteSec / EFFACEMENT.fenetreSec);
    this.parFenetreRemontee = baisseDb / Math.max(1, EFFACEMENT.remonteeSec / EFFACEMENT.fenetreSec);
  }

  /** Gains du bloc de voix donné (même longueur). */
  traiter(voix: Float32Array): Float32Array {
    const n = voix.length;
    const gains = new Float32Array(n).fill(1);
    if (this.baisseDb <= 0 || !n) return gains;
    for (let debut = 0; debut < n; debut += this.pas) {
      const fin = Math.min(n, debut + this.pas);
      let s = 0;
      for (let i = debut; i < fin; i++) s += voix[i] * voix[i];
      const niveau = 10 * Math.log10(s / (fin - debut) + 1e-12);
      this.restant = niveau > EFFACEMENT.seuilDb ? this.maintien : Math.max(0, this.restant - 1);
      const vise = this.restant > 0 ? this.baisseDb : 0;
      this.attenuationDb = vise > this.attenuationDb ? Math.min(vise, this.attenuationDb + this.parFenetreDescente) : Math.max(vise, this.attenuationDb - this.parFenetreRemontee);
      const g = Math.pow(10, -this.attenuationDb / 20);
      for (let i = debut; i < fin; i++) gains[i] = g;
    }
    return gains;
  }
}

/** Gains d'une voix entière (un seul bloc). PUR, testé. */
export function gainsEffacement(voix: Float32Array, baisseDb: number, frequence = FREQUENCE): Float32Array {
  return new EffaceurMusique(baisseDb, frequence).traiter(voix);
}

/** Échantillons mono par bloc du mélange (2 000 fenêtres de 10 ms = 20 s ; ≈ 15 Mo en tout en mémoire). */
export const ECHANTILLONS_PAR_BLOC = 2000 * Math.round(EFFACEMENT.fenetreSec * FREQUENCE);

/**
 * Mélange voix (PCM f32 mono brut) + musique (PCM f32 stéréo brut, déjà à son niveau) → PCM f32 stéréo brut, PAR BLOCS :
 * jamais une piste entière en mémoire (relecture sécurité R45 n° 7). Musique plus courte : silence ensuite.
 */
export async function melangerParBlocs(voixF32: string, musiqueF32: string, sortieF32: string, baisseDb: number, parBloc = ECHANTILLONS_PAR_BLOC): Promise<void> {
  const effaceur = new EffaceurMusique(baisseDb);
  const taille = Math.max(effaceur.pas, Math.floor(parBloc / effaceur.pas) * effaceur.pas);
  const voix = await open(voixF32, "r");
  const musique = await open(musiqueF32, "r");
  const sortie = await open(sortieF32, "w");
  try {
    const bv = Buffer.alloc(taille * 4);
    const bm = Buffer.alloc(taille * 8);
    const bs = Buffer.alloc(taille * 8);
    for (let position = 0; ; position += taille) {
      const { bytesRead: lusV } = await voix.read(bv, 0, bv.length, position * 4);
      const n = Math.floor(lusV / 4);
      if (!n) break;
      bm.fill(0);
      await musique.read(bm, 0, n * 8, position * 8);
      const v = new Float32Array(bv.buffer, bv.byteOffset, n);
      const m = new Float32Array(bm.buffer, bm.byteOffset, n * 2);
      const s = new Float32Array(bs.buffer, bs.byteOffset, n * 2);
      const gains = effaceur.traiter(v);
      for (let i = 0; i < n; i++) {
        const x = v[i] * Math.SQRT1_2; // voix centrée, même équilibre que `PAN_VOIX_STEREO`
        s[2 * i] = x + m[2 * i] * gains[i];
        s[2 * i + 1] = x + m[2 * i + 1] * gains[i];
      }
      await sortie.write(bs, 0, n * 8);
    }
  } finally {
    await Promise.all([voix.close(), musique.close(), sortie.close()]);
  }
}

/**
 * Entrée téléchargée → WAV flottant que NOUS écrivons (relecture sécurité R45 n° 6) : format reconnu à ses premiers
 * octets puis imposé, fichier local seulement, durée coupée au plafond. Toute la suite ne lit que ce WAV.
 */
async function assainirAudio(brut: string, sortie: string, signal: AbortSignal): Promise<string> {
  const format = await formatFichier(brut, FORMATS_AUDIO);
  try {
    await executerAvecErreurs(FFMPEG, ["-hide_banner", "-v", "error", "-y", ...lectureLocale(format), "-i", brut, "-map", "0:a:0", "-vn", "-t", String(DUREE_MAX_SEC + 1), "-c:a", "pcm_f32le", "-f", "wav", sortie], signal);
  } catch {
    throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Son illisible." });
  }
  return sortie;
}

/**
 * Limiteur du son STÉRÉO final (PCM, sans encodage derrière) : plafond d'échantillon à la crête visée moins 0,8 dB,
 * marge pour la crête VRAIE (suréchantillonnée) entre deux échantillons. PUR.
 */
export function limiteurStereo(creteVraieMaxDbtp: number): string {
  const plafond = Math.pow(10, (creteVraieMaxDbtp - 0.8) / 20);
  return `alimiter=limit=${plafond.toFixed(4)}:attack=4:release=60:level=false`;
}

const DUREE_INVALIDE = "Durée du son invalide (10 minutes au plus).";

/** Durée demandée : un nombre fini positif (non donné : null, celle de la voix). Le plafond de 4 h est vérifié ensuite, une seule fois, quelle que soit la source. PUR. */
export function dureeDemandee(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw new ErreurRendu({ code: "refuse", reessayable: false, message: DUREE_INVALIDE });
  return n;
}

export const mixage: Operation = async (demande, contexte) => {
  if (!demande.entrees.voix) throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Entrée « voix » manquante." });
  const p = demande.parametres;
  const r = reglagesMixage(p);
  const d = contexte.dossier;
  const dureeVoulue = dureeDemandee(p.dureeSec);
  if (dureeVoulue !== null && dureeVoulue > DUREE_MAX_SEC) throw new ErreurRendu({ code: "refuse", reessayable: false, message: DUREE_INVALIDE });
  // Chaque entrée : téléchargée sous plafond, puis réécrite en WAV par nous (format imposé, fichier local seulement).
  const entree = async (url: string, nom: string, maxOctets: number) => {
    await telecharger(url, join(d, `${nom}-brut`), contexte.signal, maxOctets);
    return assainirAudio(join(d, `${nom}-brut`), join(d, `${nom}.wav`), contexte.signal);
  };
  const voix = await entree(demande.entrees.voix, "voix-brute", OCTETS_MAX_VOIX);
  const dureeSec = dureeVoulue ?? (await dureeMedia(voix, contexte.signal));
  if (dureeSec > DUREE_MAX_SEC) throw new ErreurRendu({ code: "refuse", reessayable: false, message: DUREE_INVALIDE });
  const tonPiece = demande.entrees["ton-piece"] ? await entree(demande.entrees["ton-piece"], "ton-piece", OCTETS_MAX_TON) : undefined;
  const bruitages: { chemin: string; debutSec: number; gainDb: number; passeHautHz: number }[] = [];
  const demandes = Array.isArray(p.bruitages) ? (p.bruitages as { entree?: string; debutSec?: number; gainDb?: number; passeHautHz?: number }[]) : [];
  if (demandes.length > BRUITAGES_MAX) throw new ErreurRendu({ code: "refuse", reessayable: false, message: `Trop de bruitages (${BRUITAGES_MAX} au plus).` });
  for (const [i, b] of demandes.entries()) {
    const url = b.entree ? demande.entrees[b.entree] : undefined;
    if (!url) continue;
    const chemin = await entree(url, `bruitage-${i}`, OCTETS_MAX_BRUITAGE);
    bruitages.push({ chemin, debutSec: Number(b.debutSec) || 0, gainDb: Number(b.gainDb) || 0, passeHautHz: Number(b.passeHautHz) || 120 });
  }
  contexte.progression(15);

  // 1. La voix : même chaîne que le montage (WAV mono flottant à la cible, ton de pièce compris).
  const son = await preparerSon({
    voix,
    tonPiece,
    dureeSec,
    dossier: d,
    passeHautHz: Number(p.passeHautHz) || 80,
    seuilLraCompression: Number(p.seuilLraCompression) || 3,
    ratioCompression: Number(p.ratioCompression) || 3,
    lufs: r.lufs,
    creteVraieMaxDbtp: r.creteVraieMaxDbtp,
    tonPieceDb: Number(p.tonPieceDb) || -45,
    graine: Number(p.graine) || 7,
    signal: contexte.signal,
    ...(bruitages.length ? { bruitages } : {}),
  });
  contexte.progression(60);

  // 2. La musique sous la voix (facultative) : elle s'efface quand la voix parle (`EffaceurMusique`). Voix et musique
  //    sont décodées sur le disque puis mélangées PAR BLOCS : jamais une piste entière en mémoire.
  const mix = join(d, "mix.wav");
  let entreeMix = ["-i", mix];
  if (demande.entrees.musique) {
    const musique = await entree(demande.entrees.musique, "musique", OCTETS_MAX_MUSIQUE);
    const voixF32 = join(d, "voix.f32");
    const musiqueF32 = join(d, "musique.f32");
    await executerAvecErreurs(FFMPEG, ["-hide_banner", "-v", "error", "-y", "-i", son.chemin, "-f", "f32le", "-ac", "1", "-ar", String(FREQUENCE), voixF32], contexte.signal);
    try {
      await executerAvecErreurs(FFMPEG, ["-hide_banner", "-v", "error", "-y", "-stream_loop", "-1", "-i", musique, "-t", dureeSec.toFixed(3), "-af", `volume=${r.musiqueDb.toFixed(1)}dB`, "-f", "f32le", "-ac", "2", "-ar", String(FREQUENCE), musiqueF32], contexte.signal);
    } catch {
      throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Musique illisible." });
    }
    const brut = join(d, "mix.f32");
    await melangerParBlocs(voixF32, musiqueF32, brut, r.baisseSousVoixDb);
    entreeMix = ["-f", "f32le", "-ar", String(FREQUENCE), "-ac", "2", "-i", brut];
  } else {
    await executerAvecErreurs(FFMPEG, ["-hide_banner", "-v", "error", "-y", "-i", son.chemin, "-af", PAN_VOIX_STEREO, "-c:a", "pcm_f32le", "-ar", String(FREQUENCE), mix], contexte.signal);
  }

  // 3. Le niveau final remesuré sur le fichier rendu (3 passes au plus), toujours depuis le mélange d'origine :
  //    le gain se corrige, il ne s'empile pas. Hors cible après 3 passes : refus (jamais un son livré hors cible).
  const sortie = join(d, "son-mixe.wav");
  const rendre = async (gain: number) => {
    await executerAvecErreurs(FFMPEG, ["-hide_banner", "-v", "error", "-y", ...entreeMix, "-af", [`volume=${gain.toFixed(2)}dB`, limiteurStereo(r.creteVraieMaxDbtp)].join(","), "-c:a", "pcm_s24le", "-ar", String(FREQUENCE), "-ac", "2", sortie], contexte.signal);
    return mesurerFichier(sortie, [], contexte.signal);
  };
  let gainDb = 0;
  let mesure = await rendre(0);
  const dansLaCible = () => Math.abs(mesure.lufs - r.lufs) <= TOLERANCE_LUFS && mesure.creteVraieDbtp <= r.creteVraieMaxDbtp;
  for (let passe = 0; passe < 3 && !(Math.abs(mesure.lufs - r.lufs) <= 0.3 && mesure.creteVraieDbtp <= r.creteVraieMaxDbtp); passe++) {
    gainDb += r.lufs - mesure.lufs;
    mesure = await rendre(gainDb);
  }
  if (!dansLaCible()) {
    // Phrase simple (elle peut remonter jusqu'à l'écran) ; les mesures restent dans le journal du serveur.
    console.error(`[studio-rendu] mixage hors cible : ${mesure.lufs.toFixed(1)} / ${mesure.creteVraieDbtp.toFixed(1)} (visé ${r.lufs} ± ${TOLERANCE_LUFS}, crête ≤ ${r.creteVraieMaxDbtp})`);
    throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Le son n'atteint pas le niveau voulu sans saturer : il n'est pas livré." });
  }
  contexte.progression(90);
  await deposer(demande.sortie.urlDepot, sortie, "audio/wav", contexte.signal);
  return { mesures: { lufs: mesure.lufs, creteVraieDbtp: mesure.creteVraieDbtp, lra: mesure.lra, dureeSec: +dureeSec.toFixed(3), compression: son.compression ? 1 : 0, musique: demande.entrees.musique ? 1 : 0 } };
};
