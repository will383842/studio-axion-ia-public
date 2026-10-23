/**
 * Opération `nettoyage-audio` (file courte, lot M1, plan B.4). Le studio CALCULE (`src/moteurs/montage-avocat/
 * nettoyage.ts`) ; cette opération mesure et applique, rien d'autre. Deux temps, deux demandes :
 *
 *  - `parametres.mode = "analyse"` : reconnaît les respirations dans les blancs reçus (`parametres.blancs`) et les
 *    renvoie dans les mesures (`respiration.<i>.debut` / `.fin`, en secondes), plus `dureeSec`. Le rapport JSON est
 *    déposé à la sortie.
 *  - `parametres.mode = "appliquer"` : retire les morceaux reçus (`parametres.coupures`, en secondes), chaque raccord
 *    recalé sur un passage par zéro et fondu en enchaîné (`parametres.fonduMs`, 10-20 ms), et dépose un WAV 48 kHz
 *    mono (l'audio maître). Mesures : `dureeSec`, `coupures`, et les instants réellement coupés
 *    (`coupure.<i>.debut` / `.fin`), que le studio reprend pour décaler les mots au plus juste.
 *
 *  - `parametres.mode = "recette"` (tableau animé, recette de la voix du 11/10) : garde les morceaux reçus
 *    (`parametres.morceaux`, calculés par le studio à partir des horodatages des mots), fondu de `fonduMs` à chaque
 *    coupe, puis les filtres reçus (`atempo`, passe-haut, compresseur, `loudnorm`), un fondu de sortie et un silence de
 *    fin. Tout est fait par FFmpeg en une passe (`argumentsRecette`, PUR et testé). Mesure : `dureeSec`.
 *    RACCORD (12/10/2026, fin propre à TikTok et Shorts) : avec une seconde entrée `audio2` (la phrase de fin lue à
 *    part), un morceau porte `source: 1` pour être pris dans `audio2`, et `silence: true` pour un blanc ; tout est
 *    remis à 48 kHz mono avant d'être mis bout à bout, puis le traitement final commun (même niveau sonore) s'applique
 *    au tout. Sans `audio2`, le graphe est celui d'avant, à l'identique.
 *    PORTE DE BRUIT (14/10/2026, souffle entendu dans les blancs) : avec `parametres.porte`, une porte est posée juste
 *    avant la `loudnorm` (`graphePorte`, PUR et testé). Sans `porte`, le graphe est celui d'avant, à l'identique.
 *
 *  - `parametres.mode = "mesure-voix"` (14/10, voix de référence) : mesure la voix reçue (`audio/voix.ts`, portage de
 *    `docs/voix-reference/comparer-voix.py`) : `voix.hauteurHz`, `voix.variationHz`, `voix.energie`, `voix.dynamique`,
 *    `voix.rythmePicsParSec`, `voix.partieParole`, plus `dureeSec` et `voix.versionMesure` (15/10 : version 2, part de
 *    parole sans les bords silencieux). Le rapport JSON (`versionMesure`, `voix`) est déposé à la sortie. Ajout pur :
 *    les autres modes sont inchangés.
 *    19/10 : `parametres.traitement = "video-finie"` (Image → vidéo) mesure la voix après la chaîne d'une vidéo finie
 *    (version 3 ; `audio/voix.ts`) et ajoute `voix.pretraitement`, `voix.niveauBrutLufs`, `voix.lraBrut`,
 *    `voix.gainAvantDb`, `voix.gainApresDb`, `voix.niveauMesurable`. Sans `traitement` : mesure brute à l'identique
 *    (version 2). Autre valeur : refus. Aucun WAV n'est jamais renvoyé.
 *
 * Entrée : `audio` (adresse de lecture signée), `audio2` facultative. FFmpeg décode ; le calcul est fait en mémoire
 * (`audio/pcm.ts`).
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ErreurRendu, type Operation } from "../contrat.js";
import { appliquerCoupures, decoderPcm, detecterRespirations, FREQUENCE, versWav, type Intervalle } from "../audio/pcm.js";
import {
  FREQUENCE_MESURE_VOIX,
  TRAITEMENT_MESURE_VIDEO_FINIE,
  VERSION_MESURE_VOIX_BRUTE,
  VERSION_MESURE_VOIX_VIDEO_FINIE,
  mesurerVoix,
  mesurerVoixVideoFinie,
  mesuresVoixAPlat,
} from "../audio/voix.js";
import { deposer, dureeMedia, executer, FFMPEG, telecharger } from "../outils.js";

function intervalles(valeur: unknown, nom: string): Intervalle[] {
  if (!Array.isArray(valeur)) throw new ErreurRendu({ code: "refuse", reessayable: false, message: `Paramètre « ${nom} » manquant.` });
  return valeur.map((v) => {
    const x = v as Partial<Intervalle>;
    if (typeof x.debutSec !== "number" || typeof x.finSec !== "number" || !(x.finSec >= x.debutSec)) {
      throw new ErreurRendu({ code: "refuse", reessayable: false, message: `Intervalle invalide dans « ${nom} ».` });
    }
    return { debutSec: x.debutSec, finSec: x.finSec };
  });
}

/** Mesures à plat (l'état d'un rendu ne porte que des nombres). */
export function aplatir(prefixe: string, liste: Intervalle[]): Record<string, number> {
  const m: Record<string, number> = {};
  liste.forEach((x, i) => {
    m[`${prefixe}.${i}.debut`] = +x.debutSec.toFixed(4);
    m[`${prefixe}.${i}.fin`] = +x.finSec.toFixed(4);
  });
  return m;
}

/**
 * Le travail lui-même, sur un fichier local : sert à l'opération (après téléchargement) ET aux essais sur le poste
 * (`tests/montage-avocat-son.test.ts`, sur un vrai fichier son). Renvoie les mesures et, en mode « appliquer », le WAV.
 */
/** Correcteur réel 2 : silence ajouté à la fin du son maître (3 s au plus). PUR, testé. */
export function ajouterSilenceFin(x: Float32Array, sec: number): Float32Array {
  const n = Math.round(Math.max(0, Math.min(3, Number.isFinite(sec) ? sec : 0)) * FREQUENCE);
  if (!n) return x;
  const y = new Float32Array(x.length + n);
  y.set(x, 0);
  return y;
}

/** Filtres permis dans une recette (rien d'autre n'entre dans le graphe FFmpeg). */
const FILTRE_PERMIS = /^(atempo=[0-9.]+|highpass=f=[0-9.]+|acompressor=[A-Za-z0-9=:.-]+|loudnorm=[A-Za-z0-9=:.-]+)$/;

/** Réglages d'une porte de bruit (recette du tableau, 14/10/2026). */
export interface PorteBruit {
  /** La porte écoute la voix filtrée au-dessus de cette fréquence (Hz) : le bruit de fond grave ne l'ouvre pas. */
  detectionHz: number;
  /** Seuil d'ouverture (dB), sur la voix filtrée. */
  seuilDb: number;
  /** Baisse quand elle est fermée (dB, négatif). */
  plageDb: number;
  ratio: number;
  attaqueMs: number;
  relachementMs: number;
  /** Avance de l'écoute sur le son (ms) : la porte est ouverte avant le début d'un mot. */
  anticipationMs: number;
}

/** Lit et borne la porte reçue ; `undefined` si absente. Refuse des valeurs hors limites. */
export function lirePorte(valeur: unknown): PorteBruit | undefined {
  if (valeur === undefined || valeur === null) return undefined;
  const p = valeur as Record<string, unknown>;
  const bornes: [keyof PorteBruit, number, number][] = [
    ["detectionHz", 100, 8000],
    ["seuilDb", -70, -10],
    ["plageDb", -60, -3],
    ["ratio", 1, 20],
    ["attaqueMs", 1, 50],
    ["relachementMs", 10, 500],
    ["anticipationMs", 0, 50],
  ];
  const porte = {} as PorteBruit;
  for (const [cle, min, max] of bornes) {
    const v = p[cle];
    if (typeof v !== "number" || !(v >= min && v <= max)) throw new ErreurRendu({ code: "refuse", reessayable: false, message: `Porte de bruit : « ${cle} » hors limites (${min} à ${max}).` });
    porte[cle] = v;
  }
  return porte;
}

/**
 * Porte de bruit en graphe FFmpeg (PUR) : de l'étiquette `entree` à l'étiquette `sortie`. La voix est retardée de
 * `anticipationMs`, la porte écoute la voix NON retardée filtrée en passe-haut (deux pôles, deux fois), puis l'avance
 * est retirée : même durée, mots au même instant.
 */
export function graphePorte(p: PorteBruit, entree: string, sortie: string): string {
  const a = (p.anticipationMs / 1000).toFixed(4);
  const porte = `sidechaingate=threshold=${p.seuilDb}dB:range=${p.plageDb}dB:ratio=${p.ratio}:attack=${p.attaqueMs}:release=${p.relachementMs}`;
  return [
    `[${entree}]asplit=2[pv][pe]`,
    `[pv]adelay=delays=${p.anticipationMs}:all=1[pvr]`,
    `[pe]highpass=f=${p.detectionHz},highpass=f=${p.detectionHz},apad=pad_dur=${a}[pec]`,
    `[pvr][pec]${porte},atrim=start=${a},asetpts=PTS-STARTPTS[${sortie}]`,
  ].join(";");
}

/**
 * Arguments FFmpeg de la recette de voix (PUR) : morceaux gardés (fondu à chaque coupe), concaténés, puis les filtres,
 * le fondu de sortie et le silence de fin ; WAV 48 kHz mono. Refuse des paramètres hors limites.
 */
export function argumentsRecette(source: string, sortie: string, parametres: Record<string, unknown>, source2?: string): string[] {
  const refus = (message: string) => new ErreurRendu({ code: "refuse", reessayable: false, message });
  const morceaux = intervalles(parametres.morceaux, "morceaux");
  const bruts = parametres.morceaux as { source?: unknown; silence?: unknown }[];
  const raccord = bruts.some((m) => m.source === 1 || m.silence === true);
  if (raccord && bruts.some((m) => m.source === 1) && !source2) throw refus("Entrée « audio2 » manquante pour le raccord.");
  if (!morceaux.length || morceaux.length > 2000) throw refus("Morceaux de la recette absents ou trop nombreux.");
  const fonduMs = Number(parametres.fonduMs ?? 6);
  if (!(fonduMs >= 1 && fonduMs <= 40)) throw refus("Fondu hors limites (1 à 40 ms).");
  const filtres = String(parametres.filtres ?? "").split(",").filter(Boolean);
  if (filtres.some((f) => !FILTRE_PERMIS.test(f))) throw refus("Filtre de recette non permis.");
  const fonduSortie = Number(parametres.fonduSortieSec ?? 0);
  const debutFondu = Number(parametres.debutFonduSortieSec ?? 0);
  const silence = Math.max(0, Math.min(3, Number(parametres.silenceFinSec ?? 0)));
  if (!(fonduSortie >= 0 && fonduSortie <= 2) || !(debutFondu >= 0)) throw refus("Fondu de sortie hors limites.");
  const f = (x: number) => x.toFixed(4);
  const d = fonduMs / 1000;
  const parties = morceaux.map((m, i) => {
    const duree = m.finSec - m.debutSec;
    const fondu = Math.min(d, duree / 2);
    if (raccord && bruts[i].silence === true) {
      if (!(duree > 0 && duree <= 3)) throw refus("Silence de raccord hors limites (3 s au plus).");
      return `anullsrc=r=${FREQUENCE}:cl=mono,atrim=end=${f(duree)},asetpts=PTS-STARTPTS[m${i}]`;
    }
    const entree = raccord && bruts[i].source === 1 ? 1 : 0;
    const format = raccord ? `,aresample=${FREQUENCE},aformat=sample_fmts=fltp:channel_layouts=mono` : "";
    return `[${entree}:a]atrim=start=${f(m.debutSec)}:end=${f(m.finSec)},asetpts=PTS-STARTPTS${format},afade=t=in:d=${f(fondu)},afade=t=out:st=${f(Math.max(0, duree - fondu))}:d=${f(fondu)}[m${i}]`;
  });
  // Porte de bruit : juste avant la `loudnorm` (le dernier filtre de la recette), après le compresseur.
  const porte = lirePorte(parametres.porte);
  const iNiveau = filtres.findIndex((x) => x.startsWith("loudnorm="));
  const coupe = iNiveau < 0 ? filtres.length : iNiveau;
  const avantPorte = porte ? filtres.slice(0, coupe) : [];
  const chaine = [...(porte ? filtres.slice(coupe) : filtres), "aresample=48000", ...(fonduSortie > 0 ? [`afade=t=out:st=${f(debutFondu)}:d=${f(fonduSortie)}`] : []), ...(silence > 0 ? [`apad=pad_dur=${f(silence)}`] : [])].join(",");
  const concat = `${parties.join(";")};${morceaux.map((_, i) => `[m${i}]`).join("")}concat=n=${morceaux.length}:v=0:a=1[c]`;
  const graphe = porte
    ? `${concat};${avantPorte.length ? `[c]${avantPorte.join(",")}[cp];` : ""}${graphePorte(porte, avantPorte.length ? "cp" : "c", "cg")};[cg]${chaine}[s]`
    : `${concat};[c]${chaine}[s]`;
  return ["-v", "error", "-y", "-i", source, ...(raccord && source2 ? ["-i", source2] : []), "-filter_complex", graphe, "-map", "[s]", "-ac", "1", "-ar", String(FREQUENCE), "-c:a", "pcm_s16le", sortie];
}

export async function nettoyerFichier(source: string, parametres: Record<string, unknown>, signal?: AbortSignal, source2?: string): Promise<{ mesures: Record<string, number>; wav?: Buffer; rapport?: unknown }> {
  const mode = parametres.mode;
  if (mode === "recette") {
    const sortie = `${source}-recette.wav`;
    await executer(FFMPEG, argumentsRecette(source, sortie, parametres, source2), signal);
    return { mesures: { dureeSec: await dureeMedia(sortie, signal) }, wav: await readFile(sortie) };
  }
  if (mode === "mesure-voix") {
    const traitement = parametres.traitement;
    if (traitement === undefined) {
      const y = await decoderPcm(source, signal, FREQUENCE_MESURE_VOIX);
      const m = mesurerVoix(y, FREQUENCE_MESURE_VOIX);
      return { mesures: { dureeSec: y.length / FREQUENCE_MESURE_VOIX, ...mesuresVoixAPlat(m), "voix.versionMesure": VERSION_MESURE_VOIX_BRUTE }, rapport: { versionMesure: VERSION_MESURE_VOIX_BRUTE, voix: m } };
    }
    if (traitement !== TRAITEMENT_MESURE_VIDEO_FINIE) throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Traitement de mesure inconnu." });
    const r = await mesurerVoixVideoFinie(source, signal);
    const traite = {
      "voix.pretraitement": 1,
      "voix.niveauBrutLufs": r.niveauBrutLufs,
      "voix.lraBrut": r.lraBrut,
      "voix.gainAvantDb": r.gainAvantDb,
      "voix.gainApresDb": r.gainApresDb,
      "voix.niveauMesurable": r.niveauMesurable,
    };
    const finis: Record<string, number> = {};
    for (const [k, v] of Object.entries(traite)) if (Number.isFinite(v)) finis[k] = +v.toFixed(5);
    return {
      mesures: { dureeSec: r.dureeSec, ...mesuresVoixAPlat(r.voix), "voix.versionMesure": VERSION_MESURE_VOIX_VIDEO_FINIE, ...finis },
      rapport: { versionMesure: VERSION_MESURE_VOIX_VIDEO_FINIE, voix: r.voix, traitement: TRAITEMENT_MESURE_VIDEO_FINIE, ...finis },
    };
  }
  if (mode !== "analyse" && mode !== "appliquer") throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Mode de nettoyage inconnu." });
  const x = await decoderPcm(source, signal);
  if (mode === "analyse") {
    const respirations = detecterRespirations(x, intervalles(parametres.blancs, "blancs"));
    return { mesures: { dureeSec: x.length / FREQUENCE, respirations: respirations.length, ...aplatir("respiration", respirations) }, rapport: { respirations } };
  }
  const fonduMs = Number(parametres.fonduMs ?? 15);
  if (!(fonduMs >= 5 && fonduMs <= 40)) throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Fondu hors limites (5 à 40 ms)." });
  const coupe = appliquerCoupures(x, intervalles(parametres.coupures, "coupures"), fonduMs);
  const appliquees = coupe.appliquees;
  const echantillons = ajouterSilenceFin(coupe.echantillons, Number(parametres.silenceFinSec ?? 0));
  return { mesures: { dureeSec: echantillons.length / FREQUENCE, coupures: appliquees.length, ...aplatir("coupure", appliquees) }, wav: versWav(echantillons) };
}

export const nettoyageAudio: Operation = async (demande, contexte) => {
  const audio = demande.entrees.audio;
  if (!audio) throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Entrée « audio » manquante." });
  const source = join(contexte.dossier, "source-audio");
  await telecharger(audio, source, contexte.signal);
  // Raccord : la phrase de fin, lue à part.
  const audio2 = demande.entrees.audio2;
  const source2 = audio2 ? join(contexte.dossier, "source-audio-2") : undefined;
  if (audio2 && source2) await telecharger(audio2, source2, contexte.signal);
  contexte.progression(25);
  const r = await nettoyerFichier(source, demande.parametres, contexte.signal, source2);
  contexte.progression(80);
  const chemin = join(contexte.dossier, r.wav ? "audio-maitre.wav" : "analyse.json");
  await writeFile(chemin, r.wav ?? JSON.stringify(r.rapport));
  await deposer(demande.sortie.urlDepot, chemin, r.wav ? "audio/wav" : "application/json", contexte.signal);
  contexte.progression(100);
  return { mesures: r.mesures };
};
