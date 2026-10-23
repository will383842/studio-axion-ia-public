/**
 * L15 · Doubles de la fabrication « image → vidéo » : AUCUN appel réel. Lecture et écriture : rôles simulés (cartes
 * figées, fiches A-F de L6) ; HeyGen, rendu, stockage : simulés avec des WAV synthétiques (mots = notes avec fondu,
 * blancs = silence numérique), comme `voix.test.ts` ; transcription : la piste voix seule relue telle quelle ;
 * extraction d'images, relecture Claude, mise en page : doubles. Tout est figé : aucune date, aucun hasard.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { VERSION_MESURE_VOIX } from "@/briques/voix-maitre/reference";
import { REFERENCE_V4_IV } from "@/domaine/image-video/reference-voix";
import type { CarteImage } from "@/domaine/image-video/carte";
import { RESEAUX_IV } from "@/domaine/image-video/plafonds";
import type { MotHorodate } from "@/domaine/types";
import type { DemandeRendu, EtatRendu, FournisseurAlignement, FournisseurVoix, ServiceRendu, StockageFichiers } from "@/fournisseurs/types";
import type { DefinitionRole, EntreeRole } from "@/generateur/roles/types";
import type { OutilsAssemblageIV } from "@/moteurs/montage-image-video/assemblage";
import type { DemandeDepenseIV, DemandeFabricationIV, DemandeRenduIV, OutilsFabricationIV } from "@/moteurs/montage-image-video/fabrication";
import { RenduEnCoursIV } from "@/moteurs/montage-image-video/fabrication";
import type { LectureImage } from "@/moteurs/montage-image-video/lecture";
import { appelerEnSimulation, convertirEnSimulation, lectureDeCarte, pngSimule } from "@/moteurs/montage-image-video/lecture/simulation";
import type { RelectureFinale } from "@/moteurs/montage-image-video/relecture-finale";

export const DOSSIER_CARTES = join(process.cwd(), "tests/image-video/fixtures/cartes");
export const IMAGES = ["A", "B", "C", "D", "E", "F", "faux-16-noeuds"] as const;
export type Image = (typeof IMAGES)[number];
export const carteFixe = (nom: Image): CarteImage => JSON.parse(readFileSync(join(DOSSIER_CARTES, `${nom}.json`), "utf8"));

/* ------------------------------------------------------------------ */
/* Sons synthétiques                                                     */
/* ------------------------------------------------------------------ */

const FREQ = 8000;

function wav(e: Float32Array): Uint8Array {
  const b = new Uint8Array(44 + e.length * 2);
  const v = new DataView(b.buffer);
  const ecrire = (i: number, s: string) => [...s].forEach((c, k) => (b[i + k] = c.charCodeAt(0)));
  ecrire(0, "RIFF");
  v.setUint32(4, 36 + e.length * 2, true);
  ecrire(8, "WAVE");
  ecrire(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, FREQ, true);
  v.setUint32(28, FREQ * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  ecrire(36, "data");
  v.setUint32(40, e.length * 2, true);
  e.forEach((x, i) => v.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, x)) * 32767), true));
  return b;
}

function lireEchantillons(b: Uint8Array): Float32Array {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const n = v.getUint32(40, true) / 2;
  return Float32Array.from({ length: n }, (_, i) => v.getInt16(44 + i * 2, true) / 32768);
}

/**
 * `naturel` (sons bruts en MP3, chemin réel de studio-rendu) : chaque mot s'éteint comme une voix, par une queue
 * exponentielle (τ = 15 ms) jusqu'au mot suivant, au lieu d'un fondu linéaire jusqu'au zéro numérique. Ce fondu-là,
 * remonté par le vrai compresseur et la `loudnorm` de la recette, tombe de −27 dB au silence en 20 ms : le contrôle Q19
 * y voit (à juste titre) une coupure nette, que ne produit pas une vraie voix.
 */
/**
 * Niveaux (dB RMS) de la parole d'une voix réaliste (`bruitDb`) : de −12 à −25 dB d'un mot à l'autre, comme la voix
 * HeyGen mesurée en prod (médiane −24,5 dB, crêtes de phrase vers −12 dB).
 */
export const NIVEAUX_PAROLE_DB = [-12, -16, -20, -25, -14, -18, -22] as const;
const amplitudeSinus = (db: number) => Math.SQRT2 * 10 ** (db / 20);

function sonDesMots(mots: readonly MotHorodate[], dureeSec: number, naturel = false, niveauxVaries = false): Uint8Array {
  const e = new Float32Array(Math.round(dureeSec * FREQ));
  if (naturel) {
    mots.forEach((m, k) => {
      const fin = Math.min(e.length, Math.round((mots[k + 1]?.debutSec ?? dureeSec) * FREQ));
      const a = niveauxVaries ? amplitudeSinus(NIVEAUX_PAROLE_DB[k % NIVEAUX_PAROLE_DB.length]) : 0.3;
      for (let i = Math.round(m.debutSec * FREQ); i < fin; i++) {
        const t = i / FREQ;
        const env = a * Math.min(1, (t - m.debutSec) / 0.02) * (t <= m.finSec ? 1 : Math.exp(-(t - m.finSec) / 0.015));
        e[i] = env * Math.sin(2 * Math.PI * 220 * t);
      }
    });
    return wav(e);
  }
  for (const m of mots) {
    for (let i = Math.round(m.debutSec * FREQ); i < Math.round(m.finSec * FREQ) && i < e.length; i++) {
      const t = i / FREQ;
      const env = 0.3 * Math.min(1, (t - m.debutSec) / 0.02) * Math.min(1, (m.finSec - t) / 0.15);
      e[i] = env * Math.sin(2 * Math.PI * 220 * t);
    }
  }
  return wav(e);
}

/**
 * Mots horodatés d'un texte (centièmes ronds) : 0,27 s par mot, 0,12 s entre deux mots (≈ 2,75 mots/s (plus lent que le débit réel de 3,4 : à recalibrer) après le tempo
 * ×1,08, le débit de référence du plan), 0,40 s après une phrase.
 */
function motsDuTexte(texte: string, lent = false): MotHorodate[] {
  const res: MotHorodate[] = [];
  const mot0 = lent ? 30 : 27;
  let t = 30;
  for (const mot of texte.split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m))) {
    res.push({ mot, debutSec: t / 100, finSec: (t + mot0) / 100 });
    t += mot0 + (/[.!?…]["»]?$/.test(mot) ? (lent ? 45 : 40) : /[,;:]$/.test(mot) ? 20 : 12);
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* Le monde simulé                                                       */
/* ------------------------------------------------------------------ */

export interface Monde {
  /** Textes lus par HeyGen (chaque entrée = une lecture payée). */
  lus: string[];
  sons: Map<string, Uint8Array>;
  /** Appels Claude, par rôle. */
  appelsClaude: { role: string; variable: string }[];
  /** Dépenses soumises au budget réel (après la caisse), dans l'ordre. */
  depenses: DemandeDepenseIV[];
  /** Journal mêlé : « réserve <appelId> », « claude <rôle> », « heygen », « transcription », « rendu <version> ». */
  ordre: string[];
  rendus: DemandeRenduIV[];
  transcriptions: string[];
  mesures: number;
}

export interface OptionsMonde {
  /** Lectures rendues par les deux appels de lecture (défaut : la carte figée, lue à l'identique). */
  lectures?: Partial<Record<"a" | "b", LectureImage>>;
  /** Le budget réel refuse cette dépense. */
  refuserDepense?: (d: DemandeDepenseIV, n: number) => string | null;
  /** La n-ième lecture HeyGen (à partir de 1) tombe en panne (aucun son rendu, rien n'est payé). */
  pannesVoix?: number[];
  /** Le n-ième rendu soumis (à partir de 1) est encore en cours. */
  rendusEnCours?: number[];
  cartesValidees?: number;
  /** Voix plus lente (0,30 s par mot, 0,45 s après une phrase) : les vidéos longues dépassent les plafonds courts. */
  voixLente?: boolean;
  /** Mesure de ressemblance rendue pour la n-ième mesure (à partir de 1) ; défaut : la référence, mesure version 2. */
  mesureVoix?: (n: number) => Record<string, number>;
  /**
   * 15/10 (v-dd3049053f88) : sons bruts comme la copie HeyGen de la prod, de VRAIS MP3 (FFmpeg du poste, 24 kHz, clé
   * `brut-N.mp3`) ; l'assemblage reçoit alors ses outils de `assemblage` (conversion et recette réelles).
   */
  brutsMp3?: boolean;
  /**
   * 15/10 (v-dd3049053f88, après #279) : avec `brutsMp3`, voix RÉALISTE comme la copie HeyGen de la prod : parole de −12
   * à −25 dB et BRUIT DE FOND rose à ce niveau (dB RMS, −40 en prod) sur tout le fichier, mêlé par FFmpeg à l'encodage.
   */
  bruitDb?: number;
  /** Outils d'assemblage remplacés (conversion en WAV, piste voix seule…). */
  assemblage?: Partial<OutilsAssemblageIV>;
}

/** Niveau RMS (dB) du bruit rose de FFmpeg à l'amplitude 1 (`anoisesrc=color=pink`, mesuré par `volumedetect`). */
const BRUIT_ROSE_UNITE_DB = -14.2;

/**
 * Encode un WAV en vrai MP3 (FFmpeg du poste, 24 kHz mono, 64 kbit/s, en-tête LAME comme un fichier fini). `bruitDb` :
 * un bruit rose de ce niveau RMS (graine fixe : octets identiques d'un essai à l'autre) est ajouté sur toute la durée.
 */
export function enMp3(wavOctets: Uint8Array, o: { enteteLame?: boolean; bruitDb?: number } = {}): Uint8Array {
  const dossier = mkdtempSync(join(tmpdir(), "iv-mp3-"));
  try {
    // Fichier (sortie qu'on peut relire) : FFmpeg y écrit l'en-tête LAME (retard de l'encodeur), sauf `enteteLame: false`.
    const sortie = join(dossier, "brut.mp3");
    const bruit =
      o.bruitDb === undefined
        ? []
        : ["-filter_complex", `[0:a]aresample=24000[v];anoisesrc=color=pink:amplitude=${(10 ** ((o.bruitDb - BRUIT_ROSE_UNITE_DB) / 20)).toFixed(6)}:seed=7:r=24000[n];[v][n]amix=inputs=2:duration=first:normalize=0`];
    const r = spawnSync("ffmpeg", ["-v", "error", "-nostdin", "-f", "wav", "-i", "pipe:0", ...bruit, "-ar", "24000", "-ac", "1", "-c:a", "libmp3lame", "-b:a", "64k", ...(o.enteteLame === false ? ["-write_xing", "0"] : []), sortie], { input: wavOctets, maxBuffer: 64 * 1024 * 1024 });
    if (r.status !== 0) throw new Error(`MP3 impossible : ${String(r.stderr)}`);
    return new Uint8Array(readFileSync(sortie));
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}

export function monde(): Monde {
  return { lus: [], sons: new Map(), appelsClaude: [], depenses: [], ordre: [], rendus: [], transcriptions: [], mesures: 0 };
}

export const MESURE_REFERENCE: Record<string, number> = { ...Object.fromEntries(Object.entries(REFERENCE_V4_IV).map(([k, v]) => [`voix.${k}`, v])), "voix.versionMesure": VERSION_MESURE_VOIX };
export const TARIF_SIMULE = 0.05;
export const MESURES_FICHIER = Object.freeze({ lufs: -14, creteVraieDbtp: -1.5, noirMaxSec: 0, figeMaxSec: 0, largeur: 1080, hauteur: 1920, fps: 25 });

/** Les outils complets de la fabrication, sur un monde simulé. */
export function outilsSimules(carte: CarteImage, m: Monde, o: OptionsMonde = {}): OutilsFabricationIV {
  const lecture = lectureDeCarte(carte);
  const appelerLecture = appelerEnSimulation({ a: o.lectures?.a ?? lecture, b: o.lectures?.b ?? lecture });
  const soumises = new Map<string, DemandeRendu>();
  let lectureVoix = 0;
  let rendu = 0;
  const voix = {
    id: "heygen-simule",
    mode: "simulation",
    capacites: { audioSeul: true, horodatageMots: true },
    async lire(d: { texte: string }) {
      lectureVoix++;
      if (o.pannesVoix?.includes(lectureVoix)) throw new Error("HeyGen ne répond pas");
      m.lus.push(d.texte);
      m.ordre.push("heygen");
      const n = m.lus.length;
      const mots = motsDuTexte(d.texte, o.voixLente);
      const dureeSec = +((mots.at(-1)?.finSec ?? 0) + 0.6).toFixed(2);
      const fichierCle = `brut-${n}.${o.brutsMp3 ? "mp3" : "wav"}`;
      const son = sonDesMots(mots, dureeSec, o.brutsMp3, o.bruitDb !== undefined);
      m.sons.set(fichierCle, o.brutsMp3 ? enMp3(son, { bruitDb: o.bruitDb }) : son);
      return { fichierCle, dureeSec, cout: { centimes: 2, devise: "EUR" }, mots };
    },
  } as unknown as FournisseurVoix;
  const stockage = { urlLecture: async (cle: string) => `https://stockage.test/${cle}`, urlLectureDuree: async (cle: string) => `https://stockage.test/${cle}`, urlDepotDuree: async (cle: string) => `https://depot.test/${cle}` } as unknown as StockageFichiers;
  const serviceRendu: ServiceRendu = {
    async soumettre(d) {
      soumises.set(d.idRendu, d);
      return { idRendu: d.idRendu };
    },
    async etat(id): Promise<EtatRendu> {
      const d = soumises.get(id);
      if (!d) return { statut: "inconnu" };
      if (d.parametres.mode === "mesure-voix") return { statut: "termine", sortieCle: d.sortie.cle, mesures: o.mesureVoix ? o.mesureVoix(++m.mesures) : (m.mesures++, MESURE_REFERENCE) };
      return { statut: "termine", sortieCle: d.sortie.cle, mesures: d.parametres.mode === "appliquer" ? { dureeSec: 5 } : {} };
    },
  };
  return {
    lireImageSource: async () => pngSimule(carte.image.largeur, carte.image.hauteur),
    lecture: {
      convertir: convertirEnSimulation,
      appeler: async (role, entree) => {
        m.appelsClaude.push({ role: role.id, variable: entree.variable });
        m.ordre.push(`claude ${role.id}`);
        return appelerLecture(role, entree);
      },
    },
    ecriture: {
      appeler: async (role: DefinitionRole, entree: EntreeRole) => {
        m.appelsClaude.push({ role: role.id, variable: entree.variable });
        m.ordre.push(`claude ${role.id}`);
        const r = role.simuler(entree);
        return { ok: true, simule: true, ...(typeof r === "string" ? { texte: r } : { donnees: r }) };
      },
    },
    voix: {
      voix: () => voix,
      stockage: () => stockage,
      aligneur: () => ({ mode: "simulation" }) as unknown as FournisseurAlignement,
      rendu: () => serviceRendu,
      renduEstSimule: () => false,
      cle: (nom) => `voix/${nom}`,
      caler: () => false,
      mesurerPauses: async (_cle, pauses) => pauses.map(() => -60),
      tarifCentimesParCaractere: TARIF_SIMULE,
    },
    assemblage: {
      lireSon: async (cle) => m.sons.get(cle) ?? null,
      // Bruts des doubles déjà en WAV : rien à convertir (le chemin MP3 réel est testé dans `brut-mp3.test.ts`).
      convertirEnWav: async () => {
        throw new Error("son brut des doubles déjà en WAV : aucune conversion attendue");
      },
      rangerSon: async (cle, octets) => void m.sons.set(cle, octets),
      async traiterVoix(d) {
        const morceaux = d.recette.parametres.morceaux as { debutSec: number; finSec: number; source?: 0 | 1; silence?: true }[];
        const sources = { 0: lireEchantillons(m.sons.get(d.recette.corps)!), 1: d.recette.fin ? lireEchantillons(m.sons.get(d.recette.fin)!) : new Float32Array(0) };
        const parties = morceaux.map((x) => (x.silence ? new Float32Array(Math.round((x.finSec - x.debutSec) * FREQ)) : sources[x.source ?? 0].subarray(Math.round(x.debutSec * FREQ), Math.round(x.finSec * FREQ))));
        const bout = new Float32Array(parties.reduce((n, x) => n + x.length, 0));
        parties.reduce((i, x) => (bout.set(x, i), i + x.length), 0);
        const silence = d.recette.parametres.silenceFinSec as number;
        const n = Math.floor(bout.length / d.tempo);
        const sortie = new Float32Array(n + Math.round(silence * FREQ));
        for (let k = 0; k < n; k++) sortie[k] = bout[Math.floor(k * d.tempo)];
        const cle = `${d.id}.wav`;
        m.sons.set(cle, wav(sortie));
        return { cle, dureeSec: sortie.length / FREQ };
      },
      ...o.assemblage,
    },
    rendre: async (d) => {
      rendu++;
      m.ordre.push(`rendu ${d.version}`);
      if (o.rendusEnCours?.includes(rendu)) throw new RenduEnCoursIV("Le rendu");
      m.rendus.push(d);
      // Cadre du fichier : celui de la ligne (1080 × 1350 pour une version 4:5).
      return { cle: `final/${d.version}.mp4`, empreinte: `octets-${d.id}`, dureeSec: d.ligne.dureeSec, mesures: { ...MESURES_FICHIER, largeur: d.ligne.largeur, hauteur: d.ligne.hauteur } };
    },
    controles: {
      lireSon: async (cle) => m.sons.get(cle) ?? null,
      transcrire: async (d) => {
        m.transcriptions.push(d.appelId);
        m.ordre.push("transcription");
        const rendu = m.rendus.find((r) => r.piste.cle === d.cle);
        return { mots: (rendu?.piste.mots ?? []).map((x) => ({ ...x })) };
      },
      extraireImages: async (d) => ({ images: d.parametres.instants.map((i) => ({ nom: i.nom, cle: d.parametres.cles[i.nom] })) }),
      lireImage: async (cle) => ({ octets: new TextEncoder().encode(cle), type: "image/jpeg" }),
      appeler: async (role, entree) => {
        m.appelsClaude.push({ role: role.id, variable: entree.variable });
        m.ordre.push(`claude ${role.id}`);
        return { ok: true, simule: true, donnees: role.simuler(entree) as RelectureFinale };
      },
    },
    budget: {
      reserver: async (d) => {
        m.depenses.push(d);
        m.ordre.push(`réserve ${d.appelId}`);
        const refus = o.refuserDepense?.(d, m.depenses.length);
        return refus ? { ok: false, message: refus } : { ok: true };
      },
    },
    cartesValidees: async () => o.cartesValidees ?? 0,
    maintenant: () => "2026-10-15T08:00:00.000Z",
  };
}

/** Demande de fabrication d'une image du jeu d'essai, tous réseaux. */
export function demandeEssai(carte: CarteImage, plus: Partial<DemandeFabricationIV> = {}): DemandeFabricationIV {
  return {
    videoId: `v-${carte.image.empreinte}`,
    versionId: "ver-1",
    image: { cle: carte.image.cle, empreinte: carte.image.empreinte },
    reseaux: [...RESEAUX_IV],
    validationCarte: "si-doute",
    appelCommentaire: "question-puis-fin",
    plafondCentimes: 500,
    tauxUsdEur: 0.9,
    numeroVersion: 42,
    codeSuivi: "essai",
    ...plus,
  };
}
