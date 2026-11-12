/**
 * 15/10 (prod v-dd3049053f88, studio 3352c82d, après #279) : l'assemblage s'arrêtait sur « Voix (youtube-shorts) · la coupe à
 * 2,52 s du son du corps tombe en plein son, hors de tout silence mesuré (26 coupes dans ce cas) ». La voix HeyGen a un
 * BRUIT DE FOND de −38 à −46 dB dans ses pauses : au seuil fixe −45 dB, presque aucun silence n'était mesuré. Ici :
 *  - le profil de niveaux RÉEL (fenêtres de 20 ms, 2,30-2,95 s, percentiles du fichier) : la coupe à 2,52 s est dans un
 *    silence avec le seuil adapté, et ne l'est pas au seuil fixe (le refus de la prod est reproduit) ;
 *  - la parole (−12 à −30 dB) n'est jamais un silence ;
 *  - des bruts MP3 RÉALISTES (FFmpeg : parole −12 à −25 dB, bruit rose à −40 dB, 24 kHz) : assemblage au bout ; au seuil
 *    fixe −45 dB, les coupes tombent en plein son (la mutation rougit) ;
 *  - reprise depuis l'état EXACT de la prod : « Refaire cette partie » proposé, assemblage repris sans lecture ni
 *    réservation de voix ;
 *  - RÉPÉTITION GÉNÉRALE : bruts MP3 bruités, vraie recette de `studio-rendu`, vrai branchement du rendu, écoute
 *    (Q17/Q19), contrôles finaux, 5 versions dont Facebook en repli Instagram.
 */
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { nettoyerFichier } from "../../studio-rendu/src/operations/nettoyage-audio";
import { VERSION_MESURE_VOIX } from "@/briques/voix-maitre/reference";
import { REFERENCE_V4_IV } from "@/domaine/image-video/reference-voix";
import { refusReessayableIV, vueFabrication } from "@/components/formats/image-video/vue";
import {
  REGLES_SILENCES_IV,
  assemblerVersionsIV,
  cleWavDuBrut,
  coupesEnPleinSon,
  seuilSilenceIV,
  silencesIV,
  type OutilsAssemblageIV,
} from "@/moteurs/montage-image-video/assemblage";
import { REGLES_FIN_DE_VOIX, lireWav, niveauxDb, planRaccordVoix, recalerCoupesSurSilences, silencesMesures, type Silence, type Son } from "@/moteurs/montage-image-video/emprunts";
import { attendWillIV, avancerJusquAArretIV, etatInitialIV, reprendreIV, validerCarteIV, validerScriptIV, type EtatFabricationIV, type OutilsFabricationIV } from "@/moteurs/montage-image-video/fabrication";
import { motsDits } from "@/domaine/image-video/fiche";
import { sonsBrutsIV } from "@/moteurs/montage-image-video/voix";
import { convertirSonEnWavParFfmpeg } from "@/services/image-video";
import { MESURE_REFERENCE, carteFixe, demandeEssai, enMp3, monde, outilsSimules, type Monde, type OptionsMonde } from "./doubles-fabrication";
import { outilsAvecRendu, ServeurDouble } from "./doubles-rendu";

/**
 * 20/10 : la lecture unique de la voix est la règle (`LECTURE_UNIQUE_IV`). Les blocs ci-dessous qui décrivent une voix
 * payée en segments SÉPARÉS (arrêts de fin, fins de secours, replis : « voix-iv/1 », qui existe encore en prod) la
 * remettent à `false` le temps du bloc ; la lecture unique a ses propres tests (`fabrication-lecture-unique.test.ts`).
 */
/**
 * 26/10/2026 : `planDesFinsIV` pose les fins « accroche + appel + lien ». La répétition générale des fins de secours de
 * Facebook rejoue l'ancien plan (fin « diagnostic », question), toujours GARDÉ dans l'état des vidéos faites avant.
 */
const reglageFins = vi.hoisted(() => ({ avant: false }));
vi.mock("@/moteurs/montage-image-video/fins", async (importOriginal) => {
  const vrai = await importOriginal<typeof import("@/moteurs/montage-image-video/fins")>();
  const { planDesFinsAvant } = await import("./plan-des-fins-avant");
  return { ...vrai, planDesFinsIV: (d: Parameters<typeof vrai.planDesFinsIV>[0]) => (reglageFins.avant ? planDesFinsAvant(d) : vrai.planDesFinsIV(d)) };
});
const reglageVoix = vi.hoisted(() => ({ lectureUnique: true }));
vi.mock("@/moteurs/montage-image-video/voix", async (importOriginal) => {
  const vrai = await importOriginal<typeof import("@/moteurs/montage-image-video/voix")>();
  return {
    ...vrai,
    get LECTURE_UNIQUE_IV() {
      return reglageVoix.lectureUnique;
    },
  };
});

vi.setConfig({ testTimeout: 300_000 });

const FFMPEG_PRESENT = spawnSync("ffmpeg", ["-version"]).status === 0;
const BRUIT_PROD_DB = -40;

/* ------------------------------------------------------------------ */
/* Profil de niveaux réel                                                */
/* ------------------------------------------------------------------ */

const F = 24000;
const FEN = 0.02;
/** Niveaux mesurés en prod (MP3 HeyGen du corps), fenêtres de 20 ms, de 2,44 à 2,84 s (pause « écrit. » → « Oui, »). */
const PAUSE_PROD: Record<string, number> = { "2.44": -31, "2.46": -41, "2.48": -41, "2.50": -43, "2.52": -42, "2.54": -41, "2.56": -41, "2.58": -40, "2.60": -39, "2.62": -40, "2.64": -40, "2.66": -42, "2.68": -43, "2.70": -42, "2.72": -40, "2.74": -39, "2.76": -38, "2.78": -38, "2.80": -38, "2.82": -39, "2.84": -30 };
/** Répartition des niveaux du fichier de prod (percentiles mesurés : p5 −49,8, p10 −46,4, p20 −41,8, p50 −24,5). */
const REPARTITION: [number, number][] = [
  [0, -55],
  [0.05, -49.8],
  [0.1, -46.4],
  [0.2, -41.8],
  [0.5, -24.5],
  [0.9, -14],
  [1, -10],
];
const quantile = (u: number) => {
  const k = REPARTITION.findIndex(([p]) => p >= u);
  if (k <= 0) return REPARTITION[0][1];
  const [p0, d0] = REPARTITION[k - 1];
  const [p1, d1] = REPARTITION[k];
  return d0 + ((u - p0) / (p1 - p0)) * (d1 - d0);
};

/** Bruit blanc (graine fixe) dont chaque fenêtre de 20 ms a EXACTEMENT le niveau RMS demandé. */
function sonDeNiveaux(niveaux: readonly number[]): Son {
  const n = Math.round(FEN * F);
  const e = new Float32Array(niveaux.length * n);
  let graine = 12345;
  const alea = () => ((graine = (graine * 1103515245 + 12345) % 2147483648) / 2147483648) * 2 - 1;
  niveaux.forEach((db, w) => {
    const x = Float32Array.from({ length: n }, alea);
    const rms = Math.sqrt(x.reduce((a, v) => a + v * v, 0) / n);
    const cible = 10 ** (db / 20);
    x.forEach((v, j) => (e[w * n + j] = (v / rms) * cible));
  });
  return { echantillons: e, frequence: F };
}

/** 69,08 s comme le corps de la prod : la pause réelle à sa place, la parole autour, le reste réparti comme le fichier. */
function profilProd(): Son {
  const total = Math.round(69.08 / FEN);
  const niveaux = Array.from({ length: total }, (_, w) => {
    const t = (w * FEN).toFixed(2);
    if (PAUSE_PROD[t] !== undefined) return PAUSE_PROD[t];
    if (w * FEN >= 2.06 - 1e-9 && w * FEN < 2.44 - 1e-9) return -20; // « écrit. »
    if (w * FEN >= 2.86 - 1e-9 && w * FEN < 3.0 - 1e-9) return -18; // « Oui, »
    return quantile((w * 0.6180339887) % 1);
  });
  return sonDeNiveaux(niveaux);
}

const dans = (t: number, s: readonly Silence[]) => s.some((x) => t >= x.debutSec - 1e-6 && t <= x.finSec + 1e-6);

describe("seuil de silence adapté au bruit de fond (assemblage IV seulement)", () => {
  it("profil réel de la prod : la coupe à 2,52 s est dans un silence (la pause 2,46-2,74 s en est un) ; au seuil fixe −45 dB, non", () => {
    const son = profilProd();
    const niv = niveauxDb(son, REGLES_SILENCES_IV.fenetreSec);
    const tries = [...niv].sort((a, b) => a - b);
    // Le son fabriqué a bien les percentiles de la prod.
    expect(tries[Math.floor(0.1 * (tries.length - 1))]).toBeCloseTo(-46.4, 0);
    expect(tries[Math.floor(0.5 * (tries.length - 1))]).toBeCloseTo(-24.5, 0);
    const { silences, seuilDb } = silencesIV(son);
    // p10 + 8 = −38,4 dB (sous la médiane de la parole − 10 dB et sous −35 dB).
    expect(seuilDb).toBeGreaterThan(-39);
    expect(seuilDb).toBeLessThan(-38);
    const pause = silences.find((s) => dans(2.52, [s]))!;
    expect(pause).toBeDefined();
    expect(pause.debutSec).toBeLessThanOrEqual(2.46 + 1e-6);
    expect(pause.finSec).toBeGreaterThanOrEqual(2.76 - 1e-6);
    // La parole autour n'est pas dans ce silence.
    expect(pause.debutSec).toBeGreaterThanOrEqual(2.44);
    expect(pause.finSec).toBeLessThanOrEqual(2.84);
    // Au seuil fixe (la règle d'avant, celle du cas concret) : la prod est reproduite, 2,52 s n'est dans aucun silence.
    expect(dans(2.52, silencesMesures(son))).toBe(false);
    expect(dans(2.52, silencesMesures(son, { ...REGLES_FIN_DE_VOIX, fenetreSec: FEN }))).toBe(false);

    // Une coupe du plan à 2,52 s (fin du morceau « … écrit. ») : en plein son au seuil fixe, dans un silence ici.
    const plan = { morceaux: [{ debutSec: 0.1, finSec: 2.52, source: 0 as const }, { debutSec: 2.74, finSec: 60, source: 0 as const }] };
    const a252 = (s: readonly Silence[]) => coupesEnPleinSon(plan, { corps: s }, { corps: 69.08 }).filter((c) => c.instantSec === 2.52 || c.instantSec === 2.74);
    expect(a252(silences)).toEqual([]);
    expect(a252(silencesMesures(son)).map((c) => c.instantSec)).toEqual([2.52, 2.74]);
  });

  it("la parole (−12 à −30 dB) n'est JAMAIS un silence, même dans un fichier sans pause ni bruit de fond bas", () => {
    for (const bas of [-30, -28, -25]) {
      const niveaux = Array.from({ length: 1500 }, (_, w) => bas + ((w * 7) % 19) * ((bas + 12) / -18));
      const son = sonDeNiveaux(niveaux);
      const { silences, seuilDb } = silencesIV(son);
      expect(seuilDb).toBeLessThanOrEqual(REGLES_SILENCES_IV.plafondDb);
      expect(silences).toEqual([]);
    }
    // Seuil toujours ≤ médiane de la parole − 10 dB et ≤ −35 dB ; jamais sous −45 dB (relecture #283 : la borne p50 − 12
    // de #281 mettait le seuil à 2,5 dB du bruit dès −42 dB ; le garde-fou se prend sur la parole seule).
    const p = (pause: number, parole: number) => seuilSilenceIV([...Array(30).fill(pause), ...Array(70).fill(parole)]);
    expect(p(-40, -20)).toBe(-35); // p10 + 8 = −32 → plafonné à −35
    expect(p(-46, -30)).toBe(-40); // médiane de la parole (−30) − 10
    expect(p(-46, -14)).toBe(-38);
    expect(p(-80, -20)).toBe(-45); // fichier propre : la règle d'avant
    expect(seuilSilenceIV([...Array(50).fill(-200), ...Array(50).fill(-20)])).toBe(-35); // zéro numérique ignoré
  });

  it("la pause courte de la prod (« quatorze. » 1,22 → « Un » 1,40 ; −44 à −48 dB) et le début du fichier (−41 à −44 dB) sont des silences", () => {
    const son = profilProd();
    const niv = niveauxDb(son, FEN).map((d, w) => {
      const t = w * FEN;
      if (t >= 0.06 - 1e-9 && t < 0.18 - 1e-9) return -41 - ((w % 4) * 1);
      if (t >= 1.24 - 1e-9 && t < 1.4 - 1e-9) return t >= 1.32 - 1e-9 ? -44 - (w % 5) : -40;
      if (t >= 0.9 && t < 1.24) return -20;
      return d;
    });
    const { silences } = silencesIV(sonDeNiveaux(niv));
    expect(dans(1.36, silences)).toBe(true);
    expect(dans(0.12, silences)).toBe(true);
    expect(dans(1.0, silences)).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Bruts MP3 réalistes                                                   */
/* ------------------------------------------------------------------ */

/** Piste voix seule par la VRAIE recette de `studio-rendu`, sur les sons bruts tels que rangés (MP3). */
function traiterVoixReelle(m: Monde): OutilsAssemblageIV["traiterVoix"] {
  return async (d) => {
    const dossier = await mkdtemp(join(tmpdir(), "iv-recette-"));
    try {
      const source = join(dossier, "audio");
      await writeFile(source, m.sons.get(d.recette.corps)!);
      const source2 = d.recette.fin ? join(dossier, "audio2") : undefined;
      if (source2) await writeFile(source2, m.sons.get(d.recette.fin!)!);
      const r = await nettoyerFichier(source, { ...d.recette.parametres, tempo: d.tempo }, undefined, source2);
      const cle = `voix-seule/${d.id}.wav`;
      m.sons.set(cle, new Uint8Array(r.wav!));
      return { cle, dureeSec: r.mesures.dureeSec };
    } finally {
      await rm(dossier, { recursive: true, force: true });
    }
  };
}

function assemblageReel(m: Monde, compte = { conversions: 0 }): Partial<OutilsAssemblageIV> {
  return { convertirEnWav: async (o) => (compte.conversions++, convertirSonEnWavParFfmpeg(o)), traiterVoix: traiterVoixReelle(m) };
}

const decisionScript = (e: EtatFabricationIV) => ({ proposition: e.propositionScript!.empreinte, choixFormules: Object.fromEntries(e.propositionScript!.formules.map((f) => [f.cle, "garder" as const])) });

async function jusquAuBout(e0: EtatFabricationIV, o: OutilsFabricationIV): Promise<EtatFabricationIV> {
  let e = await avancerJusquAArretIV(e0, o);
  for (let i = 0; i < 200 && e.etape !== "prete" && e.etape !== "refusee"; i++) {
    if (e.attente) e = await avancerJusquAArretIV(e, o);
    else if (attendWillIV(e) === "carte") e = await avancerJusquAArretIV(validerCarteIV(e, { proposition: e.propositionCarte!.empreinte, le: "2026-10-15T08:00:00.000Z" }), o);
    else if (attendWillIV(e) === "script") e = await avancerJusquAArretIV(validerScriptIV(e, decisionScript(e)), o);
    else break;
  }
  return e;
}

const bruite = (o: Omit<OptionsMonde, "brutsMp3" | "bruitDb"> = {}): OptionsMonde => ({ ...o, brutsMp3: true, bruitDb: BRUIT_PROD_DB });

/** Ajoute un bruit (graine fixe) de ce niveau RMS à un WAV converti : le son d'une voix dont les pauses ne sont jamais silencieuses. */
function plusBruit(wav: Uint8Array, db: number): Uint8Array {
  const r = spawnSync("ffmpeg", ["-v", "error", "-nostdin", "-f", "wav", "-i", "pipe:0", "-filter_complex", `anoisesrc=color=white:amplitude=${(10 ** ((db + 4.77) / 20)).toFixed(6)}:seed=3:r=${lireWav(wav).frequence}[n];[0:a][n]amix=inputs=2:duration=first:normalize=0`, "-ac", "1", "-c:a", "pcm_s16le", "-f", "wav", "pipe:1"], { input: wav, maxBuffer: 256 * 1024 * 1024 });
  return new Uint8Array(r.stdout);
}

describe.skipIf(!FFMPEG_PRESENT)("bruts MP3 réalistes (parole −12 à −25 dB, bruit rose −40 dB, 24 kHz)", () => {
  it("le brut fabriqué a le profil de la prod : pauses au bruit de fond (−46 à −36 dB), parole au-dessus de −30 dB", async () => {
    const m = monde();
    const carte = carteFixe("A");
    const o = outilsSimules(carte, m, bruite({ assemblage: assemblageReel(m) }));
    const e = await jusquAuBout(etatInitialIV(demandeEssai(carte)), o);
    const corps = sonsBrutsIV(e.voix!).corps;
    const son = lireWav(await convertirSonEnWavParFfmpeg(m.sons.get(corps.fichierCle)!));
    expect(son.frequence).toBe(24000);
    const niv = niveauxDb(son, FEN);
    const auMilieu = (a: number, b: number) => niv.slice(Math.ceil(a / FEN), Math.floor(b / FEN));
    // Dans chaque pause entre deux phrases : jamais de zéro numérique, toujours le bruit de fond.
    let pauses = 0;
    corps.mots.forEach((w, k) => {
      const suivant = corps.mots[k + 1];
      if (!suivant || suivant.debutSec - w.finSec < 0.3) return;
      const p = auMilieu(w.finSec + 0.1, suivant.debutSec - 0.02);
      if (!p.length) return;
      pauses++;
      for (const d of p) {
        expect(d).toBeGreaterThan(-50);
        expect(d).toBeLessThan(-34);
      }
    });
    expect(pauses).toBeGreaterThan(3);
    // Au seuil fixe −45 dB : presque aucun silence mesuré (comme en prod).
    const fixes = silencesMesures(son);
    expect(fixes.reduce((a, s) => a + s.finSec - s.debutSec, 0)).toBeLessThan(0.5);
    // Seuil adapté : chaque pause entre phrases contient un silence ; aucun mot n'est dans un silence (en son milieu).
    const { silences, seuilDb } = silencesIV(son);
    expect(seuilDb).toBeGreaterThan(-45);
    expect(seuilDb).toBeLessThanOrEqual(-35);
    for (const w of corps.mots) expect(dans((w.debutSec + w.finSec) / 2, silences)).toBe(false);
    expect(silences.length).toBeGreaterThan(pauses);
    expect(e.refus?.message).toBeUndefined();
    expect(e.etape).toBe("prete");
  });

  it("assemblage des versions au bout ; MUTATION : au seuil fixe −45 dB les coupes tombent en plein son (le refus de la prod)", async () => {
    const m = monde();
    const carte = carteFixe("A");
    const o = outilsSimules(carte, m, bruite({ assemblage: assemblageReel(m) }));
    const e = await jusquAuBout(etatInitialIV(demandeEssai(carte)), o);
    expect(e.etape).toBe("prete");
    // Les pistes de l'assemblage, refaites sur le même état de voix : au bout, 4 versions (une par fin, LinkedIn = corps).
    const pistes = await assemblerVersionsIV(e.voix!, o.assemblage);
    expect(pistes.length).toBe(e.voix!.segments.versions.length);
    for (const p of pistes) expect(lireWav(m.sons.get(p.cle)!).frequence).toBe(48000);

    // Mutation : les mêmes sons, le même plan, mais les silences au seuil fixe −45 dB.
    const sons = sonsBrutsIV(e.voix!);
    const v = e.voix!.segments.versions[0];
    const fin = v.segment ? sons.fins[v.segment] : undefined;
    const wav = async (cle: string) => lireWav(m.sons.get(cleWavDuBrut(cle))!);
    const fixe = { corps: silencesMesures(await wav(sons.corps.fichierCle)), ...(fin ? { fin: silencesMesures(await wav(fin.fichierCle)) } : {}) };
    const adapte = { corps: silencesIV(await wav(sons.corps.fichierCle)).silences, ...(fin ? { fin: silencesIV(await wav(fin.fichierCle)).silences } : {}) };
    const durees = { corps: sons.corps.dureeSec, ...(fin ? { fin: fin.dureeSec } : {}) };
    const hors = (s: typeof fixe) => {
      const { plan } = recalerCoupesSurSilences(planRaccordVoix(sons.corps, fin), { corps: sons.corps.mots, ...(fin ? { fin: fin.mots } : {}) }, { 0: s.corps, ...(s.fin ? { 1: s.fin } : {}) });
      return coupesEnPleinSon(plan, s, durees);
    };
    expect(hors(adapte)).toEqual([]);
    expect(hors(fixe).length).toBeGreaterThan(5);
  });

  it("reprise depuis l'état EXACT de la prod (voix faite, assemblage arrêté « en plein son ») : proposée, 0 lecture, 0 réservation de voix, vidéo au bout", async () => {
    // L'état de la prod : les pauses mesurées ne sont jamais silencieuses (ici, bruit ajouté au WAV converti) → refus.
    const m = monde();
    const carte = carteFixe("A");
    const o = outilsSimules(carte, m, bruite({ assemblage: { ...assemblageReel(m), convertirEnWav: async (x) => plusBruit(await convertirSonEnWavParFfmpeg(x), -28), rangerSon: async () => {} } }));
    let etat = await jusquAuBout(etatInitialIV(demandeEssai(carte)), o);
    expect(etat.etape).toBe("refusee");
    expect(etat.refus).toMatchObject({ etape: "voix", code: "IV_VOIX", reessayable: false });
    expect(etat.refus!.message).toMatch(/^Voix \(youtube-shorts\) · la coupe à \d+,\d\d s du son du corps tombe en plein son, hors de tout silence mesuré( \(\d+ coupes dans ce cas\))? : la voix n'est jamais coupée ailleurs que dans un silence\. Détail \(coupe : niveau, seuil, silence le plus proche ; recherche à ±0,25 s\) : corps \d+,\d\d s : −\d+,\d dB, seuil −\d+,\d dB, (silence le plus proche à \d+,\d\d s \(\d+,\d\d s → \d+,\d\d s\)|aucun silence mesuré dans ce son)( ; .+)?\.$/);
    expect(etat.voix?.issue?.statut).toBe("faite");
    expect(etat.pistes).toBeUndefined();
    // Phrase EXACTE de la prod : même forme, reconnue.
    const prod = structuredClone(etat);
    prod.refus!.message = "Voix (youtube-shorts) · la coupe à 2,52 s du son du corps tombe en plein son, hors de tout silence mesuré (26 coupes dans ce cas) : la voix n'est jamais coupée ailleurs que dans un silence.";
    expect(refusReessayableIV(prod)).toBe(true);
    expect(vueFabrication(prod).refus?.reessayable).toBe(true);
    expect(vueFabrication(prod).refus?.phrase).toBe(prod.refus!.message);

    // En prod, les WAV convertis (justes) sont rangés : la reprise les relit, sans reconversion.
    for (const k of [...m.sons.keys()].filter((x) => /^brut-\d+\.mp3$/.test(x))) m.sons.set(cleWavDuBrut(k), await convertirSonEnWavParFfmpeg(m.sons.get(k)!));
    const lus = m.lus.length;
    const mesures = m.mesures;
    const reservationsVoix = prod.caisse.reservations.filter((r) => r.etape === "voix").length;
    const ordreAvant = m.ordre.length;
    const mp3 = new Map([...m.sons].filter(([k]) => k.endsWith(".mp3")).map(([k, v]) => [k, Buffer.from(v).toString("base64")]));
    const compte = { conversions: 0 };
    const o2 = outilsSimules(carte, m, bruite({ assemblage: assemblageReel(m, compte) }));
    const repris = reprendreIV(prod);
    expect(repris.etape).toBe("voix");
    etat = await jusquAuBout(repris, o2);
    expect(etat.refus?.message).toBeUndefined();
    expect(etat.etape).toBe("prete");
    expect(etat.livraison?.map((l) => l.reseau)).toEqual(["youtube-shorts", "linkedin", "instagram", "facebook"]);
    expect(m.lus.length).toBe(lus);
    expect(m.mesures).toBe(mesures);
    expect(m.ordre.slice(ordreAvant).filter((x) => x === "heygen" || x.startsWith("réserve iv-voix"))).toEqual([]);
    expect(etat.caisse.reservations.filter((r) => r.etape === "voix")).toHaveLength(reservationsVoix);
    expect(compte.conversions).toBe(0);
    expect(new Map([...m.sons].filter(([k]) => k.endsWith(".mp3")).map(([k, v]) => [k, Buffer.from(v).toString("base64")]))).toEqual(mp3);
  });

  it("un refus « en plein son » AVANT que la voix soit faite, ou d'une autre étape, n'est pas rendu réessayable par cette règle", () => {
    const message = "Voix (youtube-shorts) · la coupe à 2,52 s du son du corps tombe en plein son, hors de tout silence mesuré.";
    const base = { refus: { etape: "voix" as const, code: "IV_VOIX" as const, message, reessayable: false }, voix: { issue: { statut: "refus" as const, controle: "Q16" as const, message: "x" }, voix: { corps: {}, fins: [] } } };
    expect(refusReessayableIV(base as unknown as Parameters<typeof refusReessayableIV>[0])).toBe(false);
    const autre = { ...base, refus: { ...base.refus, etape: "controles" as const, code: "IV_CONTROLES" as const }, voix: { ...base.voix, issue: { statut: "faite" as const } } };
    expect(refusReessayableIV(autre as unknown as Parameters<typeof refusReessayableIV>[0])).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Répétition générale                                                   */
/* ------------------------------------------------------------------ */

describe.skipIf(!FFMPEG_PRESENT)("RÉPÉTITION GÉNÉRALE : bruts MP3 bruités, vraie recette, rendu, écoute, contrôles, 5 versions (Facebook en repli Instagram)", () => {
  // Fins de secours et replis : voix payée en segments séparés (« voix-iv/1 »).
  beforeAll(() => {
    reglageVoix.lectureUnique = false;
    reglageFins.avant = true;
  });
  afterAll(() => {
    reglageVoix.lectureUnique = true;
    reglageFins.avant = false;
  });
  const HORS = (facteur: number, dyn = 1) => ({ ...Object.fromEntries(Object.entries({ ...REFERENCE_V4_IV, hauteurHz: REFERENCE_V4_IV.hauteurHz * facteur, dynamique: REFERENCE_V4_IV.dynamique * dyn }).map(([k, v]) => [`voix.${k}`, v])), "voix.versionMesure": VERSION_MESURE_VOIX });
  const FIN_FB = "Le lien est en commentaire.";
  const SECOURS = "Le lien est dans le premier commentaire.";
  const SECOURS_2 = "Le lien est juste sous la vidéo.";
  const REPLI = "Facebook reprend la version Instagram : la voix des fins Facebook ne ressemblait pas à la référence.";

  it("de la carte à la livraison, avec les arrêts et reprises de la prod : vidéo prête pour les 5 réseaux", async () => {
    const ref: { m?: Monde } = {};
    const mesure = () => {
      const t = ref.m!.lus.at(-1)!;
      if (t.endsWith(FIN_FB) || t.endsWith(SECOURS_2)) return HORS(1.17);
      return t.endsWith(SECOURS) ? HORS(1.24, 1.202) : MESURE_REFERENCE;
    };
    const m = monde();
    ref.m = m;
    const carte = carteFixe("C");
    const compte = { conversions: 0 };
    const serveur = new ServeurDouble({ enCours: 1 });
    // Parcours où chaque fin de secours attend « Refaire cette partie » (le parcours automatique est testé ailleurs).
    const o = { ...outilsAvecRendu(m, serveur, outilsSimules(carte, m, bruite({ mesureVoix: mesure, assemblage: assemblageReel(m, compte) }))), secoursAutomatique: false };

    let etat = await jusquAuBout(etatInitialIV(demandeEssai(carte, { appelCommentaire: "question-puis-fin" })), o);
    const arrets: string[] = [];
    for (let i = 0; i < 4 && etat.etape === "refusee"; i++) {
      arrets.push(etat.refus!.message);
      expect(refusReessayableIV(etat)).toBe(true);
      etat = await jusquAuBout(reprendreIV(etat), o);
    }
    expect(etat.refus?.message).toBeUndefined();
    expect(etat.etape).toBe("prete");
    // Les arrêts sont ceux de la voix Facebook (habituelle, secours 1), jamais l'assemblage ni l'écoute.
    expect(arrets).toHaveLength(2);
    for (const a of arrets) expect(a).toMatch(/facebook ne ressemble pas/);
    expect(etat.journal.join(" ")).toContain(REPLI);

    // 5 versions livrées, Facebook = Instagram.
    expect(etat.livraison?.map((l) => l.reseau)).toEqual(["youtube-shorts", "linkedin", "instagram", "facebook"]);
    expect(etat.livraison!.find((l) => l.reseau === "facebook")!.mention).toBe(REPLI);
    const fb = etat.plan!.fins.find((f) => f.reseaux.includes("facebook"))!;
    expect(fb.repli).toBe("instagram");

    // Contrôles finaux et écoute (Q17/Q19) passés sur les vraies pistes (WAV 48 kHz de la recette).
    expect(etat.controles?.verdict?.ok).toBe(true);
    expect(etat.pistes!.length).toBeGreaterThanOrEqual(3);
    for (const p of etat.pistes!) {
      const son = lireWav(m.sons.get(p.cle)!);
      expect(son.frequence).toBe(48000);
      expect(p.finVoixSec).toBeLessThanOrEqual(p.dureeSec);
    }
    expect(serveur.montages().length).toBeGreaterThanOrEqual(4);
    // Chaque brut converti une fois (rangé), jamais relu chez HeyGen au-delà des lectures de la chaîne de secours.
    const bruts = [...m.sons.keys()].filter((k) => /^brut-\d+\.mp3$/.test(k));
    expect(compte.conversions).toBe(new Set(bruts.filter((b) => m.sons.has(cleWavDuBrut(b)))).size);
  });
});

/* ------------------------------------------------------------------ */
/* Répétition générale · lecture unique (20/10)                           */
/* ------------------------------------------------------------------ */

describe.skipIf(!FFMPEG_PRESENT)("RÉPÉTITION GÉNÉRALE · lecture unique : bruts MP3 bruités, vraie recette, une seule lecture, versions taillées", () => {
  it("Shorts, Facebook + LinkedIn, Instagram : corps + partie commune + SA phrase du lien (les autres phrases sautées) ; coupes, durées, mots, aucun son abîmé", async () => {
    const m = monde();
    const carte = carteFixe("C");
    const compte = { conversions: 0 };
    const o = outilsSimules(carte, m, bruite({ assemblage: assemblageReel(m, compte) }));
    const etat = await jusquAuBout(etatInitialIV(demandeEssai(carte)), o);
    expect(etat.refus?.message).toBeUndefined();
    expect(etat.etape).toBe("prete");

    // Une seule lecture HeyGen, d'un trait, et un seul brut converti.
    const voix = etat.voix!;
    expect(voix.version).toBe("voix-iv/2");
    expect(m.lus).toEqual([voix.segments.corps]);
    expect(compte.conversions).toBe(1);
    const lecture = voix.segments.lecture!;
    const lus = motsDits(voix.segments.corps);
    const attendus = (id: string) => [...lus.slice(0, lecture.motsCorps), ...(lecture.fins[id] ?? []).flatMap(([a, b]) => lus.slice(a, b))];

    const pistes = etat.pistes!.filter((p) => !p.courte);
    expect(pistes.map((p) => p.version)).toEqual(voix.segments.versions.map((v) => v.id));
    for (const p of pistes) {
      // Les mots dits : exactement le corps puis la fin de cette version, rien d'autre (aucun mot perdu, aucun mot de trop).
      expect(p.mots.map((x) => x.mot), p.version).toEqual(attendus(p.version));
      expect(p.motsCorps).toBe(lecture.motsCorps);
      // La durée annoncée est celle du fichier rendu.
      const son = lireWav(m.sons.get(p.cle)!);
      expect(son.echantillons.length / son.frequence).toBeCloseTo(p.dureeSec, 1);
      // Aucune coupe nette : la dernière parole est suivie de silence jusqu'à la fin du fichier (contrôle Q19 de l'assemblage).
      // (la recette remonte aussi le bruit de fond : on compare à la parole de la même piste, 10 dB au moins plus bas)
      const niv = niveauxDb(son, FEN);
      const parole = niv.slice(Math.ceil(p.mots[0].debutSec / FEN), Math.floor(p.mots.at(-1)!.finSec / FEN)).sort((x, y) => x - y);
      const mediane = parole[Math.floor(parole.length / 2)];
      const dernier = p.mots.at(-1)!;
      const fin = niv.slice(Math.ceil((dernier.finSec + 0.1) / FEN), Math.floor(Math.min(p.dureeSec, dernier.finSec + 0.4) / FEN));
      expect(fin.length).toBeGreaterThan(0);
      for (const d of fin) expect(d).toBeLessThan(mediane - 10);
    }
    const [li] = pistes.filter((p) => p.reseaux.includes("linkedin"));
    const [ig] = pistes.filter((p) => p.reseaux.includes("instagram"));
    const [fb] = pistes.filter((p) => p.reseaux.includes("facebook"));
    // LinkedIn dit la fin comme les autres (26/10/2026) et partage la version de Facebook (même phrase du lien).
    expect(li.mots.length).toBeGreaterThan(li.motsCorps);
    expect(li.raccordSec).toBeDefined();
    expect(li.version).toBe(fb.version);
    // Instagram : le corps, la partie commune, sa phrase.
    expect(ig.mots.length).toBeGreaterThan(ig.motsCorps);
    // Facebook : sa phrase propre à la place de celle d'Instagram ; le blanc laissé par la phrase sautée est silencieux.
    expect(fb.mots.map((x) => x.mot)).not.toEqual(ig.mots.map((x) => x.mot));
    const [commun] = lecture.fins[fb.version];
    const iPhrase = lecture.motsCorps + (commun[1] - commun[0]);
    const trou = [fb.mots[iPhrase - 1].finSec + 0.03, fb.mots[iPhrase].debutSec - 0.03];
    expect(trou[1] - trou[0]).toBeGreaterThan(0.03);
    const son = lireWav(m.sons.get(fb.cle)!);
    const nivFb = niveauxDb(son, FEN);
    const paroleFb = nivFb.slice(Math.ceil(fb.mots[0].debutSec / FEN), Math.floor(fb.mots.at(-1)!.finSec / FEN)).sort((x, y) => x - y);
    for (const d of nivFb.slice(Math.ceil(trou[0] / FEN), Math.floor(trou[1] / FEN))) expect(d).toBeLessThan(paroleFb[Math.floor(paroleFb.length / 2)] - 10);
    // Les pistes qui disent la même chose sont identiques.
    expect(new Set(pistes.map((p) => p.empreinte)).size).toBe(new Set(pistes.map((p) => JSON.stringify(lecture.fins[p.version] ?? []))).size);
    expect(etat.controles?.verdict?.ok).toBe(true);
  });
});
